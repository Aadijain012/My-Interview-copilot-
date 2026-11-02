import { useAIAnalytics } from "@/features/analytics";
import { Button, Skeleton, ErrorState } from "@/components";
import "./AIAnalyticsPage.css";

export function AIAnalyticsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useAIAnalytics();

  return (
    <div className="analytics-page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
            AI / Interview Analytics
          </h1>
          <p
            style={{
              margin: "0.25rem 0 0",
              color: "#64748b",
              fontSize: "0.875rem",
            }}
          >
            Inspect AI model usage, provider distribution, failure counts, and
            top user consumption.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Refreshing..." : "Refresh Metrics"}
        </Button>
      </div>

      {isLoading ? (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <div className="analytics-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={100} />
            ))}
          </div>
          <Skeleton height={200} />
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load AI analytics"
          message={
            error?.message || "Unable to retrieve AI analytics telemetry."
          }
          onRetry={() => refetch()}
        />
      ) : (
        <>
          {/* Metrics Cards */}
          <div className="analytics-grid">
            <div className="analytics-card">
              <span className="analytics-card__label">
                Total AI Prompts / Questions
              </span>
              <span className="analytics-card__value">
                {data?.metrics.totalRequests ?? 0}
              </span>
            </div>
            <div className="analytics-card">
              <span className="analytics-card__label">
                AI Answers Generated
              </span>
              <span className="analytics-card__value">
                {data?.metrics.totalResponses ?? 0}
              </span>
            </div>
            <div className="analytics-card">
              <span className="analytics-card__label">
                Generation Success Rate
              </span>
              <span
                className="analytics-card__value"
                style={{ color: "#16a34a" }}
              >
                {data?.metrics.successRate ?? 100}%
              </span>
            </div>
            <div className="analytics-card">
              <span className="analytics-card__label">AI Error Log Count</span>
              <span
                className="analytics-card__value"
                style={{
                  color:
                    (data?.metrics.aiErrorCount ?? 0) > 0
                      ? "#ef4444"
                      : "#0f172a",
                }}
              >
                {data?.metrics.aiErrorCount ?? 0}
              </span>
            </div>
          </div>

          {/* Model Breakdown */}
          <div className="analytics-section">
            <h2
              style={{
                fontSize: "1.125rem",
                margin: "0 0 1rem",
                fontWeight: 600,
              }}
            >
              AI Model & Provider Distribution
            </h2>
            {!data?.providers || data.providers.length === 0 ? (
              <p style={{ color: "#64748b", margin: 0 }}>
                No AI usage recorded yet.
              </p>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "0.875rem",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      color: "#64748b",
                    }}
                  >
                    <th style={{ padding: "0.5rem 0" }}>Provider</th>
                    <th style={{ padding: "0.5rem 0" }}>Model Name</th>
                    <th style={{ padding: "0.5rem 0", textAlign: "right" }}>
                      Generated Answers
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.providers.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td
                        style={{
                          padding: "0.75rem 0",
                          fontWeight: 600,
                          textTransform: "capitalize",
                        }}
                      >
                        {p.provider}
                      </td>
                      <td style={{ padding: "0.75rem 0" }}>{p.model}</td>
                      <td
                        style={{
                          padding: "0.75rem 0",
                          textAlign: "right",
                          fontWeight: 600,
                        }}
                      >
                        {p.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Top Users */}
          <div className="analytics-section">
            <h2
              style={{
                fontSize: "1.125rem",
                margin: "0 0 1rem",
                fontWeight: 600,
              }}
            >
              Top Users by AI Token / Request Volume
            </h2>
            {!data?.topUsers || data.topUsers.length === 0 ? (
              <p style={{ color: "#64748b", margin: 0 }}>
                No user consumption data found.
              </p>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "0.875rem",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      color: "#64748b",
                    }}
                  >
                    <th style={{ padding: "0.5rem 0" }}>User</th>
                    <th style={{ padding: "0.5rem 0" }}>Email</th>
                    <th style={{ padding: "0.5rem 0", textAlign: "right" }}>
                      AI Usage Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.topUsers.map((u) => (
                    <tr
                      key={u.id}
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                    >
                      <td style={{ padding: "0.75rem 0", fontWeight: 600 }}>
                        {u.name || "Unnamed"}
                      </td>
                      <td style={{ padding: "0.75rem 0", color: "#64748b" }}>
                        {u.email}
                      </td>
                      <td
                        style={{
                          padding: "0.75rem 0",
                          textAlign: "right",
                          fontWeight: 700,
                        }}
                      >
                        {u.aiUsage}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
