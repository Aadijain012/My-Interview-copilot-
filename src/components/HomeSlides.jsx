import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  ArrowRight,
  Star,
  Check,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Users,
  Heart,
  ThumbsUp,
  Sparkles,
  Rocket,
  Play,
  Volume2,
  VolumeX,
  ExternalLink
} from 'lucide-react';
import './HomeSlides.css';

const featureCardsData = [
  {
    id: 'copilot',
    title: 'AI Interview Copilot',
    badge: 'POPULAR',
    badgeClass: 'badge-yellow',
    desc: 'Get real-time answer suggestions during practice interviews — with multiple response options.',
    bullets: [
      'Multi-answer suggestions',
      'Confidence feedback',
      'Copy & save best response'
    ],
    tag: 'Best for: Live practice',
    tagClass: 'tag-blue',
    btnText: 'Start Copilot',
    btnClass: 'btn-royal-blue',
    action: 'skills'
  },
  {
    id: 'notetaker',
    title: 'Smart Notetaker',
    badge: 'NEW',
    badgeClass: 'badge-green',
    desc: 'Automatically capture questions, answers, and key feedback with timestamps.',
    bullets: [
      'Speaker labels',
      'Live notes',
      'Export to PDF'
    ],
    tag: 'Best for: Calls & mock interviews',
    tagClass: 'tag-green',
    btnText: 'Open Notetaker',
    btnClass: 'btn-navy-dark',
    action: 'notetaker'
  },
  {
    id: 'resume',
    title: 'Resume Builder',
    badge: 'AI',
    badgeClass: 'badge-purple',
    desc: 'Optimize your resume with ATS scoring, keyword analysis, and AI suggestions.',
    bullets: [
      'ATS keyword gaps',
      'Tailored bullet rewrites',
      'Version history'
    ],
    footnote: "ATS scores are estimates and don't guarantee hiring outcomes.",
    tag: 'Best for: Resume upgrades',
    tagClass: 'tag-purple',
    btnText: 'Improve Resume',
    btnClass: 'btn-navy-dark',
    action: 'upload'
  },
  {
    id: 'radar',
    title: 'Job Radar',
    badge: null,
    badgeClass: '',
    desc: 'Find relevant jobs based on your location, skills, and preferences.',
    bullets: [
      'IP-based location + manual',
      'Filter by remote/hybrid',
      'Save jobs & alerts'
    ],
    tag: 'Best for: Finding roles fast',
    tagClass: 'tag-cyan',
    btnText: 'Discover Jobs',
    btnClass: 'btn-navy-dark',
    action: 'dashboard'
  },
  {
    id: 'system-design',
    title: 'System Design Studio',
    badge: 'PRO',
    badgeClass: 'badge-purple',
    desc: 'Interactive architecture simulations with scalability analysis and trade-offs.',
    bullets: [
      'Distributed systems templates',
      'Bottleneck & latency auditor',
      'Live whiteboard flow coach'
    ],
    tag: 'Best for: Senior & Lead roles',
    tagClass: 'tag-blue',
    btnText: 'Explore Studio',
    btnClass: 'btn-navy-dark',
    action: 'skills'
  },
  {
    id: 'voice-mock',
    title: 'Voice Mock Arena',
    badge: 'HOT',
    badgeClass: 'badge-green',
    desc: 'Speak naturally with an ultra-realistic voice interviewer that challenges your reasoning.',
    bullets: [
      'Realistic human voice latency',
      'Speech pace & tone feedback',
      'Adaptive recruiter follow-ups'
    ],
    tag: 'Best for: Verbal & Phone rounds',
    tagClass: 'tag-green',
    btnText: 'Launch Voice Coach',
    btnClass: 'btn-royal-blue',
    action: 'voice-agent'
  }
];

