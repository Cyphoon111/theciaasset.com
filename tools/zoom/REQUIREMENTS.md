# LIVE Cameraman Requirements

As of 2026-10-26. Owner: Jason Sullivan. The living copy is the Claude Doc "LIVE Cameraman Requirements"; this file is the repository copy, kept in step with it.

## The Law

There is never a skip, a jump, a tick or a stutter in the picture, and at every moment Jason looks like he is being filmed inside a multi-million-dollar studio by a professional film crew under a top-tier producer. Every rule in this document serves that law. Any change that makes the picture less smooth or less professional is rejected, whatever else it gains.

## Purpose and scope

The LIVE cameraman is a software camera operator that runs on Jason's MacBook Pro whenever OBS is on and delivers one finished picture to any video platform he joins, as the camera called OBS Virtual Camera. It governs framing, centring, focus reactions, the occasional zoom, the pull-out, and the on-air graphics. It never touches audio, and it stores or recognises no one's face: it tracks whichever face is largest and most central in the lens.

The operator is `cameraman.mjs` in this folder, started by the On Air app, working through OBS's own control channel (obs-websocket). Every rule below is one the operator must meet on its own, with nothing from Jason during a show.

## The non-negotiable rules

In priority order. When two rules conflict, the higher one wins and the operator finds another way to satisfy the lower one.

1. The picture is always smooth. No skip, jump, tick or stutter, in any shot or transition.
2. Jason's head is always dead centre of the screen, directly above the UNLEASHED logo in the banner. He is never featured left or right of it.
3. The top of his head is never cut off.
4. His neck and chin are never cut off and never hidden behind the banner.
5. When he sits still, the frame does not move. The only motion while he is still is the occasional slight zoom in or out.
6. When he moves, the operator refocuses on him the instant he moves, smoothly, like a focus pull on a film set.
7. From time to time the operator pulls out to a wide shot that includes his chest and his white pocket square, then returns.
8. The UNLEASHED neon sign on the wall behind him is in view at least 70% of the time he is on air.
9. The book cover, QR code and banner graphics run their choreography without ever covering his face.

## Framing specification

The lens is the MacBook's fixed 1080p camera. The operator cannot move it; it crops inside what the lens sees. The banner covers the bottom 150 of the 1080 rows, so 930 rows are visible.

| Requirement | Specification | How it is met |
| --- | --- | --- |
| Head centred | Face centre within 50 px of the 1920-wide picture's centre line when settled; returns there within 2 s of a move | The face tracker keeps a crop of about 1.1x (track_z .50), leaving about 90 px of pan either side of the lens axis |
| Head never cut | Top of hair at least 5% (54 px) below the top edge; 10 to 20% preferred | The head-room guard, checked every 1.5 s |
| Neck never cut | Chin plus neck at least 2% above the banner line (row 930); 12% preferred | The head-room guard lifts the picture or slides the face before it widens |
| Neon sign in view | In frame in every normal shot and in the pull-out | Normal shots sit at the lens's natural position (py = 150); the face is placed a little low in the crop (track_y -.10) |
| Pan room | The crop never widens past 90% of its base zoom | A hard floor in the guard: centring is never traded for head room |
| Vertical steadiness | Face wobble under 2 px standard deviation while still | Tracker PID: Kp .7, Ki .25, no derivative, 1.8 s low-pass |

His seat matters: the crop can pan about 90 px either side of the lens axis. Sitting squarely in front of the lens keeps every rule satisfied; sitting further off-axis than that is beyond what any crop can correct.

## Reaction to movement

The operator watches the camera ten times a second (96x54 thumbnail) and compares each frame with the one from a third of a second earlier. A real move scores above 16; the room's own flicker scores under 11, so the room never triggers it.

On a real move, within a tenth of a second:

1. The focus pull: the picture softens slightly (the Focus scale filter from 1152x648) and racks back to sharp over about half a second in six steps 70 ms apart, then the sharpening ramps up to a peak (.24) and settles (.12). Every sharpen change is a ramp of twelve steps; nothing snaps.
2. The tracker glides his head back to the centre line over one to two seconds.
3. The frame itself does not lean, zoom or jump during the pull. The focus rack is the whole effect.

A full pull happens at most every 6 s. Between pulls, each new move gets a lighter touch of focus with no re-blur. While he is still, none of this fires and the frame holds.

OBS renders at 60 fps and the operator drives every move at 60 updates a second.

## The shot schedule

