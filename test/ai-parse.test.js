const test = require('node:test');
const assert = require('node:assert/strict');

const ai = require('../main/ai/openrouter');

test('extractJson 이 코드블록과 앞뒤 설명을 걷어낸다', () => {
  assert.deepEqual(ai.extractJson('{"translation":"해석"}'), { translation: '해석' });
  assert.deepEqual(ai.extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(ai.extractJson('물론입니다. 결과는 다음과 같습니다.\n{"a":{"b":2}}\n도움이 되었으면 합니다.'), { a: { b: 2 } });
  assert.deepEqual(ai.extractJson('[{"a":1}]'), [{ a: 1 }]);
  assert.equal(ai.extractJson(''), null);
  assert.equal(ai.extractJson('   '), null);
  assert.equal(ai.extractJson('그냥 텍스트입니다.'), null);
  assert.equal(ai.extractJson(null), null);
});

test('normalizeAnalysis 가 표준 키를 그대로 읽는다', () => {
  const raw = {
    translation: '그래서 오늘은 좋은 아침 루틴을 어떻게 만들지 이야기하고 싶어요.',
    structure: [
      { part: 'So today,', meaning: '그래서 오늘은', note: '시간 부사구' },
      { part: 'I want to talk about', meaning: '~에 대해 이야기하고 싶다', note: 'want to + 동사원형' },
    ],
  };
  const analysis = ai.normalizeAnalysis(raw, 'raw text');
  assert.equal(analysis.translation, raw.translation);
  assert.deepEqual(analysis.structure[0], { part: 'So today,', meaning: '그래서 오늘은', note: '시간 부사구' });
  assert.equal(analysis.raw, 'raw text');
});

test('normalizeAnalysis 가 한국어 키와 별칭을 받아들인다', () => {
  const analysis = ai.normalizeAnalysis(
    {
      해석: '해석입니다.',
      구문분석: [{ 구문: 'in order to', 의미: '~하기 위해', 설명: '목적을 나타낸다' }],
    },
    null,
  );
  assert.equal(analysis.translation, '해석입니다.');
  assert.deepEqual(analysis.structure[0], { part: 'in order to', meaning: '~하기 위해', note: '목적을 나타낸다' });
  assert.equal(analysis.raw, null);
});

test('normalizeAnalysis 가 문자열 항목과 누락 키를 보정한다', () => {
  const partial = ai.normalizeAnalysis({
    translation: '해석',
    syntax: ['주어 + 동사', { part: 'with you', meaning: '너와 함께' }],
  });
  assert.deepEqual(partial.structure, [
    { part: '주어 + 동사', meaning: '', note: '' },
    { part: 'with you', meaning: '너와 함께', note: '' },
  ]);

  const empty = ai.normalizeAnalysis(null);
  assert.deepEqual(empty, { translation: '', structure: [], raw: null });
  assert.deepEqual(ai.normalizeAnalysis('문자열'), { translation: '', structure: [], raw: null });
});

test('normalizeAnalysis 가 빈 항목을 걸러낸다', () => {
  const analysis = ai.normalizeAnalysis({
    structure: [{ part: '', meaning: '', note: '' }, { part: 'kept', meaning: '', note: '' }],
  });
  assert.equal(analysis.structure.length, 1);
});

test('makeError 가 code/detail 을 담는다', () => {
  const error = ai.makeError('AI_HTTP', '오류', 'detail');
  assert.equal(error.code, 'AI_HTTP');
  assert.equal(error.message, '오류');
  assert.equal(error.detail, 'detail');
  assert.equal(ai.makeError('AI_HTTP', '오류').detail, undefined);
});

test('analyzeSentence 가 빈 문장을 네트워크 호출 없이 거부한다', async () => {
  await assert.rejects(
    () => ai.analyzeSentence({ apiKey: 'sk-test', model: 'openai/gpt-4o-mini', sentence: '   ' }),
    (error) => error.code === 'AI_INPUT_EMPTY',
  );
});

test('chatCompletion 이 키/모델 누락을 먼저 검사한다', async () => {
  await assert.rejects(
    () => ai.chatCompletion({ apiKey: '', model: 'openai/gpt-4o-mini', messages: [] }),
    (error) => error.code === 'AI_KEY_MISSING',
  );
  await assert.rejects(
    () => ai.chatCompletion({ apiKey: 'sk-test', model: '', messages: [] }),
    (error) => error.code === 'AI_MODEL_MISSING',
  );
  assert.equal(ai.BASE_URL, 'https://openrouter.ai/api/v1');
  ai.resetModelCache();
});
test('priceLabel/priceShort 가 무료·가격 미정·단가를 구분한다', () => {
  assert.equal(ai.priceLabel({ promptPrice: '0', completionPrice: '0' }), '무료');
  assert.equal(ai.priceShort({ promptPrice: '0', completionPrice: '0' }), '무료');
  assert.equal(ai.priceLabel({ promptPrice: '-1', completionPrice: '-1' }), '가격 정보 없음');
  assert.equal(ai.priceShort({ promptPrice: '-1', completionPrice: '-1' }), '가격 미정');
  assert.equal(ai.priceLabel({}), '가격 정보 없음');
  assert.equal(ai.priceShort({}), '가격 미정');
  assert.equal(ai.priceLabel({ promptPrice: '0.00000015', completionPrice: '0.0000006' }), '입력 $0.15 · 출력 $0.6 / 1M');
  assert.equal(ai.priceShort({ promptPrice: '0.00000015', completionPrice: '0.0000006' }), '$0.15/$0.6');
  assert.equal(ai.priceLabel({ promptPrice: '0', completionPrice: '0.000001' }), '입력 $0 · 출력 $1 / 1M');
  assert.equal(ai.pricePerMillion('0.00000015'), 0.15);
  assert.equal(ai.pricePerMillion('-1'), null);
});

test('priceScore 가 입력 40% · 출력 60% 가중 평균으로 매긴다', () => {
  assert.equal(ai.priceScore({ promptPrice: '0', completionPrice: '0' }), 0);
  assert.equal(ai.priceScore({ promptPrice: '-1', completionPrice: '-1' }), null);
  const score = ai.priceScore({ promptPrice: '0.000001', completionPrice: '0.000002' });
  assert.ok(Math.abs(score - 1.6) < 1e-9);
  assert.equal(ai.priceScore({ promptPrice: '0.000001', completionPrice: '-1' }), 1);
});

test('rankModels 가 무료 → 저렴 → 가격 미정 순으로 정렬한다', () => {
  const rank = ai
    .rankModels([
      { id: 'c', name: 'Paid', promptPrice: '0.00000015', completionPrice: '0.0000006' },
      { id: 'd', name: 'Route', promptPrice: '-1', completionPrice: '-1' },
      { id: 'a', name: 'Free', promptPrice: '0', completionPrice: '0' },
      { id: 'b', name: 'Cheap', promptPrice: '0.0000001', completionPrice: '0.0000004' },
    ])
    .map((model) => model.id);
  assert.deepEqual(rank, ['a', 'b', 'c', 'd']);
});

test('filterModels 가 이름·ID 를 대소문자 무시하고 부분 일치로 찾는다', () => {
  const models = [
    { id: 'openai/gpt-4o-mini', name: 'OpenAI: GPT-4o mini' },
    { id: 'qwen/qwen-2.5-72b', name: 'Qwen 2.5 72B' },
  ];
  assert.deepEqual(ai.filterModels(models, 'QWEN').map((model) => model.id), ['qwen/qwen-2.5-72b']);
  assert.deepEqual(ai.filterModels(models, 'gpt-4o').map((model) => model.id), ['openai/gpt-4o-mini']);
  assert.deepEqual(ai.filterModels(models, ' ').map((model) => model.id), ['openai/gpt-4o-mini', 'qwen/qwen-2.5-72b']);
  assert.deepEqual(ai.filterModels(models, 'no-such-model'), []);
});

test('decorateModels 가 가격 표시와 가성비 순위를 붙인다', () => {
  const models = ai.decorateModels([
    { id: 'paid/one', name: 'Paid One', context_length: 128000, pricing: { prompt: '0.00000015', completion: '0.0000006' } },
    { id: 'free/one', name: 'Free One', pricing: { prompt: '0', completion: '0' } },
    { id: 'route/auto', name: 'Route Auto', pricing: { prompt: '-1', completion: '-1' } },
    { name: 'id 가 없으면 버린다' },
  ]);
  assert.deepEqual(models.map((model) => model.id), ['free/one', 'paid/one', 'route/auto']);
  assert.equal(models[0].valueRank, 1);
  assert.equal(models[0].priceShort, '무료');
  assert.equal(models[1].valueRank, 2);
  assert.equal(models[1].contextLength, 128000);
  assert.equal(models[2].valueRank, 3);
  assert.equal(models[2].priceLabel, '가격 정보 없음');
  assert.ok(models[1].searchText.includes('paid/one'));
  assert.ok(models[1].searchText.includes('paid one'));
});

// --- 재시도 / 백오프 ------------------------------------------------------
// 무료 모델은 429 가 잦다. 재시도가 없으면 구문분석이 한 번에 실패하고 저장도 되지 않는다.

function fakeResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
    text: async () => body,
  };
}

