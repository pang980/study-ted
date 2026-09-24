// 설치 파일과 함께 올릴 업데이트 정보(latest.json)를 만든다.
//   npm run dist                      → 설치 파일 + dist/latest.json
//   node scripts/make-manifest.js     → 이미 만든 설치 파일로 latest.json 만 다시 생성
// 사용법: 설치 파일과 latest.json 을 같은 곳(웹 서버·릴리스 자산 등)에 올린 뒤,
//        앱 설정의 "업데이트 주소" 에 latest.json 주소를 넣는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const notesPath = path.join(root, 'build', 'release-notes.md');

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(distDir)) fail('dist 폴더가 없습니다. 먼저 npm run dist 로 설치 파일을 만들어 주세요.');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;

const entries = fs
  .readdirSync(distDir)
  .filter((name) => /^StudyTED-Setup-.*\.exe$/i.test(name) || /^study-ted .*\.exe$/i.test(name))
  .filter((name) => !name.endsWith('__uninstaller.exe'))
  .map((name) => ({ name, stat: fs.statSync(path.join(distDir, name)) }))
  .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

if (!entries.length) fail('dist 폴더에 설치 파일(*.exe)이 없습니다. 먼저 npm run dist 를 실행해 주세요.');

const installers = entries.filter((entry) => entry.name.includes(version));
const picked = (installers.length ? installers : entries)[0];
const installerPath = path.join(distDir, picked.name);

const hash = crypto.createHash('sha256');
hash.update(fs.readFileSync(installerPath));
const sha256 = hash.digest('hex');

let notes = '';
try {
  notes = fs.readFileSync(notesPath, 'utf8').trim().slice(0, 2000);
} catch {
  notes = `${version} 버전입니다.`;
}

const manifest = {
  version,
  pubDate: new Date().toISOString(),
  url: picked.name,
  sha256,
  size: picked.stat.size,
  notes,
};

const target = path.join(distDir, 'latest.json');
fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`latest.json 생성 완료 · ${picked.name} (${(picked.stat.size / 1048576).toFixed(1)} MB)`);
console.log(`  version : ${manifest.version}`);
console.log(`  sha256  : ${sha256.slice(0, 16)}…`);
console.log(`  위치    : ${target}`);
if (picked.name !== `StudyTED-Setup-${version}.exe`) {
  console.log(`  참고    : 파일 이름이 버전과 달라( ${picked.name} ) 그대로 사용했습니다.`);
}