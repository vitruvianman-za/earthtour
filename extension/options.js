const $ = (id) => document.getElementById(id);

function flash(text) {
  $('flash').textContent = text;
  setTimeout(() => ($('flash').textContent = ''), 1800);
}

async function refresh() {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  $('keyState').textContent = apiKey ? `Key saved (ends in ${apiKey.slice(-4)}).` : 'No key saved yet.';
}

$('keyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = $('key').value.trim();
  if (!key) return;
  await chrome.storage.local.set({ apiKey: key });
  // A new key may give different answers; drop old phrase results.
  await chrome.storage.local.remove('phraseCache');
  $('key').value = '';
  refresh();
});

$('clearCache').addEventListener('click', async () => {
  await chrome.storage.local.remove(['phraseCache', 'geoCache', 'tourCache']);
  flash('Cache cleared');
});

$('shortcuts').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

refresh();
