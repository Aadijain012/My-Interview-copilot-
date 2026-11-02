import { useState } from "react";
import { Modal, Button, Field, Input, Select } from "@/components";
import { useAuth } from "@/features/auth/useAuth";
import { getAllowedAssignableRoles } from "@/features/auth/rbac";

export function EditAdminUserModal({
  admin,
  isOpen,
  isLoading,
  onClose,
  onSubmit,
}) {
  const { admin: currentAdmin } = useAuth();
  const allowedRoles = getAllowedAssignableRoles(currentAdmin?.role);

  const [prevAdminId, setPrevAdminId] = useState(admin?.id);
  const [name, setName] = useState(admin?.name || "");
  const [email, setEmail] = useState(admin?.email || "");
  const [role, setRole] = useState(admin?.role || "viewer");
  const [error, setError] = useState(null);

  if (admin && admin.id !== prevAdminId) {
    setPrevAdminId(admin.id);
    setName(admin.name || "");
    setEmail(admin.email);
    setRole(admin.role);
    setError(null);
  }

  if (!admin) return null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    try {
      await onSubmit(admin.id, {
        name: name.trim() || undefined,
        email: email.trim().toLowerCase(),
        role,
      });
      onClose();
    } catch (err) {
      setError(err?.message ?? "Failed to update admin user.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Admin Account"
      subtitle={admin.email}
      size="md"
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            width: "100%",
          }}
        >
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="edit-admin-form"
            onClick={handleSubmit}
            isLoading={isLoading}
          >
            Save Changes
          </Button>
        </div>
      }
    >
      <form
        id="edit-admin-form"
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        {error && (
          <div
            style={{
              padding: "12px",
              backgroundColor: "var(--color-danger-subtle)",
              border: "1px solid var(--color-danger)",
              color: "var(--color-danger)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--font-size-sm)",
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        <Field label="Full Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
            disabled={isLoading}
          />
        </Field>

        <Field label="Email Address" required>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </Field>

        <Field
          label="Role"
          required
          hint="Changing role updates system permissions immediately"
        >
          <Select
            id="edit-admin-role"
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
      </form>
    </Modal>
  );
}
