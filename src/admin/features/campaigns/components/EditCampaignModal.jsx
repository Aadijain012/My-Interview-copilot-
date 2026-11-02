import { useState, useMemo } from "react";
import { Modal, Button, Field, Input, Select, Textarea } from "@/components";
import { generateCampaignCode } from "../api/campaignsApi";

const STATUS_OPTIONS = ["draft", "active", "paused", "ended"];

export function EditCampaignModal({
  campaign,
  isOpen,
  isLoading,
  onClose,
  onSubmit,
}) {
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const initialForm = useMemo(() => {
    if (!campaign) return {};
    return {
      name: campaign.name,
      code: campaign.code,
      description: campaign.description,
      status: campaign.status,
      rewardAmount: campaign.rewardAmount,
      maxReferrals: campaign.maxReferrals,
      maxPerUser: campaign.maxPerUser,
      startDate: campaign.startDate ? campaign.startDate.slice(0, 10) : null,
      endDate: campaign.endDate ? campaign.endDate.slice(0, 10) : null,
    };
  }, [campaign]);

  const [form, setForm] = useState(initialForm);

  // Re-sync form when campaign changes (modal opened for a different campaign)
  const [prevCampaignId, setPrevCampaignId] = useState(campaign?.id);
  if (campaign?.id !== prevCampaignId) {
    setPrevCampaignId(campaign?.id);
    setForm(initialForm);
  }

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleGenerateCode = async () => {
    if (!campaign) return;
    setIsGeneratingCode(true);
    try {
      const res = await generateCampaignCode(form.name || campaign.name);
      if (res.code) {
        set("code", res.code);
      }
    } catch (err) {
      console.error("Failed to generate campaign code:", err);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  if (!campaign) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit: ${campaign.name}`}
      size="md"
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}
      >
        <Field label="Campaign Name" required>
          <Input
            value={form.name || ""}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label="Referral Code">
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            <Input
              value={form.code || ""}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="e.g. DIWALI2026"
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
        </Field>
        <Field label="Description">
          <Textarea
            value={form.description || ""}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Status">
          <Select
            value={form.status || ""}
            onChange={(e) => set("status", e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reward per Referral (credits)">
          <Input
            type="number"
            value={String(form.rewardAmount ?? "")}
            onChange={(e) =>
              set("rewardAmount", parseInt(e.target.value, 10) || 0)
            }
          />
        </Field>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--sp-4)",
          }}
        >
          <Field label="Max Referrals">
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
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--sp-3)",
          marginTop: "var(--sp-4)",
        }}
      >
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => onSubmit(form)}
          isLoading={isLoading}
        >
          Save Changes
        </Button>
      </div>
    </Modal>
  );
}
