# September Sweet & Bloom NFC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace September’s three moon-phase cosmetic gifts with a lemon tiramisu cake, a cream/blush rose bouquet, order-independent iPhone NFC discovery, and a two-ribbon bow puzzle.

**Architecture:** Keep the existing vanilla Vite scene/state/history architecture, but replace the three-gift domain contract with `cake/sweet` and `bouquet/bloom`. Treat iPhone NFC as an OS-level deep-link enhancement: fixed hash fragments enter the existing reveal flow, while a minimal 24-hour same-origin progress record lets separate tag navigations combine. Preserve a button fallback, generated local media, deterministic validation, and the production fixture gate.

**Tech Stack:** Vanilla JavaScript ES modules, Vite 7.3.6, Node.js 20.19+, Sharp 0.34.5, Playwright 1.62.0, Node test runner, iPhone background NDEF URL reading.

**Spec:** `docs/superpowers/specs/2026-08-29-september-sweet-and-bloom-nfc-design.md`

## Global Constraints

- Route remains `/september/`; Birthday, August, chooser routing, direct refresh, and shared 404 behavior must not regress.
- Exactly two gifts: `cake/sweet` and `bouquet/bloom`; both are guaranteed and only their reveal order changes.
- Theme and UI copy use “Một chút ngọt, một chút hoa”; no moon imagery, moon copy, lunar phase fields, or cosmetic silhouettes remain at runtime.
- Demo content remains `fixture:true` and `approved:false`; production must fail before Vite/composite build.
- NFC uses fixed HTTPS NDEF URLs ending in `#gift=sweet` or `#gift=bloom`; there is no Web NFC API, native app, backend, camera, microphone, analytics, or third-party runtime request.
- The only persisted value is `{ v: 1, foundGiftIds, expiresAt }`; it contains no name, query, URL, photo, or referrer and expires after exactly `86_400_000` ms.
- NFC is never required: every unopened compartment exposes “Mở không dùng NFC”.
- Keep Playfair Display 600/700 and Be Vietnam Pro 400/500/600/700 from local `@fontsource/*@5.2.8` packages.
- Product rendering order remains AVIF → WebP → JPEG; each encoding is at most `307_200` bytes and product images are `800×800`.
- Initial September transfer stays at or below `512_000` bytes; no runtime request may target a third-party domain.
- All interactive targets are at least `44×44` CSS px; focus, keyboard, pointer, reduced motion, and image fallback behavior remain functional.
- Do not deploy in this implementation task. Physical NFC programming and device smoke are release gates after a reviewed HTTPS staging artifact exists.
- Preserve unrelated dirty/untracked work. Stage and commit only the exact files listed in each task.

## File Structure

### New files

- `apps/september/src/core/nfc-progress.mjs` — parse NFC fragments and safely read/write/clear the 24-hour anonymous progress record.
- `apps/september/tests/core-nfc-progress.test.mjs` — deterministic hash, expiry, malformed storage, denial, and reset tests.
- `apps/september/scripts/generate-product-media.mjs` — deterministic Sharp derivatives for cake, bouquet, and the 1200×630 preview.
- `apps/september/tests/product-media-generator.test.mjs` — generator dimensions, formats, determinism, and check-mode tests.
- `apps/september/tests/ui-theme-contract.test.mjs` — static contract that removes lunar/runtime cosmetic references and preserves local fonts.

### Existing files to modify

- `apps/september/src/content/copy.mjs` — all approved Sweet & Bloom copy.
- `apps/september/src/content/assets.mjs` — exact Pexels provenance for cake and bouquet; remove NASA runtime mapping.
- `apps/september/src/content/gift-definitions.mjs` — two authoritative demo gift records.
- `apps/september/src/content/gifts.mjs` — emit `groupId/groupLabel` instead of phase/emotion/shade fields.
- `apps/september/src/content/schema.mjs` — exact two-gift contract and release rejection.
- `apps/september/src/content/media-manifest.json` — two current product media families.
- `apps/september/src/core/session.mjs` — two IDs and optional persisted-open-order hydration.
- `apps/september/src/core/puzzle.mjs` — two ribbon rings, initial detents, solution, and hint order.
- `apps/september/src/main.js` — consume/clean NFC fragments, hydrate progress, persist commits, clear on reset, and update title.
- `apps/september/src/ui/scenes.js` — two compartments, NFC dialog/fallback, non-lunar seals, two-ring puzzle, and two messages.
- `apps/september/src/ui/puzzle-controller.js` — ribbon labels, selectors, reset/hint announcements, and existing cleanup guarantees.
- `apps/september/src/styles.css` — replace moon/orbit visuals with lemon, rose, satin ribbon, and bow visuals.
- `apps/september/scripts/generate-release-content.mjs` — schema v2/group fields/two assets.
- `apps/september/scripts/validate.mjs` — report two gifts and six encodings.
- `apps/september/package.json` — rename package and add product-media generate/check commands.
- September unit tests — replace three-gift/phase assertions with two-gift/group assertions.
- `tests/e2e/september.spec.js` — two reveal orders, NFC/manual parity, persistence/expiry/reset, bow puzzle, visual/accessibility, offline, and history coverage.
- `src/content/site.json` — Sweet & Bloom metadata.
- `portal/index.html` — chooser card title, description, alt text, and action.
- `README.md` and `docs/release-process.md` — new experience and NFC release instructions.
- `tests/unit/site-metadata.test.js`, `tests/unit/portal-contract.test.js`, and `tests/unit/vercel-build-gate.test.js` — updated public copy and two-fixture release behavior.

### Obsolete public outputs to remove after replacements validate

- `apps/september/public/images/cleanser.{avif,jpg,webp}`
- `apps/september/public/images/moisturizer.{avif,jpg,webp}`
- `apps/september/public/images/lipstick.{avif,jpg,webp}`
- `apps/september/public/images/source/phase-new.jpg`
- `apps/september/public/images/source/phase-waxing.jpg`
- `apps/september/public/images/source/phase-full.jpg`

