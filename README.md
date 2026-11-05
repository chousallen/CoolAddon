# NTU COOL Video

A Brave / Chrome add-on for lecture videos on NTU COOL (https://cool.ntu.edu.tw).

- **Volume up to 1000 %** — a limiter keeps loud parts from crackling.
- **Remove background noise** — GTCRN (a small neural network for speech) quiets fan and room noise,
  also while someone talks. It delays the sound by about 80 ms (35 ms in GTCRN, the rest from larger
  audio batches that keep slower laptops from stuttering) and removes sound above 8 kHz.
- **Invert video colors** — white slides become dark. Only the video picture changes.

## Install

1. Open `brave://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this folder.
4. After changing any file, click the reload arrow on the add-on's card, then reload the NTU COOL tab.

## Use

Click the add-on icon in the toolbar, or use the keys:

| Key | Action |
|-----|--------|
| Alt+Shift+Up / Alt+Shift+Down | Volume up / down 50 % |
| Alt+Shift+N | Remove background noise on/off |
| Alt+Shift+I | Invert video colors on/off |

Change the keys at `brave://extensions/shortcuts`.

Settings are remembered and apply to every NTU COOL tab at once.

Volume above 100 % and noise removal start after you click or press a key once
inside the video player. The browser does not let sound processing start before that.

## Rebuilding vendor/gtcrn.js

`vendor/gtcrn.js` is generated and committed, so the add-on loads without a
build step. It is GTCRN compiled to WebAssembly without SIMD and converted to
plain JavaScript with binaryen's `wasm2js`, because the NTU COOL player page
does not allow WebAssembly.

Tools, with the versions the committed file was built with:

| Tool | Version | Install |
|------|---------|---------|
| Emscripten (emcc) | 6.0.13 | see below |
| protobuf (protoc + C++ library) | 7.36.2 (protoc 36.2) | `conda env create -f environment.yml` |
| uv | 0.9.8 | https://docs.astral.sh/uv/ |
| cmake | 3.28.3 | Ubuntu 24.04 package |
| C compiler | gcc 13.3.0 | Ubuntu 24.04 package |

Install Emscripten once (about 1 GB, in your home folder):

```sh
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
~/emsdk/emsdk install 6.0.13
~/emsdk/emsdk activate 6.0.13
```

Then regenerate:

```sh
source ~/emsdk/emsdk_env.sh
export PROTOBUF_PREFIX=$(conda info --base)/envs/gtcrn-build
PATH=$PROTOBUF_PREFIX/bin:$PATH ./build-gtcrn.sh
```

The script fetches the pinned `sapphi-red/gtcrn-wasm` source into `build-cache/`.
Its Python packages are pinned by that source's `uv.lock`.

## Licenses

GTCRN model: MIT (Rong Xiaobin, `vendor/LICENSE-gtcrn`). WebAssembly port and
streaming front end: `sapphi-red/gtcrn-wasm`, MIT (`vendor/LICENSE-gtcrn-wasm`).
FFT: pffft, BSD-style (`vendor/LICENSE-pffft`). Converted to C with onnx2c and
compiled with Emscripten.
