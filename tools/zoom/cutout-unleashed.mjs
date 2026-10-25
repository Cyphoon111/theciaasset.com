// Makes unleashed-logo.png (transparent) from the Unleashed.news logo, which only
// exists on a hazy off-white background. Cut by shape: the dark pink/blue outlines
// (thickened a little to close glossy gaps) are walls. Regions reachable from the
// picture's edge, and enclosed regions that are mostly neutral white (the band under
// the neon glow line, the holes in A and D), are background, where only the glow is
// kept as translucency. Everything else (letter faces, outlines, shadow) is solid.
// The .NEWS badge is filled as a solid disc so its glossy edge survives.
import sharp from "sharp";

const SRC = process.argv[2] || "/Users/jasonsullivan/Developer/unleashed.news/assets/logo.png";
const OUT = process.argv[3] || "./unleashed-logo.png";

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, N = W * H;
const sat = new Uint8Array(N), dark = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
  sat[i] = Math.max(r, g, b) - Math.min(r, g, b); dark[i] = Math.min(r, g, b);
}

// 1. walls: saturated and not bright, thickened by 2 px
const wall = new Uint8Array(N);
for (let i = 0; i < N; i++) if (sat[i] > 60 && dark[i] < 110) wall[i] = 1;
const wallD = new Uint8Array(N);
for (let i = 0; i < N; i++) if (wall[i]) {
  const x = i % W, y = (i - x) / W;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx >= 0 && yy >= 0 && xx < W && yy < H) wallD[yy * W + xx] = 1;
  }
}

// 2. flood regions between walls
const label = new Int32Array(N).fill(-1);
const stack = new Int32Array(N); let sp = 0;
function flood(seed, id, passable) {
  let area = 0, white = 0, minX = W, maxX = 0, minY = H, maxY = 0;
  stack[sp++] = seed; label[seed] = id;
  while (sp) {
    const i = stack[--sp]; area++;
    if (dark[i] > 235 && sat[i] < 15) white++;
    const x = i % W, y = (i - x) / W;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
    for (const j of nb) if (j >= 0 && label[j] === -1 && passable(j)) { label[j] = id; stack[sp++] = j; }
  }
  return { area, whiteFrac: white / area, minX, maxX, minY, maxY };
}
const open = (j) => !wallD[j];
for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const i = y * W + x; if (label[i] === -1 && open(i)) flood(i, 0, open); }
for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const i = y * W + x; if (label[i] === -1 && open(i)) flood(i, 0, open); }
const clear = new Set([0]);
let id = 0, holes = [], regs = [];
for (let i = 0; i < N; i++) if (label[i] === -1 && open(i)) {
  const reg = flood(i, ++id, open); regs.push(reg);
  if (reg.whiteFrac > 0.5 && reg.area > 300) { clear.add(id); holes.push(reg.area); }
}
if (process.env.DEBUG) for (const r of regs.sort((a, b) => b.area - a.area).slice(0, 8))
  console.log(`region area=${r.area} white=${r.whiteFrac.toFixed(2)} box=${r.minX},${r.minY}-${r.maxX},${r.maxY}`);

// 3. the badge: every pink pixel (any lightness, so the gloss counts) in the lower-right
// corner, filled as the disc that bounds them
let bx0 = W, bx1 = 0, by0 = H, by1 = 0;
for (let i = 0; i < N; i++) {
  const x = i % W, y = (i - x) / W;
  if (x > W * 0.84 && y > H * 0.62 && sat[i] > 30 && data[i * 3] > data[i * 3 + 1]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
}
const badge = { minX: bx0, maxX: bx1, minY: by0, maxY: by1 };
const bcx = (bx0 + bx1) / 2, bcy = (by0 + by1) / 2, br = Math.max(bx1 - bx0, by1 - by0) / 2;

// 4. alpha
label.fill(-1);
for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const i = y * W + x; if (label[i] === -1 && open(i)) flood(i, 0, open); }
for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const i = y * W + x; if (label[i] === -1 && open(i)) flood(i, 0, open); }
id = 0;
for (let i = 0; i < N; i++) if (label[i] === -1 && open(i)) flood(i, ++id, open);
const alpha = Buffer.alloc(N);
for (let i = 0; i < N; i++) {
  const x = i % W, y = (i - x) / W;
  if ((x - bcx) ** 2 + (y - bcy) ** 2 <= br * br) { alpha[i] = 255; continue; }
  const bg = label[i] >= 0 && clear.has(label[i]);
  alpha[i] = bg ? Math.min(200, Math.max(0, sat[i] - 20) * 2) : (wallD[i] && !wall[i] ? Math.min(255, Math.max(0, sat[i] - 12) * 12, (228 - dark[i]) * 12) : 255);
}
const soft = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } }).blur(0.7).toColourspace("b-w").raw().toBuffer();
if (soft.length !== N) throw new Error(`alpha came back as ${soft.length / N} channels`);
// Assemble RGBA by hand and crop to the visible part by hand: sharp's joinChannel/trim
// combination shifted the colour data under the mask.
let cx0 = W, cx1 = 0, cy0 = H, cy1 = 0;
for (let i = 0; i < N; i++) if (soft[i] > 4) { const x = i % W, y = (i - x) / W; if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; if (y < cy0) cy0 = y; if (y > cy1) cy1 = y; }
const cw = cx1 - cx0 + 1, ch = cy1 - cy0 + 1;
const rgba = Buffer.alloc(cw * ch * 4);
for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
  const s = (cy0 + y) * W + (cx0 + x), d = (y * cw + x) * 4;
  rgba[d] = data[s * 3]; rgba[d + 1] = data[s * 3 + 1]; rgba[d + 2] = data[s * 3 + 2]; rgba[d + 3] = soft[s];
}
await sharp(rgba, { raw: { width: cw, height: ch, channels: 4 } }).png().toFile(OUT);
const m = await sharp(OUT).metadata();
console.log(`wrote ${OUT} ${m.width}x${m.height}; enclosed regions ${id}, cleared ${holes.length} (${holes.sort((a, b) => b - a).slice(0, 8).join(", ")}); badge centre ${bcx.toFixed(0)},${bcy.toFixed(0)} r=${br.toFixed(0)}`);
