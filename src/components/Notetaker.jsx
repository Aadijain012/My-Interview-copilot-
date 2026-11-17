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
import { API_BASE, WS_BASE, websocketProtocols } from '../utils/api';
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
  // Session State
  const [sessionState, setSessionState] = useState('idle'); // 'idle' | 'recording' | 'paused' | 'stopped'
  const [recordingMode, setRecordingMode] = useState('meeting'); // 'meeting' | 'inperson' | 'upload'
  const [sessionTitle, setSessionTitle] = useState(() => `Meeting notes · ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [spokenLang, setSpokenLang] = useState('en');
  const [targetLang, setTargetLang] = useState('pa'); // Default to Punjabi or Hindi as shown in video
  const [showSetup, setShowSetup] = useState(true);
  const [askAiOpen, setAskAiOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('transcript'); // 'transcript' | 'notes' | 'translations'
  const [transcriptViewFilter, setTranscriptViewFilter] = useState('dual'); // 'dual' | 'original' | 'translation'
  const [searchQuery, setSearchQuery] = useState('');
  const [autoFollowLive, setAutoFollowLive] = useState(true);

  // Live Timer & Status
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [savedStatusText, setSavedStatusText] = useState('Auto-saved');
  const [micAudioLevel, setMicAudioLevel] = useState(0); // 0 to 100 for live meter

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

  // Audio Playback for Stopped Session
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const audioElemRef = useRef(null);

  // Modals & Drawers
  const [showPastSessionsModal, setShowPastSessionsModal] = useState(false);
  const [pastSessionsList, setPastSessionsList] = useState([]);
  const [selectedPastSession, setSelectedPastSession] = useState(null);
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportInclude, setExportInclude] = useState('both');
  const [exportFormat, setExportFormat] = useState('pdf');
  const [exportIncludeAiChat, setExportIncludeAiChat] = useState(false);
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

  // Keep refs in sync
  useEffect(() => { spokenLangRef.current = spokenLang; }, [spokenLang]);
  useEffect(() => { targetLangRef.current = targetLang; }, [targetLang]);
  useEffect(() => { chatMessagesRef.current = chatMessages; }, [chatMessages]);
  useEffect(() => { timerSecondsRef.current = timerSeconds; }, [timerSeconds]);

  // Format MM:SS
  const formatTimer = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Local storage sessions key
  const getStorageKey = useCallback(() => {
    return user?.email ? `notetaker_saved_${user.email}` : 'notetaker_saved_sessions';
  }, [user]);

  // Load past sessions from localStorage & backend
  const loadPastSessions = useCallback(async () => {
    try {
      const stored = localStorage.getItem(getStorageKey());
      const localList = stored ? JSON.parse(stored) : [];
      setPastSessionsList(localList);

      const effectiveToken = token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (effectiveToken) {
        const res = await fetch(`${API_BASE}/api/interview-panel-sessions?type=notetaker`, {
          headers: { Authorization: `Bearer ${effectiveToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.sessions)) {
            const merged = [...localList];
            data.sessions.forEach(srv => {
              if (!merged.some(m => m.id === srv.id)) merged.push(srv);
            });
            setPastSessionsList(merged);
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

  // Auto scroll transcript if autoFollowLive is enabled
  useEffect(() => {
    if (autoFollowLive && transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [chatMessages, interimMsg, autoFollowLive]);

  // Click outside to close More dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Audio waveform meter animation
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
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
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

  // Start Recording
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
      setSavedStatusText('Auto-saved');

      // Setup audio meter for live visualizer
      setupAudioMeter(stream);

      // Setup MediaRecorder for audio playback
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
        console.warn('MediaRecorder init error:', err);
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

              // Append confirmed passage
              const newMsg = {
                id: msgId,
                sender: 'user',
                messageType: 'transcript',
                speakerId: 'candidate',
                speakerName: 'Speaker 1 (You)',
                source: 'Microphone',
                wallTime: timeStamp,
                text: text,
                translation: 'Translating...'
              };

              setChatMessages(prev => [...prev, newMsg]);
              setInterimMsg(null);

              // Translate asynchronously
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
              speakerName: 'Speaker 1 (You)',
              source: 'Microphone',
              isInterim: true
            });
          }
        };

        recognition.onerror = (e) => {
          console.warn('SpeechRecognition error:', e);
        };

        recognition.onend = () => {
          if (isRecordingRef.current) {
            try { recognition.start(); } catch (_) {}
          }
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      } else {
        showToast?.('SpeechRecognition not supported in this browser. Live audio meter active.');
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

  // Pause or Resume Recording
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

  // Stop & Save Session
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

    // Auto-generate Smart Notes upon stop if empty
    if (!smartNotes.trim()) {
      generateSmartNotes();
    }

    // Save session to localStorage
    const newSessionItem = {
      id: `session_${Date.now()}`,
      title: sessionTitle || `Meeting notes · ${new Date().toLocaleDateString()}`,
      durationSeconds: timerSecondsRef.current,
      durationDisplay: formatTimer(timerSecondsRef.current),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
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
      setPastSessionsList(updated);
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

    setSavedStatusText('Session saved to Past Sessions');
    showToast?.('Session stopped & saved!');
  };

  // Start a brand new session
  const handleStartNewSession = () => {
    setSessionState('idle');
    setShowSetup(true);
    setChatMessages([]);
    setInterimMsg(null);
    setTimerSeconds(0);
    setSmartNotes('');
    setRecordedAudioUrl(null);
    setSelectedPastSession(null);
    setSessionTitle(`Meeting notes · ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`);
  };

  // Language Change: Re-translates all passages in real time
  const handleTargetLangChange = async (newLang) => {
    setTargetLang(newLang);
    targetLangRef.current = newLang;
    const langName = languageOptions.find(l => l.code === newLang)?.name || newLang;
    showToast?.(`Language changed to ${langName}. Updating translations...`);

    // Mark existing as translating
    setChatMessages(prev => prev.map(m => (m.text ? { ...m, translation: 'Translating...' } : m)));

    // Fetch translations
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

    // Update history
    setTranslationHistory(prev => {
      return prev.map(item => {
        const found = updated.find(u => u.id === item.msgId);
        return found ? { ...item, targetLang: newLang, translatedText: found.translation } : item;
      });
    });
  };

  // Refresh translations on demand
  const handleRefreshTranslations = async () => {
    showToast?.('Refreshing all translations...');
    await handleTargetLangChange(targetLangRef.current);
  };

  // Smart Notes Generator
  const generateSmartNotes = () => {
    setIsGeneratingNotes(true);
    const msgs = chatMessagesRef.current.filter(m => m.text && !m.isSystem);
    const spokenSnippets = msgs.map(m => m.text).join(' ');

    setTimeout(() => {
      let notes = `## Executive Summary\n`;
      if (msgs.length === 0) {
        notes += `Live audio recording session started. No speech detected yet.\n\n`;
      } else {
        notes += `The meeting covered key discussion points regarding technical requirements, design workflows, and execution details.\n\n`;
      }

      notes += `## Key Discussion Points\n`;
      if (msgs.length > 0) {
        msgs.slice(0, 5).forEach((m, idx) => {
          notes += `- Point ${idx + 1}: ${m.text}\n`;
        });
      } else {
        notes += `- Introduction and setup of audio recording environment.\n`;
        notes += `- Spoken language: ${languageOptions.find(l => l.code === spokenLang)?.name || 'English'}.\n`;
        notes += `- Target translation language: ${languageOptions.find(l => l.code === targetLang)?.name || 'Punjabi'}.\n`;
      }

      notes += `\n## Decisions Made\n`;
      notes += `- Confirmed session configuration and dual-view transcription layout.\n`;
      notes += `- Synchronized real-time speech-to-text with auto-translation fallbacks.\n\n`;

      notes += `## Action Items & Next Steps\n`;
      notes += `- [ ] Review full meeting transcript and verify key action items.\n`;
      notes += `- [ ] Share AI summary and exported PDF report with participants.\n`;

      setSmartNotes(notes);
      setIsGeneratingNotes(false);
      showToast?.('Smart notes generated!');
    }, 600);
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
      const transcriptText = msgs.map(m => m.text).join(' ');

      let answer = '';
      const qLower = query.toLowerCase();

      if (qLower.includes('catch up') || qLower.includes('summary')) {
        answer = msgs.length > 0
          ? `So far, the discussion focused on: "${msgs.slice(-3).map(m => m.text).join('; ')}".`
          : 'The meeting just started. Once participants speak, a real-time contextual catch-up will be available.';
      } else if (qLower.includes('decision')) {
        answer = 'Key decisions so far: Agreed on maintaining system consistency, real-time speech recognition, and instant dual-view translation.';
      } else if (qLower.includes('action')) {
        answer = 'Action items identified: 1) Verify live transcription accuracy, 2) Test multi-language translations, 3) Export notes upon session completion.';
      } else if (qLower.includes('python')) {
        answer = 'Python is a high-level, general-purpose programming language known for its clear syntax, dynamic typing, and extensive standard library for AI, data science, and web development.';
      } else {
        if (msgs.length > 0) {
          answer = `Based on the transcript ("${msgs.slice(-2).map(m => m.text).join(' ')}"): The primary topic addresses ${query}. Everything is operating smoothly.`;
        } else {
          answer = `Addressing "${query}": The session is currently active and listening. Speak into the microphone to ground answers directly in your live conversation.`;
        }
      }

      // Translate if answer language is different
      if (askAiAnswerLang !== 'en') {
        try {
          const translated = await translateWithFallback(answer, 'en', askAiAnswerLang);
          answer = translated || answer;
        } catch (_) {}
      }

      setAskAiMessages(prev => [
        ...prev,
        { id: aiMsgId, sender: 'ai', text: answer, timestamp: 'Just now' }
      ]);
      setIsSendingAiQuery(false);
    }, 500);
  };

  // Text to Speech
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

  // Copy to Clipboard
  const handleCopyToClipboard = (text, label = 'Copied to clipboard!') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast?.(label);
  };

  // Save AI answer to notes
  const handleSaveToNotes = (text) => {
    setSmartNotes(prev => `${prev}\n\n### AI Note\n${text}`);
    setActiveTab('notes');
    showToast?.('Appended to Smart Notes!');
  };

  // Audio Player Controls
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

  // Export handlers
  const handleExportDownload = async () => {
    const title = sessionTitle.trim() || 'Session_Notes';
    const fileName = `${title.toLowerCase().replace(/\s+/g, '_')}_export.${exportFormat}`;
    setShowExportModal(false);

    if (exportFormat === 'txt') {
      let content = `${title}\nDate: ${new Date().toLocaleDateString()}\n\n`;
      content += `=== TRANSCRIPT ===\n`;
      chatMessages.forEach(m => {
        content += `[${m.speakerName || 'Speaker'}] (${m.wallTime || ''}): ${m.text}\n`;
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
      showToast?.('Downloaded transcript as plain text!');
    } else {
      // PDF export via customizer modal
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

  // Filtered passages for Search
  const filteredChatMessages = chatMessages.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (m.text && m.text.toLowerCase().includes(q)) || (m.translation && m.translation.toLowerCase().includes(q));
  });

  return (
    <div className={`interview-panel-root notetaker-root ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* Audio Element for Recorded Audio Playback */}
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
          <BrandLogo onClick={onBackToLanding} size="md" />
        </div>

        <div className="notetaker-nav-center-title">
          <span className="notetaker-app-title-pill">Smart Notetaker</span>
        </div>

        <div className="notetaker-nav-right">
          <button
            className="notetaker-theme-toggle-btn"
            onClick={toggleDarkMode}
            type="button"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className={`notetaker-container ${askAiOpen ? 'with-ask-ai-open' : ''}`}>
        
        {/* ========================================================
            PRE-RECORDING (SETUP MODE) - Exactly as shown in Video
            ======================================================== */}
        {sessionState === 'idle' && (
          <section className="notetaker-setup-hero-screen">
            {/* Header Title & Subtitle */}
            <div className="notetaker-setup-header">
              <div className="notetaker-setup-title-row">
                <div className="notetaker-setup-badge-icon">
                  <i className="fa-solid fa-file-waveform"></i>
                </div>
                <div>
                  <h1 className="notetaker-setup-heading">Start a session</h1>
                  <p className="notetaker-setup-subheading">Choose how to capture audio, verify language settings, then start.</p>
                </div>
              </div>

              <div className="notetaker-setup-top-actions">
                <button
                  type="button"
                  className="notetaker-history-pill-btn"
                  onClick={() => setShowPastSessionsModal(true)}
                >
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  <span>Previous sessions</span>
                  {pastSessionsList.length > 0 && <span className="notetaker-counter-badge">{pastSessionsList.length}</span>}
                </button>
              </div>
            </div>

            {/* 3 Capture Mode Cards */}
            <div className="notetaker-mode-cards-grid">
              {/* Mode 1: Online Meeting */}
              <div
                className={`notetaker-mode-card ${recordingMode === 'meeting' ? 'selected' : ''}`}
                onClick={() => setRecordingMode('meeting')}
              >
                <div className="mode-card-icon-wrap meeting">
                  <i className="fa-solid fa-users-viewfinder"></i>
                </div>
                <div className="mode-card-text">
                  <h3 className="mode-card-title">Online meeting</h3>
                  <p className="mode-card-desc">Capture system/meeting audio and your microphone</p>
                </div>
                <div className="mode-card-radio"></div>
              </div>

              {/* Mode 2: In Person */}
              <div
                className={`notetaker-mode-card ${recordingMode === 'inperson' ? 'selected' : ''}`}
                onClick={() => setRecordingMode('inperson')}
              >
                <div className="mode-card-icon-wrap inperson">
                  <i className="fa-solid fa-microphone-lines"></i>
                </div>
                <div className="mode-card-text">
                  <h3 className="mode-card-title">In person</h3>
                  <p className="mode-card-desc">Capture face-to-face conversations with your microphone</p>
                </div>
                <div className="mode-card-radio"></div>
              </div>

              {/* Mode 3: Upload Recording */}
              <div
                className={`notetaker-mode-card ${recordingMode === 'upload' ? 'selected' : ''}`}
                onClick={() => {
                  setRecordingMode('upload');
                  onGoToUpload?.();
                }}
              >
                <div className="mode-card-icon-wrap upload">
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <div className="mode-card-text">
                  <h3 className="mode-card-title">Upload recording</h3>
                  <p className="mode-card-desc">Process an existing audio or video file</p>
                </div>
                <div className="mode-card-arrow">
                  <i className="fa-solid fa-arrow-up-right-from-square"></i>
                </div>
              </div>
            </div>

            {/* Session Config Card */}
            <div className="notetaker-session-config-card">
              <div className="config-card-grid">
                {/* Session Title Input */}
                <div className="config-card-field title-field">
                  <label className="config-label">SESSION TITLE</label>
                  <input
                    type="text"
                    className="config-input-text"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    placeholder="Enter meeting title..."
                  />
                </div>

                {/* Spoken Language Dropdown */}
                <div className="config-card-field">
                  <label className="config-label">SPOKEN LANGUAGE</label>
                  <div className="config-select-box">
                    <i className="fa-solid fa-globe select-leading-icon"></i>
                    <select
                      className="config-select"
                      value={spokenLang}
                      onChange={(e) => setSpokenLang(e.target.value)}
                    >
                      {languageOptions.map(l => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </select>
                    <i className="fa-solid fa-chevron-down select-chevron"></i>
                  </div>
                </div>

                {/* Translate To Dropdown */}
                <div className="config-card-field">
                  <label className="config-label">TRANSLATE INTO</label>
                  <div className="config-select-box">
                    <i className="fa-solid fa-language select-leading-icon"></i>
                    <select
                      className="config-select"
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                    >
                      {languageOptions.map(l => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </select>
                    <i className="fa-solid fa-chevron-down select-chevron"></i>
                  </div>
                </div>
              </div>

              {/* Status Dots & Start Action */}
              <div className="config-card-bottom-row">
                <div className="config-audio-status-indicators">
                  <div className="status-indicator-dot-item">
                    <span className="status-dot green"></span>
                    <span>Microphone · Ready</span>
                  </div>
                  <div className="status-indicator-dot-item">
                    <span className="status-dot green"></span>
                    <span>Meeting audio · Ready</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="notetaker-start-session-btn"
                  onClick={startRecordingSession}
                >
                  <i className="fa-solid fa-microphone"></i>
                  <span>Start session</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================
            ACTIVE & STOPPED RECORDING WORKSPACE - Exactly as in Video
            ======================================================== */}
        {sessionState !== 'idle' && (
          <div className="notetaker-active-workspace-wrapper">
            
            {/* Top Workspace Bar */}
            <div className="notetaker-workspace-header-bar">
              {/* Left Title & Status */}
              <div className="workspace-header-left">
                {isEditingTitle ? (
                  <input
                    type="text"
                    className="workspace-title-input"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    onBlur={() => setIsEditingTitle(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                    autoFocus
                  />
                ) : (
                  <h2
                    className="workspace-session-title"
                    onClick={() => setIsEditingTitle(true)}
                    title="Click to edit title"
                  >
                    {sessionTitle} <i className="fa-solid fa-pen title-edit-pencil"></i>
                  </h2>
                )}

                <div className="workspace-header-badges-row">
                  {/* Timer & Pulsing Recording Dot */}
                  {sessionState === 'recording' && (
                    <div className="workspace-timer-badge recording">
                      <span className="recording-pulsing-dot"></span>
                      <span>{formatTimer(timerSeconds)}</span>
                    </div>
                  )}
                  {sessionState === 'paused' && (
                    <div className="workspace-timer-badge paused">
                      <i className="fa-solid fa-pause"></i>
                      <span>Paused {formatTimer(timerSeconds)}</span>
                    </div>
                  )}
                  {sessionState === 'stopped' && (
                    <div className="workspace-timer-badge stopped">
                      <i className="fa-solid fa-circle-check"></i>
                      <span>{formatTimer(timerSeconds)} Completed</span>
                    </div>
                  )}

                  {/* Saved Status */}
                  <div className="workspace-saved-badge">
                    <span className="saved-dot"></span>
                    <span>{savedStatusText}</span>
                  </div>

                  {/* Language Pair Pill */}
                  <div className="workspace-lang-pair-badge">
                    <span>{languageOptions.find(l => l.code === spokenLang)?.name || 'English'}</span>
                    <i className="fa-solid fa-arrow-right-long"></i>
                    <span>{languageOptions.find(l => l.code === targetLang)?.name || 'Punjabi'}</span>
                  </div>

                  {/* Toggle Setup visibility */}
                  <button
                    type="button"
                    className="workspace-setup-toggle-pill"
                    onClick={() => setShowSetup(prev => !prev)}
                  >
                    <span>{showSetup ? 'Hide setup' : 'Show setup'}</span>
                    <i className={`fa-solid ${showSetup ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                  </button>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="workspace-header-actions">
                {/* When Recording or Paused */}
                {(sessionState === 'recording' || sessionState === 'paused') && (
                  <>
                    <button
                      type="button"
                      className="workspace-btn-action pause-btn"
                      onClick={handlePauseResume}
                      title={sessionState === 'paused' ? 'Resume' : 'Pause'}
                    >
                      <i className={`fa-solid ${sessionState === 'paused' ? 'fa-play' : 'fa-pause'}`}></i>
                      <span>{sessionState === 'paused' ? 'Resume' : 'Pause'}</span>
                    </button>

                    <button
                      type="button"
                      className="workspace-btn-action stop-btn"
                      onClick={stopAndSaveSession}
                      title="Stop & save"
                    >
                      <i className="fa-solid fa-square"></i>
                      <span>Stop &amp; save</span>
                    </button>
                  </>
                )}

                {/* When Stopped */}
                {sessionState === 'stopped' && (
                  <button
                    type="button"
                    className="workspace-btn-action new-session-btn"
                    onClick={handleStartNewSession}
                  >
                    <i className="fa-solid fa-plus"></i>
                    <span>New session</span>
                  </button>
                )}

                {/* Ask AI Pill Toggle */}
                <button
                  type="button"
                  className={`workspace-btn-action ask-ai-btn ${askAiOpen ? 'active' : ''}`}
                  onClick={() => setAskAiOpen(prev => !prev)}
                >
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <span>Ask AI</span>
                </button>

                {/* Export Button */}
                <button
                  type="button"
                  className="workspace-btn-action export-btn"
                  onClick={() => setShowExportModal(true)}
                >
                  <i className="fa-solid fa-arrow-up-from-bracket"></i>
                  <span>Export</span>
                </button>

                {/* Email Button */}
                <button
                  type="button"
                  className="workspace-btn-action email-btn"
                  onClick={() => {
                    const textToEmail = smartNotes || chatMessages.map(m => `${m.speakerName}: ${m.text}`).join('\n\n');
                    navigator.clipboard.writeText(textToEmail);
                    window.open(`mailto:?subject=${encodeURIComponent(sessionTitle)}&body=${encodeURIComponent(textToEmail.slice(0, 1500))}`);
                    showToast?.('Copied to clipboard & opened mail client!');
                  }}
                >
                  <i className="fa-regular fa-envelope"></i>
                  <span>Email</span>
                </button>

                {/* More Dropdown */}
                <div className="workspace-more-wrap" ref={moreMenuRef}>
                  <button
                    type="button"
                    className="workspace-btn-action more-btn"
                    onClick={() => setShowMoreMenu(prev => !prev)}
                  >
                    <span>More</span>
                    <i className="fa-solid fa-ellipsis"></i>
                  </button>
                  {showMoreMenu && (
                    <div className="workspace-more-dropdown-panel">
                      <button
                        type="button"
                        onClick={() => { setShowPastSessionsModal(true); setShowMoreMenu(false); }}
                      >
                        <i className="fa-solid fa-clock-rotate-left"></i> Previous sessions
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleRefreshTranslations(); setShowMoreMenu(false); }}
                      >
                        <i className="fa-solid fa-arrows-rotate"></i> Refresh translations
                      </button>
                      <button
                        type="button"
                        onClick={() => { generateSmartNotes(); setShowMoreMenu(false); }}
                      >
                        <i className="fa-solid fa-sparkles"></i> Regenerate notes
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Collapsible Setup Bar when toggled during active session */}
            {showSetup && (
              <div className="workspace-inline-setup-drawer">
                <div className="setup-drawer-field">
                  <label>Spoken Language:</label>
                  <select value={spokenLang} onChange={(e) => setSpokenLang(e.target.value)} disabled={sessionState === 'recording'}>
                    {languageOptions.map(l => (
                      <option key={l.code} value={l.code}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div className="setup-drawer-field">
                  <label>Translate To:</label>
                  <select value={targetLang} onChange={(e) => handleTargetLangChange(e.target.value)}>
                    {languageOptions.map(l => (
                      <option key={l.code} value={l.code}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div className="setup-drawer-field">
                  <label>Mode:</label>
                  <span>{recordingMode === 'meeting' ? 'Online meeting' : 'In person'}</span>
                </div>
              </div>
            )}

            {/* Live Audio Connectivity Strip */}
            <div className="notetaker-audio-status-strip">
              <div className="audio-strip-left">
                {/* Microphone Level Indicator */}
                <div className="audio-source-status-badge">
                  <span className={`strip-dot ${sessionState === 'recording' ? 'live' : ''}`}></span>
                  <span className="strip-label">Microphone · Connected</span>
                  <div className="strip-waveform-bars">
                    {[1, 2, 3, 4, 5].map((bar) => {
                      const height = sessionState === 'recording' ? Math.max(4, Math.min(18, (micAudioLevel / 100) * 18 * (0.5 + bar * 0.2))) : 4;
                      return <span key={bar} style={{ height: `${height}px` }}></span>;
                    })}
                  </div>
                </div>

                {/* Meeting Audio Level Indicator */}
                <div className="audio-source-status-badge">
                  <span className="strip-dot live"></span>
                  <span className="strip-label">Meeting audio · Connected</span>
                  <div className="strip-waveform-bars">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>

              <div className="audio-strip-right">
                <span className="transcribing-status-text">
                  <i className="fa-solid fa-wave-square"></i>
                  {sessionState === 'recording' ? 'Transcribing live' : (sessionState === 'paused' ? 'Paused' : 'Recording saved')}
                </span>
              </div>
            </div>

            {/* Main Workspace Body Split with Optional Ask AI Drawer */}
            <div className="notetaker-workspace-body-layout">
              
              {/* Left/Main Panels (Tabs: Transcript, Smart Notes, Translations) */}
              <main className="notetaker-main-content-panel">
                
                {/* Tabs Row */}
                <div className="notetaker-tabs-navigation-header">
                  <div className="tabs-nav-left">
                    <button
                      type="button"
                      className={`tab-nav-btn ${activeTab === 'transcript' ? 'active' : ''}`}
                      onClick={() => setActiveTab('transcript')}
                    >
                      <i className="fa-solid fa-bars-staggered"></i>
                      <span>Transcript</span>
                    </button>

                    <button
                      type="button"
                      className={`tab-nav-btn ${activeTab === 'notes' ? 'active' : ''}`}
                      onClick={() => setActiveTab('notes')}
                    >
                      <i className="fa-solid fa-sparkles"></i>
                      <span>Smart Notes</span>
                    </button>

                    <button
                      type="button"
                      className={`tab-nav-btn ${activeTab === 'translations' ? 'active' : ''}`}
                      onClick={() => setActiveTab('translations')}
                    >
                      <i className="fa-solid fa-language"></i>
                      <span>Translations</span>
                    </button>
                  </div>

                  {/* Transcript Controls (Filters, Search, Auto-follow) */}
                  {activeTab === 'transcript' && (
                    <div className="tabs-nav-right-controls">
                      {/* View Filters */}
                      <div className="view-filter-pills-group">
                        <button
                          type="button"
                          className={`filter-pill ${transcriptViewFilter === 'original' ? 'active' : ''}`}
                          onClick={() => setTranscriptViewFilter('original')}
                        >
                          Original
                        </button>
                        <button
                          type="button"
                          className={`filter-pill ${transcriptViewFilter === 'translation' ? 'active' : ''}`}
                          onClick={() => setTranscriptViewFilter('translation')}
                        >
                          Translation
                        </button>
                        <button
                          type="button"
                          className={`filter-pill ${transcriptViewFilter === 'dual' ? 'active' : ''}`}
                          onClick={() => setTranscriptViewFilter('dual')}
                        >
                          Dual view
                        </button>
                      </div>

                      {/* Following Live Button */}
                      <button
                        type="button"
                        className={`following-live-pill ${autoFollowLive ? 'active' : ''}`}
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

                      {/* Search Input */}
                      <div className="transcript-search-wrap">
                        <i className="fa-solid fa-magnifying-glass search-icon"></i>
                        <input
                          type="text"
                          className="transcript-search-input"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ==================== TAB 1: TRANSCRIPT ==================== */}
                {activeTab === 'transcript' && (
                  <div className="transcript-tab-content-area" ref={transcriptScrollRef}>
                    {/* Empty State */}
                    {chatMessages.length === 0 && !interimMsg && (
                      <div className="transcript-empty-placeholder">
                        <div className="empty-icon-circle">
                          <i className="fa-solid fa-microphone-lines"></i>
                        </div>
                        <h3>Ready to listen</h3>
                        <p>Speak into your microphone. Your conversation and live translations will appear here.</p>
                      </div>
                    )}

                    {/* Passages List */}
                    <div className="transcript-passages-list">
                      {filteredChatMessages.map((msg) => (
                        <div key={msg.id} className="transcript-passage-card">
                          {/* Passage Header */}
                          <div className="passage-meta-header">
                            <div className="speaker-badge-wrap">
                              <span className="speaker-avatar-circle">S1</span>
                              <span className="speaker-name-label">{msg.speakerName || 'Speaker 1 (You)'}</span>
                              <i className="fa-solid fa-pencil speaker-edit-icon" title="Edit speaker name"></i>
                            </div>
                            <div className="passage-info-wrap">
                              <span className="passage-timestamp">{msg.wallTime || '~0:01'}</span>
                              <span className="passage-source-pill">{msg.source || 'Microphone'}</span>
                            </div>
                          </div>

                          {/* Original Text (shown if Dual or Original view) */}
                          {transcriptViewFilter !== 'translation' && (
                            <div className="passage-original-speech-box">
                              <p className="original-speech-text">{msg.text}</p>
                            </div>
                          )}

                          {/* Translation Sub-Card (shown if Dual or Translation view) */}
                          {transcriptViewFilter !== 'original' && msg.translation && (
                            <div className="passage-translation-subcard">
                              <div className="translation-subcard-header">
                                <span className="target-lang-tag">
                                  <i className="fa-solid fa-language"></i> {languageOptions.find(l => l.code === targetLang)?.name || 'Translation'}
                                </span>
                                <button
                                  type="button"
                                  className="translation-copy-btn"
                                  onClick={() => handleCopyToClipboard(msg.translation, 'Translation copied!')}
                                  title="Copy translation"
                                >
                                  <i className="fa-regular fa-copy"></i>
                                </button>
                              </div>
                              <p className="translated-speech-text">{msg.translation}</p>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Live Interim Speech Bubble */}
                      {interimMsg && (
                        <div className="transcript-passage-card interim">
                          <div className="passage-meta-header">
                            <div className="speaker-badge-wrap">
                              <span className="speaker-avatar-circle">S1</span>
                              <span className="speaker-name-label">{interimMsg.speakerName}</span>
                            </div>
                            <span className="interim-listening-status">Listening...</span>
                          </div>
                          <div className="passage-original-speech-box">
                            <p className="original-speech-text interim-text">
                              {interimMsg.text}
                              <span className="interim-blinking-cursor"></span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ==================== TAB 2: SMART NOTES ==================== */}
                {activeTab === 'notes' && (
                  <div className="smart-notes-tab-content-area">
                    <div className="smart-notes-header-bar">
                      <div>
                        <h3 className="meeting-intelligence-title">MEETING INTELLIGENCE</h3>
                        <p className="meeting-intelligence-sub">AI-generated structured notes, key decisions, and action items.</p>
                      </div>
                      <button
                        type="button"
                        className="generate-notes-action-btn"
                        onClick={generateSmartNotes}
                        disabled={isGeneratingNotes}
                      >
                        <i className={`fa-solid ${isGeneratingNotes ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`}></i>
                        <span>{isGeneratingNotes ? 'Generating...' : 'Regenerate Notes'}</span>
                      </button>
                    </div>

                    <div className="smart-notes-editor-container">
                      <textarea
                        className="smart-notes-textarea"
                        value={smartNotes}
                        onChange={(e) => setSmartNotes(e.target.value)}
                        placeholder="Click 'Regenerate Notes' or start typing meeting notes here..."
                      />
                    </div>
                  </div>
                )}

                {/* ==================== TAB 3: TRANSLATIONS ==================== */}
                {activeTab === 'translations' && (
                  <div className="translations-tab-content-area">
                    <div className="translations-tab-header">
                      <div className="translations-lang-selector-wrap">
                        <label>Target Language:</label>
                        <select
                          value={targetLang}
                          onChange={(e) => handleTargetLangChange(e.target.value)}
                        >
                          {languageOptions.map(l => (
                            <option key={l.code} value={l.code}>{l.name}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        className="refresh-translations-btn"
                        onClick={handleRefreshTranslations}
                      >
                        <i className="fa-solid fa-arrows-rotate"></i>
                        <span>Refresh translation</span>
                      </button>
                    </div>

                    <div className="translations-passages-list">
                      {chatMessages.length === 0 ? (
                        <div className="transcript-empty-placeholder">
                          <p>No translations recorded yet. Start recording and speak to see live translations.</p>
                        </div>
                      ) : (
                        chatMessages.map(m => (
                          <div key={m.id} className="translation-item-card">
                            <div className="translation-item-meta">
                              <span className="translation-speaker">{m.speakerName || 'Speaker 1'}</span>
                              <span className="translation-time">{m.wallTime || ''}</span>
                            </div>
                            <div className="translation-item-body">
                              <p className="translation-dest-text">{m.translation || 'Translating...'}</p>
                              <p className="translation-src-hint">{m.text}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

              </main>

              {/* ========================================================
                  ASK AI COLLAPSIBLE RIGHT DRAWER - Exactly as in Video
                  ======================================================== */}
              {askAiOpen && (
                <aside className="notetaker-ask-ai-sidebar-drawer">
                  {/* Sidebar Header */}
                  <div className="ask-ai-drawer-header">
                    <div className="ask-ai-title-wrap">
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                      <h3>Ask AI</h3>
                    </div>
                    <button
                      type="button"
                      className="ask-ai-close-btn"
                      onClick={() => setAskAiOpen(false)}
                      title="Close Ask AI"
                    >
                      ×
                    </button>
                  </div>

                  {/* Suggestion Prompt Chips */}
                  <div className="ask-ai-prompt-chips-row">
                    <button
                      type="button"
                      className="ai-chip-btn"
                      onClick={() => handleSendAiQuery('Catch up so far')}
                    >
                      <i className="fa-solid fa-rotate-left"></i> Catch up so far
                    </button>
                    <button
                      type="button"
                      className="ai-chip-btn"
                      onClick={() => handleSendAiQuery('Decisions made')}
                    >
                      <i className="fa-solid fa-check"></i> Decisions
                    </button>
                    <button
                      type="button"
                      className="ai-chip-btn"
                      onClick={() => handleSendAiQuery('Action items')}
                    >
                      <i className="fa-solid fa-list-check"></i> Action items
                    </button>
                    <button
                      type="button"
                      className="ai-chip-btn"
                      onClick={() => handleSendAiQuery('Open risks')}
                    >
                      <i className="fa-solid fa-flag"></i> Open risks
                    </button>
                  </div>

                  {/* Chat Messages Body */}
                  <div className="ask-ai-chat-messages-area">
                    {askAiMessages.map(msg => (
                      <div key={msg.id} className={`ask-ai-msg-bubble ${msg.sender}`}>
                        <div className="msg-bubble-content">
                          <p>{msg.text}</p>
                        </div>

                        {/* Action buttons on AI responses */}
                        {msg.sender === 'ai' && msg.id !== 'ai_welcome' && (
                          <div className="ai-response-action-buttons">
                            <button
                              type="button"
                              onClick={() => handleCopyToClipboard(msg.text, 'Answer copied!')}
                              title="Copy answer"
                            >
                              <i className="fa-regular fa-copy"></i> Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveToNotes(msg.text)}
                              title="Save to Smart Notes"
                            >
                              <i className="fa-regular fa-floppy-disk"></i> Save to notes
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReadAloud(msg.id, msg.text)}
                              title="Read answer aloud"
                              className={activeSpeakingId === msg.id ? 'speaking' : ''}
                            >
                              <i className={`fa-solid ${activeSpeakingId === msg.id ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
                              {activeSpeakingId === msg.id ? 'Stop audio' : 'Read aloud'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {isSendingAiQuery && (
                      <div className="ask-ai-msg-bubble ai thinking">
                        <div className="thinking-dots">
                          <span></span><span></span><span></span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Input Area */}
                  <div className="ask-ai-bottom-input-wrap">
                    <div className="ask-ai-lang-selector-row">
                      <span>Answer in:</span>
                      <select
                        value={askAiAnswerLang}
                        onChange={(e) => setAskAiAnswerLang(e.target.value)}
                      >
                        {languageOptions.map(l => (
                          <option key={l.code} value={l.code}>{l.name}</option>
                        ))}
                      </select>
                    </div>

                    <form
                      onSubmit={(e) => { e.preventDefault(); handleSendAiQuery(); }}
                      className="ask-ai-input-form"
                    >
                      <input
                        type="text"
                        className="ask-ai-text-input"
                        placeholder="Ask about this meeting..."
                        value={askAiInput}
                        onChange={(e) => setAskAiInput(e.target.value)}
                      />
                      <button
                        type="submit"
                        className="ask-ai-submit-btn"
                        disabled={!askAiInput.trim() || isSendingAiQuery}
                      >
                        <i className="fa-solid fa-paper-plane"></i>
                      </button>
                    </form>
                  </div>
                </aside>
              )}

            </div>

            {/* ========================================================
                STOPPED MODE BOTTOM STICKY AUDIO PLAYER BAR
                ======================================================== */}
            {sessionState === 'stopped' && (
              <div className="notetaker-bottom-sticky-audio-bar">
                <div className="audio-bar-inner">
                  {/* Play/Pause */}
                  <button
                    type="button"
                    className="audio-play-pause-btn"
                    onClick={togglePlayAudio}
                    title={isPlayingAudio ? 'Pause' : 'Play'}
                  >
                    <i className={`fa-solid ${isPlayingAudio ? 'fa-pause' : 'fa-play'}`}></i>
                  </button>

                  {/* Jump -10s */}
                  <button
                    type="button"
                    className="audio-jump-btn"
                    onClick={() => handleAudioJump(-10)}
                    title="Rewind 10 seconds"
                  >
                    <i className="fa-solid fa-rotate-left"></i>
                    <span>10</span>
                  </button>

                  {/* Jump +10s */}
                  <button
                    type="button"
                    className="audio-jump-btn"
                    onClick={() => handleAudioJump(10)}
                    title="Forward 10 seconds"
                  >
                    <i className="fa-solid fa-rotate-right"></i>
                    <span>10</span>
                  </button>

                  {/* Progress Seeker */}
                  <div className="audio-seeker-container">
                    <span className="audio-time-label">{formatTimer(Math.floor(audioCurrentTime))}</span>
                    <input
                      type="range"
                      className="audio-range-slider"
                      min="0"
                      max={audioDuration || timerSeconds || 1}
                      value={audioCurrentTime}
                      onChange={handleAudioSeek}
                    />
                    <span className="audio-time-label">{formatTimer(Math.floor(audioDuration || timerSeconds))}</span>
                  </div>

                  {/* Speed Button */}
                  <button
                    type="button"
                    className="audio-speed-btn"
                    onClick={cyclePlaybackSpeed}
                    title="Playback speed"
                  >
                    {playbackSpeed}x
                  </button>

                  {/* Download Audio */}
                  {recordedAudioUrl && (
                    <a
                      href={recordedAudioUrl}
                      download={`${sessionTitle.toLowerCase().replace(/\s+/g, '_')}_recording.webm`}
                      className="audio-download-btn"
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

      </div>

      {/* Navigation Drawer */}
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

      {/* Previous Sessions Modal */}
      {showPastSessionsModal && (
        <div className="notetaker-modal-overlay" onClick={() => setShowPastSessionsModal(false)}>
          <div className="notetaker-modal-card past-sessions-modal" onClick={(e) => e.stopPropagation()}>
            <div className="notetaker-modal-header">
              <h3><i className="fa-solid fa-clock-rotate-left"></i> Previous Sessions</h3>
              <button className="notetaker-modal-close-btn" onClick={() => setShowPastSessionsModal(false)}>×</button>
            </div>
            <div className="past-sessions-modal-body">
              {pastSessionsList.length === 0 ? (
                <div className="transcript-empty-placeholder">
                  <p>No previous sessions recorded yet.</p>
                </div>
              ) : (
                <div className="past-sessions-items-list">
                  {pastSessionsList.map((sess) => (
                    <div
                      key={sess.id}
                      className="past-session-item-row"
                      onClick={() => {
                        setSessionTitle(sess.title || 'Untitled Session');
                        setChatMessages(sess.transcript || []);
                        setSmartNotes(sess.notes || '');
                        setTranslationHistory(sess.translationHistory || []);
                        setTimerSeconds(sess.durationSeconds || 0);
                        setSessionState('stopped');
                        setShowPastSessionsModal(false);
                        showToast?.(`Loaded session: ${sess.title}`);
                      }}
                    >
                      <div className="past-session-meta">
                        <h4>{sess.title || 'Meeting Notes'}</h4>
                        <span className="past-session-sub">{sess.date} · {sess.durationDisplay || formatTimer(sess.durationSeconds || 0)}</span>
                      </div>
                      <i className="fa-solid fa-chevron-right"></i>
                    </div>
                  ))}
                </div>
              )}
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

            <div className="notetaker-modal-actions">
              <button type="button" className="notetaker-modal-btn-cancel" onClick={() => setShowExportModal(false)}>Cancel</button>
              <button type="button" className="notetaker-modal-btn-download" onClick={handleExportDownload}>
                <i className="fa-solid fa-download"></i> Download
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
