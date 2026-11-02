import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../utils/api';
import { copyToClipboardSafely } from '../../utils/clipboard';
import './SubscriptionPage.css';

export default function OfferBanner({ offer: externalOffer, onSelectOffer, onCopyCode }) {
  const [fetchedOffer, setFetchedOffer] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (externalOffer !== undefined) return undefined;

    let mounted = true;

    const fetchActiveOffer = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/offers/active`);
        if (!response.ok) return;

        const data = await response.json();
        if (mounted) {
          setFetchedOffer(data?.ok && data?.offer ? data.offer : null);
        }
      } catch (error) {
        if (mounted) setFetchedOffer(null);
      }
    };

    fetchActiveOffer();
    const refreshId = window.setInterval(fetchActiveOffer, 60000);

    return () => {
      mounted = false;
      window.clearInterval(refreshId);
    };
  }, [externalOffer]);

  const activeOffer = externalOffer !== undefined ? externalOffer : fetchedOffer;

  // Only show the scrolling banner when an active offer is present
  if (!activeOffer) return null;

  const redeemCode = activeOffer.redeemCode || activeOffer.promoCode;
  const rawTitle = activeOffer.bannerText || '';
  const offerName = activeOffer.name || '';
  const bannerTitle =
    rawTitle && offerName && !rawTitle.toLowerCase().includes(offerName.toLowerCase())
      ? `${offerName}: ${rawTitle}`
      : (rawTitle || offerName || 'Special Offer');

  const triggerRedirectAndModal = () => {
    try {
      sessionStorage.setItem('kairos_open_offer_modal', JSON.stringify({
        offer: activeOffer,
        timestamp: Date.now()
      }));
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('kairos-open-offer-modal', {
      detail: activeOffer
    }));

    if (onSelectOffer) {
      onSelectOffer(activeOffer);
    }
  };

  const handleCopyCode = (e) => {
    e.stopPropagation();
    if (!redeemCode) return;
    copyToClipboardSafely(redeemCode);
    setCopied(true);
    if (onCopyCode) onCopyCode(redeemCode);
    setTimeout(() => setCopied(false), 2000);

    triggerRedirectAndModal();
  };

  const handleBannerClick = () => {
    triggerRedirectAndModal();
  };

  return (
    <div
      className="offers-live-banner-marquee subscription-offer-banner"
      role="status"
      aria-live="polite"
      onClick={handleBannerClick}
      style={{ cursor: 'pointer' }}
      title="Click to view subscription plans and redeem this offer code"
    >
      <div className="offers-live-banner-track subscription-offer-banner-track">
        <span>{bannerTitle}</span>
        <span>
          Save {Number(activeOffer.discountPercent)}% with code{' '}
          <strong>{redeemCode}</strong>
          <button
            type="button"
            onClick={handleCopyCode}
            style={{
              marginLeft: '8px',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(253, 230, 138, 0.6)',
              background: 'rgba(255, 255, 255, 0.14)',
              color: '#fde68a',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </span>
        <span aria-hidden="true">{bannerTitle}</span>
        <span aria-hidden="true">
          Save {Number(activeOffer.discountPercent)}% with code{' '}
          <strong>{redeemCode}</strong>
        </span>
      </div>
    </div>
  );
}
