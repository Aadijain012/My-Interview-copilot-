import { Table, Th, Td, Pagination } from "@/components";
import { Badge, Button } from "@/components";
import { Skeleton } from "@/components";
import { formatDate } from "@/utils";
import "./ReferralsTable.css";

const STATUS_VARIANT = {
  pending: "warning",
  completed: "success",
  rejected: "danger",
};

export function ReferralsTable({
  referrals,
  pagination,
  isLoading,
  sortBy,
  order,
  onSort,
  onPageChange,
  onView,
  onApprove,
  onReject,
  canWrite,
}) {
  if (isLoading) {
    return (
      <div className="referrals-table-card">
        <Table aria-label="Referrals">
          <thead>
            <tr>
              <Th>Referrer</Th>
              <Th>Referee</Th>
              <Th>Campaign</Th>
              <Th>Status</Th>
              <Th>Date</Th>
              <Th>Actions</Th>
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
    <div className="referrals-table-card">
      <Table aria-label="Referrals">
        <thead>
          <tr>
            <Th>Referrer</Th>
            <Th>Referee</Th>
            <Th>Campaign</Th>
            <Th
              sortable
              sortDir={sortBy === "status" ? order : null}
              onSort={() => onSort("status")}
            >
              Status
            </Th>
            <Th
              sortable
              sortDir={sortBy === "createdAt" ? order : null}
              onSort={() => onSort("createdAt")}
            >
              Date
            </Th>
            <Th style={{ textAlign: "right" }}>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {referrals.map((r) => (
            <tr key={r.id}>
              <Td primary>
                <div className="referrals-table__user">
                  <span className="referrals-table__user-name">
                    {r.referrer.name || r.referrer.email}
                  </span>
                  <span className="referrals-table__user-email">
                    {r.referrer.email}
                  </span>
                </div>
              </Td>
              <Td>
                <div className="referrals-table__user">
                  <span className="referrals-table__user-name">
                    {r.referee.name || r.referee.email}
                  </span>
                  <span className="referrals-table__user-email">
                    {r.referee.email}
                  </span>
                </div>
              </Td>
              <Td>{r.campaign?.name || "—"}</Td>
              <Td>
                <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
              </Td>
              <Td>{formatDate(r.createdAt)}</Td>
              <Td style={{ textAlign: "right" }}>
                <div className="referrals-table__actions">
                  <Button size="xs" variant="ghost" onClick={() => onView(r)}>
                    View
                  </Button>
                  {canWrite && r.status === "pending" && (
                    <>
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => onApprove?.(r)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        variant="danger-outline"
                        onClick={() => onReject?.(r)}
                      >
                        Reject
                      </Button>
                    </>
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
