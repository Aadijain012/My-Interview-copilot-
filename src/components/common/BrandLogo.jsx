import React from 'react';
import './BrandLogo.css';

/**
 * Unified Brand Logo for "My Interview Copilot"
 * Consistently displays the signature brain mark and styled typography
 * across all headers, sidebars, navigation bars, and pages.
 */
export default function BrandLogo({
  onClick,
  size = 'md', // 'sm', 'md', 'lg'
  showBadge = true,
  subtitle = null,
  className = '',
  separateWords = true // "My Interview" vs "MyInterview"
}) {
  const isClickable = typeof onClick === 'function';

  return (
    <div
      className={`brand-logo-container size-${size} ${isClickable ? 'clickable' : ''} ${className}`}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick(e) : undefined}
      title={isClickable ? 'My Interview Copilot' : undefined}
    >
      {/* Signature Brain Mark Squircle */}
      <div className="brand-logo-mark" aria-hidden="true">
        <i className="fa-solid fa-brain"></i>
      </div>

      {/* Typography: "My Interview Copilot" + [AI] */}
      <div className="brand-logo-text-group">
        <div className="brand-logo-title-row">
          <span className="brand-logo-main">
            {separateWords ? 'My Interview ' : 'MyInterview '}
            <span className="brand-logo-accent">Copilot</span>
          </span>
          {showBadge && <span className="brand-logo-badge">AI</span>}
        </div>
        {subtitle && <div className="brand-logo-sub">{subtitle}</div>}
      </div>
    </div>
  );
}

