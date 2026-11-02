function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

import { useState } from "react";
import { Table, Th, Td, Pagination, Badge, Button, EmptyState } from "@/components";
import { formatNumber } from "@/utils";
import { formatCurrency } from "@/utils/currency";
import "./InfluencersTable.css";

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
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

const PLATFORM_BADGE_STYLES = {
  youtube: { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444", label: "YouTube" },
  instagram: { bg: "rgba(236, 72, 153, 0.12)", color: "#ec4899", label: "Instagram" },
  twitter: { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", label: "Twitter/X" },
  linkedin: { bg: "rgba(14, 165, 233, 0.12)", color: "#0ea5e9", label: "LinkedIn" },
  tiktok: { bg: "rgba(168, 85, 247, 0.12)", color: "#a855f7", label: "TikTok" },
  podcast: { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", label: "Podcast" },
  newsletter: { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981", label: "Newsletter" },
  other: { bg: "rgba(100, 116, 139, 0.12)", color: "#94a3b8", label: "Other" },
};

export function InfluencersTable({
  influencers = [],
  pagination,
  isLoading,
  onPageChange,
  onEdit,
  onSuspend,
  onReactivate,
  onConfigureCurrency,
  onResendEmail,
  resendingId,
  canUpdate,
  canSuspend,
  canManageCurrency,
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [copiedType, setCopiedType] = useState(null);

  const handleCopyCode = (id, code) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setCopiedType("code");
    setTimeout(() => {
      setCopiedId(null);
      setCopiedType(null);
    }, 2000);
  };

  const handleCopyLink = (id, linkOrCode) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const link = linkOrCode && linkOrCode.startsWith("http")
      ? linkOrCode
      : `${origin}/signup?ref=${linkOrCode}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setCopiedType("link");
    setTimeout(() => {
      setCopiedId(null);
      setCopiedType(null);
    }, 2000);
  };

  if (isLoading) {
    return (
      <div className="influencers-table-card">
        <Table aria-label="Influencers list loading">
          <thead>
            <tr>
              <Th>Influencer</Th>
              <Th>Referral Code</Th>
              <Th>Campaign</Th>
              <Th>Currency</Th>
              <Th>Rate / Tier</Th>
              <Th>Platform</Th>
              <Th>Referrals</Th>
              <Th>Conversions</Th>
              <Th>Total Earned</Th>
              <Th>Status</Th>
              <Th style={{ textAlign: "right" }}>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <Td colSpan={11} style={{ textAlign: "center", padding: "16px", color: "var(--color-text-muted)" }}>
                  Loading influencer network data...
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }

  if (!influencers || influencers.length === 0) {
    return (
      <div className="influencers-table-card">
        <EmptyState
          title="No Influencers Found"
          description="No influencers have joined the referral network matching this criteria."
        />
      </div>
    );
  }

  return (
    <div className="influencers-table-card">
      <Table aria-label="Influencers network table">
        <thead>
          <tr>
            <Th>Influencer</Th>
            <Th>Referral Code</Th>
            <Th>Campaign</Th>
            <Th>Currency</Th>
            <Th>Rate / Tier</Th>
            <Th>Platform</Th>
            <Th>Referrals</Th>
            <Th>Conversions</Th>
            <Th>Total Earned</Th>
            <Th>Status</Th>
            <Th style={{ textAlign: "right" }}>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {influencers.map((inf) => {
            const isSuspended = inf.status === "suspended";
            const isCopiedCode = copiedId === inf.id && copiedType === "code";
            const isCopiedLink = copiedId === inf.id && copiedType === "link";
            const currency = inf.payoutCurrency || "USD";
            const effectiveRate = inf.currentCommissionRate != null ? inf.currentCommissionRate : 10;
            const link = inf.referralLink || inf.referralCode;

            return (
              <tr key={inf.id}>
                {/* Influencer Name & Email */}
                <Td>
                  <div className="influencer-cell__profile">
                    <span className="influencer-cell__name">{inf.name}</span>
                    <span className="influencer-cell__email">{inf.email}</span>
                  </div>
                </Td>

                {/* Referral Code with Quick Copy Buttons */}
                <Td>
                  <div className="influencer-code-actions">
                    <span className="influencer-code-badge">{inf.referralCode}</span>
                    <button
                      type="button"
                      className={`influencer-copy-btn ${isCopiedCode ? "influencer-copy-btn--copied" : ""}`}
                      onClick={() => handleCopyCode(inf.id, inf.referralCode)}
                      title="Copy promo code"
                      aria-label={`Copy code ${inf.referralCode}`}
                    >
                      {isCopiedCode ? <IconCheck /> : <IconCopy />}
                    </button>
                    <button
                      type="button"
                      className={`influencer-copy-btn ${isCopiedLink ? "influencer-copy-btn--copied" : ""}`}
                      onClick={() => handleCopyLink(inf.id, link)}
                      title="Copy referral link"
                      aria-label={`Copy referral link for ${inf.name}`}
                    >
                      {isCopiedLink ? <IconCheck /> : <IconLink />}
                    </button>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--color-brand, #3b82f6)", fontWeight: 500, display: "block", marginTop: "4px" }}>
                    🎁 {inf.refereeCredits != null ? inf.refereeCredits : 100} credits
                  </span>
                </Td>

                {/* Campaign */}
                <Td>
                  {inf.campaign ? (
                    <Badge variant="default">{inf.campaign.name}</Badge>
                  ) : (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                      General
                    </span>
                  )}
                </Td>

                {/* Currency */}
                <Td>
                  <Badge variant="warning">{currency}</Badge>
                </Td>

                {/* Rate / Tier */}
                <Td>
                  <Badge variant="default">
                    {effectiveRate}%
                  </Badge>
                </Td>

                {/* Platform & Audience */}
                <Td>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "180px" }}>
                      {(Array.isArray(inf.platforms) && inf.platforms.length > 0
                        ? inf.platforms
                        : (inf.platform || "other").split(",").map((p) => p.trim().toLowerCase()).filter(Boolean)
                      ).map((p) => {
                        const style = PLATFORM_BADGE_STYLES[p] || PLATFORM_BADGE_STYLES.other;
                        return (
                          <span
                            key={p}
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: style.bg,
                              color: style.color,
                              display: "inline-block",
                              lineHeight: "1.2",
                            }}
                          >
                            {style.label || p}
                          </span>
                        );
                      })}
                    </div>
                    {inf.followerCount || inf.audienceSize ? (
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                        {formatNumber(inf.followerCount || inf.audienceSize)} audience
                      </span>
                    ) : null}
                  </div>
                </Td>

                {/* Referrals Count */}
                <Td>
                  <strong>{formatNumber(inf.usersJoined ?? inf.totalReferrals ?? 0)}</strong>
                </Td>

                {/* Conversions Count */}
                <Td>
                  <strong style={{ color: "var(--color-brand)" }}>
                    {formatNumber(inf.conversions ?? inf.totalConversions ?? 0)}
                  </strong>
                </Td>

                {/* Total Earned Commission */}
                <Td>
                  <span style={{ fontWeight: 600, color: "var(--color-success)" }}>
                    {formatCurrency(inf.totalCommissionEarned ?? 0, currency)}
                  </span>
                </Td>

                {/* Status Badge */}
                <Td>
                  <Badge variant={isSuspended ? "danger" : inf.status === "active" ? "success" : "default"}>
                    {inf.status ? inf.status.toUpperCase() : "ACTIVE"}
                  </Badge>
                </Td>

                {/* Actions */}
                <Td style={{ textAlign: "right" }}>
                  <div className="influencer-actions-cell">
                    {canUpdate && onResendEmail && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResendEmail(inf)}
                        disabled={resendingId === inf.id}
                        title="Resend welcome email & credentials"
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        <IconMail />
                        <span>{resendingId === inf.id ? "Sending..." : "Resend Mail"}</span>
                      </Button>
                    )}
                    {canManageCurrency && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onConfigureCurrency(inf)}
                        title="Configure Payout Currency"
                      >
                        Currency
                      </Button>
                    )}
                    {canUpdate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(inf)}
                        title="Edit Influencer"
                      >
                        Edit
                      </Button>
                    )}
                    {canSuspend && (
                      isSuspended ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onReactivate(inf.id)}
                          title="Reactivate account"
                        >
                          Reactivate
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => onSuspend(inf)}
                          title="Suspend account"
                        >
                          Suspend
                        </Button>
                      )
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
