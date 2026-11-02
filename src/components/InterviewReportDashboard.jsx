import React, { useState } from 'react';
import './InterviewReportDashboard.css';
import { CREDIT_USAGE_CONFIG, getUserCredits, recordDownloadAction } from '../config/creditUsageConfig';
import { downloadPdfReport, renderQaCard } from '../utils/pdfReportTemplate';
import PdfCustomizerModal from './PdfCustomizerModal';

export default function InterviewReportDashboard({
  report,
  session,
  onClose,
  onReevaluate,
  isReevaluating = false,
  darkMode = false
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'questions'
  const [expandedQuestionIdx, setExpandedQuestionIdx] = useState(0);
  const [pdfCustomizerModal, setPdfCustomizerModal] = useState({
    isOpen: false,
    reportData: null,
    filename: 'report.pdf'
  });

  if (!report) return null;

  const overallScore = Number(report.overallScore) || 42;
  const verdict = report.verdict || (overallScore >= 85 ? 'Strong Hire' : (overallScore >= 75 ? 'Hire' : (overallScore >= 65 ? 'Lean Hire' : 'Needs Practice')));
  const summary = report.summary || 'The candidate demonstrated solid technical knowledge but delivered overly long answers that lacked conciseness and natural interview flow.';
  
  const rawCategories = report.categoryScores || {};
  const speaking = report.speakingMetrics || {};
  const strengths = Array.isArray(report.strengths) && report.strengths.length > 0 
    ? report.strengths 
    : ['Demonstrated deep, comprehensive technical knowledge across language history, characteristics, and modern usage for both Java and JavaScript.'];
  
  const weaknesses = Array.isArray(report.weaknesses) && report.weaknesses.length > 0 
    ? report.weaknesses 
    : (Array.isArray(report.areasForGrowth) && report.areasForGrowth.length > 0 
        ? report.areasForGrowth 
        : ['Answers were far too long and detailed for typical interview settings; need to focus on brevity and adjust depth based on interviewer cues.']);

  const questionAudit = Array.isArray(report.questionAudit) ? report.questionAudit : [];

  const getBadgeType = (score) => {
    if (score >= 80) return { label: 'Strong', colorClass: 'badge-strong' };
    if (score >= 68) return { label: 'Good', colorClass: 'badge-good' };
    if (score >= 50) return { label: 'Fair', colorClass: 'badge-fair' };
    return { label: 'Poor', colorClass: 'badge-poor' };
  };

  const getVerdictBadgeClass = (v) => {
    const norm = String(v).toLowerCase();
    if (norm.includes('strong')) return 'verdict-strong';
    if (norm.includes('lean')) return 'verdict-lean';
    if (norm.includes('hire')) return 'verdict-hire';
    return 'verdict-needs-practice';
  };

  const vocabScore = rawCategories.vocabularyScore ?? 75;
  const englishScore = rawCategories.grammarScore ?? rawCategories.englishScore ?? 65;
  const confidenceScore = rawCategories.confidenceScore ?? 70;
  const starScore = rawCategories.starScore ?? 35;
  const pacingScore = rawCategories.pacingScore ?? 80;
  const concisenessScore = rawCategories.concisenessScore ?? 25;
  const technicalScore = rawCategories.technicalScore ?? 85;

  const wpm = speaking.wpm || 135;
  const fillerCount = speaking.fillerCount !== undefined ? speaking.fillerCount : 4;
  const fillerWordsList = speaking.frequentFillers || (speaking.fillerBreakdown ? Object.keys(speaking.fillerBreakdown) : ['um', 'uh', 'like', 'you know']);

  const handlePrintPdf = async () => {
    const cost = CREDIT_USAGE_CONFIG.downloads.creditCostPerDownload;
    const currentBal = getUserCredits();
    if (currentBal < cost) {
      alert(`Insufficient credits to download PDF report. Need ${cost} credits (Balance: ${currentBal}).`);
      return;
    }

    const sections = [];

    // Executive Summary
    sections.push({
      title: 'EXECUTIVE SUMMARY',
      itemsHtml: `
        <div style="background:#f8fafc; padding:16px 20px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span style="font-size:16px; font-weight:700; color:#1e293b;">Overall Score: ${overallScore}/100</span>
            <span style="font-size:14px; font-weight:600; padding:4px 12px; border-radius:9999px; background:#e0e7ff; color:#3730a3;">${verdict}</span>
          </div>
          <p style="margin:0; font-size:14px; line-height:1.6; color:#475569;">${summary}</p>
        </div>
      `
    });

    // Strengths & Areas for Improvement
    const strengthsHtml = strengths.map(s => `<li style="margin-bottom:6px; color:#166534;">${s}</li>`).join('');
    const weaknessesHtml = weaknesses.map(w => `<li style="margin-bottom:6px; color:#991b1b;">${w}</li>`).join('');
    sections.push({
      title: 'KEY STRENGTHS & AREAS FOR IMPROVEMENT',
      itemsHtml: `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:14px 18px;">
            <div style="font-weight:700; color:#15803d; margin-bottom:8px; font-size:14px;">Key Strengths</div>
            <ul style="margin:0; padding-left:18px; font-size:13.5px; line-height:1.5;">${strengthsHtml}</ul>
          </div>
          <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:14px 18px;">
            <div style="font-weight:700; color:#b91c1c; margin-bottom:8px; font-size:14px;">Areas for Improvement</div>
            <ul style="margin:0; padding-left:18px; font-size:13.5px; line-height:1.5;">${weaknessesHtml}</ul>
          </div>
        </div>
      `
    });

    // Question Audit
    const questionAudit = report.questionAudit || [];
    if (questionAudit.length > 0) {
      const qaItemsHtml = questionAudit.map((q, idx) => {
        const fullAnswer = [
          q.candidateAnswer ? `<p><strong>Candidate:</strong> ${q.candidateAnswer}</p>` : '',
          q.feedback ? `<p style="color:#4f46e5; margin-top:8px;"><strong>Feedback:</strong> ${q.feedback}</p>` : '',
          q.goldenAnswer ? `<p style="color:#059669; margin-top:8px;"><strong>Recommended Golden Answer:</strong> ${q.goldenAnswer}</p>` : ''
        ].filter(Boolean).join('');

        return renderQaCard({
          questionNumber: idx + 1,
          timestamp: q.score ? `Score: ${q.score}/100` : '',
          question: q.question || 'Interview Question',
          answer: fullAnswer
        });
      }).join('');

      sections.push({
        title: 'QUESTIONS & EVALUATION AUDIT',
        itemsHtml: qaItemsHtml
      });
    }

    const reportData = {
      title: 'Interview Evaluation Report',
      subtitle: `${session?.tech || 'Software Engineering'} - ${session?.timestamp || new Date().toLocaleDateString()}`,
      badges: [
        `Overall Score: ${overallScore}/100`,
        `Verdict: ${verdict}`,
        `Tech: ${session?.tech || 'General'}`
      ],
      sections,
      footerText: `Generated by Meeting Copilot - ${session?.timestamp || new Date().toLocaleDateString()}`
    };

    setPdfCustomizerModal({
      isOpen: true,
      reportData,
      filename: `interview_report_${session?.id || 'export'}.pdf`
    });
  };

  const handleConfirmPdfCustomizerDownload = async ({ customizedHtml, filename, pdfTheme }) => {
    await downloadPdfReport({ htmlContent: customizedHtml, filename, pdfTheme });
    const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : null;
    await recordDownloadAction({
      fileType: 'Interview PDF Report',
      fileName: filename,
      token
    });
  };

  return (
    <div className={`report-dashboard-page ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      <div className="report-dashboard-container">
        
        {/* Top Header Navigation */}
        <div className="report-top-nav-bar">
          <button className="report-back-btn" onClick={onClose} type="button">
            <i className="fa-solid fa-arrow-left"></i> Back to Review
          </button>
          
          <div className="report-session-details">
            <span className="session-title-label">
              <i className="fa-solid fa-code"></i> {session?.tech || 'Software Engineering'}
            </span>
            <span className="session-time-pill">
              <i className="fa-solid fa-clock"></i> {session?.durationDisplay || '00:00:32'}
            </span>
            <span className="session-date-pill">
              <i className="fa-regular fa-calendar"></i> {session?.timestamp || new Date().toLocaleDateString()}
            </span>
          </div>

          <div className="report-nav-actions">
            {onReevaluate && (
              <button 
                className="report-action-btn btn-secondary" 
                onClick={onReevaluate}
                disabled={isReevaluating}
                type="button"
              >
                <i className={`fa-solid fa-rotate-right ${isReevaluating ? 'fa-spin' : ''}`}></i>
                {isReevaluating ? 'Analyzing…' : 'Re-evaluate'}
              </button>
            )}
            <button className="report-action-btn btn-primary" onClick={handlePrintPdf} type="button">
              <i className="fa-solid fa-file-pdf"></i> Download Report (PDF)
            </button>
          </div>
        </div>

        <div className="report-scrollable-body">
          {/* 1. Header Section Title */}
          <div className="section-kicker-title">
            <i className="fa-solid fa-chart-line"></i> INTERVIEW SCORE &amp; PERFORMANCE EVALUATION
          </div>

          {/* 2. Executive Performance Summary Hero Card */}
          <div className="executive-summary-card">
            <div className="score-badge-col">
              <div className="score-circle-solid">
                <span className="score-val-big">{overallScore}</span>
                <span className="score-val-denom">/100</span>
              </div>
              <span className={`verdict-pill-tag ${getVerdictBadgeClass(verdict)}`}>
                {verdict.toUpperCase()}
              </span>
            </div>

            <div className="summary-text-col">
              <h2 className="summary-card-title">Executive Performance Summary</h2>
              <p className="summary-card-desc">{summary}</p>
              
              <div className="summary-actions-row">
                <button className="btn-hero-primary" onClick={handlePrintPdf} type="button">
                  <i className="fa-solid fa-file-pdf"></i> Download Report (PDF)
                </button>
                {onReevaluate && (
                  <button 
                    className="btn-hero-outline" 
                    onClick={onReevaluate} 
                    disabled={isReevaluating}
                    type="button"
                  >
                    <i className={`fa-solid fa-rotate-right ${isReevaluating ? 'fa-spin' : ''}`}></i>
                    {isReevaluating ? 'Analyzing…' : 'Re-analyze'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3. Core Skill Dimensions Section */}
          <div className="section-kicker-title" style={{ marginTop: '28px' }}>
            <i className="fa-solid fa-layer-group"></i> CORE SKILL DIMENSIONS
          </div>

          <div className="core-dimensions-grid">
            {/* Card 1: Vocabulary Proficiency */}
            <div className="dimension-card">
              <div className="dim-header">
                <span className="dim-title"><i className="fa-solid fa-book-open"></i> Vocabulary Proficiency</span>
                <span className="dim-percent">{vocabScore}%</span>
              </div>
              <div className="dim-progress-track">
                <div className="dim-progress-bar bar-teal" style={{ width: `${vocabScore}%` }}></div>
              </div>
              <div className="dim-badge-row">
                <span className={`dim-level-badge ${getBadgeType(vocabScore).colorClass}`}>
                  {getBadgeType(vocabScore).label}
                </span>
              </div>
              <p className="dim-description">
                {rawCategories.vocabularyFeedback || 'Strong command of technical terminology with accurate use of terms like "prototype-based", "dynamically typed", "WORA", and "multi-paradigm".'}
              </p>
            </div>

            {/* Card 2: English Speaking Skills */}
            <div className="dimension-card">
              <div className="dim-header">
                <span className="dim-title"><i className="fa-solid fa-language"></i> English Speaking Skills</span>
                <span className="dim-percent">{englishScore}%</span>
              </div>
              <div className="dim-progress-track">
                <div className="dim-progress-bar bar-blue" style={{ width: `${englishScore}%` }}></div>
              </div>
              <div className="dim-badge-row">
                <span className={`dim-level-badge ${getBadgeType(englishScore).colorClass}`}>
                  {getBadgeType(englishScore).label}
                </span>
              </div>
              <p className="dim-description">
                {rawCategories.grammarFeedback || 'Generally clear but overly formal and complex sentence structures. Some awkward phrasing and run-on explanations reduce natural fluency.'}
              </p>
            </div>

            {/* Card 3: Confidence & Presence */}
            <div className="dimension-card">
              <div className="dim-header">
                <span className="dim-title"><i className="fa-solid fa-user-check"></i> Confidence &amp; Presence</span>
                <span className="dim-percent">{confidenceScore}%</span>
              </div>
              <div className="dim-progress-track">
                <div className="dim-progress-bar bar-teal" style={{ width: `${confidenceScore}%` }}></div>
              </div>
              <div className="dim-badge-row">
                <span className={`dim-level-badge ${getBadgeType(confidenceScore).colorClass}`}>
                  {getBadgeType(confidenceScore).label}
                </span>
              </div>
              <p className="dim-description">
                {rawCategories.confidenceFeedback || 'Shows confidence through depth of knowledge, but delivery feels rehearsed rather than spontaneous, with initial hesitation visible in the transcript.'}
              </p>
            </div>

            {/* Card 4: STAR Structuring */}
            <div className="dimension-card">
              <div className="dim-header">
                <span className="dim-title"><i className="fa-solid fa-star"></i> STAR Structuring</span>
                <span className="dim-percent">{starScore}%</span>
              </div>
              <div className="dim-progress-track">
                <div className="dim-progress-bar bar-blue" style={{ width: `${starScore}%` }}></div>
              </div>
              <div className="dim-badge-row">
                <span className={`dim-level-badge ${getBadgeType(starScore).colorClass}`}>
                  {getBadgeType(starScore).label}
                </span>
              </div>
              <p className="dim-description">
                {rawCategories.starFeedback || 'No evidence of STAR (Situation, Task, Action, Result) or structured framework. Answers are unstructured information dumps without clear organization or storytelling.'}
              </p>
            </div>

            {/* Card 5: Filler Words & Pacing */}
            <div className="dimension-card">
              <div className="dim-header">
                <span className="dim-title"><i className="fa-solid fa-wave-square"></i> Filler Words &amp; Pacing</span>
                <span className="dim-percent">{pacingScore}%</span>
              </div>
              <div className="dim-progress-track">
                <div className="dim-progress-bar bar-teal" style={{ width: `${pacingScore}%` }}></div>
              </div>
              <div className="dim-meta-chips-row">
                <span className="chip-meta"><i className="fa-solid fa-gauge-high"></i> {wpm} WPM</span>
                <span className="chip-meta"><i className="fa-solid fa-filter"></i> {fillerCount} Fillers</span>
              </div>
              {fillerWordsList.length > 0 && (
                <div className="filler-red-chips">
                  {fillerWordsList.slice(0, 4).map((fWord, i) => (
                    <span key={i} className="chip-filler-red">"{fWord}"</span>
                  ))}
                </div>
              )}
              <p className="dim-description">
                {speaking.feedback || 'Relatively low filler word usage, but the provided transcript is too short to fully assess natural speech patterns.'}
              </p>
            </div>

            {/* Card 6: Conciseness & Focus */}
            <div className="dimension-card">
              <div className="dim-header">
                <span className="dim-title"><i className="fa-solid fa-crosshairs"></i> Conciseness &amp; Focus</span>
                <span className="dim-percent">{concisenessScore}%</span>
              </div>
              <div className="dim-progress-track">
                <div className="dim-progress-bar bar-blue" style={{ width: `${concisenessScore}%` }}></div>
              </div>
              <div className="dim-badge-row">
                <span className={`dim-level-badge ${getBadgeType(concisenessScore).colorClass}`}>
                  {getBadgeType(concisenessScore).label}
                </span>
              </div>
              <p className="dim-description">
                {rawCategories.concisenessFeedback || 'Answers are excessively verbose and read like blog posts or documentation rather than interview responses. They include unnecessary history, philosophy, and senior-level framing that overwhelm the listener.'}
              </p>
            </div>

            {/* Card 7: Technical Accuracy */}
            <div className="dimension-card">
              <div className="dim-header">
                <span className="dim-title"><i className="fa-solid fa-gear"></i> Technical Accuracy</span>
                <span className="dim-percent">{technicalScore}%</span>
              </div>
              <div className="dim-progress-track">
                <div className="dim-progress-bar bar-teal" style={{ width: `${technicalScore}%` }}></div>
              </div>
              <div className="dim-badge-row">
                <span className={`dim-level-badge ${getBadgeType(technicalScore).colorClass}`}>
                  {getBadgeType(technicalScore).label}
                </span>
              </div>
              <p className="dim-description">
                {rawCategories.technicalFeedback || 'Highly accurate technical content covering history, characteristics, use cases, and differences. Minor nit: JavaScript is not strictly "interpreted" in modern engines due to JIT compilation.'}
              </p>
            </div>
          </div>

          {/* 4. Bottom Strengths & Growth Areas */}
          <div className="strengths-growth-grid">
            {/* Left Card: Key Strengths */}
            <div className="feedback-banner banner-strengths">
              <div className="banner-header">
                <i className="fa-solid fa-circle-check"></i> Key Strengths
              </div>
              <ul className="banner-items-list">
                {strengths.map((item, idx) => (
                  <li key={idx}>
                    <span className="list-icon icon-check">✓</span>
                    <span className="list-text">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Card: Areas for Growth */}
            <div className="feedback-banner banner-growth">
              <div className="banner-header">
                <i className="fa-solid fa-lightbulb"></i> Areas for Growth
              </div>
              <ul className="banner-items-list">
                {weaknesses.map((item, idx) => (
                  <li key={idx}>
                    <span className="list-icon icon-arrow">↗</span>
                    <span className="list-text">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Optional Question Audit section if audit data is present */}
          {questionAudit.length > 0 && (
            <div className="question-audit-section">
              <div className="section-kicker-title" style={{ marginTop: '28px' }}>
                <i className="fa-solid fa-clipboard-question"></i> DETAILED QUESTION AUDIT ({questionAudit.length})
              </div>
              <div className="question-audit-list">
                {questionAudit.map((q, qIdx) => (
                  <div key={qIdx} className={`audit-card ${expandedQuestionIdx === qIdx ? 'expanded' : ''}`}>
                    <div 
                      className="audit-card-header" 
                      onClick={() => setExpandedQuestionIdx(expandedQuestionIdx === qIdx ? -1 : qIdx)}
                    >
                      <div className="audit-q-num">Q{qIdx + 1}</div>
                      <div className="audit-q-text">{q.question || `Question ${qIdx + 1}`}</div>
                      <div className="audit-q-score" style={{ color: q.score >= 75 ? '#10b981' : '#f59e0b' }}>
                        {q.score || overallScore}%
                      </div>
                      <i className={`fa-solid fa-chevron-${expandedQuestionIdx === qIdx ? 'up' : 'down'}`}></i>
                    </div>

                    {expandedQuestionIdx === qIdx && (
                      <div className="audit-card-body">
                        {q.candidateAnswer && (
                          <div className="audit-sub-block">
                            <span className="audit-sub-title">Candidate Answer:</span>
                            <p className="audit-sub-content">{q.candidateAnswer}</p>
                          </div>
                        )}
                        {q.feedback && (
                          <div className="audit-sub-block">
                            <span className="audit-sub-title">Critique &amp; Feedback:</span>
                            <p className="audit-sub-content">{q.feedback}</p>
                          </div>
                        )}
                        {q.goldenAnswer && (
                          <div className="audit-sub-block golden-answer-block">
                            <span className="audit-sub-title golden-title">✨ Recommended Golden Answer:</span>
                            <p className="audit-sub-content">{q.goldenAnswer}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
      <PdfCustomizerModal
        isOpen={pdfCustomizerModal.isOpen}
        onClose={() => setPdfCustomizerModal(prev => ({ ...prev, isOpen: false }))}
        reportData={pdfCustomizerModal.reportData}
        defaultFilename={pdfCustomizerModal.filename}
        onConfirmDownload={handleConfirmPdfCustomizerDownload}
        darkMode={darkMode}
      />
    </div>
  );
}
