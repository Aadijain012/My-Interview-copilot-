import { Table, Th, Td, Badge, Button, Pagination } from "@/components";
import { Skeleton } from "@/components";
import { formatNumber } from "@/utils";
import "./MilestonesTable.css";

export function MilestonesTable({
  milestones,
  isLoading,
  onEdit,
  canWrite,
  pagination,
  onPageChange,
}) {
  if (isLoading) {
    return (
      <div className="milestones-table-card">
        <Table aria-label="Milestones">
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Name</Th>
              <Th>Threshold</Th>
              <Th>Reward</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 3 }).map((_, i) => (
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
    <div className="milestones-table-card">
      <Table aria-label="Milestones">
        <thead>
          <tr>
            <Th>#</Th>
            <Th>Name</Th>
            <Th>Campaign</Th>
            <Th>Threshold</Th>
            <Th>Reward</Th>
            <Th>Status</Th>
            <Th style={{ textAlign: "right" }}>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {milestones.map((m) => (
            <tr key={m.id}>
              <Td>{m.sortOrder}</Td>
              <Td primary>{m.name}</Td>
              <Td>{m.campaign?.name || "—"}</Td>
              <Td>{formatNumber(m.threshold)} referrals</Td>
              <Td>{formatNumber(m.rewardAmount)} credits</Td>
              <Td>
                <Badge variant={m.isActive ? "success" : "default"}>
                  {m.isActive ? "Active" : "Disabled"}
                </Badge>
              </Td>
              <Td style={{ textAlign: "right" }}>
                {canWrite && (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => onEdit?.(m)}
                  >
                    Edit
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={onPageChange ?? (() => {})}
        />
      )}
    </div>
  );
}
