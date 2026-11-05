importScripts('settings.js');

chrome.commands.onCommand.addListener(async (command) => {
  const current = await chrome.storage.local.get(DEFAULTS);
  switch (command) {
    case 'toggle-invert':
      await chrome.storage.local.set({ invert: !current.invert });
      break;
    case 'volume-up':
      await chrome.storage.local.set({ volume: clampVolume(current.volume + VOLUME_KEY_STEP) });
      break;
    case 'volume-down':
      await chrome.storage.local.set({ volume: clampVolume(current.volume - VOLUME_KEY_STEP) });
      break;
  }
});
