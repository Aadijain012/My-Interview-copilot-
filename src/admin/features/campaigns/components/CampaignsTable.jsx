import { useState } from "react";
import { Table, Th, Td, Pagination, Badge, Button } from "@/components";
import { Skeleton } from "@/components";
import { formatDate, formatNumber } from "@/utils";
import "./CampaignsTable.css";

const STATUS_VARIANT = {
  draft: "default",
  active: "success",
  paused: "warning",
  ended: "danger",
};

function IconCopy() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  );
}

export function CampaignsTable({
  campaigns,
  pagination,
  isLoading,
  onPageChange,
  onView,
  onEdit,
  canWrite,
}) {
  const [copiedCode, setCopiedCode] = useState(null);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="campaigns-table-card">
        <Table aria-label="Campaigns">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Referral Code</Th>
              <Th>Status</Th>
              <Th>Reward</Th>
              <Th>Referrals</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <Td key={j}>
                    <Skeleton height={16} />
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }
  return (
    <div className="campaigns-table-card">
      <Table aria-label="Campaigns">
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Referral Code</Th>
            <Th>Status</Th>
            <Th>Reward</Th>
            <Th>Referrals</Th>
            <Th>Created</Th>
            <Th style={{ textAlign: "right" }}>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <Td primary>{c.name}</Td>
              <Td>
                {c.code ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <code
                      style={{
                        fontSize: "0.8125rem",
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "var(--color-bg-elevated)",
                        border: "1px solid var(--color-border)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {c.code}
                    </code>
                    <button
                      type="button"
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 2,
                        color: "var(--color-text-secondary)",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                      title="Copy referral code"
                      aria-label={`Copy referral code ${c.code}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyCode(c.code);
                      }}
                    >
                      {copiedCode === c.code ? (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--color-success)",
                            fontWeight: 600,
                          }}
                        >
                          Copied!
                        </span>
                      ) : (
                        <IconCopy />
                      )}
                    </button>
                  </div>
                ) : (
                  <span
                    style={{
                      color: "var(--color-text-muted)",
                      fontSize: "0.8125rem",
                    }}
                  >
                    None
                  </span>
                )}
              </Td>
              <Td>
                <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
              </Td>
              <Td>{formatNumber(c.rewardAmount)} credits</Td>
              <Td>{c._count ? formatNumber(c._count.referrals) : "—"}</Td>
              <Td>{formatDate(c.createdAt)}</Td>
              <Td style={{ textAlign: "right" }}>
                <div className="campaigns-table__actions">
                  <Button size="xs" variant="ghost" onClick={() => onView(c)}>
                    View
                  </Button>
                  {canWrite && (
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => onEdit?.(c)}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        limit={pagination.limit}
        onPageChange={onPageChange}
      />
    </div>
  );
}
