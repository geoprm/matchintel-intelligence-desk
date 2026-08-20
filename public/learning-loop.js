const l11Cfg=()=>window.MATCHINTEL_CONFIG||null;
const l11Esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const l11Hdr=c=>({apikey:c.SUPABASE_KEY,Authorization:`Bearer ${c.SUPABASE_KEY}`});
const l11Num=(v,d=0)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
const l11Pct=v=>v==null||!Number.isFinite(Number(v))?'—':`${Number(v).toFixed(1)}%`;
const l11StatusLabel=s=>({WAITING_AUDIT:'AGUARDANDO BASE AUDITÁVEL',LEARNING:'APRENDENDO',CANDIDATES_AVAILABLE:'PADRÕES EM TESTE',REVIEW_REQUIRED:'CANDIDATO PARA REVISÃO'})[s]||s||'—';
const l11Tone=s=>({OBSERVAR:'observe',TESTAR:'test',CANDIDATO:'candidate',REJEITADO:'reject'})[s]||'observe';

async function l11Api(c){
  const r=await fetch(`${c.SUPABASE_URL}/functions/v1/matchintel-learning-loop`,{headers:l11Hdr(c),cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j?.ok)throw new Error(j?.error||`HTTP ${r.status}`);
  return j;
}
function l11Evidence(title,arr,good){
  const xs=(arr||[]).filter(Boolean);
  if(!xs.length)return '';
  return `<div class="l11-evidence ${good?'for':'against'}"><small>${title}</small>${xs.slice(0,4).map(x=>`<span>${good?'✓':'·'} ${l11Esc(x)}</span>`).join('')}</div>`;
}
function l11JournalCard(j){
  return `<article class="l11-journal-card ${l11Tone(j.status)}">
    <header><div><small>${l11Esc(j.key||'learning')}</small><strong>${l11Esc(j.title)}</strong></div><b>${l11Esc(j.status)}</b></header>
    <p>${l11Esc(j.what)}</p>
    <div class="l11-journal-meta"><span><small>Amostra</small><b>${l11Num(j.sample)}</b></span><span><small>Confiança</small><b>${l11Esc(j.confidence)}</b></span><span><small>Impacto</small><b>${l11Esc(j.impact)}</b></span></div>
    <div class="l11-evidence-grid">${l11Evidence('Evidência a favor',j.for,true)}${l11Evidence('Limites / contra',j.against,false)}</div>
  </article>`;
}
function l11Candidate(c){
  return `<article class="l11-candidate ${l11Tone(c.status)}">
    <header><div><small>${l11Esc(c.dimension)}</small><strong>${l11Esc(c.segment)}</strong></div><b>${l11Esc(c.status)}</b></header>
    <div class="l11-candidate-kpis">
      <span><small>Amostra</small><b>${l11Num(c.sample_size)}</b></span>
      <span><small>Hit rate</small><b>${l11Pct(c.hit_rate)}</b></span>
      <span><small>Prob. média</small><b>${l11Pct(c.mean_probability)}</b></span>
      <span><small>Erro calib.</small><b>${c.calibration_error_pp==null?'—':`${l11Num(c.calibration_error_pp,1)} p.p.`}</b></span>
      <span><small>Wilson lower</small><b>${l11Pct(c.wilson_lower)}</b></span>
      <span><small>Yield auditável</small><b>${l11Pct(c.yield_pct)}</b></span>
    </div>
    <div class="l11-candidate-body">
      <div><small>Confiança</small><b>${l11Esc(c.confidence)}</b></div>
      <div><small>Impacto potencial</small><b>${l11Esc(c.impact_potential)}</b></div>
      <div><small>Gate</small><b>P6 OBRIGATÓRIO</b></div>
    </div>
    ${l11Evidence('Evidência a favor',c.evidence_for,true)}
    ${l11Evidence('Evidência contra',c.evidence_against,false)}
    <p class="l11-proposal">Regra candidata: <strong>${l11Esc(c?.rule_proposal?.condition||`${c.dimension} == ${c.segment}`)}</strong></p>
  </article>`;
}
function l11ProviderRows(providers={}){
  const es=Object.entries(providers);
  if(!es.length)return '<div class="l11-empty-small">Nenhuma fonte Telegram suficiente para diagnóstico.</div>';
  return es.map(([name,v])=>`<span><b>${l11Esc(name)}</b><small>${Number(v.resolved||0)}/${Number(v.total||0)} resolvidos</small></span>`).join('');
}
async function l11Load(){
  const c=l11Cfg(),root=document.querySelector('#learningLoopCenter');
  if(!root)return;
  if(!c){setTimeout(l11Load,800);return}
  try{
    root.innerHTML='<div class="l11-loading">Atualizando Learning Journal…</div>';
    const j=await l11Api(c),s=j.summary||{},a=s.audit||{},p7=s.p7||{},p6=s.p6||{},tg=s.telegram||{},ex=s.execution||{},cl=s.candidate_lab||{},journal=s.journal||[],cands=j.candidates||[];
    const badge=document.querySelector('#learningLoopBadge');
    if(badge)badge.textContent=`P11 · ${l11StatusLabel(s.status)}`;
    root.innerHTML=`<div class="l11-hero"><div><small>P11 · INTELLIGENCE LEARNING LOOP</small><strong>${l11StatusLabel(s.status)}</strong><span>Aprende com resultados auditáveis, Telegram resolvido, execução real e P6. Nenhuma regra é alterada automaticamente.</span></div><b>SHADOW LEARNING</b></div>
      <div class="l11-guardrails">
        <span><small>Mudança automática</small><b>DESLIGADA</b></span>
        <span><small>Promoção automática</small><b>DESLIGADA</b></span>
        <span><small>Gate obrigatório</small><b>P6 WALK-FORWARD</b></span>
        <span><small>Candidato formal</small><b>≥120 CASOS + ESTABILIDADE</b></span>
      </div>
      <div class="l11-kpis">
        <span><small>Auditáveis</small><b>${Number(a.audit_eligible||0)}</b><em>${Number(a.raw_settled||0)} encerrados brutos</em></span>
        <span><small>Pós-evento excluídos</small><b>${Number(a.post_event_excluded||0)}</b><em>${Number(a.unsupported||0)} unsupported</em></span>
        <span><small>P7 histórico</small><b>${Number(p7.fixtures||0)}/${Number(p7.target||600)}</b><em>crescendo em paralelo</em></span>
        <span><small>P6 walk-forward</small><b>${Number(p6.walkforward_predictions||0)}</b><em>${l11Esc(p6.sample_state||'INSUFFICIENT')}</em></span>
        <span><small>Telegram resolvido</small><b>${Number(tg.resolved||0)}/${Number(tg.total||0)}</b><em>${Number(tg.unresolved||0)} não resolvido(s)</em></span>
        <span><small>Execução real</small><b>${Number(ex.count||0)}</b><em>${Number(ex.settled||0)} settled</em></span>
        <span><small>Segmentos analisáveis</small><b>${Number(cl.total||0)}</b><em>${Number(cl.test||0)} em TESTAR</em></span>
        <span><small>Candidatos formais</small><b>${Number(cl.candidate||0)}</b><em>sempre exige revisão P6</em></span>
      </div>
      <div class="l11-section-head"><div><small>LEARNING JOURNAL</small><strong>O que o sistema aprendeu — e o que ainda não pode concluir</strong></div><span>${journal.length} registros</span></div>
      <div class="l11-journal">${journal.map(l11JournalCard).join('')}</div>
      <div class="l11-section-head"><div><small>TELEGRAM DIAGNOSTICS</small><strong>Resolução por fonte</strong></div><span>performance só após vínculo auditável</span></div>
      <div class="l11-provider-grid">${l11ProviderRows(tg.providers||{})}</div>
      <div class="l11-section-head"><div><small>CANDIDATE RULE LAB</small><strong>Hipóteses que merecem teste — nunca promoção direta</strong></div><span>${cands.length} exibido(s)</span></div>
      ${cands.length?`<div class="l11-candidates">${cands.map(l11Candidate).join('')}</div>`:`<div class="l11-empty"><strong>Nenhuma regra candidata ainda.</strong><span>Isso é saudável. O P11 está recusando conclusões com amostra insuficiente. Quando segmentos auditáveis crescerem, eles passam por OBSERVAR → TESTAR → CANDIDATO; CANDIDATO ainda precisa do P6.</span></div>`}
      <p class="l11-note">P11 usa cronologia estrita e deduplica pela primeira previsão de cada match+market. Previsões pós-evento, resultados UNSUPPORTED e sinais Telegram não resolvidos não viram “aprendizado positivo”. ROI só aparece quando existem odds realmente observadas.</p>`;
  }catch(e){root.innerHTML=`<div class="l11-empty"><strong>P11 indisponível</strong><span>${l11Esc(e.message)}</span></div>`}
}
window.addEventListener('DOMContentLoaded',()=>{l11Load();setInterval(l11Load,300000)});