---

### Task 1: Replace the content and validation domain with two gifts

**Files:**
- Modify: `apps/september/src/content/copy.mjs`
- Modify: `apps/september/src/content/gift-definitions.mjs`
- Modify: `apps/september/src/content/gifts.mjs`
- Modify: `apps/september/src/content/schema.mjs`
- Modify: `apps/september/tests/content-schema.test.mjs`

**Interfaces:**
- Produces: `SEPTEMBER_GIFTS` containing exactly `cake/sweet` then `bouquet/bloom`.
- Produces: `validateSeptemberContent(gifts, { release?: boolean }): string[]` and unchanged `orderedProductMedia(media)`.
- Consumed by: session, scenes, media generation, release generation, and every later test task.

- [ ] **Step 1: Replace the schema tests with the exact approved two-gift contract**

```js
test("development content contains the exact Sweet & Bloom gifts", () => {
  assert.deepEqual(
    SEPTEMBER_GIFTS.map(({ id, groupId, productName }) => ({ id, groupId, productName })),
    [
      { id: "cake", groupId: "sweet", productName: "Bánh tiramisu chanh — bản xem thử" },
      { id: "bouquet", groupId: "bloom", productName: "Bó hồng kem và hồng phấn — bản xem thử" },
    ],
  );
  assert.deepEqual(validateSeptemberContent(SEPTEMBER_GIFTS), []);
});

test("release rejects both demo fixtures", () => {
  const errors = validateSeptemberContent(SEPTEMBER_GIFTS, { release: true });
  assert.equal(errors.filter((error) => /approved:true/u.test(error)).length, 2);
  assert.equal(errors.filter((error) => /development fixture/u.test(error)).length, 2);
  assert.equal(errors.filter((error) => /placeholder product content/u.test(error)).length, 2);
});
```

- [ ] **Step 2: Run the focused tests and verify the old phase contract fails**

Run: `node --test apps/september/tests/content-schema.test.mjs`

Expected: FAIL because the current fixture contains three cosmetic IDs and phase fields.

- [ ] **Step 3: Replace copy and authoritative definitions**

Use these exact values in `copy.mjs`:

```js
export const SEPTEMBER_COPY = Object.freeze({
  kicker: "Một chút ngọt, một chút hoa · Bản xem thử",
  introTitle: "Một chút ngọt, một chút hoa — anh chọn riêng cho em.",
  introBody: "Cả hai đều là của em. Em chỉ cần chọn món mình muốn mở trước.",
  introCta: "Bắt đầu",
  boxTitle: "Em muốn tìm món nào trước?",
  boxBody: "Hai món quà, hai điều nhỏ. Thứ tự là do em chọn.",
  boxCompleteTitle: "Cả hai món đã ở đây.",
  boxCompleteBody: "Giờ mình thắt hai dải ruy-băng lại nhé.",
  boxCompleteCta: "Thắt nơ cho món quà",
  nfcOpen: "Chạm iPhone vào thẻ quà",
  nfcFallback: "Mở không dùng NFC",
  nfcStay: "Để sau",
  revealReturn: "Trở về hộp quà",
  imageError: "Ảnh món quà chưa tải được",
  gameTitle: "Thắt nơ cho món quà",
  gameInstruction: "Xoay hai dải ruy-băng để nối chúng thành một chiếc nơ hoàn chỉnh.",
  gameSkip: "Bỏ qua và xem lời nhắn",
  gameSolved: "Em thắt được rồi.",
  endingTitle: "Một chút ngọt. Một chút hoa.",
  endingSolvedBody: "Hai dải ruy-băng đã khép thành một chiếc nơ.",
  endingSkippedBody: "Không cần hoàn thành trò chơi để nhận đủ hai lời nhắn.",
  endingReplay: "Mở lại từ đầu",
  demoBadge: "Bản xem thử",
  wishes: Object.freeze({
    cake: "Anh chọn bánh tiramisu chanh vì vị vừa ngọt vừa tươi. Nhớ ăn khi còn mát nhé.",
    bouquet: "Bó hoa này không cần chờ một dịp đặc biệt. Anh chỉ muốn em có hoa và vui thêm một chút.",
  }),
  groupClues: Object.freeze({
    sweet: "Một vị ngọt có chút tươi",
    bloom: "Một bó dịu dàng ở lại",
  }),
});

export const SEPTEMBER_ENDING_TEMPLATE =
  "{{recipient}}, mong em thích hai món quà nhỏ này. {{sender}} chỉ muốn thấy em vui thôi.";
```

Define the two records in this order:

```js
[
  {
    id: "cake",
    groupId: "sweet",
    groupLabel: "Một chút ngọt",
    clue: SEPTEMBER_COPY.groupClues.sweet,
    productAssetId: "product-cake",
    productName: "Bánh tiramisu chanh — bản xem thử",
    variant: "Ảnh Pexels · bản xem thử",
    alt: "Bánh kem chanh nhiều lớp với kem tươi và lát chanh trong bản xem thử",
    personalMessageKey: "cake",
    fixture: true,
    approved: false,
  },
  {
    id: "bouquet",
    groupId: "bloom",
    groupLabel: "Một chút hoa",
    clue: SEPTEMBER_COPY.groupClues.bloom,
    productAssetId: "product-bouquet",
    productName: "Bó hồng kem và hồng phấn — bản xem thử",
    variant: "Ảnh Pexels · bản xem thử",
    alt: "Bó hồng màu kem và hồng phấn trong ánh sáng mềm của bản xem thử",
    personalMessageKey: "bouquet",
    fixture: true,
    approved: false,
  },
]
```

Use this shared reason for both records:

