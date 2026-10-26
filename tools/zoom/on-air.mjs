// On Air: open OBS and start its virtual camera once OBS is actually ready.
//
// Launching OBS with --startvirtualcam fires "The virtual camera is not installed"
// because OBS tries before it has checked the camera extension. So instead this
// script enables OBS's built-in remote control (obs-websocket, local port 4455,
// password kept in OBS's own config), opens OBS, waits until it answers, and asks
// it to start the virtual camera. Safe to run when OBS is already open.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

const cfgPath = `${homedir()}/Library/Application Support/obs-studio/plugin_config/obs-websocket/config.json`;
const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, "utf8")) : {};
if (!cfg.server_enabled || !cfg.server_port) {
  Object.assign(cfg, { server_enabled: true, server_port: cfg.server_port || 4455, auth_required: true,
    server_password: cfg.server_password || createHash("sha256").update(String(Math.random())).digest("base64").slice(0, 16),
    first_load: false });
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
}
const port = cfg.server_port, password = cfg.server_password;

execFileSync("open", ["-a", "OBS"]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => createHash("sha256").update(s).digest("base64");

// One identified obs-websocket connection, with request() awaiting each reply.
function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const pending = new Map();
    let n = 0;
    ws.onerror = () => reject(new Error("no answer"));
    ws.onclose = () => { for (const p of pending.values()) p.reject(new Error("OBS closed the connection")); };
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.op === 0) {                                   // Hello
        const a = m.d.authentication;
        const auth = a ? sha(sha(password + a.salt) + a.challenge) : undefined;
        ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, authentication: auth } }));
      } else if (m.op === 2) {                            // Identified
        resolve({
          request: (requestType, requestData) => new Promise((res, rej) => {
            const requestId = String(++n);
            pending.set(requestId, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
          }),
          close: () => { try { ws.close(); } catch {} },
        });
      } else if (m.op === 7 && pending.has(m.d.requestId)) {
        const p = pending.get(m.d.requestId); pending.delete(m.d.requestId);
        p.resolve({ ok: m.d.requestStatus.result, code: m.d.requestStatus.code, comment: m.d.requestStatus.comment, data: m.d.responseData || {} });
      }
    };
  });
}

// Ask OBS to start the camera ONCE. Every StartVirtualCam that fails pops a dialog in OBS, so
// a retry loop on failure buries the screen in them (2026-10-26). Retries here are only for
// "OBS not answering yet"; after a connection the one attempt decides.
//
// OBS answers StartVirtualCam before the output is actually running: on 2026-10-26 the status
// check 5 ms later still said "not active", On Air quit with a dialog, and OBS switched the
// camera on 14 ms after that — with the cameraman and record hook never started. So after the
// request, the status is polled for up to 15 s before the camera is called off.
async function startCamera() {
  const obs = await connect();                            // throws "no answer" while OBS is still coming up
  try {
    const v = (await obs.request("GetVideoSettings")).data;
    if (v.fpsNumerator !== 60 || v.fpsDenominator !== 1)   // OBS does not keep this across restarts reliably
      await obs.request("SetVideoSettings", { fpsNumerator: 60, fpsDenominator: 1 });
    if (!(await obs.request("GetVirtualCamStatus")).data.outputActive) {
      const r = await obs.request("StartVirtualCam");
      if (!r.ok && r.code !== 500) throw new Error(`OBS refused StartVirtualCam: ${r.code} ${r.comment || ""}`);  // 500 = already running
    }
    for (let i = 0; i < 30; i++) {
      if ((await obs.request("GetVirtualCamStatus")).data.outputActive) return "virtual camera on";
      await sleep(500);
    }
    throw new Error("the virtual camera did not come on within 15 s");
  } finally { obs.close(); }
}

let last;
for (let i = 0; i < 60; i++) {                            // up to ~60 s for OBS to come up
  try {
    console.log(await startCamera());
    // Helpers ride along while OBS runs, one of each: a second On Air click (or a second
    // helper after a false failure) must not start a second copy — two record hooks would
    // publish every show twice.
    const running = (script) => { try { return execFileSync("pgrep", ["-f", script], { encoding: "utf8" }).trim() !== ""; } catch { return false; } };
    const helper = (script) => { if (existsSync(script) && !running(script)) spawn(process.execPath, [script], { detached: true, stdio: "ignore" }).unref(); };
    // The camera operator (cameraman.mjs) with its face detector (facepos) lives in the
    // repository checkout; On Air.app only carries this script. The bundle path is the
    // fallback (decoded: "On Air.app" has a space, which the URL spells %20). Until
    // 2026-10-26 the launcher looked beside itself and so never started the operator.
    const repo = "/Users/jasonsullivan/Developer/theciaasset.com/tools/zoom";
    const here = decodeURIComponent(new URL(".", import.meta.url).pathname);
    helper(existsSync(`${repo}/cameraman.mjs`) ? `${repo}/cameraman.mjs` : `${here}cameraman.mjs`);
    // and the record hook: when a recording stops, the show is published to unleashed.news/shows
    helper("/Users/jasonsullivan/Developer/unleashed.news/tools/shows/record-hook.mjs");
    process.exit(0);
  } catch (e) {
    last = e;
    if (e.message !== "no answer") break;                 // OBS answered and the one attempt failed: say so once
    await sleep(1000);
  }
}
console.error(`Could not start the virtual camera: ${last?.message}`);
process.exit(1);
