import { useState } from "react";
import { usePermission } from "@/features/auth/rbac";
import { ErrorState, EmptyState, Button, Select } from "@/components";
import { MilestonesTable, CreateMilestoneModal } from "@/features/milestones";
import { useMilestones, useCreateMilestone } from "@/features/milestones";
import { useCampaigns } from "@/features/campaigns";
import "./MilestonesPage.css";

export function MilestonesPage() {
  const canRead = usePermission("milestones:read");
  const canWrite = usePermission("milestones:write");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const milestonesQuery = useMilestones(campaignFilter || undefined);
  const campaignsQuery = useCampaigns({ limit: 100 });
  const createMutation = useCreateMilestone();

  const allMilestones = milestonesQuery.data?.milestones ?? [];
  const total = allMilestones.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginatedMilestones = allMilestones.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  if (!canRead)
    return (
      <ErrorState
        title="Access Restricted"
        message="You don't have permission to view milestones."
      />
    );

  return (
    <div className="milestones-page">
      <div className="milestones-page__header">
        <div>
          <h1 className="milestones-page__title">Milestone Ladder</h1>
          <p className="milestones-page__subtitle">
            Configure referral milestones and bonus rewards.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setShowCreate(true)}>+ Add Milestone</Button>
        )}
      </div>

      <div className="milestones-page__filter">
        <Select
          value={campaignFilter}
          onChange={(e) => {
            setCampaignFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by campaign"
        >
          <option value="">All Campaigns</option>
          {(campaignsQuery.data?.campaigns ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {milestonesQuery.isError ? (
        <ErrorState
          message="Failed to load milestones."
          onRetry={() => milestonesQuery.refetch()}
        />
      ) : allMilestones.length === 0 && !milestonesQuery.isLoading ? (
        <EmptyState
          title="No milestones"
          description="Create a milestone to set up bonus rewards."
        />
      ) : (
        <MilestonesTable
          milestones={paginatedMilestones}
          isLoading={milestonesQuery.isLoading}
          canWrite={canWrite}
          pagination={{ page, totalPages, total, limit: pageSize }}
          onPageChange={setPage}
        />
      )}

      <CreateMilestoneModal
        campaigns={campaignsQuery.data?.campaigns ?? []}
        isOpen={showCreate}
        isLoading={createMutation.isPending}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) =>
          createMutation.mutate(data, { onSuccess: () => setShowCreate(false) })
        }
      />
    </div>
  );
}
