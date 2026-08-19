const tcCfg=()=>window.MATCHINTEL_CONFIG||null;
const tcEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const tcHeaders=c=>({apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`});
const TC_SIGNAL_FRESH_MS=10*60*1000;
const TC_MATCH_FRESH_MS=4*60*1000;

function tcAge(v){const t=new Date(v||0).getTime();return Number.isFinite(t)&&t?Date.now()-t:Number.POSITIVE_INFINITY}
function tcSignalTime(s){return new Date(s?.occurred_at||s?.created_at||0).getTime()||0}
function tcSignalFresh(s){const a=Date.now()-tcSignalTime(s);return a>=-120000&&a<=TC_SIGNAL_FRESH_MS}
function tcMatchFresh(m){const a=tcAge(m?.updated_at);return a>=-120000&&a<=TC_MATCH_FRESH_MS}
function tcNorm(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')}
function tcProvider(s){
  const hay=tcNorm(`${s?.provider_family||''} ${s?.provider_name||''}`);
  if(hay.includes('BETZORD'))return {kind:'BETZORD',name:s?.provider_name||'BETZORD'};
  if(hay.includes('MAFIA'))return {kind:'CHAT_MAFIA',name:s?.provider_name||'CHAT MÁFIA'};
  return {kind:'OTHER',name:s?.provider_name||s?.provider_family||'Telegram'};
}
function tcMarketFromText(text){
  const t=tcNorm(text);
  if(/OVER_?0?5.*HT|HT.*OVER_?0?5|OVER_?05.*1H|1H.*OVER_?05/.test(t))return 'OVER_05_HT';
  if(/OVER_?15.*FT|OVER_?1?5/.test(t))return 'OVER_15_FT';
  if(/OVER_?25.*FT|OVER_?2?5/.test(t))return 'OVER_25_FT';
  if(/BTTS|AMBAS.*MARCAM/.test(t))return 'BTTS';
  if(/CORNER|ESCANTEIO/.test(t))return 'CORNERS';
  return 'UNKNOWN';
}
function tcNormalizeMarket(raw){
  const t=tcNorm(raw);
  if(!t||t==='UNKNOWN'||t==='N_A')return 'UNKNOWN';
  if(/OVER_?0?5.*HT|OVER_?05.*HT|OVER_?0?5.*1H|OVER_?05.*1H/.test(t))return 'OVER_05_HT';
  if(/OVER_?1?5/.test(t))return 'OVER_15_FT';
  if(/OVER_?2?5/.test(t))return 'OVER_25_FT';
  if(t.includes('BTTS'))return 'BTTS';
  if(t.includes('CORNER'))return 'CORNERS';
  return t;
}
function tcSignalMarket(s){
  const provider=tcProvider(s);
  const raw=tcNormalizeMarket(s?.market);
  if(raw!=='UNKNOWN')return {market:raw,inferred:false,source:'parser'};
  const text=tcMarketFromText(`${s?.text_summary||''} ${s?.signal_type||''}`);
  if(text!=='UNKNOWN')return {market:text,inferred:false,source:'texto'};
  // Regra aprovada do projeto: BETZORD envia exclusivamente OVER 0.5 HT.
  // Por segurança, isso serve como contexto semântico, mas não autoriza CONFIRMA
  // enquanto o parser/mensagem não resolver explicitamente o mercado.
  if(provider.kind==='BETZORD')return {market:'OVER_05_HT',inferred:true,source:'politica_betzord'};
  return {market:'UNKNOWN',inferred:false,source:'nao_resolvido'};
}
function tcModelMarket(m){return tcNormalizeMarket(m?.best_market)}
function tcProb(m){const p=Number(m?.best_probability);return Number.isFinite(p)?Math.max(0,Math.min(100,p)):null}
function tcHtWindowOpen(m){
  const phase=tcNorm(m?.phase||m?.state);
  const minute=Number(m?.minute);
  if(/FT|2H|AET|PEN|FINISHED/.test(phase))return false;
  if(phase==='HT')return false;
  if(Number.isFinite(minute)&&minute>=45)return false;
  return true;
}
function tcMarketCompatible(signalMarket,modelMarket){
  if(signalMarket==='UNKNOWN'||modelMarket==='UNKNOWN')return null;
  return signalMarket===modelMarket;
}
function tcEvaluate(signal,match){
  const provider=tcProvider(signal),sm=tcSignalMarket(signal);
  if(!tcSignalFresh(signal))return {status:'REJEITADO',tone:'rejected',provider,signalMarket:sm,reason:'sinal expirado (>10 min)',support:0};
  if(provider.kind==='BETZORD'&&sm.market!=='OVER_05_HT')return {status:'REJEITADO',tone:'rejected',provider,signalMarket:sm,reason:'política BetZord: somente Over 0.5 HT',support:0};
  if(!signal?.match_key||!match)return {status:'NÃO RESOLVIDO',tone:'unresolved',provider,signalMarket:sm,reason:'partida ainda não vinculada com segurança',support:0};
  if(sm.market==='OVER_05_HT'&&!tcHtWindowOpen(match))return {status:'REJEITADO',tone:'rejected',provider,signalMarket:sm,reason:'janela do Over 0.5 HT já encerrou',support:0};

  const mm=tcModelMarket(match),p=tcProb(match),dq=Number(match?.data_quality||0),conf=Number(match?.conflicts||0),src=Number(match?.independent_sources||0),compatible=tcMarketCompatible(sm.market,mm);
  if(sm.inferred)return {status:'PARCIAL',tone:'partial',provider,signalMarket:sm,modelMarket:mm,probability:p,reason:'mercado inferido pela política BetZord; aguardando resolução explícita do parser',support:.35};
  if(sm.market==='UNKNOWN')return {status:'PARCIAL',tone:'partial',provider,signalMarket:sm,modelMarket:mm,probability:p,reason:'partida vinculada, mas mercado do sinal ainda não foi resolvido',support:.25};
  if(!tcMatchFresh(match))return {status:'PARCIAL',tone:'partial',provider,signalMarket:sm,modelMarket:mm,probability:p,reason:'partida vinculada, mas snapshot atual está antigo',support:.2};
  if(conf>0)return {status:'DIVERGE',tone:'diverge',provider,signalMarket:sm,modelMarket:mm,probability:p,reason:'há conflito ativo entre fontes do jogo',support:-.7};
  if(compatible===false&&mm!=='UNKNOWN'&&p!=null&&p>=65)return {status:'DIVERGE',tone:'diverge',provider,signalMarket:sm,modelMarket:mm,probability:p,reason:`modelo promove ${mm}, diferente do mercado do sinal`,support:-.8};
  if(compatible===true&&p!=null&&p<50&&dq>=50)return {status:'DIVERGE',tone:'diverge',provider,signalMarket:sm,modelMarket:mm,probability:p,reason:`modelo está em apenas ${Math.round(p)}% para o mesmo mercado`,support:-.65};
  if(compatible===true&&p!=null&&p>=65&&dq>=60&&src>=1)return {status:'CONFIRMA',tone:'confirm',provider,signalMarket:sm,modelMarket:mm,probability:p,reason:`mesmo mercado · modelo ${Math.round(p)}% · DQ ${dq}%`,support:1};
  if(compatible===true)return {status:'PARCIAL',tone:'partial',provider,signalMarket:sm,modelMarket:mm,probability:p,reason:`mercado compatível, mas faltam gates do MatchIntel (DQ ${dq}%${p==null?'':`, prob. ${Math.round(p)}%`})`,support:.55};
  return {status:'PARCIAL',tone:'partial',provider,signalMarket:sm,modelMarket:mm,probability:p,reason:'sinal vinculado; MatchIntel ainda não tem leitura comparável suficiente',support:.35};
}
function tcForMatch(match,signals){
  const rows=(signals||[]).filter(s=>s?.match_key===match?.match_key&&tcSignalFresh(s)).map(s=>({signal:s,...tcEvaluate(s,match)}));
  const uniq=new Map();
  for(const r of rows){
    const k=`${r.provider.kind}|${r.signalMarket.market}`;
    const old=uniq.get(k);
    if(!old||tcSignalTime(r.signal)>tcSignalTime(old.signal))uniq.set(k,r);
  }
  return [...uniq.values()];
}
function tcSupport(match,signals){
  const rows=tcForMatch(match,signals);
  return {
    rows,
    confirms:rows.filter(r=>r.status==='CONFIRMA').length,
    partials:rows.filter(r=>r.status==='PARCIAL').length,
    diverges:rows.filter(r=>r.status==='DIVERGE').length,
    rejected:rows.filter(r=>r.status==='REJEITADO').length,
    unresolved:rows.filter(r=>r.status==='NÃO RESOLVIDO').length,
    score:rows.reduce((a,r)=>a+Number(r.support||0),0)
  };
}

window.MatchIntelTelegramConvergence={evaluate:tcEvaluate,forMatch:tcForMatch,support:tcSupport,signalMarket:tcSignalMarket,provider:tcProvider};

function tcStatusBadge(r){return `<span class="tc-status ${r.tone}">${tcEsc(r.status)}</span>`}
function tcSourcePolicy(){
  return `<div class="tc-policy"><div><b>🔥 CHAT MÁFIA TOP 1</b><small>mercados variáveis · só confirma quando mercado + jogo + dados convergem</small></div><div><b>🥇 BETZORD VIP / ⚜️ PREMIUM</b><small><strong>POLÍTICA FIXA: somente OVER 0.5 HT.</strong> Mercado inferido pela origem permanece PARCIAL até o parser resolver explicitamente.</small></div></div>`;
}
function tcRow(signal,match){
  const r=tcEvaluate(signal,match),sm=r.signalMarket,age=Math.max(0,Math.round((Date.now()-tcSignalTime(signal))/1000));
  const game=match?`${match.home} × ${match.away}`:'Partida não resolvida';
  const summary=String(signal?.text_summary||signal?.signal_type||'').slice(0,145);
  return `<article class="tc-row ${r.tone}"><div class="tc-row-head"><div><small>${tcEsc(r.provider.name)} · há ${age}s</small><strong>${tcEsc(game)}</strong><span>${tcEsc(summary)}</span></div>${tcStatusBadge(r)}</div><div class="tc-meta"><span><small>Mercado sinal</small><b>${tcEsc(sm.market)}${sm.inferred?' · inferido':''}</b></span><span><small>Modelo</small><b>${tcEsc(r.modelMarket||'—')}</b></span><span><small>Prob.</small><b>${r.probability==null?'—':`${Math.round(r.probability)}%`}</b></span></div><p>${tcEsc(r.reason)}</p></article>`;
}
async function tcQ(c,table,params){const r=await fetch(`${c.SUPABASE_URL}/rest/v1/${table}?${params}`,{headers:tcHeaders(c),cache:'no-store'});if(!r.ok)throw new Error(`${table}: HTTP ${r.status}`);return r.json()}
async function tcLoad(){
  const c=tcCfg(),root=document.querySelector('#telegramConvergence');
  if(!root)return;
  if(!c){setTimeout(tcLoad,800);return}
  try{
    const [signals,matches]=await Promise.all([
      tcQ(c,'matchintel_signals','select=*&order=created_at.desc&limit=120'),
      tcQ(c,'matchintel_match_lifecycle','select=*&lifecycle_state=eq.ATIVO&order=updated_at.desc&limit=500')
    ]);
    const map=new Map(matches.map(m=>[m.match_key,m]));
    const recent=signals.filter(s=>tcSignalFresh(s));
    const rows=recent.map(s=>({s,m:s.match_key?map.get(s.match_key):null,r:tcEvaluate(s,s.match_key?map.get(s.match_key):null)}));
    const counts={CONFIRMA:0,PARCIAL:0,DIVERGE:0,REJEITADO:0,'NÃO RESOLVIDO':0};
    for(const x of rows)counts[x.r.status]=(counts[x.r.status]||0)+1;
    const betzord=rows.filter(x=>x.r.provider.kind==='BETZORD').length;
    const mafia=rows.filter(x=>x.r.provider.kind==='CHAT_MAFIA').length;
    const badge=document.querySelector('#telegramConvergenceBadge');
    if(badge)badge.textContent=`${counts.CONFIRMA} confirma · ${counts.DIVERGE} diverge · ${counts['NÃO RESOLVIDO']} não resolvido`;
    root.innerHTML=`${tcSourcePolicy()}<div class="tc-summary"><span><small>Confirma</small><b>${counts.CONFIRMA}</b></span><span><small>Parcial</small><b>${counts.PARCIAL}</b></span><span><small>Diverge</small><b>${counts.DIVERGE}</b></span><span><small>Rejeitado</small><b>${counts.REJEITADO}</b></span><span><small>Não resolvido</small><b>${counts['NÃO RESOLVIDO']}</b></span></div><div class="tc-source-count"><span>Chat Máfia: <b>${mafia}</b></span><span>BetZord: <b>${betzord}</b></span><span>Janela: <b>10 min</b></span></div>${rows.length?`<div class="tc-list">${rows.slice(0,20).map(x=>tcRow(x.s,x.m)).join('')}</div>`:`<div class="tc-empty">Nenhum sinal Telegram fresco nos últimos 10 minutos.</div>`}<p class="tc-note">P9.2 é SHADOW: Telegram nunca sobe uma oportunidade sozinho. CONFIRMA pode reforçar convergência; DIVERGE impede que o sinal seja usado como confirmação; NÃO RESOLVIDO permanece visível sem ser associado por aproximação insegura.</p>`;
  }catch(e){root.innerHTML=`<div class="tc-empty">Telegram × Dados indisponível · ${tcEsc(e.message)}</div>`}
}
window.addEventListener('DOMContentLoaded',()=>{tcLoad();setInterval(tcLoad,15000)});