const reminderCardsData = [
  {
    key: 'voice',
    title: 'Voice Call',
    badge: null,
    desc: 'Get a phone call reminder before high-stakes interviews.',
    meta: '5, 15, 30 min before',
    metaIcon: '🕒',
    tag: 'Best for: High-stakes interviews',
    tagClass: 'tag-blue'
  },
  {
    key: 'email',
    title: 'Email',
    badge: 'ON',
    desc: 'Branded emails with prep tips delivered to your inbox.',
    meta: 'Calendar invites attached',
    metaIcon: '📅',
    tag: 'Best for: Daily prep reminders',
    tagClass: 'tag-blue'
  },
  {
    key: 'sms',
    title: 'SMS',
    badge: null,
    desc: 'Instant texts that cut through the noise.',
    meta: 'Any carrier, any country',
    metaIcon: '✔',
    tag: 'Best for: Last-minute alerts',
    tagClass: 'tag-blue'
  },
  {
    key: 'push',
    title: 'Push',
    badge: 'ON',
    desc: 'Browser and mobile notifications on the go.',
    meta: 'One-tap join links',
    metaIcon: '🔗',
    tag: 'Best for: On-the-move updates',
    tagClass: 'tag-blue'
  },
  {
    key: 'whatsapp',
    title: 'WhatsApp Alert',
    badge: 'NEW',
    desc: 'Quick bullet cheat-sheet & direct meeting link sent to your phone.',
    meta: 'Instant 1-tap briefing',
    metaIcon: '💬',
    tag: 'Best for: Mobile readiness',
    tagClass: 'tag-green'
  },
  {
    key: 'calendar',
    title: 'Calendar Sync',
    badge: 'SYNC',
    desc: 'Auto-schedule focus blocks and warm-up prep 20m before.',
    meta: 'Google & Outlook auto-sync',
    metaIcon: '📆',
    tag: 'Best for: No double booking',
    tagClass: 'tag-cyan'
  }
];

const marqueeFeatures = [...featureCardsData, ...featureCardsData, ...featureCardsData, ...featureCardsData];
const marqueeReminders = [...reminderCardsData, ...reminderCardsData, ...reminderCardsData, ...reminderCardsData];

