self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// fetch は未登録のまま（ネットワークをそのまま利用）。no-op ハンドラは登録しない。
