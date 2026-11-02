/**
 * Computes ISO date strings for from/to given a preset.
 * Preset '7d'  -> last 7 full days
 * Preset '30d' -> last 30 full days
 * Preset '90d' -> last 90 full days
 */
export function getPresetDateRange(preset) {
  const now = new Date();
  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    from: past.toISOString(),
    to: now.toISOString(),
  };
}

/**
 * Returns a human label for the preset.
 */
export function getPresetLabel(preset) {
  switch (preset) {
    case "7d":
      return "Last 7 Days";
    case "90d":
      return "Last 90 Days";
    case "30d":
    default:
      return "Last 30 Days";
  }
}
