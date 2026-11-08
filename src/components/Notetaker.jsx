import React, { useState, useEffect, useRef, useCallback } from 'react';
import BrandLogo from './common/BrandLogo';
import AccountDropdown from './UserProfile/AccountDropdown';
import CreditUsagePromptModal from './common/CreditUsagePromptModal';
import {
  CREDIT_USAGE_CONFIG,
  getUserCredits,
  getDownloadStatus,
  recordDownloadAction,
  getNotetakerIntervalMinutes,
  getNotetakerCreditCost,
  recordNotetakerUsageAction
} from '../config/creditUsageConfig';
import { API_BASE, WS_BASE, websocketProtocols } from '../utils/api';
import { createHourlyUsageBilling } from '../utils/hourlyUsageBilling';
import { downloadPdfReport, renderTranscriptRow, renderQaCard } from '../utils/pdfReportTemplate';
import PdfCustomizerModal from './PdfCustomizerModal';
import './Notetaker.css';

const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;


const workletCode = `
class PCMForwarder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Int16Array(this.bufferSize);
    this.index = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input[0]) {
      const inputData = input[0];
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        this.buffer[this.index++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this.index >= this.bufferSize) {
          const sendBuffer = new Int16Array(this.buffer);
          this.port.postMessage(sendBuffer.buffer, [sendBuffer.buffer]);
          this.index = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("pcm-forwarder", PCMForwarder);
`;

const languageOptions = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ru', name: 'Russian' },
  { code: 'tr', name: 'Turkish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ar', name: 'Arabic' },
  { code: 'bn', name: 'Bengali' },
  { code: 'te', name: 'Telugu' },
  { code: 'ta', name: 'Tamil' },
  { code: 'mr', name: 'Marathi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'pa', name: 'Punjabi' },
];

