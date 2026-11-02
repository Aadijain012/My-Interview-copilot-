import React from 'react';
import './Dashboard.css';
import { getUserCredits } from '../config/creditUsageConfig';
import { CURRENCIES } from './subscription/currencyData';

const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;

export default function Dashboard({
  token,
  user,
  onLogout,
  onBackToLanding,
  onGoToPanel,
  onGoToNotetaker,
  onGoToVoiceAgent,
  onGoToUpload,
  onGoToReferral,
  onGoToProfile,
  onGoToSubscription,
  onGoToUsage,
  showToast,
  darkMode,
  toggleDarkMode,
  windowType
}) {
  const handleMinimize = () => ipcRenderer?.send('window-minimize');
  const handleMaximize = () => ipcRenderer?.send('window-maximize');
  const handleClose = () => ipcRenderer?.send('window-close');

  const credits = user?.credits !== undefined ? user.credits : getUserCredits();

  // Country Picker State
  const [selectedCountry, setSelectedCountry] = React.useState(() => {
    return localStorage.getItem('user_country') || 'India';
  });
  const [showCountryPicker, setShowCountryPicker] = React.useState(false);
  const [countrySearch, setCountrySearch] = React.useState('');
  const countryDropdownRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target)) {
        setShowCountryPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentCountryObj = React.useMemo(() => {
    return CURRENCIES.find(c => c.country.toLowerCase() === selectedCountry.toLowerCase()) || {
      flag: '🇮🇳',
      country: 'India',
      code: 'INR'
    };
  }, [selectedCountry]);

  const filteredCountries = React.useMemo(() => {
    if (!countrySearch.trim()) return CURRENCIES;
    const q = countrySearch.toLowerCase().trim();
    return CURRENCIES.filter(c => 
      c.country.toLowerCase().includes(q) || 
      c.code.toLowerCase().includes(q) || 
      c.name.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const handleSelectCountry = (c) => {
    setSelectedCountry(c.country);
    localStorage.setItem('user_country', c.country);
    localStorage.setItem('preferred_currency', c.code);
    setShowCountryPicker(false);
    setCountrySearch('');
    if (showToast) {
      showToast(`Language region set to ${c.country} (${c.code})`);
    }
  };

  // Modern Dynamic Scroll State for Transparent to Frosted Glass Navbar Transition
  const [isScrolled, setIsScrolled] = React.useState(false);
  const mainAreaRef = React.useRef(null);

  React.useEffect(() => {
    const handleScrollEvent = () => {
      const scrollPos = mainAreaRef.current?.scrollTop || window.scrollY || 0;
      setIsScrolled(scrollPos > 15);
    };

    const target = mainAreaRef.current;
    if (target) {
      target.addEventListener('scroll', handleScrollEvent, { passive: true });
    }
    window.addEventListener('scroll', handleScrollEvent, { passive: true });

    return () => {
      if (target) target.removeEventListener('scroll', handleScrollEvent);
      window.removeEventListener('scroll', handleScrollEvent);
    };
  }, []);

  return (
    <div className={`dashboard-root ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* Top Navbar - Modern Glassmorphism & Dynamic Scroll */}
      <header className={`dashboard-top-navbar ${isScrolled ? 'scrolled' : 'transparent-header'}`}>
        <div className="dashboard-nav-left" onClick={onBackToLanding} style={{ cursor: 'pointer' }}>
          <div className="dashboard-logo-avatar">
            <i className="fa-solid fa-brain"></i>
          </div>
          <span className="dashboard-brand-name">MyInterview Copilot</span>
        </div>

        <div className="dashboard-nav-right">
          {/* Country Selector with Full Interactive Country List Dropdown */}
          <div className="dashboard-country-wrapper" ref={countryDropdownRef} style={{ position: 'relative' }}>
            <div
              className={`dashboard-country-pill ${showCountryPicker ? 'active' : ''}`}
              onClick={() => setShowCountryPicker(prev => !prev)}
              role="button"
              tabIndex={0}
              title="Select your country / region"
            >
              <span className="flag-icon">{currentCountryObj.flag}</span>
              <span>{currentCountryObj.country}</span>
              <i className={`fa-solid fa-chevron-down pill-chevron ${showCountryPicker ? 'rotated' : ''}`}></i>
            </div>

            {showCountryPicker && (
              <div className="dashboard-country-popup">
                <div className="country-search-header">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <input
                    type="text"
                    className="country-search-input"
                    placeholder="Search country..."
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    autoFocus
                  />
                  {countrySearch && (
                    <button
                      type="button"
                      className="country-search-clear"
                      onClick={() => setCountrySearch('')}
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="country-popup-list">
                  {filteredCountries.length === 0 ? (
                    <div className="country-empty-msg">No countries found</div>
                  ) : (
                    filteredCountries.map((c) => (
                      <div
                        key={c.code}
                        className={`country-popup-item ${c.country.toLowerCase() === selectedCountry.toLowerCase() ? 'active' : ''}`}
                        onClick={() => handleSelectCountry(c)}
                      >
                        <span className="country-item-flag">{c.flag}</span>
                        <span className="country-item-name">{c.country}</span>
                        <span className="country-item-code">{c.code}</span>
                        {c.country.toLowerCase() === selectedCountry.toLowerCase() && (
                          <i className="fa-solid fa-check country-check-icon"></i>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Plans & Pricing Link */}
          <button
            type="button"
            className="dashboard-nav-link"
            onClick={onGoToSubscription}
          >
            Plans &amp; pricing
          </button>

          {/* Credits Pill */}
          <div
            className="dashboard-credits-pill"
            onClick={onGoToSubscription}
            title="View credits &amp; plans"
          >
            <i className="fa-solid fa-wallet"></i>
            <span>{credits} credits</span>
            <i className="fa-solid fa-chevron-down pill-chevron"></i>
          </div>

          {/* Notifications */}
          <button
            type="button"
            className="dashboard-icon-btn"
            onClick={() => showToast?.('No new notifications')}
            title="Notifications"
          >
            <i className="fa-regular fa-bell"></i>
          </button>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            className="dashboard-icon-btn"
            onClick={toggleDarkMode}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>

          {/* Settings / Profile */}
          <button
            type="button"
            className="dashboard-icon-btn"
            onClick={onGoToProfile}
            title="Account Settings"
          >
            <i className="fa-solid fa-gear"></i>
          </button>

          {/* Window controls for desktop */}
          <div className="dashboard-win-controls">
            <button className="dash-win-btn" onClick={handleMinimize} title="Minimize">—</button>
            <button className="dash-win-btn" onClick={handleMaximize} title="Maximize">▢</button>
            <button className="dash-win-btn dash-win-close" onClick={handleClose} title="Close">×</button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="dashboard-main-area" ref={mainAreaRef}>
        <div className="dashboard-banners-container">
          {/* 1. AI Copilot (Mint/Emerald Theme) */}
          <div
            className="dash-banner-card theme-copilot"
            onClick={onGoToPanel}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoToPanel(); } }}
            aria-label="Open AI Copilot"
          >
            <div className="dash-card-left">
              <div className="dash-card-pill">
                <i className="fa-solid fa-sparkles"></i>
                <span>AI Copilot</span>
              </div>
              <h2 className="dash-card-title">
                Ace Your Interviews<br />
                with <span className="highlight-color">AI-Powered</span> Guidance
              </h2>
              <p className="dash-card-subtitle">
                Get real-time answers, practice with smart questions,<br />
                and boost your confidence.
              </p>
              <div className="dash-card-btn-row">
                <button
                  type="button"
                  className="dash-btn-primary"
                  onClick={(e) => { e.stopPropagation(); onGoToPanel(); }}
                >
                  <span>Start AI Copilot</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>
            <div className="dash-card-right">
              <img
                src={darkMode ? "/assets/dash_scene_copilot_dark.png" : "/assets/dash_scene_copilot.png"}
                alt="AI Copilot Interface & Mascot"
                className="dash-card-visual-img"
              />
            </div>
          </div>

          {/* 2. AI Voice Agent (Lavender/Purple Theme) */}
          <div
            className="dash-banner-card theme-voice"
            onClick={onGoToVoiceAgent}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoToVoiceAgent(); } }}
            aria-label="Open AI Voice Agent"
          >
            <div className="dash-card-left">
              <div className="dash-card-pill">
                <i className="fa-solid fa-microphone"></i>
                <span>AI Voice Agent</span>
              </div>
              <h2 className="dash-card-title">
                Speak. Practice. <span className="highlight-color">Perfect.</span>
              </h2>
              <p className="dash-card-subtitle">
                Start a voice interview, get AI feedback, and improve<br />
                your communication skills.
              </p>
              <div className="dash-card-btn-row">
                <button
                  type="button"
                  className="dash-btn-primary"
                  onClick={(e) => { e.stopPropagation(); onGoToVoiceAgent(); }}
                >
                  <span>Try Voice Agent</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>
            <div className="dash-card-right">
              <img
                src={darkMode ? "/assets/dash_scene_voice_dark.png" : "/assets/dash_scene_voice.png"}
                alt="AI Voice Agent Studio Microphone"
                className="dash-card-visual-img"
              />
            </div>
          </div>

          {/* 3. Smart Note Taker (Peach/Amber Theme) */}
          <div
            className="dash-banner-card theme-notetaker"
            onClick={onGoToNotetaker}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoToNotetaker(); } }}
            aria-label="Open Smart Note Taker"
          >
            <div className="dash-card-left">
              <div className="dash-card-pill">
                <i className="fa-solid fa-file-lines"></i>
                <span>Smart Note Taker</span>
              </div>
              <h2 className="dash-card-title">
                Take Smart Notes,<br />
                Focus on <span className="highlight-color">What Matters</span>
              </h2>
              <p className="dash-card-subtitle">
                Automatically capture key points, get summaries,<br />
                and never miss important details.
              </p>
              <div className="dash-card-btn-row">
                <button
                  type="button"
                  className="dash-btn-primary"
                  onClick={(e) => { e.stopPropagation(); onGoToNotetaker(); }}
                >
                  <span>Start Taking Notes</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>
            <div className="dash-card-right">
              <img
                src={darkMode ? "/assets/dash_scene_notetaker_dark.png" : "/assets/dash_scene_notetaker.png"}
                alt="Smart Note Taker Notebook & Pen"
                className="dash-card-visual-img"
              />
            </div>
          </div>

          {/* 4. Uploads (Rose/Coral Pink Theme) */}
          <div
            className="dash-banner-card theme-uploads"
            onClick={onGoToUpload}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoToUpload(); } }}
            aria-label="Open Uploads"
          >
            <div className="dash-card-left">
              <div className="dash-card-pill">
                <i className="fa-solid fa-cloud-arrow-up"></i>
                <span>Uploads</span>
              </div>
              <h2 className="dash-card-title">
                Upload. Analyze. <span className="highlight-color">Get Insights.</span>
              </h2>
              <p className="dash-card-subtitle">
                Upload your files and get smart analysis, summaries,<br />
                and actionable insights.
              </p>
              <div className="dash-card-btn-row">
                <button
                  type="button"
                  className="dash-btn-primary"
                  onClick={(e) => { e.stopPropagation(); onGoToUpload(); }}
                >
                  <span>Upload Files</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>
            <div className="dash-card-right">
              <img
                src={darkMode ? "/assets/dash_scene_upload_dark.png" : "/assets/dash_scene_upload.png"}
                alt="Uploads Cloud & Documents"
                className="dash-card-visual-img"
              />
            </div>
          </div>

          {/* 5. Referral & Earn (Teal/Seafoam Theme) */}
          <div
            className="dash-banner-card theme-referral"
            onClick={onGoToReferral}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoToReferral(); } }}
            aria-label="Open Referral & Earn"
          >
            <div className="dash-card-left">
              <div className="dash-card-pill">
                <i className="fa-solid fa-gift"></i>
                <span>Referral &amp; Earn</span>
              </div>
              <h2 className="dash-card-title">
                Invite Friends, <span className="highlight-color">Earn Rewards</span>
              </h2>
              <p className="dash-card-subtitle">
                Share your referral link and get 250 credits for you<br />
                and your friend.
              </p>
              <div className="dash-card-btn-row">
                <button
                  type="button"
                  className="dash-btn-primary"
                  onClick={(e) => { e.stopPropagation(); onGoToReferral(); }}
                >
                  <span>Get Referral Link</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>
            <div className="dash-card-right">
              <img
                src={darkMode ? "/assets/dash_scene_referral_dark.png" : "/assets/dash_scene_referral.png"}
                alt="Referral Rewards 250 Credits"
                className="dash-card-visual-img"
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="dashboard-footer">
        <div className="dashboard-footer-links">
          <a href="#" onClick={(e) => { e.preventDefault(); }}>Terms of Service</a>
          <span className="dot-sep">·</span>
          <a href="#" onClick={(e) => { e.preventDefault(); }}>Privacy Policy</a>
        </div>

        {/* Floating Help Button */}
        <button
          className="dashboard-floating-help-btn"
          onClick={() => showToast?.('Need assistance? Email support@myinterviewcopilot.com')}
          title="Help &amp; Support"
          type="button"
        >
          ?
        </button>
      </footer>
    </div>
  );
}
