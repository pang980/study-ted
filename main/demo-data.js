const db = require('./db');
const channelsDb = require('./db/channels');
const videosDb = require('./db/videos');

const CHANNEL = {
  channelId: 'UCdemoEnglishEmma',
  handle: '@englishwithemma',
  title: 'English with Emma',
  url: 'https://www.youtube.com/@englishwithemma',
  avatarUrl: null,
  subscriberText: '구독자 1.2M',
  videoCountText: '동영상 328개',
  description: '일상에서 배우는 실용 영어! 😊',
};

const VIDEOS = [
  {
    videoId: 'demoVideo001',
    title: 'Morning Routine in English',
    durationSec: 624,
    durationText: '10:24',
    viewCountText: '125만회',
    publishedText: '2주 전',
    description:
      "Let's talk about how to build a simple and realistic morning routine in English! This video will help you learn useful vocabulary and expressions for daily life.",
    hasTranscript: 1,
  },
  {
    videoId: 'demoVideo002',
    title: 'How to Think in English',
    durationSec: 497,
    durationText: '8:17',
    viewCountText: '98만회',
    publishedText: '3주 전',
    description:
      'Stop translating in your head. Here are three simple habits that help you think directly in English.',
    hasTranscript: 0,
  },
  {
    videoId: 'demoVideo003',
    title: 'Useful Phrases at the Airport',
    durationSec: 543,
    durationText: '9:03',
    viewCountText: '72만회',
    publishedText: '1개월 전',
    description: 'Check in, go through security, and find your gate — with the phrases native speakers really use.',
    hasTranscript: 0,
  },
  {
    videoId: 'demoVideo004',
    title: 'A Day in New York',
    durationSec: 688,
    durationText: '11:28',
    viewCountText: '66만회',
    publishedText: '1개월 전',
    description: 'Come with me for a full day in New York City and learn everyday English along the way.',
    hasTranscript: 0,
  },
];

const TRANSCRIPT = {
  videoId: 'demoVideo001',
  lang: 'en',
  kind: 'auto',
  source: 'demo',
  segments: [
    { start: 0, end: 2, text: 'Hi everyone!' },
    { start: 2, end: 5, text: 'Welcome back to my channel.' },
    { start: 5, end: 9.5, text: 'So today, I want to talk about how to build a good morning routine.' },
    { start: 9.5, end: 13, text: 'A morning routine can help you be more productive,' },
    { start: 13, end: 17, text: 'feel happier, and stay focused throughout the day.' },
    { start: 17, end: 21, text: "First, let's talk about waking up early." },
    { start: 21, end: 24, text: "It's not always easy, I know." },
    { start: 24, end: 28, text: 'But even just 15 minutes earlier can make a big difference.' },
    { start: 28, end: 33, text: 'You can use this time to stretch,' },
    { start: 33, end: 37, text: "drink some water, or write down three things you're grateful for." },
    { start: 37, end: 41, text: "Second, don't check your phone right away." },
    { start: 41, end: 46, text: 'Your morning mind is quiet and clear.' },
    { start: 46, end: 51, text: 'Use that quiet time to plan your day.' },
    { start: 51, end: 55, text: 'Small steps make big progress.' },
    { start: 55, end: 60, text: 'Thanks for watching, and see you next time!' },
  ],
};

const ANALYSIS_ROUTINE = {
  translation: '그래서 오늘은 좋은 아침 루틴을 어떻게 만들어야 할지에 대해 이야기하고 싶어요.',
  structure: [
    { part: 'So today,', meaning: '그래서 오늘은', note: '시간을 나타내는 부사구' },
    { part: 'I want to talk about', meaning: '~에 대해 이야기하고 싶다', note: 'want to + 동사원형' },
    { part: 'how to build', meaning: '어떻게 만들지', note: '의문사 + to부정사, "방법"을 나타냄' },
    { part: 'a good morning routine', meaning: '좋은 아침 루틴', note: '목적어' },
  ],
};

