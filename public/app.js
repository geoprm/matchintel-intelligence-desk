
const SUPABASE_URL = "https://tkzfkkqcgmzqjfcokrws.supabase.co";
const SUPABASE_KEY = "sb_publishable_8l70j1YfLAOdNn2auEBYXA_tue5rP9T";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const state = { matches:[], signals:[], events:[], status:null, liveFilter:"all", signalFilter:"all", evidence:[] };

const $ = (s)=>document.querySelector(s);
const $$=(s)=>[...document.querySelectorAll(s)];
const esc=(s)=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const empty=(title,body)=>`<div class="empty"><div class="icon">◌</div><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
const fmtTime=(d)=>{try{return new Date(d).toLocaleString("pt-BR",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"})}catch{return "—"}};
const minuteLabel=(m,phase)=>m!=null?`${m}'`:(phase||"—");
const isLive=(m)=>["LIVE","1H","HT","2H","ET","P"].includes(String(m.state||m.phase||"").toUpperCase());

const P0_VERSION="p0-freshness-v1.2";
const PRIORITY_TTL_MS=5*60*1000;
const SIGNAL_TTL_MS=10*60*1000;
const LIVE_MATCH_TTL_MS=90*1000;
const FUTURE_TOLERANCE_MS=2*60*1000;
const gatewayFresh=()=>!!state.status?.last_sync_at && Date.now()-new Date(state.status.last_sync_at).getTime()<=90*1000;
const matchAgeMs=(m)=>{const t=m?.updated_at?new Date(m.updated_at).getTime():0;return Number.isFinite(t)&&t?Date.now()-t:Number.POSITIVE_INFINITY};
const isFreshLiveMatch=(m)=>gatewayFresh() && isLive(m) && matchAgeMs(m)>=-FUTURE_TOLERANCE_MS && matchAgeMs(m)<=LIVE_MATCH_TTL_MS;

