import React from 'react';
import './BillingSuccessPage.css';

export default function BillingCancelPage({ onGoToSubscription, onGoToDashboard }) {
  const handleReturnPlans = () => {
    window.history.replaceState({}, document.title, window.location.pathname);
    if (onGoToSubscription) {
      onGoToSubscription();
    } else {
      window.location.href = '/?window=subscription';
    }
  };

  const handleReturnDashboard = () => {
    window.history.replaceState({}, document.title, window.location.pathname);
    if (onGoToDashboard) {
      onGoToDashboard();
    } else {
      window.location.href = '/?window=dashboard';
    }
  };

  return (
    <div className="billing-status-container">
      <div className="billing-status-card">
        <div className="billing-status-state cancel">
          <div className="billing-status-icon cancel-icon">
            <i className="fa-solid fa-ban"></i>
          </div>
          <h2>Checkout Cancelled</h2>
          <p>
            Your payment session was cancelled. No charges were made to your account.
            You can return to the plans page to choose another option or retry when you are ready.
          </p>
          <div className="billing-action-buttons">
            <button className="billing-btn secondary" onClick={handleReturnDashboard}>
              Back to Dashboard
            </button>
            <button className="billing-btn primary" onClick={handleReturnPlans}>
              View Subscription Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
