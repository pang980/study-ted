const fs = require('node:fs');
const http = require('node:http');
const path = require('path');
const { app, BrowserWindow, Menu, shell } = require('electron');

const logger = require('./logger');
const paths = require('./paths');
const db = require('./db');
const ipc = require('./ipc');
const demo = require('./demo-data');
const updater = require('./update');

const HOST = '127.0.0.1';

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://s.ytimg.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
  'media-src https: blob:',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

let mainWindow = null;
let server = null;
let serverReady = null;
let booted = false;

// 렌더러는 http://127.0.0.1:<임의 포트> 로 서빙한다.
// 커스텀 스킴(app://)으로 띄우면 Chromium 이 Referer 를 보내지 않아 YouTube 가
// 임베드 재생을 거부(error 153)하므로, 실제 http 오리진이 필요하다.
// constants 는 서버가 뜬 뒤에 채워지며, 내보낸 객체를 그대로 갱신한다.
const constants = { ORIGIN: '', HOME_URL: '', CSP };

function resolveAsset(requestUrl) {
  const url = new URL(requestUrl, `http://${HOST}`);
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const full = path.resolve(paths.rendererDir, relative);
  if (full !== paths.rendererDir && !full.startsWith(paths.rendererDir + path.sep)) return null;
  return full;
}

function serveAsset(request, response) {
  const filePath = resolveAsset(request.url);
  if (!filePath) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    const headers = {
      'Content-Security-Policy': constants.CSP,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    };
    const type = MIME[path.extname(filePath).toLowerCase()];
    headers['Content-Type'] = type ?? 'application/octet-stream';
    response.writeHead(200, headers);
    response.end(data);
  });
}

function startStaticServer() {
  if (serverReady) return serverReady;
  serverReady = new Promise((resolve, reject) => {
    const instance = http.createServer((request, response) => {
      // 로컬 파일만 서빙하므로 DNS 리바인딩으로 다른 호스트명이 들어오면 거부한다.
      if (request.headers.host !== `${HOST}:${instance.address()?.port ?? ''}`) {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Forbidden');
        return;
      }
      serveAsset(request, response);
    });
    instance.once('error', (error) => {
      logger.error('server', '렌더러 서버를 시작하지 못했습니다.', error.message);
      reject(error);
    });
    instance.listen(0, HOST, () => {
      server = instance;
      const port = instance.address().port;
      constants.ORIGIN = `http://${HOST}:${port}`;
      constants.HOME_URL = `${constants.ORIGIN}/index.html`;
      logger.info('server', `렌더러 서버 준비 (${constants.ORIGIN})`);
      resolve(constants.ORIGIN);
    });
  });
  return serverReady;
}

function closeStaticServer() {
  try {
    server?.close();
  } catch {
    // 종료 중 서버 정리 실패는 무시한다.
  }
  server = null;
  serverReady = null;
}

function buildMenu() {
  // 프레임리스 창에서도 복사/붙여넣기 단축키가 동작하도록 편집 역할만 등록한다.
  const menu = Menu.buildFromTemplate([
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

function openExternal(url) {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
}

function createWindow(options = {}) {
  const win = new BrowserWindow({
    width: options.width ?? 1440,
    height: options.height ?? 960,
    minWidth: 1180,
    minHeight: 720,
    frame: false,
    show: false,
    backgroundColor: '#f0f6f6',
    title: 'YouTube English Learner',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  win.once('ready-to-show', () => {
    if (!options.hidden) win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!constants.ORIGIN || !url.startsWith(constants.ORIGIN)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  const query = new URLSearchParams();
  if (options.demo) query.set('demo', '1');
  if (options.dev) query.set('dev', '1');
  const suffix = query.toString() ? `?${query.toString()}` : '';

  // 서버 포트가 정해진 뒤에 페이지를 올린다(창 객체는 즉시 반환한다).
  startStaticServer()
    .then(() => {
      if (!win.isDestroyed()) win.loadURL(`${constants.HOME_URL}${suffix}`);
    })
    .catch((error) => {
      logger.error('server', '렌더러 페이지를 불러오지 못했습니다.', error.message);
    });

  if (options.dev) win.webContents.openDevTools({ mode: 'detach' });
  return win;
}

function bootstrap(options = {}) {
  if (booted) return mainWindow;
  booted = true;

  paths.ensureDirs();
  logger.configure(paths.logsDir());
  db.init(paths.dbPath());
  logger.info('app', `시작 (electron ${process.versions.electron} / node ${process.versions.node})`);

  startStaticServer();
  buildMenu();
  ipc.register();

  if (options.demo) {
    const summary = demo.seed({ force: Boolean(options.demoForce) });
    logger.info('demo', `데모 데이터 ${summary.seeded ? '주입' : '건너뜀'}`, summary.added ?? summary.reason);
  }

  mainWindow = createWindow(options);
  ipc.setWindow(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

if (process.env.STUDY_TED_SMOKE !== '1') {
  const argv = process.argv.slice(1);
  const dev = argv.includes('--dev');
  const demoFlag = argv.includes('--demo');

  // 설치본의 바로가기/알림이 같은 앱으로 묶이도록 electron-builder 의 appId 와 맞춘다.
  app.setAppUserModelId('com.studyted.desktop');

  app.whenReady().then(() => {
    bootstrap({ dev, demo: demoFlag });
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow({ dev });
        ipc.setWindow(mainWindow);
      }
    });

    // 창이 뜨는 것을 방해하지 않도록 잠시 뒤에 새 버전을 확인한다.
    updater.cleanupDownloads();
    setTimeout(() => {
      updater.autoCheck().catch(() => {});
    }, 8000);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    try {
      db.close();
    } catch {
      // 종료 중 DB 정리 실패는 무시한다.
    }
    closeStaticServer();
  });
}

module.exports = { bootstrap, createWindow, getWindow: () => mainWindow, constants };
