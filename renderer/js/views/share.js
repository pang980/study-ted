import { h, clear, toast } from '../ui.js';
import { api } from '../api.js';
import * as actions from '../actions.js';

const FORMATS = [
  { value: 'json', label: 'JSON', hint: '다른 사람이 이 앱에서 그대로 가져올 수 있습니다.' },
  { value: 'md', label: 'Markdown', hint: '읽기 좋은 문서로 저장합니다.' },
  { value: 'html', label: 'HTML', hint: '브라우저에서 열고 인쇄할 수 있습니다.' },
  { value: 'csv', label: 'CSV', hint: '엑셀에서 열 수 있습니다.' },
];

export function createShareView() {
  let format = 'json';
  let exporting = false;
  let importing = false;

  const formatRow = h('div', { class: 'chip-row' });
  const scopeSelect = h('select', { class: 'select', style: { minWidth: '220px' } });
  const exportBtn = h('button', { class: 'btn btn--primary', type: 'button', text: '⤓ 내보내기' });
  const exportHint = h('p', { class: 'muted small', text: FORMATS[0].hint });

  const exportCard = h(
    'section',
    { class: 'card' },
    h('div', { class: 'card__head' }, h('div', { class: 'card__title', text: '내보내기 (공유용)' })),
    h(
      'div',
      { class: 'card__body stack' },
      h(
        'div',
        { class: 'form-field' },
        h('label', { class: 'form-field__label', text: '파일 형식' }),
        formatRow,
        exportHint,
      ),
      h(
        'div',
        { class: 'form-field' },
        h('label', { class: 'form-field__label', text: '보낼 범위' }),
        scopeSelect,
        h('p', { class: 'form-field__hint', text: '채널을 고르면 그 채널의 문장만 저장합니다.' }),
      ),
      h('div', { class: 'row' }, exportBtn),
    ),
  );

  const importSummary = h('div', { class: 'stack' });
  const importBtn = h('button', { class: 'btn', type: 'button', text: 'JSON 파일 선택' });

  const importCard = h(
    'section',
    { class: 'card' },
    h('div', { class: 'card__head' }, h('div', { class: 'card__title', text: '가져오기' })),
    h(
      'div',
      { class: 'card__body stack' },
      h('p', {
        class: 'muted small',
        text: '다른 사람이 내보낸 JSON 파일을 선택하면 문장이 내 목록에 합쳐집니다. 같은 문장은 중복 저장하지 않습니다.',
      }),
      h('div', { class: 'row' }, importBtn),
      importSummary,
    ),
  );

  const guideCard = h(
    'section',
    { class: 'card' },
    h('div', { class: 'card__head' }, h('div', { class: 'card__title', text: '공유하는 방법' })),
    h(
      'div',
      { class: 'card__body' },
      h(
        'ol',
        { class: 'stack', style: { paddingLeft: '18px', margin: '0' } },
        h('li', { class: 'small', text: 'JSON 으로 내보내면 상대방이 이 앱의 "가져오기" 로 그대로 불러올 수 있습니다.' }),
        h('li', { class: 'small', text: 'Markdown / HTML / CSV 는 노션·블로그·엑셀에 붙여 넣어 공유할 때 씁니다.' }),
        h('li', { class: 'small', text: '즐겨찾기만 보내고 싶다면 범위를 "즐겨찾기만" 으로 고르세요.' }),
      ),
    ),
  );

  const element = h('div', { class: 'view stack' }, exportCard, importCard, guideCard);

  for (const item of FORMATS) {
    formatRow.append(
      h('button', {
        class: `chip${item.value === format ? ' chip--on' : ''}`,
        type: 'button',
        text: item.label,
        dataset: { format: item.value },
        onClick: (event) => {
          format = item.value;
          for (const button of formatRow.querySelectorAll('.chip')) button.classList.toggle('chip--on', button.dataset.format === format);
          exportHint.textContent = item.hint;
        },
      }),
    );
  }

  function renderScopes(s) {
    const channels = s.channels ?? [];
    const current = scopeSelect.value;
    const options = [
      { value: 'all', label: `전체 문장 (${s.sentences?.total ?? 0}개)` },
      { value: 'favorites', label: '즐겨찾기만' },
      ...channels.map((channel) => ({ value: `channel:${channel.pk}`, label: `${channel.title ?? '채널'} 문장만` })),
    ];
    const signature = options.map((option) => `${option.value}:${option.label}`).join('|');
    if (scopeSelect.dataset.signature === signature) return;
    scopeSelect.dataset.signature = signature;
    clear(scopeSelect);
    for (const option of options) scopeSelect.append(h('option', { value: option.value, text: option.label }));
    scopeSelect.value = options.some((option) => option.value === current) ? current : 'all';
  }

  async function runExport() {
    if (exporting) return;
    exporting = true;
    exportBtn.disabled = true;
    exportBtn.textContent = '내보내는 중…';
    try {
      const result = await api.share.export({ format, scope: scopeSelect.value || 'all' });
      if (result.canceled) return;
      toast(`${result.path} 로 내보냈습니다. (문장 ${result.counts?.sentences ?? 0}개)`, { type: 'success', timeout: 6000 });
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 6000 });
    } finally {
      exporting = false;
      exportBtn.disabled = false;
      exportBtn.textContent = '⤓ 내보내기';
    }
  }

  async function runImport() {
    if (importing) return;
    importing = true;
    importBtn.disabled = true;
    importBtn.textContent = '가져오는 중…';
    clear(importSummary);
    try {
      const result = await api.share.import({});
      if (result.canceled) return;
      const summary = result.summary ?? {};
      importSummary.append(
        h('div', { class: 'card', style: { background: 'var(--selected-bg)' } },
          h(
            'div',
            { class: 'card__body stack' },
            h('strong', { text: `가져왔습니다: ${result.path ?? ''}` }),
            h('span', { class: 'small', text: `새 문장 ${summary.added ?? 0}개 · 합쳐진 문장 ${summary.merged ?? 0}개 · 건너뜀 ${summary.skipped ?? 0}개` }),
            h('span', { class: 'muted small', text: `만든 동영상 ${summary.videosCreated ?? 0}개 · 만든 채널 ${summary.channelsCreated ?? 0}개` }),
          ),
        ),
      );
      await Promise.all([actions.loadSentences(), actions.loadChannels(), actions.loadInfo()]);
      toast('가져오기를 마쳤습니다.', { type: 'success' });
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 6000 });
    } finally {
      importing = false;
      importBtn.disabled = false;
      importBtn.textContent = 'JSON 파일 선택';
    }
  }

  exportBtn.addEventListener('click', () => runExport());
  importBtn.addEventListener('click', () => runImport());

  return {
    element,
    update(s) {
      renderScopes(s);
    },
  };
}
