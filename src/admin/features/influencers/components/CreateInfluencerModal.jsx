import { useState } from "react";
import { Modal, Button, Field, Input, Select, Textarea } from "@/components";

const CURRENCY_OPTIONS = [
  { code: "USD", label: "USD ($) - US Dollar" },
  { code: "INR", label: "INR (₹) - Indian Rupee" },
  { code: "EUR", label: "EUR (€) - Euro" },
  { code: "GBP", label: "GBP (£) - British Pound" },
  { code: "CAD", label: "CAD ($) - Canadian Dollar" },
  { code: "AUD", label: "AUD ($) - Australian Dollar" },
  { code: "AED", label: "AED (د.إ) - UAE Dirham" },
  { code: "SGD", label: "SGD ($) - Singapore Dollar" },
];

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

export function CreateInfluencerModal({
  isOpen,
  isLoading,
  campaigns = [],
  onClose,
  onSubmit,
  conflictError,
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    referralCode: "",
    refereeCredits: 100,
    campaignId: "",
    payoutCurrency: "USD",
    platforms: ["youtube"],
    followerCount: "",
    profileUrl: "",
    notes: "",
    sendWelcomeEmail: true,
  });
  const [showPassword, setShowPassword] = useState(false);
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

  const handleCodeChange = (val) => {
    const formatted = val.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    set("referralCode", formatted);
  };

  const handleAutoGenerateCode = () => {
    const prefix = (form.name || "INF").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "INF";
    const random = Math.floor(1000 + Math.random() * 9000);
    set("referralCode", `${prefix}${random}`);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.email.trim() || !form.email.includes("@")) e.email = "Valid email is required";
    if (form.referralCode.trim() && (form.referralCode.trim().length < 3 || form.referralCode.trim().length > 20)) {
      e.referralCode = "Code must be between 3 and 20 characters";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!validate()) return;

    onSubmit({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password.trim() || undefined,
      referralCode: form.referralCode.trim() || undefined,
      refereeCredits: form.refereeCredits !== "" && !isNaN(Number(form.refereeCredits)) ? Math.max(0, parseInt(form.refereeCredits, 10)) : 100,
      campaignId: form.campaignId || null,
      payoutCurrency: form.payoutCurrency || "USD",
      platforms: form.platforms,
      platform: form.platforms.join(", "),
      followerCount: form.followerCount ? Number(form.followerCount) : 0,
      profileUrl: form.profileUrl.trim() || null,
      notes: form.notes.trim() || null,
      sendWelcomeEmail: form.sendWelcomeEmail !== false,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Influencer Partner">
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {conflictError && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid var(--color-danger)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-danger)",
                fontSize: "var(--text-sm)",
              }}
            >
              {conflictError}
            </div>
          )}

                    {/* Automated Welcome & Credentials Email Notice / Toggle */}
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div>
              <strong style={{ color: "var(--color-success, #10b981)", display: "block", fontSize: "var(--text-xs)" }}>
                ✉️ Automated Welcome &amp; Credentials Email:
              </strong>
              <span style={{ fontSize: "11px", color: "var(--color-text-secondary, #64748b)" }}>
                Automatically send login credentials, temporary password, and referral links to partner.
              </span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={form.sendWelcomeEmail}
                onChange={(e) => set("sendWelcomeEmail", e.target.checked)}
                style={{ accentColor: "var(--color-accent, #6366f1)", width: "16px", height: "16px", cursor: "pointer" }}
              />
              Send
            </label>
          </div>

          {/* Scope notice banner */}
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(59, 130, 246, 0.08)",
              border: "1px solid rgba(59, 130, 246, 0.25)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-text-primary)",
              fontSize: "var(--text-xs)",
              lineHeight: 1.5,
            }}
          >
            <strong>Automatic Restricted Scope:</strong> The partner will automatically receive an account with <code>viewer</code> role and <code>influencer_dashboard:view</code> permission only. They will be strictly isolated to their own metrics and cannot access admin controls or modify currencies/rates.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
            <Field label="Full Name" error={errors.name} required>
              <Input
                placeholder="e.g. Rahul Sharma"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                autoFocus
              />
            </Field>

            <Field label="Email Address (Login Account)" error={errors.email} required>
              <Input
                type="email"
                placeholder="rahul@creator.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
            <Field
              label={
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span>Referral Promo Code</span>
                  <button
                    type="button"
                    onClick={handleAutoGenerateCode}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--color-primary, #3b82f6)",
                      fontSize: "11px",
                      cursor: "pointer",
                      padding: 0,
                      fontWeight: 500,
                      textDecoration: "underline"
                    }}
                  >
                    Auto-Generate
                  </button>
                </span>
              }
              error={errors.referralCode}
              helpText="Custom code (e.g. RAHUL2026) or leave blank to auto-generate"
            >
              <Input
                placeholder="e.g. RAHUL2026 (or auto-generated)"
                value={form.referralCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                style={{ textTransform: "uppercase", fontFamily: "var(--font-mono)", fontWeight: 600 }}
              />
            </Field>

            <Field label="Initial Password" helpText="Leave blank for secure default (Influencer@2026!)">
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Optional custom password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  style={{ paddingRight: "36px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: "10px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-text-secondary, #6b7280)",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
            <Field label="Assign Campaign" helpText="Optional marketing campaign">
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
              label="Payout Currency"
              helpText="Owner/Admin configured currency for earnings & payouts"
              required
            >
              <Select
                value={form.payoutCurrency}
                onChange={(e) => set("payoutCurrency", e.target.value)}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

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

          <Field
            label="Active Platforms / Marketing Channels"
            helpText="Select all platforms operated by this influencer (e.g. YouTube, Instagram, X, LinkedIn)"
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
            <Field label="Total Audience Size" helpText="Combined follower/subscriber base">
              <Input
                type="number"
                placeholder="e.g. 50000"
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

          <Field label="Notes / Partnership Terms">
            <Textarea
              placeholder="Sponsorship contract notes, agreed deliverables, or special arrangement..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
            />
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)", marginTop: "var(--sp-5)" }}>
          <Button variant="ghost" onClick={onClose} disabled={isLoading} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isLoading}>
            Create Influencer Account
          </Button>
        </div>
      </form>
    </Modal>
  );
}