async function withFetch(stub, run) {
  const original = global.fetch;
  global.fetch = stub;
  try {
    return await run();
  } finally {
    global.fetch = original;
  }
}

test('request 가 429 를 재시도해 성공한다', async () => {
  let calls = 0;
  const data = await withFetch(
    async () => {
      calls += 1;
      return calls === 1 ? fakeResponse(429, '{"error":"rate limited"}') : fakeResponse(200, '{"ok":true}');
    },
    () => ai.request('/chat/completions', { apiKey: 'sk-test', retry: { baseMs: 1, maxMs: 2 } }),
  );
  assert.deepEqual(data, { ok: true });
  assert.equal(calls, 2);
});

test('request 가 429 재시도를 모두 소진하면 다른 모델을 안내한다', async () => {
  let calls = 0;
  await withFetch(
    async () => {
      calls += 1;
      return fakeResponse(429, '{"error":"rate limited"}');
    },
    async () => {
      await assert.rejects(
        () => ai.request('/chat/completions', { apiKey: 'sk-test', retry: { attempts: 1, baseMs: 1, maxMs: 2 } }),
        (error) => error.code === 'AI_RATE_LIMIT' && error.message.includes('다른 모델') && error.detail.includes('rate limited'),
      );
    },
  );
  assert.equal(calls, 2);
});

