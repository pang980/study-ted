import { api } from './api.js';
import { state, set } from './state.js';

// 진행 중인 수집 작업은 화면에서 취소를 누를 수 있어야 하므로 최근 jobId 를 기억한다.
let currentJobId = null;

// 동영상 선택 목록은 한 페이지에 이만큼만 그린다(채널에 2000편이 넘어도 부하가 없도록).
export const VIDEO_PAGE_SIZE = 50;

// 늦게 도착한 이전 페이지 응답이 최신 검색 결과를 덮지 않도록 요청마다 순번을 매긴다.
let videoPageToken = 0;

// 첫 페이지 상태(검색어 없음).
export function defaultVideoPage(patch = {}) {
  return { q: '', offset: 0, limit: VIDEO_PAGE_SIZE, total: 0, hasMore: false, loading: false, ...patch };
}

// 설정의 수집 개수를 API 로 넘길 값으로 바꾼다. 전체 수집이면 'all'.
export function resolveCollectLimit() {
  const settings = state.settings ?? {};
  if (settings.collectAll !== false) return 'all';
  const value = Number(settings.collectLimit);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 24;
}

export async function loadInfo() {
  const info = await api.app.info();
  set({ info, counts: info.counts, settings: info.settings });
  return info;
}

export async function loadChannels() {
  const channels = await api.channels.list();
  const patch = { channels };
  if (!channels.length) {
    patch.activeChannelPk = null;
    patch.videos = [];
    patch.videoPage = defaultVideoPage();
  } else if (!channels.some((channel) => channel.pk === state.activeChannelPk)) {
    patch.activeChannelPk = channels[0].pk;
  }
  set(patch);
  if (patch.activeChannelPk) await loadVideos(patch.activeChannelPk);
  return channels;
}

// 페이지 한 장을 읽어 state.videos(현재 페이지 항목)와 videoPage(페이지 정보)를 함께 갱신한다.
export async function loadVideoPage({ channelPk = state.activeChannelPk, q = null, offset = null, limit = null } = {}) {
  const current = state.videoPage ?? defaultVideoPage();
  const nextQ = q === null ? current.q : String(q ?? '');
  const nextOffset = offset === null ? current.offset : Math.max(0, Math.floor(Number(offset) || 0));
  const nextLimit = limit === null ? current.limit : limit;
  if (!channelPk) {
    const empty = defaultVideoPage({ q: nextQ, limit: nextLimit });
    set({ videos: [], videoPage: empty });
    return { items: [], total: 0, offset: 0, limit: nextLimit, hasMore: false };
  }
  const token = (videoPageToken += 1);
  set({ videoPage: { ...current, q: nextQ, offset: nextOffset, limit: nextLimit, loading: true } });
  try {
    const page = await api.videos.page({ channelPk, q: nextQ, offset: nextOffset, limit: nextLimit });
    if (token !== videoPageToken) return page;
    set({
      videos: page.items ?? [],
      activeChannelPk: channelPk,
      videoPage: {
        q: nextQ,
        offset: page.offset,
        limit: page.limit,
        total: page.total,
        hasMore: page.hasMore,
        loading: false,
      },
    });
    return page;
  } catch (error) {
    if (token === videoPageToken) set({ videoPage: { ...(state.videoPage ?? defaultVideoPage()), loading: false } });
    throw error;
  }
}

export async function loadVideos(channelPk = state.activeChannelPk) {
  const page = await loadVideoPage({ channelPk, q: '', offset: 0, limit: VIDEO_PAGE_SIZE });
  return page.items ?? [];
}

export async function loadSentences(patch = {}) {
  const filters = { ...state.filters, ...patch };
  set({ filters });
  const result = await api.sentences.list({
    q: filters.q,
    channelPk: filters.channelPk,
    favoriteOnly: filters.favoriteOnly,
    sort: filters.sort,
    limit: 300,
  });
  set({ sentences: { items: result.items, total: result.total } });
  return result;
}

export async function selectChannel(pk) {
  set({
    activeChannelPk: pk,
    activeVideoId: null,
    video: null,
    transcript: null,
    videoSentences: [],
    videoPage: defaultVideoPage(),
  });
  await loadVideos(pk);
}

export async function syncChannel({ url, limit, withSubtitles, provider, onProgress }) {
  const jobId = `job-${Date.now()}`;
  currentJobId = jobId;
  const off = api.collect.onProgress((payload) => {
    if (payload.jobId !== jobId) return;
    set({ collecting: payload });
    if (onProgress) onProgress(payload);
  });
  try {
    return await api.channels.sync({ url, jobId, limit, withSubtitles, provider });
  } finally {
    off();
    currentJobId = null;
    set({ collecting: null });
  }
}

export async function cancelCollect() {
  if (!currentJobId) return false;
  try {
    return await api.collect.cancel(currentJobId);
  } catch {
    return false;
  }
}

export async function syncFromUrl(url, { onProgress } = {}) {
  const settings = state.settings ?? {};
  const result = await syncChannel({
    url,
    limit: resolveCollectLimit(),
    withSubtitles: settings.withSubtitles !== false,
    provider: settings.provider ?? 'auto',
    onProgress,
  });
  await loadChannels();
  const channelId = result?.channel?.channelId ?? null;
  const saved = channelId ? (state.channels ?? []).find((item) => item.channelId === channelId) : null;
  if (saved) await selectChannel(saved.pk);
  await loadInfo();
  return result;
}

