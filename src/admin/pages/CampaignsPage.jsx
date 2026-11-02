import { useState } from "react";
import { usePermission } from "@/features/auth/rbac";
import { ErrorState, EmptyState, Button } from "@/components";
import {
  CampaignsTable,
  CreateCampaignModal,
  EditCampaignModal,
} from "@/features/campaigns";
import {
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
} from "@/features/campaigns";
import { useDebounce } from "@/hooks";
import { Input, Select } from "@/components";
import "./CampaignsPage.css";

function IconSearch() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function CampaignsPage() {
  const canRead = usePermission("campaigns:read");
  const canWrite = usePermission("campaigns:write");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [editCampaign, setEditCampaign] = useState(null);

  const campaignsQuery = useCampaigns({
    page,
    limit: 10,
    status: statusFilter || undefined,
    search: debouncedSearch,
  });
  const createMutation = useCreateCampaign();
  const updateMutation = useUpdateCampaign();

  if (!canRead)
    return (
      <ErrorState
        title="Access Restricted"
        message="You don't have permission to view campaigns."
      />
    );

  return (
    <div className="campaigns-page">
      <div className="campaigns-page__header">
        <div>
          <h1 className="campaigns-page__title">Campaigns</h1>
          <p className="campaigns-page__subtitle">
            Manage referral campaigns and track performance.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setShowCreate(true)}>+ Create Campaign</Button>
        )}
      </div>

      <div className="campaigns-page__toolbar">
        <Input
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          leftIcon={<IconSearch />}
        />
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="ended">Ended</option>
        </Select>
      </div>

      {campaignsQuery.isError ? (
        <ErrorState
          message="Failed to load campaigns."
          onRetry={() => campaignsQuery.refetch()}
        />
      ) : campaignsQuery.data?.campaigns?.length === 0 &&
        !campaignsQuery.isLoading ? (
        <EmptyState
          title="No campaigns found"
          description="Create a campaign to get started."
        />
      ) : (
        <CampaignsTable
          campaigns={campaignsQuery.data?.campaigns ?? []}
          pagination={
            campaignsQuery.data?.pagination ?? {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 1,
            }
          }
          isLoading={campaignsQuery.isLoading}
          onPageChange={setPage}
          onView={setEditCampaign}
          onEdit={setEditCampaign}
          canWrite={canWrite}
        />
      )}

      <CreateCampaignModal
        isOpen={showCreate}
        isLoading={createMutation.isPending}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) =>
          createMutation.mutate(data, { onSuccess: () => setShowCreate(false) })
        }
      />

      <EditCampaignModal
        campaign={editCampaign}
        isOpen={!!editCampaign}
        isLoading={updateMutation.isPending}
        onClose={() => setEditCampaign(null)}
        onSubmit={(data) => {
          if (editCampaign)
            updateMutation.mutate(
              { id: editCampaign.id, data },
              { onSuccess: () => setEditCampaign(null) },
            );
        }}
      />
    </div>
  );
}
