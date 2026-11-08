import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import BrandLogo from './common/BrandLogo';
import './VoiceAgent.css';
import AccountDropdown from './UserProfile/AccountDropdown';
import CreditUsagePromptModal from './common/CreditUsagePromptModal';
import {
  getVoiceStatus,
  extendVoiceWithCredits,
  getVoiceIntervalMinutes,
  getVoiceCreditCost,
  recordVoiceUsageAction,
  getUserCredits
} from '../config/creditUsageConfig';
import { API_BASE, WS_BASE, websocketProtocols } from '../utils/api';
import { createHourlyUsageBilling } from '../utils/hourlyUsageBilling';

const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;
// Deepgram Voice Agent CONFIG
const CONFIG = {
  listen: { type: "deepgram", model: "flux-general-en", version: "v2" }, // Flux STT
  think: { type: "google", model: "gemini-3.1-flash-lite" },          // LLM
  speak: { type: "deepgram", model: "aura-2-odysseus-en" },             // Aura-2 voice
  outputSampleRate: 24000,
  greeting: "Hello! Welcome to your technical interview. I'm ready to conduct your interview today. When you're ready, let's get started. To begin, could you give a brief introduction of yourself, or would you like to jump right into core technical topics like Python, Java, and computer science fundamentals?",
  prompt: [
    "You are an expert, professional AI technical interviewer conducting a realistic live spoken general technical interview.",
    "",
    "INTERVIEW STRUCTURE & TOPICS (GENERAL TECHNICAL INTERVIEW):",
    "Conduct a comprehensive technical mock interview covering core software engineering topics, including:",
    "- Programming languages: Python, Java, JavaScript, C++, SQL.",
    "- Core programming fundamentals: Ask foundational questions such as 'What is Python and what are its key features?', 'What is Java and how does the JVM work?', or questions on data types, memory management, and syntax.",
    "- Software engineering concepts: Object-Oriented Programming (OOP), Data Structures (arrays, linked lists, trees, hash maps), Algorithms (sorting, searching, time complexity), and REST APIs.",
    "- Databases: Relational vs Non-Relational (SQL vs NoSQL), ACID properties, indexing.",
    "- System design and problem-solving fundamentals.",
    "",
    "INTERVIEW RULES (STRICT):",
    "1. Ask exactly ONE question at a time. Never ask compound or multi-part questions.",
    "2. Listen carefully to the candidate's spoken response.",
    "3. Provide a concise 1-2 sentence constructive acknowledgement or feedback, then ask a relevant follow-up or move to the next technical question.",
    "4. If the candidate expresses preference for a particular programming language or area (e.g. Python, Java, web development, backend), focus primarily on that domain while covering core concepts.",
    "5. Keep questions clear, conversational, and direct.",
    "",
    "SPOKEN VOICE STYLE (CRITICAL — words are converted to audio by TTS):",
    "- Be warm, conversational, concise, and professional.",
    "- Never use markdown, asterisks, bullet points, numbered lists with digits, or code blocks. Never say 'asterisk' or 'bullet'.",
    "- Keep answers between 40 to 80 words so the candidate speaks the majority of the time.",
    "- If code logic is needed, describe it verbally in plain English."
  ].join("\n")
};

const extractErrorMessage = (err, fallback = 'Failed to upload resume. Please try again.') => {
  if (!err) return fallback;
  if (typeof err === 'string') {
    const trimmed = err.trim();
    return trimmed || fallback;
  }
  if (typeof err === 'object') {
    // 1. axios response structures
    const resData = err.response?.data;
    if (typeof resData === 'string' && resData.trim()) {
      return resData.trim();
    }
    if (resData && typeof resData === 'object') {
      if (typeof resData.error === 'string' && resData.error.trim()) {
        return resData.error.trim();
      }
      if (resData.error && typeof resData.error === 'object') {
        if (typeof resData.error.message === 'string' && resData.error.message.trim()) {
          return resData.error.message.trim();
        }
        if (typeof resData.error.description === 'string' && resData.error.description.trim()) {
          return resData.error.description.trim();
        }
      }
      if (typeof resData.message === 'string' && resData.message.trim()) {
        return resData.message.trim();
      }
      if (typeof resData.description === 'string' && resData.description.trim()) {
        return resData.description.trim();
      }
    }

    // 2. native/JS error structures
    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message.trim();
    }
    if (typeof err.description === 'string' && err.description.trim()) {
      return err.description.trim();
    }
    if (typeof err.error === 'string' && err.error.trim()) {
      return err.error.trim();
    }
    if (err.error && typeof err.error === 'object') {
      if (typeof err.error.message === 'string' && err.error.message.trim()) {
        return err.error.message.trim();
      }
    }
  }
  return fallback;
};


const WORKLET_CODE = `
class PCMForwarder extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && ch.length) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("pcm-forwarder", PCMForwarder);
`;

