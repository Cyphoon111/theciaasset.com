// The camera operator. Runs while OBS runs. The Auto-framing tracker keeps Jason centred;
// this process moves the camera frame itself (the Camera scene item's zoom and position)
// with crisp, eased one-to-two-second moves at random intervals: push in, pull back, a
// reframe left or right, a drift. (Jason, 2026-10-26: "the effect that I have a camera man
// filming me ... These moves by the professional camera man should be random" ... "the moves
// need to be more sharp so they are actually noticeable".)
//
//   node cameraman.mjs          runs until OBS goes away
//   started automatically by on-air.mjs
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

const HOME = homedir();
const LOG = `${HOME}/Library/Logs/on-air-cameraman.log`;
const PIDFILE = `${HOME}/Library/Application Support/obs-studio/cameraman.pid`;
const SCENE = "On Air", ITEM = 1;                 // the Camera scene item
const W = 1920, H = 1080;
const BANNER = 150;                               // the banner covers the bottom 150 px of the canvas
const FLOOR = H - BANNER;                         // the picture's bottom edge always sits here, never under the banner
const log = (s) => { try { appendFileSync(LOG, `${new Date().toISOString()} ${s}\n`); } catch {} };

// one operator at a time
if (existsSync(PIDFILE)) {
  const pid = Number(readFileSync(PIDFILE, "utf8"));
  try { process.kill(pid, 0); console.log(`cameraman already running (pid ${pid})`); process.exit(0); } catch {}
}
writeFileSync(PIDFILE, String(process.pid));

const cfg = JSON.parse(readFileSync(`${HOME}/Library/Application Support/obs-studio/plugin_config/obs-websocket/config.json`, "utf8"));
const sha = (s) => createHash("sha256").update(s).digest("base64");
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // ease-in-out

// A framing = zoom (1 = the whole tracked picture) and a pan in canvas pixels.
// The tracker keeps his face at the centre, so zooming on the centre zooms on him.
// His head stays on the centre line, in line with the Unleashed.news logo in the banner
// (Jason, 2026-10-26): no sideways pans, ever. Only zoom and a little headroom vary.
// The banner covers the bottom 130 px, so a shot may only ever lift the picture (py ≤ 0),
// never lower it: chin and neck stay clear (Jason, 2026-10-26: "NEVER CUT OFF MY CHIN OR NECK").
// The tracker now holds a real crop of its own (≈1.5x, so it can always pan him onto the
// centre line), so the operator's zooms stay modest to keep the total under ≈1.8x.
// Only from time to time, and only slightly: a touch in, or back out (Jason, 2026-10-26:
// "IT SHOULD ALWAYS ADJUST WHEN I MOVE... AND THEN PERIODICALLY ONLY FROM TIME TO TIME
// DOES IT ZOOM IN SLIGHTLY OR PAN OUT SLIGHTLY").
const SHOTS = {
  "wide":          () => ({ z: 1.0, px: 0, py: 0 }),
  "a touch in":    () => ({ z: rnd(1.04, 1.07), px: 0, py: rnd(-14, -8) }),
  "in":            () => ({ z: rnd(1.07, 1.10), px: 0, py: rnd(-22, -14) }),
};
const WEIGHTS = ["wide", "a touch in", "a touch in", "in"];

let ws, cur = { z: 1, px: 0, py: 0 }, last = "", activeTick = null;
// The picture is anchored to the top of the banner: its bottom row lands on FLOOR, so nothing
// the lens sees at the bottom (neck, collar, breast pocket) is ever hidden behind the banner
// (Jason, 2026-10-26). What gets cropped instead is the top of the lens view: ceiling and
// whiteboard. py ≤ 0 lifts it further still.
function transform({ z, px, py }) {
  const bw = W * z, bh = H * z;
  return { boundsWidth: bw, boundsHeight: bh, positionX: (W - bw) / 2 + px, positionY: FLOOR - bh + py };
}
function send(type, data, id = "op") { ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: id, requestData: data } })); }
function setFrame(f) { send("SetSceneItemTransform", { sceneName: SCENE, sceneItemId: ITEM, sceneItemTransform: transform(f) }); }

