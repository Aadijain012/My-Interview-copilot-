import { Card, CardBody, StatCard } from "@/components";
import { Skeleton } from "@/components";
import { formatNumber } from "@/utils";
import "./ReferralDashboardKpis.css";

function IconReferral() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function IconCredit() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

export function ReferralDashboardKpis({ data, isLoading }) {
  if (isLoading) {
    return (
      <div className="referral-kpi-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardBody>
              <Skeleton height={80} />
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="referral-kpi-grid">
      <StatCard
        label="Total Referrals"
        value={formatNumber(data.totalReferrals)}
        icon={<IconReferral />}
        iconColor="accent"
      />
      <StatCard
        label="Pending Review"
        value={formatNumber(data.pendingReferrals)}
        icon={<IconClock />}
        iconColor="warning"
        meta={`${data.conversionRate}% conversion`}
      />
      <StatCard
        label="Completed"
        value={formatNumber(data.completedReferrals)}
        icon={<IconCheck />}
        iconColor="success"
      />
      <StatCard
        label="Credits Issued"
        value={formatNumber(data.creditsIssued)}
        icon={<IconCredit />}
        iconColor="info"
        meta={`${formatNumber(data.creditsReversed)} reversed`}
      />
    </div>
  );
}
