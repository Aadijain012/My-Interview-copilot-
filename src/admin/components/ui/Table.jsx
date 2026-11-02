import "./Table.css";

/* ── Table ── */

export function Table({ className = "", children, "aria-label": ariaLabel }) {
  return (
    <div
      className="table-container"
      role="region"
      aria-label={ariaLabel ?? "Data table"}
      tabIndex={0}
    >
      <table className={`table${className ? ` ${className}` : ""}`}>
        {children}
      </table>
    </div>
  );
}

/* ── Th ── */

function IconSort({ dir }) {
  if (dir === "asc") {
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    );
  }
  if (dir === "desc") {
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    );
  }
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ opacity: 0.4 }}
      aria-hidden="true"
    >
      <polyline points="18 9 12 3 6 9" />
      <polyline points="6 15 12 21 18 15" />
    </svg>
  );
}

export function Th({
  sortable,
  sortDir = null,
  onSort,
  children,
  className = "",
  ...rest
}) {
  const cls = [
    sortable && "sortable",
    sortDir === "asc" && "sort-asc",
    sortDir === "desc" && "sort-desc",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (sortable) {
    return (
      <th
        className={cls}
        onClick={onSort}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && onSort) {
            e.preventDefault();
            onSort();
          }
        }}
        tabIndex={0}
        role="columnheader"
        aria-sort={
          sortDir === "asc"
            ? "ascending"
            : sortDir === "desc"
              ? "descending"
              : "none"
        }
        {...rest}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {children}
          <IconSort dir={sortDir} />
        </span>
      </th>
    );
  }

  return (
    <th className={className} {...rest}>
      {children}
    </th>
  );
}

/* ── Td ── */

export function Td({ primary, mono, className = "", children, ...rest }) {
  const cls = [primary && "td--primary", mono && "td--mono", className]
    .filter(Boolean)
    .join(" ");

  return (
    <td className={cls || undefined} {...rest}>
      {children}
    </td>
  );
}

/* ── Pagination ── */

export function Pagination({
  page: pageProp,
  currentPage,
  totalPages = 1,
  total,
  limit: limitProp,
  pageSize,
  onPageChange,
}) {
  const page = Number(pageProp ?? currentPage ?? 1) || 1;
  const limit = Number(limitProp ?? pageSize ?? 10) || 10;
  const numTotal = total != null ? Number(total) : null;
  const safeTotalPages = Math.max(1, Number(totalPages) || (numTotal != null ? Math.ceil(numTotal / limit) : 1));

  let infoText;
  if (numTotal != null) {
    if (numTotal === 0) {
      infoText = "No results";
    } else {
      const from = Math.min((page - 1) * limit + 1, numTotal);
      const to = Math.min(page * limit, numTotal);
      infoText = `${from}–${to} of ${numTotal}`;
    }
  } else {
    infoText = `Page ${page} of ${safeTotalPages}`;
  }

  const getPages = () => {
    const pages = [];
    if (safeTotalPages <= 7) {
      for (let i = 1; i <= safeTotalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("…");
      for (
        let i = Math.max(2, page - 1);
        i <= Math.min(safeTotalPages - 1, page + 1);
        i++
      ) {
        pages.push(i);
      }
      if (page < safeTotalPages - 2) pages.push("…");
      pages.push(safeTotalPages);
    }
    return pages;
  };

  return (
    <div className="pagination" role="navigation" aria-label="Table pagination">
      <span className="pagination__info">{infoText}</span>
      <div className="pagination__controls">
        <button
          className="pagination__btn"
          onClick={() => onPageChange?.(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          ‹
        </button>
        {getPages().map((p, idx) =>
          p === "…" ? (
            <span
              key={`ellipsis-${idx}`}
              style={{ padding: "0 4px", color: "var(--color-text-muted)" }}
            >
              …
            </span>
          ) : (
            <button
              key={p}
              className={`pagination__btn${page === p ? " pagination__btn--active" : ""}`}
              onClick={() => onPageChange?.(p)}
              aria-label={`Page ${p}`}
              aria-current={page === p ? "page" : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button
          className="pagination__btn"
          onClick={() => onPageChange?.(page + 1)}
          disabled={page >= safeTotalPages}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}
