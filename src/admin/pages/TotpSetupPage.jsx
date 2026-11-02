/**
 * TotpSetupPage.tsx — First-time TOTP setup page.
 *
 * Flow:
 *   1. On mount: POST /auth/totp/setup (using tempToken from location state)
 *      → receives { secret, otpAuthUrl }
 *   2. Displays QR code (via qrserver.com — no JS dependency)
 *   3. Displays raw secret as fallback for manual entry
 *   4. User scans, enters their first 6-digit code
 *   5. POST /auth/totp/confirm → on success: setFullAuth → /dashboard
 *
 * Guards:
 *   - No tempToken in location state → redirect to /login
 *   - Expired tempToken (TOTP step JWT) → clear state → redirect with message
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button, Field, Input, Spinner } from "@/components";
import { useAuth } from "@/features/auth/useAuth";
import { setupTotp, confirmTotpSetup } from "@/features/auth/authApi";
import { ApiError } from "@/api/client";
import "./TotpSetupPage.css";

/* ── Error message helper ── */

function getConfirmError(err) {
  if (err instanceof ApiError) {
    if (err.code === "INVALID_TOTP") {
      return "Incorrect code. Make sure you entered the 6-digit code from your authenticator app.";
    }
    if (err.status === 401) {
      return "Your setup session has expired. Please sign in again to restart.";
    }
    if (err.status >= 500) {
      return "A server error occurred. Please try again.";
    }
    return err.message;
  }
  if (err instanceof TypeError) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return "An unexpected error occurred. Please try again.";
}

/* ── Component ── */

