import {
  Card,
  CardHeader,
  CardBody,
  Table,
  Th,
  Td,
  Skeleton,
  ErrorState,
  EmptyState,
} from "@/components";
import { formatDate } from "@/utils";
import "./TopUsersSection.css";

export function TopUsersSection({ data, isLoading, isError, error, onRetry }) {
  if (isLoading) {
    return (
      <Card className="top-users-card">
        <CardHeader
          title="Top 10 Most Active Users"
          subtitle="Loading leaderboards…"
        />
        <CardBody flush>
          <Table aria-label="Loading top users">
            <thead>
              <tr>
                <Th style={{ width: 60 }}>Rank</Th>
                <Th>User</Th>
                <Th>Email</Th>
                <Th>AI Usage</Th>
                <Th>Sessions</Th>
                <Th>Joined Date</Th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <Td>
                    <Skeleton
                      width={26}
                      height={26}
                      className="top-users-rank-skeleton"
                    />
                  </Td>
                  <Td>
                    <Skeleton width={120} height={20} />
                  </Td>
                  <Td>
                    <Skeleton width={160} height={20} />
                  </Td>
                  <Td>
                    <Skeleton width={70} height={20} />
                  </Td>
                  <Td>
                    <Skeleton width={50} height={20} />
                  </Td>
                  <Td>
                    <Skeleton width={90} height={20} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="top-users-card">
        <CardHeader title="Top 10 Most Active Users" />
        <CardBody>
          <ErrorState
            title="Failed to load top active users"
            message={error?.message ?? "Unable to fetch user activity leaders."}
            onRetry={onRetry}
          />
        </CardBody>
      </Card>
    );
  }

  const users = data ?? [];

  return (
    <Card className="top-users-card">
      <CardHeader
        title="Top 10 Most Active Users"
        subtitle="Ranked by total AI copilot feature requests and session activity"
      />

      <CardBody flush>
        {users.length === 0 ? (
          <EmptyState
            title="No user activity recorded"
            description="Users with AI feature interactions will appear here."
          />
        ) : (
          <Table aria-label="Top 10 Most Active Users">
            <thead>
              <tr>
                <Th style={{ width: 60 }}>Rank</Th>
                <Th>User</Th>
                <Th>Email</Th>
                <Th>AI Usage</Th>
                <Th>Sessions</Th>
                <Th>Joined Date</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const rankModifier =
                  u.rank === 1
                    ? "top-users-rank--1"
                    : u.rank === 2
                      ? "top-users-rank--2"
                      : u.rank === 3
                        ? "top-users-rank--3"
                        : "";

                return (
                  <tr key={u.id}>
                    <Td>
                      <span className={`top-users-rank ${rankModifier}`}>
                        {u.rank}
                      </span>
                    </Td>
                    <Td primary>
                      <div className="top-users-user-cell">
                        <div className="top-users-avatar" aria-hidden="true">
                          {(u.name?.[0] || u.email[0]).toUpperCase()}
                        </div>
                        <span className="top-users-name">
                          {u.name || (
                            <span className="top-users-no-name">No name</span>
                          )}
                        </span>
                      </div>
                    </Td>
                    <Td mono>{u.email}</Td>
                    <Td>
                      <span className="top-users-usage-badge">
                        <span className="top-users-usage-val">
                          {u.usageCount.toLocaleString()}
                        </span>
                        <span className="top-users-usage-unit">reqs</span>
                      </span>
                    </Td>
                    <Td>
                      <span className="top-users-sessions">
                        {u.sessionsCount.toLocaleString()}
                      </span>
                    </Td>
                    <Td>
                      {formatDate(u.createdAt, "en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
