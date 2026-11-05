// Runs in every NTU COOL frame, including the cool-video.dlc.ntu.edu.tw player iframe.

const STYLE_ID = 'ntu-cool-video-invert';
// invert turns white to black; the 180° hue turn brings colors back near their original tone.
const INVERT_CSS = 'video { filter: invert(1) hue-rotate(180deg) !important; }';

let settings = { ...DEFAULTS };

// ---------- Invert ----------

function applyInvert() {
  let style = document.getElementById(STYLE_ID);
  if (settings.invert) {
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = INVERT_CSS;
      (document.head || document.documentElement).appendChild(style);
    }
  } else if (style) {
    style.remove();
  }
}

// ---------- Sound chain: video -> volume -> limiter -> makeup trim -> speakers ----------
//
// The player's media is a blob: (MediaSource) URL on the player's own origin, so
// createMediaElementSource gets real samples, not CORS silence (checked 2026-11-05).
// A video is only routed through the chain once the volume is first raised above
// 100 %, so the add-on does not touch the sound until it is needed. Routing a
// video cannot be undone; afterwards 100 % simply means gain 1.

const LOG = '[NTU COOL Video]';

// Limiter settings. Measured offline (2026-11-05): with these, a full-scale input
// boosted x10 peaks at 0.88, and quiet input passes at exactly the set volume.
const LIMIT_THRESHOLD_DB = -3;
const LIMIT_RATIO = 20;
// The Web Audio spec makes DynamicsCompressorNode add "makeup gain" of
// (1 / full_range_gain)^0.6, i.e. -0.6 * threshold * (1 - 1/ratio) dB with knee 0
// (+1.71 dB here). The trim stage removes it, so 100 % is the original loudness.
const MAKEUP_TRIM = 10 ** ((0.6 * LIMIT_THRESHOLD_DB * (1 - 1 / LIMIT_RATIO)) / 20);

let ctx = null;
let waitingLogged = false;
const chains = new WeakMap(); // video -> { gain }

function needsChain() {
  return settings.volume > 100;
}

function getContext() {
  if (!ctx) {
    // 48 kHz: the rate RNNoise (noise removal) needs.
    ctx = new AudioContext({ sampleRate: 48000 });
    ctx.addEventListener('statechange', applyAudio);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function buildChain(video) {
  const source = ctx.createMediaElementSource(video);
  const gain = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = LIMIT_THRESHOLD_DB;
  limiter.knee.value = 0;
  limiter.ratio.value = LIMIT_RATIO;
  limiter.attack.value = 0.003; // s
  limiter.release.value = 0.1; // s
  const trim = ctx.createGain();
  trim.gain.value = MAKEUP_TRIM;
  source.connect(gain).connect(limiter).connect(trim).connect(ctx.destination);
  const chain = { gain };
  chains.set(video, chain);
  console.info(`${LOG} sound processing on for a video (${ctx.sampleRate} Hz)`);
  return chain;
}

function applyAudio() {
  for (const video of document.querySelectorAll('video')) {
    let chain = chains.get(video);
    if (!chain) {
      if (!needsChain()) continue;
      // Never route a video into a context that is not running: it would go silent.
      // The browser only lets the context run after the user has clicked or pressed
      // a key in this frame; the listeners below retry then.
      if (getContext().state !== 'running') {
        if (!waitingLogged) console.info(`${LOG} volume boost waits for a click or key press in the player`);
        waitingLogged = true;
        continue;
      }
      chain = buildChain(video);
    }
    chain.gain.gain.setTargetAtTime(settings.volume / 100, ctx.currentTime, 0.02);
  }
}

// Retry once the user interacts with the frame, and pick up videos that start later.
for (const type of ['pointerdown', 'keydown']) {
  document.addEventListener(type, () => { if (needsChain()) applyAudio(); }, true);
}
document.addEventListener('play', (e) => {
  if (e.target instanceof HTMLVideoElement) applyAudio();
}, true);

// ---------- Settings ----------

function applyAll() {
  applyInvert();
  applyAudio();
}

chrome.storage.local.get(DEFAULTS).then((stored) => {
  settings = stored;
  applyAll();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  for (const [key, { newValue }] of Object.entries(changes)) {
    settings[key] = newValue ?? DEFAULTS[key];
  }
  applyAll();
});

// The popup asks every frame how many videos it has. Only frames that have
// videos answer, so a frame without videos cannot answer "0" first.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'count-videos') return;
  const count = document.querySelectorAll('video').length;
  if (count > 0) sendResponse({ count });
});
