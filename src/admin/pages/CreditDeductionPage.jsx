import { useState, useEffect } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hasPermission } from "@/features/auth/rbac";
import { ErrorState, Skeleton } from "@/components";
import { fetchPlatformPricing, updatePlatformPricing } from "@/features/settings/api/settingsApi";
import "./CreditDeductionPage.css";

const BILLING_UNIT_OPTIONS = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" }
];

export function CreditDeductionPage() {
  const { admin } = useAuth();
  const hasReadPermission = hasPermission(admin?.role, "settings:read");
  const hasWritePermission =
    hasPermission(admin?.role, "settings:write") ||
    admin?.role === "owner" ||
    admin?.role === "admin";

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [downloadCost, setDownloadCost] = useState(25);
  const [uploadCost, setUploadCost] = useState(0);
  const [answerCost, setAnswerCost] = useState(2);

  const [copilotUnit, setCopilotUnit] = useState("hours");
  const [copilotInterval, setCopilotInterval] = useState(1);
  const [copilotCost, setCopilotCost] = useState(50);

  const [voiceUnit, setVoiceUnit] = useState("hours");
  const [voiceInterval, setVoiceInterval] = useState(1);
  const [voiceCost, setVoiceCost] = useState(50);

  const [notetakerUnit, setNotetakerUnit] = useState("hours");
  const [notetakerInterval, setNotetakerInterval] = useState(1);
  const [notetakerCost, setNotetakerCost] = useState(50);

  const [toast, setToast] = useState(null);
  const [savedRates, setSavedRates] = useState({
    downloadCost: 25,
    uploadCost: 0,
    answerCost: 2,
    copilotUnit: "hours",
    copilotInterval: 1,
    copilotCost: 50,
    voiceUnit: "hours",
    voiceInterval: 1,
    voiceCost: 50,
    notetakerUnit: "hours",
    notetakerInterval: 1,
    notetakerCost: 50
  });

  function applyLoadedPricing(pricing) {
    const dCost = typeof pricing.downloadCreditCost === "number" ? pricing.downloadCreditCost : 25;
    const uCost = typeof pricing.mediaUploadCreditCost === "number" ? pricing.mediaUploadCreditCost : 0;
    const aCost = typeof pricing.questionAnswerCreditCost === "number" ? pricing.questionAnswerCreditCost : 2;

    const cUnit = pricing.copilotBillingUnit || "hours";
    const cInterval = typeof pricing.copilotIntervalMinutes === "number" ? pricing.copilotIntervalMinutes : 1;
    const cCost =
      cUnit === "minutes"
        ? (typeof pricing.copilotCreditCost === "number" ? pricing.copilotCreditCost : 2)
        : (typeof pricing.copilotHourlyRate === "number" ? pricing.copilotHourlyRate : 50);

    const vUnit = pricing.voiceBillingUnit || "hours";
    const vInterval = typeof pricing.voiceAgentIntervalMinutes === "number" ? pricing.voiceAgentIntervalMinutes : 1;
    const vCost =
      vUnit === "minutes"
        ? (typeof pricing.voiceAgentCreditCost === "number" ? pricing.voiceAgentCreditCost : 2)
        : (typeof pricing.voiceHourlyRate === "number" ? pricing.voiceHourlyRate : 50);

    const nUnit = pricing.notetakerBillingUnit || "hours";
    const nInterval = typeof pricing.notetakerIntervalMinutes === "number" ? pricing.notetakerIntervalMinutes : 1;
    const nCost =
      nUnit === "minutes"
        ? (typeof pricing.notetakerCreditCost === "number" ? pricing.notetakerCreditCost : 2)
        : (typeof pricing.notetakerHourlyRate === "number" ? pricing.notetakerHourlyRate : 50);

    setDownloadCost(dCost);
    setUploadCost(uCost);
    setAnswerCost(aCost);
    setCopilotUnit(cUnit);
    setCopilotInterval(cInterval);
    setCopilotCost(cCost);
    setVoiceUnit(vUnit);
    setVoiceInterval(vInterval);
    setVoiceCost(vCost);
    setNotetakerUnit(nUnit);
    setNotetakerInterval(nInterval);
    setNotetakerCost(nCost);

    setSavedRates({
      downloadCost: dCost,
      uploadCost: uCost,
      answerCost: aCost,
      copilotUnit: cUnit,
      copilotInterval: cInterval,
      copilotCost: cCost,
      voiceUnit: vUnit,
      voiceInterval: vInterval,
      voiceCost: vCost,
      notetakerUnit: nUnit,
      notetakerInterval: nInterval,
      notetakerCost: nCost
    });
  }

  useEffect(() => {
    if (!hasReadPermission) return;
    let isMounted = true;

    async function loadRates() {
      setIsLoading(true);
      try {
        const res = await fetchPlatformPricing();
        const pricing = res?.pricing || res?.data?.pricing || {};
        if (isMounted) {
          applyLoadedPricing(pricing);
        }
      } catch (err) {
        try {
          const pubRes = await fetch("/api/platform/credit-rates");
          const pubData = await pubRes.json();
          if (isMounted && pubData?.ok) {
            applyLoadedPricing(pubData);
          }
        } catch (_) {}
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRates();
    return () => {
      isMounted = false;
    };
  }, [hasReadPermission]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!hasWritePermission) {
      setToast({ message: "You do not have permission to modify settings.", type: "error" });
      return;
    }

    const dNum = Math.max(0, parseInt(downloadCost, 10) || 0);
    const uNum = Math.max(0, parseInt(uploadCost, 10) || 0);
    const aNum = Math.max(0, parseInt(answerCost, 10) || 0);

    const cIntervalNum = Math.max(1, parseInt(copilotInterval, 10) || 1);
    const cCostNum = Math.max(0, parseInt(copilotCost, 10) || 0);

    const vIntervalNum = Math.max(1, parseInt(voiceInterval, 10) || 1);
    const vCostNum = Math.max(0, parseInt(voiceCost, 10) || 0);

    const nIntervalNum = Math.max(1, parseInt(notetakerInterval, 10) || 1);
    const nCostNum = Math.max(0, parseInt(notetakerCost, 10) || 0);

    setIsSaving(true);
    setToast(null);

    try {
      await updatePlatformPricing({
        downloadCreditCost: dNum,
        mediaUploadCreditCost: uNum,
        questionAnswerCreditCost: aNum,
        copilotBillingUnit: copilotUnit,
        copilotIntervalMinutes: cIntervalNum,
        copilotCreditCost: cCostNum,
        copilotHourlyRate: copilotUnit === "minutes" ? Math.ceil((cCostNum * 60) / cIntervalNum) : cCostNum,
        voiceBillingUnit: voiceUnit,
        voiceAgentIntervalMinutes: vIntervalNum,
        voiceAgentCreditCost: vCostNum,
        voiceHourlyRate: voiceUnit === "minutes" ? Math.ceil((vCostNum * 60) / vIntervalNum) : vCostNum,
        notetakerBillingUnit: notetakerUnit,
        notetakerIntervalMinutes: nIntervalNum,
        notetakerCreditCost: nCostNum,
        notetakerHourlyRate: notetakerUnit === "minutes" ? Math.ceil((nCostNum * 60) / nIntervalNum) : nCostNum
      });

      setSavedRates({
        downloadCost: dNum,
        uploadCost: uNum,
        answerCost: aNum,
        copilotUnit,
        copilotInterval: cIntervalNum,
        copilotCost: cCostNum,
        voiceUnit,
        voiceInterval: vIntervalNum,
        voiceCost: vCostNum,
        notetakerUnit,
        notetakerInterval: nIntervalNum,
        notetakerCost: nCostNum
      });
      setToast({
        message: `Credit rates saved! Copilot: ${cCostNum}/${cIntervalNum} ${copilotUnit}, Voice: ${vCostNum}/${vIntervalNum} ${voiceUnit}, Notetaker: ${nCostNum}/${nIntervalNum} ${notetakerUnit}, Downloads: ${dNum}, Uploads: ${uNum}, Answers: ${aNum}.`,
        type: "success"
      });
    } catch (err) {
      setToast({
        message: err?.response?.data?.message || err?.message || "Failed to update credit deduction rates.",
        type: "error"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!hasReadPermission) {
    return (
      <div className="credit-deduction-page">
        <ErrorState
          title="Access Restricted"
          message="You do not have permission to view or manage Credit Deduction settings. Contact an Owner to request access."
        />
      </div>
    );
  }

  const isChanged =
    downloadCost !== savedRates.downloadCost ||
    uploadCost !== savedRates.uploadCost ||
    answerCost !== savedRates.answerCost ||
    copilotUnit !== savedRates.copilotUnit ||
    copilotInterval !== savedRates.copilotInterval ||
    copilotCost !== savedRates.copilotCost ||
    voiceUnit !== savedRates.voiceUnit ||
    voiceInterval !== savedRates.voiceInterval ||
    voiceCost !== savedRates.voiceCost ||
    notetakerUnit !== savedRates.notetakerUnit ||
    notetakerInterval !== savedRates.notetakerInterval ||
    notetakerCost !== savedRates.notetakerCost;

  return (
    <div className="credit-deduction-page">
      {/* Header */}
      <div className="credit-deduction-header">
        <div>
          <h1 className="credit-deduction-title">Credit Deduction</h1>
          <p className="credit-deduction-subtitle">
            Configure live credit reduction rates and billing units (minutes, hours, or days) across AI Copilot, Voice Agent, Notetaker, downloads, and media uploads.
          </p>
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div className={`credit-deduction-alert credit-deduction-alert--${toast.type}`} role="status">
          <div className="credit-deduction-alert-content">
            <i className={`fa-solid ${toast.type === "success" ? "fa-circle-check" : "fa-triangle-exclamation"}`}></i>
            <span>{toast.message}</span>
          </div>
          <button
            className="credit-deduction-alert-close"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="credit-deduction-loading">
          <Skeleton height={180} />
          <Skeleton height={180} />
          <Skeleton height={120} />
        </div>
      ) : (
        <form onSubmit={handleSave} className="credit-deduction-form">
          <div className="credit-deduction-grid">
            {/* 1. AI Copilot Session Card */}
            <div className="credit-deduction-card">
              <div className="credit-deduction-card-header">
                <div className="credit-deduction-icon-wrap bg-indigo">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                </div>
                <div>
                  <h3 className="credit-deduction-card-title">AI Copilot Session</h3>
                  <span className="credit-deduction-active-badge">
                    Current: <strong>{savedRates.copilotCost} Credits / {savedRates.copilotInterval} {savedRates.copilotUnit}</strong>
                  </span>
                </div>
              </div>
              <p className="credit-deduction-card-desc">
                Credits deducted dynamically during active AI Copilot live interview sessions based on configured unit and duration.
              </p>

              <div className="credit-deduction-input-group">
                <label htmlFor="copilotUnitSelect">Billing Unit</label>
                <div className="credit-deduction-input-wrap">
                  <select
                    id="copilotUnitSelect"
                    value={copilotUnit}
                    onChange={(e) => setCopilotUnit(e.target.value)}
                    disabled={isSaving}
                  >
                    {BILLING_UNIT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="credit-deduction-input-group">
                <label htmlFor="copilotIntervalInput">Billing Interval ({copilotUnit})</label>
                <div className="credit-deduction-input-wrap">
                  <input
                    id="copilotIntervalInput"
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    value={copilotInterval}
                    onChange={(e) => setCopilotInterval(Math.max(1, Number(e.target.value) || 1))}
                    disabled={isSaving}
                    required
                  />
                  <span className="credit-deduction-input-suffix">{copilotUnit}</span>
                </div>
              </div>

              <div className="credit-deduction-input-group">
                <label htmlFor="copilotCostInput">Cost Per Interval (Credits)</label>
                <div className="credit-deduction-input-wrap">
                  <input
                    id="copilotCostInput"
                    type="number"
                    min="0"
                    max="1000"
                    step="1"
                    value={copilotCost}
                    onChange={(e) => setCopilotCost(Math.max(0, Number(e.target.value) || 0))}
                    disabled={isSaving}
                    required
                  />
                  <span className="credit-deduction-input-suffix">Credits</span>
                </div>
              </div>
            </div>

            {/* 2. Voice Agent Mock Interview Card */}
            <div className="credit-deduction-card">
              <div className="credit-deduction-card-header">
                <div className="credit-deduction-icon-wrap bg-purple">
                  <i className="fa-solid fa-robot"></i>
                </div>
                <div>
                  <h3 className="credit-deduction-card-title">Voice Agent Mock Interview</h3>
                  <span className="credit-deduction-active-badge">
                    Current: <strong>{savedRates.voiceCost} Credits / {savedRates.voiceInterval} {savedRates.voiceUnit}</strong>
                  </span>
                </div>
              </div>
              <p className="credit-deduction-card-desc">
                Credits deducted dynamically during active Voice Agent mock interview sessions based on elapsed duration.
              </p>

              <div className="credit-deduction-input-group">
                <label htmlFor="voiceUnitSelect">Billing Unit</label>
                <div className="credit-deduction-input-wrap">
                  <select
                    id="voiceUnitSelect"
                    value={voiceUnit}
                    onChange={(e) => setVoiceUnit(e.target.value)}
                    disabled={isSaving}
                  >
                    {BILLING_UNIT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="credit-deduction-input-group">
                <label htmlFor="voiceIntervalInput">Billing Interval ({voiceUnit})</label>
                <div className="credit-deduction-input-wrap">
                  <input
                    id="voiceIntervalInput"
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    value={voiceInterval}
                    onChange={(e) => setVoiceInterval(Math.max(1, Number(e.target.value) || 1))}
                    disabled={isSaving}
                    required
                  />
                  <span className="credit-deduction-input-suffix">{voiceUnit}</span>
                </div>
              </div>

              <div className="credit-deduction-input-group">
                <label htmlFor="voiceCostInput">Cost Per Interval (Credits)</label>
                <div className="credit-deduction-input-wrap">
                  <input
                    id="voiceCostInput"
                    type="number"
                    min="0"
                    max="1000"
                    step="1"
                    value={voiceCost}
                    onChange={(e) => setVoiceCost(Math.max(0, Number(e.target.value) || 0))}
                    disabled={isSaving}
                    required
                  />
                  <span className="credit-deduction-input-suffix">Credits</span>
                </div>
              </div>
            </div>

            {/* 3. Notetaker Session Card */}
            <div className="credit-deduction-card">
              <div className="credit-deduction-card-header">
                <div className="credit-deduction-icon-wrap bg-blue">
                  <i className="fa-solid fa-microphone-lines"></i>
                </div>
                <div>
                  <h3 className="credit-deduction-card-title">Notetaker Session</h3>
                  <span className="credit-deduction-active-badge">
                    Current: <strong>{savedRates.notetakerCost} Credits / {savedRates.notetakerInterval} {savedRates.notetakerUnit}</strong>
                  </span>
                </div>
              </div>
              <p className="credit-deduction-card-desc">
                Credits deducted dynamically during active Notetaker audio recording sessions based on elapsed duration.
              </p>

              <div className="credit-deduction-input-group">
                <label htmlFor="notetakerUnitSelect">Billing Unit</label>
                <div className="credit-deduction-input-wrap">
                  <select
                    id="notetakerUnitSelect"
                    value={notetakerUnit}
                    onChange={(e) => setNotetakerUnit(e.target.value)}
                    disabled={isSaving}
                  >
                    {BILLING_UNIT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="credit-deduction-input-group">
                <label htmlFor="notetakerIntervalInput">Billing Interval ({notetakerUnit})</label>
                <div className="credit-deduction-input-wrap">
                  <input
                    id="notetakerIntervalInput"
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    value={notetakerInterval}
                    onChange={(e) => setNotetakerInterval(Math.max(1, Number(e.target.value) || 1))}
                    disabled={isSaving}
                    required
                  />
                  <span className="credit-deduction-input-suffix">{notetakerUnit}</span>
                </div>
              </div>

              <div className="credit-deduction-input-group">
                <label htmlFor="notetakerCostInput">Cost Per Interval (Credits)</label>
                <div className="credit-deduction-input-wrap">
                  <input
                    id="notetakerCostInput"
                    type="number"
                    min="0"
                    max="1000"
                    step="1"
                    value={notetakerCost}
                    onChange={(e) => setNotetakerCost(Math.max(0, Number(e.target.value) || 0))}
                    disabled={isSaving}
                    required
                  />
                  <span className="credit-deduction-input-suffix">Credits</span>
                </div>
              </div>
            </div>

            {/* 4. Download Credit Deduction Card */}
            <div className="credit-deduction-card">
              <div className="credit-deduction-card-header">
                <div className="credit-deduction-icon-wrap bg-blue">
                  <i className="fa-solid fa-download"></i>
                </div>
                <div>
                  <h3 className="credit-deduction-card-title">Download Credit Deduction</h3>
                  <span className="credit-deduction-active-badge">
                    Current: <strong>{savedRates.downloadCost} Credits</strong>
                  </span>
                </div>
              </div>
              <p className="credit-deduction-card-desc">
                Credits deducted whenever a user downloads an Interview Transcript (.txt), Audio Recording (.webm), or Evaluation PDF Report across any page.
              </p>
              <div className="credit-deduction-input-group">
                <label htmlFor="downloadCostInput">Cost Per Download (Credits)</label>
                <div className="credit-deduction-input-wrap">
                  <input
                    id="downloadCostInput"
                    type="number"
                    min="0"
                    max="1000"
                    step="1"
                    value={downloadCost}
                    onChange={(e) => setDownloadCost(Number(e.target.value))}
                    disabled={isSaving}
                    required
                  />
                  <span className="credit-deduction-input-suffix">Credits</span>
                </div>
                <div className="credit-deduction-presets">
                  <span>Quick Presets:</span>
                  <button type="button" onClick={() => setDownloadCost(10)}>10</button>
                  <button type="button" onClick={() => setDownloadCost(15)}>15</button>
                  <button type="button" onClick={() => setDownloadCost(20)}>20</button>
                  <button type="button" onClick={() => setDownloadCost(25)}>25</button>
                </div>
              </div>
            </div>

            {/* 5. Media Upload Credit Deduction Card */}
            <div className="credit-deduction-card">
              <div className="credit-deduction-card-header">
                <div className="credit-deduction-icon-wrap bg-purple">
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <div>
                  <h3 className="credit-deduction-card-title">Audio / Video Upload Deduction</h3>
                  <span className="credit-deduction-active-badge">
                    Current: <strong>{savedRates.uploadCost} Credits</strong>
                  </span>
                </div>
              </div>
              <p className="credit-deduction-card-desc">
                Credits deducted when a user uploads an audio (.mp3, .wav, .m4a) or video (.mp4, .mov, etc.) file in Upload.jsx for transcription and analysis.
              </p>
              <div className="credit-deduction-input-group">
                <label htmlFor="uploadCostInput">Cost Per Media Upload (Credits)</label>
                <div className="credit-deduction-input-wrap">
                  <input
                    id="uploadCostInput"
                    type="number"
                    min="0"
                    max="1000"
                    step="1"
                    value={uploadCost}
                    onChange={(e) => setUploadCost(Number(e.target.value))}
                    disabled={isSaving}
                    required
                  />
                  <span className="credit-deduction-input-suffix">Credits</span>
                </div>
                <div className="credit-deduction-presets">
                  <span>Quick Presets:</span>
                  <button type="button" onClick={() => setUploadCost(0)}>0</button>
                  <button type="button" onClick={() => setUploadCost(10)}>10</button>
                  <button type="button" onClick={() => setUploadCost(20)}>20</button>
                  <button type="button" onClick={() => setUploadCost(25)}>25</button>
                </div>
              </div>
            </div>

            {/* 6. Interview Question Answer Generation Card */}
            <div className="credit-deduction-card">
              <div className="credit-deduction-card-header">
                <div className="credit-deduction-icon-wrap bg-amber">
                  <i className="fa-solid fa-comments"></i>
                </div>
                <div>
                  <h3 className="credit-deduction-card-title">Interview Answer Generation</h3>
                  <span className="credit-deduction-active-badge">
                    Current: <strong>{savedRates.answerCost} Credits</strong>
                  </span>
                </div>
              </div>
              <p className="credit-deduction-card-desc">
                Credits deducted whenever an interviewer asks a question and an AI answer is generated during the interview session.
              </p>
              <div className="credit-deduction-input-group">
                <label htmlFor="answerCostInput">Cost Per Generated Answer (Credits)</label>
                <div className="credit-deduction-input-wrap">
                  <input
                    id="answerCostInput"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={answerCost}
                    onChange={(e) => setAnswerCost(Number(e.target.value))}
                    disabled={isSaving}
                    required
                  />
                  <span className="credit-deduction-input-suffix">Credits</span>
                </div>
                <div className="credit-deduction-presets">
                  <span>Quick Presets:</span>
                  <button type="button" onClick={() => setAnswerCost(1)}>1</button>
                  <button type="button" onClick={() => setAnswerCost(2)}>2</button>
                  <button type="button" onClick={() => setAnswerCost(3)}>3</button>
                  <button type="button" onClick={() => setAnswerCost(5)}>5</button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="credit-deduction-actions">
            <div className="credit-deduction-actions-info">
              {isChanged ? (
                <span className="badge-pending-changes">
                  <i className="fa-solid fa-circle-dot"></i> Unsaved changes detected
                </span>
              ) : (
                <span className="badge-saved">
                  <i className="fa-solid fa-check-circle"></i> Rates are up to date
                </span>
              )}
            </div>
            <button
              type="submit"
              className="btn-save-rates"
              disabled={isSaving || !hasWritePermission || !isChanged}
            >
              {isSaving ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Saving Rates…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk"></i> Save Credit Deduction
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default CreditDeductionPage;
