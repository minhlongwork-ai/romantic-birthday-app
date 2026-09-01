# Task 9 report: September workshop navigation and privacy

## Delivered

- Replaced the live September scene map with `intro`, `workshop`, `reveal`, and `ending`; every mount owns one idempotent `SceneMount` disposer, and only the reveal mount exposes a connected product card.
- Moved reveal ownership to one guarded main-thread transaction. An identity attempt is invalidated on every scene exit, Back/popstate, restart, and dispose; a guarded mount root prevents a late async reveal from attaching a stale card. The prior workshop disposer runs once before a reveal mount; the card mounts once, is revalidated, then commits state and one v2 history entry without a second render.
- Added v2-only history (`v`, session token, scene, optional reveal gift ID), path-only URL replacement before first render, and in-memory-only normalized chooser age. NFC fragments, storage, puzzle state, and their source/tests are removed.
- Updated workshop return/Back focus to target the relevant stable control, kept the reveal heading focused after mount, and retained valid same-session progress when Back reaches intro so Forward can restore a committed reveal. The approved final-letter text remains unchanged.
- Removed compatibility gift fields/copy from runtime and generated release content. The release artifact now contains only reveal-safe gift fields plus the camera-manifest reference.
- Removed the obsolete box, game, reveal-sequence, message-list, bow, and old responsive selectors. Updated syntax and theme contracts for the paper-and-brass workshop. Existing unrelated preview-media, portal, and in-progress style/assets changes remain outside this task's commit.

## Regression coverage

- Added delayed-reveal regressions for navigation, Back/popstate, dispose, and restart, plus duplicate activation. The lifecycle harness traverses actual mounted card nodes rather than returning a fixed empty selector result, and proves one card, one commit, and one history push.
- Added a desktop-Chrome Playwright privacy assertion that instruments `replaceState`, verifies the browser address bar is `/september/`, and confirms neither rendered body text nor history state contains `age=29`.
- Covered unopened history reveals, wrong v2 history entries, one-time cleanup ownership, failed reveal recovery, no early product card, and product-content schema privacy.

## Verification

- `npm --prefix apps/september run check` — passed.
- `node --test apps/september/tests/core-session.test.mjs apps/september/tests/core-personalization.test.mjs apps/september/tests/ui-theme-contract.test.mjs apps/september/tests/scene-lifecycle.test.mjs` — 25 passed.
- `node --test apps/september/tests/workshop-controller.test.mjs && node --test apps/september/tests/ui-media-order.test.mjs && node --test apps/september/tests/release-content-generator.test.mjs && node --test apps/september/tests/content-schema.test.mjs` — 23 passed.
- `npm --prefix apps/september run check:manifests && npm --prefix apps/september run validate` — passed.
- `npm --prefix apps/september test` — 99 passed.
- `npm run build` — passed; expected pre-existing MediaPipe size and unresolved background-JPG warnings remain.
- `E2E_APP_PATH=september/ npx playwright test tests/e2e/september-workshop.spec.js --project=desktop-chrome` — 1 passed.

## Scope note

Task 7's physical-iPhone HTTPS gate was explicitly waived for this integration; no device, camera, latency, or Safari evidence is claimed here. A new focused root Playwright workshop privacy spec is included. The legacy root NFC/box/puzzle suite is outside Task 9's listed deletion targets and still needs a separate workshop-flow rewrite before the full legacy September E2E run can be expected to pass.
