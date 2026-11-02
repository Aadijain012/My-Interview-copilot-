import { useState } from "react";
import { usePermission } from "@/features/auth/rbac";
import { ErrorState, EmptyState } from "@/components";
import { CreditsTable, CreditsToolbar } from "@/features/credits";
import { useCredits, useExportCredits } from "@/features/credits";
import { useDebounce } from "@/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { creditKeys } from "@/features/credits/hooks/useCreditQueries";
import "./CreditsLedgerPage.css";

export function CreditsLedgerPage() {
  const canRead = usePermission("credits:read");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const params = {
    page,
    limit: 10,
    type: typeFilter || undefined,
    search: debouncedSearch,
  };
  const creditsQuery = useCredits(params);
  const exportMutation = useExportCredits();

  if (!canRead)
    return (
      <ErrorState
        title="Access Restricted"
        message="You don't have permission to view the credits ledger."
      />
    );

  return (
    <div className="credits-ledger-page">
      <div className="credits-ledger-page__header">
        <h1 className="credits-ledger-page__title">Credits Ledger</h1>
        <p className="credits-ledger-page__subtitle">
          Read-only transaction log for all credit operations.
        </p>
      </div>

      <CreditsToolbar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        typeFilter={typeFilter}
        onTypeChange={(v) => {
          setTypeFilter(v);
          setPage(1);
        }}
        total={creditsQuery.data?.pagination?.total ?? 0}
        onRefresh={() => qc.invalidateQueries({ queryKey: creditKeys.all })}
        onExport={() => exportMutation.mutate(params)}
        isExporting={exportMutation.isPending}
      />

      {creditsQuery.isError ? (
        <ErrorState
          message="Failed to load credits."
          onRetry={() => creditsQuery.refetch()}
        />
      ) : (creditsQuery.data?.entries?.length ?? 0) === 0 &&
        !creditsQuery.isLoading ? (
        <EmptyState
          title="No credit entries"
          description="Credit transactions will appear here when referrals are processed."
        />
      ) : (
        <CreditsTable
          entries={creditsQuery.data?.entries ?? []}
          pagination={
            creditsQuery.data?.pagination ?? {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 1,
            }
          }
          isLoading={creditsQuery.isLoading}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
