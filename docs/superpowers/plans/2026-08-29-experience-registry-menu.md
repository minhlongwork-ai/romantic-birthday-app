# Experience Registry Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay menu và orchestration hardcode bằng một registry trung tâm để mỗi thiệp hàng tháng tự xuất hiện đúng năm/tháng, được build đúng môi trường và vẫn giữ trải nghiệm gần gũi, không lộ trạng thái kỹ thuật.

**Architecture:** `src/content/experiences.json` là nguồn duy nhất cho catalog, routes, metadata, share targets, validation commands và composite build. Vite render catalog thành HTML tại build-time; development/preview build mọi route, production chỉ build route published nhưng vẫn xuất preview chooser của mọi thiệp.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node.js ESM, Vite 7, Node test runner, Playwright, existing composite build and Vercel static deployment.

**Spec:** `docs/superpowers/specs/2026-08-29-experience-registry-menu-design.md`

## Global Constraints

- Registry trung tâm là nguồn duy nhất; không tự quét thư mục và không giữ route/metadata arrays song song.
- Ba record đầu tiên thuộc năm 2026 và có thứ tự Birthday tháng 5 → August tháng 8 → September tháng 9.
- `draft` và `published` chỉ là logic nội bộ; UI không hiển thị badge, status text hoặc thuật ngữ kỹ thuật.
- Published card là link thật; draft card vẫn có ảnh/copy nhưng không có link, CTA giả hoặc tab stop.
- Development và preview build mọi route; production chỉ build published routes.
- Production vẫn copy chooser preview của draft dưới `/experience-previews/`, nhưng không copy runtime namespace của draft.
- Direct URL draft hoạt động trong development/preview và trả shared 404 trong production.
- Chỉ `to`, `from`, `age` được chuyển tiếp từ chooser; không lưu query trong registry, manifest hoặc logs.
- Không đổi nội dung hoặc interaction bên trong Birthday, August và September.
- Không thêm backend, CMS, analytics, storage hoặc runtime request tới bên thứ ba.
- Không deploy trong plan này.
- Working tree đang có thay đổi dirty/untracked của người dùng; không reset, checkout hoặc ghi đè file ngoài phạm vi task.

---

### Task 1: Tạo authoritative experience registry và validator

**Files:**
- Create: `src/content/experiences.json`
- Create: `scripts/experience-registry.mjs`
- Create: `tests/unit/experience-registry.test.js`

**Interfaces:**
- Produces: `loadExperienceRegistry(options) -> Promise<ReadonlyArray<Experience>>`
- Produces: `validateExperienceRegistry(records, options) -> Promise<string[]>`
- Produces: `groupExperiencesByYear(records) -> Array<{ year: number, experiences: Experience[] }>`
- Produces: `selectBuildExperiences(records, environment) -> Experience[]`
- Environment values: `development | preview | production`

- [ ] **Step 1: Write failing ordering and environment-selection tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  groupExperiencesByYear,
  loadExperienceRegistry,
  selectBuildExperiences,
} from '../../scripts/experience-registry.mjs';

test('2026 catalog is ordered May, August, September', async () => {
  const records = await loadExperienceRegistry();
  assert.deepEqual(records.map(({ id }) => id), ['birthday', 'august', 'september']);
  assert.deepEqual(records.map(({ month }) => month), [5, 8, 9]);
  assert.deepEqual(groupExperiencesByYear(records).map(({ year }) => year), [2026]);
});

