import { ConfirmModal } from "@/components";

export function AdminSuspendModal({
  admin,
  isOpen,
  isLoading,
  onClose,
  onConfirm,
}) {
  if (!admin) return null;

  const isSuspending = admin.status === "active";

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      title={isSuspending ? "Suspend Admin User" : "Reactivate Admin User"}
      description={
        isSuspending
          ? `Are you sure you want to suspend ${admin.email}? All active refresh tokens will be revoked immediately and they will be barred from administrative access.`
          : `Are you sure you want to reactivate ${admin.email}? Their account status will be restored to active.`
      }
      confirmLabel={isSuspending ? "Suspend Admin" : "Reactivate Admin"}
      variant={isSuspending ? "warning" : "warning"}
    />
  );
}
