import { useState, useEffect, useMemo, useCallback } from "react";
import { Button, ConfirmModal, ErrorState, PageLoader } from "@/components";
import { useAuth } from "@/features/auth/useAuth";
import { usePermission } from "@/features/auth/rbac";
import {
  useManageableAdmins,
  useAdminPermissions,
  useUpdateAdminPermissions,
  useResetAdminPermissions,
} from "@/features/permissions/hooks/usePermissions";
import { AdminUserSelector } from "@/features/permissions/components/AdminUserSelector";
import { PermissionUserHeader } from "@/features/permissions/components/PermissionUserHeader";
import { PermissionMatrixTable } from "@/features/permissions/components/PermissionMatrixTable";
import "./PermissionsPage.css";

export function PermissionsPage() {
  const { admin: currentAdmin } = useAuth();
  const canRead = usePermission("permissions:read");
  const canWrite = usePermission("permissions:write");

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [overrides, setOverrides] = useState(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // 1. Fetch manageable admins list
  const {
    data: admins = [],
    isLoading: isAdminsLoading,
    isError: isAdminsError,
    refetch: refetchAdmins,
  } = useManageableAdmins();

  // Derive activeUserId without cascading setState in effect
  const activeUserId =
    selectedUserId ??
    (admins.find((a) => a.role !== "owner") || admins[0])?.id ??
    null;

  // 2. Fetch permissions for selected admin
  const {
    data: permData,
    isLoading: isPermLoading,
    isError: isPermError,
    refetch: refetchPerms,
  } = useAdminPermissions(activeUserId);

  // Derive local permissions set
  const serverPerms = useMemo(() => {
    return new Set(permData?.effectivePermissions || []);
  }, [permData]);

  const localPermissions = overrides ?? serverPerms;
  const hasChanges = overrides !== null;

  const diffCount = useMemo(() => {
    if (!overrides || !permData) return 0;
    let count = 0;
    for (const p of overrides) {
      if (!serverPerms.has(p)) count++;
    }
    for (const p of serverPerms) {
      if (!overrides.has(p)) count++;
    }
    return count;
  }, [overrides, serverPerms, permData]);

  // Warn on tab close with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  // Mutations
  const updateMutation = useUpdateAdminPermissions();
  const resetMutation = useResetAdminPermissions();

  const isOwnerUser = permData?.admin.role === "owner";
  const isSelf = currentAdmin?.id === activeUserId;
  const isReadOnly = !canWrite || isOwnerUser || isSelf;

  const handleTogglePermission = useCallback(
    (permission) => {
      if (isReadOnly) return;
      const next = new Set(localPermissions);
      if (next.has(permission)) {
        next.delete(permission);
      } else {
        next.add(permission);
      }
      setOverrides(next);
      setFeedback(null);
    },
    [isReadOnly, localPermissions],
  );

  const handleCancelChanges = () => {
    setOverrides(null);
    setFeedback(null);
  };

  const handleSave = async () => {
    if (!activeUserId || !hasChanges || isReadOnly) return;
    try {
      await updateMutation.mutateAsync({
        adminId: activeUserId,
        permissions: Array.from(localPermissions),
      });
      setOverrides(null);
      setFeedback({
        type: "success",
        message:
          "Permissions saved and enforced successfully. Audit log recorded.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to update permissions.",
      });
    }
  };

  const handleResetToDefault = async () => {
    if (!activeUserId || isReadOnly) return;
    try {
      await resetMutation.mutateAsync(activeUserId);
      setOverrides(null);
      setIsResetConfirmOpen(false);
      setFeedback({
        type: "success",
        message:
          "Permissions reset to role default policy. Audit log recorded.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to reset permissions.",
      });
    }
  };

  if (!canRead) {
    return (
      <div className="perm-page">
        <ErrorState
          title="Access Restricted"
          message="You do not have permission to view or manage administrator permissions. Contact the platform Owner for access."
        />
      </div>
    );
  }

  return (
    <div className="perm-page">
      <header className="perm-page__header">
        <h1 className="perm-page__title">Permissions Management</h1>
        <p className="perm-page__desc">
          Configure and enforce granular action permissions for each
          administrator on the platform.
        </p>
      </header>

      {isAdminsError ? (
        <ErrorState
          title="Failed to Load Administrators"
          message="Could not retrieve administrative users. Please verify backend connectivity and try again."
          onRetry={refetchAdmins}
        />
      ) : (
        <div className="perm-layout">
          {/* Left Admin Selector */}
          <AdminUserSelector
            users={admins}
            selectedUserId={activeUserId}
            onSelectUser={(id) => {
              if (hasChanges) {
                if (
                  !window.confirm(
                    "You have unsaved permission changes. Discard and switch user?",
                  )
                ) {
                  return;
                }
              }
              setSelectedUserId(id);
              setOverrides(null);
              setFeedback(null);
            }}
            isLoading={isAdminsLoading}
          />

          {/* Right Main Details Panel */}
          <main className="perm-detail">
            {isPermLoading ? (
              <PageLoader text="Loading permissions policy..." />
            ) : isPermError || !permData ? (
              <ErrorState
                title="Failed to Load Permissions"
                message="Could not retrieve permission matrix for the selected user."
                onRetry={refetchPerms}
              />
            ) : (
              <>
                {feedback && (
                  <div
                    className={`perm-alert perm-alert--${feedback.type}`}
                    role="alert"
                  >
                    <span>{feedback.message}</span>
                    <button
                      type="button"
                      onClick={() => setFeedback(null)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                      aria-label="Dismiss alert"
                    >
                      ×
                    </button>
                  </div>
                )}

                <PermissionUserHeader
                  data={permData}
                  isSelf={isSelf}
                  isOwnerUser={isOwnerUser}
                />

                <PermissionMatrixTable
                  sections={permData.sections}
                  selectedPermissions={localPermissions}
                  onTogglePermission={handleTogglePermission}
                  isReadOnly={isReadOnly}
                />

                <footer className="perm-footer-toolbar">
                  <div className="perm-footer-toolbar__status">
                    {hasChanges ? (
                      <span className="perm-footer-toolbar__status--dirty">
                        ● {diffCount} modification{diffCount === 1 ? "" : "s"}{" "}
                        pending save
                      </span>
                    ) : (
                      <span className="perm-footer-toolbar__status--clean">
                        ✓ All permissions in sync
                      </span>
                    )}
                  </div>

                  <div className="perm-footer-toolbar__buttons">
                    <Button
                      variant="danger"
                      onClick={() => setIsResetConfirmOpen(true)}
                      disabled={
                        isReadOnly ||
                        !permData.isCustom ||
                        resetMutation.isPending
                      }
                    >
                      Reset to Default
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={handleCancelChanges}
                      disabled={!hasChanges || updateMutation.isPending}
                    >
                      Cancel
                    </Button>

                    <Button
                      variant="primary"
                      onClick={handleSave}
                      disabled={
                        !hasChanges || isReadOnly || updateMutation.isPending
                      }
                      isLoading={updateMutation.isPending}
                    >
                      Save Permissions
                    </Button>
                  </div>
                </footer>
              </>
            )}
          </main>
        </div>
      )}

      {/* Confirm Reset Dialog */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleResetToDefault}
        title="Reset to Default Permissions?"
        description={`This will remove all custom permissions for ${permData?.admin.name || "this user"} and restore the default policy for the ${permData?.admin.role} role. This action will be audit logged.`}
        confirmLabel="Reset to Default"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={resetMutation.isPending}
      />
    </div>
  );
}
