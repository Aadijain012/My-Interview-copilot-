import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Field,
  Input,
  Button,
  Spinner,
  ErrorState,
} from "@/components";
import { formatCurrency } from "@/utils";
import { useAuth } from "@/features/auth/useAuth";
import { hasPermission } from "@/features/auth/rbac";
import {
  usePlatformPricing,
  useUpdatePlatformPricing,
} from "../hooks/useSettingsQueries";

export function PlatformPricingSection({ onSuccess, onError }) {
  const { admin } = useAuth();
  const canEdit = hasPermission(admin?.role, "settings:write");

  const { data, isLoading, isError, error, refetch } = usePlatformPricing();
  const updateMutation = useUpdatePlatformPricing();

  const [creditsPerUnit, setCreditsPerUnit] = useState(250);
  const [unitPrice, setUnitPrice] = useState(1.0);
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data?.pricing) {
      setCreditsPerUnit(data.pricing.creditsPerUnit);
      setUnitPrice(data.pricing.unitPrice);
      setCurrencyCode(data.pricing.currencyCode || "INR");
      setHasChanges(false);
    }
  }, [data]);

  const handleCreditsChange = (val) => {
    setCreditsPerUnit(parseInt(val, 10) || 0);
    setHasChanges(true);
  };

  const handlePriceChange = (val) => {
    setUnitPrice(parseFloat(val) || 0);
    setHasChanges(true);
  };

  const handleCurrencyChange = (val) => {
    setCurrencyCode(val.toUpperCase());
    setHasChanges(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        creditsPerUnit,
        unitPrice,
        currencyCode,
      });
      setHasChanges(false);
      onSuccess?.(
        "Platform dynamic pricing configuration updated successfully.",
      );
    } catch (err) {
      onError?.(err?.message || "Failed to update platform pricing.");
    }
  };

  return (
    <Card className="settings-section">
      <CardHeader
        title="Platform Pricing & Currency"
        subtitle="Global baseline pricing for credit bundles, AI compute units, and default platform billing currency."
      />

      <CardBody>
        {isLoading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "var(--sp-6)",
            }}
          >
            <Spinner size="md" />
          </div>
        )}

        {isError && (
          <ErrorState
            title="Failed to load platform pricing"
            message={error?.message ?? "An unexpected error occurred."}
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && (
          <form
            onSubmit={handleSave}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-4)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "var(--sp-4)",
              }}
            >
              <Field
                label="Credits Per Base Unit"
                hint="Amount of AI credits awarded per unit purchase"
              >
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={String(creditsPerUnit)}
                  onChange={(e) => handleCreditsChange(e.target.value)}
                  disabled={!canEdit || updateMutation.isPending}
                  required
                />
              </Field>

              <Field
                label="Unit Price"
                hint="Base monetary cost for one compute credit unit"
              >
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={String(unitPrice)}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  disabled={!canEdit || updateMutation.isPending}
                  required
                />
              </Field>

              <Field
                label="Platform Currency"
                hint="Standard ISO 4217 currency code"
              >
                <Input
                  value={currencyCode}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  disabled={!canEdit || updateMutation.isPending}
                  maxLength={4}
                  required
                />
              </Field>
            </div>

            {/* Live Pricing Preview */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-3)",
                padding: "var(--sp-3) var(--sp-4)",
                backgroundColor: "var(--color-bg-secondary, #f8fafc)",
                borderRadius: "var(--radius-md, 8px)",
                border: "1px solid var(--color-border-subtle, #e2e8f0)",
                fontSize: "0.875rem",
              }}
            >
              <span style={{ color: "var(--color-text-muted, #64748b)" }}>
                Conversion preview:
              </span>
              <strong style={{ color: "var(--color-text-primary, #0f172a)" }}>
                1 Base Unit = {creditsPerUnit.toLocaleString()} Credits ={" "}
                {formatCurrency(unitPrice, currencyCode)}
              </strong>
            </div>

            {canEdit && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "var(--sp-2)",
                }}
              >
                <Button
                  variant="primary"
                  type="submit"
                  isLoading={updateMutation.isPending}
                  disabled={!hasChanges || updateMutation.isPending}
                >
                  Save Pricing Configuration
                </Button>
              </div>
            )}
          </form>
        )}
      </CardBody>
    </Card>
  );
}
