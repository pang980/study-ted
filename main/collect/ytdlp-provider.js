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
  const args = [...playerClientArgs(options.playerClients), '--flat-playlist', '--dump-json', '--no-warnings', '--ignore-errors'];
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
  // 단일 동영상 조회도 같은 클라이언트 순서를 쓴다(메타데이터 갱신이 같은 이유로 실패한다).
  const args = [...playerClientArgs(options.playerClients), IGNORE_NO_FORMATS, '--dump-single-json', '--no-warnings', '--skip-download', videoUrl];
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

// yt-dlp 는 플레이어 클라이언트를 골라 영상 정보를 받아온다. 이 버전의 기본 클라이언트(visionos)는
// 일부 채널의 영상을 "This video is not available" 로 거절하는데, 같은 영상도 android 로는 정상
// 조회되고 자막도 받아진다(실측: @BlueyOfficialChannel). 그래서 기본 → android 순으로 넘어가게 하고,
// 그래도 파일이 안 생기면 android/ios 조합으로 한 번 더 시도한다.
const DEFAULT_PLAYER_CLIENTS = 'default,android';
const PLAYER_CLIENT_ATTEMPTS = [DEFAULT_PLAYER_CLIENTS, 'android,ios'];

// 자막만 받을 때도 yt-dlp 는 재생 포맷을 고른다. 클라이언트에 따라 포맷이 없어
// "Requested format is not available" 로 죽는데, 자막은 포맷과 무관하므로 이 오류는 무시하게 한다.
// (실측: ios/web/mweb/tv 가 이 플래그 하나로 exit 0 이 되고 ios 는 자막도 받아진다.)
const IGNORE_NO_FORMATS = '--ignore-no-formats-error';

function playerClientArgs(playerClients = DEFAULT_PLAYER_CLIENTS) {
  if (!playerClients) return [];
  return ['--extractor-args', `youtube:player_client=${playerClients}`];
}

// 자막이 아예 없는 영상은 클라이언트를 바꿔도 결과가 같다. 이 안내가 나오면 재시도를 멈춘다.
function isMissingSubtitleNotice(line) {
  return /no subtitles for the requested languages|there are no subtitles|subtitles are not available/i.test(String(line));
}

// yt-dlp 는 실패 이유를 "ERROR: [youtube] id: ..." 형태로 내보낸다. 사용자에게 보여 줄 문장만 남긴다.
function reasonFrom(line) {
  return String(line)
    .replace(/^yt-dlp\s+(?:종료 코드 \d+|시간 초과 \([^)]*\)|실행 실패):\s*/i, '')
    .replace(/^\[(?:info|warning|error)\]\s*/i, '')
    .replace(/^(?:ERROR|WARNING):\s*/i, '')
    .replace(/^\[youtube\]\s*[A-Za-z0-9_-]{6,}:\s*/i, '')
    .replace(/^\[youtube\]\s*/i, '')
    .trim();
}

// yt-dlp 문구를 사용자가 바로 이해할 수 있는 한국어로 바꾼다. 모르는 문구는 그대로 둔다.
const REASON_HINTS = [
  [/this video is not available|video unavailable|has been removed|private video|members-only/i,
    'YouTube 가 이 동영상을 제공하지 않습니다(비공개·삭제·지역 제한 등).'],
  [/sign in to confirm|not a bot/i,
    'YouTube 가 자동 요청을 차단했습니다. 잠시 후 다시 시도해 주세요.'],
  [/requested format is not available|only images are available/i,
    '이 동영상은 자막만 따로 받을 수 없습니다.'],
  [/no supported javascript runtime|js runtime|nsig/i,
    'yt-dlp 실행 환경(JS 런타임) 문제로 요청 서명을 풀지 못했습니다.'],
];

function friendlyReason(text) {
  const value = String(text ?? '').trim();
  if (!value) return '';
  for (const [pattern, hint] of REASON_HINTS) {
    if (pattern.test(value)) return hint;
  }
  return value;
}

