const fs = require('fs');
const path = require('path');
const paths = require('../paths');
const logger = require('../logger');
const channelsDb = require('../db/channels');
const videosDb = require('../db/videos');
const transcriptsDb = require('../db/transcripts');
const settingsDb = require('../db/settings');
const native = require('./native-provider');
const ytdlpManager = require('./ytdlp-manager');
const ytdlp = require('./ytdlp-provider');
const jobs = require('./job-registry');

// 취소는 jobId 단위로 job-registry 가 관리한다(즉시 중단 + 루프 경계 확인).
const { cancel, isCancelled, assertNotCancelled } = jobs;

function makeError(code, message, detail) {
  const error = new Error(message);
  error.code = code;
  if (detail) error.detail = detail;
  return error;
}

function detectYtdlp() {
  return ytdlpManager.detect({
    configuredPath: settingsDb.getValue('collect.ytdlpPath', ''),
    binDir: paths.binDir(),
    rootDir: paths.rootDir,
  });
}

function resolveProvider(requested) {
  const preference = requested ?? settingsDb.getValue('collect.provider', 'auto');
  const detection = detectYtdlp();
  if (preference === 'ytdlp' && !detection.available) {
    throw makeError('YTDLP_MISSING', 'yt-dlp 를 찾을 수 없습니다. 설정에서 경로를 지정하거나 다운로드해 주세요.');
  }
  const provider = preference === 'auto' ? (detection.available ? 'ytdlp' : 'native') : preference;
  return { provider, preference, ytdlp: detection };
}

function providerStatus() {
  const preference = settingsDb.getValue('collect.provider', 'auto');
  const detection = detectYtdlp();
  return {
    preference,
    active: preference === 'auto' ? (detection.available ? 'ytdlp' : 'native') : preference,
    ytdlp: detection,
  };
}

function jobDir(jobId) {
  return path.join(paths.tmpDir(), `collect-${jobId || 'job'}`);
}

function clearJobDir(jobId) {
  const dir = jobDir(jobId);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    logger.warn('collect', '임시 폴더 정리를 건너뜁니다.', dir);
  }
}

function emit(onProgress, payload) {
  if (onProgress) onProgress(payload);
}

// 자막 파일은 영상마다 따로 받는다. 여러 편을 동시에 받을 때 서로의 파일을 지우거나
// 남의 자막을 집어오지 않도록 임시 폴더를 영상 단위로 나눈다.
function videoDir(jobId, videoId) {
  return path.join(jobDir(jobId), String(videoId ?? 'video').replace(/[^A-Za-z0-9_-]/g, '_'));
}

function clearVideoDir(jobId, videoId) {
  const dir = videoDir(jobId, videoId);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    logger.warn('collect', '자막 임시 폴더 정리를 건너뜁니다.', dir);
  }
}

async function fetchTranscriptFor(video, options) {
  const { provider, jobId, onProgress, timeoutMs, signal } = options;
  assertNotCancelled(jobId);
  if (provider === 'ytdlp') {
    try {
      return await ytdlp.fetchSubtitles(video.url, {
        exePath: options.exePath,
        outDir: videoDir(jobId, video.videoId),
        timeoutMs: timeoutMs ?? 150000,
        signal,
        onProgress,
      });
    } finally {
      clearVideoDir(jobId, video.videoId);
    }
  }
  return native.getTranscript(video.videoId, { signal });
}

// 동시에 받을 자막 개수. 네트워크 대기가 대부분이라 여러 편을 겹쳐 받아야 전체 시간이 줄어든다.
const DEFAULT_SUBTITLE_CONCURRENCY = 4;

function resolveConcurrency(raw) {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_SUBTITLE_CONCURRENCY;
  return Math.min(8, Math.max(1, Math.floor(num)));
}

// '전체' 수집은 Infinity 로 표현한다. 미지정/null/''/0/'all' 은 모두 전체로 해석한다.
function resolveLimit(raw) {
  if (raw === null || raw === undefined || raw === '' || raw === 'all') return Infinity;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return Infinity;
  return Math.max(1, Math.floor(num));
}