```js
const reason =
  "Ảnh và quà trong bản xem thử chỉ để minh họa; người tặng sẽ thay bằng món quà thật trước khi phát hành.";
```

- [ ] **Step 4: Replace phase validation with the exact group mapping**

```js
export const EXPECTED_GIFT_IDS = Object.freeze(["cake", "bouquet"]);
export const EXPECTED_GROUP_IDS = Object.freeze(["sweet", "bloom"]);

const EXPECTED_GIFT_GROUP_PAIRS = Object.freeze([
  "bouquet:bloom",
  "cake:sweet",
]);
```

Require exactly two gifts, exact approved group label/clue/message copy, complete product fields, one local media stem, boolean approval flags, and the existing release placeholder checks. Change diagnostics from “gift-to-phase” to “gift-to-group”.

- [ ] **Step 5: Run focused content tests**

Run: `node --test apps/september/tests/content-schema.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the domain contract**

```bash
git add apps/september/src/content/copy.mjs apps/september/src/content/gift-definitions.mjs apps/september/src/content/gifts.mjs apps/september/src/content/schema.mjs apps/september/tests/content-schema.test.mjs
git commit -m "feat: define September sweet and bloom gifts"
```

### Task 2: Add anonymous NFC progress and hydrate the two-gift session

**Files:**
- Create: `apps/september/src/core/nfc-progress.mjs`
- Create: `apps/september/tests/core-nfc-progress.test.mjs`
- Modify: `apps/september/src/core/session.mjs`
- Modify: `apps/september/tests/core-session.test.mjs`

**Interfaces:**
- Produces: `parseNfcGiftFragment(hash): "cake" | "bouquet" | null`.
- Produces: `readNfcProgress(storage, now?): GiftId[]`.
- Produces: `recordNfcGift(storage, giftId, currentOrder, now?): GiftId[]`.
- Produces: `clearNfcProgress(storage): void`.
- Produces: `createExperienceState({ openedGiftIds?: GiftId[] } = {}): ExperienceState`.
- Consumed by: `src/main.js` in Task 5.

- [ ] **Step 1: Write deterministic NFC progress tests**

```js
const NOW = 1_800_000_000_000;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("fixed NFC fragments map to exact gift IDs", () => {
  assert.equal(parseNfcGiftFragment("#gift=sweet"), "cake");
  assert.equal(parseNfcGiftFragment("#gift=bloom"), "bouquet");
  assert.equal(parseNfcGiftFragment("#gift=moon"), null);
  assert.equal(parseNfcGiftFragment("#gift=sweet&to=Minh"), null);
});

test("progress is unique, ordered, anonymous, and expires after 24 hours", () => {
  const storage = memoryStorage();
  const first = recordNfcGift(storage, "cake", [], NOW);
  const second = recordNfcGift(storage, "bouquet", first, NOW + 1_000);
  assert.deepEqual(second, ["cake", "bouquet"]);
  assert.deepEqual(readNfcProgress(storage, NOW + 86_399_999), ["cake", "bouquet"]);
  assert.deepEqual(readNfcProgress(storage, NOW + 86_400_001), []);
  assert.doesNotMatch(storage.getItem(NFC_PROGRESS_KEY) ?? "", /Minh|from|query|url/u);
});
```

Add cases for malformed JSON, unknown version, duplicate/unknown IDs, expiry more than one TTL in the future, storage methods throwing, and `clearNfcProgress` being idempotent.

- [ ] **Step 2: Run the new tests and verify the module is missing**

Run: `node --test apps/september/tests/core-nfc-progress.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the storage module with injected storage**

```js
import { GIFT_IDS } from "./session.mjs";

export const NFC_PROGRESS_KEY = "september:nfc-progress:v1";
export const NFC_PROGRESS_TTL_MS = 86_400_000;

const GROUP_TO_GIFT = Object.freeze({ sweet: "cake", bloom: "bouquet" });

export function parseNfcGiftFragment(hash) {
  const source = String(hash ?? "");
  if (!source.startsWith("#")) return null;
  const params = new URLSearchParams(source.slice(1));
  if ([...params.keys()].some((key) => key !== "gift")) return null;
  const values = params.getAll("gift");
  return values.length === 1 ? GROUP_TO_GIFT[values[0]] ?? null : null;
}

export function readNfcProgress(storage, now = Date.now()) {
  try {
    const parsed = JSON.parse(storage?.getItem(NFC_PROGRESS_KEY) ?? "null");
    const validIds = Array.isArray(parsed?.foundGiftIds)
      && new Set(parsed.foundGiftIds).size === parsed.foundGiftIds.length
      && parsed.foundGiftIds.every((id) => GIFT_IDS.includes(id));
    const validExpiry = Number.isSafeInteger(parsed?.expiresAt)
      && parsed.expiresAt > now
      && parsed.expiresAt <= now + NFC_PROGRESS_TTL_MS;
    if (parsed?.v !== 1 || !validIds || !validExpiry) {
      storage?.removeItem(NFC_PROGRESS_KEY);
      return [];
    }
    return [...parsed.foundGiftIds];
  } catch {
    try { storage?.removeItem(NFC_PROGRESS_KEY); } catch {}
    return [];
  }
}
```

Implement `recordNfcGift` by validating `giftId`, preserving unique order, writing only `v`, `foundGiftIds`, and `expiresAt`, and returning the order even when storage throws. Implement `clearNfcProgress` with a guarded `removeItem`.

- [ ] **Step 4: Hydrate session state from a validated order**

```js
export const GIFT_IDS = Object.freeze(["cake", "bouquet"]);

export function createExperienceState({ openedGiftIds = [] } = {}) {
  const safeOrder = openedGiftIds.filter(
    (giftId, index) => GIFT_IDS.includes(giftId) && openedGiftIds.indexOf(giftId) === index,
  );
  return {
    scene: "intro",
    openedGiftIds: new Set(safeOrder),
    openOrder: [...safeOrder],
    activeGiftId: null,
    puzzleDetents: { ...INITIAL_DETENTS },
    completionMode: null,
  };
}
```

