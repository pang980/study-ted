import { h, clear, formatDate, shorten, emptyState, toast, confirmDialog, openModal, debounce } from '../ui.js';
import { api } from '../api.js';
import * as actions from '../actions.js';
import { parseStructureText } from './sentence-panel.js';
import { renderAnalysisCard, hasAnalysis, analysisSummaryText } from './analysis-card.js';

const SORT_OPTIONS = [
  { value: 'latest', label: '최신순' },
  { value: 'oldest', label: '오래된순' },
  { value: 'sentence', label: '문장순' },
  { value: 'video', label: '영상순' },
  { value: 'favorite', label: '즐겨찾기순' },
];

const EXPORT_FORMATS = [
  { value: 'json', label: 'JSON', hint: '다른 사람이 그대로 가져올 수 있는 형식입니다.' },
  { value: 'md', label: 'Markdown', hint: '읽기 좋은 문서로 저장합니다.' },
  { value: 'html', label: 'HTML', hint: '브라우저에서 열고 인쇄할 수 있습니다.' },
  { value: 'csv', label: 'CSV', hint: '엑셀에서 열 수 있습니다.' },
];

const COLUMNS = ['번호', '★', '문장', '해석', '분석', '출처', '저장일', ''];

export async function exportSentences(scope = 'all') {
  const radios = EXPORT_FORMATS.map((item) =>
    h(
      'label',
      { class: 'row', style: { alignItems: 'flex-start', gap: '8px' } },
      h('input', { type: 'radio', name: 'export-format', value: item.value, checked: item.value === 'json' }),
      h('span', { class: 'stack', style: { gap: '2px' } }, h('strong', { text: item.label }), h('span', { class: 'muted small', text: item.hint })),
    ),
  );

  const format = await new Promise((resolve) => {
    const dialog = openModal({
      title: '내보내기 (공유용)',
      body: h('div', { class: 'stack' }, h('p', { class: 'muted small', text: '저장할 파일 형식을 선택하면 저장 위치를 묻습니다.' }), ...radios),
      foot: [
        h('button', { class: 'btn', type: 'button', text: '취소', onClick: () => { resolve(null); dialog.close(); } }),
        h('button', {
          class: 'btn btn--primary',
          type: 'button',
          text: '내보내기',
          onClick: () => {
            const picked = dialog.modal.querySelector('input[name="export-format"]:checked');
            resolve(picked ? picked.value : 'json');
            dialog.close();
          },
        }),
      ],
      onClose: () => resolve(null),
    });
  });

  if (!format) return null;
  try {
    const result = await api.share.export({ format, scope });
    if (result.canceled) return null;
    toast(`${result.path} 로 내보냈습니다.`, { type: 'success', timeout: 5000 });
    return result;
  } catch (error) {
    toast(error.message, { type: 'error' });
    return null;
  }
}

function openSentenceEditor(sentence) {
  const analysis = sentence.analysis ?? {};
  const toLines = (items, join) => (Array.isArray(items) ? items.map(join).join('\n') : '');

  const fields = {
    sentence: h('textarea', { class: 'textarea', rows: '3', value: sentence.sentence ?? '' }),
    translation: h('input', { class: 'input', value: sentence.translation ?? '', placeholder: '한국어 해석' }),
    structure: h('textarea', { class: 'textarea', rows: '4', value: toLines(analysis.structure, (item) => [item.part, item.meaning, item.note].filter(Boolean).join(' | ')) }),
  };

  const field = (label, control, hint) =>
    h('div', { class: 'form-field' }, h('label', { class: 'form-field__label', text: label }), control, hint ? h('p', { class: 'form-field__hint', text: hint }) : null);

  const dialog = openModal({
    title: '문장 수정',
    body: h(
      'div',
      { class: 'stack' },
      field('영어 문장 *', fields.sentence),
      field('해석', fields.translation),
      field('구문 분석', fields.structure, '한 줄에 하나씩 "구문 | 의미 | 설명" 형식입니다. "구문"은 영어로 적어 주세요.'),
    ),
    foot: [
      h('button', { class: 'btn', type: 'button', text: '취소', onClick: () => dialog.close() }),
      h('button', {
        class: 'btn btn--primary',
        type: 'button',
        text: '저장',
        onClick: async () => {
          const value = fields.sentence.value.trim();
          if (!value) {
            toast('영어 문장은 필수입니다.', { type: 'warn' });
            return;
          }
          const structure = parseStructureText(fields.structure.value);
          const translation = fields.translation.value.trim();
          const hasAnalysis = structure.length || translation;
          try {
            await actions.updateSentence(sentence.pk, {
              sentence: value,
              translation: translation || null,
              analysis: hasAnalysis ? { translation, structure } : null,
            });
            toast('문장을 수정했습니다.', { type: 'success' });
            dialog.close();
          } catch (error) {
            toast(error.message, { type: 'error' });
          }
        },
      }),
    ],
  });
  return dialog;
}

