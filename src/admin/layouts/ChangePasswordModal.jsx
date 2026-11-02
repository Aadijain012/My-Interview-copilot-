import { useState } from "react";
import { Modal, Button, Field, Input } from "@/components";
import { updateCurrentPassword } from "@/features/auth/authApi";
import { ApiError } from "@/api/client";

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

export function ChangePasswordModal({ isOpen, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [currentError, setCurrentError] = useState(null);
  const [newError, setNewError] = useState(null);
  const [confirmError, setConfirmError] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setCurrentError(null);
    setNewError(null);
    setConfirmError(null);
    setGeneralError(null);
    setSuccessMessage(null);
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  }

  function handleClose() {
    if (isLoading) return;
    resetForm();
    onClose();
  }

  function validate() {
    let valid = true;
    setCurrentError(null);
    setNewError(null);
    setConfirmError(null);
    setGeneralError(null);

    if (!currentPassword) {
      setCurrentError("Current password is required.");
      valid = false;
    }

    if (!newPassword) {
      setNewError("New password is required.");
      valid = false;
    } else if (newPassword.length < 8) {
      setNewError("Password must be at least 8 characters long.");
      valid = false;
    } else if (newPassword === currentPassword) {
      setNewError("New password must be different from current password.");
      valid = false;
    }

    if (!confirmPassword) {
      setConfirmError("Please confirm your new password.");
      valid = false;
    } else if (newPassword && newPassword !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      valid = false;
    }

    return valid;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setGeneralError(null);
    try {
      const res = await updateCurrentPassword(currentPassword, newPassword);
      setSuccessMessage(res.message || "Password changed successfully!");
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "INVALID_CREDENTIALS") {
          setCurrentError("Current password is incorrect.");
        } else {
          setGeneralError(err.message);
        }
      } else {
        setGeneralError("Failed to change password. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Change Password"
      size="sm"
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--sp-2)",
            width: "100%",
          }}
        >
          <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={Boolean(successMessage)}
          >
            Update Password
          </Button>
        </div>
      }
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}
      >
        {generalError && (
          <div
            style={{
              padding: "var(--sp-2) var(--sp-3)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-danger-subtle, rgba(239, 68, 68, 0.1))",
              color: "var(--color-danger)",
              fontSize: "var(--text-sm)",
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-2)",
            }}
            role="alert"
          >
            <span>{generalError}</span>
          </div>
        )}

        {successMessage && (
          <div
            style={{
              padding: "var(--sp-2) var(--sp-3)",
              borderRadius: "var(--radius-md)",
              background: "rgba(16, 185, 129, 0.1)",
              color: "#10b981",
              fontSize: "var(--text-sm)",
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-2)",
            }}
            role="status"
          >
            <span>{successMessage}</span>
          </div>
        )}

        <Field
          label="Current Password"
          htmlFor="current-password"
          required
          error={currentError ?? undefined}
        >
          <Input
            id="current-password"
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setCurrentError(null);
            }}
            placeholder="Enter current password"
            autoComplete="current-password"
            hasError={Boolean(currentError)}
            disabled={isLoading || Boolean(successMessage)}
            rightIcon={
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "inherit",
                  display: "flex",
                  padding: 0,
                }}
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? "Hide password" : "Show password"}
              >
                <IconEye show={showCurrent} />
              </button>
            }
          />
        </Field>

        <Field
          label="New Password"
          htmlFor="new-password"
          required
          error={newError ?? undefined}
          hint="Minimum 8 characters"
        >
          <Input
            id="new-password"
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setNewError(null);
            }}
            placeholder="Enter new password"
            autoComplete="new-password"
            hasError={Boolean(newError)}
            disabled={isLoading || Boolean(successMessage)}
            rightIcon={
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "inherit",
                  display: "flex",
                  padding: 0,
                }}
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                <IconEye show={showNew} />
              </button>
            }
          />
        </Field>

        <Field
          label="Confirm New Password"
          htmlFor="confirm-password"
          required
          error={confirmError ?? undefined}
        >
          <Input
            id="confirm-password"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setConfirmError(null);
            }}
            placeholder="Confirm new password"
            autoComplete="new-password"
            hasError={Boolean(confirmError)}
            disabled={isLoading || Boolean(successMessage)}
            rightIcon={
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "inherit",
                  display: "flex",
                  padding: 0,
                }}
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                <IconEye show={showConfirm} />
              </button>
            }
          />
        </Field>
      </form>
    </Modal>
  );
}
