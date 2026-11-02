import { useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Field,
  Input,
  Button,
} from "@/components";
import { useAuth } from "@/features/auth/useAuth";
import { hasPermission } from "@/features/auth/rbac";
import { bulkGrantCredits } from "@/features/credits/api/creditsApi";
import { useQueryClient } from "@tanstack/react-query";
import "./BulkCreditDistributionSection.css";

const PRESET_AMOUNTS = [10, 25, 50, 100, 250];

export function BulkCreditDistributionSection({ onSuccess, onError }) {
  const { admin } = useAuth();
  const canDistribute = hasPermission(admin?.role, "credits:compensate") || admin?.role === "owner" || admin?.role === "admin";
  const queryClient = useQueryClient();

  const [audience, setAudience] = useState("ALL"); // "ALL" or "FREE"
  const [amount, setAmount] = useState("50");
  const [reason, setReason] = useState("Promotional bonus for platform users");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleAmountChange = (val) => {
    setAmount(val);
    setSuccessInfo(null);
    setErrorInfo(null);
  };

  const handlePresetClick = (preset) => {
    setAmount(String(preset));
    setSuccessInfo(null);
    setErrorInfo(null);
  };

  const handleTriggerGrant = async () => {
    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount <= 0) {
      setErrorInfo("Please enter a valid positive credit amount.");
      return;
    }

    setIsSubmitting(true);
    setErrorInfo(null);
    setSuccessInfo(null);
    setIsConfirming(false);

    try {
      const res = await bulkGrantCredits({
        amount: parsedAmount,
        reason: reason.trim() || "Administrative bulk credit grant",
        tier: audience,
      });

      const successMsg = res.message || `Successfully granted ${parsedAmount} credits to ${res.count || 0} users.`;
      setSuccessInfo(successMsg);
      onSuccess?.(successMsg);

      // Invalidate queries to refresh lists and metrics
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      const errMsg = err?.message || "Failed to distribute bulk credits.";
      setErrorInfo(errMsg);
      onError?.(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="settings-section bulk-credits-section">
      <CardHeader
        title="Bulk Free Credits Distribution"
        subtitle="Directly credit free AI credits to user wallets in bulk. Choose whether to target all registered users or only existing free tier users."
      />

      <CardBody>
        {successInfo && (
          <div className="bulk-credits__success-banner">
            <span>✓</span>
            <div>{successInfo}</div>
          </div>
        )}

        {errorInfo && (
          <div className="bulk-credits__error-banner">
            <span>⚠</span>
            <div>{errorInfo}</div>
          </div>
        )}

        {/* 1. Target Audience Toggle */}
        <div style={{ marginBottom: "var(--sp-4, 16px)" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.875rem",
              fontWeight: 600,
              marginBottom: "8px",
              color: "var(--color-text-primary, #0f172a)",
            }}
          >
            Target Audience
          </label>
          <div className="bulk-credits__toggle-group">
            <button
              type="button"
              className={`bulk-credits__toggle-btn ${
                audience === "ALL" ? "bulk-credits__toggle-btn--active" : ""
              }`}
              onClick={() => {
                setAudience("ALL");
                setSuccessInfo(null);
              }}
            >
              <span>👥</span>
              <span>All Users</span>
            </button>
            <button
              type="button"
              className={`bulk-credits__toggle-btn ${
                audience === "FREE" ? "bulk-credits__toggle-btn--active" : ""
              }`}
              onClick={() => {
                setAudience("FREE");
                setSuccessInfo(null);
              }}
            >
              <span>🎁</span>
              <span>Existing Free Tier Users</span>
            </button>
          </div>
        </div>

        {/* 2. Amount and Reason Fields */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--sp-4, 16px)",
            marginBottom: "var(--sp-4, 16px)",
          }}
        >
          <Field
            label="Credits to Add per User"
            hint="Amount to be added to each user's wallet"
          >
            <Input
              type="number"
              min="1"
              max="100000"
              step="1"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="e.g. 50"
              disabled={isSubmitting || !canDistribute}
              required
            />
            <div className="bulk-credits__presets">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`bulk-credits__preset-btn ${
                    amount === String(preset)
                      ? "bulk-credits__preset-btn--active"
                      : ""
                  }`}
                  onClick={() => handlePresetClick(preset)}
                >
                  +{preset}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="Reason / Ledger Note"
            hint="Visible in the credits ledger & user audit records"
          >
            <Input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Festival promotional gift"
              disabled={isSubmitting || !canDistribute}
            />
          </Field>
        </div>

        {/* 3. Live Preview Banner */}
        <div className="bulk-credits__preview">
          <span className="bulk-credits__preview-icon">ℹ️</span>
          <div>
            <strong>Distribution Summary:</strong> Each account in{" "}
            <strong>
              {audience === "ALL" ? "All Platform Users" : "Free Tier Existing Accounts"}
            </strong>{" "}
            will receive an immediate credit adjustment of{" "}
            <strong>+{amount || 0} credits</strong> added directly to their available balance.
          </div>
        </div>

        {/* 4. Action Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            justifyContent: "flex-end",
          }}
        >
          {isConfirming ? (
            <>
              <span
                style={{
                  fontSize: "0.875rem",
                  color: "var(--color-danger, #ef4444)",
                  fontWeight: 600,
                }}
              >
                Confirm adding +{amount} credits to {audience === "ALL" ? "all users" : "free tier users"}?
              </span>
              <Button
                variant="danger"
                size="md"
                isLoading={isSubmitting}
                onClick={handleTriggerGrant}
              >
                Yes, Distribute Now
              </Button>
              <Button
                variant="ghost"
                size="md"
                disabled={isSubmitting}
                onClick={() => setIsConfirming(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="md"
              disabled={!canDistribute || isSubmitting || !amount || Number(amount) <= 0}
              onClick={() => setIsConfirming(true)}
            >
              Grant Free Credits
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

