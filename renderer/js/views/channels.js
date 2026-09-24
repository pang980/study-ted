import { h, clear, initials, formatDate, emptyState, toast, confirmDialog } from '../ui.js';
import { state } from '../state.js';
import * as actions from '../actions.js';
import { api } from '../api.js';

const PROVIDER_LABEL = {
  auto: '자동 (yt-dlp 를 먼저 시도하고 실패하면 내장 방식 사용)',
  ytdlp: 'yt-dlp 만 사용',
  native: '내장 방식만 사용 (HTML + Innertube)',
};

export function createChannelsView({ onNavigate } = {}) {
  let status = null;
  let listSignature = '';
  // 여러 채널을 순서대로 수집할 때의 진행 상태. running 중이면 버튼을 잠근다.
  let queue = null;
  const progressByPk = new Map();
  const rowStatus = new Map();
  const rowButtons = new Map();

  const input = h('input', {
    class: 'input',
    type: 'text',
    placeholder: 'https://www.youtube.com/@channelname',
    spellcheck: 'false',
    style: { flex: '1', minWidth: '220px' },
  });
  const syncBtn = h('button', { class: 'btn btn--primary', type: 'button', text: '채널 불러오기' });
  const cancelBtn = h('button', { class: 'btn btn--danger', type: 'button', text: '취소', hidden: true });
  const fill = h('div', { class: 'progress-bar__fill' });
  const progressText = h('span', { class: 'muted small', text: '', style: { flex: '1', minWidth: '0' } });
  // 진행 바 옆에 붙는 정지 버튼. 자막을 수천 개 받는 중에도 바로 보이도록 한다.
  const cancelInline = h('button', {
    class: 'btn btn--sm btn--danger',
    type: 'button',
    text: '수집 정지',
    hidden: true,
    style: { flexShrink: '0' },
  });
  const progress = h(
    'div',
    { class: 'stack', hidden: true, style: { gap: '6px' } },
    h('div', { class: 'progress-bar' }, fill),
    h('div', { class: 'row row--between' }, progressText, cancelInline),
  );

  const addCard = h(
    'section',
    { class: 'card' },
    h(
      'div',
      { class: 'card__head' },
      h('div', { class: 'card__title', text: '채널 추가' }),
      h('span', { class: 'muted small', text: '채널 주소를 넣으면 최신 동영상부터 순서대로 가져옵니다.' }),
    ),
    h('div', { class: 'card__body stack' }, h('div', { class: 'row' }, input, syncBtn, cancelBtn), progress),
  );

  const providerValue = h('span', { class: 'muted small', text: '확인 중…' });
  const ytdlpValue = h('span', { class: 'muted small', text: '확인 중…' });
  const ytdlpPath = h('div', { class: 'muted small', text: '' });
  const downloadBtn = h('button', { class: 'btn btn--sm btn--primary', type: 'button', text: 'yt-dlp 내려받기', hidden: true });
  const refreshBtn = h('button', { class: 'btn btn--sm btn--subtle', type: 'button', text: '상태 새로고침' });

  // 진단용 카드다. 평소에는 감추고, yt-dlp 를 쓰기로 했는데 yt-dlp 가 없어 수집이 불가능할 때만 보여 준다.
  const statusCard = h(
    'section',
    { class: 'card', hidden: true },
    h('div', { class: 'card__head' }, h('div', { class: 'card__title', text: '수집 환경' }), refreshBtn),
    h(
      'div',
      { class: 'card__body stack' },
      h('div', { class: 'list-row' }, h('span', { class: 'grow small', text: '수집 방식' }), providerValue),
      h('div', { class: 'list-row' }, h('span', { class: 'grow small', text: 'yt-dlp' }), ytdlpValue),
      ytdlpPath,
      h('div', { class: 'row' }, downloadBtn),
      h('p', {
        class: 'muted small',
        text: '자막은 yt-dlp 가 있으면 안정적으로 받아옵니다. 없으면 내장 방식으로 시도합니다.',
      }),
    ),
  );

  const listBody = h('div', { class: 'card__body', style: { padding: '0' } });
  const listCount = h('span', { class: 'muted small', text: '' });
  const allBtn = h('button', {
    class: 'btn btn--sm btn--primary',
    type: 'button',
    text: '전체 채널 수집',
    title: '등록된 모든 채널의 동영상과 자막을 순서대로 다시 가져옵니다.',
    hidden: true,
  });
  const listCard = h(
    'section',
    { class: 'card' },
    h(
      'div',
      { class: 'card__head' },
      h('div', { class: 'card__title', text: '등록된 채널' }),
      h('div', { class: 'row' }, listCount, allBtn),
    ),
    listBody,
  );

  const element = h('div', { class: 'view' }, addCard, statusCard, listCard);

  async function refreshStatus() {
    try {
      status = await api.collect.status();
    } catch (error) {
      toast(error.message, { type: 'error' });
      return;
    }
    providerValue.textContent = PROVIDER_LABEL[status.preference] ?? status.preference;
    const ytdlp = status.ytdlp ?? {};
    ytdlpValue.textContent = ytdlp.available
      ? `사용 가능${ytdlp.version ? ` (${ytdlp.version})` : ''} · ${ytdlp.source ?? ''}`
      : '사용할 수 없음';
    ytdlpPath.textContent = ytdlp.path ? `경로: ${ytdlp.path}` : '경로: 자동 탐지되지 않았습니다.';
    downloadBtn.hidden = Boolean(ytdlp.available);
    // 수집 방식이 yt-dlp 인데 실행 파일이 없으면 수집 자체가 안 되므로 그때만 안내 카드를 띄운다.
    statusCard.hidden = !(status.preference === 'ytdlp' && !ytdlp.available);
  }

  async function download() {
    downloadBtn.disabled = true;
    downloadBtn.textContent = '내려받는 중…';
    try {
      const result = await api.collect.downloadYtdlp();
      toast(`yt-dlp ${result.version ?? ''} 를 준비했습니다.`, { type: 'success', timeout: 5000 });
      await refreshStatus();
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 7000 });
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'yt-dlp 내려받기';
    }
  }

  // 정지 요청이 접수되면 결과가 올 때까지 버튼을 잠근다.
  let cancelling = false;

  function paintCancelButtons(busy) {
    for (const button of [cancelBtn, cancelInline]) {
      button.hidden = !busy;
      if (!busy) continue;
      button.disabled = cancelling;
      button.textContent = cancelling ? '정지하는 중…' : (button === cancelBtn ? '취소' : '수집 정지');
    }
  }

  async function requestCancel() {
    if (cancelling) return;
    cancelling = true;
    paintCancelButtons(true);
    const ok = await actions.cancelCollect();
    if (!ok) {
      cancelling = false;
      paintCancelButtons(Boolean(queue) || Boolean(state.collecting));
      toast('취소할 수집 작업이 없습니다.', { type: 'warn', timeout: 4000 });
    }
  }

  function setBusy(busy) {
    syncBtn.disabled = busy;
    allBtn.disabled = busy || !(state.channels ?? []).length;
    paintCancelButtons(busy);
    for (const button of rowButtons.values()) button.disabled = busy;
  }

  function setRowStatus(pk, text) {
    if (pk) progressByPk.set(pk, text);
    const element = rowStatus.get(pk);
    if (element) element.textContent = text;
  }

  function paintProgress(done, total, message) {
    progress.hidden = false;
    fill.style.width = total > 0 ? `${Math.min(100, Math.round((done / total) * 100))}%` : '8%';
    progressText.textContent = message;
  }

  async function sync(url) {
    if (queue) return;
    queue = { total: 1, index: 0 };
    setBusy(true);
    paintProgress(0, 1, '채널 정보를 확인하는 중입니다.');
    try {
      const result = await actions.syncFromUrl(url, {
        onProgress: (payload) => {
          const total = Number(payload.total) || 0;
          paintProgress(Number(payload.done) || 0, total, payload.message ?? '수집 중입니다.');
        },
      });
      const parts = [`동영상 ${result.videoCount ?? 0}개`];
      if (result.addedCount !== undefined) parts.push(`신규 ${result.addedCount}개`);
      if (result.keptCount) parts.push(`기존 ${result.keptCount}개 유지`);
      if (result.transcriptCount) parts.push(`자막 ${result.transcriptCount}개`);
      const failed = Number(result.failures?.length) || 0;
      if (failed) parts.push(`자막 실패 ${failed}개`);
      toast(`채널을 불러왔습니다. (${parts.join(' · ')})`, { type: failed ? 'warn' : 'success', timeout: 5000 });
      if (failed) {
        // 왜 못 받았는지 한 줄로 알려 준다(대개 YouTube 가 막은 경우다).
        const reason = result.failures[0]?.message ?? '';
        toast(`자막을 가져오지 못한 동영상이 ${failed}개 있습니다.${reason ? ` 예: ${reason}` : ''}`, { type: 'warn', timeout: 8000 });
      }
      if (result.listWarning) toast(result.listWarning, { type: 'warn', timeout: 6000 });
      await refreshStatus();
    } catch (error) {
      const canceled = error.code === 'CANCELLED';
      toast(canceled ? '수집을 취소했습니다.' : error.message, { type: canceled ? 'warn' : 'error', timeout: 7000 });
    } finally {
      queue = null;
      cancelling = false;
      setBusy(false);
      progress.hidden = true;
    }
  }

  // 등록된 채널을 순서대로 수집한다(전체 채널 수집 / 채널별 수집 공용).
  async function collectChannels(items) {
    if (queue) return;
    const list = (items ?? []).filter(Boolean);
    if (!list.length) {
      toast('수집할 채널이 없습니다.', { type: 'warn' });
      return;
    }
    const limit = actions.resolveCollectLimit();
    queue = { total: list.length, index: 0 };
    setBusy(true);
    const totals = { added: 0, transcripts: 0, failed: 0, subtitleFailed: 0 };
    let cancelled = false;
    try {
      for (let i = 0; i < list.length; i += 1) {
        const item = list[i];
        const label = item.title ?? item.url ?? '';
        setRowStatus(item.pk, `수집 중… (${i + 1}/${list.length})`);
        paintProgress(i, list.length, `채널 ${i + 1}/${list.length} 수집 중 · ${label}`);
        try {
          // eslint-disable-next-line no-await-in-loop
          const result = await actions.syncChannel({
            url: item.url,
            limit,
            withSubtitles: state.settings?.withSubtitles !== false,
            provider: state.settings?.provider ?? 'auto',
            onProgress: (payload) => {
              const total = Number(payload.total) || 0;
              const done = Number(payload.done) || 0;
              const step = total > 0 ? Math.min(1, done / total) : 0;
              paintProgress(i + step, list.length, `(${i + 1}/${list.length}) ${payload.message ?? '수집 중입니다.'}`);
              setRowStatus(item.pk, `${payload.message ?? '수집 중'}${total > 0 ? ` (${done}/${total})` : ''}`);
            },
          });
          const added = Number(result?.addedCount) || 0;
          const transcripts = Number(result?.transcriptCount) || 0;
          const failedSubtitles = Number(result?.failures?.length) || 0;
          totals.added += added;
          totals.transcripts += transcripts;
          totals.subtitleFailed += failedSubtitles;
          setRowStatus(
            item.pk,
            `완료 · 신규 ${added}개 · 자막 ${transcripts}개${failedSubtitles ? ` · 자막 실패 ${failedSubtitles}개` : ''}`,
          );
        } catch (error) {
          if (error.code === 'CANCELLED') {
            cancelled = true;
            setRowStatus(item.pk, '취소됨');
            break;
          }
          totals.failed += 1;
          setRowStatus(item.pk, `실패 · ${error.message}`);
        }
      }
      const suffix = cancelled ? '중단' : '완료';
      const failedNote = `${totals.failed ? ` · 실패 ${totals.failed}개` : ''}${totals.subtitleFailed ? ` · 자막 실패 ${totals.subtitleFailed}개` : ''}`;
      paintProgress(1, 1, `수집 ${suffix} · 신규 ${totals.added}개 · 자막 ${totals.transcripts}개${failedNote}`);
      toast(
        cancelled
          ? '수집을 취소했습니다.'
          : `채널 ${list.length}개 수집 완료 (신규 ${totals.added}개 · 자막 ${totals.transcripts}개${failedNote})`,
        { type: cancelled || totals.failed || totals.subtitleFailed ? 'warn' : 'success', timeout: 6000 },
      );
      await Promise.all([actions.loadChannels(), actions.loadInfo()]);
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 7000 });
    } finally {
      queue = null;
      cancelling = false;
      setBusy(false);
      progress.hidden = true;
    }
  }

  async function openChannel(pk, view) {
    try {
      await actions.selectChannel(pk);
      onNavigate?.(view);
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  async function removeChannel(pk, title) {
    const yes = await confirmDialog({
      title: '채널 삭제',
      message: `"${title}" 채널과 저장된 동영상 목록을 삭제할까요? 저장한 문장은 남습니다.`,
      confirmText: '삭제',
      danger: true,
    });
    if (!yes) return;
    try {
      await actions.removeChannel(pk);
      toast('채널을 삭제했습니다.', { type: 'success' });
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  function channelRow(item) {
    const avatar = h('div', { class: 'channel-card__avatar' });
    if (item.avatarUrl) avatar.append(h('img', { src: item.avatarUrl, alt: '' }));
    else avatar.textContent = initials(item.title);

    const meta = [item.handle, item.subscriberText, item.videoCountText].filter(Boolean).join(' · ');
    const synced = item.lastSyncedAt ? `마지막 수집 ${formatDate(item.lastSyncedAt)}` : '아직 수집한 기록이 없습니다.';
    const counts = [
      `수집 동영상 ${Number(item.savedVideoCount) || 0}개`,
      `자막 ${Number(item.savedTranscriptCount) || 0}개`,
      `저장 문장 ${Number(item.savedSentenceCount) || 0}개`,
    ].join(' · ');

    const statusEl = h('div', {
      class: 'muted small',
      style: { minHeight: '14px' },
      text: progressByPk.get(item.pk) ?? '',
    });
    rowStatus.set(item.pk, statusEl);

    const collectBtn = h('button', {
      class: 'btn btn--sm btn--primary',
      type: 'button',
      text: '수집',
      title: '이 채널의 동영상과 자막을 다시 가져옵니다.',
      disabled: Boolean(queue),
      onClick: () => collectChannels([item]),
    });
    rowButtons.set(item.pk, collectBtn);

    return h(
      'div',
      { class: 'list-row' },
      avatar,
      h(
        'div',
        { class: 'grow stack', style: { gap: '2px' } },
        h('div', { class: 'list-row__title', text: item.title ?? '' }),
        h('div', { class: 'muted small', text: meta }),
        h('div', { class: 'muted small', text: synced }),
        h('div', { class: 'channel-counts', text: counts }),
        statusEl,
      ),
      h(
        'div',
        { class: 'row' },
        collectBtn,
        h('button', {
          class: 'btn btn--sm btn--subtle',
          type: 'button',
          text: '원본',
          title: '브라우저에서 채널 열기',
          onClick: () => api.app.openExternal(item.url).catch((error) => toast(error.message, { type: 'error' })),
        }),
        h('button', { class: 'btn btn--sm', type: 'button', text: '학습하기', onClick: () => openChannel(item.pk, 'learn') }),
        h('button', {
          class: 'btn btn--sm btn--subtle',
          type: 'button',
          text: '✕',
          title: '채널 삭제',
          onClick: () => removeChannel(item.pk, item.title),
        }),
      ),
    );
  }

  function renderList(s) {
    const channels = s.channels ?? [];
    const signature = channels
      .map((item) =>
        [
          item.pk,
          item.title,
          item.subscriberText,
          item.videoCountText,
          item.avatarUrl,
          item.lastSyncedAt,
          item.savedVideoCount,
          item.savedTranscriptCount,
          item.savedSentenceCount,
        ].join('|'),
      )
      .join('::');
    if (signature === listSignature) return;
    listSignature = signature;

    rowStatus.clear();
    rowButtons.clear();
    listCount.textContent = channels.length ? `${channels.length}개` : '';
    allBtn.hidden = !channels.length;
    clear(listBody);
    if (!channels.length) {
      listBody.append(emptyState('아직 등록된 채널이 없습니다. 위에서 채널 주소를 입력해 보세요.', { icon: '📺' }));
      return;
    }
    for (const item of channels) listBody.append(channelRow(item));
  }

  syncBtn.addEventListener('click', () => {
    const url = input.value.trim();
    if (!url) {
      toast('채널 주소를 입력해 주세요.', { type: 'warn' });
      input.focus();
      return;
    }
    sync(url);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') syncBtn.click();
  });
  cancelBtn.addEventListener('click', () => {
    requestCancel();
  });
  cancelInline.addEventListener('click', () => {
    requestCancel();
  });
  refreshBtn.addEventListener('click', () => refreshStatus());
  downloadBtn.addEventListener('click', () => download());
  allBtn.addEventListener('click', () => collectChannels(state.channels ?? []));

  refreshStatus();

  return {
    element,
    update(s) {
      const collecting = s.collecting;
      const busy = Boolean(queue) || Boolean(collecting);
      syncBtn.disabled = busy;
      paintCancelButtons(busy);
      if (queue) {
        // 여러 채널 수집 중에는 진행률을 queue 쪽에서 관리한다.
        progress.hidden = false;
      } else {
        progress.hidden = !collecting;
        if (collecting) {
          const total = Number(collecting.total) || 0;
          const done = Number(collecting.done) || 0;
          fill.style.width = total > 0 ? `${Math.min(100, Math.round((done / total) * 100))}%` : '8%';
          progressText.textContent = collecting.message ?? '수집 중입니다.';
        }
      }
      renderList(s);
      allBtn.disabled = busy || !(s.channels ?? []).length;
      for (const button of rowButtons.values()) button.disabled = busy;
    },
  };
}
