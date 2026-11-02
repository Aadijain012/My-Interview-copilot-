import React, { useState, useEffect, useMemo } from 'react';
import './UsageRestrictionsPage.css';
import { getStoredTransactions, getUserCredits } from '../subscription/transactionHistoryStore';
import { getFeatureUsage, getTopUpHistory, getActiveUserPlanTier, setActiveUserPlanTier } from '../subscription/topUpStore';
import { getDownloadStatus, updateDynamicPlanLimits } from '../../config/creditUsageConfig';
import { API_BASE } from '../../utils/api';

export default function UsageRestrictionsPage({
  user,
  onBack,
  onGoToSubscription,
  onGoToPanel,
  showToast,
  darkMode = true,
  toggleDarkMode
}) {
  const [showAllActivityModal, setShowAllActivityModal] = useState(false);
  const [activityFilter, setActivityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Payment & Top-up History State
  const [transactions, setTransactions] = useState(getStoredTransactions());
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');

  // Top-Up Store & Usage State (Section 14)
  const [topUpHistory, setTopUpHistory] = useState(() => getTopUpHistory());
  const [featureUsage, setFeatureUsage] = useState(() => getFeatureUsage());
  const [activePlanTier, setActivePlanTier] = useState(() => getActiveUserPlanTier());
  const [availableCredits, setAvailableCredits] = useState(() => getUserCredits());
  const [downloadStatus, setDownloadStatus] = useState(() => getDownloadStatus());
  const [historyTab, setHistoryTab] = useState('topup'); // 'topup' | 'all'

  // Dynamic API Data State
  const [plans, setPlans] = useState([]);
  const [liveSubscription, setLiveSubscription] = useState(null);

  useEffect(() => {
    const handleUpdate = () => {
      setTransactions(getStoredTransactions());
    };
    const handleTopUpSync = () => {
      setTopUpHistory(getTopUpHistory());
      setFeatureUsage(getFeatureUsage());
      setAvailableCredits(getUserCredits());
    };
    const handleCreditsSync = (e) => {
      if (typeof e.detail === 'number') {
        setAvailableCredits(e.detail);
      } else {
        setAvailableCredits(getUserCredits());
      }
    };
    const handlePlanTierSync = (e) => {
      const tier = e.detail || getActiveUserPlanTier();
      setActivePlanTier(tier);
      setDownloadStatus(getDownloadStatus(tier));
    };
    const handleUsageSync = () => {
      setDownloadStatus(getDownloadStatus());
    };
    window.addEventListener('copilot-transactions-updated', handleUpdate);
    window.addEventListener('copilot-topup-updated', handleTopUpSync);
    window.addEventListener('copilot-credits-updated', handleCreditsSync);
    window.addEventListener('copilot-plan-tier-updated', handlePlanTierSync);
    window.addEventListener('copilot-usage-updated', handleUsageSync);

    // Fetch dynamic backend plan, subscription and wallet data
    const fetchApiData = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const headers = { 'x-suppress-auth-redirect': 'true' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // 1. Fetch dynamic plans
        try {
          const pRes = await fetch(`${API_BASE}/api/plans`, { headers });
          if (pRes.ok) {
            const pData = await pRes.json();
            const plansArr = Array.isArray(pData) ? pData : pData?.plans;
            if (Array.isArray(plansArr) && plansArr.length > 0) {
              setPlans(plansArr);
              updateDynamicPlanLimits(plansArr);
            }
          }
        } catch (_) {}

        // 2. Fetch subscription limits
        try {
          const sRes = await fetch(`${API_BASE}/api/user/subscription-limits`, { headers });
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData?.subscription) {
              setLiveSubscription(sData.subscription);
              if (sData.subscription.tier) {
                const tier = sData.subscription.tier.toUpperCase();
                setActivePlanTier(tier);
                setActiveUserPlanTier(tier);
              }
            }
          }
        } catch (_) {}

        // 3. Fetch wallet
        if (token) {
          try {
            const wRes = await fetch(`${API_BASE}/api/profiles/wallet`, { headers });
            if (wRes.ok) {
              const wData = await wRes.json();
              if (wData?.wallet && typeof wData.wallet.availableCredits === 'number') {
                setAvailableCredits(wData.wallet.availableCredits);
              }
            }
          } catch (_) {}
        }
      } catch (_) {}
    };

    fetchApiData();

    return () => {
      window.removeEventListener('copilot-transactions-updated', handleUpdate);
      window.removeEventListener('copilot-topup-updated', handleTopUpSync);
      window.removeEventListener('copilot-credits-updated', handleCreditsSync);
      window.removeEventListener('copilot-plan-tier-updated', handlePlanTierSync);
      window.removeEventListener('copilot-usage-updated', handleUsageSync);
    };
  }, []);

  const filteredTransactions = transactions.filter((t) => {
    if (historyFilter !== 'ALL' && t.status.toLowerCase() !== historyFilter.toLowerCase()) {
      return false;
    }
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      return (
        t.planOrPackage?.toLowerCase().includes(q) ||
        t.type?.toLowerCase().includes(q) ||
        t.paymentMethod?.toLowerCase().includes(q) ||
        t.id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleBackAction = () => {
    if (onBack) {
      onBack();
    } else if (onGoToPanel) {
      onGoToPanel();
    }
  };

  const handleUpgradeAction = () => {
    if (onGoToSubscription) {
      onGoToSubscription();
    } else if (showToast) {
      showToast('Navigating to Upgrade Plan...');
    }
  };

  // Dynamic credit consumption computed from user transactions
  const consumedCredits = useMemo(() => {
    return (transactions || []).reduce((acc, t) => acc + (Number(t.creditsUsed) || 0), 0);
  }, [transactions]);

  // Dynamic activity log built from real transactions and user sessions
  const dynamicActivities = useMemo(() => {
    const list = [];
    (transactions || []).forEach((t, idx) => {
      const isVoice = (t.planOrPackage || '').toLowerCase().includes('voice');
      const isCopilot = (t.planOrPackage || '').toLowerCase().includes('copilot');
      const isDownload = (t.planOrPackage || '').toLowerCase().includes('download');
      list.push({
        id: `txn-act-${t.id || idx}`,
        dateTime: t.dateTime || 'Just now',
        feature: isVoice ? 'Voice' : isCopilot ? 'AI Copilot' : isDownload ? 'Download' : (t.type || 'Usage'),
        icon: isVoice ? 'fa-solid fa-microphone' : isCopilot ? 'fa-solid fa-robot' : isDownload ? 'fa-solid fa-file-arrow-down' : 'fa-solid fa-bolt',
        iconColor: isVoice ? '#38bdf8' : isCopilot ? '#818cf8' : '#34d399',
        usage: t.creditsUsed ? `${t.creditsUsed} Credits` : t.creditsAdded ? `+${t.creditsAdded} Credits` : (t.amount ? `$${t.amount}` : '1 Action'),
        details: t.planOrPackage || t.type
      });
    });

    try {
      const rawSessions = localStorage.getItem('copilot_recent_sessions');
      if (rawSessions) {
        const parsed = JSON.parse(rawSessions);
        if (Array.isArray(parsed)) {
          parsed.forEach((s, idx) => {
            list.push({
              id: `sess-act-${s.id || idx}`,
              dateTime: s.createdAt || s.timestamp || 'Recent',
              feature: s.tech || s.sessionType || 'Interview Session',
              icon: 'fa-solid fa-user-astronaut',
              iconColor: '#a78bfa',
              usage: s.durationDisplay || `${s.durationSeconds || 0}s`,
              details: s.title || s.name || 'Live Interview Practice'
            });
          });
        }
      }
    } catch (_) {}

    return list;
  }, [transactions]);

  const filteredActivities = dynamicActivities.filter((item) => {
    const matchesFilter =
      activityFilter === 'ALL' ||
      item.feature.toLowerCase().includes(activityFilter.toLowerCase());
    const matchesSearch =
      !searchQuery.trim() ||
      item.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.feature.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.dateTime.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const currentPlanObj = useMemo(() => {
    const tierUpper = (activePlanTier || 'FREE').toUpperCase();
    return (plans || []).find(p => String(p.id).toUpperCase() === tierUpper || String(p.tier).toUpperCase() === tierUpper) || null;
  }, [plans, activePlanTier]);

  const copilotBaseHours = useMemo(() => {
    if (liveSubscription?.copilotLimit) return liveSubscription.copilotLimit / 60;
    if (currentPlanObj?.copilotMinutes) return currentPlanObj.copilotMinutes / 60;
    return activePlanTier.toUpperCase() === 'FREE' ? 0.5 : (activePlanTier.toUpperCase() === 'PRO_PLUS' ? 40 : 10);
  }, [liveSubscription, currentPlanObj, activePlanTier]);

  const voiceBaseHours = useMemo(() => {
    if (liveSubscription?.voiceLimit) return liveSubscription.voiceLimit / 60;
    if (currentPlanObj?.voiceMinutes) return currentPlanObj.voiceMinutes / 60;
    return activePlanTier.toUpperCase() === 'FREE' ? 0.16 : (activePlanTier.toUpperCase() === 'PRO_PLUS' ? 6 : 1.5);
  }, [liveSubscription, currentPlanObj, activePlanTier]);

  const notetakerBaseHours = useMemo(() => {
    if (liveSubscription?.notetakerLimit) return liveSubscription.notetakerLimit / 60;
    if (currentPlanObj?.notetakerMinutes) return currentPlanObj.notetakerMinutes / 60;
    return activePlanTier.toUpperCase() === 'FREE' ? 0.5 : (activePlanTier.toUpperCase() === 'PRO_PLUS' ? 40 : 15);
  }, [liveSubscription, currentPlanObj, activePlanTier]);

  const uploadMaxMb = useMemo(() => {
    if (liveSubscription?.uploadMaxMbLimit) return liveSubscription.uploadMaxMbLimit;
    if (currentPlanObj?.uploadMaxMb) return currentPlanObj.uploadMaxMb;
    return activePlanTier.toUpperCase() === 'FREE' ? 100 : 500;
  }, [liveSubscription, currentPlanObj, activePlanTier]);

  const downloadLimitCount = useMemo(() => {
    if (typeof liveSubscription?.downloadsLimit === 'number') return liveSubscription.downloadsLimit;
    if (typeof currentPlanObj?.downloadLimit === 'number') return currentPlanObj.downloadLimit;
    return downloadStatus.limit;
  }, [liveSubscription, currentPlanObj, downloadStatus]);

  const displayPlanName = useMemo(() => {
    if (currentPlanObj?.name) return currentPlanObj.name;
    if (liveSubscription?.planName) return liveSubscription.planName;
    return activePlanTier.toUpperCase() === 'PRO_PLUS' ? 'Pro Plus Plan' : activePlanTier.toUpperCase() === 'FREE' ? 'Free Plan' : 'Pro Plan';
  }, [currentPlanObj, liveSubscription, activePlanTier]);

  const displayPlanPrice = useMemo(() => {
    if (activePlanTier.toUpperCase() === 'FREE') return '$0.00 (Free)';
    const monthlyPrice = currentPlanObj?.priceMonthly ?? (activePlanTier.toUpperCase() === 'PRO_PLUS' ? 79 : 29);
    return `$${monthlyPrice}.00 / month`;
  }, [currentPlanObj, activePlanTier]);

  return (
    <div className={`usage-page-root ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      <div className="usage-page-container">
        {/* Top Header Navigation */}
        <header className="usage-header">
          <div className="usage-header-left">
            <button
              onClick={handleBackAction}
              className="usage-back-arrow-btn"
              type="button"
              title="Go back"
              aria-label="Go back"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div className="usage-header-titles">
              <h1 className="usage-page-title">Usage &amp; Restrictions</h1>
              <p className="usage-page-subtitle">
                Track your plan usage, remaining limits and subscription details.
              </p>
            </div>
          </div>

          <div className="usage-header-right">
            {toggleDarkMode && (
              <button
                className="theme-toggle-btn usage-theme-toggle-btn"
                onClick={toggleDarkMode}
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                type="button"
                style={{
                  background: darkMode ? 'rgba(255, 255, 255, 0.06)' : '#ffffff',
                  border: darkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #cbd5e1',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: darkMode ? '#f1f5f9' : '#0f172a',
                  marginRight: '12px',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
              </button>
            )}
            <button
              onClick={handleBackAction}
              className="usage-back-chat-btn"
              type="button"
            >
              <i className="fa-solid fa-arrow-left"></i>
              <span>Back to Chat</span>
            </button>
          </div>
        </header>

        {/* Current Plan Hero Banner */}
        <section className="usage-hero-banner" aria-label="Current Plan Banner">
          <div className="usage-hero-left">
            <div className="usage-crown-circle" aria-hidden="true">
              <i className="fa-solid fa-crown"></i>
            </div>
            <div className="usage-plan-info">
              <span className="usage-plan-label">Current Plan</span>
              <div className="usage-plan-title-row">
                <h2 className="usage-plan-name">
                  {displayPlanName}
                </h2>
                <span className="usage-active-badge">Active</span>
              </div>
              <p className="usage-plan-desc">
                {activePlanTier.toUpperCase() === 'PRO_PLUS'
                  ? `VIP tier with ${copilotBaseHours}h AI assistance, unlimited retention and full teleprompter.`
                  : activePlanTier.toUpperCase() === 'FREE'
                  ? `Starter tier with ${Math.round(copilotBaseHours * 60)}m trial AI assistance and basic transcription.`
                  : `Enjoy ${copilotBaseHours}h AI assistance, higher limits and premium real-time AI features.`}
              </p>
            </div>
          </div>

          <div className="usage-hero-center">
            {/* Plan Started */}
            <div className="usage-meta-col">
              <div className="usage-meta-icon-wrapper">
                <i className="fa-regular fa-calendar"></i>
              </div>
              <div className="usage-meta-text">
                <span className="usage-meta-label">Plan Started</span>
                <span className="usage-meta-value">
                  {liveSubscription?.startDate ? new Date(liveSubscription.startDate).toLocaleDateString() : (activePlanTier.toUpperCase() === 'FREE' ? 'Free Tier' : 'Active Cycle')}
                </span>
                <span className="usage-meta-sub">
                  {activePlanTier.toUpperCase() === 'FREE' ? 'Permanent' : 'Current Month'}
                </span>
              </div>
            </div>

            {/* Expires On */}
            <div className="usage-meta-col">
              <div className="usage-meta-icon-wrapper">
                <i className="fa-regular fa-calendar-check"></i>
              </div>
              <div className="usage-meta-text">
                <span className="usage-meta-label">Expires On</span>
                <span className="usage-meta-value">
                  {liveSubscription?.endDate ? new Date(liveSubscription.endDate).toLocaleDateString() : (activePlanTier.toUpperCase() === 'FREE' ? 'Never' : 'Auto-renews')}
                </span>
                <span className="usage-remaining-badge">
                  {activePlanTier.toUpperCase() === 'FREE' ? 'Lifetime Access' : 'Active Cycle'}
                </span>
              </div>
            </div>
          </div>

          <div className="usage-hero-right">
            <button
              onClick={handleUpgradeAction}
              className="usage-upgrade-btn"
              type="button"
            >
              <span>Upgrade Plan</span>
              <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </section>

        {/* Section 14: Credits Overview (Available: 1,200, Used: 800, Remaining: 400) */}
        <section className="usage-credits-overview-section" aria-label="Credits Overview">
          <div className="usage-panel-card full-width credits-summary-card">
            <div className="credits-card-header">
              <div className="credits-title-wrap">
                <div className="credits-icon-box">
                  <i className="fa-solid fa-coins"></i>
                </div>
                <div>
                  <h2 className="credits-section-title">Credits</h2>
                  <p className="credits-section-desc">Current plan wallet and consumption overview</p>
                </div>
              </div>
              <div className="credits-plan-tag">
                <span className="credits-plan-lbl">Current Plan:</span>
                <strong className="credits-plan-val">{displayPlanName}</strong>
              </div>
            </div>

            <div className="credits-metrics-triad">
              <div className="credit-metric-box box-available">
                <div className="c-meta-top">
                  <span className="c-icon"><i className="fa-solid fa-wallet"></i></span>
                  <span className="c-tag">Wallet Balance</span>
                </div>
                <div className="c-number">{(availableCredits || 0).toLocaleString()}</div>
                <div className="c-label">Available</div>
              </div>

              <div className="credit-metric-box box-used">
                <div className="c-meta-top">
                  <span className="c-icon"><i className="fa-solid fa-chart-pie"></i></span>
                  <span className="c-tag">Consumed</span>
                </div>
                <div className="c-number">{consumedCredits.toLocaleString()}</div>
                <div className="c-label">Used</div>
              </div>

              <div className="credit-metric-box box-remaining">
                <div className="c-meta-top">
                  <span className="c-icon"><i className="fa-solid fa-bolt"></i></span>
                  <span className="c-tag">Net Usable</span>
                </div>
                <div className="c-number">{(availableCredits || 0).toLocaleString()}</div>
                <div className="c-label">Remaining</div>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Feature Usage (Section 14) */}
        <section className="usage-section" aria-labelledby="usage-overview-title">
          <div className="usage-section-heading">
            <h2 id="usage-overview-title" className="usage-section-title">
              Feature Usage
            </h2>
            <p className="usage-section-subtitle">
              Monitor your usage and purchased top-ups across key platform features.
            </p>
          </div>

          <div className="usage-metrics-grid">
              <div className="usage-metric-card">
                <div className="metric-card-top">
                  <div className="metric-icon-circle purple">
                    <i className="fa-solid fa-robot"></i>
                  </div>
                  <div className="metric-card-info">
                    <span className="metric-label">AI Copilot</span>
                    <div className="metric-value-row">
                      <span className="metric-value-highlight">
                        {featureUsage.copilot?.used ?? 0} / {(copilotBaseHours + (featureUsage.copilot?.toppedUp || 0)).toFixed(1)}
                      </span>
                      <span className="metric-unit">Hours</span>
                    </div>
                  </div>
                </div>
                <div className="metric-progress-container">
                  <div className="metric-progress-track">
                    <div
                      className="metric-progress-fill gradient-purple"
                      style={{
                        width: `${Math.min(100, Math.round(((featureUsage.copilot?.used ?? 0) / Math.max(0.1, copilotBaseHours + (featureUsage.copilot?.toppedUp || 0))) * 100))}%`
                      }}
                    ></div>
                  </div>
                  <span className="metric-percentage">
                    {Math.min(100, Math.round(((featureUsage.copilot?.used ?? 0) / Math.max(0.1, copilotBaseHours + (featureUsage.copilot?.toppedUp || 0))) * 100))}%
                  </span>
                </div>
                <div className="metric-card-footer">
                  <span className="metric-remaining-text">
                    {Math.max(0, (copilotBaseHours + (featureUsage.copilot?.toppedUp || 0)) - (featureUsage.copilot?.used ?? 0)).toFixed(1)} Hours remaining
                  </span>
                  {featureUsage.copilot?.toppedUp > 0 && (
                    <span className="metric-topped-pill">+{featureUsage.copilot.toppedUp}h Topped Up</span>
                  )}
                </div>
              </div>

              {/* Card 2: Voice Simulator */}
              <div className="usage-metric-card">
                <div className="metric-card-top">
                  <div className="metric-icon-circle blue">
                    <i className="fa-solid fa-microphone"></i>
                  </div>
                  <div className="metric-card-info">
                    <span className="metric-label">Voice Simulator</span>
                    <div className="metric-value-row">
                      <span className="metric-value-highlight">
                        {featureUsage.voice?.used ?? 0} / {(voiceBaseHours + (featureUsage.voice?.toppedUp || 0)).toFixed(2)}
                      </span>
                      <span className="metric-unit">Hours</span>
                    </div>
                  </div>
                </div>
                <div className="metric-progress-container">
                  <div className="metric-progress-track">
                    <div
                      className="metric-progress-fill gradient-blue"
                      style={{
                        width: `${Math.min(100, Math.round(((featureUsage.voice?.used ?? 0) / Math.max(0.1, voiceBaseHours + (featureUsage.voice?.toppedUp || 0))) * 100))}%`
                      }}
                    ></div>
                  </div>
                  <span className="metric-percentage">
                    {Math.min(100, Math.round(((featureUsage.voice?.used ?? 0) / Math.max(0.1, voiceBaseHours + (featureUsage.voice?.toppedUp || 0))) * 100))}%
                  </span>
                </div>
                <div className="metric-card-footer">
                  <span className="metric-remaining-text">
                    {Math.max(0, (voiceBaseHours + (featureUsage.voice?.toppedUp || 0)) - (featureUsage.voice?.used ?? 0)).toFixed(2)} Hours remaining
                  </span>
                  {featureUsage.voice?.toppedUp > 0 && (
                    <span className="metric-topped-pill">+{featureUsage.voice.toppedUp}h Topped Up</span>
                  )}
                </div>
              </div>

            {/* Card 3: Uploads: Unlimited for all plans */}
            <div className="usage-metric-card">
              <div className="metric-card-top">
                <div className="metric-icon-circle emerald">
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <div className="metric-card-info">
                  <span className="metric-label">File Uploads</span>
                  <div className="metric-value-row">
                    <span className="metric-value-highlight">Unlimited</span>
                    <span className="metric-unit">All Plans</span>
                  </div>
                </div>
              </div>
              <div className="metric-progress-container">
                <div className="metric-progress-track">
                  <div
                    className="metric-progress-fill gradient-emerald"
                    style={{ width: '100%' }}
                  ></div>
                </div>
                <span className="metric-percentage">100%</span>
              </div>
              <div className="metric-card-footer">
                <span className="metric-remaining-text">
                  Unlimited uploads · 0 credits deducted
                </span>
                <span className="metric-topped-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                  Free
                </span>
              </div>
            </div>

            {/* Card 4: File Downloads */}
            <div className="usage-metric-card">
              <div className="metric-card-top">
                <div className="metric-icon-circle blue">
                  <i className="fa-solid fa-file-arrow-down"></i>
                </div>
                <div className="metric-card-info">
                  <span className="metric-label">File Downloads</span>
                  <div className="metric-value-row">
                    <span className="metric-value-highlight">
                      {downloadStatus.used} / {downloadLimitCount === -1 ? '∞' : downloadLimitCount}
                    </span>
                    <span className="metric-unit">Downloads</span>
                  </div>
                </div>
              </div>
              <div className="metric-progress-container">
                <div className="metric-progress-track">
                  <div
                    className="metric-progress-fill gradient-blue"
                    style={{
                      width: `${downloadLimitCount === -1 ? 10 : Math.min(100, Math.round((downloadStatus.used / Math.max(1, downloadLimitCount)) * 100))}%`
                    }}
                  ></div>
                </div>
                <span className="metric-percentage">
                  {downloadLimitCount === -1 ? '0%' : `${Math.min(100, Math.round((downloadStatus.used / Math.max(1, downloadLimitCount)) * 100))}%`}
                </span>
              </div>
              <div className="metric-card-footer">
                <span className="metric-remaining-text">
                  {downloadLimitCount === -1 || (downloadLimitCount - downloadStatus.used > 0)
                    ? `${downloadLimitCount === -1 ? 'Unlimited' : Math.max(0, downloadLimitCount - downloadStatus.used)} included remaining`
                    : 'Included limit reached'}
                </span>
                {!downloadStatus.hasIncluded && (
                  <span className="metric-topped-pill" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                    Continue with Credits
                  </span>
                )}
              </div>
            </div>

            {/* Card 4: Notepad & Notes */}
            <div className="usage-metric-card">
              <div className="metric-card-top">
                <div className="metric-icon-circle purple">
                  <i className="fa-regular fa-file-lines"></i>
                </div>
                <div className="metric-card-info">
                  <span className="metric-label">Notepad &amp; Notes</span>
                  <div className="metric-value-row">
                    <span className="metric-value-highlight">
                      {featureUsage.notetaker?.used ?? 0} / {(notetakerBaseHours + (featureUsage.notetaker?.toppedUp || 0)).toFixed(1)}
                    </span>
                    <span className="metric-unit">Hours</span>
                  </div>
                </div>
              </div>
              <div className="metric-progress-container">
                <div className="metric-progress-track">
                  <div
                    className="metric-progress-fill gradient-purple"
                    style={{
                      width: `${Math.min(100, Math.round(((featureUsage.notetaker?.used ?? 0) / Math.max(0.1, notetakerBaseHours + (featureUsage.notetaker?.toppedUp || 0))) * 100))}%`
                    }}
                  ></div>
                </div>
                <span className="metric-percentage">
                  {Math.min(100, Math.round(((featureUsage.notetaker?.used ?? 0) / Math.max(0.1, notetakerBaseHours + (featureUsage.notetaker?.toppedUp || 0))) * 100))}%
                </span>
              </div>
              <div className="metric-card-footer">
                <span className="metric-remaining-text">
                  {Math.max(0, (notetakerBaseHours + (featureUsage.notetaker?.toppedUp || 0)) - (featureUsage.notetaker?.used ?? 0)).toFixed(1)} Hours remaining
                </span>
                {featureUsage.notetaker?.toppedUp > 0 && (
                  <span className="metric-topped-pill">+{featureUsage.notetaker.toppedUp}h Topped Up</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Section: Plan Details & Usage Restrictions (2-Column Grid) */}
        <section className="usage-details-grid">
          {/* Column 1: Plan Details */}
          <div className="usage-panel-card">
            <div className="usage-panel-header">
              <h2 className="usage-panel-title">Plan Details</h2>
              <p className="usage-panel-subtitle">Your current subscription information.</p>
            </div>

            <div className="usage-rows-list">
              <div className="usage-detail-row">
                <div className="usage-detail-left">
                  <i className="fa-regular fa-id-badge usage-detail-icon"></i>
                  <span className="usage-detail-label">Plan Name</span>
                </div>
                <span className="usage-detail-value bold">
                  {displayPlanName}
                </span>
              </div>

              <div className="usage-detail-row">
                <div className="usage-detail-left">
                  <i className="fa-regular fa-credit-card usage-detail-icon"></i>
                  <span className="usage-detail-label">Plan Price</span>
                </div>
                <span className="usage-detail-value bold">
                  {displayPlanPrice}
                </span>
              </div>

              <div className="usage-detail-row">
                <div className="usage-detail-left">
                  <i className="fa-regular fa-calendar-plus usage-detail-icon"></i>
                  <span className="usage-detail-label">Plan Started</span>
                </div>
                <span className="usage-detail-value">
                  {liveSubscription?.startDate ? new Date(liveSubscription.startDate).toLocaleDateString() : (activePlanTier.toUpperCase() === 'FREE' ? 'Free Tier' : 'Active Cycle')}
                </span>
              </div>

              <div className="usage-detail-row">
                <div className="usage-detail-left">
                  <i className="fa-regular fa-calendar-xmark usage-detail-icon"></i>
                  <span className="usage-detail-label">Plan Expires</span>
                </div>
                <span className="usage-detail-value">
                  {liveSubscription?.endDate ? new Date(liveSubscription.endDate).toLocaleDateString() : (activePlanTier.toUpperCase() === 'FREE' ? 'Never (Lifetime)' : 'Auto-renews monthly')}
                </span>
              </div>

              <div className="usage-detail-row">
                <div className="usage-detail-left">
                  <i className="fa-regular fa-clock usage-detail-icon"></i>
                  <span className="usage-detail-label">Total Duration</span>
                </div>
                <span className="usage-detail-value">
                  {activePlanTier.toUpperCase() === 'FREE' ? 'Lifetime' : '30 days'}
                </span>
              </div>

              <div className="usage-detail-row">
                <div className="usage-detail-left">
                  <i className="fa-solid fa-hourglass-half usage-detail-icon"></i>
                  <span className="usage-detail-label">Days Used</span>
                </div>
                <span className="usage-detail-value">
                  {activePlanTier.toUpperCase() === 'FREE' ? 'Ongoing' : 'Current Cycle'}
                </span>
              </div>

              <div className="usage-detail-row">
                <div className="usage-detail-left">
                  <i className="fa-regular fa-calendar-days usage-detail-icon"></i>
                  <span className="usage-detail-label">Days Remaining</span>
                </div>
                <span className="usage-detail-value">
                  {activePlanTier.toUpperCase() === 'FREE' ? 'Unlimited' : '30 days remaining'}
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Usage Restrictions */}
          <div className="usage-panel-card">
            <div className="usage-panel-header">
              <h2 className="usage-panel-title">Usage Restrictions</h2>
              <p className="usage-panel-subtitle">Limits and restrictions for your current plan.</p>
            </div>

            <div className="usage-restrictions-list">
              {/* Voice Minutes */}
              <div className="usage-restriction-row">
                <div className="restriction-left">
                  <div className="restriction-icon-box purple">
                    <i className="fa-solid fa-microphone"></i>
                  </div>
                  <div className="restriction-text-group">
                    <span className="restriction-name">Voice Minutes</span>
                    <span className="restriction-limit-desc">
                      {Math.round(voiceBaseHours * 60)} minutes per cycle
                    </span>
                  </div>
                </div>
                <div className="restriction-status green">
                  <i className="fa-solid fa-check"></i>
                  <span>
                    {Math.round((featureUsage.voice?.used || 0) * 60)} / {Math.round(voiceBaseHours * 60)} used
                  </span>
                </div>
              </div>

              {/* AI Copilot (Interview) */}
              <div className="usage-restriction-row">
                <div className="restriction-left">
                  <div className="restriction-icon-box purple">
                    <i className="fa-solid fa-user-astronaut"></i>
                  </div>
                  <div className="restriction-text-group">
                    <span className="restriction-name">AI Copilot (Interview)</span>
                    <span className="restriction-limit-desc">
                      {Math.round(copilotBaseHours * 60)} minutes per month
                    </span>
                  </div>
                </div>
                <div className="restriction-status green">
                  <i className="fa-solid fa-check"></i>
                  <span>
                    {Math.round((featureUsage.copilot?.used || 0) * 60)} / {Math.round(copilotBaseHours * 60)} used
                  </span>
                </div>
              </div>

              {/* Meeting Intelligence */}
              <div className="usage-restriction-row">
                <div className="restriction-left">
                  <div className="restriction-icon-box purple">
                    <i className="fa-solid fa-video"></i>
                  </div>
                  <div className="restriction-text-group">
                    <span className="restriction-name">Meeting Intelligence</span>
                    <span className="restriction-limit-desc">
                      {Math.round(notetakerBaseHours * 60)} minutes per month
                    </span>
                  </div>
                </div>
                <div className="restriction-status green">
                  <i className="fa-solid fa-check"></i>
                  <span>
                    {Math.round((featureUsage.notetaker?.used || 0) * 60)} / {Math.round(notetakerBaseHours * 60)} used
                  </span>
                </div>
              </div>

              {/* Cloud Storage */}
              <div className="usage-restriction-row">
                <div className="restriction-left">
                  <div className="restriction-icon-box purple">
                    <i className="fa-solid fa-cloud"></i>
                  </div>
                  <div className="restriction-text-group">
                    <span className="restriction-name">Cloud Storage</span>
                    <span className="restriction-limit-desc">
                      {uploadMaxMb} MB total storage
                    </span>
                  </div>
                </div>
                <div className="restriction-status green">
                  <i className="fa-solid fa-check"></i>
                  <span>Within limit</span>
                </div>
              </div>

              {/* File Upload Size */}
              <div className="usage-restriction-row">
                <div className="restriction-left">
                  <div className="restriction-icon-box purple">
                    <i className="fa-solid fa-file-arrow-up"></i>
                  </div>
                  <div className="restriction-text-group">
                    <span className="restriction-name">File Upload Size</span>
                    <span className="restriction-limit-desc">
                      {uploadMaxMb} MB per file
                    </span>
                  </div>
                </div>
                <div className="restriction-status green">
                  <i className="fa-solid fa-check"></i>
                  <span>Within limit</span>
                </div>
              </div>

              {/* Number of Sessions */}
              <div className="usage-restriction-row">
                <div className="restriction-left">
                  <div className="restriction-icon-box purple">
                    <i className="fa-solid fa-layer-group"></i>
                  </div>
                  <div className="restriction-text-group">
                    <span className="restriction-name">Number of Sessions</span>
                    <span className="restriction-limit-desc">Unlimited</span>
                  </div>
                </div>
                <div className="restriction-status green">
                  <i className="fa-solid fa-check"></i>
                  <span>Within limit</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Recent Usage Activity Table */}
        <section className="usage-activity-section" aria-labelledby="usage-activity-title">
          <div className="usage-panel-card full-width">
            <div className="usage-activity-header">
              <div className="usage-panel-header-left">
                <h2 id="usage-activity-title" className="usage-panel-title">
                  Recent Usage Activity
                </h2>
                <p className="usage-panel-subtitle">Your recent activity and usage details.</p>
              </div>
              <button
                onClick={() => setShowAllActivityModal(true)}
                className="usage-view-all-btn"
                type="button"
              >
                <span>View All Activity</span>
                <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>

            <div className="usage-table-responsive">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '22%' }}>Date &amp; Time</th>
                    <th scope="col" style={{ width: '22%' }}>Feature</th>
                    <th scope="col" style={{ width: '16%' }}>Usage</th>
                    <th scope="col" style={{ width: '40%' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {dynamicActivities.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                        <i className="fa-regular fa-clock" style={{ fontSize: '24px', display: 'block', marginBottom: '8px', opacity: 0.6 }}></i>
                        No activity recorded yet. Your real-time session logs, downloads, and credit usage will appear here automatically.
                      </td>
                    </tr>
                  ) : (
                    dynamicActivities.slice(0, 4).map((item) => (
                      <tr key={item.id} className="usage-table-row">
                        <td className="usage-cell-datetime">{item.dateTime}</td>
                        <td className="usage-cell-feature">
                          <i
                            className={`${item.icon} feature-icon`}
                            style={{ color: item.iconColor }}
                          ></i>
                          <span className="feature-name">{item.feature}</span>
                        </td>
                        <td className="usage-cell-usage">{item.usage}</td>
                        <td className="usage-cell-details">{item.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 14: Payment & Top-up History */}
        <section className="usage-activity-section payment-history-section" aria-labelledby="payment-history-title">
          <div className="usage-panel-card full-width">
            <div className="usage-activity-header">
              <div className="usage-panel-header-left">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="history-header-badge">
                    <i className="fa-solid fa-receipt"></i>
                  </div>
                  <div>
                    <h2 id="payment-history-title" className="usage-panel-title">
                      {historyTab === 'topup' ? 'Top-Up History' : 'Payment & Top-up History'}
                    </h2>
                    <p className="usage-panel-subtitle">
                      {historyTab === 'topup'
                        ? 'Log of capacity additions, additional hours, and credit top-ups for your plan.'
                        : 'Complete log of your subscription upgrades, credit top-ups, and transactions.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Header Controls: History Tab Switcher & Filters */}
              <div className="history-header-controls">
                <div className="history-type-tabs">
                  <button
                    type="button"
                    className={`history-type-tab-btn ${historyTab === 'topup' ? 'active' : ''}`}
                    onClick={() => setHistoryTab('topup')}
                  >
                    <i className="fa-solid fa-bolt"></i>
                    <span>Top-Up History</span>
                  </button>
                  <button
                    type="button"
                    className={`history-type-tab-btn ${historyTab === 'all' ? 'active' : ''}`}
                    onClick={() => setHistoryTab('all')}
                  >
                    <i className="fa-solid fa-receipt"></i>
                    <span>All Transactions</span>
                  </button>
                </div>

                {historyTab === 'all' && (
                  <>
                    <div className="history-filter-pills">
                      {['ALL', 'Successful', 'Failed', 'Pending'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`history-filter-pill ${historyFilter === status ? 'active' : ''}`}
                          onClick={() => setHistoryFilter(status)}
                        >
                          {status === 'ALL' ? 'All' : status}
                        </button>
                      ))}
                    </div>

                    <div className="history-search-input-box">
                      <i className="fa-solid fa-magnifying-glass"></i>
                      <input
                        type="text"
                        placeholder="Search history..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                      />
                      {historySearch && (
                        <button
                          type="button"
                          className="history-search-clear"
                          onClick={() => setHistorySearch('')}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* TAB 1: Section 14 Top-Up History Table [Date, Feature, Hours, Credits, Status] */}
            {historyTab === 'topup' ? (
              <div className="usage-table-responsive history-desktop-table">
                <table className="usage-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '22%' }}>Date</th>
                      <th scope="col" style={{ width: '24%' }}>Feature</th>
                      <th scope="col" style={{ width: '18%' }}>Hours</th>
                      <th scope="col" style={{ width: '20%' }}>Credits</th>
                      <th scope="col" style={{ width: '16%' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topUpHistory.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                          <i className="fa-regular fa-folder-open" style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}></i>
                          No top-up history recorded yet.
                        </td>
                      </tr>
                    ) : (
                      topUpHistory.map((item) => (
                        <tr key={item.id} className="usage-table-row">
                          <td className="usage-cell-datetime">{item.date}</td>
                          <td className="usage-cell-feature">
                            <span className="topup-feat-cell-badge">
                              <i className={
                                item.featureId === 'voice'
                                  ? 'fa-solid fa-microphone'
                                  : item.featureId === 'upload'
                                  ? 'fa-solid fa-cloud-arrow-up'
                                  : item.featureId === 'notetaker'
                                  ? 'fa-regular fa-file-lines'
                                  : 'fa-solid fa-robot'
                              } style={{
                                color: item.featureId === 'voice'
                                  ? '#38bdf8'
                                  : item.featureId === 'upload'
                                  ? '#10b981'
                                  : item.featureId === 'notetaker'
                                  ? '#a855f7'
                                  : '#6366f1'
                              }}></i>
                              <strong className="topup-feat-name">{item.feature}</strong>
                            </span>
                          </td>
                          <td className="usage-cell-usage bold highlight-hours">
                            +{item.hours} {item.unit || 'Hours'}
                          </td>
                          <td className="usage-cell-usage">
                            <span className="credits-badge-pill">
                              <i className="fa-solid fa-coins"></i> {item.credits.toLocaleString()} Credits
                            </span>
                          </td>
                          <td className="usage-cell-details">
                            <span className="txn-status-badge status-successful">
                              <i className="fa-solid fa-circle-check"></i> {item.status || 'Successful'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* TAB 2: Full Transaction Log */
              <div className="usage-table-responsive history-desktop-table">
                <table className="usage-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '15%' }}>Type</th>
                      <th scope="col" style={{ width: '22%' }}>Plan / Package</th>
                      <th scope="col" style={{ width: '15%' }}>Credits Detail</th>
                      <th scope="col" style={{ width: '14%' }}>Amount Paid</th>
                      <th scope="col" style={{ width: '16%' }}>Payment Method</th>
                      <th scope="col" style={{ width: '18%' }}>Date &amp; Time</th>
                      <th scope="col" style={{ width: '10%' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                          <i className="fa-regular fa-folder-open" style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}></i>
                          No transactions found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((txn) => (
                        <tr key={txn.id} className="usage-table-row">
                          <td className="usage-cell-feature">
                            <span className={`txn-type-badge ${txn.type?.toLowerCase().includes('credit') ? 'type-credit' : 'type-plan'}`}>
                              <i className={`fa-solid ${txn.type?.toLowerCase().includes('credit') ? 'fa-coins' : 'fa-award'}`}></i>
                              {txn.type}
                            </span>
                          </td>
                          <td className="usage-cell-details" style={{ fontWeight: 600, color: '#f8fafc' }}>
                            {txn.planOrPackage}
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>{txn.id}</div>
                          </td>
                          <td className="usage-cell-usage">
                            {txn.creditsAdded > 0 && (
                              <span style={{ color: '#10b981', fontWeight: 600 }}>
                                +{txn.creditsAdded.toLocaleString()} added
                              </span>
                            )}
                            {txn.creditsUsed > 0 && (
                              <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                                -{txn.creditsUsed.toLocaleString()} used
                              </span>
                            )}
                            {!txn.creditsAdded && !txn.creditsUsed && (
                              <span style={{ color: '#64748b' }}>—</span>
                            )}
                          </td>
                          <td className="usage-cell-usage" style={{ fontWeight: 700, color: txn.amount === 0 ? '#10b981' : '#f1f5f9' }}>
                            {txn.amount === 0 ? '$0 (Covered by Credits)' : `${txn.currencySymbol || '$'}${txn.amount} ${txn.currency || 'USD'}`}
                          </td>
                          <td className="usage-cell-feature">
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <i className="fa-solid fa-credit-card" style={{ color: '#818cf8', fontSize: '12px' }}></i>
                              {txn.paymentMethod}
                            </span>
                          </td>
                          <td className="usage-cell-datetime">{txn.dateTime}</td>
                          <td className="usage-cell-details">
                            <span className={`txn-status-badge status-${txn.status?.toLowerCase()}`}>
                              <i className={`fa-solid ${
                                txn.status === 'Successful'
                                  ? 'fa-circle-check'
                                  : txn.status === 'Failed'
                                  ? 'fa-circle-xmark'
                                  : 'fa-clock'
                              }`}></i>
                              {txn.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mobile Card Layout */}
            <div className="history-mobile-cards">
              {historyTab === 'topup' ? (
                topUpHistory.map((item) => (
                  <div key={item.id} className="history-mobile-card">
                    <div className="mobile-card-top">
                      <div className="mobile-card-title-group">
                        <span className="txn-type-badge type-credit">Top-Up</span>
                        <strong className="mobile-card-name">{item.feature}</strong>
                      </div>
                      <span className="txn-status-badge status-successful">{item.status || 'Successful'}</span>
                    </div>
                    <div className="mobile-card-rows">
                      <div className="mobile-card-row">
                        <span className="m-lbl">Hours</span>
                        <span className="m-val bold highlight-hours">+{item.hours} {item.unit || 'Hours'}</span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="m-lbl">Credits</span>
                        <span className="m-val">{item.credits.toLocaleString()} Credits</span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="m-lbl">Date</span>
                        <span className="m-val">{item.date}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : filteredTransactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 16px', color: '#94a3b8' }}>
                  No transactions found.
                </div>
              ) : (
                filteredTransactions.map((txn) => (
                  <div key={txn.id} className="history-mobile-card">
                    <div className="mobile-card-top">
                      <div className="mobile-card-title-group">
                        <span className={`txn-type-badge ${txn.type?.toLowerCase().includes('credit') ? 'type-credit' : 'type-plan'}`}>
                          {txn.type}
                        </span>
                        <strong className="mobile-card-name">{txn.planOrPackage}</strong>
                      </div>
                      <span className={`txn-status-badge status-${txn.status?.toLowerCase()}`}>
                        {txn.status}
                      </span>
                    </div>

                    <div className="mobile-card-grid">
                      <div className="mobile-card-field">
                        <span className="mobile-field-lbl">Amount:</span>
                        <strong className="mobile-field-val">
                          {txn.amount === 0 ? '$0' : `${txn.currencySymbol || '$'}${txn.amount} ${txn.currency || 'USD'}`}
                        </strong>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-field-lbl">Credits:</span>
                        <span className="mobile-field-val">
                          {txn.creditsAdded > 0 ? `+${txn.creditsAdded.toLocaleString()}` : txn.creditsUsed > 0 ? `-${txn.creditsUsed.toLocaleString()}` : '—'}
                        </span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-field-lbl">Method:</span>
                        <span className="mobile-field-val">{txn.paymentMethod}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-field-lbl">Date:</span>
                        <span className="mobile-field-val">{txn.dateTime}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Modal: View All Activity */}
      {showAllActivityModal && (
        <div
          className="usage-modal-backdrop"
          onClick={() => setShowAllActivityModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="usage-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="usage-modal-header">
              <div>
                <h3 className="usage-modal-title">All Usage Activity</h3>
                <p className="usage-modal-subtitle">
                  Detailed timeline of feature interactions and resource consumption.
                </p>
              </div>
              <button
                onClick={() => setShowAllActivityModal(false)}
                className="usage-modal-close-btn"
                type="button"
                aria-label="Close modal"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="usage-modal-controls">
              <div className="usage-filter-pills">
                {['ALL', 'Voice', 'AI Copilot', 'Meeting', 'Cloud'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActivityFilter(tab)}
                    className={`usage-filter-pill ${activityFilter === tab ? 'active' : ''}`}
                    type="button"
                  >
                    {tab === 'ALL' ? 'All Features' : tab}
                  </button>
                ))}
              </div>
              <div className="usage-search-box">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input
                  type="text"
                  placeholder="Search activity..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="usage-search-clear"
                    type="button"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>
            </div>

            <div className="usage-modal-body">
              <div className="usage-table-responsive">
                <table className="usage-table">
                  <thead>
                    <tr>
                      <th scope="col">Date &amp; Time</th>
                      <th scope="col">Feature</th>
                      <th scope="col">Usage</th>
                      <th scope="col">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivities.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="usage-table-empty">
                          No matching activity found.
                        </td>
                      </tr>
                    ) : (
                      filteredActivities.map((item) => (
                        <tr key={item.id} className="usage-table-row">
                          <td className="usage-cell-datetime">{item.dateTime}</td>
                          <td className="usage-cell-feature">
                            <i
                              className={`${item.icon} feature-icon`}
                              style={{ color: item.iconColor }}
                            ></i>
                            <span className="feature-name">{item.feature}</span>
                          </td>
                          <td className="usage-cell-usage">{item.usage}</td>
                          <td className="usage-cell-details">{item.details}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="usage-modal-footer">
              <span className="usage-modal-count">
                Showing {filteredActivities.length} of {dynamicActivities.length} records
              </span>
              <button
                onClick={() => setShowAllActivityModal(false)}
                className="usage-modal-done-btn"
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
