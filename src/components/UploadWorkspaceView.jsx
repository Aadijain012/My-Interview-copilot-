import React, { useState, useEffect, useRef } from 'react';
import './UploadWorkspaceView.css';

const DEFAULT_UTTERANCES = [
  { id: 'u1', speaker: 'Speaker 1', time: '0:03', text: 'What is' },
  { id: 'u2', speaker: 'Speaker 1', time: '0:10', text: 'Python?' },
  { id: 'u3', speaker: 'Speaker 1', time: '0:11', text: 'What is the difference between Python and Java?' },
  { id: 'u4', speaker: 'Speaker 1', time: '0:21', text: 'What is Java?' },
  { id: 'u5', speaker: 'Speaker 1', time: '0:25', text: 'What is Java?' },
  { id: 'u6', speaker: 'Speaker 1', time: '0:34', text: 'What do you think?' },
  { id: 'u7', speaker: 'Speaker 1', time: '0:36', text: 'Java is best or Python?' },
  { id: 'u8', speaker: 'Speaker 1', time: '0:39', text: "It's good, sir. What do you think? Java is best or Python?" },
  { id: 'u9', speaker: 'Speaker 1', time: '0:44', text: 'What do you think? Java is best or Python?' },
  { id: 'u10', speaker: 'Speaker 1', time: '0:50', text: 'No.' },
  { id: 'u11', speaker: 'Speaker 1', time: '0:55', text: 'Okay.' },
];

