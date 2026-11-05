// When popup.html is opened outside the add-on (for testing), the chrome.* APIs
// do not exist. Then settings live in memory and one video is pretended found.
const inExtension = typeof chrome !== 'undefined' && !!chrome.storage;

const memory = { ...DEFAULTS };
const store = inExtension
  ? {
      get: () => chrome.storage.local.get(DEFAULTS),
      set: (values) => chrome.storage.local.set(values),
    }
  : {
      get: async () => ({ ...memory }),
      set: async (values) => Object.assign(memory, values),
    };

const statusEl = document.getElementById('status');
const activeEl = document.getElementById('active');
const controlsEl = document.getElementById('controls');
const volumeEl = document.getElementById('volume');
const volumeValueEl = document.getElementById('volume-value');
const invertEl = document.getElementById('invert');
const resetEl = document.getElementById('reset');

function show(settings) {
  volumeEl.value = settings.volume;
  volumeValueEl.textContent = `${settings.volume} %`;
  invertEl.checked = settings.invert;

  const on = [];
  if (settings.volume !== DEFAULTS.volume) on.push(`Volume ${settings.volume} %`);
  if (settings.invert) on.push('Invert video colors');
  activeEl.textContent = `On now: ${on.length ? on.join(', ') : 'nothing'}`;
}

async function save(values) {
  await store.set(values);
  show(await store.get());
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

// Show the keys actually set at brave://extensions/shortcuts.
async function showKeys() {
  if (!inExtension) return;
  for (const command of await chrome.commands.getAll()) {
    const el = document.getElementById(`key-${command.name}`);
    if (el) el.textContent = command.shortcut || 'no key set';
  }
}

volumeEl.addEventListener('input', () => save({ volume: clampVolume(Number(volumeEl.value)) }));
invertEl.addEventListener('change', () => save({ invert: invertEl.checked }));
resetEl.addEventListener('click', () => save({ ...DEFAULTS }));

// Keep the popup in step with keyboard shortcuts pressed while it is open.
if (inExtension) {
  chrome.storage.onChanged.addListener(async (_changes, area) => {
    if (area === 'local') show(await store.get());
  });
}

store.get().then(show);
showStatus();
showKeys();
