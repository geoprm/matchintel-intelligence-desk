
import fs from "node:fs";
import path from "node:path";

function parseEnv(file){
  const out={};
  if(!fs.existsSync(file)) return out;
  for(const raw of fs.readFileSync(file,"utf8").split(/\r?\n/)){
    const line=raw.trim(); if(!line||line.startsWith("#"))continue;
    const i=line.indexOf("="); if(i<0)continue;
    out[line.slice(0,i).trim()]=line.slice(i+1).trim();
  }
  return out;
}
const cwd=process.cwd();
const local={...parseEnv(path.join(cwd,".env")),...parseEnv(path.join(cwd,".env.cloud"))};
const gatewayUrl=(local.GATEWAY_URL||"http://127.0.0.1:8787").replace(/\/$/,"");
const gatewayToken=local.GATEWAY_ACCESS_TOKEN;
const ingestUrl=local.MATCHINTEL_INGEST_URL;
const ingestKey=local.MATCHINTEL_INGEST_KEY;
const every=Math.max(10000,Number(local.MATCHINTEL_SYNC_MS||20000));
if(!gatewayToken||!ingestUrl||!ingestKey){
  console.error("[ERRO] Configure GATEWAY_ACCESS_TOKEN no .env e MATCHINTEL_INGEST_URL / MATCHINTEL_INGEST_KEY no .env.cloud");
  process.exit(1);
}
const auth={Authorization:`Bearer ${gatewayToken}`};
async function getJson(route){
  try{const r=await fetch(gatewayUrl+route,{headers:auth,signal:AbortSignal.timeout(8000)});if(!r.ok)return null;return await r.json()}catch{return null}
}
const arr=(v)=>Array.isArray(v)?v:[];
const firstArray=(o,keys)=>{for(const k of keys)if(Array.isArray(o?.[k]))return o[k];return[]};
const text=(...xs)=>xs.find(x=>typeof x==="string"&&x.trim())||null;
const num=(...xs)=>{const x=xs.find(v=>v!==null&&v!==undefined&&v!==""&&!Number.isNaN(Number(v)));return x===undefined?null:Number(x)};
function normalizeMatch(m){
  const home=text(m.home,m.homeTeam?.name,m.teams?.home?.name,m.teamHome,m.home_name);
  const away=text(m.away,m.awayTeam?.name,m.teams?.away?.name,m.teamAway,m.away_name);
  if(!home||!away)return null;
  const providerId=text(String(m.provider_match_id??""),String(m.fixture?.id??""),String(m.id??""))||null;
  const matchKey=text(m.match_key,m.matchKey,m.key,providerId?`api:${providerId}`:null,`${home}::${away}`.toLowerCase().replace(/\s+/g,"_"));
  const decision=m.bestDecision||m.decision||m.opportunity||m.shadowDecision||{};
  const scoreObj=m.score||m.goals||{};
  return {
    match_key:matchKey,provider_match_id:providerId,home,away,
    competition:text(m.competition,m.league?.name,m.tournament?.name,m.league),
    state:text(m.state,m.status?.short,m.status,m.matchState)||"WATCH",
    radar_state:text(m.radar_state,m.radarState,m.focusState,m.adaptiveFocus?.state),
    minute:num(m.minute,m.elapsed,m.status?.elapsed,m.clock?.minute),
    phase:text(m.phase,m.period,m.status?.short),
    home_score:num(m.home_score,m.homeScore,scoreObj.home,m.goals?.home),
    away_score:num(m.away_score,m.awayScore,scoreObj.away,m.goals?.away),
    data_quality:num(m.data_quality,m.dataQuality,m.dqi,m.DQI)||0,
    independent_sources:num(m.independent_sources,m.independentSources,m.sourceMatrix?.independentSources)||0,
    source_matrix_state:text(m.source_matrix_state,m.sourceMatrixState,m.sourceMatrix?.state),
    conflicts:num(m.conflicts,m.sourceMatrix?.conflicts)||0,
    best_market:text(m.best_market,decision.market,decision.bestMarket,m.market),
    best_level:text(m.best_level,decision.level,decision.classification,m.level),
    best_probability:num(m.best_probability,decision.probability,decision.score,m.probability),
    best_explanation:text(m.best_explanation,decision.explanation,decision.why,m.explanation),
    priority:num(m.priority,m.adaptiveFocus?.priority),
    refresh_seconds:num(m.refresh_seconds,m.adaptiveFocus?.refreshSeconds),
    origin:text(m.origin,m.source,"gateway"),
    stats:m.stats||m.statistics||m.liveStats||{},
    source_matrix:m.source_matrix||m.sourceMatrix||{},
    risks:arr(m.risks||decision.risks),
    updated_at:new Date().toISOString()
  };
}
function normalizeSignal(s){
  return {
    match_key:text(s.match_key,s.matchKey,s.match?.key),
    provider_family:text(s.provider_family,s.providerFamily,s.family,s.provider)||"unknown",
    provider_name:text(s.provider_name,s.providerName,s.chatName,s.source,s.provider)||"unknown",
    signal_type:text(s.signal_type,s.signalType,s.type,s.label)||"SIGNAL",
    market:text(s.market,s.parsed?.market),
    text_summary:text(s.text_summary,s.summary,s.text,s.message),
    state:text(s.state,s.status,s.priorityState)||"WATCH",
    pinned:Boolean(s.pinned||s.isPinned),
    author_role:text(s.author_role,s.authorRole),
    occurred_at:text(s.occurred_at,s.occurredAt,s.date,s.timestamp,new Date().toISOString())
  };
}
function normalizeEvent(e){
  const event_type=text(e.event_type,e.eventType,e.type,e.name);if(!event_type)return null;
  return {match_key:text(e.match_key,e.matchKey),event_type,side:text(e.side,e.team),observed_minute:num(e.observed_minute,e.observedMinute,e.minute),detected_at:text(e.detected_at,e.detectedAt,e.timestamp,new Date().toISOString()),payload:e.payload||e};
}
async function tick(){
  const [radar, signalsR, statusR, eventsR]=await Promise.all([getJson("/radar"),getJson("/signals"),getJson("/status"),getJson("/events")]);
  if(!radar&&!statusR){console.log(new Date().toLocaleTimeString(),"Gateway indisponível; aguardando...");return;}
  const matchesRaw=firstArray(radar,["matches","live","sessions","matchSessions","items","radar"]) || [];
  const signalsRaw=[...firstArray(radar,["signals","telegramSignals"]),...firstArray(signalsR,["signals","items","data"])];
  const eventsRaw=[...firstArray(radar,["events","timeline"]),...firstArray(eventsR,["events","items","data"])];
  const matches=matchesRaw.map(normalizeMatch).filter(Boolean);
  const signals=signalsRaw.map(normalizeSignal);
  const events=eventsRaw.map(normalizeEvent).filter(Boolean);
  const statusSource=statusR||radar?.status||{};
  const status={
    id:"main",gateway_online:true,
    telegram_connected:Boolean(statusSource.telegram_connected??statusSource.telegramConnected??radar?.telegramConnected),
    auto_scan_active:Boolean(statusSource.auto_scan_active??statusSource.autoScanActive??radar?.autoScanActive),
    shadow_mode:Boolean(statusSource.shadow_mode??statusSource.shadowMode??radar?.shadowMode??true),
    api_provider:text(statusSource.api_provider,statusSource.apiProvider,radar?.apiProvider,"API-Football"),
    quota_daily_remaining:num(statusSource.quota_daily_remaining,statusSource.quotaDailyRemaining,radar?.quotaDailyRemaining),
    independent_sources:num(statusSource.independent_sources,statusSource.independentSources,radar?.independentSources)||0,
    last_sync_at:new Date().toISOString(),
    version:text(statusSource.version,radar?.version,"gateway")
  };
  const r=await fetch(ingestUrl,{method:"POST",headers:{"content-type":"application/json","x-matchintel-key":ingestKey},body:JSON.stringify({matches,events,signals,status}),signal:AbortSignal.timeout(12000)});
  const out=await r.text();
  if(!r.ok) throw new Error(`Cloud ${r.status}: ${out}`);
  console.log(new Date().toLocaleTimeString(),`sync OK | matches=${matches.length} signals=${signals.length} events=${events.length}`);
}
console.log(`MatchIntel Cloud Bridge ativo | Gateway ${gatewayUrl} | intervalo ${every/1000}s`);
tick().catch(e=>console.error("sync:",e.message));
setInterval(()=>tick().catch(e=>console.error("sync:",e.message)),every);