function connect() {
  ws = new WebSocket(`ws://127.0.0.1:${cfg.server_port}`);
  ws.onerror = () => {};
  ws.onclose = () => { log("OBS gone, cameraman off"); try { writeFileSync(PIDFILE, ""); } catch {} process.exit(0); };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.op === 0) {
      const a = m.d.authentication;
      ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, authentication: a ? sha(sha(cfg.server_password + a.salt) + a.challenge) : undefined } }));
    } else if (m.op === 2) {
      log("cameraman on"); setFrame(cur); setTracker(TRACKER_BASE, "base framing"); schedule(); setInterval(requestFrame, 100);
      if (process.env.CHEST_NOW) setTimeout(chestShot, 1000);   // test mode: the chest shot right away
    }
    else if (m.op === 7 && m.d.requestId === "frame" && m.d.responseData) onFrame(m.d.responseData);
    else if (m.op === 7 && m.d.requestId === "chestframe" && m.d.responseData) onChestFrame(m.d.responseData);
  };
}

// Where is the top of his head in the lens? Skin-toned pixels in the middle half of the
// frame, scanned from the top; the first row with a run of them is the forehead/hair line.
function onChestFrame(data) {
  if (!chest) return;
  const b = Buffer.from(data.imageData.split(",")[1], "base64");
  const off = b.readUInt32LE(10), w = b.readInt32LE(18), h = Math.abs(b.readInt32LE(22)), bpp = b.readUInt16LE(28) / 8;
  const row = Math.ceil((w * bpp) / 4) * 4;
  let top = -1;
  for (let y = 0; y < h && top < 0; y++) {
    let skin = 0;
    for (let x = Math.floor(w * 0.25); x < w * 0.75; x++) {
      const p = off + y * row + x * bpp, bl = b[p], g = b[p + 1], r = b[p + 2];
      if (r > 90 && r > g + 15 && g > bl && r - bl > 30 && r < 235) skin++;
    }
    if (skin > w * 0.06) top = y;
  }
  if (top < 0) { log("chest shot: no face found, keeping the lens at rest"); return; }
  const headTop = Math.round(top * (H / h)) - 28;                 // hair room above the skin line
  const lift = Math.max(0, Math.min(BANNER, headTop - 12));       // lift until the head sits just under the top: every row counts at the bottom
  log(`chest shot: head top near lens row ${headTop + 40}, lifting the picture ${lift} px`);
  moveTo({ z: 1.0, px: 0, py: BANNER - lift }, 2.5, "head up");
}

