const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#34': '"',
};

function decodeEntities(text) {
  return String(text).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code) => {
    if (Object.prototype.hasOwnProperty.call(ENTITIES, code)) return ENTITIES[code];
    if (code.startsWith('#x') || code.startsWith('#X')) return safeChar(parseInt(code.slice(2), 16));
    if (code.startsWith('#')) return safeChar(parseInt(code.slice(1), 10));
    return match;
  });
}

function safeChar(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

function normalizeText(text) {
  return String(text)
    .replace(/<[^>]*>/g, '')
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSeconds(value) {
  const raw = String(value).trim().replace(',', '.');
  const parts = raw.split(':');
  if (parts.length === 0 || parts.some((p) => p === '')) return null;
  if (parts.length > 3) return null;
  let seconds = 0;
  for (const part of parts) {
    const num = Number(part);
    if (!Number.isFinite(num)) return null;
    seconds = seconds * 60 + num;
  }
  return Number(seconds.toFixed(3));
}

function dedupe(segments) {
  const out = [];
  for (const seg of segments) {
    const prev = out[out.length - 1];
    if (!seg.text) continue;
    if (prev && prev.text === seg.text) {
      prev.end = Math.max(prev.end, seg.end);
      continue;
    }
    out.push(seg);
  }
  return out;
}

function mergeRolling(segments) {
  const out = [];
  for (const seg of segments) {
    const prev = out[out.length - 1];
    if (prev && prev.text === seg.text) {
      prev.end = Math.max(prev.end, seg.end);
      continue;
    }
    if (prev && seg.text.startsWith(prev.text)) {
      prev.text = seg.text;
      prev.end = Math.max(prev.end, seg.end);
      continue;
    }
    out.push({ ...seg });
  }
  return out;
}

function parseJson3(text) {
  const data = JSON.parse(text);
  const events = Array.isArray(data.events) ? data.events : [];
  const segments = [];
  for (const event of events) {
    if (event.aAppend) continue;
    if (!Array.isArray(event.segs)) continue;
    const content = normalizeText(event.segs.map((seg) => seg.utf8 ?? '').join(''));
    if (!content) continue;
    const start = Number(event.tStartMs ?? 0) / 1000;
    const duration = Number(event.dDurationMs ?? 0) / 1000;
    segments.push({ start, end: start + duration, text: content });
  }
  return dedupe(segments);
}

function parseCueBlocks(text) {
  const normalized = String(text).replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  const blocks = normalized.split(/\n{2,}/);
  const segments = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((line) => line.trim() !== '');
    if (!lines.length) continue;
    const timedIndex = lines.findIndex((line) => line.includes('-->'));
    if (timedIndex < 0) continue;
    const [rawStart, rawEnd] = lines[timedIndex].split('-->');
    const start = toSeconds(rawStart);
    const end = toSeconds(String(rawEnd).trim().split(/\s+/)[0]);
    if (start === null || end === null) continue;
    const body = normalizeText(lines.slice(timedIndex + 1).join(' '));
    if (!body) continue;
    segments.push({ start, end, text: body });
  }
  return segments;
}

function parseVtt(text) {
  const body = String(text).replace(/^WEBVTT[^\n]*\n/, '');
  return mergeRolling(dedupe(parseCueBlocks(body)));
}

function parseSrt(text) {
  return dedupe(parseCueBlocks(text));
}

function parseSrv3(text) {
  const segments = [];
  const re = /<text([^>]*)>([\s\S]*?)<\/text>/g;
  let match = re.exec(text);
  while (match) {
    const attrs = match[1];
    const startMatch = /start="([^"]*)"/.exec(attrs);
    const durMatch = /dur="([^"]*)"/.exec(attrs);
    const content = normalizeText(decodeEntities(match[2]));
    if (content) {
      const start = startMatch ? Number(startMatch[1]) : null;
      const duration = durMatch ? Number(durMatch[1]) : 0;
      segments.push({
        start: Number.isFinite(start) ? start : null,
        end: Number.isFinite(start) ? start + duration : null,
        text: content,
      });
    }
    match = re.exec(text);
  }
  return dedupe(segments);
}

function parseText(text) {
  const lines = String(text)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean);
  return dedupe(lines.map((line) => ({ start: null, end: null, text: line })));
}

function detectFormat(text) {
  const head = String(text).slice(0, 4096).replace(/^\uFEFF/, '').trimStart();
  if (!head) return 'text';
  if (head.startsWith('{') || head.startsWith('[')) return 'json3';
  if (head.startsWith('WEBVTT')) return 'vtt';
  if (head.startsWith('<')) return 'srv3';
  if (head.includes('-->') && /^\s*\d+\s*\n\d{2}:\d{2}/m.test(head)) return 'srt';
  if (head.includes('-->')) return 'srt';
  return 'text';
}

function parse(text, format) {
  const resolved = format && format !== 'auto' ? format : detectFormat(text);
  try {
    if (resolved === 'json3' || resolved === 'json') return parseJson3(text);
    if (resolved === 'vtt') return parseVtt(text);
    if (resolved === 'srt') return parseSrt(text);
    if (resolved === 'srv3' || resolved === 'xml') return parseSrv3(text);
    return parseText(text);
  } catch (error) {
    throw new Error(`자막 파싱 실패 (${resolved}): ${error.message}`);
  }
}

function toPlainText(segments) {
  return (segments ?? []).map((seg) => seg.text).join('\n');
}

function formatTime(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return '00:00';
  const rounded = Math.floor(total);
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

module.exports = {
  parse, detectFormat, parseJson3, parseVtt, parseSrt, parseSrv3, parseText,
  normalizeText, toPlainText, formatTime, decodeEntities, mergeRolling,
};
