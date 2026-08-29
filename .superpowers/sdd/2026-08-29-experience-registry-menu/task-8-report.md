# Task 8 report — full regression and release evidence

## Regression defect and minimal fix

The first `npm test` run exposed one integration-test isolation defect: the
shared/Birthday suite passed 113 of 114 tests, but
`tests/unit/composite-build.test.js` and
`tests/unit/vercel-build-gate.test.js` launched composite builds concurrently.
Both builds delete and recreate the repository-global `staging/` and `dist/`
directories, so the Vercel production build lost
`staging/birthday/service-worker.js` before its post-build hook could read it.

Root-cause evidence:

- `node --test tests/unit/vercel-build-gate.test.js` passed 4/4 in isolation.
- Running the composite and Vercel build-gate files together reproduced the
  same `ENOENT` failure (5 passed, 1 failed).
- The minimal fix changes only the `test:birthday` command in `package.json`
  to use Node's `--test-concurrency=1`. Production build code and application
  behavior are unchanged.
- After the fix, `npm run test:birthday` passed 114/114.

## Unit, composite, release, and source validation

- `npm test` — passed with zero failures:
  - shared/Birthday: 114 passed;
  - August: 39 passed;
  - September: 52 passed;
  - total: 205 passed.
- `npm run validate` — passed. Birthday checked 82 media files, August passed
  its 7-scene/36-file production validation, and September checked 2 gifts and
  6 product encodings in development mode.
- The existing three MediaPipe files above the recommended 2 MiB size remained
  warnings only; no new source-validation warning appeared.

## Development/preview build evidence

- `npm run build` — passed and built chooser, Birthday, August, and September.
- `npm run validate:dist` — passed with 178 assets.
- The restored final development manifest contains ordered catalog entries
  `birthday -> august -> september`, marks all three built, contains zero
  external runtime URLs, and includes `dist/september/index.html`.

### Preview browser coverage

`E2E_EXPECTED_ENV=preview npm run test:e2e:run` started all 364 configured
cases across desktop Chrome, Android Chrome, desktop Firefox, desktop Safari,
iOS Safari, and iPhone X. Before interruption it completed desktop Chrome,
Android Chrome, and Firefox, including chooser, routing/metadata/shared-404,
Birthday, August, and September journeys. It recorded 150 passes and 178
intentional project skips, then one desktop-Safari camera test timed out while
waiting for the initial `Dùng cử chỉ` action; two iOS tests were interrupted by
the requested stop and 33 cases had not started.

The timeout was not reproducible:

- the exact desktop-Safari case passed once in isolation;
- it then passed 5/5 with `--repeat-each=5` and two workers (2.6–5.8 seconds);
- the unfinished desktop-Safari, iOS-Safari, and iPhone-X projects were rerun
  sequentially with one worker and passed 46 tests with 102 intentional skips;
  the formerly timed-out camera case passed in 4.3 seconds.

No browser-test or application edit was made for this load-sensitive timeout.
Combined browser evidence covers every configured preview project and preserves
the existing intentional project skips.

## Production exclusion and browser evidence

- `npm run build:release` — exited 0 and passed validation with 148 assets.
- A direct manifest/filesystem assertion confirmed:
  - routes are `chooser`, `birthday`, and `august`;
  - catalog build flags are Birthday `true`, August `true`, September `false`;
  - Birthday and August indexes exist;
  - `dist/september/index.html` and the entire September runtime namespace are
    absent;
  - no manifest runtime asset belongs to September;
  - `dist/experience-previews/september.webp` remains present;
  - external runtime URLs remain empty.
- A fresh production `npm run validate:dist` passed with 148 assets.
- The production chooser/routing matrix ran
  `portal-typography.spec.js`, `portal-registry.spec.js`, and
  `routing-metadata.spec.js` on desktop Chrome, Android Chrome, desktop
  Firefox, desktop Safari, and iOS Safari: 18 passed, 12 intentional skips.
  Desktop Chrome verified the explicit production route/metadata matrix,
  September's shared 404, the generic missing-route 404, and all critical
  assets. Every browser verified the human-facing registry timeline, query
  allowlist, draft non-interactivity, and preview fallback.

## Published-September failure path

