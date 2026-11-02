import { useState } from "react";
import { Modal, Button, Field, Input, Select, Textarea } from "@/components";

const AVAILABLE_PLATFORMS = [
  { id: "youtube", label: "YouTube" },
  { id: "instagram", label: "Instagram" },
  { id: "twitter", label: "Twitter / X" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok" },
  { id: "podcast", label: "Podcast" },
  { id: "newsletter", label: "Newsletter" },
  { id: "other", label: "Other / Website" },
];

export function EditInfluencerModal({
  isOpen,
  isLoading,
  influencer,
  campaigns = [],
  onClose,
  onSubmit,
  onResendEmail,
  isResendingEmail,
}) {
  const [form, setForm] = useState(() => {
    let initialPlatforms = ["youtube"];
    if (Array.isArray(influencer?.platforms) && influencer.platforms.length > 0) {
      initialPlatforms = influencer.platforms;
    } else if (influencer?.platform) {
      initialPlatforms = influencer.platform.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
    }
    if (!initialPlatforms.length) initialPlatforms = ["youtube"];

    return {
      name: influencer?.name || "",
      refereeCredits: influencer?.refereeCredits != null ? String(influencer.refereeCredits) : "100",
      platforms: initialPlatforms,
      followerCount: influencer?.followerCount != null ? String(influencer.followerCount) : "",
      profileUrl: influencer?.profileUrl || "",
      campaignId: influencer?.campaignId || "",
      notes: influencer?.notes || "",
    };
  });
  const [errors, setErrors] = useState({});

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[key];
        return next;
      });
    }
  };

  const handleTogglePlatform = (platId) => {
    setForm((f) => {
      const current = f.platforms || [];
      const exists = current.includes(platId);
      const next = exists ? current.filter((p) => p !== platId) : [...current, platId];
      return { ...f, platforms: next.length > 0 ? next : [platId] };
    });
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!validate()) return;

    onSubmit({
      name: form.name.trim(),
      refereeCredits: form.refereeCredits !== "" && !isNaN(Number(form.refereeCredits)) ? Math.max(0, parseInt(form.refereeCredits, 10)) : 100,
      platforms: form.platforms,
      platform: form.platforms.join(", "),
      followerCount: form.followerCount ? Number(form.followerCount) : 0,
      profileUrl: form.profileUrl.trim() || null,
      campaignId: form.campaignId || null,
      notes: form.notes.trim() || null,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Influencer: ${influencer?.name || ""}`}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <Field label="Full Name" error={errors.name} required>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              autoFocus
            />
          </Field>

          <Field
            label="Active Platforms / Marketing Channels"
            helpText="Select all platforms operated by this influencer"
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
              {AVAILABLE_PLATFORMS.map((plat) => {
                const isSelected = form.platforms.includes(plat.id);
                return (
                  <button
                    key={plat.id}
                    type="button"
                    onClick={() => handleTogglePlatform(plat.id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "var(--text-xs, 12px)",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      border: isSelected ? "1px solid var(--color-brand, #3b82f6)" : "1px solid var(--color-border-subtle, #334155)",
                      background: isSelected ? "rgba(59, 130, 246, 0.15)" : "var(--color-bg-subtle, #1e293b)",
                      color: isSelected ? "var(--color-brand, #3b82f6)" : "var(--color-text-secondary, #94a3b8)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{isSelected ? "✓" : "+"}</span>
                    <span>{plat.label}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
            <Field label="Audience Size (Followers)">
              <Input
                type="number"
                value={form.followerCount}
                onChange={(e) => set("followerCount", e.target.value)}
              />
            </Field>

            <Field label="Primary Profile / Channel URL">
              <Input
                placeholder="https://youtube.com/@channel or https://instagram.com/..."
                value={form.profileUrl}
                onChange={(e) => set("profileUrl", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Assigned Campaign">
            <Select
              value={form.campaignId}
              onChange={(e) => set("campaignId", e.target.value)}
            >
              <option value="">General Network (No campaign)</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.currency || "USD"})
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Referee Signup Bonus Credits"
            helpText="Dynamic credits awarded to new users who register using this influencer's referral code (configured by Owner)"
          >
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="100"
              value={form.refereeCredits}
              onChange={(e) => set("refereeCredits", e.target.value)}
            />
          </Field>

          <Field label="Notes / Partnership Context">
            <Textarea
              placeholder="Notes, status updates, or contract details..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
            />
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--sp-5)" }}>
          {onResendEmail ? (
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => onResendEmail(influencer)}
              disabled={isResendingEmail}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              title="Resend welcome email with login credentials"
            >
              ✉️ {isResendingEmail ? "Sending..." : "Resend Credentials Email"}
            </Button>
          ) : <div />}
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            <Button variant="ghost" onClick={onClose} disabled={isLoading} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isLoading}>
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
