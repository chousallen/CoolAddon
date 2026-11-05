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
- Hence noise removal runs as plain JS. `./build-gtcrn.sh` (with emsdk active)
  regenerates `vendor/gtcrn.js`: GTCRN compiled to WebAssembly without SIMD,
  then binaryen `wasm2js`. wasm2js cannot convert SIMD; binaryen has no
  SIMD-to-scalar pass, so SIMD must be off at compile time.

## GTCRN build (vendor/gtcrn.js)
- Source: `sapphi-red/gtcrn-wasm` at the commit pinned in `build-gtcrn.sh`, built
  with emcc 6.0.13. Its upstream steps (`rewrite_gru.py`, onnx2c, native check)
  are reused; only the emcc and wasm2js steps differ.
- Speed depends on function size: V8 does not optimize huge functions, and the
  unoptimized code boxes every float (GC took 44 % of the time). wasm2js -O2/-O3
  (and C-level inlining) merge all ~800 network nodes into one 1.2 MB function:
  12 ms per 16 ms frame. `-fno-inline` + emcc link `-O1` + `wasm2js -O1`:
  1.2 ms per frame (Node 26, 2026-11-05). Check the largest function in the
  output after any build change.
- Warm-up (stutter at start, garbage collection) comes from V8 tiering: each
  of the ~800 node functions runs about once per frame, and V8 needs
  ~3000 calls (`--invocation-count-for-turbofan`) before TurboFan. Until then
  code runs in Maglev, which boxes floats: ~3600 GCs in the first 500 frames,
  ~0.2 per frame later. Loop unrolling (-O3) makes long straight-line node
  functions that tier up slower; `-O2 -fno-unroll-loops` gives identical output
  with 2.3x less warm-up compute and 5x fewer GCs. wasm2js inlining (-O2/-O3,
  even with `-imcbs`) still builds 600+ KB functions: 5x slower.
- Benchmark: `node tools/bench-gtcrn.mjs [file]` (cold-start bands, warm
  percentiles, GC count). Lenovo power-saver numbers are ~2x asus.
- emcc 6 emits bulk-memory and nontrapping-fptoint ops by default; wasm2js
  needs `--enable-bulk-memory --enable-bulk-memory-opt
  --enable-nontrapping-float-to-int` (it handles them itself).
- emsdk's `wasm2js` is in `~/emsdk/upstream/bin`, which `emsdk_env.sh` does not
  put on PATH; the script finds it next to emcc.
- onnx2c needs the protobuf C++ library: `environment.yml` (conda package
  `libprotobuf`, which also ships `protoc`). On this laptop the env is
  `~/miniconda3/envs/gtcrn-build` (`PROTOBUF_PREFIX`). Conda's default
  package folder is on an external SSD; when it is not mounted, set
  `CONDA_PKGS_DIRS=$HOME/.conda/pkgs`.
- Output matches the WebAssembly build exactly. 48 kHz mode: 768-sample frames,
  18.5 ms internal delay (cross-correlation), output band-limited to 8 kHz.

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

## Noise removal during speech
- RNNoise (used up to version 0.3.0) cleared pauses but left noise in voice bands
  while someone talked; it only scales ~20 frequency bands. Replaced by GTCRN
  (DNSMOS BAK 3.90 vs RNNoise 3.45 in its paper).
