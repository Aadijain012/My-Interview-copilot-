import {countries,digits} from './markets.js';
export function readPricing(body) {
  const original=body?.data;
  const local=original?.pricingKey != null;
  if (local && (!Object.hasOwn(countries,original.country) || !/^[a-f0-9]{32}$/.test(original.pricingKey) || original.minorDigits !== digits[original.currency])) throw Error('Invalid regional pricing');
  if (!local && original?.currency !== 'USD') throw Error('Invalid pricing currency');
  const data=original?{...original,country:original.country||'US',minorDigits:original.minorDigits??2,
    plans:original.plans?.map(p=>({...p,priceMinor:local?p.priceMinor:p.priceCents,
      comparisonPriceMinor:local?p.comparisonPriceMinor:p.comparisonPriceCents??null,regularPriceMinor:local?p.regularPriceMinor:p.regularPriceCents??null})),
    freePlan:original.freePlan?{...original.freePlan,priceMinor:0}:null}:null;
  if (!body?.ok || !data || !Object.hasOwn(digits,data.currency) || !Number.isSafeInteger(data.revision) || data.revision < 1 ||
      !Number.isFinite(Date.parse(data.asOf)) || !Array.isArray(data.plans) || data.plans.length > 20 ||
      (data.nextChangeAt !== null && !Number.isFinite(Date.parse(data.nextChangeAt)))) throw new Error('Invalid pricing response');
  const ids = new Set();
  for (const p of data.plans) {
    if (!p || typeof p.id !== 'string' || ids.has(p.id) || !['payg','subscription'].includes(p.kind) ||
        !Number.isSafeInteger(p.priceMinor) || p.priceMinor < 1 || p.priceMinor > 100000000000000 ||
        (p.comparisonPriceMinor != null && (!Number.isSafeInteger(p.comparisonPriceMinor) || p.comparisonPriceMinor <= p.priceMinor)) ||
        (p.regularPriceMinor != null && (!Number.isSafeInteger(p.regularPriceMinor) || p.regularPriceMinor < 1)) ||
        typeof p.name !== 'string' || !p.name.trim() || !Number.isSafeInteger(p.priceCents) || p.priceCents < 1 ||
        !Number.isSafeInteger(p.credits) || p.credits < 1 ||
        !['undecided','never','days','billing_period_end'].includes(p.expiry) ||
        (p.expiry === 'days' && (!Number.isSafeInteger(p.expiryDays) || p.expiryDays < 1)) ||
        (p.comparisonPriceCents != null && (!Number.isSafeInteger(p.comparisonPriceCents) || p.comparisonPriceCents <= p.priceCents)) ||
        (p.benefits != null && (!Array.isArray(p.benefits) || p.benefits.length > 8 || p.benefits.some(x=>typeof x !== 'string' || !x.trim() || x.length > 120))) ||
        (p.offer !== null && (!p.offer || typeof p.offer.name !== 'string' || !Number.isFinite(Date.parse(p.offer.endsAt))))) {
      throw new Error('Invalid plan');
    }
    ids.add(p.id);
  }
  const free = data.freePlan;
  // Optional for compatibility during a backend-first rollout.
  if (free != null && (free.id !== 'basic_free' || free.name !== 'Basic Free' || free.priceCents !== 0 ||
      free.cadence !== 'once' || free.grantingEnabled !== false ||
      !Number.isSafeInteger(free.credits) || free.credits < 1 ||
      !['undecided','never','days'].includes(free.expiry) ||
      (free.expiry === 'days' && (!Number.isSafeInteger(free.expiryDays) || free.expiryDays < 1)))) {
    throw new Error('Invalid free plan');
  }
  if (data.referral != null && (!Number.isSafeInteger(data.referral.welcomeCredits) || data.referral.welcomeCredits < 0 || !Number.isSafeInteger(data.referral.referrerCredits) || data.referral.referrerCredits < 0 || typeof data.referral.grantingEnabled !== 'boolean')) throw Error('Invalid referral offer');
  return data;
}
export function refreshDelay(data, elapsed = 0) {
  const boundary = data?.nextChangeAt ? Date.parse(data.nextChangeAt) - Date.parse(data.asOf) - elapsed + 100 : 30000;
  return Math.max(250, Math.min(30000, boundary));
}
export function expiryText(plan) {
  if (plan.expiry === 'billing_period_end') return 'Valid for one monthly billing period. Unused credits expire at its end; no rollover.';
  if (plan.expiry === 'never') return 'These credits do not expire.';
  if (plan.expiry === 'days' && plan.expiryDays === 30) return 'Valid for 30 days after credits are added. Unused credits expire.';
  if (plan.expiry === 'days') return 'Credits expire ' + plan.expiryDays + ' days after they are added.';
  return plan.id === 'basic_free' ? 'Credit expiry will be confirmed before welcome credits launch.' : 'Credit expiry will be confirmed before checkout opens.';
}
export function moneyMinor(amount,context={currency:'USD',minorDigits:2,country:'US'}){
 const {currency,minorDigits,country}=context;
 if(!Number.isSafeInteger(amount)||amount<0||digits[currency]!==minorDigits)throw Error('Invalid currency amount');
 const unit=10**minorDigits;
 const formatter=new Intl.NumberFormat('en-'+(country||'US'),{style:'currency',currency,minimumFractionDigits:amount%unit?minorDigits:0,maximumFractionDigits:minorDigits});
 const qualified={USD:'US$',CAD:'CA$',AUD:'A$',NZD:'NZ$',SGD:'S$',HKD:'HK$'};
 return formatter.formatToParts(amount/unit).map(part=>part.type==='currency'&&qualified[currency]?qualified[currency]:part.value).join('');
}
export const money = cents => new Intl.NumberFormat('en-US', {
  style:'currency', currency:'USD', minimumFractionDigits:cents % 100 ? 2 : 0, maximumFractionDigits:2
}).format(cents / 100);
export const credits = value => new Intl.NumberFormat('en-US').format(value);

