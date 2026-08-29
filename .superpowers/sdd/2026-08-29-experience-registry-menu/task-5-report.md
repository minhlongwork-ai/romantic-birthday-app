# Task 5 report — registry-driven composite builds

## Implemented

- Added `scripts/experience-builds.mjs` with environment resolution, published-only production selection, normalized route/hook/copy plans, collision-safe preview destinations, and longest-prefix URL ownership.
- Reworked `scripts/build-composite.mjs` to load the registry once and drive experience validation, Vite builds, post-build hooks, tree copies, preview copies, route ownership, and manifest catalog entries from registry records.
- Preserved the chooser build plus all legacy Birthday/August/September development outputs and the existing standalone chooser/service-worker/font copies.
- Copied every registry preview, including draft September, to its `/experience-previews/<id>.webp` public path.
- Added ordered catalog entries with only `{ id, year, month, route, built, previewPublicPath }`; no personalized values are written.

## TDD evidence

- `node --test tests/unit/experience-builds.test.js` first failed with `ERR_MODULE_NOT_FOUND` for the planned helper.
- `node --test tests/unit/composite-build.test.js` then failed because all three `/experience-previews/*.webp` dependencies were absent from `dist`.
- After implementation, `node --test tests/unit/experience-builds.test.js tests/unit/composite-build.test.js tests/unit/build-validator.test.js` passed: 18 tests, 0 failures.
- `npm test` passed the complete repository matrix: 103 shared/Birthday tests, 39 August tests, and 52 September tests (194 total), with 0 failures.

## Smoke evidence

- `npm run build` passed and built chooser, Birthday, August, and September for the development environment.
- `npm run validate:dist` passed with 178 assets.
- A direct manifest/filesystem smoke assertion confirmed catalog order `birthday → august → september`, all three route indexes, all three chooser previews, every catalog record marked built, and zero external runtime URLs.
- The production fixture confirmed the output plan contains chooser/Birthday/August only, contains no September route/runtime namespace, retains all three chooser previews, and marks September `built: false`.

## Deferred dependency

The production composite currently reaches the legacy `scripts/validate-build.mjs` gate after writing the correct published-only artifact, then that validator rejects the missing September route because it is still hardcoded to all routes. Task 6 owns the status-aware validator migration. The production artifact test accepts only that known gate until Task 6 makes the same command exit successfully; no test-only bypass was added.

## Scope notes

- `scripts/runtime-dependencies.mjs`, `scripts/validate-build.mjs`, and `tests/unit/build-validator.test.js` were not modified because the parent task explicitly kept them outside this worker's ownership.
- The pre-existing dirty build-SHA fingerprint changes in `scripts/build-composite.mjs` were preserved and are intentionally excluded from this task's staged commit.
- Unrelated dirty and untracked files were left untouched and unstaged.
