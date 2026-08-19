const TYPE_ORDER={SAFETY:0,BALANCED:1,VALUE:2,BINGO:3};
const TYPE_META={
  SAFETY:{icon:'🛡️',name:'Segurança',tone:'safe'},
  BALANCED:{icon:'⚖️',name:'Equilíbrio',tone:'balanced'},
  VALUE:{icon:'🔥',name:'Valor',tone:'value'},
  BINGO:{icon:'🎯',name:'Bingo',tone:'bingo'}
};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const ymd=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${o.year}-${o.month}-${o.day}`};
const pct=v=>v==null?'—':`${Number(v).toFixed(Number(v)%1?1:0)}%`;
const odd=v=>v==null?'—':Number(v).toFixed(2);
const time=v=>{try{return new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}catch{return '—'}};
function config(){return window.MATCHINTEL_CONFIG||null}
async function loadTickets(){
  const c=config();const el=document.querySelector('#dailyTickets');if(!el)return;
  if(!c){el.innerHTML='<div class="ticket-empty">Inicializando módulo de bilhetes…</div>';setTimeout(loadTickets,1000);return}
  try{
    const u=`${c.SUPABASE_URL}/rest/v1/matchintel_daily_tickets?select=*&ticket_day=eq.${ymd()}&order=ticket_type.asc`;
    const r=await fetch(u,{headers:{apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`},cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const rows=(await r.json()).sort((a,b)=>(TYPE_ORDER[a.ticket_type]??9)-(TYPE_ORDER[b.ticket_type]??9));
    document.querySelector('#dailyTicketsDate').textContent=new Date().toLocaleDateString('pt-BR',{timeZone:'America/Bahia',day:'2-digit',month:'short'});
    el.innerHTML=rows.length?rows.map(card).join(''):'<div class="ticket-empty">Bilhetes ainda não publicados pelo Gateway. O P4A não preenche palpites sem base histórica suficiente.</div>';
  }catch(e){el.innerHTML=`<div class="ticket-empty">Bilhetes indisponíveis agora · ${esc(e.message)}</div>`}
}
function card(t){
  const m=TYPE_META[t.ticket_type]||{icon:'◈',name:t.ticket_type,tone:''};const ready=t.status==='READY'||t.status==='LOCKED'||t.status==='SETTLED';const sels=Array.isArray(t.selections)?t.selections:[];
  const oddsLabel=t.observed_odds!=null?'Odd observada':'Odd justa';const oddsValue=t.observed_odds!=null?t.observed_odds:t.fair_odds;
  const status=ready?t.status:'AGUARDANDO BASE';
  const legs=ready?sels.map(s=>`<li><div><strong>${esc(s.home)} × ${esc(s.away)}</strong><small>${esc(s.market_label||s.market)} · ${time(s.kickoff)}</small></div><div class="ticket-leg-prob">${pct(s.probability)}</div></li>`).join(''):'';
  const info=ready?`<div class="ticket-kpis"><div><small>${oddsLabel}</small><b>${odd(oddsValue)}</b></div><div><small>Prob. combinada</small><b>${pct(t.combined_probability)}</b></div><div><small>Odd mín. valor</small><b>${odd(t.min_value_odds)}</b></div></div><ol class="ticket-legs">${legs}</ol>`:`<p class="ticket-wait">${esc((t.rationale||[])[0]||'Ainda não há evidência suficiente para liberar este perfil.')}</p>`;
  return `<article class="daily-ticket ${m.tone} ${ready?'ready':'insufficient'}"><div class="ticket-head"><div><span class="ticket-icon">${m.icon}</span><div><strong>${esc(m.name)}</strong><small>${esc(t.model_version||'P4A')}</small></div></div><span class="ticket-status">${esc(status)}</span></div>${info}<div class="ticket-foot"><span>DQ ${Number(t.data_quality||0)}%</span><span>amostra ${Number(t.sample_size||0)}</span><span class="shadow-chip">SHADOW</span></div>${t.ticket_type==='BINGO'&&ready?'<div class="ticket-risk">Alta variância: probabilidade absoluta menor, apesar da seleção orientada por dados.</div>':''}</article>`;
}
window.addEventListener('DOMContentLoaded',()=>{loadTickets();setInterval(loadTickets,30000)});
