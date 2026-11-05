// Default settings, shared by the content script, the popup and the background script.
// Settings are stored as separate keys in chrome.storage.local. (Not storage.sync:
// sync allows only ~120 writes per minute, which dragging the volume slider exceeds.)
const DEFAULTS = Object.freeze({
  invert: false,
  volume: 100, // percent
  denoise: false,
});

const VOLUME_MIN = 100;
const VOLUME_MAX = 1000;
const VOLUME_KEY_STEP = 50;

function clampVolume(percent) {
  return Math.min(VOLUME_MAX, Math.max(VOLUME_MIN, Math.round(percent)));
}
