# On-air banner for Zoom shows

A news-style lower third over Jason's live camera: logo bar + theciaasset.com
bottom-left, the site's 3D book (tilted, floating, with its light sweep) standing
above it, and a QR to theciaasset.com bottom-right. It reaches Zoom (or Teams,
Riverside, StreamYard, Meet) through OBS Studio's virtual camera. Set up 2026-10-25.

## The requirements (law)

[REQUIREMENTS.md](REQUIREMENTS.md) is the law for the camera operator: never a skip, always a
multi-million-dollar-studio picture, head centred over the Unleashed logo, head and neck never
cut, still when still, focus on every move, the pull-out with the pocket square, the neon sign
in view. Every change is tested against it. Tag `cameraman-v2` is the state it was written for.

## Locked down 2026-10-26 (tag `cameraman-v1`)

The camera operator, as approved: head centred over the Unleashed.news logo; never cut at
the top of the head or the neck; still when Jason sits still; a smooth focus pull when
he moves; a slight zoom in or out every 45–100 s; a full pull-out (whole lens above the
banner, dark side bars) every other change, which with the lid tilted slightly down
shows the white pocket square. OBS runs at 60 fps. Keep the lid at that angle and sit
roughly in front of the lens.

## Before a show

Click **On Air** in the Dock (or /Applications). It opens OBS and starts the
virtual camera. When OBS shows you with the banner and its button reads
"Stop Virtual Camera", open the Zoom invite and join. Zoom remembers
OBS Virtual Camera, HD on, mirror off, background None.

If Zoom's preview shows the OBS logo on blue instead of you, OBS is not running:
click On Air again.

## Files

- `build.mjs` — generates everything below from the site's cover and icon
  (`npm i && npm run build`). Layout lives in this file: edge margin `M`,
  bar size, cover size.
- `overlay.html` — what OBS shows (Browser Source, 1920x1080, transparent):
  `overlay-base.png` (bar + QR) plus the 3D book from `assets/site.css` rules.
- `overlay-1920x1080.png` — static version with a flat cover, for anything
  that can only take a picture. `overlay-preview*.{jpg,png}` are renders.
- `zoom-virtual-background-1920x1080.jpg` — fallback for a machine without OBS
  (Zoom > Backgrounds > Add Image); branding top corners, replaces the room.
- `cutout-unleashed.mjs` — cuts `unleashed-logo.png` (transparent) out of the
  Unleashed.news logo, which only exists on a white background; the logo sits
  bottom dead centre of the banner.
- `refresh-banner.mjs` — after a rebuild, reloads the banner in a running OBS
  without restarting it (`node refresh-banner.mjs`).
- `on-air.mjs` — the launcher: enables OBS's websocket (port 4455, password
  kept in OBS's own config), opens OBS, waits for it, sends StartVirtualCam.
- `make-launcher.sh` — rebuilds `/Applications/On Air.app` around `on-air.mjs`.
- `cameraman.mjs` — the camera operator: while OBS runs, it holds a shot 8–20 s then
  makes a crisp 1–2 s eased move of the Camera scene item itself (zoom up to 1.32x
  plus a pan): wide, medium, push in, reframe left/right, low angle, at random.
  The tracker only keeps Jason centred (steady track_z, scale_max 1.35). Started by
  On Air; one instance at a time (pid file in the OBS config folder); log at
  ~/Library/Logs/on-air-cameraman.log.
- `obs-request.mjs` — sends one obs-websocket request to the running OBS
  (`node obs-request.mjs GetVersion`, or `... CreateSourceFilter @file.json`).
- `obs/` — backup of the OBS scene collection and profile, plus
  `auto-framing-filter.json`: the face-tracking filter on the Camera source
  (obs-face-tracker plugin, installed in ~/Library/Application Support/obs-studio/plugins).
  It keeps Jason centred and zooms gently as he moves, like Apple's Center Stage,
  which the Nov 2023 M3 Max MacBook Pro's camera does not support. Re-create it with
  `node obs-request.mjs CreateSourceFilter @obs/auto-framing-filter.json`.

## Rebuilding on another Mac

1. `brew install --cask obs`, open OBS once, allow the camera, quit.
2. Copy `obs/The_CIA_Asset.json` to
   `~/Library/Application Support/obs-studio/basic/scenes/` and
   `obs/basic.ini` to `.../basic/profiles/The_CIA_Asset/basic.ini`; fix the
   absolute path to `overlay.html` inside the scene JSON and the camera's
   `device` id (`system_profiler SPCameraDataType`).
3. `cd tools/zoom && npm i && npm run build && ./make-launcher.sh`.
4. Click On Air; approve the OBS camera extension when macOS asks
   (System Settings > General > Login Items & Extensions > OBS).

After changing `overlay.html`, run `node refresh-banner.mjs` (or in OBS: Banner >
Properties > "Refresh cache of current page"); OBS does not watch the file.
