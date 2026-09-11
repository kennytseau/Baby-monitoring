// Service worker for Little One.
//
// Its only job is lock-screen notifications. iOS freezes a service worker
// whenever the app is not in front, so it cannot count the minutes itself —
// the sync Worker does that and pushes the new text every few minutes. One
// fixed tag means each update replaces the previous notification in place
// instead of stacking a new one up every time.
//
// There is deliberately no fetch handler: nothing here caches or changes how
// the app loads.

const TIMER_TAG = 'little-one-timer'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Little One', {
      body: payload.body || '',
      tag: TIMER_TAG,
      // Update the count quietly; only the first notification announces itself.
      renotify: false,
      icon: './icon-192.png',
      badge: './icon-192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const home = new URL('./', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(home) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(home)
    }),
  )
})
