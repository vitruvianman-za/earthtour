(async () => {
  const { target } = await chrome.storage.local.get('target');
  window.EarthJumpPalette(document.getElementById('app'), {
    mode: 'popup',
    initialTarget: target || 'auto',
    onTargetChange: (t) => chrome.storage.local.set({ target: t })
  });

  document.getElementById('settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
})();