export class NotesTable {
  constructor({ title = '학습한 문장', onSeek = null, showTitle = true } = {}) {
    this.onSeek = onSeek;
    this.title = title;
    this.showTitle = showTitle;
    this.lastChannelSignature = '';
    this.rows = [];

    this.searchInput = h('input', {
      class: 'input input--search',
      type: 'search',
      placeholder: '저장한 문장 검색...',
      style: { flex: '1', minWidth: '160px' },
      onInput: debounce(() => this.applyFilters(), 280),
    });
    this.channelSelect = h('select', { class: 'select', style: { width: 'auto', minWidth: '128px' }, onChange: () => this.applyFilters() });
    this.sortSelect = h('select', { class: 'select', style: { width: 'auto', minWidth: '112px' }, onChange: () => this.applyFilters() });
    this.favBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '★ 즐겨찾기', onClick: () => this.toggleFavoriteOnly() });
    this.countLabel = h('span', { class: 'muted small', text: '' });
    this.exportBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '⤓ 내보내기 (공유용)', onClick: () => this.exportNow() });

    this.tbody = h('tbody');
    this.table = h(
      'table',
      { class: 'data-table' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          ...COLUMNS.map((label, index) =>
            h('th', {
              text: label,
              style: index === 0 ? { width: '52px' } : index === 1 ? { width: '40px' } : index === 4 ? { width: '176px' } : index === 7 ? { width: '104px', textAlign: 'right' } : null,
            }),
          ),
        ),
      ),
      this.tbody,
    );

    this.headRow = h(
      'div',
      { class: 'row', style: { flex: '1', gap: '8px' } },
      this.searchInput,
      this.channelSelect,
      this.sortSelect,
      this.favBtn,
    );

    // 상세를 펼치면 높이 제한을 풀어야 해서 감싸는 요소를 기억해 둔다.
    this.tableWrap = h('div', { class: 'table-wrap' }, this.table);

    this.element = h(
      'section',
      { class: 'card' },
      h(
        'div',
        { class: 'table-head' },
        this.showTitle ? h('span', { class: 'card__title', text: this.title }) : null,
        this.headRow,
        this.countLabel,
        this.exportBtn,
      ),
      this.tableWrap,
    );
  }

  applyFilters() {
    const channelPk = this.channelSelect.value ? Number(this.channelSelect.value) : null;
    actions.loadSentences({
      q: this.searchInput.value.trim(),
      channelPk,
      sort: this.sortSelect.value,
      favoriteOnly: this.favBtn.classList.contains('is-on'),
    });
  }

  toggleFavoriteOnly() {
    const on = !this.favBtn.classList.contains('is-on');
    this.favBtn.classList.toggle('is-on', on);
    this.favBtn.classList.toggle('btn--primary', on);
    this.applyFilters();
  }

  async exportNow() {
    await exportSentences('all');
  }

  syncControls(state) {
    const channelSignature = state.channels.map((channel) => `${channel.pk}:${channel.title}`).join('|');
    if (channelSignature !== this.lastChannelSignature) {
      this.lastChannelSignature = channelSignature;
      const current = state.filters.channelPk ? String(state.filters.channelPk) : '';
      clear(this.channelSelect);
      this.channelSelect.append(h('option', { value: '', text: '전체 채널' }));
      for (const channel of state.channels) {
        this.channelSelect.append(h('option', { value: String(channel.pk), text: shorten(channel.title, 22) }));
      }
      this.channelSelect.value = current;
    }

    const sorts = SORT_OPTIONS.map((option) => option.value).join('|');
    if (this.sortSelect.dataset.ready !== sorts) {
      this.sortSelect.dataset.ready = sorts;
      clear(this.sortSelect);
      for (const option of SORT_OPTIONS) this.sortSelect.append(h('option', { value: option.value, text: option.label }));
    }
    this.sortSelect.value = state.filters.sort;

    if (document.activeElement !== this.searchInput && this.searchInput.value !== state.filters.q) {
      this.searchInput.value = state.filters.q ?? '';
    }

    this.favBtn.classList.toggle('is-on', Boolean(state.filters.favoriteOnly));
    this.favBtn.classList.toggle('btn--primary', Boolean(state.filters.favoriteOnly));
  }

  renderRows(state) {
    const items = state.sentences.items ?? [];
    this.rows = items;
    clear(this.tbody);
    // 행을 다시 그리면 펼친 상세도 사라지므로 높이 제한을 원래대로 돌린다.
    this.tableWrap.classList.remove('is-expanded');
    this.countLabel.textContent = `전체 ${state.sentences.total ?? items.length}개`;

    if (!items.length) {
      this.tbody.append(
        h('tr', {}, h('td', { colspan: String(COLUMNS.length) }, emptyState('저장한 문장이 없습니다. 자막에서 문장을 선택해 저장해 보세요.', { icon: '📝' }))),
      );
      return;
    }

    items.forEach((item, index) => {
      const star = h('button', {
        class: `star-btn${item.isFavorite ? ' is-on' : ''}`,
        type: 'button',
        title: item.isFavorite ? '즐겨찾기 해제' : '즐겨찾기',
        text: item.isFavorite ? '★' : '☆',
        onClick: async () => {
          try {
            await actions.toggleFavorite(item.pk);
          } catch (error) {
            toast(error.message, { type: 'error' });
          }
        },
      });

      const sentenceCell = h('div', {
        class: 'cell-sentence cell-clamp is-clickable',
        title: '눌러서 해석·구문 분석 보기',
        text: item.sentence,
        onClick: () => toggleDetail(),
      });
      const actions_cell = h(
        'div',
        { class: 'row-actions' },
        h('button', { class: 'btn btn--sm btn--subtle', type: 'button', title: '수정', text: '✎', onClick: () => openSentenceEditor(item) }),
        h('button', {
          class: 'btn btn--sm btn--subtle',
          type: 'button',
          title: '학습 +1',
          text: '+1',
          onClick: async () => {
            try {
              await api.sentences.study(item.pk);
              toast('학습 횟수를 늘렸습니다.', { type: 'success' });
            } catch (error) {
              toast(error.message, { type: 'error' });
            }
          },
        }),
        h('button', {
          class: 'btn btn--sm btn--subtle',
          type: 'button',
          title: '삭제',
          text: '✕',
          onClick: async () => {
            const yes = await confirmDialog({ title: '문장 삭제', message: '이 문장을 삭제할까요?', confirmText: '삭제', danger: true });
            if (!yes) return;
            try {
              await actions.removeSentence(item.pk);
              toast('문장을 삭제했습니다.', { type: 'success' });
            } catch (error) {
              toast(error.message, { type: 'error' });
            }
          },
        }),
      );

      // 저장된 AI 분석(문장 해석·구문 분석)을 목록에서 바로 펼쳐 볼 수 있게 한다.
      const analysis = item.analysis ?? null;
      const hasSavedAnalysis = hasAnalysis(analysis);
      // 문장을 눌러도, "분석 보기"를 눌러도 같은 상세가 열린다.
      const detailRow = h(
        'tr',
        { class: 'is-detail', hidden: true },
        h(
          'td',
          { colspan: String(COLUMNS.length) },
          h(
            'div',
            { class: 'detail-body' },
            h('div', { class: 'detail-sentence', text: item.sentence }),
            hasSavedAnalysis
              ? renderAnalysisCard(analysis, { model: analysis?.model ?? '', title: '저장된 AI 분석', head: false })
              : h('p', { class: 'muted small', text: '저장된 AI 분석이 없습니다. "수정"에서 직접 입력하거나 학습 화면에서 "AI 구문분석"을 실행해 주세요.' }),
          ),
        ),
      );
      // 상세가 하나라도 열려 있으면 목록 높이 제한을 풀어 분석 내용이 잘리지 않게 한다.
      const syncExpanded = () => {
        const open = Array.from(this.tbody.querySelectorAll('tr.is-detail')).some((row) => !row.hidden);
        this.tableWrap.classList.toggle('is-expanded', open);
      };
      const toggleDetail = () => {
        detailRow.hidden = !detailRow.hidden;
        syncExpanded();
      };
      const analysisCell = hasSavedAnalysis
        ? h(
            'div',
            { class: 'row', style: { gap: '6px', alignItems: 'center' } },
            h('span', { class: 'analysis-summary muted small', text: analysisSummaryText(analysis) || '해석만 저장됨' }),
            h('button', {
              class: 'btn btn--sm btn--subtle',
              type: 'button',
              title: 'AI 분석 상세 보기',
              text: '분석 보기',
              onClick: () => toggleDetail(),
            })
          )
        : h('span', { class: 'muted small', text: '—' });

      const row = h(
        'tr',
        {},
        h('td', { class: 'muted small', text: String(index + 1) }),
        h('td', {}, star),
        h('td', { style: { maxWidth: '380px' } }, sentenceCell),
        h('td', { style: { maxWidth: '300px' } }, h('div', { class: 'cell-clamp', title: item.translation ?? '', text: item.translation ?? '—' })),
        h('td', { style: { maxWidth: '180px' } }, analysisCell),
        h(
          'td',
          { style: { maxWidth: '200px' } },
          item.videoId
            ? h('button', {
                class: 'btn btn--sm btn--subtle',
                type: 'button',
                title: item.videoTitle ?? '',
                text: shorten(item.videoTitle ?? item.videoId, 24),
                onClick: () => this.onSeek?.(item),
              })
            : h('span', { class: 'muted small', text: '직접 입력' }),
        ),
        h('td', { class: 'muted small', text: formatDate(item.createdAt) }),
        h('td', {}, actions_cell),
      );
      this.tbody.append(row);
      if (detailRow) this.tbody.append(detailRow);
    });
  }

  render(state) {
    this.syncControls(state);
    this.renderRows(state);
  }
}
