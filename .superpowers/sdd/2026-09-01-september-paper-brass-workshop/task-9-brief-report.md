# Task 9 report: September workshop navigation and privacy

## Delivered

- Replaced the live September scene map with `intro`, `workshop`, `reveal`, and `ending`; every mount owns one idempotent `SceneMount` disposer, and only the reveal mount exposes a connected product card.
- Moved reveal ownership to one guarded main-thread transaction. The prior workshop disposer runs once before a reveal mount; the card mounts once, is revalidated, then commits state and one v2 history entry without a second render.
- Added v2-only history (`v`, session token, scene, optional reveal gift ID), path-only URL replacement before first render, and in-memory-only normalized chooser age. NFC fragments, storage, puzzle state, and their source/tests are removed.
- Updated workshop return/Back focus to target the relevant stable control, kept the reveal heading focused after mount, and retained the approved final-letter text unchanged.
- Removed compatibility gift fields/copy from runtime and generated release content. The release artifact now contains only reveal-safe gift fields plus the camera-manifest reference.
- Updated syntax checks and theme contracts for the paper-and-brass workshop. Existing unrelated preview-media, portal, and in-progress style/assets changes remain outside this task's commit.

## Regression coverage

- Added a stale reveal regression proving that a late async mount cannot overwrite a restart.
- Covered unopened history reveals, wrong v2 history entries, one-time cleanup ownership, failed reveal recovery, no early product card, and product-content schema privacy.

## Verification

- `npm --prefix apps/september run check` — passed.
- `node --test apps/september/tests/core-session.test.mjs apps/september/tests/core-personalization.test.mjs apps/september/tests/ui-theme-contract.test.mjs apps/september/tests/scene-lifecycle.test.mjs` — 20 passed.
- `node --test apps/september/tests/workshop-controller.test.mjs && node --test apps/september/tests/ui-media-order.test.mjs && node --test apps/september/tests/release-content-generator.test.mjs && node --test apps/september/tests/content-schema.test.mjs` — 23 passed.
- `npm --prefix apps/september run check:manifests && npm --prefix apps/september run validate` — passed.
- `npm --prefix apps/september test` — 95 passed.

## Scope note

Task 7's physical-iPhone HTTPS gate was explicitly waived for this integration; no device, camera, latency, or Safari evidence is claimed here. The root Playwright September spec is still the old NFC/box/puzzle suite and was outside the Task 9 file list, so it needs a separate workshop-flow rewrite before root E2E can be expected to pass.
