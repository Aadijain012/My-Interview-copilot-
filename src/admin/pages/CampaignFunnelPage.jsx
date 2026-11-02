import { useState, useMemo } from "react";
import { usePermission } from "@/features/auth/rbac";
import { ErrorState, Select } from "@/components";
import { CampaignFunnelChart } from "@/features/campaigns";
import { useCampaigns, useCampaignFunnel } from "@/features/campaigns";
import { DateRangeFilter } from "@/features/dashboard/components/DateRangeFilter";
import { getPresetDateRange } from "@/features/dashboard/utils/dateRange";
import "./CampaignFunnelPage.css";

export function CampaignFunnelPage() {
  const canRead = usePermission("campaigns:read");
  const [preset, setPreset] = useState("30d");
  const dateRange = useMemo(() => getPresetDateRange(preset), [preset]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  const campaignsQuery = useCampaigns({ limit: 100 });
  const funnelQuery = useCampaignFunnel(
    selectedCampaignId,
    dateRange.from,
    dateRange.to,
  );

  if (!canRead)
    return (
      <ErrorState
        title="Access Restricted"
        message="You don't have permission to view campaign analytics."
      />
    );

  return (
    <div className="campaign-funnel-page">
      <div className="campaign-funnel-page__header">
        <div>
          <h1 className="campaign-funnel-page__title">Campaign Funnel</h1>
          <p className="campaign-funnel-page__subtitle">
            Analyze referral conversion funnel by campaign.
          </p>
        </div>
        <DateRangeFilter preset={preset} onChange={setPreset} />
      </div>

      <div className="campaign-funnel-page__selector">
        <Select
          value={selectedCampaignId}
          onChange={(e) => setSelectedCampaignId(e.target.value)}
          aria-label="Select campaign"
        >
          <option value="">Select a campaign</option>
          {(campaignsQuery.data?.campaigns ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {selectedCampaignId ? (
        funnelQuery.isError ? (
          <ErrorState
            message="Failed to load funnel data."
            onRetry={() => funnelQuery.refetch()}
          />
        ) : (
          <CampaignFunnelChart
            data={funnelQuery.data}
            isLoading={funnelQuery.isLoading}
          />
        )
      ) : (
        <div className="campaign-funnel-page__placeholder">
          <p>Select a campaign above to view its referral funnel.</p>
        </div>
      )}
    </div>
  );
}
