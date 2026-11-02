import { Card, CardHeader, CardBody, Badge } from "@/components";
import "./ServerConfigSection.css";

export function ServerConfigSection({ serverConfig }) {
  if (!serverConfig) return null;

  const items = [
    { label: "HTTP Server Port", value: serverConfig.port, mono: true },
    {
      label: "Public API Endpoint",
      value: serverConfig.publicApiUrl,
      mono: true,
    },
    { label: "Candidate Token Lifetime", value: serverConfig.jwtExpiresIn },
    { label: "Admin Token Lifetime", value: serverConfig.adminJwtExpiresIn },
    {
      label: "Permitted CORS Origins",
      value: serverConfig.corsOrigins.join(", "),
      mono: true,
    },
  ];

  return (
    <Card className="settings-section">
      <CardHeader
        title="Server & Environment Configuration"
        subtitle="Read-only backend infrastructure parameters resolved at process boot."
        actions={<Badge variant="default">Environment Resolved</Badge>}
      />

      <CardBody>
        <div className="server-config-grid">
          {items.map((it) => (
            <div key={it.label} className="server-config-item">
              <span className="server-config-item__label">{it.label}</span>
              <span
                className={`server-config-item__value${it.mono ? " mono" : ""}`}
              >
                {it.value}
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
