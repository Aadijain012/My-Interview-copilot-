import { Modal, Button, RoleBadge, StatusBadge } from "@/components";
import { formatDate } from "@/utils";
import { OnboardingBadge } from "./OnboardingBadge";
import "./AdminUserDetailsModal.css";

export function AdminUserDetailsModal({ admin, isOpen, onClose, onEdit }) {
  if (!admin) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Admin User Details"
      subtitle={admin.email}
      size="md"
      footer={
        <div className="admin-details-modal__footer">
          <div className="admin-details-modal__actions-left">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                onEdit(admin);
              }}
            >
              Edit Profile
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="admin-details-modal__grid">
        <div className="admin-details-modal__item">
          <span className="admin-details-modal__label">Admin ID</span>
          <span className="admin-details-modal__value mono">{admin.id}</span>
        </div>

        <div className="admin-details-modal__item">
          <span className="admin-details-modal__label">Email Address</span>
          <span className="admin-details-modal__value mono">{admin.email}</span>
        </div>

        <div className="admin-details-modal__item">
          <span className="admin-details-modal__label">Full Name</span>
          <span className="admin-details-modal__value">
            {admin.name || <em className="text-muted">Not specified</em>}
          </span>
        </div>

        <div className="admin-details-modal__item">
          <span className="admin-details-modal__label">Role</span>
          <div className="admin-details-modal__value">
            <RoleBadge role={admin.role} />
          </div>
        </div>

        <div className="admin-details-modal__item">
          <span className="admin-details-modal__label">Account Status</span>
          <div className="admin-details-modal__value">
            <StatusBadge status={admin.status} />
          </div>
        </div>

        <div className="admin-details-modal__item">
          <span className="admin-details-modal__label">
            Onboarding & Security
          </span>
          <div className="admin-details-modal__value">
            <OnboardingBadge
              mustChangePassword={admin.mustChangePassword}
              totpEnabled={admin.totpEnabled}
            />
          </div>
        </div>

        <div className="admin-details-modal__item">
          <span className="admin-details-modal__label">Created Date</span>
          <span className="admin-details-modal__value">
            {formatDate(admin.createdAt, "en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>

        <div className="admin-details-modal__item">
          <span className="admin-details-modal__label">Last Updated</span>
          <span className="admin-details-modal__value">
            {formatDate(admin.updatedAt, "en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>
      </div>
    </Modal>
  );
}
