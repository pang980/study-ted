import { h, clear, formatTime, thumb, toast } from '../ui.js';
import { state, set } from '../state.js';
import { api } from '../api.js';
import { YouTubePlayer, describePlayerError, isVideoError } from '../player.js';
import { TranscriptPanel } from './transcript.js';
import { SentencePanel } from './sentence-panel.js';
import * as actions from '../actions.js';

export function findSegmentIndex(segments, time) {
  if (!Array.isArray(segments) || !segments.length) return -1;
  const target = Number(time);
  if (!Number.isFinite(target)) return -1;
  let low = 0;
  let high = segments.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const start = Number(segments[mid]?.start ?? 0);
    if (Number.isFinite(start) && start <= target) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

export function createModeSwitch({ onChange } = {}) {
  const listenBtn = h('button', { class: 'mode-switch__btn', type: 'button', text: '듣기', title: '자막 없이 소리만 듣습니다.' });
  const captionBtn = h('button', { class: 'mode-switch__btn', type: 'button', text: '자막', title: '자막을 켜고 학습합니다.' });
  const element = h('div', { class: 'mode-switch' }, listenBtn, captionBtn);

  const apply = (mode) => {
    set({ studyMode: mode });
    if (onChange) onChange(mode);
  };
  listenBtn.addEventListener('click', () => apply('listen'));
  captionBtn.addEventListener('click', () => apply('captions'));

  const update = (mode) => {
    listenBtn.classList.toggle('is-active', mode === 'listen');
    captionBtn.classList.toggle('is-active', mode !== 'listen');
  };
  update(state.studyMode);

  return { element, update };
}

export function createChannelBar({ onSync, onCancel, onModeChange } = {}) {
  const input = h('input', {
    class: 'input topbar__input',
    type: 'text',
    placeholder: 'https://www.youtube.com/@channelname',
    spellcheck: 'false',
  });
  const syncBtn = h('button', { class: 'btn btn--primary', type: 'button', text: '채널 불러오기' });
  const cancelBtn = h('button', { class: 'btn btn--danger', type: 'button', text: '취소', hidden: true });
  const fill = h('div', { class: 'progress-bar__fill' });
  const progressText = h('span', { class: 'muted small', text: '' });
  const progress = h(
    'div',
    { class: 'card__body', hidden: true, style: { paddingTop: '0' } },
    h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'progress-bar' }, fill), progressText),
  );

  const mode = createModeSwitch({ onChange: onModeChange });

  syncBtn.addEventListener('click', () => {
    const url = input.value.trim();
    if (!url) {
      toast('채널 주소를 입력해 주세요.', { type: 'warn' });
      input.focus();
      return;
    }
    if (onSync) onSync(url);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') syncBtn.click();
  });
  cancelBtn.addEventListener('click', () => {
    if (onCancel) onCancel();
  });

  const element = h(
    'section',
    { class: 'card' },
    h(
      'div',
      { class: 'topbar' },
      h('span', { class: 'topbar__label', text: 'YouTube 채널 주소 입력' }),
      input,
      syncBtn,
      cancelBtn,
      h('div', { class: 'topbar__right' }, mode.element),
    ),
    progress,
  );

  return {
    element,
    input,
    update(s) {
      mode.update(s.studyMode);
      const collecting = s.collecting;
      progress.hidden = !collecting;
      cancelBtn.hidden = !collecting;
      syncBtn.disabled = Boolean(collecting);
      if (collecting) {
        const total = Number(collecting.total) || 0;
        const done = Number(collecting.done) || 0;
        fill.style.width = total > 0 ? `${Math.min(100, Math.round((done / total) * 100))}%` : '8%';
        progressText.textContent = collecting.message ?? '수집 중입니다.';
      }
    },
  };
}

