/* Earth Tour: the tour layer that sits on Google Earth.
   Two parts: an atlas-style annotation pinned to the stop on the map, and a
   documentary band along the bottom with subtitles and a time-scale timeline.
   Exposes window.EarthTourUI(mount, options). */
(function () {
  if (window.EarthTourUI) return;

  // ---------- fonts: bundled, loaded from bytes so the page's CSP can't block them ----------
  let fontsPromise = null;
  function loadFonts() {
    if (fontsPromise) return fontsPromise;
    const faces = [
      ['ET Sans', 'inter-latin-400-normal.woff2', '400'],
      ['ET Sans', 'inter-latin-500-normal.woff2', '500'],
      ['ET Sans', 'inter-latin-600-normal.woff2', '600'],
      ['ET Mono', 'courier-prime-latin-400-normal.woff2', '400'],
      ['ET Mono', 'courier-prime-latin-700-normal.woff2', '700']
    ];
    fontsPromise = Promise.all(
      faces.map(async ([family, file, weight]) => {
        const buf = await fetch(chrome.runtime.getURL('fonts/' + file)).then((r) => r.arrayBuffer());
        const face = new FontFace(family, buf, { weight, style: 'normal' });
        await face.load();
        document.fonts.add(face);
      })
    ).catch(() => {}); // fall back to system fonts
    return fontsPromise;
  }

  const CSS = `
.et{all:initial;--hi:#FFC94A;--band:rgba(14,16,20,.82);--w2:rgba(255,255,255,.72);--w3:rgba(255,255,255,.36);
  --sans:"ET Sans",Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:"ET Mono","Courier Prime",ui-monospace,monospace;
  font:14px/1.45 var(--sans);color:#fff;-webkit-font-smoothing:antialiased}
.et *,.et *::before,.et *::after{box-sizing:border-box}
:where(.et) :where(button){all:unset;cursor:pointer;box-sizing:border-box}
.et button:focus-visible,.et .lnk:focus-visible{outline:2px solid var(--hi);outline-offset:2px}

/* annotation pinned to the stop (Earth lands with the stop at the centre of the view) */
.ann{position:fixed;left:50%;top:50%;z-index:2147483645;pointer-events:none;opacity:0;transition:opacity .4s}
.ann.on{opacity:1}
.pt{position:absolute;left:-7px;top:-7px;width:14px;height:14px;background:var(--hi);border:2px solid #111;box-shadow:0 0 0 2px #fff}
.leader{position:absolute;left:0;top:-96px;width:120px;height:96px;overflow:visible}
.lab{position:absolute;left:116px;top:-132px;width:max-content;max-width:min(300px,calc(50vw - 140px));padding:6px 10px 7px;
  background:rgba(12,14,18,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
  text-shadow:0 1px 2px rgba(0,0,0,.8)}
.lab .k{display:block;font:700 12px/1.2 var(--mono);color:var(--hi)}
.lab .t{display:block;margin-top:2px;font:600 19px/1.18 var(--sans);letter-spacing:-.01em}
.lab .m{display:block;margin-top:3px;font:400 12.5px/1.3 var(--mono);color:var(--w2)}

/* documentary band */
.band{position:fixed;z-index:2147483646;left:84px;right:236px;bottom:30px;max-width:760px;margin:0 auto;min-width:300px;
  background:var(--band);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-top:1px solid rgba(255,255,255,.14);
  animation:in .25s ease-out}
@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.x{position:absolute;right:6px;top:6px;width:28px;height:28px;display:grid;place-items:center;z-index:1}
.x:hover,.ib:hover{background:rgba(255,255,255,.1)}
.x svg{width:12px;height:12px}
.sub{padding:12px 44px 10px 16px;max-height:min(34vh,13em);overflow:auto;overscroll-behavior:contain;font:400 14px/1.5 var(--sans);max-width:64ch;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.28) transparent}
.sub.more-below{-webkit-mask-image:linear-gradient(#000 calc(100% - 32px),transparent);mask-image:linear-gradient(#000 calc(100% - 32px),transparent)}
.sub::-webkit-scrollbar{width:6px}.sub::-webkit-scrollbar-track{background:transparent}.sub::-webkit-scrollbar-thumb{background:rgba(255,255,255,.28)}
.sub .ttl{font-weight:600;font-size:15.5px}
.sub .dim{color:var(--w2)}
.sub .mono{font:400 12.5px/1.5 var(--mono);color:var(--w2)}
.sub .err{color:#FFB4A8}
.cursor{display:inline-block;width:7px;height:13px;margin-left:3px;background:var(--hi);vertical-align:-2px;animation:blink 1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}

.more{display:none;padding:2px 16px 12px;border-top:1px solid rgba(255,255,255,.12);font:400 12.5px/1.5 var(--sans);color:var(--w2)}
.more.open{display:block}
.more h3{all:unset;display:block;margin:10px 0 3px;font:700 11.5px var(--mono);color:#fff}
.more ul{margin:0;padding:0;list-style:none;font:400 12.5px/1.55 var(--mono)}
.more li{color:#fff}
.more .legend{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:10px;font:400 11px var(--mono)}
.more .legend svg{width:22px;height:6px;margin-right:6px;vertical-align:1px}
.more .lnk{color:#fff;text-decoration:underline;text-underline-offset:3px;cursor:pointer;font:400 12px var(--mono)}

.tl{display:flex;align-items:center;gap:12px;min-height:30px;padding:0 14px 10px 8px}
.tl>.meta:first-child{padding-left:8px}
.ctr{display:flex;gap:2px;flex:none}
.ib{width:30px;height:30px;display:grid;place-items:center}
.ib[disabled]{opacity:.3;cursor:default;background:none}
.ib svg{width:12px;height:12px}
.go{flex:none;padding:8px 12px;background:var(--hi);color:#111;font:600 12.5px/1 var(--sans);white-space:nowrap}
.go[disabled]{opacity:.35;cursor:default}
.meta{display:flex;align-items:center;gap:12px;flex:none;font:400 11.5px/1 var(--mono);color:var(--w2);white-space:nowrap}
.meta b{color:#fff;font-weight:700}
.meta .lnk{color:#fff;text-decoration:underline;text-underline-offset:3px;cursor:pointer;line-height:1}

/* time scale: years sit at the ends, everything centred on one line */
.span{display:flex;align-items:center;gap:8px;flex:1;min-width:140px}
.span .y{flex:none;font:400 10.5px/1 var(--mono);color:var(--w2);white-space:nowrap}
.sc{position:relative;flex:1;height:20px}
.sc .rail{position:absolute;left:7px;right:7px;top:0;bottom:0}
.sc .base{position:absolute;left:0;right:0;top:50%;border-top:1px solid var(--w3)}
.sc .leg{position:absolute;top:50%;height:0;margin-top:-.5px;border-top:2px solid var(--w3)}
.sc .leg.approximate{border-top-style:dashed}
.sc .leg.disputed{border-top-style:dotted;border-top-width:2.5px}
.sc .leg.done{border-top-color:#fff}
.sc .leg.run::after{content:"";position:absolute;left:0;right:0;top:-2px;border-top:2px solid #fff;transform-origin:left;transform:scaleX(0);animation:run var(--dur) linear var(--delay) forwards}
@keyframes run{to{transform:scaleX(1)}}
.sc .s{all:unset;position:absolute;top:50%;width:8px;height:8px;border:1.5px solid var(--w2);background:#16181d;
  transform:translate(-50%,-50%) rotate(45deg);cursor:pointer;box-sizing:border-box}
.sc .s::after{content:"";position:absolute;inset:-6px}
.sc .s:hover{border-color:#fff}
.sc .s.done{background:#fff;border-color:#fff}
.sc .s.cur{width:12px;height:12px;background:var(--hi);border-color:#111;box-shadow:0 0 0 1.5px #fff;z-index:1}
.sc .s.new{animation:pop .35s ease-out}
.sc .s[disabled]{cursor:default}
@keyframes pop{from{transform:translate(-50%,-50%) rotate(45deg) scale(0)}to{transform:translate(-50%,-50%) rotate(45deg) scale(1)}}

@media (max-width:620px){.band{left:12px;right:12px}}
@media (prefers-reduced-motion:reduce){.ann,.band,.sc .s.new,.cursor{transition:none;animation:none}.sc .leg.run::after{animation:none;transform:scaleX(.5);opacity:.5}}`;

  const CERT = {
    established: { label: 'Established', dash: '' },
    approximate: { label: 'Approximate', dash: '7 5' },
    disputed: { label: 'Disputed', dash: '0 6' }
  };

  const ICON = {
    prev: '<svg viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="1.7"><path d="M7.5 2.5 4 6l3.5 3.5"/></svg>',
    next: '<svg viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="1.7"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg>',
    play: '<svg viewBox="0 0 12 12" fill="#fff"><path d="M3.5 2v8l6.5-4z"/></svg>',
    pause: '<svg viewBox="0 0 12 12" fill="#fff"><path d="M3 2h2.2v8H3zM6.8 2H9v8H6.8z"/></svg>',
    close: '<svg viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="1.5"><path d="M2 2l8 8M10 2l-8 8"/></svg>'
  };

  // ---------- helpers ----------
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const pad2 = (n) => String(n).padStart(2, '0');

  function distanceM(a, b) {
    const R = 6371000, r = (x) => (x * Math.PI) / 180;
    const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function earthCam(lat, lng, range, tilt, heading) {
    return `https://earth.google.com/web/@${lat.toFixed(6)},${lng.toFixed(6)},0a,${Math.round(range)}d,35y,${Math.round(heading)}h,${tilt}t,0r`;
  }
  function stopCam(s, i) {
    const range = Math.max(800, s.range_m || 8000);
    return earthCam(s.lat, s.lng, range, range < 60000 ? 55 : 25, ((i * 47) % 50) - 25);
  }
  function overviewCam(stops) {
    const c = { lat: stops.reduce((a, p) => a + p.lat, 0) / stops.length, lng: stops.reduce((a, p) => a + p.lng, 0) / stops.length };
    const spread = Math.max(...stops.map((p) => distanceM(c, p)));
    return earthCam(c.lat, c.lng, Math.min(9e6, Math.max(40000, spread * 2.8)), 0, 0);
  }

  // "c. 1787" -> 1787, "334 BCE" -> -334, "June 1824" -> 1824; null if no year
  // A sortable year from a date as written: "c. 1787", "June 1824", "334 BCE",
  // "c. 3.67 million years ago", "c. 164,000 years ago". Null if there's no number.
  function yearOf(date) {
    const d = String(date || '');
    let m = d.match(/([\d.]+)\s*million years ago/i);
    if (m) return -Number(m[1]) * 1e6;
    m = d.match(/([\d][\d,]*)\s*years ago/i);
    if (m) return -Number(m[1].replace(/,/g, ''));
    // Prefer a 3-4 digit year, so "18 July 1918" is 1918, not 18.
    m = d.match(/\b(\d{3,4})(?:s\b|\b)\s*(BCE|BC)?/i) || d.match(/\b(\d{1,2})\s*(BCE|BC)\b/i);
    if (!m) return null;
    return m[2] ? -Number(m[1]) : Number(m[1]);
  }
  function yearLabel(y) {
    if (y <= -1e6) return `${+(-y / 1e6).toFixed(1)}m years ago`;
    if (y <= -10000) return `${Math.round(-y / 1000).toLocaleString('en')},000 years ago`;
    return y < 0 ? `${-y} BCE` : String(y);
  }
  // What kind of tour this is, said plainly wherever it matters.
  function provenance(tour) {
    return tour && tour.curated
      ? 'Researched tour, written from the sources listed for each stop. Not yet reviewed by a historian.'
      : 'AI-generated tour. Check the sources before relying on it.';
  }

  // Positions (0..100) on the time scale, with a minimum gap so close years stay clickable.
  function positions(stops, gapPct) {
    const ys = stops.map((s) => yearOf(s.date));
    for (let i = 0; i < ys.length; i++) {
      if (ys[i] == null) ys[i] = i > 0 && ys[i - 1] != null ? ys[i - 1] : 0; // undated: sit with the previous stop
    }
    const lo = Math.min(...ys), hi = Math.max(...ys);
    const span = hi - lo;
    let pos = ys.map((y, i) => (span > 0 ? ((y - lo) / span) * 100 : stops.length > 1 ? (i / (stops.length - 1)) * 100 : 0));
    const gap = Math.min(gapPct || 4, 100 / Math.max(1, stops.length - 1));
    // Push crowded stops apart: forwards, then back from the end if they ran past it.
    for (let i = 1; i < pos.length; i++) pos[i] = Math.max(pos[i], pos[i - 1] + gap);
    const n = pos.length;
    if (n && pos[n - 1] > 100) {
      pos[n - 1] = 100;
      for (let i = n - 2; i >= 0; i--) pos[i] = Math.min(pos[i], pos[i + 1] - gap);
      if (pos[0] < 0) pos = pos.map((p, i) => (n > 1 ? (i / (n - 1)) * 100 : 0)); // too many to fit: space evenly
    }
    return { pos, lo, hi };
  }

  // ---------- KML export ----------
  function xml(s) {
    return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  }
  function toKml(tour) {
    const line = tour.stops.map((s) => `${s.lng},${s.lat},0`).join(' ');
    const marks = tour.stops.map((s, i) => {
      const desc = [s.date, s.place, s.narration,
        `Confidence: ${(CERT[s.confidence] || CERT.approximate).label}${s.confidence_note ? ' (' + s.confidence_note + ')' : ''}`,
        s.sources && s.sources.length ? 'Sources: ' + s.sources.join('; ') : ''].filter(Boolean).join('\n\n');
      return `<Placemark><name>${xml(`${i + 1}. ${s.title}`)}</name><description>${xml(desc)}</description><Point><coordinates>${s.lng},${s.lat},0</coordinates></Point></Placemark>`;
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<name>${xml(tour.title || 'Tour')}</name>
<description>${xml(`${tour.span || ''}\n\n${tour.summary || ''}\n\n${tour.caveat || ''}\n\n${provenance(tour)}`)}</description>
<Style id="route"><LineStyle><color>ff4ac9ff</color><width>4</width></LineStyle></Style>
<Placemark><name>Route</name><styleUrl>#route</styleUrl><LineString><tessellate>1</tessellate><coordinates>${line}</coordinates></LineString></Placemark>
${marks}
</Document></kml>`;
  }
  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/vnd.google-earth.kml+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ---------- the layer ----------
  window.EarthTourUI = function (mount, opts) {
    const fly = opts.fly || (() => {});
    const onIndex = opts.onIndex || (() => {});
    const onClose = opts.onClose || (() => {});
    const onRetry = opts.onRetry || (() => {});
    loadFonts();

    const style = el('style');
    style.textContent = CSS;
    mount.appendChild(style);
    const root = el('div', 'et');

    // annotation
    const ann = el('div', 'ann');
    ann.setAttribute('aria-hidden', 'true');
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'leader');
    svg.setAttribute('viewBox', '0 0 120 96');
    const halo = document.createElementNS(NS, 'path');
    const line = document.createElementNS(NS, 'path');
    for (const [p, stroke, w, op] of [[halo, '#000', '4', '.55'], [line, '#fff', '2.2', '1']]) {
      p.setAttribute('d', 'M0 96 L46 34 L116 34');
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', stroke);
      p.setAttribute('stroke-width', w);
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('opacity', op);
      svg.appendChild(p);
    }
    const pt = el('div', 'pt');
    const lab = el('div', 'lab');
    const labK = el('span', 'k'), labT = el('span', 't'), labM = el('span', 'm');
    lab.append(labK, labT, labM);
    ann.append(svg, pt, lab);

    // band
    const band = el('section', 'band');
    band.setAttribute('aria-label', 'Tour');
    const xBtn = el('button', 'x');
    xBtn.innerHTML = ICON.close;
    xBtn.setAttribute('aria-label', 'End tour');
    xBtn.title = 'End tour';
    const sub = el('div', 'sub');
    sub.setAttribute('aria-live', 'polite');
    const more = el('div', 'more');
    const tl = el('div', 'tl');
    band.append(xBtn, sub, more, tl);

    root.append(ann, band);
    mount.appendChild(root);

    // ---------- state ----------
    let A = null;          // the active tour from storage
    let i = -1;            // current stop; -1 = not started
    let started = false;
    let playing = false;
    let dwellStart = 0;   // when the current autoplay countdown began
    let dwellMs = 0;
    let timer = null;
    let annTimer = null;
    let flownOverview = false;
    let lastCam = null;    // {lat,lng} of the last place we flew to
    let seen = 0;          // stops already drawn, to animate new ones
    let moreOpen = false;
    let tick = null;

    const stops = () => (A && A.tour && A.tour.stops) || [];
    const planning = () => A && A.status === 'planning';

    // ---------- camera ----------
    function flyTo(url, target) {
      hideAnn();
      fly(url);
      if (!target) return;
      // Show the annotation once Earth has roughly arrived: longer hops take longer.
      const km = lastCam ? distanceM(lastCam, target) / 1000 : 2000;
      lastCam = target;
      const ms = 1500 + 1300 * Math.log10(1 + km);
      clearTimeout(annTimer);
      annTimer = setTimeout(showAnn, ms);
    }
    function hideAnn() {
      clearTimeout(annTimer);
      ann.classList.remove('on');
    }
    function showAnn() {
      if (started && i >= 0) ann.classList.add('on');
    }

    function renderAnn() {
      const s = stops()[i];
      if (!s) return;
      const c = CERT[s.confidence] || CERT.approximate;
      labK.textContent = planning() ? pad2(i + 1) : `${pad2(i + 1)} / ${pad2(stops().length)}`;
      labT.textContent = s.title;
      labM.textContent = `${s.date}${s.date ? ', ' : ''}${c.label.toLowerCase()}`;
      for (const p of [halo, line]) {
        if (c.dash) p.setAttribute('stroke-dasharray', c.dash);
        else p.removeAttribute('stroke-dasharray');
      }
    }

    // ---------- time scale ----------
    function renderScale(cur) {
      const list = stops();
      const wrap = el('div', 'span');
      const sc = el('div', 'sc');
      const rail = el('div', 'rail');
      rail.append(el('div', 'base'));
      sc.append(rail);
      if (!list.length) {
        wrap.append(sc);
        tl.append(wrap);
        return;
      }
      const ys = list.map((s) => yearOf(s.date)).filter((y) => y != null);
      const lo = ys.length ? Math.min(...ys) : null, hi = ys.length ? Math.max(...ys) : null;
      if (lo != null) wrap.append(el('span', 'y', yearLabel(lo)));
      wrap.append(sc);
      if (hi != null && hi !== lo) wrap.append(el('span', 'y', yearLabel(hi)));
      tl.append(wrap);

      // Place the stops once the rest of the row has been built (still before the next
      // paint), so the rail's measured width is final and close stops stay 16px apart.
      queueMicrotask(() => place(rail, list, cur));
    }

    function place(rail, list, cur) {
      if (!rail.isConnected) return;
      const w = rail.clientWidth || 300;
      const { pos } = positions(list, (16 / w) * 100);

      for (let k = 1; k < list.length; k++) {
        const leg = el('div', `leg ${list[k].confidence}${cur != null && k <= cur ? ' done' : ''}`);
        if (playing && dwellMs && cur != null && k === cur + 1) {
          // Autoplay countdown: the leg to the next stop fills in, picking up where it was.
          leg.classList.add('run');
          leg.style.setProperty('--dur', dwellMs + 'ms');
          leg.style.setProperty('--delay', -(Date.now() - dwellStart) + 'ms');
        }
        leg.style.left = pos[k - 1] + '%';
        leg.style.width = Math.max(0, pos[k] - pos[k - 1]) + '%';
        rail.append(leg);
      }
      list.forEach((s, k) => {
        const b = el('button', 's');
        if (cur != null && k < cur) b.classList.add('done');
        if (k === cur) {
          b.classList.add('cur');
          b.setAttribute('aria-current', 'step');
        }
        if (k >= seen) b.classList.add('new');
        b.style.left = pos[k] + '%';
        b.title = `${s.date ? s.date + ': ' : ''}${s.title}`;
        b.setAttribute('aria-label', `Stop ${k + 1}: ${s.title}`);
        if (!started) b.disabled = true;
        else b.addEventListener('click', () => goTo(k));
        rail.append(b);
      });
      seen = list.length;
    }

    // ---------- band contents ----------
    function button(cls, html, label, onClick, disabled) {
      const b = el('button', cls);
      b.innerHTML = html;
      b.setAttribute('aria-label', label);
      b.title = label;
      if (disabled) b.disabled = true;
      else b.addEventListener('click', onClick);
      return b;
    }

    function elapsed() {
      const s = Math.max(0, Math.round((Date.now() - (A.started || Date.now())) / 1000));
      return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
    }

    function renderPlanning() {
      const list = stops();
      const t = A.tour || {};
      sub.textContent = '';
      const head = el('div');
      head.append(el('span', 'dim', 'Planning a tour: '), el('span', 'ttl', t.title || `\u201c${A.phrase}\u201d`));
      sub.append(head);
      const last = list[list.length - 1];
      const ln = el('div', 'mono');
      ln.append(document.createTextNode(last ? `${last.date}   ${last.title}` : A.region ? `Flying to ${A.region.name}` : 'Reading the record'));
      ln.append(el('span', 'cursor'));
      sub.append(ln);

      tl.textContent = '';
      const meta = el('div', 'meta');
      meta.append(el('b', null, `${list.length} ${list.length === 1 ? 'stop' : 'stops'}`), el('span', null, elapsed()));
      tl.append(meta);
      renderScale(null);
      const go = el('button', 'go', 'Start tour');
      if (!list.length) go.disabled = true;
      else go.addEventListener('click', start);
      tl.append(go);
    }

    function renderIntro() {
      const t = A.tour;
      sub.textContent = '';
      const head = el('div');
      head.append(el('span', 'ttl', t.title || 'Tour'));
      sub.append(head);
      if (t.span) sub.append(el('div', 'mono', t.span));
      if (t.summary) sub.append(el('div', null, t.summary));
      if (t.caveat) {
        const c = el('div', 'dim');
        c.style.marginTop = '6px';
        c.textContent = t.caveat;
        sub.append(c);
      }
      tl.textContent = '';
      const meta = el('div', 'meta');
      meta.append(el('b', null, `${stops().length} stops`));
      if (t.curated) meta.append(el('span', null, 'Researched'));
      tl.append(meta);
      renderScale(null);
      const go = el('button', 'go', 'Start tour');
      go.addEventListener('click', start);
      tl.append(go);
    }

    function renderStop() {
      const list = stops();
      const s = list[i];
      sub.textContent = s.narration || '';
      renderMore();

      tl.textContent = '';
      const ctr = el('div', 'ctr');
      const nextReady = i < list.length - 1;
      ctr.append(
        button('ib', ICON.prev, 'Previous stop', prev, i <= 0),
        button('ib', playing ? ICON.pause : ICON.play, playing ? 'Pause' : 'Play', togglePlay),
        button('ib', ICON.next, nextReady ? 'Next stop' : planning() ? 'Next stop is still arriving' : 'End of tour', next, !nextReady)
      );
      tl.append(ctr);
      renderScale(i);
      const meta = el('div', 'meta');
      const n = s.sources ? s.sources.length : 0;
      const lnk = el('button', 'lnk', moreOpen ? 'Hide notes' : n ? `${n} ${n === 1 ? 'source' : 'sources'}` : 'Notes');
      lnk.setAttribute('aria-expanded', String(moreOpen));
      lnk.addEventListener('click', () => {
        moreOpen = !moreOpen;
        render();
      });
      meta.append(lnk, el('span', null, `${i + 1}/${list.length}${planning() ? '+' : ''}`));
      tl.append(meta);
    }

    function legendItem(dash, label) {
      const span = el('span');
      span.innerHTML = `<svg viewBox="0 0 22 6"><path d="M1 3H21" stroke="#fff" stroke-width="2" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ''}/></svg>`;
      span.append(document.createTextNode(label));
      return span;
    }

    function renderMore() {
      more.classList.toggle('open', moreOpen);
      if (!moreOpen) return;
      const s = stops()[i];
      const t = A.tour;
      more.textContent = '';
      if (s.confidence_note) {
        more.append(el('h3', null, `What's uncertain`), el('div', null, s.confidence_note));
      }
      more.append(el('h3', null, 'Sources'));
      if (s.sources && s.sources.length) {
        const ul = el('ul');
        s.sources.forEach((x) => ul.append(el('li', null, x)));
        more.append(ul);
      } else more.append(el('div', null, 'No sources cited for this stop.'));
      if (t.caveat) more.append(el('h3', null, 'About the record'), el('div', null, t.caveat));
      const lg = el('div', 'legend');
      lg.append(legendItem('', 'Established'), legendItem('7 5', 'Approximate'), legendItem('0 6', 'Disputed'));
      more.append(lg);
      const foot = el('div');
      foot.style.marginTop = '10px';
      foot.append(el('span', null, provenance(t) + ' '));
      if (!planning()) {
        const k = el('button', 'lnk', 'Download KML');
        k.title = 'Import into a Google Earth project to see the route as a line';
        k.addEventListener('click', () => {
          const slug = (t.title || 'tour').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tour';
          download(`${slug}.kml`, toKml(t));
        });
        foot.append(k);
      }
      more.append(foot);
    }

    function renderError() {
      sub.textContent = '';
      sub.append(el('div', 'err', A.error || 'Something went wrong planning that tour.'));
      tl.textContent = '';
      const go = el('button', 'go', 'Try again');
      go.addEventListener('click', () => onRetry());
      tl.append(go);
    }

    function render() {
      renderInner();
      queueMicrotask(checkOverflow);
    }

    function renderInner() {
      if (!A) return;
      if (started && !stops()[i]) {
        // The current stop has gone (a shorter tour replaced this one): fall back safely.
        i = Math.min(i, stops().length - 1);
        if (i < 0) reset();
      }
      clearInterval(tick);
      tick = null;
      if (A.status === 'error' && !started) return renderError();
      if (!started) {
        if (planning()) {
          renderPlanning();
          tick = setInterval(() => {
            const m = tl.querySelector('.meta span');
            if (m) m.textContent = elapsed();
          }, 1000);
          return;
        }
        return renderIntro();
      }
      renderStop();
      renderAnn();
    }

    // ---------- navigation ----------
    function start() {
      started = true;
      goTo(0);
    }
    function goTo(n) {
      const list = stops();
      if (!list.length) return;
      i = Math.max(0, Math.min(list.length - 1, n));
      onIndex(i);
      const s = list[i];
      renderAnn();
      flyTo(stopCam(s, i), s);
      schedule();
    }
    function next() {
      if (i < stops().length - 1) goTo(i + 1);
    }
    function prev() {
      if (i > 0) goTo(i - 1);
    }
    function dwell(s) {
      if (!s) return 11000;
      const words = (s.narration || '').trim().split(/\s+/).length;
      return Math.min(26000, Math.max(11000, 7000 + words * 230));
    }
    function schedule() {
      clearTimeout(timer);
      dwellMs = 0;
      if (playing) {
        if (i >= stops().length - 1 && !planning()) playing = false;
        else {
          dwellStart = Date.now();
          dwellMs = dwell(stops()[i]);
          timer = setTimeout(function step() {
            if (i < stops().length - 1) goTo(i + 1);
            else if (planning()) timer = setTimeout(step, 1000); // wait for the next stop to arrive
            else {
              playing = false;
              dwellMs = 0;
              render();
            }
          }, dwellMs);
        }
      }
      render();
    }
    function togglePlay() {
      if (!started || !stops()[i]) return;
      playing = !playing;
      if (playing && i >= stops().length - 1 && !planning()) return goTo(0);
      schedule();
    }

    function close() {
      clearTimeout(timer);
      clearTimeout(annTimer);
      clearInterval(tick);
      root.remove();
      style.remove();
      onClose();
    }
    xBtn.addEventListener('click', close);

    // Fade the bottom of the subtitles while there's more text to scroll to.
    function checkOverflow() {
      sub.classList.toggle('more-below', sub.scrollTop + sub.clientHeight < sub.scrollHeight - 2);
    }
    sub.addEventListener('scroll', checkOverflow, { passive: true });

    // ---------- updates from storage ----------
    // What the band actually shows; storage also changes for index echoes and coordinate
    // snaps, and rebuilding the row on those could swallow a click halfway through.
    function visible(a) {
      if (!a) return '';
      const t = a.tour || {};
      return [a.status, (t.stops || []).length, t.title, t.span, t.summary, t.caveat, a.error, a.region ? 1 : 0].join('|');
    }

    // Back to a clean slate, for a new tour arriving in a tab that already has one open.
    function reset() {
      clearTimeout(timer);
      clearTimeout(annTimer);
      clearInterval(tick);
      tick = null;
      playing = false;
      dwellMs = 0;
      started = false;
      i = -1;
      seen = 0;
      moreOpen = false;
      flownOverview = false;
      lastCam = null;
      hideAnn();
    }

    function update(active) {
      if (A && active && (active.started !== A.started || active.phrase !== A.phrase)) {
        reset();
        A = null;
      }
      const firstTime = !A;
      const before = visible(A);
      A = active;
      if (firstTime && Number.isInteger(active.index) && active.index >= 0 && stops().length) {
        // Earth reloaded mid-tour: carry on where we were.
        started = true;
        i = Math.min(active.index, stops().length - 1);
        seen = stops().length;
        renderAnn();
        flyTo(stopCam(stops()[i], i), stops()[i]);
        render();
        return;
      }
      if (!started && !flownOverview) {
        if (A.status === 'ready' && stops().length) {
          flownOverview = true;
          fly(overviewCam(stops()));
        } else if (A.region) {
          flownOverview = true;
          fly(earthCam(A.region.lat, A.region.lng, A.region.range_m || 400000, 0, 0));
        }
      }
      // A planning job that stopped reporting (e.g. the browser restarted mid-way).
      if (planning() && Date.now() - (A.started || 0) > 4 * 60 * 1000) {
        A = { ...A, status: 'error', error: 'Planning stopped before it finished. Try again.' };
      }
      if (!firstTime && visible(A) === before) return;
      render();
    }

    function handleKey(e) {
      if (e.type !== 'keydown' || e.altKey || e.ctrlKey || e.metaKey || !started) return false;
      if (e.key === ' ' && !e.repeat) {
        const f = mount.activeElement;
        if (f && f.tagName === 'BUTTON') return false;
        e.preventDefault();
        togglePlay();
        return true;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
        return true;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
        return true;
      }
      return false;
    }

    // The person dragged or zoomed the map: the stop is no longer at the centre.
    function mapMoved() {
      hideAnn();
    }

    return { update, handleKey, mapMoved, close };
  };

  window.EarthTourUI._toKml = toKml;
  window.EarthTourUI._positions = positions;
})();
