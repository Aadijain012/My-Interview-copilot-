import { Card, CardHeader, CardBody, Badge } from "@/components";
import "./SecuritySettingsSection.css";

export function SecuritySettingsSection({ serverConfig }) {
  return (
    <Card className="settings-section">
      <CardHeader
        title="Security & Authentication Posture"
        subtitle="Current multi-factor verification enforcement, session parameters, and credential policies."
      />

      <CardBody>
        <div className="security-settings-grid">
          {/* Two-Factor Authentication (TOTP) */}
          <div className="security-item">
            <div className="security-item__icon security-item__icon--success">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="security-item__content">
              <div className="security-item__header">
                <strong className="security-item__name">
                  Two-Factor Authentication (TOTP)
                </strong>
                <Badge variant="success">Enforced & Active</Badge>
              </div>
              <p className="security-item__desc">
                Time-based One-Time Password (TOTP) verification is required for
                all administrative sessions on Kairos Platform.
              </p>
            </div>
          </div>

          {/* Admin JWT Session Expiration */}
          <div className="security-item">
            <div className="security-item__icon security-item__icon--info">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="security-item__content">
              <div className="security-item__header">
                <strong className="security-item__name">
                  Admin Access Token Lifetime
                </strong>
                <Badge variant="info">
                  {serverConfig?.adminJwtExpiresIn || "30m"}
                </Badge>
              </div>
              <p className="security-item__desc">
                Short-lived admin bearer tokens minimize window of
                vulnerability. Automatic refresh token rotation manages
                background renewal.
              </p>
            </div>
          </div>

          {/* Password Policy */}
          <div className="security-item">
            <div className="security-item__icon security-item__icon--warning">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="security-item__content">
              <div className="security-item__header">
                <strong className="security-item__name">
                  Password Policy & Onboarding
                </strong>
                <Badge variant="default">Bcrypt Salted</Badge>
              </div>
              <p className="security-item__desc">
                New administrators are provisioned with temporary credentials
                and strictly required to complete initial password change prior
                to TOTP enrollment.
              </p>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