Replace six reveal-order assertions with the two orders `cake → bouquet` and `bouquet → cake`. Keep history recovery tests for invalid gift IDs, early game/ending, exact reveal gift restoration, and completion mode.

- [ ] **Step 5: Run NFC and session tests**

Run: `node --test apps/september/tests/core-nfc-progress.test.mjs apps/september/tests/core-session.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit NFC core state**

```bash
git add apps/september/src/core/nfc-progress.mjs apps/september/src/core/session.mjs apps/september/tests/core-nfc-progress.test.mjs apps/september/tests/core-session.test.mjs
git commit -m "feat: add anonymous September NFC progress"
```

### Task 3: Convert the orbit puzzle to two satin ribbon rings

**Files:**
- Modify: `apps/september/src/core/puzzle.mjs`
- Modify: `apps/september/src/ui/puzzle-controller.js`
- Modify: `apps/september/tests/core-puzzle.test.mjs`

**Interfaces:**
- Produces: `RING_IDS = ["outer", "inner"]`.
- Produces: `INITIAL_DETENTS = { outer: 1, inner: 5 }`.
- Produces: `SOLUTION_DETENTS = { outer: 6, inner: 2 }`.
- Keeps signatures for `rotateDetent`, `shortestAngularDelta`, `snapAccumulatedDrag`, `isPuzzleSolved`, and `getPuzzleHint`.
- Consumed by: `mountGame` and `mountPuzzleController`.

- [ ] **Step 1: Change the puzzle contract tests first**

```js
test("the bow puzzle has two exact ribbon states", () => {
  assert.deepEqual(RING_IDS, ["outer", "inner"]);
  assert.deepEqual(INITIAL_DETENTS, { outer: 1, inner: 5 });
  assert.deepEqual(SOLUTION_DETENTS, { outer: 6, inner: 2 });
  assert.equal(isPuzzleSolved(SOLUTION_DETENTS), true);
  assert.equal(isPuzzleSolved({ outer: 6, inner: 1 }), false);
});

test("hint order is outer then inner", () => {
  assert.deepEqual(getPuzzleHint({ outer: 2, inner: 2 }), {
    ringId: "outer",
    direction: "clockwise",
    steps: 4,
  });
});
```

Keep the existing modulo, shortest-angle, ±22.5° tie, 8 px tap threshold, and cancellation tests unchanged.

- [ ] **Step 2: Run the focused puzzle test and verify it fails on three rings**

Run: `node --test apps/september/tests/core-puzzle.test.mjs`

Expected: FAIL on `RING_IDS`, initial detents, and solution detents.

- [ ] **Step 3: Implement the two-ring constants and controller language**

```js
export const RING_IDS = Object.freeze(["outer", "inner"]);
export const INITIAL_DETENTS = Object.freeze({ outer: 1, inner: 5 });
export const SOLUTION_DETENTS = Object.freeze({ outer: 6, inner: 2 });
```

Use these labels in `puzzle-controller.js`:

```js
const RING_LABELS = Object.freeze({
  outer: "Dải nơ ngoài",
  inner: "Dải nơ trong",
});

const HINT_LABELS = Object.freeze({
  outer: "dải nơ ngoài",
  inner: "dải nơ trong",
});
```

Change the puzzle root selector from `.orbit-puzzle` to `.ribbon-puzzle`; change the reset announcement to “Hai dải ruy-băng đã trở về vị trí ban đầu.” Preserve single-pointer capture, active-time hinting, cancellation restoration, disposed guards, and idempotent cleanup exactly.

- [ ] **Step 4: Run puzzle tests**

Run: `node --test apps/september/tests/core-puzzle.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the bow puzzle core**

```bash
git add apps/september/src/core/puzzle.mjs apps/september/src/ui/puzzle-controller.js apps/september/tests/core-puzzle.test.mjs
git commit -m "feat: replace orbit puzzle with ribbon bow"
```

### Task 4: Add real demo media and regenerate all two-gift artifacts

**Files:**
- Create: `apps/september/scripts/generate-product-media.mjs`
- Create: `apps/september/tests/product-media-generator.test.mjs`
- Create binary: `apps/september/src/assets/source/product-cake.jpeg`
- Create binary: `apps/september/src/assets/source/product-bouquet.jpeg`
- Create binary outputs: `apps/september/public/images/cake.{avif,jpg,webp}`
- Create binary outputs: `apps/september/public/images/bouquet.{avif,jpg,webp}`
- Modify binary outputs: `apps/september/public/images/preview.{avif,jpg,webp}`
- Modify: `apps/september/src/content/assets.mjs`
- Modify: `apps/september/scripts/generate-release-content.mjs`
- Modify: `apps/september/scripts/validate.mjs`
- Modify: `apps/september/src/content/media-manifest.json`
- Modify generated: `apps/september/src/generated/runtime-media.mjs`
- Modify generated: `apps/september/src/generated/release-content.json`
- Modify generated: `apps/september/src/generated/media-manifest.json`
- Modify generated: `apps/september/src/generated/font-manifest.json`
- Modify: `apps/september/tests/content-media.test.mjs`
- Modify: `apps/september/package.json`
- Delete the obsolete public outputs listed in the File Structure section.

**Interfaces:**
- Produces: `generateProductMedia({ check?: boolean }): Promise<void>`.
- Produces: cake/bouquet `800×800` AVIF/WebP/JPEG and preview `1200×630` AVIF/WebP/JPEG.
- Produces: schema version `2`, copy version `3`, and two media assets in generated manifests.
- Consumed by: `pictureForGift`, portal preview, source validation, composite build, and release validation.

- [ ] **Step 1: Write the generator and two-family media tests**

