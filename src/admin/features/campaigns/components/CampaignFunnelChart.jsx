import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Card, CardHeader, CardBody, Skeleton } from "@/components";
import { formatNumber } from "@/utils";

const STAGE_COLORS = [
  "#6366f1", // Indigo - Signups / Code Uses
  "#06b6d4", // Cyan - Completed Interviews
  "#f59e0b", // Amber - Pending Referrals
  "#10b981", // Emerald - Approved Referrals
  "#8b5cf6", // Violet - Credits Issued
];

export function CampaignFunnelChart({ data, isLoading }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Campaign Funnel" subtitle="Loading telemetry..." />
        <CardBody>
          <Skeleton height={280} />
        </CardBody>
      </Card>
    );
  }
  if (!data) return null;

  const stages =
    data.funnel.stages && data.funnel.stages.length > 0
      ? data.funnel.stages
      : [
          {
            stage: "Signups / Code Uses",
            count: data.funnel.signups,
            conversionRate: 100,
            dropOffRate: 0,
          },
          {
            stage: "Completed Interviews",
            count: data.funnel.completedSessions ?? 0,
            conversionRate: 0,
            dropOffRate: 0,
          },
          {
            stage: "Pending Referrals",
            count: data.funnel.pendingReferrals ?? 0,
            conversionRate: 0,
            dropOffRate: 0,
          },
          {
            stage: "Approved Referrals",
            count: data.funnel.completedReferrals,
            conversionRate: data.funnel.conversionRate,
            dropOffRate: 0,
          },
          {
            stage: "Credits Issued",
            count: data.funnel.creditsIssued,
            conversionRate: data.funnel.conversionRate,
            dropOffRate: 0,
          },
        ];

  const chartData = stages.map((s) => ({
    stage: s.stage,
    value: s.count,
    conversionRate: s.conversionRate,
    dropOffRate: s.dropOffRate,
  }));

  const codeLabel = data.campaignCode ? ` • Code: ${data.campaignCode}` : "";

  return (
    <Card>
      <CardHeader
        title="Campaign Referral Funnel"
        subtitle={`${data.campaignName}${codeLabel} — ${data.funnel.conversionRate}% overall conversion`}
      />

      <CardBody>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 20, bottom: 20, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="4 4"
              vertical={false}
              stroke="var(--color-border-subtle)"
            />
            <XAxis
              dataKey="stage"
              tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
              interval={0}
            />

            <YAxis
              tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                color: "var(--color-text-primary)",
              }}
              formatter={(value, _name, entry) => {
                const count = formatNumber(Number(value ?? 0));
                const conv =
                  entry.payload?.conversionRate != null
                    ? ` (${entry.payload.conversionRate}% conv)`
                    : "";
                return [`${count}${conv}`, "Volume"];
              }}
            />

            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Funnel Telemetry Breakdown Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "var(--sp-3)",
            marginTop: "var(--sp-5)",
            paddingTop: "var(--sp-4)",
            borderTop: "1px solid var(--color-border-subtle)",
          }}
        >
          {stages.map((st, idx) => (
            <div
              key={st.stage}
              style={{
                padding: "var(--sp-3)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: STAGE_COLORS[idx % STAGE_COLORS.length],
                  }}
                />

                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {st.stage}
                </span>
              </div>
              <div
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                }}
              >
                {formatNumber(st.count)}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  color: "var(--color-text-muted)",
                  marginTop: 4,
                }}
              >
                <span>Conv: {st.conversionRate}%</span>
                {st.dropOffRate > 0 && (
                  <span style={{ color: "var(--color-danger)" }}>
                    Drop: {st.dropOffRate}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
