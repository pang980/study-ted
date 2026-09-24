// 배포 도우미 — 설치 파일을 빌드해 GitHub 릴리스에 올린다.
//
//   1) 버전 올리기      npm version 1.0.1 --no-git-tag-version
//   2) 새 버전 설명     build/release-notes.md 수정 (없으면 이전 내용이 그대로 올라간다)
//   3) 배포             npm run release
//
// 앱은 설정의 "업데이트 주소"(latest.json)를 보고 새 버전을 자동으로 내려받는다.
// 준비물: gh CLI 로그인(gh auth status), origin 원격 저장소.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const notesPath = path.join(root, 'build', 'release-notes.md');

function fail(message) {
  console.error(`\n[중단] ${message}`);
  process.exit(1);
}

// gh·git 은 exe 라 그대로 실행하고, npm 은 shell 을 거쳐야 실행된다(.cmd).
function run(command, args) {
  const result = spawnSync(command, args, { shell: false, stdio: 'inherit', cwd: root });
  if (result.status !== 0) fail(`${command} ${args.join(' ')} 실행에 실패했습니다.`);
}

function runShell(line) {
  const result = spawnSync(line, { shell: true, stdio: 'inherit', cwd: root });
  if (result.status !== 0) fail(`${line} 실행에 실패했습니다.`);
}

function capture(command, args) {
  return spawnSync(command, args, { shell: false, cwd: root, encoding: 'utf8' });
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = String(pkg.version);
const tag = `v${version}`;
const installerName = `StudyTED-Setup-${version}.exe`;

// 0) 사전 점검 — gh 로그인과 origin 원격이 없으면 올릴 수 없다.
const auth = capture('gh', ['auth', 'status']);
if (auth.status !== 0) {
  fail('gh CLI 로그인이 필요합니다. 터미널에서 gh auth login 을 먼저 실행해 주세요.');
}

const remote = capture('git', ['remote', 'get-url', 'origin']);
if (remote.status !== 0) {
  fail('origin 원격 저장소가 없습니다. git remote add origin <저장소 주소> 로 추가해 주세요.');
}

const remoteUrl = String(remote.stdout ?? '').trim();
const repoUrl = remoteUrl.replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
const feedUrl = `${repoUrl}/releases/latest/download/latest.json`;

console.log(`StudyTED ${tag} 배포를 시작합니다.`);
console.log(`  저장소 : ${repoUrl}`);

// 1) 빌드 — prepare-bin + electron-builder + latest.json 생성
runShell('npm run dist');

const manifestPath = path.join(distDir, 'latest.json');
if (!fs.existsSync(manifestPath)) fail('dist/latest.json 이 없습니다. 빌드를 확인해 주세요.');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (String(manifest.version) !== version) {
  fail(`설치 파일 버전(${manifest.version})이 package.json(${version})과 다릅니다.`);
}

const assets = [`StudyTED-Setup-${version}.exe`, `${installerName}.blockmap`, 'latest.json']
  .map((name) => path.join(distDir, name))
  .filter((file) => fs.existsSync(file));

if (assets.length < 3) fail('dist 에 설치 파일·블록맵·latest.json 이 모두 있어야 합니다.');

// 2) 릴리스 업로드 — 같은 태그가 있으면 파일만 덮어쓴다.
const existing = capture('gh', ['release', 'view', tag]);
const notesArgs = fs.existsSync(notesPath) ? ['--notes-file', notesPath] : ['--notes', `StudyTED ${tag}`];

if (existing.status === 0) {
  console.log(`\n기존 릴리스 ${tag} 의 파일을 새로 올린 것으로 바꿉니다.`);
  run('gh', ['release', 'upload', tag, ...assets, '--clobber']);
  run('gh', ['release', 'edit', tag, ...notesArgs]);
} else {
  run('gh', ['release', 'create', tag, ...assets, '--title', `StudyTED ${tag}`, ...notesArgs]);
}

console.log('\n배포 완료');
console.log(`  ${(manifest.size / 1048576).toFixed(1)} MB · sha256 ${manifest.sha256.slice(0, 16)}…`);
console.log(`  업데이트 주소 : ${feedUrl}`);
console.log('  (앱 설정 → 업데이트 주소에 위 주소가 들어 있어야 자동 확인이 동작합니다.)');