import { useState } from "react";
import { Badge, Table, Th, Td, Pagination, EmptyState, PageLoader, Select } from "@/components";
import { formatDate } from "@/utils";
import { formatCurrency } from "@/utils/currency";
import { useMyInfluencerDashboard } from "@/features/influencers";
import "./InfluencerDashboardPage.css";

const CONVERSION_STATUS_VARIANT = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "default",
};

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

export function InfluencerConversionsPage() {
  const { data, isLoading, error } = useMyInfluencerDashboard();
  const [platformFilter, setPlatformFilter] = useState("");
  const [page, setPage] = useState(1);

  if (isLoading) {
    return <PageLoader text="Loading your conversions..." />;
  }

  if (error) {
    return (
      <div className="influencer-dashboard-page">
        <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid var(--color-danger, #ef4444)", borderRadius: "var(--radius-lg, 12px)", padding: "24px", textAlign: "center" }}>
          <h2 style={{ color: "var(--color-danger, #ef4444)", margin: "0 0 8px" }}>Error Loading Conversions</h2>
          <p style={{ color: "var(--color-text-secondary, #64748b)", margin: 0 }}>{error?.message || "Could not retrieve conversion data."}</p>
        </div>
      </div>
    );
  }

  const influencer = data?.influencer || {};
  const earnings = data?.earnings || {};
  const tier = data?.commissionTier || {};
  const conversions = data?.conversions || [];
  const currency = earnings.currency || influencer.payoutCurrency || "USD";

  const PAGE_SIZE = 10;
  const influencerPlatforms = Array.isArray(influencer.platforms) && influencer.platforms.length > 0
    ? influencer.platforms
    : (influencer.platform || "general").split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);

  const filteredConversions = platformFilter
    ? conversions.filter((c) => (c.source || c.platform || "direct").toLowerCase() === platformFilter.toLowerCase())
    : conversions;

  const totalPages = Math.ceil(filteredConversions.length / PAGE_SIZE) || 1;
  const paginatedConversions = filteredConversions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalEarnedInFilter = filteredConversions.reduce((sum, c) => sum + (c.commissionAmount || 0), 0);

  return (
    <div className="influencer-dashboard-page">
      {/* Header */}
      <div className="influencer-dashboard-header">
        <div>
          <h1 className="influencer-dashboard-title">My Conversions</h1>
          <p className="influencer-dashboard-subtitle">
            All successful subscription upgrades and your earned commission cuts.
          </p>
        </div>
        <div>
          <Badge variant="success" style={{ fontSize: "var(--text-sm)", padding: "6px 14px" }}>
            Active Cut: {tier.currentRate || 10}%
          </Badge>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div className="influencer-kpi-grid">
        <div className="influencer-kpi-card">
          <span className="influencer-kpi-label">Approved Conversions</span>
          <span className="influencer-kpi-value">{conversions.length}</span>
          <span className="influencer-kpi-sub">Total paying users</span>
        </div>
        <div className="influencer-kpi-card">
          <span className="influencer-kpi-label">Total Commission Earned</span>
          <span className="influencer-kpi-value" style={{ color: "var(--color-brand)" }}>
            {formatCurrency(earnings.totalEarnings || totalEarnedInFilter, currency)}
          </span>
          <span className="influencer-kpi-sub">Lifetime affiliate earnings</span>
        </div>
        <div className="influencer-kpi-card">
          <span className="influencer-kpi-label">Current Commission Rate</span>
          <span className="influencer-kpi-value" style={{ color: "var(--color-success)" }}>
            {tier.currentRate || 10}%
          </span>
          <span className="influencer-kpi-sub">{tier.currentTierLabel || "Standard Tier"}</span>
        </div>
      </div>

      {/* Conversions Table Card */}
      <div className="influencers-table-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-3, 12px)", padding: "16px 20px 0", flexWrap: "wrap", gap: "10px" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
            Showing <strong>{filteredConversions.length}</strong> of {conversions.length} total conversions
          </span>
          <Select
            value={platformFilter}
            onChange={(e) => {
              setPlatformFilter(e.target.value);
              setPage(1);
            }}
            style={{ width: "200px", fontSize: "var(--text-xs)" }}
          >
            <option value="">All Channels / Platforms</option>
            {influencerPlatforms.map((p) => (
              <option key={p} value={p}>{CHANNEL_BADGES[p]?.label || p}</option>
            ))}
            <option value="direct">Direct / Web</option>
          </Select>
        </div>

        {filteredConversions.length === 0 ? (
          <EmptyState
            title="No Conversions Yet"
            description={platformFilter ? `No conversions from ${CHANNEL_BADGES[platformFilter]?.label || platformFilter} yet.` : "When referred users upgrade to a paid Pro or Pro Plus subscription, your commission will appear here."}
          />
        ) : (
          <Table aria-label="My conversions list">
            <thead>
              <tr>
                <Th>Type / Referral</Th>
                <Th>Channel</Th>
                <Th>Order Value</Th>
                <Th>Cut Rate</Th>
                <Th>Your Commission</Th>
                <Th>Status</Th>
                <Th>Converted At</Th>
              </tr>
            </thead>
            <tbody>
              {paginatedConversions.map((conv) => {
                const channel = (conv.source || conv.platform || "direct").toLowerCase();
                const badgeInfo = CHANNEL_BADGES[channel] || CHANNEL_BADGES.other;
                return (
                  <tr key={conv.id}>
                    <Td>
                      <strong style={{ fontSize: "var(--text-xs)" }}>
                        {conv.conversionType === "subscription_upgrade" ? "Subscription Upgrade" : (conv.conversionType || "Upgrade")}
                      </strong>
                    </Td>
                    <Td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          backgroundColor: badgeInfo.bg,
                          color: badgeInfo.color,
                        }}
                      >
                        {badgeInfo.label}
                      </span>
                    </Td>
                    <Td style={{ fontWeight: 600 }}>
                      {formatCurrency(conv.baseAmount, conv.currency || currency)}
                    </Td>
                    <Td>
                      <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)" }}>
                        {conv.commissionRate ?? 10}%
                      </span>
                    </Td>
                    <Td style={{ fontWeight: 700, color: "var(--color-success)" }}>
                      +{formatCurrency(conv.commissionAmount, conv.currency || currency)}
                    </Td>
                    <Td>
                      <Badge variant={CONVERSION_STATUS_VARIANT[conv.status] || "default"}>
                        {conv.status || "APPROVED"}
                      </Badge>
                    </Td>
                    <Td style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)" }}>
                      {formatDate(conv.convertedAt || conv.createdAt)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {filteredConversions.length > PAGE_SIZE && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filteredConversions.length}
            limit={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
