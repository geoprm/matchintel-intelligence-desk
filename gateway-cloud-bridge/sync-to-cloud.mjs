import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const VERSION="2.4-P11.0.4";
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
const ticketIngestUrl=env.MATCHINTEL_TICKET_INGEST_URL||ingestUrl.replace(/\/matchintel-ingest\/?$/,"/matchintel-ticket-ingest");
const valueIngestUrl=env.MATCHINTEL_VALUE_INGEST_URL||ingestUrl.replace(/\/matchintel-ingest\/?$/,"/matchintel-value-ingest");
const performanceIngestUrl=env.MATCHINTEL_PERFORMANCE_INGEST_URL||ingestUrl.replace(/\/matchintel-ingest\/?$/,"/matchintel-performance-ingest");
const backtestIngestUrl=env.MATCHINTEL_BACKTEST_INGEST_URL||ingestUrl.replace(/\/matchintel-ingest\/?$/,"/matchintel-backtest-ingest");
const every=Math.max(10000,Number(env.MATCHINTEL_SYNC_MS||20000));
if(!gatewayToken||!ingestUrl||!ingestKey){console.error("[ERRO] Configuracao incompleta.");process.exit(1)}

const stateFile=path.join(here,".data","cloud-bridge-p3.json");
fs.mkdirSync(path.dirname(stateFile),{recursive:true});
let seen={version:4,initialized:false,signals:{}};
try{const old=JSON.parse(fs.readFileSync(stateFile,"utf8"));if(old?.version===4)seen={...seen,...old}}catch{}
const saveSeen=()=>{try{fs.writeFileSync(stateFile,JSON.stringify(seen,null,2))}catch{}};
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const auth={Authorization:`Bearer ${gatewayToken}`};
const text=(...xs)=>xs.find(x=>typeof x==="string"&&x.trim())||null;
const num=(...xs)=>{const x=xs.find(v=>v!==null&&v!==undefined&&v!==""&&!Number.isNaN(Number(v)));return x===undefined?null:Number(x)};

