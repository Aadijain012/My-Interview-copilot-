import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Skeleton,
  ErrorState,
  EmptyState,
} from "@/components";
import "./AiApiCreditUsageSection.css";

function getStatusBadge(status) {
  switch (status) {
    case "exhausted":
      return { variant: "danger", label: "🔴 Exhausted" };
    case "almost_exhausted":
      return { variant: "danger", label: "🔴 Almost Exhausted" };
    case "critical":
      return { variant: "danger", label: "🔴 Critical" };
    case "warning":
      return { variant: "warning", label: "⚠️ Warning" };
    case "normal":
    default:
      return { variant: "success", label: "Normal" };
  }
}

function getProgressClass(status) {
  switch (status) {
    case "exhausted":
    case "almost_exhausted":
    case "critical":
      return "ai-credit-item__progress-fill--critical";
    case "warning":
      return "ai-credit-item__progress-fill--warning";
    case "normal":
    default:
      return "ai-credit-item__progress-fill--normal";
  }
}

function getRemainingClass(status) {
  switch (status) {
    case "exhausted":
    case "almost_exhausted":
    case "critical":
      return "ai-credit-item__remaining--danger";
    case "warning":
      return "ai-credit-item__remaining--warning";
    case "normal":
    default:
      return "ai-credit-item__remaining--normal";
  }
}

export function AiApiCreditUsageSection({
  data,
  isLoading,
  isError,
  error,
  onRetry,
}) {
  if (isLoading) {
    return (
      <Card className="ai-credit-card">
        <CardHeader
          title="AI API / Credit Usage"
          subtitle="Monitoring internal provider budget & credit consumption…"
        />

        <CardBody>
          <div className="ai-credit-skeleton-list">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="ai-credit-skeleton-item">
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Skeleton width={120} height={18} />
                  <Skeleton width={70} height={20} />
                </div>
                <Skeleton width="100%" height={8} />
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Skeleton width={140} height={14} />
                  <Skeleton width={90} height={14} />
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="ai-credit-card">
        <CardHeader title="AI API / Credit Usage" />
        <CardBody>
          <ErrorState
            title="Failed to load AI API usage"
            message={
              error?.message ??
              "Unable to fetch provider budget and credit consumption."
            }
            onRetry={onRetry}
          />
        </CardBody>
      </Card>
    );
  }

  const providers = data?.providers ?? [];

  return (
    <Card className="ai-credit-card">
      <CardHeader
        title="AI API / Credit Usage"
        subtitle="Internal AI provider budget & API credit consumption"
      />

      <CardBody>
        {providers.length === 0 ? (
          <EmptyState
            title="No AI Provider Configured"
            description="Provider budget and consumption metrics will appear here."
          />
        ) : (
          <div className="ai-credit-content">
            <div className="ai-credit-grid">
              {providers.map((p) => {
                const badgeInfo = getStatusBadge(p.status);
                const isAttention = p.status !== "normal";
                const progressWidth = Math.min(
                  100,
                  Math.max(0, p.usagePercentage),
                );

                return (
                  <div
                    key={p.providerId}
                    className={`ai-credit-item ai-credit-item--${p.status}`}
                    data-testid={`ai-credit-item-${p.providerId}`}
                  >
                    <div className="ai-credit-item__header">
                      <div className="ai-credit-item__provider">
                        <span className="ai-credit-item__name">
                          {p.provider}
                        </span>
                      </div>
                      <div className="ai-credit-item__badge-wrap">
                        <Badge variant={badgeInfo.variant} dot>
                          {badgeInfo.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div
                      className="ai-credit-item__progress-bar"
                      role="progressbar"
                      aria-valuenow={progressWidth}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${p.provider} credit usage: ${p.usagePercentage}%`}
                    >
                      <div
                        className={`ai-credit-item__progress-fill ${getProgressClass(p.status)}`}
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>

                    {/* Key Consumption Metrics */}
                    <div className="ai-credit-item__stats">
                      <div>
                        <span className="ai-credit-item__consumption">
                          {p.costUnavailable
                            ? `${p.requestCount.toLocaleString()} reqs`
                            : `${p.currencySymbol}${p.usage.toFixed(2)} / ${p.currencySymbol}${p.budget.toFixed(2)}`}
                        </span>
                        <span className="ai-credit-item__pct">
                          ({p.usagePercentage}% used)
                        </span>
                      </div>
                      <div
                        className={`ai-credit-item__remaining ${getRemainingClass(p.status)}`}
                      >
                        {p.costUnavailable
                          ? "Cost unavailable"
                          : `${p.currencySymbol}${p.remaining.toFixed(2)} remaining`}
                      </div>
                    </div>

                    {/* Secondary Metrics & Disclaimer */}
                    <div className="ai-credit-item__subtext">
                      <span>
                        {p.requestCount.toLocaleString()} API requests
                      </span>
                      <span>Estimated Remaining</span>
                    </div>

                    {/* Advisory Message if approaching/exceeding limit */}
                    {isAttention && (
                      <div
                        className={`ai-credit-item__advisory ${
                          p.status === "warning"
                            ? "ai-credit-item__advisory--warning"
                            : "ai-credit-item__advisory--danger"
                        }`}
                      >
                        {p.statusMessage}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="ai-credit-footer-note">
              <span>Tracked Usage • Estimated Remaining</span>
              <span>
                Total Budget: ${(data?.totalBudget ?? 0).toFixed(2)} | Used: $
                {(data?.totalUsage ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
