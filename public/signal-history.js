/* P11.0.5.7 SIGNAL HISTORY LEDGER */
const shCfg=()=>window.MATCHINTEL_CONFIG||null;
const shEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const shNorm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
const shHeaders=c=>({apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`});
let shRows=[],shFilter='all',shLoadedAt=0;

function shKind(s){
  const x=shNorm(`${s?.provider_family||''} ${s?.provider_name||''}`);
  if(x.includes('BETZORD'))return 'betzord';
  if(x.includes('MAFIA'))return 'mafia';
  if(x.includes('COMMUNITY')||x.includes('RESENHA'))return 'community';
  return 'other';
}
function shMarket(s){
  const k=shKind(s),t=shNorm(`${s?.market||''} ${s?.signal_type||''} ${s?.text_summary||''}`);
  if(k==='betzord' && /GOAL_HT|GOL_HT|OVER_?0?5.*HT|HT.*OVER_?0?5/.test(t))return 'OVER 0.5 HT';
  return s?.market||s?.signal_type||'—';
}
function shTime(v){
  try{return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}
  catch{return '—'}
}
function shBucket5(v){const t=new Date(v||0).getTime();return Number.isFinite(t)?Math.floor(t/300000):0}
function shLogicalKey(s){
  const k=shKind(s);
  if(k!=='betzord')return s.id||s.fingerprint||`${s.provider_name}|${s.occurred_at}`;
  return ['betzord',s.match_key||'',shNorm(s.signal_type||''),shMarket(s),shBucket5(s.occurred_at||s.created_at)].join('|');
}
function shDedupe(rows){
  const m=new Map();
  for(const s of rows){
    const key=shLogicalKey(s);
    if(!m.has(key)){m.set(key,{...s,_providers:new Set([s.provider_name||s.provider_family]),_twins:1});continue}
    const x=m.get(key);x._providers.add(s.provider_name||s.provider_family);x._twins++;
    if(!x.push_sent_at&&s.push_sent_at)x.push_sent_at=s.push_sent_at;
    if(new Date(s.occurred_at||0)>new Date(x.occurred_at||0))x.occurred_at=s.occurred_at;
  }
  return [...m.values()].map(x=>({...x,_providers:[...x._providers]})).sort((a,b)=>new Date(b.occurred_at||b.created_at)-new Date(a.occurred_at||a.created_at));
}
function shProviderLabel(s){
  const k=shKind(s);
  if(k==='betzord')return s._providers?.length>1?'BETZORD VIP + PREMIUM':(s.provider_name||'BETZORD');
  if(k==='mafia')return 'CHAT MÁFIA TOP 1';
  if(k==='community')return s.provider_name||'RESENHAS BET';
  return s.provider_name||s.provider_family||'Fonte';
}
function shPushBadge(s){
  return s.push_sent_at?'<span class="sh-badge push">🔔 PUSH ENVIADO</span>':'<span class="sh-badge nopush">SEM PUSH</span>';
}
function shCard(s){
  const kind=shKind(s),market=shMarket(s),linked=s.match_key?'VINCULADO':'SEM VÍNCULO';
  const twin=s._twins>1?` · ${s._twins} fontes espelhadas`:'';
  const role=kind==='community'?' · COMMUNITY peso zero':'';
  return `<article class="sh-card ${kind}">
    <div class="sh-card-top"><div><small>${shEsc(shTime(s.occurred_at||s.created_at))}</small><strong>${shEsc(shProviderLabel(s))}</strong></div>${shPushBadge(s)}</div>
    <div class="sh-meta"><span>${shEsc(s.signal_type||'SINAL')}</span><span>${shEsc(market)}</span><span>${linked}</span></div>
    <p>${shEsc(s.text_summary||'Sem resumo textual.')}</p>
    <small class="sh-foot">${shEsc(s.state||'—')}${s.pinned?' · PINNED':''}${twin}${role}</small>
  </article>`;
}
function shRender(){
  const list=document.querySelector('#signalHistoryList'),count=document.querySelector('#signalHistoryCount');
  if(!list)return;
  let rows=shRows;
  if(shFilter!=='all')rows=rows.filter(s=>shKind(s)===shFilter);
  if(count)count.textContent=`${rows.length} sinal${rows.length===1?'':'is'}`;
  list.innerHTML=rows.length?rows.map(shCard).join(''):'<div class="sh-empty">Nenhum sinal encontrado neste filtro.</div>';
  document.querySelectorAll('[data-sh-filter]').forEach(b=>b.classList.toggle('active',b.dataset.shFilter===shFilter));
}
async function shLoad(force=false){
  const c=shCfg();if(!c)return;
  if(!force&&Date.now()-shLoadedAt<15000)return;shLoadedAt=Date.now();
  const list=document.querySelector('#signalHistoryList');
  if(list&&!shRows.length)list.innerHTML='<div class="sh-empty">Carregando ledger de sinais…</div>';
  try{
    const r=await fetch(`${c.SUPABASE_URL}/rest/v1/matchintel_signals?select=*&order=occurred_at.desc&limit=1000`,{headers:shHeaders(c),cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    shRows=shDedupe(await r.json());shRender();
  }catch(e){
    if(list)list.innerHTML=`<div class="sh-empty">Não foi possível carregar o histórico de sinais · ${shEsc(e.message)}</div>`;
  }
}
function shMount(){
  const section=document.querySelector('#history'),historyList=document.querySelector('#historyList');
  if(!section||!historyList||document.querySelector('#historyLedgerTabs'))return;
  const tabs=document.createElement('div');tabs.id='historyLedgerTabs';tabs.className='sh-tabs';
  tabs.innerHTML=`<button class="active" data-sh-tab="matches">Partidas</button><button data-sh-tab="signals">Sinais / Telegram</button>`;
  historyList.parentElement.insertBefore(tabs,historyList);
  const panel=document.createElement('div');panel.id='signalHistoryPanel';panel.className='hidden';
  panel.innerHTML=`<div class="sh-panel-head"><div><strong>Ledger permanente de sinais</strong><small>O painel operacional continua usando janela de 10 min; aqui nada some da auditoria.</small></div><span id="signalHistoryCount">0 sinais</span></div>
    <div class="sh-filters">
      <button class="active" data-sh-filter="all">Todos</button>
      <button data-sh-filter="mafia">Chat Máfia</button>
      <button data-sh-filter="betzord">BetZord</button>
      <button data-sh-filter="community">Resenhas Bet</button>
    </div>
    <div id="signalHistoryList" class="sh-list"></div>`;
  historyList.insertAdjacentElement('afterend',panel);

  tabs.querySelectorAll('[data-sh-tab]').forEach(b=>b.onclick=()=>{
    const tab=b.dataset.shTab;
    tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));
    historyList.classList.toggle('hidden',tab!=='matches');
    panel.classList.toggle('hidden',tab!=='signals');
    if(tab==='signals')shLoad(true);
  });
  panel.querySelectorAll('[data-sh-filter]').forEach(b=>b.onclick=()=>{shFilter=b.dataset.shFilter;shRender()});
}
window.addEventListener('DOMContentLoaded',()=>{shMount();setInterval(()=>{if(!document.querySelector('#signalHistoryPanel')?.classList.contains('hidden'))shLoad(false)},20000)});
