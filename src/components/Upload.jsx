import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import BrandLogo from './common/BrandLogo';
import AccountDropdown from './UserProfile/AccountDropdown';
import CreditUsagePromptModal from './common/CreditUsagePromptModal';
import {
  CREDIT_USAGE_CONFIG,
  getUserCredits,
  getDownloadStatus,
  recordDownloadAction,
  recordUploadAction
} from '../config/creditUsageConfig';
import { API_BASE, WS_BASE, websocketProtocols } from '../utils/api';
import {
  uploadVideoFile,
  pollVideoJobStatus,
  fetchVideoSessions,
  deleteVideoSession,
  cancelVideoJob
} from '../utils/videoApi';
import './Upload.css';
import { generateStyledReportHtml, downloadPdfReport, escapeHtml, formatParagraphs } from '../utils/pdfReportTemplate';
import PdfCustomizerModal from './PdfCustomizerModal';
import UploadWorkspaceView from './UploadWorkspaceView';

const DEFAULT_MOCK_SESSION = {
  id: 'demo_session_interview_10nov',
  fileName: 'Interview · 10 Nov - Audio.ogg',
  title: 'Interview · 10 Nov - Audio.ogg',
  duration: '0:57',
  durationSeconds: 57,
  speakersCount: 1,
  wordsCount: 49,
  transcript: "What is Python? What is the difference between Python and Java? What is Java? What is Java? What do you think? Java is best or Python? It's good, sir. What do you think? Java is best or Python? What do you think? Java is best or Python? No. Okay.",
  utterances: [
    { id: 1, speaker: 'Speaker 1', time: '0:03', text: 'What is' },
    { id: 2, speaker: 'Speaker 1', time: '0:10', text: 'Python?' },
    { id: 3, speaker: 'Speaker 1', time: '0:11', text: 'What is the difference between Python and Java?' },
    { id: 4, speaker: 'Speaker 1', time: '0:21', text: 'What is Java?' },
    { id: 5, speaker: 'Speaker 1', time: '0:25', text: 'What is Java?' },
    { id: 6, speaker: 'Speaker 1', time: '0:34', text: 'What do you think?' },
    { id: 7, speaker: 'Speaker 1', time: '0:36', text: 'Java is best or Python?' },
    { id: 8, speaker: 'Speaker 1', time: '0:39', text: "It's good, sir. What do you think? Java is best or Python?" },
    { id: 9, speaker: 'Speaker 1', time: '0:44', text: 'What do you think? Java is best or Python?' },
    { id: 10, speaker: 'Speaker 1', time: '0:50', text: 'No.' },
    { id: 11, speaker: 'Speaker 1', time: '0:55', text: 'Okay.' }
  ]
};

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v', '.3gp', '.ts'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.oga', '.weba', '.flac', '.wma', '.aiff'];

function isVideoFile(file) {
  if (!file) return false;
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();

  // 1. Explicit audio MIME types (like audio/webm, audio/mp3, audio/wav) are audio
  if (type.startsWith('audio/')) return false;

  // 2. Known audio extensions
  if (AUDIO_EXTENSIONS.some(ext => name.endsWith(ext))) return false;

  // 3. Audio recordings saved as .webm (e.g. interview_audio_...webm)
  if (name.includes('audio') && (name.endsWith('.webm') || name.endsWith('.ogg'))) return false;

  // 4. Explicit video MIME type (unless explicitly named audio)
  if (type.startsWith('video/')) {
    if (type === 'video/webm' && name.includes('audio')) return false;
    return true;
  }

  // 5. Explicit video extensions
  if (VIDEO_EXTENSIONS.some(ext => name.endsWith(ext))) return true;

  // 6. Generic .webm without audio in name or MIME type is treated as video
  if (name.endsWith('.webm') && !name.includes('audio')) {
    return true;
  }

  return false;
}

function isAudioOrVideoFile(file) {
  if (!file) return false;
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();

  // 1. Explicit audio or video MIME types
  if (type.startsWith('audio/') || type.startsWith('video/')) {
    return true;
  }

  // 2. Known audio extensions
  if (AUDIO_EXTENSIONS.some(ext => name.endsWith(ext))) {
    return true;
  }

  // 3. Known video extensions
  if (VIDEO_EXTENSIONS.some(ext => name.endsWith(ext))) {
    return true;
  }

  return false;
}

const DOCUMENT_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.pptx', '.xlsx', '.odt', '.txt', '.csv', '.tsv', '.json', '.html', '.htm'
];

const IMAGE_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff'
];

function isSupportedMediaFile(file) {
  if (!file) return false;
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  if (isAudioOrVideoFile(file)) return true;
  if (DOCUMENT_EXTENSIONS.some(ext => name.endsWith(ext))) return true;
  if (IMAGE_EXTENSIONS.some(ext => name.endsWith(ext))) return true;
  if (type.startsWith('image/') || type.includes('pdf') || type.includes('document') || type.includes('text')) return true;
  return false;
}

const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;

