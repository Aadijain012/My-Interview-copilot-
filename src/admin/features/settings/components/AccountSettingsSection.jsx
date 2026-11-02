import { useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Field,
  Input,
  Button,
  RoleBadge,
} from "@/components";
import { useAuth } from "@/features/auth/useAuth";
import { updateAdminUser } from "@/features/admin-users/api/adminUsersApi";
import "./AccountSettingsSection.css";

export function AccountSettingsSection({ onSuccess, onError }) {
  const { admin } = useAuth();

  const [name, setName] = useState(admin?.name || "");
  const [email, setEmail] = useState(admin?.email || "");
  const [isSaving, setIsSaving] = useState(false);

  if (!admin) return null;

  const hasChanges =
    name.trim() !== (admin.name || "") ||
    email.trim().toLowerCase() !== admin.email;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      onError("Email address cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      await updateAdminUser(admin.id, {
        name: name.trim() || undefined,
        email: email.trim().toLowerCase(),
      });
      onSuccess("Account profile updated successfully.");
    } catch (err) {
      onError(err?.message ?? "Failed to update account profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="settings-section">
      <CardHeader
        title="Administrator Account"
        subtitle="Manage your personal administrative display credentials and identification."
        actions={<RoleBadge role={admin.role} />}
      />

      <CardBody>
        <form onSubmit={handleSubmit} className="account-settings-form">
          <div className="account-settings-form__grid">
            <Field label="Admin ID" hint="System-assigned unique identifier">
              <Input
                value={admin.id}
                disabled
                readOnly
                className="input--readonly"
              />
            </Field>

            <Field
              label="Assigned Role"
              hint="Current access level and authority"
            >
              <Input
                value={admin.role.toUpperCase()}
                disabled
                readOnly
                className="input--readonly"
              />
            </Field>

            <Field
              htmlFor="account-name"
              label="Full Name"
              hint="Display name for activity logs and team identification"
            >
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                disabled={isSaving}
              />
            </Field>

            <Field
              htmlFor="account-email"
              label="Email Address"
              required
              hint="Used for sign-in and security notifications"
            >
              <Input
                id="account-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSaving}
              />
            </Field>
          </div>

          <div className="account-settings-form__footer">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!hasChanges || isSaving}
              isLoading={isSaving}
            >
              Save Account Changes
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