export default function UploadWorkspaceView({
  file,
  onBack,
  darkMode = true,
  showToast = (msg) => console.log(msg),
  onOpenDrawer,
}) {
  // File Metadata
  const fileName = file?.name || 'Interview · 10 Nov - Audio.ogg';
  const [showFileDetails, setShowFileDetails] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekSec, setSeekSec] = useState(0);
  const [volume, setVolume] = useState(1);
  const timerRef = useRef(null);

  // Quick Tools State: null | 'summarize' | 'key_points' | 'explain' | 'actions' | 'mindmap'
  const [activeTool, setActiveTool] = useState(null);
  const [toolState, setToolState] = useState('idle'); // 'idle' | 'accepted' | 'creating' | 'ready'
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showMoreTools, setShowMoreTools] = useState(false);

  // Chat / Query State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

  // Voice Chat Assistant State
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState('en');

  // Audio playback ticker
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setSeekSec((prev) => {
          if (prev >= 56) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  // Quick Tool execution simulation (matches video timing)
  const runQuickTool = (toolKey) => {
    setActiveTool(toolKey);
    setToolState('accepted');
    setElapsedSec(1);

    const secTimer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    setTimeout(() => {
      setToolState('creating');
    }, 900);

    setTimeout(() => {
      setToolState('ready');
      clearInterval(secTimer);
    }, 1900);
  };

  const handleCopyTranscript = () => {
    const fullText = DEFAULT_UTTERANCES.map((u) => `${u.speaker} (${u.time}): ${u.text}`).join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText);
      showToast('Transcript copied to clipboard!');
    } else {
      showToast('Transcript ready to copy.');
    }
  };

  const handleSendPrompt = (e) => {
    e?.preventDefault();
    const query = chatInput.trim();
    if (!query) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { role: 'user', text: query, time: timeStr };

    let reply = `Based on your audio file "${fileName}", the speaker examines key differences between Python and Java—touching on ecosystem flexibility, backend performance benchmarks, and development velocity.`;
    if (query.toLowerCase().includes('python')) {
      reply = 'Python is highlighted as highly readable, versatile, and ideal for AI, prototyping, and data science workflows.';
    } else if (query.toLowerCase().includes('java')) {
      reply = 'Java is presented as a statically typed enterprise powerhouse offering predictable performance on the JVM and robust multithreading.';
    }

    const aiMsg = { role: 'ai', text: reply, time: timeStr };

    setChatMessages((prev) => [...prev, userMsg, aiMsg]);
    setChatInput('');
  };

  return (
    <div className={`upload-workspace-view-root ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* =================== TOP BAR =================== */}
      <div className="uws-topbar">
        <div className="uws-topbar-left">
          <button type="button" className="uws-back-btn" onClick={onBack} title="Return to upload landing">
            <i className="fa-solid fa-arrow-left"></i> All files
          </button>

          <div className="uws-file-icon-wrap">
            <i className="fa-regular fa-file-audio"></i>
          </div>

          <div className="uws-file-meta-group">
            <h2 className="uws-file-title" title={fileName}>
              {fileName}
            </h2>
            <div className="uws-file-submeta">
              <span>Audio · 0:57 · 49 words</span>
              <span className="uws-ready-pill">
                <span className="uws-ready-dot"></span>
                <span>Ready</span>
              </span>
            </div>
          </div>
        </div>

        <div className="uws-topbar-right">
          <button type="button" className="uws-badge-btn" onClick={() => onOpenDrawer?.()}>
            <i className="fa-regular fa-bookmark"></i>
            <span>Saved results</span>
            <span className="uws-count-badge">1</span>
          </button>

          <button
            type="button"
            className="uws-action-btn"
            onClick={() => {
              showToast('Exporting transcript and AI summaries...');
            }}
          >
            <i className="fa-solid fa-download"></i>
            <span>Export</span>
          </button>

          <button type="button" className="uws-action-btn primary" onClick={onBack}>
            <i className="fa-solid fa-rotate-right"></i>
            <span>New file</span>
          </button>
        </div>
      </div>

      {/* Accordion link below topbar */}
      <button
        type="button"
        className="uws-sub-accordion-btn"
        onClick={() => setShowFileDetails((prev) => !prev)}
      >
        <i className={`fa-solid ${showFileDetails ? 'fa-caret-down' : 'fa-caret-right'}`}></i>
        <span>File details &amp; storage</span>
      </button>

      {showFileDetails && (
        <div className="uws-file-details-panel">
          <div><strong>Filename:</strong> {fileName}</div>
          <div><strong>Audio Duration:</strong> 00:56.840</div>
          <div><strong>Codec:</strong> Ogg Opus (48,000 Hz, Mono)</div>
          <div><strong>Storage:</strong> Encrypted AES-256 (Private Workspace)</div>
        </div>
      )}

      {/* =================== 2-COLUMN WORKSPACE =================== */}
      <div className="uws-workspace-grid">
        {/* =================== LEFT COLUMN: TRANSCRIPT =================== */}
        <div className="uws-card uws-transcript-panel">
          <div className="uws-card-header-row">
            <h3 className="uws-panel-h3">Transcript</h3>
            <button type="button" className="uws-header-copy-btn" onClick={handleCopyTranscript}>
              <i className="fa-regular fa-copy"></i>
              <span>Copy</span>
            </button>
          </div>

          {/* Transcript language selector */}
          <div className="uws-lang-row">
            <div className="uws-lang-label">Transcript language</div>
            <div className="uws-lang-dropdown-box">
              <div className="uws-lang-dropdown-left">
                <i className="fa-solid fa-language" style={{ color: '#c084fc' }}></i>
                <span>Keep original</span>
                <i className="fa-solid fa-chevron-down" style={{ fontSize: '11px', color: '#94a3b8' }}></i>
              </div>
              <span className="uws-lang-check-pill">✓ Original</span>
            </div>
            <div className="uws-lang-subtext">66 languages · Original preserved</div>
          </div>

          {/* Sleek Audio Player Bar */}
          <div className="uws-audio-player">
            <span className="uws-saved-audio-label">
              <i className="fa-solid fa-headphones"></i> Saved audio
            </span>

            <button
              type="button"
              className="uws-play-pause-btn"
              onClick={() => setIsPlaying((p) => !p)}
              title={isPlaying ? 'Pause audio' : 'Play audio'}
            >
              <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
            </button>

            <span className="uws-time-display">
              0:{String(seekSec).padStart(2, '0')} / 0:56
            </span>

            <div className="uws-scrubber-track">
              <input
                type="range"
                min="0"
                max="56"
                value={seekSec}
                onChange={(e) => setSeekSec(Number(e.target.value))}
                className="uws-scrubber-input"
              />
            </div>

            <button
              type="button"
              className="uws-player-icon-btn"
              title="Volume"
              onClick={() => setVolume((v) => (v === 1 ? 0 : 1))}
            >
              <i className={`fa-solid ${volume > 0 ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
            </button>

            <button type="button" className="uws-player-icon-btn" title="Options">
              <i className="fa-solid fa-ellipsis-vertical"></i>
            </button>
          </div>

          {/* Transcript Speaker Turns */}
          <div className="uws-utterances-scroller">
            {DEFAULT_UTTERANCES.map((utt) => (
              <div key={utt.id} className="uws-utterance-item">
                <div className="uws-speaker-time-row">
                  <span>{utt.speaker}</span>
                  <span>{utt.time}</span>
                </div>
                <p className="uws-utt-p">{utt.text}</p>
              </div>
            ))}
          </div>

          {/* Left Panel Footer */}
          <div className="uws-card-footer">
            <span className="uws-preserved-text">✓ Original text preserved</span>
            <button
              type="button"
              className="uws-settings-link"
              onClick={() => showToast('Audio & reading settings')}
            >
              <i className="fa-solid fa-gear"></i>
              <span>Reading settings</span>
            </button>
          </div>
        </div>

        {/* =================== RIGHT COLUMN: ASK ANYTHING =================== */}
        <div className="uws-card uws-ask-panel">
          <div>
            <div className="uws-ask-header-top">
              <h3 className="uws-panel-h3">Ask anything</h3>
              <span className="uws-based-pill">
                <i className="fa-regular fa-file-lines"></i> Based on this file
              </span>
            </div>

            <div className="uws-ask-subhead-row">
              <span>Ask about your file and follow references to the source.</span>
              <button
                type="button"
                className="uws-new-q-link"
                onClick={() => {
                  setActiveTool(null);
                  setToolState('idle');
                  setChatMessages([]);
                }}
              >
                + New question
              </button>
            </div>
          </div>

          {/* Center Content Section */}
          <div className="uws-ask-body-center">
            {/* STATE 1: Empty Initial Hero (Matches frame_0330s.jpg) */}
            {activeTool === null && chatMessages.length === 0 && (
              <>
                <h4 className="uws-hero-title">What would you like to know?</h4>
                <p className="uws-hero-subtitle">Start with a quick tool, or ask a question below.</p>

                <div className="uws-tools-row">
                  <button type="button" className="uws-tool-chip" onClick={() => runQuickTool('summarize')}>
                    <span>✨</span> Summarize
                  </button>
                  <button type="button" className="uws-tool-chip" onClick={() => runQuickTool('key_points')}>
                    <span>🎚</span> Key points
                  </button>
                  <button type="button" className="uws-tool-chip" onClick={() => runQuickTool('explain')}>
                    <span>💡</span> Explain simply
                  </button>
                  <button type="button" className="uws-tool-chip" onClick={() => runQuickTool('actions')}>
                    <span>✓</span> Action items
                  </button>
                </div>

                <div className="uws-tools-row">
                  <button type="button" className="uws-tool-chip" onClick={() => runQuickTool('mindmap')}>
                    <span>🌿</span> Mind map
                  </button>
                  <button
                    type="button"
                    className="uws-tool-chip"
                    onClick={() => setShowMoreTools((prev) => !prev)}
                  >
                    More tools ⌵
                  </button>
                </div>

                {showMoreTools && (
                  <div className="uws-tools-row" style={{ animation: 'uwsFadeIn 0.2s ease-out' }}>
                    <button type="button" className="uws-tool-chip" onClick={() => runQuickTool('quiz')}>
                      <span>📝</span> Generate Quiz
                    </button>
                    <button type="button" className="uws-tool-chip" onClick={() => runQuickTool('study_guide')}>
                      <span>📚</span> Study Guide
                    </button>
                  </div>
                )}
              </>
            )}

            {/* STATE 2: Tool Processing Stepper (Matches frame_0360s.jpg) */}
            {activeTool !== null && toolState !== 'ready' && (
              <div className="uws-tool-process-box">
                <div className="uws-tool-subtop-bar">
                  <h4 className="uws-tool-name-h4">
                    {activeTool === 'key_points' && 'Key points'}
                    {activeTool === 'summarize' && 'Summarize'}
                    {activeTool === 'explain' && 'Explain simply'}
                    {activeTool === 'actions' && 'Action items'}
                    {activeTool === 'mindmap' && 'Mind map'}
                    {activeTool === 'quiz' && 'Generate Quiz'}
                    {activeTool === 'study_guide' && 'Study Guide'}
                  </h4>
                  <button
                    type="button"
                    className="uws-change-tool-btn"
                    onClick={() => setActiveTool(null)}
                  >
                    Change tool ⌵
                  </button>
                </div>

                <svg className="uws-doc-icon-svg" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" />
                  <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeLinecap="round" />
                </svg>

                <h4 className="uws-process-h4">Your request was accepted and is waiting to start.</h4>

                <div className="uws-stepper-row">
                  <span className={`uws-stepper-step ${toolState === 'accepted' || toolState === 'creating' ? 'active' : ''}`}>
                    <span className="uws-step-dot"></span> Accepted
                  </span>
                  <span className={`uws-stepper-step ${toolState === 'creating' ? 'active' : ''}`}>
                    <span className="uws-step-dot"></span> Creating
                  </span>
                  <span className="uws-stepper-step">
                    <span className="uws-step-dot"></span> Ready
                  </span>
                </div>

                <p className="uws-process-leave-note">You can leave this page. Your task keeps running.</p>

                <div className="uws-queued-bottom-status">
                  <div>
                    <span className="uws-spinner-pulse"></span>
                    <span>
                      {activeTool === 'key_points' ? 'Key points is queued' : 'AI Analysis is queued'}
                    </span>
                  </div>
                  <div>Original language · {elapsedSec} sec elapsed</div>
                </div>
              </div>
            )}

            {/* STATE 3: Tool Results Ready */}
            {activeTool !== null && toolState === 'ready' && (
              <div className="uws-tool-result-scroll">
                <div className="uws-tool-subtop-bar">
                  <h4 className="uws-tool-name-h4">
                    {activeTool === 'key_points' && 'Key points'}
                    {activeTool === 'summarize' && 'Executive Summary'}
                    {activeTool === 'explain' && 'Explain simply'}
                    {activeTool === 'actions' && 'Action items'}
                    {activeTool === 'mindmap' && 'Mind map'}
                    {activeTool === 'quiz' && 'Interview Practice Quiz'}
                    {activeTool === 'study_guide' && 'Comprehensive Study Guide'}
                  </h4>
                  <button
                    type="button"
                    className="uws-change-tool-btn"
                    onClick={() => setActiveTool(null)}
                  >
                    Change tool ⌵
                  </button>
                </div>

                {activeTool === 'key_points' && (
                  <>
                    <div className="uws-result-card">
                      <strong>Python vs Java debate:</strong> The speaker actively contrasts Python and Java, examining which programming ecosystem provides superior advantages in modern workflows.
                    </div>
                    <div className="uws-result-card">
                      <strong>Velocity &amp; Concurrency tradeoffs:</strong> Python prioritizes rapid readability, agility, and AI/ML libraries, while Java excels in robust enterprise typing and multithreaded backend pipelines.
                    </div>
                    <div className="uws-result-card">
                      <strong>Contextual suitability:</strong> The dialogue emphasizes that neither language is universally "better"—choice depends on latency requirements, infrastructure scale, and developer experience.
                    </div>
                  </>
                )}

                {activeTool === 'summarize' && (
                  <div className="uws-result-card">
                    <p style={{ margin: 0, marginBottom: '8px' }}><strong>Executive Summary:</strong></p>
                    <p style={{ margin: 0 }}>
                      This audio session records an interactive technical comparison between <strong>Python</strong> and <strong>Java</strong>. The participants review syntactic simplicity, execution runtime, enterprise maintainability, and concurrency models to evaluate proper project architecture fit.
                    </p>
                  </div>
                )}

                {activeTool === 'explain' && (
                  <div className="uws-result-card">
                    <p style={{ margin: 0 }}>
                      Think of <strong>Python</strong> like writing in plain, friendly English—it is quick to pick up, great for quick math and smart AI. <strong>Java</strong> is like building with rigid steel scaffolding—it requires strict rules and structure, but can support giant skyscrapers that never collapse under heavy load.
                    </p>
                  </div>
                )}

                {activeTool === 'actions' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="uws-action-item">
                      <input type="checkbox" defaultChecked />
                      <span>Benchmark project performance bottlenecks (I/O bound vs CPU bound).</span>
                    </label>
                    <label className="uws-action-item">
                      <input type="checkbox" defaultChecked />
                      <span>Evaluate team expertise across dynamic typing vs static compilation.</span>
                    </label>
                    <label className="uws-action-item">
                      <input type="checkbox" />
                      <span>Draft technical stack criteria matrix for backend microservices.</span>
                    </label>
                  </div>
                )}

                {activeTool === 'mindmap' && (
                  <div className="uws-mindmap-container">
                    <div className="uws-mm-root">🎯 Programming Comparison</div>
                    <div className="uws-mm-branches">
                      <div className="uws-mm-branch-card">
                        <div className="uws-mm-branch-title">🐍 Python</div>
                        <div className="uws-mm-leaf">• Dynamic typing</div>
                        <div className="uws-mm-leaf">• AI &amp; Machine Learning</div>
                        <div className="uws-mm-leaf">• Rapid prototyping</div>
                      </div>
                      <div className="uws-mm-branch-card">
                        <div className="uws-mm-branch-title">☕ Java</div>
                        <div className="uws-mm-leaf">• JVM bytecode speed</div>
                        <div className="uws-mm-leaf">• Multi-threaded concurrency</div>
                        <div className="uws-mm-leaf">• Enterprise stability</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Custom Chat Feed */}
            {chatMessages.length > 0 && (
              <div className="uws-chat-feed">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`uws-chat-bubble-row ${msg.role}`}>
                    <span className="uws-chat-role">{msg.role === 'user' ? 'You' : 'AI Assistant'} · {msg.time}</span>
                    <div className="uws-chat-bubble">{msg.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* =================== VOICE CHAT BOX (Matches frame_0345s.jpg) =================== */}
          {isVoiceChatActive && (
            <div className="uws-voice-chat-box">
              <div className="uws-vc-header">
                <div className="uws-vc-mic-icon">
                  <i className="fa-solid fa-microphone"></i>
                </div>
                <div className="uws-vc-meta">
                  <h5 className="uws-vc-title">I'm listening</h5>
                  <p className="uws-vc-subtitle">Ask naturally. Your request is sent automatically after you pause.</p>
                </div>
              </div>

              <div className="uws-vc-controls-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Speak to AI in</span>
                  <select
                    value={voiceLanguage}
                    onChange={(e) => setVoiceLanguage(e.target.value)}
                    className="uws-vc-lang-select"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="hi">Hindi</option>
                    <option value="te">Telugu</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="uws-vc-end-btn"
                  onClick={() => setIsVoiceChatActive(false)}
                >
                  End voice chat
                </button>
              </div>

              <div className="uws-soundwave-bars">
                <div className="uws-sw-bar"></div>
                <div className="uws-sw-bar"></div>
                <div className="uws-sw-bar"></div>
                <div className="uws-sw-bar"></div>
                <div className="uws-sw-bar"></div>
                <div className="uws-sw-bar"></div>
                <div className="uws-sw-bar"></div>
              </div>

              <p className="uws-vc-credit-note">
                Voice and AI processing use credits. End the chat any time, or switch to typing.
              </p>
            </div>
          )}

          {/* =================== BOTTOM PROMPT BAR =================== */}
          <div className="uws-bottom-bar">
            <div className="uws-shortcut-tags-row">
              <button type="button" className="uws-tag-chip" onClick={() => runQuickTool('mindmap')}>
                /mindmap
              </button>
              <button type="button" className="uws-tag-chip" onClick={() => runQuickTool('actions')}>
                /actions
              </button>
              <button type="button" className="uws-tag-chip" onClick={() => runQuickTool('summarize')}>
                /summary
              </button>
            </div>

            <form onSubmit={handleSendPrompt} className="uws-input-form-box">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about this file..."
                className="uws-prompt-input"
              />
              <button type="submit" className="uws-send-btn">
                <i className="fa-regular fa-paper-plane"></i>
                <span>Send</span>
              </button>
            </form>

            <div className="uws-prompt-subcontrols">
              <button
                type="button"
                className="uws-talk-ai-btn"
                onClick={() => setIsVoiceChatActive((prev) => !prev)}
              >
                <i className="fa-solid fa-microphone"></i>
                <span>{isVoiceChatActive ? 'Type instead' : 'Talk to AI'}</span>
              </button>

              <span style={{ fontSize: '11px', color: '#64748b' }}>
                AI processing uses credits
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion link below left panel */}
      <button
        type="button"
        className="uws-help-btn"
        onClick={() => setShowHelp((prev) => !prev)}
      >
        <i className={`fa-solid ${showHelp ? 'fa-caret-down' : 'fa-caret-right'}`}></i>
        <span>Help with this file</span>
      </button>

      {showHelp && (
        <div className="uws-file-details-panel" style={{ marginTop: '8px' }}>
          <div>You can ask any questions grounded in this transcript. All processing runs privately.</div>
        </div>
      )}

      {/* Very bottom privacy notice */}
      <div className="uws-bottom-privacy-note">
        <i className="fa-solid fa-lock"></i>
        <span>Your saved content stays in your private library. Review AI answers against your source.</span>
      </div>
    </div>
  );
}
