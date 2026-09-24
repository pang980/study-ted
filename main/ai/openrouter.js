const BASE_URL = 'https://openrouter.ai/api/v1';
const MODEL_TTL_MS = 10 * 60 * 1000;

let modelCache = { at: 0, items: [] };

function makeError(code, message, detail) {
  const error = new Error(message);
  error.code = code;
  if (detail !== undefined) error.detail = detail;
  return error;
}

function requireKey(apiKey) {
  if (!apiKey || !String(apiKey).trim()) {
    throw makeError('AI_KEY_MISSING', '설정에서 OpenRouter API 키를 먼저 저장해 주세요.');
  }
  return String(apiKey).trim();
}

// 사용량 제한(429)·일시적 서버 오류(5xx)·일시적 네트워크 오류는 잠시 기다렸다 다시 시도한다.
// 무료 모델은 429 가 잦아 재시도 없이는 구문분석이 그대로 실패한다.
const RETRY_STATUSES = [408, 429, 500, 502, 503, 504];
const RETRY_ATTEMPTS = 2;
const RETRY_BASE_MS = 800;
const RETRY_MAX_MS = 8000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 429 는 Retry-After 헤더(초)를 우선 따르고, 없으면 지수 백오프(800ms → 1.6s → …)를 쓴다.
function retryDelayMs(response, attempt, options = {}) {
  const base = Number(options.baseMs ?? RETRY_BASE_MS);
  const max = Number(options.maxMs ?? RETRY_MAX_MS);
  const header = Number(response?.headers?.get?.('retry-after'));
  const suggested = Number.isFinite(header) && header > 0 ? header * 1000 : base * 2 ** attempt;
  return Math.max(0, Math.min(suggested, max));
}

function httpError(response, text) {
  const body = text.slice(0, 400);
  if (response.status === 401) return makeError('AI_KEY_INVALID', 'API 키가 유효하지 않습니다.');
  if (response.status === 402) return makeError('AI_CREDIT', 'OpenRouter 크레딧이 부족합니다.');
  if (response.status === 429) {
    return makeError(
      'AI_RATE_LIMIT',
      '요청이 너무 많습니다. 잠시 후 다시 시도하거나 설정에서 다른 모델을 선택해 주세요. (무료 모델은 사용량 제한이 잦습니다)',
      body,
    );
  }
  if (response.status === 404) return makeError('AI_MODEL_NOT_FOUND', '선택한 모델을 사용할 수 없습니다.');
  return makeError('AI_HTTP', `OpenRouter 오류 (HTTP ${response.status})`, body);
}

