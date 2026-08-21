/* P11.0.5.6.1 INTERACTION RECOVERY */
const IR_LABELS=[
  'Atualizar agora',
  'Evidência / Multi-Print',
  'Instant Markets',
  'Late Goal',
  'Corner 35+',
  '84:45 Corner/Late'
];

const irNorm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const irEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const irSleep=ms=>new Promise(r=>setTimeout(r,ms));

function irToast(message,tone='ok'){
  let box=document.querySelector('#irToast');
  if(!box){box=document.createElement('div');box.id='irToast';box.className='ir-toast';document.body.appendChild(box)}
  box.className=`ir-toast ${tone}`;box.textContent=message;box.classList.add('show');
  clearTimeout(irToast._t);irToast._t=setTimeout(()=>box.classList.remove('show'),2600);
}

function irFindLabelFromNode(node){
  let el=node instanceof Element?node:null;
  for(let i=0;el&&i<6;i++,el=el.parentElement){
    const txt=irNorm(el.textContent);
    for(const label of IR_LABELS){
      const n=irNorm(label);
      if(txt.includes(n))return {label,el};
    }
  }
  return null;
}

function irSignalsNav(){
  const candidates=[...document.querySelectorAll('button,a,[role="button"]')];
  const hit=candidates.find(el=>{
    const t=irNorm(el.textContent);
    return t==='sinais'||t.startsWith('sinais ')||el.getAttribute('data-screen')==='signals'||el.getAttribute('href')==='#signals';
  });
  if(hit){try{hit.click()}catch{}}
  const section=document.querySelector('#signals');
  if(section){section.classList.add('active');section.scrollIntoView({behavior:'smooth',block:'start'})}
  return section;
}

async function irOpenAssist({market='UNKNOWN',minute='',focusMarket=false}={}){
  irSignalsNav();
  for(let i=0;i<20;i++){
    const details=document.querySelector('details.ea-manual'),form=document.querySelector('#eaManualForm');
    if(details&&form){
      details.open=true;
      await irSleep(50);
      const marketEl=form.querySelector('[name="market"]'),minuteEl=form.querySelector('[name="minute"]');
      if(marketEl&&market){marketEl.value=market;marketEl.dispatchEvent(new Event('change',{bubbles:true}))}
      if(minuteEl&&minute){minuteEl.value=String(minute);minuteEl.dispatchEvent(new Event('input',{bubbles:true}))}
      details.scrollIntoView({behavior:'smooth',block:'center'});
      if(focusMarket&&marketEl)setTimeout(()=>marketEl.focus(),350);
      else setTimeout(()=>form.querySelector('[name="source"]')?.focus(),350);
      return true;
    }
    await irSleep(150);
  }
  irToast('External Source Assist não encontrado nesta tela.','warn');
  return false;
}

