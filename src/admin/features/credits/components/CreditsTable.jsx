import { Table, Th, Td, Pagination, Badge } from "@/components";
import { Skeleton } from "@/components";
import { formatDateTime, formatNumber } from "@/utils";
import "./CreditsTable.css";

const TYPE_VARIANT = {
  referral_reward: "success",
  milestone_reward: "accent",
  admin_adjustment: "info",
  reversal: "danger",
};

const TYPE_LABEL = {
  referral_reward: "Referral",
  milestone_reward: "Milestone",
  admin_adjustment: "Adjustment",
  reversal: "Reversal",
};

export function CreditsTable({ entries, pagination, isLoading, onPageChange }) {
  if (isLoading) {
    return (
      <div className="credits-table-card">
        <Table aria-label="Credits Ledger">
          <thead>
            <tr>
              <Th>User</Th>
              <Th>Amount</Th>
              <Th>Type</Th>
              <Th>Balance</Th>
              <Th>Reason</Th>
              <Th>Date</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
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
    <div className="credits-table-card">
      <Table aria-label="Credits Ledger">
        <thead>
          <tr>
            <Th>User</Th>
            <Th>Amount</Th>
            <Th>Type</Th>
            <Th>Balance</Th>
            <Th>Reason</Th>
            <Th>Date</Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <Td primary>
                <div className="credits-table__user">
                  <span>{e.user.name || e.user.email}</span>
                  <span className="credits-table__email">{e.user.email}</span>
                </div>
              </Td>
              <Td>
                <span
                  className={`credits-table__amount credits-table__amount--${e.amount >= 0 ? "positive" : "negative"}`}
                >
                  {e.amount >= 0 ? "+" : ""}
                  {formatNumber(e.amount)}
                </span>
              </Td>
              <Td>
                <Badge variant={TYPE_VARIANT[e.type]}>
                  {TYPE_LABEL[e.type] || e.type}
                </Badge>
              </Td>
              <Td mono>
                {formatNumber(e.balanceBefore)} → {formatNumber(e.balanceAfter)}
              </Td>
              <Td>{e.reason || "—"}</Td>
              <Td>{formatDateTime(e.createdAt)}</Td>
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