// 요청 한 번. HTTP 오류는 상태 코드와 본문을 그대로 돌려주고, 네트워크 오류만 던진다.
async function sendOnce(path, { apiKey, method, body, timeout }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'http-referer': 'https://github.com/study-ted',
        'x-title': 'Study TED',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    throw makeError('AI_NETWORK', `OpenRouter 요청 실패: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
  return { ok: response.ok, status: response.status, headers: response.headers, text: await response.text() };
}

async function request(path, options = {}) {
  const { apiKey, method = 'GET', body, timeout = 90000 } = options;
  const retry = options.retry ?? {};
  const attempts = Math.max(0, Number(retry.attempts ?? RETRY_ATTEMPTS));
  let lastError = null;
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    let response;
    try {
      // eslint-disable-next-line no-await-in-loop
      response = await sendOnce(path, { apiKey, method, body, timeout });
    } catch (error) {
      lastError = error;
      if (attempt === attempts || error.code !== 'AI_NETWORK') throw error;
      // eslint-disable-next-line no-await-in-loop
      await sleep(retryDelayMs(null, attempt, retry));
      continue;
    }
    if (response.ok) {
      try {
        return JSON.parse(response.text);
      } catch {
        throw makeError('AI_BAD_RESPONSE', 'OpenRouter 응답을 해석하지 못했습니다.', response.text.slice(0, 400));
      }
    }
    lastError = httpError(response, response.text);
    if (attempt === attempts || !RETRY_STATUSES.includes(response.status)) throw lastError;
    // eslint-disable-next-line no-await-in-loop
    await sleep(retryDelayMs(response, attempt, retry));
  }
  throw lastError ?? makeError('AI_HTTP', 'OpenRouter 요청에 실패했습니다.');
}

// --- 모델 가격 ----------------------------------------------------------
// OpenRouter 는 단가를 "USD / 1 token" 문자열로 준다(무료는 "0", 라우팅 모델처럼
// 가격이 정해지지 않은 경우는 "-1"). 화면에서는 1M 토큰 기준으로 보여 준다.
const PRICE_WEIGHT = { prompt: 0.4, completion: 0.6 };

function pricePerToken(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
}

function pricePerMillion(value) {
  const token = pricePerToken(value);
  return token === null ? null : token * 1e6;
}

function formatUsd(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number === 0) return '무료';
  const decimals = Math.min(8, Math.max(2, Math.ceil(-Math.log10(Math.abs(number))) + 1));
  return '$' + number.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
}

// 한쪽만 0 인 모델(예: 입력 무료 · 출력 유료)은 "무료" 대신 "$0" 으로 적는다.
function formatRate(value) {
  const number = Number(value);
  if (Number.isFinite(number) && number === 0) return '$0';
  return formatUsd(value);
}

function priceParts(model) {
  return {
    prompt: pricePerMillion(model?.promptPrice),
    completion: pricePerMillion(model?.completionPrice),
  };
}

// 한 줄 가격표: "입력 $0.15 · 출력 $0.6 / 1M" / "무료" / "가격 정보 없음"
function priceLabel(model) {
  const { prompt, completion } = priceParts(model);
  if (prompt === null && completion === null) return '가격 정보 없음';
  if (prompt === 0 && (completion === 0 || completion === null)) return '무료';
  if (prompt === null) return '출력 ' + formatRate(completion) + ' / 1M';
  if (completion === null) return '입력 ' + formatRate(prompt) + ' / 1M';
  return '입력 ' + formatRate(prompt) + ' · 출력 ' + formatRate(completion) + ' / 1M';
}

// 좁은 자리(선택 목록 option 등)에 쓰는 축약 가격표: "무료" / "$0.15/$0.6"
function priceShort(model) {
  const { prompt, completion } = priceParts(model);
  if (prompt === null && completion === null) return '가격 미정';
  if (prompt === 0 && (completion === 0 || completion === null)) return '무료';
  return (formatRate(prompt) ?? '?') + '/' + (formatRate(completion) ?? '?');
}

// 가성비 점수: 입력·출력 단가의 가중 평균(USD / 1M). 낮을수록 저렴하다.
function priceScore(model) {
  const { prompt, completion } = priceParts(model);
  const parts = [[prompt, PRICE_WEIGHT.prompt], [completion, PRICE_WEIGHT.completion]].filter(([value]) => value !== null);
  if (!parts.length) return null;
  const weight = parts.reduce((sum, [, item]) => sum + item, 0);
  return parts.reduce((sum, [value, item]) => sum + value * item, 0) / weight;
}

function modelLabel(model) {
  return String(model?.name ?? model?.id ?? '');
}

// 가성비 순 정렬: 무료 → 저렴 → (가격 미정). 같은 값이면 이름 순.
function rankModels(models) {
  return [...(Array.isArray(models) ? models : [])].sort((a, b) => {
    const left = priceScore(a);
    const right = priceScore(b);
    if (left === null && right === null) return modelLabel(a).localeCompare(modelLabel(b));
    if (left === null) return 1;
    if (right === null) return -1;
    if (left !== right) return left - right;
    return modelLabel(a).localeCompare(modelLabel(b));
  });
}

function searchTextOf(model) {
  return (String(model?.id ?? '') + ' ' + String(model?.name ?? '')).toLowerCase();
}

function filterModels(models, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  const list = Array.isArray(models) ? models : [];
  if (!needle) return list;
  return list.filter((model) => searchTextOf(model).includes(needle));
}

// OpenRouter /models 응답을 화면에서 바로 쓸 수 있는 형태로 바꾼다.
function decorateModels(raw) {
  const items = (Array.isArray(raw) ? raw : [])
    .filter((model) => model && model.id)
    .map((model) => {
      const base = {
        id: model.id,
        name: model.name ?? model.id,
        contextLength: model.context_length ?? null,
        promptPrice: model.pricing?.prompt ?? null,
        completionPrice: model.pricing?.completion ?? null,
      };
      return {
        ...base,
        searchText: searchTextOf(base),
        priceScore: priceScore(base),
        priceLabel: priceLabel(base),
        priceShort: priceShort(base),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const ranks = new Map(rankModels(items).map((model, index) => [model.id, index + 1]));
  return items.map((model) => ({ ...model, valueRank: ranks.get(model.id) ?? null }));
}

async function listModels(apiKey, options = {}) {
  const fresh = modelCache.items.length && Date.now() - modelCache.at < MODEL_TTL_MS;
  if (fresh && !options.force) return modelCache.items;
  const data = await request('/models', { apiKey });
  const items = decorateModels(data?.data);
  modelCache = { at: Date.now(), items };
  return items;
}

function systemPrompt(targetLang) {
  return [
    'You are an English grammar and usage coach for Korean learners.',
    'You always answer with a single JSON object and nothing else.',
    `All explanatory text (translation, meaning, note) must be written in Korean (${targetLang}).`,
    'The English field structure[].part must stay in English.',
    'Never translate that field and never put a Korean word inside it.',
    'Copy structure[].part from the sentence exactly as it is written.',
    'Every structure item must also have a Korean "meaning" and a short Korean "note". Never leave them empty.',
    'The analysis target is always the single line that starts with "Sentence:".',
    'A video title or surrounding context is reference only: never translate it and never analyze it instead of that sentence.',
  ].join(' ');
}

function userPrompt({ sentence, context, videoTitle }) {
  return [
    'Analyze the English sentence below and return JSON with this exact shape:',
    '{',
    '  "translation": "한국어 해석 한 줄",',
    '  "structure": [{ "part": "영어 구문 (문장에서 그대로 복사)", "meaning": "한국어 의미", "note": "한국어로 쉬운 설명" }]',
    '}',
    'What to analyze:',
    '- The analysis target is ONLY the line that starts with "Sentence:" at the very end of this message.',
    '- Video title and surrounding context are reference only. Never translate them and never use them as the target.',
    'Language rules (most important):',
    '- "part" MUST be English only. Copy it from the sentence exactly as written.',
    '- Never write Korean (한글) inside "part".',
    '- Korean goes only in "translation", "meaning" and "note".',
    'Content rules:',
    '- structure: 3~6 items, split the sentence into meaningful chunks in order. Never split the sentence into single words.',
    '- "meaning" is the Korean meaning of that chunk. It must never be empty.',
    '- "note" is a short Korean grammar note for that chunk. It must never be empty.',
    '- Return only the keys "translation" and "structure".',
    '- Use plain Korean without markdown.',
    videoTitle || context ? 'Reference only (never translate or analyze these):' : '',
    videoTitle ? `- Video title: ${videoTitle}` : '',
    context ? `- Surrounding context: ${context}` : '',
    'Analysis target: the one English sentence below. It is the only text you translate and split into chunks.',
    `Sentence: ${sentence}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function extractJson(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const withoutFence = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const candidates = [withoutFence];
  const objectStart = withoutFence.indexOf('{');
  const objectEnd = withoutFence.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) candidates.push(withoutFence.slice(objectStart, objectEnd + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // 다음 후보를 시도한다.
    }
  }
  return null;
}

function asString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeList(value, mapper) {
  if (!Array.isArray(value)) return [];
  return value.map(mapper).filter((item) => item && Object.values(item).some((field) => asString(field)));
}

const HANGUL_RE = /[\u3131-\u318E\uAC00-\uD7A3]/;

function hasHangul(value) {
  return HANGUL_RE.test(asString(value));
}

// 소형 모델은 "설명은 한국어" 지시를 따라 영어로 나와야 할 구문(part)까지 한국어로 채운다.
// 그러면 구문분석 카드가 전부 한국어로 보인다. 어떤 구문이 오염됐는지 찾아낸다.
function findLanguageMismatch(analysis) {
  const issues = [];
  (Array.isArray(analysis?.structure) ? analysis.structure : []).forEach((item, index) => {
    if (hasHangul(item?.part)) issues.push(`structure[${index}].part`);
  });
  return issues;
}

// 약한 모델은 구문(part)만 채우고 한국어 뜻(meaning)을 비워 둔다.
// 그러면 구문분석 카드에 영어 단어만 줄줄이 보여서 무슨 뜻인지 알 수 없다.
function findMissingMeaning(analysis) {
  const issues = [];
  (Array.isArray(analysis?.structure) ? analysis.structure : []).forEach((item, index) => {
    if (asString(item?.part) && !asString(item?.meaning)) issues.push(`structure[${index}].meaning`);
  });
  return issues;
}

// 구문을 단어 하나씩 쪼개면 "구문 분석"이 아니라 단어 목록이 된다. 뜻이 있어도 문장 구조는 안 보인다.
function findChunkingProblem(analysis) {
  const structure = (Array.isArray(analysis?.structure) ? analysis.structure : []).filter((item) => asString(item?.part));
  if (structure.length < 3) return [];
  if (structure.length > 6) return ['structure'];
  const singleWords = structure.filter((item) => !/\s/.test(asString(item.part))).length;
  return singleWords * 2 >= structure.length ? ['structure'] : [];
}

// 저장 전에 한 번 더 요청해 바로잡을 부분을 모은다.
function analysisIssues(analysis) {
  return [...findLanguageMismatch(analysis), ...findMissingMeaning(analysis), ...findChunkingProblem(analysis)];
}

function normalizeAnalysis(raw, fallbackText) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    translation: asString(source.translation ?? source.해석 ?? source.korean),
    structure: normalizeList(source.structure ?? source.syntax ?? source.구문분석, (item) => {
      if (typeof item === 'string') return { part: item, meaning: '', note: '' };
      return {
        part: asString(item?.part ?? item?.english ?? item?.구문),
        meaning: asString(item?.meaning ?? item?.korean ?? item?.의미 ?? item?.뜻 ?? item?.뜻풀이),
        note: asString(item?.note ?? item?.explanation ?? item?.설명),
      };
    }),
    raw: fallbackText ?? null,
  };
}

