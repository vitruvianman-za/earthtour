// Runs on Google Maps / Google Earth. Adds the Ctrl+K palette and, on Earth, the tour panel.
(() => {
  if (window.__earthJumpLoaded) return;
  window.__earthJumpLoaded = true;

  const onEarth = location.hostname === 'earth.google.com';

  function send(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => resolve(chrome.runtime.lastError ? null : res));
      } catch {
        resolve(null);
      }
    });
  }

  // ---------- palette ----------
  let paletteHost = null;
  let palette = null;

  function ensurePalette() {
    if (palette) return palette;
    paletteHost = document.createElement('earth-jump-palette');
    paletteHost.style.cssText = 'all:initial;';
    const shadow = paletteHost.attachShadow({ mode: 'closed' });
    (document.body || document.documentElement).appendChild(paletteHost);

    palette = window.EarthJumpPalette(shadow, {
      mode: 'overlay',
      onTargetChange: (t) => chrome.storage.local.set({ target: t })
    });
    chrome.storage.local.get('target').then(({ target }) => {
      if (target) palette.setTarget(target);
    });
    return palette;
  }

  // ---------- Earth: fly without reloading ----------
  // Earth's router watches the URL. Pushing a new @lat,lng camera path and firing
  // popstate makes it fly there smoothly. pushState also means Back flies you back.
  function earthFly(url) {
    if (!onEarth) return false;
    const u = new URL(url);
    if (u.origin !== location.origin || !u.pathname.startsWith('/web/@')) return false;
    history.pushState({}, '', u.pathname + u.search + u.hash);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    return true;
  }

  // ---------- Earth: tour panel ----------
  let tourHost = null;
  let tour = null;

  function closeTourUI() {
    if (tourHost) tourHost.remove();
    tourHost = null;
    tour = null;
  }

  async function showTour() {
    if (!onEarth) return false;
    const active = await send({ type: 'getTour' });
    if (!active || !active.ok || !active.data) return false;

    closeTourUI();
    tourHost = document.createElement('earth-jump-tour');
    tourHost.style.cssText = 'all:initial;';
    const shadow = tourHost.attachShadow({ mode: 'closed' });
    (document.body || document.documentElement).appendChild(tourHost);

    const { tour: data, index } = active.data;
    tour = window.EarthJumpTour(shadow, {
      tour: data,
      index,
      fly: earthFly,
      onIndex: (i) => send({ type: 'tourIndex', index: i }),
      onClose: () => {
        send({ type: 'endTour' });
        closeTourUI();
      }
    });
    return true;
  }

  if (onEarth) {
    // Earth takes a few seconds to boot; wait for its app before flying anywhere.
    const boot = () => setTimeout(showTour, 2500);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }

  // ---------- keyboard ----------
  // Maps and Earth both listen for keys (Earth flies the camera with them). This
  // script runs at document_start, so a capture listener on window sees keys first.
  function isEditable(e) {
    const t = e.composedPath()[0];
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''));
  }

  function onKey(e) {
    const key = (e.key || '').toLowerCase();
    const isToggle =
      e.type === 'keydown' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === 'k';

    if (isToggle) {
      e.preventDefault();
      e.stopImmediatePropagation();
      ensurePalette().toggle();
      return;
    }

    const path = e.composedPath();

    if (palette && palette.isOpen) {
      if (path.includes(paletteHost)) {
        palette.handleKey(e);
        e.stopImmediatePropagation();
      } else if (e.type === 'keydown' && key === 'escape') {
        e.stopImmediatePropagation();
        palette.close();
      }
      return;
    }

    if (tour) {
      // Keys on the panel's own buttons stay with the panel (Enter/Space activate them).
      if (path.includes(tourHost)) {
        tour.handleKey(e);
        e.stopImmediatePropagation();
        return;
      }
      // Arrow keys step through the tour, unless you're typing in Earth's search box.
      if (!isEditable(e) && tour.handleKey(e)) e.stopImmediatePropagation();
    }
  }

  for (const type of ['keydown', 'keypress', 'keyup']) {
    window.addEventListener(type, onKey, true);
  }

  // ---------- messages from the background ----------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'toggle') ensurePalette().toggle();
    if (msg.type === 'earthFly') {
      try {
        sendResponse({ ok: earthFly(msg.url) });
      } catch {
        sendResponse({ ok: false });
      }
    }
    if (msg.type === 'tourShow') {
      if (!onEarth) {
        sendResponse({ ok: false });
        return;
      }
      sendResponse({ ok: true });
      showTour();
    }
  });
})();
