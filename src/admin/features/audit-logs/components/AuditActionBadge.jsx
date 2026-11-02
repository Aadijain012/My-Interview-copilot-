import { getActionCategory } from "../utils/auditSanitizer";
import "./AuditActionBadge.css";

export function AuditActionBadge({ action }) {
  const category = getActionCategory(action);
  return (
    <span className={`audit-action-badge audit-action-badge--${category}`}>
      {action}
    </span>
  );
}
