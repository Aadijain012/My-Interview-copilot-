import { useState, useMemo } from "react";
import { usePermission } from "@/features/auth/rbac";
import { ErrorState } from "@/components";
import { DateRangeFilter } from "@/features/dashboard/components/DateRangeFilter";
import {
  ReferralDashboardKpis,
  ReferralsTable,
  ReferralsToolbar,
  ReferralDetailsModal,
  ReferralUsersTable,
} from "@/features/referrals";
import {
  useReferralDashboard,
  useReferrals,
  useApproveReferral,
  useReferralUsers,
  useRejectReferral,
} from "@/features/referrals";
import { RejectReferralModal } from "@/features/referrals/components/RejectReferralModal";
import { useDebounce } from "@/hooks";
import { getPresetDateRange } from "@/features/dashboard/utils/dateRange";
import { ConfirmModal } from "@/components";
import { useQueryClient } from "@tanstack/react-query";
import { referralKeys } from "@/features/referrals/hooks/useReferralQueries";
import "./ReferralDashboardPage.css";

export function ReferralDashboardPage() {
  const canRead = usePermission("referrals:read");
  const canWrite = usePermission("referrals:write");
  const qc = useQueryClient();

  const [preset, setPreset] = useState("30d");
  const dateRange = useMemo(() => getPresetDateRange(preset), [preset]);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [order, setOrder] = useState("desc");

  const dashboardQuery = useReferralDashboard(dateRange.from, dateRange.to);
  const referralsQuery = useReferrals({
    page,
    limit: 10,
    status: statusFilter,
    search: debouncedSearch,
    from: dateRange.from,
    to: dateRange.to,
    sortBy,
    order,
  });

  const approveMutation = useApproveReferral();
  const rejectMutation = useRejectReferral();

  const [viewReferral, setViewReferral] = useState(null);
  const [approveReferral, setApproveReferral] = useState(null);
  const [rejectReferral, setRejectReferral] = useState(null);

  const [activeTab, setActiveTab] = useState("referrals");

  // User Explorer state
  const [userPage, setUserPage] = useState(1);
  const [userSortBy, setUserSortBy] = useState("totalReferrals");
  const [userOrder, setUserOrder] = useState("desc");

  const referralUsersQuery = useReferralUsers({
    page: userPage,
    limit: 10,
    search: debouncedSearch,
    sortBy: userSortBy,
    order: userOrder,
  });

  const handleSort = (col) => {
    if (sortBy === col) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setOrder("desc");
    }
    setPage(1);
  };

  const handleUserSort = (col) => {
    if (userSortBy === col) {
      setUserOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setUserSortBy(col);
      setUserOrder("desc");
    }
    setUserPage(1);
  };

  if (!canRead)
    return (
      <ErrorState
        title="Access Restricted"
        message="You don't have permission to view referrals."
      />
    );

  return (
    <div className="referral-dashboard-page">
      <div className="referral-dashboard-page__header">
        <div>
          <h1 className="referral-dashboard-page__title">Refer & Earn</h1>
          <p className="referral-dashboard-page__subtitle">
            Manage referrals, track performance, and review pending referrals.
          </p>
        </div>
        <DateRangeFilter preset={preset} onChange={setPreset} />
      </div>

      <ReferralDashboardKpis
        data={dashboardQuery.data}
        isLoading={dashboardQuery.isLoading}
      />

      <div className="referral-dashboard-page__section">
        <div className="referral-dashboard-page__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "referrals"}
            className={`referral-dashboard-page__tab${activeTab === "referrals" ? " referral-dashboard-page__tab--active" : ""}`}
            onClick={() => setActiveTab("referrals")}
          >
            Referral Events
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "users"}
            className={`referral-dashboard-page__tab${activeTab === "users" ? " referral-dashboard-page__tab--active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            Referral User Explorer
          </button>
        </div>

        {activeTab === "referrals" ? (
          <>
            <ReferralsToolbar
              search={search}
              onSearchChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              statusFilter={statusFilter}
              onStatusChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
              total={referralsQuery.data?.pagination?.total ?? 0}
              onRefresh={() =>
                qc.invalidateQueries({ queryKey: referralKeys.all })
              }
            />

            {referralsQuery.isError ? (
              <ErrorState
                message="Failed to load referrals."
                onRetry={() => referralsQuery.refetch()}
              />
            ) : (
              <ReferralsTable
                referrals={referralsQuery.data?.referrals ?? []}
                pagination={
                  referralsQuery.data?.pagination ?? {
                    page: 1,
                    limit: 10,
                    total: 0,
                    totalPages: 1,
                  }
                }
                isLoading={referralsQuery.isLoading}
                sortBy={sortBy}
                order={order}
                onSort={handleSort}
                onPageChange={setPage}
                onView={setViewReferral}
                onApprove={setApproveReferral}
                onReject={setRejectReferral}
                canWrite={canWrite}
              />
            )}
          </>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--sp-2)",
              }}
            >
              <div style={{ maxWidth: 320, width: "100%" }}>
                <input
                  type="text"
                  placeholder="Search user or code..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setUserPage(1);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-bg-surface)",
                    color: "var(--color-text-primary)",
                    fontSize: "var(--text-sm)",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                }}
              >
                {(
                  referralUsersQuery.data?.pagination?.total ?? 0
                ).toLocaleString()}{" "}
                users tracked
              </span>
            </div>
            {referralUsersQuery.isError ? (
              <ErrorState
                message="Failed to load referral users."
                onRetry={() => referralUsersQuery.refetch()}
              />
            ) : (
              <ReferralUsersTable
                users={referralUsersQuery.data?.users ?? []}
                pagination={
                  referralUsersQuery.data?.pagination ?? {
                    page: 1,
                    limit: 10,
                    total: 0,
                    totalPages: 1,
                  }
                }
                isLoading={referralUsersQuery.isLoading}
                sortBy={userSortBy}
                order={userOrder}
                onSort={handleUserSort}
                onPageChange={setUserPage}
              />
            )}
          </>
        )}
      </div>

      <ReferralDetailsModal
        referral={viewReferral}
        isOpen={!!viewReferral}
        onClose={() => setViewReferral(null)}
      />
      <ConfirmModal
        isOpen={!!approveReferral}
        onClose={() => setApproveReferral(null)}
        title="Approve Referral"
        description={`Approve referral from ${approveReferral?.referrer?.name || approveReferral?.referrer?.email || ""}? Credits will be issued.`}
        confirmLabel="Approve"
        variant="warning"
        isLoading={approveMutation.isPending}
        onConfirm={() => {
          if (approveReferral)
            approveMutation.mutate(approveReferral.id, {
              onSuccess: () => setApproveReferral(null),
            });
        }}
      />

      <RejectReferralModal
        referral={rejectReferral}
        isOpen={!!rejectReferral}
        isLoading={rejectMutation.isPending}
        onClose={() => setRejectReferral(null)}
        onConfirm={(reason) => {
          if (rejectReferral)
            rejectMutation.mutate(
              { id: rejectReferral.id, reason },
              { onSuccess: () => setRejectReferral(null) },
            );
        }}
      />
    </div>
  );
}