```js
test("the generated Sweet & Bloom product media is complete", async () => {
  for (const id of ["cake", "bouquet"]) {
    for (const extension of ["avif", "webp", "jpg"]) {
      const metadata = await sharp(path.join(publicDir, "images", `${id}.${extension}`)).metadata();
      assert.equal(metadata.width, 800);
      assert.equal(metadata.height, 800);
    }
  }
  const preview = await sharp(path.join(publicDir, "images", "preview.webp")).metadata();
  assert.equal(preview.width, 1200);
  assert.equal(preview.height, 630);
});

test("checked-in media is generator-fresh", async () => {
  await generateProductMedia({ check: true });
});
```

Update `content-media.test.mjs` to assert manifest keys `cake` and `bouquet`, six product encodings, identical 800×800 dimensions, digest freshness, MIME/decode failures, missing files, and the 307,200-byte cap.

- [ ] **Step 2: Run tests and verify missing assets/generator fail**

Run: `node --test apps/september/tests/product-media-generator.test.mjs apps/september/tests/content-media.test.mjs`

Expected: FAIL because the script and two image families do not exist.

- [ ] **Step 3: Download the two exact licensed source JPEGs**

```bash
curl -L --fail --silent --show-error "https://images.pexels.com/photos/27971019/pexels-photo-27971019.jpeg?cs=srgb&dl=pexels-beyza-555707524-27971019.jpg&fm=jpg" -o apps/september/src/assets/source/product-cake.jpeg
curl -L --fail --silent --show-error "https://images.pexels.com/photos/34735100/pexels-photo-34735100.jpeg?cs=srgb&dl=pexels-larissafarber-34735100.jpg&fm=jpg" -o apps/september/src/assets/source/product-bouquet.jpeg
```

Record provenance in `assets.mjs`:

```js
cake: Object.freeze({
  assetId: "product-cake",
  sourcePath: "src/assets/source/product-cake.jpeg",
  pageUrl: "https://www.pexels.com/photo/a-person-is-cutting-up-a-cake-with-cream-27971019/",
  sourceUrl: "https://images.pexels.com/photos/27971019/pexels-photo-27971019.jpeg",
  creator: "Beyza",
  licenseUrl: "https://www.pexels.com/license/",
}),
bouquet: Object.freeze({
  assetId: "product-bouquet",
  sourcePath: "src/assets/source/product-bouquet.jpeg",
  pageUrl: "https://www.pexels.com/photo/elegant-bouquets-of-blush-pink-and-cream-roses-34735100/",
  sourceUrl: "https://images.pexels.com/photos/34735100/pexels-photo-34735100.jpeg",
  creator: "Lara",
  licenseUrl: "https://www.pexels.com/license/",
}),
```

- [ ] **Step 4: Implement deterministic Sharp generation**

For each source, call `rotate()` then `resize(800, 800, { fit: "cover", position: "attention" })`; encode AVIF quality 50, WebP quality 76, and progressive JPEG quality 82. Generate the preview from the existing warm-silk source at 1200×630, darken it, and composite 430×430 cake and bouquet crops at `{ left: 95, top: 100 }` and `{ left: 675, top: 100 }`. Encode the preview with the same three formats.

Implement `--check` by generating into a `mkdtemp` directory, SHA-256 comparing each of the nine outputs with `public/images`, and deleting the temporary directory in `finally`. Reject all CLI arguments except `--check`.

Add scripts:

```json
{
  "generate:media": "node scripts/generate-product-media.mjs",
  "check:media": "node scripts/generate-product-media.mjs --check"
}
```

- [ ] **Step 5: Emit group-based release artifacts and exact validator counts**

In `generate-release-content.mjs`, replace phase/emotion/shade output with:

```js
gifts.push({
  id: gift.id,
  groupId: gift.groupId,
  groupLabel: gift.groupLabel,
  clue: gift.clue,
  productName: gift.productName,
  variant: gift.variant,
  reason: gift.reason,
  personalMessage: gift.personalMessage,
  approved: gift.approved,
  fixture: gift.fixture === true,
  media: {
    assetId: gift.productAssetId,
    avifSrc: gift.media.avifSrc,
    webpSrc: gift.media.webpSrc,
    jpegSrc: gift.media.jpegSrc,
    alt: gift.media.alt,
  },
});
```

Write `schemaVersion: 2`, `copyVersion: 3`, and derive provenance `sourcePath`
from `SEPTEMBER_ASSET_SOURCES.products[gift.id].sourcePath`. In `validate.mjs`,
build the success message from `SEPTEMBER_GIFTS.length` and
`SEPTEMBER_GIFTS.length * 3`, producing exactly “2 gifts and 6 product
encodings checked.”

- [ ] **Step 6: Generate media and canonical manifests**

Run:

```bash
npm --prefix apps/september run generate:media
node apps/september/scripts/generate-media-manifest.mjs
node apps/september/scripts/generate-release-content.mjs
```

Expected: six product encodings, three preview encodings, a two-image content manifest, and four fresh generated artifacts.

- [ ] **Step 7: Remove only the obsolete public runtime outputs**

After verifying all new files decode, remove the 12 exact obsolete public files listed under “Obsolete public outputs”. Keep source files outside `public/` until the final clean-up review so no unrelated untracked data is lost.

- [ ] **Step 8: Run media, content, and CLI validation**

Run:

```bash
node --test apps/september/tests/product-media-generator.test.mjs apps/september/tests/content-media.test.mjs apps/september/tests/content-schema.test.mjs apps/september/tests/content-cli.test.mjs
npm --prefix apps/september run check:media
npm --prefix apps/september run check:content
npm --prefix apps/september run validate
```

Expected: PASS and development validator reports `2 gifts and 6 product encodings checked`.

- [ ] **Step 9: Commit real demo media and generated artifacts**

