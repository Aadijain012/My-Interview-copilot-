import { Card, CardHeader, CardBody } from "@/components";
import { useTheme } from "@/providers/useTheme";
import "./AppearanceSettingsSection.css";

export function AppearanceSettingsSection() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const options = [
    {
      id: "light",
      label: "Light",
      desc: "Clean, crisp appearance with bright surfaces and dark text.",
    },
    {
      id: "dark",
      label: "Dark",
      desc: "Low-light high-contrast theme optimized for reduced eye strain.",
    },
    {
      id: "system",
      label: "System Preference",
      desc: "Automatically synchronizes with your operating system display theme.",
    },
  ];

  return (
    <Card className="settings-section">
      <CardHeader
        title="Appearance & Interface Theme"
        subtitle={`Customize the visual style of the administrative panel. Active theme: ${resolvedTheme}.`}
      />

      <CardBody>
        <div
          className="theme-options-grid"
          role="radiogroup"
          aria-label="Theme mode"
        >
          {options.map((opt) => {
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`theme-option-card${isSelected ? " theme-option-card--active" : ""}`}
                onClick={() => setTheme(opt.id)}
              >
                <div className="theme-option-card__header">
                  <span className="theme-option-card__radio" />
                  <strong className="theme-option-card__label">
                    {opt.label}
                  </strong>
                </div>
                <p className="theme-option-card__desc">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
