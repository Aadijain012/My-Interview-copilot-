import { reportClientError } from "../admin/utils/errorReporter";
import React, { useState, useEffect, useRef } from 'react';
import {
  clearFirebaseSession,
  getGoogleSignInErrorMessage,
  signInWithGoogle
} from '../auth/firebase';
import AccountDropdown from './UserProfile/AccountDropdown';
import OfferBanner from './subscription/OfferBanner';
import { API_BASE } from '../utils/api';
import { validateEmailAddress, checkPasswordStrength } from '../utils/validators';
import { getDeviceId } from '../utils/device';
import HomeSlides from './HomeSlides';
import BrandLogo from './common/BrandLogo';

// Electron IPC connection if running under Electron
const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;

// Backend API Base URL
export default function LandingPage({ token, user, onLogout,onGoToReferral,onGoToPanel, onGoToNotetaker, onGoToVoiceAgent, onGoToUpload, onGoToDashboard, onGoToProfile, onGoToSubscription, onGoToUsage, onLoginSuccess, showToast, darkMode, toggleDarkMode }) {
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('login'); // 'login' or 'register'
  const [authMethod, setAuthMethod] = useState('password'); // 'password' (primary) or 'otp'
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeFaq, setActiveFaq] = useState(null);
  const [loginRedirectTarget, setLoginRedirectTarget] = useState('overlay');
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [otpStep, setOtpStep] = useState('form'); // 'form' (step 1) or 'otp' (step 2)
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error'); // 'error', 'info', or 'success'

  const sliderContainerRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScrollEvent = () => {
      const pos = sliderContainerRef.current?.scrollTop || window.scrollY || 0;
      setIsScrolled(pos > 15);
    };
    const el = sliderContainerRef.current;
    if (el) {
      el.addEventListener('scroll', handleScrollEvent, { passive: true });
    }
    window.addEventListener('scroll', handleScrollEvent, { passive: true });
    return () => {
      if (el) el.removeEventListener('scroll', handleScrollEvent);
      window.removeEventListener('scroll', handleScrollEvent);
    };
  }, []);

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Electron Titlebar Controls
  const handleMinimize = () => {
    if (ipcRenderer) ipcRenderer.send('window-minimize');
  };

  const handleMaximize = () => {
    if (ipcRenderer) ipcRenderer.send('window-maximize');
  };

  const handleClose = () => {
    if (ipcRenderer) ipcRenderer.send('window-close');
  };

  // Modal open helper
  const openModal = (mode = 'login') => {
    setModalMode(mode);
    setShowModal(true);
    setAuthMethod('password');
    setOtpStep('form');
    setOtpCode('');
    setPassword('');
    setShowPassword(false);
    setCooldown(0);
    setMessage('');
    setMessageType('error');
    setSubmitDisabled(false);
  };

  const closeModal = () => {
    setShowModal(false);
    setAuthMethod('password');
    setOtpStep('form');
    setOtpCode('');
    setPassword('');
    setShowPassword(false);
    setCooldown(0);
    setEmail('');
    setName('');
    setReferralCode('');
    setMessage('');
    setMessageType('error');
    setSubmitDisabled(false);
  };

  const handleEmailBlur = () => {
    if (!email.trim()) return;
    const check = validateEmailAddress(email);
    if (!check.valid) {
      setMessageType('error');
      setMessage(check.error);
    } else {
      if (message.includes('email') || message.includes('Placeholder') || message.includes('domain')) {
        setMessage('');
      }
    }
  };

  const handleActionClick = (action) => {
    const actionStr = typeof action === 'string' ? action : '';
    const isMockup = ['resume', 'radar', 'dashboard', 'meetings', 'history', 'reminders', 'community', 'mock_interview'].includes(actionStr);

    if (isMockup) {
      const messages = {
        resume: 'Resume Builder is coming soon!',
        radar: 'Job Radar is coming soon!',
        dashboard: 'Dashboard feature is coming soon!',
        meetings: 'Meetings scheduler is coming soon!',
        history: 'History log is coming soon!',
        reminders: 'Reminders scheduling feature is coming soon!',
        community: 'Community portal is coming soon!',
        mock_interview: 'Mock Interview feature is coming soon!'
      };
      if (showToast) {
        showToast(messages[actionStr] || 'This feature is coming soon!');
      } else {
        alert(messages[actionStr] || 'This feature is coming soon!');
      }
      return;
    }

    if (token) {
      if (actionStr === 'notetaker') {
        if (onGoToNotetaker) onGoToNotetaker();
      } else {
        if (onGoToPanel) onGoToPanel();
      }
    } else {
      const target = actionStr === 'notetaker' ? 'notetaker' : (actionStr === 'auth' ? 'auth' : 'overlay');
      setLoginRedirectTarget(target);
      openModal('register');
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitDisabled(true);
    setMessageType('info');
    setMessage('Opening Google sign-in...');

    try {
      const idToken = await signInWithGoogle();
      const response = await fetch(`${API_BASE}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          referralCode: referralCode.trim().toUpperCase()
        })
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.token) {
        throw new Error(
          payload?.error?.message || 'Google sign-in could not be completed.'
        );
      }

      setMessage('');
      if (ipcRenderer) {
        ipcRenderer.send('auth-login-success', {
          token: payload.token,
          user: payload.user || null,
          targetView: loginRedirectTarget
        });
      }
      if (onLoginSuccess) {
        onLoginSuccess(payload.token, payload.user || null, loginRedirectTarget);
      }
      closeModal();
    } catch (err) {
      try {
        await clearFirebaseSession();
      } catch {
        // Preserve the original sign-in error if Firebase cleanup also fails.
      }

      setSubmitDisabled(false);
      setMessageType('error');
      setMessage(
        err?.code
          ? getGoogleSignInErrorMessage(err)
          : err?.message || 'Google sign-in failed. Please try again.'
      );
    }
  };

  // Handle Email & Password Authentication (Login & Register)
  const handlePasswordAuth = async (e) => {
    if (e) e.preventDefault();
    const emailVal = email.trim();
    const nameVal = name.trim();
    const passVal = password;
    const refVal = referralCode.trim().toUpperCase();

    if (!emailVal) {
      setMessageType('error');
      setMessage('Please enter your email address.');
      return;
    }

    const emailCheck = validateEmailAddress(emailVal);
    if (!emailCheck.valid) {
      setMessageType('error');
      setMessage(emailCheck.error);
      return;
    }

    if (modalMode === 'register' && !nameVal) {
      setMessageType('error');
      setMessage('Please enter your full name.');
      return;
    }

    if (!passVal) {
      setMessageType('error');
      setMessage('Please enter your password.');
      return;
    }

    if (modalMode === 'register' && passVal.length < 6) {
      setMessageType('error');
      setMessage('Password must be at least 6 characters long.');
      return;
    }

    // Demo credential bypass for Vercel / demo deployment preview
    if (emailCheck.cleanEmail.toLowerCase() === 'test@gmail.com') {
      if (passVal === '123456') {
        setSubmitDisabled(true);
        setMessageType('success');
        setMessage('Welcome back! Signing you in...');

        const demoHeader = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const demoPayload = btoa(JSON.stringify({
          sub: 'user_demo_123',
          email: 'test@gmail.com',
          name: 'Aadi Jain',
          role: 'candidate',
          credits: 100,
          exp: Math.floor(Date.now() / 1000) + 31536000
        }));
        const demoSignature = btoa('demo_signature');
        const demoToken = `${demoHeader}.${demoPayload}.${demoSignature}`;
        const demoUser = {
          id: 'user_demo_123',
          name: 'Aadi Jain',
          email: 'test@gmail.com',
          role: 'candidate',
          credits: 100,
          createdAt: new Date().toISOString()
        };

        if (ipcRenderer) {
          ipcRenderer.send('auth-login-success', {
            token: demoToken,
            user: demoUser,
            targetView: loginRedirectTarget
          });
        }
        if (onLoginSuccess) {
          onLoginSuccess(demoToken, demoUser, loginRedirectTarget);
        }

        setTimeout(() => {
          closeModal();
          setSubmitDisabled(false);
        }, 400);
        return;
      } else {
        setMessageType('error');
        setMessage('Invalid password. For test account, use: 123456');
        return;
      }
    }

    setSubmitDisabled(true);
    setMessageType('info');
    setMessage(modalMode === 'login' ? 'Signing in...' : 'Creating your account...');

    try {
      const deviceId = getDeviceId();
      const endpoint = modalMode === 'login'
        ? `${API_BASE}/api/auth/login`
        : `${API_BASE}/api/auth/register`;

      const requestBody = modalMode === 'login'
        ? { email: emailCheck.cleanEmail, password: passVal, ...(deviceId ? { deviceId } : {}) }
        : { email: emailCheck.cleanEmail, password: passVal, name: nameVal, referralCode: refVal, ...(deviceId ? { deviceId } : {}) };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(deviceId ? { 'X-Device-Id': deviceId } : {})
        },
        body: JSON.stringify(requestBody)
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.message || (modalMode === 'login' ? 'Invalid email or password.' : 'Registration failed.'));
      }

      let authToken = payload?.token;
      let authUser = payload?.user;

      // If registration did not return session token directly, automatically authenticate
      if (!authToken && modalMode === 'register') {
        const loginResp = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(deviceId ? { 'X-Device-Id': deviceId } : {})
          },
          body: JSON.stringify({ email: emailCheck.cleanEmail, password: passVal, ...(deviceId ? { deviceId } : {}) })
        });
        const loginPayload = await loginResp.json().catch(() => null);
        if (loginResp.ok && loginPayload?.token) {
          authToken = loginPayload.token;
          authUser = loginPayload.user;
        }
      }

      if (!authToken) {
        throw new Error('Authentication succeeded but session token was not received.');
      }

      setMessageType('success');
      setMessage(modalMode === 'register' ? 'Account created! Signing you in...' : 'Welcome back! Signing you in...');

      if (ipcRenderer) {
        ipcRenderer.send('auth-login-success', {
          token: authToken,
          user: authUser || null,
          targetView: loginRedirectTarget
        });
      }
      if (onLoginSuccess) {
        onLoginSuccess(authToken, authUser || null, loginRedirectTarget);
      }

      setTimeout(() => {
        closeModal();
      }, 500);
    } catch (err) {
      setMessageType('error');
      if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
        setMessage('Backend is offline. For demo access, use: test@gmail.com / 123456');
      } else {
        setMessage(err?.message || 'Authentication failed. Please try again.');
      }
      try {
        reportClientError(err, { email: emailVal, mode: modalMode, action: "user_auth" }, "warning");
      } catch (_) {}
    } finally {
      setSubmitDisabled(false);
    }
  };

  // Request OTP (Step 1: Details / Email -> Step 2: Verification Code)
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    const emailVal = email.trim();
    const nameVal = name.trim();

    if (!emailVal || (modalMode === 'register' && !nameVal)) {
      setMessageType('error');
      setMessage(modalMode === 'register' && !nameVal ? 'Please enter your full name.' : 'Please enter your email address.');
      return;
    }

    const emailCheck = validateEmailAddress(emailVal);
    if (!emailCheck.valid) {
      setMessageType('error');
      setMessage(emailCheck.error);
      return;
    }

    if (emailCheck.cleanEmail.toLowerCase() === 'test@gmail.com') {
      setOtpStep('otp');
      setOtpCode('123456');
      setMessageType('info');
      setMessage('Demo verification code: 123456 (pre-filled)');
      return;
    }

    setSubmitDisabled(true);
    setMessageType('info');
    setMessage('Sending 6-digit verification code...');

    try {
      const response = await fetch(`${API_BASE}/api/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailCheck.cleanEmail, name: nameVal })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.message || 'Failed to dispatch verification code.');
      }

      setOtpStep('otp');
      setOtpCode('');
      setCooldown(payload?.cooldownSeconds || 60);
      setMessageType('info');
      setMessage(`Verification code sent to ${emailCheck.cleanEmail}`);
    } catch (err) {
      setMessageType('error');
      setMessage(err?.message || 'Error requesting verification code.');
    } finally {
      setSubmitDisabled(false);
    }
  };

  // Verify OTP (Step 2: Enter 6 digits -> Account Provisioning & Login)
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = otpCode.trim();

    if (!cleanCode || cleanCode.length !== 6) {
      setMessageType('error');
      setMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    if (email.trim().toLowerCase() === 'test@gmail.com') {
      if (cleanCode === '123456') {
        const demoHeader = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const demoPayload = btoa(JSON.stringify({
          sub: 'user_demo_123',
          email: 'test@gmail.com',
          name: name.trim() || 'Aadi Jain',
          role: 'candidate',
          credits: 100,
          exp: Math.floor(Date.now() / 1000) + 31536000
        }));
        const demoSignature = btoa('demo_signature');
        const demoToken = `${demoHeader}.${demoPayload}.${demoSignature}`;
        const demoUser = {
          id: 'user_demo_123',
          name: name.trim() || 'Aadi Jain',
          email: 'test@gmail.com',
          role: 'candidate',
          credits: 100,
          createdAt: new Date().toISOString()
        };

        if (ipcRenderer) {
          ipcRenderer.send('auth-login-success', {
            token: demoToken,
            user: demoUser,
            targetView: loginRedirectTarget
          });
        }
        if (onLoginSuccess) {
          onLoginSuccess(demoToken, demoUser, loginRedirectTarget);
        }

        setTimeout(() => {
          closeModal();
          setSubmitDisabled(false);
        }, 400);
        return;
      } else {
        setMessageType('error');
        setMessage('Invalid code. For test demo, enter: 123456');
        return;
      }
    }

    setSubmitDisabled(true);
    setMessageType('info');
    setMessage('Verifying code...');

    try {
      const deviceId = getDeviceId();
      const response = await fetch(`${API_BASE}/api/auth/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(deviceId ? { 'X-Device-Id': deviceId } : {})
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: cleanCode,
          name: name.trim(),
          referralCode: referralCode.trim().toUpperCase(),
          ...(deviceId ? { deviceId } : {})
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.message || 'Invalid or expired code.');
      }

      if (!payload?.token) {
        throw new Error('Authentication succeeded but no session token received.');
      }

      setMessageType('success');
      setMessage(payload.isNewUser ? 'Account created! Signing you in...' : 'Verified! Signing you in...');

      if (ipcRenderer) {
        ipcRenderer.send('auth-login-success', {
          token: payload.token,
          user: payload.user || null,
          targetView: loginRedirectTarget
        });
      }
      if (onLoginSuccess) {
        onLoginSuccess(payload.token, payload.user || null, loginRedirectTarget);
      }

      setTimeout(() => {
        closeModal();
      }, 500);
    } catch (err) {
      setMessageType('error');
      setMessage(err?.message || 'Verification failed.');
    } finally {
      setSubmitDisabled(false);
    }
  };

  const handleResendOtp = (e) => {
    if (e) e.preventDefault();
    if (cooldown > 0 || submitDisabled) return;
    handleRequestOtp();
  };

  // Read referral code & deep links from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = String(params.get('ref') || '').trim().toUpperCase();

    if (ref) {
      setReferralCode(ref);
      openModal('register');
    }

    const auth = String(params.get('auth') || '').toLowerCase();
    if (auth === 'login' || auth === 'signin') {
      openModal('login');
    } else if (auth === 'signup' || auth === 'register') {
      openModal('register');
    }
  }, []);

  // Scroll Sync with Section IDs
  useEffect(() => {
    const handleScroll = () => {
      const container = sliderContainerRef.current;
      const pos = container ? container.scrollTop : (window.scrollY || 0);
      setIsScrolled(pos > 15);

      const sectionMap = [
        { id: 'slide-0', idx: 0 },
        { id: 'slide-demo-video', idx: 1 },
        { id: 'slide-1', idx: 1 },
        { id: 'slide-2', idx: 1 },
        { id: 'slide-3', idx: 1 },
        { id: 'slide-4', idx: 1 },
        { id: 'slide-5', idx: 1 },
        { id: 'slide-6', idx: 5 }
      ];

      const scrollCenter = pos + window.innerHeight / 3;
      for (let i = sectionMap.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionMap[i].id);
        if (el && el.offsetTop <= scrollCenter) {
          setActiveSlide(sectionMap[i].idx);
          break;
        }
      }
    };

    const container = sliderContainerRef.current;
    if (container) container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (container) container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToSlide = (idx) => {
    const slideMap = {
      0: 'slide-0',
      1: 'slide-demo-video',
      2: 'slide-1',
      3: 'slide-2',
      4: 'slide-3',
      5: 'slide-6',
      6: 'slide-6'
    };
    const targetId = typeof idx === 'string' ? idx : (slideMap[idx] || `slide-${idx}`);
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSlide(typeof idx === 'number' ? idx : 0);
    }
  };

  const handleNavigateView = (view) => {
    if (view === 'skills' || view === 'copilot') onGoToPanel?.('overlay');
    else if (view === 'notetaker') onGoToNotetaker?.();
    else if (view === 'voice-agent') onGoToVoiceAgent?.();
    else if (view === 'upload') onGoToUpload?.();
    else if (view === 'dashboard') onGoToDashboard?.();
    else if (view === 'subscription' || view === 'plans' || view === 'pricing') onGoToSubscription?.();
    else onGoToPanel?.(view);
  };

  const handleOpenAuthModal = (mode = 'signup', targetView = 'overlay') => {
    setLoginRedirectTarget(targetView === 'skills' ? 'overlay' : (targetView || 'overlay'));
    openModal(mode === 'login' ? 'login' : 'register');
  };

  // Toggle FAQ Accordion
  const toggleFaq = (idx) => {
    setActiveFaq(activeFaq === idx ? null : idx);
  };

  const pwdStrength = checkPasswordStrength(password);

  return (
    <div className={`landing-page-root ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* Shared fixed floating header with announcement banner */}
      <div className={`landing-fixed-header-group ${isScrolled ? 'scrolled' : 'transparent-header'}`}>
        <header className="app-header landing-pill-header">
          {/* Left: Brand Logo & Title */}
          <BrandLogo onClick={() => scrollToSlide(0)} size="md" />

          {/* Center: Minimal Clean Pill Navigation */}
          <nav className="landing-pill-nav">
            <button
              type="button"
              className={`landing-pill-nav-item ${activeSlide === 0 ? 'active' : ''}`}
              onClick={() => scrollToSlide(0)}
            >
              Home
            </button>
            <button
              type="button"
              className={`landing-pill-nav-item ${activeSlide === 1 ? 'active' : ''}`}
              onClick={() => scrollToSlide(1)}
            >
              Features
            </button>
            {token && user && (
              <button
                type="button"
                className="landing-pill-nav-item"
                onClick={onGoToDashboard}
              >
                Dashboard
              </button>
            )}

            <button
              type="button"
              className="landing-pill-nav-item"
              onClick={onGoToSubscription}
            >
              Plans
            </button>
            <button
              type="button"
              className={`landing-pill-nav-item ${activeSlide === 5 ? 'active' : ''}`}
              onClick={() => scrollToSlide(5)}
            >
              FAQ
            </button>
          </nav>

          {/* Right: Action Buttons & Hamburger (Three Lines) */}
          <div className="landing-pill-actions">
            {token && user ? (
              <AccountDropdown
                user={user}
                onGoToProfile={onGoToProfile}
                onGoToSubscription={onGoToSubscription}
                onGoToUsage={onGoToUsage}
                onLogout={onLogout}
                showToast={showToast}
              />
            ) : (
              <>
                <button
                  type="button"
                  className="landing-pill-login-link"
                  onClick={() => { setLoginRedirectTarget('auth'); openModal('login'); }}
                >
                  Login
                </button>
                <button
                  type="button"
                  className="landing-pill-cta-btn"
                  onClick={() => { setLoginRedirectTarget('auth'); openModal('register'); }}
                >
                  <i className="fa-solid fa-play"></i> Get Started Free
                </button>
              </>
            )}

            {/* Three Lines / Hamburger Button */}
            <button
              type="button"
              className="landing-hamburger-btn"
              onClick={() => setShowNavDrawer(true)}
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <i className="fa-solid fa-bars"></i>
            </button>
          </div>
        </header>

        <OfferBanner onSelectOffer={onGoToSubscription} />
      </div>

      {/* Scrollable Container with HomeSlides */}
      <div className="slider-container" ref={sliderContainerRef}>
        <HomeSlides
          setCurrentView={handleNavigateView}
          openAuthModal={handleOpenAuthModal}
          user={user}
        />

        {/* Bottom Footer Bar */}
        <footer className="app-bottom-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>
              <i className="fa-solid fa-lock"></i> <strong>Privacy-first AI</strong>
            </span>
            <span>• Personal use only • You control &amp; delete your data anytime</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); alert("Privacy Policy: Your data is encrypted and never used for training."); }}
              style={{ color: '#94a3b8', fontSize: '0.78rem', textDecoration: 'none' }}
            >
              Privacy
            </a>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); alert("Terms of Service: Standard personal practice use terms apply."); }}
              style={{ color: '#94a3b8', fontSize: '0.78rem', textDecoration: 'none' }}
            >
              Terms
            </a>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); alert("Support: Please contact us at support@myinterviewcopilot.com"); }}
              style={{ color: '#94a3b8', fontSize: '0.78rem', textDecoration: 'none' }}
            >
              Support
            </a>
          </div>
        </footer>

        <div className="faq-footer-meta" style={{ textAlign: 'center', padding: '16px 20px 24px', fontSize: '0.74rem', color: '#64748b', background: '#070d19' }}>
          <div>Training-only AI interview practice. Not a real interview. No employer affiliation. No guarantees.</div>
          <div style={{ marginTop: '4px' }}>© 2025 My Interview Copilot - Privacy - Terms</div>
        </div>
      </div>

      {/* Modal Authentication Popup */}
      {showModal && (
        <div className="auth-modal">
          <div className="auth-modal-overlay" onClick={closeModal}></div>
          <div className="auth-modal-card">
            <button className="auth-modal-close" onClick={closeModal} aria-label="Close modal">&times;</button>
            <h1>
              {authMethod === 'otp'
                ? (otpStep === 'otp' ? 'Verify Your Email' : (modalMode === 'login' ? 'OTP Sign In' : 'OTP Register'))
                : (modalMode === 'login' ? 'Welcome Back' : 'Create Account')}
            </h1>
            <div className="sub">
              {authMethod === 'otp'
                ? (otpStep === 'otp'
                    ? 'Enter the 6-digit verification code sent to your email'
                    : 'Enter your email to receive a login code')
                : (modalMode === 'login'
                    ? 'Sign in with your email and password'
                    : 'Register to start using the assistant')}
            </div>

            {authMethod === 'password' && (
              <>
                <button
                  className="google-auth-btn"
                  type="button"
                  disabled={submitDisabled}
                  onClick={handleGoogleSignIn}
                >
                  <i className="fa-brands fa-google" aria-hidden="true"></i>
                  Continue with Google
                </button>

                <div className="auth-divider" aria-hidden="true">
                  <span>or continue with email</span>
                </div>

                <form onSubmit={handlePasswordAuth} noValidate>
                  {modalMode === 'register' && (
                    <div className="field">
                      <label htmlFor="name">Full Name</label>
                      <input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        required
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (message) setMessage('');
                        }}
                        autoComplete="name"
                      />
                    </div>
                  )}


                  <div className="field">
                    <label htmlFor="email">Email</label>
                    <input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      required
                      value={email}
                      onBlur={handleEmailBlur}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (message.includes('email') || message.includes('Placeholder') || message.includes('domain')) {
                          setMessage('');
                        }
                      }}
                      autoComplete="email"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="password">Password</label>
                    <div className="password-input-wrapper">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder={modalMode === 'login' ? 'Enter your password' : 'Create a password (min. 6 characters)'}
                        required
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (message) setMessage('');
                        }}
                        autoComplete={modalMode === 'login' ? 'current-password' : 'new-password'}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                  </div>

                  {modalMode === 'register' && password && (
                    <div className="password-strength-container">
                      <div className="strength-header">
                        <span className="strength-title">Password Strength</span>
                        {pwdStrength.label && (
                          <span className={`strength-badge ${pwdStrength.level}`}>
                            {pwdStrength.label}
                          </span>
                        )}

                      </div>
                      <div className="strength-meter-bar">
                        <div className={`strength-segment ${pwdStrength.count >= 1 ? pwdStrength.level : ''}`}></div>
                        <div className={`strength-segment ${pwdStrength.count >= 2 ? pwdStrength.level : ''}`}></div>
                        <div className={`strength-segment ${pwdStrength.count >= 3 ? pwdStrength.level : ''}`}></div>
                        <div className={`strength-segment ${pwdStrength.count >= 5 ? pwdStrength.level : ''}`}></div>
                      </div>
                      <div className="password-requirements-list">
                        <div className={`req-item ${pwdStrength.checks.length ? 'met' : ''}`}>
                          <i className={`fa-solid ${pwdStrength.checks.length ? 'fa-check' : 'fa-circle'}`}></i>
                          <span>At least 8 chars</span>
                        </div>
                        <div className={`req-item ${pwdStrength.checks.hasUpper ? 'met' : ''}`}>
                          <i className={`fa-solid ${pwdStrength.checks.hasUpper ? 'fa-check' : 'fa-circle'}`}></i>
                          <span>Uppercase (A-Z)</span>
                        </div>
                        <div className={`req-item ${pwdStrength.checks.hasLower ? 'met' : ''}`}>
                          <i className={`fa-solid ${pwdStrength.checks.hasLower ? 'fa-check' : 'fa-circle'}`}></i>
                          <span>Lowercase (a-z)</span>
                        </div>
                        <div className={`req-item ${pwdStrength.checks.hasNumber ? 'met' : ''}`}>
                          <i className={`fa-solid ${pwdStrength.checks.hasNumber ? 'fa-check' : 'fa-circle'}`}></i>
                          <span>Number (0-9)</span>
                        </div>
                        <div className={`req-item ${pwdStrength.checks.hasSpecial ? 'met' : ''}`}>
                          <i className={`fa-solid ${pwdStrength.checks.hasSpecial ? 'fa-check' : 'fa-circle'}`}></i>
                          <span>Special char</span>
                        </div>
                      </div>
                    </div>
                  )}


                  {modalMode === 'register' && (
                    <div className="field">
                      <label htmlFor="referralCode">Referral Code (Optional)</label>
                      <input
                        id="referralCode"
                        type="text"
                        placeholder="Enter referral code"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        autoComplete="off"
                      />
                    </div>
                  )}

                  {modalMode === 'login' && (
                    <div
                      style={{
                        margin: '0 0 16px 0',
                        padding: '10px 14px',
                        background: darkMode ? 'rgba(16, 185, 129, 0.16)' : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 95, 70, 0.15))',
                        border: darkMode ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: darkMode ? '#34d399' : '#065f46',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setEmail('test@gmail.com');
                        setPassword('123456');
                        setMessage('Demo credentials filled! Click Sign In to continue.');
                        setMessageType('info');
                      }}
                      title="Click to auto-fill test credentials"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-key"></i>
                        <span>Demo Account: <strong>test@gmail.com</strong> / <strong>123456</strong></span>
                      </div>
                      <span style={{ fontSize: '11px', textDecoration: 'underline', opacity: 0.9, fontWeight: 600 }}>Auto-fill</span>
                    </div>
                  )}

                  {message && (
                    <div className={`auth-message-banner ${messageType}`}>
                      <i className={`fa-solid ${messageType === 'success' ? 'fa-circle-check' : (messageType === 'info' ? 'fa-spinner fa-spin' : 'fa-circle-exclamation')}`}></i>
                      <span>{message}</span>
                    </div>
                  )}


                  <button className="auth-submit-btn" type="submit" disabled={submitDisabled}>
                    {submitDisabled ? (
                      <span>
                        <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                        {modalMode === 'login' ? 'Signing In...' : 'Creating Account...'}
                      </span>
                    ) : (
                      modalMode === 'login' ? 'Sign In' : 'Create Account'
                    )}

                  </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '14px' }}>
                  <button
                    type="button"
                    className="otp-resend-btn"
                    style={{ fontSize: '12px', color: '#64748b' }}
                    onClick={() => {
                      setAuthMethod('otp');
                      setOtpStep('form');
                      setMessage('');
                    }}
                  >
                    <i className="fa-solid fa-envelope"></i> Sign in with OTP code instead
                  </button>
                </div>
              </>
            )}


            {authMethod === 'otp' && (
              <>
                {otpStep === 'form' && (
                  <>
                    <button
                      className="google-auth-btn"
                      type="button"
                      disabled={submitDisabled}
                      onClick={handleGoogleSignIn}
                    >
                      <i className="fa-brands fa-google" aria-hidden="true"></i>
                      Continue with Google
                    </button>

                    <div className="auth-divider" aria-hidden="true">
                      <span>or continue with email</span>
                    </div>
                  </>
                )}


                {otpStep === 'form' ? (
                  <form onSubmit={handleRequestOtp} noValidate>
                    {modalMode === 'register' && (
                      <div className="field">
                        <label htmlFor="name">Full Name</label>
                        <input
                          id="name"
                          type="text"
                          placeholder="John Doe"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    )}

                    {modalMode === 'register' && (
                      <div className="field">
                        <label htmlFor="referralCode">Referral Code (Optional)</label>
                        <input
                          id="referralCode"
                          type="text"
                          placeholder="Enter referral code"
                          value={referralCode}
                          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                          autoComplete="off"
                        />
                      </div>
                    )}

                    <div className="field">
                      <label htmlFor="email">Email</label>
                      <input
                        id="email"
                        type="email"
                        placeholder="name@company.com"
                        required
                        value={email}
                        onBlur={handleEmailBlur}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (message.includes('email') || message.includes('Placeholder') || message.includes('domain')) {
                            setMessage('');
                          }
                        }}
                      />
                    </div>

                    {message && (
                      <div className={`auth-message-banner ${messageType}`}>
                        <i className={`fa-solid ${messageType === 'success' ? 'fa-circle-check' : (messageType === 'info' ? 'fa-spinner fa-spin' : 'fa-circle-exclamation')}`}></i>
                        <span>{message}</span>
                      </div>
                    )}


                    <button className="auth-submit-btn" type="submit" disabled={submitDisabled}>
                      {submitDisabled ? (
                        <span><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Sending Code...</span>
                      ) : (
                        'Send Verification Code'
                      )}

                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} noValidate>
                    <div className="otp-info-pill">
                      <span>Code sent to: <strong>{email}</strong></span>
                      <button
                        type="button"
                        className="change-email-btn"
                        onClick={() => {
                          setOtpStep('form');
                          setMessage('');
                        }}
                      >
                        Edit
                      </button>
                    </div>

                    <div className="field">
                      <label htmlFor="otpCode">6-Digit Verification Code</label>
                      <input
                        id="otpCode"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="••••••"
                        autoFocus
                        required
                        className="otp-code-input"
                        value={otpCode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setOtpCode(val);
                          if (message) setMessage('');
                        }}
                      />
                    </div>

                    {message && (
                      <div className={`auth-message-banner ${messageType}`}>
                        <i className={`fa-solid ${messageType === 'success' ? 'fa-circle-check' : (messageType === 'info' ? 'fa-spinner fa-spin' : 'fa-circle-exclamation')}`}></i>
                        <span>{message}</span>
                      </div>
                    )}


                    <button
                      className="auth-submit-btn"
                      type="submit"
                      disabled={submitDisabled || otpCode.length !== 6}
                    >
                      {submitDisabled ? (
                        <span><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Verifying...</span>
                      ) : (
                        modalMode === 'register' ? 'Verify & Create Account' : 'Verify & Sign In'
                      )}

                    </button>

                    <div className="otp-resend-row">
                      {cooldown > 0 ? (
                        <span>Resend code in <strong className="otp-timer">{cooldown}s</strong></span>
                      ) : (
                        <button
                          type="button"
                          className="otp-resend-btn"
                          onClick={handleResendOtp}
                          disabled={submitDisabled}
                        >
                          <i className="fa-solid fa-rotate-right"></i> Resend code
                        </button>
                      )}

                    </div>

                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                      <button
                        type="button"
                        className="change-email-btn"
                        onClick={() => {
                          setOtpStep('form');
                          setMessage('');
                        }}
                      >
                        <i className="fa-solid fa-arrow-left" style={{ marginRight: '6px' }}></i> Change details / email
                      </button>
                    </div>
                  </form>
                )}


                <div style={{ textAlign: 'center', marginTop: '14px' }}>
                  <button
                    type="button"
                    className="otp-resend-btn"
                    style={{ fontSize: '12px', color: '#64748b' }}
                    onClick={() => {
                      setAuthMethod('password');
                      setMessage('');
                    }}
                  >
                    <i className="fa-solid fa-lock"></i> Sign in with email & password instead
                  </button>
                </div>
              </>
            )}

            
            <div className="auth-mode-switch">
              {modalMode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => {
                      setModalMode('register');
                      setAuthMethod('password');
                      setOtpStep('form');
                      setOtpCode('');
                      setPassword('');
                      setShowPassword(false);
                      setMessage('');
                    }}
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => {
                      setModalMode('login');
                      setAuthMethod('password');
                      setOtpStep('form');
                      setOtpCode('');
                      setPassword('');
                      setShowPassword(false);
                      setMessage('');
                    }}
                  >
                    Sign In
                  </button>
                </>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Slide-out Navigation Drawer ("Three Lines" Menu) */}
      {showNavDrawer && (
        <div className="landing-drawer-overlay" onClick={() => setShowNavDrawer(false)}>
          <div className="landing-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="landing-drawer-header">
              <BrandLogo size="sm" />
              <button
                type="button"
                className="landing-drawer-close-btn"
                onClick={() => setShowNavDrawer(false)}
                aria-label="Close navigation menu"
              >
                &times;
              </button>
            </div>

            <div className="landing-drawer-body">
              <div className="landing-drawer-section-title">Navigation</div>
              <button
                type="button"
                className={`landing-drawer-item ${activeSlide === 0 ? 'active' : ''}`}
                onClick={() => { setShowNavDrawer(false); scrollToSlide(0); }}
              >
                <i className="fa-solid fa-house"></i> Home
              </button>
              <button
                type="button"
                className="landing-drawer-item"
                onClick={() => { setShowNavDrawer(false); onGoToDashboard(); }}
              >
                <i className="fa-solid fa-chart-line"></i> Dashboard
              </button>
              <button
                type="button"
                className="landing-drawer-item"
                onClick={() => { setShowNavDrawer(false); handleActionClick('mock_interview'); }}
              >
                <i className="fa-solid fa-video"></i> Mock Interview
              </button>
              <button
                type="button"
                className="landing-drawer-item"
                onClick={() => { setShowNavDrawer(false); handleActionClick('meetings'); }}
              >
                <i className="fa-solid fa-calendar-days"></i> Meetings
              </button>
              <button
                type="button"
                className="landing-drawer-item"
                onClick={() => { setShowNavDrawer(false); handleActionClick('history'); }}
              >
                <i className="fa-solid fa-clock-rotate-left"></i> History
              </button>
              <button
                type="button"
                className="landing-drawer-item"
                onClick={() => { setShowNavDrawer(false); handleActionClick('reminders'); }}
              >
                <i className="fa-solid fa-bell"></i> Reminders
              </button>
              <button
                type="button"
                className="landing-drawer-item"
                onClick={() => { setShowNavDrawer(false); onGoToSubscription(); }}
              >
                <i className="fa-solid fa-crown"></i> Plans &amp; Pricing
              </button>

              <div className="landing-drawer-section-title">AI Copilot Suite</div>
              <button
                type="button"
                className="landing-drawer-item"
                onClick={() => { setShowNavDrawer(false); onGoToPanel(); }}
              >
                <i className="fa-solid fa-rocket"></i> AI Copilot
              </button>
              <button
                type="button"
                className="landing-drawer-item"
                onClick={() => { setShowNavDrawer(false); onGoToNotetaker(); }}
              >
                <i className="fa-solid fa-microphone"></i> Notetaker
              </button>
              <button
                type="button"
                className="landing-drawer-item"
                onClick={() => { setShowNavDrawer(false); onGoToVoiceAgent(); }}
              >
                <i className="fa-solid fa-robot"></i> Voice Agent
              </button>
              <button
                type="button"
                className="landing-drawer-item"
                onClick={() => { setShowNavDrawer(false); onGoToUpload(); }}
              >
                <i className="fa-solid fa-cloud-arrow-up"></i> Upload Media
              </button>
              <button
                type="button"
                className="landing-drawer-item"
                onClick={() => { setShowNavDrawer(false); onGoToReferral?.(); }}
              >
                <i className="fa-solid fa-gift"></i> Refer &amp; Earn
              </button>

              <div className="landing-drawer-section-title">Preferences &amp; Account</div>
              <button
                type="button"
                className="landing-drawer-item"
                onClick={() => { toggleDarkMode?.(); }}
              >
                <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i> {darkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
              <div className="landing-drawer-item" style={{ cursor: 'default' }}>
                <i className="fa-solid fa-globe"></i> US EN
              </div>
              {token && user ? (
                <>
                  <button
                    type="button"
                    className="landing-drawer-item"
                    onClick={() => { setShowNavDrawer(false); onGoToProfile?.(); }}
                  >
                    <i className="fa-solid fa-user-gear"></i> Profile &amp; Settings
                  </button>
                  <button
                    type="button"
                    className="landing-drawer-item"
                    onClick={() => { setShowNavDrawer(false); onGoToUsage?.(); }}
                  >
                    <i className="fa-solid fa-gauge-high"></i> Usage &amp; Billing
                  </button>
                  <button
                    type="button"
                    className="landing-drawer-item landing-drawer-logout"
                    onClick={() => { setShowNavDrawer(false); onLogout?.(); }}
                  >
                    <i className="fa-solid fa-right-from-bracket"></i> Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="landing-drawer-item"
                    onClick={() => { setShowNavDrawer(false); setLoginRedirectTarget('auth'); openModal('login'); }}
                  >
                    <i className="fa-solid fa-arrow-right-to-bracket"></i> Login
                  </button>
                  <button
                    type="button"
                    className="landing-drawer-item"
                    onClick={() => { setShowNavDrawer(false); setLoginRedirectTarget('auth'); openModal('register'); }}
                  >
                    <i className="fa-solid fa-user-plus"></i> Register Free
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