export class StudyWorkspace {
  constructor({ onOpenSentences = null } = {}) {
    this.onOpenSentences = onOpenSentences;
    this.mode = state.studyMode;
    this.tab = 'info';
    this.lastVideoId = undefined;
    this.lastTranscript = undefined;
    this.lastSentences = undefined;
    this.lastMode = undefined;
    this.lastAnalysis = undefined;
    this.detailSignature = '';
    this.currentCaption = '';
    this.currentIndex = -1;
    this.lastSeekNonce = null;
    this.pendingSeek = null;

    this.playerNote = h('div', { class: 'player-note', text: '아래 동영상 목록에서 재생할 동영상을 선택해 주세요.' });
    this.captionOverlay = h('div', { class: 'player-caption', hidden: true });
    this.playerHost = h('div', { class: 'player-host' });
    this.frame = h('div', { class: 'player-frame' }, this.playerHost, this.playerNote, this.captionOverlay);

    this.titleEl = h('div', { class: 'video-meta__title', text: '동영상을 선택해 주세요.' });
    this.subEl = h('div', { class: 'video-meta__sub', text: '채널을 불러오면 최신 동영상부터 순서대로 표시됩니다.' });
    this.meta = h('div', { class: 'video-meta' }, this.titleEl, this.subEl);

    this.tabInfo = h('button', { class: 'tab tab--underline is-active', type: 'button', text: '영상 정보' });
    this.tabSentences = h('button', { class: 'tab tab--underline', type: 'button', text: '관련 문장 (0)' });
    this.tabInfo.addEventListener('click', () => this.setTab('info'));
    this.tabSentences.addEventListener('click', () => this.setTab('sentences'));

    this.transcriptBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '자막 가져오기' });
    this.transcriptBtn.addEventListener('click', () => this.fetchTranscript());

    this.tabs = h(
      'div',
      { class: 'tabs row--between', style: { padding: '2px 12px 0' } },
      h('div', { class: 'tabs' }, this.tabInfo, this.tabSentences),
      this.transcriptBtn,
    );

    this.detailThumb = h('div', { class: 'detail__thumb' });
    this.detailBody = h('div', { class: 'grow' });
    this.detailMain = h('div', { class: 'detail__main' }, this.detailThumb, this.detailBody);

    this.sentencesBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '≡ 이 영상의 문장 보기' });
    this.favBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '☆ 즐겨찾기' });
    this.shareBtn = h('button', { class: 'btn btn--sm', type: 'button', text: '< 공유하기' });
    this.sentencesBtn.addEventListener('click', () => this.setTab('sentences'));
    this.favBtn.addEventListener('click', () => this.favoriteVideoSentences());
    this.shareBtn.addEventListener('click', () => set({ view: 'share' }));

    this.actions = h('div', { class: 'detail__actions' }, this.sentencesBtn, this.favBtn, this.shareBtn);
    this.detail = h('div', { class: 'detail' }, this.detailMain, this.actions);

    this.playerPanel = h('section', { class: 'panel panel--player' }, this.frame, this.meta, this.tabs, this.detail);

    this.transcript = new TranscriptPanel({
      onSeek: (seconds) => this.replayFrom(seconds),
      onSelect: ({ text, startSec }) => this.selectSentence(text, startSec),
      onSend: ({ text, start }) => this.sendSentence(text, start),
    });

    this.sentencePanel = new SentencePanel({
      onSave: (payload) => this.saveSentence(payload),
      onAnalyze: (sentence, meta) => this.analyzeSentence(sentence, meta),
      onError: (error) => toast(error.message, { type: 'error' }),
    });

    this.player = new YouTubePlayer(this.playerHost);
    this.player.on('time', (seconds) => this.handleTime(seconds));
    this.player.on('error', (code) => this.handlePlayerError(code));

    this.element = h(
      'div',
      { class: 'workspace' },
      this.playerPanel,
      this.transcript.element,
      h('div', { class: 'stack panel--sentences' }, this.sentencePanel.element),
    );
  }

  setTab(tab) {
    this.tab = tab;
    this.tabInfo.classList.toggle('is-active', tab === 'info');
    this.tabSentences.classList.toggle('is-active', tab === 'sentences');
    this.detailSignature = '';
    this.renderDetail(state);
  }

  handleTime(seconds) {
    this.currentTime = seconds;
    const segments = this.transcript.segments;
    const index = findSegmentIndex(segments, seconds);
    this.currentIndex = index;
    this.transcript.setActiveIndex(index);
    const text = index >= 0 ? String(segments[index]?.text ?? '') : '';
    if (text === this.currentCaption) return;
    this.currentCaption = text;
    this.captionOverlay.textContent = text;
    this.captionOverlay.hidden = !text || this.mode === 'listen';
  }

  handlePlayerError(code) {
    const base = describePlayerError(code);
    const message =
      state.demo && isVideoError(code)
        ? `${base} 데모 데이터의 동영상 주소는 실제 YouTube 주소가 아니므로, 실제 채널을 불러와 확인해 주세요.`
        : base;
    toast(message, { type: 'error', timeout: 7000 });
    this.playerNote.textContent = message;
    if (!this.playerHost.contains(this.playerNote)) this.playerHost.replaceChildren(this.playerNote);
  }

  async applyMode(mode) {
    this.mode = mode;
    const captions = mode !== 'listen';
    this.transcript.setEnabled(captions);
    this.captionOverlay.hidden = !captions || !this.currentCaption;
    if (this.player.videoId) await this.player.setCaptions(captions);
  }

  async loadVideo(s) {
    const video = s.video;
    if (!video) {
      this.pendingSeek = null;
      this.player.destroy();
      this.titleEl.textContent = '동영상을 선택해 주세요.';
      this.subEl.textContent = '채널을 불러오면 최신 동영상부터 순서대로 표시됩니다.';
      if (!this.playerHost.contains(this.playerNote)) this.playerHost.replaceChildren(this.playerNote);
      return;
    }
    this.playerNote.remove();
    this.currentCaption = '';
    this.currentIndex = -1;
    this.captionOverlay.hidden = true;
    this.titleEl.textContent = video.title ?? '제목 없음';
    this.subEl.textContent = [video.channelTitle, video.viewCountText, video.publishedText].filter(Boolean).join(' · ');
    const startAt = this.pendingSeek ?? 0;
    this.pendingSeek = null;
    try {
      await this.player.mount(video.videoId, { captions: this.mode !== 'listen', startAt });
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 6000 });
    }
  }

  // 자막에서 보낸 문장은 이미 입력한 내용을 지우지 않고 줄 단위로 덧붙인다.
  selectSentence(text, startSec = null, { focus = true } = {}) {
    if (!text) return false;
    const added = this.sentencePanel.appendSentence(text, { focus, startSec });
    set({ selectedSentence: this.sentencePanel.getSentence(), selectedStartSec: startSec ?? null });
    return added;
  }

  // 자막 줄의 "문장 전송" 버튼: 문장 패널로 보내되 입력 포커스는 빼앗지 않는다.
  sendSentence(text, startSec = null) {
    if (!text) return;
    const added = this.selectSentence(text, startSec, { focus: false });
    toast(
      added === false ? '이미 문장 패널에 있는 문장입니다.' : '문장을 오른쪽 문장 패널에 추가했습니다.',
      { type: added === false ? 'warn' : 'success', timeout: 2600 },
    );
  }

  // 자막 줄 클릭: 그 시점으로 이동한 뒤 이어서 재생한다.
  replayFrom(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return;
    this.player.seekTo(value);
    this.player.play();
  }

  async saveSentence(payload) {
    const video = state.video;
    return actions.saveSentence({
      sentence: payload.sentence,
      translation: payload.translation ?? null,
      analysis: payload.analysis ?? null,
      source: payload.source ?? (video ? 'youtube' : 'manual'),
      startSec: payload.startSec ?? null,
      isFavorite: Boolean(payload.isFavorite),
      videoPk: video?.pk ?? null,
      videoId: video?.videoId ?? null,
      videoTitle: video?.title ?? null,
      videoUrl: video?.url ?? null,
      channelPk: video?.channelPk ?? state.activeChannelPk ?? null,
    });
  }

  // 저장 단계를 거치지 않고 바로 분석하고, 결과를 문장 노트에 저장한 뒤 보여 준다.
  async analyzeSentence(sentence, { startSec = null } = {}) {
    const video = state.video;
    const result = await actions.analyzeAndSaveSentence({
      sentence,
      model: state.settings?.model || undefined,
      videoTitle: video?.title ?? undefined,
      videoPk: video?.pk ?? null,
      videoId: video?.videoId ?? null,
      videoUrl: video?.url ?? null,
      channelPk: video?.channelPk ?? state.activeChannelPk ?? null,
      startSec: startSec ?? this.sentencePanel.startSecFor(sentence) ?? null,
    });
    this.sentencePanel.setAnalysis(result.analysis ?? { raw: result.raw ?? '' }, result.model);
    this.lastAnalysis = result.analysis ?? null;
    return result;
  }

  async fetchTranscript() {
    const videoId = state.activeVideoId;
    if (!videoId) {
      toast('동영상을 먼저 선택해 주세요.', { type: 'warn' });
      return;
    }
    this.transcriptBtn.disabled = true;
    this.transcriptBtn.textContent = '자막 가져오는 중…';
    try {
      const transcript = await actions.ensureTranscript(videoId, { force: true });
      if (!transcript || !(transcript.segments ?? []).length) {
        toast('이 동영상에서 사용할 수 있는 자막을 찾지 못했습니다.', { type: 'warn', timeout: 6000 });
      } else {
        toast(`자막 ${transcript.segments.length}줄을 가져왔습니다.`, { type: 'success' });
      }
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 7000 });
    } finally {
      this.transcriptBtn.disabled = false;
      this.transcriptBtn.textContent = '자막 가져오기';
    }
  }

  async favoriteVideoSentences() {
    const items = state.videoSentences ?? [];
    if (!items.length) {
      toast('이 영상에서 저장한 문장이 없습니다.', { type: 'warn' });
      return;
    }
    const allFavorite = items.every((item) => item.isFavorite);
    try {
      for (const item of items) {
        if (item.isFavorite === allFavorite) await api.sentences.favorite(item.pk);
      }
      await actions.loadSentences();
      if (state.activeVideoId) await actions.loadVideo(state.activeVideoId);
      toast(allFavorite ? '즐겨찾기를 해제했습니다.' : '이 영상의 문장을 즐겨찾기에 추가했습니다.', { type: 'success' });
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  renderSentencesTab(s) {
    clear(this.detailBody);
    const items = s.videoSentences ?? [];
    if (!items.length) {
      this.detailBody.append(h('p', { class: 'muted small', text: '이 영상에서 저장한 문장이 아직 없습니다. 자막에서 문장을 선택해 저장해 보세요.' }));
      return;
    }
    const list = h('div', { class: 'transcript-list' });
    for (const item of items) {
      list.append(
        h(
          'div',
          {
            class: 'transcript-line',
            onClick: () => {
              if (item.startSec !== null && item.startSec !== undefined) this.player.seekTo(item.startSec);
              this.sentencePanel.setSentence(item.sentence, { focus: true });
            },
          },
          h('span', { class: 'transcript-line__time', text: item.startSec === null || item.startSec === undefined ? '--:--' : formatTime(item.startSec) }),
          h('span', { class: 'transcript-line__text', text: item.sentence }),
        ),
      );
    }
    this.detailBody.append(list);
  }

  renderDetail(s) {
    const count = (s.videoSentences ?? []).length;
    const signature = [s.activeVideoId ?? '', this.tab, count, s.video?.pk ?? '', s.video?.description ? '1' : '0'].join('|');
    if (signature === this.detailSignature) return;
    this.detailSignature = signature;

    this.tabSentences.textContent = `관련 문장 (${count})`;

    if (this.tab === 'sentences') {
      this.detailThumb.hidden = true;
      this.renderSentencesTab(s);
      return;
    }

    this.detailThumb.hidden = !s.video;
    clear(this.detailThumb);
    clear(this.detailBody);
    if (s.video) {
      this.detailThumb.append(
        thumb({ title: s.video.title, thumbnailUrl: s.video.thumbnailUrl, durationText: s.video.durationText }),
      );
    }
    this.detailBody.append(h('div', { class: 'detail__title', text: s.video?.title ?? '동영상을 선택해 주세요.' }));
    if (s.video?.channelTitle) this.detailBody.append(h('div', { class: 'detail__channel', text: s.video.channelTitle }));
    const description = s.video?.description ?? '';
    if (description) {
      const descEl = h('div', { class: 'detail__desc is-clamped', text: description });
      const moreBtn = h('button', { class: 'btn btn--sm btn--subtle', type: 'button', text: '더보기 ⌄' });
      moreBtn.addEventListener('click', () => {
        const clamped = descEl.classList.toggle('is-clamped');
        moreBtn.textContent = clamped ? '더보기 ⌄' : '접기 ⌃';
      });
      this.detailBody.append(descEl, moreBtn);
    } else if (!s.video) {
      this.detailBody.append(h('p', { class: 'muted small', text: '동영상을 선택하면 설명과 관련 문장이 표시됩니다.' }));
    }
  }

  update(s) {
    if (s.studyMode !== this.lastMode) {
      this.lastMode = s.studyMode;
      this.applyMode(s.studyMode);
    }
    const request = s.seekRequest;
    if (request && request.nonce !== this.lastSeekNonce) {
      this.lastSeekNonce = request.nonce;
      this.pendingSeek = Number(request.seconds) || 0;
    }
    if (s.activeVideoId !== this.lastVideoId) {
      this.lastVideoId = s.activeVideoId;
      this.loadVideo(s);
    } else if (this.pendingSeek !== null) {
      this.player.seekTo(this.pendingSeek);
      this.pendingSeek = null;
    }
    if (s.transcript !== this.lastTranscript) {
      this.lastTranscript = s.transcript;
      this.currentCaption = '';
      this.transcript.setSegments(s.transcript?.segments ?? []);
    }
    if (s.videoSentences !== this.lastSentences) this.lastSentences = s.videoSentences;
    if (s.analysis !== this.lastAnalysis) {
      this.lastAnalysis = s.analysis;
      if (s.analysis) this.sentencePanel.setAnalysis(s.analysis, s.analysisModel);
    }
    this.renderDetail(s);
  }

  seek(seconds) {
    const value = Number(seconds);
    if (Number.isFinite(value)) this.player.seekTo(value);
  }

  destroy() {
    this.player.destroy();
  }
}
