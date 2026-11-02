import "./DateRangeFilter.css";

const PRESETS = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
];

export function DateRangeFilter({ preset, onChange, disabled = false }) {
  return (
    <div
      className="date-range-filter"
      role="group"
      aria-label="Select dashboard date range"
    >
      <span className="date-range-filter__label" aria-hidden="true">
        Range:
      </span>
      <div className="date-range-filter__buttons">
        {PRESETS.map((p) => {
          const isActive = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`date-range-filter__btn${isActive ? " date-range-filter__btn--active" : ""}`}
              onClick={() => onChange(p.id)}
              disabled={disabled}
              aria-pressed={isActive}
              aria-label={
                p.id === "7d"
                  ? "Last 7 days"
                  : p.id === "30d"
                    ? "Last 30 days"
                    : "Last 90 days"
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
