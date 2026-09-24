const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { app } = require('electron');

const logger = require('./logger');
const paths = require('./paths');
const settingsDb = require('./db/settings');

// 업데이트 정보(JSON)는 사용자가 설정에 넣은 주소에서 받아 온다.
// 형식: { "version": "1.0.1", "url": "StudyTED-Setup-1.0.1.exe", "sha256": "...", "notes": "..." }
const FEED_TIMEOUT_MS = 15000;
const STALL_TIMEOUT_MS = 60000;
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_REDIRECTS = 5;
const MAX_FEED_BYTES = 1024 * 1024;

const listeners = new Set();

const status = {
  phase: 'idle', // idle | checking | current | available | downloading | ready | installing | error
  version: '',
  packaged: false,
  feedUrl: '',
  autoCheck: true,
  silentInstall: true,
  latest: null,
  checkedAt: null,
  received: 0,
  total: 0,
  percent: 0,
  filePath: '',
  error: '',
  message: '',
};

function withCode(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function snapshot() {
  return { ...status, latest: status.latest ? { ...status.latest } : null };
}

function emit() {
  const payload = snapshot();
  for (const listener of listeners) {
    try {
      listener(payload);
    } catch (error) {
      logger.error('update', '상태 전달 실패', error.message);
    }
  }
}

function onStatus(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function refreshConfig() {
  status.version = app.getVersion();
  status.packaged = app.isPackaged;
  status.feedUrl = String(settingsDb.getValue('update.feedUrl', '') ?? '').trim();
  status.autoCheck = settingsDb.getValue('update.autoCheck', '1') === '1';
  status.silentInstall = settingsDb.getValue('update.silentInstall', '1') === '1';
  return status;
}

// 'v1.2.3', '1.2' 같은 표기도 받아 숫자 3자리로 맞춘다.
function parseVersion(value) {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(value ?? '').trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function isNewer(candidate, current) {
  const next = parseVersion(candidate);
  const now = parseVersion(current);
  if (!next || !now) return false;
  for (let index = 0; index < 3; index += 1) {
    if (next[index] > now[index]) return true;
    if (next[index] < now[index]) return false;
  }
  return false;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value ?? ''));
}

function resolveAssetUrl(feedUrl, value) {
  if (!value) return '';
  try {
    return new URL(String(value), feedUrl).toString();
  } catch {
    return '';
  }
}

function requestStream(url, { timeout = FEED_TIMEOUT_MS, redirects = MAX_REDIRECTS } = {}) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      reject(withCode('업데이트 주소가 올바르지 않습니다.', 'UPDATE_URL'));
      return;
    }
    const transport = target.protocol === 'http:' ? http : https;
    const request = transport.get(
      target,
      { headers: { 'User-Agent': `StudyTED/${app.getVersion()}`, Accept: '*/*', 'Cache-Control': 'no-cache' } },
      (response) => {
        const code = response.statusCode ?? 0;
        if (code >= 300 && code < 400 && response.headers.location) {
          response.resume();
          if (redirects <= 0) {
            reject(withCode('주소 이동이 너무 많습니다.', 'UPDATE_REDIRECT'));
            return;
          }
          const next = new URL(response.headers.location, target).toString();
          requestStream(next, { timeout, redirects: redirects - 1 }).then(resolve, reject);
          return;
        }
        if (code !== 200) {
          response.resume();
          reject(withCode(`업데이트 서버가 ${code} 응답을 보냈습니다.`, 'UPDATE_HTTP'));
          return;
        }
        resolve(response);
      },
    );
    request.setTimeout(timeout, () => {
      request.destroy(withCode('업데이트 서버 응답이 없습니다.', 'UPDATE_TIMEOUT'));
    });
    request.on('error', (error) => {
      reject(error && error.code ? error : withCode(error?.message ?? '네트워크 오류', 'UPDATE_NETWORK'));
    });
  });
}

function readFeedText(url) {
  return requestStream(url).then(
    (response) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_FEED_BYTES) {
            response.destroy();
            reject(withCode('업데이트 정보가 너무 큽니다.', 'UPDATE_FEED'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        response.on('error', reject);
      }),
  );
}

function safeFileName(latest) {
  try {
    const name = decodeURIComponent(path.basename(new URL(latest.url).pathname));
    if (name && /\.(exe|msi|zip)$/i.test(name)) return name;
  } catch {
    // 이름을 못 뽑으면 버전으로 대신한다.
  }
  return `StudyTED-Setup-${latest.version}.exe`;
}

