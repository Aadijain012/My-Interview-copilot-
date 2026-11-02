import { useState, useCallback } from "react";
import { Modal, Button, Field, Input, Select } from "@/components";
import { useAuth } from "@/features/auth/useAuth";
import { getAllowedAssignableRoles } from "@/features/auth/rbac";
import "./CreateAdminUserModal.css";

function generateSecurePassword() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let pwd = "";
  for (let i = 0; i < 14; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

export function CreateAdminUserModal({ isOpen, isLoading, onClose, onSubmit }) {
  const { admin: currentAdmin } = useAuth();
  const allowedRoles = getAllowedAssignableRoles(currentAdmin?.role);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  // Transient state for one-time display of temporary password post-creation
  const [createdPasswordBanner, setCreatedPasswordBanner] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleGeneratePassword = () => {
    const gen = generateSecurePassword();
    setPassword(gen);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }
    if (!password) {
      setError("A temporary password is required.");
      return;
    }
    if (password.length < 8) {
      setError("Temporary password must be at least 8 characters.");
      return;
    }

    try {
      await onSubmit({
        name: name.trim() || undefined,
        email: email.trim().toLowerCase(),
        password,
        role,
      });

      // Show temporary password banner
      setCreatedPasswordBanner(password);
    } catch (err) {
      setError(err?.message ?? "Failed to create admin user.");
    }
  };

  const handleCopyPassword = () => {
    if (createdPasswordBanner) {
      navigator.clipboard.writeText(createdPasswordBanner);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = useCallback(() => {
    setName("");
    setEmail("");
    setRole("viewer");
    setPassword("");
    setError(null);
    setCreatedPasswordBanner(null);
    setCopied(false);
    onClose();
  }, [onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        createdPasswordBanner ? "Admin User Created" : "Create New Admin User"
      }
      subtitle={
        createdPasswordBanner
          ? "Secure temporary password generated."
          : "Provision a new admin account with mandatory first-login password change."
      }
      size="md"
      footer={
        createdPasswordBanner ? (
          <Button variant="primary" size="md" onClick={handleClose}>
            Done
          </Button>
        ) : (
          <div className="create-admin-modal__footer">
            <Button
              variant="ghost"
              size="md"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              form="create-admin-form"
              onClick={handleSubmit}
              isLoading={isLoading}
            >
              Create Account
            </Button>
          </div>
        )
      }
    >
      {createdPasswordBanner ? (
        <div className="create-admin-modal__banner">
          <div className="create-admin-modal__banner-header">
            <strong>Important Security Notice:</strong>
            <p>
              Please securely share this temporary password with the new admin.
              The admin will be required to change their password and enroll in
              TOTP upon their first sign in.
            </p>
          </div>

          <div className="create-admin-modal__pwd-box">
            <code className="create-admin-modal__pwd-value">
              {createdPasswordBanner}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyPassword}
              aria-label="Copy temporary password"
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <p className="create-admin-modal__banner-warning">
            This temporary password will not be shown again once you close this
            dialog.
          </p>
        </div>
      ) : (
        <form
          id="create-admin-form"
          onSubmit={handleSubmit}
          className="create-admin-modal__form"
        >
          {error && (
            <div className="create-admin-modal__error" role="alert">
              {error}
            </div>
          )}

          <Field label="Full Name" hint="Optional display name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              disabled={isLoading}
            />
          </Field>

          <Field label="Email Address" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@kairos.ai"
              required
              disabled={isLoading}
            />
          </Field>

          <Field
            label="Admin Role"
            required
            hint="Determines access level and system permissions"
          >
            <Select
              id="create-admin-role"
              aria-label="Admin Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isLoading}
            >
              {allowedRoles.map((r) => (
                <option key={r} value={r}>
                  {r.toUpperCase()}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Temporary Password"
            required
            hint="Must be at least 8 characters. The admin must change this on first login."
          >
            <div className="create-admin-modal__pwd-input-group">
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter or generate temporary password…"
                required
                disabled={isLoading}
              />

              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleGeneratePassword}
                disabled={isLoading}
              >
                Generate
              </Button>
            </div>
          </Field>
        </form>
      )}
    </Modal>
  );
}
