const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

// 자막 내려받기는 yt-dlp 프로세스를 그대로 쓴다. 여기서는 "어떤 인자로 몇 번 실행하는지"와
// 실패 안내 문구만 확인하면 되므로 ytdlp-manager 를 가짜로 꽂는다.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'study-ted-client-'));

function stub(request, exports) {
  const resolved = require.resolve(request);
  const fake = new Module(resolved, null);
  fake.filename = resolved;
  fake.loaded = true;
  fake.exports = exports;
  require.cache[resolved] = fake;
  return exports;
}

const state = { runs: [], script: [] };
const CUE = JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 1200, segs: [{ utf8: 'hello world' }] }] });

stub('../main/collect/ytdlp-manager', {
  run: async (exePath, args, options = {}) => {
    state.runs.push(args);
    const step = state.script.shift() ?? {};
    for (const line of step.lines ?? []) {
      if (options.onLine) options.onLine(line, step.stderr !== false);
    }
    if (step.throw) {
      const error = new Error(step.throw);
      if (step.code) error.code = step.code;
      throw error;
    }
    const outTemplate = args[args.indexOf('-o') + 1];
    if (outTemplate) {
      const outDir = path.dirname(outTemplate);
      fs.mkdirSync(outDir, { recursive: true });
      for (const file of step.files ?? []) {
        fs.writeFileSync(path.join(outDir, file), step.content ?? CUE, 'utf8');
      }
    }
    return { stdout: step.stdout ?? '', stderr: '', code: 0 };
  },
});

const provider = require('../main/collect/ytdlp-provider');
const VIDEO = 'https://www.youtube.com/watch?v=vid1';

function reset() {
  state.runs = [];
  state.script = [];
}

function outDir(name) {
  const dir = path.join(tmpRoot, name);
  fs.rmSync(dir, { recursive: true, force: true });
  return dir;
}

test('player_client 인자는 기본 → android 순서로 넘어간다', () => {
  assert.deepEqual(provider.playerClientArgs(), ['--extractor-args', 'youtube:player_client=default,android']);
  assert.deepEqual(provider.playerClientArgs('android'), ['--extractor-args', 'youtube:player_client=android']);
  assert.deepEqual(provider.playerClientArgs(''), []);
  assert.deepEqual(provider.PLAYER_CLIENT_ATTEMPTS, ['default,android', 'android,ios']);
});

test('자막 없음 안내와 다른 실패를 구분한다', () => {
  assert.equal(provider.isMissingSubtitleNotice('[info] There are no subtitles for the requested languages'), true);
  assert.equal(provider.isMissingSubtitleNotice('ERROR: [youtube] vid1: This video is not available'), false);
});

test('목록·단일 조회도 같은 player_client 인자를 쓴다', async () => {
  reset();
  state.script = [{ stdout: '' }, { stdout: '{"id":"vid1","title":"영상"}' }];
  await provider.listVideos('https://www.youtube.com/@ch', { exePath: 'yt-dlp', limit: 5 });
  const video = await provider.getVideo(VIDEO, { exePath: 'yt-dlp' });
  assert.equal(video.videoId, 'vid1');
  for (const args of state.runs) {
    assert.ok(args.includes('--extractor-args'), '추출기 인자가 있어야 한다');
    assert.equal(args[args.indexOf('--extractor-args') + 1], 'youtube:player_client=default,android');
  }
});

test('플레이어 클라이언트가 막히면 다음 조합으로 다시 시도한다', async () => {
  reset();
  const dir = outDir('retry');
  const blocked = 'ERROR: [youtube] vid1: This video is not available';
  state.script = [{ lines: [blocked] }, { lines: [blocked] }, { files: ['vid1.en.json3'] }];
  const transcript = await provider.fetchSubtitles(VIDEO, { exePath: 'yt-dlp', outDir: dir });
  assert.equal(transcript.segments.length, 1);
  assert.equal(transcript.source, 'yt-dlp');
  assert.match(state.runs[0].join(' '), /player_client=default,android/);
  assert.match(state.runs[2].join(' '), /player_client=android,ios/);
});

test('자막이 아예 없으면 클라이언트를 바꾸지 않고 NO_SUBTITLES 로 끝낸다', async () => {
  reset();
  const dir = outDir('none');
  const notice = '[info] There are no subtitles for the requested languages';
  state.script = [{ lines: [notice] }, { lines: [notice] }];
  await assert.rejects(
    () => provider.fetchSubtitles(VIDEO, { exePath: 'yt-dlp', outDir: dir }),
    (error) => error.code === 'NO_SUBTITLES' && /영어 자막이 없습니다/.test(error.message),
  );
  assert.equal(state.runs.length, 2, '언어 패턴 두 가지만 시도한다');
  assert.equal(state.runs[0][state.runs[0].indexOf('--sub-langs') + 1], 'en');
  assert.equal(state.runs[1][state.runs[1].indexOf('--sub-langs') + 1], 'en.*,en');
});

