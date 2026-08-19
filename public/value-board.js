const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pct=v=>v==null?'—':`${Number(v).toFixed(1)}%`;
const odd=v=>v==null?'—':Number(v).toFixed(2);
const time=v=>{try{return new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}catch{return '—'}};
const day=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${o.year}-${o.month}-${o.day}`};
let visible=5;
function cfg(){return window.MATCHINTEL_CONFIG||null}
function headers(c){return {apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`}}
async function q(c,table,params){const r=await fetch(`${c.SUPABASE_URL}/rest/v1/${table}?${params}`,{headers:headers(c),cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
const statusMeta={STRONG_VALUE:{label:'FORTE VALOR',cls:'strong'},VALUE:{label:'VALOR',cls:'value'},WATCH_VALUE:{label:'MONITORAR',cls:'watch'},NO_VALUE:{label:'SEM VALOR',cls:'none'}};
function card(x){
  const sm=statusMeta[x.status]||statusMeta.NO_VALUE;
  const bks=Array.isArray(x.bookmakers)?x.bookmakers:[];
  return `<article class="value-card ${sm.cls}">
    <div class="value-head"><div><strong>${esc(x.home)} × ${esc(x.away)}</strong><small>${esc(x.competition||'')} · ${time(x.kickoff)}</small></div><span class="value-status">${sm.label}</span></div>
    <div class="value-market">${esc(x.market_label||x.market)}</div>
    <div class="value-kpis">
      <div><small>MatchIntel</small><b>${pct(x.model_probability)}</b></div>
      <div><small>Odd justa</small><b>${odd(x.fair_odds)}</b></div>
      <div><small>Melhor odd feed</small><b>${odd(x.observed_odds)}</b></div>
      <div><small>Consenso s/ margem</small><b>${pct(x.market_fair_probability)}</b></div>
      <div><small>Edge</small><b>${x.edge_pp==null?'—':`${Number(x.edge_pp)>=0?'+':''}${Number(x.edge_pp).toFixed(1)} p.p.`}</b></div>
    </div>
    <div class="value-foot"><span>DQ ${x.data_quality==null?'—':`${Number(x.data_quality)}%`}</span><span>${Number(x.independent_sources||0)} fontes esportivas</span><span>${Number(x.bookmaker_count||0)} preços</span></div>
    <div class="value-source">The Odds API${bks.length?` · amostra: ${esc(bks.slice(0,3).join(', '))}${bks.length>3?'…':''}`:''} · ${time(x.odds_fetched_at)}</div>
  </article>`;
}
async function warmup(c,el){
  try{
    const rows=await q(c,'matchintel_daily_tickets',`select=ticket_type,metadata&ticket_day=eq.${day()}&limit=4`);
    const base=Math.max(0,...rows.map(x=>Number(x?.metadata?.history?.fixtures??x?.metadata?.historyFixtures??0)));
    const min=80,p=Math.max(0,Math.min(100,base/min*100));
    el.innerHTML=`<div class="value-empty"><strong>Value Board aquecendo</strong><p>O ranking será liberado quando o modelo pré-live tiver base suficiente e houver odd observada compatível. Nada é inventado para preencher a tela.</p><div class="ticket-progress"><i style="width:${p}%"></i></div><small>Base histórica ${base}/${min} · preços externos já entram quando compatíveis</small></div>`;
  }catch{el.innerHTML='<div class="value-empty">Value Board aguardando dados do Gateway.</div>'}
}
async function loadValueBoard(){
  const c=cfg(),el=document.querySelector('#valueBoard');if(!el)return;if(!c){setTimeout(loadValueBoard,1000);return}
  try{
    const rows=await q(c,'matchintel_value_opportunities',`select=*&opportunity_day=eq.${day()}&status=in.(STRONG_VALUE,VALUE,WATCH_VALUE)&order=score.desc&limit=40`);
    const date=document.querySelector('#valueBoardDate');if(date)date.textContent=new Date().toLocaleDateString('pt-BR',{timeZone:'America/Bahia',day:'2-digit',month:'short'});
    if(!rows.length){await warmup(c,el);return}
    const strong=rows.filter(x=>x.status==='STRONG_VALUE').length,value=rows.filter(x=>x.status==='VALUE').length;
    if(date)date.textContent=`${strong} forte · ${value} valor`;
    const shown=rows.slice(0,visible),remaining=rows.length-shown.length;
    el.innerHTML=shown.map(card).join('')+(remaining>0?`<button class="prelive-more" id="valueMoreBtn">Ver mais valores · ${Math.min(5,remaining)} de ${remaining}</button>`:'')+'<p class="value-note">Odd observada = melhor preço encontrado no feed externo; não representa necessariamente Betano/Bet365 Brasil. Probabilidade MatchIntel permanece independente da odd.</p>';
    const b=document.querySelector('#valueMoreBtn');if(b)b.onclick=()=>{visible=Math.min(rows.length,visible+5);loadValueBoard()};
  }catch(e){el.innerHTML=`<div class="value-empty">Value Board indisponível agora · ${esc(e.message)}</div>`}
}
window.addEventListener('DOMContentLoaded',()=>{loadValueBoard();setInterval(loadValueBoard,30000)});
