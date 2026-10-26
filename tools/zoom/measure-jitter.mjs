// Measures vertical jitter of the tracked camera: 40 tiny frames of the Camera source at
// 100 ms, the vertical centre of skin-toned pixels in each, and how much it wobbles
// (standard deviation in 1080p pixels). Used to tune the tracker (2026-10-26).
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

const cfg = JSON.parse(readFileSync(`${homedir()}/Library/Application Support/obs-studio/plugin_config/obs-websocket/config.json`, "utf8"));
const sha = (s) => createHash("sha256").update(s).digest("base64");
const N = Number(process.argv[2] || 40);
const ws = new WebSocket(`ws://127.0.0.1:${cfg.server_port}`);
const ys = [];
function faceY(b) {
  const off = b.readUInt32LE(10), w = b.readInt32LE(18), h = Math.abs(b.readInt32LE(22)), bpp = b.readUInt16LE(28) / 8, row = Math.ceil((w * bpp) / 4) * 4;
  let sy = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = Math.floor(w * 0.3); x < w * 0.7; x++) {
    const p = off + y * row + x * bpp, bl = b[p], g = b[p + 1], r = b[p + 2];
    if (r > 90 && r > g + 15 && g > bl && r - bl > 30 && r < 235) { sy += y; n++; }
  }
  return n > 20 ? (sy / n) * (1080 / h) : null;
}
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.op === 0) { const a = m.d.authentication; ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, authentication: a ? sha(sha(cfg.server_password + a.salt) + a.challenge) : undefined } })); }
  else if (m.op === 2) { let i = 0; const t = setInterval(() => { if (i++ >= N) { clearInterval(t); return; } ws.send(JSON.stringify({ op: 6, d: { requestType: "GetSourceScreenshot", requestId: "f", requestData: { sourceName: "Camera", imageFormat: "bmp", imageWidth: 192, imageHeight: 108 } } })); }, 100); }
  else if (m.op === 7 && m.d.responseData) {
    const y = faceY(Buffer.from(m.d.responseData.imageData.split(",")[1], "base64"));
    if (y !== null) ys.push(y);
    if (ys.length >= N - 2) {
      const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
      const sd = Math.sqrt(ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length);
      let jumps = 0; for (let k = 1; k < ys.length; k++) if (Math.abs(ys[k] - ys[k - 1]) > 3) jumps++;
      console.log(`face centre y ≈ ${mean.toFixed(0)} px; vertical wobble sd ${sd.toFixed(2)} px; frame-to-frame jumps >3 px: ${jumps} of ${ys.length}`);
      ws.close(); process.exit(0);
    }
  }
};
