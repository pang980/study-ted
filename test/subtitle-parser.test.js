const test = require('node:test');
const assert = require('node:assert/strict');
const parser = require('../main/collect/subtitle-parser');

test('detectFormat 이 형식을 판별한다', () => {
  assert.equal(parser.detectFormat('{"events":[]}'), 'json3');
  assert.equal(parser.detectFormat('WEBVTT\n\n00:00.000 --> 00:02.000\nHi'), 'vtt');
  assert.equal(parser.detectFormat('1\n00:00:00,000 --> 00:00:02,000\nHi'), 'srt');
  assert.equal(parser.detectFormat('<transcript><text start="0">Hi</text></transcript>'), 'srv3');
  assert.equal(parser.detectFormat('just words'), 'text');
  assert.equal(parser.detectFormat('   '), 'text');
});

test('parseJson3 이 세그먼트를 만들고 aAppend 와 중복을 건너뛴다', () => {
  const json = JSON.stringify({
    events: [
      { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: 'Hello ' }, { utf8: 'world' }] },
      { tStartMs: 2000, dDurationMs: 1000, aAppend: 1, segs: [{ utf8: 'ignored' }] },
      { tStartMs: 2000, dDurationMs: 1000, segs: [{ utf8: 'Hello world' }] },
      { tStartMs: 3000, dDurationMs: 1000, segs: [{ utf8: '\n' }] },
      { tStartMs: 4000, dDurationMs: 1500, segs: [{ utf8: 'Next line' }] },
      { tStartMs: 5000, dDurationMs: 500, segs: [] },
    ],
  });
  const segments = parser.parse(json, 'auto');
  assert.equal(segments.length, 2);
  assert.deepEqual(segments[0], { start: 0, end: 3, text: 'Hello world' });
  assert.deepEqual(segments[1], { start: 4, end: 5.5, text: 'Next line' });
});

test('parseVtt 가 롤링 자막을 합치고 태그를 제거한다', () => {
  const vtt = [
    'WEBVTT',
    'Kind: captions',
    '',
    '00:00:00.000 --> 00:00:02.000',
    'So today,',
    '',
    '00:00:02.000 --> 00:00:04.000',
    'So today, I want to',
    '',
    '00:00:04.000 --> 00:00:06.000',
    '<c.colorE5E5E5>So today, I want to talk</c>',
    '',
    '00:00:06.000 --> 00:00:08.000',
    'about a morning routine.',
  ].join('\n');
  const segments = parser.parseVtt(vtt);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].text, 'So today, I want to talk');
  assert.equal(segments[0].start, 0);
  assert.equal(segments[0].end, 6);
  assert.equal(segments[1].text, 'about a morning routine.');
});

test('parseSrt 가 타임코드와 줄바꿈을 처리한다', () => {
  const srt = [
    '1',
    '00:00:01,000 --> 00:00:03,500',
    'First line',
    'continued here',
    '',
    '2',
    '00:01:05,250 --> 00:01:07,000',
    'Second line',
  ].join('\n');
  const segments = parser.parse(srt);
  assert.equal(segments.length, 2);
  assert.deepEqual(segments[0], { start: 1, end: 3.5, text: 'First line continued here' });
  assert.deepEqual(segments[1], { start: 65.25, end: 67, text: 'Second line' });
});

test('parseSrv3 가 엔티티를 복원하고 dur 로 end 를 계산한다', () => {
  const xml = '<transcript><text start="0" dur="2.5">Tom &amp; Jerry</text><text start="3" dur="1">It&#39;s fine</text></transcript>';
  const segments = parser.parseSrv3(xml);
  assert.deepEqual(segments[0], { start: 0, end: 2.5, text: 'Tom & Jerry' });
  assert.deepEqual(segments[1], { start: 3, end: 4, text: "It's fine" });
});

test('parseText 가 줄 단위로 나누고 캡션 서식을 제거한다', () => {
  const segments = parser.parseText('{\\an8}Hello there\n\n  Second   line  \n');
  assert.equal(segments.length, 2);
  assert.deepEqual(segments[0], { start: null, end: null, text: 'Hello there' });
  assert.equal(segments[1].text, 'Second line');
});

test('toPlainText 와 formatTime 이 기대값을 반환한다', () => {
  const segments = [{ start: 0, end: 1, text: 'a' }, { start: 1, end: 2, text: 'b' }];
  assert.equal(parser.toPlainText(segments), 'a\nb');
  assert.equal(parser.toPlainText(null), '');
  assert.equal(parser.formatTime(0), '00:00');
  assert.equal(parser.formatTime(65.9), '01:05');
  assert.equal(parser.formatTime(3725), '01:02:05');
  assert.equal(parser.formatTime(-3), '00:00');
  assert.equal(parser.formatTime('nope'), '00:00');
});

test('decodeEntities 가 10진/16진 엔티티를 처리한다', () => {
  assert.equal(parser.decodeEntities('&amp;&lt;&gt;&quot;&apos;&nbsp;'), '&<>"\' ');
  assert.equal(parser.decodeEntities('&#65;&#x42;'), 'AB');
  assert.equal(parser.decodeEntities('&unknown;'), '&unknown;');
});

test('mergeRolling 이 접두사가 같은 세그먼트를 누적한다', () => {
  const merged = parser.mergeRolling([
    { start: 0, end: 1, text: 'I want' },
    { start: 1, end: 2, text: 'I want to go' },
    { start: 2, end: 3, text: 'home' },
    { start: 3, end: 4, text: 'home' },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].text, 'I want to go');
  assert.equal(merged[0].end, 2);
  assert.deepEqual(merged[1], { start: 2, end: 4, text: 'home' });
  assert.deepEqual(parser.mergeRolling([]), []);
});

test('parse 가 잘못된 JSON 을 오류로 감싼다', () => {
  assert.throws(() => parser.parse('{"events":', 'json3'), /자막 파싱 실패 \(json3\)/);
});
