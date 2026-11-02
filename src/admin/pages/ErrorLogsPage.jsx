import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { hasPermission } from "@/features/auth/rbac";
import { ErrorState } from "@/components";
import {
  useErrorLogs,
  useErrorLogStats,
  useResolveErrorLog,
  useUpdateErrorLogStatus,
  useTriggerTestError,
  ErrorLogsStatsCards,
  ErrorLogsToolbar,
  ErrorLogsTable,
  ErrorLogDetailsModal,
} from "@/features/error-logs";
import "./ErrorLogsPage.css";

export function ErrorLogsPage() {
  const { admin } = useAuth();
  const hasReadPermission = hasPermission(admin?.role, "error-logs:read");

  const [searchParams, setSearchParams] = useSearchParams();

  const searchParam = searchParams.get("search") ?? "";
  const severityParam = searchParams.get("severity") ?? "all";
  const sourceParam = searchParams.get("source") ?? "all";
  const resolvedParam = searchParams.get("resolved") ?? "all";
  const statusParam = searchParams.get("status") ?? "all";
  const pageParam = parseInt(searchParams.get("page") ?? "1", 10) || 1;

  const [search, setSearch] = useState(searchParam);
  const [severity, setSeverity] = useState(severityParam);
  const [source, setSource] = useState(sourceParam);
  const [resolved, setResolved] = useState(resolvedParam);
  const [status, setStatus] = useState(statusParam);
  const [page, setPage] = useState(pageParam);

  const [selectedLog, setSelectedLog] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);

  const queryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      severity: severity !== "all" ? severity : undefined,
      source: source !== "all" ? source : undefined,
      status: status !== "all" ? status : undefined,
      resolved:
        resolved === "true" ? true : resolved === "false" ? false : undefined,
      page,
      limit: 10,
    }),
    [search, severity, source, status, resolved, page],
  );

  const updateUrl = useCallback(
    (newSearch, newSeverity, newSource, newResolved, newStatus, newPage) => {
      const next = new URLSearchParams();
      if (newSearch) next.set("search", newSearch);
      if (newSeverity && newSeverity !== "all")
        next.set("severity", newSeverity);
      if (newSource && newSource !== "all") next.set("source", newSource);
      if (newResolved && newResolved !== "all")
        next.set("resolved", newResolved);
      if (newStatus && newStatus !== "all") next.set("status", newStatus);
      if (newPage > 1) next.set("page", String(newPage));
      setSearchParams(next, { replace: true });
    },
    [setSearchParams],
  );

  // Queries (no live auto-refresh polling)
  const {
    data: listData,
    isLoading: isListLoading,
    isError: isListError,
    error: listError,
    isFetching,
    refetch: refetchList,
  } = useErrorLogs(queryParams, hasReadPermission);

  const {
    data: statsData,
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = useErrorLogStats(hasReadPermission);

  // Mutations
  const resolveMutation = useResolveErrorLog();
  const updateStatusMutation = useUpdateErrorLogStatus();
  const triggerTestMutation = useTriggerTestError();

  if (!hasReadPermission) {
    return (
      <div className="error-logs-page">
        <ErrorState
          title="Access Restricted"
          message="You do not have permission to view product error logs and internal stack traces. Contact a platform Administrator to request access."
        />
      </div>
    );
  }

  const handleSearchChange = (val) => {
    setSearch(val);
    setPage(1);
    updateUrl(val, severity, source, resolved, status, 1);
  };

  const handleSeverityChange = (val) => {
    setSeverity(val);
    setPage(1);
    updateUrl(search, val, source, resolved, status, 1);
  };

  const handleSourceChange = (val) => {
    setSource(val);
    setPage(1);
    updateUrl(search, severity, val, resolved, status, 1);
  };

  const handleResolvedChange = (val) => {
    setResolved(val);
    setPage(1);
    updateUrl(search, severity, source, val, status, 1);
  };

  const handleStatusChange = (val) => {
    setStatus(val);
    setPage(1);
    updateUrl(search, severity, source, resolved, val, 1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setSeverity("all");
    setSource("all");
    setResolved("all");
    setStatus("all");
    setPage(1);
    updateUrl("", "all", "all", "all", "all", 1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    updateUrl(search, severity, source, resolved, status, newPage);
  };

  const handleToggleResolve = async (id, currentResolved) => {
    try {
      setResolvingId(id);
      const res = await resolveMutation.mutateAsync({
        id,
        resolved: !currentResolved,
      });
      if (selectedLog && selectedLog.id === id) {
        setSelectedLog(res.data);
      }
    } finally {
      setResolvingId(null);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      setResolvingId(id);
      const res = await updateStatusMutation.mutateAsync({
        id,
        status: newStatus,
      });
      if (selectedLog && selectedLog.id === id) {
        setSelectedLog(res.data);
      }
    } finally {
      setResolvingId(null);
    }
  };

  const handleTriggerTest = async () => {
    await triggerTestMutation.mutateAsync({
      severity: "error",
      source: "api",
      message:
        "Synthetic test error generated from Admin Panel verification toolbar",
    });
  };

  const handleRefresh = () => {
    refetchList();
    refetchStats();
  };

  return (
    <div className="error-logs-page">
      {/* Header */}
      <div className="error-logs-page__header">
        <div>
          <h1 className="error-logs-page__title">Error Logs</h1>
          <p className="error-logs-page__subtitle">
            Runtime diagnostic stream tracking application exceptions, AI
            service failures, and sanitized stack traces.
          </p>
        </div>
      </div>

      {/* KPI Stats (5 cards including Total Errors Monitoring) */}
      <ErrorLogsStatsCards
        stats={statsData?.data}
        isLoading={isStatsLoading}
        onSelectMonitoring={() =>
          handleStatusChange(status === "monitoring" ? "all" : "monitoring")
        }
        activeStatus={status}
      />

      {/* Toolbar */}
      <ErrorLogsToolbar
        search={search}
        onSearchChange={handleSearchChange}
        severity={severity}
        onSeverityChange={handleSeverityChange}
        source={source}
        onSourceChange={handleSourceChange}
        resolved={resolved}
        onResolvedChange={handleResolvedChange}
        status={status}
        onStatusChange={handleStatusChange}
        monitoringCount={statsData?.data?.monitoringErrors}
        totalCount={listData?.pagination?.total}
        isFetching={isFetching}
        onRefresh={handleRefresh}
        onResetFilters={handleResetFilters}
        onTriggerTestError={handleTriggerTest}
      />

      {/* Error state with retry */}
      {isListError && (
        <ErrorState
          title="Failed to load error logs"
          message={
            listError?.message ??
            "An unexpected network error occurred while contacting the error logging service."
          }
          onRetry={handleRefresh}
        />
      )}

      {/* Table */}
      {!isListError && (
        <ErrorLogsTable
          logs={listData?.data ?? []}
          pagination={listData?.pagination}
          isLoading={isListLoading}
          onPageChange={handlePageChange}
          onSelectLog={(log) => setSelectedLog(log)}
          onToggleResolve={handleToggleResolve}
          onUpdateStatus={handleUpdateStatus}
          resolvingId={resolvingId}
        />
      )}

      {/* Detail Modal */}
      <ErrorLogDetailsModal
        errorLog={selectedLog}
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        onToggleResolve={handleToggleResolve}
        onUpdateStatus={handleUpdateStatus}
        isResolving={resolvingId === selectedLog?.id}
      />
    </div>
  );
}
