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
import { useAuth } from "@/features/auth/useAuth";
import { hasPermission } from "@/features/auth/rbac";
import {
  useRateLimitConfig,
  useUpdateRateLimitConfig,
  useSignupBonus,
  useUpdateSignupBonus,
} from "../hooks/useSettingsQueries";

export function RateLimitSection({ onSuccess, onError }) {
  const { admin } = useAuth();
  const canEdit = hasPermission(admin?.role, "settings:write");

  const { data, isLoading, isError, error, refetch } = useRateLimitConfig();
  const updateMutation = useUpdateRateLimitConfig();

  const { data: bonusData, isLoading: isLoadingBonus } = useSignupBonus();
  const updateBonusMutation = useUpdateSignupBonus();

  const [freeMaxRequests, setFreeMaxRequests] = useState(10);
  const [freeWindowMinutes, setFreeWindowMinutes] = useState(15);
  const [signupBonusCredits, setSignupBonusCredits] = useState(30);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data?.rateLimit) {
      setFreeMaxRequests(data.rateLimit.freeMaxRequests);
      setFreeWindowMinutes(data.rateLimit.freeWindowMinutes);
    }
  }, [data]);

  useEffect(() => {
    if (bonusData && typeof bonusData.signupBonusCredits === "number") {
      setSignupBonusCredits(bonusData.signupBonusCredits);
    }
  }, [bonusData]);

  const handleRequestsChange = (val) => {
    setFreeMaxRequests(parseInt(val, 10) || 1);
    setHasChanges(true);
  };

  const handleWindowChange = (val) => {
    setFreeWindowMinutes(parseInt(val, 10) || 1);
    setHasChanges(true);
  };

  const handleCreditsChange = (val) => {
    setSignupBonusCredits(parseInt(val, 10) || 0);
    setHasChanges(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        freeMaxRequests,
        freeWindowMinutes,
      });
      await updateBonusMutation.mutateAsync(signupBonusCredits);
      setHasChanges(false);
      onSuccess?.(
        "Free tier rate limiting and dynamic signup credits updated successfully.",
      );
    } catch (err) {
      onError?.(err?.message || "Failed to update rate limit configuration.");
    }
  };

  return (
    <Card className="settings-section">
      <CardHeader
        title="Free-User Rate Limiting & Dynamic Signup Credits"
        subtitle="Configure dynamic initial credits awarded to new users upon registration, and enforce API request limits on free accounts."
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
            title="Failed to load rate limit configuration"
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
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "var(--sp-4)",
              }}
            >
              <Field
                label="Maximum Allowed Requests"
                hint="Number of requests allowed within the sliding window"
              >
                <Input
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  value={String(freeMaxRequests)}
                  onChange={(e) => handleRequestsChange(e.target.value)}
                  disabled={!canEdit || updateMutation.isPending}
                  required
                />
              </Field>

              <Field
                label="Sliding Window Duration (minutes)"
                hint="Time window before request counts expire"
              >
                <Input
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  value={String(freeWindowMinutes)}
                  onChange={(e) => handleWindowChange(e.target.value)}
                  disabled={
                    !canEdit ||
                    updateMutation.isPending ||
                    updateBonusMutation.isPending
                  }
                  required
                />
              </Field>

              <Field
                label="Dynamic Free Signup Credits"
                hint="Credits automatically credited to new free users on registration"
              >
                <Input
                  type="number"
                  min="0"
                  max="100000"
                  step="1"
                  value={String(signupBonusCredits)}
                  onChange={(e) => handleCreditsChange(e.target.value)}
                  disabled={
                    !canEdit ||
                    updateMutation.isPending ||
                    updateBonusMutation.isPending
                  }
                  required
                />
              </Field>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--sp-3)",
                padding: "var(--sp-3) var(--sp-4)",
                backgroundColor: "var(--color-bg-secondary, #f8fafc)",
                borderRadius: "var(--radius-md, 8px)",
                border: "1px solid var(--color-border-subtle, #e2e8f0)",
                fontSize: "0.875rem",
                color: "var(--color-text-secondary, #475569)",
              }}
            >
              <span style={{ fontSize: "1.125rem" }}>🎁</span>
              <div>
                <strong>Free User Policy & Initial Balance:</strong>
                <div>
                  New users will automatically receive{" "}
                  <strong>{signupBonusCredits} AI credits</strong> upon
                  registration (viewable in their Profile &gt; My Wallet under
                  Available Credits). Free users are rate-limited to{" "}
                  <strong>
                    {freeMaxRequests} requests per {freeWindowMinutes} minutes
                  </strong>{" "}
                  to protect platform capacity.
                </div>
              </div>
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
                  isLoading={
                    updateMutation.isPending || updateBonusMutation.isPending
                  }
                  disabled={
                    !hasChanges ||
                    updateMutation.isPending ||
                    updateBonusMutation.isPending
                  }
                >
                  Save Free Tier Settings
                </Button>
              </div>
            )}
          </form>
        )}
      </CardBody>
    </Card>
  );
}
