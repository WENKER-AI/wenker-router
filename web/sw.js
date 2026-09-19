/**
 * Service Worker for WENKER ADS Landing Page
 * Tuần 2 - Frontend: Caching cho performance offline
 * 
 * Features:
 * - Cache CSS, JS, fonts, images
 * - Offline support
 * - Background sync
 * - App shell caching
 */

const CACHE_NAME = 'wenker-ads-v2';
const ASSETS_CACHE_NAME = 'wenker-assets-v2';

// Files to cache for offline
const APP_SHELL = [
  '/wenker/',
  '/wenker/index.html',
  '/wenker/landing.html',
  '/wenker/404.html',
  '/wenker/assets/favicon-w.svg',
  '/wenker/assets/banner.png',
  '/wenker/assets/landing.css',
  '/wenker/assets/landing.js',
  '/wenker/assets/i18n.js',
];

// Cache assets with versioning
const ASSETS_TO_CACHE = [
  '/wenker/assets/favicon-w.svg',
  '/wenker/assets/banner.png',
  '/wenker/assets/landing.css',
  '/wenker/assets/landing.js',
  '/wenker/assets/i18n.js',
  '/wenker/assets/lang.js',
  '/wenker/assets/icons.js',
  '/wenker/assets/games.js',
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(APP_SHELL);
    })
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== ASSETS_CACHE_NAME) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch and cache assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Cache CSS, JS, fonts
  if (url.pathname.includes('/wenker/assets/')) {
    event.respondWith(
      caches.open(ASSETS_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          // Return cached if exists
          if (cachedResponse) {
            console.log(`[SW] Serving from cache: ${url.pathname}`);
            return cachedResponse;
          }
          
          // Fetch and cache
          return fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              console.log(`[SW] Caching: ${url.pathname}`);
              cache.put(event.request, response.clone());
            }
            return response;
          });
        });
      })
    );
  }
  
  // Serve app shell from cache
  if (APP_SHELL.includes(url.pathname) || APP_SHELL.includes(url.pathname + '/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log(`[SW] Serving app shell from cache: ${url.pathname}`);
          return cachedResponse;
        }
        return fetch(event.request);
      })
    );
  }
  
  // Cache images with strategy: cache first, network fallback
  if (url.pathname.includes('.png') || url.pathname.includes('.jpg') || url.pathname.includes('.jpeg') || url.pathname.includes('.svg')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(ASSETS_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-failed-requests') {
    event.waitUntil(
      caches.open('failed-requests').then((cache) => {
        return cache.keys().then((requests) => {
          return Promise.all(
            requests.map((request) => {
              return fetch(request).then((response) => {
                return cache.delete(request);
              }).catch(() => cache.delete(request));
            })
          );
        });
      })
    );
  }
});

// Push notification support (for future)
self.addEventListener('push', (event) => {
  const data = event.data?.json();
  if (data) {
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/wenker/assets/favicon-w.svg',
      data: data.url,
    });
  }
});

// Skip waiting for service worker to activate
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

console.log('[SW] WENKER Service Worker loaded');
