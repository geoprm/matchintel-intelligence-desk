const hdq=(s,r=document)=>r.querySelector(s);
const hdqa=(s,r=document)=>[...r.querySelectorAll(s)];
const hdEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function hdMoveGroup(id,dest,{toggle=false}={}){
  const node=document.getElementById(id); if(!node||!dest)return false;
  const title=node.previousElementSibling?.classList?.contains('section-title')?node.previousElementSibling:null;
  if(title)dest.appendChild(title);
  dest.appendChild(node);
  if(toggle){
    const btn=node.nextElementSibling;
    if(btn?.classList?.contains('lab-toggle'))dest.appendChild(btn);
  }
  return true;
}
function hdText(sel,fallback='—'){
  const n=hdq(sel); const t=String(n?.textContent||'').replace(/\s+/g,' ').trim();
  return t||fallback;
}
function hdExtractNumber(text,re){
  const m=String(text||'').match(re); return m?m[1]:null;
}
function hdFindKpi(container,label){
  const root=hdq(container); if(!root)return null;
  for(const el of root.querySelectorAll('span')){
    const small=el.querySelector('small')?.textContent?.trim().toLowerCase();
    if(small&&small.includes(label.toLowerCase()))return el.querySelector('b')?.textContent?.trim()||null;
  }
  return null;
}
function hdSystemPills(){
  return hdqa('#statusPills .pill').slice(0,3).map(x=>`<span class="${x.classList.contains('ok')?'ok':x.classList.contains('warn')?'warn':'bad'}">${hdEsc(x.textContent.trim())}</span>`).join('');
}
function hdRefresh(){
  const deck=hdq('#homeCommandDeck'),hub=hdq('#intelligenceHubSummary'); if(!deck||!hub)return;
  const p10=hdText('#ticketExecutionBadge','P10 · aguardando');
  const p101=hdText('#settlementBankrollBadge','P10.1 · aguardando');
  const p11=hdText('#learningLoopBadge','P11 · aguardando');
  const p7=hdText('#historyExpansionBadge','P7 · sincronizando');
  const settled=hdFindKpi('#settlementBankrollCenter','Executados')||hdExtractNumber(p101,/(\d+)\s+settled/i)||'0';
  const profit=hdFindKpi('#settlementBankrollCenter','Lucro')||'—';
  const bankroll=hdFindKpi('#settlementBankrollCenter','Bankroll atual')||'—';
  const audit=hdFindKpi('#learningLoopCenter','Auditáveis')||'0';
  const candidates=hdFindKpi('#learningLoopCenter','Candidatos formais')||'0';
  const p7Count=hdFindKpi('#learningLoopCenter','P7 histórico')||hdExtractNumber(p7,/(\d+)\s*\/\s*600/)||'—';
  const performance=`${settled} exec. · ${profit}`;
  deck.innerHTML=`<div class="hd-main"><div><small>COMMAND DECK</small><strong>O que merece atenção agora</strong><span>Decisão e execução ficam na Home. Laboratórios, calibração, aprendizado e diagnóstico ficam no Intelligence Hub.</span></div><button id="openIntelligenceHub" type="button">Abrir Intelligence Hub →</button></div>
    <div class="hd-strip">
      <span><small>P10 · Bilhetes</small><b>${hdEsc(p10)}</b></span>
      <span><small>Execução real</small><b>${hdEsc(performance)}</b></span>
      <span><small>P7 · Histórico</small><b>${hdEsc(String(p7Count).includes('/')?p7Count:`${p7Count}/600`)}</b></span>
      <span><small>P11 · Aprendizado</small><b>${hdEsc(`${audit} auditáveis · ${candidates} cand.`)}</b></span>
    </div>
    <div class="hd-status">${hdSystemPills()}<span class="neutral">${hdEsc(bankroll==='—'?'Bankroll ainda sem movimento':`Bankroll ${bankroll}`)}</span></div>`;
  hub.innerHTML=`<div class="hub-summary-grid">
      <span><small>P10.1</small><b>${hdEsc(p101)}</b></span>
      <span><small>P11</small><b>${hdEsc(p11)}</b></span>
      <span><small>P7</small><b>${hdEsc(p7)}</b></span>
      <span><small>Sistema</small><b>${hdEsc(hdText('#lastSync','sincronizando'))}</b></span>
    </div>`;
  hdq('#openIntelligenceHub')?.addEventListener('click',hdOpenHub,{once:true});
}
function hdShowScreen(id){
  hdqa('.screen').forEach(s=>s.classList.toggle('active',s.id===id));
  hdqa('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));
  window.scrollTo({top:0,behavior:'smooth'});
}
function hdOpenHub(){hdShowScreen('intelligence');hdRefresh()}
function hdOpenHome(){hdShowScreen('home')}
function hdBuild(){
  const home=hdq('#home'),live=hdq('#live'); if(!home||!live||hdq('#intelligence'))return;
  const hub=document.createElement('section'); hub.id='intelligence'; hub.className='screen intelligence-screen';
  hub.innerHTML=`<div class="hub-top"><div><small>INTELLIGENCE HUB</small><h2>Laboratórios, aprendizado e diagnóstico</h2><p>A Home mostra ação. Aqui ficam as camadas analíticas completas, sem perder nenhum motor ou dado.</p></div><button id="closeIntelligenceHub" type="button">← Voltar à Home</button></div>
    <div id="intelligenceHubSummary"></div>
    <div class="hub-jump">
      <button data-hub-target="hubPerformance">Desempenho</button>
      <button data-hub-target="hubLearning">Aprendizado</button>
      <button data-hub-target="hubHistory">Histórico</button>
      <button data-hub-target="hubDiagnostics">Diagnóstico</button>
    </div>
    <div class="hub-section" id="hubPerformance"><div class="hub-label"><span>01</span><div><small>EXECUÇÃO + CALIBRAÇÃO</small><strong>Desempenho</strong></div></div></div>
    <div class="hub-section" id="hubLearning"><div class="hub-label"><span>02</span><div><small>LEARNING JOURNAL + CANDIDATE RULE LAB</small><strong>Aprendizado</strong></div></div></div>
    <div class="hub-section" id="hubHistory"><div class="hub-label"><span>03</span><div><small>P7 + LIFECYCLE</small><strong>Histórico e cobertura</strong></div></div></div>
    <div class="hub-section" id="hubDiagnostics"><div class="hub-label"><span>04</span><div><small>RADAR + SINAIS</small><strong>Diagnóstico operacional</strong></div></div></div>`;
  live.parentNode.insertBefore(hub,live);

  // Move detailed analytical blocks out of Home without changing IDs or engines.
  hdMoveGroup('settlementBankrollCenter',hdq('#hubPerformance'));
  hdMoveGroup('performanceLab',hdq('#hubPerformance'),{toggle:true});
  hdMoveGroup('backtestLab',hdq('#hubPerformance'),{toggle:true});
  hdMoveGroup('learningLoopCenter',hdq('#hubLearning'));
  hdMoveGroup('historyExpansion',hdq('#hubHistory'));
  hdMoveGroup('lifecycleSummary',hdq('#hubHistory'));
  hdMoveGroup('radarCards',hdq('#hubDiagnostics'));
  hdMoveGroup('homeSignals',hdq('#hubDiagnostics'));

  // Insert Command Deck after P10; operational flow remains untouched.
  const p10=hdq('#ticketExecutionCenter');
  if(p10){
    const title=document.createElement('div');title.className='section-title hd-title';title.innerHTML='<h2>Command Deck</h2><span>ação primeiro · laboratório depois</span>';
    const deck=document.createElement('div');deck.id='homeCommandDeck';deck.className='home-command-deck';
    p10.insertAdjacentElement('afterend',title);title.insertAdjacentElement('afterend',deck);
  }

  hdq('#closeIntelligenceHub')?.addEventListener('click',hdOpenHome);
  hdqa('[data-hub-target]').forEach(b=>b.addEventListener('click',()=>hdq(`#${b.dataset.hubTarget}`)?.scrollIntoView({behavior:'smooth',block:'start'})));
  hdqa('.navbtn').forEach(b=>b.addEventListener('click',()=>hub.classList.remove('active')));

  // Clean old notification wording without changing push behavior.
  const alerts=hdq('#alertsStatus');
  if(alerts&&/alertas ativos neste aparelho|notifica/i.test(alerts.textContent||'')){
    const obs=new MutationObserver(()=>{if(/alertas ativos neste aparelho/i.test(alerts.textContent||''))alerts.textContent='Push backend ativo enquanto Gateway/Bridge sincronizam.'});
    obs.observe(alerts,{childList:true,subtree:true,characterData:true});
    if(/alertas ativos neste aparelho/i.test(alerts.textContent||''))alerts.textContent='Push backend ativo enquanto Gateway/Bridge sincronizam.';
  }

  hdRefresh();
  setInterval(hdRefresh,5000);
}
window.addEventListener('DOMContentLoaded',()=>setTimeout(hdBuild,50));