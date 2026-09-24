const db = require('./index');

const COLUMNS = `
  s.id AS pk, s.video_pk AS videoPk, s.video_id AS videoId, s.video_title AS videoTitle,
  s.video_url AS videoUrl, s.channel_pk AS channelPk, s.sentence, s.translation,
  s.analysis_json AS analysisJson, s.source, s.start_sec AS startSec,
  s.is_favorite AS isFavorite, s.study_count AS studyCount,
  s.created_at AS createdAt, s.updated_at AS updatedAt
`;

function mapRow(row) {
  return {
    ...row,
    isFavorite: row.isFavorite === 1,
    analysis: parseJson(row.analysisJson),
  };
}

function parseJson(json) {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (m) => `\\${m}`);
}

function create(input) {
  db.run(
    `INSERT INTO sentences (video_pk, video_id, video_title, video_url, channel_pk, sentence, translation,
                            analysis_json, source, start_sec, is_favorite)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.videoPk ?? null,
      input.videoId ?? null,
      input.videoTitle ?? null,
      input.videoUrl ?? null,
      input.channelPk ?? null,
      input.sentence,
      input.translation ?? null,
      input.analysis ? JSON.stringify(input.analysis) : null,
      input.source ?? 'manual',
      input.startSec ?? null,
      input.isFavorite ? 1 : 0,
    ],
  );
  const row = db.get('SELECT last_insert_rowid() AS id');
  return getByPk(row.id);
}

function getByPk(pk) {
  const row = db.get(`SELECT ${COLUMNS} FROM sentences s WHERE s.id = ?`, [pk]);
  return row ? mapRow(row) : null;
}

function update(pk, patch) {
  const current = getByPk(pk);
  if (!current) return null;
  db.run(
    `UPDATE sentences SET sentence = ?, translation = ?, analysis_json = ?,
       source = ?, start_sec = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [
      patch.sentence ?? current.sentence,
      patch.translation === undefined ? current.translation : patch.translation,
      patch.analysis === undefined
        ? current.analysisJson
        : patch.analysis ? JSON.stringify(patch.analysis) : null,
      patch.source ?? current.source,
      patch.startSec === undefined ? current.startSec : patch.startSec,
      pk,
    ],
  );
  return getByPk(pk);
}

function remove(pk) {
  return db.run('DELETE FROM sentences WHERE id = ?', [pk]).changes;
}

function toggleFavorite(pk) {
  db.run(`UPDATE sentences SET is_favorite = CASE is_favorite WHEN 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?`, [pk]);
  return getByPk(pk);
}

function incrementStudy(pk) {
  db.run('UPDATE sentences SET study_count = study_count + 1 WHERE id = ?', [pk]);
  return getByPk(pk);
}

const SORTS = {
  latest: 's.created_at DESC, s.id DESC',
  oldest: 's.created_at ASC, s.id ASC',
  sentence: 's.sentence COLLATE NOCASE ASC',
  video: 's.video_title COLLATE NOCASE ASC, s.start_sec ASC',
  favorite: 's.is_favorite DESC, s.created_at DESC',
};

function list(options = {}) {
  const { q = '', channelPk = null, favoriteOnly = false, sort = 'latest', limit = 200, offset = 0 } = options;
  const where = [];
  const params = [];
  if (q) {
    where.push(`(s.sentence LIKE ? ESCAPE '\\' OR s.translation LIKE ? ESCAPE '\\' OR s.video_title LIKE ? ESCAPE '\\')`);
    const like = `%${escapeLike(q)}%`;
    params.push(like, like, like);
  }
  if (channelPk) {
    where.push('s.channel_pk = ?');
    params.push(channelPk);
  }
  if (favoriteOnly) where.push('s.is_favorite = 1');
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order = SORTS[sort] ?? SORTS.latest;
  params.push(limit, offset);
  const rows = db.all(`SELECT ${COLUMNS} FROM sentences s ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`, params);
  const totalRow = db.get(`SELECT COUNT(*) AS c FROM sentences s ${clause}`, params.slice(0, params.length - 2));
  return { items: rows.map(mapRow), total: totalRow ? totalRow.c : 0 };
}

function listRecent(limit = 5) {
  return list({ sort: 'latest', limit }).items;
}

function count() {
  const row = db.get('SELECT COUNT(*) AS c FROM sentences');
  return row ? row.c : 0;
}

function exportAll() {
  const { items } = list({ limit: 100000 });
  return items.map((row) => ({
    sentence: row.sentence,
    translation: row.translation,
    analysis: row.analysis,
    source: row.source,
    startSec: row.startSec,
    isFavorite: row.isFavorite,
    createdAt: row.createdAt,
    videoId: row.videoId,
    videoTitle: row.videoTitle,
    videoUrl: row.videoUrl,
  }));
}

module.exports = {
  create, getByPk, update, remove, toggleFavorite, incrementStudy,
  list, listRecent, count, exportAll,
};
