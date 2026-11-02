import { useState } from "react";
import { Modal, Button, Field, Textarea } from "@/components";

export function SuspendInfluencerModal({ isOpen, isLoading, influencer, onClose, onConfirm }) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason.trim() || undefined);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Suspend Influencer Account">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", margin: 0 }}>
          Are you sure you want to suspend <strong>{influencer?.name}</strong> (code: <code>{influencer?.referralCode}</code>)?
          Suspended influencers cannot earn new commissions, cannot access their dashboard, and attribution will be blocked.
        </p>

        <Field label="Suspension Reason (Optional)">
          <Textarea
            placeholder="e.g. Terms violation, requested partnership termination, inactive..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </Field>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)", marginTop: "var(--sp-5)" }}>
        <Button variant="ghost" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleConfirm} isLoading={isLoading}>
          Confirm Suspension
        </Button>
      </div>
    </Modal>
  );
}
