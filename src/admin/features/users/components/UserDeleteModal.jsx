import { ConfirmModal } from "@/components";

export function UserDeleteModal({
  user,
  isOpen,
  isLoading,
  onClose,
  onConfirm,
}) {
  if (!user) return null;

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      title="Permanently Delete User"
      description={`Are you sure you want to delete ${user.email}? This action is irreversible. All of the user's interview sessions, transcripts, audio recordings, and notes will be permanently erased.`}
      confirmLabel="Permanently Delete"
      variant="danger"
    />
  );
}
