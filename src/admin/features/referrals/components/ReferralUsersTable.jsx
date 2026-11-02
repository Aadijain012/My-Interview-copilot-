import { useState } from "react";
import { Table, Th, Td, Pagination, Skeleton, EmptyState } from "@/components";
import { formatNumber } from "@/utils";

function IconCopy() {
  return (
    <svg
      width="13"
      height="13"
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

export function ReferralUsersTable({
  users,
  pagination,
  isLoading,
  sortBy,
  order,
  onSort,
  onPageChange,
}) {
  const [copiedCode, setCopiedCode] = useState(null);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="referrals-table-card" aria-busy="true">
        <Table aria-label="Loading referral users">
          <thead>
            <tr>
              <Th>User</Th>
              <Th>Referral Code</Th>
              <Th>Total Referrals</Th>
              <Th>Successful</Th>
              <Th>Credits Earned</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <Td key={j}>
                    <Skeleton height={18} />
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="referrals-table-card">
        <EmptyState
          title="No referral users found"
          description="Users participating in referral campaigns will appear here."
        />
      </div>
    );
  }

  return (
    <div className="referrals-table-card">
      <Table aria-label="Referral Users Explorer">
        <thead>
          <tr>
            <Th>User</Th>
            <Th>Referral Code</Th>
            <Th
              sortable
              sortDir={sortBy === "totalReferrals" ? order : null}
              onSort={() => onSort("totalReferrals")}
            >
              Total Referrals
            </Th>
            <Th
              sortable
              sortDir={sortBy === "successfulReferrals" ? order : null}
              onSort={() => onSort("successfulReferrals")}
            >
              Successful
            </Th>
            <Th
              sortable
              sortDir={sortBy === "creditsEarned" ? order : null}
              onSort={() => onSort("creditsEarned")}
            >
              Credits Earned
            </Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <Td primary>
                <div className="referrals-table__user">
                  <span className="referrals-table__user-name">
                    {u.name || u.email}
                  </span>
                  <span className="referrals-table__user-email">{u.email}</span>
                </div>
              </Td>
              <Td>
                {u.referralCode ? (
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
                      {u.referralCode}
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
                      aria-label={`Copy referral code ${u.referralCode}`}
                      onClick={() => handleCopyCode(u.referralCode)}
                    >
                      {copiedCode === u.referralCode ? (
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
                      fontSize: "0.75rem",
                      color: "var(--color-text-muted)",
                      fontStyle: "italic",
                      background: "var(--color-bg-subtle)",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    No active referral code
                  </span>
                )}
              </Td>
              <Td>
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {formatNumber(u.totalReferrals)}
                </span>
              </Td>
              <Td>
                <span
                  style={{
                    fontWeight: 600,
                    color:
                      u.successfulReferrals > 0
                        ? "var(--color-success)"
                        : "var(--color-text-secondary)",
                  }}
                >
                  {formatNumber(u.successfulReferrals)}
                </span>
              </Td>
              <Td>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 3,
                    fontWeight: 600,
                    color:
                      u.creditsEarned > 0
                        ? "var(--color-accent)"
                        : "var(--color-text-muted)",
                  }}
                >
                  {formatNumber(u.creditsEarned)}
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    cr
                  </span>
                </span>
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
