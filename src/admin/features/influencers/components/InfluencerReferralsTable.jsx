import { Table, Th, Td, Pagination, Badge, EmptyState, Select } from "@/components";
import { formatDate } from "@/utils";

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

export function InfluencerReferralsTable({
  referrals = [],
  pagination,
  isLoading,
  platformFilter = "",
  onPlatformFilterChange,
  onPageChange,
  onUpdateStatus,
  canUpdate,
}) {
  if (isLoading) {
    return (
      <div className="influencers-table-card">
        <Table aria-label="Referrals loading">
          <thead>
            <tr>
              <Th>Referred User</Th>
              <Th>Referral Code</Th>
              <Th>Influencer Partner</Th>
              <Th>Channel / Platform</Th>
              <Th>Campaign</Th>
              <Th>Status</Th>
              <Th>Attributed Date</Th>
              {canUpdate && <Th style={{ textAlign: "right" }}>Update Status</Th>}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <Td colSpan={8} style={{ textAlign: "center", padding: "16px", color: "var(--color-text-muted)" }}>
                  Loading referral attribution records...
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }

  if (!referrals || referrals.length === 0) {
    return (
      <div className="influencers-table-card">
        {onPlatformFilterChange && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--sp-3, 12px)" }}>
            <Select
              value={platformFilter || ""}
              onChange={(e) => onPlatformFilterChange(e.target.value)}
              style={{ width: "170px", fontSize: "var(--text-xs)" }}
            >
              <option value="">All Platforms</option>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="twitter">Twitter / X</option>
              <option value="linkedin">LinkedIn</option>
              <option value="tiktok">TikTok</option>
              <option value="podcast">Podcast</option>
              <option value="direct">Direct / Web</option>
            </Select>
          </div>
        )}
        <EmptyState
          title="No Referrals Found"
          description="Users attributed to influencer referral codes will appear here."
        />
      </div>
    );
  }

  return (
    <div className="influencers-table-card">
      {onPlatformFilterChange && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-3, 12px)" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
            Showing <strong>{referrals.length}</strong> referral records
          </span>
          <Select
            value={platformFilter || ""}
            onChange={(e) => onPlatformFilterChange(e.target.value)}
            style={{ width: "170px", fontSize: "var(--text-xs)" }}
          >
            <option value="">All Platforms</option>
            <option value="youtube">YouTube</option>
            <option value="instagram">Instagram</option>
            <option value="twitter">Twitter / X</option>
            <option value="linkedin">LinkedIn</option>
            <option value="tiktok">TikTok</option>
            <option value="podcast">Podcast</option>
            <option value="direct">Direct / Web</option>
          </Select>
        </div>
      )}
      <Table aria-label="Influencer Referrals Table">
        <thead>
          <tr>
            <Th>Referred User</Th>
            <Th>Referral Code</Th>
            <Th>Influencer Partner</Th>
            <Th>Channel / Platform</Th>
            <Th>Campaign</Th>
            <Th>Status</Th>
            <Th>Attributed Date</Th>
            {canUpdate && <Th style={{ textAlign: "right" }}>Update Status</Th>}
          </tr>
        </thead>
        <tbody>
          {referrals.map((ref) => {
            const rawStatus = (ref.status || "REGISTERED").toUpperCase();
            const badgeVariant = REFERRAL_STATUS_VARIANT[rawStatus] || "default";
            const src = (ref.source || ref.platform || "direct").toLowerCase();
            const channelStyle = CHANNEL_BADGES[src] || CHANNEL_BADGES.other;

            return (
              <tr key={ref.id}>
                <Td>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                      {ref.user?.name || ref.referredUser?.name || "Registered User"}
                    </span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>
                      {ref.user?.email || ref.referredUser?.email || ref.userId || ref.referredUserId}
                    </span>
                  </div>
                </Td>

                <Td>
                  <code style={{ background: "var(--color-bg-subtle)", padding: "2px 8px", borderRadius: "4px", color: "var(--color-brand)", fontWeight: 600 }}>
                    {ref.referralCode || ref.codeUsed}
                  </code>
                </Td>

                <Td>
                  {ref.influencer ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>
                        {ref.influencer.name}
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                        {ref.influencer.email}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Direct</span>
                  )}
                </Td>

                {/* Channel / Platform Source */}
                <Td>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: channelStyle.bg,
                      color: channelStyle.color,
                      display: "inline-block",
                    }}
                  >
                    {channelStyle.label || src}
                  </span>
                </Td>

                <Td>
                  {ref.influencer?.campaign ? (
                    <Badge variant="default">{ref.influencer.campaign.name}</Badge>
                  ) : (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>General</span>
                  )}
                </Td>

                <Td>
                  <Badge variant={badgeVariant}>
                    {rawStatus}
                  </Badge>
                </Td>

                <Td>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                    {formatDate(ref.createdAt)}
                  </span>
                </Td>

                {canUpdate && (
                  <Td style={{ textAlign: "right" }}>
                    <Select
                      value={rawStatus}
                      onChange={(e) => onUpdateStatus(ref.id, e.target.value)}
                      style={{ fontSize: "var(--text-xs)", padding: "4px 8px", width: "auto", display: "inline-block" }}
                    >
                      <option value="CLICKED">CLICKED</option>
                      <option value="REGISTERED">REGISTERED</option>
                      <option value="QUALIFIED">QUALIFIED</option>
                      <option value="CONVERTED">CONVERTED</option>
                      <option value="REJECTED">REJECTED</option>
                    </Select>
                  </Td>
                )}
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
