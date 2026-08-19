const b6esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const b6pct=v=>v==null?'—':`${Number(v).toFixed(1)}%`;
const b6num=(v,d=2)=>v==null?'—':Number(v).toFixed(d);
const b6cfg=()=>window.MATCHINTEL_CONFIG||null;
const b6headers=c=>({apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`});
async function b6q(c,params){const r=await fetch(`${c.SUPABASE_URL}/rest/v1/matchintel_backtest_runs?${params}`,{headers:b6headers(c),cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
function b6state(s){return ({INSUFFICIENT:'amostra insuficiente',EARLY:'amostra inicial',LEARNING:'em aprendizado',CALIBRATING:'calibração ativa'})[s]||String(s||'coletando').toLowerCase()}
function ruleText(c){if(!c?.filter)return 'Nenhuma regra elegível ainda';const f=c.filter;const parts=[f.kind!=='ALL'?f.kind:null,f.market!=='ALL'?f.market:null,`P≥${f.prob_min}%`,f.dq_min?`DQ≥${f.dq_min}`:null,f.sources_min?`${f.sources_min}+ fontes`:null,f.edge_min!=null?`edge≥${f.edge_min} p.p.`:null].filter(Boolean);return parts.join(' · ')}
function candRow(c){const v=c.validation||{};return `<div class="bt-row"><div><strong>${b6esc(ruleText(c))}</strong><small>${b6esc(c.source||'')} · ${b6esc(c.state||'')} · n=${Number(c.total||0)}</small></div><div><b>${b6pct(v.hit_rate)}</b><small>Brier ${v.brier_score==null?'—':b6num(v.brier_score,3)} · estabilidade ${c.stability_pp==null?'—':b6num(c.stability_pp,1)+' p.p.'}</small></div></div>`}
function calibrationBars(cal){const bins=(cal?.bins||[]).filter(x=>x.count);if(!bins.length)return '<div class="bt-empty small">Calibração ainda sem amostra suficiente.</div>';return `<div class="bt-cal">${bins.map(b=>`<div class="bt-bin"><span>${b.from}-${b.to}%</span><div><i style="width:${Math.max(0,Math.min(100,Number(b.mean_probability||0)))}%"></i><em style="left:${Math.max(0,Math.min(100,Number(b.hit_rate||0)))}%"></em></div><small>modelo ${b6pct(b.mean_probability)} · real ${b6pct(b.hit_rate)} · n=${b.count}</small></div>`).join('')}</div>`}
async function loadBacktestLab(){
  const c=b6cfg(),el=document.querySelector('#backtestLab');if(!el)return;if(!c){setTimeout(loadBacktestLab,1000);return}
  try{
    const rows=await b6q(c,'select=*&order=generated_at.desc&limit=1');const r=rows[0]||null,badge=document.querySelector('#backtestBadge');
    if(!r){if(badge)badge.textContent='SHADOW · aguardando';el.innerHTML='<div class="bt-empty"><strong>Replay Lab iniciando</strong><p>O P6 ainda não publicou o primeiro replay. Nenhuma regra será promovida automaticamente.</p></div>';return}
    const s=r.summary||{},q=s.source_quality||{},wf=s.walk_forward||{},best=s.best_candidate||{},cal=s.calibration||{};
    if(badge)badge.textContent=`SHADOW · ${b6state(r.sample_state)}`;
    const promo=String(r.promotion_state||'NO_PROMOTION')==='REVIEW_REQUIRED'?'REVISÃO NECESSÁRIA':'SEM PROMOÇÃO';
    el.innerHTML=`<div class="bt-kpis">
      <div><small>Replay auditável</small><b>${Number(q.audit_eligible||0)}</b><span>${Number(q.raw_settled||0)} liquidados brutos</span></div>
      <div><small>Walk-forward</small><b>${Number(wf.prediction_count||0)}</b><span>${Number(wf.fixture_count||0)} fixtures históricos</span></div>
      <div><small>Regras testadas</small><b>${Number(r.candidate_count||0)}</b><span>split cronológico 70/30</span></div>
      <div><small>Gate de promoção</small><b class="${promo==='SEM PROMOÇÃO'?'muted':''}">${promo}</b><span>${Number(r.promotion_count||0)} candidatas</span></div>
    </div>
    <div class="bt-audit"><strong>Higiene do replay</strong><span>${Number(q.post_event_excluded||0)} pós-jogo excluídas · ${Number(q.duplicate_prediction_excluded||0)} snapshots duplicados excluídos · ${Number(q.anti_lookahead_excluded||0)} violações temporais excluídas</span></div>
    <div class="bt-best"><div><small>Melhor regra atual</small><strong>${b6esc(ruleText(best))}</strong><span>${best?.validation?.count?`validação n=${best.validation.count} · acerto ${b6pct(best.validation.hit_rate)} · Wilson ${b6pct(best.validation.wilson_lower)}`:'Ainda sem amostra suficiente para recomendar mudança.'}</span></div><span class="bt-state">${b6esc(best.state||'INSUFFICIENT')}</span></div>
    <div class="bt-split"><div><h3>Calibração real emitida</h3><small>ECE ${cal?.audit?.ece==null?'—':b6num(cal.audit.ece,1)+' p.p.'}</small>${calibrationBars(cal.audit)}</div></div>
    ${(s.top_candidates||[]).length?`<div class="bt-candidates"><h3>Top regras em observação</h3>${s.top_candidates.slice(0,5).map(candRow).join('')}</div>`:''}
    <div class="bt-note">P6 · Replay sem lookahead. Walk-forward usa apenas partidas anteriores a cada kickoff e não recria odds históricas. Nenhum threshold do sistema é alterado automaticamente; qualquer candidata precisa passar pelo gate e revisão.</div>`;
  }catch(e){el.innerHTML=`<div class="bt-empty">Replay Lab indisponível agora · ${b6esc(e.message)}</div>`}
}
window.addEventListener('DOMContentLoaded',()=>{loadBacktestLab();setInterval(loadBacktestLab,60000)});
