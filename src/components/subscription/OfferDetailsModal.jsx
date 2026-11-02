import React, { useState } from 'react';
import { copyToClipboardSafely } from '../../utils/clipboard';
import './OfferDetailsModal.css';

export default function OfferDetailsModal({
  isOpen,
  onClose,
  offer,
  darkMode,
  onApplyCode,
  isApplied = false,
  showToast
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !offer) return null;

  const isDark = darkMode !== undefined
    ? darkMode
    : (typeof document !== 'undefined' && (document.body.classList.contains('dark-theme') || document.documentElement.classList.contains('dark-theme')));

  const promoCode = offer.redeemCode || offer.promoCode || '';
  const offerName = offer.name || 'Special Promotion';
  const discountPercent = Number(offer.discountPercent || 0);
  const bannerText = offer.bannerText || '';
  const eligiblePlanIds = Array.isArray(offer.eligiblePlanIds) ? offer.eligiblePlanIds : [];

  const handleCopy = (e) => {
    if (e) e.stopPropagation();
    if (!promoCode) return;
    copyToClipboardSafely(promoCode);
    setCopied(true);
    if (showToast) showToast(`Copied promo code: ${promoCode}`);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleApply = (e) => {
    if (e) e.stopPropagation();
    if (onApplyCode && promoCode) {
      onApplyCode(promoCode);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return null;
    }
  };

  const formattedStarts = formatDate(offer.startsAt);
  const formattedEnds = formatDate(offer.endsAt);

  return (
    <div
      className={`offer-modal-overlay ${isDark ? 'dark-theme' : 'light-theme'}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-modal-title"
    >
      <div
        className="offer-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="offer-modal-header">
          <div className="offer-modal-header-info">
            <div className="offer-modal-icon-badge">
              <i className="fa-solid fa-gift"></i>
            </div>
            <div>
              <h2 id="offer-modal-title" className="offer-modal-title">
                Special Offer: {offerName}
              </h2>
              <p className="offer-modal-subtitle">
                Redeem this limited-time offer to save on your subscription!
              </p>
            </div>
          </div>
          <button
            type="button"
            className="offer-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Promo Code Box */}
        <div className="offer-modal-promo-section">
          <div className="offer-modal-field-label">
            <i className="fa-solid fa-ticket"></i> Redeem / Promo Code
          </div>
          <div className="offer-modal-promo-box">
            <span className="offer-modal-promo-code">{promoCode}</span>
            <button
              type="button"
              className={`offer-modal-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
            >
              <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
        </div>

        {/* Details Grid */}
        <div className="offer-modal-details-grid">
          {/* Offer Name */}
          <div className="offer-modal-detail-item">
            <span className="offer-modal-detail-label">Offer Name</span>
            <span className="offer-modal-detail-value highlight">{offerName}</span>
          </div>

          {/* Discount Percentage */}
          <div className="offer-modal-detail-item">
            <span className="offer-modal-detail-label">Discount</span>
            <span className="offer-modal-detail-value discount-badge">
              <i className="fa-solid fa-tag"></i> {discountPercent}% OFF
            </span>
          </div>

          {/* Banner Text / Notice */}
          {bannerText && (
            <div className="offer-modal-detail-item full-width">
              <span className="offer-modal-detail-label">Scrolling Banner Notice</span>
              <span className="offer-modal-detail-value banner-text">
                <i className="fa-solid fa-bullhorn"></i> {bannerText}
              </span>
            </div>
          )}

          {/* Eligible Plans */}
          <div className="offer-modal-detail-item full-width">
            <span className="offer-modal-detail-label">Eligible Plans</span>
            <div className="offer-modal-plans-wrap">
              {eligiblePlanIds.length === 0 ? (
                <span className="offer-plan-badge all-plans">
                  <i className="fa-solid fa-circle-check"></i> All Paid Plans
                </span>
              ) : (
                eligiblePlanIds.map((planId) => (
                  <span key={planId} className="offer-plan-badge">
                    <i className="fa-solid fa-crown"></i> {planId === 'PRO' ? 'PRO — Pro Plan' : planId === 'PRO_PLUS' ? 'PRO_PLUS — Pro Plus Plan' : planId}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Schedule / Validity */}
          {(formattedStarts || formattedEnds) && (
            <div className="offer-modal-detail-item full-width schedule-row">
              {formattedStarts && (
                <div>
                  <span className="offer-modal-detail-label">Starts At</span>
                  <span className="offer-modal-detail-value schedule-time">{formattedStarts}</span>
                </div>
              )}
              {formattedEnds && (
                <div>
                  <span className="offer-modal-detail-label">Ends At</span>
                  <span className="offer-modal-detail-value schedule-time expire">{formattedEnds}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="offer-modal-footer">
          <button
            type="button"
            className="offer-modal-secondary-btn"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className={`offer-modal-primary-btn ${isApplied ? 'applied' : ''}`}
            onClick={handleApply}
            disabled={isApplied}
          >
            <i className={`fa-solid ${isApplied ? 'fa-check-double' : 'fa-wand-magic-sparkles'}`}></i>
            <span>{isApplied ? 'Offer Applied to Plans!' : 'Apply Offer to Plans'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