// ---- motion → focus pull (Jason, 2026-10-26: "whenever I move... there must be a visual LIVE
// cameraman effect that he is focusing in on and sharpening his focus in on me") ----
// A 96x54 frame of the camera every 300 ms; the mean change in brightness between frames is
// the motion score. Past the threshold: drop focus (the Focus filter renders the camera at
// low resolution), rack back to sharp over half a second, sharpen a touch, and lean in.
// Calibrated 2026-10-26 at 96x54 over 300 ms: sitting still reads 2–4, a real move 6–24.
// Frames come every 100 ms; each is compared with the one from 300 ms ago, so the score
// keeps that calibration while the reaction comes within a tenth of a second.
// Re-calibrated in his second room (neon wall, 2026-10-26): sitting still reads 5–8 there,
// so the bar is 11 — a real move, never the room's own flicker.
const MOTION_THRESH = Number(process.env.MOTION_THRESH || 16);   // a real move only
const COOLDOWN_MS = 6000;                                          // and not again for six seconds
const FULL_PULL_GAP_MS = 6000;                    // a full rack at most this often; in between, light touches
let frames = [], lastPull = 0, lastFull = 0, pulling = false, peak = 0, lastPeakLog = 0;
function requestFrame() { send("GetSourceScreenshot", { sourceName: "Camera", imageFormat: "bmp", imageWidth: 96, imageHeight: 54 }, "frame"); }
function onFrame(data) {
  const b = Buffer.from(data.imageData.split(",")[1], "base64");
  const off = b.readUInt32LE(10), w = b.readInt32LE(18), h = Math.abs(b.readInt32LE(22)), bpp = b.readUInt16LE(28) / 8;
  const row = Math.ceil((w * bpp) / 4) * 4;
  const luma = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = off + y * row + x * bpp; luma[y * w + x] = 0.114 * b[p] + 0.587 * b[p + 1] + 0.299 * b[p + 2]; }
  if (pulling) { frames = []; return; }             // the pull's own blur is not motion
  frames.push(luma); if (frames.length > 4) frames.shift();
  if (frames.length === 4) {
    const ref = frames[0];
    let s = 0; for (let i = 0; i < luma.length; i++) s += Math.abs(luma[i] - ref[i]);
    const d = s / luma.length, now = Date.now();
    if (d > peak) peak = d;
    if (now - lastPeakLog > 5000) { log(`motion peak ${peak.toFixed(1)}`); peak = 0; lastPeakLog = now; }
    if (d > MOTION_THRESH && now - lastPull > COOLDOWN_MS) focusPull(d, now - lastFull > FULL_PULL_GAP_MS);
  }
}
// The focus rack: a glide from soft to sharp through nine resolutions, 55 ms apart.
// Starts from a real defocus so it reads even on a small preview, then glides to sharp in
// sixteen fine steps, 32 ms apart: one continuous pull, never a skip.
// Gentle rack (Jason, 2026-10-26: "it must ALWAYS BE SMOOTH"): from a mild softness, six
// steps 70 ms apart — each step too small to read as a jump.
const RACK = ["1152x648", "1280x720", "1408x792", "1536x864", "1664x936", "1792x1008"];
const RACK_MS = 70;
// smooth sharpen ramps: many tiny steps instead of snaps
function rampSharpen(from, to, ms, steps = 12, delay = 0) {
  for (let i = 1; i <= steps; i++) setTimeout(() => send("SetSourceFilterSettings", { sourceName: "Camera", filterName: "Sharpen", filterSettings: { sharpness: from + (to - from) * (i / steps) } }), delay + (ms * i) / steps);
}
function focusPull(d, full) {
  pulling = true; lastPull = Date.now();
  const focus = (on, res) => {
    if (res) send("SetSourceFilterSettings", { sourceName: "Camera", filterName: "Focus", filterSettings: { resolution: res } });
    send("SetSourceFilterEnabled", { sourceName: "Camera", filterName: "Focus", filterEnabled: on });
  };
  const sharpen = (v) => send("SetSourceFilterSettings", { sourceName: "Camera", filterName: "Sharpen", filterSettings: { sharpness: v } });
  const back = { ...cur };
  if (full) {
    lastFull = lastPull;
    log(`focus pull (motion ${d.toFixed(1)})`);
    rampSharpen(0.12, 0.0, 120);
    RACK.forEach((res, i) => setTimeout(() => focus(true, res), 120 + i * RACK_MS));
    const T = 120 + RACK.length * RACK_MS;
    setTimeout(() => focus(false), T);
    rampSharpen(0.0, 0.24, 300, 12, T);                      // the lens bites, as a glide
    rampSharpen(0.24, 0.12, 500, 12, T + 320);               // and settles
    // the focus rack is the whole effect: the frame itself never moves on a pull (Jason, 2026-10-26)
    setTimeout(() => { pulling = false; }, T + 900);
  } else {
    // he is still moving: no re-blur, just a glide of focus
    log(`focus touch (motion ${d.toFixed(1)})`);
    rampSharpen(0.12, 0.05, 150);
    rampSharpen(0.05, 0.20, 250, 12, 150);
    rampSharpen(0.20, 0.12, 400, 12, 400);
    setTimeout(() => { pulling = false; }, 900);
  }
}

