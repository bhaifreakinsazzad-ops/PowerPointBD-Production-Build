import type { createProjectClient,Order } from './project-client.ts';

export function mountOrderPanel(options:{client:ReturnType<typeof createProjectClient>;getProjectId():string|undefined;isApproved():boolean;
  isWorking():boolean;run(action:()=>Promise<void>):Promise<void>}){
  const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
  const button=(id:string)=>el<HTMLButtonElement>(id);
  let order:Order|undefined,productionKey:string|undefined,expiry:ReturnType<typeof setTimeout>|undefined;

  function clearDownload(){if(expiry)clearTimeout(expiry);expiry=undefined;const link=el<HTMLAnchorElement>('order-download-link');link.hidden=true;link.removeAttribute('href');}

  // Modal elements
  const modal=el('payment-modal');
  const modalAmount=el('payment-modal-amount');
  const modalStatus=el('payment-modal-status');
  const tabBtnBangla=button('tab-btn-bangla');
  const tabContentBangla=el('tab-content-bangla');

  function openModal(){
    if(!order?.quote||order.quote.status!=='active'||!order.quote.not_expired)return;
    const formatted=new Intl.NumberFormat('en-BD',{style:'currency',currency:'BDT'}).format(order.quote.quote_amount);
    modalAmount.textContent=`Payable Amount: ${formatted}`;
    modalStatus.textContent='';
    modal.hidden=false;
  }

  function closeModal(){modal.hidden=true;modalStatus.textContent='';}

  el('payment-close').addEventListener('click',closeModal);

  button('payment-confirm-bangla').addEventListener('click',()=>{
    const trxId=el<HTMLInputElement>('payment-trxid').value.trim();
    if(!trxId){modalStatus.textContent='অনুগ্রহ করে TrxID দিন।';return;}
    void options.run(async()=>{
      if(!order?.quote)return;
      modalStatus.textContent='TrxID সাবমিট হচ্ছে…';
      try {
        await options.client.confirmPayment(order.quote.id,'bangla_qr',trxId,crypto.randomUUID());
        modalStatus.textContent='যাচাই চলছে (সাধারণত ১০-৩০ মিনিট সময় লাগে)।';
        setTimeout(closeModal,1500);
        await refresh();
      } catch (err: any) {
        modalStatus.textContent = err?.message || 'সাবমিট ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
      }
    });
  });

  function update(){
    const active=!!options.getProjectId()&&options.isApproved(),locked=options.isWorking();
    el('order-panel').hidden=!active;
    button('order-refresh').disabled=locked||!active;
    button('order-quote').disabled=locked||!active||!order||order.payment?.status==='pending'
      ||(order.quote?.status==='active'&&order.quote.not_expired)
      ||!['design_approved','motion_configured','quoted','payment_failed'].includes(order.project.state);
    button('order-produce').disabled=locked||!active||!order?.can_produce;
    button('order-download').disabled=locked||!active||!order?.download_available;
    const canCheckout=!locked&&active&&!!order?.quote&&order.quote.status==='active'&&order.quote.not_expired&&order.payment?.status!=='verified';
    button('order-checkout').disabled=!canCheckout;
    button('order-checkout').textContent=canCheckout
      ?'Proceed to payment'
      :(order?.payment?.status==='verified'?'Payment verified':'Checkout unavailable');
  }

  async function refresh(){
    const id=options.getProjectId();if(!id||!options.isApproved())return;
    order=await options.client.order(id);
    const summary=el('quote-summary');summary.replaceChildren();
    if(order.quote){
      const quote=order.quote;
      if(quote.tier!=='static'||!Number.isSafeInteger(quote.quote_amount_paisa)||quote.quote_amount_paisa!==quote.quote_amount*100
        ||!Number.isInteger(quote.slide_count)||quote.slide_count<1||quote.slide_count>100)throw new Error('QUOTE_RESPONSE_INVALID');
      const amount=document.createElement('strong');amount.textContent=new Intl.NumberFormat('en-BD',{style:'currency',currency:'BDT'}).format(quote.quote_amount);
      const detail=document.createElement('p');detail.textContent=`${quote.slide_count} approved slides · Static · Quote ${quote.status}${quote.status==='active'&&!quote.not_expired?' (expired)':''}`;
      const expiration=document.createElement('p');expiration.textContent=`Quote expires: ${new Date(quote.expires_at).toLocaleString()}`;
      summary.append(amount,detail,expiration);
    }else summary.textContent='No quote yet. Request a server quote for the approved Static design.';
    let message='Checkout is unavailable: no real payment provider is configured. No money has been collected.';
    if(order.payment?.provider==='mock_sandbox')message=`Sandbox payment: ${order.payment.status}. This is development verification; no real payment was collected.`;
    else if(order.payment?.status==='verified')message=`Payment verified via ${order.payment.provider}. Entitlement active — ready to produce deck.`;
    else if(order.quote?.status==='active'&&order.quote.not_expired)message='Quote active. Proceed to payment via Bangla QR, Remitly, or Instant Investor Demo to unlock production.';
    if(order.production){message+=` Production: ${order.production.status} — ${order.production.progress_stage}.`;if(order.production.error_code)message+=` ${order.production.error_code}.`;}
    if(order.production?.status==='quarantined')productionKey=undefined;
    if(!order.download_available)clearDownload();
    el('order-status').textContent=message;update();
  }

  button('order-refresh').addEventListener('click',()=>void options.run(refresh));
  button('order-checkout').addEventListener('click',()=>{
    if(button('order-checkout').disabled)return;
    openModal();
  });
  button('order-quote').addEventListener('click',()=>{
    if(button('order-quote').disabled)return;
    void options.run(async()=>{const id=options.getProjectId();if(!id||!order)return;await options.client.quote(id,order.project.state==='design_approved');await refresh();});
  });
  button('order-produce').addEventListener('click',()=>{
    if(button('order-produce').disabled)return;
    void options.run(async()=>{const id=options.getProjectId();if(!id)return;productionKey??=crypto.randomUUID();await options.client.produce(id,productionKey);await refresh();});
  });
  button('order-download').addEventListener('click',()=>{
    if(button('order-download').disabled)return;
    void options.run(async()=>{
      const id=options.getProjectId();if(!id)return;clearDownload();const result=await options.client.download(id);
      if(!Number.isFinite(result.expires)||result.expires<1||result.expires>900)throw new Error('DOWNLOAD_URL_INVALID');
      const link=el<HTMLAnchorElement>('order-download-link');link.href=result.url;link.download=result.filename;link.textContent=`Download ${result.filename}`;link.hidden=false;
      el('order-status').textContent=`Private download ready for ${Math.floor(result.expires/60)} minutes. Anyone holding this link can use it until expiry.`;
      expiry=setTimeout(clearDownload,result.expires*1000);
    });
  });
  window.addEventListener('pagehide',clearDownload);
  update();
  return {update,refresh,reset(){order=undefined;productionKey=undefined;clearDownload();closeModal();el('quote-summary').replaceChildren();update();}};
}
