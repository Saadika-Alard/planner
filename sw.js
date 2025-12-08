const CACHE_NAME = "planner-v1";
const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./css/style.css",
    "./js/planner.js",
    "./js/auth.js",
    "./js/utils.js",
    "./js/supabaseClient.js",
    "./setup.html",
    "./js/setup.js",
    "./attendance.html",
    "./js/attendance.js"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener("fetch", (event) => {
    // Navigation requests: NETWORK FIRST, fall back to cache
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match("./index.html");
            })
        );
        return;
    }

    // Static assets: STALE-WHILE-REVALIDATE
    // This means we serve from cache instantly, but update the cache in background.
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request);
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
            }).catch(() => {
                // Network failed, do nothing (we rely on cache)
            });
            return cachedResponse || fetchPromise;
        })
    );
});
