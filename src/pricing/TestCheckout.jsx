import { authStorage } from '../auth/tokenStore.mjs';
import { countryOptions } from './markets';
import {useEffect,useRef,useState} from 'react';
import {API_BASE,userSession} from '../utils/api';
import {authHref,policyHref} from '../routing/appRoutes';
import {moneyMinor,credits,expiryText,checkoutAvailable} from './pricingModel';
import './TestCheckout.css';

export const testCheckoutEnabled = checkoutAvailable;
const token=()=>authStorage.getItem('auth_token');
async function api(path,options={}){
  // Renew or restore the same session the pricing page shows before calling
  // Stripe test checkout; never send "Bearer null".
  try{await userSession?.restore();}catch{}
  if(!token())throw Error('Please sign in to continue to checkout.');
  const response=await fetch(API_BASE+'/api/test-billing'+path,{signal:AbortSignal.timeout(20000),...options,credentials:'omit',cache:'no-store',headers:{Authorization:'Bearer '+token(),'Content-Type':'application/json'}});
  const body=await response.json().catch(()=>null);if(response.status===401)throw Error('Your session has expired. Please sign in again to continue.');if(!response.ok)throw Error(body?.error?.message||'Test checkout is temporarily unavailable.');return body.data;
}
export function TestCheckoutDialog({selection,data,onClose}){
  const dialog=useRef(null),requestId=useRef(crypto.randomUUID());
  const [coupon,setCoupon]=useState(selection.coupon||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{dialog.current?.showModal();const node=dialog.current;return()=>node?.close();},[]);
  const plan=selection.plan,signedIn=!!token(),signInHref=(href=>href.startsWith('?')?'/'+href:href)(authHref('login'));
  async function checkout(event){
    event.preventDefault();setBusy(true);setError('');
    try{
      const result=await api('/checkout',{method:'POST',body:JSON.stringify({planId:plan.id,country:data.country,pricingKey:data.pricingKey,couponCode:coupon.trim(),requestId:requestId.current})});
      if(result.paid){window.location.assign('/app/pricing?testCheckout=success&order='+encodeURIComponent(result.orderId));return;}
      const destination=new URL(result.url);
      if(destination.protocol!=='https:'||destination.hostname!=='checkout.stripe.com'||destination.port)throw Error('Invalid test checkout destination.');
      window.location.assign(destination.href);
    }catch(e){setError(e.message);setBusy(false);}
  }
  return <dialog className="test-checkout-dialog" ref={dialog} onCancel={event=>{if(busy)event.preventDefault();else onClose();}} aria-labelledby="test-checkout-title">
    <form onSubmit={checkout}>
      <div className="test-checkout-heading"><span className="test-checkout-badge">STRIPE SANDBOX</span><button type="button" aria-label="Close test checkout" disabled={busy} onClick={onClose}>×</button></div>
      <h2 id="test-checkout-title">Test {plan.name}</h2><p>No real money will be charged. Use a Stripe test card, never a real card.</p>
      <div className="test-checkout-summary"><strong>{moneyMinor(plan.priceMinor,data)}{plan.kind==='subscription'?' / month':''}</strong><span>{credits(plan.credits)} test credits{plan.kind==='subscription'?' per billing period':''}</span></div>
      <p className="pricing-small">Billing country: <strong>{countryOptions.find(c=>c.code===data.country)?.name||data.country}</strong> · Payment currency: <strong>{data.currency}</strong>. Use a test billing address in the selected country.</p>
      <p>{plan.kind==='subscription'?'This creates a test monthly subscription. Credits expire at the end of each billing period. Coupons apply to the first invoice only.':'This is a one-time test purchase. '+expiryText(plan)}</p>
      <label>Coupon code (optional)<input value={coupon} maxLength={32} autoComplete="off" disabled={busy} onChange={e=>{setCoupon(e.target.value.toUpperCase());requestId.current=crypto.randomUUID();setError('');}}/></label>
      <p className="pricing-small">Your final test total appears on Stripe before you confirm. Test credits are added only after payment is verified. See the <a href={policyHref('terms')} target="_blank" rel="noreferrer">refund and cancellation policy</a>.</p>
      {error&&<p className="pricing-form-error" role="alert">{error}</p>}
      {signedIn?<button className="pricing-cta" type="submit" disabled={busy}>{busy?'Opening Stripe...':'Continue to Stripe test checkout'}</button>:
        <a className="pricing-cta" href={signInHref}>Sign in to continue</a>}
    </form>
  </dialog>;
}
// The signed-in user's current test subscription. Refreshes when a checkout
// result or cancellation changes it ('test-subscription-changed').
export function useCurrentSubscription(enabled){
  const [current,setCurrent]=useState(null);
  useEffect(()=>{
    if(!enabled){setCurrent(null);return;}
    let stopped=false;
    const load=()=>api('/current').then(d=>{if(!stopped)setCurrent(d.subscription);}).catch(()=>{if(!stopped)setCurrent(null);});
    load();window.addEventListener('test-subscription-changed',load);
    return()=>{stopped=true;window.removeEventListener('test-subscription-changed',load);};
  },[enabled]);
  return current;
}
const dateText=value=>value?new Date(value).toLocaleDateString(undefined,{dateStyle:'medium'}):null;
/** Plan & billing: current plan, cancel (with confirmation) and the Stripe billing portal. */
export function PlanBilling({subscription}){
  const [busy,setBusy]=useState(''),[error,setError]=useState('');
  if(!subscription)return null;
  const until=dateText(subscription.currentPeriodEnd);
  async function manage(){
    setBusy('portal');setError('');
    try{
      const {url}=await api('/portal',{method:'POST',body:'{}'});
      const destination=new URL(url);
      if(destination.protocol!=='https:'||destination.hostname!=='billing.stripe.com')throw Error('Billing management is not available right now.');
      window.location.assign(destination.href);
    }catch(e){setError(e.message);setBusy('');}
  }
  async function cancel(){
    if(!window.confirm('Cancel your '+subscription.name+' subscription? It stays active'+(until?' until '+until:' until the end of the current billing period')+'. No further payments will be taken.'))return;
    setBusy('cancel');setError('');
    try{await api('/orders/'+encodeURIComponent(subscription.orderId)+'/cancel-subscription',{method:'POST',body:'{}'});window.dispatchEvent(new Event('test-subscription-changed'));}
    catch(e){setError(e.message);}
    finally{setBusy('');}
  }
  return <section className="test-checkout-result plan-billing" aria-labelledby="plan-billing-title"><span className="test-checkout-badge">TEST MODE · PLAN & BILLING</span>
    <h2 id="plan-billing-title">Current plan: {subscription.name}</h2>
    <p>{moneyMinor(subscription.priceMinor,subscription)} {subscription.currency} / month · {subscription.cancelAtPeriodEnd?(until?'Cancels on '+until:'Cancels at the end of this billing period')+'. You keep your credits until then.':subscription.status==='past_due'?'Payment failed. Update your card to keep this plan.':until?'Renews on '+until+'.':'Active.'}</p>
    <div className="plan-billing-actions">
      <button type="button" disabled={!!busy} onClick={manage}>{busy==='portal'?'Opening…':'Manage billing (card & receipts)'}</button>
      {!subscription.cancelAtPeriodEnd&&<button type="button" disabled={!!busy} onClick={cancel}>{busy==='cancel'?'Cancelling…':'Cancel subscription'}</button>}
    </div>
    {error&&<p className="pricing-form-error" role="alert">{error}</p>}
  </section>;
}
export function TestCheckoutResult(){
  const query=new URLSearchParams(window.location.search),order=query.get('order'),result=query.get('testCheckout');
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!order||!['success','cancelled'].includes(result)||!token())return;
    let stopped=false,timer,attempts=0;
    async function load(){try{const next=await api('/orders/'+encodeURIComponent(order));if(stopped)return;setData(next);setError('');
      if(result==='success'&&next.state!=='billing_country_mismatch'&&!next.receipts.some(r=>r.granted)){if(++attempts<40)timer=setTimeout(load,3000);else setError('Payment confirmation is taking longer than expected. Refresh this page to check again. Do not pay again.');}
    }catch(e){if(!stopped)setError(e.message);}}
    load();return()=>{stopped=true;clearTimeout(timer);};
  },[order,result]);
  useEffect(()=>{if(data?.subscriptionStatus)window.dispatchEvent(new Event('test-subscription-changed'));},[data?.subscriptionStatus,data?.cancelAtPeriodEnd]);
  if(!order||!['success','cancelled'].includes(result))return null;
  const granted=data?.receipts?.filter(r=>r.granted)||[];
  async function cancel(){if(!window.confirm(data?.subscriptionStatus==='active'||data?.subscriptionStatus==='trialing'?'Cancel this test subscription? It stays active until the end of the current billing period.':'Cancel this test subscription?'))return;setBusy(true);setError('');try{await api('/orders/'+encodeURIComponent(order)+'/cancel-subscription',{method:'POST',body:'{}'});setData(await api('/orders/'+encodeURIComponent(order)));}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <section className="test-checkout-result" aria-label="Test checkout result" role="status"><span className="test-checkout-badge">TEST MODE · NO REAL CHARGE</span>
    <h2>{data?.state==='billing_country_mismatch'?'Check your billing country':granted.length?'Test payment verified':result==='cancelled'?'Test checkout cancelled':'Checking your test payment'}</h2>
    {data?.state==='billing_country_mismatch'?<p>{data.message}</p>:!token()?<p>Sign in to view your test checkout result.</p>:granted.length?<p>{credits(granted.reduce((n,r)=>n+r.credits,0))} test credits recorded for this purchase. {granted.some(r=>r.refundedMinor||r.disputed)?'A refund or dispute was recorded; the affected credits may have been reversed.':''}</p>:<p>{result==='cancelled'?'You can choose a plan and try again.':'Waiting for Stripe’s verified payment event. Returning to this page alone does not add credits.'}</p>}
    {data?.subscriptionStatus&&<p>Test subscription: {data.subscriptionStatus}{data.cancelAtPeriodEnd?' · cancels at the end of the billing period':''}</p>}
    {data?.subscriptionStatus&&data.subscriptionStatus!=='canceled'&&!data.cancelAtPeriodEnd&&<button type="button" disabled={busy} onClick={cancel}>{busy?'Cancelling…':'Cancel test subscription'}</button>}
    {error&&<p className="pricing-form-error" role="alert">{error}</p>}
  </section>;
}
