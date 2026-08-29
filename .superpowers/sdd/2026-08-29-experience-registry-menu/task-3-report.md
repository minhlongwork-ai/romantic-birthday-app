# Task 3 report — Vite catalog injection

## Delivered

- Added `portal/experience-catalog-plugin.mjs`, which renders the registry catalog into the single `<!-- EXPERIENCE_CATALOG -->` marker and throws a clear error if the marker is absent or duplicated.
- Registered the catalog transform before chooser metadata processing in `portal/vite.config.js`.
- Loaded the experience registry once with top-level `await`; chooser metadata now uses asynchronous file loading rather than a synchronous JSON read.
- Added transform unit coverage for published/draft output, marker validation, and plugin ordering.

## Verification

- RED: `node --test tests/unit/experience-catalog-plugin.test.js` failed with `ERR_MODULE_NOT_FOUND` before the plugin existed.
- GREEN: `node --test tests/unit/experience-catalog.test.js tests/unit/experience-catalog-plugin.test.js` passed (9 tests).
- Build: `npx vite build --config portal/vite.config.js --outDir /private/tmp/experience-catalog-portal-build` passed. The generated chooser contains birthday and August links, omits the September link, and contains no catalog marker.

The build retains the existing unresolved-runtime-font warnings from the portal stylesheet; they are unrelated to this task.
