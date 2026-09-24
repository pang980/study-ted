const fs = require('fs');
const path = require('path');

const REDACTIONS = [
  /sk-or-[A-Za-z0-9._-]+/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /"api[_-]?key"\s*:\s*"[^"]*"/gi,
];

const MAX_BYTES = 1024 * 1024;
let filePath = null;

function redact(text) {
  let out = String(text);
  for (const re of REDACTIONS) out = out.replace(re, '[REDACTED]');
  return out;
}

function configure(dir) {
  fs.mkdirSync(dir, { recursive: true });
  filePath = path.join(dir, 'app.log');
}

function rotate() {
  try {
    if (!filePath) return;
    if (!fs.existsSync(filePath)) return;
    if (fs.statSync(filePath).size < MAX_BYTES) return;
    fs.rmSync(`${filePath}.1`, { force: true });
    fs.renameSync(filePath, `${filePath}.1`);
  } catch {
    // 로그 회전 실패는 앱 동작에 영향을 주지 않는다.
  }
}

function write(level, scope, message, detail) {
  const line = `[${new Date().toISOString()}] ${level} ${scope} ${redact(message)}${
    detail === undefined ? '' : ` ${redact(typeof detail === 'string' ? detail : JSON.stringify(detail))}`
  }`;
  if (level === 'ERROR') {
    process.stderr.write(`${line}\n`);
  } else if (process.env.STUDY_TED_DEV || process.env.STUDY_TED_SMOKE) {
    process.stdout.write(`${line}\n`);
  }
  if (!filePath) return;
  try {
    fs.appendFileSync(filePath, `${line}\n`, 'utf8');
    rotate();
  } catch {
    // 파일 로그 실패는 무시한다.
  }
}

module.exports = {
  redact,
  configure,
  info: (scope, message, detail) => write('INFO', scope, message, detail),
  warn: (scope, message, detail) => write('WARN', scope, message, detail),
  error: (scope, message, detail) => write('ERROR', scope, message, detail),
};
