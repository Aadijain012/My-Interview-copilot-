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

    // Demo credential bypass for Vercel / frontend preview deployment
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
          exp: Math.floor(Date.now() / 1000) + 31536000 // 1 year validity
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

        setMessageType('success');
        setMessage('Verified! Signing you in...');

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
        setMessage('Invalid code. For test account, use: 123456');
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

  // Scroll Sync with Side Dot indicators
  useEffect(() => {
    const container = sliderContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const slides = container.querySelectorAll('.slide');
      let currentIdx = 0;
      let minDiff = Infinity;
      const containerTop = container.getBoundingClientRect().top;

      slides.forEach((slide, idx) => {
        const slideTop = slide.getBoundingClientRect().top;
        const diff = Math.abs(slideTop - containerTop);
        if (diff < minDiff) {
          minDiff = diff;
          currentIdx = idx;
        }
      });
      setActiveSlide(currentIdx);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSlide = (idx) => {
    const container = sliderContainerRef.current;
    if (!container) return;
    const slides = container.querySelectorAll('.slide');
    const target = slides[idx];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSlide(idx);
    }
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
          <div className="landing-pill-logo logo-container" onClick={() => scrollToSlide(0)}>
            <div className="landing-pill-logo-icon logo-icon">
              <i className="fa-solid fa-brain"></i>
            </div>
            <span className="landing-pill-logo-text logo-text">My Interview Copilot</span>
          </div>

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

      {/* Slide Navigation Dots */}
      <div className="slider-dots">
        {[
          { name: 'Welcome' },
          { name: 'Features' },
          { name: 'Reminders' },
          { name: 'Careers' },
          { name: 'Community' },
          { name: 'Get Ready & FAQ' }
        ].map((s, idx) => (
          <div
            key={idx}
            className={`dot ${activeSlide === idx ? 'active' : ''}`}
            onClick={() => scrollToSlide(idx)}
            title={s.name}
          />
        ))}
      </div>

      {/* Fixed footer strip (hidden on Slide 6) */}
      {activeSlide !== 5 && (
        <footer className="app-footer">
          <div className="footer-left">
            <span className="footer-badge"><i className="fa-solid fa-lock"></i> Privacy-first AI</span>
            <span>• Personal use only</span>
            <span>• You control &amp; delete your data anytime</span>
          </div>
          <div className="footer-right">
            <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Support</a>
          </div>
        </footer>
      )}


      {/* Scroll Snapping Container */}
      <div className="slider-container" ref={sliderContainerRef}>
        
        {/* Slide 1: Hero */}
        <section className="slide" id="slide1">
          <div className="hero-left">
            <div className="badge-coach">
              <i className="fa-solid fa-bolt"></i> AI-Powered Interview Coach
            </div>
            <h1 className="hero-title">
              Interview Smarter<br /><span>with Your AI Copilot</span>
            </h1>
            <p className="hero-desc">
              Thousands of candidates have already used our AI interviews and report highly positive, confidence-boosting feedback on their performance.
            </p>
            
            <div className="rating-row">
              <div className="avatar-stack">
                <img className="avatar" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop&crop=faces" alt="U1" />
                <img className="avatar" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=faces" alt="U2" />
                <img className="avatar" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=50&h=50&fit=crop&crop=faces" alt="U3" />
                <img className="avatar" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=50&h=50&fit=crop&crop=faces" alt="U4" />
                <img className="avatar" src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop&crop=faces" alt="U5" />
              </div>
              <div className="rating-text">
                50K+ <span>users</span>
              </div>
              <div className="stars">
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
                <i className="fa-solid fa-star"></i>
              </div>
              <div className="rating-text" style={{ fontWeight: 500, fontSize: '12.5px', color: '#64748b' }}>
                4.9/5 rating
              </div>
            </div>

            <button className="hero-cta-btn" onClick={() => handleActionClick('copilot')}>
              <i className="fa-solid fa-bolt"></i> {token ? 'Go to Skill Selection' : 'Sign up free – no credit card'} <i className="fa-solid fa-arrow-right" style={{ marginLeft: '4px' }}></i>
            </button>
            
            <div className="hero-cta-sub">
              <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i> Instant Access — <span>start free</span>, no payment details required
            </div>

            <div className="features-list-row">
              <span><i className="fa-solid fa-circle"></i> Real-time AI Feedback</span>
              <span><i className="fa-solid fa-circle"></i> Speech Recognition</span>
              <span><i className="fa-solid fa-circle"></i> Instant Results</span>
            </div>
          </div>
          
        </section>

        {/* Slide 2: Feature Columns */}
        <section className="slide" id="slide2">
          <div className="grid-4">
            {/* Card 1 */}
            <div className="card-feature">
              <span className="card-badge badge-orange">POPULAR</span>
              <h2 className="card-title">AI Interview Copilot</h2>
              <p className="card-desc">Get real-time answer suggestions during practice interviews — with multiple response options.</p>
              <ul className="card-bullets">
                <li><i className="fa-solid fa-circle-check"></i> Multi-answer suggestions</li>
                <li><i className="fa-solid fa-circle-check"></i> Confidence feedback</li>
                <li><i className="fa-solid fa-circle-check"></i> Copy &amp; save best response</li>
              </ul>
              <span className="card-best-for best-blue">Best for: Live practice</span>
              <button className="card-btn btn-gradient" onClick={() => handleActionClick('copilot')}>Start Copilot <i className="fa-solid fa-arrow-right"></i></button>
            </div>

            {/* Card 2 */}
            <div className="card-feature">
              <span className="card-badge badge-green">NEW</span>
              <h2 className="card-title">Smart Notetaker</h2>
              <p className="card-desc">Automatically capture questions, answers, and key feedback with timestamps.</p>
              <ul className="card-bullets">
                <li><i className="fa-solid fa-circle-check"></i> Speaker labels</li>
                <li><i className="fa-solid fa-circle-check"></i> Live notes</li>
                <li><i className="fa-solid fa-circle-check"></i> Export to PDF</li>
              </ul>
              <span className="card-best-for best-green">Best for: Calls &amp; mock interviews</span>
              <button className="card-btn btn-dark" onClick={() => handleActionClick('notetaker')}>Open Notetaker <i className="fa-solid fa-arrow-right"></i></button>
            </div>

            {/* Card 3 */}
            <div className="card-feature">
              <span className="card-badge badge-purple">AI</span>
              <h2 className="card-title">Resume Builder</h2>
              <p className="card-desc">Optimize your resume with ATS scoring, keyword analysis, and AI suggestions.</p>
              <ul className="card-bullets">
                <li><i className="fa-solid fa-circle-check"></i> ATS keyword gaps</li>
                <li><i className="fa-solid fa-circle-check"></i> Tailored bullet rewrites</li>
                <li><i className="fa-solid fa-circle-check"></i> Version history</li>
              </ul>
              <span className="card-info">ATS scores are estimates and don't guarantee hiring outcomes.</span>
              <span className="card-best-for best-purple">Best for: Resume upgrades</span>
              <button className="card-btn btn-dark" onClick={() => handleActionClick('resume')}>Improve Resume <i className="fa-solid fa-arrow-right"></i></button>
            </div>

            {/* Card 4 */}
            <div className="card-feature">
              <h2 className="card-title">Job Radar</h2>
              <p className="card-desc">
                Find relevant jobs based on your location, skills, and preferences.
              </p>

              <ul className="card-bullets">
                <li><i className="fa-solid fa-circle-check"></i> IP-based location + manual</li>
                <li><i className="fa-solid fa-circle-check"></i> Filter by remote/hybrid</li>
                <li><i className="fa-solid fa-circle-check"></i> Save jobs &amp; alerts</li>
              </ul>

              <span className="card-best-for best-cyan">
                Best for: Finding roles fast
              </span>

              <button
                className="card-btn btn-dark"
                onClick={() => handleActionClick('radar')}
              >
                Discover Jobs <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>

            {/* Card 5 - Refer & Earn */}
            <div className="card-feature referral-feature-card">

              <div className="referral-card-icon">
                <i className="fa-solid fa-gift"></i>
              </div>

              <span className="card-badge badge-green">REWARDS</span>

              <h2 className="card-title">Refer &amp; Earn</h2>

              <p className="card-desc">
                Invite friends, grow your circle, and unlock exclusive rewards
                as your community grows.
              </p>

              <ul className="card-bullets">
                <li>
                  <i className="fa-solid fa-circle-check"></i>
                  Share your personal referral code
                </li>
                <li>
                  <i className="fa-solid fa-circle-check"></i>
                  Earn referral rewards
                </li>
                <li>
                  <i className="fa-solid fa-circle-check"></i>
                  Unlock community features
                </li>
              </ul>

              <span className="card-best-for best-green">
                Best for: Growing your circle
              </span>

              <button
                className="card-btn referral-card-btn home-referral-action-button"
                onClick={() => {
                  if (token) {
                    onGoToReferral();
                  } else {
                    setLoginRedirectTarget('auth');
                    openModal('register');
                  }
                }}
              >
                Refer &amp; Earn <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </section>

        {/* Slide 3: Reminders */}
        <section className="slide" id="slide3">
          <div className="slide-header">
            <h2 className="slide-title">Schedule reminders <span>anytime, anywhere</span></h2>
            <p className="slide-subtitle">Voice calls, emails, SMS, or push notifications — pick how you want to be reminded and let us handle the rest.</p>
          </div>

          <div className="grid-4" style={{ maxWidth: '1000px' }}>
            {/* Reminder 1 */}
            <div className="card-reminder">
              <h3 className="card-title" style={{ fontSize: '15px', marginBottom: '4px' }}>Voice Call</h3>
              <p className="card-desc" style={{ fontSize: '11.5px', minHeight: '40px', marginBottom: '8px' }}>Get a phone call reminder before high-stakes interviews.</p>
              <div className="reminder-time"><i className="fa-regular fa-clock"></i> 5, 15, 30 min before</div>
              <span className="card-best-for best-blue" style={{ marginBottom: '14px', fontSize: '10px' }}>Best for: High-stakes interviews</span>
              <button className="btn-reminder-toggle btn-rem-disable" onClick={() => handleActionClick('reminders')}>Tap to enable</button>
            </div>

            {/* Reminder 2 */}
            <div className="card-reminder">
              <span className="reminder-badge">ON</span>
              <h3 className="card-title" style={{ fontSize: '15px', marginBottom: '4px' }}>Email</h3>
              <p className="card-desc" style={{ fontSize: '11.5px', minHeight: '40px', marginBottom: '8px' }}>Branded emails with prep tips delivered to your inbox.</p>
              <div className="reminder-time"><i className="fa-regular fa-calendar-check"></i> Calendar invites attached</div>
              <span className="card-best-for best-blue" style={{ marginBottom: '14px', fontSize: '10px' }}>Best for: Daily prep reminders</span>
              <button className="btn-reminder-toggle btn-rem-enable" onClick={() => handleActionClick('reminders')}><i className="fa-solid fa-circle-check"></i> Selected</button>
            </div>

            {/* Reminder 3 */}
            <div className="card-reminder">
              <h3 className="card-title" style={{ fontSize: '15px', marginBottom: '4px' }}>SMS</h3>
              <p className="card-desc" style={{ fontSize: '11.5px', minHeight: '40px', marginBottom: '8px' }}>Instant texts that cut through the noise.</p>
              <div className="reminder-time"><i className="fa-solid fa-check"></i> Any carrier, any country</div>
              <span className="card-best-for best-blue" style={{ marginBottom: '14px', fontSize: '10px' }}>Best for: Last-minute alerts</span>
              <button className="btn-reminder-toggle btn-rem-disable" onClick={() => handleActionClick('reminders')}>Tap to enable</button>
            </div>

            {/* Reminder 4 */}
            <div className="card-reminder">
              <span className="reminder-badge">ON</span>
              <h3 className="card-title" style={{ fontSize: '15px', marginBottom: '4px' }}>Push</h3>
              <p className="card-desc" style={{ fontSize: '11.5px', minHeight: '40px', marginBottom: '8px' }}>Browser and mobile notifications on the go.</p>
              <div className="reminder-time"><i className="fa-solid fa-link"></i> One-tap join links</div>
              <span className="card-best-for best-blue" style={{ marginBottom: '14px', fontSize: '10px' }}>Best for: On-the-move updates</span>
              <button className="btn-reminder-toggle btn-rem-enable" onClick={() => handleActionClick('reminders')}><i className="fa-solid fa-circle-check"></i> Selected</button>
            </div>
          </div>

          <button className="btn-explore-schedule" onClick={() => handleActionClick('reminders')}>
            <i className="fa-solid fa-bolt"></i> Explore Full Scheduling <i className="fa-solid fa-arrow-right" style={{ marginLeft: '4px' }}></i>
          </button>
        </section>

        {/* Slide 4: Career Coach */}
        <section className="slide" id="slide4">
          <div className="slide-header">
            <h2 className="slide-title">AI Interview Coach for <span>Every Career</span></h2>
            <p className="slide-subtitle">Practice real interview questions with an AI coach that gives tailored questions, instant feedback, and guided support - so you feel confident and prepared for your next interview.</p>
          </div>

          <div className="career-grid">
            {/* Col 1 */}
            <div className="career-column">
              <h3 className="career-col-title">Engineering &amp; Tech</h3>
            </div>

            {/* Col 2 */}
            <div className="career-column">
              <h3 className="career-col-title">All Careers &amp; Industries</h3>
            </div>

            {/* Col 3 */}
            <div className="career-column">
              <h3 className="career-col-title">Freelancers &amp; Contractors</h3>
            </div>

            {/* Col 4 */}
            <div className="career-column">
              <h3 className="career-col-title">Career Changers</h3>
            </div>
          </div>

          {/* Stats row */}
          <div className="stats-row">
            <div className="stat-item">
              <div className="stat-icon stat-icon-blue"><i className="fa-solid fa-users"></i></div>
              <div className="stat-details">
                <span className="stat-val">12,983 +</span>
                <span className="stat-lbl">Happy Users</span>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon stat-icon-green"><i className="fa-solid fa-heart"></i></div>
              <div className="stat-details">
                <span className="stat-val">98.5%</span>
                <span className="stat-lbl">Satisfaction Rate</span>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon stat-icon-orange"><i className="fa-solid fa-thumbs-up"></i></div>
              <div className="stat-details">
                <span className="stat-val">4.9/5</span>
                <span className="stat-lbl">Average Rating</span>
              </div>
            </div>
          </div>
        </section>

        {/* Slide 5: Community in Action */}
        <section className="slide" id="slide5">
          <div className="community-layout">
            {/* Left activity column */}
            <div className="activity-feed">
              <h3 className="card-title" style={{ fontSize: '20px', borderLeft: '3px solid #10b981', paddingLeft: '8px', marginBottom: '8px' }}>Community in Action</h3>
              
              <div className="activity-item">
                <div className="activity-user">
                  <div className="user-avatar avatar-v">V</div>
                  <p className="activity-text"><strong>Valentina M.</strong> communicated their value clearly <span>Moments ago</span></p>
                </div>
                <i className="fa-solid fa-sparkles activity-icon"></i>
              </div>

              <div className="activity-item">
                <div className="activity-user">
                  <div className="user-avatar avatar-h">H</div>
                  <p className="activity-text"><strong>Hugo H.</strong> polished their project explanations <span>Moments ago</span></p>
                </div>
                <i className="fa-solid fa-sparkles activity-icon"></i>
              </div>

              <div className="activity-item">
                <div className="activity-user">
                  <div className="user-avatar avatar-j">J</div>
                  <p className="activity-text"><strong>Jack N.</strong> gained peace of mind before interviews <span>Moments ago</span></p>
                </div>
                <i className="fa-solid fa-sparkles activity-icon"></i>
              </div>

              <div className="activity-item">
                <div className="activity-user">
                  <div className="user-avatar avatar-l">L</div>
                  <p className="activity-text"><strong>Lorenzo W.</strong> discovered areas for improvement <span>Moments ago</span></p>
                </div>
                <i className="fa-solid fa-sparkles activity-icon"></i>
              </div>

              <div className="activity-item">
                <div className="activity-user">
                  <div className="user-avatar avatar-f">F</div>
                  <p className="activity-text"><strong>Felipe J.</strong> communicated their value clearly <span>Moments ago</span></p>
                </div>
                <i className="fa-solid fa-sparkles activity-icon"></i>
              </div>
            </div>

            {/* Right simulator card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="sim-card">
                <div className="sim-country"><i className="fa-solid fa-heart" style={{ fontSize: '8px' }}></i> South Africa / Life-changing interview practice!</div>
                
                <div className="sim-profile">
                  <div className="sim-avatar">D</div>
                  <div>
                    <h4 className="sim-name">David C.</h4>
                    <p className="sim-role">DevOps Engineer</p>
                  </div>
                </div>
                
                <div className="stars" style={{ fontSize: '10px' }}>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                </div>
                
                <div className="sim-bubble">
                  <span style={{ fontSize: '9px', display: 'block', color: '#059669', textTransform: 'uppercase', fontWeight: 800, marginBottom: '2px' }}>AI Feedback</span>
                  Technical depth is amazing!
                </div>
                
                <div className="sim-score">
                  <span>Confidence Score</span>
                  <span className="sim-score-val">96%</span>
                </div>
                
                <div className="score-dots" style={{ alignSelf: 'flex-end' }}>
                  <span className="fill" style={{ background: '#2563eb' }}></span>
                  <span className="fill" style={{ background: '#2563eb' }}></span>
                  <span className="fill" style={{ background: '#2563eb' }}></span>
                  <span className="fill" style={{ background: '#2563eb' }}></span>
                  <span style={{ background: '#e2e8f0' }}></span>
                </div>

                <div className="carousel-indicators">
                  <span className="car-dot"></span>
                  <span className="car-dot"></span>
                  <span className="car-dot"></span>
                  <span className="car-dot"></span>
                  <span className="car-dot active"></span>
                </div>
              </div>
              
              <button className="btn-community" onClick={() => handleActionClick('community')}>Join the community</button>
            </div>
          </div>

          <div className="community-footer">
            <h4 className="footer-title">Trusted by Millions of Candidates Worldwide</h4>
            <p className="footer-desc">Loved by candidates from South Africa and 150+ countries</p>
          </div>
        </section>

        {/* Slide 6: Get Ready & FAQ */}
        <section className="slide" id="slide6">
          {/* Top banner */}
          <div className="cta-banner">
            <h2 className="banner-title">Get Interview-Ready With Your AI Copilot</h2>
            <p className="banner-subtitle">Candidates love it: quick, realistic AI interviews with instant feedback that boost your confidence for the real thing.</p>
            <button className="btn-banner-practice" onClick={() => handleActionClick('copilot')}>
              🚀 Practice My Interview Free
            </button>
            <div className="banner-pills">
              <span className="banner-pill"><i className="fa-solid fa-check"></i> No resume required</span>
              <span className="banner-pill"><i className="fa-solid fa-check"></i> No credit card</span>
              <span className="banner-pill"><i className="fa-solid fa-check"></i> Free sign-up</span>
            </div>
            <div className="banner-bullet">
              <span></span> Join thousands of candidates who landed their dream jobs
            </div>
          </div>

          {/* FAQ Section */}
          <div className="faq-section">
            <span className="badge-faq"><i className="fa-solid fa-circle-question"></i> Frequently Asked Questions</span>
            <h2 className="faq-title">Got Questions? We've Got Answers</h2>
            <p className="faq-subtitle">Everything you need to know about our AI interview practice tool</p>

            {/* Accordion */}
            <div className="faq-accordion">
              {[
                {
                  q: 'What is My Interview Copilot and how does it work?',
                  a: 'My Interview Copilot is an AI-powered desktop assistant designed to help you practice and excel in job interviews. It runs as an invisible overlay on your screen, transcribing your live practice session and generating real-time suggestions, notes, and professional answer feedback.'
                },
                {
                  q: 'Is this a real interview or just practice?',
                  a: 'It is a practice tool. It simulates realistic interview scenarios and coaches you to improve your structure, confidence, and content delivery before the actual high-stakes interview.'
                },
                {
                  q: 'What types of interviews can I practice?',
                  a: 'You can practice tech-focused engineering interviews, behavioral and leadership rounds, product management discussions, and general industry prep across various domains.'
                },
                {
                  q: 'Do I need to upload my resume to get started?',
                  a: 'No resume is required! You can simply enter the skills or roles you want to practice, and our AI will dynamically generate customized interview questions for you.'
                },
                {
                  q: 'Is it free to use?',
                  a: 'Yes, you can get started for free! No payment details or credit cards are required.'
                },
                {
                  q: 'How is my data and privacy protected?',
                  a: 'We take privacy very seriously. All practice data, transcripts, and audio recordings are securely encrypted and you have full control to delete them at any time.'
                }
              ].map((item, idx) => (
                <div key={idx} className={`faq-item ${activeFaq === idx ? 'active' : ''}`}>
                  <button className="faq-trigger" onClick={() => toggleFaq(idx)}>
                    {item.q}
                    <i className="fa-solid fa-chevron-down"></i>
                  </button>
                  <div className="faq-content">
                    <div className="faq-inner">
                      {item.a}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="faq-footer-meta">
              <span>Training-only AI interview practice. Not a real interview. No employer affiliation. No guarantees.</span>
              <span>© 2025 InterviewAI - Privacy - Terms</span>
            </div>
          </div>
        </section>

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
                        margin: '10px 0 14px 0',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: '#10b981',
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
              <div className="landing-drawer-brand">
                <div className="landing-pill-logo-icon logo-icon">
                  <i className="fa-solid fa-brain"></i>
                </div>
                <span>My Interview Copilot</span>
              </div>
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
