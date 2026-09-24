const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

// 자막 단계는 네트워크와 DB 를 함께 쓴다. 여기서는 오케스트레이션(동시성·취소·건너뛰기)만
// 확인하면 되므로 provider·DB 모듈을 미리 가짜로 꽂고 main/collect 를 불러온다.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'study-ted-subs-'));

function stub(request, exports) {
  const resolved = require.resolve(request);
  const fake = new Module(resolved, null);
  fake.filename = resolved;
  fake.loaded = true;
  fake.exports = exports;
  require.cache[resolved] = fake;
  return exports;
}

const state = {
  concurrency: '4',
  videos: [],
  existing: new Set(),
  saved: [],
  fetchDelayMs: 40,
  fetchCalls: [],
  detectAvailable: false,
};

stub('../main/paths', {
  rootDir: tmpRoot,
  binDir: () => path.join(tmpRoot, 'bin'),
  tmpDir: () => path.join(tmpRoot, 'tmp'),
  dbPath: () => path.join(tmpRoot, 'test.db'),
});
stub('../main/logger', { warn() {}, info() {}, error() {} });
stub('../main/db/channels', {
  upsert: () => ({ pk: 1, channelId: 'ch1', url: 'https://example.com/@ch', title: '테스트 채널' }),
  touchSync: () => ({ pk: 1, title: '테스트 채널' }),
});
stub('../main/db/videos', {
  upsert: (entry) => ({ pk: entry.videoId, videoId: entry.videoId, title: entry.title, url: entry.url }),
  setHasTranscript() {},
  getByVideoId: () => null,
});
stub('../main/db/transcripts', {
  getByVideoId: (videoId) => (state.existing.has(videoId) ? { videoId, segments: [] } : null),
  upsert: (row) => state.saved.push(row),
});
stub('../main/db/settings', { getValue: (key, fallback) => (key === 'collect.concurrency' ? state.concurrency : fallback) });
stub('../main/collect/ytdlp-manager', {
  detect: () => ({ available: state.detectAvailable, path: state.detectAvailable ? 'yt-dlp' : null, source: 'test' }),
  run: async () => ({ stdout: '' }),
});
stub('../main/collect/ytdlp-provider', {
  listVideos: async () => state.videos,
  fetchSubtitles: async () => {
    throw new Error('yt-dlp 경로는 이 테스트에서 쓰지 않습니다.');
  },
});
stub('../main/collect/native-provider', {
  resolveChannel: async () => ({ channelId: 'ch1', url: 'https://example.com/@ch', title: '테스트 채널' }),
  listVideos: async () => state.videos.map((video) => ({ ...video })),
  getTranscript: async (videoId, options = {}) => {
    state.fetchCalls.push({ videoId, at: Date.now() });
    const signal = options.signal;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, state.fetchDelayMs);
      if (!signal) return;
      const onAbort = () => {
        clearTimeout(timer);
        const error = new Error('사용자가 수집을 취소했습니다.');
        error.code = 'CANCELLED';
        reject(error);
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    });
    return { lang: 'en', kind: null, source: 'test', segments: [{ start: 0, end: 1, text: 'hi' }], plainText: 'hi' };
  },
});

const collect = require('../main/collect');

function reset(overrides = {}) {
  state.concurrency = '4';
  state.existing = new Set();
  state.saved = [];
  state.fetchCalls = [];
  state.fetchDelayMs = 40;
  state.detectAvailable = false;
  state.videos = Array.from({ length: 8 }, (unused, index) => ({
    videoId: `vid${index}`,
    title: `영상 ${index}`,
    url: `https://www.youtube.com/watch?v=vid${index}`,
  }));
  Object.assign(state, overrides);
}

function sync(jobId, options = {}) {
  return collect.syncChannel({
    url: 'https://example.com/@ch',
    jobId,
    limit: state.videos.length,
    provider: 'native',
    withSubtitles: true,
    onProgress() {},
    ...options,
  });
}

test('동시 수집 개수는 1~8 사이로 제한한다', () => {
  assert.equal(collect.resolveConcurrency(undefined), 4);
  assert.equal(collect.resolveConcurrency('0'), 4);
  assert.equal(collect.resolveConcurrency('abc'), 4);
  assert.equal(collect.resolveConcurrency(3), 3);
  assert.equal(collect.resolveConcurrency(99), 8);
});

test('자막을 순서대로 받지 않고 동시에 받는다', async () => {
  reset({ concurrency: '4', fetchDelayMs: 60 });
  const started = Date.now();
  const result = await sync('job-parallel');
  const elapsed = Date.now() - started;

  assert.equal(result.transcriptCount, 8);
  // 순차 실행이면 8 * 60ms = 480ms 이상 걸린다. 동시 4개면 두 묶음이면 끝난다.
  assert.ok(elapsed < 360, `동시 수집이어야 합니다(실측 ${elapsed}ms)`);
  assert.equal(state.saved.length, 8);
});

test('동시 수집 개수를 1로 두면 순서대로 받는다', async () => {
  reset({ concurrency: '1', fetchDelayMs: 30 });
  const result = await sync('job-serial');
  assert.equal(result.transcriptCount, 8);
  assert.equal(state.saved.length, 8);
});

test('이미 자막이 있는 영상은 다시 받지 않는다', async () => {
  reset();
  state.existing = new Set(['vid0', 'vid1', 'vid2', 'vid3']);
  const result = await sync('job-skip');
  assert.equal(state.fetchCalls.length, 4);
  assert.equal(result.transcriptCount, 4);
  assert.deepEqual(state.fetchCalls.map((call) => call.videoId).sort(), ['vid4', 'vid5', 'vid6', 'vid7']);
});

test('동시에 받는 중에도 정지는 즉시 먹고, 이미 받은 자막은 남는다', async () => {
  reset({ concurrency: '4', fetchDelayMs: 5000 });
  const jobId = 'job-cancel-parallel';
  const started = Date.now();
  const pending = sync(jobId);
  setTimeout(() => collect.cancel(jobId), 150);
  await assert.rejects(() => pending, (error) => error.code === 'CANCELLED');
  const elapsed = Date.now() - started;

  // 진행 중이던 4개가 한꺼번에 끊겨야 한다(한 편을 기다리지 않는다).
  assert.ok(elapsed < 2000, `정지는 즉시 끝나야 합니다(실측 ${elapsed}ms)`);
  assert.equal(state.fetchCalls.length, 4, '동시 4개까지만 시작한다');
});