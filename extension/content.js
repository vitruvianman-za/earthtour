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

  // ---------- Earth: tour layer ----------
  // The background writes the live tour to storage as it streams in; this page
  // listens for changes to it, so stops appear here as soon as they're written.
  let tourHost = null;
  let tour = null;
  let myTabId = null;

  function closeTourUI() {
    if (tourHost) tourHost.remove();
    tourHost = null;
    tour = null;
  }

  function ensureTourUI() {
    if (tour) return tour;
    tourHost = document.createElement('earth-tour-layer');
    tourHost.style.cssText = 'all:initial;';
    const shadow = tourHost.attachShadow({ mode: 'closed' });
    (document.body || document.documentElement).appendChild(tourHost);
    tour = window.EarthTourUI(shadow, {
      fly: earthFly,
      onIndex: (i) => send({ type: 'tourIndex', index: i }),
      onRetry: () => send({ type: 'retryTour' }),
      onClose: () => {
        send({ type: 'endTour' });
        closeTourUI();
      }
    });
    return tour;
  }

  function applyTour(active) {
    if (!active || active.tabId !== myTabId) {
      if (tour) closeTourUI();
      return;
    }
    ensureTourUI().update(active);
  }

  async function initTour() {
    const who = await send({ type: 'whoami' });
    myTabId = who && who.ok ? who.data : null;
    if (myTabId == null) return;
    const got = await send({ type: 'getTour' });
    if (got && got.ok && got.data) applyTour(got.data);
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.activeTour) return;
      applyTour(changes.activeTour.newValue || null);
    });
  }

  if (onEarth) {
    // Earth takes a few seconds to boot; wait for its app before flying anywhere.
    const boot = () => setTimeout(initTour, 2500);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();

    // Dragging or zooming the map moves the stop off-centre, so hide its marker.
    // Only react to the map surface itself: opening Earth's menus or panels is not a
    // camera move, and hiding the label for every click made them feel broken.
    const isMapSurface = (path) =>
      path.some((n) => n && (n.nodeName === 'CANVAS' || n.id === 'map'));
    const moved = (e) => {
      if (!tour) return;
      const path = e.composedPath();
      if (path.includes(tourHost) || (paletteHost && path.includes(paletteHost))) return;
      if (!isMapSurface(path)) return;
      tour.mapMoved();
    };
    window.addEventListener('pointerdown', moved, true);
    window.addEventListener('wheel', moved, { capture: true, passive: true });
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
  });
})();
