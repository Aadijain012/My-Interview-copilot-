import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../utils/api';
import './BillingSuccessPage.css';

export default function BillingSuccessPage({ onGoToDashboard, onGoToSubscription, showToast }) {
  const [loading, setLoading] = useState(true);
  const [fulfilled, setFulfilled] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isPendingTimeout, setIsPendingTimeout] = useState(false);
  const pollAttempts = useRef(0);
  const maxAttempts = 10; // 15 seconds max (10 * 1500ms)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (!sessionId) {
      setLoading(false);
      setErrorMessage('Missing session ID. Cannot verify payment without a valid Stripe reference.');
      return;
    }

    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('copilot_token') ||
      '';

    let isMounted = true;
    let timeoutId = null;

    async function checkStatus() {
      if (!isMounted) return;
      pollAttempts.current += 1;

      try {
        const res = await fetch(`${API_BASE}/api/billing/payment/session/${encodeURIComponent(sessionId)}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setLoading(false);
            setErrorMessage('Authorization required to verify this payment session. Please ensure you are logged in.');
            return;
          }
        }

        const data = await res.json();

        if (data.ok && data.fulfilled) {
          if (isMounted) {
            setFulfilled(true);
            setPaymentDetails(data);
            setLoading(false);
            // Refresh wallet balance across tabs and windows
            window.dispatchEvent(new CustomEvent('copilot-credits-updated'));
            if (showToast) showToast('Payment verified successfully!');
          }
          return;
        }

        // If not fulfilled yet, continue polling if within attempts
        if (pollAttempts.current < maxAttempts) {
          timeoutId = setTimeout(checkStatus, 1500);
        } else {
          // Timeout reached
          if (isMounted) {
            setLoading(false);
            setIsPendingTimeout(true);
          }
        }
      } catch (err) {
        if (pollAttempts.current < maxAttempts) {
          timeoutId = setTimeout(checkStatus, 1500);
        } else {
          if (isMounted) {
            setLoading(false);
            setErrorMessage('Unable to reach the verification server. Please check your internet connection.');
          }
        }
      }
    }

    checkStatus();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [showToast]);

  const handleReturn = () => {
    // Clean up query param from URL
    window.history.replaceState({}, document.title, window.location.pathname);
    if (onGoToDashboard) {
      onGoToDashboard();
    } else {
      window.location.href = '/?window=dashboard';
    }
  };

  const handleReturnPlans = () => {
    window.history.replaceState({}, document.title, window.location.pathname);
    if (onGoToSubscription) {
      onGoToSubscription();
    } else {
      window.location.href = '/?window=subscription';
    }
  };

  return (
    <div className="billing-status-container">
      <div className="billing-status-card">
        {loading && (
          <div className="billing-status-state">
            <div className="billing-spinner"></div>
            <h2>Confirming your payment...</h2>
            <p>Please wait while our secure gateway verifies your transaction with Stripe.</p>
            <span className="billing-subtext">Do not close or refresh this window.</span>
          </div>
        )}

        {!loading && fulfilled && (
          <div className="billing-status-state success">
            <div className="billing-status-icon success-icon">
              <i className="fa-solid fa-circle-check"></i>
            </div>
            <h2>Payment Successful!</h2>
            <p>Thank you! Your payment has been confirmed and fulfilled.</p>

            {paymentDetails && (
              <div className="billing-details-box">
                {paymentDetails.plan && (
                  <div className="billing-detail-row">
                    <span>Plan Activated:</span>
                    <strong>{paymentDetails.plan.name}</strong>
                  </div>
                )}
                {paymentDetails.creditsGranted > 0 && (
                  <div className="billing-detail-row">
                    <span>Credits Added:</span>
                    <strong>+{paymentDetails.creditsGranted} credits</strong>
                  </div>
                )}
                {paymentDetails.amount > 0 && (
                  <div className="billing-detail-row">
                    <span>Amount Paid:</span>
                    <strong>{paymentDetails.amount} {paymentDetails.currency}</strong>
                  </div>
                )}
                <div className="billing-detail-row">
                  <span>Status:</span>
                  <span className="status-badge paid">Completed</span>
                </div>
              </div>
            )}

            <div className="billing-action-buttons">
              <button className="billing-btn primary" onClick={handleReturn}>
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        {!loading && isPendingTimeout && (
          <div className="billing-status-state pending">
            <div className="billing-status-icon pending-icon">
              <i className="fa-solid fa-clock"></i>
            </div>
            <h2>Payment Processing</h2>
            <p>
              Your payment has been submitted and is being processed by Stripe.
              Entitlements will be credited automatically once the gateway confirms settlement.
            </p>
            <div className="billing-action-buttons">
              <button className="billing-btn secondary" onClick={handleReturnPlans}>
                View Plans
              </button>
              <button className="billing-btn primary" onClick={handleReturn}>
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="billing-status-state error">
            <div className="billing-status-icon error-icon">
              <i className="fa-solid fa-circle-exclamation"></i>
            </div>
            <h2>Verification Issue</h2>
            <p>{errorMessage}</p>
            <div className="billing-action-buttons">
              <button className="billing-btn secondary" onClick={handleReturnPlans}>
                Return to Plans
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
