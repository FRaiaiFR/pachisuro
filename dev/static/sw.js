// オフラインでも開けるようにするための最小限のキャッシュ。
// ページ本体は「まず通信、だめなら前回の保存分」。フォントは「保存分があればそれを使う」。
const CACHE = 'dx7-shushi-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('dx7-shushi-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  const mine = url.origin === location.origin && url.pathname.startsWith(new URL(self.registration.scope).pathname);
  if (!font && !mine) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (font) {
      const hit = await cache.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res;
    }
    try { const res = await fetch(req, { cache: 'no-store' }); if (res.ok) cache.put(req, res.clone()); return res; }
    catch (err) { const hit = await cache.match(req, { ignoreSearch: true }); if (hit) return hit; throw err; }
  })());
});
