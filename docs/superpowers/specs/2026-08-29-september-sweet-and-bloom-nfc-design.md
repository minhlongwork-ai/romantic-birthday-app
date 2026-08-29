# September — “Một chút ngọt, một chút hoa”

Status: Draft for final review  
Date: 2026-08-29

## 1. Summary

Redesign `/september/` around exactly two gifts:

- A lemon tiramisu cake.
- A cream and blush rose bouquet.

The experience keeps the existing mobile-first gift reveal, browser history,
accessibility, reduced-motion support, media fallback, and production release
gate. It removes the cosmetic gifts, moon phases, moon imagery, and the
three-ring orbit puzzle.

The new concept is **“Một chút ngọt, một chút hoa”**. The primary real-world
interaction uses two NFC tags attached to the physical gifts. The recipient can
tap either gift with an iPhone in any order, before or after opening the gifts.
After both gifts have been found, a two-ribbon bow puzzle leads to the final
message.

No sender interaction is required after delivery.

## 2. Goals

- Make the experience coherent around two real gifts rather than three
  cosmetic products.
- Work whether the recipient opens the website first or opens the gifts first.
- Let the recipient choose the discovery order.
- Add a physical interaction that does not reuse camera or candle-blowing
  mechanics.
- Use real, locally hosted demo photography with an explicit “Bản xem thử”
  label.
- Preserve privacy, accessibility, graceful fallback, and production safety.

## 3. Non-goals

- No backend, account, analytics, checkout, service worker, camera, microphone,
  object recognition, audio recording, or third-party runtime requests.
- No native iOS application and no Web NFC reader inside Safari.
- No requirement that the gifts remain wrapped when the website is opened.
- No rarity, random reward, score, failure state, or gift entitlement decided by
  the game.
- No deployment as part of this redesign.

## 4. Experience flow

### 4.1 Entry

The base URL remains `/september/` and continues to accept `to`, `from`, and
`age`. Only `to` and `from` are displayed. Personalization is normalized and
inserted as text. The URL is cleaned immediately after parsing.

The recipient may enter in any of three ways:

1. The main card or shared link opens `/september/`.
2. The cake NFC tag opens `/september/#gift=sweet`.
3. The bouquet NFC tag opens `/september/#gift=bloom`.

The fragment is consumed locally and removed with `history.replaceState`; it is
not sent to the server or included in referrers.

### 4.2 Intro

Primary copy:

- Title: “Một chút ngọt, một chút hoa — anh chọn riêng cho em.”
- Body: “Cả hai đều là của em. Em chỉ cần chọn món mình muốn mở trước.”
- CTA: “Bắt đầu”
- Demo badge: “Bản xem thử”

If a valid NFC fragment is present, the app acknowledges the gift immediately
and moves to its reveal without requiring the recipient to replay the intro.

### 4.3 Two-compartment gift box

The box has two equal compartments:

- `sweet`: “Một chút ngọt”
- `bloom`: “Một chút hoa”

Both gifts are guaranteed. The order changes only the reveal sequence.

Selecting an unopened compartment presents a concise NFC instruction and a
manual fallback. Selecting an opened compartment revisits its reveal
immediately.

### 4.4 NFC discovery

Each physical gift has a small NTAG213-compatible NDEF tag in its paper hang
tag:

- Cake tag URL: `/september/#gift=sweet`
- Bouquet tag URL: `/september/#gift=bloom`

On supported iPhones, the recipient holds the top of the phone close to the
tag, then taps the system notification to open Safari. The website itself does
not request NFC permission or read raw NFC data.

Placement constraints:

- Do not attach a tag directly to metal or foil.
- Put the cake tag in a laminated or moisture-resistant paper hang tag.
- Keep both tags reachable after the gifts have been opened.
- Print a small “Chạm phần trên iPhone vào đây” cue without exposing a QR code.

NFC is enhancement, not a gate. Every NFC prompt includes **“Mở không dùng
NFC”**, which performs the same reveal through an ordinary button.

### 4.5 Reveal

The reveal rhythm remains clue → silhouette → real image, gift name, reason,
and personal message. The gift is committed once when the product card becomes
visible. Revisit shows it immediately.

Cake content:

- Group: “Một chút ngọt”
- Gift: “Bánh tiramisu chanh”
- Clue: “Một vị ngọt có chút tươi”
- Message: “Anh chọn bánh tiramisu chanh vì vị vừa ngọt vừa tươi. Nhớ ăn khi
  còn mát nhé.”

Bouquet content:

- Group: “Một chút hoa”
- Gift: “Bó hồng kem và hồng phấn”
- Clue: “Một bó dịu dàng ở lại”
- Message: “Bó hoa này không cần chờ một dịp đặc biệt. Anh chỉ muốn em có hoa
  và vui thêm một chút.”

Demo records use real representative photos but remain `fixture:true` and
`approved:false`. Product names, variants, photos, and reasons must be replaced
and approved before production.

### 4.6 Bow puzzle

The puzzle becomes **“Thắt nơ cho món quà”**:

- Two satin ribbon rings: outer and inner.
- Eight 45-degree detents per ring.
- A fixed initial state and one exact solution.
- Pointer drag, rotate-left/right buttons, and ArrowLeft/ArrowRight controls.
- A hint after 20 seconds of visible-document activity.
- Skip remains available through a two-button confirmation dialog.
- No score, countdown pressure, attempt limit, or failure state.

The solved animation joins the two ribbons into one bow. Reduced motion removes
spin and interpolation, using opacity transitions no longer than 150 ms.

The puzzle is available after both gifts are discovered by NFC or manual
fallback. Solving and skipping both open the ending; only solving triggers the
bow flourish.

