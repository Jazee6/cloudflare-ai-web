self.addEventListener('install', (event) => {
    event.waitUntil(caches.open('v1').then((cache) => {
        return cache.addAll(['/', 'favicon.ico', 'manifest.json', 'MenuRound.svg', 'pwa.webp'])
    }))
})

self.addEventListener('fetch', (event) => {
    event.respondWith(caches.match(event.request).then((response) => {
        if (response) {
            return response
        }
        return fetch(event.request)
    }))
})