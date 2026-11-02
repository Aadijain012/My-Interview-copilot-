/**
 * IPC handlers - bridges renderer with Deepgram.
 * Supports single stream or dual stream (interviewer + candidate).
 */

const { ipcMain, app, desktopCapturer, screen } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { setWindowCaptureExclusion } = require('../win32-capture-exclude');
const {
  createConnection,
  startDeepgramConnection,
  sendAudioChunk,
  stopDeepgramConnection,
  createGoogleConnection,
  startGoogleConnection,
  createSarvamConnection,
  startSarvamConnection
} = require('./deepgramService');
const {
  isInterviewQuestion,
  isQuestionOrCode,
  generateAnswer,
  extractQuestionFromOcrText,
  extractQuestionOrCodeFromOcrText,
  generateNotes,
  generateFeedback,
  generateAiNotes,
  generateNotetakerChatReply,
  translateText,
} = require('./aiAnswerGenerator');
const { secondsToHMS, persistInterviewSession } = require('./interviewSessionPersist');
const { setupEmbeddedBackendIpcHandlers } = require('./embeddedBackend');

function logCapture(msg) {
  try {
    const logPath = path.join(__dirname, '../renderer_error.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] [capture-debug] ${msg}\n`, 'utf8');
  } catch (_) {}
}

let captureWindow = null;
let teleprompterWindow = null;
let isExcludedFromCapture = true;
let topBarWindow = null;

function getCaptureWindow() {
  if (captureWindow && !captureWindow.isDestroyed()) {
    return captureWindow;
  }
  const { BrowserWindow } = require('electron');
  const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.customType === 'copilot-main');
  if (win) captureWindow = win;
  return win;
}

function getTeleprompterWindow() {
  if (teleprompterWindow && !teleprompterWindow.isDestroyed()) {
    return teleprompterWindow;
  }
  const { BrowserWindow } = require('electron');
  const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.customType === 'teleprompter');
  if (win) teleprompterWindow = win;
  return win;
}

function getTopBarWindow() {
  if (topBarWindow && !topBarWindow.isDestroyed()) {
    return topBarWindow;
  }
  const { BrowserWindow } = require('electron');
  const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.customType === 'topbar');
  if (win) topBarWindow = win;
  return win;
}

function safeSend(win, channel, ...args) {
  if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
    try {
      win.webContents.send(channel, ...args);
    } catch (err) {
      console.warn(`[ipcHandlers] Failed to send to channel ${channel}:`, err.message);
    }
  }
}

function setTopBarWindow(win) {
  topBarWindow = win;
}

let persistToken = null;
let persistBaseUrl = null;
let sessionStartMs = null;
let sessionTech = '';
let sessionResumeContext = '';
let transcriptEntries = [];
let lastInterviewerSpeechTime = 0;
let recentCandidateSpeech = [];
let questionsHistory = [];
let pendingSessionAudio = null;
let currentCaptureMode = '';
let spokenLanguageName = '';
let targetLanguageName = '';
let lastGeneratedNotes = '';
let lastGeneratedAiNotes = '';
let candidateMicActive = false;

let lastAnsweredQuestion = '';
let lastAnsweredTime = 0;
let currentGenerationId = 0;

let activeQuestionText = '';
let activeQuestionSpeaker = null;
let questionDebounceTimer = null;

const NEW_QUESTION_STARTERS = /^(?:what\s+is|what\s+are|what\s+do|what\s+does|how\s+to|how\s+do|how\s+does|how\s+can|how\s+would|why\s+is|why\s+are|why\s+do|why\s+does|explain\s|describe\s|define\s|tell\s+me|walk\s+me|difference\s+between|differences\s+between|can\s+you|could\s+you|would\s+you)\b/i;

function queueQuestionSegment(speaker, text) {
  if ((speaker === 'candidate' || speaker === 'user') && !candidateMicActive) return;
  const cleanText = String(text || '').trim();
  if (!cleanText) return;

  if (activeQuestionSpeaker === speaker) {
    // If a new clear question starter begins and we already have a previous question buffered, trigger previous immediately!
    if (activeQuestionText && isInterviewQuestion(activeQuestionText) && NEW_QUESTION_STARTERS.test(cleanText)) {
      if (questionDebounceTimer) {
        clearTimeout(questionDebounceTimer);
      }
      triggerQueuedQuestion();
      activeQuestionText = cleanText;
    } else {
      activeQuestionText = (activeQuestionText + ' ' + cleanText).trim();
    }
  } else {
    if (activeQuestionText && questionDebounceTimer) {
      clearTimeout(questionDebounceTimer);
      triggerQueuedQuestion();
    }
    activeQuestionSpeaker = speaker;
    activeQuestionText = cleanText;
  }

  // Fast debounce: 200ms if punctuation mark present, 450ms otherwise (no more 3000ms freeze!)
  if (questionDebounceTimer) {
    clearTimeout(questionDebounceTimer);
  }
  const debounceDelay = /[\?？]\s*$/.test(activeQuestionText) ? 200 : 450;
  questionDebounceTimer = setTimeout(() => {
    triggerQueuedQuestion();
  }, debounceDelay);
}

function triggerQueuedQuestion() {
  const q = activeQuestionText.trim();
  activeQuestionText = '';
  activeQuestionSpeaker = null;
  questionDebounceTimer = null;

  if (q && isInterviewQuestion(q)) {
    console.log(`[ai] Question triggered immediately: "${q}"`);
    handleAudioQuestion(q);
  }
}

async function handleAudioQuestion(text) {
  if (!text) return;
  const q = text.trim();
  const cleanQ = q.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const now = Date.now();

  // Fast exact duplicate prevention (within 1.5 seconds)
  if (lastAnsweredQuestion && (now - lastAnsweredTime < 1500)) {
    const cleanLast = lastAnsweredQuestion.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (cleanQ === cleanLast) {
      console.log(`[ai] Duplicate question ignored: "${q}"`);
      return;
    }
  }

  lastAnsweredQuestion = q;
  lastAnsweredTime = now;

  // Cancel any in-flight answer generation from previous questions
  const thisGenId = ++currentGenerationId;

  const qTimeSecs = nowSessionSecs();
  sendAiAnswerStart(q);
  const panelErr = (reason) =>
    /timeout|network|ECONNREFUSED/i.test(String(reason?.message || reason))
      ? 'Slow connection. Please check your internet and try again.'
      : 'Failed to generate answer.';
  try {
    const effectiveResume = sessionResumeContext || sessionTech || '';
    const [resA, resB] = await Promise.allSettled([
      generateAnswer(
        q,
        'a',
        (partial) => {
          if (thisGenId === currentGenerationId) sendAiAnswer(q, partial, true, 'a');
        },
        (retryMsg) => {
          if (thisGenId === currentGenerationId) sendAiAnswer(q, retryMsg, true, 'a');
        },
        'normal',
        questionsHistory,
        effectiveResume,
        spokenLanguageName || 'en'
      ),
      generateAnswer(
        q,
        'b',
        (partial) => {
          if (thisGenId === currentGenerationId) sendAiAnswer(q, partial, true, 'b');
        },
        (retryMsg) => {
          if (thisGenId === currentGenerationId) sendAiAnswer(q, retryMsg, true, 'b');
        },
        'normal',
        questionsHistory,
        effectiveResume,
        spokenLanguageName || 'en'
      ),
    ]);

    // If a newer question was asked while this was generating, discard results immediately!
    if (thisGenId !== currentGenerationId) {
      console.log(`[ai] Generation ${thisGenId} superseded by ${currentGenerationId}. Discarding stale answer.`);
      return;
    }

    const answerA =
      resA.status === 'fulfilled' ? (resA.value || '').trim() : panelErr(resA.reason);
    const answerB =
      resB.status === 'fulfilled' ? (resB.value || '').trim() : panelErr(resB.reason);
    sendAiAnswer(q, answerA, false, 'a');
    sendAiAnswer(q, answerB, false, 'b');
    const aiTimeA = nowSessionSecs();
    transcriptEntries.push({
      speaker: 'ai_a',
      text: answerA,
      time: secondsToHMS(aiTimeA),
      timeSecs: aiTimeA,
    });
    const aiTimeB = nowSessionSecs();
    transcriptEntries.push({
      speaker: 'ai_b',
      text: answerB,
      time: secondsToHMS(aiTimeB),
      timeSecs: aiTimeB,
    });
    questionsHistory.push({
      question: q,
      answerA,
      answerB,
      timeSecs: qTimeSecs,
      status: 'done',
    });
  } catch (err) {
    console.error('[ai] generateAnswer error:', err.message);
    const msg = panelErr(err);
    sendAiAnswer(q, msg, false, 'a');
    sendAiAnswer(q, msg, false, 'b');
    const aiTime = nowSessionSecs();
    transcriptEntries.push(
      {
        speaker: 'ai_a',
        text: msg,
        time: secondsToHMS(aiTime),
        timeSecs: aiTime,
      },
      {
        speaker: 'ai_b',
        text: msg,
        time: secondsToHMS(aiTime),
        timeSecs: aiTime,
      }
    );
    questionsHistory.push({
      question: q,
      answerA: msg,
      answerB: msg,
      timeSecs: qTimeSecs,
      status: 'done',
    });
  }
}