A shot holds for 45 to 100 s, chosen at random, then the operator drifts to the next over 3 to 5 s. Never the same shot twice in a row.

| Shot | What it is | Share of changes |
| --- | --- | --- |
| Wide | The base framing, head and shoulders, neon sign in view | about a quarter |
| A touch in | 2 to 4% tighter than wide | about a quarter |
| In | 4 to 7% tighter than wide | about an eighth |
| The pull-out | The tracker opens to about 1.15x (track_z .64, upsize_b 2.5) pinned to the bottom of the lens, and the whole picture shrinks to 930 rows above the banner with dark side bars, so the lowest rows the lens sees (the pocket square) are on screen with his head still centred. Holds 20 to 30 s, then eases back | every other change, and the first change after start |

No shot ever lowers the picture; zooms keep the bottom row on the banner line. No shot ever has zero pan room. The pull-out shows the pocket square only when the lens sees it (lid angle, below).

## Graphics choreography

The banner is a 150 px frosted white strip across the bottom with a 4 px black line and a 4 px red rule along its top. Left: the red-dot mark, THE CIA ASSET, theciaasset.com. Centre: the Unleashed.news logo exactly as supplied, with unleashed.news in the logo's pink beneath it. Right: the QR on a solid white tile, which always scans. The 3D book cover floats above the left block with the website's tilt, float and light sweep.

Everything shimmers on one 12 s clock: a gloss and the red rule's highlight cross the banner left to right in the first 8 s, then the Unleashed logo and its URL glint together, left to right, in step.

Once every 60 s, at the end of the minute, the book glides right to just left of centre, grows 30%, hovers 7 s with theciaasset.com under it, and glides home; the QR lifts to the right of his face at double size with its label on the same clock and returns with the book. Both stop short of his head.

All of this is drawn by `overlay.html` in OBS, built by `build.mjs`, and runs at the browser's full frame rate.

## Self-checks the operator runs

- Head-room guard, every 1.5 s: `facepos` (macOS Vision, built from `facepos.swift`) finds the face in the program picture. If the top of the head is within 5% of the top edge, or the chin within 2% of the banner, the guard acts in order: (1) raise or lower the whole picture by up to the 150 px otherwise under the banner, (2) slide the face up or down inside the crop (track_y), (3) only if both edges are tight at once, widen the crop, never past 90% of base zoom. With room to spare everything drifts back so the neon sign shows. A frame with no face changes nothing.
- Motion sensing, ten times a second: the trigger for the focus pull.
- The operator re-applies the tracker's base settings on every start; the launcher checks OBS's frame rate on every start and sets 60 fps.

Measurement tools: `measure-jitter.mjs` (vertical wobble in px), `facepos` (face position in any frame), `obs-request.mjs` (any OBS command, including a live program screenshot). Framing judgements are made with these, never by eye alone.

## Physical setup Jason keeps

- Lid angle: tilted slightly down, as set on 26 October 2026, so the lens reaches his breast pocket. Tilted up, the lens ends at his lapels.
- Seat: squarely in front of the lens, within about a hand's width of its axis.
- Distance: roughly arm's length. Closer works, but the guard then spends its margins.
- Light: from the front, on the face.
- Camera: the built-in FaceTime HD camera at 1920x1080 (no HD 4:3 mode exists).
- OBS at 60 fps, virtual camera on, started by On Air, which also starts the operator. In the meeting app: OBS Virtual Camera, HD on, mirror off, the app's own background, blur and auto-framing off.

## Pre-show checklist

- [ ] Click On Air. OBS opens, the virtual camera starts, the operator starts.
- [ ] In OBS, the Controls panel reads Stop Virtual Camera.
- [ ] In the OBS preview: head centred over the Unleashed logo, hair with room, neck above the banner, neon sign in view.
- [ ] Lean left, then right, then sit back: the frame glides and re-centres with no jump.
- [ ] Sit still for 30 seconds: the frame does not move.
- [ ] Wait for the first pull-out, within the first two minutes: the pocket square is in view above the banner, head still centred.
- [ ] Banner shimmer, Unleashed glint and the book's trip all run.
- [ ] In the meeting app: OBS Virtual Camera selected, HD on, its own effects off.

## Change control

Everything lives in this folder and is backed up by the GitHub repository; the approved state carries a git tag. A change is made here, installed into `/Applications/On Air.app/Contents/Resources`, verified against the rules with the measurement tools, and committed with the request that caused it quoted in the message. Nothing is tuned by eye and nothing is left uncommitted. The Law is the test every change must pass.