function updatesDir() {
  const dir = path.join(paths.tmpDir(), 'updates');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function findReadyFile(latest) {
  if (!latest?.url) return '';
  const target = path.join(updatesDir(), safeFileName(latest));
  try {
    const stat = fs.statSync(target);
    if (stat.size > 0 && (!latest.size || stat.size === latest.size)) return target;
  } catch {
    return '';
  }
  return '';
}

function autoCheckDue() {
  refreshConfig();
  if (!status.autoCheck || !status.feedUrl) return false;
  const last = settingsDb.getValue('update.lastCheckAt', '');
  const at = Date.parse(last);
  if (!Number.isFinite(at)) return true;
  return Date.now() - at > AUTO_CHECK_INTERVAL_MS;
}

// 주소를 지우거나 바꾸면 이전에 받아 둔 업데이트 정보가 남지 않게 비운다.
function clearLatest() {
  if (status.phase === 'downloading' || status.phase === 'installing') return;
  status.latest = null;
  status.filePath = '';
  status.checkedAt = null;
  status.received = 0;
  status.total = 0;
  status.percent = 0;
  if (status.phase === 'ready' || status.phase === 'available' || status.phase === 'current') {
    status.phase = 'idle';
  }
}

async function check({ silent = false, force = false } = {}) {
  refreshConfig();
  if (!status.feedUrl) {
    clearLatest();
    if (!silent) {
      status.phase = 'error';
      status.error = '업데이트 주소가 없습니다. 설정에서 업데이트 주소를 입력해 주세요.';
      status.message = '';
      emit();
      throw withCode(status.error, 'UPDATE_NO_FEED');
    }
    return snapshot();
  }
  if (!isHttpUrl(status.feedUrl)) {
    clearLatest();
    if (!silent) {
      status.phase = 'error';
      status.error = '업데이트 주소는 http/https 주소여야 합니다.';
      emit();
      throw withCode(status.error, 'UPDATE_URL');
    }
    return snapshot();
  }

  status.phase = 'checking';
  status.error = '';
  status.message = '업데이트를 확인하는 중입니다.';
  status.percent = 0;
  emit();

  try {
    const text = await readFeedText(status.feedUrl);
    const data = JSON.parse(text);
    const latestVersion = String(data.version ?? data.tag_name ?? '').trim().replace(/^v/i, '');
    if (!parseVersion(latestVersion)) throw withCode('업데이트 정보에 버전이 없습니다.', 'UPDATE_FEED');

    const url = resolveAssetUrl(status.feedUrl, data.url ?? data.path ?? data.asset ?? '');
    const latest = {
      version: latestVersion,
      url,
      notes: String(data.notes ?? data.releaseNotes ?? '').slice(0, 2000),
      sha256: String(data.sha256 ?? '').trim().toLowerCase(),
      size: Number(data.size) || 0,
      pubDate: data.pubDate ?? data.releaseDate ?? null,
    };
    const hasUpdate = isNewer(latest.version, status.version);
    status.latest = latest;
    status.checkedAt = new Date().toISOString();
    settingsDb.setRaw('update.lastCheckAt', status.checkedAt);
    status.filePath = hasUpdate ? findReadyFile(latest) : '';
    status.phase = hasUpdate ? (status.filePath ? 'ready' : 'available') : 'current';
    status.error = '';
    status.message = hasUpdate
      ? `새 버전 ${latest.version} 을(를) 사용할 수 있습니다.`
      : `최신 버전(${status.version})을 사용 중입니다.`;
    if (force) logger.info('update', `업데이트 확인 완료 (${status.version} → ${latest.version})`);
    emit();
    return snapshot();
  } catch (error) {
    status.phase = 'error';
    status.error = error?.code === 'UPDATE_FEED' || error?.code === 'UPDATE_URL' ? error.message : `업데이트를 확인하지 못했습니다. ${error?.message ?? ''}`.trim();
    status.message = '';
    emit();
    if (silent) {
      logger.warn('update', '자동 업데이트 확인 실패', status.error);
      return snapshot();
    }
    throw Object.assign(new Error(status.error), { code: error?.code ?? 'UPDATE_CHECK' });
  }
}

async function download() {
  refreshConfig();
  const latest = status.latest;
  if (!latest?.url || !isHttpUrl(latest.url)) {
    const error = withCode('내려받을 업데이트가 없습니다. 먼저 업데이트를 확인해 주세요.', 'UPDATE_STATE');
    status.phase = 'error';
    status.error = error.message;
    emit();
    throw error;
  }

  const dir = updatesDir();
  const target = path.join(dir, safeFileName(latest));
  const partial = `${target}.part`;
  status.phase = 'downloading';
  status.error = '';
  status.message = `업데이트 ${latest.version} 내려받는 중입니다.`;
  status.received = 0;
  status.total = latest.size || 0;
  status.percent = 0;
  status.filePath = '';
  emit();

  try {
    const response = await requestStream(latest.url, { timeout: STALL_TIMEOUT_MS });
    const total = Number(response.headers['content-length']) || latest.size || 0;
    status.total = total;
    const hash = crypto.createHash('sha256');
    let received = 0;
    let pending = 0;

    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(partial);
      response.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      response.on('data', (chunk) => {
        received += chunk.length;
        hash.update(chunk);
        pending += chunk.length;
        if (pending >= 256 * 1024) {
          pending = 0;
          status.received = received;
          status.percent = total ? Math.min(99, Math.round((received / total) * 100)) : 0;
          emit();
        }
      });
      response.pipe(out);
    });

    if (latest.sha256) {
      const digest = hash.digest('hex');
      if (digest !== latest.sha256) {
        fs.rmSync(partial, { force: true });
        throw withCode('내려받은 파일이 손상되었습니다. 다시 시도해 주세요.', 'UPDATE_HASH');
      }
    }

    fs.rmSync(target, { force: true });
    fs.renameSync(partial, target);
    status.filePath = target;
    status.received = received;
    status.percent = 100;
    status.phase = 'ready';
    status.message = `업데이트 ${latest.version} 준비 완료. 설치하면 앱이 다시 시작됩니다.`;
    logger.info('update', `업데이트 파일 준비 (${path.basename(target)})`);
    emit();
    return snapshot();
  } catch (error) {
    fs.rmSync(partial, { force: true });
    status.phase = 'error';
    status.error = `업데이트를 내려받지 못했습니다. ${error?.message ?? ''}`.trim();
    status.message = '';
    emit();
    throw Object.assign(new Error(status.error), { code: error?.code ?? 'UPDATE_DOWNLOAD' });
  }
}