let pkgVersion = '1.0.0';
try {
  pkgVersion = require('../package.json').version || pkgVersion;
} catch (_) {}

function setTeleprompterWindow(win) {
  teleprompterWindow = win;
}

function setInterviewAuth(token, baseUrl) {
  persistToken = token || null;
  persistBaseUrl = baseUrl ? String(baseUrl).replace(/\/$/, '') : null;
}

function nowSessionSecs() {
  return sessionStartMs ? (Date.now() - sessionStartMs) / 1000 : 0;
}

function payloadDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return { date, time };
}

function mapSpeaker(source) {
  if (source === 'candidate') return 'user';
  if (source === 'interviewer') return 'interviewer';
  return String(source || 'combined');
}

function buildSortedTranscript() {
  return [...transcriptEntries].sort((a, b) => (a.timeSecs || 0) - (b.timeSecs || 0));
}

async function runPersistAndNotify() {
  const audioBuf = pendingSessionAudio;
  pendingSessionAudio = null;

  const durationSeconds = sessionStartMs ? Math.floor((Date.now() - sessionStartMs) / 1000) : 0;
  const sortedTranscript = buildSortedTranscript();
  const questionCount = questionsHistory.length;
  const hasAudio = audioBuf && Buffer.isBuffer(audioBuf) && audioBuf.length > 0;
  const hasTranscript = sortedTranscript.length > 0;

  if (currentCaptureMode !== 'notetaker' && questionCount === 0 && !hasTranscript && !hasAudio) {
    safeSend(getCaptureWindow(), 'session-persist-result', {
      ok: true,
      skipped: true,
      message: 'Nothing to save (no questions, transcript, or recording).',
    });
    return;
  }

  const effectiveBaseUrl = persistBaseUrl || process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:4000';
  if (!persistToken) {
    safeSend(getCaptureWindow(), 'session-persist-result', {
      ok: false,
      message: 'Not signed in. Session was not saved.',
    });
    console.error('[interview-persist] missing token');
    return;
  }

  // Generate notes if in notetaker mode
  let notes = '';
  let aiNotes = '';
  if (currentCaptureMode === 'notetaker' && hasTranscript) {
    try {
      const fullTranscriptText = sortedTranscript.map(t => {
        let label = t.speaker || 'Speaker 1';
        if (label === 'speaker_0') label = 'Speaker 1';
        else if (label === 'speaker_1') label = 'Speaker 2';
        else if (label === 'speaker_2') label = 'Speaker 3';
        else if (label === 'speaker_3') label = 'Speaker 4';
        else if (label === 'interviewer') label = 'Interviewer';
        else if (label === 'candidate' || label === 'user') label = 'You';
        else if (typeof label === 'string') label = label.replace('speaker_', 'Speaker ');
        return `${label}: ${t.text}`;
      }).join('\n');
      notes = await generateNotes(fullTranscriptText, spokenLanguageName, targetLanguageName);
      lastGeneratedNotes = notes;

      aiNotes = await generateAiNotes(fullTranscriptText, spokenLanguageName, targetLanguageName);
      lastGeneratedAiNotes = aiNotes;
    } catch (err) {
      console.error('[persist] Failed to generate notes/aiNotes:', err.message);
    }
  }

  const { date, time } = payloadDateTime();
  let techTitle = sessionTech && sessionTech.trim() ? sessionTech.trim().slice(0, 120) : '';
  if (currentCaptureMode === 'notetaker' && (!techTitle || techTitle === 'Notetaker Session')) {
    techTitle = 'default';
  }
  const title =
    techTitle ||
    questionsHistory[0]?.question?.slice(0, 120) ||
    undefined;

  const durationDisplay = secondsToHMS(durationSeconds);
  const formattedQuestionsList = questionsHistory.map((q, idx) => ({
    question: q.question,
    index: idx + 1,
    time: secondsToHMS(q.timeSecs || 0),
    wallTime: date,
    answerA: q.answerA ?? '',
    answerB: q.answerB ?? '',
  }));
  const formattedLiveTranscript = sortedTranscript.map((t) => ({
    speaker: t.speaker === 'user' ? 'candidate' : (t.speaker || 'interviewer'),
    text: t.text,
    time: secondsToHMS(t.timeSecs || 0),
    wallTime: date,
    isQuestion: isInterviewQuestion(t.text)
  }));

  const payload = {
    date,
    time,
    timestamp: `${date} ${time}`,
    version: `v${pkgVersion}`,
    name: title || 'Live Session',
    title: title || 'Live Session',
    tech: sessionTech || 'Interview',
    durationDisplay,
    durationSeconds,
    questionCount,
    qsCount: questionCount,
    answersCount: questionsHistory.length,
    answerA: questionsHistory[questionsHistory.length - 1]?.answerA || '',
    answerB: questionsHistory[questionsHistory.length - 1]?.answerB || '',
    answerAStatus: 'Done',
    answerBStatus: 'Done',
    notes: notes || undefined,
    aiNotes: aiNotes || undefined,
    targetLanguage: targetLanguageName || undefined,
    questions: questionsHistory.map((q) => ({
      question: q.question,
      answerA: q.answerA ?? null,
      answerB: q.answerB ?? null,
      time: secondsToHMS(q.timeSecs || 0),
      timeSecs: q.timeSecs || 0,
      status: q.status || 'done',
    })),
    questionsList: formattedQuestionsList,
    transcript: sortedTranscript.map((t) => ({
      speaker: t.speaker,
      text: t.text,
      time: secondsToHMS(t.timeSecs || 0),
      timeSecs: t.timeSecs || 0,
    })),
    liveTranscript: formattedLiveTranscript,
  };

  try {
    await persistInterviewSession({
      baseUrl: effectiveBaseUrl,
      token: persistToken,
      tech: sessionTech || 'Interview',
      title: title || 'Live Session',
      durationSeconds,
      questionCount,
      rating: 0,
      payload,
      audioBuffer: hasAudio ? audioBuf : null,
      audioFileName: 'session.webm',
    });
    safeSend(getCaptureWindow(), 'session-persist-result', {
      ok: true,
      message: 'Session saved to Past Sessions.',
    });
    safeSend(getTopBarWindow(), 'session-persist-result', {
      ok: true,
      message: 'Session saved to Past Sessions.',
    });
  } catch (err) {
    const msg = err?.message || 'Failed to save session.';
    safeSend(getCaptureWindow(), 'session-persist-result', { ok: false, message: msg });
  }
}

function setCaptureWindow(win) {
  captureWindow = win;
}

