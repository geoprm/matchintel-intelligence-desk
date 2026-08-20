const CACHE="matchintel-shell-p11-v1";
const ASSETS=["/","/index.html","/styles.css","/app.js","/daily-tickets.js","/performance-lab.js","/backtest-lab.js","/value-board.js","/manifest.webmanifest","/icons/icon-192.png","/icons/icon-512.png"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin) return;
  e.respondWith(
    fetch(e.request,{cache:"no-store"})
      .then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r})
      .catch(()=>caches.match(e.request).then(r=>r||caches.match("/index.html")))
  );
});

self.addEventListener("push",event=>{
  let p={};
  try{p=event.data?event.data.json():{}}catch{p={body:event.data?.text?.()||"Nova oportunidade MatchIntel"}}
  const data=p.data||{};
  const actions=[];
  if(data.bookmakerUrl && data.bookmaker){
    actions.push({action:"bookmaker",title:`Abrir ${data.bookmaker}`});
  }
  actions.push({action:"app",title:"Abrir MatchIntel"});
  const options={
    body:p.body||"Nova oportunidade detectada.",
    icon:"/icons/icon-192.png",
    badge:"/icons/icon-192.png",
    tag:p.tag||`matchintel-${Date.now()}`,
    renotify:true,
    silent:false,
    vibrate:[220,90,220,90,320],
    requireInteraction:!!p.requireInteraction,
    actions,
    data:{
      appUrl:data.appUrl||"/",
      bookmakerUrl:data.bookmakerUrl||null,
      bookmaker:data.bookmaker||null,
      matchKey:data.matchKey||null,
      level:p.level||null
    }
  };
  event.waitUntil(Promise.all([
    self.registration.showNotification(p.title||"MatchIntel",options),
    self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{
      cs.forEach(c=>c.postMessage({type:"MATCHINTEL_PUSH",payload:p}));
    })
  ]));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const d=event.notification.data||{};
  let target=d.appUrl||"/";
  if(event.action==="bookmaker" && d.bookmakerUrl) target=d.bookmakerUrl;
  const absolute=target.startsWith("http")?target:new URL(target,self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({type:"window",includeUncontrolled:true}).then(async clients=>{
      if(event.action!=="bookmaker"){
        for(const c of clients){
          if(new URL(c.url).origin===self.location.origin && "focus" in c){
            await c.focus();
            try{c.postMessage({type:"MATCHINTEL_NOTIFICATION_OPEN",data:d})}catch{}
            return;
          }
        }
      }
      if(self.clients.openWindow) return self.clients.openWindow(absolute);
    })
  );
});