export default function VoiceAgent({
  token,
  user,
  onLogout,
  onBackToLanding,
  onGoToPanel,
  onGoToNotetaker,
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
  const [wsState, setWsState] = useState('idle'); // 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking'
  const [connected, setConnected] = useState(false);

  // Dragging Header Controls
  const handleMinimize = () => ipcRenderer?.send('window-minimize');
  const handleMaximize = () => ipcRenderer?.send('window-maximize');
  const [muted, setMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [latency, setLatency] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [level, setLevel] = useState(0);
  const [activeSessionSeconds, setActiveSessionSeconds] = useState(0);
  const [totalCreditsDeducted, setTotalCreditsDeducted] = useState(0);
  const activeSecondsRef = useRef(0);
  const voiceTimerRef = useRef(null);
  const lastDeductedIntervalRef = useRef(0);
  const hourlyBillingRef = useRef(null);
  const hourlyBillingSessionIdRef = useRef(null);
  const startHourlyBilling = () => {
    if (hourlyBillingRef.current) return;

    const billing = createHourlyUsageBilling({
      action: 'voice_agent',
      endpoint: 'voice-agent',
      getToken: () =>
        token ||
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token') ||
        '',
      onBilled: (data) => {
        if (typeof data?.totalCreditsBilled === 'number') {
          setTotalCreditsDeducted(data.totalCreditsBilled);
        } else if (typeof data?.creditsDeducted === 'number' && data.creditsDeducted > 0) {
          setTotalCreditsDeducted((prev) => prev + data.creditsDeducted);
        }
      },
      onInsufficientCredits: (data) => {
        cleanup();
        setCreditPromptModal({
          isOpen: true,
          type: 'voice',
          title: 'Credits Exhausted',
          message:
            data?.error ||
            'Your credits have been exhausted and the Voice Agent session has been stopped. Please top up or upgrade your plan to continue.',
          fileDetails: { name: 'Voice Agent Mock Interview', type: 'Mock Interview' }
        });
      }
    });

    hourlyBillingRef.current = billing;
    billing.start();
  };

  // Credit Usage & Voice Limit Modal State
  const [creditPromptModal, setCreditPromptModal] = useState({
    isOpen: false,
    type: 'voice',
    title: '',
    message: '',
    fileDetails: null,
    pendingAction: null
  });

  // UI Mode & Language State (Matching Reference Design)
  const [activeMode, setActiveMode] = useState('conversation');
  const activeModeRef = useRef('conversation');
  const [practiceTech, setPracticeTech] = useState('');
  const practiceTechRef = useRef('');
  const [practiceLevel, setPracticeLevel] = useState('Intermediate');
  const practiceLevelRef = useRef('Intermediate');
  const [practiceTrack, setPracticeTrack] = useState('Job Interview');
  const [practiceSegment, setPracticeSegment] = useState('job_interview'); // 'job_interview' | 'exam_prep'
  const [isDocAccordionOpen, setIsDocAccordionOpen] = useState(false);
  const [sessionFormat, setSessionFormat] = useState('voice_only'); // 'voice_only' | 'live_avatar'
  const [showPracticeAvatar, setShowPracticeAvatar] = useState(false);
  const [uiLanguage, setUiLanguage] = useState('English');
  const [showProfile, setShowProfile] = useState(true);
  const [isJobDescOpen, setIsJobDescOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const moreMenuRef = useRef(null);
  const langDropdownRef = useRef(null);

  // Session History State (Persistent via localStorage)
  const [sessionHistory, setSessionHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('kairos_voice_session_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const saveCurrentSessionToHistory = () => {
    const currentMessages = messagesRef.current || messages;
    const currentDuration = activeSecondsRef.current || activeSessionSeconds;

    // Only record if messages exist or active duration >= 2s
    if (currentMessages.length === 0 && currentDuration < 2) return;

    const newSession = {
      id: 'va_sess_' + Date.now(),
      title: activeMode === 'practice'
        ? `${(practiceTechRef.current || practiceTech || '').trim() || 'Software Engineer'} (${practiceTrack})`
        : 'Topic Conversation',
      mode: activeMode,
      practiceTrack: practiceTrack,
      tech: practiceTechRef.current || practiceTech,
      level: practiceLevelRef.current || practiceLevel,
      language: uiLanguage,
      durationSeconds: currentDuration,
      durationFormatted: `${String(Math.floor(currentDuration / 60)).padStart(2, '0')}:${String(currentDuration % 60).padStart(2, '0')}`,
      date: new Date().toISOString(),
      formattedDate: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      messageCount: currentMessages.length,
      messages: [...currentMessages]
    };

    setSessionHistory((prev) => {
      const exists = prev.some((s) => s.id === newSession.id);
      if (exists) return prev;
      const updated = [newSession, ...prev];
      try {
        localStorage.setItem('kairos_voice_session_history', JSON.stringify(updated.slice(0, 50)));
      } catch (e) {
        console.warn('Failed to save session history to localStorage', e);
      }
      return updated;
    });
  };

  const handleNewConversation = () => {
    saveCurrentSessionToHistory();
    setMessages([]);
    setInterimTranscript('');
    setSearchQuery('');
    setActiveSessionSeconds(0);
    activeSecondsRef.current = 0;
    if (showToast) showToast('Started new conversation');
  };

  // Resume state for interview context
  const [resumeData, setResumeData] = useState(null);
  const resumeDataRef = useRef(null);
  const [jobDescription, setJobDescription] = useState('');
  const jobDescriptionRef = useRef('');
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState(null);
  const [isDraggingResume, setIsDraggingResume] = useState(false);
  const resumeInputRef = useRef(null);

  // Refs for audio and websocket
  const wsRef = useRef(null);
  const micStreamRef = useRef(null);
  const micCtxRef = useRef(null);
  const micNodeRef = useRef(null);
  const micSourceRef = useRef(null);
  const spkCtxRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const playingSourcesRef = useRef([]);
  const pausedAudioChunksRef = useRef([]);
  const wasSpeakingBeforePauseRef = useRef(false);
  const keepAliveTimerRef = useRef(null);
  const pendingSamplesRef = useRef([]);
  const pendingLengthRef = useRef(0);
  const levelIntervalRef = useRef(null);
  const transcriptEndRef = useRef(null);
  // Generation counter to guard against async start/stop/restart race conditions
  const agentGenRef = useRef(0);
  const isStartingRef = useRef(false);
  const lastClickTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  // Keep mutability values current for audio processing
  const connectedVal = useRef(false);
  const mutedVal = useRef(false);
  const isPausedVal = useRef(false);
  const wsStateVal = useRef('idle');

  useEffect(() => {
    connectedVal.current = connected;
  }, [connected]);

  useEffect(() => {
    mutedVal.current = muted;
  }, [muted]);

  useEffect(() => {
    isPausedVal.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    wsStateVal.current = wsState;
  }, [wsState]);

  useEffect(() => {
    resumeDataRef.current = resumeData;
  }, [resumeData]);

  useEffect(() => {
    jobDescriptionRef.current = jobDescription;
  }, [jobDescription]);

  // Automatically scroll transcript to bottom
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Clean up on component switch
  useEffect(() => {
    if (windowType !== 'voice-agent') {
      cleanup();
    }
  }, [windowType]);

  // Clean up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  // Clean up on beforeunload (browser tab close/reload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanup();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // ── Active Voice Session Timer ──
  useEffect(() => {
    if (connected && !isPaused) {
      voiceTimerRef.current = setInterval(() => {
        activeSecondsRef.current += 1;
        setActiveSessionSeconds(activeSecondsRef.current);
      }, 1000);
    } else {
      if (voiceTimerRef.current) {
        clearInterval(voiceTimerRef.current);
        voiceTimerRef.current = null;
      }
    }

    return () => {
      if (voiceTimerRef.current) {
        clearInterval(voiceTimerRef.current);
        voiceTimerRef.current = null;
      }
    };
  }, [connected, isPaused]);

  // Outside click listener for More dropdown and Language dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target)) {
        setShowLangDropdown(false);
      }
    };
    if (showMoreMenu || showLangDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showMoreMenu, showLangDropdown]);

  const handleStartMic = async (currentGen) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
    });
    // Cancellation guard: discard mic stream if generation has changed
    if (agentGenRef.current !== currentGen) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    micStreamRef.current = stream;
    console.log('[VoiceAgent] Microphone settings:', stream.getAudioTracks()[0]?.getSettings?.());

    const AC = window.AudioContext || window.webkitAudioContext;
    try {
      micCtxRef.current = new AC({ sampleRate: 16000 });
    } catch (e) {
      micCtxRef.current = new AC();
    }

    await micCtxRef.current.resume();
    // Cancellation guard: ensure generation did not change while audio context resumed
    if (agentGenRef.current !== currentGen) {
      stream.getTracks().forEach((t) => t.stop());
      try { micCtxRef.current.close().catch(() => { }); } catch (_) { }
      return;
    }
    micSourceRef.current = micCtxRef.current.createMediaStreamSource(micStreamRef.current);

    let workletOk = false;
    if (micCtxRef.current.audioWorklet) {
      try {
        const url = URL.createObjectURL(new Blob([WORKLET_CODE], { type: "application/javascript" }));
        try {
          await micCtxRef.current.audioWorklet.addModule(url);
        } finally {
          URL.revokeObjectURL(url);
        }
        // Cancellation guard: ensure generation did not change while worklet module was loading
        if (agentGenRef.current !== currentGen) {
          stream.getTracks().forEach((t) => t.stop());
          try { micCtxRef.current.close().catch(() => { }); } catch (_) { }
          return;
        }
        micNodeRef.current = new AudioWorkletNode(micCtxRef.current, "pcm-forwarder");
        micNodeRef.current.port.onmessage = (e) => handleMicChunk(e.data);
        micSourceRef.current.connect(micNodeRef.current);
        // Keep the worklet in the active audio graph without playing mic audio back.
        const silentGain = micCtxRef.current.createGain();
        silentGain.gain.value = 0;
        micNodeRef.current.connect(silentGain);
        silentGain.connect(micCtxRef.current.destination);
        console.log('[VoiceAgent] PCM input:', {
          encoding: 'linear16',
          sampleRate: micCtxRef.current.sampleRate,
          channels: 1,
          chunkMilliseconds: 60
        });
        workletOk = true;
      } catch (e) {
        console.warn("AudioWorklet failed, falling back to ScriptProcessor", e);
      }
    }

    if (agentGenRef.current !== currentGen) return;

    if (!workletOk) {
      micNodeRef.current = micCtxRef.current.createScriptProcessor(2048, 1, 1);
      micNodeRef.current.onaudioprocess = (e) => handleMicChunk(e.inputBuffer.getChannelData(0));
      micSourceRef.current.connect(micNodeRef.current);
      micNodeRef.current.connect(micCtxRef.current.destination);
    }
  };

  const handleMicChunk = (float32) => {
    if (isPausedVal.current) {
      if (isMountedRef.current) setLevel(0);
      return;
    }

    // Calculate level meter value
    let sum = 0;
    for (let i = 0; i < float32.length; i++) {
      sum += float32[i] * float32[i];
    }
    const rms = Math.sqrt(sum / float32.length);
    if (isMountedRef.current) {
      setLevel(prev => Math.max(rms, prev * 0.85));
    }

    if (!connectedVal.current || mutedVal.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    pendingSamplesRef.current.push(float32);
    pendingLengthRef.current += float32.length;
    const flushAt = Math.floor(micCtxRef.current.sampleRate * 0.06); // ~60 ms chunks
    if (pendingLengthRef.current < flushAt) return;

    const merged = new Float32Array(pendingLengthRef.current);
    let off = 0;
    for (const c of pendingSamplesRef.current) {
      merged.set(c, off);
      off += c.length;
    }
    pendingSamplesRef.current = [];
    pendingLengthRef.current = 0;

    const i16 = new Int16Array(merged.length);
    for (let i = 0; i < merged.length; i++) {
      const s = Math.max(-1, Math.min(1, merged[i]));
      i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    wsRef.current.send(i16.buffer);
  };

  const playAudioChunk = (arrayBuffer) => {
    if (isPausedVal.current) {
      pausedAudioChunksRef.current.push(arrayBuffer);
      return;
    }
    if (!spkCtxRef.current) return;
    const i16 = new Int16Array(arrayBuffer);
    if (!i16.length) return;
    const f32 = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) {
      f32[i] = i16[i] / 32768;
    }

    const buf = spkCtxRef.current.createBuffer(1, f32.length, CONFIG.outputSampleRate);
    buf.getChannelData(0).set(f32);

    const src = spkCtxRef.current.createBufferSource();
    src.buffer = buf;
    src.connect(spkCtxRef.current.destination);

    const startAt = Math.max(spkCtxRef.current.currentTime + 0.03, nextPlayTimeRef.current);
    src.start(startAt);
    nextPlayTimeRef.current = startAt + buf.duration;

    playingSourcesRef.current.push(src);
    src.onended = () => {
      playingSourcesRef.current = playingSourcesRef.current.filter((s) => s !== src);
      if (!playingSourcesRef.current.length && !pausedAudioChunksRef.current.length && connectedVal.current && wsStateVal.current === 'speaking') {
        setWsState(isPausedVal.current ? 'paused' : 'listening');
      }
    };
  };

  const stopPlayback = () => {
    pausedAudioChunksRef.current = [];
    wasSpeakingBeforePauseRef.current = false;
    playingSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch (e) { }
    });
    playingSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
  };

  const handleResumeFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadResume(file);
  };

  const handleResumeDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingResume(true);
  };

  const handleResumeDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingResume(false);
  };

  const handleResumeDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingResume(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadResume(file);
      e.dataTransfer.clearData();
    }
  };

  const uploadResume = async (file) => {
    // 1. Immediately terminate any active interview session
    cleanup();
    // 2. Discard previous conversation messages/history completely
    setMessages([]);
    // 3. Clear existing resume context to prevent stale or invalid data reuse
    setResumeData(null);
    resumeDataRef.current = null;
    setResumeError(null);

    if (!file) {
      const err = 'No file selected. Please select a valid resume.';
      setResumeError(err);
      if (showToast) showToast(err);
      return;
    }

    // Robust file extension & MIME type validation (supports multi-dot names like sathvika.pdf.pdf)
    const allowedExts = ['.pdf', '.docx', '.doc'];
    const fileName = (file.name || '').trim();
    const lastDotIdx = fileName.lastIndexOf('.');
    const ext = lastDotIdx !== -1 ? fileName.substring(lastDotIdx).toLowerCase() : '';

    const allowedMimes = [
      'application/pdf',
      'application/x-pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream'
    ];
    const mimeType = (file.type || '').toLowerCase();

    const isValidExt = allowedExts.includes(ext);
    const isValidMime = !mimeType ||
      allowedMimes.includes(mimeType) ||
      mimeType.includes('pdf') ||
      mimeType.includes('word') ||
      mimeType.includes('document') ||
      mimeType.includes('octet-stream');

    if (!isValidExt || !isValidMime) {
      const err = 'Invalid file format. Please upload a PDF, DOCX, or DOC document.';
      setResumeError(err);
      if (showToast) showToast(err);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      const err = 'File is too large. Maximum size is 15MB.';
      setResumeError(err);
      if (showToast) showToast(err);
      return;
    }

    if (file.size === 0) {
      const err = 'The selected file is empty. Please upload a valid resume.';
      setResumeError(err);
      if (showToast) showToast(err);
      return;
    }

    setIsUploadingResume(true);
    setResumeError(null);

    const formData = new FormData();
    formData.append('file', file);

    const effectiveToken = token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '';

    try {
      const response = await axios.post(`${API_BASE}/api/voice-agent/upload-resume`, formData, {
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.ok) {
        if (!isMountedRef.current) return;
        // Update state and ref synchronously with new resume data
        setResumeData(response.data);
        resumeDataRef.current = response.data;
        setResumeError(null);
        setMessages([]); // Confirm messages are cleared for fresh session
        console.log('[VoiceAgent] Successfully uploaded & parsed new resume:', {
          fileName: response.data.fileName,
          candidateName: response.data.preview?.name,
          skills: response.data.preview?.skills,
          textLength: response.data.resumeText?.length
        });
        if (showToast) {
          const candidate = response.data.preview?.name ? ` for ${response.data.preview.name}` : '';
          showToast(`Resume loaded${candidate}! Ready for interview.`);
        }
      } else {
        const errText = extractErrorMessage(response.data?.error || response.data, 'Failed to analyze resume.');
        throw new Error(errText);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      // Do not store invalid resume in state or ref
      setResumeData(null);
      resumeDataRef.current = null;
      const errMsg = extractErrorMessage(err, 'The uploaded document does not appear to be a resume. Please upload a valid resume.');
      setResumeError(errMsg);
      if (showToast) showToast(errMsg);
    } finally {
      if (isMountedRef.current) {
        setIsUploadingResume(false);
      }
      if (resumeInputRef.current) resumeInputRef.current.value = '';
    }
  };

  const handleClearResume = () => {
    cleanup();
    setResumeData(null);
    resumeDataRef.current = null;
    setResumeError(null);
    setMessages([]);
    if (resumeInputRef.current) resumeInputRef.current.value = '';
  };

  const buildSettings = (activeResume = resumeDataRef.current || resumeData) => {
    let agentPrompt = CONFIG.prompt;
    let agentGreeting = CONFIG.greeting;
    const activeJobDescription = jobDescriptionRef.current.trim();

    if (activeModeRef.current === 'practice' || activeMode === 'practice') {
      const currentTech = (practiceTechRef.current || practiceTech || '').trim() || 'Software Engineering';
      const currentLevel = practiceLevelRef.current || practiceLevel || 'Intermediate';
      agentGreeting = `Hello! I am your AI interviewer for today's ${currentTech} mock interview at the ${currentLevel} level. We will do one question at a time, with feedback on your answers. Let's begin whenever you are ready!`;
      agentPrompt = [
        `You are an expert, professional technical interviewer conducting an interactive interview practice session.`,
        "",
        `PRIMARY PRACTICE SCOPE:`,
        `- Technology / Focus: ${currentTech}`,
        `- Candidate Seniority Level: ${currentLevel}`,
        "",
        "PRACTICE WORKFLOW AND CONVERSATION RULES:",
        `1. Ask exactly ONE question at a time, focused specifically on ${currentTech} calibrated for the ${currentLevel} seniority level.`,
        "2. Listen to the candidate's spoken answer. Provide brief constructive 1-2 sentence feedback (what was strong or what key nuance was omitted), then smoothly ask the next question.",
        "3. Never ask compound or multi-part questions at once.",
        "4. Keep your spoken responses concise, conversational, and direct (under 75 words).",
        "5. Never use markdown, asterisks, bullet points, or code formatting because output is converted directly to speech."
      ].join("\n");

      if (activeJobDescription) {
        agentPrompt += `\n\nTARGET JOB DESCRIPTION CONTEXT:\n${activeJobDescription.slice(0, 2000)}`;
      }
      if (activeResume) {
        agentPrompt += `\n\nCANDIDATE CONTEXT:\n- Candidate Name: ${activeResume.preview?.name || 'Candidate'}\n- Background: ${(activeResume.resumeText || '').slice(0, 1000)}`;
      }
    } else if (activeResume) {
      const activeResumeText = (activeResume.resumeText || '').trim();
      const isGeneric = (!activeResume.preview?.name || activeResume.preview.name.toLowerCase() === 'candidate');
      const candidateName = isGeneric ? 'Candidate' : activeResume.preview.name;
      const role = activeResume.preview?.role || 'Software Engineer';
      const skillsList = activeResume.preview?.skills?.length > 0
        ? activeResume.preview.skills.join(', ')
        : 'software engineering and problem solving';
      const summaryText = activeResume.preview?.summary || '';
      const nameSalutation = isGeneric ? 'Candidate' : activeResume.preview.name.split(' ')[0];
      const fileName = activeResume.fileName || 'Uploaded Resume';

      agentGreeting = activeResume.preview?.greeting || `Hello ${nameSalutation}! I have reviewed your resume and I am excited to interview you today. When you are ready, please introduce yourself and tell me about your recent work.`;

      if (activeJobDescription) {
        agentGreeting = `Hello ${nameSalutation}! I have reviewed your resume and the job description. I will prepare you for this role by focusing on the most important requirements in the job description. When you are ready, please introduce yourself and tell me how your experience matches this role.`;
        agentPrompt = [
          `You are an expert, professional AI technical interviewer conducting a realistic live spoken technical interview with ${candidateName}.`,
          "",
          "PRIMARY INTERVIEW TARGET: JOB DESCRIPTION ONLY",
          "Treat the job description as the primary source of truth for this interview.",
          "Ask questions directly from the job description's responsibilities, required skills, qualifications, seniority, tools, and business expectations.",
          "Prioritize the most important and repeated requirements in the job description before secondary topics.",
          "Use the resume only as supporting evidence to personalize questions, check the candidate's fit, and ask about experience that relates directly to a job requirement.",
          "Never let the resume introduce an unrelated interview topic or override the job description.",
          "Do not invent experience, skills, responsibilities, or company details that are not present in the job description, resume, or candidate's spoken answers.",
          "Ask exactly ONE question at a time. Never ask compound or multi-part questions.",
          "Keep the interview focused on preparing the candidate to perform this specific job.",
          "",
          "CANDIDATE INFORMATION:",
          `- Candidate Name: ${candidateName}`,
          `- Resume File: ${fileName}`,
          `- Target Role: ${role}`,
          `- Resume Skills: ${skillsList}`,
          `- Resume Summary: ${summaryText}`,
          "",
          "JOB DESCRIPTION (PRIMARY SOURCE OF TRUTH FOR QUESTION SELECTION):",
          "--- JOB DESCRIPTION START ---",
          activeJobDescription,
          "--- JOB DESCRIPTION END ---",
          "",
          "RESUME CONTEXT (SUPPORTING EVIDENCE ONLY):",
          "--- RESUME START ---",
          activeResumeText,
          "--- RESUME END ---",
          "",
          "SPOKEN VOICE STYLE (CRITICAL — words are converted to audio by TTS):",
          "- Be warm, conversational, concise, and professional.",
          "- Never use markdown, asterisks, bullet points, numbered lists with digits, or code blocks. Never say 'asterisk' or 'bullet'.",
          "- Keep answers between 40 to 80 words so the candidate speaks the majority of the time.",
          "- If code logic is needed, describe it verbally in plain English."
        ].join("\n");
      } else {
        agentPrompt = [
          `You are an expert, professional AI technical interviewer conducting a realistic live spoken technical interview with ${candidateName}.`,
          "",
          "CRITICAL RESUME-ONLY CONTEXT RULES (STRICT):",
          "1. THIS IS A BRAND NEW, INDEPENDENT INTERVIEW SESSION.",
          "2. Formulate all interview questions EXCLUSIVELY and ONLY from the candidate profile and full resume text provided below.",
          "3. Review the full resume content below before asking questions.",
          "4. Dynamically generate questions tailored directly to THIS candidate's actual projects, listed technical skills, work experience, education, and certifications.",
          "5. Ask exactly ONE question at a time. Never dump multiple questions together or ask compound multi-part questions.",
          "6. Listen carefully to the candidate's spoken response. Give a concise 1-2 sentence constructive acknowledgement or feedback, then ask a relevant follow-up question or transition to another specific topic/project mentioned in THIS resume.",
          "",
          "CANDIDATE INFORMATION (FOR THIS SESSION ONLY):",
          `- Candidate Name: ${candidateName}`,
          `- Document File: ${fileName}`,
          `- Target Role: ${role}`,
          `- Key Skills: ${skillsList}`,
          `- Background Summary: ${summaryText}`,
          "",
          "FULL EXTRACTED RESUME TEXT (THIS IS YOUR SINGLE SOURCE OF TRUTH):",
          "\"\"\"",
          activeResumeText,
          "\"\"\"",
          "",
          "SPOKEN VOICE STYLE (CRITICAL — words are converted to audio by TTS):",
          "- Be warm, conversational, concise, and professional.",
          "- Never use markdown, asterisks, bullet points, numbered lists with digits, or code blocks. Never say 'asterisk' or 'bullet'.",
          "- Keep answers between 40 to 80 words so the candidate speaks the majority of the time.",
          "- If code logic is needed, describe it verbally in plain English."
        ].join("\n");
      }
    } else if (activeJobDescription) {
      agentGreeting = "Hello! I’m ready to interview you for this role. I’ll focus on the job requirements, responsibilities, and skills in the job description, and adapt questions to your answers.";
      agentPrompt = [
        "You are an expert, professional AI interviewer conducting a live interview for the role described in the job description below.",
        "",
        "JOB DESCRIPTION IS THE PRIMARY SOURCE OF TRUTH.",
        "1. Build the entire interview around the role's duties, required skills, seniority, and business expectations in the job description.",
        "2. Ask one clear interview question at a time and keep the questions directly relevant to the job role.",
        "3. Do not fall back to generic technical interview questions unless the job description explicitly demands them.",
        "4. Use the candidate's spoken answers to ask a follow-up question that is relevant to that role requirement.",
        "5. Keep questions practical, role-based, and realistic for a hiring conversation.",
        "6. Keep answers concise, warm, and professional. Never use markdown, bullets, numbered lists, code blocks, or long explanations.",
        "",
        "--- JOB DESCRIPTION START ---",
        activeJobDescription,
        "--- JOB DESCRIPTION END ---",
        "",
        "INTERVIEW STYLE:",
        "- Ask role-specific questions based on sales, communication, negotiation, client acquisition, relationship management, targets, and operations as described in the JD.",
        "- If the role is a business development role, focus on lead generation, prospecting, client outreach, objections, sales process, negotiation, and relationship building.",
        "- If the role is technical, focus on technical depth and problem-solving only when required by the JD.",
        "- Keep each question short, direct, and conversational."
      ].join("\n");
    }

    return {
      type: "Settings",
      audio: {
        input: { encoding: "linear16", sample_rate: micCtxRef.current?.sampleRate || 16000 },
        output: { encoding: "linear16", sample_rate: CONFIG.outputSampleRate, container: "none" }
      },
      agent: {
        language: "en",
        listen: { provider: { ...CONFIG.listen } },
        think: { provider: { ...CONFIG.think }, prompt: agentPrompt },
        speak: { provider: { ...CONFIG.speak } },
        greeting: agentGreeting
      }
    };
  };

  const connect = (currentGen, activeResume) => {
    // Cancellation guard: ensure generation is still valid before connecting
    if (agentGenRef.current !== currentGen) return;
    setWsState('connecting');
    setErrorMsg(null);

    const resolvedResume = activeResume || resumeDataRef.current || resumeData;
    const settings = buildSettings(resolvedResume);

    // Logging to verify whether resume context or general technical interview is being sent
    console.log('[VoiceAgent] Connecting with context:', {
      hasResume: !!resolvedResume,
      hasJobDescription: !!jobDescriptionRef.current.trim(),
      jobDescriptionLength: jobDescriptionRef.current.trim().length,
      fileName: resolvedResume?.fileName || 'None (General Interview)',
      candidateName: resolvedResume?.preview?.name || 'General Candidate',
      textLength: resolvedResume?.resumeText?.length || 0,
      greeting: settings.agent.greeting
    });

    if (ipcRenderer) {
      // ── Electron Mode: Route via native IPC bridge ──
      console.log('[VoiceAgent] Connecting via native Electron IPC...');

      ipcRenderer.removeAllListeners('voice-agent-open');
      ipcRenderer.removeAllListeners('voice-agent-msg');
      ipcRenderer.removeAllListeners('voice-agent-err');
      ipcRenderer.removeAllListeners('voice-agent-closed');

      const mockWs = {
        readyState: 1, // WebSocket.OPEN
        send: (data) => {
          // Cancellation guard: only send if this generation is active
          if (agentGenRef.current !== currentGen) return;
          ipcRenderer.send('voice-agent-send', data);
        },
        close: () => {
          ipcRenderer.send('voice-agent-close');
        }
      };
      wsRef.current = mockWs;

      ipcRenderer.on('voice-agent-open', () => {
        // Cancellation guard: ignore stale IPC open events
        if (agentGenRef.current !== currentGen) return;

        isStartingRef.current = false;
        connectedVal.current = true;
        setConnected(true);
        setWsState('connected');
        startHourlyBilling();

        console.log('[VoiceAgent IPC] Open received');
        mockWs.send(JSON.stringify(settings));

        if (keepAliveTimerRef.current) {
          clearInterval(keepAliveTimerRef.current);
        }

        keepAliveTimerRef.current = setInterval(() => {
          if (agentGenRef.current !== currentGen) {
            if (keepAliveTimerRef.current) {
              clearInterval(keepAliveTimerRef.current);
              keepAliveTimerRef.current = null;
            }
            return;
          }

          mockWs.send(JSON.stringify({ type: "KeepAlive" }));
        }, 8000);
      });

      ipcRenderer.on('voice-agent-msg', (_, data, isBinary) => {
        // Cancellation guard: discard messages from outdated generations
        if (agentGenRef.current !== currentGen) return;
        let payload = data;
        if (isBinary) {
          if (data) {
            const buf = data.buffer || new Uint8Array(data).buffer;
            payload = buf.slice(data.byteOffset || 0, (data.byteOffset || 0) + (data.byteLength || data.length || 0));
          }
        } else {
          if (data instanceof Uint8Array || Buffer.isBuffer(data)) {
            payload = new TextDecoder("utf-8").decode(data);
          } else if (typeof data !== "string") {
            payload = String(data);
          }
        }
        handleIncomingMessage({ data: payload });
      });

      ipcRenderer.on('voice-agent-err', (_, err) => {
        if (agentGenRef.current !== currentGen) return;
        setErrorMsg(err || "Native agent connection error.");
      });

      ipcRenderer.on('voice-agent-closed', (_, code, reason) => {
        // Cancellation guard: ignore close events from superseded sessions
        if (agentGenRef.current !== currentGen) return;
        const wasConnected = connectedVal.current;
        cleanup();
        if (wasConnected) {
          setWsState('idle');
        } else if (code !== 1000) {
          setErrorMsg(prev => prev || ("Connection failed (code " + code + "). Check API key validity."));
          setWsState('idle');
        }
      });

      ipcRenderer.send('voice-agent-connect');

    } else {
      // ── Browser Mode: Use standard WebSocket proxy ──
      const authToken = token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '';
      const ws = new WebSocket(`${WS_BASE}/api/voice-agent/converse`, websocketProtocols(authToken));
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        if (agentGenRef.current !== currentGen) {
          try {
            ws.close();
          } catch (_) { }
          return;
        }

        isStartingRef.current = false;
        connectedVal.current = true;
        setConnected(true);
        setWsState('connected');

        startHourlyBilling();
        ws.send(JSON.stringify(settings));

        if (keepAliveTimerRef.current) {
          clearInterval(keepAliveTimerRef.current);
        }

        keepAliveTimerRef.current = setInterval(() => {
          if (agentGenRef.current !== currentGen) {
            if (keepAliveTimerRef.current) {
              clearInterval(keepAliveTimerRef.current);
              keepAliveTimerRef.current = null;
            }
            return;
          }

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "KeepAlive" }));
          }
        }, 8000);
      };
      ws.onmessage = (evt) => {
        // Cancellation guard: discard messages from old generations
        if (agentGenRef.current !== currentGen) return;
        handleIncomingMessage(evt);
      };

      ws.onerror = () => {
        if (agentGenRef.current !== currentGen) return;
        setErrorMsg(prev => prev || "WebSocket error — check your API key, network, or browser console.");
      };

      ws.onclose = (evt) => {
        // Cancellation guard: ignore close events from superseded sessions
        if (agentGenRef.current !== currentGen) return;
        const wasConnected = connectedVal.current;
        cleanup();
        if (wasConnected) {
          setWsState('idle');
        } else if (evt && evt.code !== 1000) {
          setErrorMsg(prev => prev || ("Connection failed (code " + evt.code + "). Check API key validity."));
          setWsState('idle');
        }
      };
    }
  };

  const handleIncomingMessage = (evt) => {
    if (typeof evt.data !== "string") {
      playAudioChunk(evt.data);
      return;
    }

    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch (e) {
      return;
    }

    switch (msg.type) {
      case "SettingsApplied":
        setConnected(true);
        setWsState(isPausedVal.current ? 'paused' : 'listening');
        break;
      case "ConversationText":
        if (msg.content) {
          setMessages(prev => {
            const role = msg.role === "user" ? "user" : "assistant";
            const last = prev[prev.length - 1];
            if (last && last.role === role) {
              return [...prev.slice(0, -1), { role, text: last.text + " " + msg.content }];
            } else {
              return [...prev, { role, text: msg.content }];
            }
          });
        }
        break;
      case "UserStartedSpeaking":
        if (isPausedVal.current) return;
        stopPlayback(); // Barge-in: cut off speaker playback immediately
        setWsState('listening');
        break;
      case "AgentThinking":
        if (isPausedVal.current) return;
        setWsState('thinking');
        break;
      case "AgentStartedSpeaking":
        if (typeof msg.total_latency === "number") {
          setLatency(Math.round(msg.total_latency * 1000));
        }
        if (isPausedVal.current) {
          wasSpeakingBeforePauseRef.current = true;
          return;
        }
        setWsState('speaking');
        break;
      case "Warning":
        console.warn("Deepgram warning:", msg);
        break;
      case "Error":
        setErrorMsg(msg.description || msg.message || "Agent error");
        console.error("Deepgram error:", msg);
        break;
      default:
        break;
    }
  };

  const doStartInterviewDirect = async () => {
    const currentResume = resumeDataRef.current || resumeData;

    // Prevent starting interview while uploading or if upload/validation failed
    if (!connected && (isUploadingResume || !!resumeError)) {
      return;
    }

    if (connected || isStartingRef.current || (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN))) {
      cleanup();
      return;
    }

    // Clean up any residual connection and wipe previous conversation context completely
    cleanup();
    setMessages([]);
    setErrorMsg(null);
    setTotalCreditsDeducted(0);
    activeSecondsRef.current = 0;
    setActiveSessionSeconds(0);
    lastDeductedIntervalRef.current = 0;
    hourlyBillingSessionIdRef.current =
      globalThis.crypto?.randomUUID?.() ||
      `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    isStartingRef.current = true;

    // Invalidate any previous connection and assign a unique generation ID
    const currentGen = ++agentGenRef.current;

    try {
      setWsState('connecting');
      const AC = window.AudioContext || window.webkitAudioContext;
      spkCtxRef.current = new AC();
      await spkCtxRef.current.resume();
      // Cancellation guard: ensure generation is still valid after speaker context resumes
      if (agentGenRef.current !== currentGen) {
        cleanup();
        return;
      }
      await handleStartMic(currentGen);
      // Cancellation guard: ensure generation is still valid after mic acquisition
      if (agentGenRef.current !== currentGen) {
        cleanup();
        return;
      }
      connect(currentGen, currentResume);
    } catch (err) {
      if (agentGenRef.current !== currentGen || !isMountedRef.current) return;
      console.error(err);
      cleanup();
      if (!isMountedRef.current) return;
      if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
        setErrorMsg("Microphone access was blocked. Allow microphone permission.");
      } else if (err && err.name === "NotFoundError") {
        setErrorMsg("No microphone found. Please connect one.");
      } else {
        setErrorMsg(err.message || "Failed to start audio. Please try again.");
      }
    }
  };

  const handleStartInterview = async () => {
    const now = Date.now();
    // Guard against rapid duplicate clicks within 250ms
    if (now - lastClickTimeRef.current < 250) return;
    lastClickTimeRef.current = now;

    if (connected) {
      cleanup();
      return;
    }

    // Check initial credits for Voice Agent
    const requiredCost = getVoiceCreditCost();
    const curCredits = getUserCredits();
    if (curCredits < requiredCost) {
      setCreditPromptModal({
        isOpen: true,
        type: 'voice',
        title: 'Insufficient Credits',
        message: `You need at least ${requiredCost} credits to start a Voice Agent mock interview. Your current balance is ${curCredits}.`,
        fileDetails: { name: 'Voice Agent Mock Interview', type: 'Mock Interview' }
      });
      return;
    }

    // Check Voice Agent plan usage limit
    const voiceStatus = getVoiceStatus();
    if (!voiceStatus.hasIncluded) {
      setCreditPromptModal({
        isOpen: true,
        type: 'voice',
        title: 'Included Usage Exhausted',
        message: "You've used all the included minutes in your current plan.",
        fileDetails: null,
        pendingAction: () => {
          doStartInterviewDirect();
        }
      });
      return;
    }

    doStartInterviewDirect();
  };

  const handleConfirmCreditPrompt = async () => {
    const res = extendVoiceWithCredits();
    if (res.success) {
      if (showToast) showToast(res.message);
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

  const handlePauseToggle = async () => {
    if (!connectedVal.current) return;
    const next = !isPausedVal.current;
    isPausedVal.current = next;
    setIsPaused(next);

    if (next) {
      hourlyBillingRef.current?.pause();
    } else {
      hourlyBillingRef.current?.resume();
    }

    if (next) {
      wasSpeakingBeforePauseRef.current = (
        wsStateVal.current === 'speaking' ||
        playingSourcesRef.current.length > 0 ||
        pausedAudioChunksRef.current.length > 0
      );
      if (spkCtxRef.current && spkCtxRef.current.state === 'running') {
        try {
          await spkCtxRef.current.suspend();
        } catch (e) {
          console.error("Failed to suspend speaker AudioContext:", e);
        }
      }
      setLevel(0);
      setWsState('paused');
    } else {
      if (spkCtxRef.current && spkCtxRef.current.state === 'suspended') {
        try {
          await spkCtxRef.current.resume();
        } catch (e) {
          console.error("Failed to resume speaker AudioContext:", e);
        }
      }

      if (pausedAudioChunksRef.current.length > 0) {
        const queued = pausedAudioChunksRef.current;
        pausedAudioChunksRef.current = [];
        for (const chunk of queued) {
          playAudioChunk(chunk);
        }
      }

      const isStillSpeaking = wasSpeakingBeforePauseRef.current || playingSourcesRef.current.length > 0;
      setWsState(isStillSpeaking ? 'speaking' : 'listening');
      wasSpeakingBeforePauseRef.current = false;
    }
  };

  const handleMuteToggle = () => {
    setMuted(prev => !prev);
  };

  const cleanup = () => {
    const billing = hourlyBillingRef.current;
    hourlyBillingRef.current = null;

    if (billing) {
      void billing.stop();
    }

    // Invalidate active generation so all in-flight promises and callbacks abort immediately
    agentGenRef.current++;
    isStartingRef.current = false;
    if (connectedVal.current || (activeSecondsRef.current && activeSecondsRef.current > 0)) {
      saveCurrentSessionToHistory();
    }
    connectedVal.current = false;
    if (isMountedRef.current) {
      setConnected(false);
      setIsPaused(false);
      setWsState('idle');
    }
    isPausedVal.current = false;

    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }

    stopPlayback();

    if (micNodeRef.current) {
      try { micNodeRef.current.disconnect(); } catch (e) { }
      micNodeRef.current = null;
    }
    if (micSourceRef.current) {
      try { micSourceRef.current.disconnect(); } catch (e) { }
      micSourceRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micCtxRef.current) {
      try { micCtxRef.current.close(); } catch (e) { }
      micCtxRef.current = null;
    }
    if (spkCtxRef.current) {
      try { spkCtxRef.current.close(); } catch (e) { }
      spkCtxRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(1000); } catch (e) { }
      wsRef.current = null;
    }
    if (ipcRenderer) {
      ipcRenderer.removeAllListeners('voice-agent-open');
      ipcRenderer.removeAllListeners('voice-agent-msg');
      ipcRenderer.removeAllListeners('voice-agent-err');
      ipcRenderer.removeAllListeners('voice-agent-closed');
      ipcRenderer.send('voice-agent-close');
    }

    pendingSamplesRef.current = [];
    pendingLengthRef.current = 0;
    if (isMountedRef.current) {
      setMuted(false);
      setLevel(0);
      setLatency(null);
    }
  };

  // Navigation & Close handlers that stop voice agent before navigating
  const handleClose = () => {
    cleanup();
    ipcRenderer?.send('window-close');
  };

  const handleBackToLanding = () => {
    cleanup();
    if (onBackToLanding) onBackToLanding();
  };

  const handleGoToDashboard = () => {
    cleanup();
    if (onGoToDashboard) onGoToDashboard();
  };

  const handleGoToPanel = () => {
    cleanup();
    if (onGoToPanel) onGoToPanel();
  };

  const handleGoToNotetaker = () => {
    cleanup();
    if (onGoToNotetaker) onGoToNotetaker();
  };

  const handleGoToUpload = () => {
    cleanup();
    if (onGoToUpload) onGoToUpload();
  };

  const handleLogoutClick = () => {
    cleanup();
    if (onLogout) onLogout();
  };

  const getStatusText = () => {
    switch (wsState) {
      case 'connecting':
        return { title: "Connecting…", sub: "Setting up microphone and agent" };
      case 'paused':
        return { title: "Interview Paused", sub: "Microphone and AI speech are paused. Click Resume to continue." };
      case 'listening':
        return { title: "Listening", sub: muted ? "Microphone is muted" : "Go ahead — ask or answer in your own words" };
      case 'thinking':
        return { title: "Thinking…", sub: "Preparing your answer" };
      case 'speaking':
        return { title: "Speaking", sub: "You can interrupt at any time" };
      case 'idle':
      default:
        if (!resumeData) {
          return {
            title: "Ready for Interview",
            sub: "Click Start Agent to begin a general technical interview, or upload your resume for a personalized interview."
          };
        }
        return {
          title: "Ready for Interview",
          sub: `Resume loaded${resumeData.preview?.name ? ` for ${resumeData.preview.name}` : ''}! Click Start Agent to begin your resume-based interview.`
        };
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (!searchQuery.trim()) return true;
    return msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  const handleExportTranscript = () => {
    if (messages.length === 0) {
      if (showToast) showToast('No conversation logs to export yet.');
      return;
    }
    const formattedText = messages.map(m => `[${m.role === 'user' ? 'Candidate' : 'Interview Expert'}] ${m.text}`).join('\n\n');
    const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `voice_agent_transcript_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (showToast) showToast('Transcript exported successfully!');
  };

  const handleEmailTranscript = () => {
    if (messages.length === 0) {
      if (showToast) showToast('No conversation logs to email yet.');
      return;
    }
    const formattedText = messages.map(m => `[${m.role === 'user' ? 'Candidate' : 'Interview Expert'}] ${m.text}`).join('\n\n');
    const subject = encodeURIComponent('MyInterview Copilot - Voice Agent Transcript');
    const body = encodeURIComponent(`Here is the conversation log from the interview session:\n\n${formattedText}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const status = getStatusText();
  const speaking = wsState === 'speaking';
  const listening = wsState === 'listening';

  return (
    <div className={`voice-agent-root ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* Top Forest Green Navbar - Exact Match to User Reference Screenshot */}
      <header className="voice-top-navbar">
        <div className="voice-nav-left">
          <button
            className="voice-hamburger-btn"
            onClick={() => setShowNavDrawer(true)}
            type="button"
            title="Open Menu"
            aria-label="Open Navigation Menu"
          >
            <i className="fa-solid fa-bars"></i>
          </button>
          <BrandLogo onClick={handleBackToLanding} size="md" />
        </div>

        <div className="voice-nav-right">
          <button
            className="voice-win-btn voice-theme-toggle-btn"
            onClick={toggleDarkMode}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            type="button"
          >
            <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <button className="voice-win-btn" onClick={handleMinimize} title="Minimize" type="button">—</button>
          <button className="voice-win-btn" onClick={handleMaximize} title="Maximize" type="button">▢</button>
          <button className="voice-win-btn voice-win-close" onClick={handleClose} title="Close" type="button">×</button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="voice-agent-workspace">
        {/* Error Banner */}
        {(errorMsg || resumeError) && (
          <div className="voice-agent-error-banner">
            <i className="fa-solid fa-triangle-exclamation"></i> {typeof (errorMsg || resumeError) === 'string' ? (errorMsg || resumeError) : extractErrorMessage(errorMsg || resumeError, 'An unexpected error occurred. Please try again.')}
            <button className="close-err-btn" onClick={() => { setErrorMsg(null); setResumeError(null); }}>×</button>
          </div>
        )}

        <div className="voice-agent-grid">
          {/* Left Panel: Voice Agent Setup & Configuration (Exact Match to User Reference) */}
          <aside className="voice-setup-panel" data-state={wsState}>
            {/* Corner Decorative Organic Mint Waves */}
            <div className="voice-setup-wave-tr" aria-hidden="true">
              <svg width="150" height="95" viewBox="0 0 150 95" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0C45 25 90 10 150 65V0H0Z" fill="url(#waveTrGrad)" opacity="0.45" />
                <path d="M30 0C70 40 115 25 150 90V0H30Z" fill="url(#waveTrGrad2)" opacity="0.3" />
                <defs>
                  <linearGradient id="waveTrGrad" x1="0" y1="0" x2="150" y2="65" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#a7f3d0" />
                    <stop offset="1" stopColor="#d1fae5" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="waveTrGrad2" x1="30" y1="0" x2="150" y2="90" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6ee7b7" />
                    <stop offset="1" stopColor="#a7f3d0" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div className="voice-setup-wave-bl" aria-hidden="true">
              <svg width="120" height="85" viewBox="0 0 120 85" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 25C40 30 75 60 120 85H0V25Z" fill="url(#waveBlGrad)" opacity="0.35" />
                <defs>
                  <linearGradient id="waveBlGrad" x1="0" y1="25" x2="120" y2="85" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#a7f3d0" />
                    <stop offset="1" stopColor="#d1fae5" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Hidden File Input for Resume / Document */}
            <input
              type="file"
              ref={resumeInputRef}
              onChange={handleResumeFileChange}
              accept=".pdf,.docx,.doc,.pptx,.txt"
              style={{ display: 'none' }}
            />

            {/* 1. Header: Green Mic Icon in Circle + Title & Subtitle */}
            <div className="voice-setup-header">
              <div className="voice-setup-mic-icon-circle">
                <i className="fa-solid fa-microphone"></i>
              </div>
              <div className="voice-setup-title-group">
                <h2 className="voice-setup-heading">Voice Agent</h2>
                <p className="voice-setup-subheading">What would you like to do?</p>
              </div>
            </div>

            {/* 2. Mode Selection Cards: Conversation vs Practice */}
            <div className="voice-mode-cards-grid">
              <button
                type="button"
                className={`voice-mode-card ${activeMode === 'conversation' ? 'selected' : ''}`}
                onClick={() => {
                  setActiveMode('conversation');
                  activeModeRef.current = 'conversation';
                }}
              >
                <div className="voice-mode-card-header">
                  <div className="voice-mode-icon-circle">
                    <i className="fa-solid fa-comment-dots"></i>
                  </div>
                  {activeMode === 'conversation' && (
                    <span className="voice-mode-check-badge">
                      <i className="fa-solid fa-circle-check"></i>
                    </span>
                  )}
                </div>
                <div className="voice-mode-card-body">
                  <h4 className="voice-mode-card-title">Conversation</h4>
                  <p className="voice-mode-card-desc">Talk about a topic or document</p>
                </div>
              </button>

              <button
                type="button"
                className={`voice-mode-card ${activeMode === 'practice' ? 'selected' : ''}`}
                onClick={() => {
                  setActiveMode('practice');
                  activeModeRef.current = 'practice';
                }}
              >
                <div className="voice-mode-card-header">
                  <div className="voice-mode-icon-circle practice-icon">
                    <i className="fa-solid fa-bullseye"></i>
                  </div>
                  {activeMode === 'practice' && (
                    <span className="voice-mode-check-badge">
                      <i className="fa-solid fa-circle-check"></i>
                    </span>
                  )}
                </div>
                <div className="voice-mode-card-body">
                  <h4 className="voice-mode-card-title">Practice</h4>
                  <p className="voice-mode-card-desc">Rehearse a job interview</p>
                </div>
              </button>
            </div>

            {/* 3. Track Selection */}
            {activeMode === 'practice' ? (
              /* Practice Mode: Segmented Toggle (Job interview vs Exam prep Planned) */
              <div className="voice-form-group">
                <label className="voice-form-label">Practice track</label>
                <div className="voice-track-segmented-bar">
                  <button
                    type="button"
                    className={`voice-segment-btn ${practiceSegment === 'job_interview' ? 'active' : ''}`}
                    onClick={() => {
                      setPracticeSegment('job_interview');
                      setPracticeTrack('Job Interview');
                    }}
                  >
                    Job interview
                  </button>
                  <button
                    type="button"
                    className={`voice-segment-btn ${practiceSegment === 'exam_prep' ? 'active' : ''}`}
                    onClick={() => {
                      setPracticeSegment('exam_prep');
                      setPracticeTrack('Exam prep');
                    }}
                  >
                    <span>Exam prep</span>
                    <span className="voice-segment-planned-badge">Planned</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Conversation Mode: Standard Practice Track Dropdown */
              <div className="voice-form-group">
                <label className="voice-form-label">Practice track</label>
                <div className="voice-form-select-wrap">
                  <i className="fa-solid fa-briefcase voice-form-left-icon"></i>
                  <select
                    className="voice-form-select"
                    value={practiceTrack}
                    onChange={(e) => setPracticeTrack(e.target.value)}
                  >
                    <option value="Job Interview">Job Interview</option>
                    <option value="Technical Deep-Dive">Technical Deep-Dive</option>
                    <option value="Behavioral & STAR Method">Behavioral &amp; STAR Method</option>
                    <option value="System Design">System Design</option>
                    <option value="Executive Leadership">Executive Leadership</option>
                    <option value="Casual Q&A">Casual Q&amp;A</option>
                  </select>
                  <i className="fa-solid fa-chevron-down voice-form-chevron"></i>
                </div>
              </div>
            )}

            {/* 4. What are you preparing for? */}
            <div className="voice-form-group">
              <label className="voice-form-label">What are you preparing for?</label>
              <input
                type="text"
                className="voice-form-input"
                placeholder={activeMode === 'practice' ? "Type a job, subject, or skill" : "Type a job, subject, or skill..."}
                value={practiceTech}
                onChange={(e) => {
                  setPracticeTech(e.target.value);
                  practiceTechRef.current = e.target.value;
                }}
              />
            </div>

            {/* 5. Try an example Chips */}
            <div className="voice-chips-group">
              <label className="voice-chips-label">Try an example</label>
              <div className="voice-example-chips-wrap">
                {[
                  'Accountant',
                  'Registered nurse',
                  'Customer support agent',
                  'Software engineer',
                  'Bank teller',
                  'Teacher',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={`voice-example-chip ${practiceTech === chip ? 'active' : ''}`}
                    onClick={() => {
                      setPracticeTech(chip);
                      practiceTechRef.current = chip;
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Language & Level Controls */}
            {activeMode === 'practice' ? (
              /* Practice Mode: 2 Columns (Spoken language + Level) */
              <div className="voice-form-row-2col">
                <div className="voice-form-group">
                  <label className="voice-form-label">Spoken language</label>
                  <div className="voice-form-select-wrap">
                    <select
                      className="voice-form-select voice-form-select-clean"
                      value={uiLanguage}
                      onChange={(e) => setUiLanguage(e.target.value)}
                    >
                      <option value="English">English</option>
                      <option value="Español">Español</option>
                      <option value="Français">Français</option>
                      <option value="Deutsch">Deutsch</option>
                      <option value="हिन्दी">हिन्दी</option>
                      <option value="日本語">日本語</option>
                    </select>
                    <i className="fa-solid fa-chevron-down voice-form-chevron"></i>
                  </div>
                </div>

                <div className="voice-form-group">
                  <label className="voice-form-label">Level</label>
                  <div className="voice-form-select-wrap">
                    <select
                      className="voice-form-select voice-form-select-clean"
                      value={practiceLevel}
                      onChange={(e) => {
                        setPracticeLevel(e.target.value);
                        practiceLevelRef.current = e.target.value;
                      }}
                    >
                      <option value="Intermediate">Intermediate</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Expert">Expert</option>
                    </select>
                    <i className="fa-solid fa-chevron-down voice-form-chevron"></i>
                  </div>
                </div>
              </div>
            ) : (
              /* Conversation Mode: Single Language Dropdown */
              <div className="voice-form-group">
                <label className="voice-form-label">Language</label>
                <div className="voice-form-select-wrap">
                  <i className="fa-solid fa-globe voice-form-left-icon"></i>
                  <select
                    className="voice-form-select"
                    value={uiLanguage}
                    onChange={(e) => setUiLanguage(e.target.value)}
                  >
                    <option value="English">English</option>
                    <option value="Español">Español</option>
                    <option value="Français">Français</option>
                    <option value="Deutsch">Deutsch</option>
                    <option value="हिन्दी">हिन्दी</option>
                    <option value="日本語">日本語</option>
                  </select>
                  <i className="fa-solid fa-chevron-down voice-form-chevron"></i>
                </div>
              </div>
            )}

            {/* 7. Add a job description or document */}
            {activeMode === 'practice' ? (
              /* Practice Mode: Collapsible Bar matching user screenshot */
              <div className="voice-doc-accordion-wrap">
                <div
                  className={`voice-doc-accordion-bar ${isDocAccordionOpen || resumeData ? 'expanded' : ''}`}
                  onClick={() => {
                    if (!resumeData) {
                      setIsDocAccordionOpen(!isDocAccordionOpen);
                    }
                  }}
                >
                  <div className="voice-doc-accordion-left">
                    <i className={`fa-solid ${isDocAccordionOpen || resumeData ? 'fa-caret-down' : 'fa-play'} voice-doc-caret`}></i>
                    <i className="fa-solid fa-paperclip voice-doc-clip-icon"></i>
                    <span className="voice-doc-bar-text">Add a job description or document</span>
                    <span className="voice-optional-badge">Optional</span>
                  </div>
                  {resumeData ? (
                    <div className="voice-doc-bar-file-tag">
                      <span className="voice-doc-bar-file-name" title={resumeData.fileName}>{resumeData.fileName}</span>
                      <button
                        type="button"
                        className="voice-doc-inline-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearResume();
                        }}
                        title="Remove file"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="voice-browse-files-btn-mini"
                      onClick={(e) => {
                        e.stopPropagation();
                        resumeInputRef.current?.click();
                      }}
                    >
                      Browse
                    </button>
                  )}
                </div>

                {isDocAccordionOpen && !resumeData && (
                  <div
                    className={`voice-doc-upload-box ${isDraggingResume ? 'dragging' : ''}`}
                    onClick={() => resumeInputRef.current?.click()}
                    onDragOver={handleResumeDragOver}
                    onDragLeave={handleResumeDragLeave}
                    onDrop={handleResumeDrop}
                  >
                    <i className="fa-solid fa-cloud-arrow-up voice-doc-box-cloud"></i>
                    <span>Drag &amp; drop document or <span className="voice-link-browse">Browse Files</span></span>
                  </div>
                )}

                {resumeData && (
                  <div className="voice-doc-uploaded-card" style={{ marginTop: '8px' }}>
                    <div className="voice-doc-uploaded-top">
                      <div className="voice-doc-uploaded-info">
                        <i className="fa-solid fa-file-lines voice-doc-file-icon"></i>
                        <div className="voice-doc-meta">
                          <span className="voice-doc-filename" title={resumeData.fileName}>{resumeData.fileName}</span>
                          <span className="voice-doc-size">{Math.round((resumeData.fileSize || 0) / 1024)} KB</span>
                        </div>
                      </div>
                      <div className="voice-doc-actions">
                        <button
                          type="button"
                          className="voice-doc-action-btn"
                          onClick={() => resumeInputRef.current?.click()}
                          title="Upload different file"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          className="voice-doc-clear-btn"
                          onClick={handleClearResume}
                          title="Remove file"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    </div>
                    {resumeData.preview?.skills && resumeData.preview.skills.length > 0 && (
                      <div className="voice-doc-skills-pills">
                        {resumeData.preview.skills.slice(0, 5).map((sk, idx) => (
                          <span key={idx} className="voice-doc-skill-pill">{sk}</span>
                        ))}
                        {resumeData.preview.skills.length > 5 && (
                          <span className="voice-doc-skill-more">+{resumeData.preview.skills.length - 5}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Conversation Mode: Standard Compact Row with Browse Files */
              <div className="voice-doc-upload-section">
                {!resumeData ? (
                  <div
                    className={`voice-doc-upload-row ${isDraggingResume ? 'dragging' : ''}`}
                    onClick={() => !isUploadingResume && resumeInputRef.current?.click()}
                    onDragOver={handleResumeDragOver}
                    onDragLeave={handleResumeDragLeave}
                    onDrop={handleResumeDrop}
                  >
                    <div className="voice-doc-upload-left">
                      <i className="fa-solid fa-cloud-arrow-up voice-doc-cloud-icon"></i>
                      <span className="voice-doc-title">Add a job description or document</span>
                      <span className="voice-optional-badge">Optional</span>
                    </div>
                    <button
                      type="button"
                      className="voice-browse-files-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        resumeInputRef.current?.click();
                      }}
                    >
                      <i className="fa-regular fa-folder-open"></i> Browse Files
                    </button>
                  </div>
                ) : (
                  <div className="voice-doc-uploaded-card">
                    <div className="voice-doc-uploaded-top">
                      <div className="voice-doc-uploaded-info">
                        <i className="fa-solid fa-file-lines voice-doc-file-icon"></i>
                        <div className="voice-doc-meta">
                          <span className="voice-doc-filename" title={resumeData.fileName}>{resumeData.fileName}</span>
                          <span className="voice-doc-size">{Math.round((resumeData.fileSize || 0) / 1024)} KB</span>
                        </div>
                      </div>
                      <div className="voice-doc-actions">
                        <button
                          type="button"
                          className="voice-doc-action-btn"
                          onClick={() => resumeInputRef.current?.click()}
                          title="Upload different file"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          className="voice-doc-clear-btn"
                          onClick={handleClearResume}
                          title="Remove file"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    </div>
                    {resumeData.preview?.skills && resumeData.preview.skills.length > 0 && (
                      <div className="voice-doc-skills-pills">
                        {resumeData.preview.skills.slice(0, 5).map((sk, idx) => (
                          <span key={idx} className="voice-doc-skill-pill">{sk}</span>
                        ))}
                        {resumeData.preview.skills.length > 5 && (
                          <span className="voice-doc-skill-more">+{resumeData.preview.skills.length - 5}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 8. Session Format (Voice only vs Live AI avatar with Girl Avatar) */}
            <div className="voice-form-group">
              <label className="voice-form-label">Session format</label>
              <div className="voice-session-format-grid">
                <button
                  type="button"
                  className={`voice-format-card ${sessionFormat === 'voice_only' ? 'selected' : ''}`}
                  onClick={() => setSessionFormat('voice_only')}
                >
                  <div className="voice-format-icon-wrap">
                    <i className="fa-solid fa-microphone"></i>
                  </div>
                  <div className="voice-format-text-wrap">
                    <h5 className="voice-format-title">Voice only</h5>
                    <span className="voice-format-sub">10 credits/min</span>
                  </div>
                  {sessionFormat === 'voice_only' && (
                    <span className="voice-format-check-badge">
                      <i className="fa-solid fa-circle-check"></i>
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className={`voice-format-card ${sessionFormat === 'live_avatar' ? 'selected' : ''}`}
                  onClick={() => setSessionFormat('live_avatar')}
                >
                  <div className="voice-format-avatar-wrap">
                    <img
                      src="/assets/voice_assistant_avatar.png"
                      alt="Live AI avatar"
                      className="voice-format-avatar-thumb"
                    />
                  </div>
                  <div className="voice-format-text-wrap">
                    <h5 className="voice-format-title">Live AI avatar</h5>
                    <span className="voice-format-sub">Preview only</span>
                  </div>
                  {sessionFormat === 'live_avatar' && (
                    <span className="voice-format-check-badge">
                      <i className="fa-solid fa-circle-check"></i>
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* 9. Start Session CTA Button */}
            <div className="voice-setup-footer-cta">
              <button
                id="btnVoiceConnect"
                type="button"
                className={`voice-start-session-btn ${connected ? 'live' : ''} ${activeMode === 'practice' ? 'practice-btn-mode' : ''}`}
                onClick={handleStartInterview}
                disabled={!connected && (isUploadingResume || !!resumeError)}
              >
                {wsState === 'connecting' ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    <span>Connecting...</span>
                  </>
                ) : connected ? (
                  <>
                    <i className="fa-solid fa-square"></i>
                    <span>End Session</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </>
                ) : activeMode === 'practice' ? (
                  <>
                    <i className="fa-solid fa-play"></i>
                    <span>Start session</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-play"></i>
                    <span>Start Session</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </>
                )}
              </button>

              {connected && (
                <button
                  id="btnVoiceMute"
                  type="button"
                  className={`voice-setup-mute-btn ${muted ? 'muted' : ''}`}
                  onClick={handleMuteToggle}
                >
                  <i className={`fa-solid ${muted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                  <span>{muted ? 'Unmute' : 'Mute'}</span>
                </button>
              )}
            </div>
          </aside>

          {/* Right Panel: Your Conversation (Matches Left Panel in Size, Height & Emerald Green Theme) */}
          <div className="voice-conversation-panel">
            {/* Top-Right & Bottom-Left Decorative Organic Mint Waves (Matching Left Box) */}
            <div className="voice-setup-wave-tr" aria-hidden="true">
              <svg width="150" height="95" viewBox="0 0 150 95" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0C45 25 90 10 150 65V0H0Z" fill="url(#waveRightTrGrad)" opacity="0.35" />
                <defs>
                  <linearGradient id="waveRightTrGrad" x1="0" y1="0" x2="150" y2="65" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#a7f3d0" />
                    <stop offset="1" stopColor="#d1fae5" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div className="voice-setup-wave-bl" aria-hidden="true">
              <svg width="120" height="85" viewBox="0 0 120 85" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 25C40 30 75 60 120 85H0V25Z" fill="url(#waveRightBlGrad)" opacity="0.3" />
                <defs>
                  <linearGradient id="waveRightBlGrad" x1="0" y1="25" x2="120" y2="85" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#a7f3d0" />
                    <stop offset="1" stopColor="#d1fae5" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* 1. Header: Green Conversation Icon + "Your Conversation" + History/New Buttons */}
            <div className="voice-conv-header">
              <div className="voice-conv-header-left">
                <div className="voice-conv-icon-circle">
                  <i className="fa-solid fa-comment-dots"></i>
                </div>
                <h2 className="voice-conv-heading">Your Conversation</h2>
              </div>
              <div className="voice-conv-header-actions" ref={moreMenuRef}>
                <button
                  type="button"
                  className="voice-conv-pill-btn"
                  onClick={() => setShowHistoryModal(true)}
                  title="View session history"
                >
                  <i className="fa-solid fa-clock-rotate-left"></i> History ({sessionHistory.length})
                </button>
                <button
                  type="button"
                  className="voice-conv-pill-btn"
                  onClick={handleNewConversation}
                  title="Start fresh conversation"
                >
                  <i className="fa-solid fa-plus"></i> New
                </button>
              </div>
            </div>

            {/* 2. Meta Row & Live Session Timer (Only shown when session starts/runs, not static) */}
            {(connected || wsState === 'connecting' || activeSessionSeconds > 0) && (
              <>
                <div className="voice-conv-meta-row">
                  <div className="voice-conv-type-tag">
                    <span>Voice conversation</span>
                    <i className="fa-solid fa-pencil voice-conv-pencil"></i>
                  </div>
                  <div className="voice-conv-status-pills">
                    <span className="voice-conv-status-pill active">
                      <i className="fa-solid fa-check"></i> Saved to History
                    </span>
                    <span className="voice-conv-status-pill active">
                      <i className="fa-solid fa-check"></i> Auto-save transcript
                    </span>
                    <span className="voice-conv-status-pill muted">
                      <i className="fa-solid fa-circle-dot"></i> Audio not recorded
                    </span>
                  </div>
                </div>

                <div className="voice-conv-session-card">
                  <div className="voice-conv-session-meta">
                    <span className="voice-conv-session-label">{connected ? 'Active session' : 'Last session'}</span>
                    <span className="voice-conv-session-timer">
                      {`${String(Math.floor(activeSessionSeconds / 60)).padStart(2, '0')}:${String(activeSessionSeconds % 60).padStart(2, '0')}`}
                    </span>
                  </div>
                  <div className="voice-conv-session-status">
                    {connected ? (
                      <span className="voice-conv-badge live">
                        <span className="voice-live-dot"></span> Live
                      </span>
                    ) : (
                      <span className="voice-conv-badge ended">Ended</span>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 4. Action Toolbar: Export, Email, More */}
            <div className="voice-conv-actions-row">
              <div className="voice-conv-actions-left">
                <button
                  type="button"
                  className="voice-conv-action-btn"
                  onClick={handleExportTranscript}
                  title="Export Conversation"
                >
                  <i className="fa-solid fa-download"></i> Export
                </button>
                <button
                  type="button"
                  className="voice-conv-action-btn"
                  onClick={handleEmailTranscript}
                  title="Email Conversation"
                >
                  <i className="fa-regular fa-envelope"></i> Email
                </button>
                <button
                  type="button"
                  className={`voice-conv-action-btn ${showMoreMenu ? 'active' : ''}`}
                  onClick={() => setShowMoreMenu((prev) => !prev)}
                >
                  More <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px', marginLeft: '4px' }}></i>
                </button>

                {showMoreMenu && (
                  <div className="voice-more-dropdown-menu">
                    <button
                      type="button"
                      className="voice-more-menu-item"
                      onClick={() => {
                        handleNewConversation();
                        setShowMoreMenu(false);
                      }}
                    >
                      <i className="fa-solid fa-plus"></i>
                      <span>New conversation</span>
                    </button>
                    <button
                      type="button"
                      className="voice-more-menu-item"
                      onClick={() => {
                        const fullTxt = messages.map(m => `${m.role === 'user' ? 'You' : 'AI'}: ${m.text}`).join('\n\n');
                        if (fullTxt) {
                          navigator.clipboard?.writeText(fullTxt);
                          if (showToast) showToast('Conversation copied to clipboard');
                        } else {
                          if (showToast) showToast('No messages to copy');
                        }
                        setShowMoreMenu(false);
                      }}
                    >
                      <i className="fa-regular fa-copy"></i>
                      <span>Copy conversation</span>
                    </button>
                    <div className="voice-more-divider"></div>
                    <button
                      type="button"
                      className="voice-more-menu-item clear-action"
                      onClick={() => {
                        setMessages([]);
                        setInterimTranscript('');
                        setShowMoreMenu(false);
                        if (showToast) showToast('Conversation cleared');
                      }}
                    >
                      <i className="fa-regular fa-trash-can"></i>
                      <span>Clear conversation</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Search Bar */}
            <div className="voice-conv-search-wrap">
              <div className="voice-conv-search-input-box">
                <i className="fa-solid fa-magnifying-glass voice-conv-search-icon"></i>
                <input
                  type="text"
                  placeholder="Search conversation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="voice-conv-search-input"
                />
                {searchQuery && (
                  <button type="button" className="voice-conv-search-clear" onClick={() => setSearchQuery('')}>×</button>
                )}
              </div>
              <span className="voice-conv-search-helper">Search this conversation's text</span>
            </div>

            {/* 6. Messages / Transcript Scrollable Viewport */}
            <div className="voice-conv-messages-scroll-area">
              {filteredMessages.length === 0 ? (
                /* Empty State (Clean Green Theme, Matching User Screenshot) */
                <div className="voice-empty-state-view">
                  <div className="voice-empty-illustration-wrap">
                    <img
                      src="/assets/voice_empty_chat.png"
                      alt="No conversation yet"
                      className="voice-empty-chat-img"
                    />
                  </div>
                  <h3 className="voice-empty-title">No conversation yet</h3>
                  <p className="voice-empty-desc">
                    Ask a question, start a voice session, or upload a document to begin your conversation.
                  </p>
                  <button
                    type="button"
                    className="voice-empty-cta-btn"
                    onClick={handleStartInterview}
                    disabled={!connected && (isUploadingResume || !!resumeError)}
                  >
                    <i className="fa-solid fa-microphone"></i> Start Agent <i className="fa-solid fa-arrow-right"></i>
                  </button>
                </div>
              ) : (
                /* Messages View (Emerald Green Assistant Theme) */
                <div className="voice-conv-messages-list">
                  {/* Live active connection banner */}
                  {connected && (
                    <div className={`voice-live-active-bar ${speaking ? 'speaking' : listening ? 'listening' : ''}`}>
                      <div className="voice-live-status-pill">
                        <span className="live-dot"></span>
                        <span>{speaking ? 'AI Speaking...' : listening ? 'Listening to you...' : isPaused ? 'Interview Paused' : 'Voice Connected'}</span>
                      </div>
                      <div className="voice-live-soundwaves">
                        <span style={{ height: `${Math.max(6, Math.min(24, level * 100))}px` }}></span>
                        <span style={{ height: `${Math.max(10, Math.min(32, level * 140))}px` }}></span>
                        <span style={{ height: `${Math.max(14, Math.min(28, level * 110))}px` }}></span>
                        <span style={{ height: `${Math.max(8, Math.min(20, level * 80))}px` }}></span>
                      </div>
                    </div>
                  )}

                  {/* Real-time Interim User transcript */}
                  {interimTranscript && (
                    <div className="voice-showcase-message-card user-turn interim-turn">
                      <div className="voice-message-card-header">
                        <div className="voice-message-speaker-meta">
                          <span className="voice-message-speaker-dot" style={{ background: '#10b981' }} />
                          <span className="voice-message-speaker-name">You (speaking...)</span>
                        </div>
                      </div>
                      <p className="voice-message-text">{interimTranscript}</p>
                    </div>
                  )}

                  {/* Conversation Messages */}
                  {filteredMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`voice-showcase-message-card ${msg.role === 'user' ? 'user-turn' : 'agent-turn'}`}
                    >
                      <div className="voice-message-card-header">
                        <div className="voice-message-speaker-meta">
                          <span
                            className="voice-message-speaker-dot"
                            style={{ background: msg.role === 'user' ? '#10b981' : '#059669' }}
                          />
                          <span className="voice-message-speaker-name">
                            {msg.role === 'user' ? 'You' : 'VOICE ASSISTANT'}
                          </span>
                          <span className="voice-message-role-tag">
                            {msg.role === 'user' ? 'Candidate' : 'AI Copilot'}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="voice-message-copy-btn"
                          onClick={() => {
                            navigator.clipboard?.writeText?.(msg.text);
                            if (showToast) showToast('Copied to clipboard');
                          }}
                          title="Copy text"
                        >
                          <i className="fa-regular fa-copy"></i>
                        </button>
                      </div>
                      <p className="voice-message-text">{msg.text}</p>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="voice-agent-footer">
        Powered by Deepgram Voice Agent (Flux STT · Gemini · Aura-2 TTS).
      </footer>

      {/* Centralized Credit-Based Restriction & Usage Modal */}
      {/* Navigation Drawer (Opened via ☰ Hamburger) */}
      {showNavDrawer && (
        <div className="voice-drawer-overlay" onClick={() => setShowNavDrawer(false)}>
          <div className="voice-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="voice-drawer-header">
              <BrandLogo size="sm" />
              <button className="voice-drawer-close-btn" onClick={() => setShowNavDrawer(false)} type="button">×</button>
            </div>

            <nav className="voice-drawer-nav">
              <button className="voice-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleBackToLanding(); }} type="button">
                <i className="fa-solid fa-house"></i> Home
              </button>
              <button className="voice-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleGoToDashboard(); }} type="button">
                <i className="fa-solid fa-chart-line"></i> Dashboard
              </button>
              <button className="voice-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleGoToPanel(); }} type="button">
                <i className="fa-solid fa-rocket"></i> AI Copilot
              </button>
              <button className="voice-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleGoToNotetaker(); }} type="button">
                <i className="fa-solid fa-microphone"></i> Notetaker
              </button>
              <button className="voice-drawer-nav-item active" type="button">
                <i className="fa-solid fa-robot"></i> Voice Agent
              </button>
              <button className="voice-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleGoToUpload(); }} type="button">
                <i className="fa-solid fa-cloud-arrow-up"></i> Upload
              </button>
              <button className="voice-drawer-nav-item" onClick={() => { setShowNavDrawer(false); onGoToReferral?.(); }} type="button">
                <i className="fa-solid fa-gift"></i> Refer &amp; Earn
              </button>
              <button className="voice-drawer-nav-item" onClick={() => { setShowNavDrawer(false); onGoToSubscription?.(); }} type="button">
                <i className="fa-solid fa-crown"></i> Plans &amp; Pricing
              </button>
            </nav>

            <div className="voice-drawer-footer">
              <button
                className="voice-drawer-nav-item"
                onClick={() => { setShowNavDrawer(false); toggleDarkMode?.(); }}
                type="button"
              >
                <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i> {darkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
              <button
                className="voice-drawer-nav-item voice-drawer-logout"
                onClick={() => { setShowNavDrawer(false); handleLogoutClick(); }}
                type="button"
              >
                <i className="fa-solid fa-right-from-bracket"></i> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session History Modal Popup */}
      {showHistoryModal && (
        <div className="voice-history-modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="voice-history-modal-dialog" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="voice-history-modal-header">
              <div className="voice-history-modal-header-left">
                <div className="voice-history-modal-icon-circle">
                  <i className="fa-solid fa-clock-rotate-left"></i>
                </div>
                <div className="voice-history-modal-title-wrap">
                  <h3 className="voice-history-modal-title">Session History</h3>
                  <span className="voice-history-modal-sub">
                    {sessionHistory.length} recorded session{sessionHistory.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="voice-history-modal-close-btn"
                onClick={() => setShowHistoryModal(false)}
                title="Close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="voice-history-modal-body">
              {sessionHistory.length === 0 ? (
                /* Empty State */
                <div className="voice-history-empty-state">
                  <div className="voice-history-empty-icon-wrap">
                    <i className="fa-regular fa-folder-open"></i>
                  </div>
                  <h4 className="voice-history-empty-heading">No recorded sessions yet</h4>
                  <p className="voice-history-empty-text">
                    Start a voice interview or conversation. When you complete a session, it will be automatically recorded here with its transcript and duration.
                  </p>
                </div>
              ) : (
                /* Sessions List */
                <div className="voice-history-sessions-list">
                  {sessionHistory.map((sess) => (
                    <div key={sess.id} className="voice-history-card">
                      <div className="voice-history-card-header">
                        <div className="voice-history-card-title-group">
                          <span className="voice-history-card-title">{sess.title}</span>
                          <span className="voice-history-card-date">{sess.formattedDate}</span>
                        </div>
                        <span className={`voice-history-mode-pill ${sess.mode}`}>
                          {sess.mode === 'practice' ? 'Practice' : 'Conversation'}
                        </span>
                      </div>

                      <div className="voice-history-card-pills">
                        <span className="voice-history-pill">
                          <i className="fa-regular fa-clock"></i> {sess.durationFormatted || '00:00'}
                        </span>
                        <span className="voice-history-pill">
                          <i className="fa-regular fa-message"></i> {sess.messageCount || 0} messages
                        </span>
                        {sess.level && (
                          <span className="voice-history-pill">
                            <i className="fa-solid fa-signal"></i> {sess.level}
                          </span>
                        )}
                        {sess.language && (
                          <span className="voice-history-pill">
                            <i className="fa-solid fa-globe"></i> {sess.language}
                          </span>
                        )}
                      </div>

                      {sess.messages && sess.messages.length > 0 && (
                        <div className="voice-history-card-preview">
                          <strong>Last message: </strong>
                          <span>
                            {sess.messages[sess.messages.length - 1].text?.slice(0, 120)}
                            {sess.messages[sess.messages.length - 1].text?.length > 120 ? '...' : ''}
                          </span>
                        </div>
                      )}

                      <div className="voice-history-card-actions">
                        <button
                          type="button"
                          className="voice-history-load-btn"
                          onClick={() => {
                            if (sess.messages && sess.messages.length > 0) {
                              setMessages([...sess.messages]);
                              setActiveSessionSeconds(sess.durationSeconds || 0);
                              if (sess.mode) {
                                setActiveMode(sess.mode);
                                activeModeRef.current = sess.mode;
                              }
                              if (sess.tech) {
                                setPracticeTech(sess.tech);
                                practiceTechRef.current = sess.tech;
                              }
                              setShowHistoryModal(false);
                              if (showToast) showToast('Loaded session conversation');
                            }
                          }}
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square"></i> View Transcript
                        </button>

                        <button
                          type="button"
                          className="voice-history-delete-btn"
                          onClick={() => {
                            setSessionHistory((prev) => {
                              const updated = prev.filter((s) => s.id !== sess.id);
                              try {
                                localStorage.setItem('kairos_voice_session_history', JSON.stringify(updated));
                              } catch (e) {}
                              return updated;
                            });
                            if (showToast) showToast('Session deleted from history');
                          }}
                          title="Delete session"
                        >
                          <i className="fa-regular fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="voice-history-modal-footer">
              {sessionHistory.length > 0 && (
                <button
                  type="button"
                  className="voice-history-clear-all-btn"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear all session history?')) {
                      setSessionHistory([]);
                      try {
                        localStorage.removeItem('kairos_voice_session_history');
                      } catch (e) {}
                      if (showToast) showToast('All history cleared');
                    }
                  }}
                >
                  Clear All History
                </button>
              )}
              <button
                type="button"
                className="voice-history-close-action-btn"
                onClick={() => setShowHistoryModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
