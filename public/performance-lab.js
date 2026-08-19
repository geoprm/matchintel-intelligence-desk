const p5esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const p5pct=v=>v==null?'—':`${Number(v).toFixed(1)}%`;
const p5num=(v,d=2)=>v==null?'—':Number(v).toFixed(d);
const p5cfg=()=>window.MATCHINTEL_CONFIG||null;
const p5headers=c=>({apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`});
async function p5q(c,table,params){const r=await fetch(`${c.SUPABASE_URL}/rest/v1/${table}?${params}`,{headers:p5headers(c),cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
function sampleText(s){return ({INSUFFICIENT:'amostra insuficiente',EARLY:'amostra inicial',LEARNING:'em aprendizado',CALIBRATING:'calibração ativa'})[s]||String(s||'coletando').toLowerCase()}
function resultTag(r){if(r==='WON')return '<span class="perf-result won">GREEN</span>';if(r==='LOST')return '<span class="perf-result lost">RED</span>';if(r==='UNSUPPORTED')return '<span class="perf-result neutral">N/D</span>';return `<span class="perf-result neutral">${p5esc(r||'—')}</span>`}
function groupCards(s){
  const kind=s?.by_kind||{},defs=[['VALUE','Value Board'],['TICKET','Bilhetes'],['PREDICTION','Modelo']];
  return defs.map(([k,label])=>{const x=kind[k]||{};return `<div class="perf-mini"><small>${label}</small><b>${x.count||0}</b><span>${x.hit_rate==null?'—':p5pct(x.hit_rate)} acerto</span></div>`}).join('');
}
function recCard(r){
  const title=r.record_kind==='TICKET'?`Bilhete ${r.ticket_type||''}`:`${r.home||''}${r.away?` × ${r.away}`:''}`||r.record_kind;
  const market=r.market_label||r.market||r.record_kind;
  const roi=Number.isFinite(Number(r.profit_units))?` · ${Number(r.profit_units)>=0?'+':''}${Number(r.profit_units).toFixed(2)}u`:'';
  return `<div class="perf-row"><div><strong>${p5esc(title)}</strong><small>${p5esc(market)}${r.model_probability!=null?` · modelo ${p5pct(r.model_probability)}`:''}${r.observed_odds!=null?` · odd ${p5num(r.observed_odds)}`:''}</small></div><div>${resultTag(r.result)}<small>${roi}</small></div></div>`;
}
async function loadPerformanceLab(){
  const c=p5cfg(),el=document.querySelector('#performanceLab');if(!el)return;if(!c){setTimeout(loadPerformanceLab,1000);return}
  try{
    const [snaps,records]=await Promise.all([
      p5q(c,'matchintel_performance_snapshots','select=*&order=calculated_at.desc&limit=1'),
      p5q(c,'matchintel_performance_records','select=*&result=in.(WON,LOST,UNSUPPORTED)&order=settled_at.desc.nullslast&limit=8')
    ]);
    const s=snaps[0]||null,badge=document.querySelector('#performanceBadge');
    if(!s){
      if(badge)badge.textContent='SHADOW · coletando';
      el.innerHTML='<div class="perf-empty"><strong>Performance Lab iniciando</strong><p>O MatchIntel agora congela previsões antes do resultado e liquida automaticamente quando o placar final chega. Nenhuma estatística de desempenho é inventada.</p></div>';return;
    }
    if(badge)badge.textContent=`SHADOW · ${sampleText(s.sample_state)}`;
    const yieldLabel=Number(s.observed_bets||0)>0?p5pct(s.yield_pct):'—';
    const profit=Number(s.profit_units||0);
    el.innerHTML=`<div class="perf-kpis">
      <div><small>Liquidados</small><b>${Number(s.settled_count||0)}</b><span>${Number(s.won_count||0)} green · ${Number(s.lost_count||0)} red</span></div>
      <div><small>Taxa de acerto</small><b>${p5pct(s.hit_rate)}</b><span>previsões registradas antes</span></div>
      <div><small>Yield observado</small><b>${yieldLabel}</b><span>${Number(s.observed_bets||0)} entradas com odd real</span></div>
      <div><small>Brier</small><b>${s.brier_score==null?'—':p5num(s.brier_score,3)}</b><span>menor é melhor</span></div>
      <div><small>Resultado flat</small><b>${Number(s.observed_bets||0)?`${profit>=0?'+':''}${profit.toFixed(2)}u`:'—'}</b><span>1 unidade por entrada observável</span></div>
    </div>
    <div class="perf-groups">${groupCards(s)}</div>
    <div class="perf-note">SHADOW MODE · desempenho histórico não garante resultado futuro. Yield/resultado usam somente odds realmente observadas; bilhetes sem preço completo entram em acerto/calibração, não em ROI.</div>
    ${records.length?`<div class="perf-recent"><h3>Últimos resultados</h3>${records.map(recCard).join('')}</div>`:'<div class="perf-empty small">Ainda não há resultados liquidados. O journal já está ativo.</div>'}`;
  }catch(e){el.innerHTML=`<div class="perf-empty">Performance Lab indisponível agora · ${p5esc(e.message)}</div>`}
}
window.addEventListener('DOMContentLoaded',()=>{loadPerformanceLab();setInterval(loadPerformanceLab,30000)});
