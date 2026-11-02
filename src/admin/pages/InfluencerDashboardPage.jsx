import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, PageLoader } from "@/components";
import { formatNumber } from "@/utils";
import { formatCurrency, convertCurrency } from "@/utils/currency";
import { useMyInfluencerDashboard } from "@/features/influencers";
import "./InfluencerDashboardPage.css";

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const CHANNEL_BADGES = {
  youtube: { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444", label: "YouTube" },
  instagram: { bg: "rgba(236, 72, 153, 0.12)", color: "#ec4899", label: "Instagram" },
  twitter: { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", label: "Twitter / X" },
  linkedin: { bg: "rgba(14, 165, 233, 0.12)", color: "#0ea5e9", label: "LinkedIn" },
  tiktok: { bg: "rgba(168, 85, 247, 0.12)", color: "#a855f7", label: "TikTok" },
  podcast: { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", label: "Podcast" },
  newsletter: { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981", label: "Newsletter" },
  direct: { bg: "rgba(100, 116, 139, 0.12)", color: "#94a3b8", label: "Direct / Web" },
  other: { bg: "rgba(100, 116, 139, 0.12)", color: "#94a3b8", label: "Other" },
};

const CURRENCY_OPTIONS = [
  { code: "USD", label: "USD ($) - US Dollar" },
  { code: "INR", label: "INR (₹) - Indian Rupee" },
  { code: "EUR", label: "EUR (€) - Euro" },
  { code: "GBP", label: "GBP (£) - British Pound" },
  { code: "CAD", label: "CAD ($) - Canadian Dollar" },
  { code: "AUD", label: "AUD ($) - Australian Dollar" },
  { code: "AED", label: "AED (د.إ) - UAE Dirham" },
  { code: "SGD", label: "SGD ($) - Singapore Dollar" },
];

export function InfluencerDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useMyInfluencerDashboard();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPlatform, setCopiedPlatform] = useState(null);
  const [customCurrency, setCustomCurrency] = useState(null);

  if (isLoading) {
    return <PageLoader text="Loading your creator dashboard..." />;
  }

  if (error) {
    return (
      <div className="influencer-dashboard-page">
        <div
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid var(--color-danger, #ef4444)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "var(--sp-6, 24px)",
            textAlign: "center",
          }}
        >
          <h2 style={{ color: "var(--color-danger, #ef4444)", margin: "0 0 8px" }}>
            Account Restricted
          </h2>
          <p style={{ color: "var(--color-text-secondary, #64748b)", margin: 0 }}>
            {error?.message || "Your influencer account could not be accessed. Please contact support or your program administrator."}
          </p>
        </div>
      </div>
    );
  }

  const influencer = data?.influencer || {};
  const campaign = data?.campaign;
  const earnings = data?.earnings || {};
  const tier = data?.commissionTier || {};
  const progress = tier?.progress || {};
  const referrals = data?.referrals || [];
  const conversions = data?.conversions || [];
  const payouts = data?.payouts || [];
  const subscriptionPlans = data?.subscriptionPlans || [];

  const influencerPlatforms = Array.isArray(influencer.platforms) && influencer.platforms.length > 0
    ? influencer.platforms
    : (influencer.platform || "general").split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  const platformBreakdown = data?.platformBreakdown || [];

  const baseCurrency = earnings.currency || influencer.payoutCurrency || "USD";
  const activeCurrency = customCurrency || baseCurrency;
  const promoCode = influencer.referralCode || "";
  const promoLink = influencer.referralLink || `${typeof window !== "undefined" ? window.location.origin : ""}/signup?ref=${promoCode}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(promoCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(promoLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPlatformLink = (platKey, link) => {
    navigator.clipboard.writeText(link);
    setCopiedPlatform(platKey);
    setTimeout(() => setCopiedPlatform(null), 2000);
  };

  return (
    <div className="influencer-dashboard-page">
      {/* Creator Portal Header */}
      <div className="influencer-dashboard-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 className="influencer-welcome-title">Welcome, {influencer.name}!</h1>
            <Badge variant={influencer.status === "active" ? "success" : "danger"}>
              {(influencer.status || "ACTIVE").toUpperCase()}
            </Badge>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
              Affiliate Partner Portal • Active Channels:
            </span>
            {influencerPlatforms.map((plat) => {
              const style = CHANNEL_BADGES[plat] || CHANNEL_BADGES.other;
              return (
                <span
                  key={plat}
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: style.bg,
                    color: style.color,
                  }}
                >
                  {style.label || plat}
                </span>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4, 16px)", flexWrap: "wrap" }}>
          <div>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", display: "block", marginBottom: "4px" }}>
              Display Currency
            </span>
            <select
              value={activeCurrency}
              onChange={(e) => setCustomCurrency(e.target.value)}
              aria-label="Select display currency"
              style={{
                background: "var(--color-bg-surface, #ffffff)",
                color: "var(--color-text-primary, #0f172a)",
                border: "1px solid var(--color-border, #cbd5e1)",
                borderRadius: "var(--radius-md, 6px)",
                padding: "6px 12px",
                fontSize: "var(--text-xs, 12px)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", display: "block", marginBottom: "4px" }}>
              Payout Currency
            </span>
            <Badge variant="warning" style={{ fontSize: "var(--text-xs)", padding: "5px 10px" }}>
              {baseCurrency}
            </Badge>
          </div>
        </div>
      </div>

      {/* Quick Share Banner */}
      <div className="influencer-share-banner">
        <div className="influencer-share-card">
          <span className="influencer-share-card__label">My Referral Promo Code</span>
          <div className="influencer-share-card__content">
            <span className="influencer-share-code">{promoCode}</span>
            <Button
              variant={copiedCode ? "secondary" : "primary"}
              size="sm"
              onClick={handleCopyCode}
            >
              {copiedCode ? <><IconCheck /> Copied!</> : <><IconCopy /> Copy Code</>}
            </Button>
          </div>
        </div>

        <div className="influencer-share-card">
          <span className="influencer-share-card__label">My Shareable Referral Link</span>
          <div className="influencer-share-card__content">
            <span className="influencer-share-link" title={promoLink}>{promoLink}</span>
            <Button
              variant={copiedLink ? "secondary" : "primary"}
              size="sm"
              onClick={handleCopyLink}
            >
              {copiedLink ? <><IconCheck /> Copied!</> : <><IconCopy /> Copy Link</>}
            </Button>
          </div>
        </div>
      </div>

      {/* Multi-Platform Dedicated Tracking Links & Performance */}
      {platformBreakdown.length > 0 && (
        <div
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "var(--sp-5, 20px)",
            marginBottom: "var(--sp-5, 20px)",
          }}
        >
          <div style={{ marginBottom: "var(--sp-4, 16px)" }}>
            <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 600 }}>
              My Platform Channels & Dedicated Tracking Links
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
              Share separate tagged links for each of your platforms (YouTube, Instagram, X, LinkedIn, etc.) to track your clicks, conversions, and commissions separately.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3, 12px)" }}>
            {platformBreakdown.map((item) => {
              const platKey = (item.platform || "direct").toLowerCase();
              const style = CHANNEL_BADGES[platKey] || CHANNEL_BADGES.other;
              const isCopied = copiedPlatform === platKey;
              const channelLink = item.referralLink || `${promoLink}&source=${platKey}`;

              return (
                <div
                  key={platKey}
                  style={{
                    background: "var(--color-bg-subtle, rgba(255,255,255,0.03))",
                    border: "1px solid var(--color-border-subtle)",
                    borderRadius: "var(--radius-md, 8px)",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "3px 10px",
                          borderRadius: "4px",
                          background: style.bg,
                          color: style.color,
                        }}
                      >
                        {style.label || item.label || platKey}
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                        Attribution Tag: <code>source={platKey}</code>
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", display: "block" }}>Signups</span>
                        <strong style={{ fontSize: "var(--text-sm)" }}>{formatNumber(item.referralsCount)}</strong>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", display: "block" }}>Conversions</span>
                        <strong style={{ fontSize: "var(--text-sm)", color: "var(--color-brand)" }}>{formatNumber(item.conversionsCount)}</strong>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", display: "block" }}>Conv. Rate</span>
                        <Badge variant="default" style={{ fontSize: "11px" }}>{item.conversionRate}%</Badge>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", display: "block" }}>Commission</span>
                        <strong style={{ fontSize: "var(--text-sm)", color: "var(--color-success)" }}>
                          {formatCurrency(convertCurrency(item.commissionEarned, baseCurrency, activeCurrency), activeCurrency)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Channel link bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        flex: 1,
                        background: "var(--color-bg-surface)",
                        border: "1px solid var(--color-border-subtle)",
                        borderRadius: "var(--radius-sm, 6px)",
                        padding: "6px 12px",
                        fontSize: "var(--text-xs)",
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={channelLink}
                    >
                      {channelLink}
                    </span>
                    <Button
                      variant={isCopied ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => handleCopyPlatformLink(platKey, channelLink)}
                    >
                      {isCopied ? <><IconCheck /> Copied!</> : <><IconCopy /> Copy Channel Link</>}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="influencer-kpis-grid">
        <div className="influencer-kpi-card">
          <div className="influencer-kpi-card__header">
            <span className="influencer-kpi-card__title">Total Referrals</span>
          </div>
          <div className="influencer-kpi-card__value">
            {formatNumber(referrals.length)}
          </div>
          <div className="influencer-kpi-card__subtext">
            Registered users via promo code
          </div>
        </div>

        <div className="influencer-kpi-card">
          <div className="influencer-kpi-card__header">
            <span className="influencer-kpi-card__title">Paid Conversions</span>
          </div>
          <div className="influencer-kpi-card__value">
            {formatNumber(conversions.length)}
          </div>
          <div className="influencer-kpi-card__subtext">
            Upgraded paying subscriptions
          </div>
        </div>

        <div className="influencer-kpi-card">
          <div className="influencer-kpi-card__header">
            <span className="influencer-kpi-card__title">Total Earnings</span>
          </div>
          <div className="influencer-kpi-card__value" style={{ color: "var(--color-brand)" }}>
            {formatCurrency(convertCurrency(earnings.totalEarnings || 0, baseCurrency, activeCurrency), activeCurrency)}
          </div>
          <div className="influencer-kpi-card__subtext">
            Cumulative commission revenue
          </div>
        </div>

        <div className="influencer-kpi-card">
          <div className="influencer-kpi-card__header">
            <span className="influencer-kpi-card__title">Pending Earnings</span>
          </div>
          <div className="influencer-kpi-card__value" style={{ color: "var(--color-warning)" }}>
            {formatCurrency(convertCurrency(earnings.pendingEarnings || 0, baseCurrency, activeCurrency), activeCurrency)}
          </div>
          <div className="influencer-kpi-card__subtext">
            Available for next disbursement
          </div>
        </div>

        <div className="influencer-kpi-card">
          <div className="influencer-kpi-card__header">
            <span className="influencer-kpi-card__title">Paid Out</span>
          </div>
          <div className="influencer-kpi-card__value" style={{ color: "var(--color-success)" }}>
            {formatCurrency(convertCurrency(earnings.paidEarnings || 0, baseCurrency, activeCurrency), activeCurrency)}
          </div>
          <div className="influencer-kpi-card__subtext">
            Successfully disbursed to you
          </div>
        </div>
      </div>

      {/* Active Campaign Card (if assigned) */}
      {campaign && (
        <div
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--sp-4, 16px) var(--sp-5, 20px)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--sp-3, 12px)",
          }}
        >
          <div>
            <span style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", color: "var(--color-text-secondary)", fontWeight: 600 }}>
              Active Campaign
            </span>
            <h3 style={{ margin: "4px 0 0", fontSize: "var(--text-lg)", fontWeight: 600 }}>
              {campaign.name}
            </h3>
          </div>
          <div style={{ display: "flex", gap: "var(--sp-2, 8px)", alignItems: "center" }}>
            <Badge variant="default">Currency: {campaign.currency || baseCurrency}</Badge>
            <Badge variant="success">Campaign Active</Badge>
          </div>
        </div>
      )}

      {/* Commission Tier & Progression Card */}
      <div className="influencer-tier-progress-card">
        <div className="influencer-tier-progress-header">
          <div>
            <span style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", color: "var(--color-text-secondary)", fontWeight: 600 }}>
              Commission Tier & Performance
            </span>
            <h3 style={{ margin: "4px 0 0", fontSize: "var(--text-lg)", fontWeight: 600 }}>
              Current Commission Rate: <strong style={{ color: "var(--color-brand)" }}>{tier.currentRate || 10}%</strong>
            </h3>
          </div>
          <Badge variant="success" style={{ fontSize: "var(--text-sm)", padding: "4px 12px" }}>
            {tier.currentTierLabel || "Standard Tier"}
          </Badge>
        </div>

        {progress.hasNextTier ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
              <span>
                Progress: <strong style={{ color: "var(--color-text-primary, #e8eaf0)" }}>{formatNumber(progress.currentConversions ?? conversions.length ?? 0)}</strong> / {formatNumber(progress.nextTierTarget)} conversions ({progress.progressPercent || 0}%)
              </span>
              <span>
                <strong style={{ color: "var(--color-brand, #6c63ff)" }}>{formatNumber(progress.remainingToNext)}</strong> more conversions needed to reach next tier{progress.nextTierRate ? ` (${progress.nextTierRate}%)` : ""}
              </span>
            </div>
            <div className="influencer-tier-progress-bar-bg">
              <div
                className="influencer-tier-progress-bar-fill"
                style={{ width: `${progress.progressPercent || 0}%` }}
              />
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-success)", fontWeight: 500 }}>
            🎉 Congratulations! You have achieved the top commission tier!
          </p>
        )}
      </div>

      {/* Dynamic Subscription Plans & Commission Rate Section */}
      {subscriptionPlans.length > 0 && (
        <div className="influencer-plans-card">
          <div className="influencer-plans-header">
            <div>
              <h3 className="influencer-plans-title">
                Subscription Plans & Your Earnings
              </h3>
              <p className="influencer-plans-subtitle">
                Prices and payouts update live from admin settings. You earn <strong>{tier.currentRate || 10}%</strong> on every paid subscriber.
              </p>
            </div>
          </div>

          <div className="influencer-plans-grid">
            {subscriptionPlans.map((plan) => {
              const planBaseCurrency = plan.currency || "USD";
              const convertedPrice = convertCurrency(plan.priceMonthly, planBaseCurrency, activeCurrency);
              const convertedCommission = convertCurrency(plan.estimatedCommissionPerSale, planBaseCurrency, activeCurrency);

              return (
                <div key={plan.id} className="influencer-plan-item">
                  <div className="influencer-plan-item-header">
                    <span className="influencer-plan-name">{plan.name}</span>
                    <Badge variant={plan.id === "PRO_PLUS" ? "primary" : "info"}>
                      {plan.currentCommissionRate}% Cut
                    </Badge>
                  </div>
                  <div className="influencer-plan-price-row">
                    <span className="influencer-plan-price">
                      {formatCurrency(convertedPrice, activeCurrency)}
                    </span>
                    <span className="influencer-plan-billing">/ month</span>
                    {activeCurrency !== planBaseCurrency && (
                      <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginLeft: "6px" }}>
                        ({formatCurrency(plan.priceMonthly, planBaseCurrency)})
                      </span>
                    )}
                  </div>
                  <div className="influencer-plan-earning-box">
                    <span className="influencer-plan-earning-label">You earn per referral</span>
                    <span className="influencer-plan-earning-value">
                      +{formatCurrency(convertedCommission, activeCurrency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dedicated Workspace Quick Navigation */}
      <div className="influencer-workspace-sections">
        <div className="influencer-workspace-card">
          <div className="influencer-workspace-card-icon" style={{ background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="influencer-workspace-card-body">
            <h3 className="influencer-workspace-card-title">My Referrals</h3>
            <p className="influencer-workspace-card-desc">
              View all {referrals.length} referred signups, filter by social channel, and share targeted referral links.
            </p>
          </div>
          <div className="influencer-workspace-card-footer">
            <span className="influencer-workspace-card-stat">{formatNumber(referrals.length)} Signups</span>
            <Button variant="primary" size="sm" onClick={() => navigate("/influencer/referrals")}>
              Open Referrals →
            </Button>
          </div>
        </div>

        <div className="influencer-workspace-card">
          <div className="influencer-workspace-card-icon" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div className="influencer-workspace-card-body">
            <h3 className="influencer-workspace-card-title">My Conversions</h3>
            <p className="influencer-workspace-card-desc">
              Track {conversions.length} paid subscriptions, plan values, commission rates, and real-time commissions.
            </p>
          </div>
          <div className="influencer-workspace-card-footer">
            <span className="influencer-workspace-card-stat">{formatNumber(conversions.length)} Converted</span>
            <Button variant="primary" size="sm" onClick={() => navigate("/influencer/conversions")}>
              Open Conversions →
            </Button>
          </div>
        </div>

        <div className="influencer-workspace-card">
          <div className="influencer-workspace-card-icon" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div className="influencer-workspace-card-body">
            <h3 className="influencer-workspace-card-title">Payout History</h3>
            <p className="influencer-workspace-card-desc">
              Review completed disbursements, pending balances, payout dates, and disbursement receipts.
            </p>
          </div>
          <div className="influencer-workspace-card-footer">
            <span className="influencer-workspace-card-stat">{formatNumber(payouts.length)} Payouts</span>
            <Button variant="primary" size="sm" onClick={() => navigate("/influencer/payouts")}>
              Open Payouts →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

