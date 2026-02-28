// lifty service worker
// - Offline caching: cache-first for static assets, network-first for API
// - Background rest timer: SCHEDULE_NOTIFICATION / CANCEL_NOTIFICATION messages

const STATIC_CACHE = 'lifty-static-v1'
const API_CACHE    = 'lifty-api-v1'
const ALL_CACHES   = [STATIC_CACHE, API_CACHE]

// ── Install: activate immediately ──────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting())

// ── Activate: delete old caches, claim clients ────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Ignore non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // API: network-first, stale-cache fallback
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(request)
        .then(res => {
          caches.open(API_CACHE).then(c => c.put(request, res.clone()))
          return res
        })
        .catch(() =>
          caches.match(request).then(r =>
            r || new Response(JSON.stringify({ offline: true }), {
              headers: { 'Content-Type': 'application/json' },
              status: 503,
            })
          )
        )
    )
    return
  }

  // HTML navigation: network-first, fall back to cached /
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          caches.open(STATIC_CACHE).then(c => c.put(request, res.clone()))
          return res
        })
        .catch(() => caches.match('/').then(r => r || caches.match(request)))
    )
    return
  }

  // Static assets (Vite content-hashed): cache-first
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(res => {
        if (res.ok) caches.open(STATIC_CACHE).then(c => c.put(request, res.clone()))
        return res
      })
    })
  )
})

// ── Background rest-timer notifications ───────────────────────────────────
// Page posts SCHEDULE_NOTIFICATION when timer starts, CANCEL_NOTIFICATION
// when it stops manually or finishes on the page side.

const pendingNotifs = new Map() // id → timeoutId

self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_NOTIFICATION') {
    const { id, delay, title, body } = e.data

    // Cancel any previous timer with this id
    if (pendingNotifs.has(id)) {
      clearTimeout(pendingNotifs.get(id))
      pendingNotifs.delete(id)
    }

    // e.waitUntil keeps the SW alive until the notification fires
    const p = new Promise(resolve => {
      const t = setTimeout(async () => {
        pendingNotifs.delete(id)
        try {
          await self.registration.showNotification(title, {
            body,
            icon: '/apple-touch-icon.png',
            badge: '/apple-touch-icon.png',
            tag: 'rest-timer',
            renotify: true,
            silent: false,
            vibrate: [300, 100, 300],
          })
        } catch (_) {}
        resolve()
      }, delay)
      pendingNotifs.set(id, t)
    })
    e.waitUntil(p)
  }

  if (e.data?.type === 'CANCEL_NOTIFICATION') {
    const { id } = e.data
    if (pendingNotifs.has(id)) {
      clearTimeout(pendingNotifs.get(id))
      pendingNotifs.delete(id)
    }
  }
})

// ── Notification tap → focus / open app ───────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(ws => {
        const w = ws.find(c => c.focused) || ws[0]
        if (w) return w.focus()
        return self.clients.openWindow('/')
      })
  )
})