async function q(table, params=""){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`,{headers});
  if(!r.ok) throw new Error(`${table}: HTTP ${r.status}`);
  return r.json();
}
async function loadAll(){
  try{
    const [matches,signals,events,status] = await Promise.all([
      q("matchintel_matches","select=*&order=updated_at.desc&limit=150"),
      q("matchintel_signals","select=*&order=created_at.desc&limit=200"),
      q("matchintel_events","select=*&order=detected_at.desc&limit=300"),
      q("matchintel_system_status","select=*&id=eq.main&limit=1")
    ]);
    state.matches=matches; state.signals=dedupeSignals(signals); state.events=events; state.status=status[0]||null;
    render();
    localStorage.setItem("matchintel-cache", JSON.stringify({matches,signals:state.signals,events,status:state.status,at:Date.now()}));
  }catch(err){
    console.error(err);
    const cache=JSON.parse(localStorage.getItem("matchintel-cache")||"null");
    if(cache){state.matches=cache.matches||[];state.signals=cache.signals||[];state.events=cache.events||[];state.status=cache.status||null;render();}
  }
}
function signalTime(s){
  const raw=s.occurred_at||s.created_at;
  const t=raw?new Date(raw).getTime():0;
  return Number.isFinite(t)?t:0;
}
function signalAgeMs(s){ const t=signalTime(s); return t?Date.now()-t:Number.POSITIVE_INFINITY; }
function signalExpiryMs(s){
  const explicit=s.expires_at?new Date(s.expires_at).getTime():0;
  if(Number.isFinite(explicit)&&explicit) return explicit;
  const t=signalTime(s); return t?t+SIGNAL_TTL_MS:0;
}
function isFreshSignal(s,maxAge=SIGNAL_TTL_MS){
  const age=signalAgeMs(s);
  if(age < -FUTURE_TOLERANCE_MS || age > maxAge) return false;
  const exp=signalExpiryMs(s);
  return !exp || exp>Date.now();
}
function isFreshPriority(s){
  return isFreshSignal(s,PRIORITY_TTL_MS) &&
    (s.pinned||/APITAD|PIN/i.test(`${s.state||""} ${s.signal_type||""}`));
}
function dedupeSignals(rows){
  const seen=new Map();
  for(const s of rows){
    const fam=(s.provider_family||"").toLowerCase().includes("betzord")?"betzord":(s.provider_family||s.provider_name||"").toLowerCase();
    const key=s.fingerprint || [
      s.source_event_id||"",s.match_key||"",fam,s.signal_type||"",s.market||"",
      s.text_summary||"",s.pinned?"1":"0"
    ].join("|").toLowerCase();
    const old=seen.get(key);
    if(!old || signalTime(s)>signalTime(old)) seen.set(key,s);
  }
  return [...seen.values()].sort((a,b)=>signalTime(b)-signalTime(a));
}
function renderStatus(){
  const s=state.status;
  const stale=!s?.last_sync_at || Date.now()-new Date(s.last_sync_at).getTime()>90000;
  const recentTelegram=state.signals.some(x=>["mafia","betzord"].includes(providerKind(x)) && isFreshSignal(x));
  const telegramOn=!!s?.telegram_connected || recentTelegram;
  $("#statusPills").innerHTML=[
    `<span class="pill ${s?.gateway_online&&!stale?"ok":"bad"}">Gateway ${s?.gateway_online&&!stale?"ON":"OFF"}</span>`,
    `<span class="pill ${telegramOn&&!stale?"ok":"warn"}">Telegram ${telegramOn&&!stale?"ON":"—"}</span>`,
    `<span class="pill ${s?.shadow_mode?"warn":"ok"}">${s?.shadow_mode?"SHADOW":"LIVE"}</span>`
  ].join("");
  if(!s?.last_sync_at) $("#lastSync").textContent="Sem sincronização";
  else if(stale) $("#lastSync").textContent=`Gateway sem sync · última ${fmtTime(s.last_sync_at)}`;
  else $("#lastSync").textContent=`Sync ${fmtTime(s.last_sync_at)}`;
}
function matchCard(m){
  const score=(m.home_score!=null&&m.away_score!=null)?`${m.home_score}–${m.away_score}`:"—";
  const prob=m.best_probability!=null?Math.round(Number(m.best_probability)):"—";
  return `<div class="match" data-match="${esc(m.match_key)}">
    <div class="minute">${esc(minuteLabel(m.minute,m.phase))}</div>
    <div class="teams"><strong>${esc(m.home)} × ${esc(m.away)}</strong><small>${esc(m.competition||m.radar_state||m.state||"")}</small></div>
    <div class="score">${score}</div>
    <div class="market">${esc(m.best_market||m.radar_state||"")}<b>${prob}${prob!=="—"?"%":""}</b></div>
  </div>`;
}
function renderHome(){
  const activeSignals=state.signals.filter(s=>isFreshSignal(s));
  const priorities=activeSignals.filter(isFreshPriority).slice(0,4);
  $("#priorityList").innerHTML=priorities.length?priorities.map(signalCard).join(""):empty("Sem prioridade crítica","Nenhum PINNED/JOGO APITADO fresco recebido nos últimos 5 minutos.");
  const live=state.matches.filter(isFreshLiveMatch).slice(0,6);
  $("#homeLive").innerHTML=live.length?live.map(matchCard).join(""):empty(
    gatewayFresh()?"Nenhum jogo ao vivo no relay":"Gateway sem atualização",
    gatewayFresh()?"Quando o Gateway encontrar partidas reais, elas aparecem aqui.":"Partidas antigas ficam bloqueadas até uma nova sincronização."
  );
  $("#liveCount").textContent=`${live.length} jogo${live.length===1?"":"s"}`;

  const freshMatches=state.matches.filter(m=>!isLive(m) || isFreshLiveMatch(m));
  const metrics=[
    ["Late Goal", freshMatches.filter(m=>/late/i.test(`${m.best_market} ${m.radar_state}`)).length],
    ["Corner", freshMatches.filter(m=>/corner|escante/i.test(`${m.best_market} ${m.radar_state}`)).length],
    ["Instant", freshMatches.filter(m=>/instant|next|próxim/i.test(`${m.best_market} ${m.radar_state}`)).length],
    ["HT / Goal HT", freshMatches.filter(m=>/ht|1h/i.test(`${m.best_market} ${m.phase} ${m.radar_state}`)).length],
    ["2º Tempo", freshMatches.filter(m=>/2h|2º|segundo/i.test(`${m.best_market} ${m.phase} ${m.radar_state}`)).length],
    ["Chaos / Ruptura", freshMatches.filter(m=>/chaos|ruptur|nuclear/i.test(`${m.radar_state} ${m.best_market}`)).length],
  ];
  $("#radarCards").innerHTML=metrics.map(([label,n])=>`<div class="card kpi"><div class="label">${esc(label)}</div><div class="value">${n}</div><div class="sub">sessões elegíveis</div></div>`).join("");
  $("#homeSignals").innerHTML=activeSignals.length?activeSignals.slice(0,5).map(signalCard).join(""):empty("Sem sinais ativos","Sinais com mais de 10 minutos não aparecem como atuais.");
}
function filterMatch(m,f){
  if(!isFreshLiveMatch(m)) return false;
  const t=`${m.best_market||""} ${m.radar_state||""} ${m.phase||""}`.toLowerCase();
  if(f==="all") return true;
  if(f==="goal") return /gol|goal/.test(t);
  if(f==="corner") return /corner|escante/.test(t);
  if(f==="instant") return /instant|next|próxim/.test(t);
  if(f==="HT") return /ht|1h/.test(t);
  if(f==="2H") return /2h|2º|segundo/.test(t);
  if(f==="late") return /late|84|85|83|75|80/.test(t);
  return true;
}
function renderLive(){
  const rows=state.matches.filter(m=>filterMatch(m,state.liveFilter));
  $("#liveList").innerHTML=rows.length?rows.map(matchCard).join(""):empty(
    gatewayFresh()?"Nenhum jogo neste filtro":"Gateway sem atualização",
    gatewayFresh()?"O filtro mostra somente partidas reais e frescas.":"Nenhuma partida antiga é tratada como ao vivo."
  );
}
function providerKind(s){const x=`${s.provider_family} ${s.provider_name}`.toLowerCase();return x.includes("betzord")?"betzord":x.includes("máfia")||x.includes("mafia")?"mafia":"other"}
function signalCard(s){
  const bz=providerKind(s)==="betzord";
  const age=Math.max(0,signalAgeMs(s));
  const ageLabel=age<60*1000?"agora":`${Math.floor(age/60000)} min`;
  const badges=[
    s.pinned?`<span class="badge pin">PINNED</span>`:"",
    /APITAD/i.test(`${s.signal_type} ${s.state}`)?`<span class="badge pin">${esc(s.signal_type||s.state)}</span>`:"",
    /MATCHINTEL/i.test(`${s.signal_type} ${s.state}`)?`<span class="badge shadow">Shadow / em calibração</span>`:""
  ].join("");
  return `<div class="signal">
    <div class="avatar ${bz?"bz":""}">${bz?"BZ":"CM"}</div>
    <div class="signal-main"><strong>${esc(s.provider_name||s.provider_family)} ${badges}</strong><p>${esc(s.text_summary||s.market||s.signal_type)}</p><small>${esc(s.market||"")} · ${ageLabel}</small></div>
  </div>`;
}
function renderSignals(){
  let rows=state.signals.filter(s=>isFreshSignal(s));
  if(state.signalFilter!=="all") rows=rows.filter(s=>providerKind(s)===state.signalFilter);
  $("#signalCount").textContent=String(rows.length);
  $("#signalList").innerHTML=rows.length?rows.map(signalCard).join(""):empty("Sem sinais ativos","Sinais expirados ficam fora do painel operacional.");
  const s=state.status;
  const sources=[
    ["API-Football",s?.api_provider?.toLowerCase().includes("football")||s?.auto_scan_active,"fixtures, placar e estatísticas via Gateway"],
    ["Telegram",!!s?.telegram_connected&&!(!s?.last_sync_at||Date.now()-new Date(s.last_sync_at).getTime()>90000),"Chat Máfia / BetZord via conta local"],
    ["Source Matrix",(s?.independent_sources||0)>0,`${s?.independent_sources||0} fonte(s) independente(s) no status global`],
    ["Bet365",false,"link original do Chat Máfia / view manual"],
    ["SofaScore / Flashscore",false,"planejadas/manual quando não houver adapter ativo"]
  ];
  $("#sourceList").innerHTML=sources.map(([name,on,sub])=>`<div class="source"><span class="dot" style="${on?"":"background:#566663"}"></span><div class="main"><strong>${name}</strong><small>${esc(sub)}</small></div><span class="pill ${on?"ok":""}">${on?"Ativa":"Manual"}</span></div>`).join("");
}
function renderHistory(){
  const rows=state.matches.slice().sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)).slice(0,60);
  $("#historyList").innerHTML=rows.length?rows.map(matchCard).join(""):empty("Histórico vazio","As sessões reais acompanhadas pelo Gateway serão registradas aqui.");
}
function render(){
  renderStatus();renderHome();renderLive();renderSignals();renderHistory();bindMatchClicks();
}
function bindMatchClicks(){
  $$("[data-match]").forEach(el=>el.onclick=()=>openMatch(el.dataset.match));
}
function openMatch(key){
  const m=state.matches.find(x=>x.match_key===key); if(!m)return;
  const ev=state.events.filter(e=>e.match_key===key).slice(0,60);
  const sig=state.signals.filter(s=>s.match_key===key).slice(0,30);
  const stats=m.stats||{}, risks=Array.isArray(m.risks)?m.risks:[];
  const prob=m.best_probability!=null?Math.round(Number(m.best_probability)):null;
  const statPairs=[
    ["Corners",stats.corners??stats.corner??"—"],["Chutes",stats.shots??stats.total_shots??"—"],
    ["No alvo",stats.shots_on_goal??stats.sot??"—"],["Vermelhos",stats.red_cards??stats.redCards??"—"]
  ];
  $("#matchDetail").innerHTML=`
    <div class="card priority">
      <div class="teams"><strong style="font-size:17px">${esc(m.home)} × ${esc(m.away)}</strong><small>${esc(m.competition||"")}</small></div>
      <div style="display:flex;justify-content:space-between;align-items:end;margin-top:12px">
        <div><span class="pill ok">${esc(minuteLabel(m.minute,m.phase))}</span> <span class="pill">${esc(m.radar_state||m.state||"")}</span></div>
        <div class="score">${m.home_score??"—"} – ${m.away_score??"—"}</div>
      </div>
    </div>
    <div class="section-title"><h2>Melhor leitura</h2><span>Probabilidade ≠ oportunidade</span></div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:12px"><div><strong>${esc(m.best_market||"Sem mercado elegível")}</strong><p class="note">${esc(m.best_explanation||"Sem explicação recebida do motor.")}</p></div><div style="font-size:27px;font-weight:800">${prob==null?"—":prob+"%"}</div></div>
      <span class="pill ${/elite|forte/i.test(m.best_level||"")?"ok":"warn"}">${esc(m.best_level||"Neutro")}</span>
      ${state.status?.shadow_mode?`<span class="badge shadow">Shadow / em calibração</span>`:""}
    </div>
    <div class="section-title"><h2>Qualidade dos dados</h2><span>não é chance de acerto</span></div>
    <div class="card"><div style="display:flex;justify-content:space-between"><strong>${m.data_quality||0}%</strong><span class="note">${m.independent_sources||0} fonte(s) · ${m.conflicts||0} conflito(s)</span></div><div class="progress" style="margin-top:9px"><i style="width:${Math.max(0,Math.min(100,m.data_quality||0))}%"></i></div><p class="note">${esc(m.source_matrix_state||"Source Matrix sem estado informado.")}</p></div>
    <div class="section-title"><h2>Estatísticas presentes</h2><span>somente campos recebidos</span></div>
    <div class="stats">${statPairs.map(([a,b])=>`<div class="stat"><b>${esc(b)}</b><small>${a}</small></div>`).join("")}</div>
    <div class="section-title"><h2>Por quê / Riscos</h2><span>guardrails</span></div>
    <div class="card"><p class="note">${esc(m.best_explanation||"Sem justificativa adicional.")}</p>${risks.length?`<ul class="note warning">${risks.map(r=>`<li>${esc(typeof r==="string"?r:JSON.stringify(r))}</li>`).join("")}</ul>`:`<p class="note">Nenhum risco estruturado foi enviado.</p>`}</div>
    <div class="section-title"><h2>Timeline</h2><span>${ev.length} eventos</span></div>
    <div class="card timeline">${ev.length?ev.map(e=>`<div class="event"><b>${esc(e.event_type)}</b>${e.side?` · ${esc(e.side)}`:""}<small>${e.observed_minute!=null?`${e.observed_minute}' observado`:`Detectado em ${fmtTime(e.detected_at)}`}</small></div>`).join(""):`<p class="note">Sem eventos registrados.</p>`}</div>
    <div class="section-title"><h2>Sinais ligados</h2><span>${sig.length}</span></div>
    <div class="card">${sig.length?sig.map(signalCard).join(""):empty("Sem sinais ligados","Esta sessão pode ter sido descoberta pelo scanner autônomo.")}</div>`;
  $("#matchModal").classList.remove("hidden");
}
function nav(screen){
  $$(".screen").forEach(x=>x.classList.toggle("active",x.id===screen));
  $$(".navbtn").forEach(x=>x.classList.toggle("active",x.dataset.screen===screen));
  window.scrollTo({top:0,behavior:"smooth"});
}
$$(".navbtn").forEach(b=>b.onclick=()=>nav(b.dataset.screen));
$("#plusBtn").onclick=()=>$("#actionModal").classList.remove("hidden");
$$("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).classList.add("hidden"));
$("#refreshNow").onclick=()=>{loadAll();$("#actionModal").classList.add("hidden")};
$("#openEvidence").onclick=()=>{$("#actionModal").classList.add("hidden");$("#evidenceModal").classList.remove("hidden")};
$$("[data-go-filter]").forEach(b=>b.onclick=()=>{state.liveFilter=b.dataset.goFilter;$("#actionModal").classList.add("hidden");nav("live");$$("#liveFilters button").forEach(x=>x.classList.toggle("active",x.dataset.filter===state.liveFilter));renderLive();bindMatchClicks()});
$$("#liveFilters button").forEach(b=>b.onclick=()=>{state.liveFilter=b.dataset.filter;$$("#liveFilters button").forEach(x=>x.classList.toggle("active",x===b));renderLive();bindMatchClicks()});
$$("#signalFilters button").forEach(b=>b.onclick=()=>{state.signalFilter=b.dataset.provider;$$("#signalFilters button").forEach(x=>x.classList.toggle("active",x===b));renderSignals()});

function loadEvidence(){
  try{state.evidence=JSON.parse(localStorage.getItem("matchintel-evidence")||"[]")}catch{state.evidence=[]}
  renderEvidence();
}
function renderEvidence(){
  $("#evidenceCount").textContent=`${state.evidence.length} adicionados`;
  $("#evidenceGallery").innerHTML=state.evidence.map((x,i)=>`<div class="thumb"><img src="${x.data}" alt="evidência ${i+1}"><button data-del-e="${i}">×</button></div>`).join("");
  $$("[data-del-e]").forEach(b=>b.onclick=()=>{state.evidence.splice(Number(b.dataset.delE),1);localStorage.setItem("matchintel-evidence",JSON.stringify(state.evidence));renderEvidence()});
}
$("#evidenceInput").onchange=async(e)=>{
  const files=[...e.target.files].slice(0,10-state.evidence.length);
  for(const f of files){
    if(f.size>2_500_000) continue;
    const data=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f)});
    state.evidence.push({name:f.name,data,at:Date.now()});
  }
  localStorage.setItem("matchintel-evidence",JSON.stringify(state.evidence));renderEvidence();e.target.value="";
};

window.addEventListener("online",()=>$("#offlineBanner").classList.add("hidden"));
window.addEventListener("offline",()=>$("#offlineBanner").classList.remove("hidden"));
if(!navigator.onLine)$("#offlineBanner").classList.remove("hidden");

let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#installBtn").classList.remove("hidden")});
$("#installBtn").onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("#installBtn").classList.add("hidden")}};

if(localStorage.getItem("matchintel-p0-version")!==P0_VERSION){
  localStorage.removeItem("matchintel-cache");
  localStorage.setItem("matchintel-p0-version",P0_VERSION);
}
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).then(r=>r.update()).catch(console.error);
}
loadEvidence();loadAll();setInterval(loadAll,20000);
