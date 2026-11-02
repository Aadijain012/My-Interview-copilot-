export const USAGE_LIMIT_DEFINITIONS = [
  {
    key: "copilotMonthlyMinutes",
    label: "Copilot Monthly Minutes",
    unit: "Minutes",
    description:
      "Maximum AI Copilot active audio/session processing time allowed per calendar month.",
    defaultByTier: {
      free: 60,
      pro: 600,
      "pro+": -1,
      "pro plus": -1,
    },
  },
  {
    key: "notetakerMonthlyMinutes",
    label: "Notetaker Monthly Minutes",
    unit: "Minutes",
    description:
      "Maximum real-time notetaker meeting & personal transcription time per calendar month.",
    defaultByTier: {
      free: 30,
      pro: 300,
      "pro+": -1,
      "pro plus": -1,
    },
  },
  {
    key: "voiceAgentMonthlyMinutes",
    label: "Voice Agent Monthly Minutes",
    unit: "Minutes",
    description:
      "Allowed mock voice interview and voice conversational interaction time per month.",
    defaultByTier: {
      free: 15,
      pro: 120,
      "pro+": 300,
      "pro plus": 300,
    },
  },
  {
    key: "mediaUploadMaxMb",
    label: "Media Upload Maximum Size",
    unit: "MB",
    description:
      "Maximum permissible single audio/recording file size accepted for offline transcription & processing.",
    defaultByTier: {
      free: 25,
      pro: 250,
      "pro+": 1000,
      "pro plus": 1000,
    },
  },
  {
    key: "transcriptionLimitHours",
    label: "Transcription Limit",
    unit: "Hours",
    description:
      "Cumulative recorded file transcription limit per user per billing period.",
    defaultByTier: {
      free: 1,
      pro: 10,
      "pro+": -1,
      "pro plus": -1,
    },
  },
  {
    key: "storageRetentionDays",
    label: "Storage Retention",
    unit: "Days",
    description:
      "Days before historical session audio and detailed transcript logs are pruned from S3 cloud storage.",
    defaultByTier: {
      free: 7,
      pro: 90,
      "pro+": -1,
      "pro plus": -1,
    },
  },
];

