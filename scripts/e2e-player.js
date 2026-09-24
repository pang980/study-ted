// 실제 YouTube 영상이 임베드 재생되는지 확인한다.
// 렌더러를 커스텀 스킴(app://)으로 열면 Chromium 이 Referer 를 보내지 않아
// YouTube 가 재생을 거부(error 153)하므로, loopback http 서빙을 회귀 검증한다.
// 실행: npm run e2e:player -- --video=<영상ID>
process.env.STUDY_TED_SMOKE = '1';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const rootDir = path.join(__dirname, '..');

function readOption(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

const videoId = readOption('video') || 'PRmIrFhce04';

// 사용자의 실제 DB 를 건드리지 않도록 임시 userData 를 쓴다.
const userDataDir = path.join(rootDir, '_tmp', 'e2e-player-userdata');
fs.mkdirSync(userDataDir, { recursive: true });
app.setPath('userData', userDataDir);

const main = require('../main/main.js');
const db = require('../main/db');

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name} :: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(win, expression, timeout = 20000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      if (await win.webContents.executeJavaScript(expression, true)) return true;
    } catch { /* 로딩 중 실행 실패는 무시하고 재시도한다. */ }
    if (Date.now() > deadline) return false;
    await sleep(200);
  }
}

async function run() {
  const win = main.bootstrap({ demo: true, demoForce: true, hidden: true, width: 1400, height: 900 });
  const logs = [];
  win.webContents.on('console-message', (event, level, message) => logs.push(`[console:${level}] ${message}`));

  const referer = [];
  win.webContents.session.webRequest.onBeforeSendHeaders({ urls: ['*://*.youtube.com/*'] }, (details, callback) => {
    const header = details.requestHeaders.Referer || details.requestHeaders.referer || '';
    referer.push({ url: details.url.slice(0, 70), referer: header });
    callback({ requestHeaders: details.requestHeaders });
  });

  const loaded = await waitFor(win, "document.readyState === 'complete' && !!document.getElementById('content')");
  record('렌더러 로드', loaded, logs.slice(0, 3));
  record(
    '렌더러 origin',
    String(main.constants.ORIGIN).startsWith('http://127.0.0.1:') && String(win.webContents.getURL()).startsWith(main.constants.ORIGIN),
    { origin: main.constants.ORIGIN, pageUrl: win.webContents.getURL() },
  );

  await win.webContents.executeJavaScript("window.studyTed.settings.update({ lastView: 'learn' })", true);
  win.webContents.reload();
  await waitFor(win, "document.readyState === 'complete' && !!document.getElementById('content')");
  await sleep(500);

  const playback = await win.webContents.executeJavaScript(
    `(async () => {
      try {
        const mod = await import('/js/player.js');
        const host = document.createElement('div');
        host.id = 'e2e-player-host';
        host.style.width = '640px';
        host.style.height = '360px';
        document.body.append(host);
        const errors = [];
        const player = new mod.YouTubePlayer(host);
        player.on('error', (code) => errors.push(code));
        await player.mount('${videoId}', { captions: false, startAt: 0 });
        await new Promise((resolve) => setTimeout(resolve, 6000));
        return { mounted: true, errors, duration: player.getDuration() };
      } catch (error) {
        return { mounted: false, error: String((error && error.message) || error) };
      }
    })()`,
    true,
  );

  record('플레이어 마운트', playback.mounted === true, playback.mounted === true ? { videoId } : playback);
  record('재생 오류 없음', Array.isArray(playback.errors) && playback.errors.length === 0, playback.errors || []);
  record('재생 시간 확인', Number(playback.duration) > 0, { duration: playback.duration });

  const withReferer = referer.filter((item) => item.referer);
  record('YouTube 요청 Referer 전달', withReferer.length > 0, {
    total: referer.length,
    sample: withReferer.slice(0, 2).map((item) => item.referer),
  });

  const shot = await win.webContents.capturePage();
  fs.writeFileSync(path.join(rootDir, '_tmp', 'e2e-player.png'), shot.toPNG());
}

app.whenReady().then(async () => {
  try {
    await run();
  } catch (error) {
    record('E2E 실행', false, error.stack || error.message);
  } finally {
    const failed = results.filter((item) => !item.ok);
    console.log('');
    console.log(`총 ${results.length}개 확인 / 실패 ${failed.length}개`);
    try { db.close(); } catch { /* 종료 중 정리 실패는 무시한다. */ }
    app.exit(failed.length ? 1 : 0);
  }
});
