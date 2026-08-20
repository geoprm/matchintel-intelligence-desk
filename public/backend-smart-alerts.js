const baCfg=()=>window.MATCHINTEL_CONFIG||null;
const baEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const baHeaders=c=>({apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`});
const BA_FRESH_MS=90*1000;
function baAge(v){const t=new Date(v||0).getTime();return Number.isFinite(t)&&t?Date.now()-t:Number.POSITIVE_INFINITY}
function baTime(v){try{return new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch{return '—'}}
function baFresh(s){return !!s?.last_run_at&&baAge(s.last_run_at)<=BA_FRESH_MS&&baAge(s.last_run_at)>=-120000}
async function baQ(c,table,params){const r=await fetch(`${c.SUPABASE_URL}/rest/v1/${table}?${params}`,{headers:baHeaders(c),cache:'no-store'});if(!r.ok)throw new Error(`${table}: HTTP ${r.status}`);return r.json()}
function baFeedRow(a){
  const ok=Number(a.success_count||0)>0;
  const failed=Number(a.failure_count||0)>0;
  return `<article class="ba-feed-row ${ok?'sent':failed?'failed':''}"><div><small>${baTime(a.created_at)} · ${baEsc(a.kind||'ALERTA')}</small><strong>${baEsc(a.title||a.stage||'Smart Alert')}</strong><span>${baEsc(a.body||'')}</span></div><div class="ba-feed-meta"><b>${baEsc(a.stage||a.alignment||'')}</b><small>${Number(a.success_count||0)} ok · ${Number(a.failure_count||0)} falha</small></div></article>`;
}
async function baLoad(){
  const c=baCfg(),root=document.querySelector('#backendAlertCenter');
  if(!root)return;
  if(!c){setTimeout(baLoad,800);return}
  try{
    const [statusRows,feed]=await Promise.all([
      baQ(c,'matchintel_alert_backend_status','select=*&id=eq.main&limit=1'),
      baQ(c,'matchintel_alert_feed','select=*&order=created_at.desc&limit=12')
    ]);
    const s=statusRows[0]||{},fresh=baFresh(s);
    const badge=document.querySelector('#backendAlertBadge');
    if(badge)badge.textContent=`${fresh?'BACKEND ON':'BACKEND STALE'} · ${baEsc(s.version||'P9.4')} · ${baEsc(s.mode||'SHADOW')}`;
    root.innerHTML=`<div class="ba-hero ${fresh?'ok':'stale'}"><div><small>P9.4 · BACKEND SMART ALERTS</small><strong>${fresh?'Processamento backend ativo':'Backend sem heartbeat recente'}</strong><span>${fresh?'A PWA pode permanecer fechada. Os alertas são processados no Supabase sempre que Gateway/Bridge enviam uma sincronização.':'Verifique se Gateway/Bridge continuam sincronizando.'}</span></div><span class="ba-heartbeat">${s.last_run_at?`heartbeat ${baTime(s.last_run_at)}`:'sem heartbeat'}</span></div><div class="ba-kpis"><span><small>Último ciclo</small><b>${Number(s.push_attempted||0)} tent.</b></span><span><small>Push OK</small><b>${Number(s.push_success||0)}</b></span><span><small>Falhas</small><b>${Number(s.push_failure||0)}</b></span><span><small>Último push</small><b>${s.last_push_at?baTime(s.last_push_at):'—'}</b></span></div><div class="ba-rules"><span><b>🔥 Chat Máfia</b><small>FIXADO/APITOU/APITADAÇO chegam pelo backend; divergência continua visível.</small></span><span><b>⏱️ Janelas</b><small>35' HT, fim HT, 2ºT, 80' e 85' são avaliados no ingest backend.</small></span><span><b>⚡ BetZord</b><small>Somente OVER 0.5 HT; UNKNOWN fica parcial até resolução explícita.</small></span><span><b>🔵🟢🏆 MatchIntel</b><small>OPORTUNIDADE/FORTE/ELITE usam gates P9.1 e dedupe persistente.</small></span></div><div class="ba-feed-title"><strong>Alertas backend recentes</strong><small>${feed.length}</small></div>${feed.length?`<div class="ba-feed">${feed.map(baFeedRow).join('')}</div>`:`<div class="ba-empty">Nenhum alerta backend foi disparado ainda. O motor está armado e o antispam persistente está ativo.</div>`}<p class="ba-note">P9.4 é independente da PWA aberta, mas ainda depende do Gateway/Cloud Bridge enviar sincronizações ao backend. Nenhuma chamada extra à API-Football é criada por esta camada.</p>`;
  }catch(e){root.innerHTML=`<div class="ba-empty">Backend Smart Alerts indisponível · ${baEsc(e.message)}</div>`}
}
window.addEventListener('DOMContentLoaded',()=>{baLoad();setInterval(baLoad,20000)});