function irEvidenceEnsure(){
  let input=document.querySelector('#irEvidenceInput');
  if(!input){
    input=document.createElement('input');
    input.id='irEvidenceInput';input.type='file';input.accept='image/*';input.multiple=true;input.hidden=true;
    document.body.appendChild(input);
    input.addEventListener('change',()=>irEvidenceAdd([...input.files||[]]));
  }
  return input;
}
function irEvidenceState(){window.__miEvidenceSession=window.__miEvidenceSession||[];return window.__miEvidenceSession}
function irEvidenceAdd(files){
  const rows=irEvidenceState();
  for(const file of files){
    if(!file?.type?.startsWith('image/'))continue;
    rows.push({id:`ev_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,name:file.name,size:file.size,url:URL.createObjectURL(file),file});
  }
  irEvidenceRender();
  irToast(`${files.length} print(s) adicionado(s) à sessão local.`);
}
function irEvidenceRemove(id){
  const rows=irEvidenceState(),i=rows.findIndex(x=>x.id===id);
  if(i>=0){try{URL.revokeObjectURL(rows[i].url)}catch{}rows.splice(i,1)}
  irEvidenceRender();
}
function irEvidenceClear(){
  const rows=irEvidenceState();for(const r of rows)try{URL.revokeObjectURL(r.url)}catch{}
  rows.splice(0);irEvidenceRender();
}
function irEvidenceRender(){
  let modal=document.querySelector('#irEvidenceModal');
  if(!modal){
    modal=document.createElement('div');modal.id='irEvidenceModal';modal.className='ir-evidence-backdrop';
    modal.innerHTML=`<section class="ir-evidence-panel" role="dialog" aria-modal="true" aria-label="Evidência Multi-Print">
      <div class="ir-evidence-head"><div><b>Evidência / Multi-Print</b><small>Sessão local · nenhum arquivo é enviado automaticamente</small></div><button type="button" data-ir-close>×</button></div>
      <div class="ir-evidence-actions"><button type="button" data-ir-add>+ Adicionar prints</button><button type="button" data-ir-clear>Limpar sessão</button></div>
      <div id="irEvidenceGrid" class="ir-evidence-grid"></div>
      <p class="ir-evidence-note">Os prints ficam apenas nesta sessão do navegador. Esta etapa organiza evidências; não executa OCR/análise automática nem envia conteúdo ao backend.</p>
    </section>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-ir-close]'))modal.classList.remove('open')});
    modal.querySelector('[data-ir-add]').onclick=()=>irEvidenceEnsure().click();
    modal.querySelector('[data-ir-clear]').onclick=()=>irEvidenceClear();
  }
  const grid=modal.querySelector('#irEvidenceGrid'),rows=irEvidenceState();
  grid.innerHTML=rows.length?rows.map(r=>`<article><img src="${irEsc(r.url)}" alt="${irEsc(r.name)}"><div><span>${irEsc(r.name)}</span><button type="button" data-ir-remove="${irEsc(r.id)}">Remover</button></div></article>`).join(''):`<div class="ir-evidence-empty">Nenhum print nesta sessão.</div>`;
  grid.querySelectorAll('[data-ir-remove]').forEach(b=>b.onclick=()=>irEvidenceRemove(b.dataset.irRemove));
  modal.classList.add('open');
}

function irChoice84(){
  let modal=document.querySelector('#irChoiceModal');
  if(!modal){
    modal=document.createElement('div');modal.id='irChoiceModal';modal.className='ir-choice-backdrop';
    modal.innerHTML=`<section class="ir-choice-panel" role="dialog" aria-modal="true">
      <div><b>84:45 Corner/Late</b><small>Qual janela você quer registrar?</small></div>
      <button type="button" data-ir-84="CORNERS_FT">Escanteios FT · 85'</button>
      <button type="button" data-ir-84="LATE_GOAL">Gol tardio · 85'</button>
      <button type="button" data-ir-choice-close>Cancelar</button>
    </section>`;
    document.body.appendChild(modal);
    modal.onclick=e=>{if(e.target===modal||e.target.closest('[data-ir-choice-close]'))modal.classList.remove('open')};
    modal.querySelectorAll('[data-ir-84]').forEach(b=>b.onclick=async()=>{modal.classList.remove('open');await irOpenAssist({market:b.dataset.ir84,minute:85})});
  }
  modal.classList.add('open');
}

async function irAction(label){
  switch(label){
    case 'Atualizar agora':
      irToast('Atualizando a tela com o estado mais recente…');
      setTimeout(()=>window.location.reload(),350);
      break;
    case 'Evidência / Multi-Print':
      irEvidenceRender();
      break;
    case 'Instant Markets':
      irToast('Abrindo validação assistida para mercado imediato.');
      await irOpenAssist({market:'UNKNOWN',focusMarket:true});
      break;
    case 'Late Goal':
      irToast('Abrindo janela assistida de gol tardio.');
      await irOpenAssist({market:'LATE_GOAL'});
      break;
    case 'Corner 35+':
      irToast('Abrindo janela assistida de escanteios aos 35 minutos.');
      await irOpenAssist({market:'CORNERS_HT',minute:35});
      break;
    case '84:45 Corner/Late':
      irChoice84();
      break;
  }
}

function irDecorate(){
  const all=[...document.querySelectorAll('button,a,[role="button"],div')];
  for(const el of all){
    if(el.dataset?.irDecorated)return;
    const txt=irNorm(el.textContent);
    const label=IR_LABELS.find(x=>txt===irNorm(x)||txt.startsWith(irNorm(x)+' '));
    if(!label)continue;
    const card=el.closest('button,a,[role="button"]')||el;
    if(card.dataset.irDecorated)return;
    card.dataset.irDecorated='1';
    card.classList.add('ir-action-ready');
    if(!card.querySelector('.ir-action-badge')){
      const badge=document.createElement('span');badge.className='ir-action-badge';badge.textContent='ATIVA';card.appendChild(badge);
    }
  }
}

document.addEventListener('click',e=>{
  const hit=irFindLabelFromNode(e.target);if(!hit)return;
  // Only intercept inside the quick-action surface. Avoid matching unrelated headings elsewhere.
  const txt=irNorm(hit.el.textContent);
  const looksQuick=IR_LABELS.some(x=>txt.includes(irNorm(x)));
  if(!looksQuick)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  irAction(hit.label);
},true);

window.addEventListener('DOMContentLoaded',()=>{
  irDecorate();
  const obs=new MutationObserver(()=>irDecorate());obs.observe(document.body,{childList:true,subtree:true});
  window.MatchIntelInteractionRecovery={version:'P11.0.5.6.1',openAssist:irOpenAssist,evidence:()=>irEvidenceState().slice()};
});
