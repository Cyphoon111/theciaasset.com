// Builds two files for Jason's Zoom appearances:
//   overlay-1920x1080.png              transparent lower-third + QR, for OBS Virtual Camera
//   zoom-virtual-background-1920x1080.jpg  dark branded background with logo + URL + QR, for Zoom's own Virtual Background
import sharp from "sharp";
import QRCode from "qrcode";
import { writeFile } from "node:fs/promises";

const W = 1920, H = 1080;
const URL = "https://theciaasset.com/";
const INK = "#0b0b0d", RED = "#e0121c", GOLD = "#c9a24b", PAPER = "#ffffff";
const OUT = process.argv[2] || ".";

// QR with high error correction so it survives video compression / small tiles.
async function qrPng(size) {
  const svg = await QRCode.toString(URL, { type: "svg", errorCorrectionLevel: "H", margin: 0, color: { dark: "#000000", light: "#ffffff" } });
  return sharp(Buffer.from(svg)).resize(size, size, { kernel: "nearest" }).png().toBuffer();
}

// The site's mark: white ring, red centre.
function mark(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="${r * 0.19}"/>
          <circle cx="${cx}" cy="${cy}" r="${r * 0.37}" fill="${RED}"/>`;
}

const WORD = `font-family="Impact, 'Arial Black', sans-serif" letter-spacing="2"`;
const SANS = `font-family="Helvetica Neue, Helvetica, Arial, sans-serif"`;

// ---------- 1. Transparent overlay (OBS) ----------
// Kept inside a 4:3 centre crop (x 240..1680) so it survives if the show crops his tile.
async function buildOverlay() {
  const qrSize = 230, pad = 14, tile = qrSize + pad * 2;
  const M = 12;                                        // margin from the frame edge
  const qrX = W - M - tile, qrY = H - M - tile;        // bottom-right corner
  const ltX = M, ltY = H - M - 130, ltW = 500, ltH = 130;   // lower third, bottom-left corner

  // Book cover, standing just above the lower third, centred over the bar.
  const cvW = 230, cvH = Math.round(cvW * 3 / 2), cvX = ltX + Math.round((ltW - cvW) / 2), cvY = ltY - 18 - cvH;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <!-- cover frame -->
    <rect x="${cvX - 4}" y="${cvY - 4}" width="${cvW + 8}" height="${cvH + 8}" rx="4" fill="${GOLD}"/>
    <!-- lower third -->
    <rect x="${ltX}" y="${ltY}" width="${ltW}" height="${ltH}" rx="16" fill="${INK}" fill-opacity="0.9"/>
    <rect x="${ltX}" y="${ltY}" width="8" height="${ltH}" rx="4" fill="${RED}"/>
    ${mark(ltX + 62, ltY + ltH / 2, 34)}
    <text x="${ltX + 120}" y="${ltY + 64}" ${WORD} font-size="56" fill="#fff">THE <tspan fill="${RED}">CIA</tspan> ASSET</text>
    <text x="${ltX + 122}" y="${ltY + 108}" ${SANS} font-weight="bold" font-size="34" fill="${GOLD}">theciaasset.com</text>
    <!-- QR tile -->
    <rect x="${qrX}" y="${qrY - 46}" width="${tile}" height="40" rx="10" fill="${INK}" fill-opacity="0.9"/>
    <text x="${qrX + tile / 2}" y="${qrY - 18}" ${SANS} font-weight="bold" font-size="20" fill="#fff" text-anchor="middle" letter-spacing="2">SCAN FOR THE BOOK</text>
    <rect x="${qrX}" y="${qrY}" width="${tile}" height="${tile}" rx="12" fill="${PAPER}"/>
  </svg>`;

  const qr = await qrPng(qrSize);
  const coverSrc = "/Users/jasonsullivan/Developer/theciaasset.com/assets/cover.jpg";
  const cover = await sharp(coverSrc).resize(cvW, cvH, { fit: "cover" }).png().toBuffer();
  const base = sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

  // Unleashed.news logo, bottom dead centre (unleashed-logo.png comes from cutout-unleashed.mjs).
  const unW = 520;
  const unleashed = await sharp(`${OUT}/unleashed-logo.png`).resize({ width: unW }).png().toBuffer();
  const unH = (await sharp(unleashed).metadata()).height;
  const unLayer = { input: unleashed, left: Math.round(W / 2 - unW / 2), top: H - M - unH };

  // Static banner (flat cover baked in): the fallback for anything that can only take a picture.
  await writeFile(`${OUT}/overlay-1920x1080.png`, await base.clone()
    .composite([{ input: Buffer.from(svg) }, { input: cover, left: cvX, top: cvY }, { input: qr, left: qrX + pad, top: qrY + pad }, unLayer])
    .png().toBuffer());

  // Base for the animated page: everything except the cover, which the page draws itself in 3D.
  const svgNoFrame = svg.replace(/<!-- cover frame -->[\s\S]*?<!-- lower third -->/, "<!-- lower third -->");
  await writeFile(`${OUT}/overlay-base.png`, await base.clone()
    .composite([{ input: Buffer.from(svgNoFrame) }, { input: qr, left: qrX + pad, top: qrY + pad }, unLayer])
    .png().toBuffer());
  await writeFile(`${OUT}/cover.jpg`, await sharp(coverSrc).resize(760).jpeg({ quality: 90 }).toBuffer());

  // Animated version for OBS's Browser Source: the site's 3D book (.book in assets/site.css),
  // tilted 24°, floating, with the light sweep, standing where the flat cover sits in the PNG.
  const t = Math.round(34 * cvW / 380);   // spine thickness, scaled from the site's 380px-wide book
  const html = `<!doctype html>
<meta charset="utf-8">
<title>The CIA Asset banner</title>
<style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; background: transparent; overflow: hidden; }
  .banner { position: absolute; inset: 0; width: ${W}px; height: ${H}px; }
  .stage { position: absolute; left: ${cvX}px; top: ${cvY}px; width: ${cvW}px; height: ${cvH}px; perspective: 1000px; }
  .book { --t: ${t}px; --ry: 24deg; --rx: 3deg; position: relative; width: 100%; height: 100%; transform-style: preserve-3d;
    transform: rotateY(var(--ry)) rotateX(var(--rx)); animation: bookFloat 7s ease-in-out infinite; }
  .book__cover, .book__back, .book__spine, .book__pages { position: absolute; }
  .book__cover { inset: 0; transform: translateZ(calc(var(--t) / 2)); border-radius: 2px 6px 6px 2px; overflow: hidden;
    box-shadow: inset 4px 0 10px rgba(255,255,255,.12), inset -1px 0 0 rgba(0,0,0,.4); background: #111; }
  .book__cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .book__cover::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 10px;
    background: linear-gradient(90deg, rgba(0,0,0,.55), rgba(255,255,255,.18) 40%, rgba(0,0,0,.2) 70%, transparent); z-index: 2; mix-blend-mode: multiply; }
  .book__sheen { position: absolute; inset: 0; z-index: 3;
    background: linear-gradient(110deg, transparent 38%, rgba(255,255,255,.34) 48%, rgba(255,255,255,.06) 54%, transparent 62%);
    background-size: 260% 100%; background-position: 140% 0;
    animation: sheen 7.5s cubic-bezier(.2, .7, .2, 1) 2.2s infinite; mix-blend-mode: screen; pointer-events: none; }
  .book__back { inset: 0; transform: translateZ(calc(var(--t) / -2)) rotateY(180deg); background: #0c0c0c; border-radius: 6px 2px 2px 6px; }
  .book__spine { top: 0; bottom: 0; left: calc(var(--t) / -2); width: var(--t); transform: rotateY(-90deg);
    background: linear-gradient(90deg, #070707, #1b1b1d 45%, #0a0a0a); display: flex; flex-direction: column; align-items: center;
    justify-content: space-between; padding: 14px 0; box-sizing: border-box; overflow: hidden; }
  .book__spine::before, .book__spine::after { content: ''; position: absolute; left: 0; right: 0; height: 2px; background: ${RED}; }
  .book__spine::before { top: 6px; } .book__spine::after { bottom: 6px; }
  .book__spine span, .book__spine em { writing-mode: vertical-rl; transform: rotate(180deg); font: 400 8px/1 Georgia, serif;
    letter-spacing: .12em; color: #f4f4f4; font-style: normal; white-space: nowrap; }
  .book__spine span b { color: ${RED}; font-weight: 400; }
  .book__spine em { color: ${GOLD}; font-size: 7px; }
  .book__pages { top: 3px; bottom: 3px; right: calc(var(--t) / -2 + 1px); width: calc(var(--t) - 2px); transform: rotateY(90deg);
    background: repeating-linear-gradient(90deg, #f3f1ea 0 2px, #dcd8cd 2px 3px); box-shadow: inset 0 0 6px rgba(0,0,0,.18); }
  .book__floor { position: absolute; left: ${cvX}px; top: ${cvY + cvH + 4}px; width: ${cvW}px; height: 18px;
    background: radial-gradient(closest-side, rgba(0,0,0,.45), transparent); filter: blur(5px); animation: floorPulse 7s ease-in-out infinite; }
  @keyframes sheen { 0% { background-position: 140% 0; } 22%, 100% { background-position: -40% 0; } }
  @keyframes bookFloat { 0%, 100% { translate: 0 0; } 50% { translate: 0 -10px; } }
  @keyframes floorPulse { 0%, 100% { transform: scaleX(1); opacity: 1; } 50% { transform: scaleX(.9); opacity: .75; } }
</style>
<img class="banner" src="overlay-base.png" alt="">
<div class="book__floor"></div>
<div class="stage">
  <div class="book">
    <div class="book__spine"><span>JEFFREY EPSTEIN WAS A <b>CIA ASSET</b></span><em>SULLIVAN</em></div>
    <div class="book__pages"></div>
    <div class="book__back"></div>
    <div class="book__cover"><img src="cover.jpg" alt=""><i class="book__sheen"></i></div>
  </div>
</div>
`;
  await writeFile(`${OUT}/overlay.html`, html);
}