// 자막은 한 편에 8~11초가 걸리는 네트워크 작업이라 순서대로 받으면 채널 하나에 몇 시간이 걸린다.
// 영상마다 프로세스를 따로 띄우되 N개를 동시에 돌려 대기 시간을 겹친다.
// 정지 신호는 워커가 모두 공유하므로 정지하면 진행 중인 편들이 한꺼번에 끊긴다.
async function collectSubtitles(context) {
  const { savedVideos, jobId, signal, provider, exePath, onProgress, partial, failures } = context;
  const total = savedVideos.length;
  // 이미 자막이 있는 영상은 다시 받지 않는다(두 번째 수집부터는 신규 영상만 받는다).
  const pending = savedVideos.filter((video) => !transcriptsDb.getByVideoId(video.videoId));
  if (!pending.length) return;

  const configured = context.concurrency ?? settingsDb.getValue('collect.concurrency', String(DEFAULT_SUBTITLE_CONCURRENCY));
  const concurrency = Math.min(resolveConcurrency(configured), pending.length);
  let done = total - pending.length;
  let cursor = 0;
  let cancelled = null;

  emit(onProgress, {
    jobId,
    phase: 'subtitle',
    done,
    total,
    message: `자막 수집을 시작합니다. (동시 ${concurrency}개 · 남은 ${pending.length}개)`,
  });

  async function worker() {
    for (;;) {
      if (cancelled) return;
      try {
        assertNotCancelled(jobId);
      } catch (error) {
        cancelled = error;
        return;
      }
      const video = pending[cursor];
      cursor += 1;
      if (!video) return;
      try {
        const transcript = await fetchTranscriptFor(video, {
          provider,
          jobId,
          signal,
          exePath,
          onProgress: (payload) => emit(onProgress, { jobId, ...payload, done, total }),
        });
        transcriptsDb.upsert({
          videoId: video.videoId,
          videoPk: video.pk,
          lang: transcript.lang,
          kind: transcript.kind,
          source: transcript.source,
          segments: transcript.segments,
          plainText: transcript.plainText,
        });
        videosDb.setHasTranscript(video.videoId, true);
        partial.transcriptCount += 1;
      } catch (error) {
        if (error.code === 'CANCELLED') {
          cancelled = error;
          return;
        }
        failures.push({ videoId: video.videoId, title: video.title, message: error.message, code: error.code ?? 'TRANSCRIPT_FAILED' });
        logger.warn('collect', `자막 수집 실패: ${video.videoId}`, error.message);
      }
      done += 1;
      emit(onProgress, {
        jobId,
        phase: 'subtitle',
        done,
        total,
        message: `자막 수집 중 (${done}/${total}) · 남은 ${total - done}개 · ${video.title}`,
      });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  if (cancelled) throw cancelled;
}

// 수집 작업 하나를 감싸 취소 신호를 만들고, 취소되면 어디까지 저장했는지와 함께 알린다.
async function syncChannel(options) {
  const { jobId, onProgress } = options;
  const controller = jobs.begin(jobId);
  const signal = controller ? controller.signal : null;
  const partial = { videoCount: 0, addedCount: 0, keptCount: 0, transcriptCount: 0, cancelled: false };
  try {
    return await runSyncChannel(options, partial, signal);
  } catch (error) {
    if (error.code === 'CANCELLED') {
      partial.cancelled = true;
      // 이미 저장된 동영상과 자막은 그대로 남기고, 중단 시점의 개수를 알려준다.
      emit(onProgress, {
        jobId,
        phase: 'cancelled',
        done: partial.transcriptCount,
        total: partial.videoCount,
        message: `수집을 중단했습니다. · 신규 ${partial.addedCount}개 · 자막 ${partial.transcriptCount}개`,
      });
      error.detail = { ...(error.detail ?? {}), ...partial };
    }
    throw error;
  } finally {
    jobs.end(jobId);
  }
}

async function runSyncChannel(options, partial, signal) {
  const { url, jobId, onProgress } = options;
  // 설정에서 '전체 수집'(collect.collectAll) 을 켜면 개수 제한 없이 채널 전체를 가져온다.
  const collectAll = options.collectAll ?? settingsDb.getValue('collect.collectAll', '1') === '1';
  const limit = options.limit === undefined
    ? (collectAll ? Infinity : resolveLimit(settingsDb.getValue('collect.limit', '24')))
    : resolveLimit(options.limit);
  const limitTotal = Number.isFinite(limit) ? limit : 0;
  const withSubtitles = options.withSubtitles ?? settingsDb.getValue('collect.withSubtitles', '1') === '1';
  // 이미 저장된 동영상의 메타데이터를 다시 받을지 여부. 끄면 신규 영상만 저장한다.
  const refreshExisting = options.refreshExisting ?? settingsDb.getValue('collect.refreshExisting', '1') !== '0';
  const { provider, ytdlp: ytdlpInfo } = resolveProvider(options.provider);

  emit(onProgress, { jobId, phase: 'channel', done: 0, total: 1, message: '채널 정보를 확인하는 중입니다.' });
  const channelInfo = await native.resolveChannel(url, { signal });
  assertNotCancelled(jobId);
  const channelRow = channelsDb.upsert(channelInfo);

  emit(onProgress, {
    jobId,
    phase: 'list',
    done: 0,
    total: limitTotal,
    message: limitTotal > 0 ? '영상 목록을 가져오는 중입니다.' : '채널의 모든 영상을 가져오는 중입니다.',
  });
  let entries = [];
  let listWarning = null;
  if (provider === 'ytdlp') {
    try {
      entries = await ytdlp.listVideos(channelRow.url, {
        exePath: ytdlpInfo.path,
        limit,
        signal,
        onProgress: (payload) => emit(onProgress, { jobId, ...payload, total: Number(payload.total) || limitTotal }),
      });
    } catch (error) {
      // 취소는 폴백 대상이 아니다. 그대로 중단한다.
      if (error.code === 'CANCELLED') throw error;
      listWarning = `yt-dlp 목록 수집 실패(${error.message}) → 기본 방식으로 재시도했습니다.`;
      logger.warn('collect', 'yt-dlp 목록 실패', error.message);
      entries = await native.listVideos(channelRow.channelId, { limit, signal });
    }
  } else {
    entries = await native.listVideos(channelRow.channelId, { limit, signal });
  }
  assertNotCancelled(jobId);
  if (!entries.length) throw makeError('NO_VIDEOS', '채널에서 동영상을 찾지 못했습니다.');

  const savedVideos = [];
  for (let i = 0; i < entries.length; i += 1) {
    assertNotCancelled(jobId);
    // 대용량 채널은 목록 저장 자체도 오래 걸리므로 50개마다 진행 상황을 알린다.
    if (entries.length > 100 && i > 0 && i % 50 === 0) {
      emit(onProgress, {
        jobId,
        phase: 'videos',
        done: i,
        total: entries.length,
        message: `동영상 목록 저장 중 (${i}/${entries.length})`,
      });
    }
    const entry = entries[i];
    const existed = refreshExisting ? false : Boolean(videosDb.getByVideoId(entry.videoId));
    const row = videosDb.upsert(
      {
        ...entry,
        title: entry.title ?? entry.videoId,
        url: entry.url ?? `https://www.youtube.com/watch?v=${entry.videoId}`,
        channelPk: channelRow.pk,
        channelId: entry.channelId ?? channelRow.channelId,
      },
      { refresh: refreshExisting },
    );
    if (row) savedVideos.push(row);
    if (existed) partial.keptCount += 1;
    else partial.addedCount += 1;
  }
  partial.videoCount = savedVideos.length;

  const failures = [];
  if (withSubtitles) {
    await collectSubtitles({
      savedVideos,
      jobId,
      signal,
      provider,
      exePath: ytdlpInfo.path ?? undefined,
      onProgress,
      partial,
      failures,
      concurrency: options.concurrency,
    });
  }

  const synced = channelsDb.touchSync(channelRow.pk);
  clearJobDir(jobId);
  const keptNote = partial.keptCount > 0 ? ` · 기존 ${partial.keptCount}개 정보 유지` : '';
  // 자막을 못 받은 편이 있으면 개수를 결과 문장에 남긴다(화면에서 바로 보이도록).
  const failNote = failures.length ? ` · 자막 실패 ${failures.length}개` : '';
  emit(onProgress, {
    jobId,
    phase: 'done',
    done: savedVideos.length,
    total: savedVideos.length,
    message: `동영상 ${savedVideos.length}개(신규 ${partial.addedCount}개)${keptNote} · 자막 ${partial.transcriptCount}개 저장${failNote}`,
  });
  return {
    provider,
    listWarning,
    channel: synced,
    videoCount: savedVideos.length,
    addedCount: partial.addedCount,
    keptCount: partial.keptCount,
    refreshExisting,
    transcriptCount: partial.transcriptCount,
    failures,
  };
}

async function refreshVideo(options) {
  const { videoId } = options;
  const { provider } = resolveProvider(options.provider);
  const ytdlpDetection = options.provider === 'ytdlp' || provider === 'ytdlp' ? detectYtdlp() : null;
  const existing = videosDb.getByVideoId(videoId);
  let info;
  if (provider === 'ytdlp' && ytdlpDetection?.available) {
    info = await ytdlp.getVideo(options.url ?? `https://www.youtube.com/watch?v=${videoId}`, { exePath: ytdlpDetection.path });
  } else {
    info = await native.getVideo(videoId);
  }
  const row = videosDb.upsert({
    ...info,
    channelPk: existing?.channelPk ?? null,
    channelId: info.channelId ?? existing?.channelId ?? null,
  });
  return { video: row, provider };
}

async function fetchVideoTranscript(options) {
  const { videoId } = options;
  const existing = videosDb.getByVideoId(videoId);
  const { provider } = resolveProvider(options.provider);
  const detection = detectYtdlp();
  const target = existing ?? { videoId, url: `https://www.youtube.com/watch?v=${videoId}`, pk: null };
  const transcript = await fetchTranscriptFor(target, {
    provider,
    jobId: options.jobId,
    exePath: detection.path ?? undefined,
    timeoutMs: options.timeoutMs,
  });
  transcriptsDb.upsert({
    videoId,
    videoPk: target.pk ?? existing?.pk ?? null,
    lang: transcript.lang,
    kind: transcript.kind,
    source: transcript.source,
    segments: transcript.segments,
    plainText: transcript.plainText,
  });
  videosDb.setHasTranscript(videoId, true);
  return transcriptsDb.getByVideoId(videoId);
}

async function downloadYtdlp() {
  const result = await ytdlpManager.download(paths.binDir());
  settingsDb.setRaw('collect.ytdlpPath', result.path, false);
  return { ...result, source: '앱 데이터' };
}

module.exports = {
  syncChannel, refreshVideo, fetchVideoTranscript, providerStatus, downloadYtdlp,
  detectYtdlp, resolveProvider, resolveLimit, resolveConcurrency, cancel, isCancelled,
};
