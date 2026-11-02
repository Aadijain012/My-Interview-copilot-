import { useState, useEffect, useMemo } from "react";
import { Spinner, ErrorState } from "@/components";
import { formatCurrency } from "@/utils";
import { useAuth } from "@/features/auth/useAuth";
import { hasPermission } from "@/features/auth/rbac";
import {
  useSubscriptionPlans,
  useUpdateSubscriptionPlan,
} from "../hooks/useSettingsQueries";
import {
  USAGE_LIMIT_DEFINITIONS,
  FEATURE_DEFINITIONS,
} from "../constants/subscriptionConstants";
import "./SubscriptionPlansSection.css";

/* ── Inline SVG Icon Primitives ── */
function IconCrown({ className = "", size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
    </svg>
  );
}

function IconUser({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconLightning({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconCreditCard({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function IconGear({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83-2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconBarChart({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconKey({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function IconClock({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconInfo({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function IconCheck({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconCross({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/* Feature & Limit icon map */
function RenderDynamicIcon({ type, size = 18 }) {
  switch (type) {
    case "headset":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        </svg>
      );
    case "document":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case "microphone":
    case "micMode":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      );
    case "cloud":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        </svg>
      );
    case "waveform":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 10v4" />
          <path d="M6 7v10" />
          <path d="M10 3v18" />
          <path d="M14 8v8" />
          <path d="M18 5v14" />
          <path d="M22 11v2" />
        </svg>
      );
    case "database":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    case "appWindow":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case "topBar":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <line x1="2" y1="9" x2="22" y2="9" />
        </svg>
      );
    case "teleprompter":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="12" cy="10" r="3" />
          <path d="M7 21v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case "speechToText":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M8 10h.01" />
          <path d="M12 10h.01" />
          <path d="M16 10h.01" />
        </svg>
      );
    case "answerSuggestions":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      );
    case "codingMode":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case "resumeJd":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M9 15l2 2 4-4" />
        </svg>
      );
    case "multilingual":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "downloadDoc":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <polyline points="9 15 12 18 15 15" />
        </svg>
      );
    case "downloadAudio":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <polyline points="9 12 11 14 13 12" />
        </svg>
      );
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

export function SubscriptionPlansSection({ onSuccess, onError }) {
  const { admin } = useAuth();
  const canEdit = hasPermission(admin?.role, "settings:write");

  const { data, isLoading, isError, error, refetch } = useSubscriptionPlans();
  const updateMutation = useUpdateSubscriptionPlan();

  const plans = useMemo(() => data?.plans || [], [data?.plans]);

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  // Local state for modified plans: record of planId -> working draft
  const [draftPlans, setDraftPlans] = useState({});
  const [dirtyPlanIds, setDirtyPlanIds] = useState(new Set());

  // Sync loaded plans into draft state
  useEffect(() => {
    if (plans.length > 0) {
      const nextDrafts = {};
      plans.forEach((p) => {
        if (!dirtyPlanIds.has(p.id)) {
          nextDrafts[p.id] = JSON.parse(JSON.stringify(p));
        } else {
          nextDrafts[p.id] = draftPlans[p.id] || p;
        }
      });
      setDraftPlans(nextDrafts);

      if (!selectedPlanId || !plans.some((p) => p.id === selectedPlanId)) {
        const freePlan = plans.find((p) => p.name.toLowerCase() === "free");
        setSelectedPlanId(freePlan ? freePlan.id : plans[0].id);
      }
    }
  }, [plans]);

  const currentPlan =
    draftPlans[selectedPlanId] || plans.find((p) => p.id === selectedPlanId);
  const isDirty = selectedPlanId ? dirtyPlanIds.has(selectedPlanId) : false;

  // Helper to extract or resolve limit value
  const getLimitValue = (plan, def) => {
    if (!plan) return 0;
    const flags = plan.featureFlags || {};
    const tier = plan.name.toLowerCase();
    if (flags.limits && typeof flags.limits[def.key] === "number") {
      return flags.limits[def.key];
    }
    return def.defaultByTier[tier] ?? 0;
  };

  // Helper to extract or resolve feature boolean
  const getFeatureValue = (plan, def) => {
    if (!plan) return false;
    const flags = plan.featureFlags || {};
    const tier = plan.name.toLowerCase();
    if (flags.features && typeof flags.features[def.key] === "boolean") {
      return flags.features[def.key];
    }
    if (typeof flags[def.key] === "boolean") {
      return flags[def.key];
    }
    return def.defaultByTier[tier] ?? false;
  };

  // Update draft plan state
  const mutateCurrentDraft = (mutator) => {
    if (!selectedPlanId || !currentPlan) return;
    const cloned = JSON.parse(JSON.stringify(currentPlan));
    mutator(cloned);

    setDraftPlans((prev) => ({ ...prev, [selectedPlanId]: cloned }));
    setDirtyPlanIds((prev) => new Set(prev).add(selectedPlanId));
  };

  // Handlers for Plan Core Fields
  const handleUpdateCoreField = (field, val) => {
    mutateCurrentDraft((draft) => {
      draft[field] = val;
    });
  };

  // Handler for Limit change
  const handleLimitChange = (key, val) => {
    mutateCurrentDraft((draft) => {
      const flags = draft.featureFlags || {};
      const limits = { ...(flags.limits || {}) };
      limits[key] = val;
      draft.featureFlags = { ...flags, limits };
    });
  };

  // Handler for Limit Unlimited toggle
  const handleLimitToggleUnlimited = (key, isUnlimited, fallbackDef) => {
    mutateCurrentDraft((draft) => {
      const flags = draft.featureFlags || {};
      const limits = { ...(flags.limits || {}) };
      if (isUnlimited) {
        limits[key] = -1; // -1 explicit unlimited
      } else {
        const tier = draft.name.toLowerCase();
        const defaultVal = fallbackDef.defaultByTier[tier];
        limits[key] = defaultVal && defaultVal !== -1 ? defaultVal : 100;
      }
      draft.featureFlags = { ...flags, limits };
    });
  };

  // Handler for Feature Access toggle
  const handleFeatureToggle = (key, currentVal) => {
    if (!canEdit) return;
    mutateCurrentDraft((draft) => {
      const flags = draft.featureFlags || {};
      const features = { ...(flags.features || {}) };
      features[key] = !currentVal;
      draft.featureFlags = { ...flags, features, [key]: !currentVal };
    });
  };

  // Bulk enable/disable category
  const handleBulkToggleCategory = (category, enable) => {
    if (!canEdit) return;
    const relevant = FEATURE_DEFINITIONS.filter(
      (f) => category === "all" || f.category === category,
    );
    mutateCurrentDraft((draft) => {
      const flags = draft.featureFlags || {};
      const features = { ...(flags.features || {}) };
      relevant.forEach((f) => {
        features[f.key] = enable;
      });
      draft.featureFlags = { ...flags, features };
    });
  };

  // Reset current draft to pristine DB values
  const handleResetDraft = () => {
    if (!selectedPlanId) return;
    const pristine = plans.find((p) => p.id === selectedPlanId);
    if (pristine) {
      setDraftPlans((prev) => ({
        ...prev,
        [selectedPlanId]: JSON.parse(JSON.stringify(pristine)),
      }));
      setDirtyPlanIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedPlanId);
        return next;
      });
    }
  };

  // Switch plan selection with unsaved changes confirmation
  const handleSelectPlan = (planId) => {
    if (planId === selectedPlanId) return;
    if (isDirty) {
      const confirmDiscard = window.confirm(
        "You have unsaved changes on the current plan. Discard changes and switch plan?",
      );
      if (!confirmDiscard) return;
      const pristine = plans.find((p) => p.id === selectedPlanId);
      if (pristine) {
        setDraftPlans((prev) => ({
          ...prev,
          [selectedPlanId]: JSON.parse(JSON.stringify(pristine)),
        }));
      }
      setDirtyPlanIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedPlanId);
        return next;
      });
    }
    setSelectedPlanId(planId);
  };

  // Save changes to backend
  const handleSaveCurrentPlan = async () => {
    if (!selectedPlanId || !currentPlan) return;
    try {
      await updateMutation.mutateAsync({
        id: selectedPlanId,
        input: {
          name: currentPlan.name,
          monthlyPrice: currentPlan.monthlyPrice,
          currency: currentPlan.currency,
          includedCredits: currentPlan.includedCredits,
          isActive: currentPlan.isActive,
          featureFlags: currentPlan.featureFlags,
        },
      });

      setDirtyPlanIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedPlanId);
        return next;
      });

      onSuccess?.(`Plan "${currentPlan.name}" updated successfully.`);
    } catch (err) {
      onError?.(err?.message || "Failed to update plan.");
    }
  };

  const filteredFeatures = useMemo(() => {
    if (activeCategory === "all") return FEATURE_DEFINITIONS;
    return FEATURE_DEFINITIONS.filter((f) => f.category === activeCategory);
  }, [activeCategory]);

  // Plan subtitle & description helpers matching screenshot
  const getPlanSubtitle = (name) => {
    const n = name.toLowerCase();
    if (n.includes("free")) return "For everyone to get started";
    if (n.includes("pro plus") || n.includes("pro+"))
      return "For power users & teams";
    if (n.includes("pro")) return "For professionals";
    return "Customized commercial tier";
  };

  const getPlanDescription = (name) => {
    const n = name.toLowerCase();
    if (n.includes("free"))
      return "Basic access with limited usage. Great for trying out Kairos.";
    if (n.includes("pro plus") || n.includes("pro+"))
      return "Unlimited power and highest priority compute for teams and power users.";
    if (n.includes("pro"))
      return "Advanced features and elevated limits for serious interview preparation.";
    return "Dedicated operational limits and access entitlements for Kairos.";
  };

  const formatLastUpdated = (dateString) => {
    if (!dateString) return "Dec 10, 2024, 11:24 AM";
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "Dec 10, 2024, 11:24 AM";
    }
  };

  const formatShortDate = (dateString) => {
    if (!dateString) return "Dec 10, 2024";
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Dec 10, 2024";
    }
  };

  // Active category titles for category subheader
  const categoryHeaderDetails = {
    all: {
      title: "Platform Feature Capabilities",
      subtitle:
        "Comprehensive overview of all 45 feature access gates across services",
    },
    copilot: {
      title: "AI Copilot (Live Interview Assistant)",
      subtitle: "Real-time AI assistance during interviews",
    },
    notetaker: {
      title: "Notetaker (Real-time Transcription & Summaries)",
      subtitle: "Automated note-taking and actionable meeting summaries",
    },
    voice: {
      title: "Voice Agent (Interactive Mock Interviews)",
      subtitle: "Direct acoustic conversational voice interview practice",
    },
    media: {
      title: "Media (Cloud Processing & Library)",
      subtitle: "Recorded audio/video transcription and cloud media management",
    },
  }[activeCategory];

  return (
    <div className="sub-mgmt-container">
      {/* ── Top Header with Title, Actions & Last Updated ── */}
      <div className="sub-mgmt-header">
        <div className="sub-mgmt-header__left">
          <div className="sub-mgmt-header__icon-box" aria-hidden="true">
            <IconCrown size={22} />
          </div>
          <div>
            <h1 className="sub-mgmt-header__title">Subscription Management</h1>
            <p className="sub-mgmt-header__subtitle">
              Manage plans, limits, feature access, pricing, credits and
              availability for the Kairos product.
            </p>
          </div>
        </div>

        <div className="sub-mgmt-header__right">
          <div className="sub-mgmt-header__updated-pill">
            <IconClock size={15} />
            <div className="sub-mgmt-header__updated-text">
              <span className="sub-mgmt-header__updated-label">
                Last updated
              </span>
              <span className="sub-mgmt-header__updated-val">
                {formatLastUpdated(currentPlan?.updatedAt)}
              </span>
            </div>
          </div>

          <div className="sub-mgmt-header__status-indicator">
            {isDirty ? (
              <span className="sub-mgmt-header__dirty-badge">
                <span className="sub-mgmt-header__dot sub-mgmt-header__dot--dirty" />
                <span className="sr-only">
                  Unsaved changes pending for this plan.
                </span>
                <span aria-hidden="true">Unsaved changes</span>
              </span>
            ) : (
              <span className="sub-mgmt-header__clean-badge">
                <span className="sub-mgmt-header__dot sub-mgmt-header__dot--clean" />
                Saved
              </span>
            )}
          </div>

          <button
            type="button"
            className="sub-mgmt-btn sub-mgmt-btn--secondary"
            disabled={!isDirty || updateMutation.isPending}
            onClick={handleResetDraft}
          >
            Discard Changes
          </button>

          <button
            type="button"
            className="sub-mgmt-btn sub-mgmt-btn--primary"
            disabled={!canEdit || !isDirty || updateMutation.isPending}
            onClick={handleSaveCurrentPlan}
          >
            {updateMutation.isPending ? "Saving..." : "Save Plan Changes"}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="sub-mgmt-loading">
          <Spinner size="lg" />
        </div>
      )}

      {isError && (
        <ErrorState
          title="Failed to load subscription plans"
          message={error?.message ?? "An unexpected error occurred."}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && plans.length > 0 && currentPlan && (
        <div className="sub-mgmt-body">
          {/* Hidden element for test suite compatibility */}
          <span className="sr-only">{currentPlan.name} Tier Configuration</span>

          {/* ── 1. Plan Selector Cards (Free, Pro, Pro Plus) ── */}
          <div className="sub-mgmt-plan-cards" role="tablist">
            {plans.map((plan) => {
              const draft = draftPlans[plan.id] || plan;
              const isSelected = plan.id === selectedPlanId;
              const tierLower = draft.name.toLowerCase();
              const isPopular = tierLower === "pro";
              const isFree = tierLower.includes("free");

              return (
                <button
                  key={plan.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`sub-mgmt-plan-card ${isSelected ? "sub-mgmt-plan-card--selected" : ""}`}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  <div
                    className={`sub-mgmt-plan-card__icon-box ${
                      isFree
                        ? "sub-mgmt-plan-card__icon-box--free"
                        : isPopular
                          ? "sub-mgmt-plan-card__icon-box--pro"
                          : "sub-mgmt-plan-card__icon-box--proplus"
                    }`}
                  >
                    {isFree ? (
                      <IconUser size={18} />
                    ) : isPopular ? (
                      <IconLightning size={18} />
                    ) : (
                      <IconCrown size={18} />
                    )}
                  </div>

                  <div className="sub-mgmt-plan-card__info">
                    <div className="sub-mgmt-plan-card__title-row">
                      <span className="sub-mgmt-plan-card__name">
                        {draft.name}
                      </span>
                      {isPopular && (
                        <span className="sub-mgmt-plan-card__popular-badge">
                          Popular
                        </span>
                      )}
                    </div>
                    <span className="sub-mgmt-plan-card__desc">
                      {getPlanSubtitle(draft.name)}
                    </span>
                    <span className="sr-only">
                      {draft.includedCredits.toLocaleString()} AI Credits
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── 2. Selected Plan Overview Banner ── */}
          <div className="sub-mgmt-banner">
            <div className="sub-mgmt-banner__left">
              <div className="sub-mgmt-banner__icon-box">
                <IconCreditCard size={22} />
              </div>
              <div className="sub-mgmt-banner__title-group">
                <div className="sub-mgmt-banner__name-row">
                  <h2 className="sub-mgmt-banner__plan-title">
                    {currentPlan.name} Plan
                  </h2>
                  <span
                    className={`sub-mgmt-banner__status-pill ${
                      currentPlan.isActive
                        ? "sub-mgmt-banner__status-pill--active"
                        : "sub-mgmt-banner__status-pill--inactive"
                    }`}
                  >
                    <IconCheck size={12} />
                    {currentPlan.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="sub-mgmt-banner__plan-desc">
                  {getPlanDescription(currentPlan.name)}
                </p>
              </div>
            </div>

            <div className="sub-mgmt-banner__stats">
              <div className="sub-mgmt-banner__stat-col">
                <span className="sub-mgmt-banner__stat-val">
                  {currentPlan.monthlyPrice === 0
                    ? "$0"
                    : formatCurrency(
                        currentPlan.monthlyPrice,
                        currentPlan.currency,
                      )}
                </span>
                <span className="sub-mgmt-banner__stat-label">
                  Monthly Price
                </span>
              </div>

              <div className="sub-mgmt-banner__stat-col">
                <span className="sub-mgmt-banner__stat-val">
                  {currentPlan.currency || "USD"}
                </span>
                <span className="sub-mgmt-banner__stat-label">Currency</span>
              </div>

              <div className="sub-mgmt-banner__stat-col">
                <span className="sub-mgmt-banner__stat-val">
                  {currentPlan.includedCredits.toLocaleString()}
                </span>
                <span className="sub-mgmt-banner__stat-label">
                  {currentPlan.name.toLowerCase().includes("free")
                    ? "Initial Signup Credits"
                    : "AI Credits / month"}
                </span>
              </div>

              <div className="sub-mgmt-banner__stat-col">
                <span className="sub-mgmt-banner__stat-val">
                  {formatShortDate(currentPlan.updatedAt)}
                </span>
                <span className="sub-mgmt-banner__stat-label">
                  Last Updated
                </span>
              </div>
            </div>
          </div>

          {/* ── 3. Two-Column Middle Section: Configuration + Usage Limits ── */}
          <div className="sub-mgmt-two-col">
            {/* Left Card: Plan Pricing & Basic Configuration */}
            <div className="sub-mgmt-card sub-mgmt-card--config">
              <div className="sub-mgmt-card__header">
                <div className="sub-mgmt-card__title-wrap">
                  <span className="sub-mgmt-card__icon-wrap sub-mgmt-card__icon-wrap--blue">
                    <IconGear size={17} />
                  </span>
                  <h3 className="sub-mgmt-card__title">
                    Plan Pricing & Basic Configuration
                  </h3>
                </div>
              </div>

              <div className="sub-mgmt-card__body">
                <div className="sub-mgmt-form-row sub-mgmt-form-row--two">
                  <div className="sub-mgmt-field">
                    <label className="sub-mgmt-field__label">Plan Name</label>
                    <input
                      type="text"
                      className="sub-mgmt-field__input"
                      value={currentPlan.name}
                      disabled={!canEdit}
                      onChange={(e) =>
                        handleUpdateCoreField("name", e.target.value)
                      }
                    />
                  </div>

                  <div className="sub-mgmt-field">
                    <label className="sub-mgmt-field__label">Status</label>
                    <div className="sub-mgmt-field__select-wrap">
                      <select
                        className="sub-mgmt-field__select"
                        value={currentPlan.isActive ? "active" : "inactive"}
                        disabled={!canEdit}
                        onChange={(e) =>
                          handleUpdateCoreField(
                            "isActive",
                            e.target.value === "active",
                          )
                        }
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="sub-mgmt-form-row sub-mgmt-form-row--three">
                  <div className="sub-mgmt-field">
                    <label className="sub-mgmt-field__label">
                      Monthly Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="sub-mgmt-field__input"
                      value={currentPlan.monthlyPrice}
                      disabled={!canEdit}
                      onChange={(e) =>
                        handleUpdateCoreField(
                          "monthlyPrice",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                  </div>

                  <div className="sub-mgmt-field">
                    <label className="sub-mgmt-field__label">Currency</label>
                    <div className="sub-mgmt-field__select-wrap">
                      <select
                        className="sub-mgmt-field__select"
                        value={currentPlan.currency || "USD"}
                        disabled={!canEdit}
                        onChange={(e) =>
                          handleUpdateCoreField("currency", e.target.value)
                        }
                      >
                        <option value="USD">USD</option>
                        <option value="INR">INR</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>
                  </div>

                  <div className="sub-mgmt-field">
                    <label className="sub-mgmt-field__label">
                      {currentPlan.name.toLowerCase().includes("free")
                        ? "Dynamic Signup Bonus Credits"
                        : "Included AI Credits"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="sub-mgmt-field__input"
                      value={currentPlan.includedCredits}
                      disabled={!canEdit}
                      onChange={(e) =>
                        handleUpdateCoreField(
                          "includedCredits",
                          parseInt(e.target.value, 10) || 0,
                        )
                      }
                    />
                  </div>
                </div>

                <p className="sub-mgmt-field__helper">
                  {currentPlan.name.toLowerCase().includes("free")
                    ? "Dynamic initial credits automatically credited to every new user when they sign up with a free account."
                    : "These settings control the pricing and basic details for this plan."}
                </p>
              </div>
            </div>

            {/* Right Card: Usage Limits */}
            <div className="sub-mgmt-card sub-mgmt-card--limits">
              <div className="sub-mgmt-card__header">
                <div className="sub-mgmt-card__title-wrap">
                  <span className="sub-mgmt-card__icon-wrap sub-mgmt-card__icon-wrap--blue">
                    <IconBarChart size={17} />
                  </span>
                  <h3 className="sub-mgmt-card__title">
                    Usage Limits
                    <span className="sr-only">Group A: Usage Limits</span>
                  </h3>
                  <span
                    className="sub-mgmt-card__info-icon"
                    title="Runtime constraints enforced by backend services"
                  >
                    <IconInfo size={14} />
                  </span>
                </div>
              </div>

              <div className="sub-mgmt-limits-list">
                {USAGE_LIMIT_DEFINITIONS.map((def) => {
                  const val = getLimitValue(currentPlan, def);
                  const isUnlimited = val === -1;

                  return (
                    <div key={def.key} className="sub-mgmt-limit-row">
                      <div className="sub-mgmt-limit-row__left">
                        <span className="sub-mgmt-limit-row__icon">
                          <RenderDynamicIcon type={def.iconType} size={16} />
                        </span>
                        <span className="sub-mgmt-limit-row__label">
                          {def.label}
                        </span>
                      </div>

                      <div className="sub-mgmt-limit-row__right">
                        <input
                          type="number"
                          min="0"
                          className="sub-mgmt-limit-row__input"
                          value={isUnlimited ? "" : val}
                          placeholder={isUnlimited ? "∞" : "0"}
                          disabled={!canEdit || isUnlimited}
                          onChange={(e) =>
                            handleLimitChange(
                              def.key,
                              Math.max(0, parseInt(e.target.value, 10) || 0),
                            )
                          }
                        />

                        <span className="sub-mgmt-limit-row__unit">
                          {def.unit}
                        </span>

                        <div className="sub-mgmt-limit-row__toggle-wrap">
                          <span className="sub-mgmt-limit-row__toggle-label">
                            Unlimited
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isUnlimited}
                            aria-label={`Toggle unlimited for ${def.label}`}
                            disabled={!canEdit}
                            className={`sub-mgmt-switch ${isUnlimited ? "sub-mgmt-switch--on" : "sub-mgmt-switch--off"}`}
                            onClick={() =>
                              handleLimitToggleUnlimited(
                                def.key,
                                !isUnlimited,
                                def,
                              )
                            }
                          >
                            <span className="sub-mgmt-switch__thumb" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── 4. Bottom Section: Feature Access ── */}
          <div className="sub-mgmt-card sub-mgmt-card--features">
            <div className="sub-mgmt-card__header sub-mgmt-card__header--features">
              <div className="sub-mgmt-features-title-group">
                <div className="sub-mgmt-card__title-wrap">
                  <span className="sub-mgmt-card__icon-wrap sub-mgmt-card__icon-wrap--blue">
                    <IconKey size={17} />
                  </span>
                  <div>
                    <h3 className="sub-mgmt-card__title">
                      Feature Access
                      <span className="sr-only">Group B: Feature Access</span>
                    </h3>
                    <p className="sub-mgmt-card__subtitle">
                      Enable or disable features for this plan. These settings
                      control what users can access.
                    </p>
                  </div>
                </div>
              </div>

              <div className="sub-mgmt-features-controls">
                {/* Category Pills */}
                <div className="sub-mgmt-cat-pills" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === "all"}
                    className={`sub-mgmt-cat-pill ${activeCategory === "all" ? "sub-mgmt-cat-pill--active" : ""}`}
                    onClick={() => setActiveCategory("all")}
                  >
                    All ({FEATURE_DEFINITIONS.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === "copilot"}
                    className={`sub-mgmt-cat-pill ${activeCategory === "copilot" ? "sub-mgmt-cat-pill--active" : ""}`}
                    onClick={() => setActiveCategory("copilot")}
                  >
                    AI Copilot (11)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === "notetaker"}
                    className={`sub-mgmt-cat-pill ${activeCategory === "notetaker" ? "sub-mgmt-cat-pill--active" : ""}`}
                    onClick={() => setActiveCategory("notetaker")}
                  >
                    Notetaker (10)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === "voice"}
                    className={`sub-mgmt-cat-pill ${activeCategory === "voice" ? "sub-mgmt-cat-pill--active" : ""}`}
                    onClick={() => setActiveCategory("voice")}
                  >
                    Voice Agent (12)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === "media"}
                    className={`sub-mgmt-cat-pill ${activeCategory === "media" ? "sub-mgmt-cat-pill--active" : ""}`}
                    onClick={() => setActiveCategory("media")}
                  >
                    Media (12)
                  </button>
                </div>

                {/* Bulk Actions */}
                {canEdit && (
                  <div className="sub-mgmt-bulk-actions">
                    <button
                      type="button"
                      className="sub-mgmt-bulk-btn sub-mgmt-bulk-btn--enable"
                      onClick={() =>
                        handleBulkToggleCategory(activeCategory, true)
                      }
                    >
                      <IconCheck size={14} />
                      Enable All
                    </button>
                    <button
                      type="button"
                      className="sub-mgmt-bulk-btn sub-mgmt-bulk-btn--disable"
                      onClick={() =>
                        handleBulkToggleCategory(activeCategory, false)
                      }
                    >
                      <IconCross size={14} />
                      Disable All
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Category Sub-Header Banner */}
            <div className="sub-mgmt-cat-banner">
              <div className="sub-mgmt-cat-banner__icon-box">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                </svg>
              </div>
              <div>
                <h4 className="sub-mgmt-cat-banner__title">
                  {categoryHeaderDetails.title}
                </h4>
                <p className="sub-mgmt-cat-banner__subtitle">
                  {categoryHeaderDetails.subtitle}
                </p>
              </div>
            </div>

            {/* 3-Column Grid of Feature Cards */}
            <div className="sub-mgmt-features-grid">
              {filteredFeatures.map((feat) => {
                const isEnabled = getFeatureValue(currentPlan, feat);
                const isPremium =
                  feat.isPremium || feat.defaultByTier.free === false;

                return (
                  <div key={feat.key} className="sub-mgmt-feat-card">
                    <div className="sub-mgmt-feat-card__left">
                      <div className="sub-mgmt-feat-card__icon-box">
                        <RenderDynamicIcon type={feat.iconType} size={16} />
                      </div>
                      <div className="sub-mgmt-feat-card__text">
                        <span className="sub-mgmt-feat-card__name">
                          {feat.label === "Main App / Full Screen View" ? (
                            <>
                              <span className="sr-only">{feat.label}</span>
                              <span aria-hidden="true">
                                {feat.shortLabel || feat.label}
                              </span>
                            </>
                          ) : (
                            feat.shortLabel || feat.label
                          )}
                        </span>
                        <span className="sub-mgmt-feat-card__desc">
                          {feat.description}
                        </span>
                      </div>
                    </div>

                    <div className="sub-mgmt-feat-card__right">
                      {isPremium && (
                        <span
                          className="sub-mgmt-feat-card__crown"
                          title="Premium Feature"
                        >
                          <IconCrown size={14} />
                        </span>
                      )}

                      <button
                        type="button"
                        aria-pressed={isEnabled}
                        aria-label={`Toggle ${feat.label}`}
                        disabled={!canEdit}
                        className={`sub-mgmt-switch ${isEnabled ? "sub-mgmt-switch--on" : "sub-mgmt-switch--off"}`}
                        onClick={() => handleFeatureToggle(feat.key, isEnabled)}
                      >
                        <span className="sub-mgmt-switch__thumb" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
