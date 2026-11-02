import {
  Table,
  Th,
  Td,
  Pagination,
  Button,
  EmptyState,
  SkeletonTable,
} from "@/components";
import { formatDateTime } from "@/utils";
import { AuditActionBadge } from "./AuditActionBadge";
import "./AuditLogsTable.css";

export function AuditLogsTable({
  logs,
  pagination,
  isLoading,
  onPageChange,
  onSelectEvent,
}) {
  if (isLoading) {
    return <SkeletonTable rows={8} columns={[120, 160, 100, 100, 60]} />;
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        title="No audit events found"
        description="No events match your current filter criteria or date range."
      />
    );
  }

  return (
    <div className="audit-table-wrapper">
      <Table aria-label="System audit log events">
        <thead>
          <tr>
            <Th>Timestamp</Th>
            <Th>Action</Th>
            <Th>Actor</Th>
            <Th>Target Resource</Th>
            <Th style={{ textAlign: "right" }}>Details</Th>
          </tr>
        </thead>
        <tbody>
          {logs.map((event) => (
            <tr key={event.id} className="audit-table__row">
              {/* Timestamp */}
              <Td className="td--mono td--secondary">
                {formatDateTime(event.createdAt)}
              </Td>

              {/* Action */}
              <Td>
                <AuditActionBadge action={event.action} />
              </Td>

              {/* Actor */}
              <Td className="td--mono">
                {event.actorId ? (
                  <span
                    className="audit-table__actor"
                    title={`Admin ID: ${event.actorId}`}
                  >
                    {event.actorId}
                  </span>
                ) : (
                  <span className="text-muted">System / Guest</span>
                )}
              </Td>

              {/* Target */}
              <Td className="td--mono">
                {event.targetId ? (
                  <span
                    className="audit-table__target"
                    title={`Target ID: ${event.targetId}`}
                  >
                    {event.targetId}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </Td>

              {/* Action Button */}
              <Td style={{ textAlign: "right" }}>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onSelectEvent(event)}
                  aria-label={`View details for event ${event.id}`}
                >
                  View Event
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {pagination && (
        <div className="audit-table__pagination">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
