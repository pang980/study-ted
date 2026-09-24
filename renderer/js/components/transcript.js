import { h, clear, formatTime, emptyState } from '../ui.js';

export class TranscriptPanel {
  constructor({ onSeek, onSelect, onSend, height = 420 } = {}) {
    this.onSeek = onSeek;
    this.onSelect = onSelect;
    this.onSend = onSend;
    this.segments = [];
    this.rows = [];
    this.activeIndex = -1;
    this.mode = 'list';

    this.list = h('div', { class: 'transcript-list' });
    this.plain = h('div', { class: 'transcript-plain', hidden: true });
    this.scroll = h(
      'div',
      { class: 'panel__scroll grow', style: { maxHeight: `${height}px`, minHeight: '260px' } },
      this.list,
      this.plain,
    );

    this.tabList = h('button', { class: 'tab is-active', type: 'button', text: '자막', onClick: () => this.setMode('list') });
    this.tabPlain = h('button', { class: 'tab', type: 'button', text: '전체 자막', onClick: () => this.setMode('plain') });
    this.hint = h('div', { class: 'transcript-hint', text: '문장을 드래그해 선택하거나 줄의 "문장 전송" 버튼으로 오른쪽 패널에 보낼 수 있습니다.' });

    this.element = h(
      'section',
      { class: 'panel panel--transcript' },
      h('div', { class: 'panel__head' }, h('div', { class: 'tabs' }, this.tabList, this.tabPlain)),
      this.scroll,
      this.hint,
    );

    this.list.addEventListener('mouseup', () => this.handleSelection());
    this.plain.addEventListener('mouseup', () => this.handleSelection());
  }

  setMode(mode) {
    this.mode = mode;
    this.tabList.classList.toggle('is-active', mode === 'list');
    this.tabPlain.classList.toggle('is-active', mode === 'plain');
    this.list.hidden = mode !== 'list';
    this.plain.hidden = mode !== 'plain';
  }

  setSegments(segments = []) {
    this.segments = Array.isArray(segments) ? segments : [];
    this.activeIndex = -1;
    this.rows = [];
    clear(this.list);
    clear(this.plain);

    if (!this.segments.length) {
      this.list.append(emptyState('저장된 자막이 없습니다. 플레이어 위의 "자막 가져오기"를 눌러 주세요.', { icon: '💬' }));
      this.plain.textContent = '';
      this.hint.hidden = true;
      return;
    }

    this.hint.hidden = false;
    this.segments.forEach((segment, index) => {
      const row = h(
        'div',
        {
          class: 'transcript-line',
          dataset: { index: String(index), start: String(segment.start ?? '') },
          onClick: () => this.onSeek?.(segment.start ?? 0),
        },
        h('span', { class: 'transcript-line__time', text: segment.start === null || segment.start === undefined ? '--:--' : formatTime(segment.start) }),
        h('span', { class: 'transcript-line__text', text: segment.text ?? '' }),
        h('button', {
          class: 'btn btn--sm btn--subtle transcript-line__send',
          type: 'button',
          text: '문장 전송',
          title: '이 문장을 오른쪽 문장 패널로 보냅니다.',
          onClick: (event) => {
            // 줄 클릭(구간 재생)과 분리한다.
            event.stopPropagation();
            this.onSend?.(segment);
          },
        }),
      );
      this.rows.push(row);
      this.list.append(row);
    });

    this.plain.textContent = this.segments.map((segment) => segment.text).join(' ');
  }

  setActiveIndex(index) {
    if (index === this.activeIndex) return;
    if (this.rows[this.activeIndex]) this.rows[this.activeIndex].classList.remove('is-active');
    this.activeIndex = index;
    const row = this.rows[index];
    if (!row) return;
    row.classList.add('is-active');
    if (this.mode === 'list') row.scrollIntoView({ block: 'nearest' });
  }

  setEnabled(enabled) {
    this.scroll.style.opacity = enabled ? '1' : '0.55';
    this.hint.textContent = enabled
      ? '문장을 드래그해 선택하거나 줄의 "문장 전송" 버튼으로 오른쪽 패널에 보낼 수 있습니다.'
      : '듣기 모드에서는 자막을 표시하지 않습니다. 플레이어에서 "자막" 모드로 바꿔 주세요.';
  }

  handleSelection() {
    if (!this.onSelect) return;
    const selection = globalThis.getSelection();
    const text = selection ? String(selection.toString()).trim() : '';
    if (text.length < 2) return;
    let startSec = null;
    const node = selection.anchorNode;
    const element = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const row = element?.closest?.('.transcript-line');
    if (row && row.dataset.start) startSec = Number(row.dataset.start);
    this.onSelect({ text: text.replace(/\s+/g, ' '), startSec });
  }
}