```bash
git add apps/september/scripts/generate-product-media.mjs apps/september/tests/product-media-generator.test.mjs apps/september/src/assets/source/product-cake.jpeg apps/september/src/assets/source/product-bouquet.jpeg apps/september/public/images apps/september/src/content/assets.mjs apps/september/src/content/media-manifest.json apps/september/src/generated apps/september/scripts/generate-release-content.mjs apps/september/scripts/validate.mjs apps/september/tests/content-media.test.mjs apps/september/package.json
git commit -m "feat: add September cake and bouquet media"
```

### Task 5: Integrate NFC deep links, manual fallback, and two-gift scenes

**Files:**
- Modify: `apps/september/src/main.js`
- Modify: `apps/september/src/ui/scenes.js`
- Modify: `tests/e2e/september.spec.js`

**Interfaces:**
- Consumes: Task 1 gifts/copy, Task 2 NFC progress, and Task 3 puzzle constants/controller.
- Produces: exact scene flow `intro → box → reveal ×2 → game → ending`.
- Produces: an NFC instruction dialog whose manual action calls `openGift(gift.id)`.
- Produces: direct `#gift=sweet|bloom` reveal with immediate fragment cleanup.

- [ ] **Step 1: Add failing browser tests for direct NFC and manual parity**

```js
test("an NFC sweet fragment opens cake and is cleaned immediately", async ({ page }) => {
  await page.goto("/september/#gift=sweet");
  await expect(page).toHaveURL(/\/september\/$/u);
  await expect(page.locator('section[data-scene="reveal"][data-gift-id="cake"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bánh tiramisu chanh — bản xem thử" })).toBeVisible();
});

test("manual fallback opens the same bouquet reveal", async ({ page }) => {
  await enterBox(page);
  await page.getByRole("button", { name: "Mở ngăn Một chút hoa" }).click();
  await expect(page.getByRole("dialog", { name: "Chạm iPhone vào thẻ quà" })).toBeVisible();
  await page.getByRole("button", { name: "Mở không dùng NFC" }).click();
  await expect(page.locator('section[data-gift-id="bouquet"]')).toBeVisible();
});
```

Add tests for `#gift=bloom`, malformed fragments returning to intro, first direct tag followed by the other direct tag, a repeated tag, storage denial, expiry, and reset clearing progress.

- [ ] **Step 2: Run the two new tests and verify old intro/phase behavior fails**

Run: `npx playwright test tests/e2e/september.spec.js --project=desktop-chrome --grep "NFC sweet|manual fallback"`

Expected: FAIL because the current app starts at the moon intro and has no NFC dialog.

- [ ] **Step 3: Consume the fragment before the first history entry**

In `main.js`:

```js
const personalization = parsePersonalization(window.location.search);
const nfcGiftId = parseNfcGiftFragment(window.location.hash);
const cleanUrl = window.location.pathname;
const persistedOrder = readNfcProgress(window.localStorage);
let state = createExperienceState({ openedGiftIds: persistedOrder });

if (nfcGiftId) {
  state = { ...state, scene: "reveal", activeGiftId: nfcGiftId };
}
```

On `commitGift`, call `recordNfcGift(window.localStorage, giftId, state.openOrder)` after the immutable commit. On `restart`, call `clearNfcProgress(window.localStorage)` before replacing state. Keep all storage calls safe through Task 2’s injected guards.

Change `updateTitle()` to `Một chút ngọt, một chút hoa`. Initialize history with `replaceHistory(state.scene)` rather than always forcing intro.

An NFC URL intentionally contains no personal names. When a tag opens outside
an existing personalized visit, use the approved `em/anh` fallback; never add
`to` or `from` to the tag URL or persistence record. Add an E2E assertion for
that fallback alongside the existing personalized base-URL test.

- [ ] **Step 4: Replace moon helpers with two gift seals and an NFC dialog**

Replace `PHASE_IMAGES/createMoonSeal` with `createGiftSeal(gift)` that emits a decorative span using `gift.groupId`. Replace every `phaseId/phaseLabel/emotionLabel` read with `groupId/groupLabel/clue`.

The unopened compartment click opens an accessible dialog containing:

```text
Title: Chạm iPhone vào thẻ quà
Body: Đưa phần trên của iPhone lại gần thẻ “Một chút ngọt” hoặc “Một chút hoa”, rồi mở thông báo hiện ra.
Primary fallback: Mở không dùng NFC
Secondary: Để sau
```

The dialog restores focus to its compartment when dismissed. An opened compartment bypasses the dialog and revisits immediately.

- [ ] **Step 5: Render two ribbon rings and two ending messages**

In `createRingSvg`, use radii `[116, 76]`, role `slider`, labels “Dải nơ ngoài” and “Dải nơ trong”, and the existing 0–7 ARIA values. Rename DOM classes:

```text
orbit-puzzle → ribbon-puzzle
orbit-ring → ribbon-ring
button-orbit → button-ribbon
puzzle-moon-core → bow-core
constellation-flourish → bow-flourish
message-phases/message-phase → gift-messages/gift-message
```

The ending must iterate exactly two gifts and construct the final sentence with text nodes and a `<strong>` sender node; do not use `innerHTML`. “Mở lại từ đầu” opens a confirmation dialog with “Mở lại” and “Ở lại”; only the confirmed branch calls `restart()` and clears NFC progress, and dismissing restores focus to the replay button.

- [ ] **Step 6: Run focused NFC and reveal E2E**

Run: `npx playwright test tests/e2e/september.spec.js --project=desktop-chrome --grep "NFC|manual|reveal commits|focus"`

Expected: PASS.

- [ ] **Step 7: Commit the two-gift scene flow**

```bash
git add apps/september/src/main.js apps/september/src/ui/scenes.js tests/e2e/september.spec.js
git commit -m "feat: connect September NFC gift reveals"
```

### Task 6: Replace lunar styling with warm cake, rose, and satin visuals

