const { contextBridge, ipcRenderer } = require('electron');

// 렌더러는 invoke/handle 채널만 사용한다. 여기 나열된 화이트리스트 외에는 접근할 수 없다.
function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload ?? {});
}

const api = {
  app: {
    info: () => invoke('app:info'),
    openExternal: (url) => invoke('app:openExternal', { url }),
  },
  update: {
    state: () => invoke('update:state'),
    check: (force) => invoke('update:check', { force: Boolean(force) }),
    download: () => invoke('update:download'),
    install: () => invoke('update:install'),
    onStatus: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('update:status', listener);
      return () => ipcRenderer.removeListener('update:status', listener);
    },
  },
  window: {
    minimize: () => invoke('window:minimize'),
    toggleMaximize: () => invoke('window:toggleMaximize'),
    close: () => invoke('window:close'),
  },
  settings: {
    get: () => invoke('settings:get'),
    update: (patch) => invoke('settings:update', patch ?? {}),
    setApiKey: (apiKey) => invoke('settings:setApiKey', { apiKey }),
    clearApiKey: () => invoke('settings:clearApiKey'),
    testKey: () => invoke('settings:testKey'),
    favoriteModel: (modelId) => invoke('settings:favoriteModel', { modelId }),
  },
  collect: {
    status: () => invoke('collect:status'),
    downloadYtdlp: () => invoke('collect:downloadYtdlp'),
    cancel: (jobId) => invoke('collect:cancel', { jobId }),
    onProgress: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('collect:progress', listener);
      return () => ipcRenderer.removeListener('collect:progress', listener);
    },
  },
  channels: {
    sync: (payload) => invoke('channels:sync', payload ?? {}),
    list: () => invoke('channels:list'),
    remove: (pk) => invoke('channels:remove', { pk }),
  },
  videos: {
    list: (payload) => invoke('videos:list', payload ?? {}),
    page: (payload) => invoke('videos:page', payload ?? {}),
    get: (videoId) => invoke('videos:get', { videoId }),
    refresh: (videoId) => invoke('videos:refresh', { videoId }),
    transcript: (videoId, force) => invoke('videos:transcript', { videoId, force: Boolean(force) }),
  },
  ai: {
    models: (force) => invoke('ai:models', { force: Boolean(force) }),
    analyze: (payload) => invoke('ai:analyze', payload ?? {}),
  },
  sentences: {
    list: (payload) => invoke('sentences:list', payload ?? {}),
    create: (payload) => invoke('sentences:create', payload ?? {}),
    update: (pk, patch) => invoke('sentences:update', { pk, patch: patch ?? {} }),
    remove: (pk) => invoke('sentences:remove', { pk }),
    favorite: (pk) => invoke('sentences:favorite', { pk }),
    study: (pk) => invoke('sentences:study', { pk }),
  },
  share: {
    export: (payload) => invoke('share:export', payload ?? {}),
    import: (payload) => invoke('share:import', payload ?? {}),
  },
  demo: {
    seed: (force) => invoke('demo:seed', { force: Boolean(force) }),
    clear: () => invoke('demo:clear'),
  },
};

contextBridge.exposeInMainWorld('studyTed', api);