function sendTranscript(source, text, isFinal = true, speaker = 0, options = {}) {
  // If candidate mic is not active, drop candidate transcripts in 'both' mode
  if (source === 'candidate' && currentCaptureMode === 'both' && !candidateMicActive) {
    return;
  }

  const mappedSpeaker = source === 'combined' ? `speaker_${speaker}` : mapSpeaker(source);
  const cleanText = String(text || '').trim();
  if (!cleanText) return;

  // Track when the interviewer is speaking (both interim and final results)
  if (source === 'interviewer') {
    lastInterviewerSpeechTime = Date.now();
  }

  // Reverse Echo Cancellation: Suppress candidate voice leaks in the interviewer loopback stream
  const norm = cleanText.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  if (source === 'candidate') {
    if (norm) {
      recentCandidateSpeech.push({ text: norm, time: Date.now() });
      recentCandidateSpeech = recentCandidateSpeech.filter(x => Date.now() - x.time < 12000).slice(-10);
    }
  }

  // Disabled to prevent interviewer's own voice from being suppressed when candidate mic captures the leak first
  /*
  if (source === 'interviewer' && norm && currentCaptureMode !== 'notetaker') {
    const isCandidateLeak = recentCandidateSpeech.some(x => {
      if (x.text.includes(norm) || norm.includes(x.text)) return true;
      const w1 = x.text.split(' ').filter(w => w.length > 2);
      const w2 = norm.split(' ').filter(w => w.length > 2);
      if (w1.length > 0 && w2.length > 0) {
        const intersect = w1.filter(w => w2.includes(w)).length;
        const similarity = intersect / Math.max(w1.length, w2.length);
        return similarity > 0.35;
      }
      return false;
    });
    if (isCandidateLeak) {
      console.log(`[backend-gate] Suppressed candidate voice leak in interviewer stream: "${cleanText}"`);
      return; // Discard candidate leak from interviewer stream
    }
  }
  */

  // Temporal Gating: Ignore candidate mic transcripts if they are short and occurred while the interviewer is speaking
  if (source === 'candidate' && currentCaptureMode !== 'notetaker') {
    const timeSinceInterviewer = Date.now() - lastInterviewerSpeechTime;
    if (timeSinceInterviewer < 2500) {
      const wordCount = cleanText.split(/\s+/).length;
      if (wordCount < 3 && cleanText.length < 15) {
        console.log(`[backend-gate] Suppressed short candidate leak during interviewer speech: "${cleanText}"`);
        return; // Discard speaker leak
      }
    }
  }

  let merge = false;
  let isQuestion = false;
  if (isFinal && sessionStartMs) {
    const timeSecs = nowSessionSecs();

    // Retroactive echo cancellation: if this is an interviewer transcript, filter out candidate echoes from saved logs
    if (source === 'interviewer') {
      const normalizedText = cleanText.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      transcriptEntries = transcriptEntries.filter(entry => {
        if (entry.speaker === 'candidate' || entry.speaker === 'user') {
          const entryNorm = entry.text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
          if (normalizedText.includes(entryNorm) || entryNorm.includes(normalizedText)) {
            console.log(`[backend-retro-echo] Removed duplicate candidate transcript: "${entry.text}"`);
            return false;
          }

          const w1 = normalizedText.split(' ').filter(w => w.length > 2);
          const w2 = entryNorm.split(' ').filter(w => w.length > 2);
          if (w1.length > 0 && w2.length > 0) {
            const intersect = w1.filter(w => w2.includes(w)).length;
            const similarity = intersect / Math.max(w1.length, w2.length);
            if (similarity > 0.35) {
              console.log(`[backend-retro-echo] Removed duplicate candidate transcript (fuzzy): "${entry.text}"`);
              return false;
            }
          }
        }
        return true;
      });
    }

    isQuestion = false;
    if (transcriptEntries.length > 0) {
      const lastEntry = transcriptEntries[transcriptEntries.length - 1];
      if (lastEntry.speaker === mappedSpeaker) {
        let gap;
        let gapLimit = 3;
        if (options.start !== undefined && lastEntry.audioEndSecs !== undefined) {
          gap = options.start - lastEntry.audioEndSecs;
          gapLimit = 3;
          console.log(`[backend-merge] Audio-stream gap for ${mappedSpeaker}: ${gap}s (start: ${options.start}s, prevEnd: ${lastEntry.audioEndSecs}s)`);
        } else {
          const referenceTime = lastEntry.lastSpeechTimeSecs !== undefined ? lastEntry.lastSpeechTimeSecs : (lastEntry.timeSecs || 0);
          gap = timeSecs - referenceTime;
          gapLimit = 5;
          console.log(`[backend-merge] Fallback system-time gap for ${mappedSpeaker}: ${gap}s`);
        }

        if (gap >= 0 && gap < gapLimit) {
          lastEntry.text = (lastEntry.text + ' ' + cleanText).trim();
          lastEntry.lastSpeechTimeSecs = timeSecs;
          if (options.end !== undefined) {
            lastEntry.audioEndSecs = options.end;
          }
          merge = true;
          isQuestion = isInterviewQuestion(lastEntry.text);
          console.log(`[backend-merge] Merged segment for ${mappedSpeaker} (gap ${gap}s): "${cleanText}"`);
        }
      }
    }

    if (!merge) {
      transcriptEntries.push({
        speaker: mappedSpeaker,
        text: cleanText,
        time: secondsToHMS(timeSecs),
        timeSecs,
        lastSpeechTimeSecs: timeSecs,
        audioEndSecs: options.end,
      });
      isQuestion = isInterviewQuestion(cleanText);
    }
  } else {
    isQuestion = isInterviewQuestion(cleanText);
  }

  // Only suppress question detection for candidate when candidate mic is NOT active
  if (mappedSpeaker === 'user' || source === 'candidate') {
    if (!candidateMicActive) {
      isQuestion = false;
    }
  }

  console.log('[backend-notetaker] sendTranscript sending to captureWindow:', cleanText, 'isFinal:', isFinal);
  safeSend(getCaptureWindow(), 'transcript', { source, text: cleanText, isFinal, speaker: mappedSpeaker, merge, isQuestion });
}

function sendAiAnswerStart(question) {
  safeSend(getCaptureWindow(), 'ai-answer-start', { question });
  safeSend(getTopBarWindow(), 'ai-answer-start', { question });
  safeSend(getTeleprompterWindow(), 'ai-answer-start', { question });
}

function sendAiAnswer(question, answer, isStreaming = false, panel = 'a') {
  safeSend(getCaptureWindow(), 'ai-answer', { question, answer, isStreaming, panel });
  safeSend(getTopBarWindow(), 'ai-answer', { question, answer, isStreaming, panel });
  safeSend(getTeleprompterWindow(), 'ai-answer', { question, answer, isStreaming, panel });
}