// /D= 뒤에는 명령줄 끝까지가 경로로 들어가므로, 설치와 재실행을 한 줄에 붙이지 않는다.
function writeInstallScript(installerPath, installDir, exePath) {
  const dir = updatesDir();
  const scriptPath = path.join(dir, 'apply-update.cmd');
  const lines = [
    '@echo off',
    `start "" /wait "${installerPath}" /S /D=${installDir}`,
    `start "" "${exePath}"`,
    'del "%~f0"',
    '',
  ];
  fs.writeFileSync(scriptPath, lines.join('\r\n'), 'utf8');
  return scriptPath;
}

function install() {
  refreshConfig();
  if (!status.filePath || !fs.existsSync(status.filePath)) {
    const error = withCode('내려받은 설치 파일이 없습니다.', 'UPDATE_STATE');
    status.phase = 'error';
    status.error = error.message;
    emit();
    throw error;
  }
  if (!status.packaged) {
    const error = withCode('개발 실행 상태에서는 자동 설치를 할 수 없습니다. 설치본에서 실행해 주세요.', 'UPDATE_DEV');
    status.error = error.message;
    emit();
    throw error;
  }

  const exePath = app.getPath('exe');
  const installDir = path.dirname(exePath);
  status.phase = 'installing';
  status.error = '';
  status.message = status.silentInstall
    ? '설치를 시작합니다. 앱이 곧 종료되고 자동으로 다시 열립니다.'
    : '설치 화면을 열었습니다. 안내에 따라 설치해 주세요.';
  emit();

  try {
    if (status.silentInstall) {
      const scriptPath = writeInstallScript(status.filePath, installDir, exePath);
      spawn('cmd.exe', ['/c', scriptPath], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } else {
      spawn(status.filePath, [], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (error) {
    status.phase = 'error';
    status.error = `설치 프로그램을 실행하지 못했습니다. ${error?.message ?? ''}`.trim();
    emit();
    throw Object.assign(new Error(status.error), { code: 'UPDATE_INSTALL' });
  }

  logger.info('update', `업데이트 설치 시작 (${path.basename(status.filePath)})`);
  setTimeout(() => app.exit(0), 800);
  return snapshot();
}

function cleanupDownloads(keepVersion = '') {
  const dir = path.join(paths.tmpDir(), 'updates');
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of names) {
    if (name.endsWith('.part') || name === 'apply-update.cmd') {
      fs.rmSync(path.join(dir, name), { force: true });
      removed += 1;
      continue;
    }
    if (keepVersion && name.includes(keepVersion)) continue;
    fs.rmSync(path.join(dir, name), { force: true });
    removed += 1;
  }
  return removed;
}

async function autoCheck() {
  if (!autoCheckDue()) return snapshot();
  try {
    return await check({ silent: true });
  } catch (error) {
    logger.warn('update', '자동 확인 건너뜀', error.message);
    return snapshot();
  }
}

module.exports = {
  state: () => {
    refreshConfig();
    if (!status.latest) status.filePath = '';
    return snapshot();
  },
  check,
  download,
  install,
  autoCheck,
  onStatus,
  cleanupDownloads,
  isNewer,
  parseVersion,
  writeInstallScript,
};