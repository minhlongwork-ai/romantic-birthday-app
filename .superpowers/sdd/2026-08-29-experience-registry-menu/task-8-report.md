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
