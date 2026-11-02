import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { hasPermission } from "@/features/auth/rbac";
import { ErrorState } from "@/components";
import {
  useAuditLogs,
  AuditLogsToolbar,
  AuditLogsTable,
  AuditEventDetailsModal,
} from "@/features/audit-logs";
import "./AuditLogsPage.css";

export function AuditLogsPage() {
  const { admin } = useAuth();
  const hasReadPermission = hasPermission(admin?.role, "audit-logs:read");

  const [searchParams, setSearchParams] = useSearchParams();

  const actionParam = searchParams.get("action") ?? "";
  const actorParam = searchParams.get("actorId") ?? "";
  const targetParam = searchParams.get("targetId") ?? "";
  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";
  const pageParam = parseInt(searchParams.get("page") ?? "1", 10) || 1;

  const [actionFilter, setActionFilter] = useState(actionParam);
  const [actorFilter, setActorFilter] = useState(actorParam);
  const [targetFilter, setTargetFilter] = useState(targetParam);
  const [fromFilter, setFromFilter] = useState(fromParam);
  const [toFilter, setToFilter] = useState(toParam);
  const [page, setPage] = useState(pageParam);

  const [selectedEvent, setSelectedEvent] = useState(null);

  const queryParams = useMemo(
    () => ({
      action: actionFilter.trim() || undefined,
      actorId: actorFilter.trim() || undefined,
      targetId: targetFilter.trim() || undefined,
      from: fromFilter || undefined,
      to: toFilter || undefined,
      page,
      limit: 10,
    }),
    [actionFilter, actorFilter, targetFilter, fromFilter, toFilter, page],
  );

  const updateUrl = useCallback(
    (newAction, newActor, newTarget, newFrom, newTo, newPage) => {
      const next = new URLSearchParams();
      if (newAction) next.set("action", newAction);
      if (newActor) next.set("actorId", newActor);
      if (newTarget) next.set("targetId", newTarget);
      if (newFrom) next.set("from", newFrom);
      if (newTo) next.set("to", newTo);
      if (newPage > 1) next.set("page", String(newPage));
      setSearchParams(next, { replace: true });
    },
    [setSearchParams],
  );

  const { data, isLoading, isError, error, isFetching, refetch } = useAuditLogs(
    queryParams,
    hasReadPermission,
  );

  if (!hasReadPermission) {
    return (
      <div className="audit-logs-page">
        <ErrorState
          title="Access Restricted"
          message="You do not have permission to view system Audit Logs. Contact a platform Owner to request access."
        />
      </div>
    );
  }

  const handleActionChange = (val) => {
    setActionFilter(val);
    setPage(1);
    updateUrl(val, actorFilter, targetFilter, fromFilter, toFilter, 1);
  };

  const handleActorChange = (val) => {
    setActorFilter(val);
    setPage(1);
    updateUrl(actionFilter, val, targetFilter, fromFilter, toFilter, 1);
  };

  const handleTargetChange = (val) => {
    setTargetFilter(val);
    setPage(1);
    updateUrl(actionFilter, actorFilter, val, fromFilter, toFilter, 1);
  };

  const handleFromChange = (val) => {
    setFromFilter(val);
    setPage(1);
    updateUrl(actionFilter, actorFilter, targetFilter, val, toFilter, 1);
  };

  const handleToChange = (val) => {
    setToFilter(val);
    setPage(1);
    updateUrl(actionFilter, actorFilter, targetFilter, fromFilter, val, 1);
  };

  const handleResetFilters = () => {
    setActionFilter("");
    setActorFilter("");
    setTargetFilter("");
    setFromFilter("");
    setToFilter("");
    setPage(1);
    updateUrl("", "", "", "", "", 1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    updateUrl(
      actionFilter,
      actorFilter,
      targetFilter,
      fromFilter,
      toFilter,
      newPage,
    );
  };

  return (
    <div className="audit-logs-page">
      {/* Page Header */}
      <div className="audit-logs-page__header">
        <div>
          <h1 className="audit-logs-page__title">Audit Logs</h1>
          <p className="audit-logs-page__subtitle">
            Immutable operational event ledger recording administrative
            mutations, security modifications, and system activity.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <AuditLogsToolbar
        actionFilter={actionFilter}
        onActionChange={handleActionChange}
        actorFilter={actorFilter}
        onActorChange={handleActorChange}
        targetFilter={targetFilter}
        onTargetChange={handleTargetChange}
        fromFilter={fromFilter}
        onFromChange={handleFromChange}
        toFilter={toFilter}
        onToChange={handleToChange}
        totalCount={data?.pagination?.total}
        isFetching={isFetching}
        onRefresh={() => refetch()}
        onResetFilters={handleResetFilters}
      />

      {/* Error state with retry */}
      {isError && (
        <ErrorState
          title="Failed to load audit logs"
          message={error?.message ?? "An unexpected network error occurred."}
          onRetry={() => refetch()}
        />
      )}

      {/* Audit Log Table */}
      {!isError && (
        <AuditLogsTable
          logs={data?.auditLogs ?? []}
          pagination={data?.pagination}
          isLoading={isLoading}
          onPageChange={handlePageChange}
          onSelectEvent={(event) => setSelectedEvent(event)}
        />
      )}

      {/* Detail Modal */}
      <AuditEventDetailsModal
        event={selectedEvent}
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
