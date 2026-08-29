# Task 4 report — derived site configuration

## Delivered

- Reduced `src/content/site.json` to the chooser shell and canonical origin.
- Added `composeSiteConfig(shell, experiences)` and made `loadSiteConfig()` compose its routes, share targets, pages, and `experiences` from `loadExperienceRegistry()`.
- Made site-config validation derive route and share-target IDs from `site.experiences` instead of fixed Birthday/August/September lists.
- Updated every Vite config to await `loadSiteConfig()`; the chooser continues to register the catalog transform before the metadata transform.
- Updated site-config and metadata tests to consume the derived public config. The composition test mutates a cloned registry record’s route and metadata and verifies the public result changes without editing the shell.

## Verification

- RED: `node --test tests/unit/site-config.test.js tests/unit/site-metadata.test.js` failed because `composeSiteConfig` was not exported.
- GREEN: `node --test tests/unit/experience-registry.test.js tests/unit/site-config.test.js tests/unit/site-metadata.test.js` passed (17 tests).
- Vite smoke builds passed for Birthday, chooser, August, and September with temporary output directories. Generated HTML contains the registry-derived canonical URLs and metadata.

The chooser build retains its existing unresolved local-font URL warnings, and September retains its existing unresolved background-image URL warnings; neither blocks the build and neither was changed by this task.

## Follow-up dependency

- The full `npm test` suite has one expected failure in the legacy composite-build test: the current composite builder does not yet copy the registry previews to `/experience-previews/`. That data-driven preview-copy migration belongs to Task 5; the failure is at `scripts/build-composite.mjs:312` and is outside this task’s owned files.
