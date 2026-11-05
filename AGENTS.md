# NTU COOL Video add-on — facts for future work

## Where the video lives
- Lecture videos are LTI module items. The player runs in an iframe from
  `https://cool-video.dlc.ntu.edu.tw/courses/<course>/videos/<id>`.
- Media is DASH (`manifest.mpd`, `video-N-N.m4s`, `audio-N-N.m4s`) from
  `files-1.dlc.ntu.edu.tw`, played through MediaSource, so `video.currentSrc` is a
  `blob:` URL on the player's origin. `createMediaElementSource` therefore gets real
  samples (no CORS silence). Verified 2026-11-05.
- The player CSP also allows `drm.files-3.dlc.ntu.edu.tw`: DRM-encrypted videos
  would give silence through Web Audio. Not seen yet.

## Player page CSP (the main constraint)
- `script-src 'self' https://www.youtube.com`, no `'wasm-unsafe-eval'`.
- WebAssembly compile is refused everywhere in that page: main world, the content
  script's isolated world, and AudioWorklets created from either.
- `audioWorklet.addModule(chrome.runtime.getURL(...))` from the content script and
  its static imports DO load (files listed in `web_accessible_resources`).
- Hence RNNoise runs as plain JS: `npm install && npm run vendor` regenerates
  `vendor/rnnoise.js` via binaryen `wasm2js` (non-SIMD build; wasm2js cannot do SIMD).
- Speed in Chrome after warm-up: 0.46 ms per 10 ms frame per channel. The first
  few frames are ~10x slower (JIT warm-up); time with ≥100 warm-up frames.
- The package's own `rnnoise.wasm` measured ~600 ms per frame in both Node 26 and
  Chrome 155. Unexplained; unused, so not investigated.

## Web Audio details
- AudioContext only runs after a click or key press in that frame. Never connect a
  video to a suspended context: the video goes silent.
- DynamicsCompressorNode adds makeup gain of `-0.6 * threshold * (1 - 1/ratio)` dB
  (knee 0); `content.js` trims it out. Verified against an OfflineAudioContext.
- `chrome.storage.sync` allows ~120 writes/min; the volume slider exceeds it, so
  settings use `chrome.storage.local`.
- Extension `commands`: at most 4 `suggested_key`s (all 4 used).

## Testing with the Claude-in-Chrome tool
- It drives Google Chrome, not Brave; load the unpacked add-on in Chrome too.
- Its key presses go to the page, so they do not trigger extension shortcuts.
- It cannot run code inside the cross-origin player iframe. Open the player as a
  top-level page instead (from a logged-in cool.ntu.edu.tw tab):
  `fetch('/api/v1/courses/<c>/external_tools/sessionless_launch?launch_type=module_item&module_item_id=<item>')`
  then navigate to the returned `url`.
- Content-script console messages and storage are not visible from the page's
  main world; test the worklet by loading
  `chrome-extension://<id>/denoise-worklet.js` into an OfflineAudioContext there.

## Noise removal during speech (open)
- RNNoise clears pauses well but leaves noise in voice bands while someone talks
  (it only scales ~20 frequency bands). User-reported 2026-11-05.
- Candidate: GTCRN (MIT; https://github.com/sapphi-red/gtcrn-wasm). Published
  background-noise score DNSMOS BAK 3.90 vs RNNoise 3.45; similar CPU cost. Its
  48 kHz mode resamples to 16 kHz, so output stops at 8 kHz.
- The shipped `gtcrn.wasm` uses SIMD, which wasm2js cannot convert, and binaryen
  132 has no SIMD-to-scalar pass (only `--llvm-memory-copy-fill-lowering` and
  `--llvm-nontrapping-fptoint-lowering` for its other two features). Route: rebuild
  gtcrn-wasm from source without `-msimd128` (needs emsdk, cmake, protoc, uv, pnpm,
  onnx2c; see its internal-docs/building.md), then wasm2js. Untested.
