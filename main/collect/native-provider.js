const net = require('./net');
const parser = require('./subtitle-parser');

const ORIGIN = 'https://www.youtube.com';
const CLIENT_VERSION = '2.20240726.00.00';
let cachedKey = null;

function makeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseChannelInput(input) {
  const raw = String(input ?? '').trim();
  if (!raw) throw makeError('CHANNEL_INPUT_EMPTY', '채널 주소를 입력해 주세요.');
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(raw)) {
    return { handle: null, channelId: raw, baseUrl: `${ORIGIN}/channel/${raw}` };
  }
  if (raw.startsWith('@')) {
    const handle = raw.split('/')[0];
    return { handle, channelId: null, baseUrl: `${ORIGIN}/${handle}` };
  }
  let url;
  try {
    url = new URL(raw.startsWith('http') ? raw : `${ORIGIN}/${raw}`);
  } catch {
    throw makeError('CHANNEL_INPUT_INVALID', '올바른 채널 주소가 아닙니다.');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'channel' && parts[1]) {
    return { handle: null, channelId: parts[1], baseUrl: `${ORIGIN}/channel/${parts[1]}` };
  }
  if (parts[0] === 'watch') {
    throw makeError('CHANNEL_INPUT_INVALID', '채널 주소가 아니라 동영상 주소입니다.');
  }
  if (parts.length === 0) throw makeError('CHANNEL_INPUT_INVALID', '올바른 채널 주소가 아닙니다.');
  const handle = parts[0].startsWith('@') || parts[0] === 'c' || parts[0] === 'user'
    ? parts.slice(0, parts[0] === 'c' || parts[0] === 'user' ? 2 : 1).join('/')
    : parts[0];
  return { handle, channelId: null, baseUrl: `${ORIGIN}/${handle}` };
}

function textFromRuns(node) {
  if (!node) return null;
  if (typeof node === 'string') return node;
  if (typeof node.simpleText === 'string') return node.simpleText;
  if (typeof node.content === 'string') return node.content;
  if (Array.isArray(node.runs)) return node.runs.map((run) => run.text ?? '').join('') || null;
  return null;
}

function pickThumbnail(thumbnails) {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return null;
  return thumbnails.reduce((best, item) => ((item?.width ?? 0) > (best?.width ?? 0) ? item : best), thumbnails[0])?.url ?? null;
}

function pickSource(sources) {
  if (!Array.isArray(sources) || !sources.length) return null;
  const withUrl = sources.filter((item) => item && item.url);
  if (!withUrl.length) return null;
  return withUrl.reduce((best, item) => ((item.width ?? 0) > (best.width ?? 0) ? item : best), withUrl[0]).url;
}

function extractChannelMeta(html) {
  const data = net.extractJsonAfter(html, 'var ytInitialData = ');
  const channelId =
    net.matchFirst(html, /"externalId":"([^"]+)"/) ??
    net.matchFirst(html, /channel_id=([A-Za-z0-9_-]{20,})/) ??
    (data ? net.matchFirst(JSON.stringify(data), /"externalId":"([^"]+)"/) : null);
  const title =
    (data && textFromRuns(net.deepFind(data, (node) => node?.channelMetadataRenderer?.title)?.channelMetadataRenderer?.title)) ??
    (net.extractMeta(html, 'og:title') ?? '').replace(/\s*-\s*YouTube\s*$/, '') ??
    null;
  const avatarUrl =
    net.extractMeta(html, 'og:image') ??
    (data ? pickThumbnail(net.deepFind(data, (node) => node?.avatar)?.avatar?.thumbnails) : null);
  const description = net.extractMeta(html, 'og:description') ?? net.extractMeta(html, 'description');
  const badges = [];
  if (data) {
    for (const node of net.deepCollect(data, (item) => Array.isArray(item.metadataParts) && item.metadataParts.length > 0, 40)) {
      for (const part of node.metadataParts) {
        const text = textFromRuns(part?.text);
        if (text) badges.push(text);
      }
    }
  }
  const subscriberText = badges.find((text) => /subscriber/i.test(text)) ?? null;
  const videoCountText = badges.find((text) => /\bvideos?\b/i.test(text)) ?? null;
  return { channelId, title, avatarUrl: avatarUrl ?? null, description: description ?? null, subscriberText, videoCountText };
}

