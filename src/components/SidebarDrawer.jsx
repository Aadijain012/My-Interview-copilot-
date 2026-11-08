import React from 'react';
import {
  X,
  Rocket,
  Mic,
  Bot,
  UploadCloud,
  Home,
  TrendingUp,
  Video,
  Calendar,
  Clock,
  Bell,
  User,
  CreditCard,
  Moon,
  Sun,
  Globe,
  LogOut,
  Sparkles,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  Gift,
  Crown
} from 'lucide-react';
import BrandLogo from './common/BrandLogo';
import './SidebarDrawer.css';

export default function SidebarDrawer({
  isOpen,
  onClose,
  user,
  displayName,
  initials,
  activePlanTier = 'FREE',
  planNameDisplay = 'Free Plan',
  planPriceMonthly = '0',
  darkMode,
  toggleDarkMode,
  onBackToLanding,
  onGoToDashboard,
  onGoToSubscription,
  onGoToPanel,
  onGoToNotetaker,
  onGoToVoiceAgent,
  onGoToUpload,
  onGoToReferral,
  onGoToProfile,
  onLogout,
  showToast,
  currentView = 'profile'
}) {
  if (!isOpen) return null;

  const navigateTo = (action) => {
    onClose();
    if (typeof action === 'function') {
      action();
    }
  };

  const planLabel = activePlanTier?.toUpperCase() === 'FREE'
    ? 'Free Plan ($0/mo)'
    : `${planNameDisplay} ($${planPriceMonthly}/mo)`;

  return (
    <div className="sidebar-drawer-overlay" onClick={onClose}>
      <aside
        className="sidebar-drawer-panel animate-drawer-slide"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="drawer-header-row">
          <BrandLogo subtitle="Features & Workspace Hub" size="md" />

          <button
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close sidebar menu"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Card Profile Snippet */}
        <div
          className="drawer-user-card"
          onClick={() => navigateTo(onGoToProfile)}
          title="Click to view Profile"
        >
          <div className="drawer-user-avatar">
            {initials || (displayName ? displayName.charAt(0).toUpperCase() : 'U')}
          </div>
          <div className="drawer-user-info">
            <div className="drawer-user-name">{displayName || user?.name || 'Aadi Jain'}</div>
            <div className="drawer-user-email">{user?.email || 'aadijain2806@gmail.com'}</div>
          </div>
          <span className="drawer-tier-badge">
            <Crown size={11} style={{ marginRight: '3px', verticalAlign: '-1px' }} />
            {planLabel}
          </span>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="drawer-body-scroll">
          {/* Section 1: AI Copilot Suite */}
          <div className="drawer-section">
            <div className="drawer-section-title">⚡ AI COPILOT SUITE</div>
            <div className="drawer-menu-grid">
              <button
                type="button"
                className="drawer-feature-btn"
                onClick={() => navigateTo(onGoToPanel)}
              >
                <div className="drawer-feature-icon-box icon-box-blue">
                  <Rocket size={18} />
                </div>
                <div className="drawer-feature-btn-text">
                  <div className="drawer-feature-title">AI Copilot &amp; Overlay</div>
                  <div className="drawer-feature-desc">Live stealth suggestions &amp; STAR answers</div>
                </div>
                <ChevronRight size={15} className="drawer-feature-arrow" />
              </button>

              <button
                type="button"
                className="drawer-feature-btn"
                onClick={() => navigateTo(onGoToNotetaker)}
              >
                <div className="drawer-feature-icon-box icon-box-purple">
                  <Mic size={18} />
                </div>
                <div className="drawer-feature-btn-text">
                  <div className="drawer-feature-title">Smart Notetaker</div>
                  <div className="drawer-feature-desc">Live audio capture, transcripts &amp; notes</div>
                </div>
                <ChevronRight size={15} className="drawer-feature-arrow" />
              </button>

              <button
                type="button"
                className="drawer-feature-btn"
                onClick={() => navigateTo(onGoToVoiceAgent)}
              >
                <div className="drawer-feature-icon-box icon-box-cyan">
                  <Bot size={18} />
                </div>
                <div className="drawer-feature-btn-text">
                  <div className="drawer-feature-title">Voice Mock Agent</div>
                  <div className="drawer-feature-desc">Interactive 2-way AI mock interview</div>
                </div>
                <ChevronRight size={15} className="drawer-feature-arrow" />
              </button>

              <button
                type="button"
                className="drawer-feature-btn"
                onClick={() => navigateTo(onGoToUpload)}
              >
                <div className="drawer-feature-icon-box icon-box-orange">
                  <UploadCloud size={18} />
                </div>
                <div className="drawer-feature-btn-text">
                  <div className="drawer-feature-title">Media Upload &amp; Transcribe</div>
                  <div className="drawer-feature-desc">Audio/video AI analysis in 22 languages</div>
                </div>
                <ChevronRight size={15} className="drawer-feature-arrow" />
              </button>

              <button
                type="button"
                className="drawer-feature-btn"
                onClick={() => navigateTo(onGoToReferral)}
              >
                <div className="drawer-feature-icon-box icon-box-green">
                  <Gift size={18} />
                </div>
                <div className="drawer-feature-btn-text">
                  <div className="drawer-feature-title">Refer &amp; Earn Rewards</div>
                  <div className="drawer-feature-desc">Invite colleagues &amp; earn free bonus credits</div>
                </div>
                <ChevronRight size={15} className="drawer-feature-arrow" />
              </button>
            </div>
          </div>

          {/* Section 2: Workspace Navigation */}
          <div className="drawer-section">
            <div className="drawer-section-title">📂 WORKSPACE NAVIGATION</div>
            <div className="drawer-nav-list">
              <button
                type="button"
                className={`drawer-nav-item ${currentView === 'home' ? 'active' : ''}`}
                onClick={() => navigateTo(onBackToLanding)}
              >
                <span className="drawer-nav-item-icon"><Home size={16} /></span>
                <span>Home Page</span>
              </button>

              <button
                type="button"
                className={`drawer-nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
                onClick={() => navigateTo(onGoToDashboard)}
              >
                <span className="drawer-nav-item-icon"><TrendingUp size={16} /></span>
                <span>Dashboard Analytics</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => navigateTo(() => showToast?.('Mock Interview feature is coming soon!'))}
              >
                <span className="drawer-nav-item-icon"><Video size={16} /></span>
                <span>Mock Interview Studio</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => navigateTo(() => showToast?.('Meetings scheduler is coming soon!'))}
              >
                <span className="drawer-nav-item-icon"><Calendar size={16} /></span>
                <span>Meetings &amp; Scheduler</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => navigateTo(() => showToast?.('History log is coming soon!'))}
              >
                <span className="drawer-nav-item-icon"><Clock size={16} /></span>
                <span>History &amp; Saved Sessions</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => navigateTo(() => showToast?.('Reminders scheduling feature is coming soon!'))}
              >
                <span className="drawer-nav-item-icon"><Bell size={16} /></span>
                <span>Schedule Reminders</span>
              </button>

              <button
                type="button"
                className={`drawer-nav-item ${currentView === 'subscription' ? 'active' : ''}`}
                onClick={() => navigateTo(onGoToSubscription)}
              >
                <span className="drawer-nav-item-icon"><Crown size={16} /></span>
                <span>Plans &amp; Pricing</span>
              </button>
            </div>
          </div>

          {/* Section 3: Preferences & Account */}
          <div className="drawer-section">
            <div className="drawer-section-title">⚙️ PREFERENCES &amp; SETTINGS</div>
            <div className="drawer-nav-list">
              <button
                type="button"
                className={`drawer-nav-item ${currentView === 'profile' ? 'active' : ''}`}
                onClick={() => navigateTo(onGoToProfile)}
              >
                <span className="drawer-nav-item-icon"><User size={16} /></span>
                <span>Profile &amp; Settings</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => {
                  toggleDarkMode?.();
                }}
              >
                <span className="drawer-nav-item-icon">
                  {darkMode ? <Sun size={16} style={{ color: '#fbbf24' }} /> : <Moon size={16} style={{ color: '#6366f1' }} />}
                </span>
                <span>Theme: <strong>{darkMode ? 'Dark Mode' : 'Light Mode'}</strong></span>
              </button>

              <div className="drawer-nav-item" style={{ cursor: 'default' }}>
                <span className="drawer-nav-item-icon"><Globe size={16} /></span>
                <span>Language: <strong>English (US EN)</strong></span>
              </div>

              {onLogout && (
                <button
                  type="button"
                  className="drawer-nav-item text-danger"
                  onClick={() => navigateTo(onLogout)}
                >
                  <span className="drawer-nav-item-icon"><LogOut size={16} /></span>
                  <span>Log Out</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="drawer-footer-note">
          <ShieldCheck size={14} style={{ color: '#10b981' }} />
          <span>Privacy-first AI • 256-Bit SSL Encrypted</span>
        </div>
      </aside>
    </div>
  );
}

