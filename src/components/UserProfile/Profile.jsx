import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AccountDropdown from './AccountDropdown';
import { API_BASE } from '../../utils/api';
import { getActiveUserPlanTier } from '../subscription/topUpStore';
import { getUserCredits, hasUserModifiedCredits } from '../subscription/transactionHistoryStore';
import SidebarDrawer from '../SidebarDrawer';
import BrandLogo from '../common/BrandLogo';
import './Profile.css';

const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;
function formatDuration(totalSeconds) {
  const seconds = Number(totalSeconds) || 0;
  if (seconds <= 0) return '0m 0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m ${secs}s`;
}

function getInitials(name, email) {
  if (name && typeof name === 'string' && name.trim()) {
    const trimmed = name.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    const caps = trimmed.match(/[A-Z]/g);
    if (caps && caps.length >= 2) {
      return (caps[0] + caps[1]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && typeof email === 'string') {
    const localPart = email.trim().split('@')[0];
    const parts = localPart.split(/[._-]/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return localPart.slice(0, 2).toUpperCase();
  }
  return 'U';
}

const getStorageKey = (u) => {
  return u?.email 
    ? `copilot_recent_sessions_${u.email}` 
    : 'copilot_recent_sessions';
};

const getProfileCacheKey = (u) => {
  return u?.email 
    ? `copilot_profile_sessions_cache_${u.email}` 
    : 'copilot_profile_sessions_cache';
};

function normalizeSession(s) {
  if (!s) return null;
  const p = s.payload || {};
  const durationDisplay = s.durationDisplay || p.durationDisplay || s.timer || p.timer || '00:00:00';
  let durationSeconds = Number(s.durationSeconds) || Number(p.durationSeconds) || 0;
  if (!durationSeconds && durationDisplay) {
    const parts = String(durationDisplay).split(':').map(Number);
    if (parts.length === 3) {
      durationSeconds = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    } else if (parts.length === 2) {
      durationSeconds = (parts[0] || 0) * 60 + (parts[1] || 0);
    }
  }

  const questionCount = Number(s.questionCount) || Number(p.questionCount) || Number(s.qsCount) || Number(p.qsCount) || 0;
  const title = s.title || s.name || p.name || 'Live Session';
  const tech = s.tech || p.tech || 'Interview';
  const createdAt = s.createdAt || s.timestamp || p.timestamp || '';

  return {
    ...s,
    id: s.id,
    title,
    name: title,
    tech,
    durationDisplay,
    durationSeconds,
    questionCount,
    createdAt
  };
}

export function isMeetingNotesSession(s) {
  if (!s) return false;
  const p = s.payload || {};
  if (p.isNotetaker || p.sessionType === 'notetaker' || s.isNotetaker || s.sessionType === 'notetaker') {
    return true;
  }
  const title = String(s.title || s.name || p.name || '').trim().toLowerCase();
  if (title.startsWith('meeting notes') || title.startsWith('notetaker') || title.includes('meeting note')) {
    return true;
  }
  const tech = String(s.tech || p.tech || '').trim().toLowerCase();
  if (tech.includes('notetaker') || tech.startsWith('meeting notes') || tech.includes('meeting note')) {
    return true;
  }
  return false;
}

function getInitialSessions(u) {
  const mergedMap = new Map();
  const addItems = (items) => {
    if (!Array.isArray(items)) return;
    for (const raw of items) {
      const norm = normalizeSession(raw);
      if (norm && norm.id && !mergedMap.has(String(norm.id))) {
        mergedMap.set(String(norm.id), norm);
      }
    }
  };

  try {
    const profileKey = getProfileCacheKey(u);
    const cachedProfile = localStorage.getItem(profileKey);
    if (cachedProfile) {
      addItems(JSON.parse(cachedProfile));
    }
  } catch (_) {}

  try {
    const recentKey = getStorageKey(u);
    const cachedRecent = localStorage.getItem(recentKey);
    if (cachedRecent) {
      addItems(JSON.parse(cachedRecent));
    }
  } catch (_) {}

  try {
    const cachedNotes = localStorage.getItem('notetaker_saved_sessions');
    if (cachedNotes) {
      addItems(JSON.parse(cachedNotes));
    }
  } catch (_) {}

  return Array.from(mergedMap.values());
}

export default function Profile({
  token,
  user,
  onLogout,
  onBackToLanding,
  onGoToPanel,
  onGoToNotetaker,
  onGoToVoiceAgent,
  onGoToUpload,
  onGoToDashboard,
  onGoToProfile,
  onGoToSubscription,
  onGoToUsage,
  onGoToReferral,
  showToast,
  darkMode,
  toggleDarkMode,
  windowType
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState(() => getInitialSessions(user));
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [wallet, setWallet] = useState(() => ({
    availableCredits: getUserCredits(),
    pendingCredits: 0,
    lifetimeEarned: getUserCredits()
  }));
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);

  const handleMinimize = () => ipcRenderer?.send('window-minimize');
  const handleMaximize = () => ipcRenderer?.send('window-maximize');
  const handleClose = () => ipcRenderer?.send('window-close');

  // Editable Username State (Section 10)
  const [customUsername, setCustomUsername] = useState(() => {
    return localStorage.getItem('copilot_user_username') || user?.name || (user?.email ? user.email.split('@')[0] : 'User');
  });
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(customUsername);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameSaveSuccess, setUsernameSaveSuccess] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  // Delete Account / Danger Zone State (Section 11)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [accountDeletedState, setAccountDeletedState] = useState(false);

  // Active Plan Tier & Dynamic Plans State
  const [activePlanTier, setActivePlanTier] = useState(() => getActiveUserPlanTier());
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    const handleTierSync = (e) => {
      const newTier = e.detail || getActiveUserPlanTier();
      setActivePlanTier(newTier);
    };
    window.addEventListener('copilot-plan-tier-updated', handleTierSync);

    const fetchPlansData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/plans`, {
          headers: { 'x-suppress-auth-redirect': 'true' }
        });
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : data?.plans;
          if (Array.isArray(arr) && arr.length > 0) {
            setPlans(arr);
          }
        }
      } catch (_) {}
    };
    fetchPlansData();

    return () => window.removeEventListener('copilot-plan-tier-updated', handleTierSync);
  }, []);

  const currentPlanObj = useMemo(() => {
    const tierUpper = (activePlanTier || 'FREE').toUpperCase();
    return (plans || []).find(p => String(p.id).toUpperCase() === tierUpper || String(p.tier).toUpperCase() === tierUpper) || null;
  }, [plans, activePlanTier]);

  const planPriceMonthly = currentPlanObj?.priceMonthly ?? (activePlanTier.toUpperCase() === 'PRO_PLUS' ? 79 : activePlanTier.toUpperCase() === 'PRO' ? 29 : 0);
  const planNameDisplay = currentPlanObj?.name || (activePlanTier.toUpperCase() === 'PRO_PLUS' ? 'Pro Plus VIP' : activePlanTier.toUpperCase() === 'PRO' ? 'Pro Plan' : 'Free Plan');

  const displayName = customUsername || user?.name || (user?.email ? user.email.split('@')[0] : 'User');
  const displayEmail = user?.email || (displayName !== 'User' ? `${displayName.toLowerCase().replace(/\s+/g, '')}@copilot.ai` : 'user@copilot.ai');
  const initials = getInitials(displayName, displayEmail);

  // Exact username match verification for account deletion
  const isUsernameMatch = deleteConfirmInput.trim() === displayName.trim();

  const handleOpenDeleteModal = () => {
    setDeleteConfirmInput('');
    setDeleteError('');
    setDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    if (isDeletingAccount) return;
    setDeleteModalOpen(false);
    setDeleteConfirmInput('');
    setDeleteError('');
  };

  const handleStartEditUsername = () => {
    setUsernameInput(customUsername);
    setUsernameError('');
    setUsernameSaveSuccess(false);
    setIsEditingUsername(true);
  };

  const handleCancelEditUsername = () => {
    setIsEditingUsername(false);
    setUsernameError('');
    setUsernameInput(customUsername);
  };

  const handleSaveUsername = async () => {
    const trimmed = usernameInput.trim();
    if (!trimmed) {
      setUsernameError('Username cannot be empty.');
      return;
    }
    setIsSavingUsername(true);
    setUsernameError('');

    try {
      if (token) {
        const res = await fetch(`${API_BASE}/api/referrals/me`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-suppress-auth-redirect': 'true',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ displayName: trimmed })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errMsg = data?.error?.message || 'Unable to update username.';
          setUsernameError(errMsg);
          setIsSavingUsername(false);
          return;
        }
      }
      localStorage.setItem('copilot_user_username', trimmed);
      setCustomUsername(trimmed);
      setIsSavingUsername(false);
      setIsEditingUsername(false);
      setUsernameSaveSuccess(true);
      if (showToast) showToast('Username saved successfully');
      setTimeout(() => setUsernameSaveSuccess(false), 3000);
    } catch (err) {
      console.warn('[Profile] Username update notice:', err.message);
      localStorage.setItem('copilot_user_username', trimmed);
      setCustomUsername(trimmed);
      setIsSavingUsername(false);
      setIsEditingUsername(false);
      setUsernameSaveSuccess(true);
      if (showToast) showToast('Username saved successfully');
      setTimeout(() => setUsernameSaveSuccess(false), 3000);
    }
  };

  const handleConfirmDeleteAccount = () => {
    if (!isUsernameMatch) {
      setDeleteError('Kripya apna exact username same type karein.');
      return;
    }

    setDeleteError('');
    setDeleteModalOpen(false);

    showToast(
      'Account deletion is currently unavailable. Please contact support to request account deletion.'
    );
  };


  const handleResetDemoAccount = () => {
    setAccountDeletedState(false);
    setCustomUsername(user?.name || (user?.email ? user.email.split('@')[0] : 'User'));
    localStorage.removeItem('copilot_user_username');
    if (showToast) showToast('Account state reset.');
  };

  const loadSessionsFromLocal = useCallback(() => {
    try {
      const local = getInitialSessions(user);
      if (local && local.length > 0) {
        setSessions(prev => {
          const prevMap = new Map(prev.map(p => [String(p.id), p]));
          const merged = [...local];
          for (const s of prev) {
            if (!merged.some(m => String(m.id) === String(s.id))) {
              merged.push(s);
            }
          }
          return merged;
        });
        setIsLoadingSessions(false);
      }
      return local;
    } catch (_) {
      return [];
    }
  }, [user]);

  const syncSessionsFromServer = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.sessions)) {
        const backendNormalized = data.sessions.map(normalizeSession).filter(Boolean);
        const backendIds = new Set(backendNormalized.map(s => String(s.id)));

        // Keep any recent local sessions that might not yet be in the backend database
        let unsyncedLocal = [];
        try {
          const recentKey = getStorageKey(user);
          const cachedRecent = localStorage.getItem(recentKey);
          if (cachedRecent) {
            const parsedRecent = JSON.parse(cachedRecent);
            if (Array.isArray(parsedRecent)) {
              unsyncedLocal = parsedRecent
                .map(normalizeSession)
                .filter(Boolean)
                .filter(s => !backendIds.has(String(s.id)));
            }
          }
        } catch (_) {}

        const combined = [...unsyncedLocal, ...backendNormalized];
        setSessions(combined);
        setSessionsError(null);
        try {
          localStorage.setItem(getProfileCacheKey(user), JSON.stringify(combined));
        } catch (_) {}
      }
    } catch (err) {
      console.warn('[Profile] Failed to fetch sessions from server:', err.message);
      setSessions(prev => {
        if (!prev || prev.length === 0) {
          setSessionsError('Could not load session history');
        }
        return prev;
      });
    } finally {
      setIsLoadingSessions(false);
    }
  }, [token, user]);

  const refreshSessions = useCallback((showSpinnerIfEmpty = false) => {
    const local = loadSessionsFromLocal();
    if (showSpinnerIfEmpty && local.length === 0) {
      setIsLoadingSessions(true);
    }
    syncSessionsFromServer();
  }, [loadSessionsFromLocal, syncSessionsFromServer]);

  // Synchronize when navigating to Profile view or on initial load
  useEffect(() => {
    if (windowType === 'profile' || !windowType) {
      refreshSessions(sessions.length === 0);
    }
  }, [windowType, token, user, refreshSessions]);
 
  // Fetch real credit balance from the backend with real-time updates and local fallback
  useEffect(() => {
    const loadWalletBalance = () => {
      if (!token) {
        setWallet(prev => ({ ...prev, availableCredits: getUserCredits() }));
        return;
      }

      setIsLoadingWallet(true);

      fetch(`${API_BASE}/api/credits/balance`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-suppress-auth-redirect': 'true'
        }
      })
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          const credits = data?.credits || {};
          const backendAvail = Number(credits.availableCredits || 0);
          const finalCredits = hasUserModifiedCredits() ? getUserCredits() : backendAvail;

          setWallet({
            availableCredits: finalCredits,
            pendingCredits: Number(credits.pendingCredits || 0),
            lifetimeEarned: Number(credits.lifetimeEarned || finalCredits)
          });
        })
        .catch(err => {
          console.warn(
            '[Profile] Failed to load credit balance, using local store:',
            err.message
          );
          setWallet(prev => ({
            ...prev,
            availableCredits: getUserCredits()
          }));
        })
        .finally(() => setIsLoadingWallet(false));
    };

    loadWalletBalance();

    const handleWalletUpdated = (e) => {
      if (e?.detail?.newBalance !== undefined) {
        setWallet(prev => ({ ...prev, availableCredits: Number(e.detail.newBalance) }));
      }
      loadWalletBalance();
    };

    const handleCopilotCreditsUpdated = (e) => {
      const bal = typeof e.detail === 'number' ? e.detail : getUserCredits();
      setWallet(prev => ({ ...prev, availableCredits: bal }));
    };

    window.addEventListener('walletBalanceUpdated', handleWalletUpdated);
    window.addEventListener('copilot-credits-updated', handleCopilotCreditsUpdated);
    window.addEventListener('storage', handleWalletUpdated);
    return () => {
      window.removeEventListener('walletBalanceUpdated', handleWalletUpdated);
      window.removeEventListener('copilot-credits-updated', handleCopilotCreditsUpdated);
      window.removeEventListener('storage', handleWalletUpdated);
    };
  }, [token]);

  // Real-time synchronization when an interview is saved or deleted in AI Copilot
  useEffect(() => {
    const handleSessionsChanged = () => {
      refreshSessions(false);
    };

    window.addEventListener('kairos-sessions-updated', handleSessionsChanged);
    window.addEventListener('storage', handleSessionsChanged);
    return () => {
      window.removeEventListener('kairos-sessions-updated', handleSessionsChanged);
      window.removeEventListener('storage', handleSessionsChanged);
    };
  }, [refreshSessions]);

  // Derive real statistics from existing sessions
  const totalSessions = sessions.length;
  const totalDurationSeconds = sessions.reduce((acc, s) => acc + (Number(s.durationSeconds) || 0), 0);
  const totalQuestions = sessions.reduce((acc, s) => acc + (Number(s.questionCount) || 0), 0);

  const handleSessionClick = (sess) => {
    if (!sess) {
      setShowAllSessions(prev => !prev);
      return;
    }

    const isNotes = isMeetingNotesSession(sess);
    if (isNotes) {
      if (onGoToNotetaker) {
        onGoToNotetaker('past', sess.id);
      }
      return;
    }

    try {
      sessionStorage.setItem('copilot_target_tab', 'recent');
      if (sess?.id) {
        sessionStorage.setItem('copilot_target_session_id', String(sess.id));
      }
    } catch (_) {}
    if (onGoToPanel) {
      onGoToPanel('recent', sess?.id);
    }
  };

  return (
    <div className={`interview-panel-root profile-page-root ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* Background Pastel Ambience Glows */}
      <div className="profile-bg-glow-1"></div>
      <div className="profile-bg-glow-2"></div>

      {/* Slide-out Sidebar Drawer with Full AI Copilot Suite & Workspace Navigation */}
      <SidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        displayName={displayName}
        initials={initials}
        activePlanTier={activePlanTier}
        planNameDisplay={planNameDisplay}
        planPriceMonthly={planPriceMonthly}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        onBackToLanding={onBackToLanding}
        onGoToDashboard={onGoToDashboard}
        onGoToSubscription={onGoToSubscription}
        onGoToPanel={onGoToPanel}
        onGoToNotetaker={onGoToNotetaker}
        onGoToVoiceAgent={onGoToVoiceAgent}
        onGoToUpload={onGoToUpload}
        onGoToReferral={onGoToReferral}
        onGoToProfile={onGoToProfile}
        onLogout={onLogout}
        showToast={showToast}
        currentView="profile"
      />

      {/* Top Main Navbar - Clean, Elegant & Responsive */}
      <header className="profile-top-navbar">
        <div className="profile-nav-left">
          <button 
            className="profile-nav-hamburger" 
            onClick={() => setIsSidebarOpen(true)} 
            type="button" 
            title="Open Features & Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <i className="fa-solid fa-bars"></i>
          </button>
          <BrandLogo onClick={onBackToLanding} size="md" />
        </div>

        <nav className="profile-nav-center-tabs">
          <button onClick={onBackToLanding} className="profile-nav-tab" type="button">
            <i className="fa-solid fa-house"></i> Home
          </button>
          <button onClick={onGoToDashboard} className="profile-nav-tab" type="button">
            <i className="fa-solid fa-chart-line"></i> Dashboard
          </button>
          <button onClick={onGoToSubscription} className="profile-nav-tab" type="button">
            <i className="fa-solid fa-crown"></i> Plans &amp; Pricing
          </button>
        </nav>

        <div className="profile-nav-right">
          <button onClick={onGoToPanel} className="profile-nav-pill-btn btn-copilot" type="button" title="Launch AI Copilot">
            <i className="fa-solid fa-star"></i> AI Copilot
          </button>
          <button onClick={toggleDarkMode} className="profile-nav-icon-btn" type="button" title="Toggle Theme">
            <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <div className="profile-nav-lang-picker" title="Language: English (US)">
            <span>EN</span>
            <i className="fa-solid fa-chevron-down"></i>
          </div>
          <div className="profile-nav-user-circle" onClick={onGoToProfile} title="Profile">
            {initials}
          </div>
        </div>
      </header>

      {/* Top Breadcrumb & Disclaimer Bar */}
      <div className="profile-top-bar">
        <div className="profile-breadcrumb">
          <button 
            type="button" 
            onClick={onBackToLanding} 
            className="profile-crumb-home-btn"
            title="Go to Home"
          >
            <i className="fa-solid fa-house"></i> Home
          </button>
          <span className="profile-crumb-sep">&gt;</span>
          <span className="profile-crumb-active">Profile</span>
        </div>
        <div className="profile-disclaimer-pill">
          <i className="fa-solid fa-circle-info"></i>
          <span>No guarantee of results. This is an AI practice tool only.</span>
        </div>
      </div>

      {/* Profile Main Content Container */}
      <main className="profile-content-container">
        {/* Profile Hero Header Card */}
        <section className="profile-hero-card">
          <div className="profile-hero-left">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar-circle">
                {initials}
              </div>
              <span className="profile-avatar-online-dot" title="Online"></span>
            </div>
            <div className="profile-hero-info">
              <div className="profile-hero-name-row">
                <h1 className="profile-hero-name">{displayName}</h1>
                <span className="profile-hero-plan-pill">
                  <i className="fa-solid fa-circle-check"></i>
                  <span>{activePlanTier.toUpperCase() === 'FREE' ? 'Free Plan ($0/mo)' : `${planNameDisplay} ($${planPriceMonthly}/mo)`}</span>
                </span>
                <span 
                  className="profile-hero-credits-pill" 
                  onClick={onGoToSubscription} 
                  title="Click to view subscription / buy credits"
                  style={{ cursor: 'pointer' }}
                >
                  <i className="fa-solid fa-coins"></i>
                  <span>{wallet.availableCredits} Credits</span>
                </span>
              </div>
              <p className="profile-hero-email">
                <i className="fa-solid fa-envelope"></i> {displayEmail}
              </p>
            </div>
          </div>
          <div className="profile-hero-actions">
            <button
              type="button"
              className="profile-hero-btn-primary"
              onClick={onGoToSubscription}
              title="View Plans & Manage Subscription"
            >
              <i className="fa-solid fa-crown"></i>
              <span>{activePlanTier.toUpperCase() === 'FREE' ? 'Upgrade Plan' : 'Manage Plan'}</span>
            </button>
            <button
              type="button"
              className="profile-hero-btn-secondary"
              onClick={onGoToUsage}
              title="View Quotas and Usage Details"
            >
              <i className="fa-solid fa-clock"></i>
              <span>Usage &amp; Quotas</span>
            </button>
          </div>
        </section>

        {/* Dashboard Grid (2 Columns: Personal Info & My Wallet) */}
        <div className="profile-cards-grid">
          {/* 1. Personal Information */}
          <section className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-icon bg-purple">
                <i className="fa-solid fa-id-badge"></i>
              </div>
              <div>
                <h2 className="profile-card-title">Personal Information</h2>
                <p className="profile-card-subtitle">Your user identity and credential details</p>
              </div>
            </div>

            <div className="profile-info-list">
              {/* Username row */}
              <div className="profile-info-row">
                <span className="profile-info-label">Username</span>
                {isEditingUsername ? (
                  <div className="profile-username-edit-container">
                    <input
                      type="text"
                      className={`profile-username-input ${usernameError ? 'has-error' : ''}`}
                      value={usernameInput}
                      onChange={(e) => {
                        setUsernameInput(e.target.value);
                        if (usernameError) setUsernameError('');
                      }}
                      placeholder="Enter username"
                      autoFocus
                    />
                    {usernameError && (
                      <span className="profile-username-error-badge">
                        <i className="fa-solid fa-circle-exclamation"></i> {usernameError}
                      </span>
                    )}
                    <div className="profile-username-btn-row">
                      <button
                        type="button"
                        className="btn-username-save"
                        onClick={handleSaveUsername}
                        disabled={isSavingUsername}
                      >
                        {isSavingUsername ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="btn-username-cancel"
                        onClick={handleCancelEditUsername}
                        disabled={isSavingUsername}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="profile-username-view-container">
                    <span className="profile-info-value">{customUsername || displayName}</span>
                    <button
                      type="button"
                      className="btn-username-edit"
                      onClick={handleStartEditUsername}
                    >
                      <i className="fa-solid fa-pen-to-square"></i>
                      <span>Edit</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Email Address row */}
              <div className="profile-info-row">
                <span className="profile-info-label">Email Address</span>
                <span className="profile-info-value">{displayEmail}</span>
              </div>
            </div>
          </section>

          {/* 2. My Wallet */}
          <section className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-icon bg-orange">
                <i className="fa-solid fa-wallet"></i>
              </div>
              <div>
                <h2 className="profile-card-title">My Wallet</h2>
                <p className="profile-card-subtitle">Your credit balance and earnings</p>
              </div>
            </div>

            {isLoadingWallet ? (
              <div className="profile-loading-state">
                <i className="fa-solid fa-circle-notch fa-spin"></i> Loading wallet...
              </div>
            ) : (
              <>
                <div className="profile-wallet-stats-grid">
                  {/* Available Credits */}
                  <div className="profile-wallet-stat-tile">
                    <div className="profile-wallet-stat-top">
                      <span className="profile-wallet-number">{wallet.availableCredits}</span>
                      {wallet.availableCredits < 10 && (
                        <span className="profile-wallet-alert-dot" title="Warning: Low credits (!)">!</span>
                      )}
                    </div>
                    <div className="profile-wallet-label">AVAILABLE CREDITS</div>
                    <div className="profile-wallet-sub">Approved &amp; ready to use</div>
                    <div className="profile-wallet-bottom-icon peach-tint">
                      <i className="fa-solid fa-coins"></i>
                    </div>
                  </div>

                  {/* Pending Credits */}
                  <div className="profile-wallet-stat-tile">
                    <div className="profile-wallet-stat-top">
                      <span className="profile-wallet-number orange-num">{wallet.pendingCredits}</span>
                    </div>
                    <div className="profile-wallet-label">PENDING CREDITS</div>
                    <div className="profile-wallet-sub">Awaiting approval (e.g. referrals)</div>
                    <div className="profile-wallet-bottom-icon peach-tint">
                      <i className="fa-regular fa-clock"></i>
                    </div>
                  </div>

                  {/* Lifetime Earned */}
                  <div className="profile-wallet-stat-tile">
                    <div className="profile-wallet-stat-top">
                      <span className="profile-wallet-number purple-num">{wallet.lifetimeEarned}</span>
                    </div>
                    <div className="profile-wallet-label">LIFETIME EARNED</div>
                    <div className="profile-wallet-sub">Overall total from signups, plans &amp; referrals</div>
                    <div className="profile-wallet-bottom-icon purple-tint">
                      <i className="fa-solid fa-chart-simple"></i>
                    </div>
                  </div>
                </div>

                {/* Insufficient credits warning banner */}
                <div 
                  className="profile-insufficient-banner"
                  onClick={onGoToSubscription}
                  style={{ cursor: 'pointer' }}
                  title="Click to buy credits"
                >
                  <div className="profile-insufficient-icon">
                    <i className="fa-solid fa-circle-exclamation"></i>
                  </div>
                  <span className="profile-insufficient-text">
                    You don't have sufficient amount of credits ({wallet.availableCredits} remaining). <strong className="profile-buy-link">Buy Credits &rarr;</strong>
                  </span>
                </div>
              </>
            )}
          </section>
        </div>

        {/* 3. Usage & Sessions (Full Width) */}
        <section className="profile-card profile-card-full">
          <div className="profile-card-header">
            <div className="profile-card-icon bg-emerald">
              <i className="fa-solid fa-chart-column"></i>
            </div>
            <div>
              <h2 className="profile-card-title">Usage &amp; Sessions</h2>
              <p className="profile-card-subtitle">Real metrics from your interview sessions</p>
            </div>
          </div>

          {isLoadingSessions && sessions.length === 0 ? (
            <div className="profile-loading-state">
              <i className="fa-solid fa-circle-notch fa-spin"></i> Loading session statistics...
            </div>
          ) : sessionsError && sessions.length === 0 ? (
            <div className="profile-error-hint">
              <i className="fa-solid fa-circle-info"></i> {sessionsError}
            </div>
          ) : (
            <div className="profile-usage-tiles-row">
              {/* Saved Sessions */}
              <div
                className="profile-usage-tile clickable"
                onClick={() => handleSessionClick()}
                title={showAllSessions ? "Show fewer sessions" : "View all saved sessions"}
                role="button"
                tabIndex={0}
              >
                <div className="profile-usage-icon-box">
                  <i className="fa-solid fa-folder"></i>
                </div>
                <div className="profile-usage-info">
                  <span className="profile-usage-number">{totalSessions}</span>
                  <span className="profile-usage-label">SAVED SESSIONS</span>
                </div>
              </div>

              {/* Practice Time */}
              <div className="profile-usage-tile">
                <div className="profile-usage-icon-box">
                  <i className="fa-regular fa-clock"></i>
                </div>
                <div className="profile-usage-info">
                  <span className="profile-usage-number">{formatDuration(totalDurationSeconds)}</span>
                  <span className="profile-usage-label">PRACTICE TIME</span>
                </div>
              </div>

              {/* Questions Handled */}
              <div className="profile-usage-tile">
                <div className="profile-usage-icon-box">
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <div className="profile-usage-info">
                  <span className="profile-usage-number">{totalQuestions}</span>
                  <span className="profile-usage-label">QUESTIONS HANDLED</span>
                </div>
              </div>
            </div>
          )}

          {sessions.length > 0 && (
            <div className="profile-recent-sessions">
              <div className="recent-sessions-header">
                <div className="recent-sessions-header-left">
                  <span>{showAllSessions ? 'All Saved Sessions' : 'Recent Practice Sessions'}</span>
                  <span className="recent-sessions-count-pill">{sessions.length}</span>
                </div>
                {sessions.length > 3 && (
                  <button
                    type="button"
                    className="recent-sessions-view-all-btn"
                    onClick={() => setShowAllSessions(prev => !prev)}
                  >
                    {showAllSessions ? (
                      <>
                        Show Less <i className="fa-solid fa-chevron-up"></i>
                      </>
                    ) : (
                      <>
                        View All ({sessions.length}) <i className="fa-solid fa-chevron-down"></i>
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className={`recent-sessions-list ${showAllSessions ? 'expanded-sessions-list' : ''}`}>
                {(showAllSessions ? sessions : sessions.slice(0, 3)).map((sess) => {
                  const isNotes = isMeetingNotesSession(sess);
                  return (
                    <div
                      key={sess.id || `sess_${Math.random()}`}
                      className={`recent-session-item ${isNotes ? 'item-notetaker' : 'item-copilot'}`}
                      onClick={() => handleSessionClick(sess)}
                      title={isNotes ? "Open meeting notes in Notetaker" : "Open interview session in AI Copilot"}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="recent-session-left-meta">
                        <div className={`recent-session-type-icon ${isNotes ? 'icon-notetaker' : 'icon-copilot'}`}>
                          <i className={isNotes ? "fa-solid fa-microphone" : "fa-solid fa-robot"}></i>
                        </div>
                        <div className="recent-session-info">
                          <div className="recent-session-title-row">
                            <span className="recent-session-title">{sess.title || 'Live Session'}</span>
                            <span className={`recent-session-type-tag ${isNotes ? 'tag-notetaker' : 'tag-copilot'}`}>
                              {isNotes ? 'Meeting Notes' : 'AI Copilot'}
                            </span>
                          </div>
                          <span className="recent-session-tech">{sess.tech || (isNotes ? 'Meeting Notes' : 'Interview')}</span>
                        </div>
                      </div>
                      <div className="recent-session-right">
                        <span className="recent-session-time">{sess.durationDisplay || '00:00:00'}</span>
                        <span className="recent-session-destination-hint">
                          {isNotes ? 'Open Notetaker' : 'Open Copilot'}
                        </span>
                        <i className="fa-solid fa-chevron-right recent-session-arrow"></i>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* 4. Danger Zone */}
        <section className="profile-card profile-danger-zone-card">
          <div className="danger-zone-header">
            <div className="danger-icon-badge">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <h2 className="danger-zone-title">Danger Zone</h2>
              <p className="danger-zone-subtitle">Irreversible account operations and permanent data erasure</p>
            </div>
          </div>

          <div className="danger-action-row">
            <div className="danger-action-info">
              <strong className="danger-action-name">Delete Account</strong>
              <p className="danger-action-desc">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <button
              type="button"
              className="btn-danger-delete"
              onClick={handleOpenDeleteModal}
            >
              <i className="fa-solid fa-trash-can"></i>
              <span>Delete Account</span>
            </button>
          </div>
        </section>
      </main>

      {/* Floating Assistant Widget (Bottom Right) */}
      <div 
        className="profile-floating-assistant"
        title="Interview AI Assistant"
        onClick={onGoToVoiceAgent}
      >
        <i className="fa-solid fa-headset"></i>
        <span className="profile-floating-badge">2</span>
      </div>

      {/* Delete Account Confirmation Modal (With Username Verification) */}
      {deleteModalOpen && (
        <div className="profile-modal-backdrop" onClick={handleCloseDeleteModal}>
          <div className="profile-delete-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-icon-badge">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 className="delete-modal-title">Delete Account</h3>
            <p className="delete-modal-sub">
              Are you sure you want to delete your account? This action cannot be undone. All your saved interview sessions, notes, recordings, and credits will be permanently erased.
            </p>

            <div className="delete-modal-user-verify-box">
              <div className="delete-verify-label">
                <i className="fa-solid fa-user-shield"></i>
                <span>Username:</span>
              </div>
              <div className="delete-target-username-display">
                <code>{displayName}</code>
              </div>

              <p className="delete-type-prompt">
                Same username neeche type karein, tabhi delete button unlock hoga:
              </p>

              <div className="delete-input-wrapper">
                <input
                  type="text"
                  className={`delete-username-input ${isUsernameMatch ? 'input-matched' : deleteConfirmInput ? 'input-mismatch' : ''}`}
                  placeholder={`Type "${displayName}" here`}
                  value={deleteConfirmInput}
                  onChange={(e) => {
                    setDeleteConfirmInput(e.target.value);
                    if (deleteError) setDeleteError('');
                  }}
                  autoFocus
                  spellCheck={false}
                  disabled={isDeletingAccount}
                />
                {isUsernameMatch && (
                  <span className="delete-input-match-badge" title="Username matched">
                    <i className="fa-solid fa-circle-check"></i>
                  </span>
                )}
              </div>

              {deleteError && (
                <div className="delete-match-feedback mismatch">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{deleteError}</span>
                </div>
              )}

              {!deleteError && deleteConfirmInput.length > 0 && !isUsernameMatch && (
                <div className="delete-match-feedback mismatch">
                  <i className="fa-solid fa-circle-xmark"></i>
                  <span>Username exact match nahi hua. Same likhein (case-sensitive).</span>
                </div>
              )}

              {!deleteError && isUsernameMatch && (
                <div className="delete-match-feedback matched">
                  <i className="fa-solid fa-circle-check"></i>
                  <span>Username match ho gaya! Ab aap delete button par tap kar sakte hain.</span>
                </div>
              )}
            </div>

            <div className="delete-modal-actions">
              <button
                type="button"
                className="btn-delete-cancel"
                onClick={handleCloseDeleteModal}
                disabled={isDeletingAccount}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn-delete-confirm ${isUsernameMatch ? 'enabled-danger' : 'locked'}`}
                onClick={handleConfirmDeleteAccount}
                disabled={!isUsernameMatch || isDeletingAccount}
                title={!isUsernameMatch ? 'Pehle apna exact username upar type karein' : 'Permanently Delete Account'}
              >
                {isDeletingAccount ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Deleting Account...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-trash-can"></i>
                    <span>Delete Account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Deleted Frontend State */}
      {accountDeletedState && (
        <div className="profile-modal-backdrop">
          <div className="profile-delete-modal-card deleted-success-card">
            <div className="deleted-success-badge">
              <i className="fa-solid fa-circle-check"></i>
            </div>
            <h3 className="delete-modal-title">Account Deleted</h3>
            <p className="delete-modal-sub">
              Account deletion is currently unavailable. Please contact support.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
