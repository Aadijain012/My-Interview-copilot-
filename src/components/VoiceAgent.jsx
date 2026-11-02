import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
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
  think:  { type: "google",   model: "gemini-3.1-flash-lite" },          // LLM
  speak:  { type: "deepgram", model: "aura-2-odysseus-en" },             // Aura-2 voice
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
  const [uiLanguage, setUiLanguage] = useState('English');
  const [showProfile, setShowProfile] = useState(true);
  const [isJobDescOpen, setIsJobDescOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const moreMenuRef = useRef(null);
  const langDropdownRef = useRef(null);

  const handleNewConversation = () => {
    setMessages([]);
    setInterimTranscript('');
    setSearchQuery('');
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
      try { micCtxRef.current.close().catch(() => {}); } catch (_) {}
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
          try { micCtxRef.current.close().catch(() => {}); } catch (_) {}
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
      } catch (e) {}
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

    if (activeResume) {
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
        input:  { encoding: "linear16", sample_rate: micCtxRef.current?.sampleRate || 16000 },
        output: { encoding: "linear16", sample_rate: CONFIG.outputSampleRate, container: "none" }
      },
      agent: {
        language: "en",
        listen: { provider: { ...CONFIG.listen } },
        think:  { provider: { ...CONFIG.think }, prompt: agentPrompt },
        speak:  { provider: { ...CONFIG.speak } },
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
          } catch (_) {}
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
      try { micNodeRef.current.disconnect(); } catch (e) {}
      micNodeRef.current = null;
    }
    if (micSourceRef.current) {
      try { micSourceRef.current.disconnect(); } catch (e) {}
      micSourceRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micCtxRef.current) {
      try { micCtxRef.current.close(); } catch (e) {}
      micCtxRef.current = null;
    }
    if (spkCtxRef.current) {
      try { spkCtxRef.current.close(); } catch (e) {}
      spkCtxRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(1000); } catch (e) {}
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
          <div className="voice-nav-logo-badge" onClick={handleBackToLanding} style={{ cursor: 'pointer' }} title="Home">
            <i className="fa-solid fa-robot"></i>
          </div>
          <div className="voice-nav-brand-group" onClick={handleBackToLanding} style={{ cursor: 'pointer' }}>
            <span className="voice-nav-brand-main">MyInterview</span>
            <span className="voice-nav-brand-sub">COPILOT</span>
          </div>
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
          {/* Left Panel / Controller (Stage Card) */}
          <aside className="voice-agent-card stage-card voice-sidebar-panel" data-state={wsState}>
            {/* Hidden File Input for Resume / Document */}
            <input
              type="file"
              ref={resumeInputRef}
              onChange={handleResumeFileChange}
              accept=".pdf,.docx,.doc,.pptx,.txt"
              style={{ display: 'none' }}
            />

            {/* 1. Session Time Card */}
            <div className="voice-session-timer-card">
              <div className="voice-session-time-info">
                <span className="voice-session-timer-label">Session time</span>
                <span className="voice-session-timer-value">
                  {Math.floor(activeSessionSeconds / 60).toString().padStart(2, '0')}:{(activeSessionSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className={`voice-session-status-badge ${connected ? (isPaused ? 'paused' : 'live') : 'ready'}`}>
                <span className="status-badge-dot"></span>
                <span>{connected ? (isPaused ? 'Paused' : 'Recording') : 'Ready'}</span>
              </div>
            </div>

            {/* 2. Mode Switcher Pills */}
            <div className="voice-mode-section">
              <div className="voice-mode-pills-row">
                <button
                  type="button"
                  className={`voice-mode-pill-btn ${activeMode === 'conversation' ? 'active' : ''}`}
                  onClick={() => setActiveMode('conversation')}
                >
                  Conversation
                </button>
                <button
                  type="button"
                  className={`voice-mode-pill-btn ${activeMode === 'practice' ? 'active' : ''}`}
                  onClick={() => setActiveMode('practice')}
                >
                  Interview practice
                </button>
              </div>
              <p className="voice-mode-helper-text">
                Ask about a topic or document. You can also ask for Interview practice by voice.
              </p>
            </div>

            {/* 3. Conversation Language Selector */}
            <div className="voice-lang-section" ref={langDropdownRef}>
              <label className="voice-lang-field-label">Conversation language</label>
              <button
                type="button"
                className="voice-lang-dropdown"
                onClick={() => setShowLangDropdown(!showLangDropdown)}
              >
                <span className="voice-lang-val">
                  <i className="fa-solid fa-globe"></i> {uiLanguage}
                </span>
                <i className={`fa-solid fa-chevron-down voice-lang-chevron ${showLangDropdown ? 'rotated' : ''}`}></i>
              </button>

              {showLangDropdown && (
                <div className="voice-lang-options-menu">
                  {['English', 'Español', 'Français', 'Deutsch', 'हिन्दी', '日本語'].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      className={`voice-lang-opt-item ${uiLanguage === lang ? 'active' : ''}`}
                      onClick={() => {
                        setUiLanguage(lang);
                        setShowLangDropdown(false);
                      }}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 4. AI Voice Assistant Profile Card */}
            <div className="voice-assistant-profile-card">
              <div className="voice-avatar-wrapper">
                <div className="voice-avatar-photo-cluster">
                  <img
                    src="/assets/voice_assistant_avatar.png"
                    alt="AI Voice Assistant"
                    className="voice-avatar-photo"
                  />
                  <span className={`voice-avatar-online-dot ${connected ? 'active' : 'ready'}`}></span>
                </div>
                <div className="voice-assistant-title-group">
                  <h4 className="voice-assistant-name">AI Voice Assistant</h4>
                  <button
                    type="button"
                    className="voice-toggle-profile-link"
                    onClick={() => setShowProfile(!showProfile)}
                  >
                    {showProfile ? 'Hide profile' : 'Show profile'}
                  </button>
                </div>
              </div>

              {showProfile && (
                <div className="voice-assistant-prompt-box">
                  <h5 className="voice-prompt-title">How can I help?</h5>
                  <p className="voice-prompt-desc">
                    Start a conversation, or upload a document to ask questions about it.
                  </p>

                  {/* Action Buttons: Start Agent & Mute */}
                  <div className="voice-profile-buttons-row">
                    <button
                      id="btnVoiceConnect"
                      className={`voice-pill-start-btn ${connected ? 'live' : ''}`}
                      onClick={handleStartInterview}
                      disabled={!connected && (isUploadingResume || !!resumeError)}
                      title={connected ? "End the session" : "Start conversation"}
                    >
                      {wsState === 'connecting' ? (
                        <>
                          <i className="fa-solid fa-circle-notch fa-spin"></i> Connecting...
                        </>
                      ) : connected ? (
                        <>
                          <i className="fa-solid fa-square"></i> End Agent
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-play"></i> Start Agent
                        </>
                      )}
                    </button>

                    <button
                      id="btnVoiceMute"
                      className={`voice-pill-mute-btn ${muted ? 'muted' : ''}`}
                      disabled={!connected}
                      onClick={handleMuteToggle}
                      title={muted ? "Unmute" : "Mute"}
                    >
                      <i className={`fa-solid ${muted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                      <span>Mute</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Job description (optional) Card */}
            <div className={`job-description-card ${isJobDescOpen ? 'open' : 'collapsed'}`}>
              <div className="job-description-header">
                <div className="job-desc-header-left">
                  <i className="fa-solid fa-triangle-exclamation job-desc-icon"></i>
                  <span>Job description (optional)</span>
                </div>
                <button
                  type="button"
                  className="voice-job-desc-toggle-btn"
                  onClick={() => setIsJobDescOpen(!isJobDescOpen)}
                >
                  {isJobDescOpen ? '— Close' : '+ Open'}
                </button>
              </div>

              {isJobDescOpen && (
                <div className="job-description-body">
                  <textarea
                    id="voice-agent-job-description"
                    className="job-description-input"
                    value={jobDescription}
                    onChange={(event) => {
                      const value = event.target.value;
                      setJobDescription(value);
                      jobDescriptionRef.current = value;
                    }}
                    placeholder="Paste the role, responsibilities, and required skills here..."
                    maxLength={10000}
                    disabled={connected || wsState === 'connecting'}
                    rows={3}
                  />
                  <div className="job-desc-footer-row">
                    <p className="job-description-help">
                      Optional: add job description for job-specific interview practice.
                    </p>
                    <i className="fa-solid fa-pencil job-desc-edit-icon"></i>
                  </div>
                </div>
              )}
            </div>

            {/* 6. Upload document / Resume Card */}
            {!resumeData ? (
              <div
                className={`resume-upload-card ${isDraggingResume ? 'dragging' : ''} ${isUploadingResume ? 'loading' : ''}`}
                onClick={() => !isUploadingResume && resumeInputRef.current?.click()}
                onDragOver={handleResumeDragOver}
                onDragLeave={handleResumeDragLeave}
                onDrop={handleResumeDrop}
                role="button"
                tabIndex={0}
              >
                {isUploadingResume ? (
                  <div className="resume-upload-loading">
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    <span>Analyzing document & extracting skills...</span>
                  </div>
                ) : (
                  <div className="resume-upload-content">
                    <div className="resume-icon-circle">
                      <i className="fa-solid fa-cloud-arrow-up"></i>
                    </div>
                    <div className="resume-text-group">
                      <span className="resume-title">Upload document</span>
                      <span className="resume-subtitle">PDF, DOCX, PPTX etc. (questions, summaries, and explanations)</span>
                    </div>
                    <button type="button" className="resume-browse-btn">
                      Browse
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="resume-badge-card">
                <div className="resume-badge-header">
                  <div className="resume-file-info">
                    <div className="resume-badge-icon">
                      <i className="fa-solid fa-file-invoice"></i>
                    </div>
                    <div className="resume-name-meta">
                      <div className="resume-file-title" title={resumeData.fileName}>
                        {resumeData.fileName}
                      </div>
                      <div className="resume-candidate-meta">
                        {resumeData.preview?.name && <strong>{resumeData.preview.name}</strong>}
                        {resumeData.preview?.role && <span> · {resumeData.preview.role}</span>}
                        <span> · {Math.round((resumeData.fileSize || 0) / 1024)} KB</span>
                      </div>
                    </div>
                  </div>

                  {!connected && (
                    <div className="resume-actions">
                      <button
                        type="button"
                        className="resume-reupload-btn"
                        onClick={() => resumeInputRef.current?.click()}
                        title="Upload a different resume"
                      >
                        <i className="fa-solid fa-arrows-rotate"></i> Change
                      </button>
                      <button
                        type="button"
                        className="resume-clear-btn"
                        onClick={handleClearResume}
                        title="Remove resume"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  )}
                </div>

                {resumeData.preview?.skills && resumeData.preview.skills.length > 0 && (
                  <div className="resume-skills-section">
                    <div className="skills-header-row">
                      <span className="skills-label">
                        <i className="fa-solid fa-tags"></i> Detected Skills:
                      </span>
                      <span className="skills-count-badge">
                        {resumeData.preview.skills.length}
                      </span>
                    </div>
                    <div className="resume-skills-pills">
                      {resumeData.preview.skills.map((skill, idx) => (
                        <span key={idx} className="skill-pill" title={skill}>{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 7. Try saying: Section (2x2 Grid) */}
            <div className="orb-hints-section">
              <span className="orb-hints-label">Try saying:</span>
              <div className="voice-try-saying-grid">
                {[
                  "Explain a topic to me",
                  "Tell me about yourself",
                  "Tell me about yourself",
                  "Help me practice an interview"
                ].map((hint, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="voice-try-saying-chip"
                    onClick={() => {
                      if (showToast) showToast(`Prompt: "${hint}"`);
                    }}
                  >
                    "{hint}"
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Right Area: Hero Banner + Actions Toolbar + Workspace Card */}
          <div className="voice-main-content-col">
            {/* Top Hero Banner - Warm Peach Gradient with 3D Studio Microphone */}
            <section className="voice-hero-banner">
              <div className="voice-hero-left">
                <div className="voice-hero-icon-squircle">
                  <span className="voice-hero-soundwave">
                    <span></span><span></span><span></span><span></span><span></span>
                  </span>
                </div>
                <div className="voice-hero-text">
                  <h1 className="voice-hero-title">
                    Your <span className="voice-hero-title-accent">Conversation</span>
                  </h1>
                  <p className="voice-hero-subtitle">
                    Practice with AI, get instant feedback, and improve your skills.
                  </p>
                </div>
              </div>

              <div className="voice-hero-art">
                <img
                  src="/assets/voice_banner_mic.png"
                  alt="Studio Microphone - You're all set!"
                  className="voice-hero-mic-img"
                />
              </div>
            </section>

            {/* Action Bar (Export, Email, Search, and More dropdown) */}
            <div className="voice-actions-toolbar">
              <div className="voice-actions-left">
                <button
                  type="button"
                  className="voice-toolbar-pill-btn"
                  onClick={handleExportTranscript}
                  title="Export Conversation"
                >
                  <i className="fa-solid fa-download"></i> Export
                </button>
                <button
                  type="button"
                  className="voice-toolbar-pill-btn"
                  onClick={handleEmailTranscript}
                  title="Email Conversation"
                >
                  <i className="fa-regular fa-envelope"></i> Email
                </button>
                <span className="voice-toolbar-divider">|</span>
                <div className="voice-toolbar-search">
                  <i className="fa-solid fa-magnifying-glass voice-search-mag-icon"></i>
                  <input
                    type="text"
                    placeholder="Search conversation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="voice-toolbar-search-input"
                  />
                  {searchQuery && (
                    <button type="button" className="voice-search-clear" onClick={() => setSearchQuery('')}>×</button>
                  )}
                </div>
              </div>

              <div className="voice-actions-right" ref={moreMenuRef}>
                <button
                  type="button"
                  className={`voice-toolbar-pill-btn voice-more-btn ${showMoreMenu ? 'active' : ''}`}
                  onClick={() => setShowMoreMenu((prev) => !prev)}
                >
                  More <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px', marginLeft: '5px', transform: showMoreMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}></i>
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

            {/* Main Workspace Card */}
            <div className="voice-agent-card transcript-card voice-chat-workspace-card">
              {filteredMessages.length === 0 ? (
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
                <div className="transcript-messages-container">
                  {/* Active call indicator */}
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
                          <span className="voice-message-speaker-dot" style={{ background: '#f97316' }} />
                          <span className="voice-message-speaker-name">You (speaking...)</span>
                        </div>
                      </div>
                      <p className="voice-message-text">{interimTranscript}</p>
                    </div>
                  )}

                  {filteredMessages.map((msg, idx) => (
                    <div key={idx} className={`voice-showcase-message-card ${msg.role === 'user' ? 'user-turn' : 'agent-turn'}`}>
                      <div className="voice-message-card-header">
                        <div className="voice-message-speaker-meta">
                          <span
                            className="voice-message-speaker-dot"
                            style={{ background: msg.role === 'user' ? '#f97316' : '#ea580c' }}
                          />
                          <span className="voice-message-speaker-name">
                            {msg.role === 'user' ? 'You' : 'AI Voice Assistant'}
                          </span>
                          <span className="voice-message-role-tag">
                            {msg.role === 'user' ? 'Candidate' : 'AI Interviewer'}
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
              <div className="voice-drawer-header-left">
                <div className="voice-nav-logo-circle">
                  <i className="fa-solid fa-robot"></i>
                </div>
                <span>MyInterview Copilot</span>
              </div>
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