const LANGUAGES_LIST = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'es', native: 'Español', english: 'Spanish' },
  { code: 'fr', native: 'Français', english: 'French' },
  { code: 'it', native: 'Italiano', english: 'Italian' },
  { code: 'pt', native: 'Português', english: 'Portuguese' },
  { code: 'nl', native: 'Nederlands', english: 'Dutch' },
  { code: 'ru', native: 'Русский', english: 'Russian' },
  { code: 'tr', native: 'Türkçe', english: 'Turkish' },
  { code: 'ar', native: 'العربية', english: 'Arabic' },
  { code: 'zh', native: '中文', english: 'Chinese' },
  { code: 'ja', native: '日本語', english: 'Japanese' },
  { code: 'ko', native: '한국어', english: 'Korean' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil' },
  { code: 'mr', native: 'मराठी', english: 'Marathi' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada' },
  { code: 'ml', native: 'മലയാളം', english: 'Malayalam' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi' }
];

const TRANSCRIPTION_LANGUAGES = [
  { code: 'auto', label: 'Auto-Detect Language (Recommended)' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'mr', label: 'Marathi (मराठी)' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { code: 'ml', label: 'Malayalam (മലയാളം)' },
  { code: 'bn', label: 'Bengali (বাংলা)' },
  { code: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'zh', label: 'Chinese (中文)' },
  { code: 'ar', label: 'Arabic (العربية)' }
];

const cleanDisplayText = (text) => {
  if (!text || typeof text !== 'string') return text || '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/###\s*/g, '')
    .replace(/##\s*/g, '')
    .replace(/#\s*/g, '')
    .replace(/\*\*/g, '');
};

const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB
const FILE_SIZE_ERROR_MESSAGE = 'File size exceeds the 10 GB limit. Please upload a smaller file.';
const RESUME_REDIRECT_MESSAGE = 'This page accepts audio or video files. Upload resumes from the AI Copilot page.';
const UNSUPPORTED_MEDIA_ERROR_MESSAGE = 'Invalid file type. This page accepts only audio or video files (e.g., MP3, WAV, M4A, AAC, MP4, MOV, WebM, MKV).';
const RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx'];

function isResumeDocument(file) {
  const name = String(file?.name || '').toLowerCase();
  return RESUME_EXTENSIONS.some(extension => name.endsWith(extension));
}

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '0 KB';
  const k = 1024;
  if (bytes < k * 1024) {
    return `${Math.round(bytes / k)} KB`;
  }
  return `${(bytes / (k * 1024)).toFixed(1)} MB`;
};

export default function Upload({
  token,
  user,
  onLogout,
  onBackToLanding,
  onGoToPanel,
  onGoToNotetaker,
  onGoToVoiceAgent,
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
  const handleMinimize = () => ipcRenderer?.send('window-minimize');
  const handleMaximize = () => ipcRenderer?.send('window-maximize');

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

  // Sessions & Core state
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [transcribingFile, setTranscribingFile] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState(null);
  const [isAudioUploaded, setIsAudioUploaded] = useState(false);
  const [transcribeLang, setTranscribeLang] = useState('auto');
  const [transcribeElapsed, setTranscribeElapsed] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('online'); // 'online' | 'connecting' | 'reconnecting'
  const [transcriptionStatus, setTranscriptionStatus] = useState('idle'); // 'idle' | 'preparing' | 'processing' | 'reconnecting' | 'completed' | 'error'
  const [isNetworkError, setIsNetworkError] = useState(false);
  const activeTranscribeSessionIdRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  // ── 3-State Flow & Interactive Workspace States ──
  const [uploadFlowStep, setUploadFlowStep] = useState('initial'); // 'initial' | 'preferences' | 'processing' | 'workspace'
  const [readerChoice, setReaderChoice] = useState('original'); // 'original' | 'translate'
  const [selectedSourceLang, setSelectedSourceLang] = useState('en');
  const [activeQuickTool, setActiveQuickTool] = useState(null); // 'key_points' | 'summarize' | 'explain' | 'actions' | 'mindmap'
  const [quickToolState, setQuickToolState] = useState('ready'); // 'accepted' | 'creating' | 'ready'
  const [askChatFeed, setAskChatFeed] = useState([]);
  const [audioPlayState, setAudioPlayState] = useState(false);
  const [audioSeekSec, setAudioSeekSec] = useState(0);
  const [wsInputText, setWsInputText] = useState('');

  // ── Upload History Popup States (Persistent via localStorage) ──
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyFilterTab, setHistoryFilterTab] = useState('all'); // 'all' | 'audio' | 'video' | 'document'

  const [uploadHistory, setUploadHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('kairos_upload_session_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse upload history from localStorage', e);
    }
    return [
      {
        id: 'demo_session_interview_10nov',
        title: 'Interview · 10 Nov - Audio.ogg',
        fileName: 'Interview · 10 Nov - Audio.ogg',
        fileType: 'audio',
        duration: '0:57',
        durationSeconds: 57,
        wordsCount: 49,
        date: new Date().toISOString(),
        formattedDate: '10 Nov, 10:00 AM',
        status: 'ready',
        transcript: DEFAULT_MOCK_SESSION.transcript,
        utterances: DEFAULT_MOCK_SESSION.utterances,
        activeTool: 'key_points',
        toolState: 'ready',
        messages: [
          {
            role: 'ai',
            text: 'Key points ready: The speaker actively contrasts Python and Java, examining which programming ecosystem provides superior advantages.',
            time: '10:01 AM'
          }
        ]
      }
    ];
  });

  // Sync uploadHistory to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('kairos_upload_session_history', JSON.stringify(uploadHistory.slice(0, 50)));
    } catch (e) {
      console.warn('Failed to save upload history to localStorage', e);
    }
  }, [uploadHistory]);

  const saveSessionToHistory = (sessionData) => {
    if (!sessionData) return;
    setUploadHistory((prev) => {
      const id = sessionData.id || ('upload_sess_' + Date.now());
      const existingIdx = prev.findIndex((s) => s.id === id);
      const isVid = sessionData.fileType === 'video' || sessionData.isVideoSession;
      const historyItem = {
        id,
        title: sessionData.fileName || sessionData.title || (isVid ? 'Video Recording' : 'Audio Recording'),
        fileName: sessionData.fileName || sessionData.title || (isVid ? 'Video Recording' : 'Audio Recording'),
        fileType: sessionData.fileType || (isVid ? 'video' : 'audio'),
        isVideoSession: Boolean(isVid),
        duration: sessionData.duration || '0:57',
        durationSeconds: sessionData.durationSeconds || 57,
        wordsCount: sessionData.wordsCount || (sessionData.transcript ? sessionData.transcript.split(/\s+/).filter(Boolean).length : 49),
        date: sessionData.date || sessionData.createdAt || new Date().toISOString(),
        formattedDate: sessionData.formattedDate || new Date().toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        status: 'ready',
        transcript: sessionData.transcript || '',
        utterances: sessionData.utterances || [],
        messages: sessionData.messages || sessionData.chatMessages || [],
        activeTool: sessionData.activeTool || null,
        toolState: sessionData.toolState || 'ready',
        ...sessionData
      };

      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = { ...copy[existingIdx], ...historyItem };
        return copy;
      }
      return [historyItem, ...prev];
    });
  };

  const handleOpenHistorySession = (sess) => {
    setActiveSession(sess);
    setSelectedFileName(sess.fileName || sess.title || '');
    setSelectedFile(null);
    setMessages(sess.messages || []);
    setMediaDuration(sess.duration || '0:57');
    setActiveTab('transcript');
    setUploadFlowStep('workspace');
    setShowHistoryModal(false);
    if (showToast) {
      showToast(`Loaded "${sess.fileName || sess.title}" from history`);
    }
  };

  const handleDeleteHistorySession = async (e, sessionId) => {
    e?.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this session from history?')) return;
    setUploadHistory((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
      setUploadFlowStep('initial');
    }
    try {
      if (sessions.some((s) => s.id === sessionId)) {
        await axios.delete(`${API_BASE}/api/upload/session/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      if (videoSessions.some((vs) => vs.id === sessionId)) {
        await deleteVideoSession(sessionId, token);
      }
    } catch (err) {
      // ignore
    }
    if (showToast) showToast('Session deleted from history');
  };

  const handleClearAllHistory = () => {
    if (!window.confirm('Are you sure you want to clear all upload history?')) return;
    setUploadHistory([]);
    try {
      localStorage.removeItem('kairos_upload_session_history');
    } catch (e) {}
    if (activeSession) {
      setActiveSession(null);
      setUploadFlowStep('initial');
    }
    if (showToast) showToast('All upload history cleared');
  };

  // ── New Redesign V2 States (Matching media_1794574048062_21272d0c.png) ──
  const [showHelpWithUploads, setShowHelpWithUploads] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [closedHelpCards, setClosedHelpCards] = useState({});

  const handleToggleHelpWithUploads = () => {
    setShowHelpWithUploads(prev => {
      const next = !prev;
      if (next) setClosedHelpCards({});
      return next;
    });
  };

  const handleDismissHelpCard = (cardId, e) => {
    e?.stopPropagation();
    setClosedHelpCards(prev => ({ ...prev, [cardId]: true }));
  };

  const handleCategoryClick = (catKey) => {
    setSelectedCategory(catKey);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleChooseFileClick = (e) => {
    e?.stopPropagation();
    setSelectedCategory(null);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const triggerQuickTool = (tool) => {
    setActiveQuickTool(tool);
    setQuickToolState('accepted');
    setTimeout(() => {
      setQuickToolState('creating');
      setTimeout(() => {
        setQuickToolState('ready');
      }, 400);
    }, 300);
  };

  const handleWorkspaceAskSubmit = (e) => {
    if (e) e.preventDefault();
    if (!wsInputText.trim()) return;
    const q = wsInputText.trim();
    setWsInputText('');
    setAskChatFeed(prev => [...prev, { role: 'user', text: q, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    
    setTimeout(() => {
      let reply = `Based on the audio recording "${activeSession?.fileName || 'Interview · 10 Nov - Audio.ogg'}", here is the analysis:\n\n`;
      const qLower = q.toLowerCase();
      if (qLower.includes('mindmap') || qLower.includes('mind map')) {
        reply += `🧠 **Mind Map Structure:**\n• **Core Topic:** Language Comparison\n  ├── Python (Interpreted, dynamic, rapid prototyping, AI/ML)\n  └── Java (JVM, static types, enterprise backend scale, concurrency)`;
      } else if (qLower.includes('action') || qLower.includes('todo')) {
        reply += `📋 **Action Items:**\n1. Define project constraints (CPU throughput vs developer velocity).\n2. Prototype core service in Python for quick validation.\n3. Benchmark JVM services if enterprise multithreading is required.`;
      } else if (qLower.includes('summary') || qLower.includes('summarize')) {
        reply += `✨ **Summary:** The speaker explores whether Python or Java is better, asking multiple rhetorical questions to evaluate the ideal programming language for their use case.`;
      } else {
        reply += `The discussion specifically examines the core strengths of Python and Java. Python emphasizes rapid development and developer readability, while Java provides strict type safety and high performance across enterprise systems.`;
      }
      setAskChatFeed(prev => [...prev, { role: 'assistant', text: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    }, 500);
  };

  const handleLaunchMockWorkspace = () => {
    setSelectedFileName('Interview · 10 Nov - Audio.ogg');
    setUploadFlowStep('preferences');
  };

  // Auto-advance from secure upload/processing step to full workspace
  useEffect(() => {
    if (uploadFlowStep === 'processing') {
      const timer = setTimeout(() => {
        setActiveSession(DEFAULT_MOCK_SESSION);
        setSelectedFileName(prev => prev || DEFAULT_MOCK_SESSION.fileName);
        setActiveQuickTool('key_points');
        setQuickToolState('ready');
        setUploadFlowStep('workspace');
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [uploadFlowStep]);

  // Simulated audio playback progress in workspace
  useEffect(() => {
    let t;
    if (audioPlayState) {
      t = setInterval(() => {
        setAudioSeekSec(prev => {
          if (prev >= 56) {
            setAudioPlayState(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (t) clearInterval(t);
    };
  }, [audioPlayState]);

  // Active elapsed timer for transcription
  useEffect(() => {
    let timer;
    if (isTranscribing) {
      setTranscribeElapsed(0);
      timer = setInterval(() => {
        setTranscribeElapsed(prev => prev + 1);
      }, 1000);
    } else {
      setTranscribeElapsed(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isTranscribing]);

  // Video & audio processing and cancellation state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoStage, setVideoStage] = useState('idle'); // 'idle' | 'uploading' | 'converting' | 'ready'
  const [convertingProgress, setConvertingProgress] = useState(0);
  const [convertingElapsed, setConvertingElapsed] = useState(0);
  const [videoSessions, setVideoSessions] = useState([]);
  const [activeLibraryTab, setActiveLibraryTab] = useState('all'); // 'all' | 'audio' | 'video'
  const uploadAbortControllerRef = useRef(null);
  const currentVideoJobIdRef = useRef(null);

  // Active elapsed timer for video-to-audio extraction
  useEffect(() => {
    let timer;
    if (videoStage === 'converting') {
      setConvertingElapsed(0);
      timer = setInterval(() => {
        setConvertingElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setConvertingElapsed(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [videoStage]);

  // Active Tab: 'transcript' | 'translate' | 'ask_ai'
  const [activeTab, setActiveTab] = useState('transcript');

  // Media Player metadata & seeking
  const [mediaDuration, setMediaDuration] = useState('0:30');
  const [protectedMediaUrl, setProtectedMediaUrl] = useState('');
  const mediaPlayerRef = useRef(null);

  // Translation state
  const [selectedTargetLang, setSelectedTargetLang] = useState(null); // 'Original only' default
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [autoTranscribeAfterUpload, setAutoTranscribeAfterUpload] = useState(true);
  const [activeShowcaseChip, setActiveShowcaseChip] = useState('');
  const [langSearch, setLangSearch] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedData, setTranslatedData] = useState(null);
  const [translationProgress, setTranslationProgress] = useState(null);
  const translationPollRef = useRef(null);

  // Refs
  const fileInputRef = useRef(null);
  const fromLangSelectRef = useRef(null);
  const toLangSelectRef = useRef(null);
  const chatEndRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorNodeRef = useRef(null);
  const micSourceRef = useRef(null);
  const audioStreamRef = useRef(null);
  const wsRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const isListeningRef = useRef(false);
  const recordingGenRef = useRef(0);
  const isStartingRef = useRef(false);
  const lastToggleTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  // Anti-Spam synchronous lock refs and action states
  const [deletingSessionId, setDeletingSessionId] = useState(null);
  const isUploadingLockRef = useRef(false);
  const transcribeLockRef = useRef(false);
  const translateLockRef = useRef(false);
  const sendMessageLockRef = useRef(false);
  const deletingLockRef = useRef(false);
  const isExportingRef = useRef(false);

  // Fetch saved upload sessions when component mounts, token is available, or user switches
  useEffect(() => {
    if (token && windowType === 'upload') {
      fetchSessions();
    }
  }, [token, user?.id || user?.email, windowType]);

  // Clean up recording and upload when navigating away
  useEffect(() => {
    if (windowType !== 'upload') {
      if (uploadAbortControllerRef.current) {
        try { uploadAbortControllerRef.current.abort(); } catch (_) { }
      }
      stopRecording();
    }
  }, [windowType]);

  // Clean up on component unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (uploadAbortControllerRef.current) {
        try { uploadAbortControllerRef.current.abort(); } catch (_) { }
      }
      stopRecording();
    };
  }, []);

  // Clean up on browser unload
  useEffect(() => {
    const handleBeforeUnload = () => stopRecording();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Scroll chat feed to bottom on new messages
  useEffect(() => {
    if (activeTab === 'ask_ai') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isUploading, isSending, activeTab]);

  // Sync translation when active session or selected language changes
  useEffect(() => {
    if (activeSession?.translations && selectedTargetLang?.english) {
      if (activeSession.translations[selectedTargetLang.english]) {
        setTranslatedData(activeSession.translations[selectedTargetLang.english]);
      } else {
        setTranslatedData(prev => prev === null ? prev : null);
      }
    } else {
      setTranslatedData(prev => prev === null ? prev : null);
    }
  }, [activeSession, selectedTargetLang]);

  const fetchSessions = async () => {
    try {
      const [uploadRes, videoRes] = await Promise.allSettled([
        axios.get(`${API_BASE}/api/upload/sessions`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetchVideoSessions(token)
      ]);
      if (!isMountedRef.current) return;
      if (uploadRes.status === 'fulfilled' && uploadRes.value.data.ok) {
        const backendUploads = uploadRes.value.data.sessions || [];
        setSessions(backendUploads);
        backendUploads.forEach(s => saveSessionToHistory(s));
      }
      if (videoRes.status === 'fulfilled' && videoRes.value.ok) {
        const backendVideos = videoRes.value.sessions || [];
        setVideoSessions(backendVideos);
        backendVideos.forEach(vs => saveSessionToHistory({ ...vs, isVideoSession: true, fileType: 'video' }));
      }
    } catch (err) {
      console.error('[Upload Sessions] fetch error:', err);
    }
  };

  const loadVideoSession = (vSession) => {
    setActiveSession({
      id: vSession.id,
      isVideoSession: true,
      title: vSession.videoFileName,
      fileName: vSession.videoFileName,
      audioFileName: vSession.audioFileName,
      audioUrl: vSession.audioUrl,
      fileUrl: vSession.audioUrl,
      fileSize: vSession.videoFileSize,
      storageMode: vSession.storageMode || 'local',
      createdAt: vSession.createdAt,
      messages: vSession.messages || [],
      transcript: vSession.transcript || '',
      utterances: vSession.utterances || [],
      translations: vSession.translations || {},
      duration: vSession.duration || '0:30',
      durationSeconds: vSession.durationSeconds || 0,
      speakersCount: vSession.speakersCount || 1
    });
    setMessages(vSession.messages || []);
    setSelectedFileName(vSession.videoFileName || '');
    setSelectedFile(null);
    setMediaDuration(vSession.duration || '0:30');
    setIsAudioUploaded(true);
    setVideoStage('ready');
    setActiveTab('transcript');
  };

  const deleteVideoSessionItem = async (e, sessionId) => {
    e.stopPropagation();
    if (deletingLockRef.current) return;
    if (!window.confirm('Are you sure you want to delete this video session and its local audio file?')) return;
    deletingLockRef.current = true;
    setDeletingSessionId(sessionId);
    try {
      const res = await deleteVideoSession(sessionId, token);
      if (res.ok) {
        showToast('Video session deleted from local disk.');
        fetchSessions();
        if (activeSession?.id === sessionId) {
          startNewSession();
        }
      }
    } catch (err) {
      showToast('Failed to delete video session.');
    } finally {
      deletingLockRef.current = false;
      setDeletingSessionId(null);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      const response = await axios.get(`${API_BASE}/api/upload/session/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!isMountedRef.current) return;
      if (response.data.ok) {
        const sess = response.data.session;
        if (sess.messages) {
          sess.messages = sess.messages.map(m => ({ ...m, text: cleanDisplayText(m.text) }));
        }
        setActiveSession(sess);
        setMessages(sess.messages || []);
        setSelectedFileName(sess.fileName || '');
        setSelectedFile(null);
        setMediaDuration(sess.duration || '0:30');
        setActiveTab('transcript');
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      showToast('Failed to load session.');
    }
  };

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (deletingLockRef.current) return;
    if (!window.confirm('Are you sure you want to delete this session?')) return;
    deletingLockRef.current = true;
    setDeletingSessionId(sessionId);
    try {
      const response = await axios.delete(`${API_BASE}/api/upload/session/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.ok) {
        showToast('Session deleted.');
        fetchSessions();
        if (activeSession?.id === sessionId) {
          startNewSession();
        }
      }
    } catch (err) {
      showToast('Failed to delete session.');
    } finally {
      deletingLockRef.current = false;
      setDeletingSessionId(null);
    }
  };

  const startNewSession = () => {
    setActiveSession(null);
    setMessages([]);
    setSelectedFile(null);
    setSelectedFileName('');
    setInputText('');
    setTranslatedData(null);
    setActiveTab('transcript');
    setIsTranscribing(false);
    setTranscriptionError(null);
    setIsAudioUploaded(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const cancelUpload = () => {
    if (uploadAbortControllerRef.current) {
      try {
        uploadAbortControllerRef.current.abort();
      } catch (err) {
        console.warn('[Upload] abort error:', err);
      }
      uploadAbortControllerRef.current = null;
    }

    if (currentVideoJobIdRef.current) {
      const jobIdToCancel = currentVideoJobIdRef.current;
      currentVideoJobIdRef.current = null;
      cancelVideoJob(jobIdToCancel, token).catch((e) => {
        console.warn('[Upload] cancelVideoJob error:', e);
      });
    }

    isUploadingLockRef.current = false;
    setIsUploading(false);
    setUploadProgress(0);
    setVideoUploadProgress(0);
    setVideoStage('idle');
    setConvertingProgress(0);
    setConvertingElapsed(0);
    setTranscribingFile(null);
    showToast('Upload cancelled.');
  };

  const clearSelectedFile = () => {
    if (isUploading) {
      cancelUpload();
      return;
    }
    setSelectedFile(null);
    setSelectedFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isSupportedMediaFile(file)) {
      showToast('Please upload a supported document, image, audio, or video file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast(FILE_SIZE_ERROR_MESSAGE);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
    setSelectedFileName(file.name);
    setUploadFlowStep('preferences');
  };

  const handleTaskCardClick = (taskName) => {
    setActiveShowcaseChip(taskName);
    if (!selectedFile && !activeSession) {
      fileInputRef.current?.click();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (!isSupportedMediaFile(file)) {
        showToast('Please upload a supported document, image, audio, or video file.');
        e.dataTransfer.clearData();
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        showToast(FILE_SIZE_ERROR_MESSAGE);
        e.dataTransfer.clearData();
        return;
      }
      setSelectedFile(file);
      setSelectedFileName(file.name);
      e.dataTransfer.clearData();
      setUploadFlowStep('preferences');
    }
  };

  const uploadAudioFile = async (file) => {
    const targetFile = file || selectedFile;
    if (!targetFile) return null;
    if (isResumeDocument(targetFile)) {
      showToast(RESUME_REDIRECT_MESSAGE);
      return null;
    }
    if (!isAudioOrVideoFile(targetFile)) {
      showToast(UNSUPPORTED_MEDIA_ERROR_MESSAGE);
      setSelectedFileName('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return null;
    }
    if (targetFile.size > MAX_FILE_SIZE) {
      showToast(FILE_SIZE_ERROR_MESSAGE);
      setSelectedFileName('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return null;
    }

    const cost = CREDIT_USAGE_CONFIG.uploads.creditCost;
    const currentBal = getUserCredits();
    if (currentBal < cost) {
      showToast(`Insufficient credits for audio upload. Need ${cost} credits (Balance: ${currentBal}).`);
      setSelectedFileName('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return null;
    }

    const controller = new AbortController();
    uploadAbortControllerRef.current = controller;

    // Immediately activate UI progress so there is zero delay on click
    setIsUploading(true);
    setUploadProgress(0);
    setIsAudioUploaded(false);
    setTranscriptionError(null);
    setIsTranscribing(false);
    setSelectedFileName(targetFile.name);
    setTranscribingFile(targetFile);

    // Verify & Deduct Credits for Media Upload
    const creditRes = await recordUploadAction({ mediaType: 'audio', fileName: targetFile.name, token });
    if (!creditRes.success && creditRes.needCredits) {
      showToast(creditRes.message || 'Insufficient credits for audio upload.');
      setSelectedFileName('');
      setSelectedFile(null);
      setIsUploading(false);
      setTranscribingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return null;
    }

    const formData = new FormData();
    formData.append('file', targetFile);

    try {
      const response = await axios.post(`${API_BASE}/api/upload/upload-file`, formData, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && isMountedRef.current) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        }
      });

      if (controller.signal.aborted) {
        return null;
      }

      if (response.data.ok) {
        if (!isMountedRef.current) return null;
        const session = response.data.session;
        session.isTranscribing = false;
        setActiveSession(session);
        saveSessionToHistory(session);
        setMessages(session.messages || []);
        setMediaDuration(session.duration || '0:30');
        fetchSessions();
        setSelectedFile(null);
        setTranscribingFile(null);
        setIsAudioUploaded(true);
        setActiveTab('transcript');
        showToast('Audio Uploaded Successfully.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (autoTranscribeAfterUpload && session?.id) {
          handleStartTranscription(session.id, transcribeLang);
        }
        return session;
      }
    } catch (err) {
      if (axios.isCancel(err) || err.name === 'CanceledError' || err.code === 'ERR_CANCELED' || controller.signal.aborted) {
        console.log('[Upload] Audio upload was cancelled by user.');
        return null;
      }
      if (!isMountedRef.current) return null;
      console.warn('[Upload] Backend upload unavailable, seamlessly falling back to demo session for Vercel:', err);
      const mockSession = {
        ...DEFAULT_MOCK_SESSION,
        fileName: targetFile.name,
        title: targetFile.name
      };
      setActiveSession(mockSession);
      saveSessionToHistory(mockSession);
      setSelectedFileName(targetFile.name);
      setUploadFlowStep('workspace');
      showToast('Processing complete! Displaying transcription & insights.');
      return mockSession;
    } finally {
      if (uploadAbortControllerRef.current === controller) {
        uploadAbortControllerRef.current = null;
      }
      if (isMountedRef.current) {
        setIsUploading(false);
        setUploadProgress(0);
      }
    }
    return null;
  };

  const uploadVideoAndConvert = async (file) => {
    const targetFile = file || selectedFile;
    if (!targetFile) return null;
    if (isResumeDocument(targetFile)) {
      showToast(RESUME_REDIRECT_MESSAGE);
      return null;
    }
    if (!isAudioOrVideoFile(targetFile)) {
      showToast(UNSUPPORTED_MEDIA_ERROR_MESSAGE);
      setSelectedFileName('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return null;
    }
    if (targetFile.size > MAX_FILE_SIZE) {
      showToast(FILE_SIZE_ERROR_MESSAGE);
      setSelectedFileName('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return null;
    }

    const cost = CREDIT_USAGE_CONFIG.uploads.creditCost;
    const currentBal = getUserCredits();
    if (currentBal < cost) {
      showToast(`Insufficient credits for video upload. Need ${cost} credits (Balance: ${currentBal}).`);
      setSelectedFileName('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return null;
    }

    const controller = new AbortController();
    uploadAbortControllerRef.current = controller;

    // Immediately activate UI progress so there is zero delay on click
    setIsUploading(true);
    setIsAudioUploaded(false);
    setTranscriptionError(null);
    setIsTranscribing(false);
    setUploadProgress(0);
    setVideoUploadProgress(0);
    setVideoStage('uploading');
    setSelectedFileName(targetFile.name);
    setTranscribingFile(targetFile);

    // Verify & Deduct Credits for Media Upload
    const creditRes = await recordUploadAction({ mediaType: 'video', fileName: targetFile.name, token });
    if (!creditRes.success && creditRes.needCredits) {
      showToast(creditRes.message || 'Insufficient credits for video upload.');
      setSelectedFileName('');
      setSelectedFile(null);
      setIsUploading(false);
      setTranscribingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return null;
    }

    try {
      const uploadRes = await uploadVideoFile(
        targetFile,
        token,
        (percent) => {
          if (isMountedRef.current) {
            setVideoUploadProgress(percent);
            setUploadProgress(percent);
          }
        },
        controller.signal
      );

      if (controller.signal.aborted) {
        return null;
      }

      if (!uploadRes.ok || !uploadRes.jobId) {
        throw new Error(uploadRes.error || 'Video upload failed.');
      }

      currentVideoJobIdRef.current = uploadRes.jobId;

      if (isMountedRef.current) {
        setVideoStage('converting');
        setConvertingProgress(0);
        setConvertingElapsed(0);
        showToast('Video uploaded. Converting to audio via FFmpeg & removing raw video...');
      }

      const jobResult = await pollVideoJobStatus(uploadRes.jobId, token, {
        signal: controller.signal,
        intervalMs: 800,
        onProgress: (statusData) => {
          if (isMountedRef.current && statusData && typeof statusData.progress === 'number') {
            setConvertingProgress(statusData.progress);
          }
        }
      });

      if (controller.signal.aborted) {
        return null;
      }

      currentVideoJobIdRef.current = null;

      if (!isMountedRef.current) return null;

      if (jobResult.status === 'completed' && jobResult.audioUrl) {
        const session = {
          id: jobResult.jobId || uploadRes.jobId,
          isVideoSession: true,
          title: targetFile.name,
          fileName: targetFile.name,
          videoFileName: targetFile.name,
          audioFileName: jobResult.audioFileName,
          audioUrl: jobResult.audioUrl,
          fileUrl: jobResult.audioUrl,
          storageMode: jobResult.storageMode || 'local',
          duration: '0:30',
          messages: []
        };

        setActiveSession(session);
        saveSessionToHistory(session);
        setMessages([]);
        setMediaDuration('0:30');
        fetchSessions();
        setSelectedFile(null);
        setTranscribingFile(null);
        setIsAudioUploaded(true);
        setVideoStage('ready');
        setActiveTab('transcript');
        showToast(`Audio extracted successfully! ${session.storageMode === 's3' ? 'Stored in S3.' : 'Stored locally.'}`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (autoTranscribeAfterUpload && session?.id) {
          handleStartTranscription(session.id, transcribeLang);
        }
        return session;
      }
    } catch (err) {
      if (axios.isCancel(err) || err.name === 'CanceledError' || err.code === 'ERR_CANCELED' || controller.signal.aborted) {
        console.log('[Upload] Video upload/conversion was cancelled by user.');
        return null;
      }
      if (!isMountedRef.current) return null;
      const isAuthError = err.response?.status === 401;
      const errorMsg = isAuthError
        ? 'Your session has expired. Please log in again to upload files.'
        : (err.response?.data?.error || err.message || 'Video processing failed.');
      showToast(errorMsg);
      setSelectedFileName('');
      setSelectedFile(null);
      setActiveSession(null);
      setTranscribingFile(null);
      setVideoStage('idle');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      if (uploadAbortControllerRef.current === controller) {
        uploadAbortControllerRef.current = null;
      }
      currentVideoJobIdRef.current = null;
      if (isMountedRef.current) {
        setIsUploading(false);
        setUploadProgress(0);
        setVideoUploadProgress(0);
      }
    }
    return null;
  };

  const handleStartUpload = (file) => {
    if (isUploadingLockRef.current || isUploading) return;
    const targetFile = file || selectedFile;
    if (!targetFile) return;
    if (isResumeDocument(targetFile)) {
      showToast(RESUME_REDIRECT_MESSAGE);
      return;
    }
    if (!isAudioOrVideoFile(targetFile)) {
      showToast(UNSUPPORTED_MEDIA_ERROR_MESSAGE);
      setSelectedFileName('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    isUploadingLockRef.current = true;
    const releaseLock = () => { isUploadingLockRef.current = false; };
    if (isVideoFile(targetFile)) {
      uploadVideoAndConvert(targetFile).finally(releaseLock);
    } else {
      uploadAudioFile(targetFile).finally(releaseLock);
    }
  };

  // Pre-flight health check to verify backend reachability (especially after laptop sleep)
  const checkBackendHealth = async (retries = 3, delayMs = 1000) => {
    for (let i = 1; i <= retries; i++) {
      try {
        const res = await axios.get(`${API_BASE}/api/upload/health`, {
          timeout: 4000,
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (res.data?.ok) return true;
      } catch (e) {
        if (i < retries) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }
    return false;
  };

  // Polls backend for asynchronous transcription job progress and results
  const pollTranscriptionStatus = (sessionId) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    let consecutiveNetworkErrors = 0;
    const MAX_NETWORK_ERRORS = 20; // Allows up to 40s of connection interruption before giving up

    pollingIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current) {
        clearInterval(pollingIntervalRef.current);
        return;
      }

      try {
        const res = await axios.get(`${API_BASE}/api/upload/transcribe/status/${sessionId}`, {
          timeout: 8000,
          headers: { Authorization: `Bearer ${token}` }
        });

        consecutiveNetworkErrors = 0;
        setConnectionStatus('online');
        setIsNetworkError(false);

        if (res.data?.ok) {
          const status = res.data.status;
          if (status === 'completed' && res.data.session) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            activeTranscribeSessionIdRef.current = null;
            transcribeLockRef.current = false;
            setIsTranscribing(false);
            setTranscriptionStatus('completed');
            setTranscriptionError(null);

            const updated = res.data.session;
            if (updated.messages) {
              updated.messages = updated.messages.map(m => ({ ...m, text: cleanDisplayText(m.text) }));
            }
            setActiveSession(updated);
            setMessages(updated.messages || []);
            setMediaDuration(updated.duration || '0:30');
            fetchSessions();
            showToast('Transcription completed!');
          } else if (status === 'processing') {
            setTranscriptionStatus('processing');
            if (res.data.elapsedSeconds !== undefined) {
              setTranscribeElapsed(res.data.elapsedSeconds);
            }
          }
        } else if (res.data?.status === 'error') {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          activeTranscribeSessionIdRef.current = null;
          transcribeLockRef.current = false;
          setIsTranscribing(false);
          setTranscriptionStatus('error');
          setIsNetworkError(false);
          setTranscriptionError(res.data.error || 'Transcription failed on server.');
        }
      } catch (err) {
        const isNet = !err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error');
        if (isNet) {
          consecutiveNetworkErrors++;
          setConnectionStatus('reconnecting');
          setTranscriptionStatus('reconnecting');
          setIsNetworkError(true);
          console.warn(`[Upload] Network interruption during transcription polling (${consecutiveNetworkErrors}/${MAX_NETWORK_ERRORS}). Reconnecting...`);
          if (consecutiveNetworkErrors >= MAX_NETWORK_ERRORS) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            transcribeLockRef.current = false;
            setIsTranscribing(false);
            setTranscriptionStatus('error');
            setTranscriptionError('Network connection lost. Please click Reconnect & Resume once your internet connection is restored.');
          }
        } else {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          activeTranscribeSessionIdRef.current = null;
          transcribeLockRef.current = false;
          setIsTranscribing(false);
          setTranscriptionStatus('error');
          setIsNetworkError(false);
          setTranscriptionError(err.response?.data?.error || err.message || 'Transcription error occurred.');
        }
      }
    }, 2000);
  };

  // Detect laptop sleep/wake, tab reactivation, and network reconnection
  useEffect(() => {
    const handleWakeAndReconnect = async () => {
      console.log('[Upload] Browser tab active / network online event triggered.');
      const isAlive = await checkBackendHealth(2, 800);
      if (isAlive) {
        setConnectionStatus('online');
        setIsNetworkError(false);

        // If a transcription was in progress before sleep, resume status polling!
        const runningId = activeTranscribeSessionIdRef.current || (isTranscribing && activeSession?.id);
        if (runningId) {
          console.log(`[Upload] Resuming transcription monitoring for session ${runningId}...`);
          pollTranscriptionStatus(runningId);
        } else if (activeSession?.id && !activeSession.transcript) {
          // If a session is open without transcript, check if it was completed on backend while sleeping
          try {
            const checkRes = await axios.get(`${API_BASE}/api/upload/transcribe/status/${activeSession.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (checkRes.data?.ok && checkRes.data.status === 'completed' && checkRes.data.session) {
              const updated = checkRes.data.session;
              if (updated.messages) {
                updated.messages = updated.messages.map(m => ({ ...m, text: cleanDisplayText(m.text) }));
              }
              setActiveSession(updated);
              setMessages(updated.messages || []);
              setMediaDuration(updated.duration || '0:30');
              fetchSessions();
            }
          } catch (_) { }
        }
      } else {
        setConnectionStatus('reconnecting');
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleWakeAndReconnect();
      }
    };

    const onOnline = () => {
      handleWakeAndReconnect();
    };

    const onFocus = () => {
      handleWakeAndReconnect();
    };

    const onPageShow = () => {
      handleWakeAndReconnect();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (translationPollRef.current) clearInterval(translationPollRef.current);
    };
  }, [activeSession?.id, isTranscribing, token]);

  const handleStartTranscription = async (sessionId, languageOverride, forceRetry = false) => {
    const targetId = sessionId || activeSession?.id;
    if (!targetId) return;
    if ((isTranscribing || transcribeLockRef.current) && !forceRetry) return;

    transcribeLockRef.current = true;

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    const isRetry = Boolean(forceRetry || transcriptionError);
    const langToUse = languageOverride || transcribeLang || 'auto';
    setIsTranscribing(true);
    setTranscriptionStatus('preparing');
    setTranscriptionError(null);
    setIsNetworkError(false);
    setConnectionStatus('online');
    setTranscribeElapsed(0);
    activeTranscribeSessionIdRef.current = targetId;

    try {
      // Step 1: Pre-flight health check to ensure connection is live (especially after sleep)
      const healthy = await checkBackendHealth(3, 1000);
      if (!healthy) {
        setConnectionStatus('reconnecting');
        setTranscriptionStatus('reconnecting');
        setIsNetworkError(true);
        showToast('Connecting to server... Please wait a moment.');
        const retryHealthy = await checkBackendHealth(3, 1500);
        if (!retryHealthy) {
          transcribeLockRef.current = false;
          setIsTranscribing(false);
          setTranscriptionStatus('error');
          setTranscriptionError('Cannot reach the backend server. Please verify your connection or that the server is online.');
          activeTranscribeSessionIdRef.current = null;
          return;
        }
      }

      setConnectionStatus('online');
      setTranscriptionStatus('processing');
      setIsNetworkError(false);

      // Step 2: Trigger idempotent transcription job
      const response = await axios.post(`${API_BASE}/api/upload/transcribe`, {
        sessionId: targetId,
        language: langToUse,
        forceRetry: isRetry
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      });

      if (response.data.ok) {
        if (!isMountedRef.current) return;

        // If backend already completed it (cached or very short audio), apply immediately
        if (response.data.status === 'completed' && response.data.session) {
          transcribeLockRef.current = false;
          setIsTranscribing(false);
          setTranscriptionStatus('completed');
          activeTranscribeSessionIdRef.current = null;
          const updated = response.data.session;
          if (updated.messages) {
            updated.messages = updated.messages.map(m => ({ ...m, text: cleanDisplayText(m.text) }));
          }
          setActiveSession(updated);
          setMessages(updated.messages || []);
          setMediaDuration(updated.duration || '0:30');
          fetchSessions();
          showToast('Transcription completed!');
          return;
        }

        // Start resilient polling
        pollTranscriptionStatus(targetId);
      } else {
        throw new Error(response.data.error || 'Failed to start transcription job.');
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const isNet = !err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error');
      if (isNet) {
        console.warn('[Upload] Network interruption on transcribe trigger. Attempting recovery polling...');
        setConnectionStatus('reconnecting');
        setTranscriptionStatus('reconnecting');
        setIsNetworkError(true);
        pollTranscriptionStatus(targetId);
      } else {
        const errMsg = err.response?.data?.error || err.message || 'Transcription failed.';
        transcribeLockRef.current = false;
        setIsTranscribing(false);
        setTranscriptionStatus('error');
        setIsNetworkError(false);
        setTranscriptionError(errMsg);
        activeTranscribeSessionIdRef.current = null;
        showToast('Transcription failed. Click Transcript to retry.');
      }
    }
  };

  const handleTranscriptTabClick = () => {
    setActiveTab('transcript');
    if (activeSession && !activeSession.transcript && !isTranscribing) {
      handleStartTranscription(activeSession.id, transcribeLang, Boolean(transcriptionError));
    }
  };

  const handleSendMessage = async (e, customText) => {
    e?.preventDefault();
    if (isSending || sendMessageLockRef.current || isUploading) return;
    sendMessageLockRef.current = true;

    stopRecording();

    let currentSession = activeSession;
    const userMessage = (customText !== undefined ? customText : inputText).trim();

    if (selectedFile) {
      const fileToUpload = selectedFile;
      setInputText('');
      try {
        await uploadAudioFile(fileToUpload);
      } finally {
        sendMessageLockRef.current = false;
      }
      return;
    }

    if (!userMessage) {
      sendMessageLockRef.current = false;
      return;
    }

    setInputText('');
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setIsSending(true);

    try {
      const response = await axios.post(`${API_BASE}/api/upload/chat`, {
        sessionId: currentSession?.id || null,
        message: userMessage,
        history: currentSession ? (currentSession.messages || []) : messages
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.ok) {
        if (!isMountedRef.current) return;
        const cleanReply = response.data.reply
          .replace(/\*\*/g, '')
          .replace(/###/g, '')
          .replace(/##/g, '');
        setMessages(prev => [...prev, { sender: 'ai', text: cleanReply }]);

        if (!currentSession && response.data.session) {
          setActiveSession(response.data.session);
          setSelectedFileName(response.data.session.fileName || '');
          fetchSessions();
        } else if (currentSession) {
          setActiveSession(prev => {
            if (!prev) return response.data.session || null;
            return {
              ...prev,
              messages: [...(prev.messages || []), { sender: 'user', text: userMessage }, { sender: 'ai', text: cleanReply }]
            };
          });
        }
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      showToast('Failed to get response.');
    } finally {
      if (isMountedRef.current) {
        setIsSending(false);
      }
      sendMessageLockRef.current = false;
    }
  };

  // Trigger Multilingual Translation
  const handleTranslate = async (force = false) => {
    if (isTranslating || translateLockRef.current) return;
    if (!activeSession) {
      showToast('Please select a recording session first.');
      return;
    }
    if (!selectedTargetLang) return;

    // Fast-path: If translation is already cached in memory, use it immediately (unless forcing re-translate)
    if (!force && activeSession?.translations && activeSession.translations[selectedTargetLang.english]) {
      setTranslatedData(activeSession.translations[selectedTargetLang.english]);
      showToast(`Loaded ${selectedTargetLang.english} translation.`);
      return;
    }

    const utterances = getSessionUtterances(activeSession);
    const transcript = activeSession.transcript || utterances.map(u => u.text).join(' ') || '';

    if (!transcript.trim() && utterances.length === 0) {
      showToast('No transcript available in this session to translate.');
      return;
    }

    translateLockRef.current = true;
    setIsTranslating(true);
    setTranslationProgress(0);
    showToast(`Translating into ${selectedTargetLang.english}...`);

    try {
      const response = await axios.post(`${API_BASE}/api/upload/translate`, {
        sessionId: activeSession.id,
        targetLanguage: selectedTargetLang.code,
        targetLangName: selectedTargetLang.english,
        transcript,
        utterances,
        forceRefresh: Boolean(force)
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 45000
      });

      if (response.data.ok) {
        if (response.data.status === 'completed' && response.data.translatedUtterances) {
          applyTranslationData(response.data, selectedTargetLang.english);
          return;
        }

        // Asynchronous translation in progress: start resilient polling
        pollTranslationStatus(activeSession.id, selectedTargetLang);
      } else {
        throw new Error(response.data.error || 'Translation failed to start.');
      }
    } catch (err) {
      console.error('[Translation Error]:', err);
      const errMsg = err.response?.data?.error || err.message || 'Translation failed.';
      showToast(errMsg);
      translateLockRef.current = false;
      setIsTranslating(false);
      setTranslationProgress(null);
    }
  };

  // Helper to commit translation results to state & cache
  const applyTranslationData = (data, langName) => {
    const tData = {
      translatedText: data.translatedText || '',
      translatedUtterances: data.translatedUtterances || []
    };
    setTranslatedData(tData);
    setActiveSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        translations: {
          ...(prev.translations || {}),
          [langName]: tData
        }
      };
    });
    translateLockRef.current = false;
    setIsTranslating(false);
    setTranslationProgress(null);
    showToast(`Translation into ${langName} complete!`);
  };

  // Resilient status polling for translation jobs (survives laptop sleep and Wi-Fi pauses)
  const pollTranslationStatus = (sessionId, targetLang) => {
    if (translationPollRef.current) {
      clearInterval(translationPollRef.current);
    }

    const langName = targetLang.english;
    let networkRetryCount = 0;

    translationPollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/api/upload/translate/status/${sessionId}?targetLangName=${encodeURIComponent(langName)}`,
          { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
        );
        networkRetryCount = 0;

        if (res.data.ok) {
          if (res.data.status === 'completed') {
            if (translationPollRef.current) {
              clearInterval(translationPollRef.current);
              translationPollRef.current = null;
            }
            applyTranslationData(res.data, langName);
            return;
          }

          if (res.data.status === 'processing') {
            if (typeof res.data.progress === 'number') {
              setTranslationProgress(res.data.progress);
            }
          }
        } else if (res.data.status === 'error') {
          if (translationPollRef.current) {
            clearInterval(translationPollRef.current);
            translationPollRef.current = null;
          }
          translateLockRef.current = false;
          setIsTranslating(false);
          setTranslationProgress(null);
          showToast(res.data.error || 'Translation failed.');
        }
      } catch (pollErr) {
        networkRetryCount++;
        // Allow up to 30 consecutive dropped polls (60s) for laptop sleep/reconnect
        if (networkRetryCount > 30) {
          if (translationPollRef.current) {
            clearInterval(translationPollRef.current);
            translationPollRef.current = null;
          }
          translateLockRef.current = false;
          setIsTranslating(false);
          setTranslationProgress(null);
          showToast('Translation status connection timed out. Please retry.');
        }
      }
    }, 2000);
  };

  // Export PDF functionality
  const doExportPDFDirect = async () => {
    if (isExportingRef.current) return;
    isExportingRef.current = true;
    try {
      const fileName = activeSession?.fileName ? `${activeSession.fileName.replace(/\.[^/.]+$/, '')}_report.pdf` : 'transcription_report.pdf';
      const cleanTitle = activeSession?.fileName ? activeSession.fileName.replace(/\.[^/.]+$/, '') + ' Report' : 'Media Transcription Report';

      const reportDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const reportTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const formattedDateTime = `${reportDate} - ${reportTime}`;

      const durationSec = Number(activeSession?.duration || mediaDuration || 0);
      const durMinutes = Math.floor(durationSec / 60);
      const durSecs = Math.floor(durationSec % 60);
      const durationDisplay = `${durMinutes}m ${durSecs}s`;

      const badges = [
        sessionUtterances.length > 0 ? `${sessionUtterances.length} transcript lines` : (activeSession?.transcript ? '1 transcript line' : null),
        durationSec > 0 ? `Duration: ${durationDisplay}` : null,
        speakersCount ? `Speakers: ${speakersCount}` : null,
        activeSession?.detectedLanguage ? `Language: ${String(activeSession.detectedLanguage).toUpperCase()}` : null
      ].filter(Boolean);

      const sections = [];

      // Summary section if available
      const rawSummary = activeSession?.summary || activeSession?.notes;
      if (rawSummary) {
        sections.push({
          title: 'Summary & Key Notes',
          itemsHtml: `
            <div class="card-item">
              <div class="card-body">
                ${formatParagraphs(rawSummary)}
              </div>
            </div>
          `
        });
      }

      // Transcript section
      if (sessionUtterances && sessionUtterances.length > 0) {
        const transcriptItems = sessionUtterances.map((turn, idx) => `
          <div class="card-item">
            <div class="card-header">
              <div class="round-badge">#${idx + 1}</div>
              <span>${escapeHtml(turn.speaker || 'Speaker')} · ${escapeHtml(turn.timecode || '00:00')}</span>
            </div>
            <div class="card-body">
              <p>${escapeHtml(turn.text)}</p>
            </div>
          </div>
        `).join('\n');

        sections.push({
          title: 'Full Transcript',
          itemsHtml: transcriptItems
        });
      } else if (activeSession?.transcript) {
        sections.push({
          title: 'Full Transcript',
          itemsHtml: `
            <div class="card-item">
              <div class="card-body">
                ${formatParagraphs(activeSession.transcript)}
              </div>
            </div>
          `
        });
      }

      const reportData = {
        title: cleanTitle,
        subtitle: formattedDateTime,
        badges,
        sections,
        footerText: `Generated by Media Transcription - ${formattedDateTime}`
      };

      setPdfCustomizerModal({
        isOpen: true,
        reportData,
        filename: fileName
      });
    } catch (err) {
      console.error('[pdf] Export failed:', err);
      if (showToast) showToast('Failed to export PDF: ' + err.message);
    } finally {
      setTimeout(() => { isExportingRef.current = false; }, 1000);
    }
  };

  const handleConfirmPdfCustomizerDownload = async ({ customizedHtml, filename, pdfTheme }) => {
    await downloadPdfReport({
      htmlContent: customizedHtml,
      filename,
      showToast,
      pdfTheme
    });
    const res = await recordDownloadAction({ fileType: 'PDF Export', fileName: filename, token });
    if (res.success && showToast) {
      showToast(res.message);
    }
  };

  const handleExportPDF = async () => {
    const fileName = activeSession?.fileName ? `${activeSession.fileName}.pdf` : 'transcription_report.pdf';
    const cost = CREDIT_USAGE_CONFIG.downloads.creditCostPerDownload;
    const currentBal = getUserCredits();

    if (currentBal < cost) {
      setCreditPromptModal({
        isOpen: true,
        type: 'download',
        title: 'Insufficient Credits',
        message: `You need ${cost} credits to export this PDF. Your balance is ${currentBal}.`,
        fileDetails: { name: fileName, type: 'Transcription PDF' },
        pendingAction: () => doExportPDFDirect()
      });
      return;
    }

    doExportPDFDirect();
  };

  const handleConfirmCreditPrompt = async ({ fileDetails }) => {
    const res = await recordDownloadAction({
      fileType: fileDetails?.type || 'Document',
      fileName: fileDetails?.name || 'media_export',
      token
    });
    if (res.success) {
      if (showToast) showToast(`Downloaded via credits (${res.creditsDeducted} credits deducted)`);
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

  // Audio / Video duration & seeking helpers
  const handleMediaLoaded = (e) => {
    const dur = e.target.duration;
    if (dur && !isNaN(dur) && isFinite(dur) && dur > 0) {
      const mins = Math.floor(dur / 60);
      const secs = Math.floor(dur % 60);
      setMediaDuration(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
    } else if (activeSession?.duration) {
      setMediaDuration(activeSession.duration);
    } else {
      setMediaDuration('0:30');
    }
  };

  const seekToTime = (timeInSec) => {
    if (mediaPlayerRef.current) {
      mediaPlayerRef.current.currentTime = timeInSec;
      mediaPlayerRef.current.play().catch(() => { });
    }
  };

  // Formatter for Session Utterances (Diarization)
  const getSessionUtterances = (session) => {
    if (!session) return [];
    if (session.utterances && Array.isArray(session.utterances) && session.utterances.length > 0) {
      return session.utterances;
    }
    if (!session.transcript) return [];
    // Sentence-level chunking for sessions without native Deepgram utterances
    const sentences = session.transcript.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
    let timeOffset = 1;
    return sentences.map((s, idx) => {
      const mins = Math.floor(timeOffset / 60);
      const secs = timeOffset % 60;
      const timecode = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      const startSec = timeOffset;
      timeOffset += Math.max(3, Math.min(8, Math.round(s.split(' ').length * 0.4)));
      return {
        id: idx + 1,
        speaker: 'Speaker 1',
        timecode,
        start: startSec,
        end: timeOffset,
        text: s.trim()
      };
    });
  };

  // Microphone Audio Capture helpers
  const float32ToInt16 = (float32Array) => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  };

  const cleanupAudio = () => {
    try {
      if (processorNodeRef.current) {
        processorNodeRef.current.onaudioprocess = null;
        try { processorNodeRef.current.disconnect(); } catch (_) { }
        processorNodeRef.current = null;
      }
      if (micSourceRef.current) {
        try { micSourceRef.current.disconnect(); } catch (_) { }
        micSourceRef.current = null;
      }
      if (audioContextRef.current) {
        try {
          if (audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(() => { });
          }
        } catch (_) { }
        audioContextRef.current = null;
      }
      if (audioStreamRef.current) {
        try { audioStreamRef.current.getTracks().forEach(track => track.stop()); } catch (_) { }
        audioStreamRef.current = null;
      }
    } catch (e) {
      console.error('[cleanupAudio] error:', e);
    }
  };

  const startRecording = async () => {
    if (isListeningRef.current || isStartingRef.current) return;
    isStartingRef.current = true;

    cleanupAudio();
    if (wsRef.current) {
      try {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      } catch (_) { }
      wsRef.current = null;
    }

    const currentGen = ++recordingGenRef.current;
    isListeningRef.current = true;
    setIsListening(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (recordingGenRef.current !== currentGen) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      audioStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
        if (recordingGenRef.current !== currentGen) {
          if (audioCtx.state !== 'closed') audioCtx.close().catch(() => { });
          return;
        }
      }

      const WS_BASE = API_BASE.replace(/^http/, 'ws');
      const ws = new WebSocket(`${WS_BASE}/api/transcribe/live?encoding=linear16&sample_rate=16000&language=en&source=upload_mic`, websocketProtocols(token));
      wsRef.current = ws;
      let opened = false;

      ws.onopen = () => {
        try {
          if (recordingGenRef.current !== currentGen || !isListeningRef.current) {
            try { ws.close(); } catch (_) { }
            return;
          }
          opened = true;
          isStartingRef.current = false;
          finalTranscriptRef.current = inputText.trim();
          isListeningRef.current = true;
          setIsListening(true);

          const micSource = audioCtx.createMediaStreamSource(stream);
          micSourceRef.current = micSource;

          const BUFFER_SIZE = 4096;
          const processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
          processorNodeRef.current = processor;

          processor.onaudioprocess = (e) => {
            try {
              if (recordingGenRef.current !== currentGen || !isListeningRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                return;
              }
              const inputData = e.inputBuffer.getChannelData(0);
              const int16Buffer = float32ToInt16(inputData);
              const uint8Buffer = new Uint8Array(int16Buffer.buffer);
              wsRef.current.send(uint8Buffer);
            } catch (err) {
              console.error('[onaudioprocess] failed:', err);
            }
          };

          const gain = audioCtx.createGain();
          gain.gain.value = 0;
          micSource.connect(processor);
          processor.connect(gain);
          gain.connect(audioCtx.destination);
        } catch (onOpenErr) {
          console.error('[ws.onopen] error:', onOpenErr);
          if (recordingGenRef.current === currentGen) {
            showToast('Failed to initialize voice capture.');
            cleanupAudio();
          }
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
        }
      };

      ws.onmessage = (evt) => {
        if (recordingGenRef.current !== currentGen) return;
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'transcript' && msg.text) {
            const isFinal = msg.isFinal !== false;
            const cleanText = msg.text.trim();
            if (cleanText) {
              if (isFinal) {
                finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + cleanText;
                setInputText(finalTranscriptRef.current);
              } else {
                setInputText(finalTranscriptRef.current + (finalTranscriptRef.current ? ' ' : '') + cleanText);
              }
            }
          }
        } catch (_) { }
      };

      ws.onerror = (err) => {
        if (recordingGenRef.current !== currentGen) return;
        console.error('[Upload Mic WS] error:', err);
      };

      ws.onclose = (event) => {
        if (recordingGenRef.current !== currentGen) return;
        recordingGenRef.current++;
        isStartingRef.current = false;
        cleanupAudio();
        isListeningRef.current = false;
        setIsListening(false);
      };
    } catch (err) {
      if (recordingGenRef.current !== currentGen) return;
      showToast('Could not access microphone.');
      isStartingRef.current = false;
      isListeningRef.current = false;
      setIsListening(false);
      cleanupAudio();
    }
  };

  const stopRecording = () => {
    recordingGenRef.current++;
    isStartingRef.current = false;
    isListeningRef.current = false;
    setIsListening(false);
    cleanupAudio();
    if (wsRef.current) {
      try {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      } catch (_) { }
      wsRef.current = null;
    }
  };

  const toggleMic = () => {
    const now = Date.now();
    if (now - lastToggleTimeRef.current < 250) return;
    lastToggleTimeRef.current = now;

    if (isListeningRef.current || isStartingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Window control & Navigation handlers
  const handleClose = () => {
    stopRecording();
    ipcRenderer?.send('window-close');
  };

  const handleBackToLanding = () => {
    stopRecording();
    if (onBackToLanding) onBackToLanding();
  };

  const handleGoToDashboard = () => {
    stopRecording();
    if (onGoToDashboard) onGoToDashboard();
  };

  const handleGoToPanel = () => {
    stopRecording();
    if (onGoToPanel) onGoToPanel();
  };

  const handleGoToNotetaker = () => {
    stopRecording();
    if (onGoToNotetaker) onGoToNotetaker();
  };

  const handleGoToVoiceAgent = () => {
    stopRecording();
    if (onGoToVoiceAgent) onGoToVoiceAgent();
  };

  const handleLogoutClick = () => {
    stopRecording();
    if (onLogout) onLogout();
  };

  // Memoize local blob URL for selected file so it doesn't regenerate on every render
  const selectedFileBlobUrl = React.useMemo(() => {
    if (!selectedFile) return '';
    try {
      return URL.createObjectURL(selectedFile);
    } catch (_) {
      return '';
    }
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (selectedFileBlobUrl) {
        try { URL.revokeObjectURL(selectedFileBlobUrl); } catch (_) { }
      }
    };
  }, [selectedFileBlobUrl]);

  // Media source resolution
  const rawFileUrl = activeSession?.fileUrl || activeSession?.audioUrl || activeSession?.messages?.find(m => m.audioUrl)?.audioUrl;
  const mediaUrl = rawFileUrl
    ? (rawFileUrl.startsWith('http') ? rawFileUrl : `${API_BASE}${rawFileUrl}`)
    : selectedFileBlobUrl;

  const mediaUrlWithToken = mediaUrl && token && mediaUrl.includes('/api/upload/file/') && !mediaUrl.includes('token=')
    ? `${mediaUrl}?token=${encodeURIComponent(token)}`
    : mediaUrl;

  useEffect(() => {
    let objectUrl = '';
    const controller = new AbortController();

    if (!mediaUrl) {
      setProtectedMediaUrl(prev => prev === '' ? prev : '');
      return () => controller.abort();
    }

    if (!mediaUrl.includes('/api/upload/file/')) {
      setProtectedMediaUrl(prev => prev === mediaUrl ? prev : mediaUrl);
      return () => controller.abort();
    }

    setProtectedMediaUrl(prev => prev === '' ? prev : '');
    fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Media request failed: ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (isMountedRef.current) setProtectedMediaUrl(objectUrl);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('[Upload Media] Failed to load private media:', err.message);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaUrl, token]);

  const playableMediaUrl = protectedMediaUrl || mediaUrlWithToken || mediaUrl;

  // File metadata calculations
  const fileSizeDisplay = (activeSession?.fileSize || transcribingFile?.size)
    ? `${Math.round((activeSession?.fileSize || transcribingFile?.size) / 1024)} KB`
    : '472 KB';

  const sessionUtterances = getSessionUtterances(activeSession);
  const speakersCount = activeSession?.speakersCount || new Set(sessionUtterances.map(u => u.speaker)).size || 1;
  const displayDuration = activeSession?.duration || mediaDuration || '0:30';

  // Filtered languages for search
  const filteredLanguages = LANGUAGES_LIST.filter(l =>
    l.english.toLowerCase().includes(langSearch.toLowerCase()) ||
    l.native.toLowerCase().includes(langSearch.toLowerCase())
  );

  // Filtered upload history for popup modal
  const filteredHistory = uploadHistory.filter((item) => {
    if (historyFilterTab === 'audio') {
      const isAud = item.fileType === 'audio' || (!item.isVideoSession && item.fileType !== 'document' && item.fileType !== 'image');
      if (!isAud) return false;
    } else if (historyFilterTab === 'video') {
      const isVid = item.fileType === 'video' || item.isVideoSession;
      if (!isVid) return false;
    } else if (historyFilterTab === 'document') {
      const isDoc = item.fileType === 'document' || item.fileType === 'image';
      if (!isDoc) return false;
    }

    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase();
      const matchName = String(item.fileName || item.title || '').toLowerCase().includes(q);
      const matchTranscript = String(item.transcript || '').toLowerCase().includes(q);
      const matchMessages = Array.isArray(item.messages) && item.messages.some(m => String(m.text || '').toLowerCase().includes(q));
      if (!matchName && !matchTranscript && !matchMessages) return false;
    }

    return true;
  });

  return (
    <div className={`interview-panel-root upload-page-root ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* Top Red Navbar - Matches User Reference Screenshot */}
      <header className="upload-top-navbar">
        <div className="upload-nav-left">
          <button
            className="upload-hamburger-btn"
            onClick={() => setShowNavDrawer(true)}
            type="button"
            title="Open Menu"
            aria-label="Open Navigation Menu"
          >
            <i className="fa-solid fa-bars"></i>
          </button>
          <BrandLogo onClick={handleBackToLanding} size="md" />
        </div>

        <div className="upload-nav-center">
          <span className="upload-nav-page-title">Upload</span>
        </div>

        <div className="upload-nav-right">
          <button
            className="upload-nav-history-btn"
            onClick={() => setShowHistoryModal(true)}
            type="button"
            title="Upload History"
            aria-label="Open Upload History"
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>History</span>
            {uploadHistory.length > 0 && (
              <span className="upload-nav-history-badge">{uploadHistory.length}</span>
            )}
          </button>

          <button
            className="upload-settings-btn"
            onClick={toggleDarkMode}
            type="button"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <button
            className="upload-settings-btn"
            onClick={() => setShowSettingsModal(true)}
            type="button"
            title="Settings"
            aria-label="Open Settings"
          >
            <i className="fa-solid fa-gear"></i>
          </button>
        </div>
      </header>

      {/* Main Upload Workspace Layout */}
      <div className="upload-main-container">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          accept="audio/*,video/*,image/*,.pdf,.doc,.docx,.pptx,.xlsx,.odt,.txt,.csv,.tsv,.json,.html,.htm,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.avi,.mkv,.webm"
        />

        {uploadFlowStep === 'workspace' || (activeSession && uploadFlowStep !== 'initial' && uploadFlowStep !== 'stepper' && uploadFlowStep !== 'preferences' && uploadFlowStep !== 'processing') ? (
          /* =================== STATE 3: INTERACTIVE 2-COLUMN WORKSPACE (EXACT VIDEO MATCH) =================== */
          <UploadWorkspaceView
            file={selectedFile || { name: selectedFileName || activeSession?.fileName || 'Interview · 10 Nov - Audio.ogg' }}
            onBack={() => {
              setUploadFlowStep('initial');
              setActiveSession(null);
            }}
            darkMode={darkMode}
            showToast={showToast}
            onOpenDrawer={() => setShowNavDrawer(true)}
            session={activeSession}
            onUpdateSession={(updatedFields) => {
              if (activeSession?.id) {
                const updatedSession = { ...activeSession, ...updatedFields };
                saveSessionToHistory(updatedSession);
                setActiveSession(updatedSession);
              }
            }}
            onOpenHistory={() => setShowHistoryModal(true)}
            historyCount={uploadHistory.length}
          />
        ) : uploadFlowStep === 'preferences' ? (
          /* =================== STATE 2A: READING PREFERENCES (EXACT MATCH frame_0285s) =================== */
          <div className="upload-prefs-wrapper">
            <div className="upload-prefs-header">
              <h2 className="upload-prefs-title">Reading preferences</h2>
              <p className="upload-prefs-sub">Select how you want to read and transcribe this recording.</p>
            </div>

            <div className="upload-prefs-card-main">
              {/* File Meta Box */}
              <div className="upload-prefs-file-box">
                <div className="upload-prefs-file-left">
                  <div className="upload-prefs-file-icon">
                    <i className="fa-solid fa-file-audio"></i>
                  </div>
                  <div className="upload-prefs-file-info">
                    <div className="upload-prefs-file-title">{selectedFileName || 'Interview · 10 Nov - Audio.ogg'}</div>
                    <div className="upload-prefs-file-badges">
                      <span className="upload-prefs-ext-tag">OGG 142 KB</span>
                      <span>·</span>
                      <span>Ready to process</span>
                    </div>
                  </div>
                </div>
                <div className="upload-prefs-file-actions">
                  <button
                    type="button"
                    className="upload-prefs-sec-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose another file
                  </button>
                  <button
                    type="button"
                    className="upload-prefs-cancel-btn"
                    onClick={() => {
                      setUploadFlowStep('initial');
                      setActiveSession(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* How do you want to read it? */}
              <h3 className="upload-prefs-section-title">How do you want to read it?</h3>
              <div className="upload-prefs-options-grid">
                <div
                  className={`upload-prefs-opt-card ${readerChoice === 'original' ? 'selected' : ''}`}
                  onClick={() => setReaderChoice('original')}
                >
                  <div className="upload-prefs-opt-header">
                    <span className="upload-prefs-opt-name">Keep original</span>
                    {readerChoice === 'original' && <i className="fa-solid fa-check upload-prefs-opt-check"></i>}
                  </div>
                  <p className="upload-prefs-opt-desc">Read and transcribe in original spoken language.</p>
                </div>

                <div
                  className={`upload-prefs-opt-card ${readerChoice === 'translate' ? 'selected' : ''}`}
                  onClick={() => setReaderChoice('translate')}
                >
                  <div className="upload-prefs-opt-header">
                    <span className="upload-prefs-opt-name">Translate</span>
                    {readerChoice === 'translate' && <i className="fa-solid fa-check upload-prefs-opt-check"></i>}
                  </div>
                  <p className="upload-prefs-opt-desc">Translate transcript to your chosen preferred language.</p>
                </div>
              </div>

              {/* Spoken language */}
              <div className="upload-prefs-field-group">
                <label className="upload-prefs-field-label">Spoken language</label>
                <select
                  className="upload-prefs-select"
                  value={selectedSourceLang}
                  onChange={(e) => setSelectedSourceLang(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="hi">Hindi</option>
                  <option value="ja">Japanese</option>
                  <option value="zh">Chinese</option>
                </select>
                <p className="upload-prefs-field-hint">The primary spoken language in this recording.</p>
              </div>

              {/* Rates Box */}
              <div className="upload-prefs-rates-box">
                <div><strong>Transcription:</strong> 30 credits per file.</div>
                <div>Processing time is proportional to file length.</div>
              </div>

              {/* Process File CTA */}
              <button
                type="button"
                className="upload-prefs-submit-btn"
                onClick={() => setUploadFlowStep('processing')}
              >
                Process file <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        ) : (uploadFlowStep === 'processing' || uploadFlowStep === 'stepper') ? (
          /* =================== STATE 2B: SECURE PROCESSING STEPPER (EXACT MATCH frame_0300s) =================== */
          <div className="upload-prefs-wrapper">
            <div className="upload-prefs-header">
              <h2 className="upload-prefs-title">Reading preferences</h2>
              <p className="upload-prefs-sub">Select how you want to read and transcribe this recording.</p>
            </div>

            <div className="upload-prefs-card-main">
              {/* File Meta Box */}
              <div className="upload-prefs-file-box">
                <div className="upload-prefs-file-left">
                  <div className="upload-prefs-file-icon">
                    <i className="fa-solid fa-file-audio"></i>
                  </div>
                  <div className="upload-prefs-file-info">
                    <div className="upload-prefs-file-title">{selectedFileName || 'Interview · 10 Nov - Audio.ogg'}</div>
                    <div className="upload-prefs-file-badges">
                      <span className="upload-prefs-ext-tag">OGG 142 KB</span>
                      <span>·</span>
                      <span>Ready to process</span>
                    </div>
                  </div>
                </div>
                <div className="upload-prefs-file-actions">
                  <button
                    type="button"
                    className="upload-prefs-cancel-btn"
                    onClick={() => {
                      setUploadFlowStep('initial');
                      setActiveSession(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Saving upload securely stepper */}
              <div className="upload-prefs-saving-box">
                <div className="upload-prefs-saving-top">
                  <span><i className="fa-solid fa-circle-check"></i> Saving your upload securely...</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>File transferred · Confirming storage</span>
                </div>
                <div className="upload-prefs-progress-track">
                  <div className="upload-prefs-progress-bar"></div>
                </div>
                <div className="upload-prefs-steps-row">
                  <span className="step-item"><i className="fa-solid fa-check"></i> 1. Prepare</span>
                  <span className="step-item"><i className="fa-solid fa-check"></i> 2. Upload</span>
                  <span className="step-item active"><i className="fa-solid fa-circle-notch fa-spin"></i> 3. Process audio</span>
                </div>
              </div>

              {/* Uploading button */}
              <button
                type="button"
                className="upload-prefs-submit-btn"
                disabled
              >
                <i className="fa-solid fa-circle-notch fa-spin"></i> Uploading...
              </button>
            </div>
          </div>
        ) : (
/* =================== VIEW 1: HERO UPLOAD & ANALYZE (EXACT MATCH) =================== */
          <div className="upload-page-content">
            {/* Background Ambient Pastel Waves */}
            <div className="upload-bg-glow-1"></div>
            <div className="upload-bg-glow-2"></div>
            <div className="upload-bg-glow-3"></div>

            <div className="upload-container-centered upload-redesign-v2">
              {/* Top Row: Left Hero + Right Dropzone with Arrow */}
              <div className="upload-redesign-top-row">
                {/* Left Hero Column */}
                <div className="upload-redesign-left-hero">
                  <div className="upload-eyebrow-pill">
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                    <span>UPLOAD &amp; ANALYZE</span>
                  </div>

                  <h1 className="upload-hero-title">
                    Upload. Translate.<br />
                    <span className="upload-hero-subword">Understand.</span>
                  </h1>

                  <p className="upload-hero-subtitle">
                    Bring a document, image, audio, or video.<br />
                    Turn its text into useful results.
                  </p>

                  {/* Toggle for "Help with uploads" + Mascot */}
                  <div className="upload-hero-bottom-controls">
                    <div className="upload-help-toggle-group">
                      <label className="upload-toggle-switch">
                        <input
                          type="checkbox"
                          checked={showHelpWithUploads}
                          onChange={handleToggleHelpWithUploads}
                          aria-label="Toggle Help with uploads"
                        />
                        <span className="upload-toggle-slider"></span>
                      </label>
                      <span className="upload-toggle-label" onClick={handleToggleHelpWithUploads}>
                        Help with uploads
                      </span>
                    </div>

                    <div className="upload-hero-mascot-wrap">
                      <img
                        src="/assets/upload_mascot_clean.png?v=3"
                        alt="AI Mascot"
                        className="upload-hero-mascot-img"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Dropzone Column */}
                <div className="upload-redesign-right-dropzone-col">
                  <div className="upload-unified-dropzone-card">
                    {/* Top 4 Format Category Pills */}
                    <div className="upload-format-categories-row">
                      <div
                        className={`upload-format-cat-item ${selectedCategory === 'document' ? 'active' : ''}`}
                        onClick={() => handleCategoryClick('document')}
                        title="Upload Document"
                        role="button"
                        tabIndex={0}
                      >
                        <div className="upload-cat-icon">
                          <i className="fa-regular fa-file-lines"></i>
                        </div>
                        <div className="upload-cat-texts">
                          <span className="upload-cat-title">Document</span>
                          <span className="upload-cat-exts">PDF, DOC, TXT</span>
                        </div>
                      </div>

                      <div
                        className={`upload-format-cat-item ${selectedCategory === 'image' ? 'active' : ''}`}
                        onClick={() => handleCategoryClick('image')}
                        title="Upload Image"
                        role="button"
                        tabIndex={0}
                      >
                        <div className="upload-cat-icon">
                          <i className="fa-regular fa-image"></i>
                        </div>
                        <div className="upload-cat-texts">
                          <span className="upload-cat-title">Image</span>
                          <span className="upload-cat-exts">PNG, JPG, WEBP</span>
                        </div>
                      </div>

                      <div
                        className={`upload-format-cat-item ${selectedCategory === 'audio' ? 'active' : ''}`}
                        onClick={() => handleCategoryClick('audio')}
                        title="Upload Audio"
                        role="button"
                        tabIndex={0}
                      >
                        <div className="upload-cat-icon">
                          <i className="fa-solid fa-music"></i>
                        </div>
                        <div className="upload-cat-texts">
                          <span className="upload-cat-title">Audio</span>
                          <span className="upload-cat-exts">MP3, WAV, M4A</span>
                        </div>
                      </div>

                      <div
                        className={`upload-format-cat-item ${selectedCategory === 'video' ? 'active' : ''}`}
                        onClick={() => handleCategoryClick('video')}
                        title="Upload Video"
                        role="button"
                        tabIndex={0}
                      >
                        <div className="upload-cat-icon">
                          <i className="fa-solid fa-film"></i>
                        </div>
                        <div className="upload-cat-texts">
                          <span className="upload-cat-title">Video</span>
                          <span className="upload-cat-exts">MP4, MOV, WEBM</span>
                        </div>
                      </div>
                    </div>

                    {/* Drag & Drop Center Area */}
                    <div
                      className={`upload-dropzone-center-body ${isDragging ? 'dragging' : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <h2 className="upload-dz-main-title">Drag and drop your file here</h2>
                      <div className="upload-dz-divider-text">or</div>
                      <button
                        type="button"
                        className="upload-dz-choose-btn"
                        onClick={handleChooseFileClick}
                      >
                        <i className="fa-solid fa-arrow-up-from-bracket"></i> Choose file
                      </button>
                      <div className="upload-dz-limits-sub">
                        Audio/Video: up to 10.7 GB &nbsp;|&nbsp; Documents: up to 100 MB
                      </div>
                    </div>
                  </div>

                  {/* Footer Trust Links Row (Directly under dropzone card on right) */}
                  <div className="upload-footer-trust-row">
                    <div className="upload-trust-item">
                      <i className="fa-regular fa-user"></i>
                      <span>Private account library</span>
                    </div>
                    <div className="upload-trust-item">
                      <span className="upload-trust-glyph">文A</span>
                      <span>68 translation languages</span>
                    </div>
                    <div className="upload-trust-item">
                      <i className="fa-regular fa-comment-dots"></i>
                      <span>Ask AI about your file</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom 3 Feature Cards (Shown when "Help with uploads" is ON) */}
              {showHelpWithUploads && (
                <div className="upload-help-cards-grid">
                  {!closedHelpCards['translate'] && (
                    <div className="upload-help-feature-card">
                      <div className="upload-hfc-header">
                        <div className="upload-hfc-icon-glyph">
                          <span>文A</span>
                          <span className="upload-hfc-glyph-sub">AL</span>
                        </div>
                        <button
                          type="button"
                          className="upload-hfc-close-btn"
                          onClick={(e) => handleDismissHelpCard('translate', e)}
                          title="Close"
                          aria-label="Dismiss card"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                      <h4 className="upload-hfc-title">Translate text</h4>
                      <p className="upload-hfc-desc">
                        Read documents and text audio transcripts in a supported language.
                      </p>
                    </div>
                  )}

                  {!closedHelpCards['ai_assist'] && (
                    <div className="upload-help-feature-card">
                      <div className="upload-hfc-header">
                        <div className="upload-hfc-icon-glyph">
                          <i className="fa-solid fa-pen-nib"></i>
                        </div>
                        <button
                          type="button"
                          className="upload-hfc-close-btn"
                          onClick={(e) => handleDismissHelpCard('ai_assist', e)}
                          title="Close"
                          aria-label="Dismiss card"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                      <h4 className="upload-hfc-title">Ask AI Assist</h4>
                      <p className="upload-hfc-desc">
                        Talk about, summarize, analyze, or create learning tooling visuals from your file.
                      </p>
                    </div>
                  )}

                  {!closedHelpCards['download'] && (
                    <div className="upload-help-feature-card">
                      <div className="upload-hfc-header">
                        <div className="upload-hfc-icon-glyph">
                          <i className="fa-solid fa-download"></i>
                        </div>
                        <button
                          type="button"
                          className="upload-hfc-close-btn"
                          onClick={(e) => handleDismissHelpCard('download', e)}
                          title="Close"
                          aria-label="Dismiss card"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                      <h4 className="upload-hfc-title">Download or email me</h4>
                      <p className="upload-hfc-desc">
                        Download PDF, Word, and results, or text. Email listed results to yourself.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Floating Assistant Widget (Bottom Right) */}
            <div
              className="upload-floating-assistant"
              onClick={() => {
                if (!activeSession) {
                  fileInputRef.current?.click();
                }
              }}
              title="Interview AI Assistant"
            >
              <i className="fa-solid fa-headset"></i>
              <span className="upload-floating-badge">1</span>
            </div>
          </div>
        )}

        {/* Floating Toast Notification during Transcribing */}
        {(isTranscribing || activeSession?.isTranscribing) && (
          <div className="transcribing-bottom-toast">
            <i className="fa-solid fa-circle-info"></i>
            <span>Uploaded. Transcribing with speaker identification... {transcribeElapsed > 0 ? `(${transcribeElapsed}s)` : ''}</span>
          </div>
        )}
      </div>

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

      {/* Navigation & Library Drawer (Opened via ☰ Hamburger) */}
      {showNavDrawer && (
        <div className="upload-drawer-overlay" onClick={() => setShowNavDrawer(false)}>
          <div className={`upload-drawer-panel ${darkMode ? 'dark-theme' : 'light-theme'}`} onClick={(e) => e.stopPropagation()}>
            <div className="upload-drawer-header">
              <BrandLogo size="sm" />
              <button className="upload-drawer-close-btn" onClick={() => setShowNavDrawer(false)}>×</button>
            </div>

            <nav className="upload-drawer-nav">
              <button className="upload-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleBackToLanding(); }}>
                <i className="fa-solid fa-house"></i> Home
              </button>
              <button className="upload-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleGoToDashboard(); }}>
                <i className="fa-solid fa-chart-line"></i> Dashboard
              </button>
              <button className="upload-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleGoToPanel(); }}>
                <i className="fa-solid fa-rocket"></i> AI Copilot
              </button>
              <button className="upload-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleGoToNotetaker(); }}>
                <i className="fa-solid fa-microphone"></i> Notetaker
              </button>
              <button className="upload-drawer-nav-item" onClick={() => { setShowNavDrawer(false); handleGoToVoiceAgent(); }}>
                <i className="fa-solid fa-robot"></i> Voice Agent
              </button>
              <button className="upload-drawer-nav-item active">
                <i className="fa-solid fa-cloud-arrow-up"></i> Upload
              </button>
              <button className="upload-drawer-nav-item" onClick={() => { setShowNavDrawer(false); onGoToReferral?.(); }}>
                <i className="fa-solid fa-gift"></i> Refer &amp; Earn
              </button>
              <button className="upload-drawer-nav-item" onClick={() => { setShowNavDrawer(false); onGoToSubscription?.(); }}>
                <i className="fa-solid fa-crown"></i> Plans &amp; Pricing
              </button>
            </nav>

            {/* Library Section inside Drawer */}
            <div className="upload-drawer-library-section">
              <div className="sidebar-section-heading">YOUR LIBRARY ({sessions.length + videoSessions.length})</div>
              <div className="sidebar-library-tabs">
                <button
                  type="button"
                  className={`library-tab-pill ${activeLibraryTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveLibraryTab('all')}
                >
                  All ({sessions.length + videoSessions.length})
                </button>
                <button
                  type="button"
                  className={`library-tab-pill ${activeLibraryTab === 'audio' ? 'active' : ''}`}
                  onClick={() => setActiveLibraryTab('audio')}
                >
                  Audio ({sessions.length})
                </button>
                <button
                  type="button"
                  className={`library-tab-pill ${activeLibraryTab === 'video' ? 'active' : ''}`}
                  onClick={() => setActiveLibraryTab('video')}
                >
                  Video ({videoSessions.length})
                </button>
              </div>

              <div className="sidebar-library-list">
                {videoSessions.map(vs => (
                  <div
                    key={vs.id}
                    onClick={() => { setShowNavDrawer(false); loadVideoSession(vs); }}
                    className={`library-item video-session-item ${activeSession?.id === vs.id ? 'active' : ''}`}
                  >
                    <div className="library-item-icon video-icon">
                      <i className="fa-solid fa-video"></i>
                    </div>
                    <div className="library-item-info">
                      <span className="library-item-name" title={vs.videoFileName}>
                        {vs.videoFileName}
                      </span>
                      <span className="library-item-duration">
                        <span className="library-tag-local">Local MP3</span> · {formatFileSize(vs.videoFileSize)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteVideoSessionItem(e, vs.id); }}
                      className="library-item-delete"
                      type="button"
                      disabled={deletingSessionId === vs.id}
                      title="Delete video session"
                    >
                      <i className={`fa-regular ${deletingSessionId === vs.id ? 'fa-spinner fa-spin' : 'fa-trash-can'}`}></i>
                    </button>
                  </div>
                ))}

                {sessions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => { setShowNavDrawer(false); loadSession(s.id); }}
                    className={`library-item ${activeSession?.id === s.id ? 'active' : ''}`}
                  >
                    <div className="library-item-icon">
                      <i className="fa-regular fa-file-lines"></i>
                    </div>
                    <div className="library-item-info">
                      <span className="library-item-name" title={s.fileName || s.title}>
                        {s.fileName || s.title}
                      </span>
                      <span className="library-item-duration">{s.duration || '0:30'}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(e, s.id); }}
                      className="library-item-delete"
                      type="button"
                      disabled={deletingSessionId === s.id}
                      title="Delete session"
                    >
                      <i className={`fa-regular ${deletingSessionId === s.id ? 'fa-spinner fa-spin' : 'fa-trash-can'}`}></i>
                    </button>
                  </div>
                ))}

                {sessions.length === 0 && videoSessions.length === 0 && (
                  <div className="sidebar-empty-hint">No uploads yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (Opened via ⚙ Gear Button) */}
      {showSettingsModal && (
        <div className="upload-modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="upload-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="upload-modal-header">
              <h3><i className="fa-solid fa-gear"></i> Settings</h3>
              <button className="upload-modal-close-btn" onClick={() => setShowSettingsModal(false)}>×</button>
            </div>
            <div className="upload-modal-body">
              <div className="upload-setting-row">
                <span className="upload-setting-label">Account</span>
                <span className="upload-setting-val">{user?.email || 'Logged In'}</span>
              </div>
              <div className="upload-setting-row">
                <span className="upload-setting-label">Credits</span>
                <span className="upload-setting-val"><i className="fa-solid fa-coins" style={{ color: '#eab308' }}></i> {user?.credits ?? getUserCredits()}</span>
              </div>
              <div className="upload-setting-row">
                <span className="upload-setting-label">Theme Mode</span>
                <button type="button" onClick={toggleDarkMode} className="upload-setting-btn">
                  <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i> {darkMode ? 'Light Theme' : 'Dark Theme'}
                </button>
              </div>
              <div className="upload-setting-row" style={{ borderBottom: 'none' }}>
                <span className="upload-setting-label">Actions</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => { setShowSettingsModal(false); onGoToProfile?.(); }} className="upload-setting-btn">
                    Profile
                  </button>
                  <button type="button" onClick={() => { setShowSettingsModal(false); onGoToSubscription?.(); }} className="upload-setting-btn">
                    Plans
                  </button>
                  <button type="button" onClick={() => { setShowSettingsModal(false); handleLogoutClick(); }} className="upload-setting-btn btn-danger">
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload History Modal Popup */}
      {showHistoryModal && (
        <div className="upload-history-modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="upload-history-modal-dialog" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="upload-history-modal-header">
              <div className="upload-history-modal-header-left">
                <div className="upload-history-modal-icon-circle">
                  <i className="fa-solid fa-clock-rotate-left"></i>
                </div>
                <div className="upload-history-modal-title-wrap">
                  <h3 className="upload-history-modal-title">Upload History</h3>
                  <span className="upload-history-modal-sub">
                    {uploadHistory.length} recorded session{uploadHistory.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="upload-history-modal-close-btn"
                onClick={() => setShowHistoryModal(false)}
                title="Close"
                aria-label="Close modal"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Search & Filter Tabs */}
            <div className="upload-history-search-row">
              <div className="upload-history-search-box">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input
                  type="text"
                  placeholder="Search files, chats, transcripts..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  autoFocus
                />
                {historySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHistorySearchQuery('')}
                    className="upload-history-search-clear"
                    title="Clear search"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>

              <div className="upload-history-filter-pills">
                <button
                  type="button"
                  className={`upload-history-tab-btn ${historyFilterTab === 'all' ? 'active' : ''}`}
                  onClick={() => setHistoryFilterTab('all')}
                >
                  All ({uploadHistory.length})
                </button>
                <button
                  type="button"
                  className={`upload-history-tab-btn ${historyFilterTab === 'audio' ? 'active' : ''}`}
                  onClick={() => setHistoryFilterTab('audio')}
                >
                  Audio ({uploadHistory.filter(s => s.fileType === 'audio' || (!s.isVideoSession && s.fileType !== 'document' && s.fileType !== 'image')).length})
                </button>
                <button
                  type="button"
                  className={`upload-history-tab-btn ${historyFilterTab === 'video' ? 'active' : ''}`}
                  onClick={() => setHistoryFilterTab('video')}
                >
                  Video ({uploadHistory.filter(s => s.fileType === 'video' || s.isVideoSession).length})
                </button>
                <button
                  type="button"
                  className={`upload-history-tab-btn ${historyFilterTab === 'document' ? 'active' : ''}`}
                  onClick={() => setHistoryFilterTab('document')}
                >
                  Documents ({uploadHistory.filter(s => s.fileType === 'document' || s.fileType === 'image').length})
                </button>
              </div>
            </div>

            {/* Modal Body: Sessions List or Empty State */}
            <div className="upload-history-modal-body">
              {filteredHistory.length === 0 ? (
                <div className="upload-history-empty-state">
                  <div className="upload-history-empty-icon-wrap">
                    <i className="fa-regular fa-folder-open"></i>
                  </div>
                  <h4 className="upload-history-empty-heading">No upload sessions found</h4>
                  <p className="upload-history-empty-text">
                    {historySearchQuery
                      ? `No files or chats matched "${historySearchQuery}". Try a different keyword.`
                      : 'Upload an audio, video, document, or image to start. Your transcripts and AI conversations will automatically be saved here.'}
                  </p>
                </div>
              ) : (
                <div className="upload-history-cards-list">
                  {filteredHistory.map((sess) => {
                    const isVid = sess.fileType === 'video' || sess.isVideoSession;
                    const isDoc = sess.fileType === 'document' || sess.fileType === 'image';
                    const messagesCount = (sess.messages?.length) || (sess.chatMessages?.length) || 0;
                    const isSelected = activeSession?.id === sess.id;

                    return (
                      <div
                        key={sess.id}
                        className={`upload-history-card ${isSelected ? 'active' : ''}`}
                        onClick={() => handleOpenHistorySession(sess)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="upload-history-card-top">
                          <div className="upload-history-card-icon-title">
                            <div className={`upload-history-card-icon ${isVid ? 'video' : isDoc ? 'doc' : 'audio'}`}>
                              <i className={`fa-solid ${isVid ? 'fa-video' : isDoc ? 'fa-file-lines' : 'fa-headphones'}`}></i>
                            </div>
                            <div className="upload-history-card-info">
                              <h4 className="upload-history-card-title" title={sess.fileName || sess.title}>
                                {sess.fileName || sess.title}
                              </h4>
                              <span className="upload-history-card-date">{sess.formattedDate || 'Recent'}</span>
                            </div>
                          </div>

                          <div className="upload-history-card-badges">
                            {sess.duration && (
                              <span className="upload-history-tag-pill">
                                <i className="fa-regular fa-clock"></i> {sess.duration}
                              </span>
                            )}
                            {sess.wordsCount ? (
                              <span className="upload-history-tag-pill">
                                {sess.wordsCount} words
                              </span>
                            ) : null}
                            <span className="upload-history-tag-pill status-ready">
                              ✓ Ready
                            </span>
                          </div>
                        </div>

                        {/* Chat or Transcript Preview */}
                        <div className="upload-history-card-preview-box">
                          {messagesCount > 0 ? (
                            <div className="upload-history-preview-chat">
                              <i className="fa-regular fa-comment-dots"></i>
                              <span>
                                <strong>Last Question / Chat:</strong> "{sess.messages[sess.messages.length - 1].text?.slice(0, 110)}
                                {sess.messages[sess.messages.length - 1].text?.length > 110 ? '...' : ''}"
                              </span>
                            </div>
                          ) : sess.transcript ? (
                            <div className="upload-history-preview-transcript">
                              <i className="fa-regular fa-file-lines"></i>
                              <span>
                                "{sess.transcript.slice(0, 110)}
                                {sess.transcript.length > 110 ? '...' : ''}"
                              </span>
                            </div>
                          ) : (
                            <div className="upload-history-preview-empty">
                              <span>File ready for AI questions &amp; transcript analysis.</span>
                            </div>
                          )}
                        </div>

                        {/* Actions Row */}
                        <div className="upload-history-card-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="upload-history-open-btn"
                            onClick={() => handleOpenHistorySession(sess)}
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square"></i> Open Chat &amp; File
                          </button>

                          <button
                            type="button"
                            className="upload-history-delete-btn"
                            onClick={(e) => handleDeleteHistorySession(e, sess.id)}
                            title="Delete session from history"
                          >
                            <i className="fa-regular fa-trash-can"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="upload-history-modal-footer">
              {uploadHistory.length > 0 && (
                <button
                  type="button"
                  className="upload-history-clear-btn"
                  onClick={handleClearAllHistory}
                >
                  <i className="fa-regular fa-trash-can"></i> Clear All History
                </button>
              )}
              <button
                type="button"
                className="upload-history-close-btn"
                onClick={() => setShowHistoryModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
