import { useState } from "react";
import { Modal, Button, StatusBadge, Skeleton, ErrorState } from "@/components";
import { formatDate, formatStorageSize } from "@/utils";
import { useUser } from "../hooks/useUsersQueries";
import { usePermission } from "@/features/auth/rbac";
import { useQueryClient } from "@tanstack/react-query";
import { compensateCredits } from "@/features/credits/api/creditsApi";
import "./UserDetailsModal.css";

export function UserDetailsModal({
  user,
  isOpen,
  onClose,
  onToggleSuspend,
  onDeleteUser,
}) {
  const canSuspend = usePermission("users:suspend");
  const canDelete = usePermission("users:delete");
  const canCompensate = true; // Always available in user details modal for admin
  const queryClient = useQueryClient();

  const [showGrantForm, setShowGrantForm] = useState(false);
  const [grantAmount, setGrantAmount] = useState("50");
  const [grantReason, setGrantReason] = useState("Administrative bonus");
  const [isGranting, setIsGranting] = useState(false);
  const [grantSuccessMsg, setGrantSuccessMsg] = useState("");
  const [grantErrorMsg, setGrantErrorMsg] = useState("");

  const { data, isLoading, isError, error, refetch } = useUser(
    user?.id ?? null,
    isOpen,
  );
  const detail = data?.user;

  const handleGrantCredits = async () => {
    const amt = parseInt(grantAmount, 10);
    if (!amt || amt <= 0) {
      setGrantErrorMsg("Please enter a valid credit amount (> 0).");
      return;
    }
    setIsGranting(true);
    setGrantErrorMsg("");
    setGrantSuccessMsg("");
    try {
      await compensateCredits({
        userId: user.id,
        amount: amt,
        reason: grantReason || "Admin manual grant",
      });
      setGrantSuccessMsg(`Successfully added ${amt} credits!`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      setTimeout(() => {
        setGrantSuccessMsg("");
        setShowGrantForm(false);
      }, 2500);
    } catch (err) {
      setGrantErrorMsg(err?.message || "Failed to grant credits.");
    } finally {
      setIsGranting(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Profile Details"
      subtitle={user.email}
      size="md"
      footer={
        <div className="user-details-modal__footer">
          <div className="user-details-modal__actions-left">
            {canSuspend && (
              <Button
                variant={user.status === "active" ? "secondary" : "primary"}
                size="sm"
                onClick={() => {
                  onClose();
                  onToggleSuspend(user);
                }}
              >
                {user.status === "active" ? "Suspend User" : "Reactivate User"}
              </Button>
            )}
            {canDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  onClose();
                  onDeleteUser(user);
                }}
              >
                Delete User
              </Button>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="user-details-modal__loading" aria-busy="true">
          <Skeleton width="100%" height="40px" />
          <Skeleton width="100%" height="40px" />
          <Skeleton width="100%" height="40px" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load details"
          message={error?.message ?? "Failed to load user details."}
          onRetry={refetch}
        />
      ) : (
        <>
          <div className="user-details-modal__grid">
            <div className="user-details-modal__item">
              <span className="user-details-modal__label">Email Address</span>
              <span className="user-details-modal__value mono">
                {detail?.email || user.email}
              </span>
            </div>

            <div className="user-details-modal__item">
              <span className="user-details-modal__label">Full Name</span>
              <span className="user-details-modal__value">
                {detail?.name || user.name || (
                  <em className="text-muted">Not specified</em>
                )}
              </span>
            </div>

            <div className="user-details-modal__item">
              <span className="user-details-modal__label">Account Status</span>
              <div className="user-details-modal__value">
                <StatusBadge status={detail?.status || user.status} />
              </div>
            </div>

            <div className="user-details-modal__item">
              <span className="user-details-modal__label">Account Created</span>
              <span className="user-details-modal__value">
                {formatDate(detail?.createdAt || user.createdAt, "en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>

            <div className="user-details-modal__item">
              <span className="user-details-modal__label">Last Login</span>
              <span className="user-details-modal__value">
                {detail?.lastLoginAt || user.lastLoginAt ? (
                  formatDate(detail?.lastLoginAt || user.lastLoginAt, "en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                ) : (
                  <em className="text-muted">Never</em>
                )}
              </span>
            </div>

            <div className="user-details-modal__item">
              <span className="user-details-modal__label">Login Region / Country</span>
              <span className="user-details-modal__value">
                {detail?.country && detail.country !== "Unknown" ? (
                  <span>
                    {detail.country === "India" ? "🇮🇳 " : detail.country === "United States" ? "🇺🇸 " : "🌐 "}
                    <strong>{detail.country}</strong>
                    {detail.region ? ` (${detail.region})` : ""}
                  </span>
                ) : user?.country && user.country !== "Unknown" ? (
                  <span>
                    <strong>{user.country}</strong>
                    {user.region ? ` (${user.region})` : ""}
                  </span>
                ) : (
                  <em className="text-muted">Not detected yet</em>
                )}
              </span>
            </div>

            <div className="user-details-modal__item">
              <span className="user-details-modal__label">Bound Machine / Device</span>
              <span className="user-details-modal__value">
                {(detail?.boundDevicesCount ?? user?.boundDevicesCount ?? 0) > 0 ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    <span style={{ color: "#10b981", fontSize: "0.85rem" }}>●</span>
                    <strong>{detail?.boundDevicesCount ?? user?.boundDevicesCount} device(s) bound</strong>
                    {detail?.devices?.[0]?.deviceType ? (
                      <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                        ({detail.devices[0].deviceType})
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <em className="text-muted">No machine bound</em>
                )}
              </span>
            </div>

            <div className="user-details-modal__item">
              <span className="user-details-modal__label">Credit Balance</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="user-details-modal__value">
                  <strong>
                    {(
                      detail?.creditBalance ??
                      user.creditBalance ??
                      0
                    ).toLocaleString()}
                  </strong>{" "}
                  credits
                </span>
                {canCompensate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    style={{ padding: "2px 8px", fontSize: "0.75rem", height: "auto" }}
                    onClick={() => setShowGrantForm((v) => !v)}
                    title="Grant credits to this user"
                  >
                    {showGrantForm ? "Cancel" : "+ Add Credits"}
                  </Button>
                )}
              </div>
            </div>

            <div className="user-details-modal__item">
              <span className="user-details-modal__label">AI Usage</span>
              <span className="user-details-modal__value">
                <strong>
                  {(detail?.aiUsage ?? user.aiUsage ?? 0).toLocaleString()}
                </strong>{" "}
                requests
              </span>
            </div>

            <div className="user-details-modal__item">
              <span className="user-details-modal__label">S3 Storage</span>
              <span className="user-details-modal__value">
                <strong>
                  {formatStorageSize(detail?.s3Storage ?? user.s3Storage ?? 0)}
                </strong>
              </span>
            </div>

            <div className="user-details-modal__item">
              <span className="user-details-modal__label">
                Interview Sessions
              </span>
              <span className="user-details-modal__value session-count">
                <strong>{detail?.sessionCount ?? user.sessionCount ?? 0}</strong>{" "}
                {(detail?.sessionCount ?? user.sessionCount ?? 0) === 1 ? "session" : "sessions"}
              </span>
            </div>
          </div>

          {showGrantForm && (
            <div className="user-details-modal__grant-box">
              <div className="user-details-modal__grant-title">
                Grant Free Credits to {user.name || user.email}
              </div>
              <div className="user-details-modal__grant-row">
                <input
                  type="number"
                  min="1"
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                  placeholder="Credits"
                  className="user-details-modal__grant-input-amount"
                />
                <input
                  type="text"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="Reason for granting credits"
                  className="user-details-modal__grant-input-reason"
                />
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isGranting}
                  onClick={handleGrantCredits}
                >
                  Send Credits
                </Button>
              </div>
              {grantSuccessMsg && (
                <div className="user-details-modal__grant-success">
                  ✓ {grantSuccessMsg}
                </div>
              )}
              {grantErrorMsg && (
                <div className="user-details-modal__grant-error">
                  ⚠ {grantErrorMsg}
                </div>
              )}
            </div>
          )}

          {Array.isArray(detail?.sessions) && detail.sessions.length > 0 && (
            <div className="user-details-modal__sessions-wrapper">
              <div className="user-details-modal__sessions-header">
                <span className="user-details-modal__label">
                  Interview Sessions History ({detail.sessions.length})
                </span>
              </div>
              <div className="user-details-modal__sessions-list">
                {detail.sessions.map((s) => (
                  <div key={s.id} className="user-details-modal__session-card">
                    <div className="user-details-modal__session-primary">
                      <span className="user-details-modal__session-title">{s.title || 'Live Session'}</span>
                      <span className="user-details-modal__session-badge">{s.tech}</span>
                    </div>
                    <div className="user-details-modal__session-meta">
                      <span><strong>{s.questionCount || 0}</strong> questions</span>
                      <span>•</span>
                      <span>{s.durationDisplay || '00:00:00'}</span>
                      <span>•</span>
                      <span>{formatDate(s.createdAt, "en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
