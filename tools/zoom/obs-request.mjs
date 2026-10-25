// Sends one obs-websocket request to the running OBS and prints the response data.
//   node obs-request.mjs GetVersion
//   node obs-request.mjs CreateSourceFilter '{"sourceName":"Camera","filterName":"Tracker","filterKind":"face_tracker_filter","filterSettings":{...}}'
// Uses the same remote-control channel as on-air.mjs (password read from OBS's own config).
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

const [type, dataArg] = process.argv.slice(2);
if (!type) { console.error("usage: node obs-request.mjs <RequestType> [jsonRequestData]"); process.exit(2); }
const requestData = !dataArg ? undefined : JSON.parse(dataArg.startsWith("@") ? readFileSync(dataArg.slice(1), "utf8") : dataArg);  // @file.json reads the data from a file
const cfg = JSON.parse(readFileSync(`${homedir()}/Library/Application Support/obs-studio/plugin_config/obs-websocket/config.json`, "utf8"));
const sha = (s) => createHash("sha256").update(s).digest("base64");
const ws = new WebSocket(`ws://127.0.0.1:${cfg.server_port}`);
const done = (out, code = 0) => {   // flush before exiting: a big response (a screenshot) would otherwise be cut off
  const text = (typeof out === "string" ? out : JSON.stringify(out, null, 2)) + "\n";
  try { ws.close(); } catch {}
  (code ? process.stderr : process.stdout).write(text, () => process.exit(code));
};
setTimeout(() => done("OBS did not answer (is it running?)", 1), 15000);
ws.onerror = () => done("OBS did not answer (is it running?)", 1);
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.op === 0) {
    const a = m.d.authentication;
    ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, authentication: a ? sha(sha(cfg.server_password + a.salt) + a.challenge) : undefined } }));
  } else if (m.op === 2) {
    ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: "r", requestData } }));
  } else if (m.op === 7) {
    const s = m.d.requestStatus;
    s.result ? done(m.d.responseData ?? { ok: true }) : done(`OBS refused ${type}: ${s.code} ${s.comment || ""}`, 1);
  }
};
