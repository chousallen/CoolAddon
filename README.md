# NTU COOL Video

A Brave / Chrome add-on for lecture videos on NTU COOL (https://cool.ntu.edu.tw).

- **Volume up to 1000 %** — a limiter keeps loud parts from crackling.
- **Remove background noise** — RNNoise (a small neural network for speech) quiets fan and room noise.
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

## Rebuilding vendor/rnnoise.js

`vendor/rnnoise.js` is generated and committed, so the add-on loads without a
build step. To regenerate it (for example after updating the package):

```sh
npm install
npm run vendor
```

It is RNNoise converted from WebAssembly to plain JavaScript with binaryen's
`wasm2js`, because the NTU COOL player page does not allow WebAssembly.

## Licenses

RNNoise: BSD-3-Clause (Xiph.Org). WebAssembly build: `@shiguredo/rnnoise-wasm`,
Apache-2.0. Packaged by `@sapphi-red/web-noise-suppressor`, MIT
(`vendor/LICENSE-web-noise-suppressor`). The buffering in `denoise-worklet.js`
is ported from that package.