export default function HomeSlides({ setCurrentView, openAuthModal, user }) {
  const [activeSlide, setActiveSlide] = useState(0);

  const handleCtaClick = (targetView) => {
    if (user) {
      setCurrentView(targetView);
    } else if (openAuthModal) {
      openAuthModal('signup', targetView);
    } else {
      setCurrentView(targetView);
    }
  };

  // Reminders interactive state
  const [selectedReminders, setSelectedReminders] = useState({
    voice: false,
    email: true,
    sms: false,
    push: true,
    whatsapp: true,
    calendar: false
  });

  // FAQ Accordion open index
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const toggleReminder = (key) => {
    setSelectedReminders(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Video Player state
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);

  const toggleVideoPlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const toggleVideoMute = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const slideIds = ['slide-0', 'slide-demo-video', 'slide-1', 'slide-2', 'slide-3', 'slide-4', 'slide-5', 'slide-6'];

  const scrollToSlide = (index) => {
    setActiveSlide(index);
    const targetId = slideIds[index];
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const container = document.querySelector('.slider-container');
      const scrollY = container ? container.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);
      const slideElements = slideIds.map(id => document.getElementById(id));
      const scrollPosition = scrollY + window.innerHeight / 3;

      for (let i = slideElements.length - 1; i >= 0; i--) {
        const el = slideElements[i];
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSlide(i);
          break;
        }
      }
    };

    const container = document.querySelector('.slider-container');
    window.addEventListener('scroll', handleScroll, { passive: true });
    if (container) container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (container) container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const faqs = [
    {
      q: 'What is My Interview Copilot and how does it work?',
      a: 'My Interview Copilot is an AI-powered preparation and real-time copilot tool that listens to interview questions, captures live transcripts, and suggests structured STAR responses and system design frameworks to boost your interview performance.'
    },
    {
      q: 'Is this a real interview or just practice?',
      a: 'It serves both as an interactive AI practice coach with simulated voice mock interviews and as a live real-time stealth copilot during your actual interviews.'
    },
    {
      q: 'What types of interviews can I practice?',
      a: 'You can practice Software Engineering, System Design, Product Management, Data Science, Financial Analysis, Behavioral/Leadership rounds, and career switching screens.'
    },
    {
      q: 'Do I need to upload my resume to get started?',
      a: 'No resume is required to start! However, uploading your resume allows the AI to personalize question difficulty and tailor STAR bullet points to your genuine work experience.'
    },
    {
      q: 'Is it free to use?',
      a: 'Yes! We offer a generous Free Practice tier with mock interviews and basic transcription features.'
    },
    {
      q: 'How is my data and privacy protected?',
      a: 'All data is processed strictly for personal use with 256-bit encryption. We enforce zero data retention and you can delete your sessions at any time.'
    }
  ];

  return (
    <div className="main-content-view">
      {/* Right Side Vertical Pagination Dots */}
      <div className="vertical-pagination-bar">
        {slideIds.map((slideId, idx) => (
          <button
            key={idx}
            className={`pagination-dot ${activeSlide === idx ? 'active' : ''}`}
            onClick={() => scrollToSlide(idx)}
            title={`Slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* SLIDE 1: HERO */}
      <section id="slide-0" className="slide-section" style={{ paddingTop: '16px' }}>
        {/* Exact Pill Tag */}
        <div className="hero-tag-pill">
          <Zap size={14} fill="#2563eb" />
          <span>AI-Powered Interview Coach</span>
        </div>

        {/* Exact Headline */}
        <h1 className="hero-main-title">
          Interview Smarter <br />
          <span className="hero-green-text">with Your AI Copilot</span>
        </h1>

        {/* Exact Subtitle */}
        <p className="hero-subtitle">
          Thousands of candidates have already used our AI interviews and report highly positive, confidence-boosting feedback on their performance.
        </p>

        {/* Social Proof: Avatars + 50K+ users & 4.9/5 rating */}
        <div className="hero-social-row">
          <div className="avatar-stack-circles">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
              alt="user 1"
              className="avatar-circle-img"
            />
            <img
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
              alt="user 2"
              className="avatar-circle-img"
            />
            <img
              src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80"
              alt="user 3"
              className="avatar-circle-img"
            />
          </div>

          <div className="hero-social-text">
            <span className="social-user-count"><strong>50K+</strong> users</span>
            <span className="social-stars">★★★★★</span>
            <span className="social-rating-text">4.9/5 rating</span>
          </div>
        </div>

        {/* Hero Actions: Go to Skill Selection + Watch Demo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            className="orange-action-btn"
            onClick={() => handleCtaClick('skills')}
          >
            <Zap size={18} fill="#ffffff" />
            <span>Go to Skill Selection</span>
            <ArrowRight size={18} />
          </button>

          <button
            className="hero-watch-demo-pill"
            onClick={() => {
              const el = document.getElementById('slide-demo-video');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          >
            <Play size={16} fill="#2563eb" style={{ color: '#2563eb' }} />
            <span>Watch Live Demo</span>
          </button>
        </div>

        {/* Exact Instant Access Subbar */}
        <div className="instant-access-subbar">
          <Check size={14} style={{ color: '#16a34a' }} />
          <span>Instant Access — <strong>start free</strong> , no payment details required</span>
        </div>

        {/* Exact Instant Feature Dots */}
        <div className="instant-features-dots">
          <div className="instant-feature-item">
            <span className="feature-green-dot"></span>
            <span>Real-time AI Feedback</span>
          </div>
          <div className="instant-feature-item">
            <span className="feature-green-dot"></span>
            <span>Speech Recognition</span>
          </div>
          <div className="instant-feature-item">
            <span className="feature-green-dot"></span>
            <span>Instant Results</span>
          </div>
        </div>
      </section>

      {/* VIDEO DEMO SECTION: BETWEEN HERO AND MARQUEE */}
      <section id="slide-demo-video" className="slide-section video-demo-slide">
        {/* Pill Tag */}
        <div className="hero-tag-pill" style={{ marginBottom: '14px' }}>
          <Play size={13} fill="#2563eb" style={{ color: '#2563eb' }} />
          <span>Interactive Product Walkthrough</span>
        </div>

        {/* Headline */}
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.6rem', fontWeight: 450, letterSpacing: '-2px', color: varHeadingColor() }}>
          See My Interview Copilot <span style={{ background: 'linear-gradient(135deg, #2563eb 0%, #10b981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>in Action</span>
        </h2>

        {/* Subtitle */}
        <p style={{ fontSize: '1rem', color: 'var(--text-muted)', maxWidth: '640px', margin: '10px auto 0 auto', lineHeight: '1.6' }}>
          Watch how our real-time AI listens, transcribes questions, and provides instantaneous STAR-method responses during live interviews.
        </p>

        {/* Modern Mac/App Window Video Container */}
        <div className="video-showcase-window">
          {/* Top Window Bar */}
          <div className="video-window-header">
            {/* Window Dots */}
            <div className="video-window-dots">
              <span className="window-dot dot-red"></span>
              <span className="window-dot dot-yellow"></span>
              <span className="window-dot dot-green"></span>
            </div>

            {/* Title / Status Pill */}
            <div className="video-window-title">
              <span className="live-rec-dot"></span>
              <span>Live Demonstration • Audio &amp; HUD Overlay</span>
            </div>

            {/* Window Right Action Tools */}
            <div className="video-window-actions">
              <button 
                className="video-action-tool-btn" 
                onClick={toggleVideoMute} 
                title={isMuted ? "Unmute Sound" : "Mute Sound"}
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                <span>{isMuted ? "Unmute" : "Muted"}</span>
              </button>
            </div>
          </div>

          {/* Video Player Display */}
          <div className="video-player-frame" onClick={toggleVideoPlay}>
            <video
              ref={videoRef}
              src="/demo-walkthrough.mp4"
              className="video-element"
              autoPlay
              loop
              muted={isMuted}
              playsInline
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {/* Big Centered Play Button Overlay when paused */}
            {!isPlaying && (
              <div className="video-play-overlay">
                <div className="play-pulse-circle">
                  <Play size={28} fill="#ffffff" color="#ffffff" style={{ marginLeft: '4px' }} />
                </div>
              </div>
            )}
          </div>

          {/* Video Footer Highlights Strip */}
          <div className="video-features-footer-strip">
            <div className="video-feature-pill">
              <Zap size={14} style={{ color: '#2563eb' }} />
              <span>&lt; 300ms Speech-to-Text Response</span>
            </div>
            <div className="video-feature-pill">
              <CheckCircle2 size={14} style={{ color: '#10b981' }} />
              <span>100% Stealth &amp; Zoom/Meet Undetectable</span>
            </div>
            <div className="video-feature-pill">
              <Sparkles size={14} style={{ color: '#9333ea' }} />
              <span>Structured STAR Formatted Answers</span>
            </div>
          </div>
        </div>
      </section>

      {/* SLIDE 2: 4 CORE FEATURE CARDS - MARQUEE LEFT TO RIGHT */}
      <section id="slide-1" className="slide-section" style={{ overflow: 'hidden', paddingLeft: 0, paddingRight: 0 }}>
        <div className="cards-marquee-container">
          <div className="cards-marquee-track marquee-track-ltr">
            {marqueeFeatures.map((card, idx) => (
              <div key={`${card.id}-${idx}`} className="feature-product-card-marquee">
                <div className="card-top-title-row">
                  <span className="card-main-heading">{card.title}</span>
                  {card.badge && (
                    <span className={`badge-tag-pill ${card.badgeClass}`}>{card.badge}</span>
                  )}
                </div>
                <p className="card-desc-text">{card.desc}</p>
                <ul className="card-bullets-list">
                  {card.bullets.map((bullet, bIdx) => (
                    <li key={bIdx} className="card-bullet-item">
                      <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                {card.footnote && (
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', marginBottom: '8px' }}>
                    {card.footnote}
                  </div>
                )}
                <div className={`card-bottom-tag ${card.tagClass}`}>{card.tag}</div>
                <button
                  className={`card-action-btn ${card.btnClass}`}
                  onClick={() => handleCtaClick(card.action)}
                >
                  <span>{card.btnText}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SLIDE 3: SCHEDULE REMINDERS - MARQUEE LEFT TO RIGHT + FIXED EXPLORE BUTTON */}
      <section id="slide-2" className="slide-section" style={{ overflow: 'hidden', paddingLeft: 0, paddingRight: 0 }}>
        <div style={{ padding: '0 24px', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.8rem', fontWeight: 450, letterSpacing: '-2.5px', color: varHeadingColor() }}>
            Schedule reminders <span style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>anytime, anywhere</span>
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: '12px auto 0 auto', lineHeight: '1.6' }}>
            Voice calls, emails, SMS, or push notifications — pick how you want to be reminded and let us handle the rest.
          </p>
        </div>

        <div className="cards-marquee-container">
          <div className="cards-marquee-track marquee-track-ltr">
            {marqueeReminders.map((rem, idx) => {
              const isSelected = !!selectedReminders[rem.key];
              return (
                <div key={`${rem.key}-${idx}`} className="reminder-item-card-marquee">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-title)' }}>
                      {rem.title}
                    </span>
                    {rem.badge && (
                      <span className="badge-tag-pill" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                        {rem.badge}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', minHeight: '44px' }}>
                    {rem.desc}
                  </p>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-body)', margin: '14px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{rem.metaIcon}</span>
                    <span>{rem.meta}</span>
                  </div>
                  <div className={`card-bottom-tag ${rem.tagClass}`}>
                    {rem.tag}
                  </div>
                  <button
                    className={`reminder-btn-toggle ${isSelected ? 'btn-toggle-active' : 'btn-toggle-inactive'}`}
                    onClick={() => toggleReminder(rem.key)}
                  >
                    {isSelected ? '✔ Selected' : 'Tap to enable'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Explore Full Scheduling Button - Fixed, Centered & Premium Styled */}
        <div className="explore-scheduling-container">
          <button
            className="explore-scheduling-pill-btn"
            onClick={() => handleCtaClick('skills')}
          >
            <span className="explore-btn-zap-badge">
              <Zap size={14} className="btn-zap-icon" />
            </span>
            <span className="explore-btn-text">Explore Full Scheduling</span>
            <ArrowRight size={15} className="btn-arrow-icon" />
          </button>
        </div>
      </section>

      {/* SLIDE 4: EVERY CAREER */}
      <section id="slide-3" className="slide-section">
        <div className="hero-tag-pill" style={{ marginBottom: '14px' }}>
          <Sparkles size={14} style={{ color: '#2563eb' }} />
          <span>Universal Career Coverage</span>
        </div>

        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.8rem', fontWeight: 450, letterSpacing: '-2.5px', color: varHeadingColor() }}>
          AI Interview Coach for <span style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Every Career</span>
        </h2>

        <p style={{ fontSize: '1rem', color: 'var(--text-muted)', maxWidth: '680px', margin: '12px auto 0 auto', lineHeight: '1.6' }}>
          Practice real interview questions with an AI coach that gives tailored questions, instant feedback, and guided support - so you feel confident and prepared for your next interview.
        </p>

        <div className="industry-cards-row">
          <div className="industry-pill-box" onClick={() => handleCtaClick('skills')}>Engineering & Tech</div>
          <div className="industry-pill-box" onClick={() => handleCtaClick('skills')}>All Careers & Industries</div>
          <div className="industry-pill-box" onClick={() => handleCtaClick('skills')}>Freelancers & Contractors</div>
          <div className="industry-pill-box" onClick={() => handleCtaClick('skills')}>Career Changers</div>
        </div>

        <div className="stats-counter-bar">
          <div className="stat-item">
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} />
            </div>
            <div>
              <div className="stat-num-bold">12,983 +</div>
              <div className="stat-label-muted">Happy Users</div>
            </div>
          </div>

          <div className="stat-item">
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={18} />
            </div>
            <div>
              <div className="stat-num-bold">98.5%</div>
              <div className="stat-label-muted">Satisfaction Rate</div>
            </div>
          </div>

          <div className="stat-item">
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff7ed', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ThumbsUp size={18} />
            </div>
            <div>
              <div className="stat-num-bold">4.9/5</div>
              <div className="stat-label-muted">Average Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* SLIDE 5: COMMUNITY IN ACTION */}
      <section id="slide-4" className="slide-section">
        <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <div style={{ width: 4, height: 22, background: '#10b981', borderRadius: '2px' }}></div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 450, letterSpacing: '-2.5px', color: 'var(--text-title)' }}>
            Community in Action
          </h3>
        </div>

        <div className="community-split-grid">
          {/* Left: Feed list */}
          <div className="activity-feed-list">
            <div className="activity-feed-item">
              <div className="feed-avatar" style={{ background: '#059669' }}>V</div>
              <div className="feed-text-content"><strong>Valentina M.</strong> communicated their value clearly</div>
              <span className="feed-time-tag">Moments ago</span>
            </div>
            <div className="activity-feed-item">
              <div className="feed-avatar" style={{ background: '#2563eb' }}>H</div>
              <div className="feed-text-content"><strong>Hugo H.</strong> polished their project explanations</div>
              <span className="feed-time-tag">Moments ago</span>
            </div>
            <div className="activity-feed-item">
              <div className="feed-avatar" style={{ background: '#0284c7' }}>J</div>
              <div className="feed-text-content"><strong>Jack N.</strong> gained peace of mind before interviews</div>
              <span className="feed-time-tag">Moments ago</span>
            </div>
            <div className="activity-feed-item">
              <div className="feed-avatar" style={{ background: '#0d9488' }}>L</div>
              <div className="feed-text-content"><strong>Lorenzo W.</strong> discovered areas for improvement</div>
              <span className="feed-time-tag">Moments ago</span>
            </div>
            <div className="activity-feed-item">
              <div className="feed-avatar" style={{ background: '#7c3aed' }}>F</div>
              <div className="feed-text-content"><strong>Felipe J.</strong> communicated their value clearly</div>
              <span className="feed-time-tag">Moments ago</span>
            </div>
          </div>

          {/* Right: Review Card */}
          <div className="community-review-card">
            <div style={{ position: 'absolute', top: -12, right: 20, background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', padding: '3px 12px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: '700' }}>
              ♥ South Africa / Life-changing interview practice!
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.1rem' }}>
                D
              </div>
              <div>
                <div style={{ fontWeight: '800', color: 'var(--text-title)', fontSize: '1.05rem' }}>David C.</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DevOps Engineer</div>
              </div>
            </div>

            <div style={{ color: '#fbbf24', letterSpacing: '2px', margin: '14px 0' }}>★★★★★</div>

            <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#16a34a' }}>AI FEEDBACK</div>
              <div style={{ fontSize: '0.92rem', fontWeight: '700', color: '#15803d' }}>Technical depth is amazing!</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Confidence Score</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: '900', color: '#2563eb' }}>96%</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '18px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#cbd5e1' }}></span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#cbd5e1' }}></span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#cbd5e1' }}></span>
              <span style={{ width: 18, height: 6, borderRadius: '4px', background: '#2563eb' }}></span>
            </div>

            <button
              className="action-pill-btn"
              style={{ width: '100%', justifyContent: 'center', background: '#f1f5f9', color: '#334155' }}
              onClick={() => handleCtaClick('skills')}
            >
              Join the community
            </button>
          </div>
        </div>
      </section>

      {/* SLIDE 6: SUNSET GRADIENT CTA BANNER */}
      <section id="slide-5" className="slide-section">
        <div className="sunset-cta-card">
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem', fontWeight: 450, letterSpacing: '-2.5px', color: '#ffffff' }}>
            Get Interview-Ready With Your AI Copilot
          </h2>
          <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.92)', maxWidth: '640px', marginTop: '10px', lineHeight: '1.6' }}>
            Candidates love it: quick, realistic AI interviews with instant feedback that boost your confidence for the real thing.
          </p>

          <button
            className="cta-white-btn"
            onClick={() => handleCtaClick('skills')}
          >
            <span>🚀 Practice My Interview Free</span>
          </button>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.82rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '999px' }}>✔ No resume required</span>
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '999px' }}>✔ No credit card</span>
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '999px' }}>✔ Free sign-up</span>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', marginTop: '16px' }}>
            ● Join thousands of candidates who landed their dream jobs
          </div>
        </div>
      </section>

      {/* SLIDE 7: FAQ ACCORDIONS */}
      <section id="slide-6" className="slide-section">
        <div className="hero-tag-pill" style={{ marginBottom: '14px' }}>
          <HelpCircle size={14} />
          <span>Frequently Asked Questions</span>
        </div>

        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem', fontWeight: 450, letterSpacing: '-2.5px', color: varHeadingColor() }}>
          Got Questions? We've Got Answers
        </h2>

        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '6px' }}>
          Everything you need to know about our AI interview practice tool
        </p>

        <div className="faq-accordion-box">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="faq-row-item"
                onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
              >
                <div className="faq-row-header">
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
                {isOpen && (
                  <div className="faq-row-body">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function varHeadingColor() {
  return 'var(--text-title)';
}
