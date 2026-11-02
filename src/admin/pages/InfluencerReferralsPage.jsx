import { useState } from "react";
import { Badge, Button, Table, Th, Td, Pagination, EmptyState, PageLoader, Select } from "@/components";
import { formatDate } from "@/utils";
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

const REFERRAL_STATUS_VARIANT = {
  CLICKED: "default",
  REGISTERED: "warning",
  QUALIFIED: "default",
  CONVERTED: "success",
  REJECTED: "danger",
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

export function InfluencerReferralsPage() {
  const { data, isLoading, error } = useMyInfluencerDashboard();
  const [copiedLink, setCopiedLink] = useState(false);
  const [platformFilter, setPlatformFilter] = useState("");
  const [page, setPage] = useState(1);

  if (isLoading) {
    return <PageLoader text="Loading your referrals..." />;
  }

  if (error) {
    return (
      <div className="influencer-dashboard-page">
        <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid var(--color-danger, #ef4444)", borderRadius: "var(--radius-lg, 12px)", padding: "24px", textAlign: "center" }}>
          <h2 style={{ color: "var(--color-danger, #ef4444)", margin: "0 0 8px" }}>Error Loading Referrals</h2>
          <p style={{ color: "var(--color-text-secondary, #64748b)", margin: 0 }}>{error?.message || "Could not retrieve referral data."}</p>
        </div>
      </div>
    );
  }

  const influencer = data?.influencer || {};
  const referrals = data?.referrals || [];
  const promoCode = influencer.referralCode || "";
  const promoLink = influencer.referralLink || `${typeof window !== "undefined" ? window.location.origin : ""}/signup?ref=${promoCode}`;

  const influencerPlatforms = Array.isArray(influencer.platforms) && influencer.platforms.length > 0
    ? influencer.platforms
    : (influencer.platform || "general").split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(promoLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const PAGE_SIZE = 10;
  const filteredReferrals = platformFilter
    ? referrals.filter((r) => (r.source || r.platform || "direct").toLowerCase() === platformFilter.toLowerCase())
    : referrals;
  const totalPages = Math.ceil(filteredReferrals.length / PAGE_SIZE) || 1;
  const paginatedReferrals = filteredReferrals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="influencer-dashboard-page">
      {/* Page Header */}
      <div className="influencer-dashboard-header">
        <div>
          <h1 className="influencer-dashboard-title">My Referrals</h1>
          <p className="influencer-dashboard-subtitle">
            All users who visited and registered using your creator referral links.
          </p>
        </div>

        {/* Quick Link Share */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <code style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", padding: "6px 12px", borderRadius: "6px", fontSize: "var(--text-xs)" }}>
            {promoCode}
          </code>
          <Button variant="primary" size="sm" onClick={handleCopyLink}>
            {copiedLink ? <IconCheck /> : <IconCopy />}
            {copiedLink ? "Copied Link" : "Copy Referral Link"}
          </Button>
        </div>
      </div>

      {/* Referrals Table Card */}
      <div className="influencers-table-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-3, 12px)", padding: "16px 20px 0", flexWrap: "wrap", gap: "10px" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
            Showing <strong>{filteredReferrals.length}</strong> of {referrals.length} total referrals
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

        {filteredReferrals.length === 0 ? (
          <EmptyState
            title="No Referrals Found"
            description={platformFilter ? `No referrals tracked under ${CHANNEL_BADGES[platformFilter]?.label || platformFilter} yet.` : "Share your unique referral link to start acquiring subscribers."}
            action={
              <Button variant="secondary" onClick={handleCopyLink}>
                {copiedLink ? <IconCheck /> : <IconCopy />}
                {copiedLink ? "Copied Link" : "Copy Your Referral Link"}
              </Button>
            }
          />
        ) : (
          <Table aria-label="My referrals list">
            <thead>
              <tr>
                <Th>User / Referral ID</Th>
                <Th>Acquisition Channel</Th>
                <Th>Status</Th>
                <Th>Registered At</Th>
              </tr>
            </thead>
            <tbody>
              {paginatedReferrals.map((ref) => {
                const channel = (ref.source || ref.platform || "direct").toLowerCase();
                const badgeInfo = CHANNEL_BADGES[channel] || CHANNEL_BADGES.other;
                return (
                  <tr key={ref.id}>
                    <Td>
                      <code style={{ fontSize: "var(--text-xs)" }}>
                        {ref.userId ? `User #${ref.userId.slice(0, 8)}` : `Ref #${ref.id.slice(0, 8)}`}
                      </code>
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
                    <Td>
                      <Badge variant={REFERRAL_STATUS_VARIANT[ref.status] || "default"}>
                        {ref.status || "REGISTERED"}
                      </Badge>
                    </Td>
                    <Td style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)" }}>
                      {formatDate(ref.createdAt)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {filteredReferrals.length > PAGE_SIZE && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filteredReferrals.length}
            limit={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
