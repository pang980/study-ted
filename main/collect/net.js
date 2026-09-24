const DEFAULT_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'accept-language': 'en-US,en;q=0.9,ko;q=0.8',
};

function cancelledError() {
  const error = new Error('사용자가 수집을 취소했습니다.');
  error.code = 'CANCELLED';
  return error;
}

async function fetchText(url, options = {}) {
  const { method = 'GET', headers = {}, body = undefined, timeout = 20000, retries = 1, signal } = options;
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    // 취소 요청은 남은 재시도를 모두 건너뛰고 즉시 중단한다.
    if (signal?.aborted) throw cancelledError();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const onOuterAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', onOuterAbort, { once: true });
    try {
      const response = await fetch(url, {
        method,
        body,
        headers: { ...DEFAULT_HEADERS, ...headers },
        redirect: 'follow',
        signal: controller.signal,
      });
      const text = await response.text();
      return { ok: response.ok, status: response.status, text };
    } catch (error) {
      if (signal?.aborted) throw cancelledError();
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onOuterAbort);
    }
  }
  throw new Error(`네트워크 요청 실패: ${lastError ? lastError.message : '알 수 없는 오류'}`);
}

async function fetchJson(url, options = {}) {
  const result = await fetchText(url, options);
  if (!result.ok) throw new Error(`HTTP ${result.status} (${url})`);
  return JSON.parse(result.text);
}

function extractJsonAfter(text, marker) {
  const start = String(text).indexOf(marker);
  if (start < 0) return null;
  const openIndex = String(text).indexOf('{', start + marker.length);
  if (openIndex < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = openIndex; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(openIndex, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractMeta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${property}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) return match[1];
  }
  return null;
}

function matchFirst(text, pattern) {
  const match = pattern.exec(text);
  return match ? match[1] : null;
}

function deepFind(root, predicate, maxDepth = 12) {
  const queue = [{ node: root, depth: 0 }];
  const seen = new Set();
  while (queue.length) {
    const { node, depth } = queue.shift();
    if (!node || typeof node !== 'object' || depth > maxDepth) continue;
    if (seen.has(node)) continue;
    seen.add(node);
    try {
      if (predicate(node)) return node;
    } catch {
      // predicate 오류는 탐색 실패로 처리한다.
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') queue.push({ node: value, depth: depth + 1 });
    }
  }
  return null;
}

function deepCollect(root, predicate, limit = 500, maxDepth = 12) {
  const found = [];
  const queue = [{ node: root, depth: 0 }];
  const seen = new Set();
  while (queue.length && found.length < limit) {
    const { node, depth } = queue.shift();
    if (!node || typeof node !== 'object' || depth > maxDepth) continue;
    if (seen.has(node)) continue;
    seen.add(node);
    try {
      if (predicate(node)) found.push(node);
    } catch {
      // predicate 오류는 건너뛴다.
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') queue.push({ node: value, depth: depth + 1 });
    }
  }
  return found;
}

module.exports = { fetchText, fetchJson, extractJsonAfter, extractMeta, matchFirst, deepFind, deepCollect };
