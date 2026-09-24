import { h, clear, emptyState, toast, thumb } from '../ui.js';
import { state } from '../state.js';
import * as actions from '../actions.js';
import { createModeSwitch, StudyWorkspace } from '../components/study-workspace.js';

export function createLearnView({ onNavigate } = {}) {
  let listSignature = '';
  let channelSignature = '';
  let searchTimer = null;

  const channelSelect = h('select', { class: 'select', onChange: (event) => selectChannel(event.target.value) });
  const picker = h('div', { class: 'study-picker' });
  const pickerCount = h('span', { class: 'muted small picker-count', text: '' });

  // 검색은 메인(SQLite)에서 제목·설명을 걸러 페이지 단위로만 받아온다. 2000편이 넘어도 부하가 없다.
  const searchInput = h('input', {
    class: 'input input--search picker-search',
    type: 'search',
    placeholder: '동영상 제목으로 검색',
    spellcheck: 'false',
    autocomplete: 'off',
    onInput: () => scheduleSearch(searchInput.value),
    onKeyDown: (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      scheduleSearch(searchInput.value, 0);
    },
  });

  const prevBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '‹ 이전', onClick: () => stepPage(-1) });
  const nextBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '다음 ›', onClick: () => stepPage(1) });
  const pagerInfo = h('span', { class: 'muted small picker-pager__info', text: '' });
  const pager = h('div', { class: 'picker-pager' }, prevBtn, pagerInfo, nextBtn);

  const mode = createModeSwitch();

  const pickerCard = h(
    'section',
    { class: 'card' },
    h('div', { class: 'card__head' }, h('div', { class: 'card__title', text: '동영상 선택' }), pickerCount),
    h('div', { class: 'card__body stack' }, searchInput, channelSelect, picker, pager),
  );
  const workspace = new StudyWorkspace({ onOpenSentences: () => onNavigate?.('notes') });

  const head = h(
    'div',
    { class: 'view__head row--between' },
    h(
      'div',
      { class: 'stack', style: { gap: '2px' } },
      h('h1', { class: 'view__title', text: '학습하기' }),
      h('p', { class: 'view__desc', text: '동영상을 고르고 듣기 또는 자막 모드로 학습합니다.' }),
    ),
    mode.element,
  );

  const element = h(
    'div',
    { class: 'view stack' },
    head,
    h('div', { class: 'study-layout' }, pickerCard, workspace.element),
  );

  function cancelSearch() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = null;
  }

  // 타이핑 중에는 잠깐 기다렸다가 한 번만 조회한다(기본 260ms).
  function scheduleSearch(value, wait = 260) {
    cancelSearch();
    searchTimer = setTimeout(() => {
      searchTimer = null;
      goToPage({ q: value, offset: 0 });
    }, wait);
  }

  // 검색어/페이지 이동은 항상 메인에서 다시 읽어 온다(전체를 렌더러로 넘기지 않는다).
  async function goToPage(patch = {}) {
    try {
      await actions.loadVideoPage({ channelPk: state.activeChannelPk, limit: actions.VIDEO_PAGE_SIZE, ...patch });
      picker.scrollTop = 0;
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  function stepPage(direction) {
    const page = state.videoPage ?? {};
    const size = page.limit || actions.VIDEO_PAGE_SIZE;
    goToPage({ offset: Math.max(0, (page.offset ?? 0) + direction * size) });
  }

  async function selectChannel(value) {
    const pk = Number(value);
    if (!Number.isFinite(pk) || pk === 0) return;
    cancelSearch();
    searchInput.value = '';
    try {
      await actions.selectChannel(pk);
      listSignature = '';
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  async function openVideo(videoId) {
    if (!videoId || videoId === state.activeVideoId) return;
    try {
      await actions.loadVideo(videoId);
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  function renderChannels(s) {
    const channels = s.channels ?? [];
    const signature = channels.map((item) => item.pk).join('|');
    if (signature === channelSignature) return;
    channelSignature = signature;

    clear(channelSelect);
    if (!channels.length) {
      channelSelect.append(h('option', { value: '', text: '등록된 채널이 없습니다.' }));
      channelSelect.disabled = true;
      return;
    }
    channelSelect.disabled = false;
    for (const item of channels) {
      channelSelect.append(h('option', { value: String(item.pk), text: `${item.title ?? ''}${item.videoCountText ? ` · ${item.videoCountText}` : ''}` }));
    }
    if (s.activeChannelPk) channelSelect.value = String(s.activeChannelPk);
  }

  function renderPicker(s) {
    const videos = s.videos ?? [];
    const page = s.videoPage ?? {};
    const q = page.q ?? '';
    const limit = page.limit || videos.length || 1;
    const total = page.total ?? videos.length;
    const offset = page.offset ?? 0;
    if (searchInput.value !== q) searchInput.value = q;

    // 목록을 다시 그리지 않아도 되는 부분(개수·페이지 표시)은 먼저 갱신한다.
    pickerCount.textContent = page.loading
      ? '불러오는 중…'
      : !total
        ? (q ? '검색 결과 0개' : '')
        : `${q ? '검색 결과' : '전체'} ${total.toLocaleString('en-US')}개 중 ${offset + 1}–${offset + videos.length}`;
    pagerInfo.textContent = `${Math.floor(offset / limit) + 1} / ${Math.max(1, Math.ceil(total / limit))}`;
    prevBtn.disabled = offset <= 0;
    nextBtn.disabled = !page.hasMore;

    const signature = `${s.activeChannelPk ?? ''}::${q}::${offset}::${total}::${videos.map((video) => video.videoId).join('|')}::${s.activeVideoId ?? ''}`;
    if (signature === listSignature) return;
    listSignature = signature;

    clear(picker);
    if (!videos.length) {
      const message = q
        ? `"${q}" 검색 결과가 없습니다.`
        : s.channels?.length
          ? '이 채널에서 가져온 동영상이 없습니다.'
          : '먼저 채널을 불러와 주세요.';
      picker.append(emptyState(message, { icon: q ? '🔍' : '🎬' }));
      return;
    }
    for (const video of videos) {
      const meta = [video.viewCountText, video.publishedText].filter(Boolean).join(' · ');
      const sub = [meta, video.hasTranscript ? '자막 있음' : '자막 없음'].filter(Boolean).join(' · ');
      picker.append(
        h(
          'button',
          {
            class: `picker-item${video.videoId === s.activeVideoId ? ' is-active' : ''}`,
            type: 'button',
            title: video.title,
            onClick: () => openVideo(video.videoId),
          },
          thumb({
            title: video.title,
            thumbnailUrl: video.thumbnailUrl,
            durationText: video.durationText,
          }),
          h(
            'span',
            { class: 'picker-item__body' },
            h('span', { class: 'picker-item__title', text: video.title ?? '제목 없음' }),
            h('span', { class: 'picker-item__meta', text: sub }),
          ),
        ),
      );
    }
  }
  return {
    element,
    update(s) {
      mode.update(s.studyMode);
      renderChannels(s);
      renderPicker(s);
      workspace.update(s);
    },
    destroy() {
      cancelSearch();
      workspace.destroy();
    },
  };
}