const SENTENCES = [
  {
    sentence: 'So today, I want to talk about how to build a good morning routine.',
    translation: ANALYSIS_ROUTINE.translation,
    analysis: ANALYSIS_ROUTINE,
    videoId: 'demoVideo001',
    videoTitle: 'Morning Routine in English',
    videoUrl: 'https://www.youtube.com/watch?v=demoVideo001',
    startSec: 5,
    createdAt: '2024-03-10 09:12:00',
    isFavorite: 1,
  },
  {
    sentence: 'A small change can make a big difference.',
    translation: '작은 변화도 큰 차이를 만들 수 있어요.',
    analysis: null,
    videoId: 'demoVideo001',
    videoTitle: 'Morning Routine in English',
    videoUrl: 'https://www.youtube.com/watch?v=demoVideo001',
    startSec: null,
    createdAt: '2024-03-10 09:20:00',
    isFavorite: 0,
  },
  {
    sentence: "I'm really excited to be here.",
    translation: '여기에 오게 되어 정말 기뻐요.',
    analysis: null,
    videoId: 'demoVideo004',
    videoTitle: 'A Day in New York',
    videoUrl: 'https://www.youtube.com/watch?v=demoVideo004',
    startSec: null,
    createdAt: '2024-03-09 21:04:00',
    isFavorite: 0,
  },
  {
    sentence: "Don't be afraid to make mistakes.",
    translation: '실수하는 것을 두려워하지 마세요.',
    analysis: null,
    videoId: 'demoVideo002',
    videoTitle: 'How to Think in English',
    videoUrl: 'https://www.youtube.com/watch?v=demoVideo002',
    startSec: null,
    createdAt: '2024-03-08 18:41:00',
    isFavorite: 0,
  },
];

const VIDEO_IDS = VIDEOS.map((video) => video.videoId);

function placeholders(values) {
  return values.map(() => '?').join(', ');
}

function counts() {
  const one = (sql, params = []) => {
    const row = db.get(sql, params);
    return row ? row.c : 0;
  };
  return {
    channels: one('SELECT COUNT(*) AS c FROM channels'),
    videos: one('SELECT COUNT(*) AS c FROM videos'),
    transcripts: one('SELECT COUNT(*) AS c FROM transcripts'),
    sentences: one('SELECT COUNT(*) AS c FROM sentences'),
  };
}

function isSeeded() {
  const row = db.get('SELECT COUNT(*) AS c FROM channels WHERE channel_id = ?', [CHANNEL.channelId]);
  return Boolean(row && row.c);
}

function clear() {
  const list = placeholders(VIDEO_IDS);
  db.tx(() => {
    db.run(`DELETE FROM sentences WHERE video_id IN (${list}) OR source = 'demo'`, VIDEO_IDS);
    db.run(`DELETE FROM transcripts WHERE video_id IN (${list})`, VIDEO_IDS);
    db.run(`DELETE FROM videos WHERE video_id IN (${list})`, VIDEO_IDS);
    db.run('DELETE FROM channels WHERE channel_id = ?', [CHANNEL.channelId]);
  });
  return { removed: true };
}

function seed({ force = false } = {}) {
  if (!force && isSeeded()) {
    return {
      seeded: false,
      reason: '이미 데모 데이터가 있습니다.',
      channelId: CHANNEL.channelId,
      added: { channels: 0, videos: 0, transcripts: 0, sentences: 0 },
    };
  }
  if (force) clear();

  const added = { channels: 0, videos: 0, transcripts: 0, sentences: 0 };
  let channelPk = null;

  db.tx(() => {
    const channel = channelsDb.upsert(CHANNEL);
    channelPk = channel.pk;
    added.channels = 1;

    for (const video of VIDEOS) {
      videosDb.upsert({
        ...video,
        url: `https://www.youtube.com/watch?v=${video.videoId}`,
        channelPk,
        channelId: CHANNEL.channelId,
        thumbnailUrl: null,
      });
      added.videos += 1;
    }

    db.run(
      `INSERT INTO transcripts (video_id, video_pk, lang, kind, source, segments_json, plain_text, segment_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(video_id) DO UPDATE SET
         segments_json = excluded.segments_json,
         plain_text = excluded.plain_text,
         segment_count = excluded.segment_count,
         updated_at = datetime('now')`,
      [
        TRANSCRIPT.videoId,
        videosDb.getByVideoId(TRANSCRIPT.videoId).pk,
        TRANSCRIPT.lang,
        TRANSCRIPT.kind,
        TRANSCRIPT.source,
        JSON.stringify(TRANSCRIPT.segments),
        TRANSCRIPT.segments.map((segment) => segment.text).join(' '),
        TRANSCRIPT.segments.length,
      ],
    );
    added.transcripts = 1;

    for (const item of SENTENCES) {
      const video = videosDb.getByVideoId(item.videoId);
      db.run(
        `INSERT INTO sentences (video_pk, video_id, video_title, video_url, channel_pk, sentence, translation,
                                analysis_json, source, start_sec, is_favorite, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          video ? video.pk : null,
          item.videoId,
          item.videoTitle,
          item.videoUrl,
          channelPk,
          item.sentence,
          item.translation,
          item.analysis ? JSON.stringify(item.analysis) : null,
          'demo',
          item.startSec,
          item.isFavorite ? 1 : 0,
          item.createdAt,
          item.createdAt,
        ],
      );
      added.sentences += 1;
    }
  });

  return { seeded: true, channelId: CHANNEL.channelId, added };
}

module.exports = { seed, clear, isSeeded, counts, CHANNEL, VIDEOS, TRANSCRIPT, SENTENCES };
