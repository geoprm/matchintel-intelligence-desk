const s10Cfg=()=>window.MATCHINTEL_CONFIG||null;
const s10Esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const s10Hdr=c=>({apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`});
function s10Device(){let v=localStorage.getItem('matchintel-p10-device');if(v)return v;v=(crypto?.randomUUID?.()||`${Date.now()}_${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g,'_');localStorage.setItem('matchintel-p10-device',v);return v}
async function s10Api(c,method='GET',body=null){
  const h={...s10Hdr(c),'x-matchintel-device':s10Device()};
  if(body)h['content-type']='application/json';
  const r=await fetch(`${c.SUPABASE_URL}/functions/v1/matchintel-ticket-execution`,{method,headers:h,body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j?.error||`HTTP ${r.status}`);
  return j;
}
const s10Num=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
const s10Pct=v=>v==null||!Number.isFinite(Number(v))?'—':`${Number(v).toFixed(2)}%`;
const s10Money=v=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const s10Time=v=>{try{return new Date(v).toLocaleString('pt-BR',{timeZone:'America/Bahia',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return '—'}};
const s10Type=t=>({SAFETY:'Segurança',BALANCED:'Equilíbrio',VALUE:'Valor',BINGO:'Bingo'})[t]||t||'—';
function s10Tone(r){return r==='GREEN'?'green':r==='RED'?'red':r==='VOID'?'void':'pending'}
function s10Svg(points){
  const vals=(points||[]).map(x=>Number(x.cumulative_units||0));
  if(!vals.length)return '<div class="s10-chart-empty">A curva começa quando houver o primeiro bilhete executado e encerrado.</div>';
  const w=620,h=150,p=12,min=Math.min(0,...vals),max=Math.max(0,...vals),span=Math.max(.1,max-min);
  const xy=vals.map((v,i)=>[p+(w-2*p)*(vals.length===1?.5:i/(vals.length-1)),p+(h-2*p)*(1-(v-min)/span)]);
  const line=xy.map(p=>p.join(',')).join(' ');
  const zeroY=p+(h-2*p)*(1-(0-min)/span);
  return `<svg class="s10-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line x1="${p}" y1="${zeroY}" x2="${w-p}" y2="${zeroY}" class="s10-zero"/><polyline points="${line}" fill="none" class="s10-line"/></svg><div class="s10-chart-labels"><span>${s10Num(min,2)}u</span><span>${s10Num(max,2)}u</span></div>`;
}
function s10ProfileCards(profiles={}){
  const order=['SAFETY','BALANCED','VALUE','BINGO'];
  return order.map(k=>{const p=profiles[k]||{};return `<div class="s10-profile"><small>${s10Type(k)}</small><b>${Number(p.executions||0)} exec.</b><span>${Number(p.green||0)}G · ${Number(p.red||0)}R · ${Number(p.void||0)}V</span><em>${p.roi_pct==null?'ROI —':`Yield ${s10Pct(p.roi_pct)}`}</em></div>`}).join('');
}
function s10Execution(e){
  const r=e.settlement_result||'PENDENTE',tone=s10Tone(r),title=e?.snapshot?.title||`${s10Type(e.ticket_type)} · ${e.ticket_day}`;
  return `<article class="s10-exec ${tone}"><div><small>${s10Time(e.created_at)} · ${s10Type(e.ticket_type)}</small><strong>${s10Esc(title)}</strong><span>Odd ${s10Num(e.executed_odds,2)} · ${s10Num(e.stake_units,2)}u${e.stake_amount!=null?` · ${s10Money(e.stake_amount)}`:''}</span></div><div><b>${s10Esc(r)}</b><span>${e.profit_units==null?'aguardando settlement':`${Number(e.profit_units)>=0?'+':''}${s10Num(e.profit_units,2)}u`}</span>${e.profit_amount==null?'':`<small>${Number(e.profit_amount)>=0?'+':''}${s10Money(e.profit_amount)}</small>`}</div></article>`;
}
async function s10SaveBankroll(){
  const c=s10Cfg(),root=document.querySelector('#settlementBankrollCenter');if(!c||!root)return;
  const amt=(root.querySelector('#s10InitialAmount')?.value||'').replace(',','.'),units=(root.querySelector('#s10InitialUnits')?.value||'').replace(',','.');
  const initial_amount=amt===''?null:Number(amt),initial_units=units===''?0:Number(units);
  if(initial_amount!=null&&(!Number.isFinite(initial_amount)||initial_amount<0))return alert('Bankroll inicial em R$ inválido.');
  if(!Number.isFinite(initial_units)||initial_units<0)return alert('Bankroll inicial em unidades inválido.');
  const b=root.querySelector('#s10SaveBankroll');if(b){b.disabled=true;b.textContent='Salvando…'}
  try{await s10Api(c,'POST',{action:'SET_BANKROLL',initial_amount,initial_units});await s10Load()}catch(e){alert(`Falha ao salvar bankroll: ${e.message}`)}
}
async function s10Load(){
  const c=s10Cfg(),root=document.querySelector('#settlementBankrollCenter');if(!root)return;if(!c){setTimeout(s10Load,800);return}
  try{
    const j=await s10Api(c),s=j.summary||{},settings=j.settings||{},rows=j.executions||[];
    const moneyRoi=Number(s.staked_amount)>0?Number(s.profit_amount||0)/Number(s.staked_amount)*100:null;
    const badge=document.querySelector('#settlementBankrollBadge');if(badge)badge.textContent=`${Number(s.settled||0)} settled · ${Number(s.pending||0)} pendente(s)`;
    root.innerHTML=`<div class="s10-hero"><div><small>P10.1 · EXECUÇÃO REAL</small><strong>Settlement + Performance + Bankroll</strong><span>Esta área mede apenas os bilhetes que você registrou como executados. O Performance Lab teórico continua separado.</span></div><b>BACKEND AUDITÁVEL</b></div>
      <div class="s10-kpis">
        <span><small>Executados</small><b>${Number(s.executions||0)}</b><em>${Number(s.pending||0)} pend.</em></span>
        <span><small>Green / Red / Void</small><b>${Number(s.green||0)} / ${Number(s.red||0)} / ${Number(s.void||0)}</b><em>Hit ${s10Pct(s.hit_rate_pct)}</em></span>
        <span><small>Lucro</small><b>${Number(s.profit_units||0)>=0?'+':''}${s10Num(s.profit_units||0,2)}u</b><em>${s.profit_amount?`${Number(s.profit_amount)>=0?'+':''}${s10Money(s.profit_amount)}`:'R$ —'}</em></span>
        <span><small>Yield em unidades</small><b>${s10Pct(s.yield_pct)}</b><em>${s10Num(s.staked_units||0,2)}u apostadas</em></span>
        <span><small>ROI em R$</small><b>${s10Pct(moneyRoi)}</b><em>${s10Money(s.staked_amount||0)} apostados</em></span>
        <span><small>Máx. drawdown</small><b>${s10Num(s.max_drawdown_units||0,2)}u</b><em>curva executada</em></span>
        <span><small>Bankroll atual</small><b>${s.bankroll_current_amount==null?'—':s10Money(s.bankroll_current_amount)}</b><em>${s10Num(s.bankroll_current_units||0,2)}u</em></span>
        <span><small>Settlement</small><b>AUTOMÁTICO</b><em>daily_tickets auditável</em></span>
      </div>
      <div class="s10-bankroll"><div><strong>Configuração do bankroll</strong><small>Por enquanto é por aparelho. Execuções sem valor em R$ movem apenas a curva em unidades.</small></div><label>Inicial R$<input id="s10InitialAmount" inputmode="decimal" value="${settings.initial_amount??''}" placeholder="Ex.: 1000,00"></label><label>Inicial u<input id="s10InitialUnits" inputmode="decimal" value="${settings.initial_units??0}"></label><button id="s10SaveBankroll">Salvar</button></div>
      <div class="s10-block"><div class="s10-block-title"><strong>Curva acumulada do que foi executado</strong><small>${Number(s.settled||0)} settlement(s)</small></div>${s10Svg(s.timeline||[])}</div>
      <div class="s10-block"><div class="s10-block-title"><strong>Performance por perfil</strong><small>não mistura shadow teórico</small></div><div class="s10-profiles">${s10ProfileCards(s.profiles||{})}</div></div>
      <div class="s10-block"><div class="s10-block-title"><strong>Execuções recentes</strong><small>${rows.length}</small></div>${rows.length?`<div class="s10-execs">${rows.slice(0,30).map(s10Execution).join('')}</div>`:'<div class="s10-empty">Nenhum bilhete foi registrado como executado ainda. Quando o P10 liberar um ticket READY/LOCKED e você registrar a execução, ele aparecerá aqui.</div>'}</div>
      <p class="s10-note"><strong>Regra de auditoria:</strong> P10.1 não permite marcar GREEN/RED manualmente. Ele reconcilia a execução somente quando o ticket original recebe settlement posterior. GREEN = stake × (odd executada − 1); RED = −stake; VOID = 0.</p>`;
    root.querySelector('#s10SaveBankroll')?.addEventListener('click',s10SaveBankroll);
  }catch(e){root.innerHTML=`<div class="s10-empty">P10.1 indisponível · ${s10Esc(e.message)}</div>`}
}
window.addEventListener('DOMContentLoaded',()=>{s10Load();setInterval(s10Load,30000)});