async function chatCompletion(options) {
  const { apiKey, model, messages, jsonMode = true, timeout } = options;
  const key = requireKey(apiKey);
  if (!model) throw makeError('AI_MODEL_MISSING', '설정에서 사용할 모델을 선택해 주세요.');
  const payload = { model, messages, temperature: 0.3, max_tokens: 1200 };
  if (jsonMode) payload.response_format = { type: 'json_object' };
  try {
    return await request('/chat/completions', { apiKey: key, method: 'POST', body: payload, timeout });
  } catch (error) {
    if (jsonMode && error.code === 'AI_HTTP') {
      delete payload.response_format;
      return request('/chat/completions', { apiKey: key, method: 'POST', body: payload, timeout });
    }
    throw error;
  }
}

function languageRepairPrompt(issues) {
  const koreanPart = issues.filter((issue) => issue.endsWith('.part'));
  const emptyMeaning = issues.filter((issue) => issue.endsWith('.meaning'));
  const badChunking = issues.includes('structure');
  const lines = [`Your previous answer was not usable: ${issues.join(', ')}.`];
  if (badChunking) {
    lines.push('The "structure" list must have 3~6 chunks. Merge the single words into meaningful phrases instead of listing them one by one.');
  }
  if (koreanPart.length) {
    lines.push(`These fields must contain English taken from the sentence, never Korean: ${koreanPart.join(', ')}.`);
  }
  if (emptyMeaning.length) {
    lines.push(`These fields are empty and must hold the Korean meaning of the chunk: ${emptyMeaning.join(', ')}.`);
  }
  lines.push('Answer again with the complete JSON object.');
  lines.push('Keep "part" in English, and write Korean only in "translation", "meaning" and "note".');
  lines.push('Every structure item needs a non-empty Korean "meaning" and a short Korean "note".');
  lines.push('Never split the sentence into single words.');
  return lines.join(' ');
}

