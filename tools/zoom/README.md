# On-air banner for Zoom shows

A news-style lower third over Jason's live camera: logo bar + theciaasset.com
bottom-left, the site's 3D book (tilted, floating, with its light sweep) standing
above it, and a QR to theciaasset.com bottom-right. It reaches Zoom (or Teams,
Riverside, StreamYard, Meet) through OBS Studio's virtual camera. Set up 2026-10-25.

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
- `on-air.mjs` — the launcher: enables OBS's websocket (port 4455, password
  kept in OBS's own config), opens OBS, waits for it, sends StartVirtualCam.
- `make-launcher.sh` — rebuilds `/Applications/On Air.app` around `on-air.mjs`.
- `obs/` — backup of the OBS scene collection and profile.

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

After changing `overlay.html`, OBS needs a restart or Banner > Properties >
"Refresh cache of current page"; it does not watch the file.
