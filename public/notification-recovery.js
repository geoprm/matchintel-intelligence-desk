/* P11.0.5.7 NOTIFICATION RECOVERY — VAPID rotation + self-heal */
const NR_PUBLIC_KEY="BGkTAjIEZvyAPrDWGUJzGseRpN0b4YtVbJ0kBzxrlpKdKUdU0Jz7Jf4su60c3iD9v1oAwGqQv4Br4xqL_7N0CXM";
const NR_SUBSCRIBE_URL="https://tkzfkkqcgmzqjfcokrws.supabase.co/functions/v1/matchintel-push-subscribe";
const NR_TEST_URL="https://tkzfkkqcgmzqjfcokrws.supabase.co/functions/v1/matchintel-push-test";
const NR_VERSION="p11057-vapid-1";

function nrB64ToU8(s){const p='='.repeat((4-s.length%4)%4),x=(s+p).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(x);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
function nrU8ToB64(buf){if(!buf)return'';const a=new Uint8Array(buf);let s='';for(const b of a)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function nrStatus(msg,ok=true){const el=document.querySelector('#alertsStatus');if(el){el.textContent=msg;el.classList.toggle('ok',!!ok)}}
async function nrPost(sub,method='POST'){const r=await fetch(NR_SUBSCRIBE_URL,{method,headers:{'content-type':'application/json'},body:JSON.stringify(method==='DELETE'?{endpoint:sub.endpoint}:{subscription:sub.toJSON()})});if(!r.ok)throw new Error(`subscribe HTTP ${r.status}`);return r.json()}
async function nrTest(sub){
  const last=Number(localStorage.getItem('matchintel-p11057-test-at')||0);
  if(Date.now()-last<6*60*60*1000 && localStorage.getItem('matchintel-p11057-test-ok')===NR_VERSION)return true;
  localStorage.setItem('matchintel-p11057-test-at',String(Date.now()));
  const r=await fetch(NR_TEST_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});
  if(!r.ok)throw new Error(`push test HTTP ${r.status}`);
  localStorage.setItem('matchintel-p11057-test-ok',NR_VERSION);return true;
}
async function nrRecover(){
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))return;
  if(Notification.permission!=='granted')return;
  try{
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    const current=sub?.options?.applicationServerKey?nrU8ToB64(sub.options.applicationServerKey):'';
    if(sub&&current!==NR_PUBLIC_KEY){
      try{await nrPost(sub,'DELETE')}catch{}
      try{await sub.unsubscribe()}catch{}
      sub=null;
    }
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:nrB64ToU8(NR_PUBLIC_KEY)});
    await nrPost(sub,'POST');
    localStorage.setItem('matchintel-push-enabled','1');
    localStorage.setItem('matchintel-push-key-version',NR_VERSION);
    nrStatus('🔔 Push P11.0.5.7 registrado · executando autoteste único…',true);
    try{await nrTest(sub);nrStatus('🔔 Notificações P11.0.5.7 validadas neste aparelho.',true)}
    catch(e){console.error('[P11.0.5.7 push test]',e);nrStatus('⚠️ Inscrição refeita, mas o autoteste de push falhou. Toque no botão de alertas para testar novamente.',false)}
  }catch(e){console.error('[P11.0.5.7 notification recovery]',e);nrStatus('⚠️ Não consegui reparar a inscrição de notificações neste aparelho.',false)}
}
window.addEventListener('DOMContentLoaded',()=>setTimeout(nrRecover,900));
window.MatchIntelNotificationRecovery={version:NR_VERSION,recover:nrRecover};
