import { useState } from "react";
import { Table, Th, Td, Pagination, Badge, Button, EmptyState, Modal, Field, Input, Select, Textarea } from "@/components";
import { formatDate } from "@/utils";
import { formatCurrency } from "@/utils/currency";
import {
  usePayouts,
  useCreatePayout,
  useUpdatePayoutStatus,
} from "../hooks/useInfluencerQueries";

const PAYOUT_STATUS_VARIANT = {
  PENDING: "warning",
  PROCESSING: "default",
  PAID: "success",
  FAILED: "danger",
  CANCELLED: "default",
};

const CURRENCY_OPTIONS = [
  { code: "USD", label: "USD ($) - US Dollar" },
  { code: "INR", label: "INR (₹) - Indian Rupee" },
  { code: "EUR", label: "EUR (€) - Euro" },
  { code: "GBP", label: "GBP (£) - British Pound" },
  { code: "CAD", label: "CAD ($) - Canadian Dollar" },
  { code: "AUD", label: "AUD ($) - Australian Dollar" },
  { code: "AED", label: "AED (د.إ) - UAE Dirham" },
  { code: "SGD", label: "SGD ($) - Singapore Dollar" },
];

export function PayoutsManagementSection({
  influencers = [],
  canManage,
}) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const { data, isLoading } = usePayouts({ page, limit: 10, status: statusFilter || undefined });
  const createPayoutMutation = useCreatePayout();
  const updateStatusMutation = useUpdatePayoutStatus();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState(null);

  const [createForm, setCreateForm] = useState({
    influencerId: "",
    amount: "",
    currency: "USD",
    notes: "",
  });
  const [updateForm, setUpdateForm] = useState({
    status: "PROCESSING",
    notes: "",
  });

  const [createErrors, setCreateErrors] = useState({});

  const payouts = data?.items || [];
  const pagination = data?.pagination;

  const handleOpenCreate = () => {
    const firstInf = influencers[0];
    const initialAmount = firstInf ? (firstInf.availablePayout ?? firstInf.pendingEarnings ?? 0) : "";
    setIsCreateOpen(true);
    setCreateErrors({});
    setCreateForm({
      influencerId: firstInf?.id || "",
      amount: initialAmount > 0 ? String(initialAmount) : "",
      currency: firstInf?.payoutCurrency || "USD",
      notes: "",
    });
  };

  const handleInfluencerSelect = (infId) => {
    const inf = influencers.find((i) => i.id === infId);
    const available = inf ? (inf.availablePayout ?? inf.pendingEarnings ?? 0) : 0;
    setCreateErrors({});
    setCreateForm((f) => ({
      ...f,
      influencerId: infId,
      currency: inf?.payoutCurrency || "USD",
      amount: available > 0 ? String(available) : "",
    }));
  };

  const selectedInfluencer = influencers.find((i) => i.id === createForm.influencerId);
  const availableUnpaid = selectedInfluencer
    ? (selectedInfluencer.availablePayout ?? selectedInfluencer.pendingEarnings ?? 0)
    : 0;

  const handleCreateSubmit = async (e) => {
    e?.preventDefault();
    setCreateErrors({});
    if (!createForm.influencerId) {
      setCreateErrors({ influencerId: "Please select an influencer" });
      return;
    }
    const amt = Number(createForm.amount);
    if (!amt || amt <= 0) {
      setCreateErrors({ amount: "Amount must be greater than 0" });
      return;
    }
    if (availableUnpaid > 0 && amt > availableUnpaid) {
      setCreateErrors({
        amount: `Amount cannot exceed available unpaid commission (${formatCurrency(availableUnpaid, createForm.currency)})`,
      });
      return;
    }

    try {
      await createPayoutMutation.mutateAsync({
        influencerId: createForm.influencerId,
        amount: amt,
        currency: createForm.currency || "USD",
        notes: createForm.notes.trim() || undefined,
      });
      setIsCreateOpen(false);
      setCreateErrors({});
    } catch (err) {
      setCreateErrors({ submit: err.message || "Failed to create payout" });
    }
  };

  const handleOpenUpdate = (payout) => {
    setSelectedPayout(payout);
    setUpdateForm({
      status: payout.status || "PROCESSING",
      notes: payout.notes || "",
    });
    setIsUpdateOpen(true);
  };

  const handleUpdateSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedPayout) return;

    try {
      await updateStatusMutation.mutateAsync({
        id: selectedPayout.id,
        status: updateForm.status,
        notes: updateForm.notes.trim() || undefined,
        data: {
          status: updateForm.status,
          notes: updateForm.notes.trim() || undefined,
        },
      });
      setIsUpdateOpen(false);
      setSelectedPayout(null);
    } catch (err) {
      alert(err.message || "Failed to update payout status");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--sp-3)" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 600 }}>Payout Management</h3>
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
            Disburse earnings to influencer affiliates in their configured currency. Status lifecycle: PENDING → PROCESSING → PAID / FAILED / CANCELLED.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{ width: "160px" }}
          >
            <option value="">All Payout Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="PAID">PAID</option>
            <option value="FAILED">FAILED</option>
            <option value="CANCELLED">CANCELLED</option>
          </Select>
          {canManage && (
            <Button variant="primary" size="sm" onClick={handleOpenCreate}>
              + Process Payout
            </Button>
          )}
        </div>
      </div>

      {/* Payouts Table */}
      <div className="influencers-table-card">
        {isLoading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--color-text-muted)" }}>
            Loading payouts ledger...
          </div>
        ) : payouts.length === 0 ? (
          <EmptyState
            title="No Payouts Recorded"
            description="Initiate affiliate payouts when influencers request withdrawals or satisfy threshold criteria."
          />
        ) : (
          <Table aria-label="Payouts history">
            <thead>
              <tr>
                <Th>Influencer</Th>
                <Th>Amount</Th>
                <Th>Currency</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th>Paid At</Th>
                <Th>Notes</Th>
                {canManage && <Th style={{ textAlign: "right" }}>Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => {
                const status = (p.status || "PENDING").toUpperCase();
                const variant = PAYOUT_STATUS_VARIANT[status] || "default";

                return (
                  <tr key={p.id}>
                    <Td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                          {p.influencer?.name || "Influencer Partner"}
                        </span>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                          {p.influencer?.email}
                        </span>
                      </div>
                    </Td>

                    <Td>
                      <strong style={{ color: "var(--color-text-primary)", fontSize: "var(--text-sm)" }}>
                        {formatCurrency(p.amount, p.currency)}
                      </strong>
                    </Td>

                    <Td>
                      <Badge variant="warning">{p.currency || "USD"}</Badge>
                    </Td>

                    <Td>
                      <Badge variant={variant}>{status}</Badge>
                    </Td>

                    <Td>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                        {formatDate(p.createdAt)}
                      </span>
                    </Td>

                    <Td>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                        {p.paidAt ? formatDate(p.paidAt) : "—"}
                      </span>
                    </Td>

                    <Td>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                        {p.notes || "—"}
                      </span>
                    </Td>

                    {canManage && (
                      <Td style={{ textAlign: "right" }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenUpdate(p)}
                        >
                          Update Status
                        </Button>
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {pagination && pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Create Payout Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Initiate Influencer Payout"
      >
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
            {createErrors.submit && (
              <div style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)", padding: "8px 12px", background: "var(--color-bg-subtle)", borderRadius: "4px" }}>
                {createErrors.submit}
              </div>
            )}

            <Field label="Influencer Partner" error={createErrors.influencerId} required>
              <Select
                value={createForm.influencerId}
                onChange={(e) => handleInfluencerSelect(e.target.value)}
                autoFocus
              >
                <option value="">-- Select Influencer --</option>
                {influencers.map((inf) => (
                  <option key={inf.id} value={inf.id}>
                    {inf.name} ({inf.referralCode}) — Available: {formatCurrency(inf.availablePayout ?? inf.pendingEarnings ?? 0, inf.payoutCurrency || "USD")}
                  </option>
                ))}
              </Select>
            </Field>

            {selectedInfluencer && (
              <div
                style={{
                  background: "var(--color-bg-subtle)",
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                  <span>Total Approved Commission:</span>
                  <strong>{formatCurrency(selectedInfluencer.totalCommissionEarned ?? selectedInfluencer.totalEarnings ?? 0, selectedInfluencer.payoutCurrency || "USD")}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                  <span>Already Paid:</span>
                  <span>{formatCurrency(selectedInfluencer.paidEarnings ?? 0, selectedInfluencer.payoutCurrency || "USD")}</span>
                </div>
                {Number(selectedInfluencer.processingEarnings) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--color-warning)" }}>
                    <span>In Progress (Pending/Processing):</span>
                    <span>{formatCurrency(selectedInfluencer.processingEarnings, selectedInfluencer.payoutCurrency || "USD")}</span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "var(--text-sm)",
                    fontWeight: 700,
                    color: "var(--color-brand)",
                    borderTop: "1px dashed var(--color-border)",
                    paddingTop: "6px",
                    marginTop: "2px",
                  }}
                >
                  <span>Max Available for Payout (Cap):</span>
                  <span>{formatCurrency(availableUnpaid, selectedInfluencer.payoutCurrency || "USD")}</span>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
              <Field
                label="Disbursement Amount"
                error={createErrors.amount}
                helpText={
                  availableUnpaid > 0
                    ? `Max allowable: ${formatCurrency(availableUnpaid, createForm.currency)}`
                    : "Influencer currently has no unpaid commission balance."
                }
                required
              >
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <Input
                    type="number"
                    min="0.01"
                    max={availableUnpaid > 0 ? availableUnpaid : undefined}
                    step="0.01"
                    placeholder="0.00"
                    value={createForm.amount}
                    onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                  />
                  {availableUnpaid > 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setCreateForm({ ...createForm, amount: String(availableUnpaid) })}
                      title="Set to max available unpaid balance"
                    >
                      Max
                    </Button>
                  )}
                </div>
              </Field>

              <Field label="Currency" helpText="Configured partner currency" required>
                <Select
                  value={createForm.currency}
                  onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Disbursement Notes / Transaction Ref">
              <Textarea
                placeholder="Bank transfer reference, PayPal batch ID, invoice number..."
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                rows={2}
              />
            </Field>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)", marginTop: "var(--sp-5)" }}>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} type="button">
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={
                !createForm.influencerId ||
                !createForm.amount ||
                Number(createForm.amount) <= 0 ||
                (availableUnpaid > 0 && Number(createForm.amount) > availableUnpaid)
              }
              isLoading={createPayoutMutation.isPending}
            >
              Create Payout
            </Button>
          </div>
        </form>
      </Modal>

      {/* Update Payout Status Modal */}
      <Modal
        isOpen={isUpdateOpen}
        onClose={() => setIsUpdateOpen(false)}
        title={`Update Payout: ${selectedPayout?.influencer?.name || ""}`}
      >
        <form onSubmit={handleUpdateSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
              Amount: <strong>{formatCurrency(selectedPayout?.amount, selectedPayout?.currency)}</strong>
            </p>

            <Field label="Payout Status" required>
              <Select
                value={updateForm.status}
                onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
              >
                <option value="PENDING">PENDING (Awaiting clearance)</option>
                <option value="PROCESSING">PROCESSING (In transit)</option>
                <option value="PAID">PAID (Disbursed to partner)</option>
                <option value="FAILED">FAILED (Transfer rejected)</option>
                <option value="CANCELLED">CANCELLED (Revoked)</option>
              </Select>
            </Field>

            <Field label="Status Notes">
              <Textarea
                placeholder="Confirmation details, reference number, or reason for failure..."
                value={updateForm.notes}
                onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
                rows={2}
              />
            </Field>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)", marginTop: "var(--sp-5)" }}>
            <Button variant="ghost" onClick={() => setIsUpdateOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={updateStatusMutation.isPending}>
              Update Payout Status
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
