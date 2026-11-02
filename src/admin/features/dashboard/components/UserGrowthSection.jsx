import { useId } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Skeleton,
  ErrorState,
  EmptyState,
} from "@/components";
import { formatDate } from "@/utils";
import "./UserGrowthSection.css";

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const pt = payload[0].payload;
  const count = payload[0].value ?? 0;
  const dateStr = pt?.date || "";

  return (
    <div className="user-growth-tooltip" role="tooltip">
      <div className="user-growth-tooltip__date">
        {formatDate(dateStr, "en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </div>
      <div className="user-growth-tooltip__value">
        <span className="user-growth-tooltip__dot" />
        <strong>{count}</strong> {count === 1 ? "signup" : "signups"}
      </div>
    </div>
  );
}

export function UserGrowthSection({
  data,
  isLoading,
  isError,
  error,
  onRetry,
}) {
  const gradientId = useId();

  if (isLoading) {
    return (
      <Card className="user-growth-card">
        <CardHeader
          title="User Growth & Signups"
          subtitle="Loading trend data…"
        />

        <CardBody>
          <div className="user-growth-skeleton">
            <Skeleton width="100%" height={220} />
          </div>
        </CardBody>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="user-growth-card">
        <CardHeader title="User Growth & Signups" />
        <CardBody>
          <ErrorState
            title="Failed to load user growth data"
            message={
              error?.message ?? "Unable to fetch user signup statistics."
            }
            onRetry={onRetry}
          />
        </CardBody>
      </Card>
    );
  }

  const { dailySignups, newInRange, total } = data;
  const hasData = dailySignups && dailySignups.length > 0;

  return (
    <Card className="user-growth-card">
      <CardHeader
        title="User Growth & Signups"
        subtitle={`${newInRange.toLocaleString()} new signups in selected period • ${total.toLocaleString()} total platform users`}
        actions={
          <Badge variant="accent" dot>
            +{newInRange.toLocaleString()} signups
          </Badge>
        }
      />

      <CardBody>
        {!hasData ? (
          <EmptyState
            title="No signup data in this date range"
            description="Try selecting a wider date range to see signup trends."
          />
        ) : (
          <div
            className="user-growth-chart-container"
            role="region"
            aria-label="Daily User Signups Chart"
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={dailySignups}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-accent)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-accent)"
                      stopOpacity={0.0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="var(--color-border)"
                  vertical={false}
                />

                <XAxis
                  dataKey="date"
                  stroke="var(--color-text-secondary)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickFormatter={(val) =>
                    formatDate(val, "en-US", { month: "short", day: "numeric" })
                  }
                />

                <YAxis
                  stroke="var(--color-text-secondary)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />

                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-accent)"
                  strokeWidth={2.5}
                  fill={`url(#${gradientId})`}
                  activeDot={{
                    r: 5,
                    fill: "var(--color-bg-surface)",
                    stroke: "var(--color-accent)",
                    strokeWidth: 3,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
