import { useState, useMemo } from "react";
import { usePermission } from "@/features/auth/rbac";
import { Badge, Button, Select } from "@/components";
import { useDebounce } from "@/hooks";
import {
  InfluencerKpis,
  InfluencersTable,
  CreateInfluencerModal,
  EditInfluencerModal,
  SuspendInfluencerModal,
  ConfigureCurrencyModal,
  CampaignsManagementSection,
  ReferralCodesSection,
  InfluencerReferralsTable,
  InfluencerConversionsTable,
  CommissionRulesTable,
  CommissionRuleModal,
  PayoutsManagementSection,
  useInfluencerOverview,
  useInfluencers,
  useCreateInfluencer,
  useUpdateInfluencer,
  useSuspendInfluencer,
  useReactivateInfluencer,
  useResendInfluencerWelcomeEmail,
  useConfigurePayoutCurrency,
  useInfluencerCampaigns,
  useInfluencerReferrals,
  useUpdateReferralStatus,
  useInfluencerConversions,
  useUpdateConversionStatus,
  useCommissionRules,
  useCreateCommissionRule,
  useUpdateCommissionRule,
  useDeleteCommissionRule,
} from "@/features/influencers";
import "./InfluencerManagementPage.css";

function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

const formatNumber = (value) => {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(numericValue);
};

const formatCurrency = (value, currency = "USD") => {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(numericValue);
};

