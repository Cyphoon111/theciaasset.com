// On Air: open OBS and start its virtual camera once OBS is actually ready.
//
// Launching OBS with --startvirtualcam fires "The virtual camera is not installed"
// because OBS tries before it has checked the camera extension. So instead this
// script enables OBS's built-in remote control (obs-websocket, local port 4455,
// password kept in OBS's own config), opens OBS, waits until it answers, and asks
// it to start the virtual camera. Safe to run when OBS is already open.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

async function tryOnce() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const fail = (e) => { try { ws.close(); } catch {} reject(e); };
    ws.onerror = () => fail(new Error("no answer"));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.op === 0) {                                   // Hello
        const a = m.d.authentication;
        const auth = a ? sha(sha(password + a.salt) + a.challenge) : undefined;
        ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, authentication: auth } }));
      } else if (m.op === 2) {                            // Identified
        ws.send(JSON.stringify({ op: 6, d: { requestType: "StartVirtualCam", requestId: "on-air" } }));
      } else if (m.op === 7 && m.d.requestId === "on-air") {   // StartVirtualCam answered: now verify
        ws.send(JSON.stringify({ op: 6, d: { requestType: "GetVirtualCamStatus", requestId: "check" } }));
      } else if (m.op === 7 && m.d.requestId === "check") {
        ws.close();
        if (m.d.responseData?.outputActive) resolve("virtual camera on");
        else reject(new Error("virtual camera not active yet"));         // retried by the loop below
      }
    };
  });
}

let last;
for (let i = 0; i < 60; i++) {                           // up to ~60 s for OBS to come up
  try { console.log(await tryOnce()); process.exit(0); } catch (e) { last = e; await sleep(1000); }
}
console.error(`Could not start the virtual camera: ${last?.message}`);
process.exit(1);
