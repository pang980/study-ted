import { h, clear, openModal, toast } from '../ui.js';
import { renderAnalysisCard, renderAnalysisFailure } from './analysis-card.js';

function splitLines(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const MAX_ANALYZE_LINES = 5;

function normalizeLine(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

export function parseStructureText(text) {
  return splitLines(text).map((line) => {
    const parts = line.split('|').map((piece) => piece.trim());
    if (parts.length >= 2) {
      return { part: parts[0], meaning: parts[1], note: parts[2] ?? '' };
    }
    const pieces = line.split(':').map((piece) => piece.trim());
    if (pieces.length >= 2) {
      return { part: pieces[0], meaning: pieces.slice(1).join(' : '), note: '' };
    }
    return { part: line, meaning: '', note: '' };
  });
}


export class SentencePanel {
  constructor({ onSave, onAnalyze, onError } = {}) {
    this.onSave = onSave;
    this.onAnalyze = onAnalyze;
    this.onError = onError;
    this.analysis = null;
    // 자막에서 보낸 문장의 시작 시각. 저장할 때 문장마다 원래 위치를 붙인다.
    this.startSecs = new Map();

    this.textarea = h('textarea', {
      class: 'textarea sentence-box',
      placeholder: '자막에서 문장을 선택하거나 직접 입력하세요.',
      rows: '4',
    });

    this.saveBtn = h('button', { class: 'btn btn--primary btn--block', type: 'button', text: '+ 문장 노트에 저장', disabled: true, onClick: () => this.save() });

    this.saveCard = h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'panel__body stack' },
        h('label', { class: 'sentence-card__label', text: '선택한 문장 저장하기' }),
        this.textarea,
        this.saveBtn,
      ),
    );

    this.analyzeBtn = h('button', { class: 'btn btn--ai', type: 'button', text: 'AI 구문분석', onClick: () => this.analyze() });
    this.manualBtn = h('button', { class: 'btn', type: 'button', text: '수동 입력', onClick: () => this.manualInput() });
    this.analysisBox = h('div', { class: 'stack' }, h('p', { class: 'muted small', text: '아직 분석 결과가 없습니다.' }));

    this.analyzeCard = h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'panel__body stack' },
        h('label', { class: 'sentence-card__label', text: '문장 분석 (AI)' }),
        h('div', { class: 'row' }, this.analyzeBtn, this.manualBtn),
        this.analysisBox,
      ),
    );

    this.element = h('div', { class: 'stack' }, this.saveCard, this.analyzeCard);
    this.textarea.addEventListener('input', () => this.refreshButtons());
  }

  refreshButtons() {
    this.saveBtn.disabled = !this.textarea.value.trim();
  }

  // 저장된 문장을 불러와 편집할 때 쓴다(입력 상자의 내용을 그 문장으로 바꾼다).
  setSentence(text, { focus = false } = {}) {
    this.textarea.value = text ?? '';
    this.startSecs.clear();
    if (focus) this.textarea.focus();
    this.refreshButtons();
  }

  // 자막에서 보낸 문장은 이미 입력한 내용을 지우지 않고 줄 단위로 덧붙인다.
  appendSentence(text, { focus = false, startSec = null } = {}) {
    const value = normalizeLine(text);
    if (!value) return false;
    const existing = new Set(splitLines(this.textarea.value).map(normalizeLine));
    const added = !existing.has(value);
    if (added) {
      const current = this.textarea.value.replace(/\s+$/, '');
      this.textarea.value = current ? `${current}\n${value}` : value;
      const seconds = Number(startSec);
      this.startSecs.set(value, Number.isFinite(seconds) ? seconds : null);
      this.refreshButtons();
    }
    if (focus) {
      this.textarea.focus();
      this.textarea.setSelectionRange(this.textarea.value.length, this.textarea.value.length);
    }
    return added;
  }

  // 입력 상자에 쌓인 문장을 줄 단위로 돌려준다. 저장과 분석은 이 단위로 처리한다.
  getSentences() {
    return splitLines(this.textarea.value).map(normalizeLine).filter(Boolean);
  }

  removeSentences(sentences) {
    const drop = new Set((Array.isArray(sentences) ? sentences : [sentences]).map(normalizeLine));
    this.textarea.value = this.getSentences().filter((line) => !drop.has(line)).join('\n');
    this.refreshButtons();
  }

  startSecFor(sentence) {
    const key = normalizeLine(sentence);
    return this.startSecs.has(key) ? this.startSecs.get(key) : undefined;
  }

  getSentence() {
    return this.textarea.value.trim();
  }

  setAnalysis(analysis, model = '') {
    this.analysis = analysis ?? null;
    clear(this.analysisBox);
    if (!analysis) {
      this.analysisBox.append(h('p', { class: 'muted small', text: '아직 분석 결과가 없습니다.' }));
      return;
    }
    this.analysisBox.append(this.renderAnalysis(analysis, model));
  }

  renderAnalysis(analysis, model) {
    return renderAnalysisCard(analysis, { model });
  }

  setBusy(busy, total = 1, step = 1) {
    this.analyzeBtn.disabled = busy;
    this.analyzeBtn.textContent = busy ? (total > 1 ? `분석 중… ${step}/${total}` : '분석 중…') : 'AI 구문분석';
  }

  // 입력 상자에 문장이 여러 개 쌓여 있으면 한 줄에 하나씩 각각 저장한다.
  async save(payload = null) {
    const targets = payload?.sentence ? [normalizeLine(payload.sentence)] : this.getSentences();
    if (!targets.length) {
      toast('저장할 문장을 입력해 주세요.', { type: 'warn' });
      return null;
    }
    this.saveBtn.disabled = true;
    const created = [];
    const notes = [];
    try {
      for (const sentence of targets) {
        const item = payload ? { ...payload, sentence } : { sentence };
        if (!payload) {
          const startSec = this.startSecFor(sentence);
          if (startSec !== undefined && startSec !== null) item.startSec = startSec;
        }
        try {
          const result = await this.onSave?.(item);
          if (result) {
            created.push(result);
            notes.push(sentence);
          }
        } catch (error) {
          this.onError?.(error);
        }
      }
      if (created.length) {
        // 저장이 끝난 문장은 입력 상자에서 지운다. 남겨 두면 다음 저장 때 중복이 생긴다.
        this.removeSentences(notes);
        toast(created.length === 1 ? '문장 노트에 저장했습니다.' : `문장 ${created.length}개를 노트에 저장했습니다.`, { type: 'success' });
      }
      return created.length ? created[created.length - 1] : null;
    } finally {
      this.refreshButtons();
    }
  }

  // AI 분석은 문장 단위로 처리한다. 분석이 끝나면 바로 저장하고 결과를 보여 준다.
  async analyze() {
    const sentences = this.getSentences();
    if (!sentences.length) {
      toast('분석할 문장을 입력하거나 자막에서 선택해 주세요.', { type: 'warn' });
      return null;
    }
    const targets = sentences.slice(0, MAX_ANALYZE_LINES);
    if (targets.length < sentences.length) {
      toast(`AI 구문분석은 한 번에 최대 ${MAX_ANALYZE_LINES}문장까지 처리합니다.`, { type: 'warn', timeout: 5000 });
    }
    this.setBusy(true, targets.length);
    let last = null;
    let saved = 0;
    const failures = [];
    try {
      for (let index = 0; index < targets.length; index += 1) {
        this.setBusy(true, targets.length, index + 1);
        let result = null;
        try {
          // eslint-disable-next-line no-await-in-loop
          result = await this.onAnalyze?.(targets[index], { startSec: this.startSecFor(targets[index]) });
        } catch (error) {
          // 한 문장이 실패해도 나머지는 계속 분석하고, 실패한 문장은 따로 모아 보여 준다.
          failures.push({ sentence: targets[index], error });
          this.onError?.(error);
          continue;
        }
        if (!result) {
          failures.push({ sentence: targets[index], error: null });
          continue;
        }
        last = result;
        this.setAnalysis(result.analysis ?? { raw: result.raw ?? '' }, result.model);
        if (result.saved) {
          saved += 1;
          this.removeSentences([targets[index]]);
        }
      }
      if (saved) toast(saved === 1 ? 'AI 분석 결과를 문장 노트에 저장했습니다.' : `AI 분석 결과 ${saved}건을 노트에 저장했습니다.`, { type: 'success', timeout: 4000 });
      if (failures.length) this.appendFailures(failures, saved === 0);
      return last;
    } finally {
      this.setBusy(false);
    }
  }

  // 실패한 문장을 분석 박스에 남긴다. 성공 결과가 있으면 그 아래에 덧붙인다.
  appendFailures(failures, replace) {
    if (replace) clear(this.analysisBox);
    this.analysisBox.append(renderAnalysisFailure(failures));
  }

  manualInput() {
    const fields = {
      sentence: h('textarea', { class: 'textarea', rows: '3', value: this.getSentence() }),
      translation: h('input', { class: 'input', placeholder: '예: 그래서 오늘은 좋은 아침 루틴을 어떻게 만들어야 할지에 대해 이야기하고 싶어요.' }),
      structure: h('textarea', { class: 'textarea', rows: '4', placeholder: 'I want to talk about | ~에 대해 이야기하고 싶다 | want to + 동사원형' }),
      favorite: h('input', { type: 'checkbox' }),
    };

    const field = (label, control, hint) =>
      h('div', { class: 'form-field' }, h('label', { class: 'form-field__label', text: label }), control, hint ? h('p', { class: 'form-field__hint', text: hint }) : null);

    const dialog = openModal({
      title: '수동으로 문장 입력',
      body: h(
        'div',
        { class: 'stack' },
        field('영어 문장 *', fields.sentence),
        field('해석', fields.translation),
        field('구문 분석', fields.structure, '한 줄에 하나씩 "구문 | 의미 | 설명" 형식으로 입력합니다. "구문"은 영어로 적어 주세요.'),
        h('label', { class: 'row' }, fields.favorite, h('span', { text: '즐겨찾기에 추가' })),
      ),
      foot: [
        h('button', { class: 'btn', type: 'button', text: '취소', onClick: () => dialog.close() }),
        h('button', {
          class: 'btn btn--primary',
          type: 'button',
          text: '저장',
          onClick: async () => {
            const sentence = fields.sentence.value.trim();
            if (!sentence) {
              toast('영어 문장은 필수입니다.', { type: 'warn' });
              return;
            }
            const structure = parseStructureText(fields.structure.value);
            const translation = fields.translation.value.trim();
            const saved = await this.save({
              sentence,
              translation: translation || null,
              isFavorite: fields.favorite.checked,
              source: 'manual',
              analysis: structure.length || translation ? { translation, structure } : null,
            });
            if (saved) dialog.close();
          },
        }),
      ],
    });
  }
}