test('request 가 5xx 는 재시도하고 401 은 즉시 던진다', async () => {
  let server = 0;
  const ok = await withFetch(
    async () => {
      server += 1;
      return server === 1 ? fakeResponse(503, 'upstream') : fakeResponse(200, '{"data":[]}');
    },
    () => ai.request('/models', { apiKey: 'sk-test', retry: { baseMs: 1, maxMs: 2 } }),
  );
  assert.deepEqual(ok, { data: [] });
  assert.equal(server, 2);

  let unauthorized = 0;
  await withFetch(
    async () => {
      unauthorized += 1;
      return fakeResponse(401, '{"error":"no auth"}');
    },
    async () => {
      await assert.rejects(
        () => ai.request('/models', { apiKey: 'sk-test', retry: { attempts: 3, baseMs: 1, maxMs: 2 } }),
        (error) => error.code === 'AI_KEY_INVALID',
      );
    },
  );
  assert.equal(unauthorized, 1);
});

test('request 가 일시적 네트워크 오류를 재시도한다', async () => {
  let calls = 0;
  const data = await withFetch(
    async () => {
      calls += 1;
      if (calls === 1) throw new Error('socket hang up');
      return fakeResponse(200, '{"data":[1]}');
    },
    () => ai.request('/models', { apiKey: 'sk-test', retry: { baseMs: 1, maxMs: 2 } }),
  );
  assert.deepEqual(data, { data: [1] });
  assert.equal(calls, 2);
});

test('retryDelayMs 가 Retry-After 헤더를 지수 백오프보다 우선한다', () => {
  const limits = { baseMs: 800, maxMs: 8000 };
  assert.equal(ai.retryDelayMs(fakeResponse(429, '', { 'retry-after': '2' }), 3, limits), 2000);
  assert.equal(ai.retryDelayMs(fakeResponse(429, ''), 0, limits), 800);
  assert.equal(ai.retryDelayMs(fakeResponse(429, ''), 2, limits), 3200);
  assert.equal(ai.retryDelayMs(fakeResponse(429, ''), 9, limits), 8000);
  assert.equal(ai.retryDelayMs(fakeResponse(429, '', { 'retry-after': '600' }), 0, limits), 8000);
  assert.equal(ai.retryDelayMs(null, 1, { baseMs: 10, maxMs: 100 }), 20);
});
// --- 영어 필드 언어 검증 ---------------------------------------------------
// 소형 모델은 "설명은 한국어" 지시를 따라 구문(part)까지 한국어로 채운다.
// 그대로 저장하면 구문분석 카드가 전부 한국어로 보인다.

