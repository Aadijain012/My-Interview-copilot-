import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { hasPermission } from "@/features/auth/rbac";
import { ErrorState, Skeleton } from "@/components";
import {
  useSettings,
  useUpdateSettings,
  AccountSettingsSection,
  SecuritySettingsSection,
  AppearanceSettingsSection,
  RuntimeSettingsSection,
  ServerConfigSection,
  RateLimitSection,
  BulkCreditDistributionSection,
} from "@/features/settings";
import "./SettingsPage.css";

export function SettingsPage() {
  const { admin } = useAuth();
  const hasReadPermission = hasPermission(admin?.role, "settings:read");

  const [toast, setToast] = useState(null);

  const { data, isLoading, isError, error, refetch } =
    useSettings(hasReadPermission);
  const updateMutation = useUpdateSettings();

  if (!hasReadPermission) {
    return (
      <div className="settings-page">
        <ErrorState
          title="Access Restricted"
          message="You do not have permission to view or manage Platform Settings. Contact an Owner to request access."
        />
      </div>
    );
  }

  const handleSaveRuntimeSettings = async (updates) => {
    try {
      await updateMutation.mutateAsync(updates);
      setToast({
        message: "Platform runtime configuration updated successfully.",
        type: "success",
      });
    } catch (err) {
      setToast({
        message: err?.message ?? "Failed to update runtime configuration.",
        type: "error",
      });
    }
  };

  return (
    <div className="settings-page">
      {/* Page Header */}
      <div className="settings-page__header">
        <div>
          <h1 className="settings-page__title">Platform Settings</h1>
          <p className="settings-page__subtitle">
            Configure administrative preferences, subscription tiers, pricing
            models, rate limits, security policies, and runtime parameters.
          </p>
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div
          className={`settings-page__alert settings-page__alert--${toast.type}`}
          role="status"
        >
          <span>{toast.message}</span>
          <button
            className="settings-page__alert-close"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="settings-page__loading">
          <Skeleton height={200} />
          <Skeleton height={180} />
          <Skeleton height={160} />
        </div>
      )}

      {/* Error State */}
      {isError && (
        <ErrorState
          title="Failed to load platform settings"
          message={error?.message ?? "An unexpected network error occurred."}
          onRetry={() => refetch()}
        />
      )}

      {/* Settings Sections */}
      {!isLoading && !isError && (
        <div className="settings-page__sections">
          {/* 1. Account Settings */}
          <AccountSettingsSection
            onSuccess={(msg) => setToast({ message: msg, type: "success" })}
            onError={(msg) => setToast({ message: msg, type: "error" })}
          />

          {/* 2. Subscriptions & Plans Callout Banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "18px",
              padding: "18px 24px",
              background: "var(--color-bg-secondary, #f8fafc)",
              border: "1px solid var(--color-border, #e2e8f0)",
              borderRadius: "14px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "10px",
                  background: "rgba(99, 102, 241, 0.15)",
                  color: "#6366f1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}
              >
                <i className="fa-solid fa-crown"></i>
              </div>
              <div>
                <h3 style={{ margin: "0 0 3px 0", fontSize: "16px", fontWeight: "700" }}>
                  Subscriptions &amp; Plans Management
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-secondary, #64748b)" }}>
                  Tier quotas, credit deduction rates, Buy Credits engine, and 30-currency conversions are managed on the dedicated page.
                </p>
              </div>
            </div>
            <Link
              to="/subscriptions"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "9px 18px",
                background: "#6366f1",
                color: "#ffffff",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: "600",
                fontSize: "13px",
              }}
            >
              <span>Open Subscriptions &amp; Plans</span>
              <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>

          {/* 3. Desktop App (EXE) Releases Callout Banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "18px",
              padding: "18px 24px",
              background: "var(--color-bg-secondary, #f8fafc)",
              border: "1px solid var(--color-border, #e2e8f0)",
              borderRadius: "14px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "10px",
                  background: "rgba(59, 130, 246, 0.15)",
                  color: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}
              >
                🖥️
              </div>
              <div>
                <h3 style={{ margin: "0 0 3px 0", fontSize: "16px", fontWeight: "700" }}>
                  Desktop App (EXE) Release Management
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-secondary, #64748b)" }}>
                  Upload new Windows desktop installers (.exe), manage channels (Production, Beta, Hotfix), and trigger version rollbacks.
                </p>
              </div>
            </div>
            <Link
              to="/desktop-app"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "9px 18px",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                color: "#ffffff",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: "600",
                fontSize: "13px",
              }}
            >
              <span>Manage Desktop Releases</span>
              <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>

          {/* 4. Bulk Free Credits Distribution */}
          <BulkCreditDistributionSection
            onSuccess={(msg) => setToast({ message: msg, type: "success" })}
            onError={(msg) => setToast({ message: msg, type: "error" })}
          />

          {/* 5. Free-User Rate Limiting */}
          <RateLimitSection
            onSuccess={(msg) => setToast({ message: msg, type: "success" })}
            onError={(msg) => setToast({ message: msg, type: "error" })}
          />

          {/* 5. Security Posture */}
          <SecuritySettingsSection serverConfig={data?.settings?.server} />

          {/* 6. Appearance & Theme */}
          <AppearanceSettingsSection />

          {/* 7. Platform Runtime Settings */}
          {data?.settings?.runtime && (
            <RuntimeSettingsSection
              runtimeSettings={data.settings.runtime}
              isSaving={updateMutation.isPending}
              onSave={handleSaveRuntimeSettings}
            />
          )}

          {/* 8. Server & Environment Config */}
          <ServerConfigSection serverConfig={data?.settings?.server} />
        </div>
      )}
    </div>
  );
}