export const discountPercent = (reference, current) => Math.floor((reference-current)*100/reference);
export function readCouponPreview(body) {
 const original=body?.data,local=original?.pricingKey != null;
 const d=original?{...original,country:original.country||'US',minorDigits:original.minorDigits??2,
  priceMinor:local?original.priceMinor:original.priceCents,discountMinor:local?original.discountMinor:original.discountCents,totalMinor:local?original.totalMinor:original.totalCents}:null;
 if(!body?.ok||!d||!Object.hasOwn(digits,d.currency)||d.minorDigits!==digits[d.currency]||!Object.hasOwn(countries,d.country)||
  (!local&&d.currency!=='USD')||(local&&!/^[a-f0-9]{32}$/.test(d.pricingKey))||
  !Number.isSafeInteger(d.revision)||d.revision<1||typeof d.planId!=='string'||typeof d.name!=='string'||typeof d.code!=='string'||
  ![d.priceMinor,d.discountMinor,d.totalMinor,d.credits].every(Number.isSafeInteger)||d.priceMinor<1||d.priceMinor>100000000000000||d.discountMinor<0||d.discountMinor>d.priceMinor||d.totalMinor!==d.priceMinor-d.discountMinor||d.credits<1||
  !Number.isFinite(Date.parse(d.asOf))||!Number.isFinite(Date.parse(d.expiresAt))||Date.parse(d.expiresAt)<=Date.parse(d.asOf)||Date.parse(d.expiresAt)-Date.parse(d.asOf)>300000||d.previewOnly!==true||d.checkoutEnabled!==false)throw Error('Invalid coupon preview');
 return d;
}

// The same availability check is used by the pricing page and in-tool purchases.
export function checkoutAvailable(data) {
  const checkout = data?.testCheckout;
  return data?.checkoutEnabled === true && data?.checkoutMode === 'test' &&
    checkout?.enabled === true && checkout.provider === 'stripe' &&
    (checkout.currencies == null || (Array.isArray(checkout.currencies) && checkout.currencies.includes(data.currency)));
}
export function currencyNotice(data) {
  if (!data?.localization?.fallbackReason) return '';
  if (data.localization.fallbackReason === 'PAYMENT_CURRENCY_UNAVAILABLE') {
    return data.localization.requestedCurrency + ' checkout is not supported yet. Prices and checkout use ' + data.currency + '; your selected country stays the same.';
  }
  return 'Local currency pricing is unavailable right now. Prices and checkout use '+data.currency+'.';
}

