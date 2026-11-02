import { useState } from "react";
import { Badge, Table, Th, Td, Pagination, EmptyState, PageLoader } from "@/components";
import { formatDate } from "@/utils";
import { formatCurrency } from "@/utils/currency";
import { useMyInfluencerDashboard } from "@/features/influencers";
import "./InfluencerDashboardPage.css";

const PAYOUT_STATUS_VARIANT = {
  PENDING: "warning",
  PROCESSING: "default",
  PAID: "success",
  FAILED: "danger",
  CANCELLED: "default",
};

export function InfluencerPayoutsPage() {
  const { data, isLoading, error } = useMyInfluencerDashboard();
  const [page, setPage] = useState(1);

  if (isLoading) {
    return <PageLoader text="Loading your payout history..." />;
  }

  if (error) {
    return (
      <div className="influencer-dashboard-page">
        <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid var(--color-danger, #ef4444)", borderRadius: "var(--radius-lg, 12px)", padding: "24px", textAlign: "center" }}>
          <h2 style={{ color: "var(--color-danger, #ef4444)", margin: "0 0 8px" }}>Error Loading Payouts</h2>
          <p style={{ color: "var(--color-text-secondary, #64748b)", margin: 0 }}>{error?.message || "Could not retrieve payout records."}</p>
        </div>
      </div>
    );
  }

  const influencer = data?.influencer || {};
  const earnings = data?.earnings || {};
  const payouts = data?.payouts || [];
  const currency = earnings.currency || influencer.payoutCurrency || "USD";

  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(payouts.length / PAGE_SIZE) || 1;
  const paginatedPayouts = payouts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="influencer-dashboard-page">
      {/* Header */}
      <div className="influencer-dashboard-header">
        <div>
          <h1 className="influencer-dashboard-title">Payout History</h1>
          <p className="influencer-dashboard-subtitle">
            Complete record of payouts processed and transferred to your account.
          </p>
        </div>
        <div>
          <Badge variant="info" style={{ fontSize: "var(--text-sm)", padding: "6px 14px" }}>
            Payout Currency: {currency}
          </Badge>
        </div>
      </div>

      {/* Balance Summary KPI Cards */}
      <div className="influencer-kpi-grid">
        <div className="influencer-kpi-card">
          <span className="influencer-kpi-label">Paid Earnings</span>
          <span className="influencer-kpi-value" style={{ color: "var(--color-success)" }}>
            {formatCurrency(earnings.paidEarnings, currency)}
          </span>
          <span className="influencer-kpi-sub">Total disbursed to date</span>
        </div>
        <div className="influencer-kpi-card">
          <span className="influencer-kpi-label">Pending Payout Balance</span>
          <span className="influencer-kpi-value" style={{ color: "var(--color-warning)" }}>
            {formatCurrency(earnings.pendingEarnings, currency)}
          </span>
          <span className="influencer-kpi-sub">Available for next payout cycle</span>
        </div>
        <div className="influencer-kpi-card">
          <span className="influencer-kpi-label">Total Lifetime Earnings</span>
          <span className="influencer-kpi-value">
            {formatCurrency(earnings.totalEarnings, currency)}
          </span>
          <span className="influencer-kpi-sub">Combined paid & pending commissions</span>
        </div>
      </div>

      {/* Payouts Table Card */}
      <div className="influencers-table-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-3, 12px)", padding: "16px 20px 0" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
            Showing <strong>{payouts.length}</strong> payout records
          </span>
        </div>

        {payouts.length === 0 ? (
          <EmptyState
            title="No Payouts Processed Yet"
            description="When your accumulated commission is processed by the administrator, payout transaction details will appear here."
          />
        ) : (
          <Table aria-label="My payouts list">
            <thead>
              <tr>
                <Th>Payout ID</Th>
                <Th>Amount</Th>
                <Th>Currency</Th>
                <Th>Status</Th>
                <Th>Reference / Notes</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {paginatedPayouts.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <code style={{ fontSize: "var(--text-xs)" }}>
                      PAY-{p.id.slice(0, 8).toUpperCase()}
                    </code>
                  </Td>
                  <Td style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>
                    {formatCurrency(p.amount, p.currency || currency)}
                  </Td>
                  <Td>
                    <Badge variant="warning">{p.currency || currency}</Badge>
                  </Td>
                  <Td>
                    <Badge variant={PAYOUT_STATUS_VARIANT[p.status] || "default"}>
                      {p.status}
                    </Badge>
                  </Td>
                  <Td style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)" }}>
                    {p.reference || p.notes || "Standard Commission Settlement"}
                  </Td>
                  <Td style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)" }}>
                    {formatDate(p.paidAt || p.createdAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {payouts.length > PAGE_SIZE && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={payouts.length}
            limit={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