**Files:**
- Create: `apps/september/tests/ui-theme-contract.test.mjs`
- Modify: `apps/september/src/styles.css`
- Modify: `tests/e2e/september.spec.js`

**Interfaces:**
- Consumes: Task 5 class names and semantic DOM.
- Produces: mobile-first two-compartment studio layout, lemon/rose seals, cake/bouquet silhouettes, two satin rings, bow core/flourish, and no lunar runtime reference.

- [ ] **Step 1: Add a static no-moon UI contract**

```js
test("September runtime UI contains no lunar or cosmetic references", async () => {
  const source = await Promise.all([
    readFile(path.join(appRoot, "src", "ui", "scenes.js"), "utf8"),
    readFile(path.join(appRoot, "src", "styles.css"), "utf8"),
    readFile(path.join(appRoot, "src", "content", "copy.mjs"), "utf8"),
  ]).then((parts) => parts.join("\n"));
  assert.doesNotMatch(source, /Ba Pha Trăng|phase-(?:new|waxing|full)|moon-seal|ambient-moon|cleanser|moisturizer|lipstick/u);
  assert.match(source, /ribbon-puzzle/u);
  assert.match(source, /fallback-silhouette-cake/u);
  assert.match(source, /fallback-silhouette-bouquet/u);
});
```

- [ ] **Step 2: Run the contract and verify lunar CSS fails it**

Run: `node --test apps/september/tests/ui-theme-contract.test.mjs`

Expected: FAIL on current moon/orbit selectors and copy.

- [ ] **Step 3: Implement the visual replacement**

Keep the existing palette, silk background, safe-area spacing, `[hidden]` override, 45 px button minimum, and focus outlines. Replace the visual system as follows:

- `.intro-gifts`: two equal 7.5rem seals on a compact satin tray.
- `.gift-seal-sweet`: lemon-slice radial gradient using ivory, champagne, and muted yellow.
- `.gift-seal-bloom`: layered rose-petal pseudo-elements using dusty rose, cream, and cocoa shadows.
- `.blind-box`: exactly two equal columns at all tested widths; gap no smaller than `0.75rem`.
- `.gift-silhouette-cake`: tiered cream rectangle with lemon-disc pseudo-element.
- `.gift-silhouette-bouquet`: tapered paper wrap with three rose-disc pseudo-elements.
- `.ribbon-ring`: satin stroke with champagne/dusty-rose alternation; preserve 44 px effective hit target and `touch-action:none` only on `.ribbon-puzzle`.
- `.bow-core`: two loops and two tails made from pseudo-elements; no bitmap moon.
- `.bow-flourish`: opacity/scale only and removed under reduced motion.

Remove the obsolete lunar keyframes and all `url(...phase-*.jpg)` declarations.

- [ ] **Step 4: Add mobile and reduced-motion assertions**

At 320×568 and 375×667 assert:

```js
const ctaBox = await page.getByRole("button", { name: "Bắt đầu" }).boundingBox();
expect(ctaBox.y + ctaBox.height).toBeLessThanOrEqual(viewport.height);
expect(ctaBox.height).toBeGreaterThanOrEqual(44);
await expect(page.locator(".compartment")).toHaveCount(2);
```

Keep heading-in-viewport, no horizontal overflow, 200% zoom, reduced-motion transition duration, and pointer target checks.

- [ ] **Step 5: Run UI contract and targeted browser checks**

Run:

```bash
node --test apps/september/tests/ui-theme-contract.test.mjs
npx playwright test tests/e2e/september.spec.js --project=desktop-chrome --grep "mobile|reduced motion|target"
```

Expected: PASS.

- [ ] **Step 6: Commit the Sweet & Bloom art direction**

```bash
git add apps/september/src/styles.css apps/september/tests/ui-theme-contract.test.mjs tests/e2e/september.spec.js
git commit -m "style: redesign September for cake and flowers"
```

### Task 7: Update public metadata, chooser copy, package identity, and release documentation

**Files:**
- Modify: `src/content/site.json`
- Modify: `portal/index.html`
- Modify: `apps/september/package.json`
- Modify: `README.md`
- Modify: `docs/release-process.md`
- Modify: `tests/unit/site-metadata.test.js`
- Modify: `tests/unit/portal-contract.test.js`
- Modify: `tests/unit/vercel-build-gate.test.js`

**Interfaces:**
- Produces: canonical metadata and chooser copy for the new experience while preserving `/september/` and `/september/images/preview.webp`.
- Preserves: `build:vercel` environment-aware production gate and development fixture preview build.

- [ ] **Step 1: Change public-contract tests first**

```js
assert.equal(september.title, "Một chút ngọt, một chút hoa");
assert.match(portalHtml, /Bánh tiramisu chanh và bó hồng kem/);
assert.match(portalHtml, /Hộp quà hai món/);
assert.doesNotMatch(portalHtml, /Ba Pha Trăng|bộ ba mỹ phẩm|ba vầng trăng/u);
```

Keep the exact `/september/` route, preview URL, `aria-describedby`, and query allowlist assertions.

- [ ] **Step 2: Run public-contract tests and verify old metadata fails**

Run: `node --test tests/unit/site-metadata.test.js tests/unit/portal-contract.test.js tests/unit/vercel-build-gate.test.js`

Expected: FAIL on the old title and chooser copy.

- [ ] **Step 3: Apply the exact metadata and chooser copy**

Use this page metadata:

```json
{
  "title": "Một chút ngọt, một chút hoa",
  "description": "Hai món quà nhỏ — bánh tiramisu chanh và một bó hoa — được chuẩn bị riêng cho em.",
  "ogTitle": "Một chút ngọt, một chút hoa",
  "ogDescription": "Chạm vào hai món quà theo thứ tự em chọn và thắt chiếc nơ cuối cùng.",
  "ogImage": "/september/images/preview.webp"
}
```

