// build/icon.png · build/icon.ico 를 코드로 만든다(외부 이미지 도구 의존 없음).
// 실행: node scripts/make-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;
const SS = 3; // 슈퍼샘플링 배율(안티에일리어싱)

const TOP = [36, 54, 84];    // #243654 타이틀바
const BOTTOM = [30, 111, 245]; // #1e6ff5 프라이머리

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function insideRounded(x, y, w, h, r) {
  const cx = Math.min(Math.max(x, r), w - r);
  const cy = Math.min(Math.max(y, r), h - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function insideTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function sample(x, y) {
  // 배경(둥근 사각형 + 대각선 그라디언트)
  if (!insideRounded(x, y, SIZE, SIZE, 56)) return [0, 0, 0, 0];
  const t = Math.min(1, Math.max(0, (x * 0.55 + y * 0.45) / SIZE));
  const bg = [lerp(TOP[0], BOTTOM[0], t), lerp(TOP[1], BOTTOM[1], t), lerp(TOP[2], BOTTOM[2], t)];

  // 재생 삼각형(흰색)
  const cx = 128;
  const cy = 112;
  const half = 46;
  if (insideTriangle(x, y, cx - half * 0.72, cy - half, cx - half * 0.72, cy + half, cx + half, cy)) {
    return [255, 255, 255, 255];
  }

  // 자막 줄 2개(아래쪽)
  const bars = [
    { y: 186, h: 15, x0: 52, x1: 204, a: 0.92 },
    { y: 211, h: 15, x0: 52, x1: 156, a: 0.62 },
  ];
  for (const bar of bars) {
    if (x >= bar.x0 && x <= bar.x1 && y >= bar.y && y <= bar.y + bar.h) {
      return [255, 255, 255, Math.round(255 * bar.a)];
    }
  }
  return [bg[0], bg[1], bg[2], 255];
}

function render() {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  const total = SS * SS;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const [pr, pg, pb, pa] = sample(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
          const alpha = pa / 255;
          r += pr * alpha; g += pg * alpha; b += pb * alpha; a += pa;
        }
      }
      const alphaSum = a / 255;
      const offset = (y * SIZE + x) * 4;
      buf[offset] = alphaSum > 0 ? Math.round(r / alphaSum) : 0;
      buf[offset + 1] = alphaSum > 0 ? Math.round(g / alphaSum) : 0;
      buf[offset + 2] = alphaSum > 0 ? Math.round(b / alphaSum) : 0;
      buf[offset + 3] = Math.round(a / total);
    }
  }
  return buf;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function toPng(rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * (SIZE * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function toIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = 0; // 256
  entry[1] = 0; // 256
  entry[4] = 1;
  entry[6] = 32;
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

const outDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });
const png = toPng(render());
fs.writeFileSync(path.join(outDir, 'icon.png'), png);
fs.writeFileSync(path.join(outDir, 'icon.ico'), toIco(png));
console.log(`icon.png ${png.length} bytes · icon.ico ${toIco(png).length} bytes`);