import { countries } from './markets.js';

const valid = value => typeof value === 'string' && Object.hasOwn(countries, value);
export function localeCountry(language) {
  try {
    const region = new Intl.Locale(language).region;
    return valid(region) ? region : 'US';
  } catch { return 'US'; }
}

// Each source has its own timeout. A slow account lookup must not use up the
// connection lookup's time budget. A manual choice aborts the entire lookup.
export async function resolvePricingCountry({
  token, local, hostname, language, apiBase, signal, fetchImpl = fetch,
  accountTimeout = 2500, connectionTimeout = 1500
}) {
  const request = (url, options, timeout) => fetchImpl(url, {
    ...options, credentials: 'omit', cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)])
  });
  if (token) {
    try {
      const response = await request(apiBase + '/api/pricing/preference', {
        headers: { Authorization: 'Bearer ' + token, 'x-suppress-auth-redirect': 'true' }
      }, accountTimeout);
      const body = response.ok ? await response.json() : null;
      if (valid(body?.data?.country)) return { country: body.data.country, source: 'account' };
    } catch { /* Continue with the browser or connection preference. */ }
  }
  if (signal.aborted) return null;
  if (valid(local)) return { country: local, source: 'browser' };
  if (/(^|\.)myinterviewcopilot\.com$/.test(hostname)) {
    try {
      const response = await request('/cdn-cgi/trace', {}, connectionTimeout);
      const text = response.ok ? await response.text() : '';
      const country = text.match(/^loc=([A-Z]{2})$/m)?.[1];
      if (valid(country)) return { country, source: 'connection' };
    } catch { /* The country selector remains available. */ }
  }
  return signal.aborted ? null : { country: localeCountry(language), source: 'locale' };
}
export function countryNotice(source) {
  if (source === 'account') return 'Using the country saved to your account. You can change it anytime.';
  if (source === 'browser' || source === 'selected') return 'Using your selected country. You can change it anytime.';
  if (source === 'connection') return 'Country suggested from your connection. Check it before checkout.';
  return 'Country suggested from your browser. Check it before checkout.';
}
