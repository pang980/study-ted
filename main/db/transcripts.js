const db = require('./index');

const COLUMNS = `
  id AS pk, video_id AS videoId, video_pk AS videoPk, lang, kind, source,
  segments_json AS segmentsJson, plain_text AS plainText,
  segment_count AS segmentCount, created_at AS createdAt, updated_at AS updatedAt
`;

function upsert(transcript) {
  const segmentsJson = JSON.stringify(transcript.segments ?? []);
  db.run(
    `INSERT INTO transcripts (video_id, video_pk, lang, kind, source, segments_json, plain_text, segment_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(video_id) DO UPDATE SET
       video_pk = COALESCE(excluded.video_pk, transcripts.video_pk),
       lang = excluded.lang,
       kind = excluded.kind,
       source = excluded.source,
       segments_json = excluded.segments_json,
       plain_text = excluded.plain_text,
       segment_count = excluded.segment_count,
       updated_at = datetime('now')`,
    [
      transcript.videoId,
      transcript.videoPk ?? null,
      transcript.lang ?? null,
      transcript.kind ?? null,
      transcript.source ?? null,
      segmentsJson,
      transcript.plainText ?? '',
      (transcript.segments ?? []).length,
    ],
  );
  return getByVideoId(transcript.videoId);
}

function getByVideoId(videoId) {
  const row = db.get(`SELECT ${COLUMNS} FROM transcripts WHERE video_id = ?`, [videoId]);
  return row ? { ...row, segments: safeParse(row.segmentsJson) } : null;
}

function getByPk(pk) {
  const row = db.get(`SELECT ${COLUMNS} FROM transcripts WHERE id = ?`, [pk]);
  return row ? { ...row, segments: safeParse(row.segmentsJson) } : null;
}

function safeParse(json) {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function remove(videoId) {
  return db.run('DELETE FROM transcripts WHERE video_id = ?', [videoId]).changes;
}

function count() {
  const row = db.get('SELECT COUNT(*) AS c FROM transcripts');
  return row ? row.c : 0;
}

module.exports = { upsert, getByVideoId, getByPk, remove, count, safeParse };
