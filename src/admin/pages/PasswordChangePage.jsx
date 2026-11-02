/**
 * PasswordChangePage.tsx — Mandatory first-login password change page.
 *
 * Flow:
 *   - New admin's first login: backend returns step='password_change_required'
 *   - Admin enters new password → POST /auth/change-password → next step
 *   - Backend may return: totp_setup → /totp/setup, done → /dashboard
 *
 * Guards:
 *   - No tempToken in location state → redirect to /login
 *   - Expired tempToken (401) → redirect to /login
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button, Field, Input } from "@/components";
import { useAuth } from "@/features/auth/useAuth";
import { changePassword } from "@/features/auth/authApi";
import { ApiError } from "@/api/client";
import "./LoginPage.css";

/* ── Error helper ── */

function getErrorMessage(err) {
  if (err instanceof ApiError) {
    if (err.code === "VALIDATION_ERROR") {
      return {
        message: err.message || "Password must be at least 8 characters.",
        isExpired: false,
      };
    }
    if (err.status === 401) {
      return {
        message: "Your session has expired. Redirecting to sign-in…",
        isExpired: true,
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

export function PasswordChangePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setFullAuth } = useAuth();

  const tempToken = location.state?.tempToken ?? null;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState(null);
  const [confirmError, setConfirmError] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const passwordRef = useRef(null);

  // Guard: no temp token → redirect to login
  useEffect(() => {
    if (!tempToken) navigate("/login", { replace: true });
  }, [tempToken, navigate]);

  function validate() {
    let valid = true;
    if (!password || password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      valid = false;
    } else {
      setPasswordError(null);
    }
    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      valid = false;
    } else {
      setConfirmError(null);
    }
    return valid;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!validate() || !tempToken) return;

    setIsLoading(true);
    try {
      const result = await changePassword(tempToken, password);

      if (result.step === "done") {
        setFullAuth({
          step: "done",
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          admin: result.admin,
        });
        navigate("/dashboard", { replace: true });
      } else if (result.step === "totp_setup") {
        navigate("/totp/setup", {
          replace: true,
          state: { tempToken: result.tempToken },
        });
      } else if (result.step === "totp_required") {
        navigate("/totp/verify", {
          replace: true,
          state: { tempToken: result.tempToken },
        });
      }
    } catch (err) {
      const { message, isExpired } = getErrorMessage(err);
      setError(message);
      if (isExpired) {
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (!tempToken) return null;

  return (
    <div className="login-page">
      <div className="login-page__brand" aria-label="Kairos Admin">
        <div className="login-page__brand-icon" aria-hidden="true">
          KA
        </div>
        <span className="login-page__brand-name">Kairos Admin</span>
      </div>

      <div className="login-page__card" role="main">
        <header className="login-page__header">
          <h1 className="login-page__title">Change Password</h1>
          <p className="login-page__subtitle">
            You must set a new password before continuing.
          </p>
        </header>

        {error && (
          <div className="login-page__alert" role="alert" aria-live="assertive">
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

        <form className="login-page__form" onSubmit={handleSubmit} noValidate>
          <Field
            label="New password"
            htmlFor="new-password"
            error={passwordError ?? undefined}
            required
          >
            <Input
              id="new-password"
              ref={passwordRef}
              type="password"
              name="new-password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError(null);
              }}
              hasError={Boolean(passwordError)}
              disabled={isLoading}
            />
          </Field>

          <Field
            label="Confirm password"
            htmlFor="confirm-password"
            error={confirmError ?? undefined}
            required
          >
            <Input
              id="confirm-password"
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setConfirmError(null);
              }}
              hasError={Boolean(confirmError)}
              disabled={isLoading}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            isLoading={isLoading}
          >
            {isLoading ? "Updating…" : "Set New Password"}
          </Button>
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: "1rem",
            fontSize: "0.875rem",
          }}
        >
          <Link to="/login" style={{ color: "var(--color-primary)" }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