async function runPowerShellCaptureOcr() {
  const capWin = getCaptureWindow();
  const teleWin = getTeleprompterWindow();
  const topWin = getTopBarWindow();

  const overlayVisible = capWin && !capWin.isDestroyed() && capWin.isVisible();
  const teleprompterVisible = teleWin && !teleWin.isDestroyed() && teleWin.isVisible();
  const topbarVisible = topWin && !topWin.isDestroyed() && topWin.isVisible();

  const hideOverlay = overlayVisible;
  const hideTeleprompter = teleprompterVisible;
  const hideTopbar = topbarVisible;

  try {
    if (hideOverlay) {
      capWin.hide();
    }
    if (hideTeleprompter) {
      teleWin.setOpacity(0);
    }
    if (hideTopbar) {
      topWin.setOpacity(0);
    }

    // Wait a tiny bit (80ms) for OS window manager to register the opacity change and redraw the screen before capture
    await new Promise((resolve) => setTimeout(resolve, 80));

    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tempScriptPath = path.join(app.getPath('temp'), `ocr_capture_${uniqueId}.ps1`);

    const psScript = `param(
    [int]$ourProcessId
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWindowVisible(IntPtr hWnd);
}
"@ -ErrorAction SilentlyContinue

$tempFile = [System.IO.Path]::GetTempFileName() + ".jpg"

function Await-WinRT {
    param(
        [Parameter(Mandatory=$true)]
        $WinRtTask,
        [Parameter(Mandatory=$true)]
        [Type]$ResultType
    )
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | 
        Where-Object { 
            $_.Name -eq 'AsTask' -and 
            $_.GetParameters().Count -eq 1 -and 
            $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' 
        })[0]
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

try {
    # Find active background window bounds
    $hwnd = [Win32]::GetForegroundWindow()
    $targetRect = $null
    $attempts = 0

    while ($hwnd -ne [IntPtr]::Zero -and $attempts -lt 200) {
        if ([Win32]::IsWindowVisible($hwnd)) {
            $processId = 0
            [Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId) | Out-Null
            
            $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
            $procName = if ($proc) { $proc.ProcessName.ToLower() } else { "" }
            
            $sbTitle = New-Object System.Text.StringBuilder 512
            [Win32]::GetWindowText($hwnd, $sbTitle, $sbTitle.Capacity) | Out-Null
            $title = $sbTitle.ToString().Trim()

            $sbClass = New-Object System.Text.StringBuilder 256
            [Win32]::GetClassName($hwnd, $sbClass, $sbClass.Capacity) | Out-Null
            $className = $sbClass.ToString().Trim()

            if ($processId -ne $ourProcessId -and 
                $procName -notmatch '^(zoom|teams|discord|webex|skype|slack|obs64|obs|camtasia|snagit|screenrecorder)$' -and
                $className -notmatch '^(Shell_TrayWnd|Progman|WorkerW|Button|ComboLBox|KeyboardLayoutWindow)$' -and
                $title -and 
                $title -notmatch '^(Default IME|MSCTFIME UI|Chrome Legacy Window)$' -and
                $title -notmatch '(Zoom Meeting|Zoom Video|Zoom Floating Video|Microsoft Teams.*|Discord.*|Skype.*|Slack.*|Webex.*|OBS.*)') {
                
                $rect = New-Object Win32+RECT
                if ([Win32]::GetWindowRect($hwnd, [ref]$rect)) {
                    $width = $rect.Right - $rect.Left
                    $height = $rect.Bottom - $rect.Top
                    if ($width -gt 200 -and $height -gt 200) {
                        $targetRect = $rect
                        break
                    }
                }
            }
        }
        $hwnd = [Win32]::GetWindow($hwnd, 2)
        $attempts++
    }

    # 1. Capture screen
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    $bounds = $screen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $bitmap.Save($tempFile, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $graphics.Dispose()
    $bitmap.Dispose()

    # Signal that screenshot is captured
    Write-Output "SCREENSHOT_CAPTURED"

    # Load WinRT assemblies
    [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
    [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
    [Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime] | Out-Null

    # Open file with WinRT StorageFile
    $storageFile = Await-WinRT -WinRtTask ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tempFile)) -ResultType ([Windows.Storage.StorageFile])
    $stream = Await-WinRT -WinRtTask ($storageFile.OpenReadAsync()) -ResultType ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    $decoder = Await-WinRT -WinRtTask ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) -ResultType ([Windows.Graphics.Imaging.BitmapDecoder])
    $softwareBitmap = Await-WinRT -WinRtTask ($decoder.GetSoftwareBitmapAsync()) -ResultType ([Windows.Graphics.Imaging.SoftwareBitmap])

    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if ($engine) {
        $ocrResult = Await-WinRT -WinRtTask ($engine.RecognizeAsync($softwareBitmap)) -ResultType ([Windows.Media.Ocr.OcrResult])
        
        # Extract all words with coordinates to reconstruct line-by-line horizontally
        $words = @()
        foreach ($line in $ocrResult.Lines) {
            foreach ($word in $line.Words) {
                # Determine if we should filter by targetRect bounds (only on primary monitor)
                $filterByBounds = $false
                if ($targetRect -ne $null) {
                    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
                    $bounds = $screen.Bounds
                    if ($targetRect.Left -ge -15 -and $targetRect.Right -le ($bounds.Width + 15) -and
                        $targetRect.Top -ge -15 -and $targetRect.Bottom -le ($bounds.Height + 15)) {
                        $filterByBounds = $true
                    }
                }
                
                if ($filterByBounds) {
                    if ($word.BoundingRect.X -lt ($targetRect.Left - 5) -or 
                        $word.BoundingRect.X -gt ($targetRect.Right + 5) -or 
                        $word.BoundingRect.Y -lt ($targetRect.Top + 80) -or 
                        $word.BoundingRect.Y -gt ($targetRect.Bottom - 10)) {
                        continue
                    }
                }
                $words += [PSCustomObject]@{
                    Text = $word.Text
                    X = $word.BoundingRect.X
                    Y = $word.BoundingRect.Y
                    Height = $word.BoundingRect.Height
                }
            }
        }

        $ocrText = ""
        if ($words.Count -gt 0) {
            $sortedWords = $words | Sort-Object Y, X
            $lines = @()
            $currentLine = @()
            $lastY = -1

            foreach ($w in $sortedWords) {
                if ($lastY -eq -1) {
                    $currentLine += $w
                    $lastY = $w.Y
                } elseif ([Math]::Abs($w.Y - $lastY) -le ($w.Height * 0.7)) {
                    $currentLine += $w
                } else {
                    $lines += ,($currentLine | Sort-Object X)
                    $currentLine = @($w)
                    $lastY = $w.Y
                }
            }
            if ($currentLine.Count -gt 0) {
                $lines += ,($currentLine | Sort-Object X)
            }

            foreach ($line in $lines) {
                $lineText = ($line | ForEach-Object { $_.Text }) -join " "
                $ocrText += $lineText + "\`r\`n"
            }
        }

        Write-Output "OCR_START"
        Write-Output $ocrText
        Write-Output "OCR_END"
    } else {
        Write-Output "No OCR engine found"
    }
} catch {
    Write-Error $_.Exception.Message
} finally {
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force
    }
}
`;

    fs.writeFileSync(tempScriptPath, psScript, 'utf8');

    return new Promise((resolve, reject) => {
      const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tempScriptPath, process.pid.toString()]);
      let stdout = '';
      let stderr = '';
      let windowsRestored = false;

      function restoreWindows() {
        if (windowsRestored) return;
        windowsRestored = true;
        const capWin = getCaptureWindow();
        const teleWin = getTeleprompterWindow();
        const topWin = getTopBarWindow();
        if (hideOverlay && capWin && !capWin.isDestroyed()) {
          capWin.showInactive();
        }
        if (hideTeleprompter && teleWin && !teleWin.isDestroyed()) {
          teleWin.setOpacity(1);
        }
        if (hideTopbar && topWin && !topWin.isDestroyed()) {
          topWin.setOpacity(1);
        }
      }

      child.stdout.on('data', (data) => {
        const str = data.toString();
        stdout += str;
        if (str.includes('SCREENSHOT_CAPTURED')) {
          restoreWindows();
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        restoreWindows();

        try {
          if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath);
        } catch (err) {
          console.error('[ocr-win] Failed to cleanup temp script:', err.message);
        }

        if (code !== 0) {
          reject(new Error(`PowerShell exited with code ${code}: ${stderr}`));
          return;
        }

        const match = stdout.match(/OCR_START\r?\n([\s\S]*?)\r?\nOCR_END/);
        if (match) {
          resolve(match[1].trim());
        } else {
          resolve('');
        }
      });
    });
  } catch (err) {
    const capWin = getCaptureWindow();
    const teleWin = getTeleprompterWindow();
    const topWin = getTopBarWindow();
    if (hideOverlay && capWin && !capWin.isDestroyed()) {
      capWin.showInactive();
    }
    if (hideTeleprompter && teleWin && !teleWin.isDestroyed()) {
      teleWin.setOpacity(1);
      setWindowCaptureExclusion(teleWin, isExcludedFromCapture);
    }
    if (hideTopbar && topWin && !topWin.isDestroyed()) {
      topWin.setOpacity(1);
      setWindowCaptureExclusion(topWin, isExcludedFromCapture);
    }
    throw err;
  }
}

async function captureDesktopScreenshotFallback() {
  const capWin = getCaptureWindow();
  const teleWin = getTeleprompterWindow();
  const topWin = getTopBarWindow();

  const overlayVisible = capWin && !capWin.isDestroyed() && capWin.isVisible();
  const teleprompterVisible = teleWin && !teleWin.isDestroyed() && teleWin.isVisible();
  const topbarVisible = topWin && !topWin.isDestroyed() && topWin.isVisible();

  const hideOverlay = overlayVisible;
  const hideTeleprompter = teleprompterVisible;
  const hideTopbar = topbarVisible;

  try {
    if (hideOverlay) {
      capWin.hide();
    }
    if (hideTeleprompter) {
      teleWin.setOpacity(0);
    }
    if (hideTopbar) {
      topWin.setOpacity(0);
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor || 1;
    const captureWidth = Math.round(width * scaleFactor);
    const captureHeight = Math.round(height * scaleFactor);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: captureWidth, height: captureHeight },
    });

    if (sources && sources.length > 0) {
      const primaryScreen = sources[0];
      const thumbnail = primaryScreen.thumbnail;
      if (thumbnail && !thumbnail.isEmpty()) {
        return thumbnail.toJPEG(90);
      }
    }
  } catch (err) {
    console.error('[ipcHandlers] captureDesktopScreenshotFallback error:', err);
  } finally {
    const capWin = getCaptureWindow();
    const teleWin = getTeleprompterWindow();
    const topWin = getTopBarWindow();
    if (hideOverlay && capWin && !capWin.isDestroyed()) {
      capWin.showInactive();
    }
    if (hideTeleprompter && teleWin && !teleWin.isDestroyed()) {
      teleWin.setOpacity(1);
    }
    if (hideTopbar && topWin && !topWin.isDestroyed()) {
      topWin.setOpacity(1);
    }
  }
  return null;
}

async function performCaptureAndOcr() {
  if (process.platform === 'win32') {
    try {
      logCapture('Running runPowerShellCaptureOcr...');
      const text = await runPowerShellCaptureOcr();
      logCapture(`runPowerShellCaptureOcr returned text length: ${text?.length}`);
      if (text !== null && text !== undefined) {
        try {
          fs.writeFileSync(path.join(__dirname, '../debug_ocr.txt'), text, 'utf8');
        } catch (_) {}
        return text;
      }
    } catch (err) {
      logCapture(`runPowerShellCaptureOcr threw error: ${err.message}`);
    }
  }

  try {
    logCapture('Running Tesseract fallback...');
    const imageBuffer = await captureDesktopScreenshotFallback();
    if (imageBuffer) {
      logCapture('Tesseract fallback: captured screenshot buffer successfully');
      const { createWorker } = require('tesseract.js');
      logCapture('Creating Tesseract worker...');
      const worker = await createWorker('eng', 1, {
        langPath: path.join(__dirname, '..'), // Folder containing eng.traineddata
        cachePath: path.join(__dirname, '..'),
      });
      logCapture('Running Tesseract recognition...');
      const result = await worker.recognize(imageBuffer);
      await worker.terminate();
      const text = result.data?.text || '';
      logCapture(`Tesseract completed. Text length: ${text?.length}`);
      try {
        fs.writeFileSync(path.join(__dirname, '../debug_ocr.txt'), text, 'utf8');
      } catch (_) {}
      return text;
    } else {
      logCapture('Tesseract fallback: failed to capture screenshot buffer');
    }
  } catch (err) {
    logCapture(`Tesseract fallback failed: ${err.message}`);
  }
  return '';
}

function deduplicateQuestions(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const seen = new Set();
  const result = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Normalize string for comparison: lowercase, remove non-alphanumeric, collapse spaces
    const normalized = trimmed.toLowerCase()
      .replace(/^[0-9]+[\.\-\s]*/, '') // Remove leading numbers (e.g. "2. what is..." -> "what is...")
      .replace(/[^\w\s]/g, '')         // Remove punctuation
      .replace(/\s+/g, ' ')            // Normalize whitespace
      .trim();

    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(trimmed);
    }
  }

  return result.join('\n');
}