Use this chooser copy:

```text
Alt: Bánh kem chanh và bó hồng kem hồng phấn trên nền lụa nâu ấm
Fallback: Một chút ngọt, một chút hoa đang chờ em
Kind: Hộp quà hai món
Title: Một chút ngọt, một chút hoa
Description: Chạm vào bánh và hoa theo thứ tự em chọn, rồi thắt chiếc nơ cuối cùng.
Action: Mở hộp quà tháng Chín
```

Rename the app package to `september-sweet-and-bloom` without changing versions or dependencies.

- [ ] **Step 4: Update release documentation with exact NFC constraints**

Document NTAG213 NDEF HTTPS URLs, iPhone XS-or-later background reading, top-of-phone placement, screen-on requirement, metal/foil avoidance, moisture-resistant cake tag, manual fallback, 24-hour anonymous progress, and the fact that physical programming waits for the final reviewed HTTPS deployment. Replace lipstick/capacity release inputs with exact cake description, bouquet description, final owned/licensed JPEGs, reasons, approval flags, and staging approval.

- [ ] **Step 5: Run unit contracts and source validation**

Run:

```bash
node --test tests/unit/site-metadata.test.js tests/unit/portal-contract.test.js tests/unit/vercel-build-gate.test.js
npm run validate
```

Expected: PASS.

- [ ] **Step 6: Commit public integration and docs**

```bash
git add src/content/site.json portal/index.html apps/september/package.json README.md docs/release-process.md tests/unit/site-metadata.test.js tests/unit/portal-contract.test.js tests/unit/vercel-build-gate.test.js
git commit -m "docs: integrate September sweet and bloom experience"
```

### Task 8: Complete regression coverage and verify the non-release artifact

**Files:**
- Modify: `tests/e2e/september.spec.js`
- Modify: `apps/september/tests/content-cli.test.mjs`
- Modify: `tests/unit/composite-build.test.js`
- Modify: `tests/unit/vercel-build-gate.test.js`

**Interfaces:**
- Consumes: every preceding task.
- Produces: final automated acceptance evidence; does not deploy or program physical tags.

- [ ] **Step 1: Finish the two-order and bow-puzzle E2E matrix**

Define:

```js
const GIFTS = [
  { id: "cake", group: "Một chút ngọt", product: "Bánh tiramisu chanh — bản xem thử" },
  { id: "bouquet", group: "Một chút hoa", product: "Bó hồng kem và hồng phấn — bản xem thử" },
];
```

Cover both permutations, commit-once, revisit, exact history gift, game only after the second gift, solve/skip, reload from valid 24-hour progress, expired progress, reset, malformed history recovery, image failure, both offline cases, focus restoration, pointer cancellation, lost capture, blur, cleanup, and stale completion navigation.

Solve with buttons using the exact delta from initial to solution:

```js
for (const ring of ["dải nơ ngoài", "dải nơ trong"]) {
  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: `Xoay ${ring} sang trái` }).click();
  }
}
```

- [ ] **Step 2: Update release-gate assertions for two fixtures**

The development CLI must exit 0 and report two gifts/six encodings. The release CLI and `VERCEL_ENV=production npm run build:vercel` must exit non-zero before Vite output, with exactly two approval errors, two fixture errors, and two placeholder errors. `VERCEL_ENV=preview npm run build:vercel` and `npm run build` must succeed.

- [ ] **Step 3: Run all September unit tests**

Run: `npm run test:september`

Expected: PASS.

- [ ] **Step 4: Run shared unit and composite checks**

Run:

```bash
node --test tests/unit/site-config.test.js tests/unit/site-metadata.test.js tests/unit/portal-contract.test.js tests/unit/composite-build.test.js tests/unit/build-validator.test.js tests/unit/vercel-build-gate.test.js
npm run build
npm run validate:dist
```

Expected: PASS; build manifest contains no obsolete cosmetic or phase image output and has zero external runtime URLs.

- [ ] **Step 5: Run targeted Chromium and the full browser matrix**

Run:

```bash
npx playwright test tests/e2e/september.spec.js --project=desktop-chrome
npm run test:e2e:run
```

Expected: September targeted suite PASS; full Chromium/Firefox/WebKit/iPhone matrix PASS for chooser, Birthday, August, September, direct route, metadata, and 404.

- [ ] **Step 6: Verify production remains intentionally blocked**

Run:

```bash
npm run validate:september:release
VERCEL_ENV=production npm run build:vercel
```

Expected: both exit non-zero because the two demo gifts remain `fixture:true` and `approved:false`; no Vite/composite build output appears after the production gate starts.

- [ ] **Step 7: Inspect the final diff without touching unrelated work**

Run:

```bash
git diff --check
git status --short
git diff -- apps/september src/content/site.json portal/index.html README.md docs/release-process.md tests/e2e/september.spec.js tests/unit
```

Expected: no whitespace errors; unrelated pre-existing dirty paths remain unchanged.

- [ ] **Step 8: Commit final regression coverage**

```bash
git add tests/e2e/september.spec.js apps/september/tests/content-cli.test.mjs tests/unit/composite-build.test.js tests/unit/vercel-build-gate.test.js
git commit -m "test: verify September NFC gift journey"
```

## Post-implementation release gate — not executed in this no-deploy task

After a clean, reviewed HTTPS staging deployment exists, program two NTAG213
tags with the final absolute URLs ending in `#gift=sweet` and `#gift=bloom`.
Test both orders on a physical iPhone XS or later with the screen on, after one
unlock following reboot, with the cake tag mounted away from foil and protected
from moisture. Confirm the iOS notification opens the intended reveal, the
fragment disappears, the second tag unlocks the bow puzzle, manual fallback
works, and reset clears the 24-hour progress. Record only device class, iOS
version, deployment SHA, tag order, and pass/fail; never record personalization
values.