async function downloadSubtitleFiles(videoUrl, options) {
  const { exePath, outDir, langs, timeoutMs, signal, onProgress } = options;
  fs.mkdirSync(outDir, { recursive: true });
  const before = new Set(fs.readdirSync(outDir));
  if (onProgress) onProgress({ phase: 'subtitle', message: '자막을 내려받는 중입니다.' });
  const args = [
    ...playerClientArgs(options.playerClients),
    IGNORE_NO_FORMATS,
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
  const reasons = [];
  let missing = false;
  let failed = false;
  try {
    await manager.run(exePath, args, {
      timeoutMs,
      signal,
      onLine: (line) => {
        if (isMissingSubtitleNotice(line)) {
          missing = true;
          return;
        }
        if (/WARNING|ERROR/i.test(line)) {
          reasons.push(reasonFrom(line));
          return;
        }
        if (onProgress) onProgress({ phase: 'subtitle', message: '자막을 내려받는 중입니다.' });
      },
    });
  } catch (error) {
    // 사용자가 취소한 경우만 그대로 올린다. 그 밖의 실패는 "이 클라이언트로는 안 됐다" 로 보고
    // 다음 클라이언트·언어 패턴을 계속 시도한다(예전에는 여기서 전체 시도가 통째로 중단됐다).
    if (error.code === 'CANCELLED') throw error;
    failed = true;
    reasons.push(reasonFrom(error.message));
  }
  const files = fs.readdirSync(outDir).filter((file) => !before.has(file));
  return { files, reasons, missing, failed };
}

async function fetchSubtitles(videoUrl, options = {}) {
  const { exePath, outDir, timeoutMs = 180000, signal, onProgress } = options;
  const langAttempts = options.langs ? [options.langs] : LANG_ATTEMPTS;
  const clientAttempts = options.playerClients ? [options.playerClients] : PLAYER_CLIENT_ATTEMPTS;
  const reasons = [];
  let created = [];
  let missing = false;
  for (const playerClients of clientAttempts) {
    let missingAll = true;
    for (const langs of langAttempts) {
      let attempt;
      try {
        attempt = await downloadSubtitleFiles(videoUrl, {
          exePath, outDir, langs, playerClients, timeoutMs, signal, onProgress,
        });
      } catch (error) {
        if (error.code === 'CANCELLED') throw error;
        reasons.push(reasonFrom(error.message));
        missingAll = false;
        continue;
      }
      reasons.push(...attempt.reasons);
      if (attempt.files.length) {
        created = attempt.files;
        break;
      }
      if (!attempt.missing) missingAll = false;
    }
    if (created.length) break;
    // 모든 언어 패턴이 "요청한 언어의 자막이 없다" 였다면 클라이언트를 바꿔도 소용없다.
    if (missingAll) {
      missing = true;
      break;
    }
  }
  if (!created.length) {
    // 이유는 중복을 없애고, 아는 문구는 한국어 안내로 바꿔 2줄까지만 보여 준다.
    const candidates = [...new Set(reasons.filter(Boolean))];
    const detail = [...new Set(candidates.map(friendlyReason).filter(Boolean))].slice(0, 2).join(' / ');
    const error = new Error(missing
      ? `이 동영상에는 영어 자막이 없습니다.${detail ? ` (${detail})` : ''}`
      : `자막을 가져오지 못했습니다.${detail ? ` (${detail})` : ' 자막이 없는 동영상일 수 있습니다.'}`);
    error.code = missing ? 'NO_SUBTITLES' : 'SUBTITLE_DOWNLOAD_FAILED';
    error.detail = candidates.slice(0, 3).join(' / ');
    throw error;
  }
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

module.exports = {
  listVideos, getVideo, fetchSubtitles, parseDumpLines, toVideo,
  DEFAULT_PLAYER_CLIENTS, PLAYER_CLIENT_ATTEMPTS, playerClientArgs, isMissingSubtitleNotice,
  IGNORE_NO_FORMATS, reasonFrom, friendlyReason,
};
