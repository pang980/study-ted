const migrations = [
  {
    name: 'initial',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS channels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          channel_id TEXT NOT NULL UNIQUE,
          handle TEXT,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          avatar_url TEXT,
          subscriber_text TEXT,
          video_count_text TEXT,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS videos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_id TEXT NOT NULL UNIQUE,
          channel_pk INTEGER REFERENCES channels(id) ON DELETE SET NULL,
          channel_id TEXT,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          duration_sec INTEGER,
          duration_text TEXT,
          view_count_text TEXT,
          published_text TEXT,
          thumbnail_url TEXT,
          description TEXT,
          has_transcript INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS transcripts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_id TEXT NOT NULL UNIQUE,
          video_pk INTEGER REFERENCES videos(id) ON DELETE CASCADE,
          lang TEXT,
          kind TEXT,
          source TEXT,
          segments_json TEXT NOT NULL DEFAULT '[]',
          plain_text TEXT NOT NULL DEFAULT '',
          segment_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sentences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_pk INTEGER REFERENCES videos(id) ON DELETE SET NULL,
          video_id TEXT,
          video_title TEXT,
          video_url TEXT,
          channel_pk INTEGER REFERENCES channels(id) ON DELETE SET NULL,
          sentence TEXT NOT NULL,
          translation TEXT,
          analysis_json TEXT,
          note TEXT,
          source TEXT NOT NULL DEFAULT 'manual',
          start_sec REAL,
          is_favorite INTEGER NOT NULL DEFAULT 0,
          study_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sentence_tags (
          sentence_pk INTEGER NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
          tag_pk INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (sentence_pk, tag_pk)
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          is_secret INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_pk);
        CREATE INDEX IF NOT EXISTS idx_sentences_video ON sentences(video_pk);
        CREATE INDEX IF NOT EXISTS idx_sentences_favorite ON sentences(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_sentences_created ON sentences(created_at);
      `);
    },
  },
  {
    // 문장 노트의 메모(메모/태그)는 더 이상 쓰지 않는다. 사용자 요청으로 컬럼과 테이블을 실제로 제거한다.
    name: 'dropSentenceNoteAndTags',
    up(db) {
      db.exec(`
        DROP TABLE IF EXISTS sentence_tags;
        DROP TABLE IF EXISTS tags;
        ALTER TABLE sentences DROP COLUMN note;
      `);
    },
  },
];

module.exports = { migrations };
