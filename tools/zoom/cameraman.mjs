// The camera operator. Runs while OBS runs and, at random intervals, eases the
// Auto-framing tracker into a new framing: a slow push in, a gentle pull back, a slight
// reframe left or right, a touch more or less headroom, then holds. The tracker's own
// smoothing turns each change into a glide. Zoom is capped so the 1080p picture stays
// sharp. (Jason, 2026-10-26: "the effect that I have a camera man filming me ... these
// moves by the professional camera man should be random.")
//
//   node cameraman.mjs          runs until OBS goes away
//   started automatically by on-air.mjs
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

const HOME = homedir();
const LOG = `${HOME}/Library/Logs/on-air-cameraman.log`;
const PIDFILE = `${HOME}/Library/Application Support/obs-studio/cameraman.pid`;
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

// The framings. track_z: how big the face is (bigger = tighter). upsize l/r: how much room
// either side of the face (unequal = he sits off-centre = a reframe). upsize_t: headroom.
// Measured 2026-10-26: track_z 0.15 = the whole frame, 0.8 = a tight close-up (≈2.2x).
// scale_max 1.8 keeps the tightest shot on the sharp side of a 1080p feed.
const BASE = { track_z: 0.32, upsize_l: 0.5, upsize_r: 0.5, upsize_t: 0.8, upsize_b: 0.75, track_y: 0,
  scale_max: 1.8, Tdlpf_z: 4 };
const MOVES = {
  "push in":        () => ({ track_z: rnd(0.58, 0.66) }),
  "push in a touch":() => ({ track_z: rnd(0.44, 0.50) }),
  "pull back":      () => ({ track_z: rnd(0.18, 0.24) }),
  "settle":         () => ({ track_z: rnd(0.30, 0.36) }),
  "reframe left":   () => ({ upsize_l: rnd(0.66, 0.8), upsize_r: rnd(0.26, 0.36) }),
  "reframe right":  () => ({ upsize_l: rnd(0.26, 0.36), upsize_r: rnd(0.66, 0.8) }),
  "recentre":       () => ({ upsize_l: 0.5, upsize_r: 0.5 }),
  "more headroom":  () => ({ upsize_t: rnd(1.0, 1.2) }),
  "less headroom":  () => ({ upsize_t: rnd(0.55, 0.65) }),
};
const WEIGHTS = ["push in", "push in a touch", "push in a touch", "pull back", "settle", "settle",
  "reframe left", "reframe right", "recentre", "recentre", "more headroom", "less headroom"];

let ws, current = { ...BASE }, lastMove = "";
function connect() {
  ws = new WebSocket(`ws://127.0.0.1:${cfg.server_port}`);
  ws.onerror = () => {};
  ws.onclose = () => { log("OBS gone, cameraman off"); try { writeFileSync(PIDFILE, ""); } catch {} process.exit(0); };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.op === 0) {
      const a = m.d.authentication;
      ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, authentication: a ? sha(sha(cfg.server_password + a.salt) + a.challenge) : undefined } }));
    } else if (m.op === 2) { log("cameraman on"); apply(BASE, "base framing"); schedule(); }
  };
}
function apply(change, name) {
  current = { ...current, ...change };
  ws.send(JSON.stringify({ op: 6, d: { requestType: "SetSourceFilterSettings", requestId: name,
    requestData: { sourceName: "Camera", filterName: "Auto-framing", filterSettings: current } } }));
  log(`${name}: ${JSON.stringify(change)}`);
}
function schedule() {
  // hold a framing for 10–25 s, then make the next move (never the same move twice running)
  setTimeout(() => {
    let name; do { name = pick(WEIGHTS); } while (name === lastMove);
    lastMove = name;
    apply(MOVES[name](), name);
    schedule();
  }, rnd(10, 25) * 1000);
}
connect();
