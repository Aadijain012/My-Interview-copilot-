import React, { useEffect, useMemo, useState } from 'react';
import BrandLogo from '../common/BrandLogo';
import SidebarDrawer from '../SidebarDrawer';
import AccountDropdown from '../UserProfile/AccountDropdown';
import { API_BASE } from '../../utils/api';
import './ReferralPage.css';

const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;

function getInitials(name, email) {
  if (name && typeof name === 'string' && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && typeof email === 'string') {
    const localPart = email.trim().split('@')[0];
    return localPart.slice(0, 2).toUpperCase();
  }
  return 'AJ';
}

const MILESTONES = [
  {
    count: 1,
    title: 'First Friend',
    description: 'Invite your first friend',
    icon: 'fa-user-plus',
  },
  {
    count: 5,
    title: 'Growing Circle',
    description: 'Invite 5 friends',
    icon: 'fa-users',
  },
  {
    count: 10,
    title: 'Trading Squad',
    description: 'Invite 10 friends',
    icon: 'fa-people-group',
  },
  {
    count: 50,
    title: 'Top Circle',
    description: 'Invite 50 friends',
    icon: 'fa-trophy',
  },
];

export default function ReferralPage({
  token,
  user,
  onBackToDashboard,
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
  onLogout,
  darkMode,
  toggleDarkMode,
  showToast,
  isActive = false,
}) {
  const [referralData, setReferralData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const userName =
    user?.name ||
    user?.email?.split('@')[0] ||
    'Aadi Jain';

  const displayName = userName;
  const initials = useMemo(() => getInitials(user?.name, user?.email), [user]);

  const loadReferralData = async (isManual = false) => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [profileResponse, creditsResponse, rewardsResponse, milestonesResponse] =
        await Promise.all([
          fetch(`${API_BASE}/api/referrals/me`, {
            method: 'GET',
            headers,
          }),

          fetch(`${API_BASE}/api/referrals/credits`, {
            method: 'GET',
            headers,
          }),

          fetch(`${API_BASE}/api/referrals/rewards`, {
            method: 'GET',
            headers,
          }),

          fetch(`${API_BASE}/api/referrals/milestones`, {
            method: 'GET',
            headers,
          }),
        ]);

      if (!profileResponse.ok) {
        throw new Error(
          `Referral profile API returned ${profileResponse.status}`
        );
      }

      const profileData = await profileResponse.json();

      const creditsData = creditsResponse.ok
        ? await creditsResponse.json()
        : {
            credits: {
              availableCredits: 0,
              pendingCredits: 0,
              referralEarned: 0,
              referralPending: 0,
            },
            ledger: [],
          };

      const rewardsData = rewardsResponse.ok
        ? await rewardsResponse.json()
        : {
            qualifiedCount: 0,
            rewards: [],
          };

      const milestonesData = milestonesResponse.ok
        ? await milestonesResponse.json()
        : { milestones: [] };

      setReferralData({
        ...profileData,
        credits: creditsData.credits || {},
        ledger: creditsData.ledger || [],
        rewards: rewardsData.rewards || [],
        unlockedMilestones: milestonesData.milestones || [],
      });
    } catch (error) {
      console.error(
        '[ReferralPage] Unable to load referral data:',
        error
      );

      setReferralData(null);

      if (showToast && (isActive || isManual)) {
        showToast('Unable to load referral details');
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (isActive && token) {
      loadReferralData();
    }
  }, [isActive, token]);

  const profile = referralData?.profile || {};
  const codeInfo = referralData?.code || {};
  const creditInfo = referralData?.credits || {};

  const joinedCount = Number(profile.joinedCount || 0);
  const qualifiedCount = Number(profile.qualifiedCount || 0);

  const referralCode =
    profile.code ||
    codeInfo.code ||
    '';

  const referralUrl =
    codeInfo.shareUrl ||
    `https://myinterviewcopilot.com/?window=auth&ref=${encodeURIComponent(
      referralCode
    )}`;

  const referrerReward = Number(
    codeInfo.referrerCredits || 250
  );

  const refereeReward = Number(
    codeInfo.refereeCredits || 100
  );

  const availableCredits = Number(
    creditInfo.referralEarned || 0
  );

  const pendingCredits = Number(
    creditInfo.referralPending || 0
  );

  const codeStatus = codeInfo.status || 'pending';
  const unlockedMilestones = referralData?.unlockedMilestones || [];

  // Build a set of thresholds that are ACTUALLY unlocked
  const unlockedThresholds = useMemo(() => {
    const set = new Set();
    // Only add milestones that the backend says are unlocked
    unlockedMilestones.forEach((m) => {
      if (m.unlocked) set.add(m.threshold);
    });
    // Also use joinedCount for immediate UI feedback when friends sign up
    MILESTONES.forEach((m) => {
      if (joinedCount >= m.count) set.add(m.count);
    });
    return set;
  }, [unlockedMilestones, joinedCount]);

  // Progress bar uses joinedCount (total friends who signed up with your code)
  const maxFriends = 10;
  const currentProgress = Math.min(joinedCount, maxFriends);
  const progressPercent = Math.min(
    (currentProgress / maxFriends) * 100,
    100
  );

  const nextMilestone = useMemo(() => {
    return MILESTONES.find((item) => joinedCount < item.count);
  }, [joinedCount]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);

      if (showToast) {
        showToast('Referral link copied!');
      }

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy referral link:', error);

      if (showToast) {
        showToast('Unable to copy referral link');
      }
    }
  };

  const handleInvite = async () => {
    await handleCopy();

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join My Trading Circle',
          text: `Join me on My Interview Copilot using my referral link.`,
          url: referralUrl,
        });
      } catch (_) {
        // User closed the share dialog.
      }
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Join my Trading Circle using my referral link: ${referralUrl}`
    );

    window.open(
      `https://wa.me/?text=${text}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleTelegram = () => {
    const url = encodeURIComponent(referralUrl);
    const text = encodeURIComponent('Join my Trading Circle');

    window.open(
      `https://t.me/share/url?url=${url}&text=${text}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleX = () => {
    const text = encodeURIComponent(
      `Join my Trading Circle: ${referralUrl}`
    );

    window.open(
      `https://twitter.com/intent/tweet?text=${text}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleMinimize = () => { if (ipcRenderer) ipcRenderer.send('window-minimize'); };
  const handleMaximize = () => { if (ipcRenderer) ipcRenderer.send('window-maximize'); };
  const handleClose = () => { if (ipcRenderer) ipcRenderer.send('window-close'); };

  return (
    <div className={`interview-panel-root referral-page-root referral-page ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* Titlebar for Electron Drag */}
      <div className="window-titlebar">
        <div className="window-title">
          <i className="fa-solid fa-gift"></i> Refer &amp; Earn | My Interview Copilot
        </div>
        <div className="window-controls">
          <button className="win-btn win-btn-minimize" onClick={handleMinimize} title="Minimize">—</button>
          <button className="win-btn win-btn-maximize" onClick={handleMaximize} title="Maximize">▢</button>
          <button className="win-btn win-btn-close" onClick={handleClose} title="Close">×</button>
        </div>
      </div>

      {/* Slide-out Sidebar Drawer with Full AI Copilot Suite & Workspace Navigation */}
      <SidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        displayName={displayName}
        initials={initials}
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
        currentView="referral"
      />

      {/* Top Main Navbar - Clean, Minimal & Matches Profile */}
      <header className="referral-top-navbar">
        <div className="referral-nav-left">
          <button 
            className="referral-nav-hamburger" 
            onClick={() => setIsSidebarOpen(true)} 
            type="button" 
            title="Open Features & Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <i className="fa-solid fa-bars"></i>
          </button>
          <BrandLogo onClick={onBackToLanding} size="md" />
        </div>

        <nav className="referral-nav-center-tabs">
          <button onClick={onBackToLanding} className="referral-nav-tab" type="button">
            <i className="fa-solid fa-house"></i> Home
          </button>
          <button onClick={onGoToDashboard} className="referral-nav-tab" type="button">
            <i className="fa-solid fa-chart-line"></i> Dashboard
          </button>
          <button onClick={onGoToSubscription} className="referral-nav-tab" type="button">
            <i className="fa-solid fa-crown"></i> Plans &amp; Pricing
          </button>
        </nav>

        <div className="referral-nav-right">
          <button onClick={onGoToPanel} className="referral-nav-pill-btn btn-copilot" type="button" title="Launch AI Copilot">
            <i className="fa-solid fa-rocket"></i> AI Copilot
          </button>
          <button onClick={toggleDarkMode} className="referral-nav-icon-btn" type="button" title="Toggle Theme">
            <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <div className="referral-nav-lang-picker" title="Language: English (US)">
            <i className="fa-solid fa-globe"></i>
            <span>EN</span>
          </div>
          <AccountDropdown
            user={user}
            onGoToProfile={onGoToProfile}
            onGoToSubscription={onGoToSubscription}
            onGoToUsage={onGoToUsage}
            onLogout={onLogout}
            showToast={showToast}
          />
        </div>
      </header>

      {/* Subheader Breadcrumb & Disclaimer Bar */}
      <div className="referral-top-bar">
        <div className="referral-breadcrumb">
          <a href="#" onClick={(e) => { e.preventDefault(); onBackToLanding?.(); }} className="referral-crumb-home">
            <i className="fa-solid fa-house"></i> Home
          </a>
          <span className="referral-crumb-sep"><i className="fa-solid fa-chevron-right"></i></span>
          <span className="referral-crumb-active">
            <i className="fa-solid fa-gift"></i> Refer &amp; Earn
          </span>
        </div>
        <div className="referral-disclaimer-pill">
          <i className="fa-solid fa-coins"></i> Earn credits and unlock community rewards
        </div>
      </div>

      <main className="referral-content">
        
        {/* Hero Section - Exact Match to Reference Design */}
        <section className="referral-hero">
          <img
            src={darkMode ? "/assets/referral_hero_left_dark.png?v=hd3" : "/assets/referral_hero_left.png?v=hd3"}
            alt=""
            className="referral-hero-wave-left"
            aria-hidden="true"
          />

          <div className="referral-hero-content">
            <span className="referral-eyebrow">
              <i className="fa-solid fa-users"></i> Refer &amp; Earn
            </span>

            <h2>
              Build Your <span className="referral-hero-title-accent">Trading Circle</span>
            </h2>

            <p>
              Invite friends, grow your circle, and unlock exclusive
              rewards as your community grows.
            </p>

            <div className="referral-user-greeting">
              Welcome, <span className="referral-user-name-highlight">{displayName}</span>
            </div>
          </div>

          <div className="referral-hero-art">
            <img
              src={darkMode ? "/assets/referral_hero_art_dark.png?v=hd3" : "/assets/referral_hero_art.png?v=hd3"}
              alt="Build Your Circle Rewards"
              className="referral-hero-art-img"
            />
          </div>
        </section>

        {/* Trading Circle Progress Card */}
        <section className="referral-progress-card">
          <div className="section-heading-row">
            <div>
              <span className="section-label">TRADING CIRCLE</span>
              <h2>
                {joinedCount} <span className="fraction-label">/ {maxFriends} friends</span>
              </h2>
            </div>

            <div className="progress-percentage">
              {Math.round(progressPercent)}%
            </div>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          <div className="progress-footer">
            <span>
              <i className="fa-solid fa-user-group"></i> {joinedCount} joined • {qualifiedCount} qualified
            </span>

            {nextMilestone ? (
              <span>
                Next milestone: {nextMilestone.count} {nextMilestone.count === 1 ? 'friend' : 'friends'}
              </span>
            ) : (
              <span>All milestones reached!</span>
            )}
          </div>
        </section>

        {/* Milestones Section */}
        <section className="referral-section">
          <div className="section-title-block">
            <span className="section-label">MILESTONES</span>
            <h2>Unlock Community Rewards</h2>
            <p>
              Grow your qualified referrals to unlock premium features.
            </p>
          </div>

          <div className="milestone-grid">
            {MILESTONES.map((milestone) => {
              const unlocked = unlockedThresholds.has(milestone.count);

              return (
                <div
                  key={milestone.count}
                  className={`milestone-card ${
                    unlocked ? 'unlocked' : ''
                  }`}
                >
                  <div className="milestone-icon">
                    <i className={`fa-solid ${milestone.icon}`}></i>
                  </div>

                  <div className="milestone-count">
                    {milestone.count}
                  </div>

                  <h3>{milestone.title}</h3>

                  <p>{milestone.description}</p>

                  <div className="milestone-status">
                    {unlocked ? (
                      <>
                        <i className="fa-solid fa-circle-check"></i>
                        Unlocked
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-lock"></i>
                        Locked
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Community Rewards Banner */}
        <section className="community-reward-banner">
          <div className="community-reward-icon">
            <i className="fa-solid fa-crown"></i>
          </div>

          <div className="community-reward-text">
            <span className="banner-sublabel">COMMUNITY REWARDS</span>
            <h3>More friends. More unlocked features.</h3>
            <p>
              Your admission progress is based on qualified referrals, not just signups.
            </p>
          </div>
        </section>

        {/* Active Friends Info Card */}
        <section className="active-friends-card">
          <div className="info-icon">
            <i className="fa-solid fa-circle-info"></i>
          </div>

          <div className="active-friends-text">
            <h3>What counts as an active friend?</h3>
            <p>
              A referral becomes qualified after completing the required activity and
              remaining active through the qualification period.
            </p>

            <button
              type="button"
              className="learn-more-btn"
              onClick={() =>
                showToast?.(
                  'Qualified referrals unlock your milestone rewards.'
                )
              }
            >
              Learn More <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </section>

        {/* Referral Stats Cards */}
        <section className="referral-stats-section">
          <div className="referral-stat-card">
            <div className="referral-stat-icon">
              <i className="fa-solid fa-share-nodes"></i>
            </div>
            <div className="referral-stat-info">
              <span>Total Referrals</span>
              <strong>{joinedCount + qualifiedCount}</strong>
            </div>
          </div>

          <div className="referral-stat-card">
            <div className="referral-stat-icon">
              <i className="fa-solid fa-user-check"></i>
            </div>
            <div className="referral-stat-info">
              <span>Friends Joined</span>
              <strong>{joinedCount}</strong>
            </div>
          </div>

          <div className="referral-stat-card">
            <div className="referral-stat-icon">
              <i className="fa-solid fa-gift"></i>
            </div>
            <div className="referral-stat-info">
              <span>Referral Earned</span>
              <strong>{availableCredits}</strong>
            </div>
          </div>

          <div className="referral-stat-card">
            <div className="referral-stat-icon">
              <i className="fa-solid fa-clock"></i>
            </div>
            <div className="referral-stat-info">
              <span>Referral Pending</span>
              <strong>{pendingCredits}</strong>
            </div>
          </div>
        </section> 

        {/* Referral Code Section */}
        <section className="referral-code-section">
          <div className="section-title-block">
            <span className="section-label">YOUR REFERRAL CODE</span>
            <h2>{loading ? 'Loading...' : referralCode || 'Loading...'}</h2>
            <p>Share this code with your friends when they sign up.</p>
          </div>

          <div className="referral-code-card">
            <div className="referral-code-value">
              <div className="gift-icon-box">
                <i className="fa-solid fa-gift"></i>
              </div>
              <strong>
                {loading ? 'Loading...' : referralCode || 'Unavailable'}
              </strong>
            </div>

            <button
              type="button"
              className="copy-button"
              disabled={!referralCode || loading}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(referralCode);
                  if (showToast) {
                    showToast('Referral code copied!');
                  }
                } catch (error) {
                  console.error('Failed to copy referral code:', error);
                  if (showToast) {
                    showToast('Unable to copy referral code');
                  }
                }
              }}
            >
              <i className="fa-regular fa-copy"></i>
              Copy Code
            </button>
          </div>
        </section>

        {/* Referral Rewards Section */}
        <section className="referral-earning-section">
          <div className="section-title-block">
            <span className="section-label">REFERRAL REWARDS</span>
            <h2>Earn More With Every Qualified Referral</h2>
            <p>
              Your friend receives credits when they join,
              and you earn credits when the referral qualifies.
            </p>
          </div>

          <div className="earning-grid">
            <div className="earning-card friend-card">
              <div className="earning-icon-circle green">
                <i className="fa-solid fa-user-plus"></i>
              </div>
              <div className="earning-info">
                <span className="earning-title">Your Friend Gets</span>
                <strong className="earning-amount">{refereeReward}</strong>
                <small className="earning-sub">credits</small>
              </div>
            </div>

            <div className="earning-card you-earn-card">
              <div className="earning-icon-circle amber">
                <i className="fa-solid fa-trophy"></i>
              </div>
              <div className="earning-info">
                <span className="earning-title">You Earn</span>
                <strong className="earning-amount">{referrerReward}</strong>
                <small className="earning-sub">
                  credits per qualified referral
                </small>
              </div>
            </div>
          </div>
        </section>

        {/* Referral Link & Invite Section */}
        <section className="referral-link-section">
          <div className="section-title-block">
            <span className="section-label">YOUR REFERRAL LINK</span>
            <h2>Invite Your Friends</h2>
            <p>
              Share your personal referral link and start building
              your circle.
            </p>
          </div>

          <div className="referral-link-card">
            <div className="referral-link-input">
              <i className="fa-solid fa-link"></i>
              <span>
                {loading
                  ? 'Loading...'
                  : referralUrl || 'https://myinterviewcopilot.com/?ref=yourcodehere'}
              </span>
            </div>

            <button
              type="button"
              className="copy-button"
              onClick={handleCopy}
              disabled={loading}
            >
              <i
                className={`fa-solid ${
                  copied ? 'fa-check' : 'fa-copy'
                }`}
              ></i>
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button
              type="button"
              className="invite-button"
              onClick={handleInvite}
              disabled={loading || !referralUrl}
            >
              <i className="fa-solid fa-paper-plane"></i>
              Invite Now
            </button>
          </div>

          <div className="social-share-row">
            <button
              type="button"
              className="share-button whatsapp"
              onClick={handleWhatsApp}
            >
              <i className="fa-brands fa-whatsapp"></i>
              WhatsApp
            </button>

            <button
              type="button"
              className="share-button telegram"
              onClick={handleTelegram}
            >
              <i className="fa-brands fa-telegram"></i>
              Telegram
            </button>

            <button
              type="button"
              className="share-button x-share"
              onClick={handleX}
            >
              <i className="fa-brands fa-x-twitter"></i>
              X
            </button>

            <button
              type="button"
              className="share-button more"
              onClick={handleInvite}
            >
              <i className="fa-solid fa-ellipsis"></i>
              More
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}