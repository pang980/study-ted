const fs = require('fs');
const path = require('path');
const manager = require('./ytdlp-manager');
const parser = require('./subtitle-parser');

const FORMAT_RANK = { json3: 0, vtt: 1, srt: 2, srv3: 3, xml: 3, text: 9 };

function parseDumpLines(stdout) {
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const entries = [];
  for (const line of lines) {
    if (!line.startsWith('{')) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // 손상된 줄은 건너뛴다.
    }
  }
  return entries;
}

function pickThumbnail(entry) {
  const list = entry.thumbnails;
  if (!Array.isArray(list) || !list.length) return entry.thumbnail ?? null;
  return list.reduce((best, item) => ((item.width ?? 0) > (best.width ?? 0) ? item : best), list[0]).url ?? null;
}

function toVideo(entry) {
  const videoId = entry.id ?? entry.video_id;
  if (!videoId) return null;
  const durationSec = Number(entry.duration);
  return {
    videoId,
    title: entry.title ?? videoId,
    url: entry.webpage_url ?? entry.url ?? `https://www.youtube.com/watch?v=${videoId}`,
    durationSec: Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec) : null,
    durationText: Number.isFinite(durationSec) && durationSec > 0 ? parser.formatTime(durationSec) : null,
    viewCountText: entry.view_count ? `${Number(entry.view_count).toLocaleString('ko-KR')}회` : null,
    publishedText: entry.upload_date ? formatDate(entry.upload_date) : null,
    thumbnailUrl: pickThumbnail(entry),
    description: entry.description ?? null,
    channelId: entry.channel_id ?? null,
    channelTitle: entry.channel ?? entry.uploader ?? null,
  };
}

function formatDate(raw) {
  const text = String(raw);
  if (!/^\d{8}$/.test(text)) return text;
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

async function listVideos(channelUrl, options = {}) {
  const { exePath, limit = 24, onProgress, signal } = options;
  // 전체 수집(limit 이 유한하지 않음)이면 --playlist-end 를 빼서 채널 전체를 받아온다.
  const bounded = Number.isFinite(limit) && limit > 0;
  const timeoutMs = options.timeoutMs ?? (bounded ? 300000 : 1800000);
  const url = channelUrl.includes('/videos') || channelUrl.includes('/shorts') || channelUrl.includes('/streams')
    ? channelUrl
    : `${channelUrl.replace(/\/$/, '')}/videos`;
  const args = ['--flat-playlist', '--dump-json', '--no-warnings', '--ignore-errors'];
  if (bounded) args.push('--playlist-end', String(limit));
  args.push(url);
  let seen = 0;
  const { stdout } = await manager.run(exePath, args, {
    timeoutMs,
    signal,
    onLine: (line) => {
      if (onProgress && line.startsWith('{')) {
        seen += 1;
        onProgress({ phase: 'list', done: seen, message: `영상 ${seen}개 확인` });
      }
    },
  });
  const entries = parseDumpLines(stdout);
  const videos = entries.map(toVideo).filter(Boolean);
  return bounded ? videos.slice(0, limit) : videos;
}

async function getVideo(videoUrl, options = {}) {
  const { exePath, timeoutMs = 120000, signal } = options;
  const args = ['--dump-single-json', '--no-warnings', '--skip-download', videoUrl];
  const { stdout } = await manager.run(exePath, args, { timeoutMs, signal });
  const trimmed = stdout.trim();
  const start = trimmed.indexOf('{');
  if (start < 0) throw new Error('yt-dlp 동영상 정보를 해석하지 못했습니다.');
  const entry = JSON.parse(trimmed.slice(start));
  const video = toVideo(entry);
  if (!video) throw new Error('yt-dlp 동영상 정보가 비어 있습니다.');
  return {
    ...video,
    subtitles: entry.subtitles ?? {},
    automaticCaptions: entry.automatic_captions ?? {},
    channelId: entry.channel_id ?? null,
  };
}

function cleanupFiles(files) {
  for (const file of files) {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      // 임시 파일 정리 실패는 무시한다.
    }
  }
}

function pickSubtitleFile(files, videoId) {
  const scored = files
    .filter((file) => file.startsWith(`${videoId}.`))
    .map((file) => {
      const parts = file.split('.');
      const ext = parts[parts.length - 1].toLowerCase();
      const lang = parts.slice(1, parts.length - 1).join('.');
      const isEnglish = /^en/i.test(lang);
      return { file, ext, lang, score: (isEnglish ? 0 : 100) + (FORMAT_RANK[ext] ?? 50) };
    })
    .sort((a, b) => a.score - b.score);
  return scored[0] ?? null;
}

// 자막 언어는 좁게 잡는다. 'en.*' 같은 정규식은 en-fr·en-hu 같은 자동 번역 트랙까지 함께 받아
// 영상 한 편에 파일 2~3개를 내려받는다. 'en' 만 지정하면 1개만 받는다(실측).
// 다만 'en' 트랙이 없는 영상이 있으므로 파일이 하나도 안 생기면 넓은 패턴으로 한 번만 다시 시도한다.
const LANG_ATTEMPTS = ['en', 'en.*,en'];

async function downloadSubtitleFiles(videoUrl, options) {
  const { exePath, outDir, langs, timeoutMs, signal, onProgress } = options;
  fs.mkdirSync(outDir, { recursive: true });
  const before = new Set(fs.readdirSync(outDir));
  const args = [
    '--skip-download',
    '--write-subs',
    '--write-auto-subs',
    '--sub-langs', langs,
    '--sub-format', 'json3/vtt/srt/best',
    '--no-warnings',
    '--ignore-errors',
    '-o', path.join(outDir, '%(id)s.%(ext)s'),
    videoUrl,
  ];
  await manager.run(exePath, args, {
    timeoutMs,
    signal,
    onLine: (line) => {
      if (/WARNING|ERROR/i.test(line)) return;
      if (onProgress) onProgress({ phase: 'subtitle', message: '자막을 내려받는 중입니다.' });
    },
  });
  return fs.readdirSync(outDir).filter((file) => !before.has(file));
}

async function fetchSubtitles(videoUrl, options = {}) {
  const { exePath, outDir, timeoutMs = 180000, signal, onProgress } = options;
  const attempts = options.langs ? [options.langs] : LANG_ATTEMPTS;
  let created = [];
  for (const langs of attempts) {
    created = await downloadSubtitleFiles(videoUrl, { exePath, outDir, langs, timeoutMs, signal, onProgress });
    if (created.length) break;
  }
  if (!created.length) throw new Error('yt-dlp 가 자막 파일을 만들지 못했습니다. 자막이 없는 동영상일 수 있습니다.');
  const videoId = created[0].split('.')[0];
  const picked = pickSubtitleFile(created, videoId);
  if (!picked) throw new Error('사용할 수 있는 자막 파일을 찾지 못했습니다.');
  const raw = fs.readFileSync(path.join(outDir, picked.file), 'utf8');
  const segments = parser.parse(raw, 'auto').filter((segment) => segment.text);
  cleanupFiles(created.map((file) => path.join(outDir, file)));
  if (!segments.length) throw new Error('자막 본문이 비어 있습니다.');
  return {
    lang: picked.lang || null,
    kind: /asr/i.test(picked.lang) ? 'asr' : null,
    source: 'yt-dlp',
    segments,
    plainText: parser.toPlainText(segments),
  };
}

module.exports = { listVideos, getVideo, fetchSubtitles, parseDumpLines, toVideo };
