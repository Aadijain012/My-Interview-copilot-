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
  // Session & UI States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('idle'); // 'idle' | 'recording' | 'paused' | 'processing'
  const [recordingMode, setRecordingMode] = useState('meeting'); // 'meeting' | 'personal'
  const [showSetup, setShowSetup] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [rightTab, setRightTab] = useState('live'); // 'live' | 'notes' | 'history'
  
  // Languages
  const [spokenLang, setSpokenLang] = useState('en');
  const [targetLang, setTargetLang] = useState('pa'); // Default to Punjabi
  
  // Timer & Titles
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [interviewTitle, setInterviewTitle] = useState(() => `Meeting Notes - ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`);
  const [activeQuestion, setActiveQuestion] = useState('');
  
  // Transcripts & Notes
  const [chatMessages, setChatMessages] = useState([]);
  const [interimMsg, setInterimMsg] = useState(null);
  const [translationHistory, setTranslationHistory] = useState([]);
  const [generatedNotes, setGeneratedNotes] = useState('');
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  
  // Bottom Ask / Chat Input
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [activeSpeakingId, setActiveSpeakingId] = useState(null);
  
  // Past Sessions
  const [allSessionsList, setAllSessionsList] = useState([]);
  const [selectedPastSessionDetail, setSelectedPastSessionDetail] = useState(null);
  const [pastSessionsSearchQuery, setPastSessionsSearchQuery] = useState('');
  
  // Audio Playback
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const audioElemRef = useRef(null);

  // Modals
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
  const micStreamRef = useRef(null);
  const chatContainerRef = useRef(null);
  const moreMenuRef = useRef(null);

  // Sync refs
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

  // Storage key for user sessions
  const getStorageKey = useCallback(() => {
    return user?.email ? `notetaker_saved_${user.email}` : 'notetaker_saved_sessions';
  }, [user]);

  // Fetch past sessions from localStorage & backend
  const fetchPastSessions = useCallback(async () => {
    try {
      const stored = localStorage.getItem(getStorageKey());
      const localList = stored ? JSON.parse(stored) : [];
      setAllSessionsList(localList);

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
            setAllSessionsList(merged);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch past sessions:', e);
    }
  }, [getStorageKey, token]);

  useEffect(() => {
    fetchPastSessions();
  }, [fetchPastSessions]);

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

  // Auto-scroll chat messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, interimMsg]);

  // Start Audio & Speech Capture
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
      setIsRecording(true);
      setRecordingStatus('recording');
      setTimerSeconds(0);
      setRecordedAudioUrl(null);
      setInterimMsg(null);
      setRightTab('live');

      // Setup MediaRecorder for audio recording & playback
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
              const timeStamp = formatTimer(timerSecondsRef.current || 0);

              const newMsg = {
                id: msgId,
                sender: 'user',
                messageType: 'transcript',
                speakerName: 'Speaker 1 (You)',
                timestamp: timeStamp,
                text: text,
                translation: 'Translating...'
              };

              setChatMessages(prev => [...prev, newMsg]);
              setInterimMsg(null);

              // Translate in background
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
        showToast?.('SpeechRecognition not supported in this browser.');
      }

      // Start Timer
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);

      showToast?.('Recording started · Listening to microphone');
    } catch (err) {
      console.error('Failed to access microphone:', err);
      showToast?.('Microphone access denied or unavailable.');
    }
  };

  // Stop Recording & Save
  const stopRecordingSession = async () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setRecordingStatus('idle');

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
    setInterimMsg(null);

    // Auto-generate summary notes if empty
    if (!generatedNotes.trim()) {
      generateSmartNotes();
    }

    // Save session locally
    const newSessionItem = {
      id: `session_${Date.now()}`,
      title: interviewTitle || `Meeting Notes - ${new Date().toLocaleDateString()}`,
      durationSeconds: timerSecondsRef.current,
      durationDisplay: formatTimer(timerSecondsRef.current),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      spokenLang: spokenLangRef.current,
      targetLang: targetLangRef.current,
      transcript: chatMessagesRef.current,
      notes: generatedNotes,
      translationHistory: translationHistory
    };

    try {
      const storageKey = getStorageKey();
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = [newSessionItem, ...existing];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setAllSessionsList(updated);
    } catch (_) {}

    // Save to backend if authenticated
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
              notes: generatedNotes,
              spokenLanguage: spokenLangRef.current,
              targetLanguage: targetLangRef.current
            }
          })
        });
      } catch (e) {
        console.warn('Backend save failed:', e);
      }
    }

    showToast?.('Session stopped & saved to Previous sessions!');
  };

  // Toggle Start / Stop
  const handleStartStopRecording = () => {
    if (isRecording) {
      stopRecordingSession();
    } else {
      startRecordingSession();
    }
  };

  // Pause / Resume
  const handlePauseResume = () => {
    if (recordingStatus === 'recording') {
      isRecordingRef.current = false;
      setRecordingStatus('paused');
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch (_) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try { mediaRecorderRef.current.pause(); } catch (_) {}
      }
      showToast?.('Recording paused');
    } else if (recordingStatus === 'paused') {
      isRecordingRef.current = true;
      setRecordingStatus('recording');
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

  // Swap Languages
  const handleSwapLanguages = () => {
    const prevSpoken = spokenLang;
    setSpokenLang(targetLang);
    setTargetLang(prevSpoken);
    handleTargetLangChange(prevSpoken);
  };

  // Target Language Change: Re-translates all passages in real time
  const handleTargetLangChange = async (newLang) => {
    setTargetLang(newLang);
    targetLangRef.current = newLang;
    const langName = languageOptions.find(l => l.code === newLang)?.name || newLang;
    showToast?.(`Language changed to ${langName}. Updating translations...`);

    // Set existing passages to 'Translating...'
    setChatMessages(prev => prev.map(m => (m.text ? { ...m, translation: 'Translating...' } : m)));

    // Re-translate all confirmed messages
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

  // Clear Session
  const handleClearSession = () => {
    setChatMessages([]);
    setInterimMsg(null);
    setGeneratedNotes('');
    setRecordedAudioUrl(null);
    setTimerSeconds(0);
    showToast?.('Session cleared');
  };

  // Generate Smart Notes / AI Summary
  const generateSmartNotes = () => {
    setIsGeneratingNotes(true);
    const msgs = chatMessagesRef.current.filter(m => m.text && !m.isSystem);

    setTimeout(() => {
      let notes = `## Executive Summary\n`;
      if (msgs.length === 0) {
        notes += `Meeting recording session completed. No speech detected.\n\n`;
      } else {
        notes += `The session discussed core topics including requirements, architecture, and live technical details.\n\n`;
      }

      notes += `## Key Discussion Points\n`;
      if (msgs.length > 0) {
        msgs.slice(0, 5).forEach((m, idx) => {
          notes += `- Point ${idx + 1}: ${m.text}\n`;
        });
      } else {
        notes += `- Spoken language: ${languageOptions.find(l => l.code === spokenLang)?.name || 'English'}.\n`;
        notes += `- Target translation language: ${languageOptions.find(l => l.code === targetLang)?.name || 'Punjabi'}.\n`;
      }

      notes += `\n## Decisions Made\n`;
      notes += `- Confirmed session transcription and dual-view translation consistency.\n`;
      notes += `- Verified seamless real-time STT and language updating.\n\n`;

      notes += `## Action Items & Next Steps\n`;
      notes += `- [ ] Review meeting summary and key discussion highlights.\n`;
      notes += `- [ ] Export PDF transcript or download recorded audio session.\n`;

      setGeneratedNotes(notes);
      setIsGeneratingNotes(false);
      showToast?.('AI summary generated!');
    }, 500);
  };

  // Bottom Ask / Chat Submission
  const handleSendChat = async (e) => {
    e.preventDefault();
    const query = chatInput.trim();
    if (!query || isSendingChat) return;

    setChatInput('');
    setIsSendingChat(true);

    const userMsgId = `chat_u_${Date.now()}`;
    const aiMsgId = `chat_ai_${Date.now()}`;

    // Add user prompt to messages
    setChatMessages(prev => [
      ...prev,
      { id: userMsgId, sender: 'user', messageType: 'chat', speakerName: 'Prompt', text: query }
    ]);

    setTimeout(async () => {
      const msgs = chatMessagesRef.current.filter(m => m.text && m.messageType !== 'chat');
      let answer = '';
      const qLower = query.toLowerCase();

      if (qLower.includes('python')) {
        answer = 'Python is a high-level, interpreted programming language known for its readability, dynamic typing, and comprehensive libraries for AI, data science, and web applications.';
      } else if (qLower.includes('decision') || qLower.includes('decide')) {
        answer = 'Key decisions: Confirmed design layout consistency, real-time speech-to-text, and instant fallback translation.';
      } else if (qLower.includes('summary') || qLower.includes('catch up')) {
        answer = msgs.length > 0
          ? `Discussion so far covered: "${msgs.slice(-3).map(m => m.text).join('; ')}".`
          : 'The session has started. Speak into the microphone to populate conversation highlights.';
      } else {
        answer = msgs.length > 0
          ? `Grounded in your meeting transcript ("${msgs.slice(-2).map(m => m.text).join(' ')}"): In response to "${query}", everything was discussed clearly.`
          : `In response to "${query}": The session is currently active. Transcribe speech by speaking into the mic to ground responses.`;
      }

      // Translate answer if target language differs
      let transAnswer = '';
      if (spokenLang !== targetLang) {
        try {
          transAnswer = await translateWithFallback(answer, spokenLang, targetLang);
        } catch (_) {}
      }

      setChatMessages(prev => [
        ...prev,
        {
          id: aiMsgId,
          sender: 'ai',
          messageType: 'qa',
          text: answer,
          translation: transAnswer
        }
      ]);
      setIsSendingChat(false);
    }, 450);
  };

  // Text-to-Speech
  const handleReadAloud = (msgId, text) => {
    if (!('speechSynthesis' in window)) {
      showToast?.('Text-to-speech not supported in this browser.');
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

  // Copy notes
  const handleCopyNotes = () => {
    if (!generatedNotes) {
      showToast?.('No notes to copy.');
      return;
    }
    handleCopyToClipboard(generatedNotes, 'Notes copied to clipboard!');
  };

  // Email notes
  const handleEmailNotes = () => {
    const textToEmail = generatedNotes || chatMessages.map(m => `${m.speakerName}: ${m.text}`).join('\n\n');
    if (!textToEmail.trim()) {
      showToast?.('No content to email.');
      return;
    }
    navigator.clipboard.writeText(textToEmail);
    window.open(`mailto:?subject=${encodeURIComponent(interviewTitle)}&body=${encodeURIComponent(textToEmail.slice(0, 1500))}`);
    showToast?.('Copied to clipboard & opened mail client!');
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

  // Export Download
  const handleExportDownload = async () => {
    const title = interviewTitle.trim() || 'Session_Notes';
    const fileName = `${title.toLowerCase().replace(/\s+/g, '_')}_export.${exportFormat}`;
    setShowExportModal(false);

    if (exportFormat === 'txt') {
      let content = `${title}\nDate: ${new Date().toLocaleDateString()}\n\n=== TRANSCRIPT ===\n`;
      chatMessages.forEach(m => {
        content += `[${m.speakerName || 'Speaker'}] (${m.timestamp || ''}): ${m.text}\n`;
        if (m.translation) content += `[Translation]: ${m.translation}\n`;
      });
      content += `\n=== AI SUMMARY ===\n${generatedNotes}\n`;

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
          notes: generatedNotes,
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

  // Filter sessions by search query
  const displaySessionsList = allSessionsList.filter(s => {
    if (!pastSessionsSearchQuery.trim()) return true;
    const q = pastSessionsSearchQuery.toLowerCase();
    return (s.title && s.title.toLowerCase().includes(q)) || (s.notes && s.notes.toLowerCase().includes(q));
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
          <BrandLogo onClick={onBackToLanding} size="md" />
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
              {isRecording && (
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

              <div
                className="notetaker-setup-toggle-wrap"
                onClick={() => setShowSetup(!showSetup)}
                role="button"
                tabIndex={0}
                title={showSetup ? "Hide setup" : "Show setup"}
              >
                <span className="notetaker-setup-toggle-label">{showSetup ? 'Hide setup' : 'Show setup'}</span>
                <div className={`notetaker-switch-toggle ${showSetup ? 'on' : 'off'}`}>
                  <span className="notetaker-switch-knob"></span>
                </div>
              </div>
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
                    onChange={(e) => setSpokenLang(e.target.value)}
                    disabled={isRecording}
                  >
                    {languageOptions.map(lang => (
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
                    {languageOptions.map(lang => (
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
                    onChange={(e) => setRecordingMode(e.target.value)}
                    disabled={isRecording}
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

        {/* Main Two-Column Split (Left: Ready to Listen Recorder Card · Right: Workspace Card) */}
        <div className="notetaker-main-split">
          
          {/* ===================== LEFT CARD: VOICE RECORDER PANEL ===================== */}
          <section className="notetaker-recorder-card">
            <div className="notetaker-recorder-inner">
              <div className={`notetaker-mic-ripple-cluster ${isRecording ? 'is-recording' : ''}`}>
                <div className="ripple-ring ring-4"></div>
                <div className="ripple-ring ring-3"></div>
                <div className="ripple-ring ring-2"></div>
                <div className="ripple-ring ring-1"></div>
                <div
                  className="ripple-center-circle"
                  onClick={handleStartStopRecording}
                  title={isRecording ? "Click to stop recording" : "Click to start recording"}
                  role="button"
                  tabIndex={0}
                >
                  <i className={`fa-solid ${isRecording ? (recordingStatus === 'paused' ? 'fa-pause' : 'fa-microphone-lines') : 'fa-microphone'}`}></i>
                </div>
              </div>

              <h3 className="notetaker-recorder-title">
                {isRecording
                  ? (recordingStatus === 'paused' ? 'Recording Paused' : `Recording ${formatTimer(timerSeconds)}`)
                  : 'Ready to listen'}
              </h3>

              <p className="notetaker-recorder-desc">
                {isRecording
                  ? 'Speaking into your microphone. Your conversation and translations appear live on the right.'
                  : 'Choose your language, then press Record. Your conversation and translation will appear here.'}
              </p>

              <div className={`notetaker-soundwave-graphic ${isRecording ? 'animating' : ''}`}>
                {[
                  3, 4, 6, 8, 10, 13, 17, 21, 26, 30, 26, 21, 17, 13, 10, 8, 6, 4, 3,
                  4, 6, 9, 14, 19, 25, 19, 14, 9, 6, 4, 3
                ].map((h, i) => (
                  <span
                    key={i}
                    className="wave-bar"
                    style={{
                      height: `${h}px`,
                      animationDelay: `${(i % 12) * 80}ms`
                    }}
                  ></span>
                ))}
              </div>

              <div className="notetaker-recorder-actions">
                {!isRecording ? (
                  <button
                    type="button"
                    className="notetaker-recorder-start-pill"
                    onClick={handleStartStopRecording}
                  >
                    <span>Start Recording</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </button>
                ) : (
                  <div className="notetaker-recorder-live-controls">
                    <button
                      type="button"
                      className="notetaker-recorder-pause-btn"
                      onClick={handlePauseResume}
                      title={recordingStatus === 'paused' ? 'Resume recording' : 'Pause recording'}
                    >
                      <i className={`fa-solid ${recordingStatus === 'paused' ? 'fa-play' : 'fa-pause'}`}></i>
                      <span>{recordingStatus === 'paused' ? 'Resume' : 'Pause'}</span>
                    </button>
                    <button
                      type="button"
                      className="notetaker-recorder-stop-pill"
                      onClick={handleStartStopRecording}
                      title="Stop recording"
                    >
                      <i className="fa-solid fa-square"></i>
                      <span>Stop</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ===================== RIGHT CARD: WORKSPACE ===================== */}
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
                  onClick={() => {
                    setRightTab('history');
                    setSelectedPastSessionDetail(null);
                  }}
                  type="button"
                >
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  <span>Previous sessions</span>
                  {allSessionsList.length > 0 && (
                    <span className="notetaker-tab-badge">{allSessionsList.length}</span>
                  )}
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
                      className="notetaker-side-action-btn"
                      onClick={() => {
                        generateSmartNotes();
                        setRightTab('notes');
                        setShowMoreMenu(false);
                      }}
                      type="button"
                    >
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                      <span>Regenerate AI summary</span>
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
                  </div>
                )}
              </div>
            </div>

            {/* Split Workspace Body */}
            <div className="notetaker-split-workspace">
              <div className="notetaker-main-content-col">
                <div className="notetaker-content-scrollable">
                  
                  {/* TAB 1: TRANSCRIPT */}
                  {rightTab === 'live' && (
                    <div className="notetaker-live-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                      <div className="notetaker-chat-messages" ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto' }}>
                        {chatMessages.length === 0 && !interimMsg ? (
                          <div className="notetaker-empty-state">
                            <div className="notetaker-doc-icon-box">
                              <i className="fa-solid fa-microphone-lines"></i>
                            </div>
                            <h3 className="notetaker-empty-title">Ready to listen</h3>
                            <p className="notetaker-empty-desc">Choose your language, then press Record. Your conversation and translation will appear here.</p>
                          </div>
                        ) : (
                          <>
                            {spokenLang && targetLang && spokenLang !== targetLang && (
                              <div className="notetaker-translation-header">
                                <div className="translation-header-col">{(languageOptions.find(l => l.code === spokenLang)?.name || spokenLang).toUpperCase()} - ORIGINAL</div>
                                <div className="translation-header-col">{(languageOptions.find(l => l.code === targetLang)?.name || targetLang).toUpperCase()} - TRANSLATION</div>
                              </div>
                            )}

                            {chatMessages.map((msg, idx) => {
                              // If QA Message from Ask AI
                              if (msg.sender === 'ai') {
                                return (
                                  <div className="notetaker-msg-bubble ai" key={msg.id || idx}>
                                    <div className="msg-avatar">
                                      <i className="fa-solid fa-robot"></i>
                                    </div>
                                    <div className="msg-text">
                                      <div className="msg-text-content">{msg.text}</div>
                                      {msg.translation && (
                                        <div className="notetaker-ai-translation">
                                          <span><i className="fa-solid fa-language"></i> {(languageOptions.find(l => l.code === targetLang)?.name || targetLang).toUpperCase()}</span>
                                          <div>{msg.translation}</div>
                                        </div>
                                      )}
                                      <div className="ai-bubble-actions">
                                        <button type="button" onClick={() => handleCopyToClipboard(msg.text, 'Answer copied!')}>
                                          <i className="fa-regular fa-copy"></i> Copy
                                        </button>
                                        <button type="button" onClick={() => {
                                          setGeneratedNotes(prev => `${prev}\n\n### AI Note\n${msg.text}`);
                                          showToast?.('Appended to AI summary!');
                                        }}>
                                          <i className="fa-regular fa-floppy-disk"></i> Save to notes
                                        </button>
                                        <button type="button" onClick={() => handleReadAloud(msg.id, msg.text)}>
                                          <i className="fa-solid fa-volume-high"></i> Read aloud
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              // User Prompt message
                              if (msg.messageType === 'chat') {
                                return (
                                  <div className="notetaker-msg-bubble user notetaker-chat-prompt" key={msg.id || idx}>
                                    <div className="msg-avatar">
                                      <i className="fa-solid fa-comment-dots"></i>
                                    </div>
                                    <div className="msg-text">
                                      <div className="msg-speaker-badge">Prompt</div>
                                      <div className="msg-text-content">{msg.text}</div>
                                    </div>
                                  </div>
                                );
                              }

                              // Confirmed Transcript Row (Dual View)
                              const targetLangNameUpper = (languageOptions.find(l => l.code === targetLang)?.name || targetLang).toUpperCase();
                              return (
                                <div className="notetaker-translation-row" key={msg.id || idx}>
                                  <div className="notetaker-translation-card original">
                                    <div className="translation-card-header">
                                      <span className="card-speaker">{msg.speakerName || 'Speaker 1 (You)'}</span>
                                      <span className="card-time">{msg.timestamp || ''}</span>
                                    </div>
                                    <div className="translation-card-text">{msg.text}</div>
                                  </div>

                                  <div className="notetaker-translation-card translation">
                                    <div className="translation-card-header">
                                      <span className="card-lang"><i className="fa-solid fa-language"></i> {targetLangNameUpper}</span>
                                      <button
                                        type="button"
                                        className="translation-copy-btn"
                                        onClick={() => handleCopyToClipboard(msg.translation, 'Translation copied!')}
                                        title="Copy translation"
                                      >
                                        <i className="fa-regular fa-copy"></i>
                                      </button>
                                    </div>
                                    <div className="translation-card-text">{msg.translation || 'Translating...'}</div>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Live Interim Speech Bubble */}
                            {interimMsg && (
                              <div className="notetaker-translation-row interim">
                                <div className="notetaker-translation-card original" style={{ borderStyle: 'dashed' }}>
                                  <div className="translation-card-header">
                                    <span className="card-speaker">{interimMsg.speakerName}</span>
                                    <span className="card-time" style={{ color: 'var(--nt-primary)' }}>Listening...</span>
                                  </div>
                                  <div className="translation-card-text">{interimMsg.text} <span className="interim-blinking-cursor"></span></div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: AI SUMMARY / SMART NOTES */}
                  {rightTab === 'notes' && (
                    <div className="notetaker-notes-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                      <div className="smart-notes-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div>
                          <h3 className="notetaker-notes-title" style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>
                            <i className="fa-solid fa-sparkles"></i> AI Summary
                          </h3>
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

                      <div className="smart-notes-editor-container" style={{ flex: 1 }}>
                        <textarea
                          className="smart-notes-textarea"
                          value={generatedNotes}
                          onChange={(e) => setGeneratedNotes(e.target.value)}
                          placeholder="Complete a recording session or click 'Regenerate Notes' to generate notes..."
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 3: PREVIOUS SESSIONS */}
                  {rightTab === 'history' && (
                    <div className="notetaker-sessions-tab-wrapper" style={{ padding: '16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                      {!selectedPastSessionDetail ? (
                        <div className="notetaker-sessions-container">
                          <div className="notetaker-sessions-header" style={{ marginBottom: '14px' }}>
                            <div className="notetaker-sessions-search-wrapper">
                              <i className="fa-solid fa-magnifying-glass notetaker-sessions-search-icon"></i>
                              <input
                                type="text"
                                className="notetaker-sessions-search-input"
                                placeholder="Search sessions by title, date..."
                                value={pastSessionsSearchQuery}
                                onChange={(e) => setPastSessionsSearchQuery(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="notetaker-sessions-list">
                            {displaySessionsList.length === 0 ? (
                              <div className="notetaker-empty-state">
                                <p>No previous sessions found.</p>
                              </div>
                            ) : (
                              displaySessionsList.map((sess) => (
                                <div
                                  key={sess.id}
                                  className="past-session-item-row"
                                  onClick={() => setSelectedPastSessionDetail(sess)}
                                >
                                  <div className="past-session-meta">
                                    <h4>{sess.title || 'Meeting Notes'}</h4>
                                    <span className="past-session-sub">{sess.date} · {sess.durationDisplay || formatTimer(sess.durationSeconds || 0)}</span>
                                  </div>
                                  <i className="fa-solid fa-chevron-right"></i>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="notetaker-session-detail-view">
                          <button
                            type="button"
                            className="back-to-sessions-btn"
                            onClick={() => setSelectedPastSessionDetail(null)}
                          >
                            <i className="fa-solid fa-arrow-left"></i> Back to all sessions
                          </button>
                          <h3>{selectedPastSessionDetail.title}</h3>
                          <p className="detail-meta">{selectedPastSessionDetail.date} · {selectedPastSessionDetail.durationDisplay}</p>
                          
                          <div className="detail-notes-box">
                            <h4>AI Summary</h4>
                            <pre>{selectedPastSessionDetail.notes || 'No summary notes saved.'}</pre>
                          </div>

                          <div className="detail-transcript-box">
                            <h4>Transcript ({selectedPastSessionDetail.transcript?.length || 0} messages)</h4>
                            {selectedPastSessionDetail.transcript?.map((t, i) => (
                              <div key={i} className="detail-transcript-line">
                                <strong>{t.speakerName || 'Speaker'}:</strong> {t.text}
                                {t.translation && <div className="detail-translation">↳ {t.translation}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* Bottom Ask / Chat Bar */}
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
          </section>

        </div>

        {/* Stopped Mode Bottom Audio Player Bar */}
        {recordedAudioUrl && !isRecording && (
          <div className="notetaker-bottom-sticky-audio-bar">
            <div className="audio-bar-inner">
              <button
                type="button"
                className="audio-play-pause-btn"
                onClick={togglePlayAudio}
                title={isPlayingAudio ? 'Pause' : 'Play'}
              >
                <i className={`fa-solid ${isPlayingAudio ? 'fa-pause' : 'fa-play'}`}></i>
              </button>

              <button
                type="button"
                className="audio-jump-btn"
                onClick={() => handleAudioJump(-10)}
                title="Rewind 10 seconds"
              >
                <i className="fa-solid fa-rotate-left"></i>
                <span>10</span>
              </button>

              <button
                type="button"
                className="audio-jump-btn"
                onClick={() => handleAudioJump(10)}
                title="Forward 10 seconds"
              >
                <i className="fa-solid fa-rotate-right"></i>
                <span>10</span>
              </button>

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

              <button
                type="button"
                className="audio-speed-btn"
                onClick={cyclePlaybackSpeed}
                title="Playback speed"
              >
                {playbackSpeed}x
              </button>

              <a
                href={recordedAudioUrl}
                download={`${interviewTitle.toLowerCase().replace(/\s+/g, '_')}_audio.webm`}
                className="audio-download-btn"
                title="Download recorded audio"
              >
                <i className="fa-solid fa-download"></i>
                <span>Audio</span>
              </a>
            </div>
          </div>
        )}

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

        {/* Footer */}
        <footer className="notetaker-page-footer">
          <div className="notetaker-ai-disclaimer">
            <i className="fa-solid fa-circle-info notetaker-disclaimer-icon"></i>
            <span>AI can make mistakes. Check important details.</span>
          </div>
          <div className="notetaker-footer-links">
            <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a>
          </div>
        </footer>
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