test('findLanguageMismatch 가 영어 필드에 섞인 한글만 찾아낸다', () => {
  const clean = ai.normalizeAnalysis({
    translation: '그래서 오늘은 이야기하고 싶어요.',
    structure: [{ part: 'I want to talk about', meaning: '~에 대해 이야기하고 싶다' }],
  });
  assert.deepEqual(ai.findLanguageMismatch(clean), []);

  const broken = ai.normalizeAnalysis({
    translation: '해석',
    structure: [{ part: '고양이의 이상한 행동', meaning: '이상한 행동' }, { part: 'how to build', meaning: '어떻게 만들지' }],
  });
  assert.deepEqual(ai.findLanguageMismatch(broken), ['structure[0].part']);

  assert.equal(ai.hasHangul('morning routine'), false);
  assert.equal(ai.hasHangul('아침 루틴'), true);
  assert.equal(ai.hasHangul(''), false);
  assert.equal(ai.hasHangul(null), false);
});

test('프롬프트가 영어 필드는 영어로 두라고 지시한다', () => {
  const system = ai.systemPrompt('ko');
  assert.ok(system.includes('structure[].part'));
  assert.ok(system.includes('must stay in English'));

  const user = ai.userPrompt({ sentence: 'I want to talk about it.' });
  assert.ok(user.includes('MUST be English only'));
  assert.ok(user.includes('Copy it from the sentence exactly as written'));
  assert.ok(user.includes('Korean goes only in'));
  assert.ok(user.includes('must never be empty'));
  assert.ok(system.includes('Never leave them empty.'));
  assert.ok(user.includes('Sentence: I want to talk about it.'));
});

test('analyzeSentence 가 한국어로 채워진 영어 필드를 한 번 더 요청해 바로잡는다', async () => {
  const broken = {
    translation: '고양이 이야기',
    structure: [{ part: '고양이의 이상한 행동', meaning: '이상한 행동', note: '' }],
  };
  const fixed = {
    translation: '고양이가 보이는 놀라운 행동 중에서도',
    structure: [{ part: 'Of the many bewildering behaviors', meaning: '많은 놀라운 행동 중에서', note: '전치사구' }],
  };
  let calls = 0;
  const bodies = [];
  const result = await withFetch(
    async (url, init) => {
      calls += 1;
      bodies.push(JSON.parse(init.body));
      const content = JSON.stringify(calls === 1 ? broken : fixed);
      return fakeResponse(200, JSON.stringify({ model: 'test/model', choices: [{ message: { content } }] }));
    },
    () => ai.analyzeSentence({ apiKey: 'sk-test', model: 'test/model', sentence: 'Of the many bewildering behaviors' }),
  );

  assert.equal(calls, 2);
  assert.equal(result.parseFailed, false);
  assert.equal(result.analysis.structure[0].part, 'Of the many bewildering behaviors');
  assert.deepEqual(ai.findLanguageMismatch(result.analysis), []);
  // 두 번째 요청에는 무엇이 잘못됐는지 알려 주는 교정 지시가 붙는다.
  assert.ok(bodies[1].messages.some((message) => message.content.includes('structure[0].part')));
  assert.ok(bodies[1].messages.some((message) => message.content.includes('Keep "part" in English')));
});

test('analyzeSentence 는 교정이 안 되면 결과를 유지하고 오염 사실을 남긴다', async () => {
  const broken = {
    translation: '해석',
    structure: [{ part: '한국어 구문', meaning: '뜻', note: '' }],
  };
  let calls = 0;
  const result = await withFetch(
    async () => {
      calls += 1;
      return fakeResponse(200, JSON.stringify({ choices: [{ message: { content: JSON.stringify(broken) } }] }));
    },
    () => ai.analyzeSentence({ apiKey: 'sk-test', model: 'test/model', sentence: 'Some sentence here' }),
  );

  assert.equal(calls, 2);
  assert.equal(result.parseFailed, false);
  assert.deepEqual(ai.findLanguageMismatch(result.analysis), ['structure[0].part']);
  assert.equal(result.analysis.translation, '해석');
});

