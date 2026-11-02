import { useState } from "react";
import { Modal, Button, Field, Input, Select } from "@/components";

export function CreateMilestoneModal({
  campaigns,
  isOpen,
  isLoading,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState({
    campaignId: "",
    name: "",
    threshold: 1,
    rewardAmount: 0,
  });
  const [errors, setErrors] = useState({});

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.campaignId) e.campaignId = "Campaign is required";
    if (!form.name.trim()) e.name = "Name is required";
    if (form.threshold < 1) e.threshold = "Must be at least 1";
    if (form.rewardAmount < 0) e.rewardAmount = "Must be non-negative";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(form);
  };

  const handleClose = () => {
    setForm({ campaignId: "", name: "", threshold: 1, rewardAmount: 0 });
    setErrors({});
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Milestone"
      size="md"
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}
      >
        <Field label="Campaign" required error={errors.campaignId}>
          <Select
            value={form.campaignId}
            onChange={(e) => set("campaignId", e.target.value)}
            hasError={!!errors.campaignId}
          >
            <option value="">Select a campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Milestone Name" required error={errors.name}>
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Bronze Tier"
            hasError={!!errors.name}
          />
        </Field>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--sp-4)",
          }}
        >
          <Field
            label="Threshold (referrals)"
            required
            error={errors.threshold}
          >
            <Input
              type="number"
              value={String(form.threshold)}
              onChange={(e) =>
                set("threshold", parseInt(e.target.value, 10) || 0)
              }
              hasError={!!errors.threshold}
            />
          </Field>
          <Field label="Reward (credits)" required error={errors.rewardAmount}>
            <Input
              type="number"
              value={String(form.rewardAmount)}
              onChange={(e) =>
                set("rewardAmount", parseInt(e.target.value, 10) || 0)
              }
              hasError={!!errors.rewardAmount}
            />
          </Field>
        </div>
      </div>
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
        <Button variant="primary" onClick={handleSubmit} isLoading={isLoading}>
          Create Milestone
        </Button>
      </div>
    </Modal>
  );
}
