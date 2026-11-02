import { ConfirmModal } from "@/components";

export function UserSuspendModal({
  user,
  isOpen,
  isLoading,
  onClose,
  onConfirm,
}) {
  if (!user) return null;

  const isSuspending = user.status === "active";

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      title={isSuspending ? "Suspend User Account" : "Reactivate User Account"}
      description={
        isSuspending
          ? `Are you sure you want to suspend ${user.email}? The user will be immediately logged out and unable to access their interviews.`
          : `Are you sure you want to reactivate ${user.email}? Their full platform access and account privileges will be restored immediately.`
      }
      confirmLabel={isSuspending ? "Suspend User" : "Reactivate User"}
      variant={isSuspending ? "warning" : "warning"}
    />
  );
}
