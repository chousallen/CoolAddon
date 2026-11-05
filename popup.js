// When popup.html is opened as a local file (for testing), the chrome.* APIs
// do not exist. Then settings live in memory and one video is pretended found.
const inExtension = typeof chrome !== 'undefined' && !!chrome.storage;

const memory = { ...DEFAULTS };
const store = inExtension
  ? {
      get: () => chrome.storage.sync.get(DEFAULTS),
      set: (values) => chrome.storage.sync.set(values),
    }
  : {
      get: async () => ({ ...memory }),
      set: async (values) => Object.assign(memory, values),
    };

const statusEl = document.getElementById('status');
const controlsEl = document.getElementById('controls');
const activeEl = document.getElementById('active');
const invertEl = document.getElementById('invert');
const resetEl = document.getElementById('reset');

function show(settings) {
  invertEl.checked = settings.invert;
  const on = [];
  if (settings.invert) on.push('Invert video colors');
  activeEl.textContent = `On now: ${on.length ? on.join(', ') : 'nothing'}`;
}

async function countVideos() {
  if (!inExtension) return 1;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    // Only frames that have videos answer; no answer means no video.
    const reply = await chrome.tabs.sendMessage(tab.id, { type: 'count-videos' });
    return reply?.count ?? 0;
  } catch {
    return 0;
  }
}

async function showStatus() {
  const count = await countVideos();
  if (count > 0) {
    statusEl.textContent = 'Video found on this page';
    statusEl.className = 'status found';
    controlsEl.disabled = false;
  } else {
    statusEl.textContent = 'No video on this page. Open a lecture video first.';
    statusEl.className = 'status missing';
    controlsEl.disabled = true;
  }
}

async function showKeys() {
  if (!inExtension) return;
  const commands = await chrome.commands.getAll();
  const invert = commands.find((c) => c.name === 'toggle-invert');
  document.getElementById('key-invert').textContent = invert?.shortcut || 'no key set';
}

invertEl.addEventListener('change', async () => {
  await store.set({ invert: invertEl.checked });
  show(await store.get());
});

resetEl.addEventListener('click', async () => {
  await store.set({ ...DEFAULTS });
  show(DEFAULTS);
});

// Keep the popup in step with keyboard shortcuts pressed while it is open.
if (inExtension) {
  chrome.storage.onChanged.addListener(async (_changes, area) => {
    if (area === 'sync') show(await store.get());
  });
}

store.get().then(show);
showStatus();
showKeys();
