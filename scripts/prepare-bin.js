// build/bin 에 런타임 도구(yt-dlp)를 준비한다. electron-builder 의 extraResources 가 이 폴더를 참조한다.
// yt-dlp 가 없어도 실패하지 않는다(앱의 설정 → yt-dlp 다운로드 로 나중에 설치 가능).
// 실행: node scripts/prepare-bin.js  (npm run dist 가 자동 호출)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'build', 'bin');
const target = path.join(outDir, 'yt-dlp.exe');
const sources = [path.join(root, '_tmp', 'yt-dlp.exe'), path.join(root, 'bin', 'yt-dlp.exe')];

fs.mkdirSync(outDir, { recursive: true });

const source = sources.find((candidate) => fs.existsSync(candidate));
if (!source) {
  console.log('yt-dlp.exe 없음 → 번들에서 제외합니다. 설치 후 앱의 설정 → yt-dlp 다운로드 로 받을 수 있습니다.');
  process.exit(0);
}

const from = fs.statSync(source);
if (fs.existsSync(target) && fs.statSync(target).size === from.size) {
  console.log(`build/bin/yt-dlp.exe 그대로 사용 (${from.size} bytes)`);
} else {
  fs.copyFileSync(source, target);
  console.log(`build/bin/yt-dlp.exe 복사 (${from.size} bytes) ← ${path.relative(root, source)}`);
}