export function TotpSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setFullAuth } = useAuth();

  // tempToken comes from login → location state (never persisted to localStorage)
  const tempToken = location.state?.tempToken ?? null;

  const [totpData, setTotpData] = useState(null);
  const [setupError, setSetupError] = useState(null);
  const [isSetupLoading, setIsSetupLoading] = useState(true);

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(null);
  const [confirmError, setConfirmError] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const codeInputRef = useRef(null);
  const [showSecret, setShowSecret] = useState(false);

  // Guard: no tempToken → back to login
  useEffect(() => {
    if (!tempToken) {
      navigate("/login", { replace: true });
    }
  }, [tempToken, navigate]);

  // On mount: fetch the QR code data
  // isSetupLoading starts as true (see useState initializer above), no need to set it inside the effect.
  useEffect(() => {
    if (!tempToken) return;

    let cancelled = false;

    setupTotp(tempToken)
      .then((data) => {
        if (!cancelled) setTotpData(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setSetupError(
            "Your setup session has expired. Please sign in again.",
          );
        } else if (err instanceof TypeError) {
          setSetupError("Could not reach the server. Check your connection.");
        } else {
          setSetupError("Failed to load TOTP setup. Please sign in again.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsSetupLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tempToken]);

  async function handleConfirm(e) {
    e.preventDefault();
    setConfirmError(null);

    const trimCode = code.replace(/\s/g, "");
    if (!trimCode) {
      setCodeError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    if (!/^\d{6}$/.test(trimCode)) {
      setCodeError("The code must be exactly 6 digits.");
      return;
    }
    setCodeError(null);

    if (!tempToken) {
      navigate("/login", { replace: true });
      return;
    }

    setIsConfirming(true);
    try {
      const result = await confirmTotpSetup(tempToken, trimCode);
      setFullAuth(result);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setConfirmError(getConfirmError(err));
      // Expired tempToken → redirect to login
      if (err instanceof ApiError && err.status === 401) {
        setTimeout(
          () =>
            navigate("/login", {
              replace: true,
              state: { expiredSession: true },
            }),
          2500,
        );
      }
      setCode("");
      codeInputRef.current?.focus();
    } finally {
      setIsConfirming(false);
    }
  }

  const qrUrl = totpData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(totpData.otpAuthUrl)}`
    : null;

  return (
    <div className="totp-setup-page">
      <div className="totp-setup-page__brand" aria-label="Kairos Admin">
        <div className="totp-setup-page__brand-icon" aria-hidden="true">
          KA
        </div>
        <span className="totp-setup-page__brand-name">Kairos Admin</span>
      </div>

      <div className="totp-setup-page__card">
        <header className="totp-setup-page__header">
          <div className="totp-setup-page__step-badge" aria-hidden="true">
            One-time setup
          </div>
          <h1 className="totp-setup-page__title">
            Set up two-factor authentication
          </h1>
          <p className="totp-setup-page__subtitle">
            Your account requires two-factor authentication. Scan the QR code
            with Google Authenticator or a compatible app.
          </p>
        </header>

        {isSetupLoading && (
          <div className="totp-setup-page__loading" aria-label="Loading setup…">
            <Spinner size="md" />
            <span>Loading setup…</span>
          </div>
        )}

        {setupError && !isSetupLoading && (
          <div
            className="totp-setup-page__alert totp-setup-page__alert--danger"
            role="alert"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{setupError}</span>
          </div>
        )}

        {totpData && !isSetupLoading && (
          <div className="totp-setup-page__content">
            {/* Step 1: QR Code */}
            <section
              className="totp-setup-page__section"
              aria-labelledby="step1-heading"
            >
              <div className="totp-setup-page__step-label">
                <span className="totp-setup-page__step-num" aria-hidden="true">
                  1
                </span>
                <h2 id="step1-heading" className="totp-setup-page__step-title">
                  Scan the QR code
                </h2>
              </div>
              <p className="totp-setup-page__step-hint">
                Open <strong>Google Authenticator</strong> (or Authy, 1Password,
                etc.) → tap
                <strong> +</strong> → <strong>Scan a QR code</strong>.
              </p>
              <div
                className="totp-setup-page__qr-wrap"
                aria-label="TOTP QR code for authenticator app"
              >
                <img
                  src={qrUrl}
                  alt="Scan this QR code with your authenticator app"
                  className="totp-setup-page__qr"
                  width="180"
                  height="180"
                />
              </div>

              {/* Manual entry fallback */}
              <div className="totp-setup-page__secret-wrap">
                <button
                  type="button"
                  className="totp-setup-page__secret-toggle"
                  onClick={() => setShowSecret((v) => !v)}
                  aria-expanded={showSecret}
                >
                  {showSecret ? "Hide" : "Can't scan?"} Enter setup key manually
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className={showSecret ? "rotate-180" : ""}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showSecret && (
                  <div
                    className="totp-setup-page__secret"
                    aria-label="Manual setup key"
                  >
                    <p className="totp-setup-page__secret-label">
                      Setup key (type this into your app):
                    </p>
                    <code className="totp-setup-page__secret-code">
                      {totpData.secret}
                    </code>
                    <p className="totp-setup-page__secret-hint">
                      In your authenticator app: tap + → Enter a setup key →
                      choose <em>Time based</em> → paste the key above.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Step 2: Confirm code */}
            <section
              className="totp-setup-page__section"
              aria-labelledby="step2-heading"
            >
              <div className="totp-setup-page__step-label">
                <span className="totp-setup-page__step-num" aria-hidden="true">
                  2
                </span>
                <h2 id="step2-heading" className="totp-setup-page__step-title">
                  Enter the 6-digit code
                </h2>
              </div>
              <p className="totp-setup-page__step-hint">
                After scanning, enter the code shown in your authenticator app
                to verify the setup.
              </p>

              {confirmError && (
                <div
                  className="totp-setup-page__alert totp-setup-page__alert--danger"
                  role="alert"
                  aria-live="assertive"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{confirmError}</span>
                </div>
              )}

              <form
                onSubmit={handleConfirm}
                className="totp-setup-page__form"
                noValidate
              >
                <Field
                  label="Authentication code"
                  htmlFor="totp-code"
                  error={codeError ?? undefined}
                  required
                >
                  <Input
                    id="totp-code"
                    ref={codeInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, ""));
                      setCodeError(null);
                    }}
                    hasError={Boolean(codeError)}
                    disabled={isConfirming}
                    className="totp-setup-page__code-input"
                  />
                </Field>

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={isConfirming}
                >
                  {isConfirming ? "Verifying…" : "Verify and enable 2FA"}
                </Button>
              </form>
            </section>
          </div>
        )}

        <div className="totp-setup-page__footer">
          <Link to="/login" className="totp-setup-page__back-link" replace>
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