export function InfluencerManagementPage({ defaultTab = "overview" }) {
  // ── Permissions ───────────────────────────────────────────────────────────
  const canViewInfluencers = usePermission("influencers:view");
  const canCreateInfluencer = usePermission("influencers:create");
  const canUpdateInfluencer = usePermission("influencers:update");
  const canSuspendInfluencer = usePermission("influencers:suspend");
  const canManageCurrency = usePermission("payout_currency:manage");

  const canViewCampaigns = usePermission("campaigns:view");
  const canCreateCampaign = usePermission("campaigns:create");
  const canUpdateCampaign = usePermission("campaigns:update");

  const canViewCodes = usePermission("referral_codes:view");
  const canCreateCode = usePermission("referral_codes:create");
  const canUpdateCode = usePermission("referral_codes:update");

  const canViewReferrals = usePermission("referrals:view");
  const canViewConversions = usePermission("conversions:view");

  const canViewRules = usePermission("commission_rules:view");
  const canCreateRule = usePermission("commission_rules:create");
  const canUpdateRule = usePermission("commission_rules:update");
  const canDeleteRule = usePermission("commission_rules:delete");

  const canViewPayouts = usePermission("payouts:view");
  const canManagePayouts = usePermission("payouts:manage");

  // ── Dynamic Tabs ──────────────────────────────────────────────────────────
  const tabs = useMemo(() => {
    const list = [];
    if (canViewInfluencers) {
      list.push({ id: "overview", label: "Overview & Analytics" });
      list.push({ id: "influencers", label: "All Influencers" });
    }
    if (canViewCampaigns) {
      list.push({ id: "campaigns", label: "Campaigns" });
    }
    if (canViewCodes) {
      list.push({ id: "codes", label: "Referral Codes" });
    }
    if (canViewReferrals) {
      list.push({ id: "referrals", label: "Referral Tracking" });
    }
    if (canViewConversions) {
      list.push({ id: "conversions", label: "Conversions & Financials" });
    }
    if (canViewRules) {
      list.push({ id: "rules", label: "Commission Rules & Tiers" });
    }
    if (canViewPayouts) {
      list.push({ id: "payouts", label: "Payout Management" });
    }
    return list;
  }, [
    canViewInfluencers,
    canViewCampaigns,
    canViewCodes,
    canViewReferrals,
    canViewConversions,
    canViewRules,
    canViewPayouts,
  ]);

  const [activeTab, setActiveTab] = useState(() => {
    return tabs.some((t) => t.id === defaultTab) ? defaultTab : (tabs[0]?.id || "overview");
  });

  // ── Search & Filter State ─────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [referralsPlatformFilter, setReferralsPlatformFilter] = useState("");
  const [conversionsPlatformFilter, setConversionsPlatformFilter] = useState("");
  const [page, setPage] = useState(1);

  // ── Queries & Mutations ───────────────────────────────────────────────────
  const { data: overviewData, isLoading: isOverviewLoading } = useInfluencerOverview({
    enabled: canViewInfluencers,
  });

  const { data: influencersData, isLoading: isInfluencersLoading } = useInfluencers(
    {
      page,
      limit: 10,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      platform: platformFilter || undefined,
    },
    { enabled: canViewInfluencers }
  );

  const { data: campaignsList = [] } = useInfluencerCampaigns({
    enabled: canViewCampaigns || canCreateInfluencer,
  });

  const { data: referralsData, isLoading: isReferralsLoading } = useInfluencerReferrals(
    { page, limit: 10, platform: referralsPlatformFilter || undefined },
    { enabled: canViewReferrals && activeTab === "referrals" }
  );

  const { data: conversionsData, isLoading: isConversionsLoading } = useInfluencerConversions(
    { page, limit: 10, platform: conversionsPlatformFilter || undefined },
    { enabled: canViewConversions && activeTab === "conversions" }
  );

  const { data: rulesList = [], isLoading: isRulesLoading } = useCommissionRules(
    { planId: "default" },
    { enabled: canViewRules && (activeTab === "rules" || activeTab === "overview") }
  );

  // Influencer actions
  const createInfluencerMutation = useCreateInfluencer();
  const updateInfluencerMutation = useUpdateInfluencer();
  const suspendInfluencerMutation = useSuspendInfluencer();
  const reactivateInfluencerMutation = useReactivateInfluencer();
  const resendWelcomeEmailMutation = useResendInfluencerWelcomeEmail();
  const [resendingEmailId, setResendingEmailId] = useState(null);
  const [emailNotice, setEmailNotice] = useState(null);
  const configureCurrencyMutation = useConfigurePayoutCurrency();

  // Status updates
  const updateReferralStatusMutation = useUpdateReferralStatus();
  const updateConversionStatusMutation = useUpdateConversionStatus();

  // Rules actions
  const createRuleMutation = useCreateCommissionRule();
  const updateRuleMutation = useUpdateCommissionRule();
  const deleteRuleMutation = useDeleteCommissionRule();

  // ── Modals State ──────────────────────────────────────────────────────────
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingInfluencer, setEditingInfluencer] = useState(null);
  const [suspendingInfluencer, setSuspendingInfluencer] = useState(null);
  const [currencyInfluencer, setCurrencyInfluencer] = useState(null);
  const [conflictError, setConflictError] = useState(null);

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleServerError, setRuleServerError] = useState(null);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreateInfluencer = async (payload) => {
    try {
      setConflictError(null);
      await createInfluencerMutation.mutateAsync(payload);
      setIsCreateModalOpen(false);
    } catch (err) {
      setConflictError(err.message || "Failed to create influencer");
    }
  };

  const handleUpdateInfluencer = async (payload) => {
    if (!editingInfluencer) return;
    try {
      await updateInfluencerMutation.mutateAsync({
        id: editingInfluencer.id,
        data: payload,
      });
      setEditingInfluencer(null);
    } catch (err) {
      alert(err.message || "Failed to update influencer");
    }
  };

  const handleConfirmSuspend = async (reason) => {
    if (!suspendingInfluencer) return;
    try {
      await suspendInfluencerMutation.mutateAsync({
        id: suspendingInfluencer.id,
        reason,
      });
      setSuspendingInfluencer(null);
    } catch (err) {
      alert(err.message || "Failed to suspend influencer");
    }
  };

  const handleResendWelcomeEmail = async (influencer) => {
    if (!influencer?.id) return;
    const ok = window.confirm(
      `Do you want to resend the welcome email and portal credentials to "${influencer.name}" (${influencer.email})?`
    );
    if (!ok) return;

    try {
      setResendingEmailId(influencer.id);
      setEmailNotice(null);
      const res = await resendWelcomeEmailMutation.mutateAsync(influencer.id);
      const provider = res?.emailStatus?.provider || "Email Service";
      setEmailNotice({
        type: "success",
        message: `Welcome & credentials email sent successfully to ${influencer.email} (via ${provider}).`,
      });
      setTimeout(() => setEmailNotice(null), 7000);
    } catch (err) {
      setEmailNotice({
        type: "error",
        message: err.message || "Failed to resend welcome email. Please verify mail settings.",
      });
    } finally {
      setResendingEmailId(null);
    }
  };

  const handleReactivate = async (id) => {
    try {
      await reactivateInfluencerMutation.mutateAsync(id);
    } catch (err) {
      alert(err.message || "Failed to reactivate influencer");
    }
  };

  const handleUpdateCurrency = async (newCurrency) => {
    if (!currencyInfluencer) return;
    try {
      await configureCurrencyMutation.mutateAsync({
        id: currencyInfluencer.id,
        currency: newCurrency,
      });
      setCurrencyInfluencer(null);
    } catch (err) {
      alert(err.message || "Failed to update payout currency");
    }
  };

  const handleSaveRule = async (ruleData) => {
    try {
      setRuleServerError(null);
      if (editingRule) {
        await updateRuleMutation.mutateAsync({
          id: editingRule.id,
          data: ruleData,
        });
      } else {
        await createRuleMutation.mutateAsync(ruleData);
      }
      setIsRuleModalOpen(false);
      setEditingRule(null);
    } catch (err) {
      setRuleServerError(err.message || "Failed to save commission tier rule");
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm("Are you sure you want to delete this commission tier rule?")) return;
    try {
      await deleteRuleMutation.mutateAsync(id);
    } catch (err) {
      alert(err.message || "Failed to delete tier rule");
    }
  };

  const allInfluencersList = influencersData?.items || [];

  return (
    <div className="influencer-mgmt-page">
      {/* Header */}
      <div className="influencer-mgmt-header">
        <div>
          <h1 className="influencer-mgmt-title">Influencer Management</h1>
          <p className="influencer-mgmt-subtitle">
            Administer affiliate networks, custom promo codes, conversion attribution, dynamic tier rules, and payouts.
          </p>
        </div>
        {canCreateInfluencer && (
          <Button
            variant="primary"
            onClick={() => {
              setConflictError(null);
              setIsCreateModalOpen(true);
            }}
          >
            + Add Influencer
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="influencer-mgmt-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`influencer-mgmt-tab-btn ${activeTab === tab.id ? "influencer-mgmt-tab-btn--active" : ""}`}
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview & Analytics */}
      {emailNotice && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            marginBottom: "var(--sp-4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: emailNotice.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${emailNotice.type === "success" ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
            color: emailNotice.type === "success" ? "#10b981" : "#ef4444",
            fontSize: "var(--text-sm)",
            fontWeight: 500,
          }}
        >
          <span>{emailNotice.type === "success" ? "✉️ " : "⚠️ "} {emailNotice.message}</span>
          <button
            type="button"
            onClick={() => setEmailNotice(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {activeTab === "overview" && (
        <div>
          <InfluencerKpis
            data={overviewData}
            isLoading={isOverviewLoading}
          />

          {/* Marketing Channels & Platform Breakdown */}
          {overviewData?.platformBreakdown && overviewData.platformBreakdown.length > 0 && (
            <div
              style={{
                marginTop: "var(--sp-4, 16px)",
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "var(--radius-lg, 12px)",
                padding: "var(--sp-4, 16px)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-3, 12px)" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 600 }}>
                    Marketing Channels & Platform Breakdown
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                    Traffic, attributed registrations, converted subscribers, and commission yield separated by channel
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "var(--sp-3, 12px)",
                }}
              >
                {overviewData.platformBreakdown.map((item) => (
                  <div
                    key={item.platform}
                    style={{
                      background: "var(--color-bg-subtle, rgba(255,255,255,0.03))",
                      border: "1px solid var(--color-border-subtle)",
                      borderRadius: "var(--radius-md, 8px)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, fontSize: "var(--text-sm)", textTransform: "capitalize" }}>
                        {item.label || item.platform}
                      </span>
                      <Badge variant="default" style={{ fontSize: "11px" }}>
                        {item.conversionRate}% Conv.
                      </Badge>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "4px" }}>
                      <div>
                        <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", display: "block" }}>Referrals</span>
                        <strong style={{ fontSize: "var(--text-sm)" }}>{formatNumber(item.referralsCount)}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", display: "block" }}>Conversions</span>
                        <strong style={{ fontSize: "var(--text-sm)", color: "var(--color-brand)" }}>{formatNumber(item.conversionsCount)}</strong>
                      </div>
                    </div>

                    <div style={{ marginTop: "4px", paddingTop: "6px", borderTop: "1px solid var(--color-border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>Commission</span>
                      <strong style={{ fontSize: "var(--text-xs)", color: "var(--color-success)" }}>
                        {formatCurrency(item.commissionEarned, "USD")}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: "var(--sp-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-3)" }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 600 }}>Active Influencer Affiliates</h3>
              <Button variant="ghost" size="sm" onClick={() => { setActiveTab("influencers"); setPage(1); }}>
                View All →
              </Button>
            </div>
            <InfluencersTable
              influencers={allInfluencersList.slice(0, 5)}
              isLoading={isInfluencersLoading}
              onEdit={setEditingInfluencer}
              onSuspend={setSuspendingInfluencer}
              onReactivate={handleReactivate}
              onConfigureCurrency={setCurrencyInfluencer}
              onResendEmail={canUpdateInfluencer ? handleResendWelcomeEmail : null}
              resendingId={resendingEmailId}
              canUpdate={canUpdateInfluencer}
              canSuspend={canSuspendInfluencer}
              canManageCurrency={canManageCurrency}
            />
          </div>
        </div>
      )}

      {/* Tab: All Influencers */}
      {activeTab === "influencers" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <div className="influencer-mgmt-toolbar">
            <div className="influencer-mgmt-search-box">
              <IconSearch />
              <input
                type="text"
                placeholder="Search by name, email, or promo code..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--sp-2)" }}>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                style={{ width: "140px" }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </Select>
              <Select
                value={platformFilter}
                onChange={(e) => {
                  setPlatformFilter(e.target.value);
                  setPage(1);
                }}
                style={{ width: "140px" }}
              >
                <option value="">All Platforms</option>
                <option value="youtube">YouTube</option>
                <option value="twitter">Twitter / X</option>
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
                <option value="podcast">Podcast</option>
              </Select>
            </div>
          </div>

          <InfluencersTable
            influencers={allInfluencersList}
            pagination={influencersData?.pagination}
            isLoading={isInfluencersLoading}
            onPageChange={setPage}
            onEdit={setEditingInfluencer}
            onSuspend={setSuspendingInfluencer}
            onReactivate={handleReactivate}
            onConfigureCurrency={setCurrencyInfluencer}
            onResendEmail={canUpdateInfluencer ? handleResendWelcomeEmail : null}
            resendingId={resendingEmailId}
            canUpdate={canUpdateInfluencer}
            canSuspend={canSuspendInfluencer}
            canManageCurrency={canManageCurrency}
          />
        </div>
      )}

      {/* Tab: Campaigns */}
      {activeTab === "campaigns" && (
        <CampaignsManagementSection
          influencers={allInfluencersList}
          canCreate={canCreateCampaign}
          canUpdate={canUpdateCampaign}
        />
      )}

      {/* Tab: Referral Codes */}
      {activeTab === "codes" && (
        <ReferralCodesSection
          influencers={allInfluencersList}
          campaigns={campaignsList}
          canCreate={canCreateCode}
          canUpdate={canUpdateCode}
        />
      )}

      {/* Tab: Referral Tracking */}
      {activeTab === "referrals" && (
        <InfluencerReferralsTable
          referrals={referralsData?.items || []}
          pagination={referralsData?.pagination}
          isLoading={isReferralsLoading}
          platformFilter={referralsPlatformFilter}
          onPlatformFilterChange={(val) => {
            setReferralsPlatformFilter(val);
            setPage(1);
          }}
          onPageChange={setPage}
          onUpdateStatus={(id, status) => updateReferralStatusMutation.mutate({ id, data: { status } })}
          canUpdate={canUpdateInfluencer}
        />
      )}

      {/* Tab: Conversion Tracking */}
      {activeTab === "conversions" && (
        <InfluencerConversionsTable
          conversions={conversionsData?.items || []}
          pagination={conversionsData?.pagination}
          isLoading={isConversionsLoading}
          platformFilter={conversionsPlatformFilter}
          onPlatformFilterChange={(val) => {
            setConversionsPlatformFilter(val);
            setPage(1);
          }}
          onPageChange={setPage}
          onUpdateStatus={(id, status) => updateConversionStatusMutation.mutate({ id, data: { status } })}
          canUpdate={canUpdateInfluencer}
        />
      )}

      {/* Tab: Commission Tier Rules */}
      {activeTab === "rules" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 600 }}>Commission Tier Matrix</h3>
              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                Configurable conversion ranges and percentage rates. Calculation is executed on the backend with immutable financial snapshots.
              </p>
            </div>
            {canCreateRule && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingRule(null);
                  setRuleServerError(null);
                  setIsRuleModalOpen(true);
                }}
              >
                + Add Tier Rule
              </Button>
            )}
          </div>
          <CommissionRulesTable
            rules={rulesList}
            isLoading={isRulesLoading}
            onEdit={(r) => {
              setEditingRule(r);
              setRuleServerError(null);
              setIsRuleModalOpen(true);
            }}
            onDelete={handleDeleteRule}
            canUpdate={canUpdateRule}
            canDelete={canDeleteRule}
          />
        </div>
      )}

      {/* Tab: Payout Management */}
      {activeTab === "payouts" && (
        <PayoutsManagementSection
          influencers={allInfluencersList}
          canManage={canManagePayouts}
        />
      )}

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateInfluencerModal
          isOpen={isCreateModalOpen}
          isLoading={createInfluencerMutation.isPending}
          campaigns={campaignsList}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateInfluencer}
          conflictError={conflictError}
        />
      )}

      {editingInfluencer && (
        <EditInfluencerModal
          isOpen={Boolean(editingInfluencer)}
          isLoading={updateInfluencerMutation.isPending}
          influencer={editingInfluencer}
          campaigns={campaignsList}
          onClose={() => setEditingInfluencer(null)}
          onSubmit={handleUpdateInfluencer}
          onResendEmail={canUpdateInfluencer ? handleResendWelcomeEmail : null}
          isResendingEmail={resendingEmailId === editingInfluencer?.id}
        />
      )}

      {suspendingInfluencer && (
        <SuspendInfluencerModal
          isOpen={Boolean(suspendingInfluencer)}
          isLoading={suspendInfluencerMutation.isPending}
          influencer={suspendingInfluencer}
          onClose={() => setSuspendingInfluencer(null)}
          onConfirm={handleConfirmSuspend}
        />
      )}

      {currencyInfluencer && (
        <ConfigureCurrencyModal
          isOpen={Boolean(currencyInfluencer)}
          isLoading={configureCurrencyMutation.isPending}
          influencer={currencyInfluencer}
          onClose={() => setCurrencyInfluencer(null)}
          onSubmit={handleUpdateCurrency}
        />
      )}

      {isRuleModalOpen && (
        <CommissionRuleModal
          isOpen={isRuleModalOpen}
          isLoading={createRuleMutation.isPending || updateRuleMutation.isPending}
          rule={editingRule}
          onClose={() => {
            setIsRuleModalOpen(false);
            setEditingRule(null);
          }}
          onSubmit={handleSaveRule}
          serverError={ruleServerError}
        />
      )}
    </div>
  );
}
