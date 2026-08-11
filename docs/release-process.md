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
