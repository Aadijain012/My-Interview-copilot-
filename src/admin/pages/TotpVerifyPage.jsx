/**
 * TotpVerifyPage.tsx — TOTP verification page (for enrolled users).
 *
 * Flow:
 *   - User has already enrolled TOTP; backend returned step='totp_required'
 *   - Enters 6-digit code → POST /auth/totp/verify → setFullAuth → /dashboard
 *
 * Guards:
 *   - No tempToken in location state → redirect to /login
 *   - Expired tempToken (401) → redirect to /login with expired message
 *   - Invalid code → show error, clear input, refocus
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button, Field, Input } from "@/components";
import { useAuth } from "@/features/auth/useAuth";
import { verifyTotpLogin } from "@/features/auth/authApi";
import { ApiError } from "@/api/client";
import "./TotpVerifyPage.css";

/* ── Error helper ── */

function getVerifyError(err) {
  if (err instanceof ApiError) {
    if (err.code === "INVALID_TOTP") {
      return {
        message:
          "Incorrect code. Please check your authenticator app and try again.",
        isExpired: false,
      };
    }
    if (err.status === 401) {
      return {
        message:
          "Your sign-in session has expired. You will be redirected to the sign-in page.",
        isExpired: true,
      };
    }
    if (err.status === 429) {
      return {
        message: "Too many attempts. Please wait before trying again.",
        isExpired: false,
      };
    }
    if (err.status >= 500) {
      return {
        message: "A server error occurred. Please try again in a moment.",
        isExpired: false,
      };
    }
    return { message: err.message, isExpired: false };
  }
  if (err instanceof TypeError) {
    return {
      message: "Could not reach the server. Check your network connection.",
      isExpired: false,
    };
  }
  return {
    message: "An unexpected error occurred. Please try again.",
    isExpired: false,
  };
}

/* ── Component ── */

export function TotpVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setFullAuth } = useAuth();

  const tempToken = location.state?.tempToken ?? null;

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const codeInputRef = useRef(null);

  // Guard: no tempToken → back to login
  useEffect(() => {
    if (!tempToken) {
      navigate("/login", { replace: true });
    }
  }, [tempToken, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

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

    setIsLoading(true);
    try {
      // tempToken is guaranteed non-null here: the useEffect above redirects to /login when null
      const result = await verifyTotpLogin(tempToken, trimCode);
      setFullAuth(result);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const { message, isExpired } = getVerifyError(err);
      setError(message);
      setCode("");
      codeInputRef.current?.focus();
      if (isExpired) {
        setTimeout(
          () =>
            navigate("/login", {
              replace: true,
              state: { expiredSession: true },
            }),
          2500,
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="totp-verify-page">
      <div className="totp-verify-page__brand" aria-label="Kairos Admin">
        <div className="totp-verify-page__brand-icon" aria-hidden="true">
          KA
        </div>
        <span className="totp-verify-page__brand-name">Kairos Admin</span>
      </div>

      <div className="totp-verify-page__card" role="main">
        <header className="totp-verify-page__header">
          <div className="totp-verify-page__shield" aria-hidden="true">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="totp-verify-page__title">Two-factor verification</h1>
          <p className="totp-verify-page__subtitle">
            Open your authenticator app and enter the 6-digit code for your
            Kairos Admin account.
          </p>
        </header>

        {error && (
          <div
            className="totp-verify-page__alert"
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
            <span>{error}</span>
          </div>
        )}

        <form
          className="totp-verify-page__form"
          onSubmit={handleSubmit}
          noValidate
        >
          <Field
            label="Authenticator code"
            htmlFor="verify-code"
            error={codeError ?? undefined}
            required
          >
            <Input
              id="verify-code"
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setCodeError(null);
              }}
              hasError={Boolean(codeError)}
              disabled={isLoading}
              className="totp-verify-page__code-input"
            />
          </Field>

          <p className="totp-verify-page__hint">
            Codes refresh every 30 seconds. If your code is not working, wait
            for the next code and try again.
          </p>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isLoading}
          >
            {isLoading ? "Verifying…" : "Verify"}
          </Button>
        </form>

        <div className="totp-verify-page__footer">
          <Link to="/login" className="totp-verify-page__back-link" replace>
            ← Return to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
