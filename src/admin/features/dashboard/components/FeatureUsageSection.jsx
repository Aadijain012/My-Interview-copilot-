import { Card, CardHeader, CardBody, Skeleton, ErrorState } from "@/components";
import "./FeatureUsageSection.css";

function IconHelp() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconFileText() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function FeatureUsageSection({
  data,
  isLoading,
  isError,
  error,
  onRetry,
}) {
  if (isLoading) {
    return (
      <Card className="feature-usage-card">
        <CardHeader
          title="AI & Content Feature Usage"
          subtitle="Loading metrics…"
        />
        <CardBody>
          <div className="feature-usage-grid">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="feature-stat-item feature-stat-item--loading"
              >
                <Skeleton width={32} height={32} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="60%" height={12} />
                  <div style={{ marginTop: 4 }}>
                    <Skeleton width="40%" height={20} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="feature-usage-card">
        <CardHeader title="AI & Content Feature Usage" />
        <CardBody>
          <ErrorState
            title="Failed to load feature usage"
            message={error?.message ?? "Unable to fetch AI content metrics."}
            onRetry={onRetry}
          />
        </CardBody>
      </Card>
    );
  }

  const { questions, aiAnswers, transcriptSegments, notes, recordings } = data;

  const items = [
    {
      label: "AI Answers",
      value: aiAnswers,
      desc: "Copilot answers generated",
      icon: <IconSparkles />,
      color: "accent",
    },
    {
      label: "Questions Asked",
      value: questions,
      desc: "Interviewer questions tracked",
      icon: <IconHelp />,
      color: "info",
    },
    {
      label: "Transcripts",
      value: transcriptSegments,
      desc: "Real-time segments transcribed",
      icon: <IconMic />,
      color: "success",
    },
    {
      label: "Notes Taken",
      value: notes,
      desc: "AI notes & summaries",
      icon: <IconEdit />,
      color: "warning",
    },
    {
      label: "Recordings",
      value: recordings,
      desc: "Audio files archived",
      icon: <IconFileText />,
      color: "default",
    },
  ];

  return (
    <Card className="feature-usage-card">
      <CardHeader
        title="AI & Feature Usage"
        subtitle="Content generated across interview sessions"
      />

      <CardBody>
        <div className="feature-usage-grid">
          {items.map((it) => (
            <div key={it.label} className="feature-stat-item">
              <div
                className={`feature-stat-item__icon feature-stat-item__icon--${it.color}`}
              >
                {it.icon}
              </div>
              <div className="feature-stat-item__content">
                <span className="feature-stat-item__label">{it.label}</span>
                <span className="feature-stat-item__value">
                  {it.value.toLocaleString()}
                </span>
                <span className="feature-stat-item__desc">{it.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