// --- 한국어 뜻 누락 검증 ---------------------------------------------------
// 약한 모델은 구문(part)만 채우고 한국어 뜻(meaning)을 비워 둔다.
// 그러면 카드에 영어 단어만 줄줄이 보여서 무슨 뜻인지 알 수 없다.

test('findMissingMeaning 이 한국어 뜻이 빈 구문만 찾아낸다', () => {
  const ok = ai.normalizeAnalysis({
    translation: '해석',
    structure: [{ part: 'Along with their research', meaning: '그들의 연구와 함께', note: '전치사구' }],
  });
  assert.deepEqual(ai.findMissingMeaning(ok), []);
  assert.deepEqual(ai.analysisIssues(ok), []);

  const broken = ai.normalizeAnalysis({
    translation: '해석',
    structure: [
      { part: 'Along with their research', meaning: '그들의 연구와 함께', note: '' },
      { part: 'teams from Iwate', meaning: '', note: '' },
      { part: '', meaning: '', note: '' },
    ],
  });
  assert.deepEqual(ai.findMissingMeaning(broken), ['structure[1].meaning']);
  assert.deepEqual(ai.analysisIssues(broken), ['structure[1].meaning']);
});

test('normalizeAnalysis 가 뜻 별칭(뜻/뜻풀이)을 읽는다', () => {
  const analysis = ai.normalizeAnalysis({
    translation: '해석',
    structure: [{ part: 'Along with their research', 뜻: '그들의 연구와 함께' }],
  });
  assert.equal(analysis.structure[0].meaning, '그들의 연구와 함께');
  assert.deepEqual(ai.findMissingMeaning(analysis), []);
});

test('analyzeSentence 가 뜻이 빈 구문을 한 번 더 요청해 채운다', async () => {
  const broken = {
    translation: '이와테와 나고야 대학의 연구 팀과 함께',
    structure: [
      { part: 'Along', meaning: '', note: '' },
      { part: 'with their research teams', meaning: '', note: '' },
    ],
  };
  const fixed = {
    translation: '이와테와 나고야 대학의 연구 팀과 함께',
    structure: [
      { part: 'Along with their research teams', meaning: '그들의 연구 팀과 함께', note: '전치사구' },
      { part: 'from Iwate and Nagoya University', meaning: '이와테와 나고야 대학 출신의', note: 'from + 기관' },
    ],
  };
  let calls = 0;
  const bodies = [];
  const result = await withFetch(
    async (url, init) => {
      calls += 1;
      bodies.push(JSON.parse(init.body));
      const content = JSON.stringify(calls === 1 ? broken : fixed);
      return fakeResponse(200, JSON.stringify({ choices: [{ message: { content } }] }));
    },
    () => ai.analyzeSentence({ apiKey: 'sk-test', model: 'test/model', sentence: 'Along with their research teams from Iwate and Nagoya University,' }),
  );

  assert.equal(calls, 2);
  assert.equal(result.analysis.structure[0].meaning, '그들의 연구 팀과 함께');
  assert.deepEqual(ai.findMissingMeaning(result.analysis), []);
  // 두 번째 요청에는 어떤 구문의 뜻이 비었는지 알려 주는 교정 지시가 붙는다.
  assert.ok(bodies[1].messages.some((message) => message.content.includes('structure[0].meaning')));
  assert.ok(bodies[1].messages.some((message) => message.content.includes('must hold the Korean meaning')));
  assert.ok(bodies[1].messages.some((message) => message.content.includes('Never split the sentence into single words')));
});

test('analyzeSentence 는 뜻이 끝내 안 채워지면 결과를 유지하고 사실을 남긴다', async () => {
  const broken = { translation: '해석', structure: [{ part: 'Along with their research', meaning: '', note: '' }] };
  let calls = 0;
  const result = await withFetch(
    async () => {
      calls += 1;
      return fakeResponse(200, JSON.stringify({ choices: [{ message: { content: JSON.stringify(broken) } }] }));
    },
    () => ai.analyzeSentence({ apiKey: 'sk-test', model: 'test/model', sentence: 'Along with their research' }),
  );

  assert.equal(calls, 2);
  assert.equal(result.parseFailed, false);
  assert.deepEqual(ai.findMissingMeaning(result.analysis), ['structure[0].meaning']);
});