export async function loadVideo(videoId) {
  const result = await api.videos.get(videoId);
  set({
    activeVideoId: videoId,
    video: result.video,
    transcript: result.transcript ?? null,
    videoSentences: result.sentences ?? [],
  });
  return result;
}

export async function openSentenceSource(item, { navigate = null } = {}) {
  if (!item || !item.videoId) return false;
  if (item.channelPk && item.channelPk !== state.activeChannelPk) await selectChannel(item.channelPk);
  await loadVideo(item.videoId);
  set({ seekRequest: { videoId: item.videoId, seconds: Number(item.startSec) || 0, nonce: Date.now() } });
  if (navigate) navigate('home');
  return true;
}

export async function ensureTranscript(videoId, { force = false } = {}) {
  const transcript = await api.videos.transcript(videoId, force);
  set({ transcript });
  return transcript;
}

export async function refreshVideo(videoId) {
  const result = await api.videos.refresh(videoId);
  await loadVideo(videoId);
  return result;
}

export async function saveSentence(payload) {
  const result = await api.sentences.create(payload);
  await Promise.all([loadSentences(), loadInfo()]);
  if (state.activeVideoId) {
    const current = await api.videos.get(state.activeVideoId);
    set({ videoSentences: current.sentences ?? [] });
  }
  return result;
}

export async function analyzeSentence({ sentence, model, context, videoTitle }) {
  set({ analyzing: true });
  try {
    const result = await api.ai.analyze({ sentence, model, context, videoTitle });
    set({ analysis: result.analysis ?? { raw: result.raw ?? '' }, analysisModel: result.model, settings: result.settings });
    return result;
  } finally {
    set({ analyzing: false });
  }
}

// 문장을 따로 저장하지 않아도 AI 분석 결과를 곧바로 문장 노트에 저장한다.
export async function analyzeAndSaveSentence({
  sentence,
  model,
  context,
  videoTitle,
  videoPk = null,
  videoId = null,
  videoUrl = null,
  channelPk = null,
  startSec = null,
}) {
  set({ analyzing: true });
  try {
    const result = await api.ai.analyze({ sentence, model, context, videoTitle });
    // 어떤 모델이 만든 분석인지 저장해 두면 문장 노트에서 바로 확인할 수 있다.
    const analysis = { ...(result.analysis ?? { raw: result.raw ?? '' }) };
    if (result.model) analysis.model = result.model;
    set({ analysis, analysisModel: result.model, settings: result.settings });
    const created = await api.sentences.create({
      sentence,
      translation: analysis.translation ?? null,
      analysis,
      source: 'ai',
      startSec,
      videoPk,
      videoId,
      videoTitle: videoTitle ?? null,
      videoUrl,
      channelPk,
    });
    await Promise.all([loadSentences(), loadInfo()]);
    if (state.activeVideoId) {
      const current = await api.videos.get(state.activeVideoId);
      set({ videoSentences: current.sentences ?? [] });
    }
    return { ...result, saved: created?.sentence ?? null };
  } finally {
    set({ analyzing: false });
  }
}

export async function toggleFavorite(pk) {
  const updated = await api.sentences.favorite(pk);
  await loadSentences();
  return updated;
}

export async function removeSentence(pk) {
  await api.sentences.remove(pk);
  await Promise.all([loadSentences(), loadInfo()]);
}

// 이미 저장한 문장의 분석이 부실할 때(뜻이 비었거나 한국어로 채워졌을 때) 그 자리에서 다시 분석해 덮어쓴다.
export async function reanalyzeSentence(pk, { sentence, videoTitle = null } = {}) {
  set({ analyzing: true });
  try {
    const result = await api.ai.analyze({ sentence, videoTitle });
    const analysis = { ...(result.analysis ?? { raw: result.raw ?? '' }) };
    if (result.model) analysis.model = result.model;
    const updated = await api.sentences.update(pk, { translation: analysis.translation ?? null, analysis });
    await loadSentences();
    return updated;
  } finally {
    set({ analyzing: false });
  }
}

export async function updateSentence(pk, patch) {
  const updated = await api.sentences.update(pk, patch);
  await loadSentences();
  return updated;
}

export async function removeChannel(pk) {
  await api.channels.remove(pk);
  if (state.activeChannelPk === pk) {
    set({
      activeChannelPk: null,
      activeVideoId: null,
      video: null,
      transcript: null,
      videos: [],
      videoPage: defaultVideoPage(),
    });
  }
  await Promise.all([loadChannels(), loadInfo()]);
}

export async function saveSettings(patch) {
  const settings = await api.settings.update(patch);
  set({ settings });
  return settings;
}

// 업데이트 상태는 메인 프로세스가 밀어 주는 값을 그대로 반영한다(다운로드 진행률 포함).
let updateWired = false;

export function wireUpdateEvents() {
  if (updateWired) return;
  updateWired = true;
  api.update.onStatus((snapshot) => set({ update: snapshot }));
}

export async function loadUpdateState() {
  const snapshot = await api.update.state();
  set({ update: snapshot });
  return snapshot;
}

export async function checkUpdate({ force = true } = {}) {
  const snapshot = await api.update.check(force);
  set({ update: snapshot });
  return snapshot;
}

export async function downloadUpdate() {
  const snapshot = await api.update.download();
  set({ update: snapshot });
  return snapshot;
}

export async function installUpdate() {
  return api.update.install();
}

export async function loadModels({ force = false } = {}) {
  const models = await api.ai.models(force);
  set({ models });
  return models;
}

export async function seedDemo(force = false) {
  const summary = await api.demo.seed(force);
  await loadChannels();
  await loadSentences();
  await loadInfo();
  return summary;
}
