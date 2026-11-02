import html2canvas from 'html2canvas';

export const COPILOT_ROBOT_LOGO = "data:image/png;base64,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";

/**
 * Escapes HTML characters safely.
 */
export function escapeHtml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats multi-paragraph text into clean <p> tags.
 */
export function formatParagraphs(text) {
  if (!text) return '';
  return escapeHtml(text)
    .split(/\n\s*\n/)
    .map(p => `<p style="margin: 0 0 12px 0 !important; line-height: 1.65 !important;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/**
 * Renders a standard Q&A Card matching the emerald left-border design
 */
export function renderQaCard({ questionNumber, timestamp = '', question = '', answer = '' }) {
  const answerHtml = formatParagraphs(answer) || '<p style="margin:0 !important; color:#6b7280 !important;">No answer generated.</p>';
  return `
    <div class="card-item" style="width: 100% !important; box-sizing: border-box !important; border: 1px solid #e5e7eb !important; border-left: 4px solid var(--accent-border-color, #10b981) !important; border-left-color: var(--accent-border-color, #10b981) !important; border-radius: 8px !important; padding: 18px 22px !important; margin-bottom: 18px !important; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important; page-break-inside: avoid !important; break-inside: avoid !important;">
      <div class="card-header" style="display: flex !important; align-items: center !important; gap: 10px !important; margin-bottom: 8px !important; font-size: 13px !important; color: #6b7280 !important;">
        <div class="round-badge" style="background-color: var(--accent-border-color, #10b981) !important; color: #ffffff !important; width: 26px !important; height: 26px !important; border-radius: 50% !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; font-weight: 700 !important; font-size: 12px !important; flex-shrink: 0 !important; margin-right: 10px !important;">Q${questionNumber}</div>
        <span style="color: #6b7280 !important; font-size: 12px !important;">${escapeHtml(timestamp ? `${timestamp} - auto-detected` : 'auto-detected')}</span>
      </div>
      <div class="card-title" style="font-weight: 700 !important; font-size: 16px !important; margin: 10px 0 12px 0 !important; color: #111827 !important; line-height: 1.4 !important;">${escapeHtml(question)}</div>
      <div class="card-body" style="font-size: 14px !important; line-height: 1.65 !important; color: #374151 !important;">${answerHtml}</div>
    </div>
  `;
}

/**
 * Renders a transcript row matching Candidate (lavender) / Interviewer (mint green) speech bubbles
 */
export function renderTranscriptRow({ time = '', speaker = 'interviewer', text = '' }) {
  const isCandidate = String(speaker).toLowerCase().includes('candidate') || String(speaker).toLowerCase() === 'user';
  const label = isCandidate ? 'Candidate' : 'Interviewer';
  
  const bubbleBg = isCandidate ? '#ede9fe' : '#d1fae5';
  const labelColor = isCandidate ? '#6b21a8' : '#065f46';
  const textColor = isCandidate ? '#374151' : '#1f2937';

  return `
    <div class="transcript-row" style="width: 100% !important; box-sizing: border-box !important; display: flex !important; gap: 14px !important; margin-bottom: 12px !important; align-items: flex-start !important; page-break-inside: avoid !important; break-inside: avoid !important;">
      <div class="transcript-time" style="font-size: 12px !important; color: #94a3b8 !important; width: 65px !important; padding-top: 6px !important; flex-shrink: 0 !important; font-family: monospace !important;">${escapeHtml(time)}</div>
      <div class="bubble" style="background-color: ${bubbleBg} !important; border-radius: 12px !important; padding: 8px 16px !important; max-width: 82% !important; font-size: 13.5px !important; line-height: 1.5 !important; display: inline-block !important;">
        <strong style="color: ${labelColor} !important; font-weight: 700 !important; margin-right: 6px !important;">${label}:</strong>
        <span style="color: ${textColor} !important;">${escapeHtml(text)}</span>
      </div>
    </div>
  `;
}

function darkenColor(hex, percent = 15) {
  try {
    let cleanHex = String(hex || '#2563eb').replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const num = parseInt(cleanHex, 16);
    if (isNaN(num)) return hex;
    const r = Math.max(0, Math.floor((num >> 16) * (100 - percent) / 100));
    const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * (100 - percent) / 100));
    const b = Math.max(0, Math.floor((num & 0x0000FF) * (100 - percent) / 100));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  } catch (_) {
    return hex;
  }
}

/**
 * Generates the full HTML string for the PDF report matching the reference design.
 * Uses a rigid 794px root wrapper so content never squishes into a narrow strip.
 * Supports dynamic companyName, logoUrl, themeColor, accentBorderColor, and fontSize.
 */
export function generateStyledReportHtml({
  title = 'Meeting Copilot Report',
  subtitle = '',
  companyName = 'Bright Access',
  logoUrl = COPILOT_ROBOT_LOGO,
  themeColor = '#2563eb',
  accentBorderColor = '#10b981',
  fontSize = '14px',
  pdfTheme = 'light',
  badges = [],
  sections = [],
  footerText = ''
}) {
  const activeLogo = logoUrl || COPILOT_ROBOT_LOGO;
  const activeCompany = companyName || 'Bright Access';
  const basePx = parseInt(fontSize, 10) || 14;
  const darkerTheme = darkenColor(themeColor, 18);
  const isDarkPdf = pdfTheme === 'dark';

  const docBg = isDarkPdf ? '#0b1120' : '#ffffff';
  const cardBg = isDarkPdf ? '#1e293b' : '#ffffff';
  const cardBorder = isDarkPdf ? 'rgba(255, 255, 255, 0.12)' : '#e5e7eb';
  const textPrimary = isDarkPdf ? '#f8fafc' : '#111827';
  const textSecondary = isDarkPdf ? '#cbd5e1' : '#374151';
  const textMuted = isDarkPdf ? '#94a3b8' : '#6b7280';
  const bubbleCandidateBg = isDarkPdf ? '#311042' : '#ede9fe';
  const bubbleCandidateText = isDarkPdf ? '#f3e8ff' : '#374151';
  const bubbleInterviewerBg = isDarkPdf ? '#063c2c' : '#d1fae5';
  const bubbleInterviewerText = isDarkPdf ? '#d1fae5' : '#1f2937';

  const badgeElements = badges
    .filter(Boolean)
    .map(b => `<div class="badge" style="background-color: rgba(255, 255, 255, 0.22) !important; border: 1px solid rgba(255, 255, 255, 0.35) !important; padding: 5px 16px !important; border-radius: 9999px !important; font-size: ${Math.round(basePx * 0.9)}px !important; font-weight: 500 !important; color: #ffffff !important; display: inline-block !important; white-space: nowrap !important;">${escapeHtml(b)}</div>`)
    .join('\n      ');

  const rawSectionsHtml = sections
    .map(sec => `
      <div class="section-title" style="width: 100% !important; box-sizing: border-box !important; font-size: ${Math.round(basePx * 1.05)}px !important; font-weight: 800 !important; text-transform: uppercase !important; letter-spacing: 0.08em !important; color: ${themeColor} !important; margin: 28px 0 16px 0 !important; border-bottom: 2px solid ${accentBorderColor} !important; padding-bottom: 8px !important; page-break-after: avoid !important; break-after: avoid !important;">${escapeHtml(sec.title)}</div>
      ${sec.itemsHtml || ''}
    `)
    .join('\n');

  // Dynamically replace any hardcoded #10b981 or default green border colors across all sections!
  const sectionsHtml = rawSectionsHtml
    .replace(/border-left:\s*4px\s*solid\s*#10b981/gi, `border-left: 4px solid ${accentBorderColor}`)
    .replace(/border-left-color:\s*#10b981/gi, `border-left-color: ${accentBorderColor}`)
    .replace(/background-color:\s*#10b981/gi, `background-color: ${accentBorderColor}`)
    .replace(/#10b981/gi, accentBorderColor);

  const defaultFooter = footerText || `Generated for ${activeCompany} by ${title} - ${subtitle || new Date().toLocaleString()}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      box-sizing: border-box !important;
    }
    @page {
      margin: 10mm 12mm;
      size: A4 portrait;
    }
    html, body {
      margin: 0;
      padding: 0;
      background-color: ${docBg} !important;
      color: ${textSecondary};
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      font-size: ${basePx}px;
    }
    #pdf-report-container {
      width: 794px !important;
      min-width: 794px !important;
      max-width: 794px !important;
      margin: 0 auto !important;
      padding: 24px 28px !important;
      box-sizing: border-box !important;
      background-color: ${docBg} !important;
    }
    .report-header {
      width: 100% !important;
      box-sizing: border-box !important;
      background: ${themeColor} !important;
      background-color: ${themeColor} !important;
      background-image: linear-gradient(135deg, ${themeColor} 0%, ${darkerTheme} 100%) !important;
      border-radius: 14px !important;
      padding: 24px 28px !important;
      color: #ffffff !important;
      margin-bottom: 26px !important;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .report-title-row {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      flex-wrap: wrap !important;
      gap: 12px !important;
      margin-bottom: 6px !important;
      width: 100% !important;
    }
    .report-title {
      font-size: ${Math.round(basePx * 1.7)}px !important;
      font-weight: 700 !important;
      margin: 0 !important;
      color: #ffffff !important;
      letter-spacing: -0.01em !important;
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      flex: 1 !important;
      min-width: 220px !important;
    }
    .report-company-tag {
      background-color: rgba(255, 255, 255, 0.28) !important;
      border: 1.5px solid rgba(255, 255, 255, 0.5) !important;
      padding: 6px 16px !important;
      border-radius: 9999px !important;
      font-size: ${Math.max(12, Math.round(basePx * 0.95))}px !important;
      font-weight: 700 !important;
      color: #ffffff !important;
      letter-spacing: 0.03em !important;
      white-space: nowrap !important;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15) !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
    }
    .report-logo {
      width: 36px !important;
      height: 36px !important;
      object-fit: contain !important;
      vertical-align: middle !important;
      flex-shrink: 0 !important;
      display: inline-block !important;
      border-radius: 6px !important;
    }
    .report-subtitle {
      width: 100% !important;
      font-size: ${Math.round(basePx * 0.95)}px !important;
      opacity: 0.92 !important;
      margin: 0 0 16px 0 !important;
      color: #ffffff !important;
      font-weight: 400 !important;
    }
    .badge-container {
      width: 100% !important;
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 10px !important;
    }
    .badge {
      background-color: rgba(255, 255, 255, 0.22) !important;
      border: 1px solid rgba(255, 255, 255, 0.35) !important;
      padding: 5px 16px !important;
      border-radius: 9999px !important;
      font-size: ${Math.round(basePx * 0.9)}px !important;
      font-weight: 500 !important;
      color: #ffffff !important;
      white-space: nowrap !important;
      display: inline-block !important;
    }
    .section-title {
      width: 100% !important;
      box-sizing: border-box !important;
      font-size: ${Math.round(basePx * 1.05)}px !important;
      font-weight: 800 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.08em !important;
      color: ${themeColor} !important;
      margin: 28px 0 16px 0 !important;
      border-bottom: 2px solid ${accentBorderColor} !important;
      padding-bottom: 8px !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .card-item {
      width: 100% !important;
      box-sizing: border-box !important;
      background-color: ${cardBg} !important;
      border: 1px solid ${cardBorder} !important;
      border-left: 4px solid ${accentBorderColor} !important;
      border-left-color: ${accentBorderColor} !important;
      border-radius: 8px !important;
      padding: 18px 22px !important;
      margin-bottom: 18px !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .card-header {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      margin-bottom: 8px !important;
      font-size: ${Math.round(basePx * 0.9)}px !important;
      color: ${textMuted} !important;
    }
    .round-badge {
      background-color: ${accentBorderColor} !important;
      color: #ffffff !important;
      width: 26px !important;
      height: 26px !important;
      border-radius: 50% !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-weight: 700 !important;
      font-size: ${Math.round(basePx * 0.85)}px !important;
      flex-shrink: 0 !important;
      margin-right: 10px !important;
    }
    .card-title {
      font-weight: 700 !important;
      font-size: ${Math.round(basePx * 1.15)}px !important;
      margin: 10px 0 12px 0 !important;
      color: ${textPrimary} !important;
      line-height: 1.4 !important;
    }
    .card-body {
      font-size: ${basePx}px !important;
      line-height: 1.65 !important;
      color: ${textSecondary} !important;
    }
    .transcript-row {
      width: 100% !important;
      box-sizing: border-box !important;
      display: flex !important;
      gap: 14px !important;
      margin-bottom: 12px !important;
      align-items: flex-start !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .transcript-time {
      font-size: ${Math.round(basePx * 0.85)}px !important;
      color: ${textMuted} !important;
      width: 65px !important;
      padding-top: 6px !important;
      flex-shrink: 0 !important;
      font-family: monospace !important;
    }
    .bubble {
      border-radius: 12px !important;
      padding: 8px 16px !important;
      max-width: 82% !important;
      font-size: ${Math.round(basePx * 0.95)}px !important;
      line-height: 1.5 !important;
      display: inline-block !important;
    }
    .bubble-candidate {
      background-color: ${bubbleCandidateBg} !important;
      color: ${bubbleCandidateText} !important;
    }
    .bubble-interviewer {
      background-color: ${bubbleInterviewerBg} !important;
      color: ${bubbleInterviewerText} !important;
    }
    .footer {
      width: 100% !important;
      box-sizing: border-box !important;
      text-align: center !important;
      font-size: ${Math.round(basePx * 0.8)}px !important;
      color: ${textMuted} !important;
      margin-top: 36px !important;
      border-top: 1.5px solid ${isDarkPdf ? 'rgba(255,255,255,0.1)' : '#e5e7eb'} !important;
      padding-top: 14px !important;
      page-break-inside: avoid !important;
    }
  </style>
</head>
<body>
  <div id="pdf-report-container" style="--accent-border-color: ${accentBorderColor} !important; --theme-color: ${themeColor} !important; width: 794px !important; min-width: 794px !important; max-width: 794px !important; margin: 0 auto !important; padding: 24px 28px !important; box-sizing: border-box !important; background-color: ${docBg} !important;">
    <div class="report-header" style="width: 100% !important; box-sizing: border-box !important; background-color: ${themeColor} !important; background: ${themeColor} !important; background-image: linear-gradient(135deg, ${themeColor} 0%, ${darkerTheme} 100%) !important; border-radius: 14px !important; padding: 24px 28px !important; color: #ffffff !important; margin-bottom: 26px !important; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;">
      <div class="report-title-row" style="display: flex !important; align-items: center !important; justify-content: space-between !important; flex-wrap: wrap !important; gap: 12px !important; width: 100% !important; margin-bottom: 6px !important;">
        <div class="report-title" style="font-size: ${Math.round(basePx * 1.7)}px !important; font-weight: 700 !important; margin: 0 !important; color: #ffffff !important; letter-spacing: -0.01em !important; display: flex !important; align-items: center !important; gap: 12px !important; flex: 1 !important; min-width: 220px !important;">
          <img src="${activeLogo}" alt="Logo" class="report-logo" style="width: 36px !important; height: 36px !important; object-fit: contain !important; vertical-align: middle !important; flex-shrink: 0 !important; display: inline-block !important; border-radius: 6px !important;" />
          <span style="color: #ffffff !important; font-weight: 700 !important;">${escapeHtml(title)}</span>
        </div>
        <div class="report-company-tag" style="background-color: rgba(255, 255, 255, 0.28) !important; border: 1.5px solid rgba(255, 255, 255, 0.5) !important; padding: 6px 16px !important; border-radius: 9999px !important; font-size: ${Math.max(12, Math.round(basePx * 0.95))}px !important; font-weight: 700 !important; color: #ffffff !important; letter-spacing: 0.03em !important; white-space: nowrap !important; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15) !important; display: inline-flex !important; align-items: center !important; gap: 6px !important;">
          <span style="font-size: 11px; opacity: 0.9;">🏢</span>
          <span>${escapeHtml(activeCompany)}</span>
        </div>
      </div>
      ${subtitle ? `<div class="report-subtitle" style="width: 100% !important; font-size: ${Math.round(basePx * 0.95)}px !important; opacity: 0.92 !important; margin: 0 0 16px 0 !important; color: #ffffff !important; font-weight: 400 !important;">${escapeHtml(subtitle)}</div>` : ''}
      ${badgeElements ? `<div class="badge-container" style="width: 100% !important; display: flex !important; flex-wrap: wrap !important; gap: 10px !important;">\n      ${badgeElements}\n    </div>` : ''}
    </div>

    ${sectionsHtml}

    <div class="footer" style="width: 100% !important; box-sizing: border-box !important; text-align: center !important; font-size: ${Math.round(basePx * 0.8)}px !important; color: ${textMuted} !important; margin-top: 36px !important; border-top: 1.5px solid ${isDarkPdf ? 'rgba(255,255,255,0.1)' : '#e5e7eb'} !important; padding-top: 14px !important;">
      ${escapeHtml(defaultFooter)}
    </div>
  </div>
</body>
</html>`;
}

async function getJsPdf() {
  if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) {
    return window.jspdf.jsPDF;
  }
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) {
      return resolve(window.jspdf.jsPDF);
    }
    const script = document.createElement('script');
    script.src = '/assets/jspdf.umd.min.js';
    script.onload = () => {
      if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
      else reject(new Error('jsPDF loaded but window.jspdf.jsPDF not found'));
    };
    script.onerror = () => {
      const cdnScript = document.createElement('script');
      cdnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      cdnScript.onload = () => {
        if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error('jsPDF loaded but window.jspdf.jsPDF not found'));
      };
      cdnScript.onerror = () => reject(new Error('Failed to load jsPDF library'));
      document.head.appendChild(cdnScript);
    };
    document.head.appendChild(script);
  });
}

/**
 * Universally triggers PDF download across both Electron and Web browsers.
 * - In Electron: uses native Chromium vector printToPDF via IPC for maximum crispness.
 * - In Web Browser: uses client-side high-DPI canvas capture with jsPDF,
 *   guaranteeing 100% full-width A4 scaling with zero squishing or blank margins.
 */
export async function downloadPdfReport({ htmlContent, filename = 'report.pdf', showToast, pdfTheme = 'light' }) {
  // 1. Electron IPC check
  const ipc = typeof window !== 'undefined' && window.require ? window.require('electron').ipcRenderer : null;

  if (ipc) {
    if (showToast) showToast('Preparing PDF export...');
    try {
      const res = await ipc.invoke('export-to-pdf', {
        html: htmlContent,
        htmlContent,
        filename,
        defaultFilename: filename
      });
      if (res && res.ok) {
        if (showToast) showToast('PDF Report saved successfully!');
        return true;
      } else if (res && res.error === 'Cancelled') {
        return false;
      }
      console.warn('[pdf] Electron export-to-pdf failed, falling back to web generation:', res?.error);
    } catch (err) {
      console.warn('[pdf] Electron export-to-pdf fallback to web generation:', err);
    }
  }

  // 2. Web Browser: High-DPI jsPDF + html2canvas generation
  if (showToast) showToast('Generating PDF...');

  let hostEl = null;
  try {
    // Extract CSS styles from htmlContent
    const styleMatches = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const extractedStyles = styleMatches.map(s => s.replace(/<\/?style[^>]*>/gi, '')).join('\n');

    // Extract body inner content
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : htmlContent;

    // Create an off-screen container with fixed 794px width (standard A4 at 96 DPI)
    hostEl = document.createElement('div');
    hostEl.id = 'pdf-render-host-' + Date.now();
    hostEl.style.position = 'fixed';
    hostEl.style.left = '0';
    hostEl.style.top = '0';
    hostEl.style.width = '794px';
    hostEl.style.minWidth = '794px';
    hostEl.style.maxWidth = '794px';
    hostEl.style.zIndex = '-99999';
    hostEl.style.opacity = '0.01'; // browser lays out & renders text/images
    hostEl.style.pointerEvents = 'none';
    const isDark = pdfTheme === 'dark' || (htmlContent && (htmlContent.includes('#0b1120') || htmlContent.includes('#0f172a')));
    const docBgColor = isDark ? '#0b1120' : '#ffffff';
    hostEl.style.backgroundColor = docBgColor;
    hostEl.style.overflow = 'visible';

    // Insert extracted styles and body
    hostEl.innerHTML = `
      <style>
        ${extractedStyles}
        #pdf-report-container {
          width: 794px !important;
          min-width: 794px !important;
          max-width: 794px !important;
          margin: 0 !important;
          box-sizing: border-box !important;
          background-color: ${docBgColor} !important;
        }
      </style>
      ${bodyContent}
    `;
    document.body.appendChild(hostEl);

    const renderTarget = hostEl.querySelector('#pdf-report-container') || hostEl;

    // Preload all images inside renderTarget
    const images = Array.from(renderTarget.querySelectorAll('img'));
    await Promise.all(
      images.map(img => {
        if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 800);
        });
      })
    );

    // Wait for fonts & layout stabilization
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (_) {}
    }
    await new Promise(r => setTimeout(r, 150));

    // High-resolution canvas capture
    const canvas = await html2canvas(renderTarget, {
      scale: 2, // 2x sharpness
      useCORS: true,
      allowTaint: true,
      backgroundColor: docBgColor,
      logging: false,
      width: 794,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0
    });

    // Generate A4 PDF with jsPDF (595.28 x 841.89 pt)
    const JsPdfConstructor = await getJsPdf();
    const pdf = new JsPdfConstructor({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true
    });

    const pageWidth = 595.28;
    const pageHeight = 841.89;

    // Canvas height equivalent to one A4 page
    const pageCanvasHeight = (pageHeight / pageWidth) * canvas.width;

    if (canvas.height <= pageCanvasHeight) {
      // Single page document
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const renderedHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, renderedHeight, undefined, 'FAST');
    } else {
      // Multi-page document with clean page slicing
      let currentY = 0;
      let pageNumber = 0;

      while (currentY < canvas.height) {
        if (pageNumber > 0) {
          pdf.addPage();
        }

        const remainingCanvasHeight = canvas.height - currentY;
        const sliceCanvasHeight = Math.min(pageCanvasHeight, remainingCanvasHeight);

        // Page slice canvas
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = pageCanvasHeight;
        const pageCtx = pageCanvas.getContext('2d');

        // White background
        pageCtx.fillStyle = docBgColor;
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvasHeight);

        // Draw portion from source canvas
        pageCtx.drawImage(
          canvas,
          0, currentY, canvas.width, sliceCanvasHeight,
          0, 0, canvas.width, sliceCanvasHeight
        );

        const pageImg = pageCanvas.toDataURL('image/jpeg', 0.98);
        pdf.addImage(pageImg, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');

        currentY += sliceCanvasHeight;
        pageNumber++;
      }
    }

    // Trigger direct file download
    pdf.save(filename || 'report.pdf');
    if (showToast) showToast('PDF downloaded successfully!');
    return true;
  } catch (err) {
    console.error('[pdf] Direct export failed, falling back to print dialog:', err);
    if (showToast) showToast('Opening print dialog fallback...');
    openPrintPopup(htmlContent);
    return false;
  } finally {
    if (hostEl && hostEl.parentNode) {
      hostEl.parentNode.removeChild(hostEl);
    }
  }
}

/**
 * Fallback print popup with native browser print dialog
 */
export function openPrintPopup(htmlContent) {
  try {
    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (_) {}
      }, 500);
    }
  } catch (err) {
    console.error('[pdf] openPrintPopup error:', err);
  }
}
