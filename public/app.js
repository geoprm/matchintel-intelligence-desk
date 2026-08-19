
const SUPABASE_URL = "https://tkzfkkqcgmzqjfcokrws.supabase.co";
const SUPABASE_KEY = "sb_publishable_8l70j1YfLAOdNn2auEBYXA_tue5rP9T";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
window.MATCHINTEL_CONFIG={SUPABASE_URL,SUPABASE_KEY};
const state = { matches:[], signals:[], events:[], status:null, lifecycleSummary:{}, liveFilter:"all", signalFilter:"all", evidence:[], preliveVisible:8 };
/* P6_2_ACTIVE_MATCH_LIFECYCLE */

const $ = (s)=>document.querySelector(s);
const $$=(s)=>[...document.querySelectorAll(s)];
const esc=(s)=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const empty=(title,body)=>`<div class="empty"><div class="icon">◌</div><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
const fmtTime=(d)=>{try{return new Date(d).toLocaleString("pt-BR",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"})}catch{return "—"}};
const minuteLabel=(m,phase)=>m!=null?`${m}'`:(phase||"—");
const isLive=(m)=>["LIVE","1H","HT","2H","ET","P"].includes(String(m.state||m.phase||"").toUpperCase());
const isPrelive=(m)=>{
  const s=String(m.state||m.phase||"").toUpperCase();
  return ["PRELIVE","PRE","NS","TBD","SCHEDULED","WATCH","UPCOMING"].includes(s) || (!!scheduledAt(m) && !isLive(m) && !/[FCA]T|FINISHED|CANC|ABD|PST/i.test(s));
};
const scheduledAt=(m)=>m?.stats?._matchintel?.scheduledAt||m?.stats?.scheduled_at||m?.stats?.fixture?.date||null;
const scheduledLabel=(m)=>{const d=scheduledAt(m);if(!d)return m.phase||m.state||"Pré-live";try{return new Date(d).toLocaleString("pt-BR",{hour:"2-digit",minute:"2-digit"})}catch{return "Pré-live"}};
/* P4A3_FEATURED_PRELIVE */
function isFinishedMatch(m){
  const s=`${m?.state||""} ${m?.phase||""}`.toUpperCase();
  return /FINISHED|\bFT\b|\bAET\b|\bPEN\b/.test(s);
}
function preliveScore(m){
  const level=String(m?.best_level||"").toLowerCase();
  const levelBoost=/elite/.test(level)?30:/forte/.test(level)?22:/monitorar/.test(level)?10:0;
  const prob=Number.isFinite(Number(m?.best_probability))?Math.max(0,Math.min(100,Number(m.best_probability))):0;
  const dq=Number.isFinite(Number(m?.data_quality))?Math.max(0,Math.min(100,Number(m.data_quality))):0;
  const pri=Number.isFinite(Number(m?.priority))?Math.max(0,Math.min(100,Number(m.priority))):0;
  const src=Math.max(0,Math.min(3,Number(m?.independent_sources||0)))*10;
  const signalBoost=state.signals.some(s=>s.match_key===m.match_key&&isFreshSignal(s))?15:0;
  return levelBoost+prob*.25+dq*.25+pri*.15+src+signalBoost;
}
function isFeaturedPrelive(m){
  if(!isPrelive(m))return false;
  const level=String(m?.best_level||"").toLowerCase();
  const p=Number(m?.best_probability),dq=Number(m?.data_quality),src=Number(m?.independent_sources||0);
  return /elite|forte/.test(level)||(Number.isFinite(p)&&Number.isFinite(dq)&&p>=68&&dq>=60)||src>=2||preliveScore(m)>=65;
}
function preliveSort(a,b){
  const af=isFeaturedPrelive(a)?1:0,bf=isFeaturedPrelive(b)?1:0;
  if(af!==bf)return bf-af;
  const sd=preliveScore(b)-preliveScore(a);if(Math.abs(sd)>.01)return sd;
  return new Date(scheduledAt(a)||"2999-01-01")-new Date(scheduledAt(b)||"2999-01-01");
}
function preliveOperationalLabel(m){return isFeaturedPrelive(m)?"DESTAQUE":"RASTREANDO"}
function statValue(m,v){
  if(isPrelive(m)||v==null)return "—";
  if(Array.isArray(v)){
    if(!v.length||v.every(x=>x==null))return "—";
    return v.map(x=>x==null?"—":String(x)).join("–");
  }
  if(typeof v==="object"){
    const h=v.home??v[0],a=v.away??v[1];
    if(h==null&&a==null)return "—";
    return `${h??"—"}–${a??"—"}`;
  }
  return String(v);
}
function qualityLabel(m){return m?.data_quality==null?"—":`${Number(m.data_quality)}%`}
function qualityWidth(m){return m?.data_quality==null?0:Math.max(0,Math.min(100,Number(m.data_quality)||0))}
/* P8_1_MATCH_SEMANTIC_SAFETY */
function lifecycleState(m){return String(m?.lifecycle_state||'').toUpperCase()}
function lifecycleFinished(m){return ['FINALIZADO','HISTORICO'].includes(lifecycleState(m))||isFinishedMatch(m)}
function lifecycleExpired(m){return lifecycleState(m)==='EXPIRADO'}
function semanticStatusLabel(m){if(lifecycleFinished(m))return `FINALIZADO · ${String(m?.phase||'FT').toUpperCase()}`;if(lifecycleExpired(m))return 'EXPIRADO';if(isPrelive(m))return preliveOperationalLabel(m);return m?.radar_state||m?.state||'ATIVO'}
function qualifiedProbability(m){const p=Number(m?.best_probability),dq=Number(m?.data_quality||0),src=Number(m?.independent_sources||0),conf=Number(m?.conflicts||0);if(lifecycleFinished(m)||lifecycleExpired(m))return null;if(!Number.isFinite(p)||dq<50||src<1||conf>0||!m?.best_market)return null;return Math.max(0,Math.min(100,p))}
function rawProbabilityNote(m){const p=Number(m?.best_probability);if(!Number.isFinite(p))return '';const market=m?.best_market?` · ${esc(m.best_market)}`:'';const reason=lifecycleFinished(m)?'histórica':lifecycleExpired(m)?'expirada':'não qualificada';return `<p class="note raw-estimate">Estimativa bruta ${reason}: <strong>${Math.round(p)}%</strong>${market} · NÃO AUDITÁVEL / NÃO PROMOVIDA</p>`}
function qualifiedBestLevel(m){return qualifiedProbability(m)==null?'Não qualificada':(m?.best_level||'Neutro')}


