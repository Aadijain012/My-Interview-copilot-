import { useState } from "react";
import { Modal, Button, Field, Select } from "@/components";

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

export function ConfigureCurrencyModal({
  isOpen,
  isLoading,
  influencer,
  onClose,
  onSubmit,
}) {
  const [currency, setCurrency] = useState(influencer?.payoutCurrency || "USD");

  const handleSubmit = (e) => {
    e?.preventDefault();
    onSubmit(currency);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configure Payout Currency: ${influencer?.name || ""}`}
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
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
            <strong>Currency Control Policy:</strong> Only authorized administrators can configure or change payout currencies. Changing the currency will apply to future conversions and payouts; past commissions and disbursements will retain their original currency snapshot.
          </div>

          <Field
            label="Selected Payout Currency"
            helpText="This currency will be displayed on the creator's dashboard and used for payout calculations."
            required
          >
            <Select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              autoFocus
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)", marginTop: "var(--sp-5)" }}>
          <Button variant="ghost" onClick={onClose} disabled={isLoading} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isLoading}>
            Update Currency
          </Button>
        </div>
      </form>
    </Modal>
  );
}
