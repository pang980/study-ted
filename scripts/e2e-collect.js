// 실제 유튜브 채널을 대상으로 수집 파이프라인(채널 → 영상 목록 → 자막 → DB 저장)을 검증한다.
// 실행: npm run e2e -- --url=<채널 주소> --limit=<개수> [--native]
// 예시: npm run e2e -- --url=https://www.youtube.com/@TED --limit=3
// 옵션: --fresh 로 임시 DB 초기화, --cancel-after=<ms> --cancel-limit=<개수> 로 취소 동작 확인.
// 주의: 채널 주소는 반드시 --url= 형태로 넘긴다.
//       Electron 은 위치 인자로 들어온 URL 을 '열어야 할 주소'로 해석해서 스크립트를 실행하지 않는다.
process.env.STUDY_TED_SMOKE = '1';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const rootDir = path.join(__dirname, '..');
function readOption(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

const channelUrl = readOption('url') || process.env.STUDY_TED_E2E_URL || 'https://www.youtube.com/@TED';
const limit = Number(readOption('limit')) > 0 ? Number(readOption('limit')) : 3;
// --cancel-after=<ms> 를 주면 대량 수집을 시작한 뒤 그 시간 뒤에 정지시켜 취소 동작을 검증한다.
const cancelAfter = Number(readOption('cancel-after')) > 0 ? Number(readOption('cancel-after')) : 0;
const cancelLimit = Number(readOption('cancel-limit')) > 0 ? Number(readOption('cancel-limit')) : 200;
const provider = process.argv.includes('--native') ? 'native' : 'auto';

// 사용자의 실제 DB 를 건드리지 않도록 임시 userData 를 쓴다.
const userDataDir = path.join(rootDir, '_tmp', 'e2e-userdata');
// --fresh 를 주면 지난 실행의 임시 DB 를 지워 항상 같은 조건에서 검증한다.
if (process.argv.includes('--fresh')) {
  fs.rmSync(path.join(userDataDir, 'study-ted.db'), { force: true });
}
fs.mkdirSync(userDataDir, { recursive: true });
app.setPath('userData', userDataDir);

const paths = require('../main/paths');
const db = require('../main/db');
const settingsDb = require('../main/db/settings');
const videosDb = require('../main/db/videos');
const transcriptsDb = require('../main/db/transcripts');
const collect = require('../main/collect');

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name} :: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

