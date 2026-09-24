import { h, clear, thumb, initials, emptyState, toast } from '../ui.js';
import { state } from '../state.js';
import * as actions from '../actions.js';
import { createChannelBar, StudyWorkspace } from '../components/study-workspace.js';
import { NotesTable } from '../components/notes-table.js';
import { createUpdateBanner } from '../components/update-banner.js';

const GRID_LIMIT = 4;

function videoCard(video, activeVideoId, onOpen) {
  const meta = [video.viewCountText, video.publishedText].filter(Boolean).join(' · ');
  return h(
    'button',
    {
      class: `video-card${video.videoId === activeVideoId ? ' is-active' : ''}`,
      type: 'button',
      title: video.title,
      onClick: () => onOpen(video.videoId),
    },
    thumb({
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      durationText: video.durationText,
      badge: video.hasTranscript ? '자막' : null,
    }),
    h('span', { class: 'video-card__title', text: video.title }),
    h('span', { class: 'video-card__meta', text: meta || video.channelTitle || '' }),
  );
}

export function createHomeView({ onNavigate } = {}) {
  let channelSignature = '';
  let gridSignature = '';
  let syncing = false;

  const channel = () => (state.channels ?? []).find((item) => item.pk === state.activeChannelPk) ?? null;

  async function sync(url) {
    if (syncing) return;
    syncing = true;
    try {
      const result = await actions.syncFromUrl(url);
      const parts = [`동영상 ${result.videoCount ?? 0}개`];
      if (result.transcriptCount) parts.push(`자막 ${result.transcriptCount}개`);
      toast(`채널을 불러왔습니다. (${parts.join(' · ')})`, { type: 'success', timeout: 5000 });
      if (result.listWarning) toast(result.listWarning, { type: 'warn', timeout: 6000 });
      if (result.failures?.length) toast(`자막을 가져오지 못한 동영상이 ${result.failures.length}개 있습니다.`, { type: 'warn', timeout: 6000 });
    } catch (error) {
      const canceled = error.code === 'CANCELLED';
      toast(canceled ? '수집을 취소했습니다.' : error.message, { type: canceled ? 'warn' : 'error', timeout: 7000 });
    } finally {
      syncing = false;
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

  async function openFromNote(item) {
    try {
      await actions.openSentenceSource(item);
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  const banner = createUpdateBanner({ onOpenSettings: () => onNavigate?.('settings') });

  const bar = createChannelBar({
    onSync: sync,
    onCancel: () => {
      actions.cancelCollect();
    },
  });

  const avatar = h('div', { class: 'channel-card__avatar' });
  const nameEl = h('div', { class: 'channel-card__name' });
  const metaEl = h('div', { class: 'channel-card__meta' });
  const descEl = h('div', { class: 'channel-card__desc' });
  const videosLabel = h('span', { class: 'muted small', text: '채널의 동영상 목록 (최신순)' });
  const moreBtn = h('button', {
    class: 'btn btn--sm btn--subtle',
    type: 'button',
    text: '모두 보기 >',
    onClick: () => onNavigate?.('learn'),
  });
  const grid = h('div', { class: 'thumb-grid' });
  const channelCard = h(
    'section',
    { class: 'card', hidden: true },
    h(
      'div',
      { class: 'channel-card' },
      avatar,
      h('div', {}, nameEl, metaEl, descEl),
      h('div', { class: 'channel-card__videos' }, h('div', { class: 'row row--between' }, videosLabel, moreBtn), grid),
    ),
  );

  const workspace = new StudyWorkspace({ onOpenSentences: () => onNavigate?.('notes') });
  const notes = new NotesTable({ title: '학습한 문장', onSeek: openFromNote });

  const element = h('div', { class: 'view' }, banner.element, bar.element, channelCard, workspace.element, notes.element);

  function renderChannelCard(s) {
    const current = (s.channels ?? []).find((item) => item.pk === s.activeChannelPk) ?? null;
    const signature = current
      ? [current.pk, current.title, current.subscriberText, current.videoCountText, current.avatarUrl, current.description].join('|')
      : 'none';
    if (signature === channelSignature) return;
    channelSignature = signature;

    channelCard.hidden = !current;
    if (!current) return;

    clear(avatar);
    if (current.avatarUrl) avatar.append(h('img', { src: current.avatarUrl, alt: '' }));
    else avatar.textContent = initials(current.title);

    nameEl.textContent = current.title ?? '';
    const meta = [current.subscriberText, current.videoCountText].filter(Boolean).join(' · ');
    metaEl.textContent = meta;
    metaEl.hidden = !meta;
    descEl.textContent = current.description ?? '';
    descEl.hidden = !current.description;
    videosLabel.textContent = `채널의 동영상 목록 (최신순)`;
  }

  function renderGrid(s) {
    const list = (s.videos ?? []).slice(0, GRID_LIMIT);
    const signature = `${list.map((video) => video.videoId).join('|')}::${s.activeVideoId ?? ''}`;
    if (signature === gridSignature) return;
    gridSignature = signature;

    clear(grid);
    if (!list.length) {
      grid.append(emptyState(channel() ? '이 채널에서 저장된 동영상이 없습니다.' : '채널을 불러오면 최신 동영상이 순서대로 표시됩니다.', { icon: '🎬' }));
      return;
    }
    for (const video of list) grid.append(videoCard(video, s.activeVideoId, openVideo));
  }

  return {
    element,
    update(s) {
      banner.update(s);
      bar.update(s);
      renderChannelCard(s);
      renderGrid(s);
      workspace.update(s);
      notes.render(s);
    },
    destroy() {
      workspace.destroy();
    },
  };
}