async function resolveChannel(input, options = {}) {
  const parsed = parseChannelInput(input);
  const url = `${parsed.baseUrl}/videos`;
  const { ok, status, text } = await net.fetchText(url, { timeout: 25000, signal: options.signal });
  if (!ok) throw makeError('CHANNEL_FETCH_FAILED', `채널 페이지를 불러오지 못했습니다. (HTTP ${status})`);
  const meta = extractChannelMeta(text);
  if (!meta.channelId) throw makeError('CHANNEL_NOT_FOUND', '채널을 찾지 못했습니다. 주소를 확인해 주세요.');
  return {
    channelId: meta.channelId,
    handle: parsed.handle,
    title: meta.title || parsed.handle || meta.channelId,
    url: `${ORIGIN}/channel/${meta.channelId}`,
    avatarUrl: meta.avatarUrl,
    subscriberText: meta.subscriberText,
    videoCountText: meta.videoCountText,
    description: meta.description,
  };
}

async function innertubeKey(signal) {
  if (cachedKey) return cachedKey;
  const { text } = await net.fetchText(`${ORIGIN}/watch?v=dQw4w9WgXcQ&hl=en`, { timeout: 25000, signal });
  const key = net.matchFirst(text, /"INNERTUBE_API_KEY":"([^"]+)"/);
  if (!key) throw makeError('INNERTUBE_KEY_MISSING', 'YouTube 설정 키를 찾지 못했습니다.');
  cachedKey = key;
  return key;
}

async function browse(payload, signal) {
  const key = await innertubeKey(signal);
  const response = await net.fetchText(`${ORIGIN}/youtubei/v1/browse?key=${key}&prettyPrint=false`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-youtube-client-name': '1',
      'x-youtube-client-version': CLIENT_VERSION,
      origin: ORIGIN,
      referer: `${ORIGIN}/`,
    },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION, hl: 'en', gl: 'US' } },
      ...payload,
    }),
    timeout: 25000,
    signal,
  });
  if (!response.ok) throw makeError('INNERTUBE_FAILED', `YouTube 응답 오류 (HTTP ${response.status})`);
  return JSON.parse(response.text);
}

function normalizeMetadataRows(node) {
  const rows = node?.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => (row.metadataParts ?? []).map((part) => textFromRuns(part.text)).filter(Boolean));
}