async function getJson(route){
  try{
    const r=await fetch(gatewayUrl+route,{headers:auth,signal:AbortSignal.timeout(5000)});
    if(!r.ok)return null;
    return await r.json();
  }catch{return null}
}
function firstArray(o,keys){for(const k of keys)if(Array.isArray(o?.[k]))return o[k];return[]}
function teamName(x){return text(x?.name,x?.team?.name,typeof x==="string"?x:null)}
function extractHome(o){return text(o?.home,o?.home_name,o?.teamHome,teamName(o?.homeTeam),teamName(o?.teams?.home),teamName(o?.participants?.home),teamName(o?.fixture?.teams?.home))}
function extractAway(o){return text(o?.away,o?.away_name,o?.teamAway,teamName(o?.awayTeam),teamName(o?.teams?.away),teamName(o?.participants?.away),teamName(o?.fixture?.teams?.away))}
function looksLikeMatch(o){if(!o||typeof o!=="object"||Array.isArray(o))return false;return !!(extractHome(o)&&extractAway(o))}
function deepMatches(root,maxDepth=7){
  const out=[];const visited=new Set();
  function walk(v,d){
    if(v===null||v===undefined||d>maxDepth)return;
    if(typeof v!=="object")return;
    if(visited.has(v))return;visited.add(v);
    if(looksLikeMatch(v))out.push(v);
    if(Array.isArray(v)){for(const x of v)walk(x,d+1);return}
    for(const [k,x] of Object.entries(v)){
      if(["stats","statistics","sourceMatrix","source_matrix","risks","events","timeline","payload"].includes(k)&&d>2) continue;
      walk(x,d+1);
    }
  }
  walk(root,0);return out;
}
function findFlag(root,patterns){
  let found=null;const visited=new Set();
  function walk(v,d){
    if(found!==null||v===null||v===undefined||d>6||typeof v!=="object")return;
    if(visited.has(v))return;visited.add(v);
    if(Array.isArray(v)){for(const x of v)walk(x,d+1);return}
    for(const [k,x] of Object.entries(v)){
      const key=k.toLowerCase().replace(/[_-]/g,"");
      if(patterns.some(p=>key.includes(p))){
        if(typeof x==="boolean"){found=x;return}
        if(x&&typeof x==="object" && typeof x.active==="boolean"){found=x.active;return}
        if(typeof x==="string" && /^(active|ativo|on|true|running)$/i.test(x)){found=true;return}
      }
      walk(x,d+1);
    }
  }
  walk(root,0);return found;
}
function sourceEventId(s){const v=s.source_event_id??s.sourceEventId??s.telegram_message_id??s.telegramMessageId??s.message_id??s.messageId??s.msg_id??s.msgId;return v===null||v===undefined||v===""?null:String(v)}
function isoTime(raw){if(raw===null||raw===undefined||raw==="")return null;if(typeof raw==="number"||/^\d{9,16}$/.test(String(raw).trim())){let n=Number(raw);if(!Number.isFinite(n))return null;if(n<1e12)n*=1000;const d=new Date(n);return Number.isFinite(d.getTime())?d.toISOString():null}const d=new Date(raw);return Number.isFinite(d.getTime())?d.toISOString():null}
function parseSourceTime(s){const raw=s.source_occurred_at??s.sourceOccurredAt??s.telegramDate??s.messageDate??s.sentAt??s.date??s.occurred_at??s.occurredAt??s.sourceTimestamp??s.timestamp??null;return isoTime(raw)}
function signalMatchKey(s){const explicit=text(s.match_key,s.matchKey,s.cloudMatchKey,s.match?.key);if(explicit)return explicit;const id=s.resolvedMatchId??s.matchId??s.match_id??null;return id!==null&&id!==undefined&&String(id).trim()?`api:${String(id).trim()}`:null}
function extractUrls(s){const values=[s.bookmaker_url,s.bookmakerUrl,s.bet365_url,s.bet365Url,s.bet365Link,s.betano_url,s.betanoUrl,s.betanoLink,s.game_link,s.gameLink,s.link,s.url,s.raw_url,s.rawUrl,s.linkPreviewUrl,s.text,s.message,s.summary,s.text_summary,s.caption,s.rawText,...(Array.isArray(s.urls)?s.urls:[])].filter(v=>typeof v==="string");const urls=[];for(const v of values){if(/^https?:\/\//i.test(v.trim()))urls.push(v.trim());for(const m of v.matchAll(/https?:\/\/[^\s<>"')\]]+/gi))urls.push(m[0].replace(/[.,;!?]+$/, ""))}return [...new Set(urls)]}
function allowedBookmakerUrl(s){const kind=`${s.provider_family||s.providerFamily||s.family||s.provider||""} ${s.provider_name||s.providerName||s.chatName||s.source||""}`.toLowerCase();const mafia=kind.includes("mafia")||kind.includes("máfia");const betzord=kind.includes("betzord");for(const raw of extractUrls(s)){try{const u=new URL(raw);if(u.protocol!=="https:")continue;const h=u.hostname.toLowerCase();if(mafia&&(h==="bet365.bet.br"||h.endsWith(".bet365.bet.br")||h==="bet365.com"||h.endsWith(".bet365.com")))return{bookmaker:"BET365",bookmaker_url:u.href};if(betzord&&(h==="betano.bet.br"||h.endsWith(".betano.bet.br")||h==="betanobr.com"||h.endsWith(".betanobr.com")))return{bookmaker:"BETANO",bookmaker_url:u.href}}catch{}}if(betzord)return{bookmaker:"BETANO",bookmaker_url:"https://www.betano.bet.br/"};if(mafia)return{bookmaker:"BET365",bookmaker_url:null};return{bookmaker:null,bookmaker_url:null}}
function sigFingerprint(s){return sha([text(s.provider_family,s.providerFamily,s.family,s.provider)||"",text(s.provider_name,s.providerName,s.chatName,s.source,s.provider)||"",sourceEventId(s)||"",signalMatchKey(s)||"",text(s.signal_type,s.signalType,s.type,s.label)||"",text(s.market,s.parsed?.market)||"",text(s.text_summary,s.summary,s.text,s.message)||"",Boolean(s.pinned||s.isPinned)?"1":"0"].join("|").toLowerCase().replace(/\s+/g," "))}
function retireAbsentSignals(current){const now=Date.now();for(const [fp,rec] of Object.entries(seen.signals)){if(current.has(fp)){rec.absentTicks=0;continue}rec.absentTicks=(rec.absentTicks||0)+1;if(rec.baselineBlocked&&rec.absentTicks>=2)delete seen.signals[fp];else if(now-new Date(rec.lastSeenAt||rec.firstSeenAt||0).getTime()>2*24*60*60*1000)delete seen.signals[fp]}}
function normalizeSignal(s,baselineOnly=false){if(s?.cloudEligible===false)return null;const fp=sigFingerprint(s);const nowIso=new Date().toISOString();const sourceTime=parseSourceTime(s);let rec=seen.signals[fp];if(!rec)rec=seen.signals[fp]={firstSeenAt:sourceTime||nowIso,lastSeenAt:nowIso,sourceEventId:sourceEventId(s),baselineBlocked:false,forwardedAt:null,absentTicks:0};else{rec.lastSeenAt=nowIso;rec.absentTicks=0}if(baselineOnly){rec.baselineBlocked=true;return null}if(rec.baselineBlocked||rec.forwardedAt)return null;const occurred=sourceTime||rec.firstSeenAt;const age=Date.now()-new Date(occurred).getTime();if(!Number.isFinite(age)||age>SIGNAL_TTL_MS||age<-FUTURE_TOLERANCE_MS){rec.staleBlocked=true;return null}rec.forwardedAt=nowIso;const book=allowedBookmakerUrl(s);return{match_key:signalMatchKey(s),provider_family:text(s.provider_family,s.providerFamily,s.family,s.provider)||"unknown",provider_name:text(s.provider_name,s.providerName,s.chatName,s.source,s.provider)||"unknown",signal_type:text(s.signal_type,s.signalType,s.type,s.label)||"SIGNAL",market:text(s.market,s.parsed?.market),text_summary:text(s.text_summary,s.summary,s.text,s.message),state:text(s.state,s.status,s.priorityState)||"WATCH",pinned:Boolean(s.pinned||s.isPinned),author_role:text(s.author_role,s.authorRole),occurred_at:occurred,source_event_id:sourceEventId(s),bookmaker:book.bookmaker,bookmaker_url:book.bookmaker_url}}
function rawState(m){return text(m.state,m.matchState,m.status?.short,typeof m.status==="string"?m.status:null,m.phase,m.period,m.fixture?.status?.short)||"WATCH"}
function mapState(s){const x=String(s||"").toUpperCase();if(["1H","HT","2H","ET","P","LIVE","BT"].includes(x))return"LIVE";if(["NS","TBD","PRE","SCHEDULED","UPCOMING","WATCH"].includes(x))return"PRELIVE";if(["FT","AET","PEN"].includes(x))return"FINISHED";if(["PST","CANC","ABD","AWD","WO"].includes(x))return x;return x||"WATCH"}
/* P11_0_3_KICKOFF_TRUTH */
function scheduledAt(m){
  const sm=m?.source_matrix||m?.sourceMatrix||{};
  const candidates=[
    m?.startTimestamp,m?.start_timestamp,m?.scheduled_at,m?.scheduledAt,m?.start_time,m?.startTime,
    m?.date,m?.fixture?.date,m?.kickoff,m?.kickOff,m?.timestamp,
    sm?.fields?.kickoff?.value,sm?.fields?.startTimestamp?.value,
    ...(Array.isArray(sm?.observations)?sm.observations.map(o=>o?.fields?.kickoff??o?.fields?.startTimestamp):[])
  ];
  for(const raw of candidates){
    if(raw===null||raw===undefined||raw==="")continue;
    let v=raw;
    if((typeof v==="number"||/^\d{9,16}$/.test(String(v).trim())) && Number(v)<1e12)v=Number(v)*1000;
    const iso=isoTime(v);if(iso)return iso;
  }
  return null;
}
/* P11_0_2_PROVIDER_TRUTH */
function liveLikeState(state,phase){const s=`${state||""} ${phase||""}`.toUpperCase();return /(^|\s)(LIVE|1H|HT|2H|ET|P)(\s|$)/.test(s)&&!/(FT|FINISHED|AET|PEN)/.test(s)}
function latestProviderFetchedAt(m){
  const candidates=[];
  const add=v=>{const x=isoTime(v);if(x)candidates.push(x)};
  add(m?.provider_fetched_at);add(m?.providerFetchedAt);add(m?.stats?._matchintel?.providerFetchedAt);
  const sm=m?.source_matrix||m?.sourceMatrix||{};
  add(sm?.providerFetchedAt);add(sm?.provider_fetched_at);add(sm?.updatedAt);
  for(const o of Array.isArray(sm?.observations)?sm.observations:[]){add(o?.fetchedAt);add(o?.fetched_at);add(o?.observedAt);add(o?.timestamp)}
  // Gateway rows may expose their provider refresh timestamp directly. This is only a fallback when source-matrix evidence is absent.
  if(!candidates.length){add(m?.provider_updated_at);add(m?.providerUpdatedAt);add(m?.updated_at);add(m?.updatedAt)}
  if(!candidates.length)return null;
  return candidates.sort((a,b)=>new Date(b)-new Date(a))[0];
}
function normalizeMatch(m){const home=extractHome(m),away=extractAway(m);if(!home||!away)return null;const providerId=m.provider_match_id??m.fixture?.id??m.id??m.matchId??null;const decision=m.bestDecision||m.decision||m.opportunity||m.shadowDecision||{};const sourceState=rawState(m),state=mapState(sourceState),sched=scheduledAt(m);const nowIso=new Date().toISOString(),providerFetchedAt=latestProviderFetchedAt(m),providerLive=liveLikeState(state,sourceState);const baseStats=m.stats||m.statistics||m.liveStats||{};const baseObj=(baseStats&&typeof baseStats==="object"&&!Array.isArray(baseStats)?baseStats:{});const stats={...baseObj,_matchintel:{...(baseObj._matchintel||{}),scheduledAt:sched,sourceState,discoveredBy:"bridge-p1104",marketIntel:m.marketIntel||baseObj?._matchintel?.marketIntel||null,bridgeSyncedAt:nowIso,providerFetchedAt:providerFetchedAt,freshnessBasis:providerLive?"PROVIDER":"BRIDGE",canonicalIdentity:providerId!=null?"PROVIDER_ID":"ALIAS"}};const truthfulUpdatedAt=providerLive?(providerFetchedAt||"1970-01-01T00:00:00.000Z"):nowIso;return{match_key:text(m.match_key,m.matchKey,m.key,providerId!=null?`api:${providerId}`:null,`${home}::${away}`.toLowerCase().replace(/\s+/g,"_")),provider_match_id:providerId!=null?String(providerId):null,home,away,competition:text(m.competition,m.league?.name,m.tournament?.name,m.fixture?.league?.name,typeof m.league==="string"?m.league:null),state,radar_state:text(m.radar_state,m.radarState,m.focusState,m.adaptiveFocus?.state,m.trackingState,state==="PRELIVE"?"PRE-LIVE RADAR":null),minute:num(m.minute,m.elapsed,m.status?.elapsed,m.clock?.minute,m.fixture?.status?.elapsed),phase:text(m.phase,m.period,m.status?.short,m.fixture?.status?.short,sourceState),home_score:num(m.home_score,m.homeScore,m.score?.home,m.goals?.home,m.fixture?.goals?.home),away_score:num(m.away_score,m.awayScore,m.score?.away,m.goals?.away,m.fixture?.goals?.away),data_quality:num(m.data_quality,m.dataQuality,m.quality,m.dqi,m.DQI),independent_sources:num(m.independent_sources,m.independentSources,m.sourceMatrix?.independentSportsSources,m.sourceMatrix?.independentSources)||0,source_matrix_state:text(m.source_matrix_state,m.sourceMatrixState,m.sourceMatrix?.state),conflicts:num(m.conflicts,m.sourceMatrix?.conflicts)||0,best_market:text(m.best_market,decision.market,decision.bestMarket,m.market),best_level:text(m.best_level,decision.level,decision.classification,m.level),best_probability:num(m.best_probability,decision.probability,decision.score,m.probability),best_explanation:text(m.best_explanation,decision.explanation,decision.why,m.explanation),priority:num(m.priority,m.adaptiveFocus?.priority,m.candidateScore),refresh_seconds:num(m.refresh_seconds,m.adaptiveFocus?.refreshSeconds),origin:text(m.origin,m.source,"gateway-autonomous"),stats,source_matrix:m.source_matrix||m.sourceMatrix||{},risks:Array.isArray(m.risks||decision.risks)?(m.risks||decision.risks):[],updated_at:truthfulUpdatedAt}}
/* P11_0_4_CANONICAL_MATCH_IDENTITY */
let identityStats={mergedAliases:0,suppressedUnsafePrelive:0,keptAliases:0,official:0};
function identityToken(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g,"_")}
function pairKey(m){return `${identityToken(m?.home)}::${identityToken(m?.away)}`}
function scheduleMs(m){const raw=m?.stats?._matchintel?.scheduledAt||null;if(!raw)return null;const t=new Date(raw).getTime();return Number.isFinite(t)?t:null}
function validOperationalPrelive(m){
  if(String(m?.state||"").toUpperCase()!=="PRELIVE")return true;
  const t=scheduleMs(m);if(!t)return false;
  const now=Date.now();return t>=now-15*60*1000&&t<=now+14*24*60*60*1000;
}
function sameFixture(a,b){
  const ta=scheduleMs(a),tb=scheduleMs(b);
  if(ta==null)return true; // alias sem kickoff nunca vence uma identidade oficial do mesmo par
  if(tb==null)return false;
  return Math.abs(ta-tb)<=6*60*60*1000;
}
function betterRow(a,b){
  const pa=Number(a?.priority||0),pb=Number(b?.priority||0);
  const da=Number(a?.data_quality||0),db=Number(b?.data_quality||0);
  const ta=new Date(a?.updated_at||0).getTime()||0,tb=new Date(b?.updated_at||0).getTime()||0;
  return pb>pa||db>da||tb>ta?b:a;
}
function mergeAliasIntoOfficial(official,alias){
  const out={...official};
  for(const k of ["radar_state","best_market","best_level","best_explanation"])if(!out[k]&&alias[k])out[k]=alias[k];
  for(const k of ["priority","data_quality","independent_sources"])out[k]=Math.max(Number(out[k]||0),Number(alias[k]||0))||out[k]||alias[k]||0;
  if(out.best_probability==null&&alias.best_probability!=null)out.best_probability=alias.best_probability;
  const risks=[...(Array.isArray(out.risks)?out.risks:[]),...(Array.isArray(alias.risks)?alias.risks:[])];
  out.risks=[...new Set(risks.map(String))];
  out.stats={...(out.stats||{}),_matchintel:{...(out.stats?._matchintel||{}),aliasMerged:true,canonicalIdentity:"PROVIDER_ID"}};
  return out;
}
function dedupeMatches(rows){
  identityStats={mergedAliases:0,suppressedUnsafePrelive:0,keptAliases:0,official:0};
  const normalized=rows.map(normalizeMatch).filter(Boolean);
  const officialById=new Map(),aliases=[];
  for(const m of normalized){
    if(m.provider_match_id){
      const k=String(m.provider_match_id),old=officialById.get(k);
      officialById.set(k,old?betterRow(old,m):m);
    }else aliases.push(m);
  }
  const officials=[...officialById.values()];
  identityStats.official=officials.length;
  const byPair=new Map();
  for(const o of officials){const k=pairKey(o);if(!byPair.has(k))byPair.set(k,[]);byPair.get(k).push(o)}
  const keptAliases=[];
  for(const a of aliases){
    const candidates=byPair.get(pairKey(a))||[];
    const canonical=candidates.find(o=>sameFixture(a,o))||null;
    if(canonical){
      const idx=officials.findIndex(o=>o===canonical);
      officials[idx]=mergeAliasIntoOfficial(canonical,a);
      const arr=byPair.get(pairKey(a))||[];
      const ai=arr.findIndex(o=>o===canonical);if(ai>=0)arr[ai]=officials[idx];
      identityStats.mergedAliases++;
      continue;
    }
    if(!validOperationalPrelive(a)){identityStats.suppressedUnsafePrelive++;continue}
    keptAliases.push(a);identityStats.keptAliases++;
  }
  const map=new Map();
  for(const m of [...officials,...keptAliases]){
    const key=m.provider_match_id?`id:${m.provider_match_id}`:`alias:${pairKey(m)}|${m.stats?._matchintel?.scheduledAt||""}`;
    const old=map.get(key);map.set(key,old?betterRow(old,m):m);
  }
  return [...map.values()];
}
function normalizeEvent(e){const event_type=text(e.event_type,e.eventType,e.type,e.name);if(!event_type)return null;const matchKey=text(e.match_key,e.matchKey)||(e.matchId?`api:${String(e.matchId)}`:null);return{match_key:matchKey,event_type,side:text(e.side,e.team),observed_minute:num(e.observed_minute,e.observedMinute,e.minute),detected_at:isoTime(e.detected_at??e.detectedAt??e.timestamp)??new Date().toISOString(),payload:e.payload||e}}

const discoveryRoutes=["/radar","/matches","/match-sessions","/sessions","/prelive","/live","/focus","/scanner","/auto-scan"];
async function tick(){
  const routes=await Promise.all(discoveryRoutes.map(async route=>[route,await getJson(route)]));
  const routeMap=Object.fromEntries(routes);
  const [signalsR,statusR,eventsR,p3R,ticketsR,valueR,performanceR,backtestR,historyR]=await Promise.all([getJson("/signals"),getJson("/status"),getJson("/events"),getJson("/p3-status"),getJson("/daily-tickets"),getJson("/value-board"),getJson("/performance"),getJson("/backtest"),getJson("/history-status")]);
  const radar=routeMap["/radar"];
  if(!radar&&!statusR&&!routes.some(([,v])=>v)){console.log(new Date().toLocaleTimeString(),"Gateway indisponivel; aguardando...");return}

  const matchCandidates=[];const sourceCounts={};
  for(const [route,payload] of routes){if(!payload)continue;const found=deepMatches(payload);sourceCounts[route]=found.length;matchCandidates.push(...found)}
  const matches=dedupeMatches(matchCandidates);
  const signalsRaw=[...deepSignalArrays(radar),...firstArray(signalsR,["signals","items","data"])];
  const eventsRaw=[...firstArray(radar,["events","timeline"]),...firstArray(eventsR,["events","items","data"])];
  const currentFps=new Set(signalsRaw.map(sigFingerprint));retireAbsentSignals(currentFps);
  const baselineOnly=!seen.initialized;
  const signals=signalsRaw.map(s=>normalizeSignal(s,baselineOnly)).filter(Boolean);
  const events=eventsRaw.map(normalizeEvent).filter(Boolean);
  seen.initialized=true;saveSeen();

  const aggregate={...routeMap,"/status":statusR};
  const telegramEvidence=Boolean(statusR?.telegram_connected??statusR?.telegramConnected??radar?.telegramConnected)||signalsRaw.length>0;
  const scanFlag=findFlag(aggregate,["autoscan","scanneractive","scanactive","radaractive"]);
  const provider=text(statusR?.api_provider,statusR?.apiProvider,radar?.apiProvider,"API-Football");
  const prelive=matches.filter(m=>m.state==="PRELIVE").length,live=matches.filter(m=>m.state==="LIVE").length;
  const status={id:"main",gateway_online:true,telegram_connected:telegramEvidence,auto_scan_active:scanFlag===null?(matches.length>0):scanFlag,shadow_mode:Boolean(statusR?.shadow_mode??statusR?.shadowMode??radar?.shadowMode??true),api_provider:provider,quota_daily_remaining:num(statusR?.quota_daily_remaining,statusR?.quotaDailyRemaining,radar?.quotaDailyRemaining),independent_sources:num(statusR?.independent_sources,statusR?.independentSources,radar?.independentSources)||0,last_sync_at:new Date().toISOString(),version:`${text(statusR?.version,radar?.version,"gateway")}|bridge-${VERSION}`};

  const r=await fetch(ingestUrl,{method:"POST",headers:{"content-type":"application/json","x-matchintel-key":ingestKey},body:JSON.stringify({matches,events,signals,status}),signal:AbortSignal.timeout(12000)});
  const raw=await r.text();if(!r.ok)throw new Error(`Cloud ${r.status}: ${raw}`);
  let cloud={};try{cloud=JSON.parse(raw)}catch{}
  const tickets=Array.isArray(ticketsR?.tickets)?ticketsR.tickets:[];
  let ticketCloud={};
  if(tickets.length){
    try{
      const tr=await fetch(ticketIngestUrl,{method:"POST",headers:{"content-type":"application/json","x-matchintel-key":ingestKey},body:JSON.stringify({tickets}),signal:AbortSignal.timeout(12000)});
      const tt=await tr.text();if(!tr.ok)throw new Error(`TicketCloud ${tr.status}: ${tt}`);try{ticketCloud=JSON.parse(tt)}catch{}
    }catch(e){console.error("tickets cloud:",e.message)}
  }
  const opportunities=Array.isArray(valueR?.opportunities)?valueR.opportunities:[];
  if(opportunities.length){
    try{
      const vr=await fetch(valueIngestUrl,{method:"POST",headers:{"content-type":"application/json","x-matchintel-key":ingestKey},body:JSON.stringify({opportunities}),signal:AbortSignal.timeout(12000)});
      const vt=await vr.text();if(!vr.ok)throw new Error(`ValueCloud ${vr.status}: ${vt}`);
    }catch(e){console.error("value cloud:",e.message)}
  }
  const perfRecords=Array.isArray(performanceR?.records)?performanceR.records:[];
  const perfSnapshot=performanceR?.summary&&typeof performanceR.summary==="object"?performanceR.summary:null;
  if(perfSnapshot){
    try{
      const pr=await fetch(performanceIngestUrl,{method:"POST",headers:{"content-type":"application/json","x-matchintel-key":ingestKey},body:JSON.stringify({records:perfRecords,snapshot:perfSnapshot}),signal:AbortSignal.timeout(12000)});
      const pt=await pr.text();if(!pr.ok)throw new Error(`PerformanceCloud ${pr.status}: ${pt}`);
    }catch(e){console.error("performance cloud:",e.message)}
  }
  const backtestRun=backtestR&&typeof backtestR==="object"?backtestR:null;
  if(backtestRun?.generated_at){
    try{
      const br=await fetch(backtestIngestUrl,{method:"POST",headers:{"content-type":"application/json","x-matchintel-key":ingestKey},body:JSON.stringify({run:backtestRun}),signal:AbortSignal.timeout(12000)});
      const bt=await br.text();if(!br.ok)throw new Error(`BacktestCloud ${br.status}: ${bt}`);
    }catch(e){console.error("backtest cloud:",e.message)}
  }
  const resolvedSignals=signalsRaw.filter(s=>String(s.resolutionStatus||"").toUpperCase()==="RESOLVED").length;
  const valueStrong=opportunities.filter(x=>x.status==="STRONG_VALUE").length,valueReady=opportunities.filter(x=>x.status==="VALUE").length;
  const readyTickets=tickets.filter(x=>x.status==="READY"||x.status==="LOCKED").length;
  const perfLabel=perfSnapshot?` perf=${perfSnapshot.settled_count||0}S/${perfSnapshot.observed_bets||0}O yield=${perfSnapshot.yield_pct==null?"—":Number(perfSnapshot.yield_pct).toFixed(1)+"%"}`:"";
  const btLabel=backtestR?` replay=${backtestR.source_quality?.audit_eligible||0}A/${backtestR.walk_forward?.prediction_count||0}W cand=${backtestR.candidate_count||0} promote=${backtestR.promotion_count||0}`:"";
  const histLabel=historyR?` hist=${historyR.history?.fixtures||0}/${historyR.targetFixtures||600} days=${historyR.history?.backfilledDays||0}/${historyR.targetDays||35} hphase=${historyR.phase||"?"}`:"";
  console.log(new Date().toLocaleTimeString(),`P11.0.4 sync OK | matches=${matches.length} prelive=${prelive} live=${live} signals=${signals.length} resolved=${resolvedSignals} events=${events.length} tickets=${readyTickets}/4 values=${valueReady}+${valueStrong}F${perfLabel}${btLabel}${histLabel}${baselineOnly?" | BASELINE BLOQUEADA":""}`);
  if(p3R?.lastSignalId)console.log("  p3 trace ->",`last=${p3R.lastSignalId} resolved=${p3R.resolved||0} unresolved=${p3R.unresolved||0} ambiguous=${p3R.ambiguous||0}`);
  const activeRoutes=Object.entries(sourceCounts).filter(([,n])=>n>0).map(([r,n])=>`${r}:${n}`).join(" ");
  if(activeRoutes)console.log("  radar sources ->",activeRoutes);console.log("  identity ->",`official=${identityStats.official} merged=${identityStats.mergedAliases} unsafe_prelive_blocked=${identityStats.suppressedUnsafePrelive} aliases_kept=${identityStats.keptAliases}`);
}
function deepSignalArrays(root){if(!root||typeof root!=="object")return[];const out=[];const visited=new Set();function walk(v,d){if(v===null||v===undefined||d>5||typeof v!=="object")return;if(visited.has(v))return;visited.add(v);if(Array.isArray(v)){for(const x of v)walk(x,d+1);return}for(const [k,x] of Object.entries(v)){if(/signal|telegram/i.test(k)&&Array.isArray(x))out.push(...x);else walk(x,d+1)}}walk(root,0);return out}

console.log(`MatchIntel Cloud Bridge v${VERSION} ativo | P3 TELEGRAM + P4A TICKETS + P4C2 VALUE + P5 PERFORMANCE + P6 BACKTEST + P7 HISTORY + P11.0.4 CANONICAL IDENTITY | intervalo ${every/1000}s`);
console.log("P11.0.4: provider ID vence alias; PRELIVE sem kickoff futuro valido nao e publicado. Freshness P11.0.2 permanece ativa.");
tick().catch(e=>console.error("sync:",e.message));
setInterval(()=>tick().catch(e=>console.error("sync:",e.message)),every);