### 4.7 Ending

Final copy:

> “{{recipient}}, mong em thích hai món quà nhỏ này. {{sender}} chỉ muốn thấy
> em vui thôi.”

Personalization fallbacks remain natural when either name is missing. The
ending offers “Mở lại từ đầu”. Reset clears the experience state and NFC
progress after confirmation.

## 5. Visual direction

Retain the warm editorial studio direction:

- Ink brown, cocoa, warm taupe, ivory, dusty rose, and champagne.
- Brown silk background with mobile and desktop crops.
- Playfair Display for display type and Be Vietnam Pro for interface text.
- Real cake and bouquet photography stored in the repository.
- Satin ribbon, lemon-peel, and rose-petal motifs.

Remove all moon photos, lunar labels, silver orbits, and cosmetic silhouettes.
The two compartments must have equal size and visual weight. The intro CTA must
remain fully visible at 320×568 and 375×667.

## 6. Content model

```ts
type GiftId = "cake" | "bouquet";
type GroupId = "sweet" | "bloom";

interface SeptemberGift {
  id: GiftId;
  groupId: GroupId;
  groupLabel: string;
  clue: string;
  productAssetId: string;
  productName: string;
  variant: string;
  alt: string;
  reason: string;
  personalMessageKey: GiftId;
  fixture: boolean;
  approved: boolean;
}
```

The authoritative hand-written sources remain separated into copy, asset, and
gift-definition modules. Generated runtime content and manifests are produced
atomically by the existing generator pattern.

Production validation requires exactly `cake/sweet` and `bouquet/bloom`, valid
local media, `fixture:false`, and `approved:true`.

## 7. State and persistence

In-memory experience state:

```ts
{
  scene: "intro" | "box" | "reveal" | "game" | "ending";
  openedGiftIds: Set<"cake" | "bouquet">;
  openOrder: Array<"cake" | "bouquet">;
  activeGiftId: "cake" | "bouquet" | null;
  puzzleDetents: { outer: number; inner: number };
  completionMode: null | "solved" | "skipped";
}
```

NFC navigation needs a minimal same-origin progress record so two independent
tag navigations can be combined:

```ts
{
  v: 1;
  foundGiftIds: Array<"cake" | "bouquet">;
  expiresAt: number;
}
```

Rules:

- Store no name, query, URL, photo, referrer, or other personal data.
- Expire and remove the record after 24 hours.
- Reject unknown version, malformed data, unknown IDs, or future timestamps.
- Continue in memory if storage is unavailable or denied.
- Reset removes the record after confirmation.

Browser-history invariants remain unchanged: active reveal entries identify the
exact gift; Back/Forward never revoke an opened gift; impossible game or ending
entries recover to the nearest valid scene with `replaceState`.

## 8. Privacy, accessibility, and resilience

- Set `Referrer-Policy: no-referrer`.
- No runtime requests to NFC, image, font, analytics, or other third-party
  services.
- NFC URLs contain only a fixed non-secret fragment.
- Manual fallback is always visible and receives equal functional treatment.
- Scene headings receive visible focus; reveal close restores the associated
  compartment focus.
- All controls meet a 44×44 CSS-pixel target, keyboard access, and meaningful
  accessible names.
- Media failures retain silhouette, product text, and the complete journey.
- Puzzle cleanup remains idempotent and cannot trigger stale completion.

## 9. Media and release safety

Replace the three cosmetic media families with two locally hosted families:

- Lemon tiramisu cake.
- Cream and blush rose bouquet.

Generate AVIF, WebP, and JPEG in that order and refresh digest manifests. Remove
the obsolete cosmetic and moon outputs only after references and generated
manifests have moved to the new IDs.

The development and preview builds accept the two explicit demo fixtures.
Production validation fails before Vite/composite build until the sender
provides and approves:

- Exact cake and bouquet descriptions.
- Final owned or licensed JPEG sources.
- Final reasons and personal messages.
- `fixture:false` and `approved:true` records.
- A reviewed staging artifact from a clean commit.

## 10. Verification

Automated acceptance covers:

- Both reveal orders: cake → bouquet and bouquet → cake.
- Direct NFC fragments, repeated taps, malformed fragments, fragment cleanup,
  24-hour expiry, storage denial, and reset.
- Manual fallback parity with NFC discovery.
- Reveal timing, single commit, revisit, Back/Forward, reload, solve, and skip.
- Two-ring detents, dragging, buttons, keyboard, hint, cancellation, cleanup,
  and stale-navigation races.
- Real-photo AVIF/WebP/JPEG fallback, MIME, decode, dimensions, digest,
  provenance, and transfer budgets.
- Demo badges and production rejection.
- Accessibility, reduced motion, focus visibility, 200% zoom, and mobile CTA
  geometry.
- Regression coverage for `/`, `/birthday/`, `/august/`, `/september/`, direct
  refresh, metadata, and 404 behavior.

Physical-device smoke testing covers at least one iPhone XS-or-later device,
both programmed NFC tags, either discovery order, screen-lock recovery, tag
placement near packaging, and the manual fallback.

## 11. Decisions recorded

- Exactly two gifts replace all three cosmetics.
- The moon concept is removed.
- Theme: “Một chút ngọt, một chút hoa”.
- Gifts: lemon tiramisu cake and cream/blush rose bouquet.
- Tone: natural and gentle.
- Primary physical interaction: two NFC tags opened by iPhone.
- The interaction works before or after the physical gifts are opened.
- A two-ribbon bow puzzle follows both discoveries.
- NFC progress is the only new persisted data and expires after 24 hours.
- No deployment is included in this work.
