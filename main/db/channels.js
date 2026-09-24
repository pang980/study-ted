const db = require('./index');

// 채널 행에서 수집 결과를 바로 확인할 수 있도록 저장된 동영상·자막·문장 개수를 함께 계산한다.
const COLUMNS = `
  id AS pk, channel_id AS channelId, handle, title, url,
  avatar_url AS avatarUrl, subscriber_text AS subscriberText,
  video_count_text AS videoCountText, description,
  created_at AS createdAt, updated_at AS updatedAt, last_synced_at AS lastSyncedAt,
  (SELECT COUNT(*) FROM videos v WHERE v.channel_pk = channels.id) AS savedVideoCount,
  (SELECT COUNT(*) FROM transcripts t JOIN videos tv ON tv.id = t.video_pk WHERE tv.channel_pk = channels.id) AS savedTranscriptCount,
  (SELECT COUNT(*) FROM sentences s WHERE s.channel_pk = channels.id) AS savedSentenceCount
`;

function upsert(channel) {
  db.run(
    `INSERT INTO channels (channel_id, handle, title, url, avatar_url, subscriber_text, video_count_text, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(channel_id) DO UPDATE SET
       handle = COALESCE(excluded.handle, channels.handle),
       title = excluded.title,
       url = excluded.url,
       avatar_url = COALESCE(excluded.avatar_url, channels.avatar_url),
       subscriber_text = COALESCE(excluded.subscriber_text, channels.subscriber_text),
       video_count_text = COALESCE(excluded.video_count_text, channels.video_count_text),
       description = COALESCE(excluded.description, channels.description),
       updated_at = datetime('now')`,
    [
      channel.channelId,
      channel.handle ?? null,
      channel.title,
      channel.url,
      channel.avatarUrl ?? null,
      channel.subscriberText ?? null,
      channel.videoCountText ?? null,
      channel.description ?? null,
    ],
  );
  return getByChannelId(channel.channelId);
}

function getByChannelId(channelId) {
  return db.get(`SELECT ${COLUMNS} FROM channels WHERE channel_id = ?`, [channelId]);
}

function getByPk(pk) {
  return db.get(`SELECT ${COLUMNS} FROM channels WHERE id = ?`, [pk]);
}

function list() {
  return db.all(`SELECT ${COLUMNS} FROM channels ORDER BY updated_at DESC, id DESC`);
}

function touchSync(pk) {
  db.run(`UPDATE channels SET last_synced_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [pk]);
  return getByPk(pk);
}

function remove(pk) {
  return db.run('DELETE FROM channels WHERE id = ?', [pk]).changes;
}

module.exports = { upsert, getByChannelId, getByPk, list, touchSync, remove };
