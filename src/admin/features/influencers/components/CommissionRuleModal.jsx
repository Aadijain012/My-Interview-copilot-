import { useState } from "react";
import { Modal, Button, Field, Input, Select } from "@/components";

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

export function CommissionRuleModal({
  isOpen,
  isLoading,
  rule,
  onClose,
  onSubmit,
  serverError,
}) {
  const isEditing = Boolean(rule);
  const [form, setForm] = useState(() => ({
    planId: rule?.planId || "default",
    minConversions: rule?.minConversions ?? 0,
    maxConversions: rule?.maxConversions != null ? String(rule.maxConversions) : "",
    commissionPercent: rule?.commissionPercent ?? 10,
    currency: rule?.currency || "USD",
    status: rule?.status || "active",
  }));
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

  const validate = () => {
    const e = {};
    const min = Number(form.minConversions);
    if (isNaN(min) || min < 0) {
      e.minConversions = "Min conversions must be 0 or higher";
    }

    if (form.maxConversions !== "") {
      const max = Number(form.maxConversions);
      if (isNaN(max) || max < min) {
        e.maxConversions = `Max conversions must be greater than or equal to min conversions (${min})`;
      }
    }

    const rate = Number(form.commissionPercent);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      e.commissionPercent = "Commission percent must be between 0% and 100%";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!validate()) return;

    onSubmit({
      planId: form.planId || "default",
      minConversions: Number(form.minConversions),
      maxConversions: form.maxConversions !== "" ? Number(form.maxConversions) : null,
      commissionPercent: Number(form.commissionPercent),
      currency: form.currency || "USD",
      status: form.status || "active",
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Commission Tier Rule" : "Create Commission Tier Rule"}
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {serverError && (
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
              {serverError}
            </div>
          )}

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
            <strong>Tier Progression Engine:</strong> Conversions qualify influencers for dynamic rates (e.g. 0–24 conversions @ 10%, 25–49 @ 15%, 50–99 @ 20%, 100+ @ 25%). Historical conversions maintain their original snapshot rates.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
            <Field
              label="Min Conversions"
              error={errors.minConversions}
              helpText="Inclusive lower threshold"
              required
            >
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={form.minConversions}
                onChange={(e) => set("minConversions", e.target.value)}
                autoFocus
              />
            </Field>

            <Field
              label="Max Conversions"
              error={errors.maxConversions}
              helpText="Leave empty for unlimited (e.g. 100+)"
            >
              <Input
                type="number"
                placeholder="Unlimited (e.g. 24)"
                value={form.maxConversions}
                onChange={(e) => set("maxConversions", e.target.value)}
              />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
            <Field
              label="Commission Percent (%)"
              error={errors.commissionPercent}
              helpText="Cut awarded per conversion (0–100%)"
              required
            >
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="10"
                value={form.commissionPercent}
                onChange={(e) => set("commissionPercent", e.target.value)}
              />
            </Field>

            <Field label="Tier Currency" required>
              <Select
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
            <Field label="Plan ID">
              <Input
                placeholder="default"
                value={form.planId}
                onChange={(e) => set("planId", e.target.value)}
              />
            </Field>

            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)", marginTop: "var(--sp-5)" }}>
          <Button variant="ghost" onClick={onClose} disabled={isLoading} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isLoading}>
            {isEditing ? "Save Tier Rule" : "Create Tier Rule"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
