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

## Existing out-of-scope conflict

`tests/e2e/portal-typography.spec.js` was already dirty before this task. It
still treats September as a published link, which conflicts with the registry's
current `draft` status. It was not modified because this task was explicitly
scoped to `portal-registry.spec.js`, routing metadata coverage, and registry
documentation.
