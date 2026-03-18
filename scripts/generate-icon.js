/**
 * TikTalk アイコン生成スクリプト
 * sharp を使って 512x512 PNG と 256x256 ICO を生成する
 *
 * 使い方: node scripts/generate-icon.js
 * 出力: public/icon.png, build/icon.ico
 */

const path = require('path');
const fs = require('fs');

async function generateIcon() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.warn('[generate-icon] sharp が見つかりません。npm install --save-dev sharp を実行してください');
    process.exit(0);
  }

  const publicDir = path.join(__dirname, '..', 'public');
  const buildDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });

  // 512x512 SVG を生成（濃紺背景 + 白文字 "TT"）
  const size = 512;
  const svg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="80" fill="#1a1a2e"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="bold"
        font-size="260" fill="white" letter-spacing="-10">TT</text>
</svg>`.trim();

  // PNG 512x512
  const pngPath = path.join(publicDir, 'icon.png');
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(pngPath);
  console.log(`[generate-icon] ${pngPath} を生成しました`);

  // ICO 256x256 (PNG形式のICO — electron-builder / NSIS が対応)
  const icoPath = path.join(buildDir, 'icon.ico');
  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(256, 256)
    .png()
    .toBuffer();

  // ICO ファイルフォーマット: ICONDIR + ICONDIRENTRY + PNG データ
  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0);     // Reserved
  iconDir.writeUInt16LE(1, 2);     // Type: 1 = ICO
  iconDir.writeUInt16LE(1, 4);     // Number of images

  const iconEntry = Buffer.alloc(16);
  iconEntry.writeUInt8(0, 0);      // Width (0 = 256)
  iconEntry.writeUInt8(0, 1);      // Height (0 = 256)
  iconEntry.writeUInt8(0, 2);      // Color palette
  iconEntry.writeUInt8(0, 3);      // Reserved
  iconEntry.writeUInt16LE(1, 4);   // Color planes
  iconEntry.writeUInt16LE(32, 6);  // Bits per pixel
  iconEntry.writeUInt32LE(pngBuffer.length, 8);  // Image size
  iconEntry.writeUInt32LE(22, 12); // Offset (6 + 16 = 22)

  const icoBuffer = Buffer.concat([iconDir, iconEntry, pngBuffer]);
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`[generate-icon] ${icoPath} を生成しました`);
}

generateIcon().catch((err) => {
  console.error('[generate-icon] エラー:', err.message);
  process.exit(0); // ビルドを止めない
});
