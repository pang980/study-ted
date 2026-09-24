// Electron 부팅 스모크 테스트.
// 렌더러의 실제 IPC 브리지를 통해 시나리오를 실행하고, 화면을 PNG 로 남긴다.
// 실행: npm run smoke
process.env.STUDY_TED_SMOKE = '1';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// 화면 밖 창은 Windows 오클루전 감지로 '가려짐' 처리되어 capturePage 가 실패할 수 있다.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

const rootDir = path.join(__dirname, '..');
const tmpDir = path.join(rootDir, '_tmp');
const userDataDir = path.join(tmpDir, 'smoke-userdata');

// 스모크는 사용자의 실제 DB 를 건드리면 안 되므로 임시 userData 를 쓴다.
fs.mkdirSync(userDataDir, { recursive: true });
app.setPath('userData', userDataDir);

const main = require('../main/main.js');
const db = require('../main/db');

const VIEW_IDS = ['home', 'channels', 'learn', 'notes', 'materials', 'share', 'settings'];

// 각 뷰가 실제 데이터로 그려졌는지 확인하는 표현식.
const VIEW_PROBES = {
  home: "(() => { const q = (s) => document.querySelectorAll(s).length; return { cards: q('.thumb-grid .video-card'), lines: q('.transcript-line'), table: q('.data-table tbody tr'), title: (document.querySelector('.view__title')||{}).textContent || null }; })()",
  channels: "(() => { const q = (s) => document.querySelectorAll(s).length; const stop = Array.from(document.querySelectorAll('.btn--danger')).map((b) => b.textContent.trim()); return { cards: q('.card'), rows: q('.list-row'), channelRows: q('.list-row .list-row__title'), counts: q('.channel-counts'), countText: (document.querySelector('.channel-counts') || {}).textContent || null, stopButtons: stop }; })()",
  learn: "(() => { const q = (s) => document.querySelectorAll(s).length; const countEl = document.querySelector('.picker-count'); return { picker: q('.picker-item'), modes: q('.mode-switch__btn'), thumbs: q('.picker-item .thumb'), titles: q('.picker-item__title'), search: q('.picker-search'), pager: q('.picker-pager'), countText: countEl ? (countEl.textContent || '') : null }; })()",
  notes: "(() => { const q = (s) => document.querySelectorAll(s).length; const details = q('.data-table tbody tr.is-detail'); const bodyRows = q('.data-table tbody tr') - details; return { table: bodyRows, rows: bodyRows, details, cards: q('.data-table tbody tr.is-detail .analysis'), summaries: q('.data-table .analysis-summary'), toggleButtons: [...document.querySelectorAll('.data-table button')].filter((b) => (b.textContent || '').trim() === '분석 보기').length }; })()",
  materials: "(() => { const q = (s) => document.querySelectorAll(s).length; return { groups: q('.material-group'), rows: q('.listbox .list-row') }; })()",
  share: "(() => { const q = (s) => document.querySelectorAll(s).length; return { chips: q('.chip-row .chip'), selects: q('.select') }; })()",
  settings: "(() => { const q = (s) => document.querySelectorAll(s).length; return { cards: q('.card'), hasOpenRouter: document.body.textContent.includes('OpenRouter'), inputs: q('.input'), modelSearch: q('.input--search'), valueList: q('.model-list--value'), modelRows: q('.model-row'), valueNote: (document.querySelector('.model-list--value') || {}).textContent || null }; })()",
};

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name} :: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

