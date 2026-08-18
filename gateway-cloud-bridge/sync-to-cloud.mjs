import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const VERSION="1.3-P1";
const SIGNAL_TTL_MS=10*60*1000;
const FUTURE_TOLERANCE_MS=2*60*1000;
const here=path.dirname(fileURLToPath(import.meta.url));

function parseEnv(file){
  const out={}; if(!fs.existsSync(file)) return out;
  for(const raw of fs.readFileSync(file,"utf8").replace(/^\uFEFF/,"").split(/\r?\n/)){
    const line=raw.trim(); if(!line||line.startsWith("#"))continue;
    const i=line.indexOf("="); if(i<0)continue;
    out[line.slice(0,i).trim()]=line.slice(i+1).trim();
  } return out;
}
const env={...parseEnv(path.join(here,".env")),...parseEnv(path.join(here,".env.cloud"))};
const gatewayUrl=(env.GATEWAY_URL||"http://127.0.0.1:8787").replace(/\/$/,"");
const gatewayToken=env.GATEWAY_ACCESS_TOKEN;
const ingestUrl=env.MATCHINTEL_INGEST_URL;
const ingestKey=env.MATCHINTEL_INGEST_KEY;
const every=Math.max(10000,Number(env.MATCHINTEL_SYNC_MS||20000));
if(!gatewayToken||!ingestUrl||!ingestKey){console.error("[ERRO] Configuracao incompleta.");process.exit(1)}

const stateFile=path.join(here,".data","cloud-bridge-p0.json");
fs.mkdirSync(path.dirname(stateFile),{recursive:true});
let seen={version:2,initialized:false,signals:{}};
try{
  const old=JSON.parse(fs.readFileSync(stateFile,"utf8"));
  if(old?.version===2) seen={...seen,...old};
}catch{}
const saveSeen=()=>{try{fs.writeFileSync(stateFile,JSON.stringify(seen,null,2))}catch{}};
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const auth={Authorization:`Bearer ${gatewayToken}`};

async function getJson(route){
  try{
    const r=await fetch(gatewayUrl+route,{headers:auth,signal:AbortSignal.timeout(8000)});
    return r.ok?await r.json():null;
  }catch{return null}
}
const firstArray=(o,keys)=>{for(const k of keys)if(Array.isArray(o?.[k]))return o[k];return[]};
const text=(...xs)=>xs.find(x=>typeof x==="string"&&x.trim())||null;
const num=(...xs)=>{const x=xs.find(v=>v!==null&&v!==undefined&&v!==""&&!Number.isNaN(Number(v)));return x===undefined?null:Number(x)};

function sourceEventId(s){
  const v=s.source_event_id??s.sourceEventId??s.telegram_message_id??s.telegramMessageId??s.message_id??s.messageId??s.msg_id??s.msgId;
  return v===null||v===undefined||v===""?null:String(v);
}
function parseSourceTime(s){
  // Intentionally avoid generic poll/detected timestamps. Prefer upstream message time.
  const raw=text(s.source_occurred_at,s.sourceOccurredAt,s.telegramDate,s.messageDate,s.sentAt,s.date,s.occurred_at,s.occurredAt);
  if(!raw) return null;
  const d=new Date(raw);
  return Number.isFinite(d.getTime())?d.toISOString():null;
}

