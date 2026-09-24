const listeners = new Set();

export const state = {
  ready: false,
  demo: false,
  view: 'home',
  info: null,
  settings: null,
  counts: { channels: 0, videos: 0, transcripts: 0, sentences: 0 },
  channels: [],
  activeChannelPk: null,
  videos: [],
  // 동영상 선택 목록의 현재 페이지(검색어 / 시작 위치 / 전체 개수).
  videoPage: { q: '', offset: 0, limit: 50, total: 0, hasMore: false, loading: false },
  activeVideoId: null,
  video: null,
  transcript: null,
  videoSentences: [],
  sentences: { items: [], total: 0 },
  filters: { q: '', channelPk: null, favoriteOnly: false, sort: 'latest' },
  selectedSentence: '',
  selectedStartSec: null,
  seekRequest: null,
  analysis: null,
  analysisModel: '',
  analyzing: false,
  collecting: null,
  update: null,
  studyMode: 'captions',
  models: [],
};

export function set(patch) {
  Object.assign(state, patch);
  for (const listener of listeners) listener(state);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