function extractVideoEntries(data) {
  const out = [];
  const seen = new Set();
  const push = (entry) => {
    if (!entry.videoId || seen.has(entry.videoId)) return;
    seen.add(entry.videoId);
    out.push(entry);
  };
  for (const node of net.deepCollect(data, (item) => typeof item.videoId === 'string' && item.videoId.length === 11 && (item.title || item.lengthText), 300)) {
    const meta = [];
    push({
      videoId: node.videoId,
      title: textFromRuns(node.title) ?? node.videoId,
      url: `${ORIGIN}/watch?v=${node.videoId}`,
      durationText: textFromRuns(node.lengthText),
      viewCountText: textFromRuns(node.viewCountText),
      publishedText: textFromRuns(node.publishedTimeText),
      thumbnailUrl: pickThumbnail(node.thumbnail?.thumbnails) ?? `https://i.ytimg.com/vi/${node.videoId}/hqdefault.jpg`,
      channelTitle: textFromRuns(node.ownerText) ?? textFromRuns(node.longBylineText),
      meta,
    });
  }
  for (const node of net.deepCollect(data, (item) => typeof item.contentId === 'string' && item.contentId.length === 11 && item.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO', 300)) {
    const rows = normalizeMetadataRows(node);
    const viewCountText = rows.find((text) => /view|회|watches/i.test(text)) ?? null;
    const publishedText = rows.find((text) => /ago|전|hour|day|week|month|year/i.test(text)) ?? null;
    const overlayText = net.deepCollect(node, (item) => typeof item?.thumbnailBadgeViewModel?.text === 'string', 20)[0]?.thumbnailBadgeViewModel?.text ?? null;
    push({
      videoId: node.contentId,
      title: node?.metadata?.lockupMetadataViewModel?.title?.content ?? node.contentId,
      url: `${ORIGIN}/watch?v=${node.contentId}`,
      durationText: overlayText,
      viewCountText,
      publishedText,
      thumbnailUrl: pickSource(node?.contentImage?.thumbnailViewModel?.image?.sources) ?? `https://i.ytimg.com/vi/${node.contentId}/hqdefault.jpg`,
      channelTitle: rows[0] ?? null,
      meta: rows,
    });
  }
  return out;
}

function findContinuation(data) {
  const node = net.deepCollect(data, (item) => typeof item?.continuationCommand?.token === 'string', 20)[0];
  return node?.continuationCommand?.token ?? null;
}

async function listVideos(channelId, options = {}) {
  const { limit = 30, onProgress, signal } = options;
  // 전체 수집(limit 이 유한하지 않음)이면 안전 상한(150 페이지 ≈ 4,500개)까지 계속 넘긴다.
  const bounded = Number.isFinite(limit) && limit > 0;
  const max = bounded ? limit : Infinity;
  const pageCap = bounded ? Math.max(6, Math.ceil(limit / 30) + 1) : 150;
  const videos = [];
  let token = null;
  let pages = 0;
  const params = 'EgZ2aWRlb3PyBgQKAjoA';
  while (videos.length < max && pages < pageCap) {
    const payload = token ? { continuation: token } : { browseId: channelId, params };
    const data = await browse(payload, signal);
    const batch = extractVideoEntries(data);
    for (const entry of batch) {
      if (videos.length >= max) break;
      if (!videos.some((video) => video.videoId === entry.videoId)) videos.push(entry);
    }
    pages += 1;
    if (onProgress) {
      onProgress({ phase: 'list', done: videos.length, total: bounded ? limit : 0, message: `영상 ${videos.length}개 확인` });
    }
    token = findContinuation(data);
    if (!token || batch.length === 0) break;
  }
  return videos;
}

async function getVideo(videoId, options = {}) {
  const { ok, status, text } = await net.fetchText(`${ORIGIN}/watch?v=${videoId}&hl=en&has_verified=1`, { timeout: 25000, signal: options.signal });
  if (!ok) throw makeError('VIDEO_FETCH_FAILED', `동영상 정보를 불러오지 못했습니다. (HTTP ${status})`);
  const player = net.extractJsonAfter(text, 'ytInitialPlayerResponse = ');
  if (!player) throw makeError('VIDEO_PARSE_FAILED', '동영상 정보를 해석하지 못했습니다.');
  const details = player.videoDetails ?? {};
  const micro = player.microformat?.playerMicroformatRenderer ?? {};
  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  return {
    videoId,
    title: details.title ?? `YouTube ${videoId}`,
    url: `${ORIGIN}/watch?v=${videoId}`,
    durationSec: Number(details.lengthSeconds ?? micro.lengthSeconds ?? 0) || null,
    viewCountText: micro.viewCount ? `${Number(micro.viewCount).toLocaleString('ko-KR')}회` : null,
    publishedText: micro.publishDate ?? micro.uploadDate ?? null,
    thumbnailUrl: pickThumbnail(details.thumbnail?.thumbnails) ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    description: details.shortDescription ?? null,
    channelId: details.channelId ?? micro.externalChannelId ?? null,
    channelTitle: details.author ?? micro.ownerChannelName ?? null,
    playability: player.playabilityStatus?.status ?? null,
    captions: tracks.map((track) => ({
      baseUrl: track.baseUrl,
      languageCode: track.languageCode,
      name: textFromRuns(track.name),
      kind: track.kind ?? null,
      vssId: track.vssId ?? null,
    })),
  };
}

function pickCaptionTrack(tracks, preferred = ['en']) {
  if (!Array.isArray(tracks) || !tracks.length) return null;
  const score = (track) => {
    let value = 0;
    const code = String(track.languageCode ?? '');
    if (code === 'en') value += 100;
    else if (code.startsWith('en')) value += 90;
    else if (preferred.includes(code)) value += 50;
    if (track.kind !== 'asr') value += 10;
    return value;
  };
  return [...tracks].sort((a, b) => score(b) - score(a))[0];
}

async function fetchCaptionBody(baseUrl, signal) {
  const url = baseUrl.includes('fmt=') ? baseUrl : `${baseUrl}&fmt=json3`;
  const { ok, status, text } = await net.fetchText(url, { timeout: 20000, signal });
  if (!ok) throw makeError('CAPTION_FETCH_FAILED', `자막 요청 실패 (HTTP ${status})`);
  if (!text || text.trim() === '') {
    throw makeError(
      'CAPTION_BLOCKED',
      'YouTube 가 자막 본문 전송을 거부했습니다. 설정에서 yt-dlp 경로를 지정하거나 yt-dlp 를 설치해 주세요.',
    );
  }
  return text;
}

async function getTranscript(videoId, options = {}) {
  const video = await getVideo(videoId, options);
  const track = pickCaptionTrack(video.captions);
  if (!track) throw makeError('CAPTION_NOT_AVAILABLE', '이 동영상에는 사용할 수 있는 자막이 없습니다.');
  const body = await fetchCaptionBody(track.baseUrl, options.signal);
  const segments = parser.parse(body, 'auto').filter((segment) => segment.text);
  if (!segments.length) throw makeError('CAPTION_EMPTY', '자막 본문이 비어 있습니다.');
  return {
    lang: track.languageCode ?? null,
    kind: track.kind ?? null,
    source: 'native',
    segments,
    plainText: parser.toPlainText(segments),
  };
}

module.exports = {
  parseChannelInput, resolveChannel, listVideos, getVideo, getTranscript,
  pickCaptionTrack, fetchCaptionBody, extractVideoEntries, extractChannelMeta, makeError,
};
