# Task 6 report — status-aware release and dist validation

## Implemented

- Added `scripts/experience-release.mjs` with `createReleaseValidationPlan(records, environment)`: production selects published records and their release validators; preview/development select every record and their fixture-tolerant development validators.
- Reworked `scripts/build-vercel.mjs` to load the registry, run the selected validation commands sequentially with Node, and pass the resolved environment to the composite build. `--production` now matches `VERCEL_ENV=production`, and `--registry-url` provides a CLI-only synthetic-registry seam for the release-gate integration test.
- Changed `build:release` to the cross-platform Node entry point. `vercel.json` already used `npm run build:vercel`, so its deployment contract required no source change.
- Updated source validation to load the registry, execute development validation hooks from its records, and resolve chooser preview OG assets through registry source paths and declared dimensions.
- Made local and remote dist validation derive built routes from the registered manifest catalog. It now requires every chooser preview, rejects omitted published records, rejects runtime assets/closures/namespaces for non-built drafts, rejects unregistered routes and personalized manifest fields, and preserves the September budget only when September is built.

## TDD evidence

- The first focused run failed with `ERR_MODULE_NOT_FOUND` for `scripts/experience-release.mjs`, the old package release command, the hardcoded September production gate, and hardcoded all-route dist validation.
- The production-manifest fixture specifically failed with the legacy errors `Manifest routes do not match`, `september has no critical asset`, and `september initial dependency closure is missing`.
- After implementation, `node --test tests/unit/experience-release.test.js tests/unit/vercel-build-gate.test.js tests/unit/build-validator.test.js` passed: 21 tests, 0 failures.

## Release and validation evidence

- The real Vercel production integration build exited 0, emitted chooser/Birthday/August routes only, retained `/experience-previews/september.webp`, and emitted no September runtime asset or route namespace.
- The synthetic registry with September marked published exited 1 before any Vite output and retained the existing six approval/fixture/placeholder diagnostics.
- `VERCEL_ENV=preview node scripts/build-vercel.mjs` exited 0, built all three experience routes, and passed dist validation with 178 assets.
- `npm run validate` exited 0 and ran the three registry development validators; September fixtures remained allowed.
- `git diff --check` passed before the final commit. No deployment was performed.

## Scope notes

- Existing dirty and untracked September assets, shared portal/E2E changes, CI changes, and the user-owned `scripts/build-composite.mjs` build-SHA change were preserved and excluded from this task's commit.
- Generated `dist` and `staging` outputs remain ignored and were not staged.
