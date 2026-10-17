// Offline support for the Thread Tribe Partner Portal.
// Bump VERSION whenever index.html changes so phones pick up the new build.
const VERSION = 'tt-partner-202610171900';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './notify-app.js?v=1', './brand/tt-logomark.svg', './brand/tt-lockup.svg', './config.js', './vendor/supabase.js'];
const THIRD_PARTY = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(SHELL.map(function(u){ return new Request(u, { cache: 'reload' }); })); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k.indexOf('tt-partner-') === 0 && k !== VERSION; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

function putInCache(req, res){
  if(res && (res.ok || res.type === 'opaque')){
    const copy = res.clone();
    caches.open(VERSION).then(function(c){ c.put(req, copy); });
  }
  return res;
}

self.addEventListener('fetch', function(e){
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);


  // Settings file: always try the network so edits to config.js arrive straight away.
  if(url.origin === location.origin && /\/config\.js$/.test(url.pathname)){
    e.respondWith(fetch(req.url, { cache: 'no-cache' }).then(function(res){ return putInCache(req, res); }).catch(function(){ return caches.match(req); }));
    return;
  }

  // The app page itself: try the network first so updates arrive, fall back to the cached copy offline.
  if(req.mode === 'navigate' && url.origin === location.origin){
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function(res){
      if(res.ok){ const copy = res.clone(); caches.open(VERSION).then(function(c){ c.put('./index.html', copy); }); }
      return res;
    }).catch(function(){ return caches.match('./index.html'); }));
    return;
  }

  // Icons, manifest, fonts and the Excel library: cache first.
  if(url.origin === location.origin || THIRD_PARTY.indexOf(url.hostname) !== -1){
    e.respondWith(caches.match(req).then(function(hit){
      return hit || fetch(req).then(function(res){ return putInCache(req, res); });
    }));
  }
});

// ---- phone alerts (notifications, send-push) ----
self.addEventListener('push', function(e){
  var d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(x){ d = { title: 'Thread Tribe', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Thread Tribe', {
    body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.id || undefined,
    data: { url: d.url || self.registration.scope }
  }));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
    for(var i = 0; i < list.length; i++){
      var c = list[i];
      if(c.url.indexOf(self.registration.scope) === 0 && 'focus' in c){
        if(url.indexOf(self.registration.scope) === 0 && url !== c.url && 'navigate' in c) c.navigate(url);
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
