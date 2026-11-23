// Earth Jump service worker: resolves phrases, snaps coordinates, navigates tabs.

const MODEL = 'claude-haiku-5-5';

const SYSTEM = `You turn a phrase into real places on Earth. Reply with ONLY a JSON object, no prose:
{"candidates":[{"name":string,"lat":number,"lng":number,"range_m":number,"searchable":boolean,"note":string}]}
Rules:
- Order candidates by how likely the user means them. Best answer first.
- One candidate when the answer is clear (e.g. "highest mountain in the world").
- 2 to 5 candidates when the phrase is ambiguous ("Paris", "Springfield"), contested ("oldest city in the world"), or asks for several ("tallest buildings in Africa").
- name: common name plus region/country, specific enough for a map search (e.g. "Mount Everest, Nepal").
- lat/lng: decimal degrees, as precise as you know.
- range_m: camera distance in metres that frames it well (building ~800, stadium ~1500, mountain ~15000, city ~30000, country ~1500000).
- searchable: true if a map search by name would find it; false for ocean trenches, borders, arbitrary points.
- note: under 12 words. Why this matches, or what sets it apart from the other candidates.
If the phrase is not about a place at all, reply {"error":"short reason"}.`;

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

  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) throw codedError('NO_KEY', 'Add your Anthropic API key in Settings.');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM,
      messages: [{ role: 'user', content: phrase }]
    })
  });

  if (!res.ok) {
    if (res.status === 401) throw codedError('NO_KEY', 'Your API key was rejected. Check it in Settings.');
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 140)}`);
  }

  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || '').join('');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not read places from the response.');

  const parsed = JSON.parse(match[0]);
  if (parsed.error) throw new Error(parsed.error);

  const candidates = (parsed.candidates || []).filter(validCandidate).slice(0, 5);
  if (!candidates.length) throw new Error('No places found for that.');

  await cacheSet('phraseCache', key, candidates);
  return { candidates };
}

// ---------- 1b. phrase -> historical tour (Claude Sonnet: accuracy matters here) ----------
const TOUR_MODEL = 'claude-sonnet-5-5';

const TOUR_SYSTEM = `You create historical map tours that a 3D globe will fly through stop by stop.
Reply with ONLY a JSON object, no prose:
{"title": string, "span": string, "summary": string, "caveat": string,
 "stops": [{"date": string, "title": string, "place": string, "lat": number, "lng": number, "range_m": number,
            "narration": string, "confidence": "established" | "approximate" | "disputed",
            "confidence_note": string, "sources": [string]}]}
Fields:
- title: short name of the journey, e.g. "Shaka's rise and campaigns".
- span: years and region, e.g. "1816 to 1828, KwaZulu-Natal".
- summary: two sentences on what the journey was and why it mattered.
- caveat: one or two sentences on where the historical record comes from and how reliable it is.
- date: as precise as the record allows, e.g. "1818", "c. 1787", "June 1824".
- place: the modern location in plain words, e.g. "near present-day Ulundi, KwaZulu-Natal".
- range_m: camera distance in metres that frames the site (a battlefield ~6000, a town ~12000, a region ~150000).
- narration: two or three plain, vivid sentences. No invented dialogue or inner thoughts.
- confidence: established if historians broadly agree on what happened there; approximate if the event is accepted but the exact site or date is not; disputed if historians disagree or the main sources are partisan.
- confidence_note: one short sentence on what exactly is uncertain. Empty string if established.
- sources: real, well-known works you are confident exist, as "Author, Title (year)". Fewer is fine. Never invent a citation; give an empty array if unsure.
Rules:
- 5 to 12 stops, in chronological order, tracing the actual movement of the person, group or event.
- Do not present legend or later myth as fact. If a famous story is probably legend, say so in the narration.
If the request is not a historical journey that can be mapped, reply {"error": "short reason"}.`;

function validStop(s) {
  return (
    s &&
    typeof s.title === 'string' &&
    Number.isFinite(s.lat) && Math.abs(s.lat) <= 90 &&
    Number.isFinite(s.lng) && Math.abs(s.lng) <= 180
  );
}

function validTour(t) {
  return (
    t &&
    typeof t.title === 'string' &&
    Array.isArray(t.stops) &&
    t.stops.filter(validStop).length >= 2
  );
}

async function resolveTour(phrase) {
  const key = norm(phrase);
  const hit = await cacheGet('tourCache', key);
  if (hit) return hit;

  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) throw codedError('NO_KEY', 'Add your Anthropic API key in Settings.');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: TOUR_MODEL,
      max_tokens: 6000,
      system: TOUR_SYSTEM,
      messages: [{ role: 'user', content: phrase }]
    })
  });

  if (!res.ok) {
    if (res.status === 401) throw codedError('NO_KEY', 'Your API key was rejected. Check it in Settings.');
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 140)}`);
  }

  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || '').join('');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not read a tour from the response.');

  const tour = JSON.parse(match[0]);
  if (tour.error) throw new Error(tour.error);
  if (!validTour(tour)) throw new Error('That tour came back incomplete. Try rephrasing.');

  tour.stops = tour.stops.filter(validStop).slice(0, 12).map((s) => ({
    ...s,
    confidence: ['established', 'approximate', 'disputed'].includes(s.confidence) ? s.confidence : 'approximate',
    sources: Array.isArray(s.sources) ? s.sources.filter((x) => typeof x === 'string') : []
  }));
  tour.request = phrase;
  tour.generated = true;

  await cacheSet('tourCache', key, tour);
  return tour;
}

async function startTour(phrase, sender) {
  const tour = await resolveTour(phrase);
  const tab = sender.tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  // Already on Earth: show the panel and fly in place.
  if (tab && isEarth(tab.url)) {
    await chrome.storage.local.set({ activeTour: { tour, index: -1, tabId: tab.id } });
    try {
      const r = await chrome.tabs.sendMessage(tab.id, { type: 'tourShow' });
      if (r && r.ok) return { title: tour.title, stops: tour.stops.length };
    } catch {
      // no content script yet: fall through and load Earth fresh
    }
    await chrome.tabs.update(tab.id, { url: 'https://earth.google.com/web/' });
    return { title: tour.title, stops: tour.stops.length };
  }

  // Elsewhere: open Earth in a new tab; its content script picks the tour up on load.
  const created = await chrome.tabs.create({ url: 'https://earth.google.com/web/' });
  await chrome.storage.local.set({ activeTour: { tour, index: -1, tabId: created.id } });
  return { title: tour.title, stops: tour.stops.length };
}

async function getTour(sender) {
  const { activeTour } = await chrome.storage.local.get('activeTour');
  if (!activeTour || !sender.tab || activeTour.tabId !== sender.tab.id) return null;
  return activeTour;
}

async function setTourIndex(index, sender) {
  const { activeTour } = await chrome.storage.local.get('activeTour');
  if (!activeTour || !sender.tab || activeTour.tabId !== sender.tab.id) return false;
  activeTour.index = index;
  await chrome.storage.local.set({ activeTour });
  return true;
}

async function endTour(sender) {
  const { activeTour } = await chrome.storage.local.get('activeTour');
  if (activeTour && sender.tab && activeTour.tabId === sender.tab.id) {
    await chrome.storage.local.remove('activeTour');
  }
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
    startTour: () => startTour(msg.phrase, sender),
    getTour: () => getTour(sender),
    tourIndex: () => setTourIndex(msg.index, sender),
    endTour: () => endTour(sender)
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
