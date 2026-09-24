const bridge = globalThis.studyTed;

export const hasBridge = Boolean(bridge);

function unwrap(result) {
  if (!result || typeof result !== 'object' || !('ok' in result)) return result;
  if (result.ok) return result.data;
  const error = new Error(result.error?.message ?? '요청을 처리하지 못했습니다.');
  error.code = result.error?.code ?? 'UNEXPECTED';
  error.detail = result.error?.detail ?? null;
  throw error;
}

async function call(method, ...args) {
  if (typeof method !== 'function') {
    const error = new Error('앱 브리지를 사용할 수 없습니다. Electron 으로 실행해 주세요.');
    error.code = 'NO_BRIDGE';
    throw error;
  }
  return unwrap(await method(...args));
}

export const api = {
  app: {
    info: () => call(bridge?.app.info),
    openExternal: (url) => call(bridge?.app.openExternal, url),
  },
  update: {
    state: () => call(bridge?.update.state),
    check: (force) => call(bridge?.update.check, force),
    download: () => call(bridge?.update.download),
    install: () => call(bridge?.update.install),
    onStatus: (callback) => (bridge ? bridge.update.onStatus(callback) : () => {}),
  },
  window: {
    minimize: () => call(bridge?.window.minimize),
    toggleMaximize: () => call(bridge?.window.toggleMaximize),
    close: () => call(bridge?.window.close),
  },
  settings: {
    get: () => call(bridge?.settings.get),
    update: (patch) => call(bridge?.settings.update, patch),
    setApiKey: (apiKey) => call(bridge?.settings.setApiKey, apiKey),
    clearApiKey: () => call(bridge?.settings.clearApiKey),
    testKey: () => call(bridge?.settings.testKey),
    favoriteModel: (modelId) => call(bridge?.settings.favoriteModel, modelId),
  },
  collect: {
    status: () => call(bridge?.collect.status),
    downloadYtdlp: () => call(bridge?.collect.downloadYtdlp),
    cancel: (jobId) => call(bridge?.collect.cancel, jobId),
    onProgress: (callback) => (bridge ? bridge.collect.onProgress(callback) : () => {}),
  },
  channels: {
    sync: (payload) => call(bridge?.channels.sync, payload),
    list: () => call(bridge?.channels.list),
    remove: (pk) => call(bridge?.channels.remove, pk),
  },
  videos: {
    list: (payload) => call(bridge?.videos.list, payload),
    page: (payload) => call(bridge?.videos.page, payload),
    get: (videoId) => call(bridge?.videos.get, videoId),
    refresh: (videoId) => call(bridge?.videos.refresh, videoId),
    transcript: (videoId, force) => call(bridge?.videos.transcript, videoId, force),
  },
  ai: {
    models: (force) => call(bridge?.ai.models, force),
    analyze: (payload) => call(bridge?.ai.analyze, payload),
  },
  sentences: {
    list: (payload) => call(bridge?.sentences.list, payload),
    create: (payload) => call(bridge?.sentences.create, payload),
    update: (pk, patch) => call(bridge?.sentences.update, pk, patch),
    remove: (pk) => call(bridge?.sentences.remove, pk),
    favorite: (pk) => call(bridge?.sentences.favorite, pk),
    study: (pk) => call(bridge?.sentences.study, pk),
  },
  share: {
    export: (payload) => call(bridge?.share.export, payload),
    import: (payload) => call(bridge?.share.import, payload),
  },
  demo: {
    seed: (force) => call(bridge?.demo.seed, force),
    clear: () => call(bridge?.demo.clear),
  },
};

export function errorMessage(error) {
  if (!error) return '알 수 없는 오류가 발생했습니다.';
  if (error.code === 'NO_BRIDGE') return error.message;
  return error.message || '알 수 없는 오류가 발생했습니다.';
}
