const db = require('./index');

// 배포된 GitHub 릴리스에 함께 올리는 업데이트 정보(latest.json) 주소.
// 설정 화면에서 다른 주소를 넣으면 그 주소를 사용한다.
const DEFAULT_UPDATE_FEED_URL =
  'https://github.com/pang980/study-ted/releases/latest/download/latest.json';

const DEFAULTS = {
  'collect.provider': 'auto',
  'collect.ytdlpPath': '',
  'collect.limit': '24',
  'collect.collectAll': '1',
  'collect.withSubtitles': '1',
  'collect.refreshExisting': '1',
  'collect.concurrency': '4',
  'ai.model': '',
  'ai.recentModels': '[]',
  'ai.favoriteModels': '[]',
  'ai.usage': '{}',
  'ui.lastView': 'home',
  'update.feedUrl': DEFAULT_UPDATE_FEED_URL,
  'update.autoCheck': '1',
  'update.silentInstall': '1',
  'update.lastCheckAt': '',
};

function getRaw(key) {
  const row = db.get('SELECT value, is_secret AS isSecret, updated_at AS updatedAt FROM settings WHERE key = ?', [key]);
  if (row) return row;
  if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
    return { value: DEFAULTS[key], isSecret: 0, updatedAt: null };
  }
  return null;
}

function setRaw(key, value, isSecret = false) {
  db.run(
    `INSERT INTO settings (key, value, is_secret, updated_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, is_secret = excluded.is_secret, updated_at = datetime('now')`,
    [key, value, isSecret ? 1 : 0],
  );
  return getRaw(key);
}

function getJson(key, fallback) {
  const row = getRaw(key);
  if (!row || row.value === null || row.value === '') return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

function setJson(key, value) {
  setRaw(key, JSON.stringify(value), false);
  return value;
}

function getValue(key, fallback = '') {
  const row = getRaw(key);
  return row && row.value !== null ? row.value : fallback;
}

function encryptionAvailable() {
  try {
    return require('electron').safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function getApiKey() {
  const row = db.get(`SELECT value, is_secret AS isSecret FROM settings WHERE key = 'ai.apiKey'`);
  if (!row || !row.value) return '';
  if (!row.isSecret) return row.value;
  try {
    const { safeStorage } = require('electron');
    return safeStorage.decryptString(Buffer.from(row.value, 'base64'));
  } catch {
    return '';
  }
}

function setApiKey(key) {
  const available = encryptionAvailable();
  const stored = available
    ? require('electron').safeStorage.encryptString(key).toString('base64')
    : key;
  setRaw('ai.apiKey', stored, available);
  return { hasKey: Boolean(key), encryptionAvailable: available };
}

function clearApiKey() {
  db.run(`DELETE FROM settings WHERE key = 'ai.apiKey'`);
  return { hasKey: false };
}

function keyMask() {
  const key = getApiKey();
  if (!key) return '';
  if (key.length <= 10) return `${key.slice(0, 2)}${'*'.repeat(Math.max(key.length - 2, 0))}`;
  return `${key.slice(0, 7)}${'*'.repeat(6)}${key.slice(-4)}`;
}

function keyUpdatedAt() {
  const row = db.get(`SELECT updated_at AS updatedAt FROM settings WHERE key = 'ai.apiKey'`);
  return row ? row.updatedAt : null;
}

function publicSettings() {
  const recent = getJson('ai.recentModels', []);
  const favorite = getJson('ai.favoriteModels', []);
  return {
    provider: getValue('collect.provider', 'auto'),
    ytdlpPath: getValue('collect.ytdlpPath', ''),
    collectLimit: Number(getValue('collect.limit', '24')) || 24,
    collectAll: getValue('collect.collectAll', '1') === '1',
    withSubtitles: getValue('collect.withSubtitles', '1') === '1',
    refreshExisting: getValue('collect.refreshExisting', '1') === '1',
    concurrency: Number(getValue('collect.concurrency', '4')) || 4,
    model: getValue('ai.model', ''),
    recentModels: Array.isArray(recent) ? recent : [],
    favoriteModels: Array.isArray(favorite) ? favorite : [],
    usage: getJson('ai.usage', {}),
    hasKey: Boolean(getApiKey()),
    keyMask: keyMask(),
    keyUpdatedAt: keyUpdatedAt(),
    encryptionAvailable: encryptionAvailable(),
    lastView: getValue('ui.lastView', 'home'),
    update: {
      feedUrl: getValue('update.feedUrl', ''),
      autoCheck: getValue('update.autoCheck', '1') === '1',
      silentInstall: getValue('update.silentInstall', '1') === '1',
      lastCheckAt: getValue('update.lastCheckAt', '') || null,
    },
  };
}

function markModelUsed(modelId) {
  if (!modelId) return [];
  const recent = getJson('ai.recentModels', []).filter((m) => m !== modelId);
  recent.unshift(modelId);
  const trimmed = recent.slice(0, 8);
  setJson('ai.recentModels', trimmed);
  const usage = getJson('ai.usage', {});
  usage[modelId] = (usage[modelId] ?? 0) + 1;
  setJson('ai.usage', usage);
  return trimmed;
}

function toggleFavoriteModel(modelId) {
  const favorite = getJson('ai.favoriteModels', []);
  const index = favorite.indexOf(modelId);
  if (index >= 0) favorite.splice(index, 1);
  else favorite.unshift(modelId);
  setJson('ai.favoriteModels', favorite);
  return favorite;
}

function mostUsedModels(limit = 5) {
  const usage = getJson('ai.usage', {});
  return Object.entries(usage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, used]) => ({ id, used }));
}

module.exports = {
  DEFAULTS, getRaw, setRaw, getJson, setJson, getValue,
  getApiKey, setApiKey, clearApiKey, keyMask, publicSettings,
  markModelUsed, toggleFavoriteModel, mostUsedModels,
};
