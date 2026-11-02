/**
 * Audit log security sanitizer:
 * Recursively redacts any sensitive keys (passwords, tokens, secrets, credentials, keys)
 * as an extra client-side safety barrier.
 */
const SENSITIVE_KEY_PATTERN =
  /(password|hash|secret|token|credential|jwt|authorization|key)/i;

export function sanitizeAuditMetadata(val) {
  if (val === null || val === undefined) return val;
  if (
    typeof val === "string" ||
    typeof val === "number" ||
    typeof val === "boolean"
  ) {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeAuditMetadata);
  }
  if (typeof val === "object") {
    const clean = {};
    for (const [k, v] of Object.entries(val)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        clean[k] = "[REDACTED]";
      } else {
        clean[k] = sanitizeAuditMetadata(v);
      }
    }
    return clean;
  }
  return "[UNSUPPORTED]";
}

export function getActionCategory(action) {
  const lower = action.toLowerCase();
  if (lower.includes("delete")) return "delete";
  if (lower.includes("suspend")) return "delete";
  if (
    lower.includes("create") ||
    lower.includes("signup") ||
    lower.includes("register")
  )
    return "create";
  if (
    lower.includes("update") ||
    lower.includes("patch") ||
    lower.includes("edit")
  )
    return "update";
  if (
    lower.includes("auth") ||
    lower.includes("login") ||
    lower.includes("totp") ||
    lower.includes("logout")
  )
    return "auth";
  if (lower.includes("settings") || lower.includes("config")) return "settings";
  return "general";
}
