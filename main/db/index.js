const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { migrations } = require('./schema');

let db = null;

function execAll(connection, sql) {
  connection.exec(sql);
}

function migrate(connection) {
  execAll(connection, 'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');
  const row = connection.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version');
  const current = row ? Number(row.value) : 0;
  for (let i = current; i < migrations.length; i += 1) {
    const migration = migrations[i];
    connection.exec('BEGIN');
    try {
      migration.up(connection);
      connection
        .prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .run('schema_version', String(i + 1));
      connection.exec('COMMIT');
    } catch (error) {
      connection.exec('ROLLBACK');
      throw new Error(`마이그레이션 실패 (${migration.name}): ${error.message}`);
    }
  }
}

function init(filePath) {
  if (db) return db;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  db = new DatabaseSync(filePath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

function getDb() {
  if (!db) throw new Error('DB 가 초기화되지 않았습니다.');
  return db;
}

function close() {
  if (!db) return;
  try {
    db.close();
  } finally {
    db = null;
  }
}

function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

function get(sql, params = []) {
  return getDb().prepare(sql).get(...params) ?? null;
}

function all(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

function tx(fn) {
  const connection = getDb();
  connection.exec('BEGIN');
  try {
    const result = fn(connection);
    connection.exec('COMMIT');
    return result;
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { init, getDb, close, run, get, all, tx, migrations };
