// Runs in every NTU COOL frame, including the video player iframe.

const STYLE_ID = 'ntu-cool-video-invert';
// invert turns white to black; the 180° hue turn brings colors back near their original tone.
const INVERT_CSS = 'video { filter: invert(1) hue-rotate(180deg) !important; }';

let settings = { ...DEFAULTS };

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

chrome.storage.sync.get(DEFAULTS).then((stored) => {
  settings = stored;
  applyInvert();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  for (const [key, { newValue }] of Object.entries(changes)) {
    settings[key] = newValue ?? DEFAULTS[key];
  }
  applyInvert();
});

// The popup asks every frame how many videos it has. Only frames that have
// videos answer, so the frame without videos cannot answer "0" first.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'count-videos') return;
  const count = document.querySelectorAll('video').length;
  if (count > 0) sendResponse({ count });
});
