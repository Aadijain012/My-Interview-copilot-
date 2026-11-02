import { Badge } from "@/components";

export function OnboardingBadge({ mustChangePassword, totpEnabled }) {
  if (mustChangePassword) {
    return (
      <Badge variant="warning" dot>
        Password Change Req.
      </Badge>
    );
  }

  if (!totpEnabled) {
    return (
      <Badge variant="info" dot>
        TOTP Pending
      </Badge>
    );
  }

  return (
    <Badge variant="success" dot>
      Onboarded
    </Badge>
  );
}
