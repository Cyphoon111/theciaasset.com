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
const SHOTS = {
  "wide":          () => ({ z: 1.0, px: 0, py: 0 }),
  "medium":        () => ({ z: rnd(1.10, 1.16), px: rnd(-30, 30), py: rnd(-10, 10) }),
  "push in":       () => ({ z: rnd(1.24, 1.32), px: rnd(-40, 40), py: rnd(-20, 10) }),
  "reframe left":  () => ({ z: rnd(1.16, 1.26), px: rnd(90, 130), py: rnd(-10, 10) }),    // he sits right of centre
  "reframe right": () => ({ z: rnd(1.16, 1.26), px: rnd(-130, -90), py: rnd(-10, 10) }),  // he sits left of centre
  "low angle":     () => ({ z: rnd(1.14, 1.22), px: rnd(-30, 30), py: rnd(40, 70) }),      // more headroom
};
const WEIGHTS = ["wide", "wide", "medium", "medium", "push in", "push in", "reframe left", "reframe right", "low angle"];

let ws, cur = { z: 1, px: 0, py: 0 }, last = "";
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
    } else if (m.op === 2) { log("cameraman on"); setFrame(cur); schedule(); }
  };
}

// glide from the current framing to the target over `secs`, 30 steps a second
function moveTo(target, secs, name) {
  const from = { ...cur }, steps = Math.round(secs * 30);
  let i = 0;
  const tick = setInterval(() => {
    i++;
    const t = ease(i / steps);
    cur = { z: from.z + (target.z - from.z) * t, px: from.px + (target.px - from.px) * t, py: from.py + (target.py - from.py) * t };
    setFrame(cur);
    if (i >= steps) clearInterval(tick);
  }, 1000 / 30);
  log(`${name}: zoom ${target.z.toFixed(2)} pan ${target.px.toFixed(0)},${target.py.toFixed(0)} over ${secs.toFixed(1)} s`);
}
function schedule() {
  // hold a shot for 8–20 s, then a 1.2–2.2 s move to a different shot
  setTimeout(() => {
    let name; do { name = pick(WEIGHTS); } while (name === last);
    last = name;
    moveTo(SHOTS[name](), rnd(1.2, 2.2), name);
    schedule();
  }, rnd(8, 20) * 1000);
}
connect();
