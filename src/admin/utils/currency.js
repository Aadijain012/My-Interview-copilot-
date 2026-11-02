/**
 * Shared Currency Formatting Utility
 *
 * Formats monetary amounts dynamically without hardcoding currency symbols.
 * Uses Intl.NumberFormat based on standard ISO 4217 currency codes (e.g., INR, USD, EUR).
 */

export const EXCHANGE_RATES_TO_USD = {
  USD: 1,
  INR: 0.0116,    // 1 USD ~ 86.2 INR
  EUR: 1.085,     // 1 EUR ~ 1.085 USD
  GBP: 1.285,     // 1 GBP ~ 1.285 USD
  CAD: 0.725,     // 1 CAD ~ 0.725 USD
  AUD: 0.655,     // 1 AUD ~ 0.655 USD
  AED: 0.272,     // 1 AED ~ 0.272 USD
  SGD: 0.745,     // 1 SGD ~ 0.745 USD
};

export function convertCurrency(amount, fromCurrency = "INR", toCurrency = "USD") {
  if (amount == null || isNaN(amount)) return 0;
  const from = (fromCurrency || "INR").toUpperCase().trim();
  const to = (toCurrency || "USD").toUpperCase().trim();
  if (from === to) return Number(amount);

  const fromRate = EXCHANGE_RATES_TO_USD[from] || 1;
  const toRate = EXCHANGE_RATES_TO_USD[to] || 1;
  const inUSD = Number(amount) * fromRate;
  const converted = inUSD / toRate;
  return Math.round(converted * 100) / 100;
}

export function formatCurrency(amount, currencyCode = "INR") {
  if (amount == null || isNaN(amount)) {
    amount = 0;
  }

  const normalizedCurrency = (currencyCode || "INR").trim().toUpperCase();

  try {
    // Select appropriate locale hint depending on currency
    const locale = normalizedCurrency === "INR" ? "en-IN" : "en-US";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (err) {
    // Fallback if browser/node environment doesn't recognize the currency code
    return `${normalizedCurrency} ${amount.toLocaleString()}`;
  }
}