// 구문을 단어 하나씩 쪼개면 "구문 분석"이 아니라 단어 목록이 된다.
test('findChunkingProblem 이 단어 하나씩 쪼갠 구문을 찾아낸다', () => {
  const words = ai.normalizeAnalysis({
    translation: '해석',
    structure: [
      { part: 'Along', meaning: '따라' },
      { part: 'with', meaning: '함께' },
      { part: 'their', meaning: '그들의' },
      { part: 'research', meaning: '연구' },
    ],
  });
  assert.deepEqual(ai.findChunkingProblem(words), ['structure']);

  const chunks = ai.normalizeAnalysis({
    translation: '해석',
    structure: [
      { part: 'Along with their research teams', meaning: '그들의 연구 팀과 함께' },
      { part: 'from Iwate and Nagoya University', meaning: '이와테와 나고야 대학 출신의' },
    ],
  });
  assert.deepEqual(ai.findChunkingProblem(chunks), []);
  assert.deepEqual(ai.analysisIssues(chunks), []);
});

test('analyzeSentence 가 단어로 쪼갠 구문을 한 번 더 요청해 묶는다', async () => {
  const split = {
    translation: '해석',
    structure: [
      { part: 'Along', meaning: '따라' },
      { part: 'with', meaning: '함께' },
      { part: 'their', meaning: '그들의' },
      { part: 'research', meaning: '연구' },
    ],
  };
  const merged = {
    translation: '해석',
    structure: [
      { part: 'Along with their research', meaning: '그들의 연구와 함께' },
      { part: 'teams from Iwate', meaning: '이와테 출신 팀' },
      { part: 'and Nagoya University', meaning: '그리고 나고야 대학' },
    ],
  };
  let calls = 0;
  const bodies = [];
  const result = await withFetch(
    async (url, init) => {
      calls += 1;
      bodies.push(JSON.parse(init.body));
      const content = JSON.stringify(calls === 1 ? split : merged);
      return fakeResponse(200, JSON.stringify({ choices: [{ message: { content } }] }));
    },
    () => ai.analyzeSentence({ apiKey: 'sk-test', model: 'test/model', sentence: 'Along with their research teams from Iwate and Nagoya University,' }),
  );

  assert.equal(calls, 2);
  assert.equal(result.analysis.structure.length, 3);
  assert.deepEqual(ai.analysisIssues(result.analysis), []);
  assert.ok(bodies[1].messages.some((message) => message.content.includes('Merge the single words into meaningful phrases')));
});

test('프롬프트가 동영상 제목이 아니라 문장 하나만 분석하라고 지시한다', () => {
  const system = ai.systemPrompt('ko');
  assert.ok(system.includes('The analysis target is always the single line that starts with "Sentence:".'));
  assert.ok(system.includes('never analyze it instead of that sentence'));

  const user = ai.userPrompt({ sentence: 'Along with their research teams.', videoTitle: 'How cats purr', context: 'previous line' });
  const lines = user.split('\n');
  // 분석 대상 문장은 언제나 마지막 줄이다. 제목이 뒤에 오면 약한 모델이 제목을 분석한다.
  assert.equal(lines[lines.length - 1], 'Sentence: Along with their research teams.');
  assert.ok(user.includes('Reference only (never translate or analyze these):'));
  assert.ok(user.includes('- Video title: How cats purr'));
  assert.ok(user.includes('- Surrounding context: previous line'));
  assert.ok(user.indexOf('- Video title: How cats purr') < user.indexOf('Sentence: Along with their research teams.'));
  assert.ok(user.includes('Analysis target: the one English sentence below.'));

  // 제목도 문맥도 없으면 참고 블록 자체가 나오지 않는다.
  const plain = ai.userPrompt({ sentence: 'I want to talk about it.' });
  assert.equal(plain.includes('Reference only'), false);
  assert.equal(plain.split('\n').pop(), 'Sentence: I want to talk about it.');
});
