import { ConfirmModal } from "@/components";

export function AdminDeleteModal({
  admin,
  isOpen,
  isLoading,
  onClose,
  onConfirm,
}) {
  if (!admin) return null;

  const isOwner = admin.role === "owner";

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      title="Permanently Delete Admin User"
      description={
        isOwner
          ? `Are you sure you want to permanently delete OWNER account ${admin.email}? Note: The backend protects the system by rejecting deletion if this is the last active owner account.`
          : `Are you sure you want to permanently delete ${admin.email}? This action is irreversible and revokes all administrative privileges immediately.`
      }
      confirmLabel="Permanently Delete"
      variant="danger"
    />
  );
}
