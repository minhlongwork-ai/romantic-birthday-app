# Task 7 report: browser registry journey

## Delivered

- Added `tests/e2e/portal-registry.spec.js` with registry-driven assertions for
  chronological year/month cards, published links, draft non-interactivity,
  hidden internal status, assistive-only unavailability text, query allowlist,
  and the image-error fallback.
- Reworked `tests/e2e/routing-metadata.spec.js` to read the registry and site
  shell, verify canonical/Open Graph metadata for built routes, and accept only
  the valid preview or production route matrix. In production it checks that
  draft routes serve the shared 404 while their chooser previews remain served.
- Added `docs/experience-registry.md` with the seven-step monthly workflow and
  the rule that status remains internal, without manual portal/route/metadata/
  test-list edits.

## Verification

- `npm run build` — passed; restored the normal development/preview artifact.
- `npx playwright test tests/e2e/portal-registry.spec.js tests/e2e/routing-metadata.spec.js --project=desktop-chrome` — passed (4 tests) against the preview artifact.
- `EXPERIENCE_BUILD_ENV=production npm run build && npx playwright test tests/e2e/portal-registry.spec.js tests/e2e/routing-metadata.spec.js --project=desktop-chrome` — passed (4 tests) against the production fixture.
- `git diff --check` — passed.

## Pre-fix stale assertion

`tests/e2e/portal-typography.spec.js` was already dirty before the first Task 7
commit and treated September as a published link. Review round 1 brought that
pre-existing test into the Task 7 scope and replaced the stale expectation with
the current draft contract.

## Review fixes, round 1

- Updated the existing typography journey to derive timeline count/order from
  the registry, keep personalization on Birthday/August only, verify September
  is a non-interactive article, and preserve the published-card image fallback.
- Removed desktop-only skips from the registry suite, so its chooser, query, and
  fallback assertions run on desktop Chrome, Android Chrome, Firefox, desktop
  Safari, and iOS Safari.
- Added `E2E_EXPECTED_ENV=preview|production` to make the routing matrix
  explicit. CI now builds the production fixture and runs the desktop routing
  specification with `E2E_EXPECTED_ENV=production`.
- Corrected README and release evidence documentation: September remains a
  chooser preview while draft; production direct/personalized September URLs
  return the shared 404 until the registry record is published.

### Round-1 verification

- Stale test RED: `npx playwright test tests/e2e/portal-typography.spec.js --project=desktop-chrome` failed because it expected a September published link.
- Preview: `E2E_EXPECTED_ENV=preview npx playwright test tests/e2e/portal-typography.spec.js tests/e2e/portal-registry.spec.js tests/e2e/routing-metadata.spec.js --project=desktop-chrome --project=android-chrome --project=desktop-firefox --project=desktop-safari --project=ios-safari` — 18 passed, 12 intentional desktop-only skips.
- Production fixture: `EXPERIENCE_BUILD_ENV=production npm run build && E2E_EXPECTED_ENV=production npx playwright test tests/e2e/portal-typography.spec.js tests/e2e/portal-registry.spec.js tests/e2e/routing-metadata.spec.js --project=desktop-chrome` — 6 passed.
