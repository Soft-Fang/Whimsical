// E3：极简 Service Worker —— 只缓存带内容哈希的 /_astro/ 静态资源
// HTML 与接口一律走网络，保证内容始终最新
const CACHE = 'whimsical-static-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // 只缓存 /_astro/ 下带哈希的文件（内容变了 URL 就变，不会过期）
  if (!url.pathname.includes('/_astro/')) return;

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        });
      })
    )
  );
});