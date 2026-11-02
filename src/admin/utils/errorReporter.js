import { reportFrontendError } from "@/features/error-logs/api/errorLogsApi";

let isInitialized = false;
const seenErrors = new Set();

export async function reportClientError(error, metadata, severity = "error") {
  try {
    const message =
      error instanceof Error
        ? error.message
        : String(error || "Unknown frontend error");
    const stackTrace = error instanceof Error ? error.stack : undefined;

    // Simple deduplication key
    const dedupeKey = `${message}:${stackTrace?.slice(0, 100)}`;
    if (seenErrors.has(dedupeKey)) return;
    seenErrors.add(dedupeKey);
    if (seenErrors.size > 50) {
      const first = seenErrors.values().next().value;
      if (first) seenErrors.delete(first);
    }

    await reportFrontendError({
      message,
      stackTrace,
      endpoint: window.location.pathname,
      method: "CLIENT",
      severity,
      metadata: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...metadata,
      },
    });
  } catch {
    // Fail silently so reporting errors never breaks UI
  }
}

export function initGlobalErrorReporter() {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  window.addEventListener("error", (event) => {
    reportClientError(event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason || "Unhandled Promise Rejection", {
      type: "unhandledrejection",
    });
  });
}
