import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../utils/api';
import { getStoredCredits } from '../subscription/transactionHistoryStore';
import './AccountDropdown.css';

const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;

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

export default function AccountDropdown({
  user,
  onGoToProfile,
  onGoToSubscription,
  onGoToUsage,
  onLogout,
  showToast,
  isActive
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [credits, setCredits] = useState(() => getStoredCredits());
  const dropdownRef = useRef(null);

  useEffect(() => {
    setCredits(getStoredCredits());
    const handleCreditsUpdate = (e) => {
      if (typeof e.detail === 'number') {
        setCredits(e.detail);
      } else if (e.detail?.newBalance !== undefined) {
        setCredits(Number(e.detail.newBalance));
      } else {
        setCredits(getStoredCredits());
      }
    };
    window.addEventListener('copilot-credits-updated', handleCreditsUpdate);
    return () => window.removeEventListener('copilot-credits-updated', handleCreditsUpdate);
  }, []);

  const initials = getInitials(user?.name, user?.email);
  const displayName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleProfileClick = () => {
    setIsOpen(false);
    if (onGoToProfile) onGoToProfile();
  };

  const handleTutorialsClick = () => {
    setIsOpen(false);
    if (showToast) showToast('Tutorials are coming soon!');
  };

  const handleDesktopAppClick = () => {
    setIsOpen(false);
    if (ipcRenderer) {
      ipcRenderer.send('window-focus');
      if (showToast) showToast('Desktop App is currently active.');
    } else {
      const apiBase = (API_BASE || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
      if (showToast) showToast('Downloading My Interview Copilot desktop app...');
      window.location.href = `${apiBase}/api/download/desktop`;
    }
  };

  const handlePlanClick = () => {
    setIsOpen(false);
    if (onGoToSubscription) {
      onGoToSubscription();
    } else if (onGoToProfile) {
      onGoToProfile();
    }
  };

  const handleUsageClick = () => {
    setIsOpen(false);
    if (onGoToUsage) {
      onGoToUsage();
    } else if (showToast) {
      showToast('Opening Usage & Restrictions...');
    }
  };

  const handleLogoutClick = () => {
    setIsOpen(false);
    if (onLogout) onLogout();
  };

  const ringClass = credits < 10
    ? 'credit-ring-red'
    : credits <= 50
      ? 'credit-ring-yellow'
      : 'credit-ring-green';

  return (
    <div className="account-dropdown-container" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`setup-profile-circle-btn ${ringClass} ${isActive || isOpen ? 'active' : ''}`}
        type="button"
        title={credits < 10 ? `Warning: Low credits (${credits}). Click to buy credits.` : credits <= 50 ? `${displayName} (${credits} credits remaining)` : `${displayName} (${credits} credits)`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="setup-profile-initials">{initials}</span>
        {credits < 10 && (
          <span
            className="profile-credit-badge-exclamation"
            title="Warning: Low credits (!)"
          >
            !
          </span>
        )}
      </button>

      {isOpen && (
        <div className="account-dropdown-menu" role="menu">
          {credits < 10 && (
            <div
              className="account-menu-low-credits-banner"
              onClick={handlePlanClick}
              style={{
                margin: '4px 8px 8px 8px',
                padding: '8px 10px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '12px', fontWeight: '700' }}>
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>Low Credits ({credits})</span>
              </div>
              <p style={{ margin: '4px 0 6px 0', fontSize: '11.5px', color: '#64748b', lineHeight: '1.3' }}>
                You don't have sufficient amount of credits.
              </p>
              <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#6366f1', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Buy Credits &rarr;
              </span>
            </div>
          )}
          <button
            onClick={handleProfileClick}
            className="account-menu-item"
            role="menuitem"
            type="button"
          >
            <i className="fa-regular fa-user account-menu-icon"></i>
            <span>Profile</span>
          </button>

          <div className="account-menu-divider"></div>

          <button
            onClick={handleTutorialsClick}
            className="account-menu-item"
            role="menuitem"
            type="button"
          >
            <i className="fa-solid fa-video account-menu-icon"></i>
            <span>Tutorials</span>
          </button>

          <div className="account-menu-divider"></div>

          <button
            onClick={handleDesktopAppClick}
            className="account-menu-item"
            role="menuitem"
            type="button"
          >
            <i className="fa-solid fa-desktop account-menu-icon"></i>
            <span>{ipcRenderer ? 'Open Desktop App' : 'Download Desktop App'}</span>
          </button>

          <button
            onClick={handlePlanClick}
            className="account-menu-item"
            role="menuitem"
            type="button"
          >
            <i className="fa-regular fa-credit-card account-menu-icon"></i>
            <span>Plan &amp; Subscription</span>
          </button>

          <button
            onClick={handleUsageClick}
            className="account-menu-item"
            role="menuitem"
            type="button"
          >
            <i className="fa-solid fa-chart-pie account-menu-icon"></i>
            <span>Usage &amp; Restrictions</span>
          </button>

          <div className="account-menu-divider"></div>

          <button
            onClick={handleLogoutClick}
            className="account-menu-item account-menu-logout"
            role="menuitem"
            type="button"
          >
            <i className="fa-solid fa-arrow-right-from-bracket account-menu-icon"></i>
            <span>Log Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
