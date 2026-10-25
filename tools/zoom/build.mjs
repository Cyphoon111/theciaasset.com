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

// A logo that lives on white, as a white sticker: crop to the artwork (plus a margin),
// scale to `width`, round the corners with `radius`. Nothing inside is altered.
async function stickerPng(src, width, radius) {
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, x1 = 0, y0 = info.height, y1 = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    if (Math.min(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) < 236) {
      const x = i % info.width, y = (i - x) / info.width;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const m = Math.round((x1 - x0) * 0.012);                      // a sliver of white around the artwork
  const left = Math.max(0, x0 - m), top = Math.max(0, y0 - m);
  const cw = Math.min(info.width - left, x1 - x0 + 2 * m), ch = Math.min(info.height - top, y1 - y0 + 2 * m);
  const scaled = await sharp(src).extract({ left, top, width: cw, height: ch }).resize({ width }).png().toBuffer();
  const h = (await sharp(scaled).metadata()).height;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}"><rect width="${width}" height="${h}" rx="${radius}" fill="#fff"/></svg>`);
  return sharp(scaled).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
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
  // One white banner across the bottom (Jason, 2026-10-25: "a white banner at the bottom
  // that includes the book logo, Unleashed.news logo and the QR code all fit proportionally
  // within it. The book floats above it."). Left: the mark + THE CIA ASSET + URL. Centre:
  // the Unleashed.news logo (already on white). Right: the QR with its label. A red rule
  // along the top. The 3D book stands above the left block.
  const SH = 130, SY = H - SH;                              // banner strip (170 → 130, Jason: "slightly thinner. More professional")
  const RULE = 4;                                           // red rule along the top (shimmers in the animated page)
  const pad = 10;
  const qrSize = SH - 2 * pad, qrX = W - 50 - qrSize, qrY = SY + pad;
  const ltX = 50, ltY = SY;                                 // left block
  const unW = 236;                                          // Unleashed.news width in the strip (URL sits under it)
  const UNPINK = "#d6077c";                                 // the logo's badge pink

  const FROST = 0.86;                                       // strip opacity (Jason: "slightly translucent")

  // Book cover, standing above the left block, centred over the wordmark.
  const cvW = 230, cvH = Math.round(cvW * 3 / 2), cvX = 150, cvY = SY - 22 - cvH;

  // Unleashed.news logo, untouched (it lives on white), centred, frosted like the strip.
  const unleashed = await stickerPng("/Users/jasonsullivan/Developer/unleashed.news/assets/logo.png", unW, 0);
  await writeFile(`${OUT}/unleashed-sticker.png`, unleashed);
  const unH = (await sharp(unleashed).metadata()).height;
  const unX = Math.round(W / 2 - unW / 2), unY = SY + 10;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <!-- cover frame -->
    <rect x="${cvX - 4}" y="${cvY - 4}" width="${cvW + 8}" height="${cvH + 8}" rx="4" fill="${GOLD}"/>
    <!-- lower third -->
    <mask id="strip"><rect x="0" y="${SY}" width="${W}" height="${SH}" fill="#fff"/><rect x="${unX}" y="${unY}" width="${unW}" height="${unH}" fill="#000"/></mask>
    <rect x="0" y="${SY}" width="${W}" height="${SH}" fill="${PAPER}" fill-opacity="${FROST}" mask="url(#strip)"/>
    <image x="${unX}" y="${unY}" width="${unW}" height="${unH}" opacity="${FROST}" href="data:image/png;base64,${unleashed.toString("base64")}"/>
    <text x="${W / 2}" y="${unY + unH + 22}" ${SANS} font-weight="bold" font-size="21" fill="${UNPINK}" text-anchor="middle" letter-spacing="1.5">unleashed.news</text>
    <!-- the QR keeps a solid white tile: a see-through quiet zone can break a scan -->
    <!-- qr tile --><rect x="${qrX - 6}" y="${qrY - 6}" width="${qrSize + 12}" height="${qrSize + 12}" rx="6" fill="${PAPER}"/><!-- /qr tile -->
    <!-- red rule --><rect x="0" y="${SY}" width="${W}" height="${RULE}" fill="${RED}"/><!-- /red rule -->
    <circle cx="${ltX + 32}" cy="${SY + SH / 2 + 2}" r="29" fill="none" stroke="${INK}" stroke-width="6"/>
    <circle cx="${ltX + 32}" cy="${SY + SH / 2 + 2}" r="11" fill="${RED}"/>
    <text x="${ltX + 84}" y="${SY + 66}" ${WORD} font-size="50" fill="${INK}">THE <tspan fill="${RED}">CIA</tspan> ASSET</text>
    <text x="${ltX + 86}" y="${SY + 106}" ${SANS} font-weight="bold" font-size="30" fill="#9c7a2c">theciaasset.com</text>
    <!-- QR label -->
    <text x="${qrX - 24}" y="${SY + SH / 2 - 4}" ${SANS} font-weight="bold" font-size="19" fill="${INK}" text-anchor="end" letter-spacing="2">SCAN FOR</text>
    <text x="${qrX - 24}" y="${SY + SH / 2 + 22}" ${SANS} font-weight="bold" font-size="19" fill="${INK}" text-anchor="end" letter-spacing="2">THE BOOK</text>
  </svg>`;

  const qr = await qrPng(qrSize);
  const coverSrc = "/Users/jasonsullivan/Developer/theciaasset.com/assets/cover.jpg";
  const cover = await sharp(coverSrc).resize(cvW, cvH, { fit: "cover" }).png().toBuffer();
  const base = sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

  const qrLayer = { input: qr, left: qrX, top: qrY };

  // Static banner (flat cover baked in): the fallback for anything that can only take a picture.
  await writeFile(`${OUT}/overlay-1920x1080.png`, await base.clone()
    .composite([{ input: Buffer.from(svg) }, { input: cover, left: cvX, top: cvY }, qrLayer])
    .png().toBuffer());

  // Base for the animated page: everything except the cover, which the page draws itself in 3D.
  const svgNoFrame = svg.replace(/<!-- cover frame -->[\s\S]*?<!-- lower third -->/, "<!-- lower third -->")
    .replace(/<!-- red rule -->[\s\S]*?<!-- \/red rule -->/, "")    // the page draws the rule itself, with the shimmer
    .replace(/<!-- qr tile -->[\s\S]*?<!-- \/qr tile -->/, "");     // and the QR tile, which travels with the book
  await writeFile(`${OUT}/overlay-base.png`, await base.clone()
    .composite([{ input: Buffer.from(svgNoFrame) }])
    .png().toBuffer());
  await writeFile(`${OUT}/qr.png`, qr);
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
  /* Every 60 s the book glides right to just left of centre, grows 30%, hovers 7 s with the URL
     under it, then glides home (Jason, 2026-10-25). The rig carries book, shadow and caption;
     it pivots on the book's base so the base lifts only a little and the book grows upward. */
  .rig { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; pointer-events: none;
    transform-origin: ${cvX + cvW / 2}px ${cvY + cvH}px; animation: tour 60s ease-in-out infinite; }
  .caption { position: absolute; left: ${cvX + cvW / 2 - 120}px; top: ${cvY + cvH + 10}px; width: 240px; height: 30px; line-height: 30px;
    text-align: center; border-radius: 8px; background: rgba(11,11,13,.88); color: ${GOLD};
    font: 700 19px/30px 'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing: .5px;
    opacity: 0; animation: captionFade 60s linear infinite; }
  /* One trip per minute, at the END of the minute (47 s rest, 2 s out, 7 s hover, 2 s back),
     so a page reload — which restarts the clock — never fires an extra one. */
  @keyframes tour {
    0%, 78.5%  { transform: translate(0, 0) scale(1); }
    82%, 93.5% { transform: translate(${620 - (cvX + cvW / 2)}px, -120px) scale(1.3); }   /* hover: centre x≈620, level with his face, clear of it (Jason, 2026-10-25) */
    97%, 100%  { transform: translate(0, 0) scale(1); }
  }
  @keyframes captionFade { 0%, 82% { opacity: 0; } 84%, 92.5% { opacity: 1; } 94%, 100% { opacity: 0; } }
  /* The QR rides the same clock: at rest in its banner tile; during the hover it lifts to the
     right of his face and doubles, with its label under it (Jason, 2026-10-25). */
  .qrrig { position: absolute; left: ${qrX - 6}px; top: ${qrY - 6}px; width: ${qrSize + 12}px; height: ${qrSize + 12}px;
    background: #fff; border-radius: 6px; transform-origin: 50% 50%; animation: qrTour 60s ease-in-out infinite; }
  .qrrig img { position: absolute; left: 6px; top: 6px; width: ${qrSize}px; height: ${qrSize}px; image-rendering: pixelated; }
  .qrcap { position: absolute; left: 50%; top: calc(100% + 6px); transform: translateX(-50%); white-space: nowrap;
    padding: 0 9px; height: 17px; line-height: 17px; border-radius: 5px; background: rgba(11,11,13,.88); color: #fff;
    font: 700 10px/17px 'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing: 1.2px;
    opacity: 0; animation: captionFade 60s linear infinite; }
  @keyframes qrTour {
    0%, 78.5%  { transform: translate(0, 0) scale(1); }
    82%, 93.5% { transform: translate(${1440 - (qrX + qrSize / 2)}px, ${580 - (qrY + qrSize / 2)}px) scale(2); }
    97%, 100%  { transform: translate(0, 0) scale(1); }
  }
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
  /* the red rule along the top of the banner, with a slow left-to-right shimmer */
  .rule { position: absolute; left: 0; top: ${SY}px; width: ${W}px; height: ${RULE}px; background: ${RED}; overflow: hidden; }
  .rule::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 28%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.95) 50%, transparent);
    animation: shimmer 9s linear infinite; }
  /* a gloss sweeping the banner itself, same width, same clock as the rule, so they move as one;
     it stops short of the QR tile so the code never loses contrast */
  .gloss { position: absolute; left: 0; top: ${SY + RULE}px; width: ${W}px; height: ${SH - RULE}px; overflow: hidden;
    clip-path: inset(0 ${W - (qrX - 24)}px 0 0); pointer-events: none; }
  .gloss::after { content: ''; position: absolute; top: -20%; bottom: -20%; left: 0; width: 28%;
    background: linear-gradient(100deg,
      transparent 14%, rgba(11,11,13,.07) 30%,           /* soft shade leading the flash */
      rgba(255,255,255,.95) 46%, rgba(255,246,214,1) 50%, /* the flash, warming to gold */
      rgba(201,162,75,.45) 56%, rgba(11,11,13,.07) 68%,  /* gold tail, soft shade trailing */
      transparent 84%);
    animation: shimmer 9s linear infinite; }
  @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
</style>
<img class="banner" src="overlay-base.png" alt="">
<div class="gloss"></div>
<div class="rule"></div>
<div class="qrrig"><img src="qr.png" alt=""><div class="qrcap">SCAN FOR THE BOOK</div></div>
<div class="rig">
<div class="book__floor"></div>
<div class="caption">theciaasset.com</div>
<div class="stage">
  <div class="book">
    <div class="book__spine"><span>JEFFREY EPSTEIN WAS A <b>CIA ASSET</b></span><em>SULLIVAN</em></div>
    <div class="book__pages"></div>
    <div class="book__back"></div>
    <div class="book__cover"><img src="cover.jpg" alt=""><i class="book__sheen"></i></div>
  </div>
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
