/* P11_0_2_DISTINCT_ANALYSIS_LABELS */
const oxCfg=()=>window.MATCHINTEL_CONFIG||null;
const oxEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const oxHeaders=c=>({apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`});
async function oxQ(c,table,params='select=*'){
  const r=await fetch(`${c.SUPABASE_URL}/rest/v1/${table}?${params}`,{headers:oxHeaders(c),cache:'no-store'});
  if(!r.ok)throw new Error(`${table}: HTTP ${r.status}`);
  return r.json();
}
function oxCounts(rows=[]){const m={ATIVO:0,FINALIZADO:0,EXPIRADO:0,HISTORICO:0};for(const r of rows)m[String(r.lifecycle_state||'').toUpperCase()]=Number(r.match_count||0);return m}
function oxRenderLifecycle(rows=[]){
  const el=document.querySelector('#lifecycleSummary');if(!el)return;
  const m=oxCounts(rows);
  const cards=[
    ['ATIVO','Ativos agora',m.ATIVO,'Recebidos pelo Gateway nos últimos 3 min','ok'],
    ['FINALIZADO','Finalizados recentes',m.FINALIZADO,'Encerrados nos últimos 20 min','done'],
    ['EXPIRADO','Expirados',m.EXPIRADO,'Sessões antigas fora do radar operacional','warn'],
    ['HISTORICO','Histórico',m.HISTORICO,'Encerrados preservados para auditoria','muted']
  ];
  el.innerHTML=cards.map(([k,label,n,sub,tone])=>`<div class="life-card ${tone}"><div><small>${oxEsc(k)}</small><strong>${oxEsc(label)}</strong></div><b>${n}</b><span>${oxEsc(sub)}</span></div>`).join('');
  const badge=document.querySelector('#lifecycleBadge');if(badge)badge.textContent=`${m.ATIVO} ativos · ${m.EXPIRADO} expirados`;
}
async function oxLoadLifecycle(){
  const c=oxCfg();if(!c){setTimeout(oxLoadLifecycle,800);return}
  try{oxRenderLifecycle(await oxQ(c,'matchintel_match_lifecycle_summary'))}
  catch(e){const el=document.querySelector('#lifecycleSummary');if(el)el.innerHTML=`<div class="life-empty">Lifecycle indisponível · ${oxEsc(e.message)}</div>`}
}
function oxSetupLab(targetId,buttonId,openLabel='análise completa',closeLabel='análise'){
  const el=document.getElementById(targetId),btn=document.getElementById(buttonId);if(!el||!btn)return;
  const key=`matchintel:${targetId}:expanded`;
  let expanded=sessionStorage.getItem(key)==='1';
  const apply=()=>{el.classList.toggle('lab-compact',!expanded);btn.textContent=expanded?`Recolher ${closeLabel}`:`Ver ${openLabel}`;btn.setAttribute('aria-expanded',String(expanded))};
  btn.addEventListener('click',()=>{expanded=!expanded;sessionStorage.setItem(key,expanded?'1':'0');apply()});
  apply();
}
window.addEventListener('DOMContentLoaded',()=>{
  oxSetupLab('performanceLab','performanceToggle','Performance completa','Performance');
  oxSetupLab('backtestLab','backtestToggle','Replay completo','Replay');
  oxLoadLifecycle();
  setInterval(oxLoadLifecycle,30000);
});
