# Production release evidence

Vercel production tracks `main`. A release is accepted only when the READY
deployment reports the exact Git commit SHA that was merged. Rollback restores
service but never counts as completing a release.

## Evidence layout and retention

GitHub Actions uploads one artifact named `production-qa-<commit-sha>` with:

- `playwright-report/`
- `test-results/`
- `dist/build-manifest.json`

Artifacts are retained for 30 days. Manual production checks should be recorded
under the matching Vercel deployment with the deployment ID, Git SHA, route
smoke results, metadata result, runtime-error comparison window, and approver.

## September release gate

September remains a draft until all of the following evidence is attached to a
clean commit:

1. The sender supplies the exact cake name, size, confirmed lemon-tiramisu
   variant, exact bouquet description, final practical details shown to the
   recipient, and suitability confirmation.
2. The sender supplies one owned or properly licensed source JPEG for each real
   gift and approves its usage evidence.
3. Regenerate media and provenance; set `fixture:false` and `approved:true`; then
   validate on the clean commit.
4. The sender approves the exact HTTPS staging artifact and commit after the
   passing Task 7 physical-iPhone camera evidence and Task 11 five-person
   evidence are attached.
5. Smoke every currently registered published route, chooser, personalization,
   both order choices, touch fallback, image fallback, Back/Forward, and no
   third-party requests. On iPhone, verify the camera flow only after its explicit
   opt-in and verify **Dùng chạm** remains a complete fallback. Do not record
   query values, frames, landmarks, or names.
6. Promotion or deployment remains a separate explicit request. Roll back to the
   last-known-good deployment for a critical route, chooser, secret-reveal,
   completion, or text-fallback failure.

## Runtime error fingerprints

Runtime errors are compared using:

```text
lowercase(errorName) | normalizedMessage | sortedAffectedRoutes
```

`normalizedMessage` is trimmed, lowercased, and has volatile URLs, UUIDs,
hexadecimal identifiers, and standalone numbers replaced by stable tokens.
Affected routes are normalized to leading-slash paths, deduplicated, sorted,
and joined with commas. The executable implementation and its regression tests
live in `scripts/runtime-fingerprint.mjs` and
`tests/unit/runtime-fingerprint.test.js`.
