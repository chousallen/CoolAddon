importScripts('settings.js');

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-invert') {
    const { invert } = await chrome.storage.sync.get({ invert: DEFAULTS.invert });
    await chrome.storage.sync.set({ invert: !invert });
  }
});
