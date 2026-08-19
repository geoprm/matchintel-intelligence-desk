const tpEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const tpPct=v=>v==null||!Number.isFinite(Number(v))?'—':`${Number(v).toFixed(1)}%`;
const tpNum=(v,d=2)=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toFixed(d);
const tpCfg=()=>window.MATCHINTEL_CONFIG||null;
const tpHeaders=c=>({apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`});
async function tpQ(c,table,params){
  const r=await fetch(`${c.SUPABASE_URL}/rest/v1/${table}?${params}`,{headers:tpHeaders(c),cache:'no-store'});
  if(!r.ok)throw new Error(`${table}: HTTP ${r.status}`);
  return r.json();
}
const tpMs=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.getTime():null};
const tpFinished=p=>/\bFT\b|AET|PEN|FINISHED|MATCH FINISHED/i.test(String(p||''));
const tpBinary=r=>r?.outcome===0||r?.outcome===1||r?.outcome==='0'||r?.outcome==='1';
const tpPhase=r=>String(r?.phase??r?.metadata?.phase??'');
const tpKey=r=>`${r.record_kind||''}|${r.match_key||r.source_key||''}|${r.market||''}`;

function tpAudit(rows=[]){
  const ordered=[...rows].filter(tpBinary).sort((a,b)=>(tpMs(a.locked_at||a.generated_at)||0)-(tpMs(b.locked_at||b.generated_at)||0));
  const out=[],excluded=[],seen=new Set();
  for(const r of ordered){
    const locked=tpMs(r.locked_at||r.generated_at),settled=tpMs(r.settled_at);
    if(!locked||!settled){excluded.push({...r,_audit_reason:'tempo ausente'});continue}
    if(locked>=settled){excluded.push({...r,_audit_reason:'lookahead temporal'});continue}
    if(r.record_kind==='PREDICTION'&&tpFinished(tpPhase(r))){excluded.push({...r,_audit_reason:'snapshot pós-jogo'});continue}
    if(r.record_kind==='PREDICTION'){
      const k=tpKey(r);
      if(seen.has(k)){excluded.push({...r,_audit_reason:'snapshot duplicado'});continue}
      seen.add(k);
    }
    out.push({...r,_audit_reason:'auditável'});
  }
  return {eligible:out,excluded};
}
function tpMetrics(rows=[]){
  const a=rows.filter(tpBinary),n=a.length,w=a.reduce((s,r)=>s+Number(r.outcome),0);
  const probs=a.filter(r=>Number.isFinite(Number(r.model_probability)));
  const brier=probs.length?probs.reduce((s,r)=>{const p=Math.max(0,Math.min(1,Number(r.model_probability)/100));return s+(p-Number(r.outcome))**2},0)/probs.length:null;
  const observed=a.filter(r=>Number(r.observed_odds)>1);
  const profit=observed.reduce((s,r)=>s+(Number(r.outcome)?Number(r.observed_odds)-1:-1),0);
  return {
    count:n,wins:w,losses:n-w,
    hit_rate:n?100*w/n:null,
    brier_score:brier,
    observed_bets:observed.length,
    profit_units:observed.length?profit:null,
    yield_pct:observed.length?100*profit/observed.length:null
  };
}
function tpSample(n){
  if(n<60)return 'INSUFICIENTE';
  if(n<120)return 'INICIAL';
  if(n<300)return 'APRENDENDO';
  return 'CALIBRANDO';
}
function tpKindMetrics(rows,kind){
  return tpMetrics(rows.filter(r=>r.record_kind===kind));
}
function tpMetricCard(label,m,sub){
  return `<div class="tp-metric"><small>${tpEsc(label)}</small><b>${m.count?tpPct(m.hit_rate):'—'}</b><span>${m.count} auditáveis · ${m.wins||0}G/${m.losses||0}R</span>${sub?`<em>${tpEsc(sub)}</em>`:''}</div>`;
}
function tpResultTag(r,auditSet){
  const key=r.record_key||`${r.record_kind}|${r.match_key}|${r.market}|${r.locked_at}`;
  const info=auditSet.get(key);
  const result=r.result==='WON'?'<span class="perf-result won">GREEN</span>':r.result==='LOST'?'<span class="perf-result lost">RED</span>':'<span class="perf-result neutral">N/D</span>';
  const badge=info?.eligible?'<span class="tp-audit ok">AUDITÁVEL</span>':`<span class="tp-audit no">EXCLUÍDO · ${tpEsc(info?.reason||'não auditável')}</span>`;
  return `${result}${badge}`;
}
function tpRecTitle(r){
  if(r.record_kind==='TICKET')return `Bilhete ${r.ticket_type||''}`;
  if(r.home||r.away)return `${r.home||''}${r.away?` × ${r.away}`:''}`;
  return `${r.record_kind||'Registro'} · ${r.match_key||''}`;
}
function tpRecentRow(r,auditSet){
  const roi=Number(r.observed_odds)>1&&tpBinary(r)?` · odd ${tpNum(r.observed_odds)}`:'';
  return `<div class="perf-row tp-row"><div><strong>${tpEsc(tpRecTitle(r))}</strong><small>${tpEsc(r.market||r.record_kind||'')}${r.model_probability!=null?` · modelo ${tpPct(r.model_probability)}`:''}${roi}</small></div><div>${tpResultTag(r,auditSet)}</div></div>`;
}
function tpLane(label,m,help,tone=''){
  const y=m.observed_bets?tpPct(m.yield_pct):'—';
  return `<div class="tp-lane ${tone}"><div><strong>${tpEsc(label)}</strong><small>${tpEsc(help)}</small></div><div class="tp-lane-k"><span><small>n</small><b>${m.count}</b></span><span><small>acerto</small><b>${tpPct(m.hit_rate)}</b></span><span><small>Brier</small><b>${m.brier_score==null?'—':tpNum(m.brier_score,3)}</b></span><span><small>yield</small><b>${y}</b></span></div></div>`;
}

async function loadPerformanceLab(){
  const c=tpCfg(),el=document.querySelector('#performanceLab');
  if(!el)return;
  if(!c){setTimeout(loadPerformanceLab,900);return}
  try{
    const [snaps,btRuns,records]=await Promise.all([
      tpQ(c,'matchintel_performance_snapshots','select=*&order=calculated_at.desc&limit=1'),
      tpQ(c,'matchintel_backtest_runs','select=*&order=generated_at.desc&limit=1'),
      tpQ(c,'matchintel_performance_records','select=*&result=in.(WON,LOST)&order=locked_at.asc.nullslast&limit=2000')
    ]);
    const raw=snaps[0]||null,bt=btRuns[0]||null;
    const {eligible,excluded}=tpAudit(records);
    const official=tpMetrics(eligible),rawMetrics=tpMetrics(records);
    const model=tpKindMetrics(eligible,'PREDICTION'),value=tpKindMetrics(eligible,'VALUE'),tickets=tpKindMetrics(eligible,'TICKET');
    const wf=bt?.baseline?.walk_forward||bt?.summary?.baseline?.walk_forward||{};
    const q=bt?.summary?.source_quality||{};
    const badge=document.querySelector('#performanceBadge');
    if(badge)badge.textContent=`AUDITADO · ${tpSample(official.count)} · SHADOW`;

    const auditMap=new Map();
    for(const r of eligible)auditMap.set(r.record_key||`${r.record_kind}|${r.match_key}|${r.market}|${r.locked_at}`,{eligible:true,reason:'auditável'});
    for(const r of excluded)auditMap.set(r.record_key||`${r.record_kind}|${r.match_key}|${r.market}|${r.locked_at}`,{eligible:false,reason:r._audit_reason});

    const rawHit=raw?.hit_rate??rawMetrics.hit_rate;
    const rawSettled=Number(raw?.settled_count??rawMetrics.count??0);
    const rawWarn=rawSettled>official.count
      ?`O ledger bruto tem ${rawSettled} liquidações e ${tpPct(rawHit)} de acerto, mas esse número NÃO é performance oficial. O P6 aprovou ${official.count} registro(s) para auditoria e excluiu ${rawSettled-official.count} da amostra confiável.`
      :'A amostra bruta e a auditável estão alinhadas neste ciclo.';

    el.innerHTML=`
      <div class="tp-trust">
        <div class="tp-trust-head"><div><small>MÉTRICA OFICIAL</small><strong>Performance auditável P6</strong><span>Somente snapshots temporalmente válidos, sem pós-jogo e sem duplicatas.</span></div><span class="tp-shield">${official.count?'AUDITÁVEL':'SEM AMOSTRA'}</span></div>
        <div class="perf-kpis tp-kpis">
          <div><small>Auditáveis</small><b>${official.count}</b><span>${official.wins} green · ${official.losses} red</span></div>
          <div><small>Taxa oficial</small><b>${tpPct(official.hit_rate)}</b><span>não usa o bruto legado</span></div>
          <div><small>Brier oficial</small><b>${official.brier_score==null?'—':tpNum(official.brier_score,3)}</b><span>menor é melhor</span></div>
          <div><small>Odds observadas</small><b>${official.observed_bets}</b><span>yield só com preço real</span></div>
          <div><small>Yield oficial</small><b>${official.observed_bets?tpPct(official.yield_pct):'—'}</b><span>${official.observed_bets?'flat stake 1u':'aguardando odds auditáveis'}</span></div>
        </div>
      </div>

      <div class="tp-warning"><strong>Bruto / legado — contexto, não decisão</strong><span>${tpEsc(rawWarn)}</span></div>

      <div class="tp-lanes">
        ${tpLane('Modelo auditável',model,'Predições live/pré-live que passam pela higiene P6')}
        ${tpLane('Value auditável',value,'Somente oportunidades congeladas antes do evento e com settlement válido','value')}
        ${tpLane('Bilhetes auditáveis',tickets,'Segurança, Equilíbrio, Valor e Bingo liquidados sem lookahead','ticket')}
        ${tpLane('Pré-live walk-forward',{
          count:Number(wf.count||0),wins:Number(wf.wins||0),losses:Number(wf.losses||0),
          hit_rate:wf.hit_rate,brier_score:wf.brier_score,observed_bets:0,yield_pct:null
        },`Replay cronológico · ${Number(bt?.summary?.walk_forward?.fixture_count||0)} fixtures históricos`,'walk')}
      </div>

      <div class="tp-hygiene">
        <div><small>Liquidados brutos</small><b>${Number(q.raw_settled??rawSettled)}</b></div>
        <div><small>Pós-jogo excluídos</small><b>${Number(q.post_event_excluded??excluded.filter(x=>x._audit_reason==='snapshot pós-jogo').length)}</b></div>
        <div><small>Lookahead excluído</small><b>${Number(q.anti_lookahead_excluded??excluded.filter(x=>x._audit_reason==='lookahead temporal').length)}</b></div>
        <div><small>Duplicatas excluídas</small><b>${Number(q.duplicate_prediction_excluded??excluded.filter(x=>x._audit_reason==='snapshot duplicado').length)}</b></div>
      </div>

      <div class="perf-note tp-note">P6.1 TRUSTED PERFORMANCE · O número em destaque é sempre a amostra auditável. Estatísticas brutas permanecem visíveis apenas para rastreabilidade. Nenhuma taxa, ROI, yield ou calibração não auditável é promovida como evidência de desempenho.</div>

      ${records.length?`<div class="perf-recent"><h3>Últimas liquidações · com selo de auditoria</h3>${[...records].sort((a,b)=>(tpMs(b.settled_at)||0)-(tpMs(a.settled_at)||0)).slice(0,8).map(r=>tpRecentRow(r,auditMap)).join('')}</div>`:''}
    `;
  }catch(e){
    el.innerHTML=`<div class="perf-empty">Performance confiável indisponível agora · ${tpEsc(e.message)}</div>`;
  }
}
window.addEventListener('DOMContentLoaded',()=>{loadPerformanceLab();setInterval(loadPerformanceLab,30000)});