async function analyzeSentence(options) {
  const { apiKey, model, sentence, context, videoTitle, targetLang = 'ko' } = options;
  if (!asString(sentence)) throw makeError('AI_INPUT_EMPTY', '분석할 문장이 없습니다.');
  const messages = [
    { role: 'system', content: systemPrompt(targetLang) },
    { role: 'user', content: userPrompt({ sentence: asString(sentence), context: asString(context), videoTitle: asString(videoTitle) }) },
  ];
  const ask = async (extra = []) => {
    const data = await chatCompletion({ apiKey, model, messages: [...messages, ...extra] });
    const content = data?.choices?.[0]?.message?.content ?? '';
    const parsed = extractJson(content);
    return { data, parsed, analysis: normalizeAnalysis(parsed, content) };
  };

  let result = await ask();
  let mismatch = analysisIssues(result.analysis);
  // 영어 필드가 한국어로 오거나 뜻이 비면 한 번만 더 요청해 바로잡는다. 그래도 남으면 화면에서 경고한다.
  if (result.parsed && mismatch.length) {
    try {
      const repair = await ask([{ role: 'user', content: languageRepairPrompt(mismatch) }]);
      const repairedIssues = analysisIssues(repair.analysis);
      if (repair.parsed && repairedIssues.length < mismatch.length) result = repair;
    } catch {
      // 재시도 실패는 무시하고 첫 결과를 그대로 쓴다.
    }
  }

  return {
    analysis: result.analysis,
    parseFailed: !result.parsed,
    model: result.data?.model ?? model,
    usage: result.data?.usage ?? null,
  };
}

function resetModelCache() {
  modelCache = { at: 0, items: [] };
}

module.exports = {
  listModels,
  decorateModels,
  rankModels,
  filterModels,
  priceLabel,
  priceShort,
  priceScore,
  pricePerMillion,
  formatUsd,
  analyzeSentence,
  chatCompletion,
  request,
  retryDelayMs,
  normalizeAnalysis,
  findLanguageMismatch,
  findMissingMeaning,
  findChunkingProblem,
  analysisIssues,
  languageRepairPrompt,
  hasHangul,
  systemPrompt,
  userPrompt,
  extractJson,
  resetModelCache,
  BASE_URL,
  makeError,
};
