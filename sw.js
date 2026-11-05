// Keeps a copy of the scanner on the phone, so the page still opens with no internet
// (Safari sometimes reloads the tab by itself, or someone closes it by mistake).
// The page: from the internet when it answers within a few seconds, so updates arrive; otherwise the saved copy.
// The scripts: the saved copy, refreshed in the background.
// The check-in sheet (script.google.com) is never touched here: scans always go to the internet.
const CACHE = 'nga-scanner-1';
const PAGE = './';
const FILES = [PAGE, './html5-qrcode.min.js', './qrcode-generator.js'];
const PAGE_WAIT = 4000;   // weak signal: open the saved copy after this long

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(req.mode === 'navigate' ? page(e) : file(e));
});

async function page(e) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(PAGE);
  const net = fetch(e.request).then(res => {
    if (!res.ok || res.redirected) return saved || res;
    const copy = res.clone();
    e.waitUntil(cache.put(PAGE, copy).catch(() => {}));
    return res;
  }).catch(() => saved || Response.error());
  if (!saved) return net;
  e.waitUntil(net.catch(() => {}));   // keep updating the copy even if the saved one is shown
  return Promise.race([net, new Promise(ok => setTimeout(() => ok(saved), PAGE_WAIT))]);
}

async function file(e) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(e.request, { ignoreSearch: true });
  const net = fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); e.waitUntil(cache.put(e.request, copy).catch(() => {})); }
    return res;
  });
  if (!saved) return net;
  e.waitUntil(net.catch(() => {}));
  return saved;
}
