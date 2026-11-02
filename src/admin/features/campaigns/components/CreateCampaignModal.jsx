import { useState } from "react";
import { Modal, Button, Field, Input, Textarea } from "@/components";
import { generateCampaignCode } from "../api/campaignsApi";

export function CreateCampaignModal({ isOpen, isLoading, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", rewardAmount: 0 });
  const [customCode, setCustomCode] = useState("");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const computedPrefix = (form.name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

  const handleGenerateCode = async () => {
    setIsGeneratingCode(true);
    try {
      const res = await generateCampaignCode(form.name);
      if (res.code) {
        setCustomCode(res.code);
        setErrors((prev) => {
          const next = { ...prev };
          delete next.code;
          return next;
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate code";
      setErrors((prev) => ({ ...prev, code: msg }));
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (form.rewardAmount < 0) e.rewardAmount = "Must be non-negative";
    if (customCode.trim() && !/^[A-Z0-9_-]{3,32}$/.test(customCode.trim())) {
      e.code =
        "Code must be 3-32 characters of letters, numbers, hyphens or underscores";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const finalCode = customCode.trim() || undefined;
    onSubmit({
      ...form,
      autoGenerateCode: !finalCode,
      code: finalCode,
    });
  };

  const handleClose = () => {
    setForm({ name: "", rewardAmount: 0 });
    setCustomCode("");
    setErrors({});
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Campaign"
      size="md"
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}
      >
        <Field label="Campaign Name" required error={errors.name}>
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Summer 2026 Referral"
            hasError={!!errors.name}
          />
        </Field>

        <Field label="Description">
          <Textarea
            value={form.description || ""}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            placeholder="Optional description..."
          />
        </Field>

        {/* Referral Code Field with Generate Code Button */}
        <Field label="Referral Code" error={errors.code}>
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            <Input
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder={
                computedPrefix
                  ? `e.g. ${computedPrefix}-7X42`
                  : "e.g. SUMMER-SALE-7X42"
              }
              hasError={!!errors.code}
            />

            <Button
              type="button"
              variant="secondary"
              isLoading={isGeneratingCode}
              onClick={handleGenerateCode}
              title="Generate a unique referral code based on campaign name"
            >
              Generate Code
            </Button>
          </div>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
              marginTop: 4,
              display: "block",
            }}
          >
            Click &ldquo;Generate Code&rdquo; to auto-generate a unique code
            from the campaign name, or type a custom one.
          </span>
        </Field>

        <Field
          label="Reward per Referral (credits)"
          required
          error={errors.rewardAmount}
        >
          <Input
            type="number"
            value={String(form.rewardAmount)}
            onChange={(e) =>
              set("rewardAmount", parseInt(e.target.value, 10) || 0)
            }
            hasError={!!errors.rewardAmount}
          />
        </Field>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--sp-4)",
          }}
        >
          <Field label="Max Referrals (campaign total)">
            <Input
              type="number"
              value={form.maxReferrals != null ? String(form.maxReferrals) : ""}
              onChange={(e) =>
                set(
                  "maxReferrals",
                  e.target.value ? parseInt(e.target.value, 10) : null,
                )
              }
              placeholder="Unlimited"
            />
          </Field>
          <Field label="Max Per User">
            <Input
              type="number"
              value={form.maxPerUser != null ? String(form.maxPerUser) : ""}
              onChange={(e) =>
                set(
                  "maxPerUser",
                  e.target.value ? parseInt(e.target.value, 10) : null,
                )
              }
              placeholder="Unlimited"
            />
          </Field>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--sp-4)",
          }}
        >
          <Field label="Start Date">
            <Input
              type="date"
              value={form.startDate || ""}
              onChange={(e) => set("startDate", e.target.value || null)}
            />
          </Field>
          <Field label="End Date">
            <Input
              type="date"
              value={form.endDate || ""}
              onChange={(e) => set("endDate", e.target.value || null)}
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
          Create Campaign
        </Button>
      </div>
    </Modal>
  );
}
