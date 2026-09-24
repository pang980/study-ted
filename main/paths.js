const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const rootDir = path.join(__dirname, '..');
const rendererDir = path.join(rootDir, 'renderer');

function userDataDir() {
  return app.getPath('userData');
}

function dbPath() {
  return path.join(userDataDir(), 'study-ted.db');
}

function logsDir() {
  return path.join(userDataDir(), 'logs');
}

function binDir() {
  return path.join(userDataDir(), 'bin');
}

function tmpDir() {
  return path.join(userDataDir(), 'tmp');
}

function ensureDirs() {
  for (const dir of [userDataDir(), logsDir(), binDir(), tmpDir()]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = { rootDir, rendererDir, userDataDir, dbPath, logsDir, binDir, tmpDir, ensureDirs };
