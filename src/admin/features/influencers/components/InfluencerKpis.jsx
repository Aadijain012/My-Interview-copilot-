import { useState } from "react";
import { formatNumber } from "@/utils";
import { formatCurrency, convertCurrency } from "@/utils/currency";
import "./InfluencerKpis.css";

const CURRENCY_LIST = [
  { code: "INR", label: "INR (₹) - Indian Rupee" },
  { code: "USD", label: "USD ($) - US Dollar" },
  { code: "EUR", label: "EUR (€) - Euro" },
  { code: "GBP", label: "GBP (£) - British Pound" },
  { code: "AED", label: "AED (د.إ) - UAE Dirham" },
  { code: "CAD", label: "CAD ($) - Canadian Dollar" },
  { code: "AUD", label: "AUD ($) - Australian Dollar" },
  { code: "SGD", label: "SGD ($) - Singapore Dollar" },
];

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconTrendingUp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconDollarSign() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function InfluencerKpis({ data, isLoading, currency = "INR" }) {
  const [activeCurrency, setActiveCurrency] = useState(currency || "INR");

  const metrics = data || {};
  const totalInfluencers = metrics.totalInfluencers ?? 0;
  const activeInfluencers = metrics.activeInfluencers ?? totalInfluencers;
  const totalReferrals = metrics.totalUsersJoined ?? metrics.totalReferrals ?? 0;
  const totalConversions = metrics.totalConversions ?? 0;
  const conversionRate = totalReferrals > 0
    ? ((totalConversions / totalReferrals) * 100).toFixed(1)
    : "0.0";
  const totalPaid = metrics.paidEarnings ?? metrics.totalCommissionPaid ?? 0;
  const totalPending = metrics.pendingEarnings ?? metrics.totalCommissionPending ?? 0;
  const tierRules = metrics.rules || metrics.tierRules || [];

  const baseCurrency = metrics.currency || currency || "USD";
  const displayPaid = convertCurrency(totalPaid, baseCurrency, activeCurrency);
  const displayPending = convertCurrency(totalPending, baseCurrency, activeCurrency);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-3)", flexWrap: "wrap", gap: "var(--sp-2)" }}>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
          Global affiliate metrics calculated live across all campaigns.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-secondary)" }}>
            View Commissions In:
          </span>
          <select
            value={activeCurrency}
            onChange={(e) => setActiveCurrency(e.target.value)}
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-surface)",
              color: "var(--color-text-primary)",
              cursor: "pointer",
            }}
            title="Convert commission metrics to another currency"
          >
            {CURRENCY_LIST.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="influencer-kpis-grid" aria-label="Key Performance Indicators">
        <div className="influencer-kpi-card">
          <div className="influencer-kpi-card__header">
            <span className="influencer-kpi-card__title">Influencer Network</span>
            <div className="influencer-kpi-card__icon"><IconUsers /></div>
          </div>
          <div className="influencer-kpi-card__value">
            {isLoading ? "—" : formatNumber(totalInfluencers)}
          </div>
          <div className="influencer-kpi-card__subtext">
            {isLoading ? "..." : `${activeInfluencers} total affiliates`}
          </div>
        </div>

        <div className="influencer-kpi-card">
          <div className="influencer-kpi-card__header">
            <span className="influencer-kpi-card__title">Attributed Referrals</span>
            <div className="influencer-kpi-card__icon"><IconTrendingUp /></div>
          </div>
          <div className="influencer-kpi-card__value">
            {isLoading ? "—" : formatNumber(totalReferrals)}
          </div>
          <div className="influencer-kpi-card__subtext">
            {isLoading ? "..." : "Signups via referral codes"}
          </div>
        </div>

        <div className="influencer-kpi-card">
          <div className="influencer-kpi-card__header">
            <span className="influencer-kpi-card__title">Paid Conversions</span>
            <div className="influencer-kpi-card__icon"><IconCheckCircle /></div>
          </div>
          <div className="influencer-kpi-card__value">
            {isLoading ? "—" : formatNumber(totalConversions)}
          </div>
          <div className="influencer-kpi-card__subtext">
            {isLoading ? "..." : `${conversionRate}% conversion rate`}
          </div>
        </div>

        <div className="influencer-kpi-card">
          <div className="influencer-kpi-card__header">
            <span className="influencer-kpi-card__title">Paid Commissions</span>
            <div className="influencer-kpi-card__icon" style={{ color: "var(--color-success)" }}><IconDollarSign /></div>
          </div>
          <div className="influencer-kpi-card__value" style={{ color: "var(--color-success)" }}>
            {isLoading ? "—" : formatCurrency(displayPaid, activeCurrency)}
          </div>
          <div className="influencer-kpi-card__subtext">
            {activeCurrency !== baseCurrency
              ? `FX converted (Base: ${formatCurrency(totalPaid, baseCurrency)})`
              : "Disbursed earnings"}
          </div>
        </div>

        <div className="influencer-kpi-card">
          <div className="influencer-kpi-card__header">
            <span className="influencer-kpi-card__title">Pending Commissions</span>
            <div className="influencer-kpi-card__icon" style={{ color: "var(--color-warning)" }}><IconClock /></div>
          </div>
          <div className="influencer-kpi-card__value" style={{ color: "var(--color-warning)" }}>
            {isLoading ? "—" : formatCurrency(displayPending, activeCurrency)}
          </div>
          <div className="influencer-kpi-card__subtext">
            {activeCurrency !== baseCurrency
              ? `FX converted (Base: ${formatCurrency(totalPending, baseCurrency)})`
              : "Awaiting payout approval"}
          </div>
        </div>
      </div>

      {tierRules.length > 0 && (
        <div className="influencer-tier-banner" aria-label="Commission Tiers">
          <div className="influencer-tier-banner__header">
            <span className="influencer-tier-banner__title">
              Active Tiered Commission Matrix
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
              Commissions scale dynamically based on conversion thresholds (historical rates preserved)
            </span>
          </div>
          <div className="influencer-tier-banner__pills">
            {tierRules.map((rule) => {
              const minConv = rule.minConversions ?? rule.minReferrals ?? 0;
              const maxConv = rule.maxConversions ?? rule.maxReferrals;
              const rate = rule.commissionPercent ?? rule.commissionRate ?? 10;
              const range = maxConv !== null && maxConv !== undefined
                ? `${minConv}–${maxConv}`
                : `${minConv}+`;

              return (
                <div key={rule.id} className="influencer-tier-pill">
                  <span className="influencer-tier-pill__name">{rule.name || `Tier (${range})`}</span>
                  <span className="influencer-tier-pill__range">
                    ({range} conversions)
                  </span>
                  <span className="influencer-tier-pill__rate">{rate}% cut</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
