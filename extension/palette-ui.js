/* Earth Jump palette: one UI shared by the in-page overlay (Ctrl+K on Maps/Earth)
   and the toolbar popup. Exposes window.EarthJumpPalette(mount, options). */
(function () {
  if (window.EarthJumpPalette) return;

  const CSS = `
.ej-root{all:initial;font:14px/1.4 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#E8EDF5;-webkit-font-smoothing:antialiased}
.ej-root *,.ej-root *::before,.ej-root *::after{box-sizing:border-box}
.ej-overlay{position:fixed;inset:0;z-index:2147483647;display:none}
.ej-overlay.ej-open{display:block}
.ej-popup{display:block}
.ej-backdrop{position:absolute;inset:0;background:rgba(10,12,16,.28)}
.ej-panel{background:rgba(14,16,20,.88);border:0;border-top:1px solid rgba(255,255,255,.14);border-radius:0;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.45),0 2px 8px rgba(0,0,0,.3);-webkit-backdrop-filter:blur(18px) saturate(140%);backdrop-filter:blur(18px) saturate(140%)}
.ej-overlay .ej-panel{position:absolute;left:50%;top:14vh;width:min(580px,calc(100vw - 32px));transform:translateX(-50%);animation:ej-in .16s ease-out}
@keyframes ej-in{from{opacity:0;transform:translate(-50%,-6px) scale(.98)}to{opacity:1;transform:translate(-50%,0) scale(1)}}
.ej-popup .ej-panel{width:400px;border:0;border-radius:0;box-shadow:none;background:#15171C}
.ej-bar{display:flex;align-items:center;gap:10px;padding:14px 14px 14px 16px}
.ej-icon{width:18px;height:18px;flex:none;color:#9AAAC4}
.ej-input{all:unset;flex:1;min-width:0;font:inherit;font-size:16px;color:#E8EDF5;caret-color:#FFC94A}
.ej-input::placeholder{color:#7F8EA8}
.ej-target{all:unset;cursor:pointer;flex:none;font-size:12px;font-weight:600;letter-spacing:.02em;padding:4px 10px;border-radius:0;background:rgba(232,237,245,.08);color:#C9D3E3;transition:background .15s,color .15s}
.ej-target[data-t=maps]{background:rgba(125,206,160,.14);color:#7DCEA0}
.ej-target[data-t=earth]{background:rgba(255,201,74,.16);color:#FFC94A}
.ej-target:hover{filter:brightness(1.2)}
.ej-mode{display:none;flex:none;font-size:12px;font-weight:600;padding:3px 10px;border-radius:0;border:1px solid rgba(255,201,74,.6);color:#FFC94A}
.ej-tour .ej-mode{display:inline-block}
.ej-tour .ej-target{display:none}
.ej-input:focus-visible,.ej-target:focus-visible,.ej-link:focus-visible{outline:none}
.ej-target:focus-visible,.ej-link:focus-visible{box-shadow:0 0 0 2px #FFC94A}
.ej-status{display:block;padding:0 16px 10px;font-size:12.5px;color:#9AAAC4}
.ej-status:empty{display:none}
.ej-status.ej-busy::before{content:"";display:inline-block;width:7px;height:7px;margin-right:8px;border-radius:50%;background:#FFC94A;vertical-align:1px;animation:ej-pulse 1s ease-in-out infinite}
@keyframes ej-pulse{50%{opacity:.25}}
.ej-status.ej-err{color:#EE8F86}
.ej-link{all:unset;cursor:pointer;color:#FFC94A;margin-left:6px;text-decoration:underline}
.ej-list{display:block;list-style:none;margin:0;padding:0 6px 6px;max-height:340px;overflow:auto;transition:opacity .15s}
.ej-list:empty{display:none}
.ej-list.ej-stale{opacity:.4}
.ej-item{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:0;cursor:pointer}
.ej-item.ej-sel{background:rgba(255,201,74,.14)}
.ej-item.ej-tourrow{flex-direction:row;align-items:center;gap:12px}
.ej-tourrow .ej-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.ej-tourrow .ej-chip{flex:none;font-size:11px;font-weight:600;padding:2px 7px;border:1px solid rgba(255,201,74,.6);color:#FFC94A}
.ej-name{font-weight:500;color:#E8EDF5}
.ej-note{font-size:12.5px;color:#9AAAC4}
.ej-skel{display:block;height:48px;margin:4px 0;border-radius:0;background:linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.09) 50%,rgba(255,255,255,.04) 100%);background-size:200% 100%;animation:ej-shimmer 1.2s linear infinite}
@keyframes ej-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
.ej-hint{display:flex;flex-wrap:wrap;gap:14px;padding:9px 16px;border-top:1px solid rgba(255,255,255,.06);font-size:11.5px;color:#7F8EA8}
.ej-hint kbd{font:inherit;font-size:11px;padding:1px 5px;margin-right:5px;border-radius:4px;background:rgba(232,237,245,.08);color:#C9D3E3}
`;

  const SEARCH_SVG =
    '<svg class="ej-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';

  const TARGETS = ['auto', 'maps', 'earth'];
  const LABEL = { auto: 'Auto', maps: 'Maps', earth: 'Earth' };

  function send(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: 'Extension was updated. Reload this page.' });
          } else {
            resolve(res || { ok: false, error: 'No response from the extension.' });
          }
        });
      } catch {
        resolve({ ok: false, error: 'Extension was updated. Reload this page.' });
      }
    });
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  window.EarthJumpPalette = function (mount, opts = {}) {
    const mode = opts.mode || 'overlay';
    const onTargetChange = opts.onTargetChange || (() => {});

    const style = el('style');
    style.textContent = CSS;
    mount.appendChild(style);

    const root = el('div', `ej-root ej-${mode}`);
    const panel = el('div', 'ej-panel');

    const bar = el('div', 'ej-bar');
    bar.innerHTML = SEARCH_SVG;
    const input = el('input', 'ej-input');
    input.type = 'text';
    input.placeholder = 'Go anywhere, or "follow Shaka\'s campaigns"';
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Place, question or journey');
    const modeChip = el('span', 'ej-mode', 'Tour');
    modeChip.title = 'This will plan a historical tour in Google Earth';
    const targetBtn = el('button', 'ej-target');
    targetBtn.type = 'button';
    targetBtn.title = 'Where to open it (Tab to switch)';
    bar.append(input, modeChip, targetBtn);

    const status = el('div', 'ej-status');
    const list = el('ul', 'ej-list');

    const hint = el('div', 'ej-hint');
    [['\u21b5', 'go'], ['\u2191\u2193', 'choose'], ['Tab', 'Maps / Earth'], ['Esc', 'close']].forEach(([k, t]) => {
      const s = el('span');
      s.append(el('kbd', null, k), document.createTextNode(t));
      hint.append(s);
    });

    panel.append(bar, status, list, hint);

    if (mode === 'overlay') {
      const backdrop = el('div', 'ej-backdrop');
      backdrop.addEventListener('mousedown', (e) => {
        e.preventDefault();
        close();
      });
      root.append(backdrop);
    }
    root.append(panel);
    mount.appendChild(root);

    // ---------- state ----------
    let target = TARGETS.includes(opts.initialTarget) ? opts.initialTarget : 'auto';
    let candidates = [];
    let selected = 0;
    let resolvedFor = null; // the phrase the current list belongs to
    let isOpen = mode === 'popup';
    let reqId = 0;
    let preloaded = null;   // researched tours shipped with the extension
    let showingTours = false;

    // ---------- rendering ----------
    function renderTarget() {
      targetBtn.textContent = LABEL[target];
      targetBtn.dataset.t = target;
    }

    function setTarget(t, silent) {
      if (!TARGETS.includes(t)) return;
      target = t;
      renderTarget();
      if (!silent) onTargetChange(t);
    }

    function cycleTarget() {
      setTarget(TARGETS[(TARGETS.indexOf(target) + 1) % TARGETS.length]);
    }

    function setStatus(text, kind) {
      status.textContent = text || '';
      status.className = 'ej-status' + (kind ? ' ej-' + kind : '');
    }

    function showError(res) {
      list.textContent = '';
      setStatus(res.error || 'Something went wrong.', 'err');
      if (res.code === 'NO_KEY') {
        const b = el('button', 'ej-link', 'Open settings');
        b.type = 'button';
        b.addEventListener('click', () => send({ type: 'openOptions' }));
        status.append(b);
      }
    }

    function showSkeleton() {
      list.textContent = '';
      list.classList.remove('ej-stale');
      for (let i = 0; i < 3; i++) list.append(el('li', 'ej-skel'));
    }

    function highlight() {
      [...list.children].forEach((li, i) => li.classList.toggle('ej-sel', i === selected));
      if (selected < 0) return;
      const cur = list.children[selected];
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    }

    function renderList() {
      list.textContent = '';
      list.classList.remove('ej-stale');
      candidates.forEach((c, i) => {
        const li = el('li', 'ej-item');
        if (c.tourId) {
          li.classList.add('ej-tourrow');
          const txt = el('div', 'ej-txt');
          txt.append(el('div', 'ej-name', c.name));
          if (c.note) txt.append(el('div', 'ej-note', c.note));
          li.append(txt, el('span', 'ej-chip', 'Tour'));
        } else {
          li.append(el('div', 'ej-name', c.name));
          if (c.note) li.append(el('div', 'ej-note', c.note));
        }
        li.addEventListener('mouseenter', () => {
          selected = i;
          highlight();
        });
        li.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in input
        li.addEventListener('click', () => {
          selected = i;
          go();
        });
        list.append(li);
      });
      highlight();
    }

    // ---------- preloaded tours ----------
    async function loadPreloaded() {
      if (preloaded) return preloaded;
      const res = await send({ type: 'listTours' });
      preloaded = res && res.ok ? res.data : [];
      return preloaded;
    }

    // Shows preloaded tours: all of them when the box is empty, matching ones as you type.
    // Nothing is selected until you arrow into the list, so Enter still searches what you typed.
    async function showPreloaded() {
      const text = input.value.trim().toLowerCase();
      const all = await loadPreloaded();
      if (input.value.trim().toLowerCase() !== text) return; // typed on while loading
      const hits = !text
        ? all
        : text.length < 3
          ? []
          : all.filter((t) => [t.title, t.span, ...t.keywords].some((x) => x.toLowerCase().includes(text)));
      if (!hits.length) {
        if (showingTours) {
          list.textContent = '';
          candidates = [];
          showingTours = false;
          setStatus('');
        }
        return;
      }
      candidates = hits.map((t) => ({ name: t.title, note: `${t.span}, ${t.stops} stops`, tourId: t.id }));
      selected = -1;
      resolvedFor = null;
      showingTours = true;
      renderList();
      setStatus(text ? 'Researched tours' : 'Researched tours, or type a place or a journey');
    }

    // ---------- tours ----------
    // Journeys, campaigns and voyages become a stop-by-stop tour in Earth.
    const TOUR_RE =
      /^\s*(tour|follow|trace|retrace)\b|\b(journeys?|conquests?|campaigns?|expeditions?|voyages?|travels|migrations?|treks?|exodus|hajj|crusades?|footsteps|route of|path of|march (to|of|from))\b/i;
    const isTour = (s) => TOUR_RE.test(s);

    function updateMode() {
      root.classList.toggle('ej-tour', isTour(input.value));
    }

    async function startTour(phrase, tourId) {
      const id = ++reqId;
      candidates = [];
      resolvedFor = null;
      list.textContent = '';
      setStatus('Opening the tour in Google Earth\u2026', 'busy');

      const res = await send({ type: 'startTour', phrase, tourId });
      if (id !== reqId) return;
      if (!res.ok) return showError(res);

      // Planning carries on in Earth, where the stops appear as they're written.
      if (mode === 'popup') window.close();
      else setTimeout(close, 250);
    }

    // ---------- actions ----------
    async function search() {
      const phrase = input.value.trim();
      if (!phrase) return;
      if (isTour(phrase)) return startTour(phrase);
      showingTours = false;
      const id = ++reqId;

      candidates = [];
      resolvedFor = null;
      setStatus('Thinking\u2026', 'busy');
      showSkeleton();

      const res = await send({ type: 'resolve', phrase });
      if (id !== reqId) return; // a newer search superseded this one
      if (!res.ok) return showError(res);

      candidates = res.data.candidates || [];
      selected = 0;
      resolvedFor = phrase;

      renderList();
      if (candidates.length === 1) return go();
      setStatus(`${candidates.length} matches. \u2191\u2193 to pick, Enter to go.`);
    }

    async function go() {
      const c = candidates[selected];
      if (!c) return;
      if (c.tourId) return startTour(c.name, c.tourId);
      const id = ++reqId;
      setStatus(`Flying to ${c.name}\u2026`, 'busy');
      const res = await send({ type: 'jump', candidate: c, target });
      if (id !== reqId) return;
      if (!res.ok) return showError(res);
      if (mode === 'popup') window.close();
      else setTimeout(close, 300);
    }

    function handleKey(e) {
      if (e.type !== 'keydown' || e.isComposing) return;
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          if (showingTours && selected >= 0) go();
          else if (resolvedFor !== null && input.value.trim() === resolvedFor && candidates.length) go();
          else search();
          break;
        case 'ArrowDown':
          if (candidates.length) {
            e.preventDefault();
            selected = (selected + 1) % candidates.length;
            highlight();
          }
          break;
        case 'ArrowUp':
          if (candidates.length) {
            e.preventDefault();
            selected = selected <= 0 ? candidates.length - 1 : selected - 1;
            highlight();
          }
          break;
        case 'Tab':
          e.preventDefault();
          cycleTarget();
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    }

    input.addEventListener('input', () => {
      const stale = resolvedFor !== null && input.value.trim() !== resolvedFor;
      list.classList.toggle('ej-stale', stale);
      updateMode();
      if (resolvedFor === null || stale) showPreloaded();
    });

    targetBtn.addEventListener('mousedown', (e) => e.preventDefault());
    targetBtn.addEventListener('click', cycleTarget);

    function open() {
      isOpen = true;
      root.classList.add('ej-open');
      if (!input.value.trim()) showPreloaded();
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    }

    function close() {
      if (mode === 'popup') {
        window.close();
        return;
      }
      isOpen = false;
      reqId++; // drop any in-flight results
      input.blur();
      root.classList.remove('ej-open');
    }

    if (mode === 'popup') {
      root.classList.add('ej-open');
      input.addEventListener('keydown', handleKey);
      setTimeout(() => input.focus(), 0);
      showPreloaded();
    }
    renderTarget();

    return {
      open,
      close,
      toggle: () => (isOpen ? close() : open()),
      handleKey,
      setTarget: (t) => setTarget(t, true),
      get isOpen() {
        return isOpen;
      }
    };
  };
})();
