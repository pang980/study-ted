import { h } from '../ui.js';

// AI 구문분석 결과(문장 해석·구문 분석)를 보여 주는 공통 카드.
// 문장 패널(학습 화면)과 문장 노트·학습 자료 목록이 같은 모양을 쓰도록 한 곳에 모았다.

// 분석 카드는 문장 해석과 구문 분석만 보여 준다.
export function analysisCounts(analysis) {
  return { structure: Array.isArray(analysis?.structure) ? analysis.structure.length : 0 };
}

export function hasAnalysis(analysis) {
  if (!analysis || typeof analysis !== 'object') return false;
  if (String(analysis.translation ?? '').trim()) return true;
  return analysisCounts(analysis).structure > 0;
}

// 목록 한 줄에 넣을 요약: "구문 4"
export function analysisSummaryText(analysis) {
  const counts = analysisCounts(analysis);
  return counts.structure ? `구문 ${counts.structure}` : '';
}

// 소형 모델은 구문(part)까지 한국어로 채우는 경우가 있다. 그러면 "구문 분석"이 전부 한국어로 보인다.
// 예전에 저장된 분석도 화면에서 바로 알아챌 수 있도록 렌더링할 때 한 번 더 확인한다.
const HANGUL_RE = /[\u3131-\u318E\uAC00-\uD7A3]/;

export function koreanEnglishFields(analysis) {
  const issues = [];
  (Array.isArray(analysis?.structure) ? analysis.structure : []).forEach((item, index) => {
    if (HANGUL_RE.test(String(item?.part ?? ''))) issues.push(`구문 ${index + 1}`);
  });
  return issues;
}

// 약한 모델은 구문(part)만 채우고 한국어 뜻(meaning)을 비워 둔다.
// 그러면 카드에 영어 단어만 보여서 무슨 뜻인지 알 수 없다. 어떤 구문이 비었는지 찾아낸다.
export function missingMeaningFields(analysis) {
  const issues = [];
  (Array.isArray(analysis?.structure) ? analysis.structure : []).forEach((item, index) => {
    if (String(item?.part ?? '').trim() && !String(item?.meaning ?? '').trim()) issues.push(index + 1);
  });
  return issues;
}

function section(index, title, children) {
  return h(
    'div',
    { class: 'analysis__section' },
    h('div', { class: 'analysis__section-title' }, h('span', { class: 'analysis__index', text: String(index) }), h('span', { text: title })),
    ...children,
  );
}

export function renderAnalysisCard(analysis, { model = '', title = 'AI 분석 결과' } = {}) {
  const card = h(
    'div',
    { class: 'analysis' },
    h(
      'div',
      { class: 'analysis__head' },
      h('span', { class: 'analysis__label', text: title }),
      model ? h('span', { class: 'analysis__model', text: model }) : null,
    ),
  );

  const koreanFields = koreanEnglishFields(analysis);
  if (koreanFields.length) {
    card.append(
      h('div', {
        class: 'analysis__warn',
        text: `영어로 나와야 할 부분이 한국어로 저장돼 있습니다 (${koreanFields.join(', ')}). 설정에서 다른 모델을 고르고 "AI 구문분석"을 다시 실행해 주세요.`,
      }),
    );
  }

  // 뜻이 비어 있으면 영어 단어만 보인다. 어떤 구문인지 알려 주고 다시 분석하도록 안내한다.
  const missingMeanings = missingMeaningFields(analysis);
  if (missingMeanings.length) {
    card.append(
      h('div', {
        class: 'analysis__warn',
        text: `한국어 뜻이 없는 구문이 있습니다 (${missingMeanings.map((no) => `구문 ${no}`).join(', ')}). 설정에서 더 좋은 모델을 고르고 "AI 구문분석"을 다시 실행하거나, "수정"에서 직접 뜻을 넣어 주세요.`,
      }),
    );
  }

  card.append(section(1, '문장 해석', [h('div', { class: 'analysis__translation', text: analysis?.translation || '해석 정보가 없습니다.' })]));

  const structure = Array.isArray(analysis?.structure) ? analysis.structure : [];
  card.append(
    section(
      2,
      '구문 분석',
      structure.length
        ? structure.map((item) =>
            h(
              'div',
              { class: 'analysis__row' },
              h('span', { class: 'analysis__part', text: item.part ?? '' }),
              item.meaning
                ? h('span', { class: 'analysis__meaning', text: ` : ${item.meaning}` })
                : h('span', { class: 'analysis__missing', text: ' : 뜻 없음' }),
              item.note ? h('span', { class: 'analysis__note', text: ` (${item.note})` }) : null,
            ),
          )
        : [h('div', { class: 'analysis__row muted', text: '구문 분석 정보가 없습니다.' })],
    ),
  );

  return card;
}

// 분석에 실패한 문장과 이유. 직전 성공 결과를 그대로 두면 실패한 줄을 성공으로 오해한다.
export function renderAnalysisFailure(failures) {
  const items = (Array.isArray(failures) ? failures : []).map((item) => ({
    sentence: String(item?.sentence ?? '').trim(),
    message: String(item?.error?.message ?? item?.message ?? '알 수 없는 오류').trim(),
  }));
  const card = h(
    'div',
    { class: 'analysis analysis--error' },
    h(
      'div',
      { class: 'analysis__head' },
      h('span', { class: 'analysis__label', text: '분석하지 못한 문장' }),
      h('span', { class: 'analysis__model', text: `${items.length}건` }),
    ),
  );
  for (const item of items) {
    card.append(
      h('div', { class: 'analysis__row' }, h('span', { class: 'analysis__part', text: item.sentence }), h('span', { class: 'analysis__note', text: ` — ${item.message}` })),
    );
  }
  return card;
}