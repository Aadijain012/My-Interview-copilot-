import { useState } from "react";
import { Modal, Button } from "@/components";
import { formatDateTime } from "@/utils";
import { AuditActionBadge } from "./AuditActionBadge";
import { sanitizeAuditMetadata } from "../utils/auditSanitizer";
import "./AuditEventDetailsModal.css";

export function AuditEventDetailsModal({ event, isOpen, onClose }) {
  const [showRawJson, setShowRawJson] = useState(false);

  if (!event) return null;

  const cleanMetadata = sanitizeAuditMetadata(event.metadata);
  const metaEntries = Object.entries(cleanMetadata || {});

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Audit Event Details"
      subtitle={`ID: ${event.id}`}
      size="lg"
      footer={
        <div
          style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}
        >
          <Button variant="ghost" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="audit-detail-modal">
        {/* Core Event Overview */}
        <div className="audit-detail-modal__section">
          <h4 className="audit-detail-modal__section-title">Event Overview</h4>
          <div className="audit-detail-modal__grid">
            <div className="audit-detail-modal__item">
              <span className="audit-detail-modal__label">Action</span>
              <div>
                <AuditActionBadge action={event.action} />
              </div>
            </div>

            <div className="audit-detail-modal__item">
              <span className="audit-detail-modal__label">Timestamp</span>
              <span className="audit-detail-modal__value mono">
                {formatDateTime(event.createdAt)}
              </span>
            </div>

            <div className="audit-detail-modal__item">
              <span className="audit-detail-modal__label">Actor Admin ID</span>
              <span className="audit-detail-modal__value mono">
                {event.actorId || (
                  <em className="text-muted">System / Anonymous</em>
                )}
              </span>
            </div>

            <div className="audit-detail-modal__item">
              <span className="audit-detail-modal__label">
                Target Resource ID
              </span>
              <span className="audit-detail-modal__value mono">
                {event.targetId || <em className="text-muted">—</em>}
              </span>
            </div>

            {event.sessionId && (
              <div className="audit-detail-modal__item">
                <span className="audit-detail-modal__label">Session ID</span>
                <span className="audit-detail-modal__value mono">
                  {event.sessionId}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Structured Metadata Breakdown */}
        <div className="audit-detail-modal__section">
          <h4 className="audit-detail-modal__section-title">
            Payload Metadata
          </h4>
          {metaEntries.length === 0 ? (
            <p className="audit-detail-modal__empty-meta">
              No additional payload metadata recorded.
            </p>
          ) : (
            <div className="audit-detail-modal__grid">
              {metaEntries.map(([key, val]) => (
                <div key={key} className="audit-detail-modal__item">
                  <span className="audit-detail-modal__label">{key}</span>
                  <span className="audit-detail-modal__value mono">
                    {typeof val === "object" && val !== null
                      ? JSON.stringify(val)
                      : String(val)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Raw JSON Inspector */}
        <div className="audit-detail-modal__section">
          <div className="audit-detail-modal__raw-toggle">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setShowRawJson(!showRawJson)}
            >
              {showRawJson ? "Hide Raw JSON" : "Inspect Raw JSON"}
            </Button>
          </div>

          {showRawJson && (
            <pre className="audit-detail-modal__json-viewer">
              {JSON.stringify(
                {
                  id: event.id,
                  action: event.action,
                  actorId: event.actorId,
                  targetId: event.targetId,
                  sessionId: event.sessionId,
                  createdAt: event.createdAt,
                  metadata: cleanMetadata,
                },
                null,
                2,
              )}
            </pre>
          )}
        </div>
      </div>
    </Modal>
  );
}
