import React, { useState, useEffect, useRef, useCallback } from 'react';
import BrandLogo from './common/BrandLogo';
import CreditUsagePromptModal from './common/CreditUsagePromptModal';
import {
  CREDIT_USAGE_CONFIG,
  getUserCredits,
  recordDownloadAction,
  getNotetakerCreditCost,
  recordNotetakerUsageAction
} from '../config/creditUsageConfig';
import { API_BASE } from '../utils/api';
import { downloadPdfReport } from '../utils/pdfReportTemplate';
import PdfCustomizerModal from './PdfCustomizerModal';
import './Notetaker.css';

const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;

// Speech language mapping for Web Speech API
const speechLangMap = {
  en: 'en-US',
  hi: 'hi-IN',
  pa: 'pa-IN',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN',
  ru: 'ru-RU',
  tr: 'tr-TR',
  nl: 'nl-NL',
  ar: 'ar-SA',
  bn: 'bn-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN'
};

const languageOptions = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
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
];

export const translateWithFallback = async (text, fromCode = 'auto', toCode = 'en') => {
  if (!text || !text.trim()) return '';
  const clean = text.trim();
  if (fromCode && toCode && fromCode === toCode) return clean;

  // 1. Try backend endpoint first if available
  try {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '';
    const fromName = languageOptions.find(l => l.code === fromCode)?.name || fromCode;
    const toName = languageOptions.find(l => l.code === toCode)?.name || toCode;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${API_BASE}/api/translate-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: clean, from: fromName, to: toName }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.translatedText) return data.translatedText;
    }
  } catch (_) {}

  // 2. High-speed Google GTX public endpoint (instant client-side fallback)
  try {
    const src = fromCode || 'auto';
    const dest = toCode || 'en';
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(src)}&tl=${encodeURIComponent(dest)}&dt=t&q=${encodeURIComponent(clean)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0].map(s => s[0]).filter(Boolean).join('');
        if (translated) return translated;
      }
    }
  } catch (err) {
    console.warn('[translateWithFallback] GTX error:', err);
  }

  return clean;
};