// ---------- 2. Zoom virtual background ----------
// Jason sits in the middle; the top corners stay visible, so that is where everything goes.
async function buildBackground() {
  const qrSize = 300, pad = 18, tile = qrSize + pad * 2;
  const qrX = W - 110 - tile, qrY = 90;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="g" cx="50%" cy="60%" r="75%">
        <stop offset="0" stop-color="#1c1b1e"/><stop offset="1" stop-color="${INK}"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect x="0" y="0" width="${W}" height="6" fill="${GOLD}"/>
    <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${GOLD}"/>
    <!-- wordmark, top-left -->
    ${mark(170, 160, 54)}
    <text x="262" y="192" ${WORD} font-size="92" fill="#fff">THE <tspan fill="${RED}">CIA</tspan> ASSET</text>
    <text x="264" y="262" ${SANS} font-weight="bold" font-size="54" fill="${GOLD}">theciaasset.com</text>
    <text x="264" y="318" ${SANS} font-size="30" fill="#d9d4c7">Jeffrey Epstein Was A CIA Asset — the book by Jason Sullivan</text>
    <!-- QR tile, top-right -->
    <rect x="${qrX}" y="${qrY}" width="${tile}" height="${tile}" rx="16" fill="${PAPER}"/>
    <text x="${qrX + tile / 2}" y="${qrY + tile + 44}" ${SANS} font-weight="bold" font-size="26" fill="#fff" text-anchor="middle" letter-spacing="3">SCAN FOR THE BOOK</text>
  </svg>`;

  const qr = await qrPng(qrSize);
  const jpg = await sharp(Buffer.from(svg))
    .composite([{ input: qr, left: qrX + pad, top: qrY + pad }])
    .jpeg({ quality: 95 }).toBuffer();
  await writeFile(`${OUT}/zoom-virtual-background-1920x1080.jpg`, jpg);
}

await buildOverlay();
await buildBackground();
console.log("built");
