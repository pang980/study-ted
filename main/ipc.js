const fs = require('fs');
const path = require('path');
const { ipcMain, dialog, shell, app } = require('electron');
const logger = require('./logger');
const channelsDb = require('./db/channels');
const videosDb = require('./db/videos');
const transcriptsDb = require('./db/transcripts');
const sentencesDb = require('./db/sentences');
const settingsDb = require('./db/settings');
const collect = require('./collect');
const ai = require('./ai/openrouter');
const share = require('./share');
const demo = require('./demo-data');
const updater = require('./update');

let mainWindow = null;
let lastExport = { content: '', filename: 'study-ted.json' };

function setWindow(win) {
  mainWindow = win;
}

function ok(data) {
  return { ok: true, data };
}

function fail(error) {
  return {
    ok: false,
    error: {
      code: error?.code ?? 'UNEXPECTED',
      message: error?.message ?? '알 수 없는 오류가 발생했습니다.',
      detail: error?.detail ?? null,
    },
  };
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (event, payload) => {
    try {
      return ok(await fn(payload ?? {}, event));
    } catch (error) {
      logger.error('ipc', `${channel} 처리 실패`, error.message);
      return fail(error);
    }
  });
}

function requireString(value, name, { max = 4096 } = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${name} 값이 필요합니다.`);
    error.code = 'VALIDATION';
    throw error;
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    const error = new Error(`${name} 값이 너무 깁니다.`);
    error.code = 'VALIDATION';
    throw error;
  }
  return trimmed;
}

function optionalString(value, max = 8192) {
  if (value === null || value === undefined) return null;
  return String(value).slice(0, max);
}

function requireInt(value, name, { min = 0, max = 100000 } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    const error = new Error(`${name} 값이 올바르지 않습니다.`);
    error.code = 'VALIDATION';
    throw error;
  }
  return Math.round(num);
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function counts() {
  return {
    channels: channelsDb.list().length,
    videos: videosDb.count(),
    transcripts: transcriptsDb.count(),
    sentences: sentencesDb.count(),
  };
}

function register() {
  // 다운로드 진행률처럼 먼저 알려야 하는 상태는 렌더러로 바로 밀어 준다.
  updater.onStatus((snapshot) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:status', snapshot);
  });

  handle('app:info', () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    platform: process.platform,
    counts: counts(),
    collect: collect.providerStatus(),
    settings: settingsDb.publicSettings(),
  }));

  handle('app:openExternal', ({ url }) => {
    const value = requireString(url, 'URL', { max: 2048 });
    if (!/^https?:\/\//i.test(value)) {
      const error = new Error('http/https 주소만 열 수 있습니다.');
      error.code = 'VALIDATION';
      throw error;
    }
    shell.openExternal(value);
    return true;
  });

  handle('window:minimize', () => {
    mainWindow?.minimize();
    return true;
  });

  handle('window:toggleMaximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });

  handle('window:close', () => {
    mainWindow?.close();
    return true;
  });

  handle('settings:get', () => settingsDb.publicSettings());

  handle('settings:update', (payload) => {
    if (payload.provider !== undefined) {
      settingsDb.setRaw('collect.provider', oneOf(payload.provider, ['auto', 'ytdlp', 'native'], 'auto'));
    }
    if (payload.ytdlpPath !== undefined) settingsDb.setRaw('collect.ytdlpPath', optionalString(payload.ytdlpPath, 1024) ?? '');
    if (payload.collectLimit !== undefined) {
      // 'all' 은 개수 제한 없이 채널 전체를 가져오는 값이다.
      if (payload.collectLimit === 'all' || Number(payload.collectLimit) === 0) settingsDb.setRaw('collect.limit', 'all');
      else settingsDb.setRaw('collect.limit', String(requireInt(payload.collectLimit, '수집 개수', { min: 1, max: 200 })));
    }
    if (payload.collectAll !== undefined) settingsDb.setRaw('collect.collectAll', payload.collectAll ? '1' : '0');
    if (payload.withSubtitles !== undefined) settingsDb.setRaw('collect.withSubtitles', payload.withSubtitles ? '1' : '0');
    if (payload.refreshExisting !== undefined) settingsDb.setRaw('collect.refreshExisting', payload.refreshExisting ? '1' : '0');
    if (payload.concurrency !== undefined) settingsDb.setRaw('collect.concurrency', String(requireInt(payload.concurrency, '동시 수집 개수', { min: 1, max: 8 })));
    if (payload.model !== undefined) settingsDb.setRaw('ai.model', optionalString(payload.model, 200) ?? '');
    if (payload.lastView !== undefined) settingsDb.setRaw('ui.lastView', oneOf(payload.lastView, ['home', 'channels', 'learn', 'notes', 'materials', 'share', 'settings'], 'home'));
    if (payload.updateFeedUrl !== undefined) {
      const url = optionalString(payload.updateFeedUrl, 1024) ?? '';
      if (url && !/^https?:\/\//i.test(url.trim())) {
        const error = new Error('업데이트 주소는 http:// 또는 https:// 로 시작해야 합니다.');
        error.code = 'VALIDATION';
        throw error;
      }
      settingsDb.setRaw('update.feedUrl', url.trim());
    }
    if (payload.updateAutoCheck !== undefined) settingsDb.setRaw('update.autoCheck', payload.updateAutoCheck ? '1' : '0');
    if (payload.updateSilentInstall !== undefined) settingsDb.setRaw('update.silentInstall', payload.updateSilentInstall ? '1' : '0');
    return settingsDb.publicSettings();
  });

  handle('settings:setApiKey', ({ apiKey }) => {
    const value = requireString(apiKey, 'API 키', { max: 512 });
    if (!value.startsWith('sk-or-')) {
      const error = new Error('OpenRouter 키는 보통 sk-or- 로 시작합니다. 값을 확인해 주세요.');
      error.code = 'VALIDATION';
      throw error;
    }
    const result = settingsDb.setApiKey(value);
    return { ...result, keyMask: settingsDb.keyMask(), keyUpdatedAt: settingsDb.publicSettings().keyUpdatedAt };
  });

  handle('settings:clearApiKey', () => settingsDb.clearApiKey());

  handle('settings:testKey', async () => {
    const key = settingsDb.getApiKey();
    const models = await ai.listModels(key, { force: true });
    return { modelCount: models.length };
  });

  handle('settings:favoriteModel', ({ modelId }) =>
    settingsDb.toggleFavoriteModel(requireString(modelId, '모델', { max: 200 })),
  );

  handle('collect:status', () => collect.providerStatus());

  handle('collect:downloadYtdlp', async () => {
    const result = await collect.downloadYtdlp();
    return { ...result, status: collect.providerStatus() };
  });

  handle('collect:cancel', ({ jobId }) => {
    if (jobId) collect.cancel(String(jobId));
    return true;
  });

  handle('channels:sync', async (payload) => {
    const url = requireString(payload.url, '채널 주소', { max: 2048 });
    const jobId = optionalString(payload.jobId, 64) ?? `job-${Date.now()}`;
    const result = await collect.syncChannel({
      url,
      jobId,
      limit: payload.limit,
      collectAll: payload.collectAll,
      provider: payload.provider,
      withSubtitles: payload.withSubtitles,
      refreshExisting: payload.refreshExisting,
      concurrency: payload.concurrency,
      onProgress: (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('collect:progress', { ...progress, jobId });
        }
      },
    });
    return { ...result, counts: counts() };
  });

  handle('channels:list', () => channelsDb.list());

  handle('channels:remove', ({ pk }) => {
    const removed = channelsDb.remove(requireInt(pk, '채널', { min: 1 }));
    return { removed, counts: counts() };
  });

  // 동영상 목록 조회 조건(채널 + 검색어 + 페이지)을 한 곳에서 검증한다.
  function videoQuery(payload = {}) {
    return {
      channelPk: payload.channelPk ? requireInt(payload.channelPk, '채널', { min: 1 }) : null,
      q: optionalString(payload.q, 200) ?? '',
      limit: requireInt(payload.limit ?? 100, '개수', { min: 1, max: 2000 }),
      offset: requireInt(payload.offset ?? 0, '시작 위치', { min: 0 }),
    };
  }

  handle('videos:list', (payload) => {
    return videosDb.list(videoQuery(payload));
  });

  // 목록 화면은 항목과 전체 개수를 함께 써야 하므로 페이지 단위 응답을 따로 준다.
  // (수천 편을 한 번에 넘기지 않아 렌더러가 멈추지 않는다.)
  handle('videos:page', (payload) => {
    const query = videoQuery(payload);
    const items = videosDb.list(query);
    const total = videosDb.count({ channelPk: query.channelPk, q: query.q });
    return {
      items,
      total,
      offset: query.offset,
      limit: query.limit,
      hasMore: query.offset + items.length < total,
    };
  });

  handle('videos:get', ({ videoId }) => {
    const video = videosDb.getByVideoId(requireString(videoId, '동영상', { max: 32 }));
    if (!video) {
      const error = new Error('저장된 동영상이 아닙니다.');
      error.code = 'NOT_FOUND';
      throw error;
    }
    const transcript = transcriptsDb.getByVideoId(video.videoId);
    const sentences = sentencesDb.list({ limit: 500 }).items.filter((row) => row.videoId === video.videoId);
    return { video, transcript, sentences };
  });

  handle('videos:refresh', async ({ videoId }) => {
    const id = requireString(videoId, '동영상', { max: 32 });
    return collect.refreshVideo({ videoId: id });
  });

  handle('videos:transcript', async ({ videoId, force }) => {
    const id = requireString(videoId, '동영상', { max: 32 });
    if (!force) {
      const existing = transcriptsDb.getByVideoId(id);
      if (existing) return existing;
    }
    return collect.fetchVideoTranscript({ videoId: id, jobId: `sub-${id}` });
  });

  handle('ai:models', async ({ force }) => ai.listModels(settingsDb.getApiKey(), { force: Boolean(force) }));

  handle('ai:analyze', async (payload) => {
    const sentence = requireString(payload.sentence, '문장', { max: 2000 });
    const models = settingsDb.publicSettings();
    const model = requireString(payload.model || models.model, '모델', { max: 200 });
    const result = await ai.analyzeSentence({
      apiKey: settingsDb.getApiKey(),
      model,
      sentence,
      context: optionalString(payload.context, 2000),
      videoTitle: optionalString(payload.videoTitle, 300),
    });
    settingsDb.markModelUsed(model);
    return { ...result, model, settings: settingsDb.publicSettings() };
  });

  handle('sentences:list', (payload) => {
    const result = sentencesDb.list({
      q: optionalString(payload.q, 200) ?? '',
      channelPk: payload.channelPk ? requireInt(payload.channelPk, '채널', { min: 1 }) : null,
      favoriteOnly: Boolean(payload.favoriteOnly),
      sort: oneOf(payload.sort, ['latest', 'oldest', 'sentence', 'video', 'favorite'], 'latest'),
      limit: requireInt(payload.limit ?? 200, '개수', { min: 1, max: 1000 }),
      offset: requireInt(payload.offset ?? 0, '시작 위치', { min: 0, max: 100000 }),
    });
    return result;
  });

  handle('sentences:create', (payload) => {
    const sentence = requireString(payload.sentence, '문장', { max: 2000 });
    const created = sentencesDb.create({
      sentence,
      translation: optionalString(payload.translation, 4000),
      analysis: payload.analysis ?? null,
      source: oneOf(payload.source, ['youtube', 'manual', 'ai', 'import'], 'manual'),
      startSec: payload.startSec === undefined || payload.startSec === null ? null : Number(payload.startSec),
      isFavorite: payload.isFavorite ? 1 : 0,
      videoPk: payload.videoPk ?? null,
      videoId: optionalString(payload.videoId, 32),
      videoTitle: optionalString(payload.videoTitle, 300),
      videoUrl: optionalString(payload.videoUrl, 2048),
      channelPk: payload.channelPk ?? null,
    });
    return { sentence: created, counts: counts() };
  });

  handle('sentences:update', ({ pk, patch }) => {
    const id = requireInt(pk, '문장', { min: 1 });
    const clean = {};
    if (patch?.sentence !== undefined) clean.sentence = requireString(patch.sentence, '문장', { max: 2000 });
    if (patch?.translation !== undefined) clean.translation = optionalString(patch.translation, 4000);
    if (patch?.analysis !== undefined) clean.analysis = patch.analysis;
    if (patch?.startSec !== undefined) clean.startSec = patch.startSec;
    const updated = sentencesDb.update(id, clean);
    if (!updated) {
      const error = new Error('문장을 찾지 못했습니다.');
      error.code = 'NOT_FOUND';
      throw error;
    }
    return updated;
  });

  handle('sentences:remove', ({ pk }) => {
    const removed = sentencesDb.remove(requireInt(pk, '문장', { min: 1 }));
    return { removed, counts: counts() };
  });

  handle('sentences:favorite', ({ pk }) => sentencesDb.toggleFavorite(requireInt(pk, '문장', { min: 1 })));

  handle('sentences:study', ({ pk }) => sentencesDb.incrementStudy(requireInt(pk, '문장', { min: 1 })));


  handle('share:export', async (payload) => {
    const format = oneOf(payload.format, ['json', 'md', 'html', 'csv'], 'json');
    const dataset = share.buildDataset({ scope: optionalString(payload.scope, 60) ?? 'all' });
    if (!dataset.sentences.length) {
      const error = new Error('내보낼 문장이 없습니다.');
      error.code = 'EMPTY_EXPORT';
      throw error;
    }
    const file = share.serialize(dataset, format);
    lastExport = { content: file.content, filename: file.filename };
    if (!payload.savePath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: '내보내기',
        defaultPath: path.join(app.getPath('documents'), file.filename),
        filters: [{ name: format.toUpperCase(), extensions: [format === 'md' ? 'md' : format] }],
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      fs.writeFileSync(result.filePath, file.content, 'utf8');
      return { canceled: false, path: result.filePath, counts: dataset.counts, format };
    }
    fs.mkdirSync(path.dirname(payload.savePath), { recursive: true });
    fs.writeFileSync(payload.savePath, file.content, 'utf8');
    return { canceled: false, path: payload.savePath, counts: dataset.counts, format };
  });

  handle('share:import', async (payload) => {
    let filePath = payload.filePath ? optionalString(payload.filePath, 2048) : null;
    if (!filePath) {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: '가져오기',
        properties: ['openFile'],
        filters: [{ name: 'Study TED JSON', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePaths.length) return { canceled: true };
      [filePath] = result.filePaths;
    }
    const text = fs.readFileSync(filePath, 'utf8');
    const dataset = share.parseImport(text);
    const summary = share.mergeImport(dataset);
    return { canceled: false, path: filePath, summary, counts: counts() };
  });

  handle('demo:seed', ({ force }) => {
    const summary = demo.seed({ force: Boolean(force) });
    return { ...summary, counts: counts() };
  });

  handle('demo:clear', () => {
    demo.clear();
    return { counts: counts() };
  });

  handle('update:state', () => updater.state());

  handle('update:check', ({ force }) => updater.check({ force: Boolean(force) }));

  handle('update:download', () => updater.download());

  handle('update:install', () => updater.install());
}

module.exports = { register, setWindow, counts, getLastExport: () => lastExport };
