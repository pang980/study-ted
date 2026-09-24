const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'study-ted-test-'));
const dbPath = path.join(tmpDir, 'test.db');

const db = require('../main/db');
const channels = require('../main/db/channels');
const videos = require('../main/db/videos');
const transcripts = require('../main/db/transcripts');
const sentences = require('../main/db/sentences');
const settings = require('../main/db/settings');
const demo = require('../main/demo-data');

db.init(dbPath);

test.after(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('스키마가 만들어지고 필수 테이블이 존재한다', () => {
  const rows = db.all(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  const names = rows.map((row) => row.name);
  for (const table of ['channels', 'videos', 'transcripts', 'sentences', 'settings', 'meta']) {
    assert.ok(names.includes(table), `${table} 테이블이 있어야 한다`);
  }
  const version = db.get(`SELECT value FROM meta WHERE key = 'schema_version'`);
  assert.equal(version.value, String(db.migrations.length));
  assert.equal(db.getDb() === db.getDb(), true);
});

test('channels upsert 가 갱신하고 목록/삭제가 동작한다', () => {
  const created = channels.upsert({
    channelId: 'UCtest000000000000000001',
    handle: '@testchannel',
    title: 'Test Channel',
    url: 'https://www.youtube.com/@testchannel',
    subscriberText: '구독자 10만',
    videoCountText: '동영상 12개',
    description: 'test',
  });
  assert.ok(created.pk > 0);
  assert.equal(created.channelId, 'UCtest000000000000000001');

  const updated = channels.upsert({
    channelId: 'UCtest000000000000000001',
    handle: '@testchannel',
    title: 'Test Channel 2',
    url: 'https://www.youtube.com/@testchannel',
  });
  assert.equal(updated.pk, created.pk);
  assert.equal(updated.title, 'Test Channel 2');
  assert.equal(updated.subscriberText, '구독자 10만');

  assert.equal(channels.list().length, 1);
  assert.equal(channels.getByChannelId('UCtest000000000000000001').pk, created.pk);
  assert.equal(channels.getByPk(created.pk).title, 'Test Channel 2');

  const synced = channels.touchSync(created.pk);
  assert.ok(synced.lastSyncedAt);

  assert.equal(channels.remove(created.pk), 1);
  assert.equal(channels.list().length, 0);
});

test('videos upsert 와 조회 옵션이 동작한다', () => {
  const channel = channels.upsert({
    channelId: 'UCvideo00000000000000001',
    title: 'Video Channel',
    url: 'https://www.youtube.com/@videochannel',
  });
  videos.upsert({
    videoId: 'vid00000001',
    channelPk: channel.pk,
    channelId: channel.channelId,
    title: 'First video',
    url: 'https://www.youtube.com/watch?v=vid00000001',
    durationSec: 120,
    durationText: '2:00',
    thumbnailUrl: null,
  });
  videos.upsert({
    videoId: 'vid00000002',
    channelPk: channel.pk,
    channelId: channel.channelId,
    title: 'Second video',
    url: 'https://www.youtube.com/watch?v=vid00000002',
    durationSec: 300,
    durationText: '5:00',
    hasTranscript: 1,
  });
  videos.upsert({ videoId: 'vid00000003', title: 'Other channel video', url: 'https://www.youtube.com/watch?v=vid00000003' });

  const first = videos.getByVideoId('vid00000001');
  assert.equal(first.channelTitle, 'Video Channel');
  assert.equal(first.durationSec, 120);
  assert.equal(first.hasTranscript, 0);

  const list = videos.list({ channelPk: channel.pk });
  assert.equal(list.length, 2);
  assert.ok(list.every((video) => video.channelTitle === 'Video Channel'));
  assert.equal(videos.list({ channelPk: channel.pk, limit: 1 }).length, 1);

  const without = videos.listWithoutTranscript({ channelPk: channel.pk });
  assert.deepEqual(without.map((video) => video.videoId), ['vid00000001']);

  videos.setHasTranscript('vid00000001', 1);
  assert.equal(videos.getByVideoId('vid00000001').hasTranscript, 1);
  assert.equal(videos.getByPk(videos.getByVideoId('vid00000002').pk).videoId, 'vid00000002');
  assert.equal(videos.count(), 3);

  // 채널 행에 표시하는 수집 개수(동영상/자막/문장)
  const counted = channels.getByPk(channel.pk);
  assert.equal(counted.savedVideoCount, 2);
  assert.equal(counted.savedTranscriptCount, 0);
  assert.equal(counted.savedSentenceCount, 0);
});

test('videos list/count 가 검색어와 페이징을 처리한다', () => {
  const channel = channels.upsert({
    channelId: 'UCsearch0000000000000001',
    title: 'Search Channel',
    url: 'https://www.youtube.com/@searchchannel',
  });
  const seed = [
    { videoId: 'srh00000001', title: 'Alpha clip', description: 'first note' },
    { videoId: 'srh00000002', title: 'Beta clip', description: 'second note' },
    { videoId: 'srh00000003', title: 'Gamma 100% sure', description: 'third note' },
  ];
  for (const item of seed) {
    videos.upsert({ ...item, channelPk: channel.pk, channelId: channel.channelId, url: `https://www.youtube.com/watch?v=${item.videoId}` });
  }

  assert.equal(videos.count({ channelPk: channel.pk }), 3);
  assert.equal(videos.list({ channelPk: channel.pk }).length, 3);

  // 제목/설명 어느 쪽이 맞아도 찾는다.
  assert.deepEqual(videos.list({ channelPk: channel.pk, q: 'Alpha' }).map((video) => video.videoId), ['srh00000001']);
  assert.equal(videos.list({ channelPk: channel.pk, q: 'clip' }).length, 2);
  assert.equal(videos.list({ channelPk: channel.pk, q: 'second note' }).length, 1);
  assert.equal(videos.list({ channelPk: channel.pk, q: '없는 제목' }).length, 0);
  assert.equal(videos.count({ channelPk: channel.pk, q: 'clip' }), 2);

  // LIKE 와일드카드는 문자로 취급한다(% 가 전체를 잡아오면 안 된다).
  assert.deepEqual(videos.list({ channelPk: channel.pk, q: '100%' }).map((video) => video.videoId), ['srh00000003']);
  assert.deepEqual(videos.list({ channelPk: channel.pk, q: '%' }).map((video) => video.videoId), ['srh00000003']);
  assert.equal(videos.list({ channelPk: channel.pk, q: '_' }).length, 0);

  // 페이지를 나눠 읽어도 겹침/누락 없이 전체를 덮는다.
  const firstPage = videos.list({ channelPk: channel.pk, limit: 2, offset: 0 });
  const secondPage = videos.list({ channelPk: channel.pk, limit: 2, offset: 2 });
  assert.equal(firstPage.length, 2);
  assert.equal(secondPage.length, 1);
  const ids = [...firstPage, ...secondPage].map((video) => video.videoId).sort();
  assert.deepEqual(ids, ['srh00000001', 'srh00000002', 'srh00000003']);

  // 다른 채널의 동영상은 검색 결과에 섞이지 않는다.
  assert.equal(videos.count({ q: 'Alpha' }), 1);

  channels.remove(channel.pk);
});

test('videos upsert 가 refresh=false 일 때 기존 메타데이터를 유지한다', () => {
  videos.upsert({
    videoId: 'vidrefresh01',
    title: '처음 제목',
    url: 'https://www.youtube.com/watch?v=vidrefresh01',
    viewCountText: '조회수 10회',
  });
  const first = videos.getByVideoId('vidrefresh01');
  assert.equal(first.title, '처음 제목');

  // 기본값(refresh=true)은 기존처럼 메타데이터를 갱신한다.
  videos.upsert({
    videoId: 'vidrefresh01',
    title: '갱신된 제목',
    url: 'https://www.youtube.com/watch?v=vidrefresh01',
    viewCountText: '조회수 99회',
  });
  assert.equal(videos.getByVideoId('vidrefresh01').title, '갱신된 제목');
  assert.equal(videos.getByVideoId('vidrefresh01').viewCountText, '조회수 99회');

  // refresh=false 이면 이미 있는 행을 그대로 두고 건너뛴다.
  const kept = videos.upsert(
    {
      videoId: 'vidrefresh01',
      title: '무시될 제목',
      url: 'https://www.youtube.com/watch?v=vidrefresh01',
      viewCountText: '조회수 0회',
    },
    { refresh: false },
  );
  assert.equal(kept.pk, first.pk);
  assert.equal(kept.title, '갱신된 제목');
  assert.equal(kept.viewCountText, '조회수 99회');

  // 신규 동영상은 refresh=false 라도 새로 저장된다.
  const created = videos.upsert(
    { videoId: 'vidrefresh02', title: '새 영상', url: 'https://www.youtube.com/watch?v=vidrefresh02' },
    { refresh: false },
  );
  assert.equal(created.title, '새 영상');
});

test('transcripts upsert 가 세그먼트를 저장하고 잘못된 JSON 을 방어한다', () => {
  const video = videos.getByVideoId('vid00000001');
  const saved = transcripts.upsert({
    videoId: 'vid00000001',
    videoPk: video.pk,
    lang: 'en',
    kind: 'manual',
    source: 'ytdlp',
    segments: [{ start: 0, end: 1, text: 'Hello' }, { start: 1, end: 2, text: 'World' }],
    plainText: 'Hello World',
  });
  assert.equal(saved.segmentCount, 2);
  assert.deepEqual(saved.segments.map((segment) => segment.text), ['Hello', 'World']);

  transcripts.upsert({
    videoId: 'vid00000001',
    videoPk: video.pk,
    lang: 'en',
    kind: 'manual',
    source: 'ytdlp',
    segments: [{ start: 0, end: 3, text: 'Hello World again' }],
    plainText: 'Hello World again',
  });
  const replaced = transcripts.getByVideoId('vid00000001');
  assert.equal(replaced.segmentCount, 1);
  assert.equal(replaced.plainText, 'Hello World again');

  db.run(`UPDATE transcripts SET segments_json = 'not json' WHERE video_id = ?`, ['vid00000001']);
  assert.deepEqual(transcripts.getByVideoId('vid00000001').segments, []);
  assert.equal(transcripts.getByPk(replaced.pk).videoId, 'vid00000001');
  assert.equal(transcripts.count(), 1);
  assert.equal(channels.getByPk(video.channelPk).savedTranscriptCount, 1);
});

test('sentences CRUD 와 검색/정렬이 동작한다', () => {
  const video = videos.getByVideoId('vid00000002');
  const first = sentences.create({
    videoPk: video.pk,
    videoId: video.videoId,
    videoTitle: video.title,
    videoUrl: video.url,
    channelPk: video.channelPk,
    sentence: 'Small steps make big progress.',
    translation: '작은 걸음이 큰 발전을 만든다.',
    analysis: { translation: '해석', structure: [] },
    startSec: 12.5,
  });
  assert.equal(first.isFavorite, false);
  assert.equal(first.analysis.translation, '해석');

  const second = sentences.create({
    videoPk: video.pk,
    videoId: video.videoId,
    videoTitle: video.title,
    videoUrl: video.url,
    sentence: 'I am grateful for today.',
    translation: '오늘 하루에 감사한다.',
  });
  assert.equal(second.source, 'manual');

  assert.equal(sentences.count(), 2);
  assert.equal(channels.getByPk(video.channelPk).savedSentenceCount, 1);
  assert.equal(sentences.list().total, 2);
  assert.equal(sentences.list().items[0].pk, second.pk);

  const byQuery = sentences.list({ q: 'progress' });
  assert.equal(byQuery.total, 1);
  assert.equal(byQuery.items[0].pk, first.pk);

  const byTranslation = sentences.list({ q: '감사' });
  assert.equal(byTranslation.total, 1);
  assert.equal(byTranslation.items[0].pk, second.pk);

  assert.equal(sentences.list({ sort: 'sentence' }).items[0].pk, second.pk);

  const favorited = sentences.toggleFavorite(first.pk);
  assert.equal(favorited.isFavorite, true);
  assert.equal(sentences.list({ favoriteOnly: true }).total, 1);
  assert.equal(sentences.toggleFavorite(first.pk).isFavorite, false);

  assert.equal(sentences.incrementStudy(first.pk).studyCount, 1);

  const updated = sentences.update(first.pk, { translation: '다시 쓴 해석' });
  assert.equal(updated.translation, '다시 쓴 해석');

  const exported = sentences.exportAll();
  assert.equal(exported.length, 2);
  assert.equal(exported.find((row) => row.sentence.startsWith('Small')).analysis.translation, '해석');

  assert.equal(sentences.remove(second.pk), 1);
  assert.equal(sentences.getByPk(second.pk), null);
  assert.equal(sentences.count(), 1);
});

test('settings 가 기본값/모델 기록/키 저장을 처리한다', () => {
  const defaults = settings.publicSettings();
  assert.equal(defaults.provider, 'auto');
  assert.equal(defaults.collectLimit, 24);
  assert.equal(defaults.withSubtitles, true);
  assert.equal(defaults.refreshExisting, true);
  assert.equal(defaults.lastView, 'home');
  assert.deepEqual(defaults.recentModels, []);
  assert.deepEqual(defaults.favoriteModels, []);
  assert.equal(defaults.hasKey, false);

  assert.equal(settings.getValue('collect.provider', 'auto'), 'auto');
  assert.deepEqual(settings.getJson('probe.roundtrip', { fallback: true }), { fallback: true });
  settings.setJson('probe.roundtrip', { 'a/b': 3 });
  assert.deepEqual(settings.getJson('probe.roundtrip', {}), { 'a/b': 3 });
  settings.setRaw('probe.broken', 'not json');
  assert.deepEqual(settings.getJson('probe.broken', { safe: true }), { safe: true });

  settings.markModelUsed('openai/gpt-4o-mini');
  settings.markModelUsed('anthropic/claude-3.5');
  const recent = settings.markModelUsed('openai/gpt-4o-mini');
  assert.deepEqual(recent, ['openai/gpt-4o-mini', 'anthropic/claude-3.5']);
  assert.deepEqual(settings.mostUsedModels(5)[0], { id: 'openai/gpt-4o-mini', used: 2 });

  assert.deepEqual(settings.toggleFavoriteModel('openai/gpt-4o-mini'), ['openai/gpt-4o-mini']);
  assert.deepEqual(settings.toggleFavoriteModel('openai/gpt-4o-mini'), []);

  const saved = settings.setApiKey('sk-or-v1-testtesttest');
  assert.equal(saved.hasKey, true);
  assert.equal(saved.encryptionAvailable, false);
  assert.equal(settings.getApiKey(), 'sk-or-v1-testtesttest');
  const public2 = settings.publicSettings();
  assert.equal(public2.hasKey, true);
  assert.equal(public2.keyMask, 'sk-or-v******test');
  assert.ok(public2.keyUpdatedAt);

  settings.clearApiKey();
  assert.equal(settings.getApiKey(), '');
  assert.equal(settings.publicSettings().hasKey, false);

  settings.setRaw('collect.refreshExisting', '0');
  assert.equal(settings.publicSettings().refreshExisting, false);
  settings.setRaw('collect.refreshExisting', '1');
  assert.equal(settings.publicSettings().refreshExisting, true);

  settings.setRaw('ui.lastView', 'notes');
  assert.equal(settings.publicSettings().lastView, 'notes');
  assert.equal(settings.getRaw('missing.key'), null);
});

test('데모 데이터 시딩과 초기화가 일관된다', () => {
  assert.equal(demo.isSeeded(), false);
  const before = demo.counts();
  const seeded = demo.seed({ force: true });
  assert.equal(seeded.seeded, true);
  assert.deepEqual(seeded.added, { channels: 1, videos: 4, transcripts: 1, sentences: 4 });
  assert.deepEqual(demo.counts(), {
    channels: before.channels + 1,
    videos: before.videos + 4,
    transcripts: before.transcripts + 1,
    sentences: before.sentences + 4,
  });
  assert.equal(demo.isSeeded(), true);

  const again = demo.seed({});
  assert.equal(again.seeded, false);
  assert.equal(demo.counts().sentences, before.sentences + 4);

  const list = sentences.list();
  assert.equal(list.total, before.sentences + 4);
  assert.equal(list.items.filter((item) => item.isFavorite).length, 1);

  const transcript = transcripts.getByVideoId(demo.TRANSCRIPT.videoId);
  assert.equal(transcript.segments.length, demo.TRANSCRIPT.segments.length);
  assert.equal(transcript.segmentCount, 15);

  demo.clear();
  assert.deepEqual(demo.counts(), before);
  assert.equal(sentences.list().total, before.sentences);
});
