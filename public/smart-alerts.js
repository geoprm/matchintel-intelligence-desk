const saCfg=()=>window.MATCHINTEL_CONFIG||null;
const saEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const saHeaders=c=>({apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`});
const SA_SIGNAL_MS=10*60*1000;
const SA_MATCH_MS=4*60*1000;
const SA_STORE='matchintel-p93-alert-state-v1';
const SA_LOG='matchintel-p93-alert-log-v1';
const SA_MAX_LOG=40;
/* P9_4_BACKEND_PUSH_OWNER */
const SA_BACKEND_PUSH_OWNER=true;

function saNorm(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')}
function saTime(v){const t=new Date(v||0).getTime();return Number.isFinite(t)?t:0}
function saAge(v){const t=saTime(v);return t?Date.now()-t:Number.POSITIVE_INFINITY}
function saSignalTime(s){return saTime(s?.occurred_at||s?.created_at)}
function saFreshSignal(s){const a=Date.now()-saSignalTime(s);return a>=-120000&&a<=SA_SIGNAL_MS}
function saFreshMatch(m){const a=saAge(m?.updated_at);return a>=-120000&&a<=SA_MATCH_MS}
function saProvider(s){const api=window.MatchIntelTelegramConvergence;return api?.provider?api.provider(s):{kind:saNorm(`${s?.provider_family||''} ${s?.provider_name||''}`).includes('MAFIA')?'CHAT_MAFIA':'OTHER',name:s?.provider_name||'Telegram'}}
function saTcEval(s,m){const api=window.MatchIntelTelegramConvergence;return api?.evaluate?api.evaluate(s,m):{status:'PARCIAL',tone:'partial',reason:'P9.2 ainda carregando',signalMarket:{market:s?.market||'UNKNOWN'}}}
function saMafiaStage(s){
  if(saProvider(s).kind!=='CHAT_MAFIA')return null;
  const t=saNorm(`${s?.state||''} ${s?.signal_type||''} ${s?.text_summary||''}`);
  if(/APITADACO|APITADASSO|APITADISSIMO/.test(t))return {stage:'APITADAÇO',rank:4};
  if(/APITOU|APITADO|APITADA|JOGO_APITOU/.test(t))return {stage:'APITOU',rank:3};
  if(/JOGO_FIXADO|TEM_JOGO_FIXADO|FIXADO|FIXEI|FIXOU|FIXAR/.test(t)||s?.pinned)return {stage:'FIXADO',rank:2};
  return {stage:'RADAR',rank:1};
}
function saTextMarket(s){
  const t=saNorm(`${s?.market||''} ${s?.signal_type||''} ${s?.text_summary||''}`);
  if(/CORNER|ESCANTEIO|CANTO|ASIATICO.*ESCANTEIO|ESCANTEIO.*ASIATICO/.test(t))return 'CORNERS';
  if(/GOL|GOAL|OVER_?0?5.*HT|OVER_?05.*HT/.test(t))return 'GOAL';
  return 'UNKNOWN';
}
function saMinute(m){const n=Number(m?.minute);return Number.isFinite(n)?n:null}
function saWindow(m,s){
  const min=saMinute(m),market=saTextMarket(s),stage=saMafiaStage(s);
  if(min==null||!stage)return null;
  // Regra aprovada: janela específica do Chat Máfia para entrada em escanteios aos 35' do HT.
  // Abrimos a janela em 35 e mantemos até 39 para não perder o alerta por atraso de polling.
  if(min>=35&&min<40&&market==='CORNERS')return {code:'CORNER_HT_35',label:"35' HT · ESCANTEIOS",priority:4};
  // Fim do primeiro tempo: gols tardios do HT.
  if(min>=40&&min<45&&market==='GOAL')return {code:'GOAL_HT_LATE',label:'FIM HT · GOL',priority:4};
  // Segundo tempo já reiniciado e sinal APITOU/APITADAÇO.
  if(min>=46&&min<60&&stage.rank>=3)return {code:'SECOND_HALF_APITOU',label:'2º TEMPO · APITOU',priority:3};
  // Janela tardia: preparação aos ~80 e orientação mais forte aos 85.
  if(min>=85&&min<91&&(market==='CORNERS'||market==='GOAL'))return {code:'LATE_85',label:"85' · JANELA TARDIA",priority:4};
  if(min>=80&&min<85&&(market==='CORNERS'||market==='GOAL'))return {code:'LATE_80',label:"80' · PREPARAR JANELA",priority:3};
  return null;
}
function saAlignment(evalr){
  if(evalr?.status==='CONFIRMA')return {code:'CONVERGE',label:'MatchIntel confirma',tone:'confirm'};
  if(evalr?.status==='DIVERGE')return {code:'DIVERGE',label:'MatchIntel diverge',tone:'diverge'};
  if(evalr?.status==='REJEITADO')return {code:'REJECT',label:'MatchIntel rejeita',tone:'rejected'};
  if(evalr?.status==='NÃO RESOLVIDO')return {code:'UNRESOLVED',label:'não resolvido',tone:'unresolved'};
  return {code:'PARTIAL',label:'convergência parcial',tone:'partial'};
}
function saLoadState(){try{return JSON.parse(localStorage.getItem(SA_STORE)||'{}')}catch{return {}}}
function saSaveState(x){try{localStorage.setItem(SA_STORE,JSON.stringify(x))}catch{}}
function saLoadLog(){try{return JSON.parse(localStorage.getItem(SA_LOG)||'[]')}catch{return []}}
function saSaveLog(rows){try{localStorage.setItem(SA_LOG,JSON.stringify(rows.slice(0,SA_MAX_LOG)))}catch{}}
function saRemember(key,ttlMs=6*60*60*1000){
  const st=saLoadState(),now=Date.now();
  for(const [k,v] of Object.entries(st))if(now-Number(v||0)>ttlMs)delete st[k];
  if(st[key])return false;
  st[key]=now;saSaveState(st);return true;
}
function saLog(item){const rows=saLoadLog();rows.unshift({...item,at:Date.now()});saSaveLog(rows)}
async function saNotify(title,body,tag){
  if(!('Notification' in window)||Notification.permission!=='granted')return false;
  try{
    if('serviceWorker' in navigator){
      const reg=await navigator.serviceWorker.ready;
      await reg.showNotification(title,{body,tag,renotify:false,icon:'/icon-192.png',badge:'/icon-192.png',data:{url:'/?screen=live'}});
      return true;
    }
    new Notification(title,{body,tag});
    return true;
  }catch(e){console.warn('P9.3 notification',e);return false}
}
function saMatchName(m){return m?`${m.home} × ${m.away}`:'Partida não resolvida'}
function saSignalKey(s){return s?.fingerprint||s?.source_event_id||`${saProvider(s).kind}|${s?.match_key||'?' }|${saSignalTime(s)}|${String(s?.text_summary||'').slice(0,40)}`}
function saAlertFromMafia(s,m){
  const stage=saMafiaStage(s);if(!stage||stage.stage==='RADAR'||!saFreshSignal(s))return [];
  const ev=saTcEval(s,m),alignment=saAlignment(ev),window=saWindow(m,s),market=ev?.signalMarket?.market||saTextMarket(s),name=saMatchName(m),dq=Number(m?.data_quality||0);
  const out=[];
  // FIXADO deve ser sinalizado MESMO quando MatchIntel diverge. A divergência muda o texto, não apaga o alerta externo.
  const baseKey=`mafia:${saSignalKey(s)}:${stage.stage}:${alignment.code}`;
  if(saRemember(baseKey)){
    let title=stage.stage==='APITADAÇO'?'🚨 APITADAÇO · Chat Máfia':stage.stage==='APITOU'?'🚨 APITOU · Chat Máfia':'🔥 JOGO FIXADO · Chat Máfia';
    if(alignment.code==='DIVERGE')title=stage.stage==='FIXADO'?'🔥 FIXADO · ⚠️ MatchIntel diverge':`${title} · ⚠️ DIVERGÊNCIA`;
    const body=`${name} · ${market||'mercado não resolvido'} · ${alignment.label}${m?` · DQ ${dq}%`:''}${alignment.code==='DIVERGE'?' · revisar; NÃO promover automaticamente':''}`;
    out.push({kind:'MAFIA',level:stage.stage,alignment:alignment.code,tone:alignment.tone,title,body,match_key:s?.match_key||null,market});
  }
  if(window){
    const wk=`window:${s?.match_key||saSignalKey(s)}:${window.code}:${stage.stage}`;
    if(saRemember(wk,3*60*60*1000)){
      let title=`⏱️ ${window.label} · Chat Máfia`;
      if(alignment.code==='DIVERGE')title+=` · ⚠️ DIVERGE`;
      const body=`${name} · ${stage.stage}${market&&market!=='UNKNOWN'?` · ${market}`:''} · ${alignment.label}${alignment.code==='DIVERGE'?' · sinalizar, mas não promover automaticamente':''}`;
      out.push({kind:'WINDOW',level:window.code,alignment:alignment.code,tone:alignment.tone,title,body,match_key:s?.match_key||null,market});
    }
  }
  return out;
}
function saStageRank(s){return ({EVITAR:0,AQUECENDO:1,OPORTUNIDADE:2,FORTE:3,ELITE:4})[s]??0}
function saOpportunityAlerts(matches,signals){
  const api=window.MatchIntelLiveOpportunity;
  if(!api?.evaluate)return [];
  const st=saLoadState(),out=[];
  for(const m of matches){
    if(!api.isLive?.(m)||!saFreshMatch(m))continue;
    const ss=(signals||[]).filter(s=>s?.match_key===m.match_key&&saFreshSignal(s));
    const e=api.evaluate(m,ss),key=`stage:${m.match_key}`,prev=String(st[key+'-value']||'');
    const prevRank=saStageRank(prev),nowRank=saStageRank(e.stage);
    if(nowRank>=2&&nowRank>prevRank){
      const alertKey=`stage-alert:${m.match_key}:${e.stage}`;
      if(saRemember(alertKey,6*60*60*1000)){
        const icon=e.stage==='ELITE'?'🏆':e.stage==='FORTE'?'🟢':'🔵';
        out.push({kind:'MATCHINTEL',level:e.stage,alignment:'MODEL',tone:e.tone,title:`${icon} MatchIntel · ${e.stage}`,body:`${saMatchName(m)} · ${m.best_market||'mercado'}${m.best_probability!=null?` · ${Math.round(Number(m.best_probability))}%`:''} · DQ ${Number(m.data_quality||0)}%`,match_key:m.match_key,market:m.best_market||null});
      }
    }
    st[key+'-value']=e.stage;st[key+'-at']=Date.now();
  }
  saSaveState(st);
  return out;
}
async function saProcess(matches,signals){
  const map=new Map(matches.map(m=>[m.match_key,m])),alerts=[];
  for(const s of signals.filter(saFreshSignal)){
    if(saProvider(s).kind!=='CHAT_MAFIA')continue;
    alerts.push(...saAlertFromMafia(s,s.match_key?map.get(s.match_key):null));
  }
  alerts.push(...saOpportunityAlerts(matches,signals));
  for(const a of alerts){
    saLog(a);
    if(!SA_BACKEND_PUSH_OWNER) await saNotify(a.title,a.body,`matchintel:${a.kind}:${a.match_key||'na'}:${a.level}`);
  }
  return alerts;
}
function saRenderRow(a){
  const t=new Date(a.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  return `<article class="sa-row ${saEsc(a.tone||'')}"><div><small>${t} · ${saEsc(a.kind)}</small><strong>${saEsc(a.title)}</strong><span>${saEsc(a.body)}</span></div><b>${saEsc(a.level||'')}</b></article>`;
}
async function saQ(c,table,params){const r=await fetch(`${c.SUPABASE_URL}/rest/v1/${table}?${params}`,{headers:saHeaders(c),cache:'no-store'});if(!r.ok)throw new Error(`${table}: HTTP ${r.status}`);return r.json()}
async function saLoad(){
  const c=saCfg(),root=document.querySelector('#smartAlertCenter');if(!root)return;
  if(!c){setTimeout(saLoad,800);return}
  try{
    const [matches,signals]=await Promise.all([
      saQ(c,'matchintel_match_lifecycle','select=*&lifecycle_state=eq.ATIVO&order=updated_at.desc&limit=500'),
      saQ(c,'matchintel_signals','select=*&order=created_at.desc&limit=200')
    ]);
    await saProcess(matches,signals);
    const log=saLoadLog(),badge=document.querySelector('#smartAlertBadge');
    if(badge)badge.textContent=`${log.length} recentes · antispam ativo`;
    root.innerHTML=`<div class="sa-rules"><span><b>🔥 FIXADO</b><small>alerta mesmo com divergência; divergência vem destacada</small></span><span><b>⏱️ 35' HT</b><small>janela específica de escanteios do Chat Máfia</small></span><span><b>80' → 85'</b><small>preparação e janela tardia para escanteios/gol</small></span><span><b>🔵→🟢→🏆</b><small>MatchIntel alerta somente ao subir para OPORTUNIDADE/FORTE/ELITE</small></span></div>${log.length?`<div class="sa-list">${log.slice(0,12).map(saRenderRow).join('')}</div>`:`<div class="sa-empty">Nenhum Smart Alert disparado ainda. O motor está armado.</div>`}<p class="sa-note">P9.3 mantém dois eixos independentes; no P9.4 o backend é responsável pelo push e esta camada local fica como log/visual.  prioridade externa do Chat Máfia e concordância interna do MatchIntel. Um FIXADO/APITOU nunca é escondido por divergência; ele é sinalizado com aviso. Divergência impede promoção automática, não a visibilidade do sinal.</p>`;
  }catch(e){root.innerHTML=`<div class="sa-empty">Smart Alert Center indisponível · ${saEsc(e.message)}</div>`}
}
window.addEventListener('DOMContentLoaded',()=>{saLoad();setInterval(saLoad,15000)});