export const FEATURE_DEFINITIONS = [
  // ── AI COPILOT ─────────────────────────────────────────────────────────────
  {
    key: "copilot_main_app",
    label: "Main App / Full Screen View",
    shortLabel: "Main App Window",
    description:
      "Standard full-window interview copilot interface with live dialogue visualization.",
    category: "copilot",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "copilot_top_bar",
    label: "Top Bar View",
    description:
      "Pinned horizontal compact overlay docked at the top of the candidate screen.",
    category: "copilot",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "copilot_floating_teleprompter",
    label: "Floating Teleprompter",
    description:
      "Translucent, draggable teleprompter widget overlaying video meeting applications.",
    category: "copilot",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "copilot_live_stt",
    label: "Live Speech-to-Text",
    description:
      "Real-time streaming speech recognition of interviewer questions and dialogue.",
    category: "copilot",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "copilot_live_answer_suggestions",
    label: "Live Answer Suggestions",
    description:
      "Instant contextual AI answer hints and structured bullet points during live interviews.",
    category: "copilot",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "copilot_coding_mode",
    label: "Coding Mode",
    description:
      "Algorithmic code snippet generation, syntax highlighting, and technical interview support.",
    category: "copilot",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "copilot_ask_question_mic",
    label: "Ask Question Mic Mode",
    description:
      "Push-to-talk mic input allowing candidate to ask follow-up questions verbally.",
    category: "copilot",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "copilot_resume_jd_setup",
    label: "Resume/JD Setup",
    description:
      "Contextual priming of AI using candidate resume and target job description.",
    category: "copilot",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "copilot_multilanguage",
    label: "Multi-language support",
    description:
      "Cross-language translation and recognition across non-English interview settings.",
    category: "copilot",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "copilot_pdf_text_transcript_download",
    label: "PDF/Text Transcript Download",
    description:
      "Export finalized interview Q&A logs as formatted PDF or raw text files.",
    category: "copilot",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "copilot_full_audio_download",
    label: "Full Audio Download",
    description:
      "Download complete recorded master audio tracks of completed copilot sessions.",
    category: "copilot",
    defaultByTier: { free: false, pro: false, "pro+": true, "pro plus": true },
  },

  // ── NOTETAKER ──────────────────────────────────────────────────────────────
  {
    key: "notetaker_personal_mode",
    label: "Personal Mode",
    description:
      "Single-speaker voice capture for personal rehearsal and post-interview debriefs.",
    category: "notetaker",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "notetaker_meeting_mode",
    label: "Meeting Mode",
    description:
      "Multi-speaker diarization and meeting recording transcription.",
    category: "notetaker",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "notetaker_realtime_transcript",
    label: "Real-time Transcript",
    description:
      "Low-latency live streaming display of transcribed meeting statements.",
    category: "notetaker",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "notetaker_translation",
    label: "Translation",
    description:
      "Live inline language translation for multilingual meetings and interviews.",
    category: "notetaker",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "notetaker_ai_executive_summary",
    label: "AI Executive Summary",
    description:
      "AI-generated synthesized executive summary highlighting key outcomes.",
    category: "notetaker",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "notetaker_action_items",
    label: "Action Items / Decisions",
    description:
      "Automated extraction of next steps, decisions made, and assigned tasks.",
    category: "notetaker",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "notetaker_copy_notes",
    label: "Copy Notes",
    description:
      "One-click clipboard copy of clean structured notes in Markdown or rich text.",
    category: "notetaker",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "notetaker_email_notes",
    label: "Email Notes",
    description:
      "Direct email delivery of meeting summaries and action items to attendees.",
    category: "notetaker",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "notetaker_pdf_meeting_summary",
    label: "PDF Meeting Summary",
    description:
      "Export professional branded PDF documentation of meeting notes and outcomes.",
    category: "notetaker",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "notetaker_plain_text_export",
    label: "Plain Text Export",
    description:
      "Standard .txt plain text file download of meeting transcript and notes.",
    category: "notetaker",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },

  // ── VOICE AGENT ────────────────────────────────────────────────────────────
  {
    key: "voice_voice_to_voice",
    label: "Voice-to-Voice Interview",
    description:
      "Direct acoustic conversational AI mock interview with speech synthesis.",
    category: "voice",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "voice_conversation_logs",
    label: "Conversation Logs",
    description:
      "Chronological transcript and replay logs of voice agent interactions.",
    category: "voice",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "voice_pause_resume_mute",
    label: "Pause/Resume/Mute",
    description:
      "Full interactive playback control and microphone muting during practice.",
    category: "voice",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "voice_resume_upload",
    label: "Resume Upload",
    description:
      "Deep resume analysis to tailor AI mock interview questions to candidate history.",
    category: "voice",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "voice_jd_input",
    label: "JD Input",
    description:
      "Targeted interviewer simulation matching specific company job descriptions.",
    category: "voice",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "voice_tailored_questions",
    label: "Tailored Questions",
    description:
      "Dynamically adjusted difficulty and follow-up inquiry based on candidate responses.",
    category: "voice",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "voice_role_specific_feedback",
    label: "Role-specific Feedback",
    description:
      "Comprehensive scoring rubric evaluation for technical & behavioral competencies.",
    category: "voice",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "voice_session_transcript",
    label: "Session Transcript",
    description:
      "Detailed written transcript of voice interview dialogue and AI responses.",
    category: "voice",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "voice_audio_playback",
    label: "Audio Playback",
    description:
      "Turn-by-turn candidate voice recording playback for answer self-review.",
    category: "voice",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "voice_reattempt_question",
    label: "Re-attempt Question",
    description:
      "Ability to reset and re-answer a specific interview prompt to improve score.",
    category: "voice",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "voice_practice_history",
    label: "Practice History",
    description:
      "Historical archive of past mock interviews, scores, and completion metrics.",
    category: "voice",
    defaultByTier: { free: true, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "voice_performance_analytics",
    label: "Performance Analytics",
    description:
      "In-depth analytics including speech cadence, confidence scores, and keyword coverage.",
    category: "voice",
    defaultByTier: { free: false, pro: false, "pro+": true, "pro plus": true },
  },

  // ── MEDIA UPLOAD ───────────────────────────────────────────────────────────
  {
    key: "audioUpload",
    label: "Audio/Video Upload",
    description:
      "Allow uploading recorded audio and video files for cloud processing and transcription.",
    category: "media",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "media_player",
    label: "In-App Media Player",
    description:
      "Embedded media player with audio scrubber, speed control, and synchronized transcript playback.",
    category: "media",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "media_library",
    label: "Uploaded Files Library",
    description:
      "Dedicated cloud media asset library storing past candidate audio, video, and uploads.",
    category: "media",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "media_stt",
    label: "Speech-to-Text Transcription",
    description:
      "Automated asynchronous speech recognition transforming recorded media into dialogue transcripts.",
    category: "media",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "media_diarization",
    label: "Speaker Labels & Timestamps",
    description:
      "Automated speaker diarization identifying individual voices and aligning word-level timestamps.",
    category: "media",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "media_translation",
    label: "Translation",
    description:
      "Multi-lingual transcript translation across 30+ supported languages.",
    category: "media",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "media_ask_ai",
    label: "Ask AI About File",
    description:
      "Conversational AI inquiry allowing candidates to ask contextual questions about uploaded files.",
    category: "media",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
  {
    key: "media_pdf_export",
    label: "Transcript PDF Export",
    description:
      "Export rich formatted PDF reports of media transcripts with timestamps and speaker labels.",
    category: "media",
    defaultByTier: { free: false, pro: true, "pro+": true, "pro plus": true },
  },
];
