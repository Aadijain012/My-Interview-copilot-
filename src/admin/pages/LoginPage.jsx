/**
 * LoginPage.tsx — Admin Panel sign-in page.
 *
 * Features:
 *   - Email + password with show/hide toggle
 *   - Client-side validation before submitting
 *   - Loading state on submit
 *   - Error display: INVALID_CREDENTIALS, RATE_LIMITED, network, server
 *   - On success: navigates based on backend step
 *       step='done'          → /dashboard
 *       step='totp_setup'    → /totp/setup (tempToken in location state)
 *       step='totp_required' → /totp/verify (tempToken in location state)
 *   - Already authenticated → redirected to /dashboard by PublicOnlyRoute
 */

import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Field, Input } from "@/components";
import { useAuth } from "@/features/auth/useAuth";
import { ApiError } from "@/api/client";
import { reportClientError } from "../utils/errorReporter";
import "./LoginPage.css";

/* ── Icon helpers ── */

function IconEye({ show }) {
  return show ? (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/* ── Error message helper ── */

function getErrorMessage(err) {
  if (err instanceof ApiError) {
    if (err.code === "INVALID_CREDENTIALS") {
      return "Incorrect email or password. Please try again.";
    }
    if (err.code === "RATE_LIMITED" || err.status === 429) {
      return "Too many sign-in attempts. Please wait 15 minutes and try again.";
    }
    if (err.code === "VALIDATION_ERROR") {
      return "Email and password are required.";
    }
    if (err.status >= 500) {
      return "A server error occurred. Please try again in a moment.";
    }
    return err.message;
  }
  if (err instanceof TypeError) {
    return "Could not reach the server. Check your network connection.";
  }
  return "An unexpected error occurred. Please try again.";
}

/* ── Component ── */

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const emailRef = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [emailError, setEmailError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  function validate() {
    let valid = true;
    const trimEmail = email.trim();

    if (!trimEmail) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(trimEmail)) {
      setEmailError("Enter a valid email address.");
      valid = false;
    } else {
      setEmailError(null);
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else {
      setPasswordError(null);
    }

    return valid;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setIsLoading(true);
    try {
      const result = await login(email.trim(), password);

      if (result.step === "done") {
        const admin = result.admin;
        const isPureInfluencer =
          admin &&
          Array.isArray(admin.permissions) &&
          !admin.permissions.includes("dashboard:read") &&
          admin.permissions.includes("influencer_dashboard:view");

        if (isPureInfluencer) {
          navigate("/influencer/dashboard", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } else if (result.step === "password_change_required") {
        navigate("/password-change", {
          replace: true,
          state: { tempToken: result.tempToken },
        });
      } else if (result.step === "totp_setup") {
        navigate("/totp/setup", {
          replace: true,
          state: { tempToken: result.tempToken },
        });
      } else {
        navigate("/totp/verify", {
          replace: true,
          state: { tempToken: result.tempToken },
        });
      }
    } catch (err) {
      setError(getErrorMessage(err));
      try {
        reportClientError(err, { email: email.trim(), action: "admin_login" }, (err?.status >= 500 || err instanceof TypeError) ? "critical" : "warning");
      } catch (_) {}
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* Brand */}
      <div className="login-page__brand" aria-label="Kairos Admin">
        <div className="login-page__brand-icon" aria-hidden="true">
          KA
        </div>
        <span className="login-page__brand-name">Kairos Admin</span>
      </div>

      <div className="login-page__card" role="main">
        <header className="login-page__header">
          <h1 className="login-page__title">Sign in</h1>
          <p className="login-page__subtitle">
            Enter your admin credentials to continue
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
            label="Email address"
            htmlFor="login-email"
            error={emailError ?? undefined}
            required
          >
            <Input
              id="login-email"
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="email"
              autoFocus
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              hasError={Boolean(emailError)}
              disabled={isLoading}
              aria-describedby={emailError ? "login-email-error" : undefined}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="login-password"
            error={passwordError ?? undefined}
            required
          >
            <div className="login-page__password-wrap">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                }}
                hasError={Boolean(passwordError)}
                disabled={isLoading}
                aria-describedby={
                  passwordError ? "login-password-error" : undefined
                }
                rightIcon={
                  <button
                    type="button"
                    className="login-page__eye-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    tabIndex={0}
                  >
                    <IconEye show={showPassword} />
                  </button>
                }
              />
            </div>
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            isLoading={isLoading}
          >
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
