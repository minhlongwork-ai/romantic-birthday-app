# Task 8 report: September lazy runtime budgets

## Delivered

- Split JavaScript static imports from `import()` roots. Initial closures now contain only HTML, CSS, and static-module dependencies; lazy closures include dynamic roots, their static modules, and module-worker closures.
- Tokenize compact Rollup/Vite ESM syntax such as `import{value}from` and `export{value}from`; both remain eager while `import()` stays lazy.
- Added sorted, deduplicated `lazyAssetUrlsByRoute` and September `workshop` / `camera` runtime profiles to the build manifest.
- A camera profile with an emitted `september-camera` root must include its emitted hand-landmarker worker and all four selected self-hosted runtime files. Profile artifacts must be manifest-backed, same-origin, correctly typed, hashed on disk, and no larger than 18 MiB individually.
- Replaced the global MediaPipe aggregate cap with the per-camera-artifact cap. Birthday MediaPipe fallbacks remain required independently. No 15 MiB compressed-transfer check is added here; Task 10 remains the sole Chromium/CDP gate for it.
- Added September-only `Referrer-Policy: no-referrer` and same-origin CSP headers without changing service-worker cache headers.

## Current integration state

The current September entry still uses the legacy scene map, so Vite does not yet emit the existing workshop/camera dynamic roots. The produced September profiles are therefore present but empty. Once Task 9 switches navigation to the workshop, the analyzer will automatically record the named camera root, emitted worker, and the four public MediaPipe paths; the unit fixture verifies that exact profile now.

## Verification

- `node --test --test-concurrency=1 tests/unit/build-validator.test.js tests/unit/composite-build.test.js tests/unit/vercel-build-gate.test.js` — 33 passed.
- `npm run build` — passed; build validation reported 184 assets.
- The same three test files without `--test-concurrency=1` can overlap their integration builds in the shared `staging/` directory, producing an unrelated missing service-worker error. The serial run avoids that shared-output race.
