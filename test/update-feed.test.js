const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const rootDir = path.join(__dirname, '..');
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'study-ted-update-'));
const userDataDir = path.join(workDir, 'userData');
fs.mkdirSync(userDataDir, { recursive: true });

// Electron 없이 업데이터만 검증한다. electron 모듈을 최소 스텁으로 바꿔 끼운다.
const electronEntry = require.resolve('electron');
require.cache[electronEntry] = {
  id: electronEntry,
  filename: electronEntry,
  loaded: true,
  exports: {
    app: {
      getVersion: () => '1.0.0',
      isPackaged: false,
      getAppPath: () => rootDir,
      getPath: (name) => (name === 'userData' ? userDataDir : path.join(userDataDir, name)),
    },
  },
};

const db = require('../main/db');
const settings = require('../main/db/settings');
const updater = require('../main/update');

db.init(path.join(userDataDir, 'study-ted.db'));

const installer = Buffer.from('StudyTED fake installer payload\n'.repeat(400), 'utf8');
const installerSha = crypto.createHash('sha256').update(installer).digest('hex');

const feed = {
  version: '1.0.1',
  url: 'StudyTED-Setup-1.0.1.exe',
  sha256: installerSha,
  size: installer.length,
  notes: '자동 업데이트 테스트',
};
let feedStatus = 200;
let feedHits = 0;

