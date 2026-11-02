# Regional pricing UI

Prices and coupons are calculated by the AWS API. The browser chooses a country, formats integer minor amounts using currency-specific decimal places, and never supplies a price or credit cost. Checkout remains disabled.

markets.json records Unicode CLDR 49.0.0 source metadata and country/currency defaults. markets.js is its browser/Node export with English country display names. Keep both aligned with backend src/billing/markets.json; retain CLDR-LICENSE.txt.

Country preference precedence: saved account, explicit browser choice, same-origin Cloudflare country suggestion, locale/US fallback. Only an explicit selection writes the account preference. No raw IP is persisted. Failed account saves remain visible to the user.

Browser tests intercept all requests and use synthetic accounts; they do not make payments, grant credits or call paid providers.

## Global pricing improvements (2026-10-25)

Country initialization now has independent account/connection timeouts, cancels on a manual selection and explains whether the country was saved or suggested. Both pricing and Add credits use the shared currency fallback/checkout capability checks. A stale catalog is hidden immediately when country changes.

Admin → Plans & offers → Country prices → Preview fixed country prices gives editable, upward-rounded suggestions. No price is saved without the existing owner review/save flow. Suggestions use regular prices before active timed offers, preserve existing overrides and refuse stale revisions or unsupported local currencies.

Stripe remains test-only. New test checkouts display the billing country and collect the address on Stripe. A provider-country mismatch is terminal and visible, with no new credit grant or endless polling. Subscription cancellation remains available. Tax configuration and live billing activation are separate, not enabled by this release.
