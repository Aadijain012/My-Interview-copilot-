import { useState } from "react";
import { Table, Th, Td, Badge, Button, EmptyState, Modal, Field, Input, Select, Textarea, Pagination } from "@/components";
import { formatDate, formatNumber } from "@/utils";
import {
  useInfluencerCampaigns,
  useCreateInfluencerCampaign,
  useUpdateInfluencerCampaign,
  useAssignInfluencerToCampaign,
} from "../hooks/useInfluencerQueries";

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

export function CampaignsManagementSection({
  influencers = [],
  canCreate,
  canUpdate,
}) {
  const { data: campaigns = [], isLoading } = useInfluencerCampaigns();
  const createCampaignMutation = useCreateInfluencerCampaign();
  const updateCampaignMutation = useUpdateInfluencerCampaign();
  const assignMutation = useAssignInfluencerToCampaign();

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(campaigns.length / PAGE_SIZE) || 1;
  const paginatedCampaigns = campaigns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    slug: "",
    description: "",
    currency: "USD",
    discountPercent: 10,
    rewardCredits: 0,
    status: "active",
  });
  const [assignForm, setAssignForm] = useState({
    influencerId: "",
    campaignId: "",
  });
  const [createErrors, setCreateErrors] = useState({});

  const handleCreateSubmit = async (e) => {
    e?.preventDefault();
    const errs = {};
    if (!createForm.name.trim()) errs.name = "Campaign name is required";
    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    try {
      await createCampaignMutation.mutateAsync({
        name: createForm.name.trim(),
        slug: createForm.slug.trim() || undefined,
        description: createForm.description.trim() || undefined,
        currency: createForm.currency || "USD",
        discountPercent: Number(createForm.discountPercent) || 0,
        rewardCredits: Number(createForm.rewardCredits) || 0,
        status: createForm.status || "active",
      });
      setIsCreateModalOpen(false);
      setCreateForm({
        name: "",
        slug: "",
        description: "",
        currency: "USD",
        discountPercent: 10,
        rewardCredits: 0,
        status: "active",
      });
      setCreateErrors({});
    } catch (err) {
      setCreateErrors({ submit: err.message || "Failed to create campaign" });
    }
  };

  const handleAssignSubmit = async (e) => {
    e?.preventDefault();
    if (!assignForm.influencerId || !assignForm.campaignId) return;

    try {
      await assignMutation.mutateAsync({
        influencerId: assignForm.influencerId,
        campaignId: assignForm.campaignId,
      });
      setIsAssignModalOpen(false);
      setAssignForm({ influencerId: "", campaignId: "" });
    } catch (err) {
      alert(err.message || "Failed to assign campaign");
    }
  };

  const handleStatusChange = async (campaignId, nextStatus) => {
    try {
      await updateCampaignMutation.mutateAsync({
        id: campaignId,
        data: { status: nextStatus },
      });
    } catch (err) {
      alert(err.message || "Failed to update campaign status");
    }
  };

  const handleEndCampaign = async (campaign) => {
    if (!window.confirm(`Are you sure you want to conclude / end campaign "${campaign.name}"?`)) return;
    try {
      await updateCampaignMutation.mutateAsync({
        id: campaign.id,
        data: { status: "ended", endsAt: new Date().toISOString() },
      });
    } catch (err) {
      alert(err.message || "Failed to end campaign");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      {/* Header with actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--sp-3)" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 600 }}>Campaign Management</h3>
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
            Configure affiliate promotions, dedicated marketing campaigns, and assign influencers.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          {canUpdate && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAssignModalOpen(true)}
            >
              Assign Influencer to Campaign
            </Button>
          )}
          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
            >
              + Create Campaign
            </Button>
          )}
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="influencers-table-card">
        {isLoading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--color-text-muted)" }}>
            Loading campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            title="No Campaigns Created"
            description="Create your first campaign to group influencers and customize attribution and currencies."
          />
        ) : (
          <Table aria-label="Campaigns list">
            <thead>
              <tr>
                <Th>Campaign Name</Th>
                <Th>Slug</Th>
                <Th>Currency</Th>
                <Th>Influencers Assigned</Th>
                <Th>Discount %</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                {canUpdate && <Th style={{ textAlign: "right" }}>Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {paginatedCampaigns.map((c) => {
                const currentStatus = (c.status || "active").toLowerCase();
                const isEnded = currentStatus === "ended";
                const isPendingMutation =
                  updateCampaignMutation.isPending &&
                  updateCampaignMutation.variables?.id === c.id;

                return (
                  <tr key={c.id}>
                    <Td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <strong style={{ color: "var(--color-brand)" }}>{c.name}</strong>
                        {c.description && (
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                            {c.description}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <code style={{ background: "var(--color-bg-subtle)", padding: "2px 6px", borderRadius: "4px" }}>
                        {c.slug}
                      </code>
                    </Td>
                    <Td>
                      <Badge variant="warning">{c.currency || "USD"}</Badge>
                    </Td>
                    <Td>
                      <strong>{formatNumber(c._count?.influencers || 0)}</strong>
                    </Td>
                    <Td>
                      {c.discountPercent ? `${c.discountPercent}%` : "None"}
                    </Td>
                    <Td>
                      <Badge
                        variant={
                          currentStatus === "active"
                            ? "success"
                            : currentStatus === "paused"
                            ? "warning"
                            : currentStatus === "ended"
                            ? "danger"
                            : "default"
                        }
                      >
                        {currentStatus.toUpperCase()}
                      </Badge>
                    </Td>
                    <Td>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                        {formatDate(c.createdAt)}
                      </span>
                    </Td>
                    {canUpdate && (
                      <Td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                          <Select
                            value={currentStatus}
                            onChange={(e) => handleStatusChange(c.id, e.target.value)}
                            disabled={isPendingMutation}
                            style={{ fontSize: "var(--text-xs)", padding: "4px 8px", width: "auto" }}
                          >
                            <option value="active">Active</option>
                            <option value="paused">Paused</option>
                            <option value="ended">Ended (Over)</option>
                            <option value="draft">Draft</option>
                          </Select>
                          {!isEnded ? (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleEndCampaign(c)}
                              isLoading={isPendingMutation}
                              title="End this campaign immediately"
                            >
                              End Campaign
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleStatusChange(c.id, "active")}
                              isLoading={isPendingMutation}
                              title="Reactivate this campaign"
                            >
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {campaigns.length > PAGE_SIZE && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={campaigns.length}
            limit={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Create Campaign Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Marketing Campaign"
      >
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
            {createErrors.submit && (
              <div style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>
                {createErrors.submit}
              </div>
            )}
            <Field label="Campaign Name" error={createErrors.name} required>
              <Input
                placeholder="e.g. Diwali Promotion 2026"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                autoFocus
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
              <Field label="Campaign Slug (Optional)">
                <Input
                  placeholder="diwali-promotion"
                  value={createForm.slug}
                  onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                />
              </Field>

              <Field label="Default Currency" required>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
              <Field label="Referred User Discount (%)">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={createForm.discountPercent}
                  onChange={(e) => setCreateForm({ ...createForm, discountPercent: e.target.value })}
                />
              </Field>

              <Field label="Status">
                <Select
                  value={createForm.status}
                  onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="paused">Paused</option>
                </Select>
              </Field>
            </div>

            <Field label="Description">
              <Textarea
                placeholder="Campaign goals, target influencer profile, duration..."
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                rows={2}
              />
            </Field>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)", marginTop: "var(--sp-5)" }}>
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={createCampaignMutation.isPending}>
              Create Campaign
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Influencer to Campaign Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Influencer to Campaign"
      >
        <form onSubmit={handleAssignSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
            <Field label="Select Influencer" required>
              <Select
                value={assignForm.influencerId}
                onChange={(e) => setAssignForm({ ...assignForm, influencerId: e.target.value })}
              >
                <option value="">-- Choose Influencer --</option>
                {influencers.map((inf) => (
                  <option key={inf.id} value={inf.id}>
                    {inf.name} ({inf.referralCode}) - Currently: {inf.campaign?.name || "General"}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Target Campaign" required>
              <Select
                value={assignForm.campaignId}
                onChange={(e) => setAssignForm({ ...assignForm, campaignId: e.target.value })}
              >
                <option value="">-- Choose Campaign --</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.currency || "USD"})
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)", marginTop: "var(--sp-5)" }}>
            <Button variant="ghost" onClick={() => setIsAssignModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!assignForm.influencerId || !assignForm.campaignId}
              isLoading={assignMutation.isPending}
            >
              Assign Campaign
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