function json(res, body, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/redirect/latest.json') {
    res.writeHead(302, { Location: '/latest.json' });
    res.end();
    return;
  }
  if (url === '/latest.json') {
    feedHits += 1;
    json(res, feed, feedStatus);
    return;
  }
  if (url === '/relative/latest.json') {
    json(res, { version: '1.0.2', asset: './files/StudyTED-Setup-1.0.2.exe', size: installer.length, notes: '상대 경로' });
    return;
  }
  if (url === '/relative/files/StudyTED-Setup-1.0.2.exe') {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': String(installer.length) });
    res.end(installer);
    return;
  }
  if (url === '/StudyTED-Setup-1.0.1.exe') {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': String(installer.length) });
    res.end(installer);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

const listening = new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let baseUrl = '';

function useFeed(pathname) {
  settings.setRaw('update.feedUrl', `${baseUrl}${pathname}`);
}

function updatesDir() {
  return path.join(userDataDir, 'tmp', 'updates');
}

test.before(async () => {
  await listening;
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
  db.close();
  fs.rmSync(workDir, { recursive: true, force: true });
});

test('업데이트 주소가 없으면 확인하지 않고 오류로 알린다', async () => {
  settings.setRaw('update.feedUrl', '');
  await assert.rejects(updater.check({ force: true }), (error) => error.code === 'UPDATE_NO_FEED');
  assert.equal(updater.state().phase, 'error');
  assert.match(updater.state().error, /업데이트 주소가 없습니다/);

  settings.setRaw('update.feedUrl', 'ftp://example.com/latest.json');
  await assert.rejects(updater.check({ force: true }), (error) => error.code === 'UPDATE_URL');
});

test('피드를 읽어 새 버전이 있으면 available 로 표시한다', async () => {
  useFeed('/latest.json');
  const state = await updater.check({ force: true });
  assert.equal(state.phase, 'available');
  assert.equal(state.version, '1.0.0');
  assert.equal(state.latest.version, '1.0.1');
  assert.equal(state.latest.sha256, installerSha);
  assert.equal(state.latest.notes, '자동 업데이트 테스트');
  assert.ok(state.checkedAt);
  assert.equal(settings.getValue('update.lastCheckAt', ''), state.checkedAt);
  assert.equal(updater.state().packaged, false);
});

test('같은 버전이면 current 로 표시한다', async () => {
  const original = feed.version;
  feed.version = '1.0.0';
  try {
    const state = await updater.check({ force: true });
    assert.equal(state.phase, 'current');
    assert.match(state.message, /최신 버전/);
  } finally {
    feed.version = original;
  }
});

test('302 이동을 따라가고 상대 자산 주소를 피드 기준으로 푼다', async () => {
  useFeed('/redirect/latest.json');
  const redirected = await updater.check({ force: true });
  assert.equal(redirected.phase, 'available');
  assert.equal(redirected.latest.version, '1.0.1');

  useFeed('/relative/latest.json');
  const relative = await updater.check({ force: true });
  assert.equal(relative.latest.version, '1.0.2');
  assert.equal(relative.latest.url, `${baseUrl}/relative/files/StudyTED-Setup-1.0.2.exe`);
});

test('파일을 내려받아 sha256 까지 검증하고 준비 상태가 된다', async () => {
  useFeed('/latest.json');
  const phases = [];
  const off = updater.onStatus((state) => phases.push(state.phase));
  try {
    await updater.check({ force: true });
    const done = await updater.download();
    assert.equal(done.phase, 'ready');
    assert.equal(done.percent, 100);
    assert.equal(done.received, installer.length);
    assert.ok(fs.existsSync(done.filePath));
    assert.equal(fs.statSync(done.filePath).size, installer.length);
    const digest = crypto.createHash('sha256').update(fs.readFileSync(done.filePath)).digest('hex');
    assert.equal(digest, installerSha);
    assert.ok(phases.includes('downloading'));
    assert.equal(phases[phases.length - 1], 'ready');
  } finally {
    off();
  }

  // 다시 확인해도 내려받은 파일을 재사용한다.
  const again = await updater.check({ force: true });
  assert.equal(again.phase, 'ready');

  assert.equal(fs.readdirSync(updatesDir()).filter((name) => name.endsWith('.part')).length, 0);
  updater.cleanupDownloads('1.0.1');
  assert.ok(fs.existsSync(path.join(updatesDir(), 'StudyTED-Setup-1.0.1.exe')));
  updater.cleanupDownloads('9.9.9');
  assert.equal(fs.existsSync(path.join(updatesDir(), 'StudyTED-Setup-1.0.1.exe')), false);
});

test('sha256 이 어긋나면 손상 파일로 거부하고 찌꺼기를 남기지 않는다', async () => {
  useFeed('/latest.json');
  const original = feed.sha256;
  feed.sha256 = 'f'.repeat(64);
  try {
    await updater.check({ force: true });
    await assert.rejects(updater.download(), (error) => error.code === 'UPDATE_HASH');
    assert.equal(updater.state().phase, 'error');
    assert.match(updater.state().error, /손상/);
    const left = fs.existsSync(updatesDir()) ? fs.readdirSync(updatesDir()) : [];
    assert.equal(left.filter((name) => name.endsWith('.part')).length, 0);
    assert.equal(left.filter((name) => name.startsWith('StudyTED-Setup-1.0.1')).length, 0);
  } finally {
    feed.sha256 = original;
  }
});

test('주소를 지우면 이전 업데이트 정보가 남지 않는다', async () => {
  useFeed('/latest.json');
  assert.equal((await updater.check({ force: true })).phase, 'available');

  settings.setRaw('update.feedUrl', '');
  const cleared = await updater.check({ silent: true });
  assert.equal(cleared.latest, null);
  assert.equal(cleared.filePath, '');
  assert.equal(cleared.phase, 'idle');

  await assert.rejects(updater.download(), (error) => error.code === 'UPDATE_STATE');
});

test('서버 오류는 확인 실패로 알린다', async () => {
  useFeed('/latest.json');
  feedStatus = 503;
  try {
    await assert.rejects(updater.check({ force: true }), (error) => error.code === 'UPDATE_HTTP');
    assert.equal(updater.state().phase, 'error');
  } finally {
    feedStatus = 200;
  }
});

test('개발 실행에서는 자동 설치를 막는다', async () => {
  useFeed('/latest.json');
  await updater.check({ force: true });
  const ready = await updater.download();
  assert.equal(ready.phase, 'ready');
  assert.throws(() => updater.install(), (error) => error.code === 'UPDATE_DEV');
  assert.match(updater.state().error, /설치본에서 실행/);
});

test('조용한 설치 스크립트가 설치 경로를 /D 로 넘기고 앱을 다시 연다', () => {
  const scriptPath = updater.writeInstallScript(
    'C:\\Users\\me\\AppData\\Local\\Temp\\StudyTED-Setup-1.0.1.exe',
    'C:\\Users\\me\\AppData\\Local\\StudyTED',
    'C:\\Users\\me\\AppData\\Local\\StudyTED\\StudyTED.exe',
  );
  const text = fs.readFileSync(scriptPath, 'utf8');
  const lines = text.split('\r\n').filter(Boolean);
  assert.equal(lines[0], '@echo off');
  // /D= 뒤에는 줄 끝까지가 경로라서 설치 명령 한 줄에 다른 명령을 붙이면 안 된다.
  assert.equal(lines[1], 'start "" /wait "C:\\Users\\me\\AppData\\Local\\Temp\\StudyTED-Setup-1.0.1.exe" /S /D=C:\\Users\\me\\AppData\\Local\\StudyTED');
  assert.equal(lines[2], 'start "" "C:\\Users\\me\\AppData\\Local\\StudyTED\\StudyTED.exe"');
  assert.equal(lines[3], 'del "%~f0"');
});

test('자동 확인은 주소가 없거나 꺼져 있으면 요청하지 않는다', async () => {
  settings.setRaw('update.feedUrl', '');
  settings.setRaw('update.autoCheck', '1');
  settings.setRaw('update.lastCheckAt', '');
  const before = feedHits;
  await updater.autoCheck();
  assert.equal(feedHits, before);

  settings.setRaw('update.lastCheckAt', '');
  settings.setRaw('update.autoCheck', '0');
  useFeed('/latest.json');
  await updater.autoCheck();
  assert.equal(feedHits, before);

  // 주소와 자동 확인이 켜져 있으면 한 번 확인한다.
  settings.setRaw('update.autoCheck', '1');
  const checked = await updater.autoCheck();
  assert.equal(feedHits, before + 1);
  assert.ok(checked.checkedAt);

  // 6시간 안에 이미 확인했으면 다시 요청하지 않는다.
  await updater.autoCheck();
  assert.equal(feedHits, before + 1);
});