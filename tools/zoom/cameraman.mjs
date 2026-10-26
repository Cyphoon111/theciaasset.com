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
function transform({ z, px, py }) {
  const bw = W * z, bh = H * z;
  return { boundsWidth: bw, boundsHeight: bh, positionX: (W - bw) / 2 + px, positionY: (H - bh) / 2 + py };
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
    } else if (m.op === 2) { log("cameraman on"); setFrame(cur); setTracker(TRACKER_BASE, "base framing"); schedule(); setInterval(requestFrame, 100); }
    else if (m.op === 7 && m.d.requestId === "frame" && m.d.responseData) onFrame(m.d.responseData);
  };
}

// ---- motion → focus pull (Jason, 2026-10-26: "whenever I move... there must be a visual LIVE
// cameraman effect that he is focusing in on and sharpening his focus in on me") ----
// A 96x54 frame of the camera every 300 ms; the mean change in brightness between frames is
// the motion score. Past the threshold: drop focus (the Focus filter renders the camera at
// low resolution), rack back to sharp over half a second, sharpen a touch, and lean in.
// Calibrated 2026-10-26 at 96x54 over 300 ms: sitting still reads 2–4, a real move 6–24.
// Frames come every 100 ms; each is compared with the one from 300 ms ago, so the score
// keeps that calibration while the reaction comes within a tenth of a second.
const MOTION_THRESH = Number(process.env.MOTION_THRESH || 5);
const COOLDOWN_MS = 1500;                         // "immediate upon me moving"
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
const RACK = ["416x234", "432x243", "448x252", "472x266", "496x279", "520x293", "544x306", "576x324", "608x342",
              "640x360", "672x378", "712x401", "752x423", "792x446", "832x468", "880x495", "928x522", "976x549",
              "1024x576", "1072x603", "1120x630", "1176x662", "1232x693", "1288x725", "1344x756", "1400x788",
              "1456x819", "1528x860", "1600x900", "1680x945", "1760x990", "1840x1035"];
const RACK_MS = 16;                                 // one step per frame at 60 fps: ~0.5 s, no visible steps
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
    sharpen(0);
    RACK.forEach((res, i) => setTimeout(() => focus(true, res), i * RACK_MS));
    const T = RACK.length * RACK_MS;
    setTimeout(() => { focus(false); sharpen(0.10); }, T);
    [0.16, 0.22, 0.26].forEach((v, i) => setTimeout(() => sharpen(v), T + 60 + i * 50));   // the lens bites, eased
    [0.20, 0.15, 0.12].forEach((v, i) => setTimeout(() => sharpen(v), T + 400 + i * 120));
    if (!activeTick) {                                         // never grab the frame mid-move
      moveTo({ ...cur, z: cur.z + 0.02 }, 0.5, "lean in");
      setTimeout(() => moveTo(back, 1.2, "settle"), 700);
    }
    setTimeout(() => { pulling = false; }, 1500);
  } else {
    // he is still moving: no re-blur, just the bite of focus and a breath of a lean
    log(`focus touch (motion ${d.toFixed(1)})`);
    [0.06, 0.02].forEach((v, i) => setTimeout(() => sharpen(v), i * 40));
    [0.12, 0.20, 0.24].forEach((v, i) => setTimeout(() => sharpen(v), 110 + i * 45));
    [0.18, 0.14, 0.12].forEach((v, i) => setTimeout(() => sharpen(v), 400 + i * 100));
    if (!activeTick) {
      moveTo({ ...cur, z: cur.z + 0.008 }, 0.4, "lean");
      setTimeout(() => moveTo(back, 0.9, "settle"), 500);
    }
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
const TRACKER_BASE = { track_z: 0.62, track_y: -0.14 };
const TRACKER_CHEST = { track_z: 0.50, track_y: -0.04 };
let chest = false, sinceChest = 0;
function setTracker(s, name) {
  send("SetSourceFilterSettings", { sourceName: "Camera", filterName: "Auto-framing", filterSettings: s });
  log(`${name}: tracker ${JSON.stringify(s)}`);
}
function chestShot() {
  chest = true; sinceChest = 0;
  if (cur.z !== 1) moveTo(SHOTS.wide(), 4, "wide for the chest");   // the frame itself at rest
  setTracker(TRACKER_CHEST, "chest shot");
  setTimeout(() => { setTracker(TRACKER_BASE, "back to head and shoulders"); chest = false; }, rnd(20, 30) * 1000);
}
function schedule() {
  // hold a shot for 45–100 s, then a slow 3–5 s drift to a different shot;
  // every third change or so is the chest shot
  setTimeout(() => {
    if (pulling) { setTimeout(schedule, 0); return; }   // never step on a focus pull; try again after the hold
    sinceChest++;
    if (!chest && (sinceChest >= 3 || Math.random() < 0.25)) { chestShot(); schedule(); return; }
    let name; do { name = pick(WEIGHTS); } while (name === last);
    last = name;
    moveTo(SHOTS[name](), rnd(3, 5), name);
    schedule();
  }, pulling ? 1500 : rnd(45, 100) * 1000);
}
connect();
