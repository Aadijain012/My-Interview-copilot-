import { useState, useEffect } from "react";
import { Modal, Button, Field, Input, Textarea } from "@/components";

export function EditPlanModal({ isOpen, plan, isLoading, onClose, onSave }) {
  const [name, setName] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState(0);
  const [currency, setCurrency] = useState("INR");
  const [includedCredits, setIncludedCredits] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [featureFlagsJson, setFeatureFlagsJson] = useState("{}");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setMonthlyPrice(plan.monthlyPrice);
      setCurrency(plan.currency || "INR");
      setIncludedCredits(plan.includedCredits);
      setIsActive(plan.isActive);
      setFeatureFlagsJson(
        typeof plan.featureFlags === "object"
          ? JSON.stringify(plan.featureFlags, null, 2)
          : plan.featureFlags || "{}",
      );
      setError(null);
    }
  }, [plan, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!plan) return;

    let parsedFlags = {};
    try {
      parsedFlags = JSON.parse(featureFlagsJson);
    } catch (_) {
      setError("Feature flags must be valid JSON.");
      return;
    }

    try {
      setError(null);
      await onSave(plan.id, {
        name,
        monthlyPrice,
        currency,
        includedCredits,
        isActive,
        featureFlags: parsedFlags,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to update plan.");
    }
  };

  if (!plan) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Subscription Plan — ${plan.name}`}
      size="md"
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}
      >
        {error && (
          <div
            style={{
              padding: "var(--sp-3)",
              backgroundColor:
                "var(--color-danger-subtle, rgba(239, 68, 68, 0.1))",
              color: "var(--color-danger, #ef4444)",
              borderRadius: "var(--radius-md)",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--sp-3)",
          }}
        >
          <Field label="Plan Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pro"
              required
            />
          </Field>
          <Field label="Currency Code (ISO 4217)" required>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="INR, USD, EUR"
              maxLength={4}
              required
            />
          </Field>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--sp-3)",
          }}
        >
          <Field label="Monthly Price" required>
            <Input
              type="number"
              min="0"
              step="any"
              value={String(monthlyPrice)}
              onChange={(e) => setMonthlyPrice(parseFloat(e.target.value) || 0)}
              required
            />
          </Field>
          <Field label="Included Credits" required>
            <Input
              type="number"
              min="0"
              step="1"
              value={String(includedCredits)}
              onChange={(e) =>
                setIncludedCredits(parseInt(e.target.value, 10) || 0)
              }
              required
            />
          </Field>
        </div>

        <Field label="Plan Status">
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-2)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />

            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
              Active (Available for user selection/billing)
            </span>
          </label>
        </Field>

        <Field label="Feature Flags (JSON)">
          <Textarea
            value={featureFlagsJson}
            onChange={(e) => setFeatureFlagsJson(e.target.value)}
            rows={5}
            placeholder='{"aiVoice": true, "maxSessions": 100}'
            style={{ fontFamily: "monospace", fontSize: "0.8125rem" }}
          />
        </Field>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--sp-3)",
            marginTop: "var(--sp-2)",
          }}
        >
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            type="button"
          >
            Cancel
          </Button>
          <Button variant="primary" isLoading={isLoading} type="submit">
            Save Plan
          </Button>
        </div>
      </form>
    </Modal>
  );
}