test('production selects only published records', async () => {
  const records = await loadExperienceRegistry();
  assert.deepEqual(
    selectBuildExperiences(records, 'production').map(({ id }) => id),
    ['birthday', 'august'],
  );
  assert.deepEqual(
    selectBuildExperiences(records, 'preview').map(({ id }) => id),
    ['birthday', 'august', 'september'],
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/unit/experience-registry.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/experience-registry.mjs`.

- [ ] **Step 3: Add the exact three migration records**

Use these identity/build values in `experiences.json`:

| id | year/month | status | route | config | destination |
|---|---:|---|---|---|---|
| birthday | 2026/05 | published | `/birthday/` | `vite.config.js` | `birthday` |
| august | 2026/08 | published | `/august/` | `apps/august/vite.config.js` | `august` |
| september | 2026/09 | draft | `/september/` | `apps/september/vite.config.js` | `september` |

Set preview outputs to `/experience-previews/birthday.webp`, `/experience-previews/august.webp`, and `/experience-previews/september.webp`. Copy current menu copy and page metadata exactly; do not invent visible draft wording.

Define build hooks in the records:

```json
{
  "validation": {
    "development": ["apps/september/scripts/validate.mjs"],
    "release": ["apps/september/scripts/validate.mjs", "--release"]
  },
  "postBuild": [],
  "copies": []
}
```

Birthday owns `scripts/validate-gift.mjs` plus the service-worker finalizer using `{stagingDir}`. August owns `apps/august/scripts/validate.mjs` and its existing public-directory copy. September owns its development/release validator and no post-build hook.

Use these exact hook records:

```json
{
  "birthday": {
    "validation": {
      "development": ["scripts/validate-gift.mjs"],
      "release": ["scripts/validate-gift.mjs"]
    },
    "postBuild": [
      { "script": "scripts/finalize-service-worker.mjs", "args": ["{stagingDir}"] }
    ],
    "copies": []
  },
  "august": {
    "validation": {
      "development": ["apps/august/scripts/validate.mjs"],
      "release": ["apps/august/scripts/validate.mjs"]
    },
    "postBuild": [],
    "copies": [
      { "mode": "tree", "source": "apps/august/public", "destination": "august/public" }
    ]
  },
  "september": {
    "validation": {
      "development": ["apps/september/scripts/validate.mjs"],
      "release": ["apps/september/scripts/validate.mjs", "--release"]
    },
    "postBuild": [],
    "copies": []
  }
}
```

- [ ] **Step 4: Implement strict validation and stable sorting**

```js
export async function loadExperienceRegistry({
  registryUrl = new URL('../src/content/experiences.json', import.meta.url),
  rootDir = DEFAULT_ROOT,
} = {}) {
  const records = JSON.parse(await readFile(registryUrl, 'utf8'));
  const errors = await validateExperienceRegistry(records, { rootDir });
  if (errors.length) {
    throw new Error(`Invalid experience registry:\n${errors.map(error => `- ${error}`).join('\n')}`);
  }
  return Object.freeze(records.map(normalizeExperience).sort(compareExperiences));
}

export function selectBuildExperiences(records, environment) {
  if (!['development', 'preview', 'production'].includes(environment)) {
    throw new TypeError(`Unknown build environment: ${environment}`);
  }
  return environment === 'production'
    ? records.filter(record => record.status === 'published')
    : [...records];
}
```

Validation must reject duplicate `id`, `(year, month)`, `route`, `destination`, and `preview.publicPath`; unsafe paths; invalid status; missing source/config/scripts; non-positive preview dimensions; copy targets escaping `dist`; and hook argv containing non-string values.

- [ ] **Step 5: Add negative schema/path tests**

Cover duplicate month, external route, `../` config, duplicate preview output, invalid status, missing source image, and a release validator whose script does not exist. Use injected temporary records and assert error strings include both the record ID and field path.

- [ ] **Step 6: Run focused tests and commit**

Run: `node --test tests/unit/experience-registry.test.js`

Expected: PASS.

```bash
git add src/content/experiences.json scripts/experience-registry.mjs tests/unit/experience-registry.test.js
git commit -m "feat: add monthly experience registry"
```

---

### Task 2: Render the human-centered timeline catalog

**Files:**
- Create: `portal/experience-catalog.mjs`
- Create: `tests/unit/experience-catalog.test.js`
- Modify: `portal/index.html`
- Modify: `portal/portal.css`

**Interfaces:**
- Consumes: normalized records from `loadExperienceRegistry()`
- Produces: `renderExperienceCatalog(records) -> string`
- Produces: `formatVietnameseMonth(month) -> string`

- [ ] **Step 1: Write failing renderer tests**

```js
test('catalog groups by year and keeps chronological month order', async () => {
  const records = await loadExperienceRegistry();
  const html = renderExperienceCatalog(records);
  assert.ok(html.indexOf('Tháng Năm') < html.indexOf('Tháng Tám'));
  assert.ok(html.indexOf('Tháng Tám') < html.indexOf('Tháng Chín'));
  assert.equal((html.match(/<h2[^>]*>2026<\/h2>/g) || []).length, 1);
});

test('draft content has no visible status or interaction', async () => {
  const html = renderExperienceCatalog(await loadExperienceRegistry());
  const september = html.slice(html.indexOf('gift-card-september'));
  assert.doesNotMatch(september, /href="\/september\/"|data-project-link/);
  assert.doesNotMatch(september, /draft|published|Đang hoàn thiện|trạng thái/ui);
  assert.match(september, /aria-disabled="true"/);
  assert.match(september, /class="sr-only"/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/unit/experience-catalog.test.js`

Expected: FAIL because `portal/experience-catalog.mjs` does not exist.

- [ ] **Step 3: Implement escaped HTML rendering**

```js
export function renderExperienceCatalog(records) {
  return groupExperiencesByYear(records).map(({ year, experiences }) => `
    <section class="experience-year" aria-labelledby="experience-year-${year}">
      <h2 id="experience-year-${year}" class="experience-year-title">${year}</h2>
      <div class="gift-options">
        ${experiences.map(renderExperienceCard).join('')}
      </div>
    </section>
  `).join('');
}
```

`renderExperienceCard` must use an `<a data-project-link>` only for published records. Draft records use `<article class="gift-card gift-card-<id>" aria-disabled="true">`, omit the action row, and include `<span class="sr-only">Thiệp này hiện chưa thể mở.</span>`. All record text and attributes pass through one HTML-escaping helper.

- [ ] **Step 4: Replace hardcoded cards with one build marker**

In `portal/index.html`, keep the header/footer and replace the three card blocks with:

```html
<nav id="gift-options" class="experience-timeline" aria-label="Những tấm thiệp theo thời gian">
  <!-- EXPERIENCE_CATALOG -->
</nav>
```

- [ ] **Step 5: Style the timeline without status UI**

Modify `portal/portal.css` so year headings act as quiet chapter markers, cards retain large photography and generous copy spacing, and `[aria-disabled="true"]` has no hover lift, pointer cursor, button-like shadow, or CTA. Do not add chips, lock icons, status labels, admin terminology, or grey overlay that makes the photograph unreadable.

- [ ] **Step 6: Run tests and commit**

Run: `node --test tests/unit/experience-catalog.test.js`

Expected: PASS.

```bash
git add portal/experience-catalog.mjs portal/index.html portal/portal.css tests/unit/experience-catalog.test.js
git commit -m "feat: render monthly gift timeline"
```

---

### Task 3: Inject the catalog during Vite builds

**Files:**
- Modify: `portal/experience-catalog.mjs`
- Modify: `portal/vite.config.js`
- Create: `tests/unit/portal-catalog-build.test.js`
- Modify: `tests/unit/portal-contract.test.js`

**Interfaces:**
- Produces: `applyExperienceCatalog(html, records) -> string`
- Produces: `createExperienceCatalogPlugin(records) -> VitePlugin`

- [ ] **Step 1: Write a failing transform contract test**

```js
test('Vite catalog transform emits all cards and removes the marker', async () => {
  const template = await readFile(new URL('../../portal/index.html', import.meta.url), 'utf8');
  const records = await loadExperienceRegistry();
  const output = applyExperienceCatalog(template, records);
  assert.doesNotMatch(output, /EXPERIENCE_CATALOG/);
  assert.match(output, /href="\/birthday\/"[^>]*data-project-link/s);
  assert.match(output, /href="\/august\/"[^>]*data-project-link/s);
  assert.doesNotMatch(output, /href="\/september\/"[^>]*data-project-link/s);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/unit/portal-catalog-build.test.js`

Expected: FAIL because `applyExperienceCatalog` is not exported.

- [ ] **Step 3: Implement a strict transform plugin**

```js
export function applyExperienceCatalog(html, records) {
  const marker = '<!-- EXPERIENCE_CATALOG -->';
  if (html.split(marker).length !== 2) {
    throw new Error('portal/index.html must contain exactly one EXPERIENCE_CATALOG marker.');
  }
  return html.replace(marker, renderExperienceCatalog(records));
}

export function createExperienceCatalogPlugin(records) {
  return {
    name: 'experience-catalog',
    transformIndexHtml: {
      order: 'pre',
      handler: html => applyExperienceCatalog(html, records),
    },
  };
}
```

- [ ] **Step 4: Load the registry once in `portal/vite.config.js`**

Use top-level `await loadExperienceRegistry()` and register `createExperienceCatalogPlugin(records)` before the metadata plugin. Remove the direct synchronous JSON parse of the old site config.

- [ ] **Step 5: Update the portal contract test to inspect transformed HTML**

The test must call `applyExperienceCatalog(sourceHtml, records)` before asserting card order and copy. Keep the exact allowlist assertion for `to`, `from`, `age` in `portal.js`.

- [ ] **Step 6: Run tests and commit**

Run: `node --test tests/unit/experience-catalog.test.js tests/unit/portal-catalog-build.test.js tests/unit/portal-contract.test.js`

Expected: PASS.

```bash
git add portal/experience-catalog.mjs portal/vite.config.js tests/unit/portal-catalog-build.test.js tests/unit/portal-contract.test.js
git commit -m "feat: build chooser catalog from registry"
```

---

### Task 4: Derive routes, share targets and metadata from the registry

**Files:**
- Modify: `src/content/site.json`
- Modify: `scripts/site-config.mjs`
- Modify: `scripts/site-metadata.mjs`
- Modify: `portal/vite.config.js`
- Modify: `vite.config.js`
- Modify: `apps/august/vite.config.js`
- Modify: `apps/september/vite.config.js`
- Modify: `tests/unit/site-config.test.js`
- Modify: `tests/unit/site-metadata.test.js`

**Interfaces:**
- Consumes: `loadExperienceRegistry()`
- Produces: `loadSiteConfig(options) -> Promise<{ origin, routes, shareTargets, pages, experiences }>`
- Produces: `composeSiteConfig(siteShell, experiences) -> SiteConfig`
- Preserves: `buildCanonicalUrl(site, routeId)` and `buildShareUrl(site, routeId)`

- [ ] **Step 1: Write failing derived-config tests**

```js
test('site routes and metadata are derived from the registry', async () => {
  const site = await loadSiteConfig();
  assert.deepEqual(site.routes, {
    chooser: '/', birthday: '/birthday/', august: '/august/', september: '/september/',
  });
  assert.equal(site.shareTargets.september, '/september/');
  assert.equal(site.pages.september.title, 'Một chút ngọt, một chút hoa');
});
```

Add a test that edits a cloned registry record and proves `composeSiteConfig` changes routes/metadata without editing `site.json`.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/unit/site-config.test.js tests/unit/site-metadata.test.js`

Expected: FAIL because the raw site file still owns route/page maps.

- [ ] **Step 3: Reduce `site.json` to site-level data**

Keep exactly:

```json
{
  "origin": "https://romantic-birthday-app.vercel.app",
  "chooser": {
    "title": "Chọn tấm thiệp dành cho em",
    "description": "Những tấm thiệp được giữ lại theo từng tháng, dành riêng cho em.",
    "ogTitle": "Những tấm thiệp dành cho em",
    "ogDescription": "Mỗi tháng là một câu chuyện nhỏ được chuẩn bị riêng.",
    "ogImage": "/experience-previews/birthday.webp"
  }
}
```

- [ ] **Step 4: Compose the existing public config shape**

```js
export function composeSiteConfig(shell, experiences) {
  return {
    origin: shell.origin,
    routes: Object.fromEntries([
      ['chooser', '/'],
      ...experiences.map(record => [record.id, record.route]),
    ]),
    shareTargets: Object.fromEntries(experiences.map(record => [record.id, record.route])),
    pages: Object.fromEntries([
      ['chooser', shell.chooser],
      ...experiences.map(record => [record.id, record.metadata]),
    ]),
    experiences,
  };
}
```

`loadSiteConfig` reads the site shell and registry, composes them, then validates the resulting public shape. `validateSiteConfig` must derive expected route IDs from `site.experiences`, not constants.

- [ ] **Step 5: Update all four Vite configs**

Replace raw `readFileSync(site.json)` usage with `const site = await loadSiteConfig()`. Keep each app's existing base, publicDir and plugins unchanged besides the config source.

- [ ] **Step 6: Run tests and commit**

Run: `node --test tests/unit/experience-registry.test.js tests/unit/site-config.test.js tests/unit/site-metadata.test.js`

Expected: PASS.

```bash
git add src/content/site.json scripts/site-config.mjs scripts/site-metadata.mjs portal/vite.config.js vite.config.js apps/august/vite.config.js apps/september/vite.config.js tests/unit/site-config.test.js tests/unit/site-metadata.test.js
git commit -m "refactor: derive site routes from registry"
```

---

### Task 5: Drive composite build and previews from registry records

**Files:**
- Create: `scripts/experience-builds.mjs`
- Create: `tests/unit/experience-builds.test.js`
- Modify: `scripts/build-composite.mjs`
- Modify: `scripts/runtime-dependencies.mjs`
- Modify: `tests/unit/composite-build.test.js`
- Modify: `tests/unit/build-validator.test.js`

**Interfaces:**
- Produces: `resolveBuildEnvironment(env) -> development | preview | production`
- Produces: `createExperienceRouteBuilds(options) -> RouteBuild[]`
- Produces: `findExperienceForUrl(url, experiences) -> Experience | null`
- Consumes: validation, post-build and copy rules from each registry record
- `options.paths` is exactly `{ projectRoot: string, stagingDir: string, distDir: string }`

- [ ] **Step 1: Write failing route-plan tests**

```js
test('preview builds every route while production excludes September', async () => {
  const records = await loadExperienceRegistry();
  assert.deepEqual(
    createExperienceRouteBuilds({ records, environment: 'preview', paths }).map(route => route.id),
    ['birthday', 'august', 'september'],
  );
  assert.deepEqual(
    createExperienceRouteBuilds({ records, environment: 'production', paths }).map(route => route.id),
    ['birthday', 'august'],
  );
});
```

Add tests for longest-prefix URL ownership, hook token expansion, collision-safe copy destinations, and environment mapping for `VERCEL_ENV=preview|production`.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/unit/experience-builds.test.js`

Expected: FAIL because `scripts/experience-builds.mjs` is absent.

- [ ] **Step 3: Implement data-driven route plans**

```js
export function resolveBuildEnvironment(env = process.env) {
  if (env.VERCEL_ENV === 'production' || env.EXPERIENCE_BUILD_ENV === 'production') {
    return 'production';
  }
  if (env.VERCEL_ENV === 'preview' || env.EXPERIENCE_BUILD_ENV === 'preview') {
    return 'preview';
  }
  return 'development';
}
```

Create one chooser route plus registry-selected experience routes. Derive `index` as `${record.route}index.html`, Vite config from `build.config`, staging output from `id`, and destination from `build.destination`.

- [ ] **Step 4: Replace hardcoded build/validation/copy branches**

In `build-composite.mjs`:

- load registry and environment once;
- run each selected record's development validation argv;
- run Vite for chooser plus selected routes;
- execute record `postBuild` hooks with `{stagingDir}` expanded;
- execute record `copies` through the existing collision-safe copy functions;
- copy every registry preview source to its chooser `publicPath`, including draft previews;
- remove `if (routeId === ...)` route lookup and use `findExperienceForUrl`;
- write `catalog` entries into `build-manifest.json` with `{id, year, month, route, built, previewPublicPath}`; do not include personalized values.

- [ ] **Step 5: Make runtime dependency analysis accept dynamic routes**

Replace assumptions about Birthday/August/September route IDs with the route list passed from the build manifest. Preserve September's existing initial-transfer budget by resolving its ID from the registry record, not a hardcoded URL prefix.

- [ ] **Step 6: Strengthen composite tests**

Run one development build and assert:

- catalog order is 05, 08, 09;
- all three route indexes exist;
- all three chooser previews exist;
- external runtime URLs remain empty.

Run a production fixture build with `EXPERIENCE_BUILD_ENV=production` and assert Birthday/August indexes exist, September index/runtime namespace do not, and `/experience-previews/september.webp` still exists.

- [ ] **Step 7: Run tests and commit**

Run: `node --test tests/unit/experience-builds.test.js tests/unit/composite-build.test.js tests/unit/build-validator.test.js`

Expected: PASS.

```bash
git add scripts/experience-builds.mjs scripts/build-composite.mjs scripts/runtime-dependencies.mjs tests/unit/experience-builds.test.js tests/unit/composite-build.test.js tests/unit/build-validator.test.js
git commit -m "refactor: build experiences from registry"
```

---

### Task 6: Make production release and dist validation status-aware

**Files:**
- Create: `scripts/experience-release.mjs`
- Create: `tests/unit/experience-release.test.js`
- Modify: `scripts/build-vercel.mjs`
- Modify: `scripts/validate-source.mjs`
- Modify: `scripts/validate-build.mjs`
- Modify: `package.json`
- Modify: `tests/unit/vercel-build-gate.test.js`
- Modify: `vercel.json`

**Interfaces:**
- Produces: `createReleaseValidationPlan(records, environment) -> Array<{ id, argv }>`
- Production validates only published records with `build.validation.release`
- Preview/development use `build.validation.development`

- [ ] **Step 1: Write failing release-plan tests**

```js
test('draft September cannot block a production deployment', async () => {
  const records = await loadExperienceRegistry();
  const plan = createReleaseValidationPlan(records, 'production');
  assert.deepEqual(plan.map(({ id }) => id), ['birthday', 'august']);
});

test('publishing an unapproved September invokes its release gate', async () => {
  const records = structuredClone(await loadExperienceRegistry());
  records.find(record => record.id === 'september').status = 'published';
  const plan = createReleaseValidationPlan(records, 'production');
  assert.deepEqual(plan.find(({ id }) => id === 'september').argv, [
    'apps/september/scripts/validate.mjs', '--release',
  ]);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/unit/experience-release.test.js tests/unit/vercel-build-gate.test.js`

Expected: FAIL because production currently always runs the September release validator.

- [ ] **Step 3: Implement the release plan and Vercel runner**

`build-vercel.mjs` must load the registry, run the release plan sequentially with `process.execPath`, then spawn `build-composite.mjs` with `EXPERIENCE_BUILD_ENV=production`. Preview uses `EXPERIENCE_BUILD_ENV=preview` and never runs release-only validation.

- [ ] **Step 4: Update package scripts without shell-only environment syntax**

Set `build:release` to a Node entry point so it is cross-platform:

```json
{
  "build:release": "node scripts/build-vercel.mjs --production"
}
```

`build-vercel.mjs --production` must behave exactly like `VERCEL_ENV=production`; `vercel.json` continues to call `npm run build:vercel`.

- [ ] **Step 5: Validate source and dist registry contracts**

Source validation loads registry and verifies every preview/config/hook/copy path. Dist validation reads `build-manifest.json` and enforces:

- every catalog preview exists;
- every built record has an index and route assets;
- every non-built draft lacks its route index/runtime namespace;
- production catalog contains no unregistered routes;
- manifest contains no query, recipient, sender, age or referrer fields.

- [ ] **Step 6: Add production-gate integration tests**

The current registry production build must exit 0 and omit September. A synthetic registry with September marked published must fail before Vite with the existing six fixture/approval diagnostics. Use an injected registry URL accepted only by test/CLI options; do not mutate the checked-in registry during tests.

- [ ] **Step 7: Run tests and commit**

Run: `node --test tests/unit/experience-release.test.js tests/unit/vercel-build-gate.test.js tests/unit/build-validator.test.js`

Expected: PASS.

```bash
git add scripts/experience-release.mjs scripts/build-vercel.mjs scripts/validate-source.mjs scripts/validate-build.mjs package.json tests/unit/experience-release.test.js tests/unit/vercel-build-gate.test.js tests/unit/build-validator.test.js vercel.json
git commit -m "feat: gate monthly routes by release state"
```

---

### Task 7: Verify the human-facing chooser in real browsers

**Files:**
- Modify: `tests/e2e/portal-typography.spec.js`
- Modify: `tests/e2e/routing-metadata.spec.js`
- Modify: `tests/unit/portal-contract.test.js`
- Modify: `README.md`
- Modify: `docs/release-process.md`

**Interfaces:**
- Consumes: built catalog and manifest from Tasks 3–6
- Keeps: runtime personalization allowlist in `portal/portal.js`

- [ ] **Step 1: Replace hardcoded chooser E2E locators with registry-driven expectations**

Import the registry in the test process and assert:

```js
const catalog = JSON.parse(await readFile('src/content/experiences.json', 'utf8'));
const ordered = [...catalog].sort((a, b) => a.year - b.year || a.month - b.month);
expect(await page.locator('.gift-card').count()).toBe(ordered.length);
```

Assert one visible `2026` chapter, month order Năm → Tám → Chín, published Birthday/August links, and a non-interactive September article.

- [ ] **Step 2: Assert no machine-like state leaks into UI**

Use visible-text assertions against the chooser body:

```js
await expect(page.locator('body')).not.toContainText(/draft|published|đang hoàn thiện|trạng thái/i);
await expect(page.locator('.gift-card-september')).toHaveAttribute('aria-disabled', 'true');
await expect(page.locator('.gift-card-september')).not.toHaveAttribute('href', /.+/);
```

Verify only the screen-reader description communicates unavailability.

- [ ] **Step 3: Keep personalization and image-fallback coverage**

Assert `to`, `from`, `age` are appended only to published links; `privateNote` and hash are absent. Force one preview image error and assert the card copy remains readable and the published card remains actionable.

- [ ] **Step 4: Test preview and production route matrices**

Preview build: `/`, `/birthday/`, `/august/`, `/september/` return 200 with correct canonical/OG metadata.

Production fixture build: `/`, `/birthday/`, `/august/` return 200; `/september/` returns shared 404; the chooser still renders September's preview without a link.

- [ ] **Step 5: Document the monthly workflow**

Update README and release docs with the exact seven-step flow from the spec. State explicitly that editors never change portal HTML, route arrays, metadata maps or test route lists when adding a month. Document that `status` is internal and must never be added to visible copy.

- [ ] **Step 6: Run browser tests and commit**

Run:

```bash
npx playwright test tests/e2e/portal-typography.spec.js tests/e2e/routing-metadata.spec.js --project=desktop-chrome
npx playwright test tests/e2e/portal-typography.spec.js --project=iphone-x
```

Expected: PASS.

```bash
git add tests/e2e/portal-typography.spec.js tests/e2e/routing-metadata.spec.js tests/unit/portal-contract.test.js README.md docs/release-process.md
git commit -m "test: verify monthly chooser journey"
```

---

### Task 8: Run full regression and release evidence

**Files:**
- Modify only if a regression test exposes a registry integration defect.
- Evidence: append command results to the implementation report; do not commit generated `dist` or `staging`.

**Interfaces:**
- Verifies every interface produced by Tasks 1–7.

- [ ] **Step 1: Run all unit suites**

Run: `npm test`

Expected: all Birthday/shared, August and September tests pass with zero failures.

- [ ] **Step 2: Build and validate development output**

Run:

```bash
npm run build
npm run validate:dist
```

Expected: chooser plus Birthday, August and September are present; build manifest has three ordered catalog entries and zero external runtime URLs.

- [ ] **Step 3: Run the complete browser matrix**

Run: `npm run test:e2e:run`

Expected: all configured desktop/mobile projects pass or use their existing intentional skips; no new failure in Birthday, August, September, routing, metadata, offline or accessibility journeys.

- [ ] **Step 4: Verify production exclusion**

Run: `npm run build:release`

Expected: exit 0; `dist/september/index.html` and September runtime assets are absent; `dist/experience-previews/september.webp` is present; Birthday and August routes pass `validate:dist`.

- [ ] **Step 5: Verify the published-fixture failure path**

Run the focused test fixture from `tests/unit/experience-release.test.js` that marks September published.

Expected: release validation exits nonzero before Vite and reports the current six fixture/approval/placeholder errors.

- [ ] **Step 6: Restore the normal preview artifact**

Run: `npm run build`

Expected: `/september/` is present again for local review.

- [ ] **Step 7: Check scope and stop on any newly exposed defect**

Run:

```bash
git diff --check
git status --short
```

Confirm no unrelated dirty/untracked file was reset, staged or overwritten. If a regression fails, stop Task 8 and open a dedicated fix task naming the failing test and exact affected files; do not make an unplanned broad edit inside the verification task. If no fix is required, do not create an empty commit.

---

## Traceability

| Requirement | Tasks |
|---|---|
| One authoritative registry | 1, 4 |
| 2026 ordering 05 → 08 → 09 and year grouping | 1, 2, 7 |
| Human-centered UI with no visible status | 2, 7 |
| Published links and non-interactive draft cards | 2, 3, 7 |
| Preview builds drafts; production excludes draft routes | 5, 6, 8 |
| Draft preview remains visible in production chooser | 1, 5, 8 |
| Metadata/share targets/routes derived from registry | 4, 5 |
| Only `to/from/age` forwarded | 2, 7 |
| Clean direct refresh and shared 404 | 6, 7, 8 |
| Adding a month requires one registry record | 1, 5, 7 |
| No behavior change inside existing apps | 7, 8 |
| No deploy | 6–8 |
