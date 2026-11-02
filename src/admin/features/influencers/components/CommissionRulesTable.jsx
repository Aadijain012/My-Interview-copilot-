import { useState } from "react";
import { Table, Th, Td, Badge, Button, EmptyState, Pagination } from "@/components";

export function CommissionRulesTable({
  rules = [],
  isLoading,
  onEdit,
  onDelete,
  canUpdate,
  canDelete,
}) {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(rules.length / PAGE_SIZE) || 1;
  const paginatedRules = rules.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (isLoading) {
    return (
      <div className="influencers-table-card">
        <Table aria-label="Commission rules loading">
          <thead>
            <tr>
              <Th>Tier Range (Conversions)</Th>
              <Th>Commission Rate</Th>
              <Th>Currency</Th>
              <Th>Plan ID</Th>
              <Th>Status</Th>
              {(canUpdate || canDelete) && <Th style={{ textAlign: "right" }}>Actions</Th>}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>
                <Td colSpan={6} style={{ textAlign: "center", padding: "16px", color: "var(--color-text-muted)" }}>
                  Loading commission tier rules...
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <div className="influencers-table-card">
        <EmptyState
          title="No Commission Rules Configured"
          description="Create tiered commission rules to automatically scale influencer earnings as conversion volume increases."
        />
      </div>
    );
  }

  return (
    <div className="influencers-table-card">
      <Table aria-label="Commission Rules Matrix">
        <thead>
          <tr>
            <Th>Tier Range (Conversions)</Th>
            <Th>Commission Rate</Th>
            <Th>Currency</Th>
            <Th>Plan ID</Th>
            <Th>Status</Th>
            {(canUpdate || canDelete) && <Th style={{ textAlign: "right" }}>Actions</Th>}
          </tr>
        </thead>
        <tbody>
          {paginatedRules.map((rule) => {
            const min = rule.minConversions ?? 0;
            const max = rule.maxConversions;
            const rangeText = max !== null && max !== undefined
              ? `${min} – ${max} conversions`
              : `${min}+ conversions (Unlimited)`;
            const rate = rule.commissionPercent ?? 10;
            const isActive = rule.status === "active";

            return (
              <tr key={rule.id}>
                {/* Range */}
                <Td>
                  <code style={{ background: "var(--color-bg-subtle)", padding: "4px 10px", borderRadius: "4px", fontWeight: 600, fontSize: "var(--text-sm)" }}>
                    {rangeText}
                  </code>
                </Td>

                {/* Rate */}
                <Td>
                  <span style={{ fontWeight: 700, color: "var(--color-success)", fontSize: "var(--text-base)" }}>
                    {rate}%
                  </span>
                </Td>

                {/* Currency */}
                <Td>
                  <Badge variant="warning">{rule.currency || "USD"}</Badge>
                </Td>

                {/* Plan */}
                <Td>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>
                    {rule.planId || "default"}
                  </span>
                </Td>

                {/* Status */}
                <Td>
                  <Badge variant={isActive ? "success" : "default"}>
                    {(rule.status || "active").toUpperCase()}
                  </Badge>
                </Td>

                {/* Actions */}
                {(canUpdate || canDelete) && (
                  <Td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "flex-end" }}>
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(rule)}
                          title="Edit tier rule"
                        >
                          Edit
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => onDelete(rule.id)}
                          title="Delete tier rule"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </Td>
                )}
              </tr>
            );
          })}
        </tbody>
      </Table>

      {rules.length > PAGE_SIZE && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={rules.length}
          limit={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
