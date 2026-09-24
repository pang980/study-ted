import { h, clear, formatTime, emptyState, toast } from '../ui.js';
import { exportSentences } from '../components/notes-table.js';
import { renderAnalysisCard, hasAnalysis, analysisSummaryText } from '../components/analysis-card.js';
import * as actions from '../actions.js';

function groupBySource(items, channels) {
  const index = new Map(channels.map((channel) => [channel.pk, channel]));
  const groups = new Map();

  for (const item of items) {
    const channelKey = item.channelPk ?? 0;
    if (!groups.has(channelKey)) {
      const channel = index.get(item.channelPk);
      groups.set(channelKey, {
        pk: item.channelPk ?? null,
        title: channel?.title ?? (item.channelPk ? `채널 #${item.channelPk}` : '동영상 없이 저장한 문장'),
        url: channel?.url ?? null,
        videos: new Map(),
      });
    }
    const group = groups.get(channelKey);
    const videoKey = item.videoId ?? 'manual';
    if (!group.videos.has(videoKey)) {
      group.videos.set(videoKey, {
        videoId: item.videoId ?? null,
        title: item.videoTitle ?? '직접 입력한 문장',
        url: item.videoUrl ?? null,
        items: [],
      });
    }
    group.videos.get(videoKey).items.push(item);
  }

  return [...groups.values()].map((group) => ({ ...group, videos: [...group.videos.values()] }));
}

export function createMaterialsView({ onNavigate } = {}) {
  let signature = '';
  let opening = false;

  const totalLabel = h('span', { class: 'pill pill--primary', text: '0' });
  const container = h('div', { class: 'stack' });

  const head = h(
    'div',
    { class: 'view__head row--between' },
    h(
      'div',
      { class: 'stack', style: { gap: '2px' } },
      h('div', { class: 'row' }, h('h1', { class: 'view__title', text: '학습 자료' }), totalLabel),
      h('p', { class: 'view__desc', text: '채널과 동영상별로 저장한 문장을 묶어서 봅니다.' }),
    ),
  );

  const element = h('div', { class: 'view stack' }, head, container);

  async function openVideo(videoId) {
    if (!videoId || opening) return;
    opening = true;
    try {
      await actions.loadVideo(videoId);
      onNavigate?.('learn');
    } catch (error) {
      toast(error.message, { type: 'error' });
    } finally {
      opening = false;
    }
  }

  async function openAt(item) {
    if (!item.videoId) {
      toast('이 문장은 동영상과 연결되어 있지 않습니다.', { type: 'warn' });
      return;
    }
    try {
      await actions.openSentenceSource(item, { navigate: onNavigate });
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  function sentenceRow(item) {
    const analysis = item.analysis ?? null;
    const hasSavedAnalysis = hasAnalysis(analysis);
    const detail = hasSavedAnalysis
      ? h('div', { class: 'list-row__detail', hidden: true }, renderAnalysisCard(analysis, { model: analysis?.model ?? '', title: '저장된 AI 분석' }))
      : null;
    const row = h(
      'div',
      { class: 'list-row', style: { cursor: item.videoId ? 'pointer' : 'default' }, onClick: () => openAt(item) },
      h('span', { class: 'muted small', style: { minWidth: '52px' }, text: item.startSec === null || item.startSec === undefined ? '--:--' : formatTime(item.startSec) }),
      h(
        'div',
        { class: 'grow stack', style: { gap: '2px' } },
        h('div', { class: 'cell-sentence', text: item.sentence ?? '' }),
        item.translation ? h('div', { class: 'muted small', text: item.translation }) : null,
      ),
      hasSavedAnalysis ? h('span', { class: 'pill', text: analysisSummaryText(analysis) || '해석' }) : null,
      hasSavedAnalysis
        ? h('button', {
            class: 'btn btn--sm btn--subtle',
            type: 'button',
            title: 'AI 분석 상세 보기',
            text: '분석',
            onClick: (event) => {
              // 행 클릭(그 구간 재생)과 겹치지 않게 막는다.
              event.stopPropagation();
              if (detail) detail.hidden = !detail.hidden;
            },
          })
        : null,
      item.isFavorite ? h('span', { class: 'star-btn is-on', text: '★' }) : null,
    );
    return detail ? h('div', { class: 'list-block' }, row, detail) : row;
  }

  function videoGroup(group) {
    const list = h('div', { class: 'listbox' }, ...group.items.map(sentenceRow));
    return h(
      'div',
      { class: 'material-group' },
      h(
        'div',
        { class: 'material-group__head' },
        h(
          'div',
          { class: 'stack', style: { gap: '2px' } },
          h('strong', { text: group.title }),
          h('span', { class: 'muted small', text: `문장 ${group.items.length}개` }),
        ),
        group.videoId
          ? h(
              'div',
              { class: 'row' },
              h('button', { class: 'btn btn--sm', type: 'button', text: '학습하기', onClick: () => openVideo(group.videoId) }),
            )
          : null,
      ),
      list,
    );
  }

  function render(s) {
    const items = s.sentences?.items ?? [];
    const groups = groupBySource(items, s.channels ?? []);
    // 분석 유무도 서명에 넣어야 분석만 바뀐 문장도 다시 그려진다.
    const next = groups
      .map((group) => `${group.pk}:${group.videos.map((video) => `${video.videoId}:${video.items.map((item) => `${item.pk}${hasAnalysis(item.analysis) ? '*' : ''}`).join(',')}`).join('|')}`)
      .join('::');
    if (next === signature) return;
    signature = next;

    totalLabel.textContent = `${items.length}개`;
    clear(container);
    if (!groups.length) {
      container.append(emptyState('아직 저장한 문장이 없습니다. 학습 화면에서 문장을 저장해 보세요.', { icon: '📚' }));
      return;
    }

    for (const group of groups) {
      const count = group.videos.reduce((sum, video) => sum + video.items.length, 0);
      const card = h(
        'section',
        { class: 'card' },
        h(
          'div',
          { class: 'card__head' },
          h(
            'div',
            { class: 'stack', style: { gap: '2px' } },
            h('div', { class: 'card__title', text: group.title }),
            h('span', { class: 'muted small', text: `동영상 ${group.videos.length}개 · 문장 ${count}개` }),
          ),
          group.pk
            ? h('button', {
                class: 'btn btn--sm btn--subtle',
                type: 'button',
                text: '⤓ 내보내기',
                onClick: () => exportSentences(`channel:${group.pk}`),
              })
            : null,
        ),
        h('div', { class: 'card__body stack' }, ...group.videos.map(videoGroup)),
      );
      container.append(card);
    }
  }

  return {
    element,
    update(s) {
      render(s);
    },
  };
}