async function run() {
  db.init(paths.dbPath());

  const exePath = path.join(rootDir, '_tmp', 'yt-dlp.exe');
  if (fs.existsSync(exePath)) settingsDb.setRaw('collect.ytdlpPath', exePath);
  const status = collect.providerStatus();
  console.log(`[INFO] provider preference=${status.preference} active=${status.active} ytdlp=${status.ytdlp.source || '-'} ${status.ytdlp.version || ''}`);

  const started = Date.now();
  const phases = [];
  const sync = await collect.syncChannel({
    url: channelUrl,
    limit,
    provider,
    withSubtitles: true,
    onProgress: (payload) => {
      if (phases[phases.length - 1] !== payload.phase) phases.push(payload.phase);
      console.log(`[INFO] ${payload.phase} ${payload.done}/${payload.total} ${payload.message || ''}`);
    },
  });

  record('채널 정보 수집', Boolean(sync.channel && sync.channel.title), {
    title: sync.channel && sync.channel.title,
    channelId: sync.channel && sync.channel.channelId,
    subscriberText: sync.channel && sync.channel.subscriberText,
    provider: sync.provider,
    listWarning: sync.listWarning || null,
    elapsedMs: Date.now() - started,
  });
  record('영상 목록 수집', sync.videoCount > 0, { count: sync.videoCount });

  const saved = videosDb.list({ channelPk: sync.channel.pk, limit: 10 });
  record('DB 영상 저장', saved.length === sync.videoCount, {
    saved: saved.length,
    titles: saved.map((video) => video.title),
    hasTranscript: saved.filter((video) => video.hasTranscript).length,
  });

  record('진행 단계 이벤트', phases.includes('subtitle') || phases.includes('done'), phases);
  record('자막 수집', sync.transcriptCount > 0, {
    transcriptCount: sync.transcriptCount,
    failures: sync.failures.slice(0, 3),
  });

  const withSubtitle = saved.find((video) => video.hasTranscript);
  if (withSubtitle) {
    const transcript = transcriptsDb.getByVideoId(withSubtitle.videoId);
    record('자막 DB 저장', Boolean(transcript && transcript.segments && transcript.segments.length), {
      videoId: withSubtitle.videoId,
      lang: transcript && transcript.lang,
      kind: transcript && transcript.kind,
      segments: transcript && transcript.segments ? transcript.segments.length : 0,
      firstLine: transcript && transcript.segments ? transcript.segments[0].text : null,
    });
  }

  const counts = {
    channels: db.get('SELECT COUNT(*) AS c FROM channels').c,
    videos: db.get('SELECT COUNT(*) AS c FROM videos').c,
    transcripts: db.get('SELECT COUNT(*) AS c FROM transcripts').c,
  };
  record('최종 집계', counts.channels > 0 && counts.videos > 0, counts);

  // 같은 채널을 다시 수집할 때 기존 영상 메타를 건너뛰는 옵션(refreshExisting=false)을 검증한다.
  const beforeCount = counts.videos;
  const second = await collect.syncChannel({
    url: channelUrl,
    limit,
    provider,
    withSubtitles: false,
    refreshExisting: false,
  });
  const afterCount = db.get('SELECT COUNT(*) AS c FROM videos').c;
  record('기존 영상 메타 건너뛰기', second.keptCount > 0 && afterCount === beforeCount, {
    keptCount: second.keptCount,
    addedCount: second.addedCount,
    refreshExisting: second.refreshExisting,
    beforeCount,
    afterCount,
  });

  if (cancelAfter > 0) await verifyCancel();
}

// 자막을 수천 개 받는 상황을 가정해 수집을 시작하고 중간에 정지시킨다.
async function verifyCancel() {
  const jobId = 'job-e2e-cancel';
  const cancelStarted = Date.now();
  const timer = setTimeout(() => collect.cancel(jobId), cancelAfter);
  let error = null;
  try {
    await collect.syncChannel({ url: channelUrl, jobId, limit: cancelLimit, provider, withSubtitles: true });
  } catch (caught) {
    error = caught;
  } finally {
    clearTimeout(timer);
  }
  const detail = (error && error.detail) || {};
  const elapsedMs = Date.now() - cancelStarted;

  record('수집 중 정지 요청이 즉시 반영된다', Boolean(error && error.code === 'CANCELLED'), {
    code: error ? error.code : null,
    message: error ? error.message : '취소되지 않고 끝까지 수집했습니다.',
    elapsedMs,
  });
  record('정지 시점까지의 결과가 보존된다', detail.cancelled === true, {
    videoCount: detail.videoCount,
    addedCount: detail.addedCount,
    transcriptCount: detail.transcriptCount,
  });
  record('정지 후에도 저장된 자료는 유지된다', db.get('SELECT COUNT(*) AS c FROM videos').c > 0, {
    videos: db.get('SELECT COUNT(*) AS c FROM videos').c,
    transcripts: db.get('SELECT COUNT(*) AS c FROM transcripts').c,
  });
}

app.whenReady().then(async () => {
  try {
    await run();
  } catch (error) {
    record('E2E 실행', false, error.code ? `${error.code} :: ${error.message}` : (error.stack || error.message));
  } finally {
    const failed = results.filter((item) => !item.ok);
    console.log('');
    console.log(`총 ${results.length}개 확인 / 실패 ${failed.length}개`);
    try { db.close(); } catch { /* 종료 중 정리 실패는 무시한다. */ }
    app.exit(failed.length ? 1 : 0);
  }
});