function setupIpcHandlers() {
  let audioChunkCount = 0;
  let interviewerConn = null;
  let candidateConn = null;

  ipcMain.on('toggle-screen-share-visibility', () => {
    isExcludedFromCapture = !isExcludedFromCapture;
  });

  ipcMain.on('interview-session-meta', (_, meta) => {
    if (meta) {
      if (typeof meta.tech === 'string') {
        sessionTech = meta.tech.trim();
      }
      if (meta.resumeContext) {
        sessionResumeContext = typeof meta.resumeContext === 'object' ? JSON.stringify(meta.resumeContext) : String(meta.resumeContext);
      } else if (meta.resumeText || meta.profile || meta.resumeProfile) {
        sessionResumeContext = JSON.stringify({
          resumeText: meta.resumeText || '',
          profile: meta.profile || meta.resumeProfile || {},
          preview: meta.preview || meta.resumePreview || null
        });
      }
      console.log(`[interview-session-meta] Updated. tech: "${sessionTech}", resumeContext length: ${sessionResumeContext.length}`);
    }
  });

  ipcMain.on('interview-resume-sync', (_, data) => {
    if (data) {
      sessionResumeContext = typeof data === 'object' ? JSON.stringify(data) : String(data);
      console.log(`[interview-resume-sync] Synced resume context (${sessionResumeContext.length} chars)`);
    }
  });

  ipcMain.on('interview-auth-sync', (_, { token, baseUrl }) => {
    const apiBase = baseUrl || process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:4000';
    setInterviewAuth(token, apiBase);
  });

  ipcMain.on('interview-session-audio', (_, data) => {
    pendingSessionAudio = toBuffer(data);
  });

  ipcMain.on('prepare-capture', async (_, mode) => {
    if (!process.env.DEEPGRAM_API_KEY) {
      safeSend(getCaptureWindow(), 'capture-error', 'Set DEEPGRAM_API_KEY in .env');
      return;
    }
    const capWin = getCaptureWindow();
    if (capWin && !capWin.isDestroyed()) {
      try {
        capWin.setAlwaysOnTop(false);
        capWin.show();
        capWin.focus();
      } catch (e) {
        console.error('[prepare-capture] failed to disable alwaysOnTop:', e);
      }
    }
    safeSend(getCaptureWindow(), 'do-capture', mode);
  });

  const BATCH_CHUNKS = 1;
  const BATCH_FLUSH_MS = 50;
  const interviewerBuf = [];
  const candidateBuf = [];
  let interviewerFlushTimer = null;
  let candidateFlushTimer = null;

  function flushInterviewer() {
    interviewerFlushTimer = null;
    if (interviewerBuf.length === 0 || !interviewerConn?.send) return;
    const combined = Buffer.concat(interviewerBuf.splice(0, interviewerBuf.length));
    if (combined.length > 0) interviewerConn.send(combined);
  }

  function flushCandidate() {
    candidateFlushTimer = null;
    if (candidateBuf.length === 0 || !candidateConn?.send) return;
    const combined = Buffer.concat(candidateBuf.splice(0, candidateBuf.length));
    if (combined.length > 0) candidateConn.send(combined);
  }

  ipcMain.on('audio-chunk', (_, data) => {
    const buffer = toBuffer(data);
    if (buffer && buffer.length > 0) {
      audioChunkCount++;
      if (audioChunkCount % 100 === 0) {
        console.log(`[backend-notetaker] Received 100 audio chunks (total: ${audioChunkCount})`);
      }
      sendAudioChunk(buffer);
    }
  });

  ipcMain.on('audio-chunk-interviewer', (_, data) => {
    const buffer = toBuffer(data);
    if (!buffer || buffer.length === 0 || !interviewerConn?.send) return;
    interviewerBuf.push(buffer);
    if (interviewerBuf.length >= BATCH_CHUNKS) {
      flushInterviewer();
    } else if (!interviewerFlushTimer) {
      interviewerFlushTimer = setTimeout(flushInterviewer, BATCH_FLUSH_MS);
    }
  });

  let lastMicLogTime = 0;

  ipcMain.on('set-candidate-mic-active', (_, active) => {
    candidateMicActive = !!active;
    console.log(`[backend-mic] Candidate mic state changed: active = ${candidateMicActive}`);
    if (!candidateMicActive) {
      candidateBuf.splice(0, candidateBuf.length);
      if (candidateFlushTimer) {
        clearTimeout(candidateFlushTimer);
        candidateFlushTimer = null;
      }
    }
  });

  ipcMain.on('audio-chunk-candidate', (_, data) => {
    if (!candidateMicActive) return;
    const buffer = toBuffer(data);
    if (!buffer || buffer.length === 0 || !candidateConn?.send) return;

    const now = Date.now();
    if (now - lastMicLogTime > 5000) {
      console.log(`[backend-mic] Candidate audio chunk active (len: ${buffer.length})`);
      lastMicLogTime = now;
    }

    candidateBuf.push(buffer);
    if (candidateBuf.length >= BATCH_CHUNKS) {
      flushCandidate();
    } else if (!candidateFlushTimer) {
      candidateFlushTimer = setTimeout(flushCandidate, BATCH_FLUSH_MS);
    }
  });

  ipcMain.on('capture-started', async (_, sampleRate, mode, languageCode, targetLanguageCode, spokenLanguage, targetLanguage, speechEngineParam) => {
    const rate = sampleRate || 44100;
    
    let speechEngine = 'deepgram';
    if (speechEngineParam === 'google' || speechEngineParam === 'deepgram' || speechEngineParam === 'sarvam') {
      speechEngine = speechEngineParam;
    } else if (languageCode === 'google' || languageCode === 'deepgram' || languageCode === 'sarvam') {
      speechEngine = languageCode;
    }

    const connectFn = (speechEngine === 'google')
      ? createGoogleConnection
      : (speechEngine === 'sarvam')
        ? createSarvamConnection
        : createConnection;

    transcriptEntries = [];
    questionsHistory = [];
    pendingSessionAudio = null;
    sessionStartMs = Date.now();
    currentCaptureMode = mode || '';
    spokenLanguageName = spokenLanguage || '';
    targetLanguageName = targetLanguage || '';
    lastGeneratedNotes = '';
    lastGeneratedAiNotes = '';
    if (mode === 'notetaker') {
      candidateMicActive = true;
    }

    const activeLanguage = (languageCode && languageCode !== 'google' && languageCode !== 'deepgram' && languageCode !== 'sarvam')
      ? languageCode
      : (spokenLanguage || 'en-US');

    if (mode === 'both' || mode === 'notetaker') {
      interviewerConn = await connectFn(
        'interviewer',
        rate,
        async (text, isFinal, speaker, options) => {
          if (text) {
            sendTranscript('interviewer', text, isFinal, speaker, options);
            if (isFinal && mode !== 'notetaker') {
              queueQuestionSegment('interviewer', text);
            }
          }
        },
        (err) => console.error(`[${speechEngine}] interviewer error:`, err ? (err.message || err) : 'unknown error'),
        activeLanguage
      );
      candidateConn = await connectFn(
        'candidate',
        rate,
        async (text, isFinal, speaker, options) => {
          if (text) {
            console.log(`[backend-mic] Candidate transcribed text: "${text}" (isFinal: ${isFinal})`);
            sendTranscript('candidate', text, isFinal, speaker, options);
            if (isFinal && mode !== 'notetaker') {
              queueQuestionSegment('candidate', text);
            }
          }
        },
        (err) => console.error(`[${speechEngine}] candidate error:`, err ? (err.message || err) : 'unknown error'),
        activeLanguage
      );

      // Fallback from Deepgram to Google Speech if connection fails
      if ((!interviewerConn || !candidateConn) && speechEngine === 'deepgram') {
        console.warn('[capture] Deepgram connection failed. Falling back to Google Speech...');
        speechEngine = 'google';
        const googleConnectFn = createGoogleConnection;
        interviewerConn = await googleConnectFn(
          'interviewer',
          rate,
          async (text, isFinal, speaker, options) => {
            if (text) {
              sendTranscript('interviewer', text, isFinal, speaker, options);
              if (isFinal && mode !== 'notetaker') {
                queueQuestionSegment('interviewer', text);
              }
            }
          },
          (err) => console.error(`[google] interviewer error:`, err ? (err.message || err) : 'unknown error'),
          activeLanguage
        );
        candidateConn = await googleConnectFn(
          'candidate',
          rate,
          async (text, isFinal, speaker, options) => {
            if (text) {
              console.log(`[backend-mic] Candidate transcribed text: "${text}" (isFinal: ${isFinal})`);
              sendTranscript('candidate', text, isFinal, speaker, options);
              if (isFinal && mode !== 'notetaker') {
                queueQuestionSegment('candidate', text);
              }
            }
          },
          (err) => console.error(`[google] candidate error:`, err ? (err.message || err) : 'unknown error'),
          activeLanguage
        );
      }

      if (!interviewerConn || !candidateConn) {
        safeSend(getCaptureWindow(), 'capture-error', `Failed to start ${speechEngine}`);
        return;
      }
    } else {
      const singleConnectFn = (speechEngine === 'google')
        ? startGoogleConnection
        : (speechEngine === 'sarvam')
          ? startSarvamConnection
          : startDeepgramConnection;
      let started = await singleConnectFn(
        rate,
        async (text, isFinal, speaker, options) => {
          if (text) {
            sendTranscript('combined', text, isFinal, speaker, options);
            if (mode !== 'notetaker' && isFinal) {
              queueQuestionSegment(`speaker_${speaker}`, text);
            }
          }
        },
        (err) => console.error(`[${speechEngine}] error:`, err ? (err.message || err) : 'unknown error'),
        () => {},
        languageCode
      );

      // Fallback from Deepgram to Google Speech if connection fails
      if (!started && speechEngine === 'deepgram') {
        console.warn('[capture] Deepgram connection failed. Falling back to Google Speech...');
        speechEngine = 'google';
        started = await startGoogleConnection(
          rate,
          async (text, isFinal, speaker, options) => {
            if (text) {
              sendTranscript('combined', text, isFinal, speaker, options);
              if (mode !== 'notetaker' && isFinal) {
                queueQuestionSegment(`speaker_${speaker}`, text);
              }
            }
          },
          (err) => console.error(`[google] error:`, err ? (err.message || err) : 'unknown error'),
          () => {},
          languageCode
        );
      }

      if (!started) {
        safeSend(getCaptureWindow(), 'capture-error', `Failed to start ${speechEngine === 'google' ? 'Google Speech' : 'Deepgram'}`);
        return;
      }
    }

    safeSend(getCaptureWindow(), 'capture-started', mode);
    safeSend(getTopBarWindow(), 'capture-started', mode);

    // Restore always-on-top for overlay mode
    const capWin = getCaptureWindow();
    if (capWin && !capWin.isDestroyed() && currentCaptureMode === 'both') {
      try {
        capWin.setAlwaysOnTop(true, 'screen-saver');
      } catch (e) {
        console.error('[capture-started] failed to restore alwaysOnTop:', e);
      }
    }
  });

  ipcMain.on('capture-stopped', async (event, options) => {
    const discard = options?.discard || false;
    audioChunkCount = 0;
    candidateMicActive = false;
    if (interviewerFlushTimer) clearTimeout(interviewerFlushTimer);
    if (candidateFlushTimer) clearTimeout(candidateFlushTimer);
    if (questionDebounceTimer) {
      clearTimeout(questionDebounceTimer);
      questionDebounceTimer = null;
    }
    activeQuestionText = '';
    activeQuestionSpeaker = null;
    interviewerBuf.length = 0;
    candidateBuf.length = 0;
    if (interviewerConn?.stop) {
      await interviewerConn.stop();
      interviewerConn = null;
    }
    if (candidateConn?.stop) {
      await candidateConn.stop();
      candidateConn = null;
    }
    await stopDeepgramConnection();

    console.log('[capture-stopped] Audio capture stopped. Session persistence will only occur if user submits Save Session modal in UI.');
    sessionStartMs = null;

    safeSend(getCaptureWindow(), 'capture-stopped');
    safeSend(getTopBarWindow(), 'capture-stopped');

    // Restore always-on-top for overlay mode
    const capWin = getCaptureWindow();
    if (capWin && !capWin.isDestroyed() && currentCaptureMode === 'both') {
      try {
        capWin.setAlwaysOnTop(true, 'screen-saver');
      } catch (e) {
        console.error('[capture-stopped] failed to restore alwaysOnTop:', e);
      }
    }
  });

  ipcMain.on('capture-error', (_, msg) => {
    // Restore always-on-top for overlay mode on error
    const capWin = getCaptureWindow();
    if (capWin && !capWin.isDestroyed() && currentCaptureMode === 'both') {
      try {
        capWin.setAlwaysOnTop(true, 'screen-saver');
      } catch (e) {
        console.error('[capture-error] failed to restore alwaysOnTop:', e);
      }
    }
    safeSend(getCaptureWindow(), 'capture-error', msg || 'Capture failed');
  });

  ipcMain.on('teleprompter-capture-request', async (event) => {
    logCapture('teleprompter-capture-request received');
    try {
      logCapture('Calling performCaptureAndOcr...');
      const ocrText = await performCaptureAndOcr();
      logCapture(`performCaptureAndOcr completed. Raw text length: ${ocrText?.length}`);
      if (ocrText && ocrText.trim()) {
        logCapture('Extracting active question/code from OCR...');
        const extracted = await extractQuestionOrCodeFromOcrText(ocrText);
        logCapture(`Extracted question/code: "${extracted}"`);
        const cleanExtracted = extracted && extracted.trim();
        if (cleanExtracted) {
          if (!event.sender.isDestroyed()) {
            event.sender.send('captured-question', cleanExtracted);
          }
          return;
        }
      } else {
        logCapture('performCaptureAndOcr returned empty/null text');
      }
    } catch (err) {
      logCapture(`Capture/OCR failed: ${err.message}\nStack: ${err.stack}`);
      console.error('[teleprompter-capture] Background screenshot capture / OCR failed:', err);
    }

    if (!event.sender.isDestroyed()) {
      event.sender.send('captured-question', null);
    }
  });

  ipcMain.on('current-question-response', (event, questionText) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('captured-question', questionText);
    }
  });

  ipcMain.on('copilot-generate-answer', async (event, question, mode = 'normal', language = 'en', incomingHistory = null, resumeContext = '') => {
    if (!question || !question.trim()) return;
    const q = question.trim();
    if (!isInterviewQuestion(q)) {
      console.log('[copilot-generate-answer] Skipping non-question speech:', q);
      return;
    }
    
    const cleanQ = q.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const now = Date.now();
    if (lastAnsweredQuestion && (now - lastAnsweredTime < 1500)) {
      const cleanLast = lastAnsweredQuestion.toLowerCase().replace(/[^\w\s]/g, '').trim();
      if (cleanQ === cleanLast) {
        console.log('[copilot-generate-answer] Redundant duplicate request skipped:', q);
        return;
      }
    }
    lastAnsweredQuestion = q;
    lastAnsweredTime = now;

    logCapture(`copilot-generate-answer received. question: "${q.slice(0, 50)}...", mode: "${mode}"`);
    
    // 1. Cancel in-flight answers and reset UI to 'Thinking…' for this question
    const thisGenId = ++currentGenerationId;
    sendAiAnswerStart(q);
    
    const panelErr = (reason) =>
      /timeout|network|ECONNREFUSED/i.test(String(reason?.message || reason))
        ? 'Slow connection. Please check your internet and try again.'
        : 'Failed to generate answer.';

    const effectiveHistory = (Array.isArray(incomingHistory) && incomingHistory.length > 0)
      ? incomingHistory
      : questionsHistory;
    const effectiveResumeContext = resumeContext || sessionResumeContext || sessionTech || '';
        
    try {
      // 2. Generate in parallel
      const [resA, resB] = await Promise.allSettled([
        generateAnswer(
          q,
          'a',
          (partial) => {
            if (thisGenId === currentGenerationId) sendAiAnswer(q, partial, true, 'a');
          },
          (retryMsg) => {
            if (thisGenId === currentGenerationId) sendAiAnswer(q, retryMsg, true, 'a');
          },
          mode,
          effectiveHistory,
          effectiveResumeContext,
          language
        ),
        generateAnswer(
          q,
          'b',
          (partial) => {
            if (thisGenId === currentGenerationId) sendAiAnswer(q, partial, true, 'b');
          },
          (retryMsg) => {
            if (thisGenId === currentGenerationId) sendAiAnswer(q, retryMsg, true, 'b');
          },
          mode,
          effectiveHistory,
          effectiveResumeContext,
          language
        ),
      ]);

      if (thisGenId !== currentGenerationId) {
        console.log(`[copilot] Generation ${thisGenId} superseded by ${currentGenerationId}. Discarding stale answer.`);
        return;
      }

      const answerA =
        resA.status === 'fulfilled' ? (resA.value || '').trim() : panelErr(resA.reason);
      const answerB =
        resB.status === 'fulfilled' ? (resB.value || '').trim() : panelErr(resB.reason);
        
      // 3. Send final updates
      sendAiAnswer(q, answerA, false, 'a');
      sendAiAnswer(q, answerB, false, 'b');

      // Update in questionsHistory as well
      const existingQ = questionsHistory.find(item => item.question === q);
      if (existingQ) {
        existingQ.answerA = answerA;
        existingQ.answerB = answerB;
      } else {
        questionsHistory.push({
          question: q,
          answerA,
          answerB,
          timeSecs: nowSessionSecs(),
          status: 'done'
        });
      }
    } catch (err) {
      console.error('[ai] copilot-generate-answer error:', err.message);
      const msg = panelErr(err);
      sendAiAnswer(q, msg, false, 'a');
      sendAiAnswer(q, msg, false, 'b');
    }
  });

  ipcMain.on('teleprompter-generate-answer', async (event, question, mode = 'normal') => {
    logCapture(`teleprompter-generate-answer received. question: "${question.slice(0, 50)}...", mode: "${mode}"`);
    try {
      await generateAnswer(
        question,
        'teleprompter', // Teleprompter custom prompt
        (partial) => {
          if (!event.sender.isDestroyed()) {
            logCapture(`teleprompter-generate-answer yielding chunk length: ${partial.length}`);
            event.reply('teleprompter-answer-chunk', { answer: partial, isStreaming: true });
          }
        },
        null,
        mode,
        questionsHistory,
        sessionResumeContext || sessionTech || '',
        spokenLanguageName || 'en'
      );
      if (!event.sender.isDestroyed()) {
        logCapture('teleprompter-generate-answer generation complete');
        event.reply('teleprompter-answer-chunk', { answer: '', isStreaming: false });
      }
    } catch (err) {
      logCapture(`teleprompter-generate-answer generation failed: ${err.message}`);
      console.error('[teleprompter-ai] Error generating answer:', err.message);
      if (!event.sender.isDestroyed()) {
        event.reply('teleprompter-answer-chunk', { answer: 'Failed to generate answer: ' + err.message, isStreaming: false });
      }
    }
  });

  ipcMain.on('topbar-capture-request', async (event, mode = 'normal') => {
    try {
      console.log('[topbar-capture] Hiding windows and capturing screenshot...');
      const ocrText = await performCaptureAndOcr();
      console.log('[topbar-capture] OCR completed. Extracted raw text length:', ocrText.length);
      if (ocrText && ocrText.trim()) {
        console.log('[topbar-capture] Extracting active question/code from OCR text...');
        const extracted = await extractQuestionOrCodeFromOcrText(ocrText);
        console.log('[topbar-capture] Extracted question/code text:', extracted);
        const cleanExtracted = extracted && extracted.trim();
        const isCode = cleanExtracted && !isInterviewQuestion(cleanExtracted) && isQuestionOrCode(cleanExtracted);
        const processedText = isCode ? cleanExtracted : deduplicateQuestions(cleanExtracted);
        console.log('[topbar-capture] Processed question/code text (isCode=' + isCode + '):', processedText);
        const cleanProcessed = processedText && processedText.trim();
        if (cleanProcessed) {
          if (!event.sender.isDestroyed()) {
            event.sender.send('captured-question', cleanProcessed);
          }
          return;
        }
      }
    } catch (err) {
      console.error('[topbar-capture] Background screenshot capture / OCR failed:', err);
    }

    if (!event.sender.isDestroyed()) {
      event.sender.send('captured-question', null);
    }
  });

  ipcMain.on('topbar-generate-answer', async (event, question, mode = 'normal') => {
    try {
      await generateAnswer(
        question,
        'teleprompter', // Use teleprompter prompt to handle both code checking/correcting and questions
        (partial) => {
          if (!event.sender.isDestroyed()) {
            event.reply('topbar-answer-chunk', { answer: partial, isStreaming: true });
          }
        },
        null,
        mode,
        questionsHistory
      );
      if (!event.sender.isDestroyed()) {
        event.reply('topbar-answer-chunk', { answer: '', isStreaming: false });
      }
    } catch (err) {
      console.error('[topbar-ai] Error generating answer:', err.message);
      if (!event.sender.isDestroyed()) {
        event.reply('topbar-answer-chunk', { answer: 'Failed to generate answer: ' + err.message, isStreaming: false });
      }
    }
  });

  ipcMain.on('topbar-resize-request', (event, mode) => {
    const topWin = getTopBarWindow();
    if (!topWin || topWin.isDestroyed()) return;
    if (mode === 'topbar-idle') {
      topWin.setSize(1000, 45);
    } else if (mode === 'topbar-active') {
      topWin.setSize(1000, 550);
    }
  });

  ipcMain.on('topbar-toggle-listening', () => {
    safeSend(getCaptureWindow(), 'topbar-toggle-listening-trigger');
  });

  ipcMain.on('topbar-timer-update', (_, timerText) => {
    safeSend(getTopBarWindow(), 'topbar-timer-update', timerText);
  });

  ipcMain.handle('generate-notes', async (event, { transcript, spokenLanguage, targetLanguage }) => {
    logCapture(`generate-notes invoked. spokenLanguage: ${spokenLanguage}, targetLanguage: ${targetLanguage}, transcriptLength: ${transcript ? transcript.length : 0}`);
    if (lastGeneratedNotes) {
      logCapture(`returning pre-generated lastGeneratedNotes. Length: ${lastGeneratedNotes.length}`);
      const notes = lastGeneratedNotes;
      lastGeneratedNotes = '';
      return { ok: true, notes };
    }
    try {
      logCapture('calling generateNotes API...');
      const notes = await generateNotes(transcript, spokenLanguage, targetLanguage);
      logCapture(`generateNotes API returned notes. Length: ${notes ? notes.length : 0}`);
      return { ok: true, notes };
    } catch (err) {
      logCapture(`[generate-notes] error: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('generate-ai-notes', async (event, { transcript, spokenLanguage, targetLanguage }) => {
    logCapture(`generate-ai-notes invoked. spokenLanguage: ${spokenLanguage}, targetLanguage: ${targetLanguage}, transcriptLength: ${transcript ? transcript.length : 0}`);
    if (lastGeneratedAiNotes) {
      logCapture(`returning pre-generated lastGeneratedAiNotes. Length: ${lastGeneratedAiNotes.length}`);
      const notes = lastGeneratedAiNotes;
      lastGeneratedAiNotes = '';
      return { ok: true, notes };
    }
    try {
      logCapture('calling generateAiNotes API...');
      const notes = await generateAiNotes(transcript, spokenLanguage, targetLanguage);
      logCapture(`generateAiNotes API returned notes. Length: ${notes ? notes.length : 0}`);
      return { ok: true, notes };
    } catch (err) {
      logCapture(`[generate-ai-notes] error: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('translate-text', async (event, { text, from, to, engine }) => {
    try {
      const translated = await translateText(text, from, to, engine);
      return translated;
    } catch (err) {
      console.error('[ipcHandlers] translate-text error:', err.message);
      return text;
    }
  });

  ipcMain.handle('get-translation-tts', async (event, { text, langCode }) => {
    try {
      if (!text) return '';

      // Google TTS has a 200 character limit. Split text into safe chunks of max 150 characters
      const chunks = [];
      const words = text.split(/\s+/);
      let currentChunk = '';

      for (const word of words) {
        if ((currentChunk + ' ' + word).length > 150) {
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = word;
        } else {
          currentChunk = currentChunk ? (currentChunk + ' ' + word) : word;
        }
      }
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      const buffers = [];
      for (const chunk of chunks) {
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
        const res = await fetch(ttsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://translate.google.com/'
          }
        });
        if (!res.ok) {
          throw new Error(`Google TTS HTTP ${res.status}`);
        }
        const arrayBuffer = await res.arrayBuffer();
        buffers.push(Buffer.from(arrayBuffer));
      }

      const combinedBuffer = Buffer.concat(buffers);
      const base64 = combinedBuffer.toString('base64');
      return base64;
    } catch (err) {
      console.error('[ipcHandlers] get-translation-tts error:', err.message);
      throw err;
    }
  });

  ipcMain.handle('get-active-model-name', () => {
    if (process.env.GROQ_API_KEY) {
      return 'grok-4.20-0309-non-reasoning';
    }
    if (process.env.OPENAI_API_KEY) {
      return 'gpt-4o-mini';
    }
    return 'none';
  });

  ipcMain.handle('export-to-pdf', async (event, { html, htmlContent, filename, defaultFilename }) => {
    let tempWin = null;
    let tempFilePath = null;
    try {
      const { BrowserWindow, dialog } = require('electron');
      const fs = require('fs');
      const path = require('path');

      const content = html || htmlContent;
      const targetFilename = filename || defaultFilename || `report_${Date.now()}.pdf`;

      tempFilePath = path.join(app.getPath('temp'), `report_${Date.now()}.html`);
      fs.writeFileSync(tempFilePath, content, 'utf8');

      tempWin = new BrowserWindow({
        show: false,
        webPreferences: {
          offscreen: true
        }
      });

      await new Promise((resolve, reject) => {
        tempWin.webContents.once('did-finish-load', resolve);
        tempWin.webContents.once('did-fail-load', (e, errorCode, errorDescription) => {
          reject(new Error(`Failed to load temp HTML file: ${errorDescription}`));
        });
        tempWin.loadFile(tempFilePath).catch(reject);
      });

      const pdfBuffer = await tempWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      const parentWin = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

      const { filePath } = await dialog.showSaveDialog(parentWin, {
        title: 'Save PDF Report',
        defaultPath: targetFilename,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });

      if (filePath) {
        fs.writeFileSync(filePath, pdfBuffer);
        return { ok: true, filePath };
      }

      return { ok: false, error: 'Cancelled' };
    } catch (err) {
      console.error('[ipcHandlers] export-to-pdf error:', err);
      return { ok: false, error: err.message };
    } finally {
      if (tempWin) {
        try {
          tempWin.destroy();
        } catch (_) {}
      }
      if (tempFilePath) {
        try {
          const fs = require('fs');
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (_) {}
      }
    }
  });

  ipcMain.handle('notetaker-chat-reply', async (event, { message, history }) => {
    try {
      const reply = await generateNotetakerChatReply(message, history);
      return { ok: true, reply };
    } catch (err) {
      console.error('[ipcHandlers] notetaker-chat-reply error:', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Voice Agent Native WebSocket Bridge ──
  let voiceAgentWs = null;

  ipcMain.on('voice-agent-connect', (event) => {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error('[voice-agent-ipc] DEEPGRAM_API_KEY is not set in environment.');
      if (!event.sender.isDestroyed()) {
        event.sender.send('voice-agent-err', 'DEEPGRAM_API_KEY is missing. Please configure it in your settings.');
        event.sender.send('voice-agent-closed', 1008, 'API key missing');
      }
      return;
    }

    if (voiceAgentWs) {
      try { voiceAgentWs.close(); } catch (_) {}
      voiceAgentWs = null;
    }

    console.log('[voice-agent-ipc] Connecting to Deepgram Agent API...');
    try {
      const dgWs = new WebSocket('wss://agent.deepgram.com/v1/agent/converse', {
        headers: { Authorization: `Token ${apiKey}` }
      });
      voiceAgentWs = dgWs;

      const queue = [];

      dgWs.on('open', () => {
        console.log('[voice-agent-ipc] Connected to Deepgram Voice Agent API successfully.');
        if (!event.sender.isDestroyed()) {
          event.sender.send('voice-agent-open');
        }
        while (queue.length > 0 && dgWs.readyState === WebSocket.OPEN) {
          const item = queue.shift();
          dgWs.send(item.data, { binary: item.isBinary });
        }
      });

      dgWs.on('message', (data, isBinary) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('voice-agent-msg', data, isBinary);
        }
      });

      dgWs.on('error', (err) => {
        console.error('[voice-agent-ipc] Deepgram Voice Agent WS error:', err.message);
        if (!event.sender.isDestroyed()) {
          event.sender.send('voice-agent-err', err.message || 'Voice agent provider error.');
        }
      });

      dgWs.on('close', (code, reason) => {
        console.log(`[voice-agent-ipc] Deepgram Voice Agent WS closed: code=${code}, reason=${reason ? reason.toString() : 'none'}`);
        if (!event.sender.isDestroyed()) {
          event.sender.send('voice-agent-closed', code, reason ? reason.toString() : '');
        }
        if (voiceAgentWs === dgWs) {
          voiceAgentWs = null;
        }
      });

      dgWs._queue = queue;
    } catch (err) {
      console.error('[voice-agent-ipc] Connection error:', err);
      if (!event.sender.isDestroyed()) {
        event.sender.send('voice-agent-err', err.message);
        event.sender.send('voice-agent-closed', 1006, err.message);
      }
    }
  });

  ipcMain.on('voice-agent-send', (event, data) => {
    if (voiceAgentWs) {
      const isBinary = Buffer.isBuffer(data) || data instanceof ArrayBuffer || ArrayBuffer.isView(data);
      if (voiceAgentWs.readyState === WebSocket.OPEN) {
        voiceAgentWs.send(data, { binary: isBinary });
      } else if (voiceAgentWs.readyState === WebSocket.CONNECTING && voiceAgentWs._queue) {
        voiceAgentWs._queue.push({ data, isBinary });
      }
    }
  });

  ipcMain.on('voice-agent-close', () => {
    if (voiceAgentWs) {
      try {
        if (voiceAgentWs.readyState === WebSocket.OPEN || voiceAgentWs.readyState === WebSocket.CONNECTING) {
          voiceAgentWs.close(1000, 'Closed by client');
        }
      } catch (_) {}
      voiceAgentWs = null;
    }
  });

  // Setup self-contained embedded backend handlers
  setupEmbeddedBackendIpcHandlers(ipcMain);
}

function toBuffer(data) {
  if (data == null) return null;
  if (Buffer.isBuffer(data)) return data;
  
  try {
    if (data instanceof ArrayBuffer) {
      return Buffer.from(new Uint8Array(data));
    }
    if (data instanceof Uint8Array || data instanceof Int16Array || data instanceof Float32Array) {
      return Buffer.from(data.buffer, data.byteOffset || 0, data.byteLength);
    }
    if (data && typeof data === 'object' && data.byteLength !== undefined) {
      if (data.buffer instanceof ArrayBuffer) {
        return Buffer.from(data.buffer, data.byteOffset || 0, data.byteLength);
      }
      return Buffer.from(Uint8Array.from(data));
    }
    return Buffer.from(data);
  } catch (e) {
    console.error('[toBuffer] Error converting data to Buffer:', e);
    return null;
  }
}

function getBackgroundWindowTitle() {
  const psScript = `
$code = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
Add-Type -TypeDefinition $code -ErrorAction Stop

$teleprompterHwnd = [Win32]::GetForegroundWindow()
$hwnd = $teleprompterHwnd
$attempts = 0
$resultObj = $null
$bgHwnd = [IntPtr]::Zero

while ($hwnd -ne [IntPtr]::Zero -and $attempts -lt 100 -and $null -eq $resultObj) {
    $sb = New-Object System.Text.StringBuilder 512
    $len = [Win32]::GetWindowText($hwnd, $sb, $sb.Capacity)
    $title = $sb.ToString()
    
    $processId = 0
    [Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId) | Out-Null
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    $procName = if ($process) { $process.ProcessName } else { "" }

    if ($title -and $procName -match "chrome|msedge|brave|firefox|opera|safari|iexplore|notepad") {
        if ($title -notmatch '^(Default IME|MSCTFIME UI|Chrome Legacy Window|ConfPopup.*|New Tab|Google|YouTube|Untitled|New Document)$') {
            $bgHwnd = $hwnd
            $resultObj = @{ Process = $procName; Title = $title }
        }
    }
    $hwnd = [Win32]::GetWindow($hwnd, 2)
    $attempts++
}

$clipText = ""
if ($bgHwnd -ne [IntPtr]::Zero) {
    # Bring the background window to the foreground, copy, and restore teleprompter
    [Win32]::SetForegroundWindow($bgHwnd) | Out-Null
    Start-Sleep -Milliseconds 150
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait("^c")
        Start-Sleep -Milliseconds 150
        $clipText = [System.Windows.Forms.Clipboard]::GetText()
    } catch {}
    [Win32]::SetForegroundWindow($teleprompterHwnd) | Out-Null
}

if ($resultObj) {
    if ($clipText -and $clipText.Trim()) {
        $resultObj.Clipboard = $clipText.Trim()
    }
    Write-Output "JSON_START"
    $resultObj | ConvertTo-Json -Compress
    Write-Output "JSON_END"
} else {
    Write-Output "No resultObj found"
}
`;

  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const tempFilePath = path.join(app.getPath('temp'), `temp_script_${uniqueId}.ps1`);
  fs.writeFileSync(tempFilePath, psScript, 'utf8');

  return new Promise((resolve) => {
    const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tempFilePath]);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (err) {
        console.error('[ipcHandlers] Failed to delete temp file:', err);
      }

      if (code !== 0) {
        console.error('[ipcHandlers] PowerShell exited with code:', code, 'stderr:', stderr);
        resolve(null);
        return;
      }

      try {
        const match = stdout.match(/JSON_START\r?\n([\s\S]*?)\r?\nJSON_END/);
        if (match) {
          resolve(JSON.parse(match[1].trim()));
        } else {
          resolve(null);
        }
      } catch (e) {
        resolve(null);
      }
    });
  });
}

function cleanTitle(title) {
  if (!title) return '';
  let clean = title.replace(/\0/g, '').replace(/^\*/, '').trim();
  
  const suffixes = [
    / - Google Search$/i,
    / - Bing Search$/i,
    / - DuckDuckGo Search$/i,
    / - Yahoo Search$/i,
    / - Google Chrome$/i,
    / - Microsoft Edge$/i,
    / - Brave$/i,
    / - Mozilla Firefox$/i,
    / - Opera$/i,
    / - YouTube$/i,
    / - Slack$/i,
    / - Discord$/i,
    / \| WhatsApp$/i,
    / - Search$/i,
    / - Notepad$/i,
    / - Notepad\+\+$/i,
  ];

  let prev = '';
  while (clean !== prev) {
    prev = clean;
    for (const pattern of suffixes) {
      clean = clean.replace(pattern, '').trim();
    }
  }
  
  return clean;
}

module.exports = {
  setupIpcHandlers,
  setCaptureWindow,
  setInterviewAuth,
  setTeleprompterWindow,
  setTopBarWindow,
};
