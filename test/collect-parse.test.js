const test = require('node:test');
const assert = require('node:assert/strict');

const net = require('../main/collect/net');
const native = require('../main/collect/native-provider');

test('parseChannelInput 이 주소 형태를 해석한다', () => {
  assert.deepEqual(native.parseChannelInput('https://www.youtube.com/@englishwithemma'), {
    handle: '@englishwithemma',
    channelId: null,
    baseUrl: 'https://www.youtube.com/@englishwithemma',
  });
  assert.equal(native.parseChannelInput('@englishwithemma').handle, '@englishwithemma');
  assert.equal(native.parseChannelInput('englishwithemma').handle, 'englishwithemma');
  assert.equal(native.parseChannelInput('https://www.youtube.com/c/SomeChannel').handle, 'c/SomeChannel');

  const byId = native.parseChannelInput('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv');
  assert.equal(byId.channelId, 'UCabcdefghijklmnopqrstuv');
  assert.equal(byId.baseUrl, 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv');
  assert.equal(native.parseChannelInput('UCabcdefghijklmnopqrstuv').channelId, 'UCabcdefghijklmnopqrstuv');
});

test('parseChannelInput 이 잘못된 입력을 거부한다', () => {
  assert.throws(() => native.parseChannelInput(''), (error) => error.code === 'CHANNEL_INPUT_EMPTY');
  assert.throws(() => native.parseChannelInput('   '), (error) => error.code === 'CHANNEL_INPUT_EMPTY');
  assert.throws(
    () => native.parseChannelInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    (error) => error.code === 'CHANNEL_INPUT_INVALID',
  );
});

test('extractJsonAfter 가 중첩 객체와 문자열 중괄호를 처리한다', () => {
  const html = 'var ytInitialData = {"a":{"b":"}{ inside"},"c":[{"d":1},{"d":2}],"e":"x\\\\"};\nvar other = 1;';
  const parsed = net.extractJsonAfter(html, 'var ytInitialData = ');
  assert.equal(parsed.a.b, '}{ inside');
  assert.equal(parsed.c.length, 2);
  assert.equal(parsed.e, 'x\\');
  assert.equal(net.extractJsonAfter(html, 'var missing = '), null);
  assert.equal(net.extractJsonAfter('var ytInitialData = not-json;', 'var ytInitialData = '), null);
});

test('extractMeta 가 속성 순서와 무관하게 메타를 읽는다', () => {
  const html = [
    '<meta property="og:title" content="English with Emma">',
    '<meta content="https://example.com/a.png" property="og:image">',
    '<meta name="description" content="Daily English">',
  ].join('');
  assert.equal(net.extractMeta(html, 'og:title'), 'English with Emma');
  assert.equal(net.extractMeta(html, 'og:image'), 'https://example.com/a.png');
  assert.equal(net.extractMeta(html, 'description'), 'Daily English');
  assert.equal(net.extractMeta(html, 'og:url'), null);
});

test('matchFirst/deepFind/deepCollect 가 노드를 찾는다', () => {
  assert.equal(net.matchFirst('key:"abc"', /key:"([^"]+)"/), 'abc');
  assert.equal(net.matchFirst('nope', /key:"([^"]+)"/), null);
  const tree = { a: { b: { target: true, list: [{ n: 1 }] } } };
  assert.equal(net.deepFind(tree, (node) => node?.target)?.target, true);
  assert.equal(net.deepFind(tree, (node) => node?.missing), null);
  assert.equal(net.deepCollect(tree, (node) => typeof node?.n === 'number').length, 1);
  assert.equal(net.deepCollect(tree, () => true, 2).length, 2);
});

test('extractChannelMeta 가 HTML 에서 채널 정보를 뽑는다', () => {
  const initialData = {
    metadata: {
      channelMetadataRenderer: { title: 'English with Emma' },
    },
    header: {
      pageHeaderRenderer: {
        content: {
          pageHeaderViewModel: {
            metadata: {
              contentMetadataViewModel: {
                metadataRows: [
                  { metadataParts: [{ text: { content: '10.9M subscribers' } }] },
                  { metadataParts: [{ text: { content: '4.4K videos' } }, { text: { content: '@englishwithemma' } }] },
                ],
              },
            },
          },
        },
      },
    },
  };
  const html = [
    '<html><head>',
    '<meta property="og:title" content="English with Emma - YouTube">',
    '<meta property="og:image" content="https://example.com/avatar.jpg">',
    '<meta property="og:description" content="Daily English lessons">',
    '</head><body>',
    '"externalId":"UCabcdefghijklmnopqrstuv"',
    `var ytInitialData = ${JSON.stringify(initialData)};`,
    '</body></html>',
  ].join('');

  const meta = native.extractChannelMeta(html);
  assert.equal(meta.channelId, 'UCabcdefghijklmnopqrstuv');
  assert.equal(meta.title, 'English with Emma');
  assert.equal(meta.avatarUrl, 'https://example.com/avatar.jpg');
  assert.equal(meta.description, 'Daily English lessons');
  assert.equal(meta.subscriberText, '10.9M subscribers');
  assert.equal(meta.videoCountText, '4.4K videos');

  const fallback = native.extractChannelMeta('<html><meta property="og:title" content="Solo - YouTube"></html>');
  assert.equal(fallback.channelId, null);
  assert.equal(fallback.title, 'Solo');
});

test('extractVideoEntries 가 videoRenderer 와 lockup 을 모두 읽는다', () => {
  const data = {
    contents: [
      {
        videoRenderer: {
          videoId: 'aaaaaaaaaaa',
          title: { runs: [{ text: 'Morning ' }, { text: 'Routine' }] },
          lengthText: { simpleText: '10:24' },
          viewCountText: { simpleText: '125만회' },
          publishedTimeText: { simpleText: '2주 전' },
          ownerText: { runs: [{ text: 'English with Emma' }] },
          thumbnail: { thumbnails: [{ url: 'small.jpg', width: 120 }, { url: 'big.jpg', width: 480 }] },
        },
      },
      {
        richItemRenderer: {
          content: {
            lockupViewModel: {
              contentId: 'bbbbbbbbbbb',
              contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
              metadata: {
                lockupMetadataViewModel: {
                  title: { content: 'How to Think in English' },
                  metadata: {
                    contentMetadataViewModel: {
                      metadataRows: [
                        { metadataParts: [{ text: { content: 'English with Emma' } }] },
                        { metadataParts: [{ text: { content: '980K views' } }] },
                        { metadataParts: [{ text: { content: '3 days ago' } }] },
                      ],
                    },
                  },
                },
              },
              thumbnailBadgeViewModel: { text: '8:17' },
              contentImage: {
                thumbnailViewModel: { image: { sources: [{ url: 'l.jpg', width: 100 }, { url: 'xl.jpg', width: 800 }] } },
              },
            },
          },
        },
      },
      { videoRenderer: { videoId: 'aaaaaaaaaaa', title: { simpleText: 'dup' } } },
      { videoRenderer: { videoId: 'short', title: { simpleText: 'too short id' } } },
    ],
  };

  const entries = native.extractVideoEntries(data);
  assert.equal(entries.length, 2);

  assert.deepEqual(entries[0], {
    videoId: 'aaaaaaaaaaa',
    title: 'Morning Routine',
    url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
    durationText: '10:24',
    viewCountText: '125만회',
    publishedText: '2주 전',
    thumbnailUrl: 'big.jpg',
    channelTitle: 'English with Emma',
    meta: [],
  });

  assert.equal(entries[1].videoId, 'bbbbbbbbbbb');
  assert.equal(entries[1].title, 'How to Think in English');
  assert.equal(entries[1].url, 'https://www.youtube.com/watch?v=bbbbbbbbbbb');
  assert.equal(entries[1].durationText, '8:17');
  assert.equal(entries[1].viewCountText, '980K views');
  assert.equal(entries[1].publishedText, '3 days ago');
  assert.equal(entries[1].thumbnailUrl, 'xl.jpg');
  assert.equal(entries[1].channelTitle, 'English with Emma');

  assert.deepEqual(native.extractVideoEntries({}), []);
});

test('pickCaptionTrack 이 수동 영어 자막을 우선한다', () => {
  const manual = { baseUrl: 'u-manual', languageCode: 'en', kind: '' };
  const asr = { baseUrl: 'u-asr', languageCode: 'en', kind: 'asr' };
  const korean = { baseUrl: 'u-ko', languageCode: 'ko', kind: '' };
  assert.equal(native.pickCaptionTrack([asr, manual, korean]), manual);
  assert.equal(native.pickCaptionTrack([korean, asr]), asr);
  assert.equal(native.pickCaptionTrack([korean]), korean);
  assert.equal(native.pickCaptionTrack([]), null);
  assert.equal(native.pickCaptionTrack(null), null);
});

test('makeError 가 code 와 메시지를 담는다', () => {
  const error = native.makeError('CAPTION_BLOCKED', '차단됨');
  assert.equal(error.code, 'CAPTION_BLOCKED');
  assert.equal(error.message, '차단됨');
  assert.ok(error instanceof Error);
});
