const API_SRC = 'https://www.youtube.com/iframe_api';
let apiPromise = null;

export function loadIframeApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (globalThis.YT && globalThis.YT.Player) {
      resolve(globalThis.YT);
      return;
    }
    const previous = globalThis.onYouTubeIframeAPIReady;
    const timer = setTimeout(() => {
      if (globalThis.YT && globalThis.YT.Player) resolve(globalThis.YT);
      else reject(new Error('YouTube 플레이어를 불러오지 못했습니다. 네트워크 상태를 확인해 주세요.'));
    }, 12000);

    globalThis.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      clearTimeout(timer);
      resolve(globalThis.YT);
    };

    const script = document.createElement('script');
    script.src = API_SRC;
    script.async = true;
    script.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('YouTube 플레이어 스크립트를 불러오지 못했습니다.'));
    });
    document.head.append(script);
  });
  return apiPromise;
}

// YouTube IFrame API 의 onError 코드를 사용자에게 보여줄 문구로 바꾼다.
// 재생 실패를 모두 '네트워크 오류' 로 안내하면 원인을 찾기 어렵다.
// 참고: https://developers.google.com/youtube/iframe_api_reference#onError
export function describePlayerError(code) {
  switch (Number(code)) {
    case 2:
      return '동영상 주소가 올바르지 않아 재생할 수 없습니다. (YouTube 오류 2 · 잘못된 동영상 ID)';
    case 5:
      return '이 동영상은 HTML5 플레이어로 재생할 수 없습니다. (YouTube 오류 5)';
    case 100:
      return '삭제되었거나 비공개로 바뀐 동영상입니다. (YouTube 오류 100)';
    case 101:
    case 150:
      return `이 동영상은 소유자가 외부 사이트 재생을 막아 두었습니다. YouTube 에서 직접 확인해 주세요. (YouTube 오류 ${Number(code)})`;
    default:
      return '동영상을 재생하지 못했습니다. 네트워크 상태를 확인해 주세요.';
  }
}

// 동영상 자체의 문제(주소·공개 범위·임베드 제한)인지 구분한다.
export function isVideoError(code) {
  return [2, 5, 100, 101, 150].includes(Number(code));
}

export class YouTubePlayer {
  constructor(container) {
    this.container = container;
    this.player = null;
    this.videoId = null;
    this.captions = true;
    this.startAt = 0;
    this.timer = null;
    this.handlers = { time: new Set(), state: new Set(), error: new Set() };
    this.playing = false;
  }

  on(event, handler) {
    if (!this.handlers[event]) return () => {};
    this.handlers[event].add(handler);
    return () => this.handlers[event].delete(handler);
  }

  emit(event, payload) {
    for (const handler of this.handlers[event] ?? []) handler(payload);
  }

  async mount(videoId, { captions = true, startAt = 0 } = {}) {
    const YT = await loadIframeApi();
    this.destroy(false);
    this.container.replaceChildren();
    this.videoId = videoId;
    this.captions = captions;
    this.startAt = Math.max(0, Math.floor(startAt));

    const host = document.createElement('div');
    this.container.append(host);

    await new Promise((resolve) => {
      this.player = new YT.Player(host, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          cc_load_policy: captions ? 1 : 0,
          cc_lang_pref: 'en',
          hl: 'en',
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          controls: 1,
          fs: 1,
          origin: globalThis.location.origin,
        },
        events: {
          onReady: (event) => {
            if (this.startAt > 1) event.target.seekTo(this.startAt, true);
            this.startPolling();
            resolve();
          },
          onStateChange: (event) => {
            this.playing = event.data === 1;
            this.emit('state', event.data);
          },
          onError: (event) => this.emit('error', event.data),
        },
      });
      setTimeout(resolve, 10000);
    });
    return this;
  }

  startPolling() {
    this.stopPolling();
    this.timer = setInterval(() => {
      const time = this.getCurrentTime();
      if (time !== null) this.emit('time', time);
    }, 250);
  }

  stopPolling() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getCurrentTime() {
    try {
      if (!this.player || typeof this.player.getCurrentTime !== 'function') return null;
      return this.player.getCurrentTime() ?? null;
    } catch {
      return null;
    }
  }

  getDuration() {
    try {
      if (!this.player || typeof this.player.getDuration !== 'function') return 0;
      return this.player.getDuration() ?? 0;
    } catch {
      return 0;
    }
  }

  seekTo(seconds) {
    try {
      if (this.player && typeof this.player.seekTo === 'function') this.player.seekTo(Math.max(0, seconds), true);
    } catch {
      // 플레이어가 아직 준비되지 않았으면 무시한다.
    }
  }

  play() {
    try {
      this.player?.playVideo?.();
    } catch {
      // 무시
    }
  }

  pause() {
    try {
      this.player?.pauseVideo?.();
    } catch {
      // 무시
    }
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  async setCaptions(captions) {
    if (captions === this.captions) return;
    const time = this.getCurrentTime() ?? this.startAt;
    await this.mount(this.videoId, { captions, startAt: time });
  }

  destroy(stopPolling = true) {
    if (stopPolling) this.stopPolling();
    else this.stopPolling();
    try {
      this.player?.destroy?.();
    } catch {
      // 무시
    }
    this.player = null;
    this.container.replaceChildren();
  }
}