const P0_VERSION="p0-freshness-v1.2";
const P1_VERSION="p1-push-v1.0.1";
const P2_VERSION="p2-autonomous-radar-v1.0";
const VAPID_PUBLIC_KEY="BGaSDtAPm1iwLkjlsti4WsrCW5xIlp_Nc5dgNniZv2UMyL6qxgKBJlNi-cJBShyZRhfWc-DIFdU32Oj-RGH61Qw";
const PUSH_SUBSCRIBE_URL="https://tkzfkkqcgmzqjfcokrws.supabase.co/functions/v1/matchintel-push-subscribe";
const PUSH_TEST_URL="https://tkzfkkqcgmzqjfcokrws.supabase.co/functions/v1/matchintel-push-test";
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
    const [activeMatches,historyMatches,lifecycleRows,signals,events,status] = await Promise.all([
      q("matchintel_match_lifecycle","select=*&lifecycle_state=eq.ATIVO&order=updated_at.desc&limit=1000"),
      q("matchintel_match_lifecycle","select=*&lifecycle_state=in.(FINALIZADO,HISTORICO)&order=updated_at.desc&limit=160"),
      q("matchintel_match_lifecycle_summary","select=*"),
      q("matchintel_signals","select=*&order=created_at.desc&limit=200"),
      q("matchintel_events","select=*&order=detected_at.desc&limit=300"),
      q("matchintel_system_status","select=*&id=eq.main&limit=1")
    ]);
    const _seenMatches=new Set();
    const matches=[...activeMatches,...historyMatches].filter(m=>{const k=m.match_key||m.provider_match_id||JSON.stringify([m.home,m.away,m.updated_at]);if(_seenMatches.has(k))return false;_seenMatches.add(k);return true});
    state.lifecycleSummary=Object.fromEntries((lifecycleRows||[]).map(x=>[x.lifecycle_state,Number(x.match_count||0)]));
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
  const pre=isPrelive(m),featured=pre&&isFeaturedPrelive(m);
  const score=pre?"—":((m.home_score!=null&&m.away_score!=null)?`${m.home_score}–${m.away_score}`:"—");
  const prob=m.best_probability!=null?Math.round(Number(m.best_probability)):"—";
  const clock=pre?scheduledLabel(m):minuteLabel(m.minute,m.phase);
  const marketLabel=m.best_market||(pre?preliveOperationalLabel(m):(m.radar_state||""));
  return `<div class="match ${featured?"featured":""}" data-match="${esc(m.match_key)}">
    <div class="minute">${esc(clock)}</div>
    <div class="teams"><strong>${esc(m.home)} × ${esc(m.away)} ${featured?'<span class="featured-badge">DESTAQUE</span>':""}</strong><small>${esc(m.competition||m.radar_state||m.state||"")}</small></div>
    <div class="score">${score}</div>
    <div class="market">${esc(marketLabel)}<b>${prob}${prob!=="—"?"%":""}</b></div>
  </div>`;
}
/* P4A3_MATCHCARD_END */
function renderHome(){
  const activeSignals=state.signals.filter(s=>isFreshSignal(s));
  const priorities=activeSignals.filter(isFreshPriority).slice(0,4);
  $("#priorityList").innerHTML=priorities.length?priorities.map(signalCard).join(""):empty("Sem prioridade crítica","Nenhum PINNED/JOGO APITADO fresco recebido nos últimos 5 minutos.");

  const preliveAll=state.matches.filter(isPrelive).sort(preliveSort);
  const prelive=preliveAll.slice(0,Math.max(8,state.preliveVisible||8));
  const featuredCount=preliveAll.filter(isFeaturedPrelive).length;
  const remaining=Math.max(0,preliveAll.length-prelive.length);
  const preEl=$("#homePrelive");
  if(preEl) preEl.innerHTML=prelive.length?prelive.map(matchCard).join("")+(remaining?`<button class="prelive-more" id="preliveMoreBtn">Ver mais · ${Math.min(8,remaining)} de ${remaining}</button>`:""):empty("Radar pré-live aguardando partidas","O MatchIntel deve receber a agenda do Gateway mesmo sem sinais do Telegram.");
  const preCount=$("#preliveCount"); if(preCount) preCount.textContent=featuredCount?`${featuredCount} em destaque · ${preliveAll.length} monitorados`:`${preliveAll.length} monitorados`;

  const live=state.matches.filter(isFreshLiveMatch).slice(0,8);
  $("#homeLive").innerHTML=live.length?live.map(matchCard).join(""):empty(
    gatewayFresh()?"Nenhum jogo ao vivo no relay":"Gateway sem atualização",
    gatewayFresh()?"O radar autônomo continuará procurando partidas independentemente do Telegram.":"Partidas antigas ficam bloqueadas até uma nova sincronização."
  );
  $("#liveCount").textContent=`${live.length} jogo${live.length===1?"":"s"}`;

  const operational=[...preliveAll,...live];
  const metrics=[
    ["Pré-live", preliveAll.length],
    ["Late Goal", operational.filter(m=>/late/i.test(`${m.best_market} ${m.radar_state}`)).length],
    ["Corner", operational.filter(m=>/corner|escante/i.test(`${m.best_market} ${m.radar_state}`)).length],
    ["Instant", operational.filter(m=>/instant|next|próxim/i.test(`${m.best_market} ${m.radar_state}`)).length],
    ["HT / Goal HT", operational.filter(m=>/ht|1h/i.test(`${m.best_market} ${m.phase} ${m.radar_state}`)).length],
    ["2º Tempo", operational.filter(m=>/2h|2º|segundo/i.test(`${m.best_market} ${m.phase} ${m.radar_state}`)).length],
  ];
  $("#radarCards").innerHTML=metrics.map(([label,n])=>`<div class="card kpi"><div class="label">${esc(label)}</div><div class="value">${n}</div><div class="sub">sessões elegíveis</div></div>`).join("");
  $("#homeSignals").innerHTML=activeSignals.length?activeSignals.slice(0,5).map(signalCard).join(""):empty("Sem sinais ativos","Telegram é evidência adicional; o radar esportivo continua funcionando sozinho.");
  const moreBtn=$("#preliveMoreBtn");
  if(moreBtn)moreBtn.onclick=()=>{state.preliveVisible=Math.min(preliveAll.length,(state.preliveVisible||8)+8);renderHome();bindMatchClicks()};
}
function filterMatch(m,f){
  if(f==="prelive") return isPrelive(m);
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
  const rows=state.matches.filter(m=>filterMatch(m,state.liveFilter)).sort((a,b)=>{
    if(state.liveFilter==="prelive") return preliveSort(a,b);
    return Number(b.priority||0)-Number(a.priority||0);
  });
  $("#liveList").innerHTML=rows.length?rows.map(matchCard).join(""):empty(
    state.liveFilter==="prelive"?"Nenhuma partida pré-live recebida":(gatewayFresh()?"Nenhum jogo neste filtro":"Gateway sem atualização"),
    state.liveFilter==="prelive"?"O Bridge P2 procura Match Sessions e agenda em múltiplas rotas locais do Gateway.":(gatewayFresh()?"O filtro mostra somente partidas reais e frescas.":"Nenhuma partida antiga é tratada como ao vivo.")
  );
}
function providerKind(s){const x=`${s.provider_family} ${s.provider_name}`.toLowerCase();return x.includes("betzord")?"betzord":x.includes("máfia")||x.includes("mafia")?"mafia":"other"}
function safeBookmakerUrl(s){
  const raw=String(s?.bookmaker_url||"").trim();
  if(!raw) return "";
  try{
    const u=new URL(raw);
    if(u.protocol!=="https:") return "";
    const h=u.hostname.toLowerCase();
    const kind=providerKind(s);
    if(kind==="mafia"){
      const ok=h==="bet365.bet.br"||h.endsWith(".bet365.bet.br")||h==="bet365.com"||h.endsWith(".bet365.com");
      return ok?u.href:"";
    }
    if(kind==="betzord"){
      const ok=h==="betano.bet.br"||h.endsWith(".betano.bet.br")||h==="betanobr.com"||h.endsWith(".betanobr.com");
      return ok?u.href:"";
    }
    return "";
  }catch{return ""}
}
function signalCard(s){
  const bz=providerKind(s)==="betzord";
  const age=Math.max(0,signalAgeMs(s));
  const ageLabel=age<60*1000?"agora":`${Math.floor(age/60000)} min`;
  const bookUrl=safeBookmakerUrl(s);
  const bookLabel=bz?"Abrir Betano":"Abrir Bet365";
  const badges=[
    s.pinned?`<span class="badge pin">PINNED</span>`:"",
    /APITAD/i.test(`${s.signal_type} ${s.state}`)?`<span class="badge pin">${esc(s.signal_type||s.state)}</span>`:"",
    /MATCHINTEL/i.test(`${s.signal_type} ${s.state}`)?`<span class="badge shadow">Shadow / em calibração</span>`:""
  ].join("");
  return `<div class="signal">
    <div class="avatar ${bz?"bz":""}">${bz?"BZ":"CM"}</div>
    <div class="signal-main">
      <strong>${esc(s.provider_name||s.provider_family)} ${badges}</strong>
      <p>${esc(s.text_summary||s.market||s.signal_type)}</p>
      <small>${esc(s.market||"")} · ${ageLabel}</small>
      ${bookUrl?`<div class="signal-actions"><a class="bookmaker-link" href="${esc(bookUrl)}" target="_blank" rel="noopener noreferrer">${bookLabel} ↗</a></div>`:""}
    </div>
  </div>`;
}
function renderSignals(){
  let rows=state.signals.filter(s=>isFreshSignal(s));
  if(state.signalFilter!=="all") rows=rows.filter(s=>providerKind(s)===state.signalFilter);
  $("#signalCount").textContent=String(rows.length);
  $("#signalList").innerHTML=rows.length?rows.map(signalCard).join(""):empty("Sem sinais ativos","Sinais expirados ficam fora do painel operacional.");
  const s=state.status;
  const fresh=gatewayFresh();
  const apiConfigured=!!(s?.api_provider?.toLowerCase().includes("football")||s?.auto_scan_active);
  const oddsConfigured=/the odds api/i.test(String(s?.api_provider||""));
  const tgConfigured=!!s?.telegram_connected;
  const matrixCount=Number(s?.independent_sources||0);
  const sources=[
    {name:"API-Football",on:fresh&&apiConfigured,status:fresh&&apiConfigured?"Ativa":apiConfigured?"Aguardando Gateway":"Manual",sub:fresh?"fixtures, placar e estatísticas via Gateway":"Gateway offline; dados automáticos pausados"},
    {name:"The Odds API",on:fresh&&oddsConfigured,status:fresh&&oddsConfigured?"Ativa":oddsConfigured?"Aguardando Gateway":"Aguardando chave",sub:oddsConfigured?"segunda família esportiva + consenso de odds; não conta Telegram":"feed externo opcional para P4B/P4C"},
    {name:"Telegram",on:fresh&&tgConfigured,status:fresh&&tgConfigured?"Conectado":tgConfigured?"Aguardando Gateway":"Manual",sub:fresh&&tgConfigured?"Chat Máfia / BetZord via conta local":"A conexão Telegram depende do Gateway local ligado"},
    {name:"Source Matrix",on:fresh&&matrixCount>0,status:fresh?(matrixCount>0?"Ativa":"Sem consenso"):"Aguardando Gateway",sub:`${matrixCount} fonte(s) independente(s) no status global`},
    {name:"Bet365",on:false,status:"Manual",sub:"link original do Chat Máfia / view manual"},
    {name:"SofaScore / Flashscore",on:false,status:"Planejada",sub:"planejadas/manual quando não houver adapter ativo"}
  ];
  $("#sourceList").innerHTML=sources.map(x=>`<div class="source"><span class="dot" style="${x.on?"":"background:#566663"}"></span><div class="main"><strong>${x.name}</strong><small>${esc(x.sub)}</small></div><span class="pill ${x.on?"ok":x.status==="Aguardando Gateway"?"warn":""}">${esc(x.status)}</span></div>`).join("");
}
function renderHistory(){
  const rows=state.matches.filter(isFinishedMatch).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)).slice(0,60);
  $("#historyList").innerHTML=rows.length?rows.map(matchCard).join(""):empty("Histórico vazio","Somente partidas encerradas e realmente acompanhadas aparecem aqui.");
}
function render(){
  renderStatus();renderHome();renderLive();renderSignals();renderHistory();bindMatchClicks();
}
function bindMatchClicks(){
  $$("[data-match]").forEach(el=>el.onclick=()=>openMatch(el.dataset.match));
}
/* P4BC_MARKET_UI */
function marketIntelBlock(m){
  const mi=m?.stats?._matchintel?.marketIntel||null;if(!mi)return "";
  const over=mi?.totals25?.outcomes?.OVER||null,home=mi?.h2h?.outcomes?.HOME||null,draw=mi?.h2h?.outcomes?.DRAW||null,away=mi?.h2h?.outcomes?.AWAY||null;
  const f=v=>v==null||!Number.isFinite(Number(v))?"—":Number(v).toFixed(2);
  const p=v=>v==null||!Number.isFinite(Number(v))?"—":Number(v).toFixed(1)+"%";
  const when=mi.fetchedAt?fmtTime(mi.fetchedAt):"—";
  return `<div class="section-title"><h2>Mercado observado</h2><span>The Odds API · ${esc(when)}</span></div>
    <div class="card market-value-card">
      <div class="market-value-grid">
        <div><small>Over 2.5 · melhor odd</small><b>${f(over?.bestOdds)}</b><span>consenso justo ${p(over?.fairProbability)}</span></div>
        <div><small>Casa · 1X2</small><b>${f(home?.bestOdds)}</b><span>justo ${p(home?.fairProbability)}</span></div>
        <div><small>Empate · 1X2</small><b>${f(draw?.bestOdds)}</b><span>justo ${p(draw?.fairProbability)}</span></div>
        <div><small>Fora · 1X2</small><b>${f(away?.bestOdds)}</b><span>justo ${p(away?.fairProbability)}</span></div>
      </div>
      <p class="note">Odds observadas são separadas da probabilidade MatchIntel e podem vir de bookmakers internacionais suportados pelo feed; não significam Betano/Bet365 Brasil.</p>
    </div>`;
}
function openMatch(key){
  const m=state.matches.find(x=>x.match_key===key); if(!m)return;
  const ev=state.events.filter(e=>e.match_key===key).slice(0,60);
  const sig=state.signals.filter(s=>s.match_key===key).slice(0,30);
  const stats=m.stats||{}, risks=Array.isArray(m.risks)?m.risks:[];
  const prob=qualifiedProbability(m);
  const rawProbNote=rawProbabilityNote(m);
  const statPairs=[
    ["Corners",statValue(m,stats.corners??stats.corner)],["Chutes",statValue(m,stats.shots??stats.total_shots)],
    ["No alvo",statValue(m,stats.shots_on_goal??stats.sot)],["Vermelhos",statValue(m,stats.red_cards??stats.redCards)]
  ];
  $("#matchDetail").innerHTML=`
    <div class="card priority">
      <div class="teams"><strong style="font-size:17px">${esc(m.home)} × ${esc(m.away)}</strong><small>${esc(m.competition||"")}</small></div>
      <div style="display:flex;justify-content:space-between;align-items:end;margin-top:12px">
        <div><span class="pill ok">${esc(isPrelive(m)&&!lifecycleFinished(m)?scheduledLabel(m):minuteLabel(m.minute,m.phase))}</span> <span class="pill">${esc(semanticStatusLabel(m))}</span></div>
        <div class="score">${isPrelive(m)?"—":`${m.home_score??"—"} – ${m.away_score??"—"}`}</div>
      </div>
    </div>
    <div class="section-title"><h2>Melhor leitura</h2><span>Probabilidade ≠ oportunidade</span></div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:12px"><div><strong>${esc(prob==null?(lifecycleFinished(m)?"Leitura histórica não auditável":"Sem leitura qualificada"):(m.best_market||"Sem mercado elegível"))}</strong><p class="note">${esc(prob==null?"A estimativa bruta foi preservada, mas não atende aos guardrails para promoção.":(m.best_explanation||"Sem explicação recebida do motor."))}</p>${rawProbNote}</div><div class="${prob==null?"prob-unqualified":""}" style="font-size:27px;font-weight:800">${prob==null?"—":Math.round(prob)+"%"}</div></div>
      <span class="pill ${prob!=null&&/elite|forte/i.test(m.best_level||"")?"ok":"warn"}">${esc(qualifiedBestLevel(m))}</span>
      ${state.status?.shadow_mode?`<span class="badge shadow">Shadow / em calibração</span>`:""}
    </div>
    <div class="section-title"><h2>Qualidade dos dados</h2><span>não é chance de acerto</span></div>
    <div class="card"><div style="display:flex;justify-content:space-between"><strong>${qualityLabel(m)}</strong><span class="note">${m.independent_sources||0} fonte(s) · ${m.conflicts||0} conflito(s)</span></div><div class="progress" style="margin-top:9px"><i style="width:${qualityWidth(m)}%"></i></div><p class="note">${esc(m.source_matrix_state||"Source Matrix sem estado informado.")}</p></div>
    <div class="section-title"><h2>Estatísticas presentes</h2><span>somente campos recebidos</span></div>
    <div class="stats">${statPairs.map(([a,b])=>`<div class="stat"><b>${esc(b)}</b><small>${a}</small></div>`).join("")}</div>
    ${marketIntelBlock(m)}
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


function b64UrlToUint8Array(base64String){
  const padding="=".repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(base64);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
function setAlertsStatus(text,active=false){
  const el=$("#alertsStatus");
  if(el){el.textContent=text;el.classList.toggle("active",!!active)}
  const btn=$("#alertsBtn");
  if(btn){
    btn.textContent=active?"🔔 Notificações críticas ativadas":"🔔 Ativar notificações críticas";
    btn.classList.toggle("active",!!active);
  }
}
async function playAlertTone(){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return;
    const ctx=new Ctx();
    const beep=(when,freq,dur)=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.frequency.value=freq;g.gain.setValueAtTime(.0001,when);
      g.gain.exponentialRampToValueAtTime(.16,when+.02);
      g.gain.exponentialRampToValueAtTime(.0001,when+dur);
      o.connect(g);g.connect(ctx.destination);o.start(when);o.stop(when+dur+.03);
    };
    beep(ctx.currentTime,880,.16);beep(ctx.currentTime+.22,1175,.18);
    setTimeout(()=>ctx.close().catch(()=>{}),700);
  }catch{}
}
async function postPushSubscription(subscription){
  const r=await fetch(PUSH_SUBSCRIBE_URL,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({subscription:subscription.toJSON()})
  });
  if(!r.ok) throw new Error(`subscribe HTTP ${r.status}`);
  return r.json();
}
async function sendPushTest(subscription){
  const r=await fetch(PUSH_TEST_URL,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({endpoint:subscription.endpoint})
  });
  if(!r.ok) throw new Error(`test HTTP ${r.status}`);
  return r.json();
}
async function ensurePushSubscription(sendTest=false){
  if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){
    setAlertsStatus("Este navegador não oferece Web Push compatível.");
    return false;
  }
  const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
  if(permission!=="granted"){
    setAlertsStatus(permission==="denied"?"Notificações bloqueadas no Android/Chrome.":"Permissão de notificação não concedida.");
    return false;
  }
  const reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  if(!sub){
    sub=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:b64UrlToUint8Array(VAPID_PUBLIC_KEY)
    });
  }
  await postPushSubscription(sub);
  localStorage.setItem("matchintel-push-enabled","1");
  setAlertsStatus("Alertas ativos neste aparelho. Push crítico + som do Android.",true);
  await playAlertTone();
  if(sendTest){
    try{
      await sendPushTest(sub);
      setAlertsStatus("Alertas ativos neste aparelho. Teste remoto enviado com sucesso.",true);
    }catch(e){
      console.error(e);
      setAlertsStatus("Alertas ativos. O teste remoto falhou; sua inscrição continua ativa.",true);
    }
  }
  return true;
}
async function initPushUI(){
  const btn=$("#alertsBtn");
  if(!btn)return;
  btn.onclick=async()=>{
    btn.disabled=true;
    setAlertsStatus("Configurando alertas...");
    try{
      await ensurePushSubscription(true);
    }catch(e){
      console.error(e);
      setAlertsStatus("Não consegui criar/registrar a inscrição de alertas. Toque para tentar novamente.",false);
    }finally{btn.disabled=false}
  };
  if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){
    btn.classList.add("hidden");
    setAlertsStatus("Web Push não suportado neste navegador.");
    return;
  }
  if(Notification.permission==="granted"){
    try{
      const reg=await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.getSubscription();
      if(sub){
        await postPushSubscription(sub);
        setAlertsStatus("Alertas ativos neste aparelho.",true);
      }
    }catch{}
  }
}
navigator.serviceWorker?.addEventListener?.("message",e=>{
  if(e.data?.type==="MATCHINTEL_PUSH"){
    playAlertTone();
    loadAll();
  }
});

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
loadEvidence();
loadAll();
initPushUI();
setInterval(loadAll,20000);