// glide from the current framing to the target over `secs`, 60 steps a second (OBS renders at 60)
const FPS = 60;
function moveTo(target, secs, name) {
  const from = { ...cur }, steps = Math.round(secs * FPS);
  let i = 0;
  if (activeTick) clearInterval(activeTick);          // a new move takes over from one in progress
  const tick = activeTick = setInterval(() => {
    i++;
    const t = ease(i / steps);
    cur = { z: from.z + (target.z - from.z) * t, px: from.px + (target.px - from.px) * t, py: from.py + (target.py - from.py) * t };
    setFrame(cur);
    if (i >= steps) { clearInterval(tick); if (activeTick === tick) activeTick = null; }
  }, 1000 / FPS);
  log(`${name}: zoom ${target.z.toFixed(2)} pan ${target.px.toFixed(0)},${target.py.toFixed(0)} over ${secs.toFixed(1)} s`);
}
// The chest shot (Jason, 2026-10-26: "Sometimes the cameraman must include my chest in the
// shot. I often wear a pocket square"): the tracker itself widens (its zoom target drops and
// the face rides a little higher), glides there over its own ~4 s, holds 20–30 s, eases back.
// With the picture lifted by the banner height, the face is placed lower in the tracker's
// output so the hair keeps its headroom at the top of the canvas.
const TRACKER_BASE  = { track_z: 0.62, track_y: -0.28, upsize_t: 0.5, upsize_b: 0.8 };
// Chest shot: a box that reaches far below the face pushes the crop window down until it is
// pinned to the bottom of the lens, so the lowest thing the lens sees (the breast pocket)
// is in the shot, while the window still centres him and keeps ~1.1x in hand.
const TRACKER_CHEST = { track_z: 0.5, track_y: 0, upsize_t: 0.3, upsize_b: 2.5 };   // the box outgrows the frame: zoom 1.0, the whole lens, nothing held back
let chest = false, sinceChest = 2;               // starts at 2: the first shot change after start IS the chest shot
function setTracker(s, name) {
  send("SetSourceFilterSettings", { sourceName: "Camera", filterName: "Auto-framing", filterSettings: s });
  log(`${name}: tracker ${JSON.stringify(s)}`);
}
// Measured from Jason's own screenshot (2026-10-26): with the lens at its natural position the
// head top sits near lens row 50 and the pocket square near row 870, x≈1420 — both fit in the
// 930 visible rows. So the chest shot shows the lens UNLIFTED (py = BANNER puts the picture
// back at its natural top), and only the tight shots use the banner anchor.
// The full pull-out: the whole lens frame, shrunk just enough that ALL of it sits above the
// banner (1080 rows into the 930 visible), with narrow dark side bars. Nothing the lens sees is
// off screen — top of the head to the last row at the bottom (Jason, 2026-10-26).
const CHEST_FRAME = { z: FLOOR / H, px: 0, py: 0 };
function chestShot() {
  chest = true; sinceChest = 0;
  moveTo(CHEST_FRAME, 4, "full pull-out: the whole lens above the banner");
  setTracker(TRACKER_CHEST, "chest shot");
  setTimeout(() => { setTracker(TRACKER_BASE, "back to head and shoulders"); moveTo(SHOTS.wide(), 4, "re-anchored"); chest = false; }, rnd(20, 30) * 1000);
}
function schedule() {
  // hold a shot for 45–100 s, then a slow 3–5 s drift to a different shot;
  // every third change or so is the chest shot
  setTimeout(() => {
    if (pulling) { setTimeout(schedule, 0); return; }   // never step on a focus pull; try again after the hold
    sinceChest++;
    if (!chest && (sinceChest >= 2 || Math.random() < 0.35)) { chestShot(); schedule(); return; }   // every other change or so
    let name; do { name = pick(WEIGHTS); } while (name === last);
    last = name;
    moveTo(SHOTS[name](), rnd(3, 5), name);
    schedule();
  }, pulling ? 1500 : rnd(45, 100) * 1000);
}
connect();
