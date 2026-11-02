/**
 * Format an ISO date string into a human-readable date.
 * Falls back gracefully for invalid input.
 */
export function formatDate(
  value,
  locale = "en-US",
  options = {
    year: "numeric",
    month: "short",
    day: "numeric",
  },
) {
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date(value));
  } catch {
    return "—";
  }
}

/**
 * Format an ISO date string with date + time.
 */
export function formatDateTime(value, locale = "en-US") {
  return formatDate(value, locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format seconds into a compact human-readable duration (e.g. "12m 45s", "1h 10m").
 */
export function formatDuration(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return "0s";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format relative time (e.g. "5m ago", "2h ago", "yesterday").
 */
export function formatRelativeTime(dateInput) {
  try {
    const date = new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date, "en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

/**
 * Format a number with thousand separators.
 */
export function formatNumber(value, locale = "en-US", options) {
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Format bytes into a compact human-readable storage size (e.g. "0 B", "14.2 MB", "1.2 GB").
 */
export function formatStorageSize(bytes = 0) {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i]}`;
}