test('끝내 받지 못하면 yt-dlp 가 알려 준 이유를 오류 메시지에 담는다', async () => {
  reset();
  const dir = outDir('blocked');
  const reason = 'ERROR: [youtube] vid1: Sign in to confirm your age';
  state.script = [
    { lines: [reason] }, { lines: [reason] },
    { lines: [reason] }, { lines: [reason] },
  ];
  await assert.rejects(
    () => provider.fetchSubtitles(VIDEO, { exePath: 'yt-dlp', outDir: dir }),
    (error) => error.code === 'SUBTITLE_DOWNLOAD_FAILED'
      && /자막을 가져오지 못했습니다/.test(error.message)
      && /YouTube 가 자동 요청을 차단했습니다/.test(error.message)
      && /Sign in to confirm your age/.test(error.detail ?? ''),
  );
  assert.equal(state.runs.length, 4, '클라이언트 2종 × 언어 패턴 2종');
});

test('자막 요청에 --ignore-no-formats-error 를 함께 넘긴다', async () => {
  reset();
  const dir = outDir('formats');
  state.script = [{ files: ['vid1.en.json3'] }];
  await provider.fetchSubtitles(VIDEO, { exePath: 'yt-dlp', outDir: dir });
  assert.equal(provider.IGNORE_NO_FORMATS, '--ignore-no-formats-error');
  assert.ok(state.runs[0].includes(provider.IGNORE_NO_FORMATS), '자막 인자에 포맷 오류 무시 플래그가 있어야 한다');
});

test('yt-dlp 가 종료 코드로 죽어도 다음 클라이언트로 계속 시도한다', async () => {
  reset();
  const dir = outDir('exit');
  const fail = 'yt-dlp 종료 코드 1: ERROR: [youtube] vid1: This video is not available';
  state.script = [{ throw: fail }, { throw: fail }, { files: ['vid1.en.json3'] }];
  const transcript = await provider.fetchSubtitles(VIDEO, { exePath: 'yt-dlp', outDir: dir });
  assert.equal(transcript.segments.length, 1);
  assert.match(state.runs[0].join(' '), /player_client=default,android/);
  assert.match(state.runs[2].join(' '), /player_client=android,ios/);
});

test('모든 시도가 종료 코드로 실패하면 한국어 안내와 함께 실패한다', async () => {
  reset();
  const dir = outDir('allexit');
  const fail = 'yt-dlp 종료 코드 1: ERROR: [youtube] vid1: This video is not available';
  state.script = [{ throw: fail }, { throw: fail }, { throw: fail }, { throw: fail }];
  await assert.rejects(
    () => provider.fetchSubtitles(VIDEO, { exePath: 'yt-dlp', outDir: dir }),
    (error) => error.code === 'SUBTITLE_DOWNLOAD_FAILED'
      && /자막을 가져오지 못했습니다/.test(error.message)
      && /YouTube 가 이 동영상을 제공하지 않습니다/.test(error.message)
      && /This video is not available/.test(error.detail ?? ''),
  );
  assert.equal(state.runs.length, 4, '클라이언트 2종 × 언어 패턴 2종');
});

test('취소는 재시도하지 않고 그대로 올린다', async () => {
  reset();
  const dir = outDir('cancel');
  state.script = [{ throw: '사용자가 수집을 취소했습니다.', code: 'CANCELLED' }];
  await assert.rejects(
    () => provider.fetchSubtitles(VIDEO, { exePath: 'yt-dlp', outDir: dir }),
    (error) => error.code === 'CANCELLED',
  );
  assert.equal(state.runs.length, 1, '취소는 첫 시도에서 바로 끝난다');
});

test('reasonFrom 이 앱 접두어와 [youtube] id 를 걷어낸다', () => {
  assert.equal(
    provider.reasonFrom('yt-dlp 종료 코드 1: ERROR: [youtube] JXvS4VIE0S0: This video is not available'),
    'This video is not available',
  );
  assert.equal(
    provider.friendlyReason('ERROR: [youtube] x: This video is not available'),
    'YouTube 가 이 동영상을 제공하지 않습니다(비공개·삭제·지역 제한 등).',
  );
  assert.equal(provider.friendlyReason('알 수 없는 오류'), '알 수 없는 오류');
});
