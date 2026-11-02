import { Table, Th, Td, Pagination, Badge, EmptyState, Select } from "@/components";
import { formatDate } from "@/utils";
import { formatCurrency } from "@/utils/currency";

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

export function InfluencerConversionsTable({
  conversions = [],
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
        <Table aria-label="Conversions loading">
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Influencer Partner</Th>
              <Th>Channel / Platform</Th>
              <Th>Campaign</Th>
              <Th>Base Amount</Th>
              <Th>Snapshot Rate</Th>
              <Th>Commission</Th>
              <Th>Currency</Th>
              <Th>Status</Th>
              <Th>Converted At</Th>
              {canUpdate && <Th style={{ textAlign: "right" }}>Update Status</Th>}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <Td colSpan={11} style={{ textAlign: "center", padding: "16px", color: "var(--color-text-muted)" }}>
                  Loading conversion financial records...
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }

  if (!conversions || conversions.length === 0) {
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
          title="No Conversions Found"
          description="Paid customer conversions attributed to influencers will appear here with frozen financial snapshots."
        />
      </div>
    );
  }

  return (
    <div className="influencers-table-card">
      {onPlatformFilterChange && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-3, 12px)" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
            Showing <strong>{conversions.length}</strong> conversion records
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
      <Table aria-label="Influencer Conversions Table">
        <thead>
          <tr>
            <Th>Customer</Th>
            <Th>Influencer Partner</Th>
            <Th>Channel / Platform</Th>
            <Th>Campaign</Th>
            <Th>Base Amount</Th>
            <Th>Snapshot Rate</Th>
            <Th>Commission</Th>
            <Th>Currency</Th>
            <Th>Status</Th>
            <Th>Converted At</Th>
            {canUpdate && <Th style={{ textAlign: "right" }}>Update Status</Th>}
          </tr>
        </thead>
        <tbody>
          {conversions.map((conv) => {
            const rawStatus = (conv.status || "PENDING").toUpperCase();
            const badgeVariant = CONVERSION_STATUS_VARIANT[rawStatus] || "default";
            const currency = conv.currency || "USD";
            const rate = conv.commissionRate ?? conv.rate ?? 10;
            const baseAmount = conv.baseAmount ?? 0;
            const commissionAmount = conv.commissionAmount ?? 0;
            const src = (conv.source || conv.platform || "direct").toLowerCase();
            const channelStyle = CHANNEL_BADGES[src] || CHANNEL_BADGES.other;

            return (
              <tr key={conv.id}>
                {/* Customer */}
                <Td>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                      {conv.user?.name || conv.referredUser?.name || "Customer"}
                    </span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>
                      {conv.user?.email || conv.referredUser?.email || conv.userId}
                    </span>
                  </div>
                </Td>

                {/* Influencer */}
                <Td>
                  {conv.influencer ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>
                        {conv.influencer.name}
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                        {conv.influencer.email}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Direct</span>
                  )}
                </Td>

                {/* Channel / Platform */}
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

                {/* Campaign */}
                <Td>
                  {conv.campaign ? (
                    <Badge variant="default">{conv.campaign.name}</Badge>
                  ) : conv.influencer?.campaign ? (
                    <Badge variant="default">{conv.influencer.campaign.name}</Badge>
                  ) : (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>General</span>
                  )}
                </Td>

                {/* Base Amount */}
                <Td>
                  <span style={{ fontWeight: 500 }}>
                    {formatCurrency(baseAmount, currency)}
                  </span>
                </Td>

                {/* Snapshot Rate */}
                <Td>
                  <Badge variant="warning">{rate}% (Frozen)</Badge>
                </Td>

                {/* Commission Amount */}
                <Td>
                  <strong style={{ color: "var(--color-success)" }}>
                    {formatCurrency(commissionAmount, currency)}
                  </strong>
                </Td>

                {/* Currency Badge */}
                <Td>
                  <Badge variant="default">{currency}</Badge>
                </Td>

                {/* Status */}
                <Td>
                  <Badge variant={badgeVariant}>
                    {rawStatus}
                  </Badge>
                </Td>

                {/* Date */}
                <Td>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                    {formatDate(conv.convertedAt || conv.createdAt)}
                  </span>
                </Td>

                {canUpdate && (
                  <Td style={{ textAlign: "right" }}>
                    <Select
                      value={rawStatus}
                      onChange={(e) => onUpdateStatus(conv.id, e.target.value)}
                      style={{ fontSize: "var(--text-xs)", padding: "4px 8px", width: "auto", display: "inline-block" }}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                      <option value="CANCELLED">CANCELLED</option>
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
