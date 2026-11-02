import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hasPermission } from "@/features/auth/rbac";
import { ErrorState, Skeleton } from "@/components";
import {
  fetchSubscriptionPlans,
  updateSubscriptionPlan,
  fetchPlatformPricing,
  updatePlatformPricing,
} from "@/features/settings";
import {
  CURRENCIES,
  DEFAULT_CURRENCY_RATES,
  convertFromUSD,
  convertToUSD,
  getCreditsPerUSD,
  setCreditsPerUSD,
  updateExchangeRate,
  resetExchangeRate,
} from "../../components/subscription/currencyData";
import "./SubscriptionsPage.css";

// Default plan definitions matching user frontend
const FALLBACK_PLANS = [
  {
    id: "FREE",
    name: "Free Plan",
    badge: "Starter Trial",
    priceMonthly: 0,
    priceAnnual: 0,
    copilotMinutes: 30,
    notetakerMinutes: 30,
    voiceMinutes: 10,
    downloadLimit: 2,
    uploadMaxMb: 100,
    storageDays: 7,
    hasTopBar: false,
    hasTeleprompter: false,
    canDownloadPdf: true,
    canDownloadAudio: true,
    features: [
      "Unlimited file uploads (zero credit deduction)",
      "2 included file downloads (expandable with credits)",
      "30 mins AI Copilot practice",
      "10 mins Voice Simulator interview",
      "30 mins Notetaker transcripts",
      "1 Resume profile extraction",
    ],
  },
  {
    id: "PRO",
    name: "Pro Plan",
    badge: "Most Popular",
    priceMonthly: 29,
    priceAnnual: 278,
    copilotMinutes: 600,
    notetakerMinutes: 900,
    voiceMinutes: 90,
    downloadLimit: 25,
    uploadMaxMb: 500,
    storageDays: 60,
    hasTopBar: true,
    hasTeleprompter: false,
    canDownloadPdf: true,
    canDownloadAudio: true,
    features: [
      "Unlimited file uploads (zero credit deduction)",
      "25 included file downloads (expandable with credits)",
      "10 Hours (600 mins) AI Copilot assistance",
      "1.5 Hours (90 mins) Interactive Voice Simulator",
      "15 Hours (900 mins) Meeting Notetaker & Summary",
      "5 Resume profiles extraction",
      "Top-bar real-time overlay support",
    ],
  },
  {
    id: "PRO_PLUS",
    name: "Pro Plus Plan",
    badge: "Ultimate Power",
    priceMonthly: 79,
    priceAnnual: 758,
    copilotMinutes: 2400,
    notetakerMinutes: 3000,
    voiceMinutes: 300,
    downloadLimit: 100,
    uploadMaxMb: 2048,
    storageDays: -1,
    hasTopBar: true,
    hasTeleprompter: true,
    canDownloadPdf: true,
    canDownloadAudio: true,
    features: [
      "Unlimited file uploads (zero credit deduction)",
      "100 included file downloads (expandable with credits)",
      "40 Hours (2400 mins) AI Copilot assistance",
      "5 Hours (300 mins) Interactive Voice Simulator",
      "50 Hours (3000 mins) Meeting Notetaker & Summary",
      "Unlimited Resume profiles extraction",
      "Floating Eye-line teleprompter & Top-bar overlay",
      "Full audio recording and transcript exports",
      "Unlimited cloud retention storage",
    ],
  },
];