function expect(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  record(name, ok, ok ? actual : `기대 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(actual)}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(win, expression, timeout = 8000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const ok = await win.webContents.executeJavaScript(expression, true);
      if (ok) return true;
    } catch {
      // 렌더러가 아직 준비되지 않았으면 다시 시도한다.
    }
    if (Date.now() > deadline) return false;
    // eslint-disable-next-line no-await-in-loop
    await sleep(150);
  }
}

const BRIDGE_SCRIPT = `(async () => {
  const bridge = window.studyTed;
  const steps = [];
  const unwrap = (result) => {
    if (result && result.ok) return result.data;
    const error = new Error(result && result.error ? result.error.message : 'IPC 오류');
    error.code = result && result.error ? result.error.code : 'UNKNOWN';
    throw error;
  };
  const call = (fn) => Promise.resolve().then(fn).then(unwrap);
  const step = async (name, fn, expectError) => {
    try { steps.push({ name, ok: true, value: await fn() }); }
    catch (error) {
      const entry = { name, ok: false, code: error.code || null, message: error.message };
      if (expectError) entry.expectError = expectError;
      steps.push(entry);
    }
  };

  let channelPk = null;
  let createdPk = null;

  await step('app.info', async () => {
    const info = await call(() => bridge.app.info());
    return {
      version: info.version,
      electron: info.electron,
      counts: info.counts,
      provider: info.settings.provider,
      collectLimit: info.settings.collectLimit,
      hasKey: info.settings.hasKey,
      ytdlpAvailable: Boolean(info.collect && info.collect.ytdlp && info.collect.ytdlp.available),
    };
  });

  await step('collect.status', async () => {
    const status = await call(() => bridge.collect.status());
    return { preference: status.preference, hasYtdlpBlock: Boolean(status.ytdlp) };
  });

  await step('demo.seed(true)', async () => {
    const seeded = await call(() => bridge.demo.seed(true));
    return { seeded: seeded.seeded, added: seeded.added, counts: seeded.counts };
  });

  await step('channels.list', async () => {
    const list = await call(() => bridge.channels.list());
    channelPk = list.length ? list[0].pk : null;
    return {
      count: list.length,
      title: list[0] && list[0].title,
      subscriberText: list[0] && list[0].subscriberText,
      videoCountText: list[0] && list[0].videoCountText,
      savedVideoCount: list[0] && list[0].savedVideoCount,
      savedTranscriptCount: list[0] && list[0].savedTranscriptCount,
      savedSentenceCount: list[0] && list[0].savedSentenceCount,
    };
  });

  await step('videos.list', async () => {
    const list = await call(() => bridge.videos.list({ channelPk, limit: 200 }));
    return { count: list.length, withTranscript: list.filter((video) => video.hasTranscript).length, firstTitle: list[0] && list[0].title, channelTitle: list[0] && list[0].channelTitle };
  });

  await step('videos.page', async () => {
    const page = await call(() => bridge.videos.page({ channelPk, limit: 50, offset: 0 }));
    const filtered = await call(() => bridge.videos.page({ channelPk, q: 'Airport', limit: 50, offset: 0 }));
    return { items: page.items.length, total: page.total, hasMore: page.hasMore, offset: page.offset, limit: page.limit, filtered: filtered.items.length, filteredTotal: filtered.total };
  });

  await step('videos.get', async () => {
    const detail = await call(() => bridge.videos.get('demoVideo001'));
    return { title: detail.video.title, segments: detail.transcript ? detail.transcript.segments.length : 0, sentences: detail.sentences.length, firstSegment: detail.transcript ? detail.transcript.segments[0].text : null };
  });

  await step('videos.get(없는 동영상)', async () => {
    await call(() => bridge.videos.get('noSuchVideo'));
    return { unexpected: true };
  }, 'NOT_FOUND');

  await step('sentences.list', async () => {
    const list = await call(() => bridge.sentences.list({ limit: 100 }));
    return { total: list.total, firstFavorite: list.items[0].isFavorite, firstStartSec: list.items[0].startSec };
  });

  await step('sentences.create', async () => {
    const created = await call(() => bridge.sentences.create({ sentence: 'Smoke test sentence.', translation: '스모크 테스트 문장.', source: 'manual' }));
    createdPk = created.sentence.pk;
    return { pk: createdPk, counts: created.counts };
  });

  await step('sentences.favorite', async () => {
    const updated = await call(() => bridge.sentences.favorite(createdPk));
    return { isFavorite: updated.isFavorite };
  });

  await step('sentences.update', async () => {
    const updated = await call(() => bridge.sentences.update(createdPk, { translation: '수정된 해석' }));
    return { translation: updated.translation };
  });

  await step('sentences.study', async () => {
    const updated = await call(() => bridge.sentences.study(createdPk));
    return { studyCount: updated.studyCount };
  });

  await step('sentences.remove', async () => {
    const removed = await call(() => bridge.sentences.remove(createdPk));
    return { removed: removed.removed, counts: removed.counts };
  });

  await step('settings.update', async () => {
    const settings = await call(() => bridge.settings.update({ provider: 'ytdlp', collectLimit: 25, withSubtitles: false, model: 'openai/gpt-4o-mini' }));
    return { provider: settings.provider, collectLimit: settings.collectLimit, withSubtitles: settings.withSubtitles, model: settings.model };
  });

  await step('settings.update(잘못된 값)', async () => {
    const settings = await call(() => bridge.settings.update({ provider: 'nope', lastView: 'hack' }));
    return { provider: settings.provider, collectLimit: settings.collectLimit, lastView: settings.lastView };
  });

  await step('settings.update(범위 초과)', async () => {
    await call(() => bridge.settings.update({ collectLimit: 9999 }));
    return { unexpected: true };
  }, 'VALIDATION');

  await step('settings.update(refreshExisting)', async () => {
    const off = await call(() => bridge.settings.update({ refreshExisting: false }));
    const on = await call(() => bridge.settings.update({ refreshExisting: true }));
    return { off: off.refreshExisting, on: on.refreshExisting };
  });

  await step('settings.setApiKey(형식 오류)', async () => {
    await call(() => bridge.settings.setApiKey('not-a-key'));
    return { unexpected: true };
  }, 'VALIDATION');

  await step('share.export(json)', async () => {
    const result = await call(() => bridge.share.export({ format: 'json', scope: 'all', savePath: window.__smokeJson }));
    return { canceled: result.canceled, path: result.path, counts: result.counts };
  });

  await step('share.export(md/즐겨찾기)', async () => {
    const result = await call(() => bridge.share.export({ format: 'md', scope: 'favorites', savePath: window.__smokeMd }));
    return { canceled: result.canceled, path: result.path, counts: result.counts };
  });

  await step('share.import', async () => {
    const result = await call(() => bridge.share.import({ filePath: window.__smokeJson }));
    return { canceled: result.canceled, summary: result.summary, counts: result.counts };
  });

  return steps;
})()`;

async function runBridge(win) {
  await win.webContents.executeJavaScript(
    `window.__smokeJson = ${JSON.stringify(path.join(tmpDir, 'smoke-export.json'))}; window.__smokeMd = ${JSON.stringify(path.join(tmpDir, 'smoke-export.md'))}; true;`,
    true,
  );
  const steps = await win.webContents.executeJavaScript(BRIDGE_SCRIPT, true);
  for (const item of steps) {
    if (!item.ok) {
      const detail = `오류 코드 ${item.code} :: ${item.message}`;
      const expected = Boolean(item.expectError) && item.expectError === item.code;
      record(`bridge:${item.name}`, expected, expected ? detail : `기대 코드 ${item.expectError} / ${detail}`);
      continue;
    }
    record(`bridge:${item.name}`, true, item.value);
  }
  return steps;
}

// 기대값 검증은 브리지 결과를 다시 읽어서 수행한다.
function evaluate(results) {
  const by = (name) => results.find((item) => item.name === name);

  const info = by('app.info');
  expect('시드 전 채널 0개', info.value.counts.channels, 0);
  expect('OpenRouter 키 없음 상태', info.value.hasKey, false);

  const seeded = by('demo.seed(true)');
  expect('데모 시딩 결과', seeded.value.added, { channels: 1, videos: 4, transcripts: 1, sentences: 4 });

  const channels = by('channels.list');
  expect('채널 1개', channels.value.count, 1);
  expect('채널 제목', channels.value.title, 'English with Emma');
  // 채널 목록은 채널별 수집 개수(동영상/자막/문장)를 함께 돌려준다.
  expect('채널 수집 동영상 수', channels.value.savedVideoCount, 4);
  expect('채널 저장 자막 수', channels.value.savedTranscriptCount, 1);
  expect('채널 저장 문장 수', channels.value.savedSentenceCount, 4);

  const videos = by('videos.list');
  expect('동영상 4개', videos.value.count, 4);
  expect('자막 보유 동영상 1개', videos.value.withTranscript, 1);

  // 2000편이 넘어도 목록은 페이지 단위로만 받는다(총계와 다음 페이지 여부를 함께 확인).
  const paged = by('videos.page');
  expect('동영상 페이지 항목 4개', paged.value.items, 4);
  expect('동영상 전체 개수', paged.value.total, 4);
  expect('동영상 페이지 offset/limit', { offset: paged.value.offset, limit: paged.value.limit }, { offset: 0, limit: 50 });
  expect('동영상 다음 페이지 없음', paged.value.hasMore, false);
  expect('동영상 검색 결과 1개', { items: paged.value.filtered, total: paged.value.filteredTotal }, { items: 1, total: 1 });

  const detail = by('videos.get');
  expect('자막 세그먼트 15개', detail.value.segments, 15);
  expect('영상 저장 문장 2개', detail.value.sentences, 2);

  const list = by('sentences.list');
  expect('시드 문장 4개', list.value.total, 4);

  const created = by('sentences.create');
  expect('문장 생성 후 5개', created.value.counts.sentences, 5);

  expect('즐겨찾기 토글', by('sentences.favorite').value.isFavorite, true);
  expect('문장 수정', by('sentences.update').value.translation, '수정된 해석');
  expect('학습 횟수 1', by('sentences.study').value.studyCount, 1);
  expect('문장 삭제', by('sentences.remove').value.removed, 1);
  expect('문장 삭제 후 4개', by('sentences.remove').value.counts.sentences, 4);

  expect('설정 저장', by('settings.update').value, { provider: 'ytdlp', collectLimit: 25, withSubtitles: false, model: 'openai/gpt-4o-mini' });
  expect('설정 검증 폴백', by('settings.update(잘못된 값)').value, { provider: 'auto', collectLimit: 25, lastView: 'home' });
  expect('설정 범위 초과 거부', by('settings.update(범위 초과)').code, 'VALIDATION');
  expect('설정 refreshExisting 저장', by('settings.update(refreshExisting)').value, { off: false, on: true });

  const exported = by('share.export(json)');
  expect('JSON 내보내기 문장 수', exported.value.counts.sentences, 4);
  const exportedMd = by('share.export(md/즐겨찾기)');
  expect('즐겨찾기 내보내기 1개', exportedMd.value.counts.sentences, 1);

  const imported = by('share.import');
  expect('가져오기 중복 병합', { added: imported.value.summary.added, merged: imported.value.summary.merged }, { added: 0, merged: 4 });
}

// capturePage 는 창이 아직 페인트되지 않았으면 실패할 수 있으므로 재시도한다.
async function captureView(win, target) {
  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const image = await win.webContents.capturePage();
      const buffer = image.toPNG();
      fs.writeFileSync(path.join(tmpDir, target), buffer);
      return { ok: true, buffer };
    } catch (error) {
      lastError = error;
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(400);
  }
  return { ok: false, error: lastError };
}

async function runViewChecks(win) {
  for (const id of VIEW_IDS) {
    // eslint-disable-next-line no-await-in-loop
    const clicked = await win.webContents.executeJavaScript(
      `(() => { const button = document.querySelector('.nav__item[data-view="${id}"]'); if (!button) return false; button.click(); return true; })()`,
      true,
    );
    if (!clicked) {
      record(`view:${id}`, false, 'nav 버튼을 찾지 못했습니다.');
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await waitFor(win, "document.querySelector('#content .view') !== null", 4000);
    // eslint-disable-next-line no-await-in-loop
    await sleep(350);
    // eslint-disable-next-line no-await-in-loop
    const probe = await win.webContents.executeJavaScript(VIEW_PROBES[id], true);
    record(`view:${id}`, Boolean(probe), probe);
    if (id === 'home') {
      // 홈 상단에는 현재 버전과 업데이트 상태, 바로 실행할 수 있는 버튼이 보여야 한다.
      // eslint-disable-next-line no-await-in-loop
      const banner = await win.webContents.executeJavaScript(
        `(() => {
           const box = document.querySelector('.update-banner');
           if (!box) return { found: false };
           const text = (box.textContent || '').replace(/\\s+/g, ' ').trim();
           return {
             found: true,
             version: /v?\\d+\\.\\d+\\.\\d+/.test(text),
             text,
             buttons: [...box.querySelectorAll('button')].map((b) => (b.textContent || '').trim()),
             hidden: [...box.querySelectorAll('button')].filter((b) => b.hidden).length,
           };
         })()`,
        true,
      );
      record('view:home 버전 표시', Boolean(banner.found && banner.version), banner.text);
      record(
        'view:home 업데이트 버튼',
        Boolean(
          banner.found
            && banner.buttons.includes('업데이트 확인')
            && banner.buttons.includes('업데이트 설정')
            && banner.buttons.length >= 3,
        ),
        banner.buttons,
      );
    }
    if (id === 'learn') {
      // 동영상 선택 목록은 썸네일 + 제목이 함께 보여야 한다.
      record('view:learn 썸네일', probe.thumbs > 0 && probe.thumbs === probe.picker, `${probe.thumbs}/${probe.picker}`);
      // 2000편이 넘어도 페이지 단위로만 그리도록 검색과 페이지 이동이 함께 있어야 한다.
      record('view:learn 검색/페이징', probe.search === 1 && probe.pager === 1 && probe.picker > 0, `검색 ${probe.search} / 페이저 ${probe.pager} :: ${probe.countText}`);
      // 검색어를 넣으면 그 결과만, 지우면 원래 목록이 돌아와야 한다(메인에서 걸러 온다).
      // eslint-disable-next-line no-await-in-loop
      const searched = await win.webContents.executeJavaScript(
        `(async () => {
           const input = document.querySelector('.picker-search');
           const count = () => document.querySelectorAll('.picker-item').length;
           const label = () => (((document.querySelector('.picker-count') || {}).textContent) || '').trim();
           if (!input) return { ok: false, reason: '검색 입력 없음' };
           const before = count();
           const type = (value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
           const settle = async (want) => {
             for (let i = 0; i < 100; i += 1) {
               await new Promise((resolve) => setTimeout(resolve, 50));
               if (count() === want) return true;
             }
             return false;
           };
           type('Airport');
           const hit = await settle(1);
           const hitLabel = label();
           type('zzzz-no-such-video');
           const none = await settle(0);
           const noneLabel = label();
           type('');
           const restored = await settle(before);
           // 검색 입력과 페이지 버튼이 좁은 픽커 카드 안에서 서로 겹치지 않아야 한다.
           const card = input.closest('.card__body');
           let layout = null;
           if (card) {
             const cb = card.getBoundingClientRect();
             const sb = input.getBoundingClientRect();
             const prev = document.querySelector('.picker-pager > .btn');
             const next = document.querySelector('.picker-pager > .btn:last-child');
             const pb = prev ? prev.getBoundingClientRect() : null;
             const nb = next ? next.getBoundingClientRect() : null;
             layout = {
               cardW: Math.round(cb.width),
               searchW: Math.round(sb.width),
               searchInside: sb.left >= cb.left - 0.5 && sb.right <= cb.right + 0.5 && sb.width > 100,
               pagerInside: Boolean(pb && nb) && pb.left >= cb.left - 0.5 && nb.right <= cb.right + 0.5,
               overlap: Boolean(pb && nb) && pb.right > nb.left + 0.5,
             };
           }
           return { ok: true, before, hit, hitLabel, none, noneLabel, restored, after: count(), afterLabel: label(), layout };
         })()`,
        true,
      );
      record(
        'view:learn 검색/페이저 배치',
        Boolean(searched.ok) && Boolean(searched.layout) && searched.layout.searchInside === true && searched.layout.pagerInside === true && searched.layout.overlap === false,
        searched.layout ?? searched,
      );
      record(
        'view:learn 제목 검색',
        Boolean(searched.ok) && searched.hit === true && searched.none === true && searched.restored === true && String(searched.hitLabel).includes('검색 결과'),
        searched.ok
          ? { before: searched.before, hitLabel: searched.hitLabel, noneLabel: searched.noneLabel, after: searched.after, afterLabel: searched.afterLabel }
          : searched,
      );
    }
    if (id === 'channels') {
      // 채널 줄마다 수집 개수(동영상·자막·문장)를 표시한다.
      record('view:channels 수집 개수 표시', probe.channelRows > 0 && probe.counts === probe.channelRows, `${probe.counts}/${probe.channelRows} :: ${probe.countText}`);
      // 2000개 이상 수집 중에도 바로 누를 수 있는 정지 버튼이 있어야 한다.
      record('view:channels 정지 버튼', Array.isArray(probe.stopButtons) && probe.stopButtons.includes('수집 정지'), (probe.stopButtons || []).join(' / '));
    }
    if (id === 'notes') {
      // 저장된 AI 분석(문장 해석·구문 분석)이 목록에서 바로 보이고 펼칠 수 있어야 한다.
      record(
        'view:notes 분석 표시',
        probe.details > 0 && probe.cards === probe.details && probe.toggleButtons === probe.details && probe.summaries === probe.details,
        `상세 ${probe.details} / 카드 ${probe.cards} / 버튼 ${probe.toggleButtons} / 요약 ${probe.summaries}`,
      );
      // eslint-disable-next-line no-await-in-loop
      const toggled = await win.webContents.executeJavaScript(
        `(() => {
           const btn = [...document.querySelectorAll('.data-table button')].find((b) => (b.textContent || '').trim() === '분석 보기');
           if (!btn) return { ok: false, reason: '분석 보기 버튼 없음' };
           const detail = btn.closest('tr').nextElementSibling;
           if (!detail || !detail.classList.contains('is-detail')) return { ok: false, reason: '상세 행 없음' };
           const before = detail.hidden;
           btn.click();
           const after = detail.hidden;
           const text = (detail.textContent || '');
           const card = Boolean(detail.querySelector('.analysis'));
           // 구문(part)은 영어로 나와야 한다. 모델이 한국어로 채우면 화면이 전부 한국어로 보인다.
           const parts = [...detail.querySelectorAll('.analysis__part')].map((el) => (el.textContent || '').trim());
           const englishParts = parts.length > 0 && parts.every((value) => /[A-Za-z]/.test(value));
           // 구문마다 한국어 뜻이 함께 보여야 한다. 영어 단어만 있으면 무슨 뜻인지 알 수 없다.
           const meanings = [...detail.querySelectorAll('.analysis__meaning')].map((el) => (el.textContent || '').trim());
           const missingMeanings = detail.querySelectorAll('.analysis__missing').length;
           const meaningOk = parts.length > 0 && meanings.length === parts.length && missingMeanings === 0 && meanings.every((value) => /[가-힣]/.test(value));
           // AI 원문 응답은 사용자에게 필요 없어 카드에서 뺐다.
           const rawBox = detail.querySelector('.analysis__raw');
           return { ok: true, before, after, card, text, englishParts, parts, meanings, missingMeanings, meaningOk, rawBox: Boolean(rawBox), rawTitle: text.includes('AI 원문 응답') };
         })()`,
        true,
      );
      record(
        'view:notes 분석 펼치기',
        Boolean(toggled.ok) && toggled.before === true && toggled.after === false && toggled.card === true && toggled.text.includes('구문 분석'),
        toggled.ok ? { before: toggled.before, after: toggled.after, card: toggled.card, text: toggled.text.slice(0, 60) } : toggled,
      );
      // 구문(part)이 한국어로 저장되면 카드가 전부 한국어로 보인다. 영어 구문만 나와야 한다.
      record(
        'view:notes 구문 영어 표시',
        Boolean(toggled.ok) && toggled.englishParts === true,
        toggled.ok ? toggled.parts.slice(0, 3).join(' / ') : toggled,
      );
      // 약한 모델이 남긴 "영어 단어만 있는 구문"이 화면에 그대로 나오면 안 된다.
      record(
        'view:notes 구문 뜻 표시',
        Boolean(toggled.ok) && toggled.meaningOk === true,
        toggled.ok ? (toggled.meanings || []).slice(0, 2).join(' / ') : toggled,
      );
      // AI 원문 응답 섹션은 카드에서 제거됐다.
      record('view:notes AI 원문 응답 없음', Boolean(toggled.ok) && toggled.rawBox === false && toggled.rawTitle === false, toggled.ok ? { rawBox: toggled.rawBox, rawTitle: toggled.rawTitle } : toggled);
    }
    if (id === 'settings') {
      // 키가 없어 모델 목록이 비어 있어도 가성비 추천·모델 검색 영역은 자리를 잡아야 한다.
      record('view:settings 모델 검색/가성비 추천', probe.modelSearch === 1 && probe.valueList === 1, `${probe.modelSearch}/${probe.valueList} :: ${probe.valueNote}`);
      // 설정에서 업데이트 주소를 넣을 수 있어야 자동 업데이트가 동작한다.
      // eslint-disable-next-line no-await-in-loop
      const updateCard = await win.webContents.executeJavaScript(
        `(() => {
           const boxes = [...document.querySelectorAll('.card')];
           const box = boxes.find((el) => ((el.querySelector('.card__title') || {}).textContent || '').trim() === '업데이트');
           if (!box) return { found: false };
           const inputs = [...box.querySelectorAll('input')];
           const buttons = [...box.querySelectorAll('button')].map((b) => (b.textContent || '').trim());
           return {
             found: true,
             text: (box.textContent || '').replace(/\\s+/g, ' ').trim(),
             textInput: inputs.filter((el) => el.type === 'text').length,
             checks: inputs.filter((el) => el.type === 'checkbox').length,
             buttons,
           };
         })()`,
        true,
      );
      record(
        'view:settings 업데이트 카드',
        Boolean(
          updateCard.found
            && updateCard.textInput === 1
            && updateCard.checks === 2
            && updateCard.buttons.includes('업데이트 확인')
            && /현재 버전/.test(updateCard.text),
        ),
        updateCard.found ? { textInput: updateCard.textInput, checks: updateCard.checks, buttons: updateCard.buttons } : '업데이트 카드 없음',
      );
    }
    // eslint-disable-next-line no-await-in-loop
    const target = id === 'home' ? 'smoke.png' : `smoke-${id}.png`;
    // eslint-disable-next-line no-await-in-loop
    const captured = await captureView(win, target);
    if (captured.ok) record(`screenshot:${target}`, captured.buffer.length > 20000, `${captured.buffer.length} bytes`);
    else record(`screenshot:${target}`, false, captured.error && captured.error.message);
    if (id === 'learn') {
      // 자막이 있는 동영상을 열면 줄마다 "문장 전송" 버튼이 붙는다(줄 클릭은 구간 재생).
      // eslint-disable-next-line no-await-in-loop
      const opened = await win.webContents.executeJavaScript(
        "(() => { const meta = (el) => ((el.querySelector('.picker-item__meta') || {}).textContent || ''); const hit = [...document.querySelectorAll('.picker-item')].find((el) => meta(el).includes('자막 있음')); if (!hit) return false; hit.click(); return true; })()",
        true,
      );
      if (!opened) {
        record('view:learn 문장 전송 버튼', false, '자막 있는 동영상을 찾지 못했습니다.');
      } else {
        // eslint-disable-next-line no-await-in-loop
        await waitFor(win, "document.querySelectorAll('.transcript-line').length > 0", 6000);
        // eslint-disable-next-line no-await-in-loop
        await sleep(250);
        // eslint-disable-next-line no-await-in-loop
        const rows = await win.webContents.executeJavaScript(
          "(() => { const q = (s) => document.querySelectorAll(s).length; return { lines: q('.transcript-line'), sends: q('.transcript-line__send') }; })()",
          true,
        );
        record('view:learn 문장 전송 버튼', rows.lines > 0 && rows.sends === rows.lines, `${rows.sends}/${rows.lines}`);
        // 전송 버튼이 자막 텍스트/시간과 겹치지 않고 줄 안쪽에 놓이는지 확인한다.
        // eslint-disable-next-line no-await-in-loop
        const geom = await win.webContents.executeJavaScript(
          "(() => { const row = document.querySelector('.transcript-line'); if (!row) return null; const send = row.querySelector('.transcript-line__send'); const text = row.querySelector('.transcript-line__text'); const time = row.querySelector('.transcript-line__time'); if (!send || !text || !time) return null; const rb = row.getBoundingClientRect(); const sb = send.getBoundingClientRect(); const tb = text.getBoundingClientRect(); const kb = time.getBoundingClientRect(); const hit = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5; return { w: Math.round(sb.width), h: Math.round(sb.height), inside: sb.right <= rb.right + 0.5 && sb.left >= rb.left - 0.5, overText: hit(sb, tb), overTime: hit(sb, kb) }; })()",
          true,
        );
        record(
          'view:learn 문장 전송 버튼 배치',
          Boolean(geom) && geom.w > 20 && geom.h > 10 && geom.inside && !geom.overText && !geom.overTime,
          JSON.stringify(geom),
        );
        // 문장 전송 버튼은 오른쪽 문장 패널에 문장을 넣고, 줄 클릭은 그 구간으로 이동 후 재생한다.
        // eslint-disable-next-line no-await-in-loop
        const behaviour = await win.webContents.executeJavaScript(
          `(async () => {
             const rows = [...document.querySelectorAll('.transcript-line')];
             const box = document.querySelector('.sentence-box');
             if (!box || rows.length < 3) return { ok: false, reason: 'rows/box 없음' };
             const textOf = (row) => ((row.querySelector('.transcript-line__text') || {}).textContent || '').trim();
             const send = rows[0].querySelector('.transcript-line__send');
             if (!send) return { ok: false, reason: '전송 버튼 없음' };
             send.click();
             await new Promise((resolve) => setTimeout(resolve, 120));
             const sent = box.value.trim() === textOf(rows[0]);
             const mod = await import('/js/player.js');
             const calls = [];
             const proto = mod.YouTubePlayer.prototype;
             const origSeek = proto.seekTo;
             const origPlay = proto.play;
             proto.seekTo = function (seconds) { calls.push(['seekTo', seconds]); return origSeek.apply(this, arguments); };
             proto.play = function () { calls.push(['play']); return origPlay.apply(this, arguments); };
             rows[2].click();
             await new Promise((resolve) => setTimeout(resolve, 120));
             proto.seekTo = origSeek;
             proto.play = origPlay;
             return {
               ok: true,
               sent,
               start: Number(rows[2].dataset.start),
               calls,
               seeked: calls.length > 0 && calls[0][0] === 'seekTo' && Number(calls[0][1]) === Number(rows[2].dataset.start),
               played: calls.some((call) => call[0] === 'play'),
               kept: box.value.trim() === textOf(rows[0]),
             };
           })()`,
          true,
        );
        record('view:learn 문장 전송 동작', Boolean(behaviour.ok) && behaviour.sent === true, behaviour.sent ? '문장 패널 반영' : behaviour);
        record('view:learn 줄 클릭 재생', Boolean(behaviour.ok) && behaviour.seeked === true && behaviour.played === true, { start: behaviour.start, calls: behaviour.calls });
        record('view:learn 줄 클릭은 전송 아님', Boolean(behaviour.ok) && behaviour.kept === true, behaviour.kept ? '문장 패널 유지' : behaviour);
        // 자막에서 문장을 여러 번 보내면 입력 상자에 줄 단위로 쌓여야 한다(덮어쓰기 금지).
        // eslint-disable-next-line no-await-in-loop
        const stacked = await win.webContents.executeJavaScript(
          `(async () => {
             const rows = [...document.querySelectorAll('.transcript-line')];
             const box = document.querySelector('.sentence-box');
             if (!box || rows.length < 3) return { ok: false, reason: 'rows/box 없음' };
             const textOf = (row) => ((row.querySelector('.transcript-line__text') || {}).textContent || '').trim();
             const fire = (row) => row.querySelector('.transcript-line__send').click();
             const lines = () => box.value.split('\\n').map((line) => line.trim()).filter(Boolean);
             box.value = '';
             box.dispatchEvent(new Event('input', { bubbles: true }));
             fire(rows[0]);
             await new Promise((resolve) => setTimeout(resolve, 90));
             fire(rows[1]);
             await new Promise((resolve) => setTimeout(resolve, 90));
             const two = lines();
             fire(rows[1]);
             await new Promise((resolve) => setTimeout(resolve, 90));
             const afterDuplicate = lines();
             return { ok: true, first: textOf(rows[0]), second: textOf(rows[1]), two, afterDuplicate };
           })()`,
          true,
        );
        record(
          'view:learn 문장 누적 전송',
          Boolean(stacked.ok) && stacked.first !== stacked.second && stacked.two.length === 2 && stacked.two[0] === stacked.first && stacked.two[1] === stacked.second,
          stacked.ok ? stacked.two : stacked,
        );
        record('view:learn 중복 문장 무시', Boolean(stacked.ok) && stacked.afterDuplicate.length === 2, stacked.ok ? stacked.afterDuplicate : stacked);
        // 문장을 저장하지 않고 AI 구문분석을 누르면 분석 결과가 곧바로 저장되고 화면에 보여야 한다.
        // eslint-disable-next-line no-await-in-loop
        const aiFlow = await win.webContents.executeJavaScript(
          `(async () => {
             const box = document.querySelector('.sentence-box');
             const analyzeBtn = [...document.querySelectorAll('button')].find((button) => (button.textContent || '').trim() === 'AI 구문분석');
             if (!box || !analyzeBtn) return { ok: false, reason: 'analyze/box 없음' };
             const api = (await import('/js/api.js')).api;
             const origAnalyze = api.ai.analyze;
             const origCreate = api.sentences.create;
             const created = [];
             api.ai.analyze = async () => ({
               model: 'smoke-model',
               raw: 'raw-smoke',
               analysis: {
                 translation: '이것은 스모크 테스트 문장입니다.',
                 structure: [{ part: 'This is', meaning: '이것은 ~이다' }],
               },
             });
             api.sentences.create = async (payload) => {
               created.push(payload);
               return { sentence: { pk: 987654321, sentence: payload.sentence }, counts: {} };
             };
             try {
               box.value = 'This is a smoke test sentence.';
               box.dispatchEvent(new Event('input', { bubbles: true }));
               analyzeBtn.click();
               // 분석 → 저장 → 입력 상자 정리까지 끝날 때까지 기다린다.
               for (let i = 0; i < 240; i += 1) {
                 await new Promise((resolve) => setTimeout(resolve, 50));
                 if (created.length && box.value.trim() === '') break;
               }
               await new Promise((resolve) => setTimeout(resolve, 150));
             } finally {
               api.ai.analyze = origAnalyze;
               api.sentences.create = origCreate;
             }
             const panel = document.querySelector('.analysis');
             return { ok: true, created, boxLeft: box.value.trim(), analysisText: panel ? (panel.textContent || '') : '' };
           })()`,
          true,
        );
        record(
          'view:learn AI 분석 즉시 저장',
          Boolean(aiFlow.ok) && aiFlow.created.length === 1 && aiFlow.created[0].source === 'ai' && Boolean(aiFlow.created[0].analysis),
          aiFlow.ok ? aiFlow.created.map((item) => ({ source: item.source, analysis: Boolean(item.analysis), sentence: item.sentence })) : aiFlow,
        );
        record(
          'view:learn AI 분석 결과 표시',
          Boolean(aiFlow.ok) && aiFlow.analysisText.includes('스모크 테스트 문장입니다') && aiFlow.analysisText.includes('This is') && aiFlow.boxLeft === '',
          aiFlow.ok ? { boxLeft: aiFlow.boxLeft, text: aiFlow.analysisText.slice(0, 60) } : aiFlow,
        );
        // AI 호출이 실패하면 직전 성공 카드를 지우고 실패한 문장을 알려 줘야 한다(성공으로 오해 방지).
        // eslint-disable-next-line no-await-in-loop
        const aiFail = await win.webContents.executeJavaScript(
          `(async () => {
             // 앞선 AI 분석이 아직 진행 중이면 버튼이 '분석 중…' 이라 찾지 못한다. 끝날 때까지 조금 기다린다.
             const waitAnalyzeButton = async () => {
               for (let i = 0; i < 120; i += 1) {
                 const found = [...document.querySelectorAll('button')].find((button) => (button.textContent || '').trim() === 'AI 구문분석');
                 if (found) return found;
                 await new Promise((resolve) => setTimeout(resolve, 50));
               }
               return null;
             };
             const box = document.querySelector('.sentence-box');
             const analyzeBtn = await waitAnalyzeButton();
             if (!box || !analyzeBtn) return { ok: false, reason: 'analyze/box 없음' };
             const api = (await import('/js/api.js')).api;
             const origAnalyze = api.ai.analyze;
             const origCreate = api.sentences.create;
             let createCalls = 0;
             api.ai.analyze = async () => { throw new Error('분석 서버가 응답하지 않습니다.'); };
             api.sentences.create = async () => { createCalls += 1; return { sentence: { pk: 1 }, counts: {} }; };
             try {
               box.value = 'Failure path smoke sentence.';
               box.dispatchEvent(new Event('input', { bubbles: true }));
               analyzeBtn.click();
               for (let i = 0; i < 240; i += 1) {
                 await new Promise((resolve) => setTimeout(resolve, 50));
                 if (document.querySelector('.analysis--error')) break;
               }
               await new Promise((resolve) => setTimeout(resolve, 200));
             } finally {
               api.ai.analyze = origAnalyze;
               api.sentences.create = origCreate;
             }
             const failed = document.querySelector('.analysis--error');
             return {
               ok: true,
               createCalls,
               staleSuccess: Boolean(document.querySelector('.analysis:not(.analysis--error)')),
               failText: failed ? (failed.textContent || '') : '',
             };
           })()`,
          true,
        );
        record(
          'view:learn AI 분석 실패 표시',
          Boolean(aiFail.ok) && aiFail.createCalls === 0 && aiFail.staleSuccess === false && aiFail.failText.includes('분석하지 못한 문장') && aiFail.failText.includes('Failure path smoke sentence.'),
          aiFail.ok ? { createCalls: aiFail.createCalls, staleSuccess: aiFail.staleSuccess, text: aiFail.failText.slice(0, 80) } : aiFail,
        );
        // eslint-disable-next-line no-await-in-loop
        const shot = await captureView(win, 'smoke-learn-transcript.png');
        if (shot.ok) record('screenshot:smoke-learn-transcript.png', shot.buffer.length > 20000, `${shot.buffer.length} bytes`);
        else record('screenshot:smoke-learn-transcript.png', false, shot.error && shot.error.message);
      }
    }
  }
}

async function run() {
  const win = main.bootstrap({ demo: false, hidden: true });
  // 캡처를 위해 화면 밖에 창을 띄운다(보이지 않는 창은 페인트되지 않는다).
  win.setPosition(-3200, 0);
  win.showInactive();

  const loaded = await waitFor(win, "document.readyState === 'complete' && !!document.getElementById('content')", 15000);
  record('renderer 로드', loaded, `readyState 대기 ${loaded ? '성공' : '실패'}`);
  if (!loaded) return;

  await sleep(600);

  const navCount = await win.webContents.executeJavaScript("document.querySelectorAll('.nav__item').length", true);
  expect('사이드바 메뉴 7개', navCount, 7);

  const steps = await runBridge(win);
  const failed = steps.filter((item) => !item.ok).map((item) => `${item.name}(${item.code})`);
  if (failed.length) console.log(`브리지 오류 단계: ${failed.join(', ')}`);
  evaluate(steps);

  await win.webContents.executeJavaScript(`window.studyTed.demo.seed(true)`, true);
  await win.webContents.executeJavaScript(
    `(async () => { const r = await window.studyTed.channels.list(); const pk = r.ok && r.data.length ? r.data[0].pk : null; if (pk) { await window.studyTed.settings.update({ lastView: 'home' }); } return true; })()`,
    true,
  );

  // 뷰 갱신을 위해 상태를 다시 불러오도록 새로고침한다.
  win.webContents.reload();
  await waitFor(win, "document.readyState === 'complete' && document.querySelectorAll('.thumb-grid .video-card').length > 0", 20000);
  await sleep(800);

  await runViewChecks(win);

  const cleared = await win.webContents.executeJavaScript('window.studyTed.demo.clear()', true);
  record('demo.clear', Boolean(cleared && cleared.ok), cleared && cleared.data && cleared.data.counts);
}

app.whenReady().then(async () => {
  try {
    await run();
  } catch (error) {
    record('스모크 실행', false, error.stack || error.message);
  } finally {
    const failed = results.filter((item) => !item.ok);
    console.log('');
    console.log(`총 ${results.length}개 확인 / 실패 ${failed.length}개`);
    if (failed.length) {
      for (const item of failed) console.log(` - ${item.name}: ${typeof item.detail === 'string' ? item.detail : JSON.stringify(item.detail)}`);
    }
    try {
      db.close();
    } catch {
      // 종료 중 DB 정리 실패는 무시한다.
    }
    app.exit(failed.length ? 1 : 0);
  }
});