const cleanNotesText = (text) => {
  if (!text || typeof text !== 'string') return text || '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/###\s*/g, '')
    .replace(/##\s*/g, '')
    .replace(/#\s*/g, '')
    .replace(/\*\*/g, '');
};

const isSystemStatusMessage = (msg) => {
  if (!msg || !msg.text) return false;
  if (msg.isSystem || msg.messageType === 'system') return true;
  const raw = String(msg.text).trim();
  const t = raw.toLowerCase();
  return (
    t.startsWith('started recording') ||
    t.startsWith('recording started') ||
    t.startsWith('recording stopped') ||
    t.startsWith('recording restarted') ||
    t.startsWith('hi! i am your ai interviewer') ||
    t === 'thinking...' ||
    (msg.sender === 'ai' && (
      raw.startsWith('रिकॉर्डिंग शुरू') ||
      raw.startsWith('रिकॉर्डिंग बंद') ||
      raw.startsWith('रिकॉर्डिंग फिर') ||
      t.includes('ai is generating a bilingual summary') ||
      t.includes('generating a bilingual summary') ||
      t.includes('no speech was detected')
    ))
  );
};

export default function Notetaker({ token, user, onLogout, onBackToLanding, onGoToPanel, onGoToVoiceAgent, onGoToUpload, onGoToDashboard, onGoToProfile, onGoToSubscription, onGoToUsage, onGoToReferral, showToast, darkMode, toggleDarkMode, windowType }) {
  const [activeTab, setActiveTab] = useState('record'); // 'record' or 'past'
  const [rightTab, setRightTab] = useState('live'); // 'live', 'notes', or 'feedback'
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('idle');

  // Credit Usage & Download Limits Modal State
  const [pdfCustomizerModal, setPdfCustomizerModal] = useState({
    isOpen: false,
    reportData: null,
    filename: 'report.pdf'
  });

  const [creditPromptModal, setCreditPromptModal] = useState({
    isOpen: false,
    type: 'download',
    title: '',
    message: '',
    fileDetails: null,
    pendingAction: null
  });
  const [recordingMode, setRecordingMode] = useState('meeting'); // 'personal' | 'meeting'
  const [showSetup, setShowSetup] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [showPastSessionsModal, setShowPastSessionsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const handleSwapLanguages = () => {
    if (isRecording) return;
    const oldSpoken = spokenLang;
    const oldTarget = targetLang;
    handleSpokenLangChange(oldTarget);
    handleTargetLangChange(oldSpoken);
  };

  const handleClearSession = () => {
    if (isRecording) {
      showToast('Please stop recording before clearing.');
      return;
    }
    setChatMessages([]);
    setLiveTranscript('');
    setGeneratedNotes('');
    setDisplayedNotesLang('');
    setGeneratedFeedback('');
    setTranslationHistory([]);
    setTimerSeconds(0);
    showToast('Session cleared.');
  };
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [interviewTitle, setInterviewTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { sender: 'ai', text: 'Hi! I am your AI Interviewer Notetaker. Start recording or type a question here to get real-time advice during your interview.' }
  ]);

  const [spokenLang, setSpokenLang] = useState('en');
  const [targetLang, setTargetLang] = useState('en');
  const [translationEngine, setTranslationEngine] = useState(() => localStorage.getItem('translationEngine') || 'google');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimMsg, setInterimMsg] = useState(null);
  const [generatedNotes, setGeneratedNotes] = useState('');
  const [generatedFeedback, setGeneratedFeedback] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState('');
  
  // Translation Speech and History states
  const [lastOriginalText, setLastOriginalText] = useState('');
  const [lastTranslatedText, setLastTranslatedText] = useState('');
  const [translationHistory, setTranslationHistory] = useState([]);
  
  // Export Modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSaveSessionModal, setShowSaveSessionModal] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [exportInclude, setExportInclude] = useState('both');
  const [exportFormat, setExportFormat] = useState('pdf');
  const [exportIncludeAiChat, setExportIncludeAiChat] = useState(true);
  const [displayedNotesLang, setDisplayedNotesLang] = useState('');
  const [pastSessions, setPastSessions] = useState([]);
  const [lineByLineMode, setLineByLineMode] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const isSendingChatLockRef = useRef(false);
  const saveConfirmLockRef = useRef(false);

  const timerRef = useRef(null);
  const chatContainerRef = useRef(null);
  const notesContainerRef = useRef(null);
  const moreMenuRef = useRef(null);
  const lineByLineModeRef = useRef(false);
  lineByLineModeRef.current = lineByLineMode;

  // Dragging Header Controls
  const handleMinimize = () => ipcRenderer?.send('window-minimize');
  const handleMaximize = () => ipcRenderer?.send('window-maximize');

  const audioContextRef = useRef(null);
  const streamsRef = useRef([]);
  const nodesRef = useRef(null);
  const activeUtteranceRef = useRef(null);
  const activeOnlineAudioRef = useRef(null);
  const accumulatedTranscriptRef = useRef('');
  const lastSpeakerRef = useRef(null);
  // Generation counter to guard against async start/stop/restart race conditions
  const notetakerGenRef = useRef(0);
  const isStartingRef = useRef(false);
  const hasActiveRecordingRef = useRef(false);
  const lastToggleTimeRef = useRef(0);
  const lastDeductedNotetakerIntervalRef = useRef(0);
  const hourlyBillingSessionIdRef = useRef(null);
  const isMountedRef = useRef(true);

  // Sync state values inside refs to be read in event listeners reliably
  const timerSecondsRef = useRef(timerSeconds);
  timerSecondsRef.current = timerSeconds;

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const spokenLangRef = useRef(spokenLang);
  spokenLangRef.current = spokenLang;

  const targetLangRef = useRef(targetLang);
  targetLangRef.current = targetLang;

  const recordingModeRef = useRef(recordingMode);
  recordingModeRef.current = recordingMode;

  const translationEngineRef = useRef(translationEngine);
  translationEngineRef.current = translationEngine;

  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;

  const translationHistoryRef = useRef(translationHistory);
  translationHistoryRef.current = translationHistory;

  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;

  const transReqSeqRef = useRef({});
  const recentInterviewerTextsRef = useRef([]);
  const speakerRegistryRef = useRef(new Map());

  const getEffectiveToken = () => {
    let t = token || tokenRef.current || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (!t) {
      try {
        const authData = JSON.parse(localStorage.getItem('interview_auth') || '{}');
        t = authData?.token || authData?.authToken;
      } catch (_) {}
    }
    return t || '';
  };

  const getLocalSessionsKey = useCallback(() => {
    return user?.email 
      ? `notetaker_saved_sessions_${user.email}` 
      : (user?.id ? `notetaker_saved_sessions_${user.id}` : 'notetaker_saved_sessions');
  }, [user]);

  const removeLocalSession = (id) => {
    if (!id) return;
    try {
      const storageKey = getLocalSessionsKey();
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      localStorage.setItem(
        storageKey,
        JSON.stringify(existing.filter((s) => s && s.id !== id))
      );
    } catch { /* best-effort */ }
  };

  // Identifies the same session across the local cache and the backend.
  // Ids cannot be compared: the cache assigns `local_<ts>` before the server
  // assigns `session_<ts>_<rand>`, so the two are disjoint by construction.
  // Title, duration and the save timestamp are written from the same object on
  // both sides, so they match exactly.
  const sessionSignature = (sess) => {
    if (!sess) return '';
    let payload = sess.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { /* best-effort */ }
    }
    if (!payload && typeof sess.payloadJson === 'string') {
      try { payload = JSON.parse(sess.payloadJson); } catch { /* best-effort */ }
    }
    payload = payload || {};
    return [
      sess.title || '',
      sess.durationSeconds ?? '',
      payload.date || sess.date || '',
      payload.time || sess.time || ''
    ].join('|');
  };

  const fetchPastSessions = async () => {
    const storageKey = getLocalSessionsKey();
    let localList = [];
    try {
      localList = JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (_) {}

    const isNotetakerSession = (sess) => {
      if (!sess) return false;
      let payload = sess.payload;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (_) {}
      }
      if (!payload && typeof sess.payloadJson === 'string') {
        try { payload = JSON.parse(sess.payloadJson); } catch (_) {}
      }
      payload = payload || {};
      
      // 1. Explicit Notetaker markers -> ALWAYS include first!
      if (payload.isNotetaker || payload.sessionType === 'notetaker' || sess.isNotetaker || sess.sessionType === 'notetaker') return true;
      if (payload.notes && payload.notes !== 'Session recorded.' && !payload.version) return true;
      if (sess.tech === 'Notetaker Session' || (typeof sess.tech === 'string' && sess.tech.toLowerCase().includes('notetaker'))) return true;
      if (typeof sess.title === 'string' && (sess.title.startsWith('Meeting Notes') || sess.title.startsWith('Notetaker') || sess.title.toLowerCase().includes('meeting note'))) return true;

      // 2. Explicit Copilot markers -> strictly exclude from Notetaker
      if (payload.questions && Array.isArray(payload.questions) && payload.questions.length > 0) return false;
      if (payload.questionsList && Array.isArray(payload.questionsList) && payload.questionsList.length > 0) return false;
      if (payload.version && !payload.isNotetaker && !payload.sessionType) return false;
      if (Array.isArray(payload.transcript) && payload.transcript.some(t => t.speaker === 'ai_a' || t.speaker === 'ai_b')) {
        return false;
      }
      
      return false;
    };

    // Filter and sanitize local storage list
    const filteredLocal = localList.filter(isNotetakerSession);
    if (filteredLocal.length !== localList.length) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(filteredLocal));
      } catch (_) {}
    }

    try {
      const effectiveToken = getEffectiveToken();
      if (effectiveToken) {
        const res = await fetch(`${API_BASE}/api/interview-panel-sessions`, {
          headers: { Authorization: `Bearer ${effectiveToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.sessions)) {
            const filteredBackend = data.sessions.filter(isNotetakerSession);
            const backendIds = new Set(filteredBackend.map(s => s.id || s._id));
            const backendSignatures = new Set(filteredBackend.map(sessionSignature));
            const uniqueLocal = filteredLocal.filter(
              (l) => !backendIds.has(l.id) && !backendSignatures.has(sessionSignature(l))
            );

            // Prune cache entries the backend already has. Without this,
            // duplicates already written to localStorage by earlier versions
            // would keep rendering on every visit.
            if (uniqueLocal.length !== filteredLocal.length) {
              try {
                localStorage.setItem(storageKey, JSON.stringify(uniqueLocal));
              } catch { /* best-effort */ }
            }

            if (!isMountedRef.current) return;
            setPastSessions([...filteredBackend, ...uniqueLocal]);
            return;
          }
        }
      }
    } catch (err) {
      console.error('Error fetching past sessions:', err);
    }
    if (!isMountedRef.current) return;
    setPastSessions(filteredLocal);
  };

  useEffect(() => {
    const tok = getEffectiveToken();
    if (ipcRenderer && tok) {
      ipcRenderer.send('interview-auth-sync', { token: tok, baseUrl: API_BASE });
    }
    fetchPastSessions();
  }, [token, user]);

  // Click outside to close the More dropdown menu
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleOutsideClick = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showMoreMenu]);

  const hourlyBillingRef = useRef(null);

  const startNotetakerBilling = () => {
    if (hourlyBillingRef.current) return;

    const billing = createHourlyUsageBilling({
      action: 'notetaker',
      endpoint: 'notetaker',
      getToken: () => getEffectiveToken(),
      onInsufficientCredits: (data) => {
        stopAudioCapture(false);
        setCreditPromptModal({
          isOpen: true,
          type: 'notetaker',
          title: 'Credits Exhausted',
          message:
            data?.error ||
            'Your credits have been exhausted and recording has been stopped. Please top up or upgrade your plan to continue.',
          fileDetails: { name: 'Notetaker Session', type: 'Audio Recording & Notes' }
        });
      }
    });

    hourlyBillingRef.current = billing;
    billing.start();
  };

  const pauseNotetakerBilling = () => {
    hourlyBillingRef.current?.pause();
  };

  const resumeNotetakerBilling = () => {
    hourlyBillingRef.current?.resume();
  };

  const stopNotetakerBilling = async () => {
    const billing = hourlyBillingRef.current;
    hourlyBillingRef.current = null;

    if (billing) {
      await billing.stop();
    }
  };

  const localCaptureInitiatedRef = useRef(false);
  const browserWsRef = useRef(null);

  const handleTranslationEngineChange = (val) => {
    setTranslationEngine(val);
    localStorage.setItem('translationEngine', val);
    if (val === 'sarvam') {
      const allowed = ['en', 'hi', 'bn', 'te', 'ta', 'mr', 'gu', 'kn', 'ml', 'pa'];
      if (!allowed.includes(spokenLangRef.current)) {
        setSpokenLang('en');
      }
      if (!allowed.includes(targetLangRef.current)) {
        setTargetLang('en');
      }
    }
  };

  const handleSpokenLangChange = (val) => {
    setSpokenLang(val);
  };

  const handleTargetLangChange = (val) => {
    setTargetLang(val);
  };

  const displayedLanguages = translationEngine === 'sarvam'
    ? languageOptions.filter(lang => ['en', 'hi', 'bn', 'te', 'ta', 'mr', 'gu', 'kn', 'ml', 'pa'].includes(lang.code))
    : languageOptions;

  // Timer effect when recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  // Scroll to bottom of chat when new message or interim text is added
  useEffect(() => {
    let scrollTimer;
    if (chatContainerRef.current) {
      scrollTimer = setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 60);
    }
    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [chatMessages, interimMsg]);

  // Auto-scroll notes panel to show latest content when notes are generated or updated
  useEffect(() => {
    let scrollTimer;
    if (notesContainerRef.current && generatedNotes) {
      scrollTimer = setTimeout(() => {
        if (notesContainerRef.current) {
          // Scroll to top when notes first load so user sees beginning of summary
          notesContainerRef.current.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [generatedNotes]);

  // Resume AudioContext if it gets suspended when returning to Notetaker view,
  // and stop audio capture when navigating away from notetaker view
  useEffect(() => {
    if (windowType === 'notetaker') {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().then(() => {
          console.log('[AudioContext] Resumed successfully on tab switch back to notetaker');
        }).catch(err => {
          console.error('[AudioContext] Failed to resume on tab switch back:', err);
        });
      }
    } else {
      if (isRecordingRef.current || isStartingRef.current) {
        notetakerGenRef.current++;
        stopSpeaking();
        stopAudioCapture(true);
      }
    }
  }, [windowType]);

  const formatTimer = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const getDefaultSessionTitle = () => {
    return `Meeting Notes - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const startRecordingWithLangs = (sp, tg) => {
    if (isRecordingRef.current || isStartingRef.current) return;
    const requiredCost = getNotetakerCreditCost();
    const curCredits = getUserCredits();
    if (curCredits < requiredCost) {
      setCreditPromptModal({
        isOpen: true,
        type: 'notetaker',
        title: 'Insufficient Credits',
        message: `You need at least ${requiredCost} credits to start a Notetaker session. Your current balance is ${curCredits}.`,
        fileDetails: { name: 'Notetaker Session', type: 'Audio Recording & Notes' }
      });
      return;
    }
    try { document.activeElement?.blur(); } catch (_) {}
    lastDeductedNotetakerIntervalRef.current = 0;
    isRecordingRef.current = true;
    hasActiveRecordingRef.current = true;
    setIsRecording(true);
    setRecordingStatus('recording');
    setInterviewTitle('');
    setTempTitle('');
    setTimerSeconds(0);
    setLiveTranscript('');
    setGeneratedNotes('');
    setDisplayedNotesLang('');
    setGeneratedFeedback('');
    accumulatedTranscriptRef.current = '';
    lastSpeakerRef.current = null;
    speakerRegistryRef.current.clear();
    setLastOriginalText('');
    setLastTranslatedText('');
    setTranslationHistory([]);
    setChatMessages([
      { id: `sys_start_${Date.now()}`, sender: 'ai', isSystem: true, text: `Started recording. I am transcribing in ${languageOptions.find(l => l.code === sp)?.name || 'English'}...` }
    ]);

    if (ipcRenderer) {
      ipcRenderer.send('interview-session-meta', { tech: 'default' });
    }

    startAudioCapture(sp, tg);
  };

  const saveSessionToBackend = async (titleToSave, notesContent, customDuration) => {
    const effectiveToken = getEffectiveToken();
    if (ipcRenderer && effectiveToken) {
      ipcRenderer.send('interview-auth-sync', { token: effectiveToken, baseUrl: API_BASE });
    }

    const durationSecs = customDuration !== undefined ? customDuration : (timerSecondsRef.current || timerSeconds);
    const durationDisplay = formatTimer(durationSecs);
    const tgName = languageOptions.find(l => l.code === targetLangRef.current)?.name || targetLangRef.current;
    const spName = languageOptions.find(l => l.code === spokenLangRef.current)?.name || spokenLangRef.current;

    const currentChat = (chatMessagesRef.current && chatMessagesRef.current.length > 0) ? chatMessagesRef.current : chatMessages;
    const sanitizedChat = (currentChat || []).map(m => {
      if (isSystemStatusMessage(m) || m.isSystem) {
        const { translation, ...rest } = m;
        return rest;
      }
      return m;
    });
    const currentTransHistory = (translationHistoryRef.current && translationHistoryRef.current.length > 0) ? translationHistoryRef.current : translationHistory;

    const sessionPayload = {
      tech: titleToSave || getDefaultSessionTitle(),
      title: titleToSave || getDefaultSessionTitle(),
      durationSeconds: durationSecs,
      durationDisplay: durationDisplay,
      questionCount: 0,
      rating: 0,
      payload: {
        sessionType: 'notetaker',
        isNotetaker: true,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        notes: notesContent || generatedNotes || undefined,
        targetLanguage: tgName || undefined,
        spokenLanguage: spName || undefined,
        transcript: sanitizedChat,
        translationHistory: currentTransHistory
      }
    };

    // Always cache locally first so a failed upload never loses the session.
    let localSessionId = null;
    try {
      localSessionId = `local_${Date.now()}`;
      const localSession = {
        id: localSessionId,
        title: sessionPayload.title,
        tech: sessionPayload.tech,
        durationSeconds: sessionPayload.durationSeconds,
        durationDisplay: sessionPayload.durationDisplay,
        date: sessionPayload.payload.date,
        time: sessionPayload.payload.time,
        payload: sessionPayload.payload
      };
      const storageKey = getLocalSessionsKey();
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      localStorage.setItem(storageKey, JSON.stringify([localSession, ...existing]));
    } catch (_) {}

    if (effectiveToken) {
      try {
        const res = await fetch(`${API_BASE}/api/interview-panel-sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${effectiveToken}` },
          body: JSON.stringify(sessionPayload)
        });
        const data = await res.json();
        if (res.ok || data?.ok || data?.session) {
          // The backend owns this session now, so drop the local fallback copy.
          // Leaving it behind is what made every saved session appear twice:
          // the local id is `local_<ts>` while the server assigns
          // `session_<ts>_<rand>`, so the id-based dedupe below could never
          // match them and both copies rendered.
          removeLocalSession(localSessionId);
          showToast('Session saved to Past Sessions!');
        }
      } catch (err) {
        console.error('[Notetaker] Error saving session to backend:', err);
      }
    } else {
      showToast('Session saved locally!');
    }

    await fetchPastSessions();
    try {
      window.dispatchEvent(new CustomEvent('kairos-sessions-updated'));
    } catch (_) {}
  };

  const handleStartStopRecording = () => {
    stopSpeaking();
    const now = Date.now();
    // Guard against rapid duplicate clicks within 250ms
    if (now - lastToggleTimeRef.current < 250) return;
    lastToggleTimeRef.current = now;

    if (hasActiveRecordingRef.current || isStartingRef.current) {
      setTempTitle(getDefaultSessionTitle());
      setShowSaveSessionModal(true);
    } else {
      if (!spokenLang || !targetLang) {
        showToast('Please select both Spoken Language and Target Notes Language first.');
        return;
      }
      // Check initial credits for Notetaker session
      const requiredCost = getNotetakerCreditCost();
      const curCredits = getUserCredits();
      if (curCredits < requiredCost) {
        setCreditPromptModal({
          isOpen: true,
          type: 'notetaker',
          title: 'Insufficient Credits',
          message: `You need at least ${requiredCost} credits to start a Notetaker session. Your current balance is ${curCredits}.`,
          fileDetails: { name: 'Notetaker Session', type: 'Audio Recording & Notes' }
        });
        return;
      }
      try { document.activeElement?.blur(); } catch (_) {}
      lastDeductedNotetakerIntervalRef.current = 0;
      isRecordingRef.current = true;
      hasActiveRecordingRef.current = true;
      setIsRecording(true);
      setRecordingStatus('recording');
      setInterviewTitle('');
      setTempTitle('');
      setActiveQuestion('');
      setTimerSeconds(0);
      setLiveTranscript('');
      setGeneratedNotes('');
      setDisplayedNotesLang('');
      setGeneratedFeedback('');
      accumulatedTranscriptRef.current = '';
      lastSpeakerRef.current = null;
      speakerRegistryRef.current.clear();
      setLastOriginalText('');
      setLastTranslatedText('');
      setTranslationHistory([]);
      setChatMessages([
        { id: `sys_start_${Date.now()}`, sender: 'ai', isSystem: true, text: `Started recording. I am transcribing in ${languageOptions.find(l => l.code === spokenLang)?.name || 'English'}...` }
      ]);
      
      if (ipcRenderer) {
        ipcRenderer.send('interview-session-meta', { tech: 'default' });
      }
      startAudioCapture(spokenLang, targetLang);
    }
  };

  const handlePauseResume = async () => {
    if (
      !hasActiveRecordingRef.current ||
      isStartingRef.current ||
      !audioContextRef.current
    ) {
      return;
    }

    if (audioContextRef.current.state === 'running') {
      await audioContextRef.current.suspend();
      await pauseNotetakerBilling();
      isRecordingRef.current = false;
      setIsRecording(false);
      setRecordingStatus('paused');
    } else if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
      await resumeNotetakerBilling();
      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordingStatus('recording');
    }
  };

  const handleRestartRecording = async () => {
    if (!hasActiveRecordingRef.current || isStartingRef.current) return;
    const requiredCost = getNotetakerCreditCost();
    const curCredits = getUserCredits();
    if (curCredits < requiredCost) {
      setCreditPromptModal({
        isOpen: true,
        type: 'notetaker',
        title: 'Insufficient Credits',
        message: `You need at least ${requiredCost} credits to restart a Notetaker session. Your current balance is ${curCredits}.`,
        fileDetails: { name: 'Notetaker Session', type: 'Audio Recording & Notes' }
      });
      return;
    }
    await stopAudioCapture(true);

    hasActiveRecordingRef.current = true;
    hourlyBillingSessionIdRef.current =
      globalThis.crypto?.randomUUID?.() ||
      `notetaker-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    isRecordingRef.current = true;
    setIsRecording(true);
    setRecordingStatus('recording');
    setTimerSeconds(0);
    setLiveTranscript('');
    setGeneratedNotes('');
    setDisplayedNotesLang('');
    setGeneratedFeedback('');
    accumulatedTranscriptRef.current = '';
    lastSpeakerRef.current = null;
    speakerRegistryRef.current.clear();
    setLastOriginalText('');
    setLastTranslatedText('');
    setTranslationHistory([]);
    setChatMessages([
      {
        id: `sys_restart_${Date.now()}`,
        sender: 'ai',
        isSystem: true,
        text: `Recording restarted. I am transcribing in ${languageOptions.find(l => l.code === spokenLangRef.current)?.name || 'English'}...`
      }
    ]);

    await startAudioCapture(
      spokenLangRef.current,
      targetLangRef.current
    );
  };

  const handleSaveSessionConfirm = (discard = false) => {
    if (saveConfirmLockRef.current) return;
    saveConfirmLockRef.current = true;
    setTimeout(() => { saveConfirmLockRef.current = false; }, 1500);
    setShowSaveSessionModal(false);
    isRecordingRef.current = false;
    isStartingRef.current = false;
    if (discard) {
      hasActiveRecordingRef.current = false;
      setIsRecording(false);
      setRecordingStatus('idle');
      setTimerSeconds(0);
      stopAudioCapture(true);
      setActiveQuestion('');
      setInterviewTitle('');
      setTempTitle('');
      showToast('Session discarded.');
      return;
    }

    const titleToSave = tempTitle.trim() || getDefaultSessionTitle();

    if (ipcRenderer) {
      ipcRenderer.send('interview-session-meta', { tech: titleToSave });
    }

    const currentDuration = timerSecondsRef.current || timerSeconds;
    hasActiveRecordingRef.current = false;
    setRecordingStatus('processing');
    setTimerSeconds(0);
    setIsRecording(false);
    stopAudioCapture(false, titleToSave, currentDuration);
    setActiveQuestion('');
    setInterviewTitle('');
    setTempTitle('');
  };

  const [currentlyPlayingMsgId, setCurrentlyPlayingMsgId] = useState(null);

  const stopSpeaking = () => {
    if (activeOnlineAudioRef.current) {
      try {
        activeOnlineAudioRef.current.pause();
        activeOnlineAudioRef.current.currentTime = 0;
      } catch (_) {}
      activeOnlineAudioRef.current = null;
    }
    setCurrentlyPlayingMsgId(null);
  };

  const speakText = (text, langCode, msgId = null) => {
    if (!text) return;
    try {
      console.log(`[tts] Speaking text in: ${langCode}`);
      
      // Stop any currently playing online fallback audio
      if (activeOnlineAudioRef.current) {
        try {
          activeOnlineAudioRef.current.pause();
          activeOnlineAudioRef.current.currentTime = 0;
        } catch (_) {}
        activeOnlineAudioRef.current = null;
      }

      if (msgId) {
        setCurrentlyPlayingMsgId(msgId);
      }

      const onPlaybackEnded = () => {
        if (msgId) {
          setCurrentlyPlayingMsgId(curr => curr === msgId ? null : curr);
        }
        if (activeOnlineAudioRef.current === audio) {
          activeOnlineAudioRef.current = null;
        }
      };

      let audio;

      const playBase64 = (base64Audio) => {
        if (base64Audio) {
          audio = new Audio("data:audio/mpeg;base64," + base64Audio);
          audio.volume = 1.0;
          activeOnlineAudioRef.current = audio;
          audio.onended = onPlaybackEnded;
          audio.onerror = onPlaybackEnded;
          audio.play().catch(e => {
            console.error('[tts] Play error:', e);
            showToast(`Audio playback failed: ${e.message}`);
            onPlaybackEnded();
          });
        } else {
          onPlaybackEnded();
        }
      };

      if (ipcRenderer) {
        ipcRenderer.invoke('get-translation-tts', { text, langCode }).then(playBase64).catch(err => {
          console.error('[tts] ipc get-translation-tts failed:', err);
          showToast(`TTS Request failed: ${err.message || err}`);
          onPlaybackEnded();
        });
      } else {
        const token = localStorage.getItem('auth_token') || '';
        fetch(`${API_BASE}/api/get-translation-tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ text, langCode })
        }).then(r => r.json()).then(data => {
          playBase64(data.base64Audio);
        }).catch(err => {
          console.error('[browser tts] failed:', err);
          onPlaybackEnded();
        });
      }
    } catch (err) {
      console.error('[tts] speakText failed:', err);
      if (msgId) {
        setCurrentlyPlayingMsgId(curr => curr === msgId ? null : curr);
      }
    }
  };

  // Audio helpers
  const float32ToInt16 = (float32) => {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16.buffer;
  };

  const startAudioCapture = async (spLang, tgLang) => {
    isStartingRef.current = true;
    // Assign a unique generation ID to this capture attempt
    const currentGen = ++notetakerGenRef.current;
    speakerRegistryRef.current.clear();
    lastSpeakerRef.current = null;
    accumulatedTranscriptRef.current = '';

    // Clean up any residual audio resources from a previous session
    if (nodesRef.current) {
      const { system, mic, processor, processor2 } = nodesRef.current;
      [processor, processor2, system, mic].forEach(n => {
        if (n) { try { n.disconnect(); } catch (_) {} }
      });
      nodesRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') audioContextRef.current.close().catch(() => {});
      } catch (_) {}
      audioContextRef.current = null;
    }
    if (streamsRef.current) {
      streamsRef.current.forEach(stream => {
        if (stream) stream.getTracks().forEach(t => t.stop());
      });
      streamsRef.current = [];
    }
    if (browserWsRef.current) {
      const { mic, interviewer } = browserWsRef.current;
      if (mic && (mic.readyState === WebSocket.OPEN || mic.readyState === WebSocket.CONNECTING)) {
        mic.onopen = null; mic.onmessage = null; mic.onerror = null; mic.onclose = null;
        mic.close();
      }
      if (interviewer && (interviewer.readyState === WebSocket.OPEN || interviewer.readyState === WebSocket.CONNECTING)) {
        interviewer.onopen = null; interviewer.onmessage = null; interviewer.onerror = null; interviewer.onclose = null;
        interviewer.close();
      }
      browserWsRef.current = null;
    }

    try {
      localCaptureInitiatedRef.current = true;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext is not supported by your browser/client.');
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported or not allowed in this environment.');
      }

      // If Meeting mode is selected, request tab/system audio first
      let displayStream = null;
      if (recordingModeRef.current === 'meeting') {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            throw new Error('Screen or tab audio capture is not supported in this browser.');
          }
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
          });
        } catch (err) {
          console.warn('[Notetaker] Display media request cancelled or failed:', err);
          if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
            showToast('Meeting audio capture cancelled.');
          } else {
            showToast('Meeting audio capture error: ' + (err.message || 'Permission denied'));
          }
          isStartingRef.current = false;
          localCaptureInitiatedRef.current = false;
          isRecordingRef.current = false;
          hasActiveRecordingRef.current = false;
          setIsRecording(false);
          setRecordingStatus('idle');
          setTimerSeconds(0);
          // Remove the misleading "Started recording..." system message that was added before capture began
          setChatMessages(prev => {
            const last = prev.length > 0 ? prev[prev.length - 1] : null;
            if (last && last.isSystem && typeof last.text === 'string' && last.text.startsWith('Started recording')) {
              return prev.slice(0, -1);
            }
            return prev;
          });
          return;
        }

        const audioTracks = displayStream.getAudioTracks();
        displayStream.getVideoTracks().forEach(t => t.stop());

        if (!audioTracks || audioTracks.length === 0) {
          displayStream.getTracks().forEach(t => t.stop());
          showToast('No tab/system audio shared! Please enable "Share tab audio" when selecting.');
          isStartingRef.current = false;
          localCaptureInitiatedRef.current = false;
          isRecordingRef.current = false;
          hasActiveRecordingRef.current = false;
          setIsRecording(false);
          setRecordingStatus('idle');
          setTimerSeconds(0);
          // Remove the misleading "Started recording..." system message
          setChatMessages(prev => {
            const last = prev.length > 0 ? prev[prev.length - 1] : null;
            if (last && last.isSystem && typeof last.text === 'string' && last.text.startsWith('Started recording')) {
              return prev.slice(0, -1);
            }
            return prev;
          });
          return;
        }
      }

      // Helper to get mic stream
      const getMicrophoneStream = async () => {
        const constraints = {
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        };
        try {
          return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {}
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: {} });
        } catch (e2) {}
        throw new Error('No microphone found.');
      };

      // Get mic stream
      let micStream = null;
      try {
        micStream = await getMicrophoneStream();
      } catch (err) {
        if (displayStream) displayStream.getTracks().forEach(t => t.stop());
        throw err;
      }

      // Cancellation guard: ensure generation is still valid before continuing
      if (notetakerGenRef.current !== currentGen) {
        micStream.getTracks().forEach(t => t.stop());
        if (displayStream) displayStream.getTracks().forEach(t => t.stop());
        return;
      }
      streamsRef.current = displayStream ? [micStream, displayStream] : [micStream];

      const micTrack = micStream.getAudioTracks()[0];
      if (!micTrack) {
        throw new Error('Microphone track missing.');
      }

      micTrack.onmute = () => console.warn('[notetaker-audio] Microphone track MUTED!');
      micTrack.onunmute = () => console.log('[notetaker-audio] Microphone track UNMUTED!');
      micTrack.onended = () => console.warn('[notetaker-audio] Microphone track ENDED!');

      // Instantiate AudioContext
      const audioCtx = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
        // Cancellation guard: ensure generation is still valid after resume
        if (notetakerGenRef.current !== currentGen) {
          if (audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
          return;
        }
      }
      const rate = audioCtx.sampleRate;

      const BUFFER_SIZE = 2048;
      const micSource = audioCtx.createMediaStreamSource(micStream);
      let displaySource = null;
      if (displayStream) {
        displaySource = audioCtx.createMediaStreamSource(displayStream);
      }
      
      let processor2 = null;
      let useWorklet = false;

      if (audioCtx.audioWorklet) {
        try {
          const blob = new Blob([workletCode], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          try {
            await audioCtx.audioWorklet.addModule(url);
          } finally {
            URL.revokeObjectURL(url);
          }
          // Cancellation guard: ensure generation did not change while loading worklet module
          if (notetakerGenRef.current !== currentGen) {
            return;
          }
          useWorklet = true;
        } catch (e) {
          console.warn('[Notetaker] AudioWorklet load failed, using ScriptProcessor fallback:', e);
        }
      }

      if (notetakerGenRef.current !== currentGen) return;

      if (useWorklet) {
        processor2 = new AudioWorkletNode(audioCtx, "pcm-forwarder");
        processor2.port.onmessage = (e) => {
          if (notetakerGenRef.current !== currentGen) return;
          const int16Buffer = e.data;
          if (ipcRenderer) {
            ipcRenderer.send('audio-chunk-candidate', new Uint8Array(int16Buffer));
          }
        };
      } else {
        processor2 = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
        processor2.onaudioprocess = (e) => {
          try {
            if (notetakerGenRef.current !== currentGen) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const int16Buffer = float32ToInt16(inputData);
            if (ipcRenderer) {
              ipcRenderer.send('audio-chunk-candidate', new Uint8Array(int16Buffer));
            }
          } catch (err) {
            console.error('[onaudioprocess candidate] processing failed:', err);
          }
        };
      }

      const gain = audioCtx.createGain();
      gain.gain.value = 0;

      // ── 1. Mic Processor (Candidate / Speaker 1) ──
      micSource.connect(processor2);
      processor2.connect(gain);

      // ── 2. Tab/Meeting Audio Processor (Interviewer / Speaker 2) ──
      let processor = null;
      if (displaySource) {
        if (useWorklet) {
          processor = new AudioWorkletNode(audioCtx, "pcm-forwarder");
          processor.port.onmessage = (e) => {
            if (notetakerGenRef.current !== currentGen) return;
            const int16Buffer = e.data;
            if (ipcRenderer) {
              ipcRenderer.send('audio-chunk-interviewer', new Uint8Array(int16Buffer));
            }
          };
        } else {
          processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
          processor.onaudioprocess = (e) => {
            try {
              if (notetakerGenRef.current !== currentGen) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const int16Buffer = float32ToInt16(inputData);
              if (ipcRenderer) {
                ipcRenderer.send('audio-chunk-interviewer', new Uint8Array(int16Buffer));
              }
            } catch (err) {
              console.error('[onaudioprocess interviewer] processing failed:', err);
            }
          };
        }
        displaySource.connect(processor);
        processor.connect(gain);
      }

      gain.connect(audioCtx.destination);
      nodesRef.current = { mic: micSource, system: displaySource, processor, processor2 };

      const spName = languageOptions.find(l => l.code === spLang)?.name || spLang;
      const tgName = languageOptions.find(l => l.code === tgLang)?.name || tgLang;
      const selectedEngine = localStorage.getItem('speechEngine') || 'deepgram';
      if (ipcRenderer) {
        ipcRenderer.send('set-candidate-mic-active', true);
        ipcRenderer.send('capture-started', rate, 'notetaker', spLang, tgLang, spName, tgName, selectedEngine);
      } else {
        // ── Browser-mode live transcription via WebSocket proxy ──
        const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '';
        const openLiveWs = (source) => {
          const langCode = spLang || spokenLangRef.current || 'en';
          const isDiarize = recordingModeRef.current === 'meeting' || lineByLineModeRef.current;
          const ws = new window.WebSocket(`${WS_BASE}/api/transcribe/live?source=${source}&language=${encodeURIComponent(langCode)}${isDiarize ? '&diarize=true&max_speakers=6' : ''}`, websocketProtocols(authToken));
          ws.binaryType = 'arraybuffer';

          ws.onopen = () => {
            // Cancellation guard: ensure socket belongs to the currently active capture generation
            if (notetakerGenRef.current !== currentGen) {
              try { ws.close(); } catch (_) {}
              return;
            }
            console.log(`[browser-notetaker] WebSocket open. source=${source} diarize=true`);
          };

          ws.onmessage = (evt) => {
            // Cancellation guard: ignore transcripts from previous/invalidated sessions
            if (notetakerGenRef.current !== currentGen || !isRecordingRef.current) return;
            try {
              const msg = JSON.parse(evt.data);
              if (msg.type === 'transcript' && msg.text && isRecordingRef.current) {
                const isFinal = msg.isFinal !== false;
                const cleanText = msg.text.trim().replace(/\b(?:South\s+Africa|Safrika|Soft\s+Africa|Southafrica)\b/gi, 'Sathwika');
                if (!cleanText) return;

                processTranscriptData({
                  source: msg.source || source,
                  text: cleanText,
                  isFinal,
                  speaker: msg.speaker !== undefined ? msg.speaker : (msg.source || source)
                });
              }
            } catch (_) {}
          };

          ws.onerror = (e) => {
            if (notetakerGenRef.current !== currentGen) return;
            console.error('[browser-notetaker] WebSocket error:', e);
          };
          ws.onclose = () => {
            if (notetakerGenRef.current !== currentGen) return;
            console.log(`[browser-notetaker] WebSocket closed. source=${source}`);
          };
          return ws;
        };

        const micWs = openLiveWs('candidate');
        let intervWs = null;

        if (processor2) {
          if (processor2 instanceof AudioWorkletNode) {
            processor2.port.onmessage = (e) => {
              if (notetakerGenRef.current !== currentGen) return;
              if (micWs.readyState === WebSocket.OPEN) micWs.send(e.data);
            };
          } else if (processor2.onaudioprocess !== undefined) {
            processor2.onaudioprocess = (e) => {
              try {
                if (notetakerGenRef.current !== currentGen) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const int16Buffer = float32ToInt16(inputData);
                if (micWs.readyState === WebSocket.OPEN) micWs.send(int16Buffer.buffer);
              } catch (err) {}
            };
          }
        }

        if (displaySource && processor) {
          intervWs = openLiveWs('interviewer');
          if (processor instanceof AudioWorkletNode) {
            processor.port.onmessage = (e) => {
              if (notetakerGenRef.current !== currentGen) return;
              if (intervWs.readyState === WebSocket.OPEN) intervWs.send(e.data);
            };
          } else if (processor.onaudioprocess !== undefined) {
            processor.onaudioprocess = (e) => {
              try {
                if (notetakerGenRef.current !== currentGen) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const int16Buffer = float32ToInt16(inputData);
                if (intervWs.readyState === WebSocket.OPEN) intervWs.send(int16Buffer.buffer);
              } catch (err) {}
            };
          }
        }

        browserWsRef.current = { mic: micWs, interviewer: intervWs };
        }

        startNotetakerBilling();
        isStartingRef.current = false;
    } catch (err) {
      if (notetakerGenRef.current !== currentGen) return;
      console.error('[notetaker] microphone/audio capture failed:', err);
      showToast('Capture error: ' + err.message);
      isStartingRef.current = false;
      localCaptureInitiatedRef.current = false;
      isRecordingRef.current = false;
      hasActiveRecordingRef.current = false;
      setRecordingStatus('idle');
      setIsRecording(false);
      
      if (streamsRef.current) {
        streamsRef.current.forEach(stream => {
          if (stream) {
            stream.getTracks().forEach(t => t.stop());
          }
        });
        streamsRef.current = [];
      }
    }
  };

  const stopAudioCapture = async (discard = false, titleToSave = '', customDuration = 0) => {
    await stopNotetakerBilling();
    
    // Invalidate the recording generation so all active audio buffers, Worklets, and WS packets are ignored
    const stopGen = ++notetakerGenRef.current;
    isStartingRef.current = false;
    isRecordingRef.current = false;
    setIsRecording(false);
    localCaptureInitiatedRef.current = false;
    if (nodesRef.current) {
      const { system, mic, processor, processor2 } = nodesRef.current;
      if (processor) {
        try { processor.disconnect(); } catch (_) {}
        processor.onaudioprocess = null;
      }
      if (processor2) {
        try { processor2.disconnect(); } catch (_) {}
        processor2.onaudioprocess = null;
      }
      if (system) {
        try { system.disconnect(); } catch (_) {}
      }
      if (mic) {
        try { mic.disconnect(); } catch (_) {}
      }
      nodesRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (streamsRef.current) {
      streamsRef.current.forEach(stream => {
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }
      });
      streamsRef.current = [];
    }

    setInterimMsg(null);
    if (browserWsRef.current) {
      const { mic, interviewer } = browserWsRef.current;
      if (mic && mic.readyState === WebSocket.OPEN) mic.close();
      if (interviewer && interviewer.readyState === WebSocket.OPEN) interviewer.close();
      browserWsRef.current = null;
    }

    if (ipcRenderer) {
      ipcRenderer.send('set-candidate-mic-active', false);
      ipcRenderer.send('capture-stopped', { discard });
    }

    if (discard) {
      hasActiveRecordingRef.current = false;
      setRecordingStatus('idle');
      setGeneratedNotes('');
      setDisplayedNotesLang('');
      return;
    }

    const finalTranscript = accumulatedTranscriptRef.current;
    const sessionTitle = titleToSave || interviewTitle.trim() || 'Notetaker Session';
    const durationToSave = customDuration || timerSecondsRef.current || timerSeconds;

    if (!finalTranscript.trim()) {
      if (notetakerGenRef.current !== stopGen) return;
      const noSpeechNote = 'No speech was detected during the recording session, so notes could not be generated.';
      setChatMessages(prev => [
        ...prev,
        { id: `sys_stop_${Date.now()}`, sender: 'ai', isSystem: true, text: 'Recording stopped. No speech was detected, so notes could not be generated.' }
      ]);
      setGeneratedNotes(noSpeechNote);
      setRightTab('notes');
      await saveSessionToBackend(sessionTitle, noSpeechNote, durationToSave);
      if (notetakerGenRef.current === stopGen) setRecordingStatus('idle');
      return;
    }

    console.log('[notetaker-renderer] stopAudioCapture: finalTranscript length:', finalTranscript.length);
    setRightTab('notes');
    setIsGenerating(true);
    setChatMessages(prev => [
      ...prev,
      { id: `sys_stop_${Date.now()}`, sender: 'ai', isSystem: true, text: `Recording stopped. AI is generating a bilingual summary in ${languageOptions.find(l => l.code === spokenLangRef.current)?.name || 'the spoken language'} and ${languageOptions.find(l => l.code === targetLangRef.current)?.name || 'the target language'}...` }
    ]);

    let notesResult = '';
    try {
      const spName = languageOptions.find(l => l.code === spokenLangRef.current)?.name || spokenLangRef.current;
      const tgName = languageOptions.find(l => l.code === targetLangRef.current)?.name || targetLangRef.current;

      const effectiveToken = getEffectiveToken();
      if (ipcRenderer) {
        const notesRes = await ipcRenderer.invoke('generate-notes', {
          transcript: finalTranscript,
          spokenLanguage: spName,
          targetLanguage: tgName
        });
        if (notesRes && notesRes.notes) {
          notesResult = notesRes.notes;
        }
      } else {
        const res = await fetch(`${API_BASE}/api/notetaker/generate-notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveToken}`
          },
          body: JSON.stringify({
            transcript: finalTranscript,
            spokenLanguage: spName,
            targetLanguage: tgName
          })
        });
        const notesRes = await res.json();
        if (notesRes && notesRes.notes) {
          notesResult = notesRes.notes;
        }
      }
      // Cancellation guard: only update notes state if a new recording session hasn't superseded this one
      if (notetakerGenRef.current === stopGen && notesResult) {
        const cleanedNotes = cleanNotesText(notesResult);
        setGeneratedNotes(cleanedNotes);
        setDisplayedNotesLang(spName === tgName ? tgName : `${spName} + ${tgName}`);
      }
    } catch (err) {
      console.error('Error generating notes:', err);
    } finally {
      if (notetakerGenRef.current === stopGen) {
        setIsGenerating(false);
      }
    }

    // Save exactly once, whether or not note generation succeeded.
    if (notetakerGenRef.current === stopGen) {
      await saveSessionToBackend(
        sessionTitle,
        cleanNotesText(notesResult || generatedNotes || 'Session recorded.'),
        durationToSave
      );
      if (notetakerGenRef.current === stopGen) setRecordingStatus('idle');
    }
  };

  const MAX_NOTE_TAKER_SPEAKERS = 6;

  const SPEAKER_COLORS = {
    'speaker 1': '#10b981', // Emerald Green (You / Primary)
    'you': '#10b981',
    'speaker 2': '#06b6d4', // Cyan
    'interviewer': '#06b6d4',
    'speaker 3': '#a78bfa', // Purple / Violet
    'speaker 4': '#f59e0b', // Amber / Gold
    'speaker 5': '#f43f5e', // Rose / Coral
    'speaker 6': '#3b82f6', // Royal Blue
  };

  const getSpeakerColor = (speakerName) => {
    if (!speakerName) return '#10b981';
    const lower = String(speakerName).toLowerCase();
    for (const [key, color] of Object.entries(SPEAKER_COLORS)) {
      if (lower.includes(key)) return color;
    }
    return '#88aaff';
  };

  const getDynamicSpeakerLabel = (source, rawSpeaker) => {
    const src = source === 'interviewer' ? 'interviewer' : 'candidate';
    let sp = '0';
    if (rawSpeaker !== undefined && rawSpeaker !== null) {
      const s = String(rawSpeaker).trim();
      if (s !== '') sp = s;
    }

    const speakerKey = `${src}_${sp}`;

    if (speakerRegistryRef.current.has(speakerKey)) {
      return { speakerKey, speakerLabel: speakerRegistryRef.current.get(speakerKey) };
    }

    let speakerLabel = '';
    const isGeneric = /^(speaker_?\d+|\d+|candidate|interviewer|user)$/i.test(sp);

    if (!isGeneric && sp.length > 1) {
      // Explicit custom or named speaker
      speakerLabel = sp;
    } else if (recordingModeRef.current === 'personal' && !lineByLineModeRef.current) {
      // Personal mode: mic voice is "You", system/interviewer voice is "Interviewer", "Interviewer 2", etc. (up to 6)
      if (src === 'candidate') {
        const candidateKeys = [...speakerRegistryRef.current.keys()].filter(k => k.startsWith('candidate_'));
        speakerLabel = candidateKeys.length === 0 ? 'You' : `Speaker ${Math.min(candidateKeys.length + 1, MAX_NOTE_TAKER_SPEAKERS)}`;
      } else {
        const interviewerCount = [...speakerRegistryRef.current.values()].filter(
          v => v === 'Interviewer' || (typeof v === 'string' && v.startsWith('Interviewer'))
        ).length;
        speakerLabel = interviewerCount === 0 ? 'Interviewer' : `Interviewer ${Math.min(interviewerCount + 1, MAX_NOTE_TAKER_SPEAKERS)}`;
      }
    } else {
      // Meeting mode & Line-by-Line mode: dynamic sequential numbering supporting up to 6 speakers
      if (src === 'candidate') {
        const candidateKeys = [...speakerRegistryRef.current.keys()].filter(k => k.startsWith('candidate_'));
        speakerLabel = candidateKeys.length === 0 ? 'Speaker 1 (You)' : `Speaker ${Math.min(candidateKeys.length + 1, MAX_NOTE_TAKER_SPEAKERS)}`;
      } else {
        const remoteCount = [...speakerRegistryRef.current.keys()].filter(k => k.startsWith('interviewer_')).length;
        const speakerNum = Math.min(remoteCount + 2, MAX_NOTE_TAKER_SPEAKERS);
        speakerLabel = `Speaker ${speakerNum}`;
      }
    }

    speakerRegistryRef.current.set(speakerKey, speakerLabel);
    return { speakerKey, speakerLabel };
  };

  const processTranscriptData = ({ source, text, isFinal, speaker, merge, isQuestion }) => {
    if (!isRecordingRef.current) return;
    const cleanText = String(text || '').trim();
    if (!cleanText) return;

    // Acoustic Echo Filter: If candidate mic captures what interviewer spoke < 3.5s ago, ignore it
    if (source === 'interviewer') {
      if (!recentInterviewerTextsRef.current) recentInterviewerTextsRef.current = [];
      recentInterviewerTextsRef.current.push({ text: cleanText.toLowerCase(), time: Date.now() });
      if (recentInterviewerTextsRef.current.length > 10) {
        recentInterviewerTextsRef.current = recentInterviewerTextsRef.current.slice(-10);
      }
    } else if (source === 'candidate' && recordingModeRef.current === 'meeting') {
      const now = Date.now();
      const lower = cleanText.toLowerCase();
      const isEcho = (recentInterviewerTextsRef.current || []).some(
        item => (now - item.time < 3500) && (item.text === lower || item.text.includes(lower) || lower.includes(item.text))
      );
      if (isEcho) {
        console.log('[browser-notetaker] Suppressed acoustic echo from mic:', cleanText);
        return;
      }
    }

    // Dynamically resolve unique speakerKey and user-facing speakerLabel
    const { speakerKey, speakerLabel } = getDynamicSpeakerLabel(source, speaker);

    if (isFinal) {
      setInterimMsg(null);
      setLiveTranscript(prev => {
        const sep = prev ? ' ' : '';
        return prev + sep + cleanText;
      });

      if (accumulatedTranscriptRef.current) {
        if (lastSpeakerRef.current === speakerKey) {
          accumulatedTranscriptRef.current += ' ' + cleanText;
        } else {
          accumulatedTranscriptRef.current += `\n${speakerLabel}: ${cleanText}`;
          lastSpeakerRef.current = speakerKey;
        }
      } else {
        accumulatedTranscriptRef.current = `${speakerLabel}: ${cleanText}`;
        lastSpeakerRef.current = speakerKey;
      }
      
      const isTranslationActive = spokenLangRef.current && targetLangRef.current && spokenLangRef.current !== targetLangRef.current;
      const fromLangName = languageOptions.find(l => l.code === spokenLangRef.current)?.name || spokenLangRef.current;
      const toLangName = languageOptions.find(l => l.code === targetLangRef.current)?.name || targetLangRef.current;
      let isQ = !!isQuestion;

      setChatMessages(curr => {
        let shouldMerge = false;
        let targetMsg = null;

        const lastMsg = curr.length > 0 ? curr[curr.length - 1] : null;

        if (lineByLineModeRef.current) {
          // Line-by-Line Mode: Only merge if last message is from the EXACT SAME speaker and not ended with punctuation
          if (lastMsg && lastMsg.sender === 'user' && lastMsg.messageType !== 'chat' && lastMsg.speakerId === speakerKey) {
            const lastTextTrimmed = (lastMsg.text || '').trim();
            const hasTerminalPunct = /[.!?]$/.test(lastTextTrimmed);
            if (!hasTerminalPunct || merge) {
              shouldMerge = true;
              targetMsg = lastMsg;
            }
          }
        } else {
          // Continuous Mode: Group speech by speaker. Only merge if the last user message was from the SAME speaker
          if (lastMsg && lastMsg.sender === 'user' && lastMsg.messageType !== 'chat' && lastMsg.speakerId === speakerKey) {
            shouldMerge = true;
            targetMsg = lastMsg;
          }
        }

        if (shouldMerge && targetMsg) {
          const updatedText = targetMsg.text + (targetMsg.text ? ' ' : '') + cleanText;
          const targetId = targetMsg.id;

          if (isTranslationActive) {
            const token = localStorage.getItem('auth_token') || '';
            const reqSeq = (transReqSeqRef.current[targetId] || 0) + 1;
            transReqSeqRef.current[targetId] = reqSeq;

            const handleTranslationResult = (translated) => {
              if (transReqSeqRef.current[targetId] !== reqSeq) return;
              setChatMessages(c => c.map(m => m.id === targetId ? { ...m, translation: translated } : m));
              setLastOriginalText(updatedText);
              setLastTranslatedText(translated);
              const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              setTranslationHistory(prev => {
                const cleanOrig = (updatedText || '').trim().toLowerCase();
                const existingIdx = prev.findIndex(item => item.msgId === targetId);
                if (existingIdx >= 0) {
                  const updated = [...prev];
                  updated[existingIdx] = {
                    ...updated[existingIdx],
                    originalText: updatedText,
                    translatedText: translated
                  };
                  return updated;
                }

                const contentIdx = prev.findIndex(item => {
                  const prevClean = (item.originalText || '').trim().toLowerCase();
                  return prevClean === cleanOrig || cleanOrig.startsWith(prevClean) || prevClean.startsWith(cleanOrig);
                });

                if (contentIdx >= 0) {
                  const updated = [...prev];
                  updated[contentIdx] = {
                    ...updated[contentIdx],
                    msgId: targetId,
                    originalText: updatedText,
                    translatedText: translated
                  };
                  return updated;
                }

                return [
                  ...prev,
                  {
                    msgId: targetId,
                    timestamp,
                    sourceLang: spokenLangRef.current,
                    targetLang: targetLangRef.current,
                    originalText: updatedText,
                    translatedText: translated
                  }
                ];
              });
            };

            fetch(`${API_BASE}/api/translate-text`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ text: updatedText, from: fromLangName, to: toLangName, engine: translationEngineRef.current })
            }).then(r => r.json()).then(data => {
              if (transReqSeqRef.current[targetId] !== reqSeq) return;
              if (data && data.translatedText) handleTranslationResult(data.translatedText);
            }).catch(() => {});
          }

          return curr.map(m => m.id === targetId ? {
            ...m,
            text: updatedText,
            translation: isTranslationActive ? (m.translation || 'Translating...') : '',
            isQuestion: isQ || m.isQuestion
          } : m);
        } else {
          const newId = Date.now() + Math.random().toString(36).substr(2, 9);

          if (isTranslationActive) {
            const token = localStorage.getItem('auth_token') || '';
            const reqSeq = (transReqSeqRef.current[newId] || 0) + 1;
            transReqSeqRef.current[newId] = reqSeq;

            const handleTranslationResult = (translated) => {
              if (transReqSeqRef.current[newId] !== reqSeq) return;
              setChatMessages(c => c.map(m => m.id === newId ? { ...m, translation: translated } : m));
              setLastOriginalText(cleanText);
              setLastTranslatedText(translated);
              const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              setTranslationHistory(prev => {
                const cleanOrig = (cleanText || '').trim().toLowerCase();
                const existingIdx = prev.findIndex(item => item.msgId === newId);
                if (existingIdx >= 0) {
                  const updated = [...prev];
                  updated[existingIdx] = {
                    ...updated[existingIdx],
                    originalText: cleanText,
                    translatedText: translated
                  };
                  return updated;
                }

                const contentIdx = prev.findIndex(item => {
                  const prevClean = (item.originalText || '').trim().toLowerCase();
                  return prevClean === cleanOrig || cleanOrig.startsWith(prevClean) || prevClean.startsWith(cleanOrig);
                });

                if (contentIdx >= 0) {
                  const updated = [...prev];
                  updated[contentIdx] = {
                    ...updated[contentIdx],
                    msgId: newId,
                    originalText: cleanText,
                    translatedText: translated
                  };
                  return updated;
                }

                return [
                  ...prev,
                  {
                    msgId: newId,
                    timestamp,
                    sourceLang: spokenLangRef.current,
                    targetLang: targetLangRef.current,
                    originalText: cleanText,
                    translatedText: translated
                  }
                ];
              });
            };

            fetch(`${API_BASE}/api/translate-text`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ text: cleanText, from: fromLangName, to: toLangName, engine: translationEngineRef.current })
            }).then(r => r.json()).then(data => {
              if (transReqSeqRef.current[newId] !== reqSeq) return;
              if (data && data.translatedText) handleTranslationResult(data.translatedText);
            }).catch(() => {});
          }

          return [
            ...curr,
            {
              id: newId,
              sender: 'user',
              messageType: 'transcript',
              speakerId: speakerKey,
              speakerName: speakerLabel,
              text: cleanText,
              translation: isTranslationActive ? 'Translating...' : '',
              isQuestion: isQ
            }
          ];
        }
      });

      lastSpeakerRef.current = speakerKey;
    } else {
      setInterimMsg({
        speakerId: speakerKey,
        speakerName: speakerLabel,
        text: cleanText
      });
    }
  };


  useEffect(() => {
    if (!ipcRenderer) return;

    const onDoCapture = (_, mode) => {
      if (mode !== 'notetaker' || isRecordingRef.current) return;
      console.log('[notetaker] received do-capture event. Starting audio capture...');
      startAudioCapture(spokenLangRef.current, targetLangRef.current);
    };

    const onCaptureStarted = () => {
      if (!localCaptureInitiatedRef.current) {
        console.log('[notetaker] ignoring capture-started since it was not initiated here.');
        return;
      }
      console.log('[notetaker] Capture started successfully in main process');
startNotetakerBilling();
    };

    const onCaptureStopped = () => {
      localCaptureInitiatedRef.current = false;
      console.log('[notetaker] Capture stopped successfully in main process');
    };

    const onCaptureError = (_, msg) => {
      console.error('[notetaker] Main process capture error:', msg);
      void stopNotetakerBilling();
      isRecordingRef.current = false;
      hasActiveRecordingRef.current = false;
      setIsRecording(false);
      setRecordingStatus('idle');
      showToast('Recording error: ' + (msg || 'Connection failed'));
    };

    const onSessionPersistResult = (_, data) => {
      if (data && data.ok) {
        showToast('Session saved successfully!');
        setActiveTab('past');
        fetchPastSessions();
      } else if (data && !data.ok) {
        showToast('Failed to save session: ' + data.message);
      }
    };

    const onTranscript = (_, data) => processTranscriptData(data);

    ipcRenderer.on('do-capture', onDoCapture);
    ipcRenderer.on('transcript', onTranscript);
    ipcRenderer.on('capture-started', onCaptureStarted);
    ipcRenderer.on('capture-stopped', onCaptureStopped);
    ipcRenderer.on('capture-error', onCaptureError);
    ipcRenderer.on('session-persist-result', onSessionPersistResult);

    return () => {
      ipcRenderer.removeListener('do-capture', onDoCapture);
      ipcRenderer.removeListener('transcript', onTranscript);
      ipcRenderer.removeListener('capture-started', onCaptureStarted);
      ipcRenderer.removeListener('capture-stopped', onCaptureStopped);
      ipcRenderer.removeListener('capture-error', onCaptureError);
      ipcRenderer.removeListener('session-persist-result', onSessionPersistResult);
    };
  }, []);

  // Cleanup recording on component unmount unconditionally (Electron + browser)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      notetakerGenRef.current++;
      isStartingRef.current = false;
      isRecordingRef.current = false;
      stopSpeaking();
      stopAudioCapture(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Cleanup on beforeunload (browser tab close/reload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isRecordingRef.current || isStartingRef.current) {
        notetakerGenRef.current++;
        stopSpeaking();
        stopAudioCapture(true);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Navigation & Close handlers that stop audio capture before navigating
  const handleClose = () => {
    if (isRecordingRef.current || isStartingRef.current) {
      notetakerGenRef.current++;
      stopSpeaking();
      stopAudioCapture(true);
    }
    ipcRenderer?.send('window-close');
  };

  const handleBackToLanding = () => {
    if (isRecordingRef.current || isStartingRef.current) {
      notetakerGenRef.current++;
      stopSpeaking();
      stopAudioCapture(true);
    }
    if (onBackToLanding) onBackToLanding();
  };

  const handleGoToDashboard = () => {
    if (isRecordingRef.current || isStartingRef.current) {
      notetakerGenRef.current++;
      stopSpeaking();
      stopAudioCapture(true);
    }
    if (onGoToDashboard) onGoToDashboard();
  };

  const handleGoToPanel = () => {
    if (isRecordingRef.current || isStartingRef.current) {
      notetakerGenRef.current++;
      stopSpeaking();
      stopAudioCapture(true);
    }
    if (onGoToPanel) onGoToPanel();
  };

  const handleGoToVoiceAgent = () => {
    if (isRecordingRef.current || isStartingRef.current) {
      notetakerGenRef.current++;
      stopSpeaking();
      stopAudioCapture(true);
    }
    if (onGoToVoiceAgent) onGoToVoiceAgent();
  };

  const handleGoToUpload = () => {
    if (isRecordingRef.current || isStartingRef.current) {
      notetakerGenRef.current++;
      stopSpeaking();
      stopAudioCapture(true);
    }
    if (onGoToUpload) onGoToUpload();
  };

  const handleLogoutClick = () => {
    if (isRecordingRef.current || isStartingRef.current) {
      notetakerGenRef.current++;
      stopSpeaking();
      stopAudioCapture(true);
    }
    if (onLogout) onLogout();
  };

  const handleTabChange = (tab) => {
    if (tab === 'past' && (isRecordingRef.current || isStartingRef.current)) {
      setTempTitle(getDefaultSessionTitle());
      setShowSaveSessionModal(true);
      return;
    }
    setActiveTab(tab);
  };

  const generateAiAnswerForQuestion = async (questionText) => {
    if (!questionText || !questionText.trim()) return;

    // Add a placeholder thinking message tagged as chat so it renders in prompt section
    const thinkingId = Date.now() + Math.random().toString(36).substr(2, 9);
    setChatMessages(prev => [...prev, { id: thinkingId, sender: 'ai', messageType: 'chat', text: 'Thinking...' }]);

    try {
      let replyText = '';
      if (ipcRenderer) {
        const res = await ipcRenderer.invoke('notetaker-chat-reply', {
          message: questionText,
          history: []
        });
        if (!isMountedRef.current) return;
        if (res.ok) {
          replyText = res.reply;
        } else {
          setChatMessages(prev => prev.map(m => m.id === thinkingId ? { ...m, text: 'Sorry, I encountered an error: ' + res.error } : m));
          return;
        }
      } else {
        const effectiveToken = getEffectiveToken();
        const res = await fetch(`${API_BASE}/api/notetaker/chat-reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${effectiveToken}` },
          body: JSON.stringify({ message: questionText, history: [] })
        });
        const data = await res.json();
        if (!isMountedRef.current) return;
        if (data && data.ok) {
          replyText = data.reply;
        } else {
          setChatMessages(prev => prev.map(m => m.id === thinkingId ? { ...m, text: 'Sorry, I encountered an error: ' + (data?.error || 'Unknown error') } : m));
          return;
        }
      }

      if (!isMountedRef.current) return;
      setChatMessages(prev => prev.map(m => m.id === thinkingId ? { ...m, text: replyText } : m));
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('[notetaker-auto-reply] failed:', err);
      setChatMessages(prev => prev.map(m => m.id === thinkingId ? { ...m, text: 'An unexpected error occurred: ' + err.message } : m));
    }
  };

  const translateTextHelper = async (text, fromCode, toCode) => {
    const srcCode = fromCode || spokenLangRef.current;
    const destCode = toCode || targetLangRef.current;
    if (!text || srcCode === destCode) return '';

    const tokenStr = getEffectiveToken();
    const fromName = languageOptions.find(l => l.code === srcCode)?.name || srcCode;
    const toName = languageOptions.find(l => l.code === destCode)?.name || destCode;
    try {
      const response = await fetch(`${API_BASE}/api/translate-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStr}` },
        body: JSON.stringify({ text, from: fromName, to: toName, engine: translationEngineRef.current })
      });
      const data = await response.json();
      return data?.translatedText || '';
    } catch (err) {
      console.warn('[notetaker-chat] translation failed:', err.message);
      return '';
    }
  };

  const translateChatReply = (reply) => translateTextHelper(reply);

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingChat || isSendingChatLockRef.current) return;
    isSendingChatLockRef.current = true;
    setIsSendingChat(true);

    const userMsg = chatInput.trim();
    setChatInput('');
    // Add user message immediately with unique id
    const userMsgId = `chat_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const shouldTranslatePrompt = spokenLang !== targetLang;
    setChatMessages(prev => [
      ...prev, 
      { 
        id: userMsgId, 
        sender: 'user', 
        messageType: 'chat', 
        text: userMsg,
        translation: shouldTranslatePrompt ? 'Translating...' : ''
      }
    ]);

    // Translate the user's prompt question itself into the selected target language
    if (shouldTranslatePrompt) {
      translateTextHelper(userMsg, spokenLangRef.current, targetLangRef.current).then(userTrans => {
        if (isMountedRef.current) {
          const cleanTrans = userTrans && userTrans.trim() !== userMsg.trim() ? userTrans.trim() : '';
          setChatMessages(prev => prev.map(m => m.id === userMsgId ? { ...m, translation: cleanTrans } : m));
        }
      }).catch(() => {
        if (isMountedRef.current) {
          setChatMessages(prev => prev.map(m => m.id === userMsgId ? { ...m, translation: '' } : m));
        }
      });
    }

    // Add a placeholder thinking message tagged as chat response
    const thinkingId = `ai_think_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setChatMessages(prev => [...prev, { id: thinkingId, sender: 'ai', messageType: 'chat', text: 'Thinking...' }]);

    try {
      const historyToSend = chatMessages.filter(m => m.text !== 'Thinking...');
      let replyText = '';
      if (ipcRenderer) {
        const res = await ipcRenderer.invoke('notetaker-chat-reply', {
          message: userMsg,
          history: historyToSend
        });
        if (!isMountedRef.current) return;
        if (res.ok) {
          replyText = res.reply;
        } else {
          setChatMessages(prev => prev.map(m => m.id === thinkingId ? { ...m, text: 'Sorry, I encountered an error: ' + res.error } : m));
          return;
        }
      } else {
        const token = localStorage.getItem('auth_token') || '';
        const res = await fetch(`${API_BASE}/api/notetaker/chat-reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ message: userMsg, history: historyToSend })
        });
        const data = await res.json();
        if (!isMountedRef.current) return;
        if (data && data.ok) {
          replyText = data.reply;
        } else {
          setChatMessages(prev => prev.map(m => m.id === thinkingId ? { ...m, text: 'Sorry, I encountered an error: ' + (data?.error || 'Unknown error') } : m));
          return;
        }
      }

      // Restore AI reply translation so AI answer has both English and target language translation
      let translation = '';
      if (spokenLang !== targetLang && replyText) {
        translation = await translateChatReply(replyText);
      }
      if (!isMountedRef.current) return;
      setChatMessages(prev => prev.map(m => m.id === thinkingId ? { ...m, text: replyText, translation } : m));

    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('[notetaker-chat] failed:', err);
      setChatMessages(prev => prev.map(m => m.id === thinkingId ? { ...m, text: 'An unexpected error occurred: ' + err.message } : m));
    } finally {
      if (isMountedRef.current) {
        setIsSendingChat(false);
      }
      isSendingChatLockRef.current = false;
    }
  };

  const handleCopyNotes = () => {
    let txt = '';
    if (rightTab === 'live') {
      txt = chatMessages
        .filter(m => m.sender === 'user')
        .map(m => `${m.speakerName || 'Speaker'}: ${m.text}`)
        .join('\n\n');
    } else {
      txt = cleanNotesText(generatedNotes);
    }

    if (!txt.trim()) {
      showToast('No content to copy.');
      return;
    }

    try {
      const electron = window.require ? window.require('electron') : null;
      if (electron && electron.clipboard) {
        electron.clipboard.writeText(txt);
        showToast('Copied to clipboard!');
        return;
      }
    } catch (_) {}

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt)
        .then(() => showToast('Copied to clipboard!'))
        .catch(() => fallbackCopyText(txt));
    } else {
      fallbackCopyText(txt);
    }
  };

  const fallbackCopyText = (txt) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = txt;
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('Copied to clipboard!');
    } catch (err) {
      showToast('Failed to copy.');
    }
  };

  const handleEmailNotes = () => {
    let txt = '';
    if (rightTab === 'live') {
      // Filter only transcript speech messages, exclude chat prompts to AI copilot
      const userMsgs = chatMessages.filter(m => m.sender === 'user' && m.messageType !== 'chat');
      if (userMsgs.length > 0) {
        txt = userMsgs.map(m => {
          const speaker = m.speakerName || 'Speaker';
          if (m.translation && m.translation !== m.text) {
            return `${speaker}: ${m.text}\n[Translation]: ${m.translation}`;
          }
          return `${speaker}: ${m.text}`;
        }).join('\n\n');
      }
    } else {
      txt = cleanNotesText(generatedNotes) || '';
    }
      
    if (!txt.trim()) {
      showToast('No content to email.');
      return;
    }

    const subject = (interviewTitle || '').trim() || 'Meeting Notes';

    // Gmail URL has a ~2KB limit; long meeting notes will be truncated or fail entirely.
    // For long content: copy to clipboard first, then open Gmail with a short placeholder body.
    const MAX_URL_BODY_LENGTH = 1800;

    if (txt.length <= MAX_URL_BODY_LENGTH) {
      // Short content: use Gmail URL directly
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(txt)}`;
      if (ipcRenderer) {
        ipcRenderer.send('open-external-url', gmailUrl);
      } else if (window.require) {
        try {
          const { shell } = window.require('electron');
          shell.openExternal(gmailUrl);
        } catch (_) {
          window.open(gmailUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        window.open(gmailUrl, '_blank', 'noopener,noreferrer');
      }
      showToast('Redirecting to Gmail...');
    } else {
      // Long content: copy to clipboard first, then open Gmail with placeholder
      const copyToClipboard = (text) => {
        try {
          const electron = window.require ? window.require('electron') : null;
          if (electron && electron.clipboard) {
            electron.clipboard.writeText(text);
            return true;
          }
        } catch (_) {}
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(() => {});
          return true;
        }
        try {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          return true;
        } catch (_) {}
        return false;
      };

      const copied = copyToClipboard(txt);
      const placeholderBody = copied 
        ? '[Your meeting notes have been copied to clipboard. Please paste them here using Ctrl+V / Cmd+V]'
        : '[Meeting notes are too long for auto-fill. Please copy them from the app and paste here.]';
      
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(placeholderBody)}`;
      
      if (ipcRenderer) {
        ipcRenderer.send('open-external-url', gmailUrl);
      } else if (window.require) {
        try {
          const { shell } = window.require('electron');
          shell.openExternal(gmailUrl);
        } catch (_) {
          window.open(gmailUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        window.open(gmailUrl, '_blank', 'noopener,noreferrer');
      }
      
      showToast(copied 
        ? 'Notes copied to clipboard! Paste them in the Gmail compose window (Ctrl+V).' 
        : 'Redirecting to Gmail... Notes may be too long, please copy from the app.');
    }
  };

  const getQaPairs = () => {
    const pairs = [];
    for (let i = 0; i < chatMessages.length; i++) {
      const m = chatMessages[i];
      if (m.sender === 'user' && m.messageType === 'chat') {
        let aiReply = null;
        for (let j = i + 1; j < chatMessages.length; j++) {
          if (chatMessages[j].sender === 'ai' && !isSystemStatusMessage(chatMessages[j])) {
            aiReply = chatMessages[j];
            break;
          }
          if (chatMessages[j].sender === 'user' && chatMessages[j].messageType === 'chat') {
            break;
          }
        }
        pairs.push({
          prompt: m.text,
          promptTranslation: m.translation || '',
          answerOriginal: aiReply ? aiReply.text : '',
          answerTranslation: aiReply ? (aiReply.translation || '') : ''
        });
      }
    }
    return pairs;
  };

  const doExportDownloadDirect = () => {
    const title = interviewTitle.trim() || 'Interview Session';
    const spokenLangName = languageOptions.find(l => l.code === spokenLang)?.name || 'English';
    const targetLangName = languageOptions.find(l => l.code === targetLang)?.name || 'Hindi';
    const durationText = formatTimer(timerSecondsRef.current || timerSeconds);
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const qaPairs = getQaPairs();
    const candidateSpeechMsgs = chatMessages.filter(m => m.sender === 'user' && m.messageType !== 'chat');

    if (exportFormat === 'txt') {
      let content = '';
      content += `============================================================\n`;
      content += `INTERVIEW SESSION REPORT: ${title.toUpperCase()}\n`;
      content += `Date & Time : ${dateStr} · ${timeStr}\n`;
      content += `Duration    : ${durationText}\n`;
      content += `Languages   : ${spokenLangName} (Spoken) -> ${targetLangName} (Target)\n`;
      content += `============================================================\n\n`;

      if (exportInclude === 'original' || exportInclude === 'translation' || exportInclude === 'both') {
      htmlContent += `<div class="section-title" style="font-size: 14px !important; font-weight: 800 !important; text-transform: uppercase !important; letter-spacing: 0.08em !important; color: #4f46e5 !important; margin: 30px 0 18px 0 !important; border-bottom: 1.5px solid #e2e8f0 !important; padding-bottom: 8px !important;">FULL TRANSCRIPT</div>`;
      if (candidateSpeechMsgs.length === 0) {
        htmlContent += `<p style="color: #64748b; font-size: 13px;">(No speech captured)</p>`;
      } else {
        candidateSpeechMsgs.forEach((msg, idx) => {
          const displayTime = msg.time || msg.wallTime || `00:${String(idx * 5).padStart(2, '0')}`;
          const isCandidate = msg.speaker === 'candidate' || msg.speakerName === 'Candidate' || msg.sender === 'user';
          const textToRender = (exportInclude === 'translation' && msg.translation) ? msg.translation : msg.text;
          htmlContent += renderTranscriptRow({
            time: displayTime,
            speaker: isCandidate ? 'Candidate' : (msg.speakerName || 'Interviewer'),
            text: textToRender
          });
        });
      }
    } else if (exportInclude === 'summary') {
      htmlContent += `<div class="section-title" style="font-size: 14px !important; font-weight: 800 !important; text-transform: uppercase !important; letter-spacing: 0.08em !important; color: #4f46e5 !important; margin: 30px 0 18px 0 !important; border-bottom: 1.5px solid #e2e8f0 !important; padding-bottom: 8px !important;">SUMMARY & NOTES</div>`;
      htmlContent += `<div class="card-item" style="background-color: #ffffff !important; border: 1px solid #e5e7eb !important; border-left: 4px solid #10b981 !important; border-radius: 8px !important; padding: 18px 22px !important; margin-bottom: 18px !important;"><div class="notes" style="font-size: 14px; line-height: 1.65; color: #374151;">${cleanNotesText(generatedNotes) || 'No notes generated yet.'}</div></div>`;
    }

    // Centered footer line matching the exact reference
    htmlContent += `<div class="footer" style="margin-top: 40px !important; border-top: 1px solid #e2e8f0 !important; padding-top: 14px !important; text-align: center !important; font-size: 11.5px !important; color: #94a3b8 !important;">Generated by Meeting Copilot - ${dateStr} - ${timeStr}</div>`;
    
    if (exportIncludeAiChat && qaPairs.length > 0) {
        content += `============================================================\n`;
        content += `AI COPILOT PROMPTS & INTERVIEW ADVICE\n`;
        content += `============================================================\n\n`;

        qaPairs.forEach((qa, idx) => {
          content += `[Q&A #${idx + 1}]\n`;
          if (exportInclude === 'original') {
            content += `USER PROMPT:\n${qa.prompt}\n\n`;
            content += `AI ADVICE:\n${qa.answerOriginal || '(No answer recorded)'}\n`;
          } else if (exportInclude === 'translation') {
            content += `USER PROMPT:\n${qa.promptTranslation || qa.prompt}\n\n`;
            content += `AI ADVICE (${targetLangName.toUpperCase()}):\n${qa.answerTranslation || qa.answerOriginal || '(No answer recorded)'}\n`;
          } else {
            // both or summary
            content += `USER PROMPT (${spokenLangName.toUpperCase()}):\n${qa.prompt}\n`;
            if (qa.promptTranslation) {
              content += `USER PROMPT (${targetLangName.toUpperCase()}):\n${qa.promptTranslation}\n`;
            }
            content += `\nAI ADVICE (${spokenLangName.toUpperCase()}):\n${qa.answerOriginal || '(No answer recorded)'}\n\n`;
            content += `AI ADVICE (${targetLangName.toUpperCase()}):\n${qa.answerTranslation || '—'}\n`;
          }
          content += `------------------------------------------------------------\n\n`;
        });
      }

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_export.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setShowExportModal(false);
      showToast('Transcript exported to Notepad (Plain text) successfully!');
      return;
    }

    // Otherwise, generate HTML content for PDF
    let htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @page {
              margin: 15mm;
              size: auto;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
              box-sizing: border-box;
            }
            @page {
              margin: 12mm 15mm;
              size: A4 portrait;
            }
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
              margin: 36px 40px; 
              padding: 0; 
              color: #1f2937; 
              background: #ffffff;
              line-height: 1.5;
            }
            .report-header {
              background: #2563eb;
              background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
              border-radius: 14px;
              padding: 24px 28px;
              color: #ffffff;
              margin-bottom: 28px;
              box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.15);
            }
            .report-title {
              font-size: 28px;
              font-weight: 700;
              margin: 0 0 8px 0;
              color: #ffffff;
              letter-spacing: -0.01em;
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .report-logo {
              width: 36px;
              height: 36px;
              object-fit: contain;
              vertical-align: middle;
              flex-shrink: 0;
            }
            .report-subtitle {
              font-size: 14px;
              opacity: 0.88;
              margin: 0 0 18px 0;
              color: #ffffff;
            }
            .badge-container {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
            }
            .badge {
              background: rgba(255, 255, 255, 0.16);
              border: 1px solid rgba(255, 255, 255, 0.35);
              padding: 6px 16px;
              border-radius: 9999px;
              font-size: 13px;
              font-weight: 500;
              color: #ffffff;
            }
            .section-title { 
              font-size: 14px; 
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: #4f46e5;
              margin: 28px 0 16px 0;
              border-bottom: 1.5px solid #e5e7eb;
              padding-bottom: 8px;
            }
            .msg { 
              background-color: #ffffff;
              border: 1px solid #e5e7eb;
              border-left: 4px solid #10b981;
              border-radius: 8px;
              padding: 14px 18px;
              margin-bottom: 14px;
              page-break-inside: avoid;
            }
            .speaker { 
              font-weight: bold; 
              color: #0284c7; 
              margin-bottom: 4px; 
              font-size: 12.5px;
              text-transform: uppercase;
            }
            .msg-text {
              font-size: 14px;
              color: #1e293b;
            }
            .comparison-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 13.5px;
              page-break-inside: auto;
            }
            .comparison-table th {
              background: #0f172a;
              color: #ffffff;
              padding: 10px 14px;
              text-align: left;
              font-size: 12px;
              letter-spacing: 0.5px;
            }
            .comparison-table td {
              padding: 12px 14px;
              border-bottom: 1px solid #e2e8f0;
              vertical-align: top;
              background: #ffffff;
              width: 50%;
            }
            .comparison-table tr:nth-child(even) td {
              background: #f8fafc;
            }
            .comparison-table tr {
              page-break-inside: avoid;
            }
            .qa-card {
              background-color: #ffffff;
              border: 1px solid #e5e7eb;
              border-left: 4px solid #10b981;
              border-radius: 8px;
              padding: 16px 20px;
              margin-bottom: 18px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .qa-header {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 8px;
              font-size: 13px;
              color: #6b7280;
            }
            .q-badge {
              background-color: #10b981;
              color: #ffffff;
              width: 26px;
              height: 26px;
              border-radius: 50%;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              font-size: 12px;
              flex-shrink: 0;
            }
            .q-text {
              font-weight: 700;
              font-size: 16px;
              margin-bottom: 8px;
              color: #111827;
            }
            .a-text {
              font-size: 14px;
              line-height: 1.6;
              color: #374151;
            }
            .a-text p {
              margin: 0 0 12px 0;
            }
            .a-text p:last-child {
              margin-bottom: 0;
            }
            .qa-badge {
              display: inline-block;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              color: #16a34a;
              margin-bottom: 6px;
            }
            .qa-prompt {
              font-weight: 600;
              color: #14532d;
              margin-bottom: 8px;
              font-size: 13.5px;
            }
            .qa-answer {
              font-size: 13px;
              color: #1e293b;
              line-height: 1.5;
              background: #ffffff;
              padding: 10px 12px;
              border-radius: 6px;
              border: 1px solid #dcfce7;
            }
            .qa-translation {
              margin-top: 8px;
              padding-top: 8px;
              border-top: 1px dashed #86efac;
              font-size: 12.5px;
              color: #15803d;
            }
            .notes { 
              white-space: pre-wrap; 
              font-size: 14px; 
              line-height: 1.6; 
              background: #f8fafc;
              padding: 16px;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
              color: #334155; 
              page-break-inside: avoid;
            }
            @media print {
              body { padding: 0; }
              .msg, .qa-card, tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div id="pdf-report-container" style="width: 794px !important; min-width: 794px !important; max-width: 794px !important; margin: 0 auto !important; padding: 24px 28px !important; box-sizing: border-box !important; background-color: #ffffff !important;">
          <div class="report-header" style="background-color: #2563eb !important; background: #2563eb !important; background-image: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important; border-radius: 14px !important; padding: 24px 28px !important; color: #ffffff !important; margin-bottom: 26px !important; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.15) !important;">
            <div class="report-title">
              <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAAA0CAYAAADSWosiAAAQAElEQVR4AexZaZBdxXX+uu+97743qzSbNBIIgUACrUheScC4bPY4kBQOCAUhYwskAYplWRvCYCwTsJ1UJVVJJalK+OGUK0mV4zgVx8SVshPbVShgEBBblhFgIwkhjWZ5y7w3b7tL+zt93xsNkgrPU5lfUk9/fU6f7j59zunl3ndHm3M0aZyj6bzj59rCn1/x8yt+jkTg/FY/RxZ60s3zKz4ZinOEOb/i58hCT7r5W1hx01DWpElVagZSJvVWyrMb1ZjhDINFJGj0sKRlx9+pQGoEM2KF0gu/wPgzexGOlKCseoA//lgkFemWQEqRxSyEb4JVxBwbkxEkQ400U9IgDGdswa4ov3EC+f/8EcoHD0Pq7AYTS08Ba+8kFCS5ZccVFTEnow3dM1RBkn3253jz7t3Ann/A2F9/HagbKGlnm1Em6W8tC+lYCXHxAOLci4jHieJLMKV9MBMvwpRfIJ5DPPF/MPXX2HeC4HCqoCokQdCUacRDJbxx3x5Udv8NKg//BWqvHQEboDTYLwkcmBTDpAmyk5ldJvnpMZzdWAcSS8Q3GThy4BBMKUJbVSO77xeo54oQI8CkhKEdymhyVQw99zSO/Nt6jHx/M0Z/uBn5Zx9E8YXNKP//ZtT3b0FwYCvqr+9C8NYeBGPPACoiZJUNKSbT+PERxG8cR49qQ7D/EIpHT9g2u+BK0XtWSSzDoVN9b91xKkgGkaHeZl74Bx+F+/5V2F8J0HP7bUjN6mLUwVVHksQAQSWHoZ/t5YryOJTKUMUSAzYOM1EAiuOIy3noehF+OAG3egSl46/Q7iqhqUsRhmAg6MWMRRcic/t1+GU+ROkDK9GzdJGdSylFqsEoI0nCU8ac1AFKmuw0Kbctp2505jIKx/2nZrXjonWfxPiSizFr9fU0i71UjNgawU6KMERmNty+D+DIUBpHR9oxPNaJsbEZGB3pJt+NE0M9OHZ0Jg6/6WH/ywECvQBQ7bBJdFh9NFt0dbhYtHsjqr39WPDIFujZXQyQYWBw0mcwmQZImpkamux0qZ2djiWUcQCsMUAtpTDR1lQp7dpGNn80i8M/PYKDP3kDrz1/CDPn/R76V3wW/sJN8C7ZCG8e6QUPwpmzEYrQg5vgDD6AzgWfh9/9URx7axQjxwvIjU2gWg2S+RpzRk6Iuq8Q+kiSTCuQmjgs9AxoWnmGpjOLRJd1ForOn9InjqBCGsaNIHNX82Xs+95eHNy7Hyd4FkvDFZTHIoxkfajZ1xE3Ix64BVH/LaS/D9N3G2W3wsy+Fd7g7cjMvgml6gygrlDnESpnKxg9VsDoUB4mEks4v+y2qA4Yznu6RZSzjxhDMjW37LjVwYKZrlMVtzPLJHPyMKQRHjAxnMfz3/kBKqPj0I6G4ylSQGsHLhFFIWANrvM41GmyGB7yXhAakLLdhHBcDe068BwXKc+Bq7QNwoljY+xjoOlBHJY5nv3FIrltGRNmSFUgvIgxJXHYlNq02Ii9CEYaok1AiWQDGq3pRCHE8//1A65UAE3DlXLgOCm4dMD1NCQIvuvBS6XheSmkUuR9F6m0h5RQwiNSvrQRpJ7vw0k5QArQngtGC9mRPGLaEYcVMEZiwiRUgxOnhbW7tFmhQBOtZXluywjRbDFFGwwcRDj+0kuo5Qp2ZcURz3VRLJQwms1iODtGmsPo2DAvtBMYGx2hA6MYHR7F8MgYxobHkDsxhtGRUYySHx0iP0R+aAQlPgU6OzuRyaS50g7q1Rj1MgPNnWaaO896yIVBTGtACG3YyLYGZ+8ecWP64KViIB5ziBHFisrJ2xzCVErIv/4q/LQP7Xj40Y9fwON/+jU8vucr+OLjT+CxRx/FI7t2Y9e2ndi+bTu2fm4btjy0FX+yaTM2r38ID376IWz41AO4754NFvevvR/33X0/1q/dgPWr78fGNQ/gJz9+ER0dvOm5m0xZtnmVFnG30QaaxJL2cYHoJ+WgkwqWYUEOks5ixTmMSkElYErcTqaDQxqGqE4UuZ3T+Ma3voO/ffqf8Pqv3sLIWB5HCxN4M1/EcC6LQj6PQjaHwmiBt3UeWbbnRnPIDReQpcxiOIdjvCsO8544fKKAt98ewb69r9jA/OPT30BHWwdUEEGuC54jWmPsuQddZQViomryaCSaKFzrjnOUIiQnx1vxuZloM0NFpKqAp328+Mp+/M+zL6OzdwB+Rwfq3T3o+J3rcOXGHVALVwA8s+l0Gul0G/xMBqkGvLZ2eJk21tugyav5izB/zSZcdPta1NMdaO/uQldXH/7yz/4O+195FZpzDfQsBQ7xcqNBSimIw2Sn7ESclvRpkt8koF6reLIfBUpj/GdH8fbXv4tZmV7Eysdz+/bTyB64vLjg+QgG5sEsuQr6qhtw8a13I3B4FCjXqRR0yrc7xPEypAnvum18NnfAW7gKhcW/i4tXr0fXhZfCaF52DJLnd+Fb3/wP+F4bBmevgPnXA6j/apym0R7alpQxuWaWxSGSBrTuOBJljfFNrcg9/yrCoRw8br9sLUCuXIVLxxztw6Gxxk0h4A1ci2Kozg5wWaHpnHLTUE4ajgX7su46Kbiuj9jJIOTYiC/fNWXgds6EoT7NNieVwaFDx+xt7jKIGKqhPjLesEcuNM7TqAkxDIncSAJDgSbOIsvQZFiTc+p1aEYj5gtMmivoN1bPpSNyyRmHU3L/lUp1lPky4nGlHLY5EpwGFMeBO0T7HpTHAY7ido1Rq9cwPlFGpBw+0jJw6KjHQLZ3dEK5Hn/hZREcO4awVrNGGWhSwgjIMtM0lpr6EovZwvrZZI5XXEHV2AHG8JLhLRNFAdI0eO7gLEBnuI3bIavtwKE5CsVSCbVKHR6f306KK80AueI4eY+8yDSDotx2uNqFpxWqQZ3jalwzBY/93FQ7uE2wfPkyxLUqVMy2oCyRRTOpUxmTCBStAJMmWsrJ+KZaoQIgVjHCOIa8SUZRFR9+/zKkeMtrrkzKz6CtPIGO8VH0EeGr+5Hx0wxKhmc6DZeOOoT20vDosEN4DEK7duFmRzC3Mg7ntQPggxx+uh0ht8/M3hm46ZaPo1Kp0H5apQkTkwcDhGRllSFFkhIzpcG2t+w47DBMJtOscxvHfFeP6bzhyl8ytx+3fuxDSCkeAfbppLz68j4Mf/ffoX95EC4DojS3NM+z0j6USsHWlQtNmXZ9ZHiO9dAQit//HrL//QwykUG9XkV3l4+tWzeip7eTj7IYJuaNjmjSJusdawbGlizekQ1rZ+W4gURWhlNDI4uzJuTkdJCWwNQncNXKS7Fh7W249oPLccmcASzsTOHyVIx5MzvQ39Nl0dfbhd4+8kRfXzf6+7sx0N+J/r5OzJrdi8sGe3BFp8aiGWlcNn8W7rzzE/jq1x7ByvctQmWihDjinHTaxAHsZy5rj4HiH+y2NpQISGT9uTOFa9lxxVECcBsJLE+ZYT2WySX6SqQxonoJc/vbcftNV2Hbhj/Cjo13YfsDa7HjoXuxc8sG7Pr8BjyybSMe3bkRj+3ehC99YRO+/NiDeOLxzXhyz2fx1BNb8JUnt+IpwVNb8OdPfg533XkjumekUKbTIW/7mIE2qMGec3GMtkhuuqqs87RHBAIkqWXHrW65LW1EEyVSGjZECGHEcbbFSlPCFj6+wirfp4MAbSkX7SmHW9iB7ypk+KMl7Wn4AtZTnoLnAuxGmYL0SVHupxRS7FOaGEeZl2NcjyDTmEiTxtBysUXybc4gSZoWAFwL2NQUK6nZwoZDatOHjBPYEU2NPFWMvDzKYrlgeNtro+zEPIHciHEC/oQK2S+KaTi3aJ13QcBX3JAIwhhhECPgcanRsTphaS1CUI1Qr4VgE9sNz7WBCYkA5CMo/ryNqyVerJG1Soo4CTsNS2pijEnCIYLWHTd2WLNQTQYY6EaFz3LQAWUnAEsFmgbN0CsaQlNBIQDNmgJiAfnYIQ/uFoFCzEsspJ6IgYjoYCQesx4HIWLWw8DQYYOA7+la+laKmEhHSPd0UHcz01Kqt/Nx94GMVNFIukHPgigaf3LYgk9ci8E1N+JIKuDrKB1gExfdTieXjkyqRMDdYLgrHFejLeMjk04lyKQTmvYpTyPtpxiIiA6GkACE4jQ/WccMhgRGnOYSo8T3hrfnZuBvuxNty+Zz1iRrzjzVQIYhaWAptmjSlrKaqsGOjBMvO32s+qsv4vqvPowCzzqgAAuZgqtKXimRAa7rYXh4CNt37cC969fhM+vvxbp778GnPk26bh3W3PXH2POlPXxG8+WEqxXKqnIXB7FGGCoihjgvQai1p3HF338ZPetuhHHZSewTcD7Z3mCilCWzlZMya6K1LI8DUUCIGySQOWwhF9EFA6hwNTWFJ4NkWKPzRnopaK3xL//8Tfz84EEU+RaXK5ZRKFWRK1SQJ0rlAP/7w7349refgeukITvE2LuBDpOCF6bhja64g0LO6cxqg0320iXHeVhywbkoZDRhsxhsGfCwNZjpksno2QGKDgmTzCSl290NLgyPb0jIxDKCp1u2uAJoK8EbvauDb20ZKDom0E4G2mVdXmwcDz5/rrZ1dHCrU0egoHi2DS9EChgImVPbBdUMstQsVFO/WALaRgFg+6lEhGbSTWa61JFYiT6BHaRZJhVR7vB51N3Pn6ZyIbEFnB5Mco+R0GhD2wOsueNO3HzDjVi+dClWrrgSVwqWX4lVy96HFUtWYPUdq3H9x29Alb/yDLd6zEeXphLD+Y1ELwbqfG/onnKhKc6lOIlSUpJhXykphgVOJrH6ZG063CmRO3WIosZLlyzjDwtefsphs4sYDk3QjLyyEEfa+BFi432fwRce3ondO7fj4e3bsZvYtWM7Ht29G6s/eQe0bGkipqMRNZAFvy5C02kdURcj3dPc5pyplaxb6Wz7KluesTAN6fyll6Nr7hxeTtziNTpeU3wWG/BjKKFQr8REhHF+UsqdyCHL3/EFfjHNjeQgyPID43i2yL4xAvYNiaAcIqwaRGWFYEKhVJxA70AHMjN8GIYWLBvTT4u07vi7qJ3cYXz7+uDNH6FRPRjP11AvadSLLipFjdq4sqhmFap5oEYElFVzBvWCsvUq67UCUC0YCK2RBuPk8wZlfmvIZQuYOdiOi5b00xrT2MXvsiLsdWr+rTo+VXmaj7er//AaDC6+EOV6gDz/q5LPTWAsm0d+bNx+YCxwxYXPjlJGZ7IjWSvPs484lxsr8MNjHmPsnxUUCpgIC7hs1QAu//AcQBuus+K0ApIWsm6hbwtdDfvGUGlgxQ1X4GP3fAjLrp+HxdcO4oprZ+Pyj/Tjimv6SftI+7D4GtKre7GY8iWUL766H4uv7mNbv5UtZtvSawew8ro5uP6uxZi3vBfJMquENEq0kN4jxxUgN7DhihB+t4f5y+dgwaq5uHTVBViwUvjBhAo/BZesHMRJzCY/m+MGOX4W5i7sheIPFgkrNdNNctRPpuX8HjkOGE3n5dATNI+GJWXc5BoGi1RA8btnC4fQXAAAAHlJREFU6dQANXONFbc5BVIheffBp7e+N46LIYSsCgmN5MR8JNFSOZasSBaLhZqkXViBYWEhBXnEfPZHMhSiQiQMK4m0i/PUo4SnqIX83jhOA2gOn7wgTjdKsT3x1pDYmkjeCSs2Vqb4csCNY3lYeZNtVpo0kU+n/DUAAAD//8/e+BgAAAAGSURBVAMA44Ptx38L+tMAAAAASUVORK5CYII=" alt="Logo" class="report-logo" />
              <span>${title || 'Meeting Notetaker Report'}</span>
            </div>
            <div class="report-subtitle">${dateStr} - ${timeStr}</div>
            <div class="badge-container" style="display: flex !important; flex-wrap: wrap !important; gap: 10px !important;">
              <div class="badge" style="background-color: rgba(255, 255, 255, 0.22) !important; border: 1px solid rgba(255, 255, 255, 0.35) !important; padding: 5px 16px !important; border-radius: 9999px !important; font-size: 13px !important; font-weight: 500 !important; color: #ffffff !important; display: inline-block !important; white-space: nowrap !important;">${candidateSpeechMsgs.length} transcript lines</div>
              <div class="badge" style="background-color: rgba(255, 255, 255, 0.22) !important; border: 1px solid rgba(255, 255, 255, 0.35) !important; padding: 5px 16px !important; border-radius: 9999px !important; font-size: 13px !important; font-weight: 500 !important; color: #ffffff !important; display: inline-block !important; white-space: nowrap !important;">Duration: ${durationText}</div>
              <div class="badge" style="background-color: rgba(255, 255, 255, 0.22) !important; border: 1px solid rgba(255, 255, 255, 0.35) !important; padding: 5px 16px !important; border-radius: 9999px !important; font-size: 13px !important; font-weight: 500 !important; color: #ffffff !important; display: inline-block !important; white-space: nowrap !important;">Spoken: ${spokenLangName}</div>
              <div class="badge" style="background-color: rgba(255, 255, 255, 0.22) !important; border: 1px solid rgba(255, 255, 255, 0.35) !important; padding: 5px 16px !important; border-radius: 9999px !important; font-size: 13px !important; font-weight: 500 !important; color: #ffffff !important; display: inline-block !important; white-space: nowrap !important;">Target: ${targetLangName}</div>
            </div>
          </div>
    `;

    if (exportInclude === 'original') {
      htmlContent += `<div class="section-title">Original Transcript (${spokenLangName})</div>`;
      if (candidateSpeechMsgs.length === 0) {
        htmlContent += `<p style="color: #64748b;">(No speech captured)</p>`;
      } else {
        candidateSpeechMsgs.forEach((msg, idx) => {
          htmlContent += `
            <div class="msg">
              <div class="speaker" style="color: ${getSpeakerColor(msg.speakerName)};">#${String(idx + 1).padStart(2, '0')} · ${msg.speakerName || 'Speaker'}</div>
              <div class="msg-text">${msg.text}</div>
            </div>
          `;
        });
      }
    } else if (exportInclude === 'translation') {
      htmlContent += `<div class="section-title">Translated Transcript (${targetLangName})</div>`;
      if (candidateSpeechMsgs.length === 0) {
        htmlContent += `<p style="color: #64748b;">(No speech captured)</p>`;
      } else {
        candidateSpeechMsgs.forEach((msg, idx) => {
          htmlContent += `
            <div class="msg">
              <div class="speaker" style="color: ${getSpeakerColor(msg.speakerName)};">#${String(idx + 1).padStart(2, '0')} · ${msg.speakerName || 'Speaker'}</div>
              <div class="msg-text">${msg.translation || msg.text}</div>
            </div>
          `;
        });
      }
    } else if (exportInclude === 'both') {
      htmlContent += `<div class="section-title">Side-by-Side Transcript</div>`;
      if (candidateSpeechMsgs.length === 0) {
        htmlContent += `<p style="color: #64748b;">(No speech captured)</p>`;
      } else {
        htmlContent += `
          <table class="comparison-table">
            <thead>
              <tr>
                <th>ORIGINAL (${spokenLangName.toUpperCase()})</th>
                <th>TRANSLATION (${targetLangName.toUpperCase()})</th>
              </tr>
            </thead>
            <tbody>
        `;
        candidateSpeechMsgs.forEach((msg, idx) => {
          htmlContent += `
            <tr>
              <td>
                <div class="speaker" style="color: ${getSpeakerColor(msg.speakerName)};">#${String(idx + 1).padStart(2, '0')} · ${msg.speakerName || 'Speaker'}</div>
                <div class="msg-text">${msg.text}</div>
              </td>
              <td>
                <div class="speaker" style="color: #16a34a;">#${String(idx + 1).padStart(2, '0')} · ${targetLangName.toUpperCase()}</div>
                <div class="msg-text">${msg.translation || '—'}</div>
              </td>
            </tr>
          `;
        });
        htmlContent += `
            </tbody>
          </table>
        `;
      }
    } else if (exportInclude === 'summary') {
      htmlContent += `<div class="section-title">AI Notes & Summary</div>`;
      htmlContent += `<div class="notes">${generatedNotes ? cleanNotesText(generatedNotes).replace(/\n/g, '<br>') : 'No notes generated yet.'}</div>`;
    }
``
    // Append AI Copilot Q&A section if enabled
    if (exportIncludeAiChat && qaPairs.length > 0) {
      htmlContent += `<div class="section-title">Questions & Answers</div>`;
      qaPairs.forEach((qa, idx) => {
        const rawAns = exportInclude === 'translation' ? (qa.answerTranslation || qa.answerOriginal || 'No reply recorded') : (qa.answerOriginal || 'No reply recorded');
        const answerParagraphs = String(rawAns)
          .split(/\n\s*\n/)
          .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
          .join('');
        htmlContent += `
          <div class="qa-card">
            <div class="qa-header">
              <div class="q-badge">Q${idx + 1}</div>
              <span>Prompt #${idx + 1} - auto-detected</span>
            </div>
            <div class="q-text">${exportInclude === 'translation' ? (qa.promptTranslation || qa.prompt) : qa.prompt}</div>
            <div class="a-text">
              ${answerParagraphs}
              ${exportInclude === 'both' && qa.answerTranslation ? `
                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 13px; color: #059669;">
                  <strong>Translation (${targetLangName.toUpperCase()}):</strong><br>
                  ${qa.answerTranslation}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      });
    }

    htmlContent += `</div></body></html>`;

    const pdfFileName = `${title.toLowerCase().replace(/\s+/g, '_')}_export.pdf`;

    const sections = [];
    if (exportInclude === 'summary' && generatedNotes) {
      sections.push({
        title: 'AI NOTES & SUMMARY',
        itemsHtml: `<div style="background:#f8fafc; padding:16px; border-radius:8px; border:1px solid #e2e8f0; font-size:14px; line-height:1.6; color:#334155;">${cleanNotesText(generatedNotes).replace(/\n/g, '<br>')}</div>`
      });
    }

    if (candidateSpeechMsgs.length > 0 && exportInclude !== 'summary') {
      const transcriptRows = candidateSpeechMsgs.map((msg, idx) => {
        return renderTranscriptRow({
          time: `#${String(idx + 1).padStart(2, '0')}`,
          speaker: msg.speakerName || 'Speaker',
          text: (exportInclude === 'translation' && msg.translation) ? msg.translation : msg.text
        });
      }).join('');
      sections.push({
        title: exportInclude === 'translation' ? 'TRANSLATED TRANSCRIPT' : 'TRANSCRIPT',
        itemsHtml: transcriptRows
      });
    }

    if (exportIncludeAiChat && qaPairs.length > 0) {
      const qaRows = qaPairs.map((qa, idx) => {
        const rawAns = exportInclude === 'translation' ? (qa.answerTranslation || qa.answerOriginal || 'No reply recorded') : (qa.answerOriginal || 'No reply recorded');
        return renderQaCard({
          questionNumber: idx + 1,
          question: exportInclude === 'translation' ? (qa.promptTranslation || qa.prompt) : qa.prompt,
          answer: rawAns
        });
      }).join('');
      sections.push({
        title: 'QUESTIONS & ANSWERS',
        itemsHtml: qaRows
      });
    }

    const reportData = {
      title: title || 'Meeting Notetaker Report',
      subtitle: `${dateStr} - ${timeStr}`,
      badges: [
        `${candidateSpeechMsgs.length} transcript lines`,
        `Duration: ${durationText}`,
        `Spoken: ${spokenLangName}`,
        `Target: ${targetLangName}`
      ],
      sections,
      footerText: `Generated by Meeting Notetaker - ${dateStr} ${timeStr}`
    };

    setPdfCustomizerModal({
      isOpen: true,
      reportData,
      filename: pdfFileName
    });
    setShowExportModal(false);
  };

  const handleExportDownload = async () => {
    const title = interviewTitle.trim() || 'Interview Session';
    const fileName = exportFormat === 'txt'
      ? `${title.toLowerCase().replace(/\s+/g, '_')}_export.txt`
      : `${title.toLowerCase().replace(/\s+/g, '_')}_export.pdf`;

    const cost = CREDIT_USAGE_CONFIG.downloads.creditCostPerDownload;
    const currentBal = getUserCredits();

    if (currentBal < cost) {
      setCreditPromptModal({
        isOpen: true,
        type: 'download',
        title: 'Insufficient Credits',
        message: `You need ${cost} credits to download this file. Your balance is ${currentBal}.`,
        fileDetails: { name: fileName, type: exportFormat === 'txt' ? 'Plain Text (.txt)' : 'PDF Document' },
        pendingAction: () => doExportDownloadDirect()
      });
      return;
    }

    if (exportFormat === 'txt') {
      doExportDownloadDirect();
      const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : null;
      const res = await recordDownloadAction({
        fileType: 'Text Transcript',
        fileName,
        token
      });
      if (res.success && showToast) {
        showToast(res.message);
      }
    } else {
      doExportDownloadDirect();
    }
  };

  const handleConfirmPdfCustomizerDownload = async ({ customizedHtml, filename, pdfTheme }) => {
    await downloadPdfReport({ htmlContent: customizedHtml, filename, showToast, pdfTheme });
    const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : null;
    const res = await recordDownloadAction({
      fileType: 'PDF Summary',
      fileName: filename,
      token
    });
    if (res.success && showToast) {
      showToast(res.message);
    }
  };

  const handleConfirmCreditPrompt = async ({ fileDetails }) => {
    if (creditPromptModal.type === 'notetaker') {
      const requiredCost = getNotetakerCreditCost();
      const curCredits = getUserCredits();
      if (curCredits < requiredCost) {
        if (showToast) showToast(`Need at least ${requiredCost} credits to continue.`);
        return;
      }
      if (creditPromptModal.pendingAction) {
        creditPromptModal.pendingAction();
      }
      setCreditPromptModal(prev => ({ ...prev, isOpen: false, pendingAction: null }));
      return;
    }

    const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : null;
    const res = await recordDownloadAction({
      fileType: fileDetails?.type || 'Document',
      fileName: fileDetails?.name || 'notetaker_export',
      token
    });
    if (res.success) {
      if (showToast) showToast(`Export downloaded via credits (${res.creditsDeducted} credits deducted)`);
      if (creditPromptModal.pendingAction) {
        creditPromptModal.pendingAction();
      }
      setCreditPromptModal(prev => ({ ...prev, isOpen: false, pendingAction: null }));
    } else {
      if (showToast) showToast(res.message);
    }
  };

  const handleTopUpFromCreditModal = () => {
    setCreditPromptModal(prev => ({ ...prev, isOpen: false, pendingAction: null }));
    if (onGoToSubscription) {
      onGoToSubscription();
    }
  };

  const handleSelectPastSession = (sessId) => {
    const found = pastSessions.find(s => (s.id === sessId || s._id === sessId));
    if (found) {
      const notesText = found.payload?.notes || found.payload?.generatedNotes || found.notes || '';
      setGeneratedNotes(cleanNotesText(notesText));
      
      const spLangName = found.payload?.spokenLanguage || found.spokenLanguage || '';
      const tgLangName = found.payload?.targetLanguage || found.targetLanguage || '';
      
      const spCode = languageOptions.find(l => l.name.toLowerCase() === spLangName.toLowerCase())?.code || (spLangName.length === 2 ? spLangName : spokenLang) || 'en';
      const tgCode = languageOptions.find(l => l.name.toLowerCase() === tgLangName.toLowerCase())?.code || (tgLangName.length === 2 ? tgLangName : targetLang) || 'en';
      
      setSpokenLang(spCode);
      setTargetLang(tgCode);
      const resolvedSpLangName = spLangName || languageOptions.find(l => l.code === spCode)?.name || spCode;
      const resolvedTgLangName = tgLangName || languageOptions.find(l => l.code === tgCode)?.name || tgCode;
      setDisplayedNotesLang(
        resolvedSpLangName.toLowerCase() === resolvedTgLangName.toLowerCase()
          ? resolvedTgLangName
          : `${resolvedSpLangName} + ${resolvedTgLangName}`
      );

      let rawTranscript = found.payload?.transcript || found.transcript || [];
      if (!Array.isArray(rawTranscript)) {
        rawTranscript = [];
      }

      const normalizedTranscript = rawTranscript.map((msg, idx) => ({
        ...msg,
        id: msg.id || `past_${idx}_${Date.now()}`
      }));

      setChatMessages(normalizedTranscript);

      // Restore translation history if saved
      if (found.payload?.translationHistory && Array.isArray(found.payload.translationHistory)) {
        setTranslationHistory(found.payload.translationHistory);
      }

      // Auto-translate any past session speech messages that are missing translations or stuck at "Translating..."
      const fromName = languageOptions.find(l => l.code === spCode)?.name || 'English';
      const toName = languageOptions.find(l => l.code === tgCode)?.name || 'English';

      if (spCode !== tgCode) {
        normalizedTranscript.forEach((msg) => {
          if (msg.sender === 'user' && msg.messageType !== 'chat' && !isSystemStatusMessage(msg) && msg.text && (!msg.translation || msg.translation === 'Translating...')) {
            const tokenStr = localStorage.getItem('auth_token') || '';
            const handleResult = (translated) => {
              setChatMessages(curr => curr.map(m => (m.id && msg.id && m.id === msg.id) ? { ...m, translation: translated } : m));
              setTranslationHistory(prev => {
                const existingIdx = prev.findIndex(item => item.msgId === msg.id || (item.originalText || '').trim().toLowerCase() === (msg.text || '').trim().toLowerCase());
                if (existingIdx >= 0) {
                  const updated = [...prev];
                  updated[existingIdx] = { ...updated[existingIdx], translatedText: translated };
                  return updated;
                }
                return [
                  ...prev,
                  {
                    msgId: msg.id,
                    timestamp: msg.wallTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    sourceLang: spCode,
                    targetLang: tgCode,
                    originalText: msg.text,
                    translatedText: translated
                  }
                ];
              });
            };

            if (ipcRenderer) {
              ipcRenderer.invoke('translate-text', { text: msg.text, from: fromName, to: toName, engine: translationEngineRef.current }).then(handleResult).catch(() => {});
            } else {
              fetch(`${API_BASE}/api/translate-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenStr}` },
                body: JSON.stringify({ text: msg.text, from: fromName, to: toName, engine: translationEngineRef.current })
              }).then(r => r.json()).then(data => { if (data && data.translatedText) handleResult(data.translatedText); }).catch(() => {});
            }
          }
        });
      }
      
      setRightTab('notes');
      showToast(`Loaded notes for "${found.title || 'default'}"`);
    }
  };

  // Handle direct navigation from Profile or other views to a specific session in the Past tab
  useEffect(() => {
    if (windowType !== 'notetaker') return;
    const targetTab = sessionStorage.getItem('notetaker_target_tab');
    if (targetTab === 'past') {
      setActiveTab('past');
      const targetSessionId = sessionStorage.getItem('notetaker_target_session_id');
      if (targetSessionId) {
        let found = pastSessions.find(s => String(s.id) === String(targetSessionId) || String(s._id) === String(targetSessionId));
        if (!found) {
          try {
            const storageKey = getLocalSessionsKey();
            const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
            found = local.find(s => String(s.id) === String(targetSessionId) || String(s._id) === String(targetSessionId));
          } catch (_) {}
        }
        if (found) {
          handleSelectPastSession(found.id || found._id);
          sessionStorage.removeItem('notetaker_target_tab');
          sessionStorage.removeItem('notetaker_target_session_id');
        }
      } else {
        sessionStorage.removeItem('notetaker_target_tab');
      }
    }
  }, [windowType, pastSessions]);

  useEffect(() => {
    if (activeTab === 'past') {
      fetchPastSessions();
    }
  }, [activeTab]);

  const displaySessions = pastSessions.map(sess => {
    const formattedDuration = sess.durationSeconds 
      ? `${Math.floor(sess.durationSeconds / 60)}:${String(sess.durationSeconds % 60).padStart(2, '0')}`
      : (sess.durationDisplay || '00:00');
    
    let formattedDate = sess.date || sess.payload?.date || '';
    if (!formattedDate && sess.createdAt) {
      try {
        formattedDate = new Date(sess.createdAt).toLocaleDateString();
      } catch (_) {}
    }
    if (!formattedDate) {
      formattedDate = new Date().toLocaleDateString();
    }

    return {
      id: sess.id || sess._id,
      title: sess.title || 'Untitled Session',
      date: formattedDate,
      duration: formattedDuration
    };
  });

  return (
    <div className={`interview-panel-root notetaker-root ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* Top Terracotta Navbar */}
      <header className="notetaker-top-navbar">
        <div className="notetaker-nav-left">
          <button
            className="notetaker-hamburger-btn"
            onClick={() => setShowNavDrawer(true)}
            type="button"
            title="Open Menu"
          >
            ☰
          </button>
          <BrandLogo onClick={handleBackToLanding} size="md" />
        </div>

        <div className="notetaker-nav-right">
          <button
            className="notetaker-hamburger-btn"
            onClick={toggleDarkMode}
            type="button"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{ fontSize: '13px' }}
          >
            <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
        </div>
      </header>

      {/* Main Page Container */}
      <div className="notetaker-container">
        {/* Top Hero Banner & Setup */}
        <section className="notetaker-hero-card">
          <div className="notetaker-banner-main">
            <div className="notetaker-banner-left">
              <div className="notetaker-banner-icon-badge">
                <i className="fa-solid fa-file-lines"></i>
              </div>
              <div className="notetaker-banner-text">
                <h2 className="notetaker-banner-title">Smart Notetaker</h2>
                <p className="notetaker-banner-subtitle">
                  Record your meetings, interviews or discussions and get AI-powered summaries, key points and translations.
                </p>
              </div>
            </div>

            <div className="notetaker-banner-center-actions">
              <button
                className="notetaker-toggle-setup-pill"
                type="button"
                onClick={() => setShowSetup(!showSetup)}
              >
                <i className="fa-solid fa-sparkles"></i>
                <span>{showSetup ? 'Hide setup' : 'Show setup'}</span>
                <i className={`fa-solid ${showSetup ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
              </button>

              {hasActiveRecordingRef.current && (
                <div className="notetaker-live-recording-indicator">
                  <span className="notetaker-ready-dot recording"></span>
                  <span>{recordingStatus === 'paused' ? 'Paused' : `Recording ${formatTimer(timerSeconds)}`}</span>
                  <button
                    className="notetaker-stop-btn-mini"
                    onClick={handleStartStopRecording}
                    type="button"
                  >
                    <i className="fa-solid fa-square"></i> Stop
                  </button>
                </div>
              )}
            </div>

            <div className="notetaker-banner-art-wrap">
              <img
                src={darkMode ? "/assets/notetaker_banner_art_dark.png" : "/assets/notetaker_banner_art.png"}
                alt="Smart Notetaker Notepad"
                className="notetaker-banner-art-img"
              />
            </div>
          </div>

          {/* Setup Row (Dropdowns) */}
          {showSetup && (
            <div className="notetaker-setup-pills-row">
              <div className="notetaker-setup-pill-col">
                <label className="notetaker-pill-label">SPEAKING IN</label>
                <div className="notetaker-select-pill-box">
                  <i className="fa-solid fa-globe notetaker-pill-leading-icon"></i>
                  <select
                    className="notetaker-pill-select"
                    value={spokenLang}
                    onChange={(e) => handleSpokenLangChange(e.target.value)}
                    disabled={isRecording}
                  >
                    {displayedLanguages.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                  <i className="fa-solid fa-chevron-down notetaker-pill-chevron"></i>
                </div>
              </div>

              <div className="notetaker-setup-pill-col">
                <label className="notetaker-pill-label">TRANSLATE TO</label>
                <div className="notetaker-select-pill-box">
                  <i
                    className="fa-solid fa-right-left notetaker-pill-leading-icon clickable"
                    onClick={handleSwapLanguages}
                    title="Swap languages"
                  ></i>
                  <select
                    className="notetaker-pill-select"
                    value={targetLang}
                    onChange={(e) => handleTargetLangChange(e.target.value)}
                    disabled={isRecording}
                  >
                    {displayedLanguages.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                  <i className="fa-solid fa-chevron-down notetaker-pill-chevron"></i>
                </div>
              </div>

              <div className="notetaker-setup-pill-col">
                <label className="notetaker-pill-label">RECORDING MODE</label>
                <div className="notetaker-select-pill-box">
                  <i className="fa-regular fa-circle-dot notetaker-pill-leading-icon"></i>
                  <select
                    className="notetaker-pill-select"
                    value={recordingMode}
                    onChange={(e) => {
                      if (hasActiveRecordingRef.current) return;
                      const m = e.target.value;
                      setRecordingMode(m);
                      recordingModeRef.current = m;
                    }}
                    disabled={hasActiveRecordingRef.current}
                  >
                    <option value="meeting">Meeting</option>
                    <option value="personal">Just me</option>
                  </select>
                  <i className="fa-solid fa-chevron-down notetaker-pill-chevron"></i>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Lower Workspace Card (Separated by page background gap) */}
        <section className="notetaker-workspace-card">
          {/* Tabs Bar */}
          <div className="notetaker-workspace-tabs-bar">
            <div className="notetaker-tabs-left">
              <button
                className={`notetaker-tab-item ${rightTab === 'live' ? 'active' : ''}`}
                onClick={() => setRightTab('live')}
                type="button"
              >
                <span className="notetaker-tab-soundwave">
                  <span></span><span></span><span></span>
                </span>
                <span>Transcript</span>
              </button>
              <button
                className={`notetaker-tab-item ${rightTab === 'notes' ? 'active' : ''}`}
                onClick={() => setRightTab('notes')}
                type="button"
              >
                <i className="fa-solid fa-sparkles"></i>
                <span>AI Summary</span>
              </button>
              <button
                className={`notetaker-tab-item ${rightTab === 'history' ? 'active' : ''}`}
                onClick={() => setRightTab('history')}
                type="button"
              >
                <i className="fa-solid fa-language"></i>
                <span>Translations</span>
              </button>
            </div>

            <div className="notetaker-more-dropdown-wrap" ref={moreMenuRef}>
              <button
                className={`notetaker-more-btn ${showMoreMenu ? 'active' : ''}`}
                type="button"
                onClick={() => setShowMoreMenu((prev) => !prev)}
                title="More options"
              >
                More <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px', marginLeft: '5px', transform: showMoreMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}></i>
              </button>

              {showMoreMenu && (
                <div className="notetaker-more-dropdown-menu">
                  <button
                    className={`notetaker-side-action-btn ${rightTab === 'notes' ? 'active' : ''}`}
                    onClick={() => {
                      setRightTab('notes');
                      setShowMoreMenu(false);
                    }}
                    type="button"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    <span>AI summary</span>
                  </button>
                  <button
                    className="notetaker-side-action-btn"
                    onClick={() => {
                      setShowExportModal(true);
                      setShowMoreMenu(false);
                    }}
                    type="button"
                  >
                    <i className="fa-solid fa-download"></i>
                    <span>Export</span>
                  </button>
                  <button
                    className="notetaker-side-action-btn"
                    onClick={() => {
                      handleEmailNotes();
                      setShowMoreMenu(false);
                    }}
                    type="button"
                  >
                    <i className="fa-regular fa-envelope"></i>
                    <span>Email</span>
                  </button>
                  <button
                    className="notetaker-side-action-btn"
                    onClick={() => {
                      handleCopyNotes();
                      setShowMoreMenu(false);
                    }}
                    type="button"
                  >
                    <i className="fa-regular fa-copy"></i>
                    <span>Copy</span>
                  </button>
                  <button
                    className="notetaker-side-action-btn clear-action"
                    onClick={() => {
                      handleClearSession();
                      setShowMoreMenu(false);
                    }}
                    type="button"
                  >
                    <i className="fa-regular fa-trash-can"></i>
                    <span>Clear</span>
                  </button>
                  <div className="notetaker-side-divider"></div>
                  <button
                    className="notetaker-side-action-btn"
                    onClick={() => {
                      setShowPastSessionsModal(true);
                      setShowMoreMenu(false);
                    }}
                    type="button"
                  >
                    <i className="fa-solid fa-clock-rotate-left"></i>
                    <span>Previous sessions</span>
                  </button>
                  <button
                    className="notetaker-side-action-btn"
                    onClick={() => {
                      setShowSettingsModal(true);
                      setShowMoreMenu(false);
                    }}
                    type="button"
                  >
                    <i className="fa-solid fa-sliders"></i>
                    <span>Settings</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main Workspace Split Body: Left Main Content + Right Action Toolbar */}
          <div className="notetaker-split-workspace">
            {/* Left Column (Transcript / Notes / Translations + Bottom Chat) */}
            <div className="notetaker-main-content-col">
              <div className="notetaker-content-scrollable">
                {rightTab === 'live' && (
                  <div className="notetaker-live-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    {activeQuestion && (
                      <div className="active-question-display" style={{ margin: '0 0 12px 0' }}>
                        <span className="active-question-label">Question Being Answered:</span>
                        <p className="active-question-text-val">{activeQuestion}</p>
                      </div>
                    )}

                    <div className="notetaker-chat-messages" ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto' }}>
                      {isRecording || chatMessages.some(m => m.sender === 'user') ? (
                        <>
                      {spokenLang && targetLang && spokenLang !== targetLang && (
                        <div className="notetaker-translation-header">
                          <div className="translation-header-col">{(languageOptions.find(l => l.code === spokenLang)?.name || spokenLang).toUpperCase()} - ORIGINAL</div>
                          <div className="translation-header-col">{(languageOptions.find(l => l.code === targetLang)?.name || targetLang).toUpperCase()} - TRANSLATION</div>
                        </div>
                      )}

                      {chatMessages.map((msg, idx) => {
                        const isSys = isSystemStatusMessage(msg) || msg.isSystem;

                        if (msg.sender === 'ai') {
                          return (
                            <div className={`notetaker-msg-bubble ai ${isSys ? 'notetaker-system-status-msg' : ''}`} key={msg.id || idx}>
                              <div className="msg-avatar">
                                <i className="fa-solid fa-robot"></i>
                              </div>
                              <div className="msg-text">
                                <div className="msg-text-content">{msg.text}</div>
                                {!isSys && msg.translation && (
                                  <div className="notetaker-ai-translation">
                                    <span><i className="fa-solid fa-language" aria-hidden="true"></i> {(languageOptions.find(l => l.code === targetLang)?.name || targetLang).toUpperCase()}</span>
                                    <div>{msg.translation}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (msg.messageType === 'chat') {
                          const targetLangName = languageOptions.find(l => l.code === targetLang)?.name || targetLang;
                          return (
                            <div className="notetaker-msg-bubble user notetaker-chat-prompt" key={msg.id || idx}>
                              <div className="msg-avatar">
                                <i className="fa-solid fa-comment-dots"></i>
                              </div>
                              <div className="msg-text">
                                <div className="msg-speaker-badge">Prompt</div>
                                <div className="msg-text-content">{msg.text}</div>
                                {spokenLang && targetLang && spokenLang !== targetLang && msg.translation && (
                                  <div className="notetaker-prompt-translation-box" style={{ 
                                    marginTop: '8px', 
                                    paddingTop: '6px', 
                                    borderTop: '1px dashed rgba(255, 255, 255, 0.25)',
                                    fontSize: '13px',
                                    color: '#86efac'
                                  }}>
                                    <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.85, marginBottom: '2px' }}>
                                      <i className="fa-solid fa-language"></i> {targetLangName}:
                                    </div>
                                    <div style={{ fontWeight: '500' }}>{msg.translation}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        const isTranslationActive = spokenLang && targetLang && spokenLang !== targetLang;

                        if (isTranslationActive) {
                          const targetLangNameUpper = (languageOptions.find(l => l.code === targetLang)?.name || targetLang).toUpperCase();
                          const userMsgs = chatMessages.filter(m => m.sender === 'user' && m.messageType !== 'chat');
                          const segmentNum = userMsgs.indexOf(msg) + 1;
                          
                          return (
                            <div className={`notetaker-translation-row ${msg.isQuestion ? 'highlighted-question' : ''}`} key={msg.id || idx}>
                              <div className="notetaker-translation-card original">
                                <div className="translation-card-header">
                                  <span className="card-num">#{String(segmentNum).padStart(2, '0')}</span>
                                  <span className="card-speaker" style={{ color: getSpeakerColor(msg.speakerName), fontWeight: 700 }}>{msg.speakerName}</span>
                                </div>
                                <div className="translation-card-text">{msg.text}</div>
                              </div>
                              <div className="notetaker-translation-card translation">
                                <div className="translation-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                  <span className="card-lang"><i className="fa-solid fa-language"></i> {targetLangNameUpper}</span>
                                </div>
                                <div className="translation-card-text">{msg.translation || 'Translating...'}</div>
                              </div>
                            </div>
                          );
                        }

                        const speakerDotColor = msg.isQuestion
                          ? '#f97316'
                          : (msg.isFeedback ? '#10b981' : (msg.speakerName?.toLowerCase().includes('interviewer') ? '#f97316' : '#3b82f6'));
                        const tagLabel = msg.isQuestion ? 'Question' : (msg.isFeedback ? 'Key feedback' : (msg.speakerName?.toLowerCase().includes('interviewer') ? 'Question' : 'Answer'));
                        const timeDisplay = msg.timestamp || msg.wallTime || 'Live';

                        return (
                          <div className={`notetaker-showcase-row ${msg.isQuestion ? 'highlighted-question' : ''}`} key={msg.id || idx}>
                            <span className="notetaker-showcase-dot" style={{ background: speakerDotColor }}></span>
                            <div className="notetaker-showcase-body">
                              <p className="notetaker-showcase-meta">
                                <span className="notetaker-showcase-time">
                                  <i className="fa-regular fa-clock"></i> {timeDisplay}
                                </span>
                                <span className="notetaker-showcase-speaker">
                                  {msg.speakerName || 'Speaker'}
                                </span>
                                <span className="notetaker-showcase-tag">
                                  <i className="fa-solid fa-tag"></i> {tagLabel}
                                </span>
                              </p>
                              <p className="notetaker-showcase-text">{msg.text}</p>
                            </div>
                          </div>
                        );
                      })}

                      {interimMsg && interimMsg.text && (
                        spokenLang && targetLang && spokenLang !== targetLang ? (
                          <div className="notetaker-translation-row interim-bubble" style={{ opacity: 0.75 }}>
                            <div className="notetaker-translation-card original">
                              <div className="translation-card-header">
                                <span className="card-num">#...</span>
                                <span className="card-speaker" style={{ color: getSpeakerColor(interimMsg.speakerName), fontWeight: 700 }}>{interimMsg.speakerName} <span style={{ fontStyle: 'italic', fontWeight: 'normal', color: '#aaa', marginLeft: '4px' }}>· typing...</span></span>
                              </div>
                              <div className="translation-card-text">{interimMsg.text}</div>
                            </div>
                            <div className="notetaker-translation-card translation">
                              <div className="translation-card-header">
                                <span className="card-lang"><i className="fa-solid fa-language"></i> {(languageOptions.find(l => l.code === targetLang)?.name || targetLang).toUpperCase()}</span>
                              </div>
                              <div className="translation-card-text" style={{ fontStyle: 'italic', color: '#888' }}>Typing...</div>
                            </div>
                          </div>
                        ) : (
                          <div className="notetaker-msg-bubble user interim-bubble" style={{ opacity: 0.75 }}>
                            <div className="msg-avatar">
                              <i className="fa-solid fa-user"></i>
                            </div>
                            <div className="msg-text">
                              <div className="msg-speaker-badge" style={{ fontWeight: 'bold', fontSize: '11px', color: getSpeakerColor(interimMsg.speakerName), marginBottom: '4px' }}>
                                {interimMsg.speakerName || 'Speaker 1'} <span style={{ fontStyle: 'italic', fontWeight: 'normal', color: '#aaa', marginLeft: '4px' }}>· typing...</span>
                              </div>
                              <div className="msg-text-content">{interimMsg.text}</div>
                            </div>
                          </div>
                        )
                      )}

                      {/* Showcase bottom status & wave equalizer */}
                      {(isRecording || chatMessages.length > 0) && (
                        <div className="notetaker-showcase-bottom-bar">
                          <div className="notetaker-wave-bars">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
                              <span key={i} className="notetaker-emerald-bar" style={{ animationDelay: `${i * 65}ms` }}></span>
                            ))}
                          </div>
                          <span className="notetaker-autosave-indicator">
                            auto-saving notes <span className="notetaker-typing-dots"><span></span><span></span><span></span></span>
                          </span>
                          <button
                            type="button"
                            className="notetaker-pdf-export-pill"
                            onClick={() => setShowExportModal(true)}
                          >
                            <i className="fa-solid fa-file-arrow-down"></i> Export to PDF
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="notetaker-empty-state notetaker-ready-view">
                      <div className="notetaker-ready-mic-cluster">
                        <div className="notetaker-flank-wave left">
                          <span></span><span></span><span></span>
                        </div>
                        <div className="notetaker-mic-circle">
                          <i className="fa-solid fa-microphone"></i>
                        </div>
                        <div className="notetaker-flank-wave right">
                          <span></span><span></span><span></span>
                        </div>
                      </div>
                      <h3 className="notetaker-empty-title">Ready to listen</h3>
                      <p className="notetaker-empty-desc">
                        Choose your language, then press Record. Your conversation and translation will appear here.
                      </p>
                      <button
                        type="button"
                        className="notetaker-ready-start-btn"
                        onClick={handleStartStopRecording}
                        disabled={recordingStatus === 'processing'}
                      >
                        <i className="fa-solid fa-microphone"></i>
                        <span>Start Recording</span>
                        <i className="fa-solid fa-arrow-right"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {rightTab === 'notes' && (
              <div className="notetaker-feedback-panel" ref={notesContainerRef} style={{ padding: '10px 0', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {isGenerating ? (
                  <div className="notetaker-empty-state">
                    <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', color: 'var(--notetaker-teal)', marginBottom: '16px' }}></i>
                    <h3 className="notetaker-empty-title">Generating Summary</h3>
                    <p className="notetaker-empty-desc">AI is analyzing the speech transcript and generating your bilingual summary...</p>
                  </div>
                ) : generatedNotes ? (
                  <div className="feedback-section" style={{ width: '100%' }}>
                    <h3 className="feedback-sec-title" style={{ color: darkMode ? '#ffffff' : '#0f172a', marginBottom: '12px', fontSize: '15px' }}>
                      <i className="fa-solid fa-wand-magic-sparkles" style={{ color: 'var(--notetaker-teal)', marginRight: '6px' }}></i>
                      AI Summary {displayedNotesLang ? `(${displayedNotesLang})` : ''}
                    </h3>
                    <div className="notetaker-notes-content" style={{ whiteSpace: 'pre-wrap', color: darkMode ? '#cbd5e1' : '#334155', lineHeight: '1.6', fontSize: '14px', background: darkMode ? '#030712' : '#f8fafc', padding: '18px', borderRadius: '8px', border: darkMode ? '1px solid #121e33' : '1px solid #e2e8f0', minHeight: '200px', width: '100%', wordBreak: 'break-word' }}>
                      {cleanNotesText(generatedNotes)}
                    </div>
                  </div>
                ) : (
                  <div className="notetaker-empty-state">
                    <div className="notetaker-doc-icon-box">
                      <svg width="22" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 2C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2H6Z" fill="#24d5dc" />
                        <path d="M14 2V8H20L14 2Z" fill={darkMode ? "#11383d" : "#008f99"} opacity="0.4" />
                      </svg>
                    </div>
                    <h3 className="notetaker-empty-title">No Notes Yet</h3>
                    <p className="notetaker-empty-desc">Complete a recording session to view generated notes in your spoken and target languages here.</p>
                  </div>
                )}
              </div>
            )}

            {rightTab === 'history' && (
              <div className="notetaker-history-panel" style={{ padding: '10px 0', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {isRecording && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '14px 0', gap: '8px' }}>
                    <div className="listening-indicator-pulse" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--nt-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 0 rgba(8, 127, 114, 0.7)', animation: 'pulse 1.5s infinite' }}>
                      <i className="fa-solid fa-microphone" style={{ fontSize: '16px', color: '#05161c' }}></i>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--nt-text-muted)', fontWeight: '500' }}>Listening &amp; Translating...</span>
                  </div>
                )}

                <div>
                  <div className="notetaker-field-label" style={{ marginBottom: '8px' }}>HISTORY</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(() => {
                      const uniqueHistory = translationHistory.reduce((acc, current) => {
                        const cleanOrig = (current.originalText || '').trim().toLowerCase();
                        if (!cleanOrig) return acc;

                        const existingIdx = acc.findIndex(item => (item.originalText || '').trim().toLowerCase() === cleanOrig);
                        if (existingIdx >= 0) {
                          acc[existingIdx] = current;
                          return acc;
                        }

                        const prefixIdx = acc.findIndex(item => {
                          const prevClean = (item.originalText || '').trim().toLowerCase();
                          return cleanOrig.startsWith(prevClean) || prevClean.startsWith(cleanOrig);
                        });

                        if (prefixIdx >= 0) {
                          if (cleanOrig.length >= (acc[prefixIdx].originalText || '').trim().length) {
                            acc[prefixIdx] = current;
                          }
                          return acc;
                        }

                        acc.push(current);
                        return acc;
                      }, []);

                      if (uniqueHistory.length === 0) {
                        return (
                          <div className="notetaker-empty-history-box">
                            No translation history yet. Start recording and speaking to begin.
                          </div>
                        );
                      }

                      return uniqueHistory.map((item, idx) => {
                        const itemKey = item.msgId || `${item.timestamp}_${idx}`;
                        const isSpeaking = currentlyPlayingMsgId === itemKey;

                        return (
                          <div key={idx} style={{ background: darkMode ? '#030712' : '#ffffff', border: darkMode ? '1px solid #121e33' : '1px solid #e2e8f0', boxShadow: darkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.04)', borderRadius: '8px', padding: '14px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '11px', color: 'var(--nt-text-muted)' }}>
                              <span>{item.timestamp}</span>
                              <span style={{ fontWeight: '600' }}>
                                {(languageOptions.find(l => l.code === item.sourceLang)?.name || item.sourceLang)} → {(languageOptions.find(l => l.code === item.targetLang)?.name || item.targetLang)}
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                              <div>
                                <div style={{ fontSize: '13.5px', color: darkMode ? '#94a3b8' : '#64748b', wordBreak: 'break-word', lineHeight: '1.4' }}>{item.originalText}</div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                <div style={{ fontSize: '13.5px', color: darkMode ? '#f1f5f9' : '#0f172a', fontWeight: '500', wordBreak: 'break-word', lineHeight: '1.4' }}>{item.translatedText}</div>
                                <button
                                  onClick={() => isSpeaking ? stopSpeaking() : speakText(item.translatedText, item.targetLang, itemKey)}
                                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--nt-cyan)', fontSize: '14px', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                                  type="button"
                                  title={isSpeaking ? "Stop translation" : "Replay translation"}
                                >
                                  <i className={isSpeaking ? "fa-solid fa-stop" : "fa-solid fa-play"}></i>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            )}
              </div>
            </div>


          </div>

          {/* Bottom Ask / Chat Bar (Only shown on live Transcript tab per screenshot) */}
          {rightTab === 'live' && (
            <>
              <form onSubmit={handleSendChat} className="notetaker-chat-bar">
                <input
                  type="text"
                  className="notetaker-chat-input"
                  placeholder="Ask about this meeting..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isSendingChat}
                />
                <button
                  className="notetaker-send-btn"
                  type="submit"
                  disabled={isSendingChat || !chatInput.trim()}
                  title="Send"
                >
                  <i className={`fa-solid ${isSendingChat ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                </button>
              </form>

              {/* Disclaimer inside card */}
              <div className="notetaker-card-disclaimer">
                <i className="fa-solid fa-circle-info notetaker-disclaimer-icon"></i>
                <span>AI can make mistakes. Check important details.</span>
              </div>
            </>
          )}
        </section>

        {/* Floating Help Headset Button */}
        <button
          className="notetaker-floating-help-btn"
          type="button"
          onClick={() => showToast?.('AI Assistant Help & Tips')}
          title="Help & Feedback"
        >
          <i className="fa-solid fa-headset"></i>
          <span className="notetaker-help-dot">?</span>
        </button>

        {/* Footer Links (Outside card) */}
        <footer className="notetaker-page-footer">
          <div className="notetaker-footer-links">
            <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a>
          </div>
        </footer>
      </div>

      {/* Navigation Drawer */}
      {showNavDrawer && (
        <div className="notetaker-drawer-overlay" onClick={() => setShowNavDrawer(false)}>
          <div className="notetaker-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="notetaker-drawer-header">
              <BrandLogo size="sm" />
              <button className="notetaker-drawer-close-btn" onClick={() => setShowNavDrawer(false)}>×</button>
            </div>

            <nav className="notetaker-drawer-nav">
              <button className="notetaker-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleBackToLanding(); }}>
                <i className="fa-solid fa-house"></i> Home
              </button>
              <button className="notetaker-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleGoToDashboard(); }}>
                <i className="fa-solid fa-chart-line"></i> Dashboard
              </button>
              <button className="notetaker-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleGoToPanel(); }}>
                <i className="fa-solid fa-rocket"></i> AI Copilot
              </button>
              <button className="notetaker-drawer-nav-item active">
                <i className="fa-solid fa-microphone"></i> Notetaker
              </button>
              <button className="notetaker-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleGoToVoiceAgent(); }}>
                <i className="fa-solid fa-robot"></i> Voice Agent
              </button>
              <button className="notetaker-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleGoToUpload(); }}>
                <i className="fa-solid fa-cloud-arrow-up"></i> Upload
              </button>
              <button className="notetaker-drawer-nav-item" onClick={() => { setShowNavDrawer(false); onGoToReferral?.(); }}>
                <i className="fa-solid fa-gift"></i> Refer &amp; Earn
              </button>
              <button className="notetaker-drawer-nav-item" onClick={() => { setShowNavDrawer(false); onGoToSubscription?.(); }}>
                <i className="fa-solid fa-crown"></i> Plans &amp; Pricing
              </button>
            </nav>

            <div className="notetaker-drawer-footer">
              <button className="notetaker-drawer-nav-item" onClick={toggleDarkMode}>
                <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i> {darkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
              <button className="notetaker-drawer-nav-item" onClick={handleLogoutClick} style={{ color: '#ef4444' }}>
                <i className="fa-solid fa-right-from-bracket" style={{ color: '#ef4444' }}></i> Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Previous Sessions Modal */}
      {showPastSessionsModal && (
        <div className="notetaker-simple-modal-overlay" onClick={() => setShowPastSessionsModal(false)}>
          <div className="notetaker-simple-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="notetaker-simple-modal-header">
              <h3><i className="fa-regular fa-clock"></i> Previous Sessions</h3>
              <button className="notetaker-simple-modal-close-btn" onClick={() => setShowPastSessionsModal(false)}>×</button>
            </div>
            <div className="notetaker-simple-modal-body">
              {displaySessions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {displaySessions.map((sess) => (
                    <div
                      key={sess.id}
                      onClick={() => {
                        handleSelectPastSession(sess.id);
                        setShowPastSessionsModal(false);
                      }}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--notetaker-border)',
                        background: 'var(--notetaker-card-bg)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600, color: 'var(--notetaker-text-main)' }}>{sess.title}</h4>
                        <span style={{ fontSize: '12px', color: 'var(--notetaker-text-muted)' }}>{sess.date}</span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--notetaker-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fa-regular fa-clock"></i> {sess.duration}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--notetaker-text-muted)', fontSize: '13px' }}>
                  No past sessions saved yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="notetaker-simple-modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="notetaker-simple-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="notetaker-simple-modal-header">
              <h3><i className="fa-solid fa-gear"></i> Notetaker Settings</h3>
              <button className="notetaker-simple-modal-close-btn" onClick={() => setShowSettingsModal(false)}>×</button>
            </div>
            <div className="notetaker-simple-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--notetaker-text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                  Translation Engine
                </label>
                <div className="notetaker-select-wrap">
                  <select
                    className="notetaker-dropdown-select"
                    value={translationEngine}
                    onChange={(e) => handleTranslationEngineChange(e.target.value)}
                    disabled={isRecording}
                  >
                    <option value="google">Google Translation</option>
                    <option value="deepgram">Deepgram (AI translation)</option>
                    <option value="sarvam">Sarvam</option>
                  </select>
                  <i className="fa-solid fa-chevron-down notetaker-select-chevron"></i>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--notetaker-border)' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--notetaker-text-main)' }}>Line-by-Line Mode</div>
                  <div style={{ fontSize: '12px', color: 'var(--notetaker-text-muted)' }}>Display speech split segment by segment</div>
                </div>
                <button
                  type="button"
                  onClick={() => setLineByLineMode(prev => !prev)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid ' + (lineByLineMode ? 'var(--notetaker-teal)' : 'var(--notetaker-border)'),
                    background: lineByLineMode ? 'var(--notetaker-teal-light)' : 'transparent',
                    color: lineByLineMode ? 'var(--notetaker-teal)' : 'var(--notetaker-text-muted)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {lineByLineMode ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--notetaker-border)' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--notetaker-text-main)' }}>Dark Theme</div>
                  <div style={{ fontSize: '12px', color: 'var(--notetaker-text-muted)' }}>Toggle between light and dark modes</div>
                </div>
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--notetaker-border)',
                    background: 'transparent',
                    color: 'var(--notetaker-text-main)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i> {darkMode ? 'Light' : 'Dark'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Export transcript modal popup */}
      {showExportModal && (
        <div className="notetaker-modal-overlay">
          <div className="notetaker-modal-card">
            <div className="notetaker-modal-header">
              <h3>Export transcript</h3>
              <button className="notetaker-modal-close-btn" onClick={() => setShowExportModal(false)}>×</button>
            </div>
            <p className="notetaker-modal-desc">Choose what to include and the file format.</p>
            
            <div className="notetaker-modal-section">
              <h4 className="notetaker-modal-section-title">INCLUDE</h4>
              <div className="notetaker-modal-options">
                <label className={`notetaker-modal-option-row ${exportInclude === 'original' ? 'checked' : ''}`} onClick={() => setExportInclude('original')}>
                  <div className="notetaker-modal-option-checkbox"></div>
                  <span className="notetaker-modal-option-text">Original</span>
                </label>
                <label className={`notetaker-modal-option-row ${exportInclude === 'translation' ? 'checked' : ''}`} onClick={() => setExportInclude('translation')}>
                  <div className="notetaker-modal-option-checkbox"></div>
                  <span className="notetaker-modal-option-text">Translation</span>
                </label>
                <label className={`notetaker-modal-option-row ${exportInclude === 'both' ? 'checked' : ''}`} onClick={() => setExportInclude('both')}>
                  <div className="notetaker-modal-option-checkbox"></div>
                  <span className="notetaker-modal-option-text">Both side-by-side</span>
                </label>
                <label className={`notetaker-modal-option-row ${exportInclude === 'summary' ? 'checked' : ''}`} onClick={() => setExportInclude('summary')}>
                  <div className="notetaker-modal-option-checkbox"></div>
                  <span className="notetaker-modal-option-text">AI summary</span>
                </label>
              </div>
            </div>

            <div className="notetaker-modal-section">
              <h4 className="notetaker-modal-section-title">FORMAT</h4>
              <div className="notetaker-modal-options">
                <label className={`notetaker-modal-option-row ${exportFormat === 'pdf' ? 'checked' : ''}`} onClick={() => setExportFormat('pdf')}>
                  <div className="notetaker-modal-option-checkbox"></div>
                  <span className="notetaker-modal-option-text">PDF Document</span>
                </label>
                <label className={`notetaker-modal-option-row ${exportFormat === 'txt' ? 'checked' : ''}`} onClick={() => setExportFormat('txt')}>
                  <div className="notetaker-modal-option-checkbox"></div>
                  <span className="notetaker-modal-option-text">Plain text (Notepad)</span>
                </label>
              </div>
            </div>

            <div className="notetaker-modal-section">
              <h4 className="notetaker-modal-section-title">OPTIONS</h4>
              <div className="notetaker-modal-options">
                <label 
                  className={`notetaker-modal-option-row ${exportIncludeAiChat ? 'checked' : ''}`} 
                  onClick={() => setExportIncludeAiChat(prev => !prev)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="notetaker-modal-option-checkbox"></div>
                  <span className="notetaker-modal-option-text">Include AI Copilot Prompts &amp; Answers</span>
                </label>
              </div>
            </div>

            <div className="notetaker-modal-actions">
              <button className="notetaker-modal-btn-cancel" onClick={() => setShowExportModal(false)}>Cancel</button>
              <button className="notetaker-modal-btn-download" onClick={handleExportDownload}>
                <i className="fa-solid fa-download"></i> Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Session modal popup */}
      {showSaveSessionModal && (
        <div className="notetaker-modal-overlay" style={{ zIndex: 9999 }}>
          <div 
            className="notetaker-modal-card" 
            style={{ 
              maxWidth: '560px', 
              width: '90%', 
              background: darkMode ? '#12121c' : '#ffffff', 
              borderColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1',
              boxShadow: darkMode ? '0 20px 40px rgba(0, 0, 0, 0.5)' : '0 20px 40px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div className="notetaker-modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <h3 style={{ color: darkMode ? '#ffffff' : '#121e33', fontSize: '18px', margin: 0 }}>Stop &amp; Save Session</h3>
              <button 
                className="notetaker-modal-close-btn" 
                onClick={() => setShowSaveSessionModal(false)}
                style={{ color: darkMode ? '#94a3b8' : '#64748b' }}
              >×</button>
            </div>
            <p className="notetaker-modal-desc" style={{ color: darkMode ? 'rgba(255, 255, 255, 0.6)' : '#64748b', fontSize: '14px', marginTop: '8px', marginBottom: '16px' }}>
              Please enter a name for this session to save it to your Past Sessions history.
            </p>
            
            <div className="notetaker-modal-section" style={{ marginTop: '8px' }}>
              <label 
                className="notetaker-label" 
                style={{ 
                  fontWeight: 'bold', 
                  display: 'block', 
                  marginBottom: '8px', 
                  color: darkMode ? '#cbd5e1' : '#475569',
                  fontSize: '12px'
                }}
              >
                Notes Name
              </label>
              <input
                type="text"
                className="notetaker-input"
                placeholder={getDefaultSessionTitle()}
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveSessionConfirm(false);
                  }
                }}
                autoFocus
                autoComplete="off"
                style={{ 
                  width: '100%', 
                  boxSizing: 'border-box',
                  color: darkMode ? '#ffffff' : '#121e33',
                  background: darkMode ? '#1e1e2f' : '#f8fafc',
                  border: darkMode ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div 
              className="notetaker-modal-actions" 
              style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end', 
                marginTop: '28px',
                borderTop: 'none',
                paddingTop: 0
              }}
            >
              <button 
                className="notetaker-modal-btn-cancel" 
                onClick={() => setShowSaveSessionModal(false)}
                type="button"
                style={{ 
                  marginRight: 'auto',
                  height: '42px',
                  borderRadius: '10px',
                  border: darkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #cbd5e1',
                  color: darkMode ? '#cbd5e1' : '#475569',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  padding: '0 16px'
                }}
              >
                Cancel (Keep Recording)
              </button>
              <button 
                className="notetaker-modal-btn-cancel" 
                onClick={() => handleSaveSessionConfirm(true)}
                type="button"
                style={{ 
                  background: '#ef4444', 
                  color: '#ffffff', 
                  border: 'none',
                  height: '42px',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  padding: '0 18px',
                  cursor: 'pointer'
                }}
              >
                Stop &amp; Discard
              </button>
              <button 
                className="notetaker-modal-btn-download" 
                onClick={() => handleSaveSessionConfirm(false)}
                type="button"
                style={{ 
                  background: '#00cbd6',
                  color: '#0c101a',
                  height: '42px',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  padding: '0 20px',
                  cursor: 'pointer',
                  opacity: 1,
                  boxShadow: '0 4px 12px rgba(0, 203, 214, 0.25)'
                }}
              >
                Stop &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Centralized Credit-Based Restriction & Usage Modal */}
      <CreditUsagePromptModal
        isOpen={creditPromptModal.isOpen}
        onClose={() => setCreditPromptModal(prev => ({ ...prev, isOpen: false, pendingAction: null }))}
        type={creditPromptModal.type}
        title={creditPromptModal.title}
        message={creditPromptModal.message}
        fileDetails={creditPromptModal.fileDetails}
        onConfirm={handleConfirmCreditPrompt}
        onTopUp={handleTopUpFromCreditModal}
        showToast={showToast}
        darkMode={darkMode}
      />

      <PdfCustomizerModal
        isOpen={pdfCustomizerModal.isOpen}
        onClose={() => setPdfCustomizerModal(prev => ({ ...prev, isOpen: false }))}
        reportData={pdfCustomizerModal.reportData}
        defaultFilename={pdfCustomizerModal.filename}
        onConfirmDownload={handleConfirmPdfCustomizerDownload}
        showToast={showToast}
        darkMode={darkMode}
      />
    </div>
  );

}