export function getFallbackCatalog(country = 'US') {
  const isIndia = country === 'IN';
  const currency = isIndia ? 'INR' : (countries[country] && digits[countries[country]] ? countries[country] : 'USD');
  const minorDigits = digits[currency] ?? 2;
  const isLocal = currency !== 'USD' || country !== 'US';
  const pricingKey = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'; // 32 hex chars

  // Sensible conversion multipliers
  const fxRates = { INR: 85.0, EUR: 0.92, GBP: 0.79, CAD: 1.36, AUD: 1.52, JPY: 152.0 };
  const rate = fxRates[currency] || 1.0;
  const convert = (cents) => Math.round(cents * rate);

  return readPricing({
    ok: true,
    data: {
      formatVersion: 3,
      currency,
      country: Object.hasOwn(countries, country) ? country : 'US',
      minorDigits,
      pricingKey: isLocal ? pricingKey : undefined,
      revision: 1,
      asOf: new Date().toISOString(),
      nextChangeAt: null,
      plans: [
        {
          id: 'payg_1',
          kind: 'payg',
          name: currency !== 'USD' ? '250-credit pack' : '$1 credit pack',
          priceCents: 100,
          priceMinor: isIndia ? 8500 : convert(100),
          credits: 250,
          expiry: 'days',
          expiryDays: 30,
          comparisonPriceCents: null,
          comparisonPriceMinor: null,
          regularPriceCents: null,
          regularPriceMinor: null,
          benefits: ['Use across all four tools', 'No monthly subscription'],
          offer: null
        },
        {
          id: 'payg_5',
          kind: 'payg',
          name: currency !== 'USD' ? '1,250-credit pack' : '$5 credit pack',
          priceCents: 500,
          priceMinor: isIndia ? 42500 : convert(500),
          credits: 1250,
          expiry: 'days',
          expiryDays: 30,
          comparisonPriceCents: null,
          comparisonPriceMinor: null,
          regularPriceCents: null,
          regularPriceMinor: null,
          benefits: ['Use across all four tools', 'No monthly subscription'],
          offer: null
        },
        {
          id: 'payg_10',
          kind: 'payg',
          name: currency !== 'USD' ? '2,500-credit pack' : '$10 credit pack',
          priceCents: 1000,
          priceMinor: isIndia ? 85000 : convert(1000),
          credits: 2500,
          expiry: 'days',
          expiryDays: 30,
          comparisonPriceCents: null,
          comparisonPriceMinor: null,
          regularPriceCents: null,
          regularPriceMinor: null,
          benefits: ['Use across all four tools', 'No monthly subscription'],
          offer: null
        },
        {
          id: 'payg_20',
          kind: 'payg',
          name: currency !== 'USD' ? '5,000-credit pack' : '$20 credit pack',
          priceCents: 2000,
          priceMinor: isIndia ? 170000 : convert(2000),
          credits: 5000,
          expiry: 'days',
          expiryDays: 30,
          comparisonPriceCents: null,
          comparisonPriceMinor: null,
          regularPriceCents: null,
          regularPriceMinor: null,
          benefits: ['Use across all four tools', 'No monthly subscription'],
          offer: null
        },
        {
          id: 'pro_monthly',
          kind: 'subscription',
          name: 'Pro',
          priceCents: 1900,
          priceMinor: isIndia ? 159900 : convert(1900),
          credits: 6000,
          expiry: 'billing_period_end',
          expiryDays: null,
          comparisonPriceCents: 5000,
          comparisonPriceMinor: isIndia ? 420000 : convert(5000),
          regularPriceCents: null,
          regularPriceMinor: null,
          benefits: ['PDF and Word session exports', 'Interview feedback and insights'],
          offer: null
        },
        {
          id: 'pro_plus_monthly',
          kind: 'subscription',
          name: 'Pro+',
          priceCents: 2900,
          priceMinor: isIndia ? 244900 : convert(2900),
          credits: 9250,
          expiry: 'billing_period_end',
          expiryDays: null,
          comparisonPriceCents: 7900,
          comparisonPriceMinor: isIndia ? 660000 : convert(7900),
          regularPriceCents: null,
          regularPriceMinor: null,
          benefits: [
            'Support center & setup guides',
            'PDF and Word session exports',
            'Interview feedback and insights',
            'Guides for credits, coupons and referrals'
          ],
          offer: null
        }
      ],
      freePlan: {
        id: 'basic_free',
        name: 'Basic Free',
        priceCents: 0,
        priceMinor: 0,
        credits: 250,
        cadence: 'once',
        grantingEnabled: false,
        expiry: 'never',
        expiryDays: null
      },
      rewards: {
        welcomeCredits: 250,
        referrerCredits: 250,
        expiry: 'days',
        expiryDays: 30
      },
      referral: {
        welcomeCredits: 250,
        referrerCredits: 250,
        grantingEnabled: true
      },
      localization: isLocal ? {
        requestedCurrency: currency,
        fallbackReason: null,
        estimated: true,
        rateDate: new Date().toISOString().slice(0, 10),
        provider: 'Frankfurter',
        providerUrl: 'https://frankfurter.dev/'
      } : undefined,
      checkoutEnabled: true,
      checkoutMode: 'test'
    }
  });
}
