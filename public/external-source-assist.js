const eaCfg=()=>window.MATCHINTEL_CONFIG||null;
const eaEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const eaHeaders=c=>({apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`});
const EA_TTL=15*60*1000;
const EA_LINK_TTL=90*60*1000;
const EA_KEY='matchintel_external_assist_v1';

function eaSafeUrl(v){try{const u=new URL(String(v||''));return /^https?:$/.test(u.protocol)?u.href:null}catch{return null}}
function eaNorm(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')}
function eaNow(){return Date.now()}
function eaTime(v){const t=new Date(v||0).getTime();return Number.isFinite(t)?t:0}
function eaFresh(v,ttl=EA_TTL){const t=eaTime(v);return !!t&&eaNow()-t>=-120000&&eaNow()-t<=ttl}
function eaStoreRead(){try{const x=JSON.parse(localStorage.getItem(EA_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function eaStoreWrite(rows){localStorage.setItem(EA_KEY,JSON.stringify((rows||[]).slice(-300)))}
function eaClean(){
  const rows=eaStoreRead().filter(r=>eaFresh(r.observedAt,24*60*60*1000));
  eaStoreWrite(rows);return rows;
}
function eaObsFresh(){return eaClean().filter(r=>eaFresh(r.observedAt,EA_TTL))}
function eaId(){return `ea_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
function eaMatchLabel(m){return m?`${m.home||'Casa'} × ${m.away||'Fora'}`:'Partida ainda não resolvida'}
function eaSourceKind(link){
  const h=eaNorm(`${link?.provider_kind||''} ${link?.provider_family||''} ${link?.provider_name||''} ${link?.url||''}`);
  if(h.includes('CHAT_MAFIA')||h.includes('MAFIA'))return 'CHAT_MAFIA';
  if(h.includes('BETZORD'))return 'BETZORD';
  if(h.includes('COMMUNITY')||h.includes('RESENHA'))return 'COMMUNITY';
  return 'OTHER';
}
function eaIsBet365(url){return /(^|\.)bet365\./i.test((()=>{try{return new URL(url).hostname}catch{return''}})())}
function eaSearchUrl(site,m){
  const q=encodeURIComponent(`site:${site} "${m?.home||''}" "${m?.away||''}"`);
  return `https://www.google.com/search?q=${q}`;
}
function eaMarketOptions(){
  return [
    ['UNKNOWN','Não informado'],
    ['OVER_05_HT','Over 0.5 HT'],
    ['CORNERS_HT','Escanteios HT'],
    ['CORNERS_FT','Escanteios FT'],
    ['LATE_GOAL','Gol tardio'],
    ['OVER_15_FT','Over 1.5 FT'],
    ['OVER_25_FT','Over 2.5 FT'],
    ['BTTS','Ambas marcam']
  ].map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
}
function eaReadingLabel(v){return v==='SUPPORTS'?'APOIA':v==='DIVERGES'?'DIVERGE':'NEUTRO'}
function eaObsCard(o){
  const age=Math.max(0,Math.round((eaNow()-eaTime(o.observedAt))/60000));
  const source=eaEsc(o.source||'Manual'),reading=eaReadingLabel(o.reading);
  const meta=[
    o.minute?`${eaEsc(o.minute)}'`:null,
    o.score?`placar ${eaEsc(o.score)}`:null,
    o.corners?`esc. ${eaEsc(o.corners)}`:null,
    o.sot?`SOT ${eaEsc(o.sot)}`:null,
    o.market&&o.market!=='UNKNOWN'?eaEsc(o.market):null,
    o.odds?`odd ${eaEsc(o.odds)}`:null
  ].filter(Boolean).join(' · ');
  return `<div class="ea-observation ${String(o.reading||'NEUTRAL').toLowerCase()}"><div><b>${source} · ${reading}</b><small>${age} min atrás${o.matchLabel?` · ${eaEsc(o.matchLabel)}`:''}</small></div><span>${meta||'validação sem métricas adicionais'}</span>${o.notes?`<p>${eaEsc(o.notes)}</p>`:''}</div>`;
}
async function eaQ(c,table,params){
  const r=await fetch(`${c.SUPABASE_URL}/rest/v1/${table}?${params}`,{headers:eaHeaders(c),cache:'no-store'});
  if(!r.ok)throw new Error(`${table}: HTTP ${r.status}`);
  return r.json();
}
function eaAssistSupport(matchOrKey){
  const key=typeof matchOrKey==='string'?matchOrKey:matchOrKey?.match_key;
  const rows=eaObsFresh().filter(r=>key&&r.matchKey===key);
  return {
    rows,
    supports:rows.filter(r=>r.reading==='SUPPORTS').length,
    diverges:rows.filter(r=>r.reading==='DIVERGES').length,
    neutral:rows.filter(r=>!['SUPPORTS','DIVERGES'].includes(r.reading)).length,
    // Never becomes an independent automatic source. It is an operator observation only.
    independentSportsSources:0,
    mode:'ASSISTED'
  };
}
window.MatchIntelExternalAssist={
  support:eaAssistSupport,
  observations:()=>eaObsFresh(),
  mode:'ASSISTED',
  independentSportsSources:0
};

function eaForm(link,m){
  const id=eaEsc(link?.link_key||link?.url||'manual');
  return `<form class="ea-form" data-ea-form="${id}">
    <div class="ea-form-head"><b>Registrar verificação assistida</b><small>expira operacionalmente em 15 min · não conta como fonte automática independente</small></div>
    <div class="ea-grid">
      <label>Fonte<select name="source"><option>Bet365</option><option>SofaScore</option><option>Flashscore</option><option>Outra fonte visual</option></select></label>
      <label>Leitura<select name="reading"><option value="NEUTRAL">Neutro</option><option value="SUPPORTS">Apoia</option><option value="DIVERGES">Diverge</option></select></label>
      <label>Minuto<input name="minute" inputmode="numeric" placeholder="35"></label>
      <label>Placar<input name="score" placeholder="0-0"></label>
      <label>Escanteios<input name="corners" placeholder="3-2"></label>
      <label>SOT<input name="sot" placeholder="2-1"></label>
      <label>Mercado<select name="market">${eaMarketOptions()}</select></label>
      <label>Odd observada<input name="odds" inputmode="decimal" placeholder="1.82"></label>
    </div>
    <label>Observação<input name="notes" maxlength="220" placeholder="Ex.: pressão alta, linha caiu, jogo perdeu intensidade..."></label>
    <div class="ea-actions"><button type="submit" class="ea-save">Salvar como ASSISTIDO</button><button type="button" class="ea-cancel" data-ea-cancel="${id}">Cancelar</button></div>
    <input type="hidden" name="matchKey" value="${eaEsc(link?.match_key||'')}">
    <input type="hidden" name="matchLabel" value="${eaEsc(eaMatchLabel(m))}">
    <input type="hidden" name="linkKey" value="${id}">
  </form>`;
}
function eaLinkCard(link,m){
  const url=eaSafeUrl(link?.url),kind=eaSourceKind(link),isB=url&&eaIsBet365(url);
  const age=Math.max(0,Math.round((eaNow()-eaTime(link?.occurred_at||link?.updated_at))/60000));
  const state=eaEsc(link?.verification_state||link?.resolution_state||'PENDING');
  const label=eaMatchLabel(m);
  const id=eaEsc(link?.link_key||url||Math.random());
  const source=kind==='CHAT_MAFIA'?'🔥 Chat Máfia':kind==='BETZORD'?'🥇 BetZord':kind==='COMMUNITY'?'💬 Comunidade':'Telegram';
  const buttons=[
    url?`<button type="button" data-ea-open="${eaEsc(url)}">${isB?'Abrir Bet365':'Abrir link'}</button>`:'',
    m?`<button type="button" data-ea-open="${eaEsc(eaSearchUrl('sofascore.com',m))}">Pesquisar SofaScore</button>`:'',
    m?`<button type="button" data-ea-open="${eaEsc(eaSearchUrl('flashscore.com',m))}">Pesquisar Flashscore</button>`:'',
    `<button type="button" class="ea-verify" data-ea-verify="${id}">Validar dados</button>`
  ].filter(Boolean).join('');
  return `<article class="ea-link-card" data-ea-card="${id}">
    <div class="ea-card-head"><div><small>${source} · há ${age} min</small><strong>${eaEsc(label)}</strong><span>${eaEsc(String(link?.text_summary||'Link para acompanhamento').slice(0,180))}</span></div><span class="ea-state">${state}</span></div>
    <div class="ea-link-actions">${buttons}</div>
    <div class="ea-form-slot"></div>
  </article>`;
}
function eaManualLauncher(matches){
  const opts=(matches||[]).slice(0,30).map(m=>`<option value="${eaEsc(m.match_key||'')}">${eaEsc(eaMatchLabel(m))}</option>`).join('');
  return `<details class="ea-manual"><summary>+ Validação manual sem link Telegram</summary>
    <form id="eaManualForm" class="ea-form">
      <div class="ea-form-head"><b>Fonte externa assistida</b><small>use quando a API estiver em reserva e você conferir o jogo no navegador</small></div>
      <label>Partida<select name="matchKey"><option value="">Sem vínculo</option>${opts}</select></label>
      <div class="ea-grid">
        <label>Fonte<select name="source"><option>Bet365</option><option>SofaScore</option><option>Flashscore</option><option>Outra fonte visual</option></select></label>
        <label>Leitura<select name="reading"><option value="NEUTRAL">Neutro</option><option value="SUPPORTS">Apoia</option><option value="DIVERGES">Diverge</option></select></label>
        <label>Minuto<input name="minute" inputmode="numeric" placeholder="35"></label>
        <label>Placar<input name="score" placeholder="0-0"></label>
        <label>Escanteios<input name="corners" placeholder="3-2"></label>
        <label>SOT<input name="sot" placeholder="2-1"></label>
        <label>Mercado<select name="market">${eaMarketOptions()}</select></label>
        <label>Odd observada<input name="odds" inputmode="decimal" placeholder="1.82"></label>
      </div>
      <label>Observação<input name="notes" maxlength="220" placeholder="O que você verificou?"></label>
      <button type="submit" class="ea-save">Salvar como ASSISTIDO</button>
    </form>
  </details>`;
}
function eaSaveForm(form,matches){
  const fd=new FormData(form),matchKey=String(fd.get('matchKey')||''),match=(matches||[]).find(x=>x.match_key===matchKey);
  const row={
    id:eaId(),matchKey:matchKey||null,matchLabel:match?eaMatchLabel(match):String(fd.get('matchLabel')||''),
    linkKey:String(fd.get('linkKey')||'')||null,source:String(fd.get('source')||'Manual'),
    reading:String(fd.get('reading')||'NEUTRAL'),minute:String(fd.get('minute')||'').trim(),
    score:String(fd.get('score')||'').trim(),corners:String(fd.get('corners')||'').trim(),
    sot:String(fd.get('sot')||'').trim(),market:String(fd.get('market')||'UNKNOWN'),
    odds:String(fd.get('odds')||'').trim(),notes:String(fd.get('notes')||'').trim(),
    observedAt:new Date().toISOString(),mode:'ASSISTED',independentSportsSource:false
  };
  const rows=eaClean();rows.push(row);eaStoreWrite(rows);
  return row;
}
function eaBind(root,links,matches){
  root.querySelectorAll('[data-ea-open]').forEach(b=>b.onclick=()=>{const u=eaSafeUrl(b.dataset.eaOpen);if(u)window.open(u,'_blank','noopener,noreferrer')});
  root.querySelectorAll('[data-ea-verify]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.eaVerify,card=root.querySelector(`[data-ea-card="${CSS.escape(id)}"]`),slot=card?.querySelector('.ea-form-slot');
    const link=links.find(x=>String(x.link_key||x.url)===id),m=matches.find(x=>x.match_key===link?.match_key);
    if(slot){slot.innerHTML=eaForm(link,m);eaBindForms(root,links,matches)}
  });
  eaBindForms(root,links,matches);
}
function eaBindForms(root,links,matches){
  root.querySelectorAll('.ea-form').forEach(form=>{
    if(form.dataset.bound)return;form.dataset.bound='1';
    form.onsubmit=e=>{e.preventDefault();eaSaveForm(form,matches);eaLoad(true)};
  });
  root.querySelectorAll('[data-ea-cancel]').forEach(b=>b.onclick=()=>{const slot=b.closest('.ea-form-slot');if(slot)slot.innerHTML=''});
}
function eaRenderObs(){
  const box=document.querySelector('#externalAssistRecent');if(!box)return;
  const rows=eaObsFresh().sort((a,b)=>eaTime(b.observedAt)-eaTime(a.observedAt));
  box.innerHTML=rows.length?rows.slice(0,8).map(eaObsCard).join(''):`<div class="ea-empty">Nenhuma validação assistida fresca. As observações expiram em 15 minutos para uso operacional.</div>`;
}
let eaLast=0;
async function eaLoad(force=false){
  const c=eaCfg(),root=document.querySelector('#externalSourceAssist');if(!root)return;
  if(!c){setTimeout(()=>eaLoad(force),800);return}
  if(!force&&eaNow()-eaLast<5000)return;eaLast=eaNow();
  try{
    const [links,matches]=await Promise.all([
      eaQ(c,'matchintel_telegram_links','select=*&order=occurred_at.desc&limit=80'),
      eaQ(c,'matchintel_match_lifecycle','select=*&order=updated_at.desc&limit=200')
    ]);
    const map=new Map(matches.map(m=>[m.match_key,m]));
    const freshLinks=links.filter(l=>eaFresh(l.occurred_at||l.updated_at,EA_LINK_TTL));
    const mafia=freshLinks.filter(l=>eaSourceKind(l)==='CHAT_MAFIA').length;
    const unresolved=freshLinks.filter(l=>!l.match_key).length;
    const assisted=eaObsFresh().length;
    const badge=document.querySelector('#externalAssistBadge');
    if(badge)badge.textContent=`${mafia} Máfia · ${assisted} assistido(s)`;
    root.innerHTML=`<div class="ea-mode"><div><b>🟡 EXTERNAL SOURCE ASSIST · ASSISTIDO</b><small>Bet365 / SofaScore / Flashscore ajudam na contingência sem fingir coleta automática.</small></div><span>não conta como 3ª fonte esportiva</span></div>
      <div class="ea-kpis"><span><small>Links frescos</small><b>${freshLinks.length}</b></span><span><small>Chat Máfia</small><b>${mafia}</b></span><span><small>Não resolvidos</small><b>${unresolved}</b></span><span><small>Validações 15m</small><b>${assisted}</b></span></div>
      ${eaManualLauncher(matches)}
      <div class="ea-subtitle"><b>Links recentes para verificar</b><small>link do grupo = radar; nunca vira entrada sozinho</small></div>
      <div class="ea-links">${freshLinks.length?freshLinks.slice(0,12).map(l=>eaLinkCard(l,map.get(l.match_key))).join(''):`<div class="ea-empty">Nenhum link Telegram recente. Você ainda pode usar “Validação manual sem link Telegram”.</div>`}</div>
      <div class="ea-subtitle"><b>Validações assistidas frescas</b><small>expiram operacionalmente em 15 minutos</small></div>
      <div id="externalAssistRecent"></div>
      <p class="ea-note">ASSISTIDO é evidência operacional humana: pode mostrar APOIA/DIVERGE, mas não cria probabilidade MatchIntel, não aumenta independentSportsSources e não promove automaticamente OPORTUNIDADE/FORTE/ELITE.</p>`;
    eaBind(root,freshLinks,matches);eaRenderObs();
  }catch(e){
    root.innerHTML=`<div class="ea-empty">External Source Assist indisponível · ${eaEsc(e.message)}</div>`;
  }
}
function eaMount(){
  if(document.querySelector('#externalSourceAssist'))return eaLoad(true);
  const signals=document.querySelector('#signals');if(!signals)return;
  const marker=document.createElement('div');
  marker.className='ea-shell';
  marker.innerHTML=`<div class="section-title"><h2>External Source Assist</h2><span id="externalAssistBadge">ASSISTIDO</span></div><div id="externalSourceAssist"></div>`;
  const tc=document.querySelector('#telegramConvergence');
  if(tc?.parentElement===signals){
    const next=tc.nextSibling;signals.insertBefore(marker,next);
  }else signals.insertBefore(marker,signals.firstChild);
  eaLoad(true);
}
window.addEventListener('DOMContentLoaded',()=>{eaMount();setInterval(()=>eaLoad(false),15000)});