- The focused test
  `node --test --test-name-pattern="publishing the September fixture fails before Vite" tests/unit/vercel-build-gate.test.js`
  passed 1/1. It asserts a synthetic published September exits 1 before Vite.
- `npm run validate:september:release` exited 1 as expected and reported exactly
  six diagnostics: each of the two gifts is unapproved, is a development
  fixture, and contains placeholder product content.

## Final artifact and scope

- A final `npm run build` restored the normal local-review artifact: 178 assets,
  all three experience routes, and zero external runtime URLs.
- `git diff --check` passed.
- No generated `dist`, `staging`, Playwright output, or deployment was staged.
- Pre-existing dirty/untracked CI, portal, composite-build, September media,
  and September test files were preserved. The only Task 8 code/config change
  is the test-runner serialization in `package.json`, plus this report.

## Final-review fix round

The load-bearing final-review findings were resolved without changing product
content or route availability:

- the main-push approval gate now runs the status-aware `npm run build:release`
  command after preview browser coverage; the existing production route-matrix
  step remains in place;
- registry preview sources must decode through Sharp, their intrinsic dimensions
  must exactly match the declared dimensions, and recipient-facing
  `kind`/`title`/`description`/`actionLabel`/preview-alt copy is capped at 200
  Unicode characters (documented in `docs/experience-registry.md`);
- development and preview build validation now expects every registry record,
  independently of manifest `built` claims, while production still expects only
  published records;
- every built chooser/experience route must declare a same-origin Open Graph
  image that exists as an image asset in the build manifest;
- the obsolete hardcoded `/chooser-birthday.webp` copy and critical-asset rule
  were removed. Composite coverage now proves it is absent and that registry
  preview paths are the chooser's authoritative preview assets;
- registry/build/release/Vercel/portal tests derive complete ID, month, status,
  and route expectations from the loaded registry, retaining focused app-specific
  assertions only where they exercise an actual Birthday/August/September
  regression.

### TDD and automated verification

- RED: the new focused unit tests failed for a preview manifest that omitted
  September, a `package.json` preview source, mismatched intrinsic dimensions,
  oversized copy, a missing built-route Open Graph asset, and the stale chooser
  preview copy.
- GREEN: the focused registry/build/release suite passed 40/40; the serialized
  composite/Vercel suite passed 6/6.
- `npm test` passed all 210 tests: 119 shared/Birthday, 39 August, and 52
  September.
- `npm run validate` passed; the three pre-existing MediaPipe size warnings
  remain warnings only.
- `npm run build && npm run validate:dist` passed with all three development
  routes and 177 manifest assets.
- `npm run build:release` passed with two published routes and 147 manifest
  assets; `EXPERIENCE_BUILD_ENV=production npm run validate:dist` independently
  passed the production artifact.
- Preview and production chooser/registry/routing matrices each passed 12 tests
  across desktop Chromium, Firefox, and WebKit, with 6 intentional project-scoped
  skips. Desktop Chromium verified the direct-route metadata matrix, draft
  September 404 in production, generic shared 404, and critical assets.
- A final development build and `npm run validate:dist` restored and validated
  the normal three-route local-review artifact (177 assets).
- `git diff --check` passed. No deployment was performed.

## Residual final-review fix round

- Preview validation now performs a full Sharp pixel decode with
  `failOn: 'error'` after reading metadata, so an image with a readable header
  but truncated/corrupt pixel data is rejected before its intrinsic dimensions
  are accepted.
- The regression fixture uses the first 500 bytes of the existing
  `public/og-preview.jpg`: Sharp reports its `1200×630` metadata while full
  decoding fails. The focused test was observed failing before the decode check
  and passing after it.
- The production composite assertion now resolves every expected chooser preview
  from that record's declared `preview.publicPath`; it no longer reconstructs an
  assumed `/experience-previews/${id}.webp` convention.
- Focused registry/composite coverage passed 16/16.
- A fresh `npm test` passed all 211 tests: 120 shared/Birthday, 39 August, and
  52 September.
- `npm run validate && npm run build && npm run validate:dist` passed; the final
  development artifact contains 177 assets. The three existing MediaPipe size
  warnings remain non-failing. No deployment was performed.
