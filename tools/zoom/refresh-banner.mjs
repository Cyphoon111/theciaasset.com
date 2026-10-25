// Tells a running OBS to reload the Banner browser source (after a rebuild), without
// restarting OBS or dropping the virtual camera. Uses the same remote-control channel
// as on-air.mjs. Exits non-zero if OBS is not running.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

const cfg = JSON.parse(readFileSync(`${homedir()}/Library/Application Support/obs-studio/plugin_config/obs-websocket/config.json`, "utf8"));
const sha = (s) => createHash("sha256").update(s).digest("base64");
const ws = new WebSocket(`ws://127.0.0.1:${cfg.server_port}`);
const done = (msg, code = 0) => { console[code ? "error" : "log"](msg); try { ws.close(); } catch {} process.exit(code); };
setTimeout(() => done("OBS did not answer (is it running?)", 1), 8000);
ws.onerror = () => done("OBS did not answer (is it running?)", 1);
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.op === 0) {
    const a = m.d.authentication;
    ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, authentication: a ? sha(sha(cfg.server_password + a.salt) + a.challenge) : undefined } }));
  } else if (m.op === 2) {
    ws.send(JSON.stringify({ op: 6, d: { requestType: "PressInputPropertiesButton", requestId: "r", requestData: { inputName: "Banner", propertyName: "refreshnocache" } } }));
  } else if (m.op === 7) {
    m.d.requestStatus.result ? done("banner reloaded in OBS") : done(`OBS said: ${m.d.requestStatus.comment || m.d.requestStatus.code}`, 1);
  }
};
