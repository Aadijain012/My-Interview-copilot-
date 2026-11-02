import { useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Field,
  Input,
  Button,
  Badge,
} from "@/components";
import { useAuth } from "@/features/auth/useAuth";
import { hasPermission } from "@/features/auth/rbac";
import "./RuntimeSettingsSection.css";

export function RuntimeSettingsSection({ runtimeSettings, isSaving, onSave }) {
  const { admin } = useAuth();
  const canWrite = hasPermission(admin?.role, "settings:write");

  const [prevRuntime, setPrevRuntime] = useState(runtimeSettings);
  const [maintenanceMode, setMaintenanceMode] = useState(
    runtimeSettings.maintenanceMode,
  );
  const [allowNewRegistrations, setAllowNewRegistrations] = useState(
    runtimeSettings.allowNewRegistrations,
  );
  const [maxSessionsPerUser, setMaxSessionsPerUser] = useState(
    String(runtimeSettings.maxSessionsPerUser),
  );

  if (prevRuntime !== runtimeSettings) {
    setPrevRuntime(runtimeSettings);
    setMaintenanceMode(runtimeSettings.maintenanceMode);
    setAllowNewRegistrations(runtimeSettings.allowNewRegistrations);
    setMaxSessionsPerUser(String(runtimeSettings.maxSessionsPerUser));
  }

  const hasChanges =
    maintenanceMode !== runtimeSettings.maintenanceMode ||
    allowNewRegistrations !== runtimeSettings.allowNewRegistrations ||
    parseInt(maxSessionsPerUser, 10) !== runtimeSettings.maxSessionsPerUser;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canWrite) return;

    const parsedSessions = parseInt(maxSessionsPerUser, 10);
    if (isNaN(parsedSessions) || parsedSessions < 1 || parsedSessions > 1000) {
      alert("Max sessions per user must be an integer between 1 and 1000.");
      return;
    }

    await onSave({
      maintenanceMode,
      allowNewRegistrations,
      maxSessionsPerUser: parsedSessions,
    });
  };

  return (
    <Card className="settings-section">
      <CardHeader
        title="Platform Runtime Configuration"
        subtitle="Dynamic live platform controls stored in-process. Modifications take effect immediately."
        actions={
          canWrite ? (
            <Badge variant="success">Owner Writable</Badge>
          ) : (
            <Badge variant="default">Read Only (Owner Only to Edit)</Badge>
          )
        }
      />

      <CardBody>
        {!canWrite && (
          <div className="runtime-settings-notice" role="note">
            <span className="runtime-settings-notice__icon">🔒</span>
            <span>
              Runtime platform configuration is restricted to Platform Owners (
              <code>settings:write</code>). You can view active settings below.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="runtime-settings-form">
          <div className="runtime-settings-form__toggles">
            {/* Maintenance Mode Toggle */}
            <div className="runtime-toggle-item">
              <div className="runtime-toggle-item__info">
                <strong className="runtime-toggle-item__title">
                  System Maintenance Mode
                </strong>
                <p className="runtime-toggle-item__desc">
                  When enabled, non-admin client traffic will encounter a
                  temporary maintenance advisory banner.
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  aria-label="System maintenance mode"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  disabled={!canWrite || isSaving}
                />

                <span className="toggle-slider" />
              </label>
            </div>

            {/* Allow New Registrations Toggle */}
            <div className="runtime-toggle-item">
              <div className="runtime-toggle-item__info">
                <strong className="runtime-toggle-item__title">
                  Accept New User Registrations
                </strong>
                <p className="runtime-toggle-item__desc">
                  Permits new candidates to create accounts. Disabling
                  registration halts new signups while preserving active user
                  access.
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  aria-label="Accept new user registrations"
                  checked={allowNewRegistrations}
                  onChange={(e) => setAllowNewRegistrations(e.target.checked)}
                  disabled={!canWrite || isSaving}
                />

                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          <div className="runtime-settings-form__fields">
            <Field
              label="Max Concurrent Sessions Per User"
              hint="Soft threshold (1 to 1000) enforced across active user logins."
              required
            >
              <Input
                type="number"
                min={1}
                max={1000}
                aria-label="Max concurrent sessions per user"
                value={maxSessionsPerUser}
                onChange={(e) => setMaxSessionsPerUser(e.target.value)}
                disabled={!canWrite || isSaving}
              />
            </Field>
          </div>

          {canWrite && (
            <div className="runtime-settings-form__footer">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!hasChanges || isSaving}
                isLoading={isSaving}
              >
                Apply Runtime Settings
              </Button>
            </div>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
