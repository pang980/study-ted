import { h, toast } from '../ui.js';
import { NotesTable } from '../components/notes-table.js';
import * as actions from '../actions.js';

export function createNotesView({ onNavigate } = {}) {
  const countLabel = h('span', { class: 'pill pill--primary', text: '0' });

  const head = h(
    'div',
    { class: 'view__head row--between' },
    h(
      'div',
      { class: 'stack', style: { gap: '2px' } },
      h('div', { class: 'row' }, h('h1', { class: 'view__title', text: '문장 노트' }), countLabel),
      h('p', { class: 'view__desc', text: '저장한 문장을 검색하고, 즐겨찾기하거나 수정하고, 공유용으로 내보낼 수 있습니다.' }),
    ),
  );

  async function openFromNote(item) {
    try {
      const opened = await actions.openSentenceSource(item, { navigate: onNavigate });
      if (!opened) toast('이 문장은 동영상과 연결되어 있지 않습니다.', { type: 'warn' });
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  const table = new NotesTable({ title: '문장 노트', onSeek: openFromNote, showTitle: false });
  const element = h('div', { class: 'view stack' }, head, table.element);

  return {
    element,
    update(s) {
      countLabel.textContent = `${s.sentences?.total ?? 0}개`;
      table.render(s);
    },
  };
}
