import React, { useState, useMemo, useRef } from 'react';
import { generateStyledReportHtml, COPILOT_ROBOT_LOGO, downloadPdfReport } from '../utils/pdfReportTemplate';

const PRESET_COLORS = [
  { name: 'Royal Blue', hex: '#2563eb' },
  { name: 'Navy Blue', hex: '#1e3a8a' },
  { name: 'Sky Blue', hex: '#0284c7' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Mint Emerald', hex: '#10b981' },
  { name: 'Forest Green', hex: '#15803d' },
  { name: 'Lime / Olive', hex: '#65a30d' },
  { name: 'Amber Gold', hex: '#d97706' },
  { name: 'Sunset Orange', hex: '#ea580c' },
  { name: 'Coral / Crimson', hex: '#dc2626' },
  { name: 'Rose Red', hex: '#e11d48' },
  { name: 'Fuchsia Pink', hex: '#db2777' },
  { name: 'Royal Purple', hex: '#7c3aed' },
  { name: 'Deep Violet', hex: '#9333ea' },
  { name: 'Electric Indigo', hex: '#4f46e5' },
  { name: 'Midnight Black', hex: '#0f172a' },
  { name: 'Slate Gray', hex: '#475569' },
  { name: 'Bronze Brown', hex: '#78350f' },
];

export default function PdfCustomizerModal({
  isOpen,
  onClose,
  reportData,
  initialHtml = '',
  defaultFilename = 'report.pdf',
  onConfirmDownload,
  showToast,
  darkMode = false
}) {
  const isModalDark = Boolean(darkMode);

  const [companyName, setCompanyName] = useState('Bright Access');
  const [logoUrl, setLogoUrl] = useState(COPILOT_ROBOT_LOGO);
  const [isCustomLogo, setIsCustomLogo] = useState(false);
  const [themeColor, setThemeColor] = useState('#2563eb');
  const [accentBorderColor, setAccentBorderColor] = useState('#10b981');
  const [fontSize, setFontSize] = useState('14px');
  const [pdfTheme, setPdfTheme] = useState(isModalDark ? 'dark' : 'light');
  const [isExporting, setIsExporting] = useState(false);

  const fileInputRef = useRef(null);

  // Sync pdfTheme with modal dark mode on open
  React.useEffect(() => {
    if (isOpen) {
      setPdfTheme(isModalDark ? 'dark' : 'light');
    }
  }, [isOpen, isModalDark]);

  // Compute live preview HTML
  const currentHtml = useMemo(() => {
    if (reportData && (reportData.title || reportData.sections)) {
      return generateStyledReportHtml({
        title: reportData.title || 'Meeting Copilot Report',
        subtitle: reportData.subtitle || '',
        badges: reportData.badges || [],
        sections: reportData.sections || [],
        footerText: reportData.footerText || '',
        companyName,
        logoUrl,
        themeColor,
        accentBorderColor,
        fontSize,
        pdfTheme
      });
    }
    // Fallback if initialHtml was passed directly: customize its basic styles
    if (initialHtml) {
      let custom = initialHtml;
      custom = custom.replace(/#2563eb/gi, themeColor);
      custom = custom.replace(/#10b981/gi, accentBorderColor);
      custom = custom.replace(/border-left:\s*4px\s*solid\s*[^;"]+/gi, `border-left: 4px solid ${accentBorderColor}`);
      if (pdfTheme === 'dark') {
        custom = custom.replace(/background-color:\s*#ffffff/gi, 'background-color: #0b1120');
      }
      return custom;
    }
    return '';
  }, [reportData, initialHtml, companyName, logoUrl, themeColor, accentBorderColor, fontSize, pdfTheme]);

  if (!isOpen) return null;

  const handleLogoUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (showToast) showToast('Please select a valid image file (PNG, JPG, SVG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const dataUrl = loadEvt.target.result;
      setLogoUrl(dataUrl);
      setIsCustomLogo(true);
      if (showToast) showToast('Custom logo applied!');
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    setLogoUrl(COPILOT_ROBOT_LOGO);
    setIsCustomLogo(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (showToast) showToast('Reset to default logo');
  };

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      if (onConfirmDownload) {
        await onConfirmDownload({
          customizedHtml: currentHtml,
          filename: defaultFilename,
          pdfTheme
        });
      } else {
        await downloadPdfReport({
          htmlContent: currentHtml,
          filename: defaultFilename,
          showToast,
          pdfTheme
        });
      }
      onClose();
    } catch (err) {
      console.error('[PdfCustomizerModal] download error:', err);
      if (showToast) showToast('Failed to generate PDF: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Dynamic Modal Color Tokens
  const modalBg = isModalDark ? '#0f172a' : '#ffffff';
  const modalHeaderBg = isModalDark ? '#1e293b' : '#f8fafc';
  const modalBorder = isModalDark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0';
  const modalTextPrimary = isModalDark ? '#f8fafc' : '#0f172a';
  const modalTextSecondary = isModalDark ? '#cbd5e1' : '#334155';
  const modalTextMuted = isModalDark ? '#94a3b8' : '#64748b';
  const controlPanelBg = isModalDark ? '#0f172a' : '#ffffff';
  const inputBg = isModalDark ? '#1e293b' : '#f8fafc';
  const inputBorder = isModalDark ? 'rgba(255, 255, 255, 0.18)' : '#cbd5e1';
  const previewOuterBg = isModalDark ? '#0b1120' : '#e2e8f0';
  const previewInnerBg = isModalDark ? '#1e293b' : '#cbd5e1';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      backgroundColor: 'rgba(15, 23, 42, 0.82)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      boxSizing: 'border-box',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        width: '96vw',
        maxWidth: '1440px',
        height: '92vh',
        maxHeight: '960px',
        backgroundColor: modalBg,
        borderRadius: '16px',
        border: `1px solid ${modalBorder}`,
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.65)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: modalTextPrimary
      }}>
        {/* Modal Top Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          borderBottom: `1px solid ${modalBorder}`,
          backgroundColor: modalHeaderBg
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: themeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <i className="fa-solid fa-file-pdf" style={{ fontSize: '16px' }}></i>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: modalTextPrimary }}>
                Customize &amp; Export PDF Report
              </h2>
              <span style={{ fontSize: '12px', color: modalTextMuted }}>
                Live real-time preview &bull; Customized branding, theme &amp; typography
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: modalTextMuted,
              fontSize: '18px',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '6px',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = modalTextPrimary; e.currentTarget.style.backgroundColor = isModalDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = modalTextMuted; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Modal Body: Split 2 Columns */}
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* Left Column: Controls (360px) */}
          <div style={{
            width: '370px',
            minWidth: '370px',
            borderRight: `1px solid ${modalBorder}`,
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflowY: 'auto',
            backgroundColor: controlPanelBg
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Company Name */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: modalTextSecondary, marginBottom: '6px' }}>
                  <i className="fa-solid fa-building" style={{ marginRight: '6px', color: themeColor }}></i>
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Bright Access"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    backgroundColor: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: modalTextPrimary,
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = themeColor}
                  onBlur={(e) => e.target.style.borderColor = inputBorder}
                />
                <span style={{ fontSize: '11px', color: modalTextMuted, marginTop: '4px', display: 'block' }}>
                  Default is "Bright Access". You can replace it with any name.
                </span>
              </div>

              {/* Logo Upload */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: modalTextSecondary, marginBottom: '6px' }}>
                  <i className="fa-solid fa-image" style={{ marginRight: '6px', color: themeColor }}></i>
                  Header Logo
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp"
                  onChange={handleLogoUpload}
                  style={{ display: 'none' }}
                />
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: inputBg,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${inputBorder}`
                }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '6px',
                    backgroundColor: isModalDark ? '#334155' : '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: modalTextPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isCustomLogo ? 'Custom Logo' : 'Default Robot Logo'}
                    </div>
                    <div style={{ fontSize: '11px', color: modalTextMuted }}>PNG, JPG or SVG</div>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      style={{
                        padding: '6px 11px',
                        borderRadius: '6px',
                        backgroundColor: isModalDark ? '#334155' : '#e2e8f0',
                        border: `1px solid ${inputBorder}`,
                        color: modalTextPrimary,
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      Upload
                    </button>
                    {isCustomLogo && (
                      <button
                        type="button"
                        onClick={handleResetLogo}
                        title="Reset to default logo"
                        style={{
                          padding: '6px 9px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#ef4444',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        <i className="fa-solid fa-rotate-left"></i>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Theme & Header Color */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: modalTextSecondary }}>
                    <i className="fa-solid fa-palette" style={{ marginRight: '6px', color: themeColor }}></i>
                    Theme &amp; Header Color
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="color"
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      style={{
                        width: '24px',
                        height: '24px',
                        border: 'none',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        background: 'none',
                        padding: 0
                      }}
                      title="Custom color picker"
                    />
                    <span style={{ fontSize: '11px', color: modalTextMuted, fontFamily: 'monospace' }}>{themeColor}</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                  {PRESET_COLORS.map(c => (
                    <button
                      key={'theme-' + c.hex}
                      type="button"
                      onClick={() => setThemeColor(c.hex)}
                      title={c.name}
                      style={{
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: c.hex,
                        border: themeColor.toLowerCase() === c.hex.toLowerCase() ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.15)',
                        boxShadow: themeColor.toLowerCase() === c.hex.toLowerCase() ? '0 0 10px ' + c.hex : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        transition: 'transform 0.1s'
                      }}
                    >
                      {themeColor.toLowerCase() === c.hex.toLowerCase() && (
                        <i className="fa-solid fa-check" style={{ fontSize: '10px' }}></i>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Accent & Border Color */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: modalTextSecondary }}>
                      <i className="fa-solid fa-border-all" style={{ marginRight: '6px', color: accentBorderColor }}></i>
                      Card Accent &amp; Border Color
                    </label>
                    <button
                      type="button"
                      onClick={() => setAccentBorderColor(themeColor)}
                      title="Match border color to theme color"
                      style={{
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: isModalDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                        border: `1px solid ${inputBorder}`,
                        color: modalTextMuted,
                        fontSize: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      Match
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="color"
                      value={accentBorderColor}
                      onChange={(e) => setAccentBorderColor(e.target.value)}
                      style={{
                        width: '24px',
                        height: '24px',
                        border: 'none',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        background: 'none',
                        padding: 0
                      }}
                      title="Custom border color"
                    />
                    <span style={{ fontSize: '11px', color: modalTextMuted, fontFamily: 'monospace' }}>{accentBorderColor}</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                  {PRESET_COLORS.map(c => (
                    <button
                      key={'border-' + c.hex}
                      type="button"
                      onClick={() => setAccentBorderColor(c.hex)}
                      title={c.name}
                      style={{
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: c.hex,
                        border: accentBorderColor.toLowerCase() === c.hex.toLowerCase() ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.15)',
                        boxShadow: accentBorderColor.toLowerCase() === c.hex.toLowerCase() ? '0 0 10px ' + c.hex : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff'
                      }}
                    >
                      {accentBorderColor.toLowerCase() === c.hex.toLowerCase() && (
                        <i className="fa-solid fa-check" style={{ fontSize: '10px' }}></i>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: modalTextSecondary, marginBottom: '6px' }}>
                  <i className="fa-solid fa-font" style={{ marginRight: '6px', color: themeColor }}></i>
                  Typography Size
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { label: 'Small', val: '12px' },
                    { label: 'Normal', val: '14px' },
                    { label: 'Large', val: '16px' }
                  ].map(fs => (
                    <button
                      key={fs.val}
                      type="button"
                      onClick={() => setFontSize(fs.val)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        backgroundColor: fontSize === fs.val ? themeColor : inputBg,
                        border: fontSize === fs.val ? '1px solid #ffffff' : `1px solid ${inputBorder}`,
                        color: fontSize === fs.val ? '#ffffff' : modalTextPrimary,
                        fontSize: '13px',
                        fontWeight: fontSize === fs.val ? 600 : 400,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s'
                      }}
                    >
                      {fs.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Bottom Modal Actions */}
            <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: `1px solid ${modalBorder}`, display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isExporting}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${modalBorder}`,
                  color: modalTextMuted,
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: isExporting ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={isExporting}
                style={{
                  flex: 2,
                  padding: '11px 16px',
                  borderRadius: '8px',
                  backgroundColor: themeColor,
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px ' + themeColor + '66'
                }}
              >
                {isExporting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-download"></i>
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Live Interactive Preview */}
          <div style={{
            flex: 1,
            backgroundColor: previewOuterBg,
            padding: '18px 24px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Preview Status Header & Theme Switcher */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              padding: '0 4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 6px #10b981'
                }}></span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: modalTextPrimary }}>
                  Live Document Preview
                </span>
                <span style={{ fontSize: '11px', color: modalTextMuted }}>
                  (A4 Standard Layout &bull; Full Width)
                </span>
              </div>

              {/* PDF Background Light / Dark Mode Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: modalTextSecondary }}>
                  PDF Theme:
                </span>
                <div style={{
                  display: 'inline-flex',
                  backgroundColor: isModalDark ? '#1e293b' : '#ffffff',
                  borderRadius: '8px',
                  padding: '3px',
                  border: `1px solid ${modalBorder}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                }}>
                  <button
                    type="button"
                    onClick={() => setPdfTheme('light')}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: pdfTheme === 'light' ? themeColor : 'transparent',
                      color: pdfTheme === 'light' ? '#ffffff' : modalTextMuted,
                      fontSize: '12px',
                      fontWeight: pdfTheme === 'light' ? 600 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>☀️</span> Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfTheme('dark')}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: pdfTheme === 'dark' ? themeColor : 'transparent',
                      color: pdfTheme === 'dark' ? '#ffffff' : modalTextMuted,
                      fontSize: '12px',
                      fontWeight: pdfTheme === 'dark' ? 600 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>🌙</span> Dark
                  </button>
                </div>
              </div>
            </div>

            {/* Preview Sheet Container */}
            <div style={{
              flex: 1,
              backgroundColor: previewInnerBg,
              borderRadius: '12px',
              border: `1px solid ${modalBorder}`,
              overflow: 'hidden',
              boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px'
            }}>
              <iframe
                title="Live Document Preview"
                srcDoc={currentHtml}
                style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: '850px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: pdfTheme === 'dark' ? '#0b1120' : '#ffffff',
                  boxShadow: '0 12px 35px rgba(0, 0, 0, 0.35)'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
