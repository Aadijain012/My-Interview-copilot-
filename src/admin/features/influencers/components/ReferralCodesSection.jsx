import { useState } from "react";
import { Table, Th, Td, Badge, Button, EmptyState, Modal, Field, Input, Select, Pagination } from "@/components";
import { formatDate, formatNumber } from "@/utils";
import {
  useReferralCodes,
  useCreateReferralCode,
  useUpdateReferralCode,
} from "../hooks/useInfluencerQueries";

export function ReferralCodesSection({
  influencers = [],
  campaigns = [],
  canCreate,
  canUpdate,
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useReferralCodes({ page, limit: 10 });
  const createCodeMutation = useCreateReferralCode();
  const updateCodeMutation = useUpdateReferralCode();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [form, setForm] = useState({
    code: "",
    campaignId: "",
    influencerId: "",
    refereeCredits: 100,
    discountPercent: 10,
    maxUses: "",
    isActive: true,
  });
  const [errors, setErrors] = useState({});

  const codes = data?.items || [];
  const pagination = data?.pagination;

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleToggleActive = async (codeItem) => {
    try {
      const isCurrentlyActive = codeItem.isActive === true || codeItem.status === "active";
      const nextActive = !isCurrentlyActive;
      const nextStatus = nextActive ? "active" : "inactive";
      await updateCodeMutation.mutateAsync({
        id: codeItem.id,
        status: nextStatus,
        data: {
          isActive: nextActive,
          status: nextStatus,
        },
      });
    } catch (err) {
      alert(err.message || "Failed to update code status");
    }
  };

  const handleCreateSubmit = async (e) => {
    e?.preventDefault();
    const errs = {};
    if (!form.code.trim()) {
      errs.code = "Code is required";
    } else if (form.code.trim().length < 3 || form.code.trim().length > 20) {
      errs.code = "Code must be between 3 and 20 characters";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    try {
      await createCodeMutation.mutateAsync({
        code: form.code.trim().toUpperCase(),
        campaignId: form.campaignId || null,
        influencerId: form.influencerId || null,
        refereeCredits: form.refereeCredits !== "" && !isNaN(Number(form.refereeCredits)) ? Math.max(0, parseInt(form.refereeCredits, 10)) : 100,
        discountPercent: Number(form.discountPercent) || 0,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        isActive: Boolean(form.isActive),
      });
      setIsCreateModalOpen(false);
      setForm({
        code: "",
        campaignId: "",
        influencerId: "",
        refereeCredits: 100,
        discountPercent: 10,
        maxUses: "",
        isActive: true,
      });
      setErrors({});
    } catch (err) {
      setErrors({ submit: err.message || "Failed to create referral code" });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--sp-3)" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 600 }}>Referral Code Management</h3>
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
            Referral promo codes are strictly provisioned and controlled by Owner/Admin. Influencers have view & copy-only access.
          </p>
        </div>
        {canCreate && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
          >
            + Create Referral Code
          </Button>
        )}
      </div>

      <div className="influencers-table-card">
        {isLoading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--color-text-muted)" }}>
            Loading referral codes...
          </div>
        ) : codes.length === 0 ? (
          <EmptyState
            title="No Referral Codes Created"
            description="Create referral codes and assign them to influencers or campaigns to track user registration attribution."
          />
        ) : (
          <Table aria-label="Referral codes list">
            <thead>
              <tr>
                <Th>Promo Code</Th>
                <Th>Assigned Influencer</Th>
                <Th>Campaign</Th>
                <Th>Referee Credits</Th>
                <Th>Uses Count</Th>
                <Th>Max Uses</Th>
                <Th>Discount</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                {canUpdate && <Th style={{ textAlign: "right" }}>Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const isCopied = copiedCode === c.code;
                return (
                  <tr key={c.id}>
                    <Td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <code style={{ background: "var(--color-bg-subtle)", padding: "2px 8px", borderRadius: "4px", fontWeight: 700, color: "var(--color-brand)" }}>
                          {c.code}
                        </code>
                        <button
                          type="button"
                          className={`influencer-copy-btn ${isCopied ? "influencer-copy-btn--copied" : ""}`}
                          onClick={() => handleCopy(c.code)}
                          title="Copy promo code"
                        >
                          {isCopied ? "✓" : "📋"}
                        </button>
                      </div>
                    </Td>
                    <Td>
                      {c.influencer ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{c.influencer.name}</span>
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>{c.influencer.email}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Unassigned</span>
                      )}
                    </Td>
                    <Td>
                      {c.campaign || c.Campaign ? (
                        <Badge variant="default">{(c.campaign || c.Campaign).name}</Badge>
                      ) : (
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>None</span>
                      )}
                    </Td>
                    <Td>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-brand, #3b82f6)", fontWeight: 600 }}>
                        🎁 {c.refereeCredits != null ? c.refereeCredits : 100} credits
                      </span>
                    </Td>
                    <Td>
                      <strong>{formatNumber(c.usesCount ?? c.redemptionCount ?? 0)}</strong>
                    </Td>
                    <Td>
                      {(c.maxUses ?? c.maxRedemptions) ? formatNumber(c.maxUses ?? c.maxRedemptions) : "Unlimited"}
                    </Td>
                    <Td>
                      {c.discountPercent ? `${c.discountPercent}%` : "—"}
                    </Td>
                    <Td>
                      {(() => {
                        const isCodeActive = c.isActive === true || c.status === "active";
                        return (
                          <Badge variant={isCodeActive ? "success" : "danger"}>
                            {isCodeActive ? "ACTIVE" : "INACTIVE"}
                          </Badge>
                        );
                      })()}
                    </Td>
                    <Td>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                        {formatDate(c.createdAt)}
                      </span>
                    </Td>
                    {canUpdate && (
                      <Td style={{ textAlign: "right" }}>
                        {(() => {
                          const isCodeActive = c.isActive === true || c.status === "active";
                          return (
                            <Button
                              variant={isCodeActive ? "danger" : "secondary"}
                              size="sm"
                              onClick={() => handleToggleActive(c)}
                              isLoading={updateCodeMutation.isPending && updateCodeMutation.variables?.id === c.id}
                            >
                              {isCodeActive ? "Deactivate" : "Activate"}
                            </Button>
                          );
                        })()}
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

      {/* Create Referral Code Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create & Assign Referral Code"
      >
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
            {errors.submit && (
              <div style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>
                {errors.submit}
              </div>
            )}
            <Field
              label="Promo Code"
              error={errors.code}
              helpText="Uppercase alphanumeric (e.g. SUMMER25, BRAND2026)"
              required
            >
              <Input
                placeholder="SUMMER25"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })}
                style={{ textTransform: "uppercase", fontFamily: "var(--font-mono)", fontWeight: 600 }}
                autoFocus
              />
            </Field>

            <Field label="Assign to Influencer Partner">
              <Select
                value={form.influencerId}
                onChange={(e) => setForm({ ...form, influencerId: e.target.value })}
              >
                <option value="">-- No Direct Influencer Assignment --</option>
                {influencers.map((inf) => (
                  <option key={inf.id} value={inf.id}>
                    {inf.name} ({inf.email})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Assign to Campaign">
              <Select
                value={form.campaignId}
                onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
              >
                <option value="">-- No Campaign --</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.currency || "USD"})
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Referee Signup Bonus Credits"
              helpText="Dynamic credits awarded to new users who register using this code (configured by Owner)"
            >
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="100"
                value={form.refereeCredits}
                onChange={(e) => setForm({ ...form, refereeCredits: e.target.value })}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
              <Field label="Referred User Discount (%)">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                />
              </Field>

              <Field label="Max Uses (Optional)" helpText="Blank for unlimited">
                <Input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)", marginTop: "var(--sp-5)" }}>
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={createCodeMutation.isPending}>
              Create Code
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
