const oeCfg=()=>window.MATCHINTEL_CONFIG||null;
const oeEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const oeHeaders=c=>({apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`});
const OE_FRESH_MS=150*1000;
const OE_RELAY_MS=3*60*1000;
const OE_SIGNAL_MS=10*60*1000;
function oeAge(v){const t=new Date(v||0).getTime();return Number.isFinite(t)&&t?Date.now()-t:Number.POSITIVE_INFINITY}
/* P11_0_2_PROVIDER_FRESHNESS */
function oeProviderTime(m){const mi=m?.stats?._matchintel||{},sm=m?.source_matrix||{},raw=[mi.providerFetchedAt,sm.providerFetchedAt,sm.updatedAt,...(Array.isArray(sm.observations)?sm.observations.map(o=>o?.fetchedAt):[])];let xs=raw.map(v=>new Date(typeof v==='number'&&v<1e12?v*1000:v||0).getTime()).filter(Number.isFinite);if(!xs.length)xs=[new Date(m?.updated_at||0).getTime()].filter(Number.isFinite);return xs.length?new Date(Math.max(...xs)).toISOString():null}
function oeBridgeTime(m){return m?.stats?._matchintel?.bridgeSyncedAt||m?.updated_at||null}
function oeFresh(m){const a=oeAge(oeProviderTime(m));return a>=-120000&&a<=OE_FRESH_MS}
function oeRelayCurrent(m){const a=oeAge(oeBridgeTime(m));return a>=-120000&&a<=OE_RELAY_MS}
function oeAgeLabel(ms){if(!Number.isFinite(ms))return 'sem timestamp';const s=Math.max(0,Math.round(ms/1000));return s<90?`${s}s`:`${Math.round(s/60)} min`}
function oeLive(m){const s=`${m?.state||''} ${m?.phase||''}`.toUpperCase();return /\bLIVE\b|\b1H\b|\bHT\b|\b2H\b|\bET\b|\bP\b/.test(s)&&!/\bFT\b|FINISHED|AET|PEN/.test(s)}
function oeArr(v){if(Array.isArray(v))return v;if(v&&typeof v==='object')return [v.home??v[0]??0,v.away??v[1]??0];return [0,0]}
function oeN(v,i){const n=Number(oeArr(v)[i]);return Number.isFinite(n)?n:0}
function oeTotal(v){return oeN(v,0)+oeN(v,1)}
function oeMoment(m){const s=m?.stats||{};const h=oeN(s.dangerous,0)+oeN(s.sot,0)*5+oeN(s.shots,0)*1.4+oeN(s.corners,0)*2.2;const a=oeN(s.dangerous,1)+oeN(s.sot,1)*5+oeN(s.shots,1)*1.4+oeN(s.corners,1)*2.2;const t=h+a;if(t<=0)return {home:0,away:0,delta:0,label:'SEM LEITURA'};const hp=Math.round(h/t*100),ap=100-hp,d=Math.abs(hp-ap);return {home:hp,away:ap,delta:d,label:d>=35?'FORTE':d>=18?'MODERADO':'EQUILIBRADO'}}
function oeSignalTime(s){return new Date(s?.occurred_at||s?.created_at||0).getTime()||0}
function oeSignals(m,signals){return signals.filter(s=>s.match_key===m.match_key&&Date.now()-oeSignalTime(s)<=OE_SIGNAL_MS&&Date.now()-oeSignalTime(s)>=-120000)}
function oeProb(m){const p=Number(m?.best_probability);return Number.isFinite(p)?Math.max(0,Math.min(100,p)):null}
/* P9_2_TELEGRAM_CONVERGENCE */
function oeTelegramSupport(m,signals){const api=window.MatchIntelTelegramConvergence;if(!api?.support)return {rows:[],confirms:0,partials:0,diverges:0,rejected:0,unresolved:0,score:0};return api.support(m,signals)}
function oeEvidence(m){const s=m?.stats||{},flags=[];if(oeTotal(s.sot)>=2)flags.push('chutes no alvo');if(oeTotal(s.shots)>=6)flags.push('volume de finalizações');if(oeTotal(s.dangerous)>=18)flags.push('ataques perigosos');if(oeTotal(s.corners)>=3)flags.push('escanteios');const xg=oeTotal(s.xg);if(xg>=0.8)flags.push('xG observado');return flags}
function oeBaseGates(m){const p=oeProb(m),dq=Number(m?.data_quality||0),src=Number(m?.independent_sources||0),conf=Number(m?.conflicts||0);return {fresh:oeFresh(m),dq,src,conf,p,market:!!m?.best_market}}
function oeEvaluate(m,signals){const g=oeBaseGates(m),mom=oeMoment(m),ev=oeEvidence(m),tg=oeTelegramSupport(m,signals),sig=tg.confirms,missing=[];
  if(!g.fresh)missing.push('freshness válida');
  if(g.dq<60)missing.push(`DQ ≥60 (atual ${g.dq})`);
  if(g.src<1)missing.push('≥1 fonte independente');
  if(g.conf>0)missing.push('zero conflitos');
  if(!g.market)missing.push('mercado qualificado');
  if(g.p==null||g.p<65)missing.push(`probabilidade ≥65%${g.p==null?'':` (atual ${Math.round(g.p)}%)`}`);
  if(ev.length<1)missing.push('evidência estatística mínima');
  if(!g.fresh||g.conf>0||g.dq<40||g.src<1)return {stage:'EVITAR',tone:'avoid',rank:0,missing,ev,mom,signals:sig,telegram:tg,reason:!g.fresh?'dado atrasado':g.conf>0?'conflito entre fontes':g.dq<40?'DQ muito baixa':'fonte insuficiente'};
  const opportunity=g.p!=null&&g.p>=65&&g.dq>=60&&g.src>=1&&g.conf===0&&g.market&&ev.length>=1;
  if(!opportunity)return {stage:'AQUECENDO',tone:'warming',rank:1,missing,ev,mom,signals:sig,telegram:tg,reason:'faltam gates para oportunidade'};
  const strong=g.p>=72&&g.dq>=70&&g.src>=2&&ev.length>=2&&(mom.delta>=18||sig>=1);
  const elite=g.p>=80&&g.dq>=80&&g.src>=2&&ev.length>=3&&mom.delta>=35&&(sig>=1||oeTotal(m?.stats?.sot)>=5||oeTotal(m?.stats?.dangerous)>=30);
  if(elite)return {stage:'ELITE',tone:'elite',rank:4,missing:[],ev,mom,signals:sig,telegram:tg,reason:'convergência excepcional sob gates rígidos'};
  if(strong)return {stage:'FORTE',tone:'strong',rank:3,missing:[],ev,mom,signals:sig,telegram:tg,reason:'modelo + qualidade + múltiplas evidências convergentes'};
  return {stage:'OPORTUNIDADE',tone:'opportunity',rank:2,missing:[],ev,mom,signals:sig,telegram:tg,reason:'gates mínimos de oportunidade satisfeitos'};
}
function oeScore(m,e){const p=oeProb(m)||0,dq=Number(m?.data_quality||0),src=Math.min(3,Number(m?.independent_sources||0)),pri=Number(m?.priority||0);return e.rank*100+p*.4+dq*.3+src*8+e.ev.length*5+e.signals*8+e.mom.delta*.15+pri*.05}
function oeGateRow(label,ok,detail){return `<span class="oe-gate ${ok?'ok':'no'}"><i>${ok?'✓':'·'}</i><b>${oeEsc(label)}</b><small>${oeEsc(detail||'')}</small></span>`}
function oeCard(x,i){const {m,e,ss}=x,p=oeProb(m),score=(m.home_score!=null&&m.away_score!=null)?`${m.home_score}–${m.away_score}`:'—',providerAge=oeAge(oeProviderTime(m)),bridgeAge=oeAge(oeBridgeTime(m)),g=oeBaseGates(m);const gates=[['Freshness da fonte',g.fresh,oeAgeLabel(providerAge)],['DQ ≥60',g.dq>=60,`${g.dq}%`],['Fonte independente',g.src>=1,`${g.src}`],['Zero conflitos',g.conf===0,`${g.conf}`],['Mercado',g.market,m.best_market||'ausente'],['Prob. ≥65%',g.p!=null&&g.p>=65,g.p==null?'—':`${Math.round(g.p)}%`],['Evidência estatística',e.ev.length>=1,e.ev.length?e.ev.join(', '):'insuficiente']];return `<article class="oe-card ${e.tone}" data-match="${oeEsc(m.match_key)}"><div class="oe-card-top"><div><small>#${i+1} · ${oeEsc(m.competition||'')}</small><strong>${oeEsc(m.home)} × ${oeEsc(m.away)}</strong><span>${oeEsc(m.phase||m.state||'LIVE')} · ${m.minute!=null?`${m.minute}'`:'—'} · fonte há ${oeEsc(oeAgeLabel(providerAge))} · relay há ${oeEsc(oeAgeLabel(bridgeAge))}</span></div><b class="oe-score">${score}</b></div><div class="oe-stage-row"><span class="oe-stage ${e.tone}">${oeEsc(e.stage)}</span><span class="oe-market">${p==null||!m.best_market?'Sem leitura promovida':`${oeEsc(m.best_market)} · ${Math.round(p)}%`}</span></div><p class="oe-reason">${oeEsc(e.reason)}</p><div class="oe-gates">${gates.map(([a,b,c])=>oeGateRow(a,b,c)).join('')}</div><div class="oe-foot"><span><small>Momento</small><b>${oeEsc(e.mom.label)} · ${e.mom.delta} p.p.</b></span><span><small>Telegram CONFIRMA</small><b>${e.telegram?.confirms||0}</b></span><span><small>Gatilhos faltantes</small><b>${e.missing.length}</b></span></div>${(e.telegram?.rows||[]).length?`<div class="oe-telegram-convergence"><small>Telegram × Dados</small>${e.telegram.rows.slice(0,3).map(r=>`<span class="${r.tone}">${oeEsc(r.provider.name)} · ${oeEsc(r.status)}</span>`).join("")}</div>`:""}${e.missing.length?`<div class="oe-missing"><small>Para subir de estágio:</small>${e.missing.slice(0,4).map(g=>`<span>${oeEsc(g)}</span>`).join('')}</div>`:''}</article>`}
function oeSummary(rows){const c={AQUECENDO:0,OPORTUNIDADE:0,FORTE:0,ELITE:0,EVITAR:0};for(const x of rows)c[x.e.stage]=(c[x.e.stage]||0)+1;return c}
/* P9_3_SMART_ALERT_API */
window.MatchIntelLiveOpportunity={evaluate:oeEvaluate,isLive:oeLive,isFresh:oeFresh,probability:oeProb};
async function oeQ(c,table,params){const r=await fetch(`${c.SUPABASE_URL}/rest/v1/${table}?${params}`,{headers:oeHeaders(c),cache:'no-store'});if(!r.ok)throw new Error(`${table}: HTTP ${r.status}`);return r.json()}
async function oeLoad(){const c=oeCfg(),root=document.querySelector('#liveOpportunityEngine');if(!root)return;if(!c){setTimeout(oeLoad,800);return}try{const [matches,signals]=await Promise.all([oeQ(c,'matchintel_matches','select=*&order=updated_at.desc&limit=500'),oeQ(c,'matchintel_signals','select=*&order=created_at.desc&limit=200')]);const live=matches.filter(m=>oeLive(m)&&oeRelayCurrent(m)),rows=live.map(m=>{const ss=oeSignals(m,signals),e=oeEvaluate(m,ss);return {m,ss,e,score:oeScore(m,e)}}).sort((a,b)=>b.score-a.score),sum=oeSummary(rows);const badge=document.querySelector('#liveOpportunityBadge');if(badge)badge.textContent=`${sum.ELITE} elite · ${sum.FORTE} forte · ${sum.OPORTUNIDADE} oportunidade`;if(!live.length){root.innerHTML=`<div class="oe-empty"><strong>Opportunity Engine armado · 0 jogos LIVE</strong><span>Quando surgir uma partida ao vivo, o P9.1 começa em AQUECENDO/EVITAR e só promove OPORTUNIDADE, FORTE ou ELITE se todos os gates correspondentes forem satisfeitos.</span></div>`;return}root.innerHTML=`<div class="oe-summary"><span><small>Aquecendo</small><b>${sum.AQUECENDO}</b></span><span><small>Oportunidade</small><b>${sum.OPORTUNIDADE}</b></span><span><small>Forte</small><b>${sum.FORTE}</b></span><span><small>Elite</small><b>${sum.ELITE}</b></span><span><small>Evitar</small><b>${sum.EVITAR}</b></span></div><div class="oe-list">${rows.map(oeCard).join('')}</div><p class="oe-note">P9.1 permanece SHADOW. “Oportunidade/Forte/Elite” é uma classificação operacional do MatchIntel, não execução automática. Odds não são inventadas; P11.0.2 exige timestamp esportivo FRESH para promoção. Relay recente não transforma snapshot antigo em dado fresco.</p>`;}catch(e){root.innerHTML=`<div class="oe-empty"><strong>Opportunity Engine indisponível</strong><span>${oeEsc(e.message)}</span></div>`}}
window.addEventListener('DOMContentLoaded',()=>{oeLoad();setInterval(oeLoad,15000)});
