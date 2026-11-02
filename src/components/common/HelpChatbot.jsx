import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { API_BASE } from "../../utils/api";
import "./HelpChatbot.css";

// ─── Canonical Issue Types (matches backend issue.constants.js) ───────────────
const ISSUE_TYPES = [
  "Login Issue",
  "Account Issue",
  "AI Copilot Issue",
  "Interview Session Issue",
  "Notetaker Issue",
  "Payment / Subscription",
  "Feature Issue",
  "Bug Report",
  "Other",
];

// Helper to safely extract payload from a JWT token
function decodeJwtPayload(tokenStr) {
  try {
    if (!tokenStr || typeof tokenStr !== "string") return null;
    const clean = tokenStr.replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "").trim();
    const parts = clean.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {return null;}
}

// ─── Conversation Flow ────────────────────────────────────────────────────────
const FLOW = {
  start: {
    bot: "👋 Hi! I am your Interview Copilot assistant.\n\nWhat would you like help with?",
    options: [
      { label: "🎙️ AI Copilot",                           next: "copilot_menu" },
      { label: "📝 Notetaker",                             next: "notetaker_menu" },
      { label: "🤖 Voice Agent",                           next: "voice_menu" },
      { label: "📁 Upload & Analysis",                     next: "upload_menu" },
      { label: "📊 Dashboard",                             next: "dashboard_menu" },
      { label: "❓ Troubleshooting",                       next: "trouble_menu" },
      { label: "📋 My Reported Issues / Track Status", icon: "🎫", next: "my_issues_view" },
      { label: "Support / Report an Issue",            icon: "🎧", next: "report_issue_form" },
    ],
  },

  // ── AI Copilot ──────────────────────────────────────────────────────────────
  copilot_menu: {
    bot: "🎙️ **AI Copilot** gives you real-time AI-generated answers during your live interview.\n\nWhat do you want to know?",
    options: [
      { label: "How to start AI Copilot?",     next: "copilot_start" },
      { label: "Panel A vs Panel B?",          next: "copilot_panels" },
      { label: "Auto question detection?",     next: "copilot_detection" },
      { label: "Use with Zoom / Meet?",        next: "copilot_zoom" },
      { label: "No answers generating?",       next: "copilot_no_answer" },
      { label: "🏠 Main Menu",                 next: "start" },
    ],
  },
  copilot_start: {
    bot: "✅ **How to start AI Copilot:**\n\n1️⃣ Click \"AI Copilot\" from the nav bar\n2️⃣ Select audio source — Interviewer Mic or System Audio\n3️⃣ Choose your preferred language\n4️⃣ Click **Start Listening**\n5️⃣ AI answers stream automatically when a question is detected\n6️⃣ Click **Stop** when done\n\n💡 Keep the browser tab active during the interview.",
    options: [
      { label: "🚀 Open AI Copilot now", next: "nav_overlay" },
      { label: "← Back",                next: "copilot_menu" },
      { label: "🏠 Main Menu",          next: "start" },
    ],
  },
  copilot_panels: {
    bot: "📊 **Panel A vs Panel B:**\n\n• **Panel A** — Deep & Comprehensive\nDetailed thorough answer. Best for complex technical questions.\n\n• **Panel B** — Short & Concise\nCrisp 3–4 sentence answer with example. Best for quick replies.\n\n💡 Both panels generate simultaneously — you pick which to use!",
    options: [
      { label: "← Back",       next: "copilot_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },
  copilot_detection: {
    bot: "🧠 **Auto Question Detection:**\n\nThe system uses NLP to detect real interview questions.\n\n✅ Detects: \"Tell me about yourself\", \"What is polymorphism?\"\n❌ Ignores: \"okay\", \"I see\", \"hmm\", \"sure\"\n\nNo button press needed — fully automatic!",
    options: [
      { label: "← Back",       next: "copilot_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },
  copilot_zoom: {
    bot: "🎥 **Using AI Copilot with Zoom / Meet / Teams:**\n\n1️⃣ Select **System Audio** as the audio source\n2️⃣ Windows: Enable \"Stereo Mix\" in Sound Settings → Recording\n3️⃣ Mac: Use **BlackHole** or **Loopback** virtual audio driver\n\n💡 The interviewer cannot see or hear the AI Copilot.",
    options: [
      { label: "← Back",       next: "copilot_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },
  copilot_no_answer: {
    bot: "🔧 **No answers generating? Try:**\n\n✅ Check mic permission in browser (lock icon in address bar)\n✅ Verify correct audio source is selected\n✅ Speak clearly — questions must be complete sentences\n✅ Keep the browser tab active and in focus\n✅ Refresh page and restart the session",
    options: [
      { label: "← Back",       next: "copilot_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },

  // ── Notetaker ───────────────────────────────────────────────────────────────
  notetaker_menu: {
    bot: "📝 **Notetaker** records meetings, shows a live transcript, and generates an AI summary — even in two languages!\n\nWhat do you want to know?",
    options: [
      { label: "How to record a session?",        next: "notetaker_record" },
      { label: "Bilingual / dual language notes?", next: "notetaker_bilingual" },
      { label: "Personal vs Meeting Mode?",        next: "notetaker_modes" },
      { label: "How to export notes?",             next: "notetaker_export" },
      { label: "Transcript not appearing?",        next: "notetaker_issue" },
      { label: "🏠 Main Menu",                     next: "start" },
    ],
  },
  notetaker_record: {
    bot: "✅ **How to record a session:**\n\n1️⃣ Go to Notetaker page\n2️⃣ Select **Spoken Language** (language used in the meeting)\n3️⃣ Select **Target Notes Language** (for the AI summary)\n4️⃣ Optionally enter a session title\n5️⃣ Click 🔴 record to start — live transcript appears in real time\n6️⃣ Click **Stop** — AI summary generated automatically",
    options: [
      { label: "🚀 Open Notetaker now", next: "nav_notetaker" },
      { label: "← Back",               next: "notetaker_menu" },
      { label: "🏠 Main Menu",         next: "start" },
    ],
  },
  notetaker_bilingual: {
    bot: "🌐 **Bilingual / Dual Language Notes:**\n\n• **Spoken Language** = What language people speak in the meeting\n• **Target Notes Language** = What language the AI summary should be in\n\n💡 If they are DIFFERENT, the AI automatically generates notes in BOTH languages side by side!",
    options: [
      { label: "← Back",       next: "notetaker_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },
  notetaker_modes: {
    bot: "👥 **Personal vs Meeting Mode:**\n\n• **Personal Mode** — Only records your microphone. Best for self-practice, 1-on-1 prep, voice notes.\n\n• **Meeting Mode** — Captures both your mic AND system audio with speaker labels (Speaker 1, Speaker 2...). Best for Zoom/Meet meetings.",
    options: [
      { label: "← Back",       next: "notetaker_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },
  notetaker_export: {
    bot: "📤 **Exporting Notes:**\n\nAfter stopping a recording, you can:\n\n📄 **Download as PDF** — formatted document with title & date\n📋 **Copy to Clipboard** — paste into Notion, Docs, Slack\n✉️ **Email Notes** — send directly to your email\n\n💡 Export buttons appear in the top-right of the notes card.",
    options: [
      { label: "← Back",       next: "notetaker_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },
  notetaker_issue: {
    bot: "🔧 **Transcript not appearing? Try:**\n\n✅ Allow microphone in browser settings\n✅ Speak continuously for 3–5 seconds before expecting output\n✅ Check the correct input device is selected\n✅ Ensure no other app has locked the mic\n✅ Try refreshing the page and recording again",
    options: [
      { label: "← Back",       next: "notetaker_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },

  // ── Voice Agent ─────────────────────────────────────────────────────────────
  voice_menu: {
    bot: "🤖 **Voice Agent** is your interactive AI interviewer. Upload your resume and practice real mock interviews with voice!\n\nWhat do you want to know?",
    options: [
      { label: "How to use Voice Agent?",       next: "voice_how" },
      { label: "Resume upload & auto-parsing?", next: "voice_resume" },
      { label: "AI not responding to voice?",   next: "voice_issue" },
      { label: "What interview types?",         next: "voice_types" },
      { label: "🏠 Main Menu",                  next: "start" },
    ],
  },
  voice_how: {
    bot: "✅ **How to use Voice Agent:**\n\n1️⃣ Go to Voice Agent from the nav bar\n2️⃣ Upload your resume (PDF/DOCX) — auto-parsed instantly\n3️⃣ Select the target role and experience level\n4️⃣ Click **Start Interview**\n5️⃣ The AI asks questions verbally — answer using your mic\n6️⃣ Review feedback when the session ends",
    options: [
      { label: "🚀 Launch Voice Agent now", next: "nav_voice" },
      { label: "← Back",                   next: "voice_menu" },
      { label: "🏠 Main Menu",             next: "start" },
    ],
  },
  voice_resume: {
    bot: "📄 **Resume Upload & Auto-Parsing:**\n\n✅ Supported: PDF, DOCX, DOC (max 15 MB)\n✅ AI extracts: name, role, skills, experience, education\n✅ Questions become personalised to YOUR background\n\n⚠️ Use text-based PDF — scanned image PDFs may not parse",
    options: [
      { label: "← Back",       next: "voice_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },
  voice_issue: {
    bot: "🔧 **AI not responding to voice? Try:**\n\n✅ Ensure mic is allowed in the browser\n✅ No other app using the mic (Zoom, Teams, Discord)\n✅ Speak clearly after AI finishes its question\n✅ Refresh page and restart the session\n✅ Use Google Chrome for best Web Audio support",
    options: [
      { label: "← Back",       next: "voice_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },
  voice_types: {
    bot: "🎯 **Interview types you can practice:**\n\n💻 **Technical** — Coding, System Design, DSA\n🧠 **Behavioural** — HR, Culture Fit, STAR method\n📊 **Domain-specific** — Data Science, Product, Marketing\n\nThe AI adapts based on your resume and selected role.",
    options: [
      { label: "← Back",       next: "voice_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },

  // ── Upload ──────────────────────────────────────────────────────────────────
  upload_menu: {
    bot: "📁 **Upload & Analysis** lets you upload resumes and audio/video files for AI-powered extraction and analysis.\n\nWhat do you want to know?",
    options: [
      { label: "How to upload a file?",       next: "upload_how" },
      { label: "Supported formats & limits?", next: "upload_formats" },
      { label: "Upload failing?",             next: "upload_issue" },
      { label: "🏠 Main Menu",               next: "start" },
    ],
  },
  upload_how: {
    bot: "✅ **How to upload a file:**\n\n1️⃣ Go to the Upload page\n2️⃣ Click the upload area or drag & drop your file\n3️⃣ Select file type: Resume or Audio/Video\n4️⃣ Wait for processing to complete\n5️⃣ Analysis result displayed automatically",
    options: [
      { label: "🚀 Go to Upload now", next: "nav_upload" },
      { label: "← Back",             next: "upload_menu" },
      { label: "🏠 Main Menu",       next: "start" },
    ],
  },
  upload_formats: {
    bot: "📋 **Supported Formats & Size Limits:**\n\n📄 Resume: PDF, DOCX, DOC — max **15 MB**\n🎵 Audio: MP3, WAV, M4A — max **200 MB**\n🎬 Video: MP4, WebM — max **200 MB**",
    options: [
      { label: "← Back",       next: "upload_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },
  upload_issue: {
    bot: "🔧 **Upload failing? Try:**\n\n✅ Check file size is within the limit\n✅ Verify the format is supported\n✅ Use a stable internet connection (min 5 Mbps)\n✅ Try compressing the file if it is too large\n✅ Use Chrome browser for best compatibility",
    options: [
      { label: "← Back",       next: "upload_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },

  // ── Dashboard ───────────────────────────────────────────────────────────────
  dashboard_menu: {
    bot: "📊 **Dashboard** shows all your past AI Copilot and Notetaker sessions — transcripts, AI answers, notes, and ratings.\n\nWhat do you want to know?",
    options: [
      { label: "What can I see in Dashboard?",      next: "dashboard_what" },
      { label: "Session not showing?",              next: "dashboard_missing" },
      { label: "Are sessions saved on cloud?",      next: "dashboard_cloud" },
      { label: "🏠 Main Menu",                      next: "start" },
    ],
  },
  dashboard_what: {
    bot: "📋 **What you can see in Dashboard:**\n\n• Session title, date & duration\n• Technology / domain of the session\n• Number of questions detected & answered\n• AI-generated notes and full transcript\n• Session rating\n\n💡 Click any card to expand. Sessions sorted by most recent.",
    options: [
      { label: "🚀 Open Dashboard now", next: "nav_dashboard" },
      { label: "← Back",               next: "dashboard_menu" },
      { label: "🏠 Main Menu",         next: "start" },
    ],
  },
  dashboard_missing: {
    bot: "🔧 **Session not showing in Dashboard?**\n\n✅ Always click **Stop** before closing the app\n✅ If you closed abruptly, the session may not be saved\n✅ Try refreshing the Dashboard page\n✅ Check you are logged in with the correct account",
    options: [
      { label: "← Back",       next: "dashboard_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },
  dashboard_cloud: {
    bot: "☁️ **Cloud Storage:**\n\n✅ Sessions stored on server linked to your account\n✅ Accessible from any device when you log in\n✅ Sessions persist even if you switch browsers\n✅ You can delete sessions anytime from Dashboard",
    options: [
      { label: "← Back",       next: "dashboard_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },

  // ── Troubleshooting ─────────────────────────────────────────────────────────
  trouble_menu: {
    bot: "🔧 **Troubleshooting** — What area is the issue in?",
    options: [
      { label: "🎙️ Microphone / Audio",         next: "trouble_mic" },
      { label: "🔐 Login / Account",             next: "trouble_login" },
      { label: "🌐 Language / Translation",      next: "trouble_lang" },
      { label: "📤 Export / Download",           next: "trouble_export" },
      { label: "⚙️ Performance / General",       next: "trouble_perf" },
      { label: "Support / Report an Issue", icon: "🎧", next: "report_issue_form" },
      { label: "🏠 Main Menu",                   next: "start" },
    ],
  },
  trouble_mic: {
    bot: "🎙️ **Microphone & Audio Fixes:**\n\n**Cannot access mic:**\n🔒 Browser address bar → Site Settings → Microphone → Allow → Refresh\n\n**Transcript empty:**\nSpeak clearly, check OS mic not muted, try different audio source\n\n**System audio (Zoom/Meet) not captured:**\n• Windows: Enable \"Stereo Mix\" in Sound Settings\n• Mac: Use BlackHole or Loopback virtual driver\n\n**Mic shown but not working:**\nClose other apps using mic (Zoom, Teams, Discord)",
    options: [
      { label: "← Back",       next: "trouble_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },
  trouble_login: {
    bot: "🔐 **Login & Account Fixes:**\n\n**Cannot log in with Google:**\nAllow popups for this site, disable popup-blocking extensions\n\n**Logged out automatically:**\nSessions expire after 30 days — log in again, your data is safe\n\n**Forgot password:**\nUse \"Forgot Password\" on login screen or \"Sign in with Google\"",
    options: [
      { label: "← Back",       next: "trouble_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },
  trouble_lang: {
    bot: "🌐 **Language & Translation Fixes:**\n\n**Summary in only one language:**\nSet Spoken Language AND Target Notes Language to two DIFFERENT languages BEFORE starting recording\n\n**Transcript in wrong language:**\nSet correct Spoken Language before the session starts\n\n**Translation incorrect:**\nSwitch translation engine in settings. For Indian languages, Sarvam gives better results",
    options: [
      { label: "← Back",       next: "trouble_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },
  trouble_export: {
    bot: "📤 **Export & Download Fixes:**\n\n**PDF blank or not downloading:**\nNotes must be generated first — then try Copy as fallback\n\n**Garbled characters (Hindi/regional):**\nOpen PDF in Google Chrome or Adobe Acrobat\n\n**Export button not visible:**\nStart and stop a recording session first — export appears after notes are generated",
    options: [
      { label: "← Back",       next: "trouble_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },
  trouble_perf: {
    bot: "⚙️ **Performance & General Fixes:**\n\n**App slow/lagging:**\nClose other tabs, use stable internet (min 5 Mbps), use Chrome\n\n**Page stuck on spinner:**\nClear cache, hard refresh: Ctrl+Shift+R (Win) / Cmd+Shift+R (Mac)\n\n**Supported browsers:**\n✅ Chrome (recommended)  ✅ Edge  ✅ Brave\n⚠️ Safari & Firefox — limited Web Audio support",
    options: [
      { label: "← Back",       next: "trouble_menu" },
      { label: "🏠 Main Menu", next: "start" },
    ],
  },

  // ── Navigation nodes ─────────────────────────────────────────────────────────
  nav_overlay:   { bot: "🚀 Launching AI Copilot...",   navigate: "overlay",     options: [{ label: "🏠 Main Menu", next: "start" }] },
  nav_notetaker: { bot: "📝 Opening Notetaker...",       navigate: "notetaker",   options: [{ label: "🏠 Main Menu", next: "start" }] },
  nav_voice:     { bot: "🤖 Launching Voice Agent...",   navigate: "voice-agent", options: [{ label: "🏠 Main Menu", next: "start" }] },
  nav_upload:    { bot: "📁 Opening Upload page...",     navigate: "upload",      options: [{ label: "🏠 Main Menu", next: "start" }] },
  nav_dashboard: { bot: "📊 Opening Dashboard...",       navigate: "dashboard",   options: [{ label: "🏠 Main Menu", next: "start" }] },

  // ── Support / Report an Issue ───────────────────────────────────────────────
  report_issue_form: {
    bot: "Report an Issue\n\nTell us what is wrong and we will look into it. Please fill out the form below:",
    options: [],
  },

  // ── My Reported Issues View ────────────────────────────────────────────────
  my_issues_view: {
    bot: "📋 **My Reported Issues**\n\nLoading your support tickets and live resolution status...",
    options: [],
  },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function HelpChatbot({ isLoggedIn, token, user, darkMode, windowType, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    { type: "bot", text: FLOW.start.bot, id: "start-initial" },
  ]);
  const [currentNode, setCurrentNode] = useState("start");
  const [optionsVisible, setOptionsVisible] = useState(true);

  // ── Issue Report Form State ─────────────────────────────────────────────────
  const [isReporting, setIsReporting] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formIssueType, setFormIssueType] = useState("Login Issue");
  const [formSubject, setFormSubject] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── My Reported Issues State ────────────────────────────────────────────────
  const [isViewingMyIssues, setIsViewingMyIssues] = useState(false);
  const [userIssues, setUserIssues] = useState([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [issuesFetchError, setIssuesFetchError] = useState("");

  const bottomRef = useRef(null);
  const timerRef = useRef(null);

  // Derive active token safely
  const effectiveToken = useMemo(() => {
    const raw =
      token ||
      (typeof window !== "undefined"
        ? localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || ""
        : "");
    if (!raw || typeof raw !== "string") return "";
    return raw.replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "").trim();
  }, [token]);

  // Derive active user identity with JWT recovery fallback
  const effectiveUser = useMemo(() => {
    if (user && user.email) return user;
    if (typeof window !== "undefined") {
      try {
        const stored =
          localStorage.getItem("auth_user") ||
          localStorage.getItem("user") ||
          localStorage.getItem("interview_auth");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.email) return parsed;
        }
      } catch (error) {
        void error;
      }
    }
    // Fallback: decode directly from JWT payload
    if (effectiveToken) {
      const decoded = decodeJwtPayload(effectiveToken);
      if (decoded && (decoded.email || decoded.id)) {
        return {
          id: decoded.id || decoded.userId,
          email: decoded.email || "",
          name: decoded.name || (decoded.email ? decoded.email.split("@")[0] : ""),
        };
      }
    }
    return user || null;
  }, [user, effectiveToken]);

  const isUserAuthenticated = Boolean(isLoggedIn || effectiveToken);

  const syncReportIdentity = useCallback(() => {
    const initialName =
      effectiveUser?.name?.trim() ||
      (effectiveUser?.email ? effectiveUser.email.split("@")[0] : "Verified User");
    const initialEmail = effectiveUser?.email?.trim() || "";
    setFormName(initialName);
    setFormEmail(initialEmail);
    setFormError("");
  }, [effectiveUser]);

  // Fetch all issues filed by the authenticated user
  const fetchUserIssues = useCallback(async () => {
    if (!isUserAuthenticated || !effectiveToken) return;
    setIsLoadingIssues(true);
    setIssuesFetchError("");
    try {
      const response = await fetch(`${API_BASE}/api/issues`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
      });
      const result = await response.json();
      if (response.ok && result.success && Array.isArray(result.data)) {
        setUserIssues(result.data);
      } else {
        throw new Error(result.error?.message || "Failed to retrieve your issues");
      }
    } catch (err) {
      console.error("[HelpChatbot] fetchUserIssues error:", err);
      setIssuesFetchError(err.message || "Unable to load issues. Please check your connection.");
    } finally {
      setIsLoadingIssues(false);
    }
  }, [effectiveToken, isUserAuthenticated]);

  // Hide only in minimal Electron child windows (teleprompter / topbar)
  const isHidden = windowType === "teleprompter" || windowType === "topbar";

  // Escape key closes chatbot
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 60);
    }
  }, [messages, optionsVisible, isReporting, isViewingMyIssues, isLoadingIssues, isOpen]);

  // showNode — core navigation function
  const showNode = useCallback(
    (nodeId) => {
      if (nodeId === "report_issue_form") {
        syncReportIdentity();
        setCurrentNode("report_issue_form");
        setOptionsVisible(false);
        setIsViewingMyIssues(false);
        setIsReporting(true);
        setMessages((prev) => [
          ...prev,
          {
            type: "bot",
            text: "Report an Issue\n\nTell us what is wrong and our team will resolve it. Your account identity is verified automatically below:",
            id: Date.now() + Math.random(),
          },
        ]);
        return;
      }

      if (nodeId === "my_issues_view") {
        setCurrentNode("my_issues_view");
        setOptionsVisible(false);
        setIsReporting(false);

        if (!isUserAuthenticated || !effectiveToken) {
          setIsViewingMyIssues(false);
          setMessages((prev) => [
            ...prev,
            {
              type: "bot",
              text: "🔒 **Authentication Required**\n\nPlease log in to your account to view your reported issues and check live resolution updates from our admin team.",
              id: Date.now() + Math.random(),
            },
          ]);
          setCurrentNode("start");
          timerRef.current = setTimeout(() => setOptionsVisible(true), 350);
          return;
        }

        setIsViewingMyIssues(true);
        setMessages((prev) => [
          ...prev,
          {
            type: "bot",
            text: "📋 **My Reported Issues**\n\nHere are all your tickets and their real-time resolution status. Whenever an admin solves your ticket, the status and resolution note will update here automatically:",
            id: Date.now() + Math.random(),
          },
        ]);
        fetchUserIssues();
        return;
      }

      const node = FLOW[nodeId];
      if (!node) return;

      setIsReporting(false);
      setIsViewingMyIssues(false);
      setCurrentNode(nodeId);
      setOptionsVisible(false);

      // Add bot message
      setMessages((prev) => [
        ...prev,
        { type: "bot", text: node.bot, id: Date.now() + Math.random() },
      ]);

      // If this node triggers navigation: navigate, stay open, show confirmation + options
      if (node.navigate && onNavigate) {
        timerRef.current = setTimeout(() => {
          onNavigate(node.navigate);
          setMessages((prev) => [
            ...prev,
            {
              type: "bot",
              text: "✅ Done! You are now on the page.\n\nWhat would you like to do next?",
              id: Date.now() + Math.random(),
            },
          ]);
          setCurrentNode("start");
          timerRef.current = setTimeout(() => setOptionsVisible(true), 400);
        }, 700);
        return;
      }

      // Show option buttons with a short delay
      timerRef.current = setTimeout(() => setOptionsVisible(true), 380);
    },
    [onNavigate, isUserAuthenticated, effectiveToken, fetchUserIssues, syncReportIdentity]
  );

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleReset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentNode("start");
    setIsReporting(false);
    setIsViewingMyIssues(false);
    setFormError("");
    setMessages([{ type: "bot", text: FLOW.start.bot, id: "start-" + Date.now() }]);
    setOptionsVisible(true);
  }, []);

  const handleOption = useCallback(
    (opt) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessages((prev) => [
        ...prev,
        { type: "user", text: opt.label, id: Date.now() + Math.random() },
      ]);
      setOptionsVisible(false);
      timerRef.current = setTimeout(() => showNode(opt.next), 300);
    },
    [showNode]
  );

  // Cancel issue report form
  const handleCancelReport = useCallback(() => {
    setIsReporting(false);
    setIsViewingMyIssues(false);
    setFormError("");
    setMessages((prev) => [
      ...prev,
      {
        type: "bot",
        text: "Issue submission cancelled. How else can I help you today?",
        id: Date.now() + Math.random(),
      },
    ]);
    setCurrentNode("start");
    timerRef.current = setTimeout(() => setOptionsVisible(true), 300);
  }, []);

  // Submit issue report form
  const handleSubmitReport = useCallback(
    async (e) => {
      if (e && e.preventDefault) e.preventDefault();
      setFormError("");

      // Enforce locked verified account identity
      const name =
        effectiveUser?.name?.trim() ||
        formName.trim() ||
        (effectiveUser?.email ? effectiveUser.email.split("@")[0] : "Verified User");
      const email = effectiveUser?.email?.trim() || formEmail.trim();
      const subject = formSubject.trim();
      const description = formDescription.trim();

      // Validations
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFormError("A verified account email is required. Please sign in to submit a ticket.");
        return;
      }
      if (!subject) {
        setFormError("Please enter an issue subject.");
        return;
      }
      if (subject.length < 3) {
        setFormError("Subject should be at least 3 characters.");
        return;
      }
      if (!description) {
        setFormError("Please provide a description of the issue.");
        return;
      }
      if (description.length < 5) {
        setFormError("Description should be at least 5 characters.");
        return;
      }

      if (!isUserAuthenticated || !effectiveToken) {
        setFormError("Authentication required. Please sign in to submit a ticket.");
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await fetch(`${API_BASE}/api/issues`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${effectiveToken}`,
          },
          body: JSON.stringify({
            name,
            email,
            issueType: formIssueType,
            subject,
            description,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error?.message || result.message || "Failed to submit issue report"
          );
        }

        const ticket = result.data;
        setIsReporting(false);
        setFormSubject("");
        setFormDescription("");

        // Prepend newly created ticket to local userIssues list for immediate tracking
        setUserIssues((prev) => [ticket, ...prev.filter((t) => t.ticketId !== ticket.ticketId)]);

        // Add user submission summary
        setMessages((prev) => [
          ...prev,
          {
            type: "user",
            text: `Submitted: [${ticket.ticketId}] ${ticket.subject}`,
            id: Date.now() + Math.random(),
          },
          {
            type: "bot",
            ticketData: ticket,
            text: `Your issue has been submitted successfully!\n\nTicket ID: **${ticket.ticketId}**\n\nOur admin and engineering team is reviewing this. You can track real-time resolution updates anytime under "My Reported Issues"!`,
            id: Date.now() + Math.random() + 1,
          },
        ]);

        setCurrentNode("start");
        timerRef.current = setTimeout(() => setOptionsVisible(true), 400);
      } catch (err) {
        setFormError(err.message || "Could not submit issue. Please check your connection.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      formName,
      formEmail,
      formIssueType,
      formSubject,
      formDescription,
      isUserAuthenticated,
      effectiveToken,
      effectiveUser,
    ]
  );

  if (isHidden) return null;

  const node = FLOW[currentNode];
  const options = node?.options || [];

  return (
    <>
      {/* Floating Action Button */}
      <button
        className={"hcb-fab" + (isOpen ? " hcb-fab--open" : "") + (darkMode ? " hcb-dark" : "")}
        onClick={isOpen ? handleClose : handleOpen}
        aria-label={isOpen ? "Close Help" : "Open Help Chatbot"}
        title={isOpen ? "Close" : "Help & Support"}
      >
        {isOpen ? (
          <i className="fa-solid fa-xmark" />
        ) : (
          <>
            <i className="fa-solid fa-headset" />
            <span className="hcb-badge">?</span>
          </>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className={"hcb-window" + (darkMode ? " hcb-dark" : "")}
          role="dialog"
          aria-label="Kairos Support Assistant"
        >
          {/* Header */}
          <div className="hcb-header">
            <div className="hcb-header-left">
              <div className="hcb-avatar">🤖</div>
              <div>
                <div className="hcb-header-name">Kairos Support</div>
                <div className="hcb-header-status">
                  <span className="hcb-status-dot" />
                  <span>Online • Help & Support</span>
                </div>
              </div>
            </div>
            <div className="hcb-header-actions">
              <button
                className="hcb-icon-btn"
                onClick={handleReset}
                title="Restart conversation"
                aria-label="Restart"
              >
                <i className="fa-solid fa-arrow-rotate-left" />
              </button>
              <button
                className="hcb-icon-btn"
                onClick={handleClose}
                title="Close"
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          </div>

          {/* Messages body area */}
          <div className="hcb-body">
            {messages.map((msg) =>
              msg.type === "bot" ? (
                <div key={msg.id} className="hcb-msg-bot-wrap">
                  <div className="hcb-msg-avatar">🤝</div>
                  <div className="hcb-msg-bot">
                    {msg.ticketData ? (
                      <div className="hcb-ticket-card">
                        <div className="hcb-ticket-badge">Support Ticket Created</div>
                        <div className="hcb-ticket-title">Your issue has been submitted!</div>
                        <div className="hcb-ticket-id-box">
                          <span className="hcb-ticket-id-label">Ticket ID</span>
                          <span className="hcb-ticket-id-val">{msg.ticketData.ticketId}</span>
                        </div>
                        <p className="hcb-ticket-desc">
                          Our support team will review this. Track live status anytime using the{" "}
                          <strong>My Reported Issues</strong> option.
                        </p>
                      </div>
                    ) : (
                      parseBotText(msg.text)
                    )}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="hcb-msg-user-wrap">
                  <div className="hcb-msg-user">{msg.text}</div>
                </div>
              )
            )}

            {/* Embedded Issue Report Form */}
            {isReporting && (
              <div className="hcb-issue-form-card">
                <div className="hcb-form-header">
                  <div className="hcb-form-title">Report an Issue</div>
                  <div className="hcb-form-subtitle">
                    Tell us what is wrong and our team will resolve it.
                  </div>
                </div>

                {!isUserAuthenticated && (
                  <div className="hcb-form-auth-notice">
                    <i className="fa-solid fa-triangle-exclamation" /> Please log in to submit a ticket.
                  </div>
                )}

                {formError && (
                  <div className="hcb-form-error">
                    <i className="fa-solid fa-circle-exclamation" /> {formError}
                  </div>
                )}

                <form onSubmit={handleSubmitReport} className="hcb-form-body">
                  <div className="hcb-form-field">
                    <div className="hcb-label-row">
                      <label className="hcb-form-label">Name</label>
                      <span className="hcb-lock-tag">
                        <i className="fa-solid fa-lock" /> Verified
                      </span>
                    </div>
                    <input
                      type="text"
                      className="hcb-form-input hcb-locked-input"
                      value={formName}
                      readOnly={true}
                      tabIndex={-1}
                      placeholder="Your Name"
                      title="Name is fixed to your verified account identity"
                    />
                  </div>

                  <div className="hcb-form-field">
                    <div className="hcb-label-row">
                      <label className="hcb-form-label">Email</label>
                      <span className="hcb-lock-tag">
                        <i className="fa-solid fa-lock" /> Verified Account
                      </span>
                    </div>
                    <input
                      type="email"
                      className="hcb-form-input hcb-locked-input"
                      value={formEmail}
                      readOnly={true}
                      tabIndex={-1}
                      placeholder="user@example.com"
                      title="Email is fixed to your verified account and cannot be modified"
                    />
                  </div>

                  <div className="hcb-form-field">
                    <label className="hcb-form-label">Issue Type</label>
                    <select
                      className="hcb-form-select"
                      value={formIssueType}
                      onChange={(e) => setFormIssueType(e.target.value)}
                    >
                      {ISSUE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="hcb-form-field">
                    <label className="hcb-form-label">Subject</label>
                    <input
                      type="text"
                      className="hcb-form-input"
                      value={formSubject}
                      onChange={(e) => setFormSubject(e.target.value)}
                      placeholder="Unable to start audio recording"
                      maxLength={120}
                    />
                  </div>

                  <div className="hcb-form-field">
                    <label className="hcb-form-label">Description</label>
                    <textarea
                      className="hcb-form-textarea"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Please describe what happened, steps to reproduce, or any error displayed..."
                      rows={3}
                      maxLength={1500}
                    />
                  </div>

                  <div className="hcb-form-actions">
                    <button
                      type="button"
                      className="hcb-btn-cancel"
                      onClick={handleCancelReport}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="hcb-btn-submit"
                      disabled={isSubmitting || !isUserAuthenticated}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="hcb-spinner" /> Submitting...
                        </>
                      ) : (
                        "Submit Issue"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Embedded "My Reported Issues / Track Status" View */}
            {isViewingMyIssues && (
              <div className="hcb-my-issues-card">
                <div className="hcb-my-issues-header">
                  <div className="hcb-my-issues-title">
                    <i className="fa-solid fa-ticket" /> My Support Tickets
                  </div>
                  <button
                    type="button"
                    className="hcb-btn-refresh-issues"
                    onClick={fetchUserIssues}
                    disabled={isLoadingIssues}
                    title="Click to check for latest admin resolution updates"
                  >
                    <i className={`fa-solid fa-arrows-rotate ${isLoadingIssues ? "fa-spin" : ""}`} />
                    <span>{isLoadingIssues ? "Refreshing..." : "Refresh Status"}</span>
                  </button>
                </div>

                {isLoadingIssues && (
                  <div className="hcb-issues-loading">
                    <span
                      className="hcb-spinner"
                      style={{ borderColor: "#3b82f6", borderTopColor: "transparent" }}
                    />
                    <span>Checking live resolution updates...</span>
                  </div>
                )}

                {issuesFetchError && !isLoadingIssues && (
                  <div className="hcb-form-error">
                    <i className="fa-solid fa-circle-exclamation" /> {issuesFetchError}
                  </div>
                )}

                {!isLoadingIssues && !issuesFetchError && userIssues.length === 0 && (
                  <div className="hcb-issues-empty">
                    <div className="hcb-issues-empty-icon">📭</div>
                    <div className="hcb-issues-empty-text">No issues reported yet.</div>
                    <p style={{ margin: "4px 0 10px", fontSize: "11px", color: "#64748b" }}>
                      If you ever encounter an issue or bug, click below to submit a ticket.
                    </p>
                    <button
                      type="button"
                      className="hcb-btn-submit"
                      style={{ margin: "0 auto" }}
                      onClick={() => showNode("report_issue_form")}
                    >
                      <i className="fa-solid fa-plus" /> Report an Issue
                    </button>
                  </div>
                )}

                {!isLoadingIssues && userIssues.length > 0 && (
                  <div className="hcb-issues-list">
                    {userIssues.map((issue) => {
                      const st = String(issue.status || "open").toLowerCase();
                      const isResolved = st === "resolved";
                      const isInProgress = st === "in_progress" || st === "investigating";
                      const isClosed = st === "closed";
                      const priority = String(issue.priority || "medium").toLowerCase();
                      const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
                      const resolverName =
                        issue.assignedTo ||
                        issue.assignee?.name ||
                        (issue.assignee?.email ? issue.assignee.email.split("@")[0] : null) ||
                        "Support Team";

                      return (
                        <div
                          key={issue.id || issue.ticketId}
                          className={`hcb-issue-card ${isResolved ? "is-resolved" : ""}`}
                        >
                          {/* 1. Ticket ID on top */}
                          <div className="hcb-card-header">
                            <span className="hcb-card-ticket-id">#{issue.ticketId}</span>
                          </div>

                          {/* 2. Directly below Ticket ID: small open, space, Medium */}
                          <div className="hcb-card-badges-row">
                            <span className={`hcb-status-pill ${st}`}>
                              {isResolved && <i className="fa-solid fa-circle-check" />}
                              {st === "open" && <i className="fa-regular fa-clock" />}
                              {isInProgress && <i className="fa-solid fa-spinner fa-spin" />}
                              {isClosed && <i className="fa-solid fa-ban" />}
                              <span>{st}</span>
                            </span>
                            <span className="hcb-badge-spacer">&nbsp;</span>
                            {issue.priority && (
                              <span className={`hcb-priority-tag ${priority}`}>
                                {priorityLabel}
                              </span>
                            )}
                          </div>

                          {/* 3. Subject / Title */}
                          {(issue.subject || issue.title) && (
                            <div className="hcb-card-subject">
                              {issue.subject || issue.title}
                            </div>
                          )}

                          {/* 4. Category / Type */}
                          {issue.issueType && (
                            <div className="hcb-card-category">
                              <i className="fa-solid fa-tag" /> {issue.issueType}
                            </div>
                          )}

                          {/* 5. Description */}
                          {issue.description && (
                            <p className="hcb-card-desc">{issue.description}</p>
                          )}

                          {/* 6. Live Admin Resolution Card */}
                          {isResolved && (
                            <div className="hcb-resolution-box">
                              <div className="hcb-resolution-head">
                                <i className="fa-solid fa-circle-check" />
                                <span>Resolved by: <strong>{resolverName}</strong></span>
                              </div>
                              {issue.resolutionNote && (
                                <div className="hcb-resolution-body">
                                  <span className="hcb-resolution-label">Resolution Note:</span>{" "}
                                  {issue.resolutionNote}
                                </div>
                              )}
                              {issue.resolvedAt && (
                                <div className="hcb-resolution-time">
                                  <i className="fa-regular fa-clock" /> Solved on: {formatDateTime(issue.resolvedAt)}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 7. Filed on: date time */}
                          <div className="hcb-card-footer">
                            <span className="hcb-card-filed-on">
                              <i className="fa-regular fa-calendar-days" /> Filed on: {formatDateTime(issue.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="hcb-my-issues-actions">
                  <button
                    type="button"
                    className="hcb-btn-cancel"
                    onClick={() => {
                      setIsViewingMyIssues(false);
                      showNode("start");
                    }}
                  >
                    🏠 Main Menu
                  </button>
                  <button
                    type="button"
                    className="hcb-btn-submit"
                    onClick={() => {
                      setIsViewingMyIssues(false);
                      showNode("report_issue_form");
                    }}
                  >
                    ➕ Report New Issue
                  </button>
                </div>
              </div>
            )}

            {/* Quick reply option buttons */}
            {!isReporting && !isViewingMyIssues && optionsVisible && options.length > 0 && (
              <div className="hcb-options">
                {options.map((opt, i) => (
                  <button key={i} className="hcb-option-btn" onClick={() => handleOption(opt)}>
                    {opt.icon && (
                      <span className="hcb-option-icon" aria-hidden="true">
                        {opt.icon}{" "}
                      </span>
                    )}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Footer */}
          <div className="hcb-footer">
            <i className="fa-solid fa-headset" />
            <span>Interview Copilot Support Desk</span>
          </div>
        </div>
      )}
    </>
  );
}

// ── Parse bot text: render bold and line breaks ──────────────────────────────
function parseBotText(text) {
  if (!text) return null;
  return text.split("\n").map((line, lineIdx, arr) => {
    if (line === "Report an Issue") {
      return (
        <span key={lineIdx}>
          <strong className="hcb-report-title">{line}</strong>
          {lineIdx < arr.length - 1 && <br />}
        </span>
      );
    }

    const parts = line.split(/\*\*(.*?)\*\*/g);
    const rendered = parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
    return (
      <span key={lineIdx}>
        {rendered}
        {lineIdx < arr.length - 1 && <br />}
      </span>
    );
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(dateStr);
  }
}
