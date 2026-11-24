// Earth Tour service worker: resolves phrases, snaps coordinates, navigates tabs.

const MODEL = 'claude-haiku-5-5';

const SYSTEM = `You turn a phrase into real places on Earth. Answer in the required JSON format.
Rules:
- Order candidates by how likely the user means them. Best answer first.
- One candidate when the answer is clear (e.g. "highest mountain in the world").
- 2 to 5 candidates when the phrase is ambiguous ("Paris", "Springfield"), contested ("oldest city in the world"), or asks for several ("tallest buildings in Africa").
- name: common name plus region/country, specific enough for a map search (e.g. "Mount Everest, Nepal").
- lat/lng: decimal degrees, as precise as you know.
- range_m: camera distance in metres that frames it well (building ~800, stadium ~1500, mountain ~15000, city ~30000, country ~1500000).
- searchable: true if a map search by name would find it; false for ocean trenches, borders, arbitrary points.
- note: under 12 words. Why this matches, or what sets it apart from the other candidates.
If the phrase is not about a place at all, set error to a short reason and leave candidates empty.`;

// ---------- helpers ----------
const MAPS_RE = /^https:\/\/((www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+\/)/;
const isMaps = (u = '') => MAPS_RE.test(u);
const isEarth = (u = '') => u.startsWith('https://earth.google.com/');
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function codedError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function distanceM(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------- small LRU-ish cache in chrome.storage ----------
const CACHE_MAX = 300;

async function cacheGet(bucket, key) {
  const { [bucket]: c = {} } = await chrome.storage.local.get(bucket);
  return c[key] ? c[key].v : undefined;
}

async function cacheSet(bucket, key, value) {
  const { [bucket]: c = {} } = await chrome.storage.local.get(bucket);
  c[key] = { v: value, t: Date.now() };
  const keys = Object.keys(c);
  if (keys.length > CACHE_MAX) {
    keys
      .sort((a, b) => c[a].t - c[b].t)
      .slice(0, keys.length - CACHE_MAX)
      .forEach((k) => delete c[k]);
  }
  await chrome.storage.local.set({ [bucket]: c });
}


// ---------- calling Claude ----------
// Structured outputs: the request carries a JSON schema and the API constrains the reply
// to it, so the JSON is always valid (a stray quote in a narration can't break it).
async function requestClaude({ model, system, schema, phrase, maxTokens, stream = false, signal, effort, thinking }) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) throw codedError('NO_KEY', 'Add your Anthropic API key in Settings.');

  const send = (withTuning) => {
    const output_config = { format: { type: 'json_schema', schema } };
    const body = { model, max_tokens: maxTokens, system, stream, output_config, messages: [{ role: 'user', content: phrase }] };
    if (withTuning && effort) output_config.effort = effort;
    if (withTuning && thinking) body.thinking = thinking;
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });
  };

  let res = await send(true);
  // If a model ever rejects the speed settings, retry once with its defaults rather than failing.
  if (res.status === 400 && (effort || thinking)) {
    const text = await res.clone().text();
    if (/effort|thinking/i.test(text)) res = await send(false);
  }

  if (!res.ok) {
    if (res.status === 401) throw codedError('NO_KEY', 'Your API key was rejected. Check it in Settings.');
    if (res.status === 429) throw new Error('Too many requests right now. Wait a moment and try again.');
    if (res.status >= 500) throw new Error('Claude is having trouble right now. Try again in a minute.');
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 140)}`);
  }
  return res;
}

// Quick lookups (places, region): Haiku at low effort with thinking off. These are
// simple, and thinking would otherwise eat into their small token budgets.
const QUICK = { effort: 'low', thinking: { type: 'disabled' } };

// Tours. Sonnet 5.5 defaults to high effort and thinks before writing, so nothing
// streams until it finishes. "Fast" writes straight away; "careful" thinks first.
const TOUR_MODES = {
  fast: { effort: 'medium', thinking: { type: 'between_tools' }, maxTokens: 8000 },
  careful: { effort: 'high', thinking: null, maxTokens: 20000 }
};

function checkStop(reason) {
  if (reason === 'max_tokens') throw new Error('The answer was cut off before it finished. Try a narrower request.');
  if (reason === 'refusal') throw new Error('Claude declined that request. Try phrasing it differently.');
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Claude sent back something unexpected. Try again.');
  }
}

async function callClaude(opts) {
  const res = await requestClaude(opts);
  const data = await res.json();
  checkStop(data.stop_reason);
  return parseJson((data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

// Streams the reply and calls onText with everything received so far.
async function streamClaude(opts, onText) {
  const res = await requestClaude({ ...opts, stream: true });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  let stop = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let cut;
    while ((cut = buf.indexOf('\n\n')) >= 0) {
      const event = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      const line = event.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      let d;
      try {
        d = JSON.parse(line.slice(5));
      } catch {
        continue;
      }
      if (d.type === 'content_block_delta' && d.delta && d.delta.type === 'text_delta') {
        text += d.delta.text;
        onText(text);
      } else if (d.type === 'message_delta' && d.delta && d.delta.stop_reason) {
        stop = d.delta.stop_reason;
      } else if (d.type === 'error') {
        throw new Error((d.error && d.error.message) || 'The connection to Claude dropped. Try again.');
      }
    }
  }
  checkStop(stop);
  return text;
}

// Pulls whatever is complete out of a partial tour JSON: the top-level text fields,
// and each stop object once its closing brace has arrived.
function partialTour(text) {
  const out = { stops: [] };
  for (const k of ['title', 'span', 'summary', 'caveat']) {
    const m = text.match(new RegExp('"' + k + '"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*")'));
    if (m) {
      try {
        out[k] = JSON.parse(m[1]);
      } catch {
        // incomplete escape; try again on the next chunk
      }
    }
  }
  const si = text.indexOf('"stops"');
  const ai = si < 0 ? -1 : text.indexOf('[', si);
  if (ai < 0) return out;

  let depth = 0, inStr = false, esc = false, start = -1;
  for (let i = ai + 1; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          out.stops.push(JSON.parse(text.slice(start, i + 1)));
        } catch {
          // shouldn't happen with constrained output
        }
        start = -1;
      }
    } else if (c === ']' && depth === 0) break;
  }
  return out;
}

const PLACES_SCHEMA = {
    type: 'object',
    properties: {
      candidates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            lat: { type: 'number' },
            lng: { type: 'number' },
            range_m: { type: 'number' },
            searchable: { type: 'boolean' },
            note: { type: 'string' }
          },
          required: ['name', 'lat', 'lng', 'range_m', 'searchable', 'note'],
          additionalProperties: false
        }
      },
      error: { type: 'string', description: 'Only when the phrase is not about a place.' }
    },
    required: ['candidates'],
    additionalProperties: false
};

const TOUR_SCHEMA = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      stops: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            title: { type: 'string' },
            place: { type: 'string' },
            lat: { type: 'number' },
            lng: { type: 'number' },
            range_m: { type: 'number' },
            narration: { type: 'string' },
            confidence: { type: 'string', enum: ['established', 'approximate', 'disputed'] },
            confidence_note: { type: 'string' },
            sources: { type: 'array', items: { type: 'string' } },
            geocode_query: { type: 'string' }
          },
          required: ['date', 'title', 'place', 'lat', 'lng', 'range_m', 'narration', 'confidence', 'confidence_note', 'sources', 'geocode_query'],
          additionalProperties: false
        }
      },
      span: { type: 'string' },
      summary: { type: 'string' },
      caveat: { type: 'string' },
      error: { type: 'string', description: 'Only when the request is not a mappable historical journey.' }
    },
    required: ['title', 'stops', 'span', 'summary', 'caveat'],
    additionalProperties: false
};

// ---------- 1. phrase -> candidates (Claude) ----------
function validCandidate(c) {
  return (
    c &&
    typeof c.name === 'string' &&
    Number.isFinite(c.lat) && Math.abs(c.lat) <= 90 &&
    Number.isFinite(c.lng) && Math.abs(c.lng) <= 180
  );
}

async function resolve(phrase) {
  const key = norm(phrase);
  if (!key) throw new Error('Type a place or a question.');

  const hit = await cacheGet('phraseCache', key);
  if (hit) return { candidates: hit, cached: true };

  const parsed = await callClaude({ model: MODEL, system: SYSTEM, schema: PLACES_SCHEMA, phrase, maxTokens: 1000, ...QUICK });
  if (parsed.error) throw new Error(parsed.error);

  const candidates = (parsed.candidates || []).filter(validCandidate).slice(0, 5);
  if (!candidates.length) throw new Error('No places found for that.');

  await cacheSet('phraseCache', key, candidates);
  return { candidates };
}

// ---------- 1b. phrase -> historical tour, streamed ----------
const TOUR_MODEL = 'claude-sonnet-5-5';

const TOUR_SYSTEM = `You create historical map tours that a 3D globe will fly through stop by stop.
Answer in the required JSON format.
Fields:
- title: short name of the journey, e.g. "Shaka's rise and campaigns".
- Write the stops before span, summary and caveat.
- span: years and region, e.g. "1816 to 1828, KwaZulu-Natal".
- summary: two sentences on what the journey was and why it mattered.
- caveat: one or two sentences on where the historical record comes from and how reliable it is.
- date: as precise as the record allows, e.g. "1818", "c. 1787", "June 1824", "334 BCE".
- title (stop): the historical name of the event or place, e.g. "KwaBulawayo".
- place: the modern location in plain words, e.g. "near present-day Eshowe, KwaZulu-Natal".
- lat/lng: decimal degrees of the site itself.
- range_m: camera distance in metres that frames the site (a battlefield ~6000, a town ~12000, a region ~150000).
- narration: two or three plain, vivid sentences. No invented dialogue or inner thoughts.
- confidence: established if historians broadly agree on what happened there; approximate if the event is accepted but the exact site or date is not; disputed if historians disagree or the main sources are partisan.
- confidence_note: one short sentence on what exactly is uncertain. Empty string if established.
- sources: real, well-known works you are confident exist, as "Author, Title (year)". Fewer is fine. Never invent a citation; give an empty array if unsure.
- geocode_query: the MODERN name of the place, for a map search, only when the stop happened in that town, city or named landmark itself (e.g. "KwaDukuza, KwaZulu-Natal, South Africa"). Never a historical name. Empty string when the site is only near somewhere, or has no modern named place.
Rules:
- 5 to 12 stops, in chronological order, tracing the actual movement of the person, group or event.
- Do not present legend or later myth as fact. If a famous story is probably legend, say so in the narration.
If the request is not a historical journey that can be mapped, set error to a short reason and leave stops empty.`;

const REGION_SYSTEM = `Given a request for a historical journey, name the region where it mostly took place, so a globe can fly there while the full tour is prepared. Answer in the required JSON format. lat/lng is the centre of the region; range_m is a camera distance that frames it (a province ~400000, a country ~1500000, a continent ~6000000).`;

const REGION_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    lat: { type: 'number' },
    lng: { type: 'number' },
    range_m: { type: 'number' }
  },
  required: ['name', 'lat', 'lng', 'range_m'],
  additionalProperties: false
};

function validStop(s) {
  return (
    s &&
    typeof s.title === 'string' &&
    Number.isFinite(s.lat) && Math.abs(s.lat) <= 90 &&
    Number.isFinite(s.lng) && Math.abs(s.lng) <= 180
  );
}

function normStop(s) {
  return {
    date: String(s.date || ''),
    title: s.title,
    place: String(s.place || ''),
    lat: s.lat,
    lng: s.lng,
    range_m: Number.isFinite(s.range_m) ? s.range_m : 8000,
    narration: String(s.narration || ''),
    confidence: ['established', 'approximate', 'disputed'].includes(s.confidence) ? s.confidence : 'approximate',
    confidence_note: String(s.confidence_note || ''),
    sources: Array.isArray(s.sources) ? s.sources.filter((x) => typeof x === 'string') : [],
    geocode_query: String(s.geocode_query || ''),
    snapped: false
  };
}

// One tour at a time. The background is the only writer of `activeTour` in storage;
// the page reads it and listens for changes, so a tour survives the Earth tab loading.
let job = null;
let writeTimer = null;

function persist(now) {
  if (!job) return;
  const j = job;
  const write = () => chrome.storage.local.set({ activeTour: j.active });
  if (now) {
    clearTimeout(writeTimer);
    writeTimer = null;
    return write();
  }
  if (writeTimer) return; // a write is already scheduled and will include this change
  writeTimer = setTimeout(() => {
    writeTimer = null;
    if (job === j) write();
  }, 120);
}

// Geocode only modern place names, one request a second, and only accept a snap
// that lands near Claude's own coordinates.
async function snapQueue(j) {
  if (j.snapping) return;
  j.snapping = true;
  try {
    while (!j.aborted) {
      const i = j.active.tour.stops.findIndex((s, k) => !j.snapTried.has(k));
      if (i < 0) break;
      j.snapTried.add(i);
      const s = j.active.tour.stops[i];
      if (!s.geocode_query) continue;
      const geo = await geocode(s.geocode_query);
      if (geo && distanceM(s, geo) <= Math.max(10000, s.range_m * 2)) {
        s.lat = geo.lat;
        s.lng = geo.lng;
        s.snapped = true;
        persist();
      }
      await new Promise((r) => setTimeout(r, 1100));
    }
  } finally {
    j.snapping = false;
  }
}

// ---------- preloaded tours ----------
// Researched tours shipped with the extension (tours/*.json). They open instantly with
// no API call. A typed journey that names one of them ("follow Shaka") uses it too.
let tourIndex = null;
async function listTours() {
  if (!tourIndex) tourIndex = await fetch(chrome.runtime.getURL('tours/index.json')).then((r) => r.json());
  return tourIndex;
}

async function matchPreloaded(phrase) {
  const p = ' ' + norm(phrase).replace(/[^a-z0-9' -]/g, ' ') + ' ';
  let best = null, bestLen = 0;
  for (const t of await listTours()) {
    for (const k of t.keywords) {
      if (k.length > bestLen && p.includes(' ' + k)) {
        best = t.id;
        bestLen = k.length;
      }
    }
  }
  return best;
}

async function loadPreloaded(id) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Unknown tour.');
  const res = await fetch(chrome.runtime.getURL(`tours/${id}.json`));
  if (!res.ok) throw new Error('That tour is missing from the extension.');
  return res.json();
}

async function startTour(phrase, sender, tourId) {
  const tab = sender.tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  let tabId;
  if (tab && isEarth(tab.url)) tabId = tab.id;
  else tabId = (await chrome.tabs.create({ url: 'https://earth.google.com/web/' })).id;

  runTour(phrase, tabId, tourId);
  return { tabId, onEarth: !!(tab && isEarth(tab.url)) };
}

async function runTour(phrase, tabId, tourId) {
  if (job) {
    job.aborted = true;
    job.ctrl.abort();
  }
  const key = norm(phrase);
  const ctrl = new AbortController();
  const j = (job = {
    ctrl,
    aborted: false,
    snapTried: new Set(),
    active: { tabId, phrase, status: 'planning', started: Date.now(), index: -1, region: null, tour: { stops: [] } }
  });

  const preloadedId = tourId || (await matchPreloaded(phrase).catch(() => null));
  if (preloadedId) {
    try {
      j.active.tour = await loadPreloaded(preloadedId);
      j.active.tourId = preloadedId;
      j.active.status = 'ready';
      await persist(true);
      return;
    } catch {
      // fall through to a generated tour
    }
  }

  const cached = await cacheGet('tourCache', key);
  if (cached) {
    j.active.status = 'ready';
    j.active.tour = cached;
    await persist(true);
    return;
  }
  await persist(true);

  // Quick region guess so Earth starts flying while the tour is written.
  callClaude({ model: MODEL, system: REGION_SYSTEM, schema: REGION_SCHEMA, phrase, maxTokens: 400, signal: ctrl.signal, ...QUICK })
    .then((r) => {
      if (j.aborted || !Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return;
      j.active.region = r;
      persist();
    })
    .catch(() => {});

  const { tourMode } = await chrome.storage.local.get('tourMode');
  const mode = TOUR_MODES[tourMode] || TOUR_MODES.fast;

  try {
    const text = await streamClaude(
      { model: TOUR_MODEL, system: TOUR_SYSTEM, schema: TOUR_SCHEMA, phrase, signal: ctrl.signal, ...mode },
      (soFar) => {
        if (j.aborted) return;
        const p = partialTour(soFar);
        const t = j.active.tour;
        let changed = false;
        for (const k of ['title', 'span', 'summary', 'caveat']) {
          if (p[k] && p[k] !== t[k]) {
            t[k] = p[k];
            changed = true;
          }
        }
        const fresh = p.stops.slice(t.stops.length).filter(validStop).map(normStop);
        if (fresh.length) {
          t.stops.push(...fresh);
          changed = true;
          snapQueue(j);
        }
        if (changed) persist();
      }
    );
    if (j.aborted) return;

    const final = parseJson(text);
    const t = j.active.tour;
    if (!t.stops.length) {
      throw new Error(final.error || 'That tour came back empty. Try rephrasing.');
    }
    if (t.stops.length < 2) throw new Error('That tour came back with too few stops. Try rephrasing.');
    for (const k of ['title', 'span', 'summary', 'caveat']) if (final[k]) t[k] = final[k];
    t.request = phrase;
    t.generated = true;
    j.active.status = 'ready';
    await persist(true);

    // Cache once snapping has had its go, so replays get the snapped coordinates.
    const waitSnap = async () => {
      while (j.snapping) await new Promise((r) => setTimeout(r, 500));
      await cacheSet('tourCache', key, t); // cache even if the tour was closed meanwhile
    };
    waitSnap();
  } catch (err) {
    if (j.aborted) return;
    j.active.status = 'error';
    j.active.error = err.message || String(err);
    j.active.errorCode = err.code || null;
    await persist(true);
  }
}

async function getTour(sender) {
  const { activeTour } = await chrome.storage.local.get('activeTour');
  if (!activeTour || !sender.tab || activeTour.tabId !== sender.tab.id) return null;
  return activeTour;
}

async function setTourIndex(index, sender) {
  if (job && sender.tab && job.active.tabId === sender.tab.id) {
    job.active.index = index;
    persist();
    return true;
  }
  const { activeTour } = await chrome.storage.local.get('activeTour');
  if (!activeTour || !sender.tab || activeTour.tabId !== sender.tab.id) return false;
  activeTour.index = index;
  await chrome.storage.local.set({ activeTour });
  return true;
}

async function endTour(sender) {
  if (job && sender.tab && job.active.tabId === sender.tab.id) {
    job.aborted = true;
    job.ctrl.abort();
    job = null;
  }
  const { activeTour } = await chrome.storage.local.get('activeTour');
  if (activeTour && sender.tab && activeTour.tabId === sender.tab.id) {
    await chrome.storage.local.remove('activeTour');
  }
  return true;
}

async function retryTour(sender) {
  const { activeTour } = await chrome.storage.local.get('activeTour');
  if (!activeTour || !sender.tab || activeTour.tabId !== sender.tab.id) return false;
  runTour(activeTour.phrase, sender.tab.id, activeTour.tourId);
  return true;
}

// ---------- 2. snap coordinates with a real geocoder ----------
// LLM coordinates are fine for mountains but drift for small places. OpenStreetMap's
// Nominatim gives precise ones. We only accept the snap if it lands reasonably close to
// the LLM's guess, so "Challenger Deep" never gets snapped to a street with the same name.
async function geocode(name) {
  const key = norm(name);
  const cached = await cacheGet('geoCache', key);
  if (cached !== undefined) return cached;

  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' +
      encodeURIComponent(name);
    const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!r.ok) return null; // rate-limited or down: don't cache, just skip snapping
    const arr = await r.json();
    const geo = arr[0] ? { lat: Number(arr[0].lat), lng: Number(arr[0].lon) } : null;
    await cacheSet('geoCache', key, geo);
    return geo;
  } catch {
    return null;
  }
}

async function snap(c) {
  if (!c.searchable) return { ...c, snapped: false };
  const geo = await geocode(c.name);
  if (!geo) return { ...c, snapped: false };

  const drift = distanceM(c, geo);
  const limit = Math.max(15000, (c.range_m || 5000) * 3);
  if (drift > limit) return { ...c, snapped: false };
  return { ...c, lat: geo.lat, lng: geo.lng, snapped: true, drift_m: Math.round(drift) };
}

// ---------- 3. URLs + navigation ----------
function mapsUrl(p) {
  const q = p.searchable ? p.name : `${p.lat},${p.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function earthUrl(p) {
  // @lat,lng,altitude(a),distance(d),fov(y),heading(h),tilt(t),roll(r)
  const range = Math.max(300, Math.round(p.range_m || 5000));
  const tilt = range < 50000 ? 45 : 0;
  return `https://earth.google.com/web/@${p.lat.toFixed(6)},${p.lng.toFixed(6)},0a,${range}d,35y,0h,${tilt}t,0r`;
}

async function jump({ candidate, target = 'auto', tabId, disposition }) {
  if (!validCandidate(candidate)) throw new Error('Nothing to jump to.');

  const tab = tabId
    ? await chrome.tabs.get(tabId)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  const resolvedTarget = target === 'auto' ? (isEarth(tab?.url) ? 'earth' : 'maps') : target;
  const place = await snap(candidate);
  const url = resolvedTarget === 'earth' ? earthUrl(place) : mapsUrl(place);

  // Smooth path: if we're already on Earth, have the content script change the URL
  // in-page. Earth's router picks that up and animates a fly-to with no reload.
  // If anything goes wrong (old tab with no content script, Earth changed), fall
  // back to a normal navigation below.
  const sameTab = !disposition || disposition === 'currentTab';
  if (resolvedTarget === 'earth' && sameTab && tab && isEarth(tab.url)) {
    try {
      const r = await chrome.tabs.sendMessage(tab.id, { type: 'earthFly', url });
      if (r && r.ok) return { url, place, target: resolvedTarget, smooth: true };
    } catch {
      // fall through to a full navigation
    }
  }

  if (disposition === 'newForegroundTab') {
    await chrome.tabs.create({ url, active: true });
  } else if (disposition === 'newBackgroundTab') {
    await chrome.tabs.create({ url, active: false });
  } else if (tab && (disposition === 'currentTab' || isMaps(tab.url) || isEarth(tab.url))) {
    await chrome.tabs.update(tab.id, { url });
  } else {
    await chrome.tabs.create({ url });
  }
  return { url, place, target: resolvedTarget };
}

// ---------- messages from the palette (in-page overlay + popup) ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handlers = {
    resolve: () => resolve(msg.phrase),
    jump: () => jump({ candidate: msg.candidate, target: msg.target, tabId: sender.tab?.id }),
    openOptions: () => chrome.runtime.openOptionsPage(),
    startTour: () => startTour(msg.phrase, sender, msg.tourId),
    listTours: () => listTours(),
    getTour: () => getTour(sender),
    tourIndex: () => setTourIndex(msg.index, sender),
    endTour: () => endTour(sender),
    retryTour: () => retryTour(sender),
    whoami: () => (sender.tab ? sender.tab.id : null)
  };
  const handler = handlers[msg?.type];
  if (!handler) return false;

  Promise.resolve()
    .then(handler)
    .then(
      (data) => sendResponse({ ok: true, data }),
      (err) => sendResponse({ ok: false, error: err.message || String(err), code: err.code })
    );
  return true; // keep the channel open for the async response
});

// ---------- Alt+G ----------
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'toggle-palette') return;
  tab = tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (tab && (isMaps(tab.url) || isEarth(tab.url))) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'toggle' });
      return;
    } catch {
      // Tab was open before the extension loaded, so no content script. Fall through.
    }
  }
  try {
    await chrome.action.openPopup();
  } catch {
    // Older Chrome: no programmatic popup. Clicking the icon still works.
  }
});

// ---------- address bar: type "ej" + space ----------
chrome.omnibox.setDefaultSuggestion({ description: 'Earth Tour: fly to <match>%s</match>' });

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const { candidates } = await resolve(text);
    const { target = 'auto' } = await chrome.storage.local.get('target');
    await jump({ candidate: candidates[0], target, tabId: tab?.id, disposition });
  } catch (err) {
    if (err.code === 'NO_KEY') {
      chrome.runtime.openOptionsPage();
      return;
    }
    // Graceful fallback: hand the raw phrase to Maps search.
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
    if (tab && disposition === 'currentTab') chrome.tabs.update(tab.id, { url });
    else chrome.tabs.create({ url, active: disposition !== 'newBackgroundTab' });
  }
});

// ---------- first run ----------
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== 'install') return;
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) chrome.runtime.openOptionsPage();
});
