import { useState } from "react";
import { Modal, Button, Field, Textarea } from "@/components";

export function RejectReferralModal({
  referral,
  isOpen,
  isLoading,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError("Rejection reason is required.");
      return;
    }
    setError("");
    onConfirm(reason.trim());
  };

  const handleClose = () => {
    setReason("");
    setError("");
    onClose();
  };

  if (!referral) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Reject Referral"
      size="md"
    >
      <p
        style={{
          marginBottom: "var(--sp-4)",
          color: "var(--color-text-secondary)",
          fontSize: "var(--text-sm)",
        }}
      >
        Rejecting referral from{" "}
        <strong>{referral.referrer.name || referral.referrer.email}</strong> for{" "}
        <strong>{referral.referee.name || referral.referee.email}</strong>.
      </p>
      <Field label="Rejection Reason" required error={error}>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this referral is being rejected..."
          rows={3}
          hasError={!!error}
        />
      </Field>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--sp-3)",
          marginTop: "var(--sp-4)",
        }}
      >
        <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleSubmit} isLoading={isLoading}>
          Reject Referral
        </Button>
      </div>
    </Modal>
  );
}
