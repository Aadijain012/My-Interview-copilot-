import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../utils/api';
import { authHref, viewHref, policyHref, readRoute } from '../routing/appRoutes';
import BrandLogo from '../components/common/BrandLogo';
import markUrl from '../assets/brand/myinterview-copilot-mark.png';
import { readPricing, readCouponPreview, refreshDelay, expiryText, moneyMinor, credits, discountPercent, getFallbackCatalog } from './pricingModel';
import './PricingPage.css';
import {TestCheckoutDialog,TestCheckoutResult,testCheckoutEnabled,PlanBilling,useCurrentSubscription} from './TestCheckout';
import {usePricingCountry} from './usePricingCountry';
import CountryPicker from './CountryPicker';
import {usePricingSession} from './usePricingSession';
import {MenuAccount} from '../components/menu/ToolMenu';

const rootLink = href => href.startsWith('?') ? '/' + href : href;
const products = [
  {name:'AI Copilot',text:'Real-time interview support',icon:'wave',tone:'blue'},
  {name:'Upload & Translate',text:'Audio, video and document insights',icon:'file',tone:'teal'},
  {name:'AI Notetaker',text:'Record, save and summarize meetings',icon:'note',tone:'amber'},
  {name:'Voice AI',text:'Ask aloud. Get spoken answers.',icon:'mic',tone:'purple'}
];
function Icon({type='check'}) {
  const paths={check:<path d="m5 12 4 4L19 6"/>,wave:<><path d="M3 8c5-7 13 7 18 0M3 16c5-7 13 7 18 0"/></>,
    file:<><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/></>,
    note:<><path d="M6 3h14v18H6zM3 7h5M3 12h5M3 17h5M11 8h5M11 12h5M11 16h3"/></>,
    mic:<><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></>,
    gift:<><rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8C4 8 5 1 8 3c2 1 4 5 4 5s2-4 4-5c3-2 4 5-4 5"/></>,
    coins:<><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 10c0 4 16 4 16 0M4 15c0 4 16 4 16 0"/></>};
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]||paths.check}</svg>;
}
function Perks({items}) { return <ul className="pricing-perks">{items.map((text,i)=><li key={i}><span><Icon/></span>{text}</li>)}</ul>; }
function Price({plan,data,monthly=false}) {
  const money=value=>moneyMinor(value,data);
  const planned=plan.comparisonPriceMinor>plan.priceMinor?plan.comparisonPriceMinor:null;
  const regular=plan.regularPriceMinor>plan.priceMinor?plan.regularPriceMinor:null;
  return <>{!monthly&&<div className="pricing-comparison"/>}
    <div className="pricing-price"><strong>{money(plan.priceMinor)}</strong><span>{data.currency} {monthly?'/ month':'· one-time pack'}</span></div>
    {(planned||regular)&&<div className="pricing-offer-highlight">{planned?<><span>Planned regular price:</span><strong>{money(planned)}{monthly?' / month':''}</strong></>:<><strong>{discountPercent(regular,plan.priceMinor)}% off</strong><span>Regular price: <del>{money(regular)}</del>{monthly?' / month':''}</span></>}</div>}
    <p className="pricing-currency-status">{data.localization?.fallbackReason?'Payment currency: '+data.currency:data.localization?.estimated?'Converted estimate · '+data.currency:'Payment currency: '+data.currency}</p></>;
}
function Allowance({amount,children,free=false}) { return <div className="pricing-allowance"><Icon type={free?'gift':'coins'}/><strong>{credits(amount)}</strong><span>{children}</span></div>; }
function Offer({plan}) { return plan.offer ? <p className="pricing-offer">{plan.offer.name}<span>Ends {new Date(plan.offer.endsAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</span></p> : null; }
function CouponPreview({data,onRefresh,onCheckout}) {
  const money=value=>moneyMinor(value,data)+' '+data.currency;
  const [planId,setPlanId]=useState(''),[code,setCode]=useState(''),[quote,setQuote]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const current=data.plans.find(p=>p.id===planId)||data.plans[0],sequence=useRef(0),request=useRef(null);
  const key=[data.pricingKey,data.country,data.currency,data.revision,current?.id,current?.priceMinor,current?.credits,current?.offer?.endsAt,code].join(':');
  useEffect(()=>{sequence.current++;request.current?.abort();setQuote(null);setError('');setBusy(false);return()=>{sequence.current++;request.current?.abort();};},[key]);
  useEffect(()=>{if(!quote)return;const timer=setTimeout(()=>{setQuote(null);setError('This preview expired. Check the coupon again for the latest price.');},Math.max(0,quote.ttlMs));return()=>clearTimeout(timer);},[quote]);
  async function apply(event) {
    event.preventDefault();if(!current)return;
    const run=++sequence.current,started=performance.now();request.current?.abort();const controller=new AbortController();request.current=controller;
    const timeout=setTimeout(()=>controller.abort(),10000);
    setBusy(true);setQuote(null);setError('');
    try {
      const res=await fetch(API_BASE+'/api/pricing/coupon-preview',{method:'POST',credentials:'omit',cache:'no-store',signal:controller.signal,
        headers:{'Content-Type':'application/json'},body:JSON.stringify({planId:current.id,code:code.trim(),...(data.pricingKey?{country:data.country,pricingKey:data.pricingKey}:{})})});
      const body=await res.json();if(res.status===409)onRefresh();if(!res.ok)throw Error(body?.error?.message||'Could not check this coupon.');
      const next=readCouponPreview(body);
      if(next.revision!==data.revision||next.planId!==current.id||next.currency!==data.currency||next.country!==data.country||next.pricingKey!==data.pricingKey)throw Error('Plans changed. Wait for the latest prices, then check again.');
      if(run===sequence.current)setQuote({...next,ttlMs:Math.max(0,Date.parse(next.expiresAt)-Date.parse(next.asOf)-(performance.now()-started))});
    } catch(e) {if(run===sequence.current)setError(e.name==='AbortError'?'Coupon check timed out. Please try again.':e.message);}
    finally {clearTimeout(timeout);if(run===sequence.current)setBusy(false);}
  }
  return <section className="pricing-coupon" aria-labelledby="coupon-title">
    <div><p className="pricing-eyebrow">A LITTLE EXTRA VALUE</p><h2 id="coupon-title">Have a discount code?</h2><p>Choose a plan and preview your coupon. Coupons reduce the price; the credit allowance stays the same.</p></div>
    <div><form onSubmit={apply} className="pricing-coupon-form">
      <label>Plan<select aria-label="Coupon plan" value={current?.id||''} onChange={e=>setPlanId(e.target.value)} disabled={!current}>{data.plans.map(p=><option key={p.id} value={p.id}>{p.name} · {money(p.priceMinor)}{p.kind==='subscription'?'/month':''}</option>)}</select></label>
      <label>Coupon code<input autoComplete="off" autoCapitalize="characters" required maxLength="32" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Enter a coupon code" /></label>
      <button type="submit" disabled={busy||!current||!code.trim()}>{busy?'Checking…':'Preview discount'}</button>
    </form>
    {error && <p className="pricing-form-error" role="alert">{error}</p>}
    {quote && <div className="pricing-quote" role="status"><strong>{quote.name}</strong><span>{money(quote.priceMinor)} − {money(quote.discountMinor)} discount = <b>{money(quote.totalMinor)}</b></span><small>{credits(quote.credits)} credits · Price preview only. No purchase or redemption has occurred.</small></div>}
    <p className="pricing-small">{testCheckoutEnabled(data)?'Test checkout is available. Coupons are validated again on the server before opening Stripe.':'Checkout is coming soon. A coupon preview does not reserve a discount; eligibility is checked again when checkout becomes available.'}</p>{quote&&testCheckoutEnabled(data)&&<button type="button" onClick={()=>onCheckout(current,code)}>Test this plan with coupon</button>}</div>
  </section>;
}
function ReferralOffer({referral}) {
  const [code,setCode]=useState(()=>new URLSearchParams(window.location.search).get('ref')||'');
  if(!referral || referral.referrerCredits < 1)return null;
  function go(event){event.preventDefault();const url=new URL(rootLink(authHref('signup')),window.location.origin);url.searchParams.set('ref',code.trim().toUpperCase());window.location.assign(url.pathname+url.search);}
  return <section className="pricing-referral" aria-labelledby="referral-title">
    <div className="pricing-gift"><Icon type="gift"/></div><div className="pricing-referral-copy"><h2 id="referral-title">Better preparation. Better together.</h2>
      <p>Invite a friend. <strong>You get {credits(referral.referrerCredits)} referral credits.</strong> Your friend gets <strong>{credits(referral.welcomeCredits)} welcome credits.</strong></p>
      <p className="pricing-small">Your friend receives the welcome allowance once per new account. Same-IP or suspicious referrals do not qualify for the referrer bonus. {referral.grantingEnabled ? 'Eligible rewards arrive after verified sign-in. Free rewards expire '+referral.expiryDays+' days after each award.' : 'Referrer awards are not active yet.'}</p>
    </div><form onSubmit={go}><label>Have a referral code?<input required maxLength="64" value={code} onChange={e=>setCode(e.target.value)} placeholder="Friend’s referral code" autoComplete="off"/></label><button type="submit">Join with referral <span aria-hidden="true">↗</span></button><small>The code is verified during signup. It is separate from a discount coupon.</small></form>
  </section>;
}
function SupportCenter({sandbox,rewards}) {
  return <section className="pricing-support" id="support" aria-labelledby="support-title">
    <div><p className="pricing-eyebrow">SUPPORT CENTER</p><h2 id="support-title">A clear path to getting started.</h2><p>Setup guides and answers for your tools, credits and plans.</p><a href={rootLink(viewHref('workspace'))}>Open your workspace <span aria-hidden="true">↗</span></a></div>
    <div className="pricing-guides">
      <details><summary>How do I start with the four AI tools?</summary><p>Sign in with Google or email OTP, complete the Terms step, and choose a tool in your workspace. AI Copilot supports live interview sessions. Upload & Translate works with your uploaded files. AI Notetaker records and summarizes meetings. Voice AI lets you speak with an AI assistant. Follow the permission and consent steps before recording or uploading.</p></details>
      <details><summary>How are credits shared?</summary><p>Each plan provides one allowance for use across all four products. Basic Free is a one-time welcome allowance. PAYG is a one-time purchase. Monthly allowances renew with the billing period and expire at its end, with no rollover. {sandbox?'Test purchases add sandbox credits after payment verification. Welcome credits are awarded after verified sign-in.':'Welcome credits are available after verified sign-in; paid checkout is unavailable.'}</p></details>
      <details><summary>What does the crossed-out price mean?</summary><p>A planned regular price is a reference for the launch offer, not a claim that this price was previously charged. The displayed saving is calculated from that reference and the current price. Event offers can have their own dates and allowances.</p></details>
      <details><summary>Can I use a coupon and a referral code?</summary><p>They serve different purposes. Coupons preview a discount for an eligible paid plan. Some cannot combine with launch or event offers. A friend’s referral code is entered at signup and checked when your account is created. The welcome allowance is awarded once, and suspicious referrals do not qualify for a referrer reward. {sandbox?'Stripe test checkout is available. Welcome credits are added after verified sign-in.':'Paid checkout is unavailable.'}</p></details>
      <details><summary>When do referral bonuses arrive?</summary><p>{rewards ? "Eligible referrer bonuses are added after a new friend verifies their first sign-in. Same-IP, self-referral and suspicious referrals do not earn a referrer bonus. The friend still receives the normal welcome allowance once. A missing network check may keep a bonus pending until the referrer signs in." : "Referral bonuses are currently paused. Welcome credits remain available."}</p></details>
      <details><summary>What help is included with Pro+?</summary><p>The support center includes product setup guides and answers about pricing, credits, coupons and referrals. Pro+ also includes the plan benefits listed above. Open a guide above to get started.</p></details>
    </div>
  </section>;
}
// In-page anchors (#support, #payg) scroll the page's own scroll container;
// relying on the URL hash fails when the page is embedded in App, whose
// history handling owns the address. When App passes onNavigate, links to
// app views switch views in this tab instead of reloading the whole app.
function handleLinkClick(event,onNavigate) {
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest?.('a[href]');
  if(!link||link.target)return;
  const raw=link.getAttribute('href');
  if(raw.startsWith('#')){
    const target=document.getElementById(raw.slice(1));
    if(target){event.preventDefault();target.scrollIntoView({behavior:'smooth',block:'start'});}
    return;
  }
  if(!onNavigate)return;
  let url;try{url=new URL(link.href);}catch{return;}
  if(url.origin!==window.location.origin)return;
  const route=readRoute(url);
  if(route.auth||route.policy||!route.view||/^\/(?:app\/)?pricing\/?$/.test(url.pathname))return;
  event.preventDefault();onNavigate(route.view);
}
// Checkout buttons only work when the API reports test checkout available;
// otherwise say so instead of offering a button that fails.
function CheckoutButton({available,outline=false,onClick}) {
  return available?<button className={'pricing-cta'+(outline?' pricing-cta-outline':'')} onClick={onClick}>Test checkout</button>:
    <button className={'pricing-cta'+(outline?' pricing-cta-outline':'')} disabled title="Checkout is not available yet">Checkout coming soon</button>;
}
export default function PricingPage({ onBack, onNavigate, darkMode, toggleDarkMode }) {
  const session=usePricingSession();
  const signedIn=session.status==='authenticated';
  const accountHref=path=>path==='/app/pricing'?path:rootLink(viewHref(({'/workspace':'workspace','/workspace/profile':'profile','/workspace/credits':'credits'})[path]));
  const {country,chooseCountry,message,status:countryStatus,retry:retryCountry}=usePricingCountry();
  const [checkoutSelection,setCheckoutSelection]=useState(null);
  const [snapshot,setData]=useState(()=>getFallbackCatalog(country||'IN')),[error,setError]=useState(false),[attempt,setAttempt]=useState(0),[selected,setSelected]=useState(null);
  const data = (snapshot?.country === country ? snapshot : null) || getFallbackCatalog(country || 'IN');
  useEffect(()=>{
    // Embedded in App (onNavigate), the page stays mounted while hidden; App owns the title there.
    if(!onNavigate)document.title='Plans & pricing · MyInterview Copilot';
    setError(false);if(!country)return;
    let stopped=false,timer,controller,busy=false;
    async function load(){
      if(stopped||busy)return;clearTimeout(timer);busy=true;controller=new AbortController();const start=performance.now();
      const timeout=setTimeout(()=>controller.abort(),10000);let next=30000;
      try{
        const response=await fetch(API_BASE+'/api/pricing/catalog?country='+encodeURIComponent(country),{signal:controller.signal,credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}});
        if(!response.ok)throw Error('Pricing unavailable');const catalog=readPricing(await response.json());if(stopped)return;
        setData(catalog);setError(false);next=refreshDelay(catalog,performance.now()-start);
      }catch(err){
        if(!stopped){
          setData(getFallbackCatalog(country));
          setError(false);
        }
      }
      finally{clearTimeout(timeout);busy=false;if(!stopped)timer=setTimeout(()=>{if(!document.hidden)load();},next);}
    }
    const visible=()=>{if(!document.hidden)load();};load();document.addEventListener('visibilitychange',visible);
    return()=>{stopped=true;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',visible);};
  },[attempt,country]);
  const monthly=data?.plans.filter(p=>p.kind==='subscription')||[],packs=data?.plans.filter(p=>p.kind==='payg')||[];
  const money=value=>moneyMinor(value,data);
  const pack=packs.find(p=>p.id===selected)||packs.find(p=>p.id==='payg_5')||packs[0];
  const sandbox=testCheckoutEnabled(data);
  const currentPlan=useCurrentSubscription(signedIn&&sandbox);
  const isCurrent=plan=>currentPlan?.planId===plan.id;
  const openCheckout=(plan,coupon='')=>setCheckoutSelection({plan,coupon,data});
  return <div className={`pricing-page ${darkMode ? 'dark-theme' : 'light-theme'}`} onClick={event=>handleLinkClick(event,onNavigate)}>
    <header className="pricing-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {onBack && (
          <button
            type="button"
            className="pricing-back-btn"
            onClick={onBack}
            title="Go back"
            aria-label="Go back"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
        )}
        <BrandLogo onClick={onBack || (() => onNavigate?.('workspace'))} size="md" />
      </div>
      <nav aria-label="Pricing navigation">
        <a href="#support">Support center</a>
        <a className="pricing-workspace-link" href={rootLink(viewHref('workspace'))}>Dashboard</a>
        {toggleDarkMode && (
          <button
            type="button"
            className="pricing-theme-toggle-btn"
            onClick={toggleDarkMode}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
        )}
        {signedIn?<MenuAccount user={session.user} onLogout={session.logout} busy={session.busy} linkHref={accountHref}/>:
          session.status==='anonymous'?<a className="pricing-sign-in" href={rootLink(authHref('login'))}>Sign in <span aria-hidden="true">↗</span></a>:
          session.status==='checking'?<span className="pricing-session-state" role="status">Checking session…</span>:
          <button className="pricing-sign-in" onClick={session.retry}>Retry session</button>}
      </nav>
    </header>
    {session.error&&<p className="pricing-session-error" role="alert">{session.error}</p>}
    {checkoutSelection&&<TestCheckoutDialog selection={checkoutSelection} data={checkoutSelection.data} onClose={()=>setCheckoutSelection(null)}/>}
    <main className="pricing-main">
      <div className="pricing-hero">
        <section className="pricing-intro" aria-labelledby="pricing-title">
          <p className="pricing-eyebrow">PLANS & PRICING</p>
          <h1 id="pricing-title">Prepare with confidence.</h1>
          <h2>Flexible credits. Four AI tools.</h2>
          <p>Get the support you need across AI Copilot, Upload & Translate, AI Notetaker and Voice AI — with a plan that fits your goals.</p>
        </section>
        <div className="pricing-country"><CountryPicker value={country} onChange={chooseCountry}/>{message&&countryStatus==='error'&&<p role="status">{message} <button type="button" onClick={retryCountry}>Try again</button></p>}</div>
      </div>

      {sandbox&&<TestCheckoutResult/>}
      {sandbox&&<PlanBilling subscription={currentPlan}/>}

      <section id="pricing-plans" aria-label="Choose your plan">
      {error?<div className="pricing-state" role="alert"><h2>We couldn’t load current prices.</h2><p>Please try again to see the latest plans.</p><button onClick={()=>{setError(false);setAttempt(n=>n+1);}}>Try again</button></div>:!data?<div className="pricing-state" role="status">Loading current plans…</div>:
        <div className="pricing-grid">
          {data.freePlan&&<article className="pricing-plan" aria-label="Basic Free"><div className="pricing-plan-top"><h2>Basic Free</h2><span>START HERE</span></div><div className="pricing-comparison"/><div className="pricing-price"><strong>{money(data.freePlan.priceMinor)}</strong><span>{data.currency}</span></div>
            <Allowance amount={data.freePlan.credits} free>welcome credits</Allowance>
            <Perks items={['Explore all four AI tools','One-time welcome allowance','No credit card required']}/>
            <p className="pricing-small pricing-card-note">One shared allowance per new account. {expiryText(data.freePlan)}</p><p className="pricing-card-status">Welcome credits after verified sign-in.</p>
            <a className="pricing-cta pricing-cta-outline" href={rootLink(session.status!=='anonymous'?viewHref('workspace'):authHref('signup'))}>{session.status!=='anonymous'?'Go to dashboard':'Create free account'} <span aria-hidden="true">↗</span></a></article>}
          {pack&&<article id="payg" className="pricing-plan pricing-plan-payg" aria-label="Pay as you go"><div className="pricing-plan-top"><h2>Pay as you go</h2><span>ON YOUR TERMS</span></div><Price plan={pack} data={data}/><Offer plan={pack}/><Allowance amount={pack.credits}>credits</Allowance>
            <fieldset className="pricing-packs"><legend>Choose your credit pack</legend>{packs.map(p=><label key={p.id} className={p.id===pack.id?'is-selected':''}><input type="radio" name="credit-pack" checked={p.id===pack.id} onChange={()=>setSelected(p.id)} aria-label={p.name+': '+money(p.priceMinor)+' for '+credits(p.credits)+' credits'}/><strong>{money(p.priceMinor)}</strong><span>· {credits(p.credits)} credits</span></label>)}</fieldset>
            <Perks items={['Use across all four tools','No monthly subscription',...(pack.benefits||[])]}/><p className="pricing-small pricing-card-note">{expiryText(pack)}</p><CheckoutButton available={sandbox} outline onClick={()=>openCheckout(pack)}/></article>}
          {monthly.map(plan=><article key={plan.id} className={'pricing-plan '+((plan.comparisonPriceMinor>plan.priceMinor||plan.regularPriceMinor>plan.priceMinor)?'pricing-plan-gold ':'')+(plan.id==='pro_plus_monthly'?'pricing-plan-plus':'pricing-plan-pro')} aria-label={plan.name}>
            {(plan.comparisonPriceMinor>plan.priceMinor||plan.regularPriceMinor>plan.priceMinor)&&<div className="pricing-offer-ribbon">{plan.comparisonPriceMinor>plan.priceMinor?'INTRODUCTORY PRICE':'SPECIAL OFFER'}</div>}
            <div className="pricing-plan-top"><h2>{plan.name}</h2><span>{plan.id==='pro_plus_monthly'?'MORE ROOM TO PREPARE':'FOR REGULAR USE'}</span></div><Price plan={plan} data={data} monthly/><Offer plan={plan}/><Allowance amount={plan.credits}>credits each month</Allowance>
            {plan.regularCredits&&plan.regularCredits!==plan.credits&&<p className="pricing-small">Regular allowance: {credits(plan.regularCredits)} credits</p>}
            <Perks items={['Use across all four tools',...(plan.benefits||[])]}/>
            {plan.id==='pro_plus_monthly'&&<a className="pricing-support-link" href="#support">Visit the support center ↗</a>}
            <p className="pricing-small pricing-card-note">{expiryText(plan)}</p>{isCurrent(plan)?<a className="pricing-cta pricing-current-plan" href="#plan-billing-title" aria-label={'Current plan: '+plan.name}>Current plan ✓</a>:<CheckoutButton available={sandbox} onClick={()=>openCheckout(plan)}/>}
          </article>)}
          {!data.freePlan&&!pack&&!monthly.length&&<div className="pricing-state"><h2>No plans available right now.</h2><p>Please check back soon.</p></div>}
        </div>}
      </section>
      <section className="pricing-products" aria-label="Included AI tools">{products.map(p=><div key={p.name}><span className={'pricing-product-icon '+p.tone}><Icon type={p.icon}/></span><div><h2>{p.name}</h2><p>{p.text}</p></div></div>)}</section>
      <p className="pricing-pricing-note">{data&&<>Prices shown in {data.currency} · price version {data.revision}{data.plans.some(p=>p.pricingSource==='country_override')?' · fixed regional prices':''}. {data.localization?.estimated&&<>Converted estimates using rates dated {data.localization.rateDate} (UTC) from <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">Frankfurter</a>. </>}{sandbox?'Confirm the test currency and total on Stripe. No real money is charged. ':'Final payment currency, taxes and payment fees will be confirmed when checkout opens. '}</>}Credit usage varies by product and task. Planned regular prices are shown for comparison.</p>
      {data&&<><CouponPreview onCheckout={openCheckout} data={data} onRefresh={()=>setAttempt(n=>n+1)}/><ReferralOffer referral={data.referral}/></>}
      <SupportCenter sandbox={sandbox} rewards={data?.referral?.grantingEnabled}/>
    </main>
    <footer className="pricing-footer"><span>MyInterview Copilot · BRIGHTAXIS CONSULTING LLC</span><div><a href={policyHref('terms')}>Terms</a><a href={policyHref('privacy')}>Privacy</a></div></footer>
  </div>;
}
