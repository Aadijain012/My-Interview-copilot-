import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Skeleton,
  ErrorState,
  EmptyState,
} from "@/components";
import "./AiModelUsageSection.css";

const MODEL_PALETTE = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#8b5cf6",
];

function getProviderVariant(provider) {
  const p = provider.toLowerCase();
  if (p.includes("xai") || p.includes("grok")) return "accent";
  if (p.includes("openai")) return "success";
  if (p.includes("anthropic")) return "warning";
  return "info";
}

export function AiModelUsageSection({
  data,
  isLoading,
  isError,
  error,
  onRetry,
}) {
  if (isLoading) {
    return (
      <Card className="ai-model-card">
        <CardHeader
          title="AI Model Usage"
          subtitle="Loading model distribution…"
        />
        <CardBody>
          <div className="ai-model-skeleton">
            <Skeleton
              width="100%"
              height={16}
              className="ai-model-skeleton__bar"
            />
            <div className="ai-model-grid">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="ai-model-item ai-model-item--loading">
                  <Skeleton width={120} height={18} />
                  <Skeleton width={60} height={20} />
                  <Skeleton width={80} height={24} />
                </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="ai-model-card">
        <CardHeader title="AI Model Usage" />
        <CardBody>
          <ErrorState
            title="Failed to load AI model metrics"
            message={error?.message ?? "Unable to fetch model telemetry."}
            onRetry={onRetry}
          />
        </CardBody>
      </Card>
    );
  }

  const models = data ?? [];
  const totalRequests = models.reduce((acc, m) => acc + m.count, 0);

  return (
    <Card className="ai-model-card">
      <CardHeader
        title="AI Model Usage"
        subtitle={`Request distribution across ${models.length} model${models.length === 1 ? "" : "s"} (${totalRequests.toLocaleString()} total calls)`}
      />

      <CardBody>
        {models.length === 0 ? (
          <EmptyState
            title="No AI requests recorded"
            description="AI model usage statistics will appear here as users interact with the copilot."
          />
        ) : (
          <div className="ai-model-content">
            {/* Proportional Distribution Bar */}
            <div
              className="ai-model-bar"
              role="progressbar"
              aria-label="AI Model distribution"
              aria-valuenow={100}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              {models.map((m, idx) => {
                const color = MODEL_PALETTE[idx % MODEL_PALETTE.length];
                return (
                  <div
                    key={`${m.provider}-${m.model}`}
                    className="ai-model-bar__segment"
                    style={{
                      width: `${m.percentage}%`,
                      backgroundColor: color,
                    }}
                    title={`${m.model} (${m.provider}): ${m.count} (${m.percentage}%)`}
                  />
                );
              })}
            </div>

            {/* Model Details Grid */}
            <div className="ai-model-grid">
              {models.map((m, idx) => {
                const color = MODEL_PALETTE[idx % MODEL_PALETTE.length];
                return (
                  <div
                    key={`${m.provider}-${m.model}`}
                    className="ai-model-item"
                  >
                    <div className="ai-model-item__header">
                      <div className="ai-model-item__title-row">
                        <span
                          className="ai-model-item__color-dot"
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />

                        <span className="ai-model-item__name" title={m.model}>
                          {m.model}
                        </span>
                      </div>
                      <Badge variant={getProviderVariant(m.provider)}>
                        {m.provider}
                      </Badge>
                    </div>

                    <div className="ai-model-item__stats">
                      <span className="ai-model-item__count">
                        {m.count.toLocaleString()}{" "}
                        <span className="ai-model-item__unit">reqs</span>
                      </span>
                      <span className="ai-model-item__percentage">
                        {m.percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
