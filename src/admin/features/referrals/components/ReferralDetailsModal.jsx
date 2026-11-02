import { Modal, Badge, Button } from "@/components";
import { formatDateTime } from "@/utils";
import "./ReferralDetailsModal.css";

const STATUS_VARIANT = {
  pending: "warning",
  completed: "success",
  rejected: "danger",
};

export function ReferralDetailsModal({ referral, isOpen, onClose }) {
  if (!referral) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Referral Details" size="lg">
      <div className="referral-details">
        <div className="referral-details__row">
          <span className="referral-details__label">Status</span>
          <Badge variant={STATUS_VARIANT[referral.status]}>
            {referral.status}
          </Badge>
        </div>
        <div className="referral-details__row">
          <span className="referral-details__label">Referrer</span>
          <span>
            {referral.referrer.name || referral.referrer.email} (
            {referral.referrer.email})
          </span>
        </div>
        <div className="referral-details__row">
          <span className="referral-details__label">Referee</span>
          <span>
            {referral.referee.name || referral.referee.email} (
            {referral.referee.email})
          </span>
        </div>
        <div className="referral-details__row">
          <span className="referral-details__label">Code</span>
          <span className="referral-details__mono">{referral.code.code}</span>
        </div>
        <div className="referral-details__row">
          <span className="referral-details__label">Campaign</span>
          <span>{referral.campaign?.name || "—"}</span>
        </div>
        <div className="referral-details__row">
          <span className="referral-details__label">Reward</span>
          <span>
            {referral.rewardAmount != null
              ? referral.rewardAmount + " credits"
              : "—"}
          </span>
        </div>
        <div className="referral-details__row">
          <span className="referral-details__label">Created</span>
          <span>{formatDateTime(referral.createdAt)}</span>
        </div>
        {referral.completedAt && (
          <div className="referral-details__row">
            <span className="referral-details__label">Completed</span>
            <span>{formatDateTime(referral.completedAt)}</span>
          </div>
        )}
        {referral.rejectionReason && (
          <div className="referral-details__row">
            <span className="referral-details__label">Rejection Reason</span>
            <span className="referral-details__reason">
              {referral.rejectionReason}
            </span>
          </div>
        )}
        {referral.reviewedBy && (
          <div className="referral-details__row">
            <span className="referral-details__label">Reviewed By</span>
            <span className="referral-details__mono">
              {referral.reviewedBy}
            </span>
          </div>
        )}
      </div>
      <div className="referral-details__footer">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
