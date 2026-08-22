/* P11.0.5.7 SIGNAL HISTORY — permanent audit ledger */
const shCfg=()=>window.MATCHINTEL_CONFIG||null;
const shEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const shNorm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const shState={provider:'all',period:'all',offset:0,limit:80,total:0,loading:false};

function shProviderKind(s){
  const x=shNorm(`${s?.provider_family||''} ${s?.provider_name||''}`);
  if(x.includes('BETZORD'))return 'betzord';
  if(x.includes('MAFIA'))return 'mafia';
  if(x.includes('COMMUNITY')||x.includes('RESENHA'))return 'community';
  return 'other';
}
function shMarket(v){
  const x=String(v||'').toUpperCase();
  if(x==='OVER_05_HT'||x==='GOAL_HT')return 'OVER 0.5 HT';
  if(x==='UNKNOWN'||!x)return 'MERCADO NÃO RESOLVIDO';
  return x.replaceAll('_',' ');
}
function shTime(v){
  try{return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v))}
  catch{return '—'}
}
function shAge(s){
  const t=new Date(s?.occurred_at||s?.created_at||0).getTime();
  if(!Number.isFinite(t))return '';
  const m=Math.max(0,Math.floor((Date.now()-t)/60000));
  if(m<60)return `${m} min`;
  const h=Math.floor(m/60);if(h<24)return `${h}h`;
  return `${Math.floor(h/24)}d`;
}
function shStatus(s){
  const exp=new Date(s?.expires_at||0).getTime();
  return Number.isFinite(exp)&&exp>Date.now()?'ATIVO':'HISTÓRICO';
}
function shPush(s){
  if(s?.push_sent_at)return {label:'🔔 PUSH ENVIADO',cls:'sent'};
  if(shProviderKind(s)==='community')return {label:'SEM PUSH · ZERO-WEIGHT',cls:'neutral'};
  return {label:'SEM PUSH',cls:'muted'};
}
function shSourceLabel(s){
  const k=shProviderKind(s);
  if(k==='mafia')return `🔥 ${s.provider_name||'CHAT MÁFIA'}`;
  if(k==='betzord')return `⚡ ${s.provider_name||'BETZORD'}`;
  if(k==='community')return `💬 ${s.provider_name||'RESENHAS BET'}`;
  return s.provider_name||s.provider_family||'Fonte';
}
function shSafeUrl(v){try{const u=new URL(String(v||''));return /^https?:$/.test(u.protocol)?u.href:''}catch{return''}}
function shCard(s){
  const p=shPush(s),book=shSafeUrl(s.bookmaker_url);
  const canonical=shProviderKind(s)==='betzord'?'OVER 0.5 HT':shMarket(s.market);
  return `<article class="sh-card ${shProviderKind(s)}">
    <div class="sh-head">
      <div><small>${shEsc(shTime(s.occurred_at||s.created_at))} · ${shEsc(shAge(s))}</small><b>${shEsc(shSourceLabel(s))}</b></div>
      <span class="sh-state">${shEsc(shStatus(s))}</span>
    </div>
    <div class="sh-chips">
      <span>${shEsc(canonical)}</span>
      <span>${shEsc(s.signal_type||'SINAL')}</span>
      <span>${s.match_key?'VINCULADO':'SEM VÍNCULO'}</span>
      <span class="${p.cls}">${shEsc(p.label)}</span>
    </div>
    <p>${shEsc(s.text_summary||'Sinal sem resumo textual.')}</p>
    <div class="sh-foot"><small>${shEsc(s.alert_level||'INFO')} · ${s.pinned?'FIXADO/PIN':'não fixado'}</small>${book?`<a href="${shEsc(book)}" target="_blank" rel="noopener noreferrer">Abrir ${shEsc(s.bookmaker||'bookmaker')} ↗</a>`:''}</div>
  </article>`;
}
function shCutoff(period){
  const now=Date.now();
  if(period==='today'){const d=new Date();d.setHours(0,0,0,0);return d.toISOString()}
  if(period==='7d')return new Date(now-7*86400000).toISOString();
  if(period==='30d')return new Date(now-30*86400000).toISOString();
  return null;
}
async function shFetch(){
  const c=shCfg();if(!c)throw new Error('Configuração Supabase indisponível.');
  const q=new URLSearchParams();
  q.set('select','id,match_key,provider_family,provider_name,signal_type,market,text_summary,state,pinned,author_role,occurred_at,created_at,expires_at,bookmaker,bookmaker_url,alert_level,push_sent_at');
  q.set('order','occurred_at.desc');
  q.set('limit',String(shState.limit));q.set('offset',String(shState.offset));
  const cutoff=shCutoff(shState.period);if(cutoff)q.set('occurred_at',`gte.${cutoff}`);
  if(shState.provider==='betzord')q.set('or','(provider_family.ilike.*betzord*,provider_name.ilike.*betzord*)');
  if(shState.provider==='mafia')q.set('or','(provider_family.ilike.*mafia*,provider_name.ilike.*mafia*)');
  if(shState.provider==='community')q.set('or','(provider_family.ilike.*community*,provider_name.ilike.*resenha*)');
  const r=await fetch(`${c.SUPABASE_URL}/rest/v1/matchintel_signals?${q}`,{headers:{apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`,Prefer:'count=exact'},cache:'no-store'});
  if(!r.ok)throw new Error(`Histórico de sinais: HTTP ${r.status}`);
  const cr=r.headers.get('content-range')||'';const total=Number(cr.split('/')[1]);
  if(Number.isFinite(total))shState.total=total;
  return r.json();
}
async function shLoad(reset=false){
  const list=document.querySelector('#signalHistoryList'),more=document.querySelector('#signalHistoryMore'),meta=document.querySelector('#signalHistoryMeta');
  if(!list||shState.loading)return;
  if(reset){shState.offset=0;list.innerHTML='';shState.total=0}
  shState.loading=true;if(more)more.disabled=true;
  if(!list.children.length)list.innerHTML='<div class="sh-empty">Carregando trilha de auditoria…</div>';
  try{
    const rows=await shFetch();
    if(reset)list.innerHTML='';
    if(!rows.length&&shState.offset===0)list.innerHTML='<div class="sh-empty">Nenhum sinal encontrado neste filtro.</div>';
    else{
      if(list.querySelector('.sh-empty'))list.innerHTML='';
      list.insertAdjacentHTML('beforeend',rows.map(shCard).join(''));
      shState.offset+=rows.length;
    }
    if(meta)meta.textContent=`${shState.total||shState.offset} registro(s) · auditoria permanente`;
    if(more){
      more.hidden=shState.offset>=shState.total||rows.length<shState.limit;
      more.disabled=false;
      more.textContent=`Carregar mais (${Math.max(0,shState.total-shState.offset)})`;
    }
  }catch(e){
    list.innerHTML=`<div class="sh-empty">Não foi possível carregar o histórico de sinais · ${shEsc(e.message)}</div>`;
    if(more){more.hidden=true;more.disabled=false}
  }finally{shState.loading=false}
}
function shMount(){
  const root=document.querySelector('#history'),history=document.querySelector('#historyList');
  if(!root||!history||document.querySelector('#historyModeTabs'))return;
  const title=root.querySelector('.section-title');
  const tabs=document.createElement('div');tabs.id='historyModeTabs';tabs.className='sh-mode-tabs';
  tabs.innerHTML=`<button class="active" data-sh-mode="matches">Partidas</button><button data-sh-mode="signals">Sinais</button><span id="signalHistoryMeta">auditoria Telegram</span>`;
  title?.after(tabs);
  const panel=document.createElement('div');panel.id='signalHistoryPanel';panel.hidden=true;
  panel.innerHTML=`<div class="sh-toolbar">
      <div class="filters" id="signalHistoryProviders"><button class="active" data-sh-provider="all">Todos</button><button data-sh-provider="mafia">Chat Máfia</button><button data-sh-provider="betzord">BetZord</button><button data-sh-provider="community">Resenhas</button></div>
      <select id="signalHistoryPeriod" aria-label="Período"><option value="all">Todo histórico</option><option value="today">Hoje</option><option value="7d">7 dias</option><option value="30d">30 dias</option></select>
    </div>
    <div class="sh-audit-note">Auditoria bruta: VIP e Premium permanecem como registros separados. O motor de notificações deduplica o mesmo evento para não tocar duas vezes.</div>
    <div id="signalHistoryList" class="sh-list"></div>
    <button id="signalHistoryMore" class="sh-more" type="button" hidden>Carregar mais</button>`;
  history.after(panel);

  tabs.querySelectorAll('[data-sh-mode]').forEach(b=>b.onclick=()=>{
    const sig=b.dataset.shMode==='signals';
    tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));
    history.hidden=sig;panel.hidden=!sig;
    if(sig)shLoad(true);
  });
  panel.querySelectorAll('[data-sh-provider]').forEach(b=>b.onclick=()=>{
    shState.provider=b.dataset.shProvider;
    panel.querySelectorAll('[data-sh-provider]').forEach(x=>x.classList.toggle('active',x===b));shLoad(true);
  });
  panel.querySelector('#signalHistoryPeriod').onchange=e=>{shState.period=e.target.value;shLoad(true)};
  panel.querySelector('#signalHistoryMore').onclick=()=>shLoad(false);
  document.querySelectorAll('.navbtn[data-screen="history"]').forEach(b=>b.addEventListener('click',()=>{if(!panel.hidden)shLoad(true)}));
}
window.addEventListener('DOMContentLoaded',shMount);
