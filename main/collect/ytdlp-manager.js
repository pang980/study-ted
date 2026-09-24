const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const EXE_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';

function canRun(candidate) {
  if (!candidate) return null;
  try {
    const result = spawnSync(candidate, ['--version'], { timeout: 20000, windowsHide: true, encoding: 'utf8' });
    if (result.error || result.status !== 0) return null;
    const version = String(result.stdout ?? '').trim().split('\n')[0] || null;
    return { path: candidate, version };
  } catch {
    return null;
  }
}

function detect(options = {}) {
  const { configuredPath = '', binDir, rootDir } = options;
  const candidates = [
    { value: configuredPath, source: '설정 경로' },
    { value: binDir ? path.join(binDir, EXE_NAME) : '', source: '앱 데이터' },
    { value: process.resourcesPath ? path.join(process.resourcesPath, 'bin', EXE_NAME) : '', source: '앱 리소스' },
    { value: rootDir ? path.join(rootDir, 'bin', EXE_NAME) : '', source: '프로젝트 bin' },
    { value: 'yt-dlp', source: 'PATH' },
    { value: 'yt-dlp.exe', source: 'PATH' },
  ];
  for (const candidate of candidates) {
    if (!candidate.value) continue;
    if (candidate.source !== 'PATH' && !fs.existsSync(candidate.value)) continue;
    const found = canRun(candidate.value);
    if (found) return { available: true, path: found.path, version: found.version, source: candidate.source };
  }
  return { available: false, path: null, version: null, source: null };
}

async function download(binDir) {
  fs.mkdirSync(binDir, { recursive: true });
  const target = path.join(binDir, EXE_NAME);
  const response = await fetch(DOWNLOAD_URL, { redirect: 'follow' });
  if (!response.ok) throw new Error(`yt-dlp 다운로드 실패 (HTTP ${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024 * 1024) throw new Error('yt-dlp 다운로드 파일이 손상되었습니다.');
  const temp = `${target}.download`;
  fs.writeFileSync(temp, buffer);
  fs.rmSync(target, { force: true });
  fs.renameSync(temp, target);
  const found = canRun(target);
  if (!found) throw new Error('다운로드한 yt-dlp 를 실행할 수 없습니다.');
  return { path: found.path, version: found.version };
}

function run(exePath, args, options = {}) {
  const { timeoutMs = 180000, onLine, signal, cwd } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(exePath, args, { windowsHide: true, cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`yt-dlp 시간 초과 (${Math.round(timeoutMs / 1000)}초)`));
    }, timeoutMs);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      const error = new Error('사용자가 수집을 취소했습니다.');
      error.code = 'CANCELLED';
      reject(error);
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
    const handleChunk = (chunk, isError) => {
      const text = chunk.toString('utf8');
      if (isError) stderr += text;
      else stdout += text;
      if (onLine) {
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) onLine(line.trim(), isError);
        }
      }
    };
    child.stdout.on('data', (chunk) => handleChunk(chunk, false));
    child.stderr.on('data', (chunk) => handleChunk(chunk, true));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`yt-dlp 실행 실패: ${error.message}`));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      if (code === 0) resolve({ stdout, stderr, code });
      else reject(new Error(`yt-dlp 종료 코드 ${code}: ${stderr.split('\n').filter(Boolean).slice(-1)[0] ?? ''}`));
    });
  });
}

module.exports = { EXE_NAME, detect, download, run, canRun };