export function SubscriptionsPage() {
  const { admin } = useAuth();
  const hasReadPermission = hasPermission(admin?.role, "settings:read");
  const hasWritePermission = hasPermission(admin?.role, "settings:write");

  // Navigation tab
  const [activeTab, setActiveTab] = useState("preview"); // "preview" | "plans" | "deductions" | "buy-credits"

  // Live data states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Plans data
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [selectedPlanId, setSelectedPlanId] = useState("PRO");

  // Customer Preview controls
  const [previewCycle, setPreviewCycle] = useState("monthly"); // "monthly" | "yearly"
  const [previewCurrency, setPreviewCurrency] = useState("USD");
  const [previewPaygAmount, setPreviewPaygAmount] = useState("50");

  // Credit Deduction Rates (Supports Minutes, Hours, or Days)
  const [deductions, setDeductions] = useState({
    downloadCreditCost: 25,
    mediaUploadCreditCost: 0,
    questionAnswerCreditCost: 2,
    copilotBillingUnit: "hours",
    copilotIntervalMinutes: 1,
    copilotCreditCost: 50,
    copilotHourlyRate: 50,
    voiceBillingUnit: "hours",
    voiceAgentIntervalMinutes: 1,
    voiceAgentCreditCost: 50,
    voiceHourlyRate: 50,
    notetakerBillingUnit: "hours",
    notetakerIntervalMinutes: 1,
    notetakerCreditCost: 50,
    notetakerHourlyRate: 50,
  });

  // Plan quota editing units (minutes | hours | days)
  const [quotaUnits, setQuotaUnits] = useState({
    copilot: "minutes",
    notetaker: "minutes",
    voice: "minutes",
  });

  // Buy Credits Config
  const [buyCreditsConfig, setBuyCreditsConfig] = useState({
    creditsPerUSD: 250,
    unitPrice: 1.0,
    currencyCode: "USD",
  });

  // Currency Search in table
  const [currencySearch, setCurrencySearch] = useState("");

  // Edit Plan Form State (for Plan Tiers & Quota Editor)
  const currentEditingPlan = useMemo(() => {
    return plans.find((p) => p.id === selectedPlanId) || plans[0] || FALLBACK_PLANS[0];
  }, [plans, selectedPlanId]);

  const [planForm, setPlanForm] = useState(currentEditingPlan);

  // Editing price strings bound to active previewCurrency
  const [editingMonthlyPrice, setEditingMonthlyPrice] = useState("");
  const [editingAnnualPrice, setEditingAnnualPrice] = useState("");

  // Rate Matrix inline editing state & refresh counter
  const [customRatesVersion, setCustomRatesVersion] = useState(0);
  const [editingRateCode, setEditingRateCode] = useState(null);
  const [tempRateValue, setTempRateValue] = useState("");

  // Buy Credits Interactive Yield Calculator state
  const [calcCurrency, setCalcCurrency] = useState("INR");
  const [calcAmount, setCalcAmount] = useState("500");

  useEffect(() => {
    if (currentEditingPlan) {
      setPlanForm({ ...currentEditingPlan });
    }
  }, [currentEditingPlan]);

  // Synchronize price editing input values whenever selected plan, currency or exchange rates change
  useEffect(() => {
    if (currentEditingPlan) {
      if (previewCurrency === "USD") {
        setEditingMonthlyPrice(currentEditingPlan.priceMonthly !== undefined ? String(currentEditingPlan.priceMonthly) : "0");
        setEditingAnnualPrice(currentEditingPlan.priceAnnual !== undefined ? String(currentEditingPlan.priceAnnual) : "0");
      } else {
        const convMonth = Math.round(convertFromUSD(currentEditingPlan.priceMonthly || 0, previewCurrency));
        const convAnnual = Math.round(convertFromUSD(currentEditingPlan.priceAnnual || 0, previewCurrency));
        setEditingMonthlyPrice(String(convMonth));
        setEditingAnnualPrice(String(convAnnual));
      }
    }
  }, [currentEditingPlan, previewCurrency, customRatesVersion]);

  // Handle Monthly Price edits in active currency
  const handleMonthlyPriceChange = (e) => {
    const inputStr = e.target.value;
    setEditingMonthlyPrice(inputStr);
    const numVal = Number(inputStr) || 0;

    let baseUSD = numVal;
    if (previewCurrency !== "USD") {
      baseUSD = convertToUSD(numVal, previewCurrency);
    }
    baseUSD = Math.round(baseUSD * 100) / 100;

    // Automatic 20% off annual calculation
    const annualUSD = Math.round(baseUSD * 12 * 0.8);
    const annualInCurr = previewCurrency === "USD" ? annualUSD : Math.round(convertFromUSD(annualUSD, previewCurrency));
    setEditingAnnualPrice(String(annualInCurr));

    setPlanForm((prev) => ({
      ...prev,
      priceMonthly: baseUSD,
      priceAnnual: annualUSD,
    }));
  };

  // Handle Annual Price edits in active currency
  const handleAnnualPriceChange = (e) => {
    const inputStr = e.target.value;
    setEditingAnnualPrice(inputStr);
    const numVal = Number(inputStr) || 0;

    let baseUSD = numVal;
    if (previewCurrency !== "USD") {
      baseUSD = convertToUSD(numVal, previewCurrency);
    }
    baseUSD = Math.round(baseUSD * 100) / 100;

    setPlanForm((prev) => ({
      ...prev,
      priceAnnual: baseUSD,
    }));
  };

  // Recalculate 20% annual discount in active currency
  const handleRecalculateAnnualDiscount = () => {
    const currentMonthNum = Number(editingMonthlyPrice) || 0;
    const annualInCurr = Math.round(currentMonthNum * 12 * 0.8);
    setEditingAnnualPrice(String(annualInCurr));

    let baseUSD = annualInCurr;
    if (previewCurrency !== "USD") {
      baseUSD = convertToUSD(annualInCurr, previewCurrency);
    }
    baseUSD = Math.round(baseUSD * 100) / 100;

    setPlanForm((prev) => ({
      ...prev,
      priceAnnual: baseUSD,
    }));
  };

  // Inline Exchange Rate Matrix Handlers
  const handleStartEditRate = (currency) => {
    setEditingRateCode(currency.code);
    setTempRateValue(String(currency.rate));
  };

  const handleSaveExchangeRate = (currencyCode) => {
    const numRate = Number(tempRateValue);
    if (isNaN(numRate) || numRate <= 0) {
      showNotification("Please enter a valid positive exchange rate.", "error");
      return;
    }
    updateExchangeRate(currencyCode, numRate);
    setCustomRatesVersion((v) => v + 1);
    setEditingRateCode(null);
    showNotification(`✅ Updated exchange rate for ${currencyCode}: 1 USD = ${numRate}`);
  };

  const handleResetExchangeRate = (currencyCode) => {
    resetExchangeRate(currencyCode);
    setCustomRatesVersion((v) => v + 1);
    if (editingRateCode === currencyCode) {
      setEditingRateCode(null);
    }
    showNotification(`🔄 Reset exchange rate for ${currencyCode} to default market baseline.`);
  };

  // Load backend data on mount
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Subscription Plans
      const plansRes = await fetchSubscriptionPlans();
      if (plansRes && Array.isArray(plansRes.plans || plansRes)) {
        const incoming = plansRes.plans || plansRes;
        if (incoming.length > 0) {
          // Merge with FALLBACK_PLANS so Free, Pro, and Pro Plus maintain standard structure
          const merged = FALLBACK_PLANS.map((fb) => {
            const found = incoming.find(
              (p) => String(p.id).toUpperCase() === fb.id || String(p.tier).toUpperCase() === fb.id
            );
            if (!found) return fb;
            return {
              ...fb,
              ...found,
              name: found.name || fb.name,
              badge: found.badge || fb.badge,
              priceMonthly: Number(found.monthlyPrice ?? found.priceMonthly ?? fb.priceMonthly),
              priceAnnual: Number(found.priceAnnual ?? found.priceYearly ?? fb.priceAnnual ?? Math.round(Number(found.priceMonthly || fb.priceMonthly) * 12 * 0.8)),
              downloadLimit: Number(found.downloadLimit ?? fb.downloadLimit),
              includedCredits: Number(found.includedCredits ?? found.copilotMinutes ?? fb.copilotMinutes),
              copilotMinutes: Number(found.copilotMinutes ?? fb.copilotMinutes),
              notetakerMinutes: Number(found.notetakerMinutes ?? fb.notetakerMinutes),
              voiceMinutes: Number(found.voiceMinutes ?? fb.voiceMinutes),
              uploadMaxMb: Number(found.uploadMaxMb ?? fb.uploadMaxMb),
              storageDays: Number(found.storageDays ?? fb.storageDays),
              hasTopBar: found.hasTopBar !== undefined ? Boolean(found.hasTopBar) : fb.hasTopBar,
              hasTeleprompter: found.hasTeleprompter !== undefined ? Boolean(found.hasTeleprompter) : fb.hasTeleprompter,
              canDownloadPdf: found.canDownloadPdf !== undefined ? Boolean(found.canDownloadPdf) : fb.canDownloadPdf,
              canDownloadAudio: found.canDownloadAudio !== undefined ? Boolean(found.canDownloadAudio) : fb.canDownloadAudio,
            };
          });
          setPlans(merged);
        }
      }

      // 2. Fetch Pricing & Deduction Rates
      const pricingRes = await fetchPlatformPricing();
      if (pricingRes?.pricing) {
        const p = pricingRes.pricing;
        setBuyCreditsConfig({
          creditsPerUSD: Number(p.creditsPerUnit ?? 250),
          unitPrice: Number(p.unitPrice ?? 1.0),
          currencyCode: p.currencyCode || "USD",
        });
        if (p.creditsPerUnit) {
          setCreditsPerUSD(p.creditsPerUnit);
        }
        setDeductions((prev) => {
          const cUnit = p.copilotBillingUnit || prev.copilotBillingUnit || "hours";
          const cInterval = p.copilotIntervalMinutes !== undefined ? Math.max(1, Number(p.copilotIntervalMinutes)) : prev.copilotIntervalMinutes;
          const cCost = cUnit === "minutes"
            ? (p.copilotCreditCost !== undefined ? Number(p.copilotCreditCost) : 2)
            : (p.copilotHourlyRate !== undefined ? Number(p.copilotHourlyRate) : (p.copilotCreditCost !== undefined ? Number(p.copilotCreditCost) : prev.copilotCreditCost));

          const vUnit = p.voiceBillingUnit || prev.voiceBillingUnit || "hours";
          const vInterval = p.voiceAgentIntervalMinutes !== undefined ? Math.max(1, Number(p.voiceAgentIntervalMinutes)) : prev.voiceAgentIntervalMinutes;
          const vCost = vUnit === "minutes"
            ? (p.voiceAgentCreditCost !== undefined ? Number(p.voiceAgentCreditCost) : 2)
            : (p.voiceHourlyRate !== undefined ? Number(p.voiceHourlyRate) : (p.voiceAgentCreditCost !== undefined ? Number(p.voiceAgentCreditCost) : prev.voiceAgentCreditCost));

          const nUnit = p.notetakerBillingUnit || prev.notetakerBillingUnit || "hours";
          const nInterval = p.notetakerIntervalMinutes !== undefined ? Math.max(1, Number(p.notetakerIntervalMinutes)) : prev.notetakerIntervalMinutes;
          const nCost = nUnit === "minutes"
            ? (p.notetakerCreditCost !== undefined ? Number(p.notetakerCreditCost) : 2)
            : (p.notetakerHourlyRate !== undefined ? Number(p.notetakerHourlyRate) : (p.notetakerCreditCost !== undefined ? Number(p.notetakerCreditCost) : prev.notetakerCreditCost));

          return {
            ...prev,
            downloadCreditCost: p.downloadCreditCost !== undefined ? Number(p.downloadCreditCost) : prev.downloadCreditCost,
            mediaUploadCreditCost: p.mediaUploadCreditCost !== undefined ? Number(p.mediaUploadCreditCost) : 0,
            questionAnswerCreditCost: p.questionAnswerCreditCost !== undefined ? Number(p.questionAnswerCreditCost) : prev.questionAnswerCreditCost,
            copilotBillingUnit: cUnit,
            copilotIntervalMinutes: cInterval,
            copilotCreditCost: cCost,
            copilotHourlyRate: cUnit === "minutes" ? Math.ceil((cCost * 60) / cInterval) : cCost,
            voiceBillingUnit: vUnit,
            voiceAgentIntervalMinutes: vInterval,
            voiceAgentCreditCost: vCost,
            voiceHourlyRate: vUnit === "minutes" ? Math.ceil((vCost * 60) / vInterval) : vCost,
            notetakerBillingUnit: nUnit,
            notetakerIntervalMinutes: nInterval,
            notetakerCreditCost: nCost,
            notetakerHourlyRate: nUnit === "minutes" ? Math.ceil((nCost * 60) / nInterval) : nCost,
          };
        });
      }
    } catch (err) {
      console.warn("Notice: Loaded baseline configurations:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toast Helper
  const showNotification = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // ── Handle Save Plan Tiers ──────────────────────────────────────────────────
  const handleSavePlan = async (e) => {
    e?.preventDefault();
    if (!hasWritePermission) {
      showNotification("Permission denied: You do not have 'settings:write' permission.", "error");
      return;
    }

    setSaving(true);
    try {
      const updates = {
        name: planForm.name,
        badge: planForm.badge,
        monthlyPrice: Number(planForm.priceMonthly) || 0,
        priceMonthly: Number(planForm.priceMonthly) || 0,
        priceAnnual: Number(planForm.priceAnnual) || 0,
        downloadLimit: planForm.downloadLimit !== undefined ? Number(planForm.downloadLimit) : 0,
        includedCredits: Number(planForm.includedCredits ?? planForm.copilotMinutes) || 0,
        copilotMinutes: Number(planForm.copilotMinutes) || 0,
        notetakerMinutes: Number(planForm.notetakerMinutes) || 0,
        voiceMinutes: Number(planForm.voiceMinutes) || 0,
        uploadMaxMb: planForm.uploadMaxMb !== undefined ? Number(planForm.uploadMaxMb) : 100,
        storageDays: planForm.storageDays !== undefined ? Number(planForm.storageDays) : 7,
        hasTopBar: Boolean(planForm.hasTopBar),
        hasTeleprompter: Boolean(planForm.hasTeleprompter),
        canDownloadPdf: Boolean(planForm.canDownloadPdf),
        canDownloadAudio: Boolean(planForm.canDownloadAudio),
      };

      await updateSubscriptionPlan(planForm.id, updates);

      // Update state locally
      setPlans((prev) =>
        prev.map((p) => (p.id === planForm.id ? { ...p, ...updates } : p))
      );

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("copilot-credits-updated"));
        window.dispatchEvent(new CustomEvent("copilot-usage-updated"));
      }

      showNotification(`🎉 ${planForm.name} updated and persisted successfully!`);
    } catch (err) {
      showNotification(err?.message || "Failed to update subscription plan.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Handle Save Credit Deduction Rates ──────────────────────────────────────
  const handleSaveDeductions = async (e) => {
    e?.preventDefault();
    if (!hasWritePermission) {
      showNotification("Permission denied: You do not have 'settings:write' permission.", "error");
      return;
    }

    setSaving(true);
    try {
      const cUnit = deductions.copilotBillingUnit || "hours";
      const cInterval = Math.max(1, Number(deductions.copilotIntervalMinutes) || 1);
      const cCost = Math.max(0, Number(deductions.copilotCreditCost ?? deductions.copilotHourlyRate) || 0);

      const vUnit = deductions.voiceBillingUnit || "hours";
      const vInterval = Math.max(1, Number(deductions.voiceAgentIntervalMinutes) || 1);
      const vCost = Math.max(0, Number(deductions.voiceAgentCreditCost ?? deductions.voiceHourlyRate) || 0);

      const nUnit = deductions.notetakerBillingUnit || "hours";
      const nInterval = Math.max(1, Number(deductions.notetakerIntervalMinutes) || 1);
      const nCost = Math.max(0, Number(deductions.notetakerCreditCost ?? deductions.notetakerHourlyRate) || 0);

      const payload = {
        downloadCreditCost: Math.max(0, Number(deductions.downloadCreditCost) || 0),
        mediaUploadCreditCost: Math.max(0, Number(deductions.mediaUploadCreditCost) || 0),
        questionAnswerCreditCost: Math.max(0, Number(deductions.questionAnswerCreditCost ?? 2) || 0),
        copilotBillingUnit: cUnit,
        copilotIntervalMinutes: cInterval,
        copilotCreditCost: cCost,
        copilotHourlyRate: cUnit === "minutes" ? Math.ceil((cCost * 60) / cInterval) : cCost,
        voiceBillingUnit: vUnit,
        voiceAgentIntervalMinutes: vInterval,
        voiceAgentCreditCost: vCost,
        voiceHourlyRate: vUnit === "minutes" ? Math.ceil((vCost * 60) / vInterval) : vCost,
        notetakerBillingUnit: nUnit,
        notetakerIntervalMinutes: nInterval,
        notetakerCreditCost: nCost,
        notetakerHourlyRate: nUnit === "minutes" ? Math.ceil((nCost * 60) / nInterval) : nCost,
      };

      await updatePlatformPricing(payload);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("copilot-credit-rates-updated", { detail: payload }));
      }

      // Store in localStorage for instant synchronization across all frontend instances
      try {
        localStorage.setItem("admin_credit_deductions_config", JSON.stringify(payload));
      } catch (_) {}

      showNotification("✅ Action credit deduction rates updated successfully!");
    } catch (err) {
      showNotification(err?.message || "Failed to update deduction rates.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Handle Save Buy Credits Engine ──────────────────────────────────────────
  const handleSaveBuyCredits = async (e) => {
    e?.preventDefault();
    if (!hasWritePermission) {
      showNotification("Permission denied: You do not have 'settings:write' permission.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        creditsPerUnit: Number(buyCreditsConfig.creditsPerUSD),
        unitPrice: Number(buyCreditsConfig.unitPrice),
        currencyCode: buyCreditsConfig.currencyCode,
      };

      await updatePlatformPricing(payload);
      setCreditsPerUSD(Number(buyCreditsConfig.creditsPerUSD));

      try {
        localStorage.setItem("admin_buy_credits_config", JSON.stringify(payload));
      } catch (_) {}

      showNotification(`✅ Buy Credits base rate (1 USD = ${buyCreditsConfig.creditsPerUSD} Credits) updated!`);
    } catch (err) {
      showNotification(err?.message || "Failed to update Buy Credits engine.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Currency lookup helper
  const activeCurrencyObj = useMemo(() => {
    return (
      CURRENCIES.find((c) => c.code.toUpperCase() === previewCurrency.toUpperCase()) ||
      CURRENCIES[0]
    );
  }, [previewCurrency]);

  const currencySymbol = activeCurrencyObj.symbol;

  // Filtered Currencies for Table
  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.toLowerCase().trim();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
    );
  }, [currencySearch]);

  if (!hasReadPermission) {
    return (
      <div className="sub-admin-page">
        <ErrorState
          title="Access Restricted"
          message="You do not have permission to view or manage Subscriptions & Plans. Contact an Owner to request access."
        />
      </div>
    );
  }

  return (
    <div className="sub-admin-page">
      {/* Page Header */}
      <div className="sub-admin-header">
        <div className="sub-admin-header-titles">
          <div className="sub-admin-badge-tag">
            <i className="fa-solid fa-crown"></i>
            <span>SUBSCRIPTION &amp; CREDIT ENGINE</span>
          </div>
          <h1 className="sub-admin-title">Subscriptions &amp; Plans Management</h1>
          <p className="sub-admin-subtitle">
            Configure dynamic pricing tiers, customer quotas, per-action credit deduction rates,
            and live multi-currency conversions across 30 world currencies.
          </p>
        </div>

        {/* Global Currency & Theme Status Pill */}
        <div className="sub-admin-header-actions">
          <div className="sub-currency-pill-box">
            <span className="pill-box-label">Customer Preview Currency:</span>
            <div className="custom-currency-select-wrapper">
              <select
                className="sub-currency-dropdown"
                value={previewCurrency}
                onChange={(e) => setPreviewCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code} &bull; {c.symbol} ({c.name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`sub-admin-toast sub-admin-toast--${toast.type}`} role="alert">
          <div className="toast-icon">
            <i className={`fa-solid ${toast.type === "success" ? "fa-circle-check" : "fa-triangle-exclamation"}`}></i>
          </div>
          <div className="toast-message">{toast.message}</div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      )}

      {/* Tabs Navigation Bar */}
      <div className="sub-admin-tabs">
        <button
          type="button"
          className={`sub-tab-btn ${activeTab === "preview" ? "active" : ""}`}
          onClick={() => setActiveTab("preview")}
        >
          <i className="fa-solid fa-eye"></i>
          <span>Customer Live Preview (4 Cards)</span>
          <span className="tab-pill-indicator">Interactive</span>
        </button>

        <button
          type="button"
          className={`sub-tab-btn ${activeTab === "plans" ? "active" : ""}`}
          onClick={() => setActiveTab("plans")}
        >
          <i className="fa-solid fa-sliders"></i>
          <span>Plan Tiers &amp; Quotas Editor</span>
        </button>

        <button
          type="button"
          className={`sub-tab-btn ${activeTab === "deductions" ? "active" : ""}`}
          onClick={() => setActiveTab("deductions")}
        >
          <i className="fa-solid fa-bolt"></i>
          <span>Action Credit Deductions</span>
        </button>

        <button
          type="button"
          className={`sub-tab-btn ${activeTab === "buy-credits" ? "active" : ""}`}
          onClick={() => setActiveTab("buy-credits")}
        >
          <i className="fa-solid fa-coins"></i>
          <span>Buy Credits &amp; Multi-Currency (30)</span>
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="sub-admin-loading-state">
          <Skeleton height={240} />
          <Skeleton height={320} />
        </div>
      ) : (
        <div className="sub-admin-tab-content">
          {/* ========================================================================= */}
          {/* TAB 1: CUSTOMER LIVE PREVIEW (4 CARDS SECTION)                           */}
          {/* ========================================================================= */}
          {activeTab === "preview" && (
            <div className="sub-preview-section">
              {/* Preview Controls Bar */}
              <div className="sub-preview-control-bar">
                <div className="control-bar-left">
                  <div className="preview-indicator-badge">
                    <span className="live-dot"></span>
                    <span>Exact Customer Viewport Simulation</span>
                  </div>
                  <span className="preview-hint-text">
                    Displaying prices converted to <strong>{activeCurrencyObj.flag} {previewCurrency} ({activeCurrencyObj.name})</strong>
                  </span>
                </div>

                <div className="control-bar-right">
                  {/* Monthly vs Yearly Billing Switcher */}
                  <div className="billing-cycle-switch-container">
                    <button
                      type="button"
                      className={`cycle-toggle-btn ${previewCycle === "monthly" ? "active" : ""}`}
                      onClick={() => setPreviewCycle("monthly")}
                    >
                      Monthly Billing
                    </button>
                    <button
                      type="button"
                      className={`cycle-toggle-btn ${previewCycle === "yearly" ? "active" : ""}`}
                      onClick={() => setPreviewCycle("yearly")}
                    >
                      <span>Annual Billing</span>
                      <span className="cycle-discount-pill">Save 20%</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Cards Grid: Free, Pro, Pro Plus, Pay As You Go */}
              <div className="admin-plan-cards-grid">
                {/* 1. Free Plan */}
                {(() => {
                  const freePlan = plans.find((p) => p.id === "FREE") || FALLBACK_PLANS[0];
                  return (
                    <div className="admin-card free-tier-card">
                      <div className="admin-card-tag">{freePlan.badge || "Starter"}</div>
                      <div className="admin-card-header">
                        <h3 className="admin-plan-title">{freePlan.name}</h3>
                        <div className="admin-price-display">
                          <span className="currency-sym">{currencySymbol}</span>
                          <span className="price-val">0</span>
                          <span className="billing-tenure">{previewCycle === "yearly" ? "/ year" : "/ month"}</span>
                        </div>
                        <div className="admin-price-note">100% Free forever &bull; No card required</div>
                      </div>

                      <div className="admin-card-stats-box">
                        <div className="stat-row">
                          <i className="fa-solid fa-robot stat-icon"></i>
                          <span>AI Copilot: <strong>{freePlan.copilotMinutes} mins / mo</strong></span>
                        </div>
                        <div className="stat-row">
                          <i className="fa-solid fa-file-lines stat-icon"></i>
                          <span>Notetaker: <strong>{freePlan.notetakerMinutes} mins / mo</strong></span>
                        </div>
                        <div className="stat-row">
                          <i className="fa-solid fa-microphone stat-icon"></i>
                          <span>Voice Simulator: <strong>{freePlan.voiceMinutes} mins / mo</strong></span>
                        </div>
                        <div className="stat-row">
                          <i className="fa-solid fa-file-arrow-down stat-icon"></i>
                          <span>Included Downloads: <strong>{freePlan.downloadLimit === -1 ? "Unlimited" : `${freePlan.downloadLimit} downloads`}</strong></span>
                        </div>
                        <div className="stat-row">
                          <i className="fa-solid fa-cloud-arrow-up stat-icon"></i>
                          <span>Uploads: <strong>{freePlan.uploadMaxMb === -1 ? "Unlimited (0 credits)" : `Max ${freePlan.uploadMaxMb} MB (0 credits)`}</strong></span>
                        </div>
                      </div>

                      <div className="admin-card-features-list">
                        <div className={`feature-row ${!freePlan.hasTopBar ? "locked" : ""}`}>
                          <i className={`fa-solid ${freePlan.hasTopBar ? "fa-check" : "fa-lock"}`}></i>
                          <span>Slim Top Bar Overlay {!freePlan.hasTopBar && <em>(Locked)</em>}</span>
                        </div>
                        <div className={`feature-row ${!freePlan.hasTeleprompter ? "locked" : ""}`}>
                          <i className={`fa-solid ${freePlan.hasTeleprompter ? "fa-check" : "fa-lock"}`}></i>
                          <span>Floating Eye-Line Teleprompter {!freePlan.hasTeleprompter && <em>(Locked)</em>}</span>
                        </div>
                        <div className={`feature-row ${!freePlan.canDownloadPdf ? "locked" : ""}`}>
                          <i className={`fa-solid ${freePlan.canDownloadPdf ? "fa-check" : "fa-lock"}`}></i>
                          <span>PDF &amp; Text Downloads</span>
                        </div>
                        <div className={`feature-row ${!freePlan.canDownloadAudio ? "locked" : ""}`}>
                          <i className={`fa-solid ${freePlan.canDownloadAudio ? "fa-check" : "fa-lock"}`}></i>
                          <span>Full Audio Recording Exports</span>
                        </div>
                        <div className="feature-row">
                          <i className="fa-solid fa-check"></i>
                          <span>{freePlan.storageDays === -1 ? "Unlimited" : `${freePlan.storageDays} Days`} Cloud Retention</span>
                        </div>
                      </div>

                      <div className="admin-card-action">
                        <button type="button" className="admin-preview-btn outline-btn" disabled>
                          <i className="fa-solid fa-circle-check"></i> Default Active Plan ({currencySymbol}0)
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Pro Plan */}
                {(() => {
                  const proPlan = plans.find((p) => p.id === "PRO") || FALLBACK_PLANS[1];
                  const isYearly = previewCycle === "yearly";
                  const baseUSD = isYearly ? Number(proPlan.priceAnnual) : Number(proPlan.priceMonthly);
                  const monthlyEquivalentUSD = isYearly ? Math.round(Number(proPlan.priceAnnual) / 12) : Number(proPlan.priceMonthly);
                  const convertedPrice = previewCurrency === "USD" ? baseUSD : Math.round(convertFromUSD(baseUSD, previewCurrency));
                  const convertedMonthlyEq = previewCurrency === "USD" ? monthlyEquivalentUSD : Math.round(convertFromUSD(monthlyEquivalentUSD, previewCurrency));

                  return (
                    <div className="admin-card pro-tier-card featured-highlight">
                      <div className="admin-card-tag popular-tag">
                        <i className="fa-solid fa-fire"></i> {proPlan.badge || "Most Popular"}
                      </div>
                      <div className="admin-card-header">
                        <h3 className="admin-plan-title">{proPlan.name}</h3>
                        <div className="admin-price-display">
                          <span className="currency-sym">{currencySymbol}</span>
                          <span className="price-val">{convertedPrice.toLocaleString()}</span>
                          <span className="billing-tenure">{isYearly ? "/ year" : "/ month"}</span>
                        </div>
                        {isYearly ? (
                          <div className="admin-price-note">
                            ({currencySymbol}{convertedMonthlyEq.toLocaleString()} / mo billed annually)
                            {previewCurrency !== "USD" && ` &bull; $${baseUSD} USD base`}
                          </div>
                        ) : (
                          previewCurrency !== "USD" && (
                            <div className="admin-price-note">(${baseUSD} USD base rate)</div>
                          )
                        )}
                      </div>

                      <div className="admin-card-stats-box">
                        <div className="stat-row">
                          <i className="fa-solid fa-robot stat-icon"></i>
                          <span>AI Copilot: <strong>{proPlan.copilotMinutes / 60} hrs ({proPlan.copilotMinutes} mins)</strong></span>
                        </div>
                        <div className="stat-row">
                          <i className="fa-solid fa-file-lines stat-icon"></i>
                          <span>Notetaker: <strong>{proPlan.notetakerMinutes / 60} hrs ({proPlan.notetakerMinutes} mins)</strong></span>
                        </div>
                        <div className="stat-row">
                          <i className="fa-solid fa-microphone stat-icon"></i>
                          <span>Voice Simulator: <strong>{proPlan.voiceMinutes / 60} hrs ({proPlan.voiceMinutes} mins)</strong></span>
                        </div>
                        <div className="stat-row">
                          <i className="fa-solid fa-file-arrow-down stat-icon"></i>
                          <span>Included Downloads: <strong>{proPlan.downloadLimit === -1 ? "Unlimited" : `${proPlan.downloadLimit} downloads`}</strong></span>
                        </div>
                        <div className="stat-row">
                          <i className="fa-solid fa-cloud-arrow-up stat-icon"></i>
                          <span>Uploads: <strong>{proPlan.uploadMaxMb === -1 ? "Unlimited (0 credits)" : `Max ${proPlan.uploadMaxMb >= 1024 ? (proPlan.uploadMaxMb / 1024).toFixed(1) + ' GB' : proPlan.uploadMaxMb + ' MB'} (0 credits)`}</strong></span>
                        </div>
                      </div>

                      <div className="admin-card-features-list">
                        <div className="feature-row">
                          <i className="fa-solid fa-check"></i>
                          <span>Slim Top Bar Overlay (Unlocked)</span>
                        </div>
                        <div className={`feature-row ${!proPlan.hasTeleprompter ? "locked" : ""}`}>
                          <i className={`fa-solid ${proPlan.hasTeleprompter ? "fa-check" : "fa-lock"}`}></i>
                          <span>Floating Teleprompter {!proPlan.hasTeleprompter && <em>(Locked)</em>}</span>
                        </div>
                        <div className="feature-row">
                          <i className="fa-solid fa-check"></i>
                          <span>PDF &amp; Text Transcript Downloads</span>
                        </div>
                        <div className="feature-row">
                          <i className="fa-solid fa-check"></i>
                          <span>Full Audio Recording Exports</span>
                        </div>
                        <div className="feature-row">
                          <i className="fa-solid fa-check"></i>
                          <span>{proPlan.storageDays === -1 ? "Unlimited" : `${proPlan.storageDays} Days`} Cloud Retention</span>
                        </div>
                      </div>

                      <div className="admin-card-action">
                        <button type="button" className="admin-preview-btn primary-glow-btn" disabled>
                          <i className="fa-solid fa-bolt"></i> Upgrade to Pro
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Pro Plus Plan */}
                {(() => {
                  const proPlus = plans.find((p) => p.id === "PRO_PLUS") || FALLBACK_PLANS[2];
                  const isYearly = previewCycle === "yearly";
                  const baseUSD = isYearly ? Number(proPlus.priceAnnual) : Number(proPlus.priceMonthly);
                  const monthlyEquivalentUSD = isYearly ? Math.round(Number(proPlus.priceAnnual) / 12) : Number(proPlus.priceMonthly);
                  const convertedPrice = previewCurrency === "USD" ? baseUSD : Math.round(convertFromUSD(baseUSD, previewCurrency));
                  const convertedMonthlyEq = previewCurrency === "USD" ? monthlyEquivalentUSD : Math.round(convertFromUSD(monthlyEquivalentUSD, previewCurrency));

                  return (
                    <div className="admin-card pro-plus-tier-card">
                      <div className="admin-card-tag pro-plus-tag">
                        <i className="fa-solid fa-gem"></i> {proPlus.badge || "Power User"}
                      </div>
                      <div className="admin-card-header">
                        <h3 className="admin-plan-title">{proPlus.name}</h3>
                        <div className="admin-price-display">
                          <span className="currency-sym">{currencySymbol}</span>
                          <span className="price-val">{convertedPrice.toLocaleString()}</span>
                          <span className="billing-tenure">{isYearly ? "/ year" : "/ month"}</span>
                        </div>
                        {isYearly ? (
                          <div className="admin-price-note">
                            ({currencySymbol}{convertedMonthlyEq.toLocaleString()} / mo billed annually)
                            {previewCurrency !== "USD" && ` &bull; $${baseUSD} USD base`}
                          </div>
                        ) : (
                          previewCurrency !== "USD" && (
                            <div className="admin-price-note">(${baseUSD} USD base rate)</div>
                          )
                        )}
                      </div>

                      <div className="admin-card-stats-box">
                        <div className="stat-row">
                          <i className="fa-solid fa-robot stat-icon"></i>
                          <span>AI Copilot: <strong>{proPlus.copilotMinutes / 60} hrs ({proPlus.copilotMinutes} mins)</strong></span>
                        </div>
                        <div className="stat-row">
                          <i className="fa-solid fa-file-lines stat-icon"></i>
                          <span>Notetaker: <strong>{proPlus.notetakerMinutes / 60} hrs ({proPlus.notetakerMinutes} mins)</strong></span>
                        </div>
                        <div className="stat-row">
                          <i className="fa-solid fa-microphone stat-icon"></i>
                          <span>Voice Simulator: <strong>{proPlus.voiceMinutes / 60} hrs ({proPlus.voiceMinutes} mins)</strong></span>
                        </div>
                        <div className="stat-row">
                          <i className="fa-solid fa-file-arrow-down stat-icon"></i>
                          <span>Included Downloads: <strong>{proPlus.downloadLimit === -1 ? "Unlimited" : `${proPlus.downloadLimit} downloads`}</strong></span>
                        </div>
                        <div className="stat-row">
                          <i className="fa-solid fa-cloud-arrow-up stat-icon"></i>
                          <span>Uploads: <strong>{proPlus.uploadMaxMb === -1 ? "Unlimited (0 credits)" : `Max ${proPlus.uploadMaxMb >= 1024 ? (proPlus.uploadMaxMb / 1024).toFixed(1) + ' GB' : proPlus.uploadMaxMb + ' MB'} (0 credits)`}</strong></span>
                        </div>
                      </div>

                      <div className="admin-card-features-list">
                        <div className="feature-row">
                          <i className="fa-solid fa-check"></i>
                          <span>Slim Top Bar Overlay (Unlocked)</span>
                        </div>
                        <div className="feature-row">
                          <i className="fa-solid fa-check"></i>
                          <span>Floating Eye-Line Teleprompter (Unlocked)</span>
                        </div>
                        <div className="feature-row">
                          <i className="fa-solid fa-check"></i>
                          <span>PDF &amp; Text Transcript Downloads</span>
                        </div>
                        <div className="feature-row">
                          <i className="fa-solid fa-check"></i>
                          <span>Full Audio Recording Exports</span>
                        </div>
                        <div className="feature-row">
                          <i className="fa-solid fa-check"></i>
                          <span>Unlimited Cloud Retention Storage</span>
                        </div>
                      </div>

                      <div className="admin-card-action">
                        <button type="button" className="admin-preview-btn pro-plus-cta-btn" disabled>
                          <i className="fa-solid fa-sparkles"></i> Upgrade to Pro Plus
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 4. Pay As You Go (STRICTLY NO ELITE PLAN) */}
                {(() => {
                  const numAmt = Number(previewPaygAmount) || 50;
                  const amtInUSD = convertToUSD(numAmt, previewCurrency);
                  const calculatedCredits = Math.max(0, Math.round(amtInUSD * buyCreditsConfig.creditsPerUSD));

                  return (
                    <div className="admin-card payg-tier-card">
                      <div className="admin-card-tag flexible-tag">
                        <i className="fa-solid fa-coins"></i> FLEXIBLE TOP-UP
                      </div>
                      <div className="admin-card-header">
                        <h3 className="admin-plan-title">Pay As You Go</h3>
                        <div className="admin-price-display">
                          <span className="currency-sym">{currencySymbol}</span>
                          <span className="price-val">&ndash;</span>
                          <span className="billing-tenure">/ custom</span>
                        </div>
                        <div className="admin-price-note">
                          No recurring subscription &bull; Credits never expire
                        </div>
                      </div>

                      <div className="payg-interactive-demo-box">
                        <label className="payg-label">Test Amount ({previewCurrency}):</label>
                        <div className="payg-input-group">
                          <span className="payg-input-sym">{currencySymbol}</span>
                          <input
                            type="number"
                            min="1"
                            className="payg-number-input"
                            value={previewPaygAmount}
                            onChange={(e) => setPreviewPaygAmount(e.target.value)}
                          />
                        </div>
                        <div className="payg-calc-result-badge">
                          <span>Yields:</span>
                          <strong>~ {calculatedCredits.toLocaleString()} Credits</strong>
                        </div>
                        <div className="payg-preset-pills-row">
                          {[10, 25, 50, 100].map((presetUSD) => {
                            const converted = previewCurrency === "USD" ? presetUSD : Math.round(convertFromUSD(presetUSD, previewCurrency));
                            return (
                              <button
                                key={presetUSD}
                                type="button"
                                className="payg-quick-pill"
                                onClick={() => setPreviewPaygAmount(String(converted))}
                              >
                                {currencySymbol}{converted}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="admin-card-features-list">
                        <div className="feature-row">
                          <i className="fa-solid fa-wallet"></i>
                          <span>Choose your exact top-up amount</span>
                        </div>
                        <div className="feature-row">
                          <i className="fa-solid fa-bolt"></i>
                          <span>Instant credit allocation to user wallet</span>
                        </div>
                        <div className="feature-row">
                          <i className="fa-solid fa-file-arrow-down"></i>
                          <span>Use for downloads ({deductions.downloadCreditCost} cr/ea)</span>
                        </div>
                        <div className="feature-row">
                          <i className="fa-solid fa-robot"></i>
                          <span>
                            Use for Copilot ({deductions.copilotCreditCost} cr/{deductions.copilotIntervalMinutes > 1 ? `${deductions.copilotIntervalMinutes} ` : ""}{deductions.copilotBillingUnit === "minutes" ? "min" : deductions.copilotBillingUnit === "days" ? "day" : "hr"})
                          </span>
                        </div>
                        <div className="feature-row">
                          <i className="fa-solid fa-microphone"></i>
                          <span>
                            Use for Voice Agent ({deductions.voiceAgentCreditCost} cr/{deductions.voiceAgentIntervalMinutes > 1 ? `${deductions.voiceAgentIntervalMinutes} ` : ""}{deductions.voiceBillingUnit === "minutes" ? "min" : deductions.voiceBillingUnit === "days" ? "day" : "hr"})
                          </span>
                        </div>
                        <div className="feature-row">
                          <i className="fa-solid fa-file-lines"></i>
                          <span>
                            Use for Notetaker ({deductions.notetakerCreditCost} cr/{deductions.notetakerIntervalMinutes > 1 ? `${deductions.notetakerIntervalMinutes} ` : ""}{deductions.notetakerBillingUnit === "minutes" ? "min" : deductions.notetakerBillingUnit === "days" ? "day" : "hr"})
                          </span>
                        </div>
                      </div>

                      <div className="admin-card-action">
                        <button type="button" className="admin-preview-btn payg-btn" disabled>
                          <i className="fa-solid fa-cart-shopping"></i> Buy Credits
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: PLAN TIERS & QUOTAS EDITOR                                         */}
          {/* ========================================================================= */}
          {activeTab === "plans" && (
            <div className="sub-plans-editor-section">
              {/* Select Plan to Edit */}
              <div className="plan-editor-selection-bar">
                <span className="selection-label">Select Plan Tier to Configure:</span>
                <div className="plan-selector-buttons">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`plan-select-pill ${p.id === selectedPlanId ? "active" : ""}`}
                      onClick={() => setSelectedPlanId(p.id)}
                    >
                      <span className="pill-name">{p.name}</span>
                      <span className="pill-price">${p.priceMonthly}/mo</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Editor Form */}
              <form onSubmit={handleSavePlan} className="plan-editor-form">
                <div className="form-card-box">
                  <div className="form-section-title plan-price-section-header">
                    <div className="title-left">
                      <i className="fa-solid fa-tag"></i>
                      <span>Plan Identity &amp; Pricing</span>
                    </div>
                    <div className="currency-editor-pill">
                      <span className="currency-editor-pill-label">Active Editing Currency:</span>
                      <select
                        className="currency-editor-select"
                        value={previewCurrency}
                        onChange={(e) => setPreviewCurrency(e.target.value)}
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.code} &bull; {c.symbol} ({c.name})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="form-field">
                      <label>Plan Name</label>
                      <input
                        type="text"
                        value={planForm.name || ""}
                        onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>Display Badge</label>
                      <input
                        type="text"
                        value={planForm.badge || ""}
                        onChange={(e) => setPlanForm({ ...planForm, badge: e.target.value })}
                        placeholder="e.g. Most Popular"
                      />
                    </div>

                    <div className="form-field">
                      <label>Monthly Price ({currencySymbol} {previewCurrency})</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={planForm.id === "FREE" ? 0 : editingMonthlyPrice}
                        onChange={handleMonthlyPriceChange}
                        disabled={planForm.id === "FREE"}
                      />
                      <span className="field-hint">
                        {planForm.id === "FREE"
                          ? "Free tier is always $0"
                          : previewCurrency !== "USD"
                          ? `Platform Base Equivalent: ~$${(Number(planForm.priceMonthly) || 0).toFixed(2)} USD (1 USD = ${currencySymbol}${activeCurrencyObj.rate} ${previewCurrency})`
                          : "Base rate in USD. Automatically converted live across all 30 currencies for end users."}
                      </span>
                    </div>

                    <div className="form-field">
                      <div className="label-with-action">
                        <label>Annual Price ({currencySymbol} {previewCurrency} billed yearly)</label>
                        {planForm.id !== "FREE" && (
                          <button
                            type="button"
                            className="auto-calc-btn"
                            onClick={handleRecalculateAnnualDiscount}
                          >
                            Recalculate 20% Off
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={planForm.id === "FREE" ? 0 : editingAnnualPrice}
                        onChange={handleAnnualPriceChange}
                        disabled={planForm.id === "FREE"}
                      />
                      <span className="field-hint">
                        {planForm.id === "FREE"
                          ? "Free tier is always $0"
                          : previewCurrency !== "USD"
                          ? `Equivalent: ~${currencySymbol}${Math.round((Number(editingAnnualPrice) || 0) / 12)}/mo &bull; Stored Base: ~$${(Number(planForm.priceAnnual) || 0).toFixed(2)} USD`
                          : `Equivalent monthly: ~$${Math.round((Number(planForm.priceAnnual) || 0) / 12)}/mo (~20% annual discount)`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quotas & Limits */}
                <div className="form-card-box">
                  <div className="form-section-title">
                    <i className="fa-solid fa-chart-pie"></i>
                    <span>Core Feature Quotas &amp; Allowances</span>
                  </div>

                  <div className="form-grid-3">
                    <div className="form-field">
                      <div className="quota-header-row">
                        <label>AI Copilot ({quotaUnits.copilot === "days" ? "Days" : quotaUnits.copilot === "hours" ? "Hours" : "Minutes"} / month)</label>
                        <select
                          value={quotaUnits.copilot}
                          onChange={(e) => setQuotaUnits((prev) => ({ ...prev, copilot: e.target.value }))}
                          style={{ padding: "2px 6px", fontSize: "12px", borderRadius: "6px" }}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={
                          quotaUnits.copilot === "days"
                            ? Math.round(((planForm.copilotMinutes ?? 30) / 1440) * 100) / 100
                            : quotaUnits.copilot === "hours"
                              ? Math.round(((planForm.copilotMinutes ?? 30) / 60) * 100) / 100
                              : (planForm.copilotMinutes ?? 30)
                        }
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          const mins = quotaUnits.copilot === "days" ? Math.round(val * 1440) : quotaUnits.copilot === "hours" ? Math.round(val * 60) : Math.round(val);
                          setPlanForm({ ...planForm, copilotMinutes: mins, includedCredits: mins });
                        }}
                      />
                      <span className="field-hint">
                        = {Number(planForm.copilotMinutes || 0)} Mins &bull; {(Number(planForm.copilotMinutes || 0) / 60).toFixed(1)} Hours &bull; {(Number(planForm.copilotMinutes || 0) / 1440).toFixed(2)} Days
                      </span>
                    </div>

                    <div className="form-field">
                      <div className="quota-header-row">
                        <label>Included Plan Credits</label>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={planForm.includedCredits ?? planForm.copilotMinutes ?? 30}
                        onChange={(e) => {
                          const credits = Math.max(0, Math.round(Number(e.target.value) || 0));
                          setPlanForm({ ...planForm, includedCredits: credits });
                        }}
                      />
                      <span className="field-hint">
                        Auto-syncs with AI Copilot minutes ({Number(planForm.copilotMinutes || 0)} mins &rarr; {Number(planForm.includedCredits ?? planForm.copilotMinutes ?? 0)} credits) or set custom credits.
                      </span>
                    </div>

                    <div className="form-field">
                      <div className="quota-header-row">
                        <label>Meeting Notetaker ({quotaUnits.notetaker === "days" ? "Days" : quotaUnits.notetaker === "hours" ? "Hours" : "Minutes"} / month)</label>
                        <select
                          value={quotaUnits.notetaker}
                          onChange={(e) => setQuotaUnits((prev) => ({ ...prev, notetaker: e.target.value }))}
                          style={{ padding: "2px 6px", fontSize: "12px", borderRadius: "6px" }}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={
                          quotaUnits.notetaker === "days"
                            ? Math.round(((planForm.notetakerMinutes ?? 30) / 1440) * 100) / 100
                            : quotaUnits.notetaker === "hours"
                              ? Math.round(((planForm.notetakerMinutes ?? 30) / 60) * 100) / 100
                              : (planForm.notetakerMinutes ?? 30)
                        }
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          const mins = quotaUnits.notetaker === "days" ? Math.round(val * 1440) : quotaUnits.notetaker === "hours" ? Math.round(val * 60) : Math.round(val);
                          setPlanForm({ ...planForm, notetakerMinutes: mins });
                        }}
                      />
                      <span className="field-hint">
                        = {Number(planForm.notetakerMinutes || 0)} Mins &bull; {(Number(planForm.notetakerMinutes || 0) / 60).toFixed(1)} Hours &bull; {(Number(planForm.notetakerMinutes || 0) / 1440).toFixed(2)} Days
                      </span>
                    </div>

                    <div className="form-field">
                      <div className="quota-header-row">
                        <label>Voice Simulator ({quotaUnits.voice === "days" ? "Days" : quotaUnits.voice === "hours" ? "Hours" : "Minutes"} / month)</label>
                        <select
                          value={quotaUnits.voice}
                          onChange={(e) => setQuotaUnits((prev) => ({ ...prev, voice: e.target.value }))}
                          style={{ padding: "2px 6px", fontSize: "12px", borderRadius: "6px" }}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={
                          quotaUnits.voice === "days"
                            ? Math.round(((planForm.voiceMinutes ?? 10) / 1440) * 100) / 100
                            : quotaUnits.voice === "hours"
                              ? Math.round(((planForm.voiceMinutes ?? 10) / 60) * 100) / 100
                              : (planForm.voiceMinutes ?? 10)
                        }
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          const mins = quotaUnits.voice === "days" ? Math.round(val * 1440) : quotaUnits.voice === "hours" ? Math.round(val * 60) : Math.round(val);
                          setPlanForm({ ...planForm, voiceMinutes: mins });
                        }}
                      />
                      <span className="field-hint">
                        = {Number(planForm.voiceMinutes || 0)} Mins &bull; {(Number(planForm.voiceMinutes || 0) / 60).toFixed(1)} Hours &bull; {(Number(planForm.voiceMinutes || 0) / 1440).toFixed(2)} Days
                      </span>
                    </div>

                    <div className="form-field">
                      <div className="quota-header-row">
                        <label>Included File Downloads / mo</label>
                        <label className="quota-unlimited-checkbox">
                          <input
                            type="checkbox"
                            checked={planForm.downloadLimit === -1}
                            onChange={(e) => {
                              setPlanForm({
                                ...planForm,
                                downloadLimit: e.target.checked ? -1 : 25,
                              });
                            }}
                          />
                          <span>Unlimited</span>
                        </label>
                      </div>
                      {planForm.downloadLimit === -1 ? (
                        <div className="unlimited-active-badge">
                          <i className="fa-solid fa-infinity"></i>
                          <span>Unlimited Downloads Included</span>
                        </div>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          value={planForm.downloadLimit ?? 2}
                          onChange={(e) => setPlanForm({ ...planForm, downloadLimit: Number(e.target.value) })}
                        />
                      )}
                      <span className="field-hint">
                        {planForm.downloadLimit === -1
                          ? "Users on this tier can download unlimited files without credit deduction."
                          : `Exports beyond this cost ${deductions.downloadCreditCost} credits each`}
                      </span>
                    </div>

                    <div className="form-field">
                      <div className="quota-header-row">
                        <label>Max Upload Size (MB)</label>
                        <label className="quota-unlimited-checkbox">
                          <input
                            type="checkbox"
                            checked={planForm.uploadMaxMb === -1}
                            onChange={(e) => {
                              setPlanForm({
                                ...planForm,
                                uploadMaxMb: e.target.checked ? -1 : 500,
                              });
                            }}
                          />
                          <span>Unlimited</span>
                        </label>
                      </div>
                      {planForm.uploadMaxMb === -1 ? (
                        <div className="unlimited-active-badge">
                          <i className="fa-solid fa-infinity"></i>
                          <span>Unlimited Upload Size</span>
                        </div>
                      ) : (
                        <input
                          type="number"
                          min="10"
                          value={planForm.uploadMaxMb ?? 100}
                          onChange={(e) => setPlanForm({ ...planForm, uploadMaxMb: Number(e.target.value) })}
                        />
                      )}
                      <span className="field-hint">
                        {planForm.uploadMaxMb === -1
                          ? "No maximum upload file size restriction applied."
                          : `= ${planForm.uploadMaxMb >= 1024 ? (planForm.uploadMaxMb / 1024).toFixed(1) + ' GB' : planForm.uploadMaxMb + ' MB'}`}
                      </span>
                    </div>

                    <div className="form-field">
                      <div className="quota-header-row">
                        <label>Cloud Retention (Days)</label>
                        <label className="quota-unlimited-checkbox">
                          <input
                            type="checkbox"
                            checked={planForm.storageDays === -1}
                            onChange={(e) => {
                              setPlanForm({
                                ...planForm,
                                storageDays: e.target.checked ? -1 : 60,
                              });
                            }}
                          />
                          <span>Unlimited</span>
                        </label>
                      </div>
                      {planForm.storageDays === -1 ? (
                        <div className="unlimited-active-badge">
                          <i className="fa-solid fa-infinity"></i>
                          <span>Permanent Retention (Unlimited)</span>
                        </div>
                      ) : (
                        <input
                          type="number"
                          min="-1"
                          value={planForm.storageDays ?? 7}
                          onChange={(e) => setPlanForm({ ...planForm, storageDays: Number(e.target.value) })}
                        />
                      )}
                      <span className="field-hint">
                        {planForm.storageDays === -1 ? "Never deleted (Permanently retained)" : `${planForm.storageDays} days retention`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Feature Locks / Toggles */}
                <div className="form-card-box">
                  <div className="form-section-title">
                    <i className="fa-solid fa-lock-open"></i>
                    <span>Feature Accessibility Toggles</span>
                  </div>

                  <div className="feature-toggles-grid">
                    <label className="toggle-switch-card">
                      <div className="toggle-info">
                        <strong>Slim Top Bar Overlay</strong>
                        <span>Compact unobtrusive interview assist bar</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(planForm.hasTopBar)}
                        onChange={(e) => setPlanForm({ ...planForm, hasTopBar: e.target.checked })}
                      />
                    </label>

                    <label className="toggle-switch-card">
                      <div className="toggle-info">
                        <strong>Floating Eye-Line Teleprompter</strong>
                        <span>Real-time response guidance widget</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(planForm.hasTeleprompter)}
                        onChange={(e) => setPlanForm({ ...planForm, hasTeleprompter: e.target.checked })}
                      />
                    </label>

                    <label className="toggle-switch-card">
                      <div className="toggle-info">
                        <strong>PDF &amp; Doc Downloads</strong>
                        <span>Allow export of formatted executive summaries</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(planForm.canDownloadPdf)}
                        onChange={(e) => setPlanForm({ ...planForm, canDownloadPdf: e.target.checked })}
                      />
                    </label>

                    <label className="toggle-switch-card">
                      <div className="toggle-info">
                        <strong>Full Audio Exports</strong>
                        <span>Download complete session audio recordings</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(planForm.canDownloadAudio)}
                        onChange={(e) => setPlanForm({ ...planForm, canDownloadAudio: e.target.checked })}
                      />
                    </label>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="form-actions-bar">
                  <button
                    type="button"
                    className="reset-btn"
                    onClick={() => {
                      const fb = FALLBACK_PLANS.find((p) => p.id === planForm.id);
                      if (fb) setPlanForm({ ...fb });
                    }}
                    disabled={saving}
                  >
                    <i className="fa-solid fa-rotate-left"></i> Reset to Default
                  </button>

                  <button
                    type="submit"
                    className="save-plan-btn"
                    disabled={saving || !hasWritePermission}
                  >
                    {saving ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i> Saving Plan Changes...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-floppy-disk"></i> Save {planForm.name}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: ACTION CREDIT DEDUCTION RATES                                      */}
          {/* ========================================================================= */}
          {activeTab === "deductions" && (
            <div className="sub-deductions-section">
              <div className="section-intro-card">
                <div className="intro-icon"><i className="fa-solid fa-calculator"></i></div>
                <div className="intro-text">
                  <h3>Per-Action Credit Deduction Rates</h3>
                  <p>
                    Set how many credits are deducted when customers exhaust their included plan allowance
                    or request immediate feature extensions.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveDeductions} className="deductions-form">
                <div className="deductions-grid">
                  {/* 1. File Downloads */}
                  <div className="deduction-config-card">
                    <div className="d-card-header">
                      <div className="d-icon" style={{ background: "rgba(14, 165, 233, 0.15)", color: "#0ea5e9" }}>
                        <i className="fa-solid fa-file-arrow-down"></i>
                      </div>
                      <div>
                        <h4>File Download Cost</h4>
                        <span>PDF, TXT, and audio file exports</span>
                      </div>
                    </div>
                    <div className="d-card-body">
                      <div className="d-input-group">
                        <label>Credits per 1 Download:</label>
                        <div className="input-with-unit">
                          <input
                            type="number"
                            min="1"
                            value={deductions.downloadCreditCost}
                            onChange={(e) =>
                              setDeductions({ ...deductions, downloadCreditCost: Number(e.target.value) })
                            }
                            required
                          />
                          <span className="unit-tag">Credits</span>
                        </div>
                      </div>
                      <div className="d-conversion-badge">
                        <span>Approx. Equivalent:</span>
                        <strong>
                          ${((deductions.downloadCreditCost / buyCreditsConfig.creditsPerUSD)).toFixed(2)} USD
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* 2. AI Copilot */}
                  <div className="deduction-config-card">
                    <div className="d-card-header">
                      <div className="d-icon" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#6366f1" }}>
                        <i className="fa-solid fa-robot"></i>
                      </div>
                      <div>
                        <h4>AI Copilot Rate</h4>
                        <span>
                          Active: {deductions.copilotCreditCost} Credits / {deductions.copilotIntervalMinutes} {deductions.copilotBillingUnit}
                        </span>
                      </div>
                    </div>
                    <div className="d-card-body">
                      <div className="d-input-group" style={{ marginBottom: "10px" }}>
                        <label>Billing Unit (Mins / Hours / Days):</label>
                        <div className="input-with-unit">
                          <select
                            value={deductions.copilotBillingUnit || "hours"}
                            onChange={(e) =>
                              setDeductions({ ...deductions, copilotBillingUnit: e.target.value })
                            }
                            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px" }}
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                      </div>
                      <div className="d-input-group" style={{ marginBottom: "10px" }}>
                        <label>Duration Interval ({deductions.copilotBillingUnit}):</label>
                        <div className="input-with-unit">
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={deductions.copilotIntervalMinutes ?? 1}
                            onChange={(e) =>
                              setDeductions({ ...deductions, copilotIntervalMinutes: Math.max(1, Number(e.target.value) || 1) })
                            }
                            required
                          />
                          <span className="unit-tag" style={{ textTransform: "capitalize" }}>{deductions.copilotBillingUnit}</span>
                        </div>
                      </div>
                      <div className="d-input-group">
                        <label>Credits per {deductions.copilotIntervalMinutes} {deductions.copilotBillingUnit}:</label>
                        <div className="input-with-unit">
                          <input
                            type="number"
                            min="0"
                            value={deductions.copilotCreditCost}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setDeductions({
                                ...deductions,
                                copilotCreditCost: val,
                                copilotHourlyRate: deductions.copilotBillingUnit === "minutes"
                                  ? Math.ceil((val * 60) / Math.max(1, deductions.copilotIntervalMinutes || 1))
                                  : val,
                              });
                            }}
                            required
                          />
                          <span className="unit-tag">Credits</span>
                        </div>
                      </div>
                      <div className="d-conversion-badge">
                        <span>Approx. Equivalent:</span>
                        <strong>
                          ${((deductions.copilotCreditCost / buyCreditsConfig.creditsPerUSD)).toFixed(2)} USD / {deductions.copilotIntervalMinutes} {deductions.copilotBillingUnit}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* 3. Voice Simulator */}
                  <div className="deduction-config-card">
                    <div className="d-card-header">
                      <div className="d-icon" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                        <i className="fa-solid fa-microphone-lines"></i>
                      </div>
                      <div>
                        <h4>Voice Simulator Rate</h4>
                        <span>
                          Active: {deductions.voiceAgentCreditCost} Credits / {deductions.voiceAgentIntervalMinutes} {deductions.voiceBillingUnit}
                        </span>
                      </div>
                    </div>
                    <div className="d-card-body">
                      <div className="d-input-group" style={{ marginBottom: "10px" }}>
                        <label>Billing Unit (Mins / Hours / Days):</label>
                        <div className="input-with-unit">
                          <select
                            value={deductions.voiceBillingUnit || "hours"}
                            onChange={(e) =>
                              setDeductions({ ...deductions, voiceBillingUnit: e.target.value })
                            }
                            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px" }}
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                      </div>
                      <div className="d-input-group" style={{ marginBottom: "10px" }}>
                        <label>Duration Interval ({deductions.voiceBillingUnit}):</label>
                        <div className="input-with-unit">
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={deductions.voiceAgentIntervalMinutes ?? 1}
                            onChange={(e) =>
                              setDeductions({ ...deductions, voiceAgentIntervalMinutes: Math.max(1, Number(e.target.value) || 1) })
                            }
                            required
                          />
                          <span className="unit-tag" style={{ textTransform: "capitalize" }}>{deductions.voiceBillingUnit}</span>
                        </div>
                      </div>
                      <div className="d-input-group">
                        <label>Credits per {deductions.voiceAgentIntervalMinutes} {deductions.voiceBillingUnit}:</label>
                        <div className="input-with-unit">
                          <input
                            type="number"
                            min="0"
                            value={deductions.voiceAgentCreditCost}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setDeductions({
                                ...deductions,
                                voiceAgentCreditCost: val,
                                voiceHourlyRate: deductions.voiceBillingUnit === "minutes"
                                  ? Math.ceil((val * 60) / Math.max(1, deductions.voiceAgentIntervalMinutes || 1))
                                  : val,
                              });
                            }}
                            required
                          />
                          <span className="unit-tag">Credits</span>
                        </div>
                      </div>
                      <div className="d-conversion-badge">
                        <span>Approx. Equivalent:</span>
                        <strong>
                          ${((deductions.voiceAgentCreditCost / buyCreditsConfig.creditsPerUSD)).toFixed(2)} USD / {deductions.voiceAgentIntervalMinutes} {deductions.voiceBillingUnit}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* 4. Notetaker */}
                  <div className="deduction-config-card">
                    <div className="d-card-header">
                      <div className="d-icon" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc" }}>
                        <i className="fa-solid fa-file-lines"></i>
                      </div>
                      <div>
                        <h4>Meeting Notetaker Rate</h4>
                        <span>
                          Active: {deductions.notetakerCreditCost} Credits / {deductions.notetakerIntervalMinutes} {deductions.notetakerBillingUnit}
                        </span>
                      </div>
                    </div>
                    <div className="d-card-body">
                      <div className="d-input-group" style={{ marginBottom: "10px" }}>
                        <label>Billing Unit (Mins / Hours / Days):</label>
                        <div className="input-with-unit">
                          <select
                            value={deductions.notetakerBillingUnit || "hours"}
                            onChange={(e) =>
                              setDeductions({ ...deductions, notetakerBillingUnit: e.target.value })
                            }
                            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px" }}
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                      </div>
                      <div className="d-input-group" style={{ marginBottom: "10px" }}>
                        <label>Duration Interval ({deductions.notetakerBillingUnit}):</label>
                        <div className="input-with-unit">
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={deductions.notetakerIntervalMinutes ?? 1}
                            onChange={(e) =>
                              setDeductions({ ...deductions, notetakerIntervalMinutes: Math.max(1, Number(e.target.value) || 1) })
                            }
                            required
                          />
                          <span className="unit-tag" style={{ textTransform: "capitalize" }}>{deductions.notetakerBillingUnit}</span>
                        </div>
                      </div>
                      <div className="d-input-group">
                        <label>Credits per {deductions.notetakerIntervalMinutes} {deductions.notetakerBillingUnit}:</label>
                        <div className="input-with-unit">
                          <input
                            type="number"
                            min="0"
                            value={deductions.notetakerCreditCost}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setDeductions({
                                ...deductions,
                                notetakerCreditCost: val,
                                notetakerHourlyRate: deductions.notetakerBillingUnit === "minutes"
                                  ? Math.ceil((val * 60) / Math.max(1, deductions.notetakerIntervalMinutes || 1))
                                  : val,
                              });
                            }}
                            required
                          />
                          <span className="unit-tag">Credits</span>
                        </div>
                      </div>
                      <div className="d-conversion-badge">
                        <span>Approx. Equivalent:</span>
                        <strong>
                          ${((deductions.notetakerCreditCost / buyCreditsConfig.creditsPerUSD)).toFixed(2)} USD / {deductions.notetakerIntervalMinutes} {deductions.notetakerBillingUnit}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* 5. Media Upload & Interview Answer Generation */}
                  <div className="deduction-config-card">
                    <div className="d-card-header">
                      <div className="d-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                        <i className="fa-solid fa-cloud-arrow-up"></i>
                      </div>
                      <div>
                        <h4>Media Uploads &amp; AI Answers</h4>
                        <span>Per-file upload &amp; per-answer generation</span>
                      </div>
                    </div>
                    <div className="d-card-body">
                      <div className="d-input-group" style={{ marginBottom: "10px" }}>
                        <label>Credits per 1 Media Upload (0 = Free):</label>
                        <div className="input-with-unit">
                          <input
                            type="number"
                            min="0"
                            value={deductions.mediaUploadCreditCost ?? 0}
                            onChange={(e) =>
                              setDeductions({ ...deductions, mediaUploadCreditCost: Math.max(0, Number(e.target.value) || 0) })
                            }
                            required
                          />
                          <span className="unit-tag">Credits</span>
                        </div>
                      </div>
                      <div className="d-input-group">
                        <label>Credits per 1 AI Interview Answer:</label>
                        <div className="input-with-unit">
                          <input
                            type="number"
                            min="0"
                            value={deductions.questionAnswerCreditCost ?? 2}
                            onChange={(e) =>
                              setDeductions({ ...deductions, questionAnswerCreditCost: Math.max(0, Number(e.target.value) || 0) })
                            }
                            required
                          />
                          <span className="unit-tag">Credits</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-actions-bar" style={{ marginTop: "24px" }}>
                  <button
                    type="submit"
                    className="save-plan-btn"
                    disabled={saving || !hasWritePermission}
                  >
                    {saving ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i> Saving Deduction Rates...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-check-double"></i> Save Credit Deduction Rates
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: BUY CREDITS ENGINE & 30-CURRENCY RATES TABLE                       */}
          {/* ========================================================================= */}
          {activeTab === "buy-credits" && (
            <div className="sub-buycredits-section">
              {/* Top Engine Configuration */}
              <div className="engine-card-box">
                <div className="form-section-title">
                  <i className="fa-solid fa-gear"></i>
                  <span>Buy Credits Conversion Engine</span>
                </div>

                <form onSubmit={handleSaveBuyCredits} className="engine-form">
                  <div className="form-grid-3">
                    <div className="form-field">
                      <label>Base Conversion Rate (Credits per $1 USD)</label>
                      <input
                        type="number"
                        min="10"
                        max="10000"
                        value={buyCreditsConfig.creditsPerUSD}
                        onChange={(e) =>
                          setBuyCreditsConfig({
                            ...buyCreditsConfig,
                            creditsPerUSD: Number(e.target.value),
                          })
                        }
                        required
                      />
                      <span className="field-hint">Default standard: 250 credits per 1 USD</span>
                    </div>

                    <div className="form-field">
                      <label>Platform Base Currency</label>
                      <select
                        value={buyCreditsConfig.currencyCode}
                        onChange={(e) =>
                          setBuyCreditsConfig({
                            ...buyCreditsConfig,
                            currencyCode: e.target.value,
                          })
                        }
                      >
                        <option value="USD">USD - United States Dollar (Recommended Base)</option>
                        <option value="INR">INR - Indian Rupee</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                      </select>
                      <span className="field-hint">Primary accounting denomination</span>
                    </div>

                    <div className="form-field form-field-btn-align">
                      <button
                        type="submit"
                        className="save-plan-btn"
                        disabled={saving || !hasWritePermission}
                        style={{ width: "100%", height: "42px" }}
                      >
                        {saving ? "Saving..." : "Save Engine Parameters"}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Preset Bundles Preview */}
                <div className="bundles-preview-row">
                  <span className="bundles-title">Standard Preset Bundles (USD):</span>
                  <div className="bundles-list">
                    {[10, 20, 50, 100, 200].map((usd) => {
                      const cr = usd * buyCreditsConfig.creditsPerUSD;
                      return (
                        <div key={usd} className="bundle-pill">
                          <span className="bundle-price">${usd}</span>
                          <span className="bundle-cr">{cr.toLocaleString()} Credits</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Multi-Currency Credit Yield Interactive Calculator */}
              <div className="yield-calc-card">
                <div className="form-section-title">
                  <i className="fa-solid fa-calculator"></i>
                  <span>Multi-Currency Credit Yield &amp; Pricing Calculator</span>
                </div>

                <p className="yield-calc-desc">
                  Simulate exact customer credit allocations for any currency and payment amount based on the active exchange rate matrix.
                </p>

                {(() => {
                  const targetCurrObj = CURRENCIES.find((c) => c.code === calcCurrency) || CURRENCIES[0];
                  const numAmt = Number(calcAmount) || 0;
                  const amtInUSD = convertToUSD(numAmt, calcCurrency);
                  const yieldedCredits = Math.round(amtInUSD * buyCreditsConfig.creditsPerUSD);
                  const creditsPerOneUnit = (buyCreditsConfig.creditsPerUSD / targetCurrObj.rate).toFixed(2);
                  const costPer100Credits = ((100 / buyCreditsConfig.creditsPerUSD) * targetCurrObj.rate).toFixed(2);

                  return (
                    <div className="yield-calc-content-grid">
                      <div className="yield-inputs-box">
                        <div className="form-field">
                          <label>Select Target Payment Currency:</label>
                          <select
                            className="yield-currency-dropdown"
                            value={calcCurrency}
                            onChange={(e) => setCalcCurrency(e.target.value)}
                          >
                            {CURRENCIES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.flag} {c.code} &bull; {c.symbol} ({c.name})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-field">
                          <label>Enter Payment Amount in {calcCurrency}:</label>
                          <div className="yield-input-wrap">
                            <span className="yield-input-sym">{targetCurrObj.symbol}</span>
                            <input
                              type="number"
                              min="1"
                              className="yield-amount-input"
                              value={calcAmount}
                              onChange={(e) => setCalcAmount(e.target.value)}
                            />
                            <span className="yield-input-code">{calcCurrency}</span>
                          </div>
                        </div>

                        {/* Quick Presets for Target Currency */}
                        <div className="yield-presets-row">
                          <span className="yield-preset-title">Quick Presets:</span>
                          <div className="yield-preset-buttons">
                            {calcCurrency === "INR"
                              ? [100, 500, 1000, 2500, 5000].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    className="calc-quick-pill"
                                    onClick={() => setCalcAmount(String(preset))}
                                  >
                                    ₹{preset.toLocaleString()}
                                  </button>
                                ))
                              : [10, 25, 50, 100, 250].map((presetUSD) => {
                                  const converted = calcCurrency === "USD" ? presetUSD : Math.round(convertFromUSD(presetUSD, calcCurrency));
                                  return (
                                    <button
                                      key={presetUSD}
                                      type="button"
                                      className="calc-quick-pill"
                                      onClick={() => setCalcAmount(String(converted))}
                                    >
                                      {targetCurrObj.symbol}{converted.toLocaleString()}
                                    </button>
                                  );
                                })}
                          </div>
                        </div>
                      </div>

                      {/* Interactive Live Yield Output Display */}
                      <div className="yield-output-box">
                        <div className="yield-output-header">
                          <span>Calculated Credit Allocation:</span>
                          <span className="yield-pulse-dot"></span>
                        </div>

                        <div className="yield-big-number">
                          <i className="fa-solid fa-coins"></i>
                          <span>{yieldedCredits.toLocaleString()}</span>
                          <small>Credits</small>
                        </div>

                        <div className="yield-metrics-list">
                          <div className="yield-metric-row">
                            <span>Payment Amount:</span>
                            <strong>{targetCurrObj.symbol}{numAmt.toLocaleString()} {calcCurrency}</strong>
                          </div>
                          <div className="yield-metric-row">
                            <span>Equivalent Base USD:</span>
                            <strong>${amtInUSD.toFixed(2)} USD</strong>
                          </div>
                          <div className="yield-metric-row">
                            <span>Yield Rate:</span>
                            <strong>1 {calcCurrency} ≈ {creditsPerOneUnit} Credits</strong>
                          </div>
                          <div className="yield-metric-row">
                            <span>Cost per 100 Credits:</span>
                            <strong>{targetCurrObj.symbol}{costPer100Credits} {calcCurrency}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Key Global Currencies Yield Benchmark Matrix */}
              <div className="yield-benchmark-card">
                <div className="form-section-title">
                  <i className="fa-solid fa-table-cells"></i>
                  <span>Key Currencies Credit Yield Benchmark</span>
                </div>

                <div className="benchmark-cards-grid">
                  {/* USD */}
                  <div className="benchmark-col">
                    <div className="b-header">
                      <span>🇺🇸 USD ($)</span>
                      <small>1 USD = {buyCreditsConfig.creditsPerUSD} cr</small>
                    </div>
                    <div className="b-rows">
                      <div className="b-item"><span>$10</span><strong>2,500 cr</strong></div>
                      <div className="b-item"><span>$20</span><strong>5,000 cr</strong></div>
                      <div className="b-item"><span>$50</span><strong>12,500 cr</strong></div>
                      <div className="b-item"><span>$100</span><strong>25,000 cr</strong></div>
                    </div>
                  </div>

                  {/* INR */}
                  <div className="benchmark-col">
                    <div className="b-header">
                      <span>🇮🇳 INR (₹)</span>
                      <small>₹1 ≈ {(buyCreditsConfig.creditsPerUSD / (CURRENCIES.find(c => c.code === 'INR')?.rate || 83.5)).toFixed(2)} cr</small>
                    </div>
                    <div className="b-rows">
                      <div className="b-item"><span>₹100</span><strong>{Math.round(convertToUSD(100, 'INR') * buyCreditsConfig.creditsPerUSD).toLocaleString()} cr</strong></div>
                      <div className="b-item"><span>₹500</span><strong>{Math.round(convertToUSD(500, 'INR') * buyCreditsConfig.creditsPerUSD).toLocaleString()} cr</strong></div>
                      <div className="b-item"><span>₹1,000</span><strong>{Math.round(convertToUSD(1000, 'INR') * buyCreditsConfig.creditsPerUSD).toLocaleString()} cr</strong></div>
                      <div className="b-item"><span>₹2,500</span><strong>{Math.round(convertToUSD(2500, 'INR') * buyCreditsConfig.creditsPerUSD).toLocaleString()} cr</strong></div>
                    </div>
                  </div>

                  {/* EUR */}
                  <div className="benchmark-col">
                    <div className="b-header">
                      <span>🇪🇺 EUR (€)</span>
                      <small>€1 ≈ {(buyCreditsConfig.creditsPerUSD / (CURRENCIES.find(c => c.code === 'EUR')?.rate || 0.92)).toFixed(2)} cr</small>
                    </div>
                    <div className="b-rows">
                      <div className="b-item"><span>€10</span><strong>{Math.round(convertToUSD(10, 'EUR') * buyCreditsConfig.creditsPerUSD).toLocaleString()} cr</strong></div>
                      <div className="b-item"><span>€25</span><strong>{Math.round(convertToUSD(25, 'EUR') * buyCreditsConfig.creditsPerUSD).toLocaleString()} cr</strong></div>
                      <div className="b-item"><span>€50</span><strong>{Math.round(convertToUSD(50, 'EUR') * buyCreditsConfig.creditsPerUSD).toLocaleString()} cr</strong></div>
                      <div className="b-item"><span>€100</span><strong>{Math.round(convertToUSD(100, 'EUR') * buyCreditsConfig.creditsPerUSD).toLocaleString()} cr</strong></div>
                    </div>
                  </div>

                  {/* GBP */}
                  <div className="benchmark-col">
                    <div className="b-header">
                      <span>🇬🇧 GBP (£)</span>
                      <small>£1 ≈ {(buyCreditsConfig.creditsPerUSD / (CURRENCIES.find(c => c.code === 'GBP')?.rate || 0.79)).toFixed(2)} cr</small>
                    </div>
                    <div className="b-rows">
                      <div className="b-item"><span>£10</span><strong>{Math.round(convertToUSD(10, 'GBP') * buyCreditsConfig.creditsPerUSD).toLocaleString()} cr</strong></div>
                      <div className="b-item"><span>£25</span><strong>{Math.round(convertToUSD(25, 'GBP') * buyCreditsConfig.creditsPerUSD).toLocaleString()} cr</strong></div>
                      <div className="b-item"><span>£50</span><strong>{Math.round(convertToUSD(50, 'GBP') * buyCreditsConfig.creditsPerUSD).toLocaleString()} cr</strong></div>
                      <div className="b-item"><span>£100</span><strong>{Math.round(convertToUSD(100, 'GBP') * buyCreditsConfig.creditsPerUSD).toLocaleString()} cr</strong></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Explainer: Real-Time Rate Matrix & Architecture */}
              <div className="currency-explainer-card">
                <div className="explainer-header">
                  <div className="explainer-badge">
                    <i className="fa-solid fa-circle-info"></i>
                    <span>ENGINE OVERVIEW &amp; REAL-TIME BEHAVIOR</span>
                  </div>
                  <h4>Understanding the Product Currencies &amp; Real-Time Rate Matrix</h4>
                </div>

                <div className="explainer-content-grid">
                  <div className="explainer-item">
                    <div className="e-icon"><i className="fa-solid fa-bolt"></i></div>
                    <div className="e-text">
                      <strong>1. Purpose of the 30-Currency Matrix:</strong>
                      <p>
                        Kairos caters to global candidates across 30 countries. This matrix drives client-side multi-currency rendering across all subscription cards, top-ups, checkout drawers, and deduction previews with <strong>zero latency</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="explainer-item">
                    <div className="e-icon"><i className="fa-solid fa-sliders"></i></div>
                    <div className="e-text">
                      <strong>2. Is it Real-Time?</strong>
                      <p>
                        The system uses international market baseline exchange rates (e.g. 1 USD = ₹83.50 INR, €0.92 EUR). Furthermore, it provides <strong>Admin Real-Time Inline Overrides</strong>: you can edit any currency's exchange rate inline below and click &ldquo;Save&rdquo;. The update instantly persists and reflects across all customer checkout sessions.
                      </p>
                    </div>
                  </div>

                  <div className="explainer-item">
                    <div className="e-icon"><i className="fa-solid fa-shield-halved"></i></div>
                    <div className="e-text">
                      <strong>3. High Availability &amp; Fail-Safe Protection:</strong>
                      <p>
                        By combining cached market baselines with real-time admin overrides, the system guarantees that customer checkout pages never experience checkout failures or timeouts caused by third-party Forex API outages.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Currency Exchange Rates Table with Inline Editing */}
              <div className="currency-table-card">
                <div className="currency-table-header">
                  <div>
                    <h3 className="table-title">Product Currencies &amp; Real-Time Rate Matrix</h3>
                    <p className="table-sub">
                      All {CURRENCIES.length} currencies with inline rate overrides and reset controls.
                    </p>
                  </div>

                  <div className="currency-search-wrap">
                    <i className="fa-solid fa-magnifying-glass search-icon"></i>
                    <input
                      type="text"
                      className="currency-search-input"
                      placeholder="Search currency, code, or country..."
                      value={currencySearch}
                      onChange={(e) => setCurrencySearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="table-responsive-wrapper">
                  <table className="currency-rates-table">
                    <thead>
                      <tr>
                        <th>Country / Region</th>
                        <th>Code</th>
                        <th>Symbol</th>
                        <th>Exchange Rate (1 USD =)</th>
                        <th>Status</th>
                        <th>Action</th>
                        <th>Yield per Unit</th>
                        <th>Pro ({plans.find((p) => p.id === "PRO")?.priceMonthly || 29} USD)</th>
                        <th>Pro Plus ({plans.find((p) => p.id === "PRO_PLUS")?.priceMonthly || 79} USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCurrencies.map((c) => {
                        const isEditing = editingRateCode === c.code;
                        const isCustomRate = c.rate !== DEFAULT_CURRENCY_RATES[c.code];
                        const proUSD = plans.find((p) => p.id === "PRO")?.priceMonthly || 29;
                        const proPlusUSD = plans.find((p) => p.id === "PRO_PLUS")?.priceMonthly || 79;
                        const proConverted = c.code === "USD" ? proUSD : Math.round(convertFromUSD(proUSD, c.code));
                        const proPlusConverted = c.code === "USD" ? proPlusUSD : Math.round(convertFromUSD(proPlusUSD, c.code));
                        const creditsPerUnit = (buyCreditsConfig.creditsPerUSD / c.rate).toFixed(1);

                        return (
                          <tr key={c.code} className={c.code === previewCurrency ? "active-row" : ""}>
                            <td>
                              <span className="c-flag">{c.flag}</span>
                              <strong className="c-country">{c.country}</strong>
                            </td>
                            <td>
                              <span className="c-code-badge">{c.code}</span>
                            </td>
                            <td className="c-symbol">{c.symbol}</td>
                            <td>
                              {isEditing ? (
                                <div className="rate-edit-inline">
                                  <span className="rate-edit-prefix">{c.symbol}</span>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0.0001"
                                    className="rate-edit-input"
                                    value={tempRateValue}
                                    onChange={(e) => setTempRateValue(e.target.value)}
                                    autoFocus
                                  />
                                </div>
                              ) : (
                                <strong>
                                  {c.symbol} {c.rate.toLocaleString()}
                                </strong>
                              )}
                            </td>
                            <td>
                              {isCustomRate ? (
                                <span className="rate-status-badge custom-rate-badge">
                                  <i className="fa-solid fa-pen-nib"></i> Custom Override
                                </span>
                              ) : (
                                <span className="rate-status-badge default-rate-badge">
                                  <i className="fa-solid fa-globe"></i> Market Baseline
                                </span>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <div className="rate-actions-group">
                                  <button
                                    type="button"
                                    className="rate-save-btn"
                                    onClick={() => handleSaveExchangeRate(c.code)}
                                    title="Save Rate"
                                  >
                                    <i className="fa-solid fa-check"></i> Save
                                  </button>
                                  <button
                                    type="button"
                                    className="rate-cancel-btn"
                                    onClick={() => setEditingRateCode(null)}
                                    title="Cancel"
                                  >
                                    <i className="fa-solid fa-xmark"></i>
                                  </button>
                                </div>
                              ) : (
                                <div className="rate-actions-group">
                                  <button
                                    type="button"
                                    className="rate-edit-btn"
                                    onClick={() => handleStartEditRate(c)}
                                    title="Edit Exchange Rate"
                                  >
                                    <i className="fa-solid fa-pen"></i> Edit
                                  </button>
                                  {isCustomRate && (
                                    <button
                                      type="button"
                                      className="rate-reset-btn"
                                      onClick={() => handleResetExchangeRate(c.code)}
                                      title="Reset to default market baseline"
                                    >
                                      <i className="fa-solid fa-rotate-left"></i> Reset
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td>
                              <strong>1 {c.code}</strong> ≈ {creditsPerUnit} cr
                            </td>
                            <td>
                              <strong>{c.symbol} {proConverted.toLocaleString()}</strong>
                            </td>
                            <td>
                              <strong>{c.symbol} {proPlusConverted.toLocaleString()}</strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default SubscriptionsPage;