function extractUrls(s){
  const values=[
    s.bookmaker_url,s.bookmakerUrl,s.bet365_url,s.bet365Url,s.betano_url,s.betanoUrl,
    s.game_link,s.gameLink,s.link,s.url,s.raw_url,s.rawUrl,
    s.text,s.message,s.summary,s.text_summary,s.caption,s.rawText
  ].filter(v=>typeof v==="string");
  const urls=[];
  for(const v of values){
    if(/^https?:\/\//i.test(v.trim())) urls.push(v.trim());
    for(const m of v.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)) urls.push(m[0].replace(/[.,;!?]+$/,""));
  }
  return [...new Set(urls)];
}
function allowedBookmakerUrl(s){
  const kind=`${s.provider_family||s.providerFamily||s.family||s.provider||""} ${s.provider_name||s.providerName||s.chatName||s.source||""}`.toLowerCase();
  const mafia=kind.includes("mafia")||kind.includes("máfia");
  const betzord=kind.includes("betzord");
  for(const raw of extractUrls(s)){
    try{
      const u=new URL(raw); if(u.protocol!=="https:")continue;
      const h=u.hostname.toLowerCase();
      if(mafia && (h==="bet365.bet.br"||h.endsWith(".bet365.bet.br")||h==="bet365.com"||h.endsWith(".bet365.com"))){
        return {bookmaker:"BET365",bookmaker_url:u.href};
      }
      if(betzord && (h==="betano.bet.br"||h.endsWith(".betano.bet.br")||h==="betanobr.com"||h.endsWith(".betanobr.com"))){
        return {bookmaker:"BETANO",bookmaker_url:u.href};
      }
    }catch{}
  }
  if(betzord) return {bookmaker:"BETANO",bookmaker_url:"https://www.betano.bet.br/"};
  if(mafia) return {bookmaker:"BET365",bookmaker_url:null};
  return {bookmaker:null,bookmaker_url:null};
}
function sigFingerprint(s){
  const sid=sourceEventId(s);
  return sha([
    text(s.provider_family,s.providerFamily,s.family,s.provider)||"",
    text(s.provider_name,s.providerName,s.chatName,s.source,s.provider)||"",
    sid||"",
    text(s.match_key,s.matchKey,s.match?.key)||"",
    text(s.signal_type,s.signalType,s.type,s.label)||"",
    text(s.market,s.parsed?.market)||"",
    text(s.text_summary,s.summary,s.text,s.message)||"",
    Boolean(s.pinned||s.isPinned)?"1":"0"
  ].join("|").toLowerCase().replace(/\s+/g," "));
}
function retireAbsentSignals(current){
  const now=Date.now();
  for(const [fp,rec] of Object.entries(seen.signals)){
    if(current.has(fp)){rec.absentTicks=0;continue}
    rec.absentTicks=(rec.absentTicks||0)+1;
    // Baseline snapshots become eligible to be considered new only after they
    // disappeared for at least two sync cycles. This stops a pinned stale
    // snapshot from becoming "new" after a restart.
    if(rec.baselineBlocked && rec.absentTicks>=2) delete seen.signals[fp];
    else if(now-new Date(rec.lastSeenAt||rec.firstSeenAt||0).getTime()>2*24*60*60*1000) delete seen.signals[fp];
  }
}
function normalizeSignal(s,baselineOnly=false){
  const fp=sigFingerprint(s);
  const nowIso=new Date().toISOString();
  const sourceTime=parseSourceTime(s);
  let rec=seen.signals[fp];
  if(!rec){
    rec=seen.signals[fp]={
      firstSeenAt:sourceTime||nowIso,lastSeenAt:nowIso,
      sourceEventId:sourceEventId(s),baselineBlocked:false,forwardedAt:null,absentTicks:0
    };
  }else{
    rec.lastSeenAt=nowIso; rec.absentTicks=0;
  }

  // FIRST CYCLE IS ALWAYS BASELINE. Even if the local snapshot claims a recent
  // timestamp, it existed before this bridge started and cannot be called new.
  if(baselineOnly){
    rec.baselineBlocked=true;
    return null;
  }
  if(rec.baselineBlocked || rec.forwardedAt) return null;

  const occurred=sourceTime||rec.firstSeenAt;
  const age=Date.now()-new Date(occurred).getTime();
  if(!Number.isFinite(age) || age>SIGNAL_TTL_MS || age<-FUTURE_TOLERANCE_MS){
    rec.staleBlocked=true;
    return null;
  }

  rec.forwardedAt=nowIso;
  const book=allowedBookmakerUrl(s);
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
    occurred_at:occurred,
    source_event_id:sourceEventId(s),
    bookmaker:book.bookmaker,
    bookmaker_url:book.bookmaker_url
  };
}
function normalizeMatch(m){
  const home=text(m.home,m.homeTeam?.name,m.teams?.home?.name,m.teamHome,m.home_name);
  const away=text(m.away,m.awayTeam?.name,m.teams?.away?.name,m.teamAway,m.away_name);
  if(!home||!away)return null;
  const providerId=m.provider_match_id??m.fixture?.id??m.id??null;
  const decision=m.bestDecision||m.decision||m.opportunity||m.shadowDecision||{};
  return {
    match_key:text(m.match_key,m.matchKey,m.key,providerId!=null?`api:${providerId}`:null,`${home}::${away}`.toLowerCase().replace(/\s+/g,"_")),
    provider_match_id:providerId!=null?String(providerId):null,home,away,
    competition:text(m.competition,m.league?.name,m.tournament?.name,typeof m.league==="string"?m.league:null),
    state:text(m.state,m.status?.short,typeof m.status==="string"?m.status:null,m.matchState)||"WATCH",
    radar_state:text(m.radar_state,m.radarState,m.focusState,m.adaptiveFocus?.state),
    minute:num(m.minute,m.elapsed,m.status?.elapsed,m.clock?.minute),
    phase:text(m.phase,m.period,m.status?.short),
    home_score:num(m.home_score,m.homeScore,m.score?.home,m.goals?.home),
    away_score:num(m.away_score,m.awayScore,m.score?.away,m.goals?.away),
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
    risks:Array.isArray(m.risks||decision.risks)?(m.risks||decision.risks):[],
    updated_at:new Date().toISOString()
  };
}
function normalizeEvent(e){
  const event_type=text(e.event_type,e.eventType,e.type,e.name);
  if(!event_type)return null;
  return {
    match_key:text(e.match_key,e.matchKey),event_type,side:text(e.side,e.team),
    observed_minute:num(e.observed_minute,e.observedMinute,e.minute),
    detected_at:text(e.detected_at,e.detectedAt,e.timestamp,new Date().toISOString()),
    payload:e.payload||e
  };
}
async function tick(){
  const [radar,signalsR,statusR,eventsR]=await Promise.all([
    getJson("/radar"),getJson("/signals"),getJson("/status"),getJson("/events")
  ]);
  if(!radar&&!statusR){
    console.log(new Date().toLocaleTimeString(),"Gateway indisponivel; aguardando...");
    return;
  }

  const matchesRaw=firstArray(radar,["matches","live","sessions","matchSessions","items","radar"]);
  const signalsRaw=[...firstArray(radar,["signals","telegramSignals"]),...firstArray(signalsR,["signals","items","data"])];
  const eventsRaw=[...firstArray(radar,["events","timeline"]),...firstArray(eventsR,["events","items","data"])];

  const currentFps=new Set(signalsRaw.map(sigFingerprint));
  retireAbsentSignals(currentFps);

  const baselineOnly=!seen.initialized;
  const matches=matchesRaw.map(normalizeMatch).filter(Boolean);
  const signals=signalsRaw.map(s=>normalizeSignal(s,baselineOnly)).filter(Boolean);
  const events=eventsRaw.map(normalizeEvent).filter(Boolean);

  seen.initialized=true;
  saveSeen();

  const ss=statusR||radar?.status||{};
  const telegramEvidence=Boolean(ss.telegram_connected??ss.telegramConnected??radar?.telegramConnected) || signalsRaw.length>0;
  const status={
    id:"main",gateway_online:true,
    telegram_connected:telegramEvidence,
    auto_scan_active:Boolean(ss.auto_scan_active??ss.autoScanActive??radar?.autoScanActive),
    shadow_mode:Boolean(ss.shadow_mode??ss.shadowMode??radar?.shadowMode??true),
    api_provider:text(ss.api_provider,ss.apiProvider,radar?.apiProvider,"API-Football"),
    quota_daily_remaining:num(ss.quota_daily_remaining,ss.quotaDailyRemaining,radar?.quotaDailyRemaining),
    independent_sources:num(ss.independent_sources,ss.independentSources,radar?.independentSources)||0,
    last_sync_at:new Date().toISOString(),
    version:`${text(ss.version,radar?.version,"gateway")}|bridge-${VERSION}`
  };

  const r=await fetch(ingestUrl,{
    method:"POST",
    headers:{"content-type":"application/json","x-matchintel-key":ingestKey},
    body:JSON.stringify({matches,events,signals,status}),
    signal:AbortSignal.timeout(12000)
  });
  const raw=await r.text();
  if(!r.ok) throw new Error(`Cloud ${r.status}: ${raw}`);
  let cloud={}; try{cloud=JSON.parse(raw)}catch{}
  const dropped=cloud?.dropped||{};
  console.log(
    new Date().toLocaleTimeString(),
    `P1 sync OK | matches=${matches.length} signals=${signals.length} events=${events.length}`+
    `${baselineOnly?" | BASELINE BLOQUEADA":""}`+
    `${dropped.signals_stale?` | cloud stale=${dropped.signals_stale}`:""}`
  );
}

console.log(`MatchIntel Cloud Bridge v${VERSION} ativo | P0 freshness + P1 bookmaker links | intervalo ${every/1000}s`);
tick().catch(e=>console.error("sync:",e.message));
setInterval(()=>tick().catch(e=>console.error("sync:",e.message)),every);
