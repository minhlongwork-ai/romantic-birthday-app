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

Vercel uses `npm run build:vercel`: previews keep the development fixture for
sender review, while production applies the same gate as `npm run build:release`.
While the September registry record is `draft`, production excludes its runtime
route: `/september/` and every personalized September URL return the shared 404,
while `/experience-previews/september.webp` remains available to the chooser.
September becomes a production route only after its registry record is changed to
`published`. At that point it cannot reach production while any gift is a
fixture, lacks `approved:true`, or has stale media digests. Before release, the
sender replaces the exact cake description and bouquet description, final owned
or licensed JPEG sources, final reasons and personal messages, and sets every
record to `fixture:false` and `approved:true`. Regenerate derivatives and the
media manifest, then approve a reviewed staging artifact from a clean commit.

## September NFC handoff

Physical programming waits until September is `published` and has that final
reviewed HTTPS deployment. Only then program NTAG213-compatible NDEF tags with
these exact fixed, non-secret URLs:

```text
https://romantic-birthday-app.vercel.app/september/#gift=sweet
https://romantic-birthday-app.vercel.app/september/#gift=bloom
```

The first tag belongs to the lemon tiramisu cake and the second to the cream and
blush rose bouquet. Do not place a tag directly on metal or foil; use a laminated
or moisture-resistant paper hang tag for the cake, keep both tags reachable after
opening, and label their placement “Chạm phần trên iPhone vào đây”.

Device smoke requires at least one iPhone XS or later. With the screen on, hold
the top of the phone close to each tag, tap the system notification, and confirm
Safari opens the matching fragment. Test both discovery orders, screen-lock
recovery, and **Mở không dùng NFC**; manual opening must remain a complete
fallback. The website never requests NFC permission or reads raw NFC data.

The matching fragment is consumed locally and removed immediately with
`history.replaceState`; it is not sent to the server or included in referrers.
September uses no camera, microphone, Web NFC, or runtime request to a
third-party service.

The sole persisted NFC state is the anonymous record
`{v,foundGiftIds,expiresAt}`, retained for at most 24 hours; it has no other
fields. It contains no name, query, URL, photo, or referrer, expires and is
removed automatically, and the experience continues in memory if storage is
unavailable. Do not include personalized values in NFC URLs or release evidence.

Immediately after deploy and again after 30 minutes, smoke `/` and every
published route, plus the chooser image-error fallback. If September is still
draft, assert `/september/` and a personalized September URL return the shared
404, while `/experience-previews/september.webp` loads and its chooser card has
no link. If September is published, also smoke `/september/` and one personalized
September URL. Revert for non-2xx published routes, wrong canonical metadata, a
broken chooser, blocking runtime errors, or a reveal failure with no usable text
fallback. Never record personalization query values in release evidence.

Before sender approval, run the AT10 usability check with five new mobile users
who have not seen the design. At least four must explain the goal within 10
seconds; median puzzle completion must stay within 20–60 seconds; nobody may be
stuck longer than 90 seconds; and median beauty/satisfaction must be at least
4/5. If any threshold fails, revise and repeat with five different users. Store
only aggregate timing and ratings, never names or personalized URLs.

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
