import { h, clear, formatDate, toast, confirmDialog } from '../ui.js';
import { api } from '../api.js';
import * as actions from '../actions.js';

const VALUE_PICK = 5;
const LIST_MAX = 200;

const PROVIDERS = [
  { value: 'auto', label: '자동 (yt-dlp 우선, 실패하면 내장 방식)' },
  { value: 'ytdlp', label: 'yt-dlp 사용' },
  { value: 'native', label: '내장 방식 사용 (HTML + Innertube)' },
];

function field(label, control, hint = null) {
  return h(
    'div',
    { class: 'form-field' },
    h('label', { class: 'form-field__label', text: label }),
    control,
    hint ? h('p', { class: 'form-field__hint', text: hint }) : null,
  );
}

function card(title, ...body) {
  return h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('div', { class: 'card__title', text: title })), h('div', { class: 'card__body stack' }, ...body));
}

export function createSettingsView() {
  let hydrated = false;
  let modelSignature = '';
  let listSignature = '';
  let favoriteSignature = '';
  let recentSignature = '';
  let modelQuery = '';
  let lastState = null;

  const keyStatus = h('div', { class: 'small' });
  const keyInput = h('input', { class: 'input', type: 'password', placeholder: 'sk-or-...', spellcheck: 'false', autocomplete: 'off' });
  const keySaveBtn = h('button', { class: 'btn btn--primary', type: 'button', text: '키 저장' });
  const keyTestBtn = h('button', { class: 'btn', type: 'button', text: '연결 테스트' });
  const keyClearBtn = h('button', { class: 'btn btn--danger', type: 'button', text: '키 삭제' });
  const encryptionNote = h('p', { class: 'muted small', text: '' });

  const keyCard = card(
    'OpenRouter API 키',
    keyStatus,
    h('div', { class: 'row' }, keyInput, keySaveBtn),
    h('div', { class: 'row' }, keyTestBtn, keyClearBtn),
    encryptionNote,
    h('p', { class: 'muted small', text: '키는 이 컴퓨터에만 저장되며 외부로 전송되지 않습니다. AI 구문분석을 쓸 때만 OpenRouter 로 전달됩니다.' }),
  );

  const providerSelect = h('select', { class: 'select', onChange: () => save({ provider: providerSelect.value }) });
  for (const item of PROVIDERS) providerSelect.append(h('option', { value: item.value, text: item.label }));
  const limitInput = h('input', { class: 'input', type: 'number', min: '1', max: '200', style: { width: '120px' } });
  const limitSaveBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '적용' });
  const collectAllCheck = h('input', { type: 'checkbox' });
  const collectAllToggle = h(
    'label',
    { class: 'row small', style: { gap: '8px' } },
    collectAllCheck,
    h('span', { text: '채널 전체 수집 (개수 제한 없이 모든 동영상 가져오기)' }),
  );
  const subtitleCheck = h('input', { type: 'checkbox' });
  const subtitleToggle = h(
    'label',
    { class: 'row small', style: { gap: '8px' } },
    subtitleCheck,
    h('span', { text: '채널을 불러올 때 자막도 함께 가져오기' }),
  );
  const refreshCheck = h('input', { type: 'checkbox' });
  const refreshToggle = h(
    'label',
    { class: 'row small', style: { gap: '8px' } },
    refreshCheck,
    h('span', { text: '기존 동영상의 정보(제목·조회수·썸네일)도 다시 가져오기' }),
  );
  const concurrencyInput = h('input', { class: 'input', type: 'number', min: '1', max: '8', style: { width: '120px' } });
  const concurrencySaveBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '적용' });
  const ytdlpPathInput = h('input', { class: 'input', placeholder: '비워 두면 자동으로 찾습니다.', spellcheck: 'false' });
  const ytdlpPathSaveBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '저장' });
  const ytdlpStatus = h('p', { class: 'muted small', text: '' });
  const ytdlpDownloadBtn = h('button', { class: 'btn btn--sm btn--primary', type: 'button', text: 'yt-dlp 내려받기', hidden: true });

  const collectCard = card(
    '수집 설정',
    field('수집 방식', providerSelect, '자막 수집이 실패하면 자동으로 다른 방식으로 넘어갑니다.'),
    field(
      '한 번에 가져올 동영상 수',
      h('div', { class: 'row' }, limitInput, limitSaveBtn),
      '1 ~ 200 사이 값입니다. 최신 동영상부터 가져옵니다. 아래 "채널 전체 수집" 을 켜면 이 값은 쓰이지 않습니다.',
    ),
    collectAllToggle,
    h('p', {
      class: 'form-field__hint',
      text: '전체 수집은 채널의 모든 동영상을 가져오므로 시간이 오래 걸릴 수 있습니다. 처음 한 번만 오래 걸리고, 다음부터는 자막이 없는 동영상만 추가로 받습니다.',
    }),
    subtitleToggle,
    refreshToggle,
    h('p', { class: 'form-field__hint', text: '체크를 끄면 이미 저장된 동영상은 건너뛰고 새 동영상만 추가합니다(수집이 빨라집니다).' }),
    field(
      '동시에 받을 자막 수',
      h('div', { class: 'row' }, concurrencyInput, concurrencySaveBtn),
      '1 ~ 8 사이 값이며 기본은 4 입니다. 자막은 대부분 대기 시간이라 여러 편을 동시에 받으면 훨씬 빨라집니다. 수집이 자주 실패하면 1 로 낮춰 보세요.',
    ),
    field('yt-dlp 경로', h('div', { class: 'row' }, ytdlpPathInput, ytdlpPathSaveBtn)),
    ytdlpStatus,
    h('div', { class: 'row' }, ytdlpDownloadBtn),
  );

  const modelSelect = h('select', { class: 'select model-select', onChange: () => save({ model: modelSelect.value }) });
  const modelRefreshBtn = h('button', { class: 'btn btn--sm btn--subtle', type: 'button', text: '모델 목록 새로고침' });
  const modelNote = h('p', { class: 'muted small', text: '' });
  const modelSearchInput = h('input', { class: 'input input--search', type: 'search', placeholder: '모델 이름 또는 ID 로 검색', spellcheck: 'false', autocomplete: 'off' });
  const valueList = h('div', { class: 'model-list model-list--value' });
  const modelListBox = h('div', { class: 'listbox model-list model-list--all' });
  const modelListNote = h('p', { class: 'muted small', text: '' });
  const favoriteRow = h('div', { class: 'chip-row' });
  const recentRow = h('div', { class: 'chip-row' });
  const favoriteSelect = h('select', { class: 'select', style: { minWidth: '260px' } });
  const favoriteAddBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '★ 즐겨찾기 추가' });

  const modelCard = card(
    'AI 모델',
    field('기본 모델', modelSelect, 'AI 구문분석에 사용할 모델입니다. 모델 이름 옆에 1M 토큰당 가격을 함께 표시합니다.'),
    h('div', { class: 'row' }, modelRefreshBtn),
    modelNote,
    field('가성비 추천', valueList, '입력·출력 단가가 낮은 순서입니다. 항목을 누르면 기본 모델로 설정됩니다.'),
    field('모델 검색', h('div', { class: 'stack' }, modelSearchInput, modelListBox, modelListNote), '이름이나 ID 일부를 입력하면 아래 목록이 좁혀집니다. 항목을 누르면 기본 모델로 설정됩니다.'),
    field('자주 쓰는 모델', recentRow),
    field('즐겨찾기 모델', h('div', { class: 'stack' }, favoriteRow, h('div', { class: 'row' }, favoriteSelect, favoriteAddBtn))),
  );

  const updateVersionLabel = h('p', { class: 'small', text: '' });
  const updateFeedInput = h('input', { class: 'input', placeholder: 'https://…/latest.json', spellcheck: 'false' });
  const updateFeedSaveBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '저장' });
  const updateAutoCheck = h('input', { type: 'checkbox' });
  const updateAutoToggle = h(
    'label',
    { class: 'row small', style: { gap: '8px' } },
    updateAutoCheck,
    h('span', { text: '앱을 켤 때 새 버전이 있는지 자동으로 확인' }),
  );
  const updateSilentCheck = h('input', { type: 'checkbox' });
  const updateSilentToggle = h(
    'label',
    { class: 'row small', style: { gap: '8px' } },
    updateSilentCheck,
    h('span', { text: '설치 화면 없이 조용히 설치하고 앱을 다시 열기' }),
  );
  const updateCheckBtn = h('button', { class: 'btn btn--sm btn--primary', type: 'button', text: '업데이트 확인' });
  const updateDownloadBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '내려받기', hidden: true });
  const updateInstallBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '지금 설치하고 다시 시작', hidden: true });
  const updateStatus = h('p', { class: 'small', text: '' });
  const updateHint = h('p', { class: 'muted small', text: '' });

  const updateCard = card(
    '업데이트',
    updateVersionLabel,
    field(
      '업데이트 주소',
      h('div', { class: 'row' }, updateFeedInput, updateFeedSaveBtn),
      '설치 파일을 올려 둔 곳의 latest.json 주소입니다. 비워 두면 자동 확인을 하지 않습니다.',
    ),
    updateAutoToggle,
    updateSilentToggle,
    h('div', { class: 'row' }, updateCheckBtn, updateDownloadBtn, updateInstallBtn),
    updateStatus,
    updateHint,
  );

  const countsLabel = h('div', { class: 'grid-3' });
  const infoLabel = h('p', { class: 'muted small', text: '' });
  const seedBtn = h('button', { class: 'btn', type: 'button', text: '데모 데이터 넣기' });
  const clearDemoBtn = h('button', { class: 'btn btn--subtle', type: 'button', text: '데모 데이터 지우기' });

  const dataCard = card(
    '데이터',
    countsLabel,
    h('p', { class: 'muted small', text: '문장·동영상·자막은 이 컴퓨터의 앱 데이터 폴더(SQLite)에 저장됩니다. 앱을 지우기 전에 공유하기에서 내보내 두세요.' }),
    h('div', { class: 'row' }, seedBtn, clearDemoBtn),
    infoLabel,
  );

  const element = h('div', { class: 'view stack' }, keyCard, collectCard, modelCard, updateCard, dataCard);

  async function save(patch) {
    try {
      await actions.saveSettings(patch);
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  async function saveKey() {
    const value = keyInput.value.trim();
    if (!value) {
      toast('API 키를 입력해 주세요.', { type: 'warn' });
      keyInput.focus();
      return;
    }
    keySaveBtn.disabled = true;
    try {
      await api.settings.setApiKey(value);
      keyInput.value = '';
      await actions.loadInfo();
      toast('API 키를 저장했습니다.', { type: 'success' });
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 6000 });
    } finally {
      keySaveBtn.disabled = false;
    }
  }

  async function testKey() {
    keyTestBtn.disabled = true;
    keyTestBtn.textContent = '확인 중…';
    try {
      const result = await api.settings.testKey();
      toast(`연결되었습니다. 사용할 수 있는 모델 ${result.modelCount ?? 0}개를 확인했습니다.`, { type: 'success', timeout: 5000 });
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 7000 });
    } finally {
      keyTestBtn.disabled = false;
      keyTestBtn.textContent = '연결 테스트';
    }
  }

  async function clearKey() {
    const yes = await confirmDialog({ title: 'API 키 삭제', message: '저장된 OpenRouter 키를 삭제할까요? AI 구문분석을 쓸 수 없게 됩니다.', confirmText: '삭제', danger: true });
    if (!yes) return;
    try {
      await api.settings.clearApiKey();
      await actions.loadInfo();
      toast('API 키를 삭제했습니다.', { type: 'success' });
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  async function downloadYtdlp() {
    ytdlpDownloadBtn.disabled = true;
    ytdlpDownloadBtn.textContent = '내려받는 중…';
    try {
      const result = await api.collect.downloadYtdlp();
      await actions.loadInfo();
      toast(`yt-dlp ${result.version ?? ''} 를 준비했습니다.`, { type: 'success', timeout: 5000 });
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 7000 });
    } finally {
      ytdlpDownloadBtn.disabled = false;
      ytdlpDownloadBtn.textContent = 'yt-dlp 내려받기';
    }
  }

  async function toggleFavorite(modelId) {
    try {
      const favoriteModels = await api.settings.favoriteModel(modelId);
      await actions.saveSettings({});
      const settings = { ...(window.__studyTedSettings ?? {}) };
      void settings;
      favoriteSignature = '';
      await actions.loadInfo();
      toast(favoriteModels.includes(modelId) ? '즐겨찾기에 추가했습니다.' : '즐겨찾기에서 뺐습니다.', { type: 'success', timeout: 2000 });
      return favoriteModels;
    } catch (error) {
      toast(error.message, { type: 'error' });
      return null;
    }
  }

  async function refreshModels() {
    modelRefreshBtn.disabled = true;
    modelRefreshBtn.textContent = '불러오는 중…';
    try {
      const models = await actions.loadModels({ force: true });
      toast(`모델 ${models.length}개를 불러왔습니다.`, { type: 'success' });
      modelSignature = '';
      listSignature = '';
      favoriteSignature = '';
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 7000 });
    } finally {
      modelRefreshBtn.disabled = false;
      modelRefreshBtn.textContent = '모델 목록 새로고침';
    }
  }

  async function seedDemo() {
    seedBtn.disabled = true;
    try {
      const summary = await actions.seedDemo(false);
      toast(summary.seeded ? '데모 데이터를 넣었습니다.' : '이미 데이터가 있어 건너뛰었습니다.', { type: 'success', timeout: 4000 });
    } catch (error) {
      toast(error.message, { type: 'error' });
    } finally {
      seedBtn.disabled = false;
    }
  }

  async function clearDemo() {
    const yes = await confirmDialog({ title: '데모 데이터 지우기', message: '데모로 넣은 채널·동영상·문장을 모두 지웁니다. 계속할까요?', confirmText: '지우기', danger: true });
    if (!yes) return;
    try {
      await api.demo.clear();
      await Promise.all([actions.loadChannels(), actions.loadSentences(), actions.loadInfo()]);
      toast('데모 데이터를 지웠습니다.', { type: 'success' });
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  keySaveBtn.addEventListener('click', () => saveKey());
  keyInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') saveKey();
  });
  keyTestBtn.addEventListener('click', () => testKey());
  keyClearBtn.addEventListener('click', () => clearKey());
  limitSaveBtn.addEventListener('click', () => {
    const value = Math.max(1, Math.min(200, Number(limitInput.value) || 24));
    limitInput.value = String(value);
    save({ collectLimit: value, collectAll: false });
  });
  collectAllCheck.addEventListener('change', () => {
    limitInput.disabled = collectAllCheck.checked;
    save({ collectAll: collectAllCheck.checked });
  });
  subtitleCheck.addEventListener('change', () => save({ withSubtitles: subtitleCheck.checked }));
  refreshCheck.addEventListener('change', () => save({ refreshExisting: refreshCheck.checked }));
  concurrencySaveBtn.addEventListener('click', () => save({ concurrency: concurrencyInput.value }));
  ytdlpPathSaveBtn.addEventListener('click', () => save({ ytdlpPath: ytdlpPathInput.value.trim() }));
  ytdlpDownloadBtn.addEventListener('click', () => downloadYtdlp());
  modelRefreshBtn.addEventListener('click', () => refreshModels());
  modelSearchInput.addEventListener('input', () => {
    modelQuery = modelSearchInput.value;
    listSignature = '';
    if (lastState) renderModels(lastState);
  });
  favoriteAddBtn.addEventListener('click', () => {
    const modelId = favoriteSelect.value;
    if (!modelId) {
      toast('추가할 모델을 먼저 고르세요.', { type: 'warn' });
      return;
    }
    toggleFavorite(modelId);
  });
  updateFeedSaveBtn.addEventListener('click', () => save({ updateFeedUrl: updateFeedInput.value.trim() }));
  updateAutoCheck.addEventListener('change', () => save({ updateAutoCheck: updateAutoCheck.checked }));
  updateSilentCheck.addEventListener('change', () => save({ updateSilentInstall: updateSilentCheck.checked }));
  updateCheckBtn.addEventListener('click', () => checkUpdateNow());
  updateDownloadBtn.addEventListener('click', () => downloadUpdateNow());
  updateInstallBtn.addEventListener('click', () => installUpdateNow());
  seedBtn.addEventListener('click', () => seedDemo());
  clearDemoBtn.addEventListener('click', () => clearDemo());

  async function checkUpdateNow() {
    updateCheckBtn.disabled = true;
    updateCheckBtn.textContent = '확인 중…';
    try {
      const snapshot = await actions.checkUpdate({ force: true });
      if (snapshot?.phase === 'available') toast(`새 버전 ${snapshot.latest?.version} 을(를) 사용할 수 있습니다.`, { type: 'success', timeout: 6000 });
      else toast('최신 버전을 사용 중입니다.', { type: 'info' });
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 8000 });
    } finally {
      updateCheckBtn.disabled = false;
      updateCheckBtn.textContent = '업데이트 확인';
    }
  }

  async function downloadUpdateNow() {
    updateDownloadBtn.disabled = true;
    try {
      await actions.downloadUpdate();
      toast('업데이트를 내려받았습니다.', { type: 'success', timeout: 5000 });
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 8000 });
    } finally {
      updateDownloadBtn.disabled = false;
    }
  }

  async function installUpdateNow() {
    updateInstallBtn.disabled = true;
    try {
      await actions.installUpdate();
      toast('설치를 시작합니다. 잠시 뒤 앱이 자동으로 다시 열립니다.', { type: 'success', timeout: 6000 });
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 8000 });
      updateInstallBtn.disabled = false;
    }
  }

  function renderUpdate(s) {
    const settings = s.settings ?? {};
    const info = s.info ?? {};
    const status = s.update ?? {};
    if (!hydrated) {
      updateFeedInput.value = settings.update?.feedUrl ?? '';
      updateAutoCheck.checked = settings.update?.autoCheck !== false;
      updateSilentCheck.checked = settings.update?.silentInstall !== false;
    }
    updateVersionLabel.textContent = info.version ? `현재 버전 v${info.version}` : '';

    const phase = status.phase ?? 'idle';
    const latest = status.latest ?? null;
    let text = '';
    switch (phase) {
      case 'checking':
        text = '업데이트를 확인하는 중입니다…';
        break;
      case 'current':
        text = `최신 버전입니다.${status.checkedAt ? ` (${formatDate(status.checkedAt)} 확인)` : ''}`;
        break;
      case 'available':
        text = `새 버전 v${latest?.version ?? ''} 을(를) 사용할 수 있습니다.`;
        break;
      case 'downloading':
        text = `내려받는 중 ${status.percent ?? 0}%`;
        break;
      case 'ready':
        text = `업데이트 v${latest?.version ?? ''} 준비 완료.`;
        break;
      case 'installing':
        text = '설치를 시작합니다…';
        break;
      case 'error':
        text = status.error || '업데이트를 확인하지 못했습니다.';
        break;
      default:
        text = status.feedUrl ? '업데이트를 확인할 수 있습니다.' : '업데이트 주소를 입력하면 새 버전을 알려 드립니다.';
        break;
    }
    updateStatus.textContent = text;
    updateDownloadBtn.hidden = phase !== 'available';
    updateInstallBtn.hidden = phase !== 'ready';
    updateCheckBtn.disabled = ['checking', 'downloading', 'installing'].includes(phase);
    updateCheckBtn.textContent = phase === 'error' ? '다시 확인' : '업데이트 확인';
    updateHint.textContent = phase === 'ready'
      ? '설치하면 앱이 종료되었다가 자동으로 다시 열립니다.'
      : '설치 파일(StudyTED-Setup-*.exe)과 latest.json 을 같은 곳에 올려 두고, 그 latest.json 주소를 넣으면 됩니다.';
  }

  function renderKey(s) {
    const settings = s.settings ?? {};
    keyStatus.textContent = settings.hasKey ? `등록됨 · ${settings.keyMask ?? ''}${settings.keyUpdatedAt ? ` · ${formatDate(settings.keyUpdatedAt)} 저장` : ''}` : '등록되지 않았습니다.';
    keyStatus.classList.toggle('muted', !settings.hasKey);
    encryptionNote.textContent = settings.encryptionAvailable
      ? '이 컴퓨터의 보안 저장소에 암호화해서 보관합니다.'
      : '이 환경에서는 암호화 저장을 쓸 수 없어 평문으로 보관됩니다. 공용 PC 라면 주의하세요.';
    keyClearBtn.disabled = !settings.hasKey;
    keyTestBtn.disabled = !settings.hasKey;
  }

  function renderCollect(s) {
    const settings = s.settings ?? {};
    const info = s.info ?? {};
    const ytdlp = info.collect?.ytdlp ?? {};
    if (!hydrated) {
      providerSelect.value = settings.provider ?? 'auto';
      limitInput.value = String(settings.collectLimit ?? 24);
      collectAllCheck.checked = settings.collectAll !== false;
      subtitleCheck.checked = settings.withSubtitles !== false;
      refreshCheck.checked = settings.refreshExisting !== false;
      concurrencyInput.value = String(settings.concurrency ?? 4);
      ytdlpPathInput.value = settings.ytdlpPath ?? '';
    }
    limitInput.disabled = settings.collectAll !== false;
    ytdlpStatus.textContent = ytdlp.available
      ? `yt-dlp 사용 가능${ytdlp.version ? ` (${ytdlp.version})` : ''} · ${ytdlp.source ?? ''}${ytdlp.path ? ` · ${ytdlp.path}` : ''}`
      : 'yt-dlp 를 찾지 못했습니다. 내려받으면 자막 수집이 안정적입니다.';
    ytdlpDownloadBtn.hidden = Boolean(ytdlp.available);
  }

  // 선택 목록(option)에 쓸 이름: "모델 이름 · $0.15/$0.6"
  function optionText(model) {
    const name = model.name && model.name !== model.id ? model.name : model.id;
    return model.priceShort ? `${name} · ${model.priceShort}` : name;
  }

  // 모델 한 줄: 별칭 · 1M 토큰당 가격 · 컨텍스트 길이. 누르면 기본 모델로 설정된다.
  function modelRow(model, currentId, badge) {
    return h(
      'button',
      {
        class: `model-row model-row--pick${model.id === currentId ? ' model-row--on' : ''}`,
        type: 'button',
        title: `${model.id} · ${model.priceLabel ?? ''}`,
        onClick: () => save({ model: model.id }),
      },
      badge ? h('span', { class: 'model-row__badge', text: badge }) : null,
      h('span', { class: 'model-row__id', text: model.name ?? model.id }),
      h('span', { class: 'model-row__price', text: model.priceLabel ?? '' }),
      h('span', { class: 'model-row__meta', text: model.contextLength ? `${Math.round(model.contextLength / 1000)}K` : '' }),
    );
  }

  // 이름·ID 부분 일치 검색(대소문자 무시). decorateModels 가 넣어 준 searchText 를 쓴다.
  function filterModels(list, query) {
    const needle = String(query ?? '').trim().toLowerCase();
    if (!needle) return list;
    return list.filter((model) => String(model.searchText ?? `${model.id} ${model.name ?? ''}`).toLowerCase().includes(needle));
  }

  function renderModels(s) {
    const settings = s.settings ?? {};
    const models = s.models ?? [];
    const favorite = new Set(settings.favoriteModels ?? []);

    const signature = `${models.length}:${settings.model ?? ''}:${[...favorite].join(',')}`;
    if (signature !== modelSignature) {
      modelSignature = signature;
      const current = settings.model ?? '';
      clear(modelSelect);
      const available = new Map(models.map((model) => [model.id, model]));
      if (!available.has(current)) modelSelect.append(h('option', { value: '', text: current ? `${current} (목록에 없음)` : '모델을 선택하세요' }));
      const favoriteModels = models.filter((model) => favorite.has(model.id));
      if (favoriteModels.length) {
        const group = h('optgroup', { label: '즐겨찾기' });
        for (const model of favoriteModels) group.append(h('option', { value: model.id, text: optionText(model) }));
        modelSelect.append(group);
      }
      const group = h('optgroup', { label: '전체 모델' });
      for (const model of models) group.append(h('option', { value: model.id, text: optionText(model) }));
      modelSelect.append(group);
      modelSelect.value = current;

      clear(favoriteSelect);
      for (const model of models) favoriteSelect.append(h('option', { value: model.id, text: `${favorite.has(model.id) ? '★ ' : ''}${optionText(model)}` }));
      favoriteSelect.disabled = !models.length;

      modelNote.textContent = models.length
        ? `사용 가능한 모델 ${models.length}개를 불러왔습니다.`
        : '모델 목록을 불러오려면 OpenRouter 키를 저장하고 "모델 목록 새로고침" 을 눌러 주세요.';
    }

    const listKey = `${models.length}:${settings.model ?? ''}:${modelQuery}`;
    if (listKey !== listSignature) {
      listSignature = listKey;

      clear(valueList);
      if (!models.length) {
        valueList.append(h('span', { class: 'muted small', text: '모델 목록을 불러오면 가성비가 좋은 순서로 보여 줍니다.' }));
      } else {
        const cheap = models
          .filter((model) => model.valueRank)
          .sort((a, b) => a.valueRank - b.valueRank)
          .slice(0, VALUE_PICK);
        for (const model of cheap) valueList.append(modelRow(model, settings.model ?? '', `가성비 ${model.valueRank}위`));
      }

      clear(modelListBox);
      const found = filterModels(models, modelQuery);
      if (!models.length) {
        modelListBox.append(h('p', { class: 'muted small', text: '모델 목록을 불러오려면 OpenRouter 키를 저장하고 "모델 목록 새로고침" 을 눌러 주세요.' }));
        modelListNote.textContent = '';
      } else {
        if (!found.length) modelListBox.append(h('p', { class: 'muted small', text: '검색 결과가 없습니다.' }));
        for (const model of found.slice(0, LIST_MAX)) modelListBox.append(modelRow(model, settings.model ?? '', null));
        modelListNote.textContent = found.length > LIST_MAX
          ? `검색 결과 ${found.length}개 중 ${LIST_MAX}개 표시 / 전체 ${models.length}개`
          : `검색 결과 ${found.length}개 / 전체 ${models.length}개`;
      }
    }

    const favoriteKey = (settings.favoriteModels ?? []).join(',');
    if (favoriteKey !== favoriteSignature) {
      favoriteSignature = favoriteKey;
      clear(favoriteRow);
      if (!(settings.favoriteModels ?? []).length) {
        favoriteRow.append(h('span', { class: 'muted small', text: '아직 즐겨찾기한 모델이 없습니다.' }));
      } else {
        for (const modelId of settings.favoriteModels) {
          favoriteRow.append(
            h('button', {
              class: `chip${modelId === settings.model ? ' chip--on' : ''}`,
              type: 'button',
              text: `★ ${modelId}`,
              onClick: () => save({ model: modelId }),
            }),
          );
        }
      }
    }

    const recent = settings.recentModels ?? [];
    const recentKey = recent.join(',');
    if (recentKey !== recentSignature) {
      recentSignature = recentKey;
      clear(recentRow);
      if (!recent.length) {
        recentRow.append(h('span', { class: 'muted small', text: 'AI 구문분석을 사용하면 자주 쓴 모델이 여기에 쌓입니다.' }));
      } else {
        for (const modelId of recent) {
          const used = settings.usage?.[modelId];
          recentRow.append(
            h('button', {
              class: `chip${modelId === settings.model ? ' chip--on' : ''}`,
              type: 'button',
              text: `${modelId}${used ? ` · ${used}회` : ''}`,
              onClick: () => save({ model: modelId }),
            }),
          );
        }
      }
    }
  }

  function renderData(s) {
    const counts = s.counts ?? {};
    const info = s.info ?? {};
    clear(countsLabel);
    for (const [label, value] of [
      ['채널', counts.channels ?? 0],
      ['동영상', counts.videos ?? 0],
      ['자막', counts.transcripts ?? 0],
      ['문장', counts.sentences ?? 0],
    ]) {
      countsLabel.append(
        h('div', { class: 'card' }, h('div', { class: 'card__body stack', style: { gap: '2px' } }, h('span', { class: 'muted small', text: label }), h('strong', { text: `${value}개` }))),
      );
    }
    infoLabel.textContent = info.version ? `버전 ${info.version} · Electron ${info.electron} · Node ${info.node} · Chrome ${info.chrome}` : '';
  }

  return {
    element,
    update(s) {
      lastState = s;
      renderKey(s);
      renderCollect(s);
      renderModels(s);
      renderUpdate(s);
      renderData(s);
      hydrated = true;
    },
  };
}
