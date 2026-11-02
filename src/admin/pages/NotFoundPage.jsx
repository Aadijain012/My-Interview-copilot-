import { Button } from "@/components";
import { useNavigate } from "react-router-dom";

/**
 * 404 — Not Found page.
 */
export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="not-found-page">
      <div
        style={{
          fontSize: "3rem",
          lineHeight: 1,
        }}
      >
        404
      </div>
      <h1>Page Not Found</h1>
      <p>The page you're looking for doesn't exist or has been moved.</p>
      <Button variant="primary" onClick={() => navigate("/dashboard")}>
        Back to Dashboard
      </Button>
    </div>
  );
}