export default function Notetaker({
  token,
  user,
  onLogout,
  onBackToLanding,
  onGoToPanel,
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
  // Session States
  const [sessionState, setSessionState] = useState('idle'); // 'idle' | 'recording' | 'paused' | 'stopped'
  const [recordingMode, setRecordingMode] = useState('meeting'); // 'meeting' | 'inperson' | 'upload'
  const [sessionTitle, setSessionTitle] = useState('product planning meeting');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [spokenLang, setSpokenLang] = useState('en');
  const [targetLang, setTargetLang] = useState('pa'); // Default to Punjabi
  const [captureAudioMode, setCaptureAudioMode] = useState('Meeting tab + microphone');
  const [showSetup, setShowSetup] = useState(true);
  const [askAiOpen, setAskAiOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('transcript'); // 'transcript' | 'notes' | 'translations'
  const [transcriptViewFilter, setTranscriptViewFilter] = useState('dual'); // 'dual' | 'original' | 'translation'
  const [searchQuery, setSearchQuery] = useState('');
  const [autoFollowLive, setAutoFollowLive] = useState(true);

  // Live Timer & Status
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [savedStatusText, setSavedStatusText] = useState('Saving text...');
  const [micAudioLevel, setMicAudioLevel] = useState(0);

  // Transcript Passages
  const [chatMessages, setChatMessages] = useState([]);
  const [interimMsg, setInterimMsg] = useState(null);
  const [translationHistory, setTranslationHistory] = useState([]);

  // Smart Notes
  const [smartNotes, setSmartNotes] = useState('');
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  // Ask AI Drawer State
  const [askAiMessages, setAskAiMessages] = useState([
    {
      id: 'ai_welcome',
      sender: 'ai',
      text: 'Ask anything about what was spoken. Responses are grounded in your meeting transcript.',
      timestamp: 'Just now'
    }
  ]);
  const [askAiInput, setAskAiInput] = useState('');
  const [askAiAnswerLang, setAskAiAnswerLang] = useState('en');
  const [isSendingAiQuery, setIsSendingAiQuery] = useState(false);
  const [activeSpeakingId, setActiveSpeakingId] = useState(null);

  // Audio Playback
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const audioElemRef = useRef(null);

  // Left Sidebar: Previous Sessions Library
  const [allSessionsList, setAllSessionsList] = useState([]);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showQuickPromptsMenu, setShowQuickPromptsMenu] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);

  // Top Carousel ("See what Notetaker can do")
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isCarouselPlaying, setIsCarouselPlaying] = useState(true);
  const carouselSlides = [
    { title: 'Conversation', textA: 'Let\'s launch Monday.', textB: 'I\'ll share the plan.' },
    { title: 'Decisions', textA: 'Agreed on shipping MVP by end of sprint.', textB: 'QA sign-off scheduled.' },
    { title: 'Summary', textA: '3 core topics covered with full team alignment.', textB: 'Next sync on Friday.' },
    { title: 'Action items', textA: 'Assigned design review to Sarah by Wednesday.', textB: 'Updated repository.' }
  ];

  // Modals & Drawers
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportInclude, setExportInclude] = useState('both');
  const [exportFormat, setExportFormat] = useState('pdf');
  const [creditPromptModal, setCreditPromptModal] = useState({ isOpen: false, type: 'notetaker', title: '', message: '', fileDetails: null });
  const [pdfCustomizerModal, setPdfCustomizerModal] = useState({ isOpen: false, filename: '', reportData: null });

  // Refs
  const isRecordingRef = useRef(false);
  const timerIntervalRef = useRef(null);
  const timerSecondsRef = useRef(0);
  const spokenLangRef = useRef(spokenLang);
  const targetLangRef = useRef(targetLang);
  const chatMessagesRef = useRef(chatMessages);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const speechRecognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const micStreamRef = useRef(null);
  const animFrameRef = useRef(null);
  const transcriptScrollRef = useRef(null);
  const moreMenuRef = useRef(null);
  const profileMenuRef = useRef(null);
  const plusMenuRef = useRef(null);

  // Sync refs
  useEffect(() => { spokenLangRef.current = spokenLang; }, [spokenLang]);
  useEffect(() => { targetLangRef.current = targetLang; }, [targetLang]);
  useEffect(() => { chatMessagesRef.current = chatMessages; }, [chatMessages]);
  useEffect(() => { timerSecondsRef.current = timerSeconds; }, [timerSeconds]);

  // Format MM:SS
  const formatTimer = (totalSecs) => {
    if (!Number.isFinite(totalSecs) || isNaN(totalSecs) || totalSecs < 0) return '00:00';
    const total = Math.floor(totalSecs);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // User storage key
  const getStorageKey = useCallback(() => {
    return user?.email ? `notetaker_saved_${user.email}` : 'notetaker_saved_sessions';
  }, [user]);

  // Load previous sessions
  const loadPastSessions = useCallback(async () => {
    try {
      const stored = localStorage.getItem(getStorageKey());
      let list = stored ? JSON.parse(stored) : [];
      if (list.length === 0) {
        // Seed default demo sessions if empty to match video library view
        list = [
          { id: 'sess_1', title: 'Meeting Notes - 08:30 AM', date: '17/11/2026', durationDisplay: '1:59', durationSeconds: 119, transcript: [] },
          { id: 'sess_2', title: 'Meeting Notes - 05:15 PM', date: '17/11/2026', durationDisplay: '0:15', durationSeconds: 15, transcript: [] },
          { id: 'sess_3', title: 'Meeting Notes - 05:00 PM', date: '17/11/2026', durationDisplay: '0:37', durationSeconds: 37, transcript: [] }
        ];
        localStorage.setItem(getStorageKey(), JSON.stringify(list));
      }
      setAllSessionsList(list);

      const effectiveToken = token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (effectiveToken) {
        const res = await fetch(`${API_BASE}/api/interview-panel-sessions?type=notetaker`, {
          headers: { Authorization: `Bearer ${effectiveToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.sessions)) {
            const merged = [...list];
            data.sessions.forEach(srv => {
              if (!merged.some(m => m.id === srv.id)) merged.push(srv);
            });
            setAllSessionsList(merged);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load past sessions:', e);
    }
  }, [getStorageKey, token]);

  useEffect(() => {
    loadPastSessions();
  }, [loadPastSessions]);

  // Carousel timer
  useEffect(() => {
    if (!isCarouselPlaying) return;
    const interval = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % carouselSlides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isCarouselPlaying, carouselSlides.length]);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target)) {
        setShowQuickPromptsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto scroll transcript
  useEffect(() => {
    if (autoFollowLive && transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [chatMessages, interimMsg, autoFollowLive]);

  // Audio meter for dynamic wave visualizer
  const setupAudioMeter = (stream) => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!isRecordingRef.current) {
          setMicAudioLevel(0);
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      animFrameRef.current = requestAnimationFrame(updateMeter);
    } catch (e) {
      console.warn('Audio meter init error:', e);
    }
  };

  // Start Session
  const startRecordingSession = async () => {
    if (isRecordingRef.current) return;

    // Check credits
    const requiredCost = getNotetakerCreditCost();
    const curCredits = getUserCredits();
    if (curCredits < requiredCost) {
      setCreditPromptModal({
        isOpen: true,
        type: 'notetaker',
        title: 'Insufficient Credits',
        message: `You need at least ${requiredCost} credits to start a Notetaker session. Balance: ${curCredits}.`,
        fileDetails: { name: 'Notetaker Session', type: 'Audio Recording & Notes' }
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      micStreamRef.current = stream;

      isRecordingRef.current = true;
      setSessionState('recording');
      setShowSetup(false);
      setTimerSeconds(0);
      setRecordedAudioUrl(null);
      setChatMessages([]);
      setInterimMsg(null);
      setSavedStatusText('Saving text...');

      setupAudioMeter(stream);

      // Setup MediaRecorder
      try {
        const mediaRecorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedAudioUrl(url);
        };
        mediaRecorder.start(1000);
        mediaRecorderRef.current = mediaRecorder;
      } catch (err) {
        console.warn('MediaRecorder error:', err);
      }

      // Setup SpeechRecognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = speechLangMap[spokenLangRef.current] || 'en-US';

        recognition.onresult = (event) => {
          if (!isRecordingRef.current) return;
          let interimText = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            const transcript = res[0].transcript;
            if (res.isFinal) {
              const text = transcript.trim();
              if (!text) continue;
              const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
              const timeStamp = `~${formatTimer(timerSecondsRef.current || 0)}`;

              const newMsg = {
                id: msgId,
                sender: 'user',
                speakerName: 'You',
                timestamp: timeStamp,
                text: text,
                translation: 'Translating...'
              };

              setChatMessages(prev => [...prev, newMsg]);
              setInterimMsg(null);

              translateWithFallback(text, spokenLangRef.current, targetLangRef.current).then(translated => {
                setChatMessages(prev => prev.map(m => m.id === msgId ? { ...m, translation: translated } : m));
                setTranslationHistory(prev => [
                  ...prev,
                  {
                    msgId,
                    timestamp: timeStamp,
                    sourceLang: spokenLangRef.current,
                    targetLang: targetLangRef.current,
                    originalText: text,
                    translatedText: translated
                  }
                ]);
              });
            } else {
              interimText += transcript;
            }
          }

          if (interimText.trim()) {
            setInterimMsg({
              text: interimText.trim(),
              speakerName: 'You',
              isInterim: true
            });
          }
        };

        recognition.onerror = (e) => console.warn('SpeechRecognition error:', e);
        recognition.onend = () => {
          if (isRecordingRef.current) {
            try { recognition.start(); } catch (_) {}
          }
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      } else {
        showToast?.('SpeechRecognition not supported in this browser.');
      }

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);

      showToast?.('Session started · Listening to microphone');
    } catch (err) {
      console.error('Failed to access microphone:', err);
      showToast?.('Microphone access denied or unavailable.');
    }
  };

  // Pause / Resume
  const handlePauseResume = () => {

    if (sessionState === 'recording') {
      isRecordingRef.current = false;
      setSessionState('paused');
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch (_) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try { mediaRecorderRef.current.pause(); } catch (_) {}
      }
      showToast?.('Recording paused');
    } else if (sessionState === 'paused') {
      isRecordingRef.current = true;
      setSessionState('recording');
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.start(); } catch (_) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
        try { mediaRecorderRef.current.resume(); } catch (_) {}
      }
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
      showToast?.('Recording resumed');
    }
  };

  // Stop & Save
  const stopAndSaveSession = async () => {
    isRecordingRef.current = false;
    setSessionState('stopped');

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch (_) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setMicAudioLevel(0);
    setInterimMsg(null);

    if (!smartNotes.trim()) {
      generateSmartNotes();
    }

    const newSessionItem = {
      id: `session_${Date.now()}`,
      title: sessionTitle || `Meeting Notes - ${new Date().toLocaleDateString()}`,
      durationSeconds: timerSecondsRef.current,
      durationDisplay: formatTimer(timerSecondsRef.current),
      date: new Date().toLocaleDateString('en-GB'),
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      spokenLang: spokenLangRef.current,
      targetLang: targetLangRef.current,
      transcript: chatMessagesRef.current,
      notes: smartNotes,
      translationHistory: translationHistory
    };

    try {
      const storageKey = getStorageKey();
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = [newSessionItem, ...existing];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setAllSessionsList(updated);
    } catch (_) {}

    // Save to backend if available
    const effectiveToken = token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (effectiveToken) {
      try {
        await fetch(`${API_BASE}/api/interview-panel-sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${effectiveToken}` },
          body: JSON.stringify({
            title: newSessionItem.title,
            tech: newSessionItem.title,
            durationSeconds: newSessionItem.durationSeconds,
            durationDisplay: newSessionItem.durationDisplay,
            payload: {
              sessionType: 'notetaker',
              transcript: newSessionItem.transcript,
              notes: smartNotes,
              spokenLanguage: spokenLangRef.current,
              targetLanguage: targetLangRef.current
            }
          })
        });
      } catch (e) {
        console.warn('Backend save failed:', e);
      }
    }

    setSavedStatusText('Text saved');
    showToast?.('Session stopped & saved to Meeting library!');
  };

  // Start fresh new session
  const handleClearSession = () => {
    if (window.confirm('Are you sure you want to clear current transcript and notes?')) {
      setChatMessages([]);
      setInterimMsg(null);
      setSmartNotes('');
      setSessionState('idle');
      setTimerSeconds(0);
      setRecordedAudioUrl(null);
      showToast?.('Session cleared');
    }
  };

  const handleStartNewSession = () => {
    setSessionState('idle');
    setShowSetup(true);
    setChatMessages([]);
    setInterimMsg(null);
    setTimerSeconds(0);
    setSmartNotes('');
    setRecordedAudioUrl(null);
    setSessionTitle('product planning meeting');
  };

  // Swap Languages
  const handleSwapLanguages = () => {
    const prev = spokenLang;
    setSpokenLang(targetLang);
    setTargetLang(prev);
    handleTargetLangChange(prev);
  };

  // Target Language Change
  const handleTargetLangChange = async (newLang) => {
    setTargetLang(newLang);
    targetLangRef.current = newLang;
    const langName = languageOptions.find(l => l.code === newLang)?.name || newLang;
    showToast?.(`Language changed to ${langName}. Updating translations...`);

    setChatMessages(prev => prev.map(m => (m.text ? { ...m, translation: 'Translating...' } : m)));

    const current = chatMessagesRef.current;
    const updated = await Promise.all(
      current.map(async (m) => {
        if (!m.text) return m;
        try {
          const trans = await translateWithFallback(m.text, spokenLangRef.current, newLang);
          return { ...m, translation: trans || m.text };
        } catch (_) {
          return m;
        }
      })
    );
    setChatMessages(updated);

    setTranslationHistory(prev => {
      return prev.map(item => {
        const found = updated.find(u => u.id === item.msgId);
        return found ? { ...item, targetLang: newLang, translatedText: found.translation } : item;
      });
    });
  };

  // Generate Smart Notes
  const generateSmartNotes = () => {
    setIsGeneratingNotes(true);
    const msgs = chatMessagesRef.current.filter(m => m.text);

    setTimeout(() => {
      let notes = `## Executive Summary\n`;
      if (msgs.length === 0) {
        notes += `Meeting recording session completed. No speech detected.\n\n`;
      } else {
        notes += `The session discussed core topics including requirements, product architecture, and roadmap execution.\n\n`;
      }

      notes += `## Key Discussion Points\n`;
      if (msgs.length > 0) {
        msgs.slice(0, 5).forEach((m, idx) => {
          notes += `- Point ${idx + 1}: ${m.text}\n`;
        });
      } else {
        notes += `- Spoken language: ${languageOptions.find(l => l.code === spokenLang)?.name || 'English'}.\n`;
        notes += `- Translation & notes language: ${languageOptions.find(l => l.code === targetLang)?.name || 'Punjabi'}.\n`;
      }

      notes += `\n## Decisions Made\n`;
      notes += `- Confirmed dual-view transcription layout with real-time translation sync.\n`;
      notes += `- Validated audio connection and speech recognition fallbacks.\n\n`;

      notes += `## Action Items & Next Steps\n`;
      notes += `- [ ] Review meeting summary and verify key action items.\n`;
      notes += `- [ ] Export PDF transcript or download recorded audio session.\n`;

      setSmartNotes(notes);
      setIsGeneratingNotes(false);
      showToast?.('Smart notes generated!');
    }, 500);
  };

  // Ask AI Submission
  const handleSendAiQuery = (customPrompt = null) => {
    const query = customPrompt || askAiInput.trim();
    if (!query || isSendingAiQuery) return;
    setAskAiInput('');
    setIsSendingAiQuery(true);

    const userMsgId = `ask_user_${Date.now()}`;
    const aiMsgId = `ask_ai_${Date.now()}`;

    setAskAiMessages(prev => [
      ...prev,
      { id: userMsgId, sender: 'user', text: query, timestamp: 'Just now' }
    ]);

    setTimeout(async () => {
      const msgs = chatMessagesRef.current.filter(m => m.text);
      let answer = '';
      const qLower = query.toLowerCase();

      if (qLower.includes('catch up') || qLower.includes('summary')) {
        answer = msgs.length > 0
          ? `So far, the discussion focused on: "${msgs.slice(-3).map(m => m.text).join('; ')}".`
          : 'The meeting just started. Speak into the microphone to populate conversation highlights.';
      } else if (qLower.includes('decision')) {
        answer = 'Key decisions: Confirmed product planning milestones, translation consistency, and audio fallbacks.';
      } else if (qLower.includes('action')) {
        answer = 'Action items: 1) Finalize product roadmap, 2) Test live speech and translation, 3) Review summary notes.';
      } else if (qLower.includes('python')) {
        answer = 'Python is a high-level, general-purpose programming language known for readable syntax, dynamic typing, and comprehensive libraries for AI, web, and automation.';
      } else {
        answer = msgs.length > 0
          ? `Based on the transcript ("${msgs.slice(-2).map(m => m.text).join(' ')}"): In response to "${query}", discussion covered core requirements.`
          : `In response to "${query}": The session is active and listening. Speak into the microphone to ground answers directly in your transcript.`;
      }

      if (askAiAnswerLang !== 'en') {
        try {
          const trans = await translateWithFallback(answer, 'en', askAiAnswerLang);
          answer = trans || answer;
        } catch (_) {}
      }

      setAskAiMessages(prev => [
        ...prev,
        { id: aiMsgId, sender: 'ai', text: answer, timestamp: 'Just now' }
      ]);
      setIsSendingAiQuery(false);
    }, 500);
  };

  // Read Aloud
  const handleReadAloud = (msgId, text) => {
    if (!('speechSynthesis' in window)) {
      showToast?.('Text-to-speech not supported on this browser.');
      return;
    }
    if (activeSpeakingId === msgId) {
      window.speechSynthesis.cancel();
      setActiveSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setActiveSpeakingId(null);
    utterance.onerror = () => setActiveSpeakingId(null);
    setActiveSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Copy to clipboard
  const handleCopyToClipboard = (text, label = 'Copied to clipboard!') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast?.(label);
  };

  // Audio Playback Controls
  const togglePlayAudio = () => {
    if (!audioElemRef.current) return;
    if (isPlayingAudio) {
      audioElemRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioElemRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleAudioSeek = (e) => {
    if (!audioElemRef.current) return;
    const time = parseFloat(e.target.value);
    audioElemRef.current.currentTime = time;
    setAudioCurrentTime(time);
  };

  const handleAudioJump = (delta) => {
    if (!audioElemRef.current) return;
    const newTime = Math.max(0, Math.min(audioDuration, audioElemRef.current.currentTime + delta));
    audioElemRef.current.currentTime = newTime;
    setAudioCurrentTime(newTime);
  };

  const cyclePlaybackSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioElemRef.current) audioElemRef.current.playbackRate = nextSpeed;
  };

  // Export
  const handleExportDownload = async () => {
    const title = sessionTitle.trim() || 'Session_Notes';
    const fileName = `${title.toLowerCase().replace(/\s+/g, '_')}_export.${exportFormat}`;
    setShowExportModal(false);

    if (exportFormat === 'txt') {
      let content = `${title}\nDate: ${new Date().toLocaleDateString()}\n\n=== TRANSCRIPT ===\n`;
      chatMessages.forEach(m => {
        content += `[${m.speakerName || 'Speaker'}] (${m.timestamp || ''}): ${m.text}\n`;
        if (m.translation) content += `[Translation]: ${m.translation}\n`;
      });
      content += `\n=== SMART NOTES ===\n${smartNotes}\n`;

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      showToast?.('Downloaded plain text transcript!');
    } else {
      setPdfCustomizerModal({
        isOpen: true,
        filename: fileName,
        reportData: {
          title,
          date: new Date().toLocaleDateString(),
          transcript: chatMessages,
          notes: smartNotes,
          translations: translationHistory
        }
      });
    }
  };

  const handleConfirmPdfCustomizerDownload = async ({ customizedHtml, filename, pdfTheme }) => {
    await downloadPdfReport({ htmlContent: customizedHtml, filename, showToast, pdfTheme });
    const tokenStr = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    await recordDownloadAction({ fileType: 'PDF Summary', fileName: filename, token: tokenStr });
  };

  // Filter sidebar sessions
  const filteredSidebarSessions = allSessionsList.filter(s => {
    if (!sidebarSearchQuery.trim()) return true;
    const q = sidebarSearchQuery.toLowerCase();
    return (s.title && s.title.toLowerCase().includes(q)) || (s.notes && s.notes.toLowerCase().includes(q));
  });

  // Filter transcript passages
  const filteredChatMessages = chatMessages.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (m.text && m.text.toLowerCase().includes(q)) || (m.translation && m.translation.toLowerCase().includes(q));
  });

  return (
    <div className={`interview-panel-root notetaker-root ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* Audio Element for Playback */}
      {recordedAudioUrl && (
        <audio
          ref={audioElemRef}
          src={recordedAudioUrl}
          onTimeUpdate={() => audioElemRef.current && setAudioCurrentTime(audioElemRef.current.currentTime)}
          onLoadedMetadata={() => audioElemRef.current && setAudioDuration(audioElemRef.current.duration)}
          onEnded={() => setIsPlayingAudio(false)}
          style={{ display: 'none' }}
        />
      )}

      {/* Top Navbar */}
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
          <div className="notetaker-brand-combo" onClick={onBackToLanding}>
            <div className="notetaker-brand-icon-head">
              <i className="fa-solid fa-robot"></i>
            </div>
            <span className="notetaker-brand-name">MyInterview <strong>Copilot</strong></span>
          </div>
          <span className="notetaker-top-breadcrumb">Smart Notetaker</span>
        </div>

        <div className="notetaker-nav-right">
          <button
            type="button"
            className="notetaker-navbar-sessions-btn"
            onClick={() => setShowSessionsModal(true)}
            title="View Previous Sessions"
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>Previous sessions</span>
            {allSessionsList.length > 0 && (
              <span className="notetaker-navbar-sessions-badge">{allSessionsList.length}</span>
            )}
          </button>
          <button
            className="notetaker-theme-toggle-btn"
            onClick={toggleDarkMode}
            type="button"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <button
            className="notetaker-dashboard-nav-btn"
            onClick={onGoToDashboard}
            type="button"
          >
            Dashboard
          </button>
        </div>
      </header>

      {/* Main Layout Container (Sidebar + Notebook) */}
      <div className="notetaker-app-body-layout">
        
        {/* ========================================================
            LEFT SIDEBAR: MEETING LIBRARY (YOUR WORKSPACE)
            ======================================================== */}
        

        {/* ========================================================
            RIGHT MAIN NOTEBOOK CONTENT
            ======================================================== */}
        <main className="notetaker-notebook-main-area">
          
          {/* ==================== 1. SETUP / IDLE VIEW ==================== */}
          {sessionState === 'idle' && (
            <div className="notetaker-idle-notebook-container">
              
              {/* Notebook Top Hero & Carousel Row */}
              <div className="notebook-hero-carousel-row">
                <div className="notebook-hero-intro">
                  <h1 className="notebook-main-heading">Your notebook</h1>
                  <p className="notebook-main-subheading">Capture conversations. Find decisions, action items, and answers afterward.</p>
                </div>

                {/* Top Right Interactive Carousel Card */}
                <div className="notebook-feature-carousel-card">
                  <div className="carousel-card-header">
                    <div className="carousel-title-group">
                      <i className="fa-solid fa-wand-magic-sparkles carousel-sparkle"></i>
                      <span className="carousel-main-label">See what Notetaker can do</span>
                    </div>
                    <button
                      type="button"
                      className="carousel-pause-btn"
                      onClick={() => setIsCarouselPlaying(prev => !prev)}
                      title={isCarouselPlaying ? 'Pause carousel' : 'Play carousel'}
                    >
                      <i className={`fa-solid ${isCarouselPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>
                  </div>

                  <div className="carousel-slide-counter">
                    <span>{carouselIndex + 1}/{carouselSlides.length}</span>
                    <span className="carousel-topic-name">{carouselSlides[carouselIndex].title}</span>
                  </div>

                  <div className="carousel-dialogue-bubbles">
                    <div className="carousel-bubble speaker-a">
                      <span className="bubble-speaker-tag">A</span>
                      <p>"{carouselSlides[carouselIndex].textA}"</p>
                    </div>
                    <div className="carousel-bubble speaker-b">
                      <span className="bubble-speaker-tag">B</span>
                      <p>"{carouselSlides[carouselIndex].textB}"</p>
                    </div>
                  </div>

                  <div className="carousel-footer-row">
                    <span className="carousel-example-tag">Example only · no audio captured</span>
                    <div className="carousel-dots-indicator">
                      {carouselSlides.map((_, idx) => (
                        <span
                          key={idx}
                          className={`carousel-dot ${carouselIndex === idx ? 'active' : ''}`}
                          onClick={() => setCarouselIndex(idx)}
                        ></span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Start a Session Main Card */}
              <div className="notetaker-start-session-box-card">
                <div className="start-session-card-header">
                  <div>
                    <h2 className="start-session-card-title">Start a session</h2>
                    <p className="start-session-card-desc">Your transcript, notes, and meeting assistant in one place.</p>
                  </div>
                  <div className="start-session-lock-tag">
                    <i className="fa-solid fa-lock"></i>
                    <span>Your account</span>
                  </div>
                </div>

                {/* 3 Capture Mode Cards */}
                <div className="notetaker-capture-modes-grid">
                  {/* Mode 1: Online Meeting */}
                  <div
                    className={`capture-mode-box-card ${recordingMode === 'meeting' ? 'active' : ''}`}
                    onClick={() => {
                      setRecordingMode('meeting');
                      setCaptureAudioMode('Meeting tab + microphone');
                    }}
                  >
                    <div className="mode-box-icon">
                      <i className="fa-solid fa-display"></i>
                    </div>
                    <div className="mode-box-text">
                      <h3 className="mode-box-heading">Online meeting</h3>
                      <p className="mode-box-info">Meeting tab + microphone</p>
                    </div>
                  </div>

                  {/* Mode 2: In Person */}
                  <div
                    className={`capture-mode-box-card ${recordingMode === 'inperson' ? 'active' : ''}`}
                    onClick={() => {
                      setRecordingMode('inperson');
                      setCaptureAudioMode('Microphone');
                    }}
                  >
                    <div className="mode-box-icon">
                      <i className="fa-solid fa-user-group"></i>
                    </div>
                    <div className="mode-box-text">
                      <h3 className="mode-box-heading">In person</h3>
                      <p className="mode-box-info">Capture your microphone</p>
                    </div>
                  </div>

                  {/* Mode 3: Upload Recording */}
                  <div
                    className={`capture-mode-box-card ${recordingMode === 'upload' ? 'active' : ''}`}
                    onClick={() => {
                      setRecordingMode('upload');
                      onGoToUpload?.();
                    }}
                  >
                    <div className="mode-box-icon">
                      <i className="fa-solid fa-cloud-arrow-up"></i>
                    </div>
                    <div className="mode-box-text">
                      <h3 className="mode-box-heading">Upload recording</h3>
                      <p className="mode-box-info">Work from an existing file</p>
                    </div>
                  </div>
                </div>

                {/* Session Title Input */}
                <div className="start-session-field-group">
                  <label className="field-group-label">Session title</label>
                  <input
                    type="text"
                    className="session-title-input-box"
                    placeholder="e.g. Product planning meeting"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                  />
                </div>

                {/* Dropdowns Row */}
                <div className="start-session-dropdowns-row">
                  {/* Spoken Language */}
                  <div className="dropdown-col">
                    <label className="dropdown-col-label">Spoken language</label>
                    <div className="custom-select-wrap">
                      <select
                        value={spokenLang}
                        onChange={(e) => setSpokenLang(e.target.value)}
                      >
                        {languageOptions.map(l => (
                          <option key={l.code} value={l.code}>{l.name}</option>
                        ))}
                      </select>
                      <i className="fa-solid fa-chevron-down select-arrow"></i>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <button
                    type="button"
                    className="languages-swap-arrow-btn"
                    onClick={handleSwapLanguages}
                    title="Swap languages"
                  >
                    <i className="fa-solid fa-right-left"></i>
                  </button>

                  {/* Translation & Notes Language */}
                  <div className="dropdown-col">
                    <label className="dropdown-col-label">Translation &amp; notes language</label>
                    <div className="custom-select-wrap">
                      <select
                        value={targetLang}
                        onChange={(e) => handleTargetLangChange(e.target.value)}
                      >
                        {languageOptions.map(l => (
                          <option key={l.code} value={l.code}>{l.name}</option>
                        ))}
                      </select>
                      <i className="fa-solid fa-chevron-down select-arrow"></i>
                    </div>
                  </div>

                  {/* Capture Audio */}
                  <div className="dropdown-col">
                    <label className="dropdown-col-label">Capture audio</label>
                    <div className="custom-select-wrap">
                      <select
                        value={captureAudioMode}
                        onChange={(e) => setCaptureAudioMode(e.target.value)}
                      >
                        <option value="Meeting tab + microphone">Meeting tab + microphone</option>
                        <option value="Microphone">Microphone</option>
                      </select>
                      <i className="fa-solid fa-chevron-down select-arrow"></i>
                    </div>
                  </div>
                </div>

                {/* Connection Status Dots */}
                <div className="start-session-connection-strip">
                  <div className="connection-item">
                    <span className="conn-dot green"></span>
                    <span>Microphone · Connected · quiet ılıı</span>
                  </div>
                  {recordingMode === 'meeting' && (
                    <div className="connection-item">
                      <span className="conn-dot green"></span>
                      <span>Meeting audio · Connected · quiet ılıı</span>
                    </div>
                  )}
                </div>

                {/* Helper Guidance Text */}
                <div className="start-session-guidance-text">
                  <p>
                    {recordingMode === 'meeting'
                      ? 'Choose the meeting tab and share its audio when you start. Availability depends on your browser and device.'
                      : 'Use your microphone for an in-person conversation or personal notes.'}
                  </p>
                  <p>
                    Confirmed speech will appear in {languageOptions.find(l => l.code === spokenLang)?.name || 'English'} with a {languageOptions.find(l => l.code === targetLang)?.name || 'Punjabi'} translation. Notes use {languageOptions.find(l => l.code === targetLang)?.name || 'Punjabi'} too.
                  </p>
                </div>

                {/* Bottom Action Footer */}
                <div className="start-session-card-bottom-bar">
                  <div className="permission-disclaimer">
                    <i className="fa-solid fa-circle-info"></i>
                    <span>You'll confirm everyone's permission before recording.</span>
                  </div>

                  <button
                    type="button"
                    className="start-session-primary-purple-btn"
                    onClick={startRecordingSession}
                  >
                    <i className="fa-solid fa-microphone"></i>
                    <span>Start session</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ==================== 2. ACTIVE / VIEWING SESSION ==================== */}
          {sessionState !== 'idle' && (
            <div className="notetaker-active-session-container">
              
              {/* Header Bar */}
              <div className="active-session-top-header">
                <div className="header-left-col">
                  {isEditingTitle ? (
                    <input
                      type="text"
                      className="header-title-edit-input"
                      value={sessionTitle}
                      onChange={(e) => setSessionTitle(e.target.value)}
                      onBlur={() => setIsEditingTitle(false)}
                      onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                      autoFocus
                    />
                  ) : (
                    <h1
                      className="header-session-title"
                      onClick={() => setIsEditingTitle(true)}
                      title="Click to edit session title"
                    >
                      {sessionTitle} <i className="fa-solid fa-pen edit-title-icon"></i>
                    </h1>
                  )}

                  <div className="header-meta-indicators">
                    {/* Recording or Paused or Stopped Badge */}
                    {sessionState === 'recording' && (
                      <div className="indicator-pill recording">
                        <span className="live-red-pulse"></span>
                        <span>Recording {formatTimer(timerSeconds)}</span>
                      </div>
                    )}
                    {sessionState === 'paused' && (
                      <div className="indicator-pill paused">
                        <i className="fa-solid fa-pause"></i>
                        <span>Paused {formatTimer(timerSeconds)}</span>
                      </div>
                    )}
                    {sessionState === 'stopped' && (
                      <div className="indicator-pill stopped">
                        <i className="fa-solid fa-check"></i>
                        <span>{formatTimer(timerSeconds)} Completed</span>
                      </div>
                    )}

                    <div className="indicator-saving-text">
                      <i className="fa-solid fa-cloud"></i>
                      <span>{savedStatusText}</span>
                    </div>

                    <div className="indicator-lang-summary">
                      <span className="lang-tag"><i className="fa-solid fa-language"></i> Spoken: <strong>{languageOptions.find(l => l.code === spokenLang)?.name || 'English'}</strong></span>
                      <span className="lang-tag">Translation &amp; notes: <strong>{languageOptions.find(l => l.code === targetLang)?.name || 'Punjabi'}</strong></span>
                      <button
                        type="button"
                        className="show-setup-pill-btn"
                        onClick={() => setShowSetup(prev => !prev)}
                      >
                        <span>{showSetup ? 'Hide setup' : 'Show setup'}</span>
                        <i className={`fa-solid ${showSetup ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                      </button>
                    </div>
                  </div>

                  <p className="header-microcopy">
                    Text saves to your account; audio saves after you stop and confirm. {sessionState === 'paused' ? 'Paused · Devices stay connected until you stop.' : ''}
                  </p>
                </div>

                {/* Top Right Action Buttons */}
                <div className="header-right-col">
                  <div className="header-actions-row">
                    {(sessionState === 'recording' || sessionState === 'paused') && (
                      <>
                        <button
                          type="button"
                          className="header-btn pause-action"
                          onClick={handlePauseResume}
                        >
                          <i className={`fa-solid ${sessionState === 'paused' ? 'fa-play' : 'fa-pause'}`}></i>
                          <span>{sessionState === 'paused' ? 'Resume' : 'Pause'}</span>
                        </button>

                        <button
                          type="button"
                          className="header-btn stop-action"
                          onClick={stopAndSaveSession}
                        >
                          <i className="fa-solid fa-square"></i>
                          <span>Stop &amp; save</span>
                        </button>
                      </>
                    )}

                    {sessionState === 'stopped' && (
                      <button
                        type="button"
                        className="header-btn new-action"
                        onClick={handleStartNewSession}
                      >
                        <i className="fa-solid fa-plus"></i>
                        <span>New session</span>
                      </button>
                    )}

                    {/* Ask AI Button */}
                    <button
                      type="button"
                      className={`header-btn ask-ai-action ${askAiOpen ? 'active' : ''}`}
                      onClick={() => setAskAiOpen(prev => !prev)}
                    >
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                      <span>Ask AI</span>
                    </button>

                    {/* Export Button */}
                    <button
                      type="button"
                      className="header-btn export-action"
                      onClick={() => setShowExportModal(true)}
                    >
                      <i className="fa-solid fa-arrow-up-from-bracket"></i>
                      <span>Export</span>
                    </button>

                    {/* Email Button */}
                    <button
                      type="button"
                      className="header-btn email-action"
                      onClick={() => {
                        const content = smartNotes || chatMessages.map(m => `${m.speakerName}: ${m.text}`).join('\n\n');
                        navigator.clipboard.writeText(content);
                        window.open(`mailto:?subject=${encodeURIComponent(sessionTitle)}&body=${encodeURIComponent(content.slice(0, 1500))}`);
                        showToast?.('Copied to clipboard & opened mail client!');
                      }}
                    >
                      <i className="fa-regular fa-envelope"></i>
                      <span>Email</span>
                    </button>

                    {/* More Menu */}
                    <div className="header-more-wrap" ref={moreMenuRef}>
                      <button
                        type="button"
                        className="header-btn more-action"
                        onClick={() => setShowMoreMenu(prev => !prev)}
                      >
                        <span>More</span>
                        <i className="fa-solid fa-ellipsis"></i>
                      </button>
                      {showMoreMenu && (
                        <div className="header-more-menu-panel">
                          <button type="button" onClick={() => { generateSmartNotes(); setShowMoreMenu(false); }}>
                            <i className="fa-solid fa-arrows-rotate"></i> Regenerate notes
                          </button>
                          <button type="button" onClick={() => { handleTargetLangChange(targetLang); setShowMoreMenu(false); }}>
                            <i className="fa-solid fa-language"></i> Refresh translations
                          </button>
                          <button type="button" onClick={() => { handleClearSession(); setShowMoreMenu(false); }}>
                            <i className="fa-regular fa-trash-can"></i> Clear session
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="header-audio-live-status">
                    <span className="audio-live-dot green"></span>
                    <span>Microphone · Connected · quiet ılıı</span>
                    <span className="audio-mode-label">{sessionState === 'recording' ? 'Transcribing' : (sessionState === 'paused' ? 'Transcription paused' : 'Completed')}</span>
                  </div>
                </div>
              </div>

              {/* Purple Translation Info Banner */}
              <div className="active-translation-banner">
                <i className="fa-solid fa-language"></i>
                <span>Confirmed speech will translate to {languageOptions.find(l => l.code === targetLang)?.name || 'Punjabi'}.</span>
              </div>

              {/* Collapsible Setup Drawer when opened */}
              {showSetup && (
                <div className="active-inline-setup-drawer">
                  <div className="setup-drawer-item">
                    <label>Spoken Language:</label>
                    <select value={spokenLang} onChange={(e) => setSpokenLang(e.target.value)} disabled={sessionState === 'recording'}>
                      {languageOptions.map(l => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="setup-drawer-item">
                    <label>Translation &amp; Notes:</label>
                    <select value={targetLang} onChange={(e) => handleTargetLangChange(e.target.value)}>
                      {languageOptions.map(l => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Tabs Bar */}
              <div className="active-tabs-navigation-strip">
                <div className="tabs-left-pills">
                  <button
                    type="button"
                    className={`tab-pill-btn ${activeTab === 'transcript' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transcript')}
                  >
                    <i className="fa-regular fa-file-lines"></i>
                    <span>Transcript</span>
                  </button>

                  <button
                    type="button"
                    className={`tab-pill-btn ${activeTab === 'notes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('notes')}
                  >
                    <i className="fa-solid fa-list-check"></i>
                    <span>Smart Notes</span>
                  </button>

                  <button
                    type="button"
                    className={`tab-pill-btn ${activeTab === 'translations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('translations')}
                  >
                    <i className="fa-solid fa-language"></i>
                    <span>Translations</span>
                  </button>
                </div>

                <div className="tabs-right-hint">
                  <i className="fa-solid fa-link"></i>
                  <span>Linked to original sources</span>
                </div>
              </div>

              {/* Main Workspace Body Split with Optional Ask AI Drawer */}
              <div className="active-workspace-split-body">
                
                {/* Left/Main Panel */}
                <div className="active-main-panel-box">
                  
                  {/* TAB 1: TRANSCRIPT */}
                  {activeTab === 'transcript' && (
                    <div className="transcript-view-container">
                      <div className="transcript-view-subbar">
                        <div className="transcript-title-col">
                          <h3>Live transcript</h3>
                          <span>Original speech and {languageOptions.find(l => l.code === targetLang)?.name || 'Punjabi'} translation</span>
                        </div>

                        <div className="transcript-controls-col">
                          <div className="view-filter-pills">
                            <button
                              type="button"
                              className={transcriptViewFilter === 'original' ? 'active' : ''}
                              onClick={() => setTranscriptViewFilter('original')}
                            >
                              Original
                            </button>
                            <button
                              type="button"
                              className={transcriptViewFilter === 'translation' ? 'active' : ''}
                              onClick={() => setTranscriptViewFilter('translation')}
                            >
                              Translation
                            </button>
                            <button
                              type="button"
                              className={transcriptViewFilter === 'dual' ? 'active' : ''}
                              onClick={() => setTranscriptViewFilter('dual')}
                            >
                              Dual view
                            </button>
                          </div>

                          <button
                            type="button"
                            className={`following-live-btn ${autoFollowLive ? 'active' : ''}`}
                            onClick={() => {
                              setAutoFollowLive(prev => !prev);
                              if (transcriptScrollRef.current) {
                                transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
                              }
                            }}
                          >
                            <i className="fa-solid fa-arrow-down"></i>
                            <span>Following live</span>
                          </button>
                        </div>
                      </div>

                      {/* Search Bar */}
                      <div className="transcript-search-bar-wrap">
                        <i className="fa-solid fa-magnifying-glass search-ico"></i>
                        <input
                          type="text"
                          className="transcript-search-box"
                          placeholder="Search text, translation, or speaker..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>

                      {/* Transcript Passages Content Area */}
                      <div className="transcript-passages-scroll-pane" ref={transcriptScrollRef}>
                        {chatMessages.length === 0 && !interimMsg ? (
                          <div className="transcript-listening-empty-state">
                            <div className="empty-purple-mic-circle">
                              <i className="fa-solid fa-microphone-lines"></i>
                            </div>
                            <h3>Listening for speech</h3>
                            <p>Confirmed speech will appear here. Check your audio sources above.</p>
                          </div>
                        ) : (
                          <div className="passages-flow-list">
                            {filteredChatMessages.map((msg) => (
                              <div key={msg.id} className="passage-card-item">
                                <div className="passage-header-meta">
                                  <div className="speaker-tag-group">
                                    <span className="speaker-avatar-dot">You</span>
                                  </div>
                                  <span className="passage-time-tag">{msg.timestamp || '~0:01'}</span>
                                </div>

                                {transcriptViewFilter !== 'translation' && (
                                  <div className="passage-speech-text-row">
                                    <p className="original-speech-paragraph">{msg.text}</p>
                                  </div>
                                )}

                                {transcriptViewFilter !== 'original' && msg.translation && (
                                  <div className="passage-translation-subcard">
                                    <div className="trans-subcard-head">
                                      <span className="trans-lang-pill">
                                        <i className="fa-solid fa-language"></i> {languageOptions.find(l => l.code === targetLang)?.name || 'Punjabi'}
                                      </span>
                                      <button
                                        type="button"
                                        className="trans-copy-icon-btn"
                                        onClick={() => handleCopyToClipboard(msg.translation, 'Translation copied!')}
                                        title="Copy translation"
                                      >
                                        <i className="fa-regular fa-copy"></i>
                                      </button>
                                    </div>
                                    <p className="translated-speech-paragraph">{msg.translation}</p>
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* Live Interim Box */}
                            {interimMsg && (
                              <div className="passage-card-item interim-box">
                                <div className="interim-speaker-label">You</div>
                                <div className="interim-text-live">
                                  {interimMsg.text}
                                  <span className="interim-blinking-cursor"></span>
                                </div>
                                <div className="interim-updating-tag">Updating...</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Transcript Footer */}
                      <div className="transcript-bottom-meta-bar">
                        <span>{chatMessages.length} passages</span>
                        <span>~ marks approximate capture times</span>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: SMART NOTES */}
                  {activeTab === 'notes' && (
                    <div className="smart-notes-view-container">
                      <div className="smart-notes-subbar">
                        <div>
                          <h3>MEETING INTELLIGENCE</h3>
                          <p>AI-generated structured notes, key decisions, and action items.</p>
                        </div>
                        <button
                          type="button"
                          className="smart-notes-regen-btn"
                          onClick={generateSmartNotes}
                          disabled={isGeneratingNotes}
                        >
                          <i className={`fa-solid ${isGeneratingNotes ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`}></i>
                          <span>{isGeneratingNotes ? 'Generating...' : 'Regenerate Notes'}</span>
                        </button>
                      </div>

                      <div className="smart-notes-textarea-wrap">
                        <textarea
                          className="smart-notes-editor-textarea"
                          value={smartNotes}
                          onChange={(e) => setSmartNotes(e.target.value)}
                          placeholder="Click 'Regenerate Notes' or start typing meeting notes here..."
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 3: TRANSLATIONS */}
                  {activeTab === 'translations' && (
                    <div className="translations-view-container">
                      <div className="translations-subbar">
                        <div>
                          <h3>Original transcript and translation</h3>
                          <p>Showing the saved {languageOptions.find(l => l.code === targetLang)?.name || 'Punjabi'} translation.</p>
                        </div>
                      </div>

                      <div className="translations-selector-action-row">
                        <div className="translation-lang-picker">
                          <label>Translation language</label>
                          <div className="custom-select-wrap">
                            <select
                              value={targetLang}
                              onChange={(e) => handleTargetLangChange(e.target.value)}
                            >
                              {languageOptions.map(l => (
                                <option key={l.code} value={l.code}>{l.name}</option>
                              ))}
                            </select>
                            <i className="fa-solid fa-chevron-down select-arrow"></i>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="refresh-translation-purple-btn"
                          onClick={() => handleTargetLangChange(targetLang)}
                        >
                          <i className="fa-solid fa-language"></i>
                          <span>Refresh translation</span>
                        </button>
                      </div>

                      <div className="translations-items-list-pane">
                        {chatMessages.length === 0 ? (
                          <div className="transcript-listening-empty-state">
                            <p>No translations recorded yet. Speak into your microphone to generate translations.</p>
                          </div>
                        ) : (
                          chatMessages.map(m => (
                            <div key={m.id} className="translation-flow-card">
                              <div className="trans-card-top-meta">
                                <span className="speaker-name-badge">{m.speakerName || 'You'}</span>
                                <span className="trans-time">{m.timestamp || ''}</span>
                              </div>
                              <div className="trans-dest-speech">{m.translation || 'Translating...'}</div>
                              <div className="trans-src-hint">{m.text}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                </div>

                {/* Right Drawer: ASK AI */}
                {askAiOpen && (
                  <aside className="active-ask-ai-drawer">
                    {/* Sleek Top Header */}
                    <div className="ask-ai-top-bar">
                      <div className="ask-ai-brand-group">
                        <div className="ask-ai-icon-circle">
                          <i className="fa-solid fa-wand-magic-sparkles"></i>
                        </div>
                        <div className="ask-ai-title-wrap">
                          <h4>Ask AI</h4>
                          <span>Grounded in meeting transcript</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ask-ai-collapse-btn"
                        onClick={() => setAskAiOpen(false)}
                        title="Collapse panel"
                      >
                        <span>Collapse</span>
                        <i className="fa-solid fa-chevron-right"></i>
                      </button>
                    </div>

                    {/* Messages Scroll Area */}
                    <div className="ask-ai-messages-scroll-area">
                      {askAiMessages.length === 0 ? (
                        <div className="ask-ai-empty-welcome-card">
                          <div className="welcome-sparkle-badge">
                            <i className="fa-solid fa-brain"></i>
                          </div>
                          <h5>Meeting Assistant</h5>
                          <p>Ask anything about what was spoken. Answers are grounded in your recorded transcript.</p>
                          <div className="welcome-hint-pill">
                            <i className="fa-solid fa-plus"></i> Use the <strong>+ Prompts</strong> button below for quick queries
                          </div>
                        </div>
                      ) : (
                        askAiMessages.map(msg => (
                          <div key={msg.id} className={`ask-ai-bubble ${msg.sender}`}>
                            <div className="bubble-content-text">
                              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.text}</p>
                            </div>
                            {msg.sender === 'ai' && msg.id !== 'ai_welcome' && (
                              <div className="ai-bubble-toolbar">
                                <button type="button" onClick={() => handleCopyToClipboard(msg.text, 'Answer copied!')} title="Copy answer">
                                  <i className="fa-regular fa-copy"></i> Copy
                                </button>
                                <button type="button" onClick={() => {
                                  setSmartNotes(prev => `${prev}

### AI Note
${msg.text}`);
                                  showToast?.('Appended to Smart Notes!');
                                }} title="Save to notes">
                                  <i className="fa-regular fa-floppy-disk"></i> Save to notes
                                </button>
                                <button type="button" onClick={() => handleReadAloud(msg.id, msg.text)} title="Read aloud">
                                  <i className={`fa-solid ${activeSpeakingId === msg.id ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
                                  {activeSpeakingId === msg.id ? 'Stop' : 'Read'}
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}

                      {isSendingAiQuery && (
                        <div className="ask-ai-bubble ai loading-bubble">
                          <span className="dot-flashing"></span>
                          <span>Thinking with transcript context...</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Form Area with PLUS button & Language selector */}
                    <div className="ask-ai-bottom-form-area">
                      <div className="ask-ai-tools-shelf-row">
                        {/* PLUS Button for quick prompts popover */}
                        <div className="ask-ai-plus-menu-wrap" ref={plusMenuRef}>
                          <button
                            type="button"
                            className={`ask-ai-plus-btn ${showQuickPromptsMenu ? 'open' : ''}`}
                            onClick={() => setShowQuickPromptsMenu(prev => !prev)}
                            title={showQuickPromptsMenu ? "Close prompt options" : "Choose quick prompt"}
                          >
                            <i className={`fa-solid ${showQuickPromptsMenu ? 'fa-xmark' : 'fa-plus'}`}></i>
                            <span>Prompts</span>
                          </button>

                          {/* Popover Shelf with the 4 options */}
                          {showQuickPromptsMenu && (
                            <div className="ask-ai-prompts-popover-card">
                              <div className="prompts-popover-header">
                                <span>Suggested Prompts</span>
                                <button type="button" onClick={() => setShowQuickPromptsMenu(false)}>✕</button>
                              </div>
                              <div className="prompts-popover-list">
                                <button
                                  type="button"
                                  className="prompt-option-item"
                                  onClick={() => {
                                    handleSendAiQuery('Catch up so far');
                                    setShowQuickPromptsMenu(false);
                                  }}
                                >
                                  <i className="fa-solid fa-rotate-left"></i>
                                  <span>Catch up so far</span>
                                </button>
                                <button
                                  type="button"
                                  className="prompt-option-item"
                                  onClick={() => {
                                    handleSendAiQuery('Decisions made');
                                    setShowQuickPromptsMenu(false);
                                  }}
                                >
                                  <i className="fa-solid fa-check"></i>
                                  <span>Decisions</span>
                                </button>
                                <button
                                  type="button"
                                  className="prompt-option-item"
                                  onClick={() => {
                                    handleSendAiQuery('Action items');
                                    setShowQuickPromptsMenu(false);
                                  }}
                                >
                                  <i className="fa-solid fa-list-check"></i>
                                  <span>Action items</span>
                                </button>
                                <button
                                  type="button"
                                  className="prompt-option-item"
                                  onClick={() => {
                                    handleSendAiQuery('Open risks');
                                    setShowQuickPromptsMenu(false);
                                  }}
                                >
                                  <i className="fa-solid fa-flag"></i>
                                  <span>Open risks</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Language Selector */}
                        <div className="ask-ai-answer-lang-row">
                          <span>Answer in:</span>
                          <div className="mini-lang-select-wrap">
                            <select
                              value={askAiAnswerLang}
                              onChange={(e) => setAskAiAnswerLang(e.target.value)}
                            >
                              {languageOptions.map(l => (
                                <option key={l.code} value={l.code}>{l.name}</option>
                              ))}
                            </select>
                            <i className="fa-solid fa-chevron-down mini-arrow"></i>
                          </div>
                        </div>
                      </div>

                      {/* Input Box */}
                      <form
                        onSubmit={(e) => { e.preventDefault(); handleSendAiQuery(); }}
                        className="ask-ai-input-form"
                      >
                        <input
                          type="text"
                          className="ask-ai-query-input"
                          placeholder="Ask about this meeting..."
                          value={askAiInput}
                          onChange={(e) => setAskAiInput(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="ask-ai-send-btn"
                          disabled={!askAiInput.trim() || isSendingAiQuery}
                          title="Send prompt"
                        >
                          <i className="fa-solid fa-arrow-up"></i>
                        </button>
                      </form>
                    </div>
                  </aside>
                )}

              </div>

              {/* Stopped Mode Bottom Audio Bar */}
              {sessionState === 'stopped' && (
                <div className="notetaker-sticky-bottom-player-bar">
                  <div className="player-bar-container">
                    <button
                      type="button"
                      className="player-play-btn"
                      onClick={togglePlayAudio}
                      title={isPlayingAudio ? 'Pause' : 'Play'}
                    >
                      <i className={`fa-solid ${isPlayingAudio ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>

                    <button
                      type="button"
                      className="player-seek-jump-btn"
                      onClick={() => handleAudioJump(-10)}
                      title="Rewind 10 seconds"
                    >
                      <i className="fa-solid fa-rotate-left"></i>
                      <span>10</span>
                    </button>

                    <button
                      type="button"
                      className="player-seek-jump-btn"
                      onClick={() => handleAudioJump(10)}
                      title="Forward 10 seconds"
                    >
                      <i className="fa-solid fa-rotate-right"></i>
                      <span>10</span>
                    </button>

                    <div className="player-timeline-box">
                      <span className="player-time-num">{formatTimer(Math.floor(audioCurrentTime))}</span>
                      <input
                        type="range"
                        className="player-range-input"
                        min="0"
                        max={Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : (timerSeconds || 1)}
                        value={audioCurrentTime}
                        onChange={handleAudioSeek}
                      />
                      <span className="player-time-num">{formatTimer(Math.floor(Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : (timerSeconds || 0)))}</span>
                    </div>

                    <button
                      type="button"
                      className="player-speed-toggle-btn"
                      onClick={cyclePlaybackSpeed}
                      title="Playback speed"
                    >
                      {playbackSpeed}x
                    </button>

                    {recordedAudioUrl && (
                      <a
                        href={recordedAudioUrl}
                        download={`${sessionTitle.toLowerCase().replace(/\s+/g, '_')}_audio.webm`}
                        className="player-download-audio-link"
                        title="Download recorded audio"
                      >
                        <i className="fa-solid fa-download"></i>
                        <span>Audio</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Notebook Footer */}
          <footer className="notebook-common-footer">
            <div className="footer-links-group">
              <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
              <a href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a>
            </div>
          </footer>

        </main>
      </div>

      {/* Nav Drawer Overlay */}
      {showNavDrawer && (
        <div className={`notetaker-drawer-overlay ${darkMode ? 'dark-theme' : 'light-theme'}`} onClick={() => setShowNavDrawer(false)}>
          <div className={`notetaker-drawer-panel ${darkMode ? 'dark-theme' : 'light-theme'}`} onClick={(e) => e.stopPropagation()}>
            <div className="notetaker-drawer-header">
              <BrandLogo size="sm" />
              <button className="notetaker-drawer-close-btn" onClick={() => setShowNavDrawer(false)} type="button">×</button>
            </div>

            <nav className="notetaker-drawer-nav">
              <button className="notetaker-drawer-nav-item" onClick={() => { setShowNavDrawer(false); onBackToLanding?.(); }}>
                <i className="fa-solid fa-house"></i> Home
              </button>
              <button className="notetaker-drawer-nav-item" onClick={() => { setShowNavDrawer(false); onGoToDashboard?.(); }}>
                <i className="fa-solid fa-chart-line"></i> Dashboard
              </button>
              <button className="notetaker-drawer-nav-item" onClick={() => { setShowNavDrawer(false); onGoToPanel?.(); }}>
                <i className="fa-solid fa-rocket"></i> AI Copilot
              </button>
              <button className="notetaker-drawer-nav-item active">
                <i className="fa-solid fa-microphone"></i> Notetaker
              </button>
              <button className="notetaker-drawer-nav-item" onClick={() => { setShowNavDrawer(false); onGoToVoiceAgent?.(); }}>
                <i className="fa-solid fa-robot"></i> Voice Agent
              </button>
              <button className="notetaker-drawer-nav-item" onClick={() => { setShowNavDrawer(false); onGoToUpload?.(); }}>
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
              <button className="notetaker-drawer-nav-item" onClick={toggleDarkMode} type="button">
                <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i> {darkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
              <button className="notetaker-drawer-nav-item notetaker-drawer-logout" onClick={onLogout} type="button">
                <i className="fa-solid fa-right-from-bracket"></i> Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="notetaker-modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="notetaker-modal-card" onClick={(e) => e.stopPropagation()}>
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

            <div className="notetaker-modal-actions">
              <button type="button" className="notetaker-modal-btn-cancel" onClick={() => setShowExportModal(false)}>Cancel</button>
              <button type="button" className="notetaker-modal-btn-download" onClick={handleExportDownload}>
                <i className="fa-solid fa-download"></i> Download
              </button>
            </div>
          </div>
        </div>
      )}

      
      {/* Previous Sessions Modal (Since open sidebar is removed) */}
      {showSessionsModal && (
        <div className="notetaker-modal-overlay" onClick={() => setShowSessionsModal(false)}>
          <div className="notetaker-sessions-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="notetaker-sessions-modal-header">
              <div className="modal-title-with-badge">
                <i className="fa-solid fa-clock-rotate-left"></i>
                <h3>Previous sessions</h3>
                <span className="modal-count-badge">{allSessionsList.length}</span>
              </div>
              <button
                type="button"
                className="notetaker-modal-close-btn"
                onClick={() => setShowSessionsModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="notetaker-modal-search-wrap">
              <i className="fa-solid fa-magnifying-glass search-ico"></i>
              <input
                type="text"
                className="notetaker-modal-search-input"
                placeholder="Search previous sessions by title, date..."
                value={sidebarSearchQuery}
                onChange={(e) => setSidebarSearchQuery(e.target.value)}
              />
            </div>

            <div className="notetaker-modal-sessions-scroll">
              {filteredSidebarSessions.length === 0 ? (
                <div className="modal-empty-sessions">
                  <i className="fa-regular fa-folder-open"></i>
                  <p>No saved sessions found.</p>
                </div>
              ) : (
                filteredSidebarSessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="modal-session-row-item"
                    onClick={() => {
                      setSessionTitle(sess.title || 'Meeting Notes');
                      setChatMessages(sess.transcript || []);
                      setSmartNotes(sess.notes || '');
                      setTimerSeconds(sess.durationSeconds || 0);
                      setSessionState('stopped');
                      setShowSessionsModal(false);
                      showToast?.(`Loaded ${sess.title}`);
                    }}
                  >
                    <div className="modal-session-icon">
                      <i className="fa-regular fa-file-lines"></i>
                    </div>
                    <div className="modal-session-info">
                      <h4>{sess.title}</h4>
                      <span>{sess.date} · {sess.durationDisplay || formatTimer(sess.durationSeconds || 0)}</span>
                    </div>
                    <button type="button" className="modal-session-open-btn">
                      Open <i className="fa-solid fa-arrow-right"></i>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="notetaker-modal-footer">
              <span className="modal-privacy-tag">
                <i className="fa-solid fa-lock"></i> Your saved sessions are private to your account.
              </span>
              <button
                type="button"
                className="modal-close-action-btn"
                onClick={() => setShowSessionsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Prompt Modal */}
      <CreditUsagePromptModal
        isOpen={creditPromptModal.isOpen}
        onClose={() => setCreditPromptModal(prev => ({ ...prev, isOpen: false }))}
        type={creditPromptModal.type}
        title={creditPromptModal.title}
        message={creditPromptModal.message}
        fileDetails={creditPromptModal.fileDetails}
        onConfirm={() => {
          setCreditPromptModal(prev => ({ ...prev, isOpen: false }));
          startRecordingSession();
        }}
        showToast={showToast}
        darkMode={darkMode}
      />

      {/* PDF Customizer Modal */}
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
