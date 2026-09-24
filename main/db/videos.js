const db = require('./index');

const COLUMNS = `
  v.id AS pk, v.video_id AS videoId, v.channel_pk AS channelPk, v.channel_id AS channelId,
  v.title, v.url, v.duration_sec AS durationSec, v.duration_text AS durationText,
  v.view_count_text AS viewCountText, v.published_text AS publishedText,
  v.thumbnail_url AS thumbnailUrl, v.description, v.has_transcript AS hasTranscript,
  v.created_at AS createdAt, v.updated_at AS updatedAt, c.title AS channelTitle
`;

// 이미 저장된 동영상이 있으면 메타데이터 갱신을 건너뛸 수 있다(refresh=false).
// 자막·문장 등 기존 데이터는 그대로 두고 제목/조회수 같은 정보만 유지한다.
function upsert(video, { refresh = true } = {}) {
  const conflict = refresh
    ? `DO UPDATE SET
       channel_pk = COALESCE(excluded.channel_pk, videos.channel_pk),
       channel_id = COALESCE(excluded.channel_id, videos.channel_id),
       title = excluded.title,
       url = excluded.url,
       duration_sec = COALESCE(excluded.duration_sec, videos.duration_sec),
       duration_text = COALESCE(excluded.duration_text, videos.duration_text),
       view_count_text = COALESCE(excluded.view_count_text, videos.view_count_text),
       published_text = COALESCE(excluded.published_text, videos.published_text),
       thumbnail_url = COALESCE(excluded.thumbnail_url, videos.thumbnail_url),
       description = COALESCE(excluded.description, videos.description),
       has_transcript = MAX(excluded.has_transcript, videos.has_transcript),
       updated_at = datetime('now')`
    : 'DO NOTHING';

  db.run(
    `INSERT INTO videos (video_id, channel_pk, channel_id, title, url, duration_sec, duration_text,
                         view_count_text, published_text, thumbnail_url, description, has_transcript)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(video_id) ${conflict}`,
    [
      video.videoId,
      video.channelPk ?? null,
      video.channelId ?? null,
      video.title ?? null,
      video.url ?? null,
      video.durationSec ?? null,
      video.durationText ?? null,
      video.viewCountText ?? null,
      video.publishedText ?? null,
      video.thumbnailUrl ?? null,
      video.description ?? null,
      video.hasTranscript ? 1 : 0,
    ],
  );
  return getByVideoId(video.videoId);
}

function getByVideoId(videoId) {
  return db.get(
    `SELECT ${COLUMNS} FROM videos v LEFT JOIN channels c ON c.id = v.channel_pk WHERE v.video_id = ?`,
    [videoId],
  );
}

function getByPk(pk) {
  return db.get(
    `SELECT ${COLUMNS} FROM videos v LEFT JOIN channels c ON c.id = v.channel_pk WHERE v.id = ?`,
    [pk],
  );
}

// 검색어에 들어 있는 LIKE 와일드카드(% _ \)는 그대로 문자로 취급한다.
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (match) => `\\${match}`);
}

// 채널 필터와 제목/설명 검색 조건을 한 곳에서 만든다. 목록과 개수가 같은 조건을 쓰도록.
function buildFilter({ channelPk = null, q = '' } = {}) {
  const where = [];
  const params = [];
  if (channelPk) {
    where.push('v.channel_pk = ?');
    params.push(channelPk);
  }
  const keyword = String(q ?? '').trim();
  if (keyword) {
    const like = `%${escapeLike(keyword)}%`;
    where.push(`(v.title LIKE ? ESCAPE '\\' OR v.description LIKE ? ESCAPE '\\')`);
    params.push(like, like);
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// 동영상은 2000편 이상일 수 있으므로 페이지 단위로만 읽는다. 반환은 배열을 유지한다.
function list({ channelPk = null, q = '', limit = 100, offset = 0 } = {}) {
  const { clause, params } = buildFilter({ channelPk, q });
  params.push(limit, offset);
  return db.all(
    `SELECT ${COLUMNS} FROM videos v LEFT JOIN channels c ON c.id = v.channel_pk
     ${clause}
     ORDER BY v.created_at DESC, v.id DESC
     LIMIT ? OFFSET ?`,
    params,
  );
}

function listWithoutTranscript({ channelPk = null, limit = 20 } = {}) {
  const params = [];
  let where = 'WHERE v.has_transcript = 0';
  if (channelPk) {
    where += ' AND v.channel_pk = ?';
    params.push(channelPk);
  }
  params.push(limit);
  return db.all(
    `SELECT ${COLUMNS} FROM videos v LEFT JOIN channels c ON c.id = v.channel_pk
     ${where}
     ORDER BY v.id ASC
     LIMIT ?`,
    params,
  );
}

function setHasTranscript(videoId, hasTranscript) {
  db.run(`UPDATE videos SET has_transcript = ?, updated_at = datetime('now') WHERE video_id = ?`, [
    hasTranscript ? 1 : 0,
    videoId,
  ]);
}

// 인자 없이 부르면 전체 개수, 조건을 주면 그 조건(채널/검색어)의 개수다.
function count({ channelPk = null, q = '' } = {}) {
  const { clause, params } = buildFilter({ channelPk, q });
  const row = db.get(`SELECT COUNT(*) AS c FROM videos v ${clause}`, params);
  return row ? row.c : 0;
}

module.exports = { upsert, getByVideoId, getByPk, list, listWithoutTranscript, setHasTranscript, count };
