/* Earth Jump tour panel. Floats over Google Earth and flies stop to stop.
   Exposes window.EarthJumpTour(mount, options). */
(function () {
  if (window.EarthJumpTour) return;

  // ---------- fonts: bundled Source Serif 4, loaded from bytes so page CSP can't block it ----------
  let fontsPromise = null;
  function loadFonts() {
    if (fontsPromise) return fontsPromise;
    const faces = [
      ['source-serif-4-latin-400-normal.woff2', '400', 'normal'],
      ['source-serif-4-latin-400-italic.woff2', '400', 'italic'],
      ['source-serif-4-latin-600-normal.woff2', '600', 'normal']
    ];
    fontsPromise = Promise.all(
      faces.map(async ([file, weight, style]) => {
        const buf = await fetch(chrome.runtime.getURL('fonts/' + file)).then((r) => r.arrayBuffer());
        const face = new FontFace('EJ Serif', buf, { weight, style });
        await face.load();
        document.fonts.add(face);
      })
    ).catch(() => {}); // fall back to Georgia
    return fontsPromise;
  }

  const CSS = `
.et-root{all:initial;--ink:rgba(20,33,58,.94);--line:rgba(232,237,245,.12);--chart:#E8EDF5;--mist:#9AAAC4;--route:#8FD3E8;--ok:#7DCEA0;--warn:#E8C065;--bad:#EE8F86;--serif:"EJ Serif","Source Serif 4",Georgia,serif;
  font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--chart);-webkit-font-smoothing:antialiased}
.et-root *,.et-root *::before,.et-root *::after{box-sizing:border-box}
.et-panel{position:fixed;left:16px;top:92px;z-index:2147483646;width:min(384px,calc(100vw - 32px));max-height:calc(100vh - 210px);display:flex;flex-direction:column;
  background:var(--ink);border:1px solid var(--line);border-radius:16px;box-shadow:0 24px 60px rgba(4,10,24,.5),0 2px 8px rgba(4,10,24,.35);
  -webkit-backdrop-filter:blur(18px) saturate(130%);backdrop-filter:blur(18px) saturate(130%);overflow:hidden;animation:et-in .22s ease-out}
@keyframes et-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

.et-head{display:flex;align-items:center;gap:8px;padding:12px 10px 0 16px}
.et-name{flex:1;min-width:0;font-size:12.5px;font-weight:500;color:var(--mist);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.et-icon{all:unset;display:grid;place-items:center;width:28px;height:28px;border-radius:8px;color:var(--mist);cursor:pointer}
.et-icon:hover{background:rgba(232,237,245,.08);color:var(--chart)}
.et-icon:focus-visible,.et-btn:focus-visible,.et-node:focus-visible,.et-src summary:focus-visible{outline:2px solid var(--route);outline-offset:2px}
.et-icon svg{width:16px;height:16px}

.et-track{display:flex;align-items:center;padding:12px 16px 6px;min-height:30px}
.et-node{all:unset;flex:none;width:10px;height:10px;border-radius:50%;border:2px solid var(--mist);cursor:pointer;transition:transform .15s}
.et-node:hover{transform:scale(1.25)}
.et-node.done{background:var(--route);border-color:var(--route)}
.et-node.cur{width:14px;height:14px;background:var(--route);border-color:var(--route);box-shadow:0 0 0 4px rgba(143,211,232,.22)}
.et-leg{position:relative;flex:1;height:2px;margin:0 3px;overflow:hidden;opacity:.5;
  background:repeating-linear-gradient(90deg,var(--mist) 0 4px,transparent 4px 8px)}
.et-leg.done{background:var(--route);opacity:1}
.et-leg.run{opacity:1}
.et-leg.run::after{content:"";position:absolute;inset:0;background:var(--route);transform-origin:left;transform:scaleX(0);animation:et-run var(--dur) linear forwards}
@keyframes et-run{to{transform:scaleX(1)}}

.et-body{flex:1;overflow:auto;padding:10px 16px 6px;transition:opacity .18s}
.et-body.swap{opacity:0}
.et-date{font:600 30px/1.1 var(--serif);letter-spacing:-.01em;font-variant-numeric:lining-nums}
.et-title{margin:6px 0 2px;font:600 19px/1.25 var(--serif)}
.et-h-intro{margin:2px 0 4px;font:600 25px/1.15 var(--serif);letter-spacing:-.01em}
.et-place{font-size:12.5px;color:var(--mist)}
.et-conf{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px;margin:12px 0}
.et-badge{display:inline-flex;align-items:center;gap:6px;padding:2px 9px 2px 7px;border-radius:999px;font-size:12px;font-weight:600}
.et-badge::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.et-badge.established{color:var(--ok);background:rgba(125,206,160,.12)}
.et-badge.approximate{color:var(--warn);background:rgba(232,192,101,.12)}
.et-badge.disputed{color:var(--bad);background:rgba(238,143,134,.12)}
.et-conf-note{flex:1 1 180px;font-size:12px;color:var(--mist)}
.et-narr{margin:0 0 12px;font:400 15.5px/1.62 var(--serif);color:rgba(232,237,245,.93)}
.et-record{margin:4px 0 12px;padding:2px 0 2px 12px;border-left:2px solid var(--warn)}
.et-record strong{display:block;font-size:12px;font-weight:600;color:var(--warn);margin-bottom:2px}
.et-record p{margin:0;font-size:13px;line-height:1.5;color:rgba(232,237,245,.85)}
.et-src{margin:0 0 10px}
.et-src summary{list-style:none;cursor:pointer;font-size:12.5px;color:var(--mist);display:inline-flex;align-items:center;gap:6px;border-radius:4px}
.et-src summary::-webkit-details-marker{display:none}
.et-src summary::before{content:"";width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .15s}
.et-src[open] summary::before{transform:rotate(45deg)}
.et-src summary:hover{color:var(--chart)}
.et-src ul{margin:8px 0 0;padding:0 0 0 14px;font:italic 400 13.5px/1.5 var(--serif);color:rgba(232,237,245,.85)}
.et-src li{margin:0 0 4px}
.et-none{font-size:12.5px;color:var(--mist);margin:0 0 10px}

.et-foot{display:flex;align-items:center;gap:8px;padding:12px 16px 10px;border-top:1px solid var(--line)}
.et-btn{all:unset;cursor:pointer;padding:7px 12px;border-radius:8px;font-size:13px;font-weight:500;color:var(--chart);background:rgba(232,237,245,.07)}
.et-btn:hover{background:rgba(232,237,245,.12)}
.et-btn[disabled]{opacity:.35;cursor:default;background:rgba(232,237,245,.07)}
.et-play{min-width:44px;text-align:center}
.et-btn.primary{background:var(--route);color:#0F1B30;font-weight:600}
.et-btn.primary:hover{filter:brightness(1.07)}
.et-count{margin-left:auto;font-size:12px;color:var(--mist);font-variant-numeric:tabular-nums}
.et-disc{padding:0 16px 12px;font-size:11.5px;color:var(--mist);opacity:.85}

@media (prefers-reduced-motion:reduce){
  .et-panel{animation:none}.et-body{transition:none}.et-node{transition:none}
  .et-leg.run::after{animation:none;transform:scaleX(1);opacity:.45}
}`;

  const ICON = {
    kml: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  const CONF_LABEL = { established: 'Established', approximate: 'Approximate', disputed: 'Disputed' };

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---------- cameras ----------
  function earthCam(lat, lng, range, tilt, heading) {
    return `https://earth.google.com/web/@${lat.toFixed(6)},${lng.toFixed(6)},0a,${Math.round(range)}d,35y,${Math.round(heading)}h,${tilt}t,0r`;
  }

  function distanceM(a, b) {
    const R = 6371000, r = (x) => (x * Math.PI) / 180;
    const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function overviewCam(stops) {
    const c = {
      lat: stops.reduce((s, p) => s + p.lat, 0) / stops.length,
      lng: stops.reduce((s, p) => s + p.lng, 0) / stops.length
    };
    const spread = Math.max(...stops.map((p) => distanceM(c, p)));
    const range = Math.min(9e6, Math.max(40000, spread * 2.8));
    return earthCam(c.lat, c.lng, range, 0, 0);
  }

  function stopCam(s, i) {
    const range = Math.max(800, s.range_m || 8000);
    const tilt = range < 60000 ? 55 : 25;
    const heading = ((i * 47) % 50) - 25; // small swing between stops so each arrival feels different
    return earthCam(s.lat, s.lng, range, tilt, heading);
  }

  // ---------- KML export: lets people load the route line into an Earth project ----------
  function xml(s) {
    return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  }

  function toKml(tour) {
    const line = tour.stops.map((s) => `${s.lng},${s.lat},0`).join(' ');
    const marks = tour.stops
      .map((s, i) => {
        const desc = [
          s.date,
          s.narration,
          `Confidence: ${CONF_LABEL[s.confidence] || s.confidence}${s.confidence_note ? ' (' + s.confidence_note + ')' : ''}`,
          s.sources && s.sources.length ? 'Sources: ' + s.sources.join('; ') : ''
        ].filter(Boolean).join('\n\n');
        return `<Placemark><name>${xml(`${i + 1}. ${s.title}`)}</name><description>${xml(desc)}</description><Point><coordinates>${s.lng},${s.lat},0</coordinates></Point></Placemark>`;
      })
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<name>${xml(tour.title)}</name>
<description>${xml(`${tour.span || ''}\n\n${tour.summary || ''}\n\n${tour.caveat || ''}\n\nAI-generated tour. Check the sources before relying on it.`)}</description>
<Style id="route"><LineStyle><color>ffe8d38f</color><width>4</width></LineStyle></Style>
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

  // ---------- the panel ----------
  window.EarthJumpTour = function (mount, opts) {
    const tour = opts.tour;
    const stops = tour.stops;
    const N = stops.length;
    const fly = opts.fly || (() => {});
    const onIndex = opts.onIndex || (() => {});
    const onClose = opts.onClose || (() => {});

    loadFonts();

    const style = el('style');
    style.textContent = CSS;
    mount.appendChild(style);

    const root = el('div', 'et-root');
    const panel = el('section', 'et-panel');
    panel.setAttribute('aria-label', `Tour: ${tour.title}`);

    // header
    const head = el('div', 'et-head');
    const name = el('div', 'et-name', tour.title);
    const kmlBtn = el('button', 'et-icon');
    kmlBtn.type = 'button';
    kmlBtn.innerHTML = ICON.kml;
    kmlBtn.title = 'Download as KML. Import it into an Earth project to see the route line.';
    kmlBtn.setAttribute('aria-label', 'Download tour as KML');
    const closeBtn = el('button', 'et-icon');
    closeBtn.type = 'button';
    closeBtn.innerHTML = ICON.close;
    closeBtn.title = 'End tour';
    closeBtn.setAttribute('aria-label', 'End tour');
    head.append(name, kmlBtn, closeBtn);

    const track = el('div', 'et-track');
    track.setAttribute('role', 'group');
    track.setAttribute('aria-label', 'Stops');
    const body = el('div', 'et-body');
    body.setAttribute('aria-live', 'polite');

    const foot = el('div', 'et-foot');
    const prevBtn = el('button', 'et-btn', 'Previous');
    const playBtn = el('button', 'et-btn et-play', 'Play');
    const nextBtn = el('button', 'et-btn primary', 'Next');
    [prevBtn, playBtn, nextBtn].forEach((b) => (b.type = 'button'));
    const count = el('div', 'et-count');
    foot.append(prevBtn, playBtn, nextBtn, count);

    const disc = el('div', 'et-disc', 'AI-generated tour. Check the sources before relying on it.');

    panel.append(head, track, body, foot, disc);
    root.append(panel);
    mount.appendChild(root);

    // ---------- state ----------
    let i = Number.isInteger(opts.index) ? Math.max(-1, Math.min(N - 1, opts.index)) : -1;
    let playing = false;
    let timer = null;

    function words(s) {
      return (s || '').trim().split(/\s+/).length;
    }
    function dwell(n) {
      if (n < 0) return 6000;
      return Math.min(26000, Math.max(11000, 7000 + words(stops[n].narration) * 230));
    }

    // ---------- render ----------
    function renderTrack(runMs) {
      track.textContent = '';
      stops.forEach((s, k) => {
        if (k > 0) {
          const leg = el('div', 'et-leg');
          if (k <= i) leg.classList.add('done');
          else if (runMs && k === i + 1) {
            leg.classList.add('run');
            leg.style.setProperty('--dur', runMs + 'ms');
          }
          track.append(leg);
        }
        const node = el('button', 'et-node');
        node.type = 'button';
        node.title = `${s.date ? s.date + ', ' : ''}${s.title}`;
        node.setAttribute('aria-label', `Stop ${k + 1}: ${s.title}`);
        if (k < i) node.classList.add('done');
        if (k === i) {
          node.classList.add('cur');
          node.setAttribute('aria-current', 'step');
        }
        node.addEventListener('click', () => goTo(k));
        track.append(node);
      });
    }

    function renderIntro() {
      body.append(el('div', 'et-place', tour.span || ''));
      body.append(el('h2', 'et-h-intro', tour.title));
      if (tour.summary) body.append(el('p', 'et-narr', tour.summary));
      if (tour.caveat) {
        const rec = el('div', 'et-record');
        rec.append(el('strong', null, 'About the record'), el('p', null, tour.caveat));
        body.append(rec);
      }
    }

    function renderStop(s) {
      body.append(el('div', 'et-date', s.date || ''));
      body.append(el('h2', 'et-title', s.title));
      body.append(el('div', 'et-place', s.place || ''));

      const conf = el('div', 'et-conf');
      conf.append(el('span', `et-badge ${s.confidence}`, CONF_LABEL[s.confidence] || s.confidence));
      if (s.confidence_note) conf.append(el('span', 'et-conf-note', s.confidence_note));
      body.append(conf);

      body.append(el('p', 'et-narr', s.narration || ''));

      if (s.sources && s.sources.length) {
        const d = el('details', 'et-src');
        d.append(el('summary', null, s.sources.length === 1 ? '1 source' : `${s.sources.length} sources`));
        const ul = el('ul');
        s.sources.forEach((x) => ul.append(el('li', null, x)));
        d.append(ul);
        body.append(d);
      } else {
        body.append(el('p', 'et-none', 'No sources cited for this stop.'));
      }
    }

    function render(runMs) {
      renderTrack(runMs);

      body.classList.add('swap');
      requestAnimationFrame(() => {
        body.textContent = '';
        if (i < 0) renderIntro();
        else renderStop(stops[i]);
        body.scrollTop = 0;
        body.classList.remove('swap');
      });

      prevBtn.disabled = i < 0;
      nextBtn.textContent = i < 0 ? 'Start tour' : i >= N - 1 ? 'Finish' : 'Next';
      playBtn.textContent = playing ? 'Pause' : 'Play';
      playBtn.setAttribute('aria-pressed', String(playing));
      count.textContent = i < 0 ? `${N} stops` : `${i + 1} of ${N}`;
    }

    // ---------- navigation ----------
    function schedule() {
      clearTimeout(timer);
      if (!playing) return render();
      if (i >= N - 1) {
        playing = false;
        return render();
      }
      const ms = dwell(i);
      render(i >= 0 ? ms : 0);
      timer = setTimeout(() => goTo(i + 1), ms);
    }

    function goTo(n) {
      i = Math.max(-1, Math.min(N - 1, n));
      onIndex(i);
      fly(i < 0 ? overviewCam(stops) : stopCam(stops[i], i));
      schedule();
    }

    function next() {
      if (i >= N - 1) return close();
      goTo(i + 1);
    }
    function prev() {
      if (i > -1) goTo(i - 1);
    }
    function togglePlay() {
      playing = !playing;
      if (playing && i >= N - 1) return goTo(0);
      if (playing && i < 0) return goTo(0);
      schedule();
    }

    function close() {
      clearTimeout(timer);
      root.remove();
      style.remove();
      onClose();
    }

    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);
    playBtn.addEventListener('click', togglePlay);
    closeBtn.addEventListener('click', close);
    kmlBtn.addEventListener('click', () => {
      const slug = tour.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tour';
      download(`${slug}.kml`, toKml(tour));
    });

    function handleKey(e) {
      if (e.type !== 'keydown' || e.altKey || e.ctrlKey || e.metaKey) return false;
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

    // first frame: fly to where the tour left off
    fly(i < 0 ? overviewCam(stops) : stopCam(stops[i], i));
    render();

    return { handleKey, close, el: root };
  };

  // exposed for tests
  window.EarthJumpTour._toKml = toKml;
})();
