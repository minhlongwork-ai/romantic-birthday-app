# September “Xưởng giấy & đồng” — Design Specification

**Date:** 2026-09-01

**Status:** Review-complete design specification, awaiting sender approval

**Route:** `/september/`

**Primary target:** Safari on iPhone with iOS 17 or later

## 1. Outcome

Replace September's current NFC compartment and ribbon puzzle experience with a warm, handcrafted miniature workshop. The recipient lends the workshop a hand, first to bridge a missing section of track and then to choose which sealed branch opens first. The workshop delivers two gifts:

- A lemon tiramisu cake.
- A bouquet of flowers.

Both gifts are guaranteed. The interaction changes only their reveal order. The product name, photograph, and message stay hidden until the corresponding envelope is opened.

The final experience must feel intimate and human rather than mechanical. Camera tracking, WebGL, loading, and recovery states remain implementation details; the recipient sees paper, wood, brass, soft light, and a gentle shadow of their hand.

## 2. Scope

### In scope

- Redesign the September route as the “Xưởng giấy & đồng” experience.
- Replace September's NFC and ribbon-puzzle runtime flow.
- Add a progressive-enhancement camera interaction for Safari on iPhone.
- Add a touch, keyboard, and screen-reader-equivalent path.
- Add a lightweight scripted 3D workshop with a 2.5D fallback.
- Preserve recipient/sender personalization, browser history, direct refresh, focus management, reduced motion, media fallbacks, release validation, and chooser integration.
- Preserve the existing routes `/`, `/birthday/`, and `/august/` without behavior changes.
- Keep the chooser ordered chronologically from oldest to newest: May birthday, August, September.
- Continue blocking production while September uses demonstration products or media.

### Out of scope

- Backend services, accounts, analytics, storage, database writes, uploads, or camera recording.
- NFC tags, QR scanning, motion sensors, audio, checkout, social sharing, or notifications.
- Full physics simulation, dynamic shadows, post-processing, or an explorable 3D room.
- Cold offline support, offline reload, or a new service worker.
- Production deployment during the spike or implementation task.
- Changes to the behavior or content of Birthday and August.

## 3. Art direction

The approved direction is **A — Xưởng giấy & đồng**.

### Materials and palette

- Dark walnut and ink brown for the room and worktable.
- Ivory paper for tracks, bridges, envelopes, and instruction slips.
- Brushed champagne brass for the ball, levers, rails, and small details.
- Dusty rose only for restrained accents such as the envelope seal.
- Warm, localized lamp light with deep but soft shadows.

The existing Playfair Display and Be Vietnam Pro font pairing remains. Product photography is photographic, not vector illustration.

### Composition

The experience stays on one continuous miniature stage. The viewpoint may push in, pull out, or shift focus, but the UI must not feel like a sequence of dashboards or status screens.

Do not show:

- Skeleton landmarks, camera video, confidence values, progress bars, debug labels, or technical errors.
- Decorative dashboards, industrial control panels, or dense steampunk gears.
- Cake crumbs, lemon colors, petals, flower silhouettes, product labels, or differently styled doors before the relevant envelope opens.
- “Rare”, “win”, “correct”, “wrong”, score, timer pressure, or failure language.

The two branches, shutters, and envelopes must look identical until reveal.

## 4. Copy

All copy in this section is approved except the two implementation labels called out under **Proposed labels for written-spec review**.

### Intro

- Personalization line: `Dành cho {recipient}` with the existing fallback `Dành cho em`.
- Title: **“Một xưởng nhỏ đang chờ em.”**
- Body: **“Anh đã để hai món ở đây. Em giúp xưởng hoàn thành nốt nhé.”**
- Primary CTA: **“Khởi động xưởng”**

### Camera and touch invitation

- Title: **“Cho xưởng mượn một bàn tay nhé?”**
- Privacy copy: **“Camera chỉ giúp chiếc bóng giấy đi theo tay em. Không có hình ảnh nào được lưu hoặc gửi đi.”**
- Primary action: **“Dùng bàn tay”**
- Equivalent action: **“Dùng chạm”**

### Workshop instructions

- Bridge: **“Giữ tay một chút, để nối đường ray.”**
- Bridge note: **“Giữ yên một chút để giấy tìm thấy tay em.”**
- Fork: **“Đưa chiếc bóng về hướng em muốn mở trước.”**
- Delivery cue: **“Nghe xem, xưởng bắt đầu chạy rồi.”**
- First reveal CTA: **“Cho xưởng chạy tiếp”**
- Replay CTA: **“Xem lại từ đầu”**

### Proposed labels for written-spec review

- Envelope action: **“Mở phong bì”**
- Final-letter CTA: **“Mở lá thư”**

These labels fill the two explicit activation points required by the approved flow. They remain proposed until the sender approves this written specification; changing either label does not change the interaction contract.

### Gift messages

**Lemon tiramisu:**

> “Tiramisu chanh — ngọt vừa đủ, lại có một chút chua. Anh nghĩ em sẽ thích. Nhớ ăn lúc còn ngon nhé.”

**Bouquet:**

> “Anh không đợi một dịp đặc biệt mới tặng hoa. Chỉ là anh nghĩ bó hoa này sẽ rất đẹp khi ở cạnh em.”

### Final letter

> “Anh không ở cạnh lúc em mở thiếp, nên gửi một xưởng nhỏ thay anh chuẩn bị mọi thứ. Bánh để em có một chút ngọt, hoa để ngày của em đẹp hơn. Còn anh chỉ muốn em biết: dù không ở đây, anh vẫn muốn có mặt trong ngày của em theo một cách nhỏ thôi.”

Render this paragraph exactly as approved. Do not append a personalized signature or rewrite `anh` from the `from` query value.

## 5. Experience flow

### Beat 1 — The sleeping workshop

The recipient sees the dormant stage, one brass ball, and a broken paper track. No gift content, product-specific clue, or camera request appears. The primary CTA remains fully visible in the first viewport at 320×568 and 375×667.

### Beat 2 — Invite a hand

After the explicit start action, an ivory paper invitation asks whether the recipient wants to use their hand or touch. Choosing the camera path triggers the browser permission request. Choosing touch enters the same workshop immediately.

Camera permission is never requested at page load or before an explicit user action.

### Beat 3 — Bridge the gap

The brass ball rolls and stops before the gap.

- Camera: an open palm held in the bridge zone for 500 ms forms the paper bridge.
- Touch: press and hold the paper bridge for 500 ms.
- Keyboard/screen reader: activate the semantic **Nối đường ray** control once.

The workshop does not punish brief tracking dropouts. The bridge progress tolerates up to 150 ms of missing samples before resetting the hold.

### Beat 4 — Choose the first branch

After the bridge locks, the ball reaches two identical branches.

- Camera: move the palm left or right past the selection threshold and hold for 350 ms.
- Touch: drag the paper guide left or right past the same threshold.
- Keyboard/screen reader: use explicit **Chọn lối trái** and **Chọn lối phải** controls.

The initial implementation mapping is deterministic and unlabeled:

- Left branch → cake first.
- Right branch → bouquet first.

There is no randomization. The remaining gift always becomes the second delivery.

### Beat 5 — Deliver the first envelope

The ball triggers a scripted chain of paper folds, brass levers, warm lights, and a sealing press. The initial timing target is five to six seconds. A closed envelope slides toward the recipient. The animation itself communicates progress; the production UI does not display “loading” or percentages.

### Beat 6 — Reveal the first gift

The delivered, closed envelope remains part of the workshop and is a semantic button with the proposed label **“Mở phong bì”**. Touch, pointer, keyboard, or screen-reader activation plays the envelope-open transition while the app remains in the workshop. When the transition succeeds, the app mounts the product card, commits the gift to `openedGiftIds` and `openOrder` exactly once, and pushes the `reveal` history entry. Only then does it expose the product photograph, exact product name, variant, and approved personal message. Focus moves to the mounted product heading after it has been scrolled into view. A canceled or stale transition does not commit or navigate, and entering a `reveal` scene never opens a sealed gift automatically.

Selecting **“Cho xưởng chạy tiếp”** returns to the same stage. The workshop uses the remaining branch and delivers the second envelope through a shorter sequence, initially targeted at three to four seconds. It does not ask for camera access or repeat the hand interaction. The second envelope uses the same explicit **“Mở phong bì”** action and focus rules.

### Beat 7 — Final letter

The app remains on the second product for as long as the recipient wants to read it. The remaining paper pieces fold into the final letter only after the recipient activates **“Mở lá thư”**. The stage lighting softens. Replay starts a new in-memory session from the intro and does not retain order or camera mode.

### Timing

The active interaction and scripted motion target is 25–35 seconds, excluding time spent reading product messages or the final letter. There is no countdown, loss state, or attempt limit.

## 6. Camera and touch behavior

### Camera capture

- Target the front camera with an ideal working resolution of 320×240.
- Use a visually clipped, non-focusable `video` element with `autoplay`, `muted`, `playsinline`, and `aria-hidden="true"`. Do not use `display:none`, and never paint its pixels into the visible interface.
- Mirror the derived paper shadow so its on-screen movement matches the recipient's expectation from a front-facing camera.
- Support one hand only.
- Sample inference at 10–15 Hz in a Web Worker and interpolate only the rendered paper shadow.
- Use MediaPipe Hand Landmarker rather than a prebuilt gesture classifier.
- Initialize Hand Landmarker in `VIDEO` running mode with `numHands: 1` and the CPU/WASM delegate. Do not request a GPU delegate that could contend with the workshop's WebGL renderer.
- Pin `@mediapipe/tasks-vision` to `1.0.1` under its Apache-2.0 license. The npm package integrity is `sha512-rvRE2FmAZ6ZxKSw7wq+e+jQDpN3t1B/tD2mJz9SmAzb1msoDkd4dMoE4wAh8Z30Um0PQwLiHr9QtomhmXk3aUQ==`.
- Self-host the official float16 Hand Landmarker v1 task asset from `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`. Its expected size is 7,819,105 bytes and SHA-256 is `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`.
- Self-host only the SIMD runtime selected for the supported iOS 17 baseline: `vision_wasm_internal.js` (323,377 bytes, SHA-256 `e170ee67dd4e16c1a6fcd8840a206687e5a59b22c20e4a902bc445b095454d73`) and `vision_wasm_internal.wasm` (11,756,954 bytes, SHA-256 `8da277a733926eacd0474b8704b36742d6ec3231c57a860c5b889dff8f1df886`). Browsers without the required WebAssembly features use touch rather than downloading another runtime variant.
- The bundled `vision_bundle.mjs` source artifact is 155,439 bytes with SHA-256 `d885630c297c0b20b1fe86096cb06291c4c8080876f27852e724f24ac603713f`.
- Do not upload, persist, log, screenshot, or serialize camera-derived video frames, landmarks, or personal gesture samples. Authored synthetic landmark fixtures are allowed in the test corpus and contain no recipient data.

The interaction layer consumes only a filtered palm center, an open-palm score, a timestamp, and tracking availability. The renderer never receives raw video frames or the landmark array.

### Frame transport and backpressure

The main thread owns `getUserMedia`, the clipped `playsinline` video, and frame scheduling. Prefer `requestVideoFrameCallback`; use a throttled animation-frame loop only when it is unavailable.

At most one inference may be in flight:

1. Center-crop the current camera frame to the working aspect ratio and create a 320×240 `ImageBitmap` without mirroring its pixels.
2. Post `{ type: "frame", generation, sequence, timestampMs, bitmap }` to the worker and transfer the bitmap.
3. While the worker is busy, drop new frames rather than queueing them.
4. The worker closes the bitmap in `finally`, whether inference succeeds, fails, or the generation is stale.
5. The worker posts `{ type: "sample", generation, sequence, timestampMs, tracking, palmX, palmY, openness }` and no landmark array.
6. The main thread mirrors the normalized `palmX` once for the front-camera paper shadow, rejects results from another generation or older than 250 ms, and then marks the worker free.

Worker initialization, frame processing, and shutdown messages all include the same generation. Shutdown closes the Hand Landmarker task, closes any owned bitmap, rejects further frames, and terminates the worker. Track `mute` or `ended` events immediately stop scheduling and offer touch.

### Open-palm derivation

Hand Landmarker does not output an open-palm confidence. The worker derives an `openness` score from landmarks:

- Use the wrist-to-middle-MCP distance as palm scale.
- For index, middle, ring, and little fingers, compare wrist-to-tip distance with wrist-to-PIP distance, normalized by palm scale.
- For the thumb, compare thumb-tip-to-index-MCP distance with palm scale.
- Map each normalized extension margin to `0…1`, clamp it, and average the five finger values.

The initial `0.65` open-palm threshold is calibrated by the spike against a committed synthetic landmark corpus covering open, closed, partial, rotated, scaled, mirrored, and noisy hands. Do not commit captured frames or personal landmark recordings. Real-device testing records only pass/fail, latency, and frame-rate evidence.

The spike must lock and document the exact normalized extension-margin endpoints used to map each finger to `0…1`. Those values become versioned constants next to the synthetic corpus rather than hidden tuning inside the worker.

### Gesture thresholds

- The bridge initially requires an open-palm score of at least 0.65 inside the bridge zone for 500 ms.
- Fork selection requires the filtered palm center to move at least 18% of the stage width from center and remain there for 350 ms.
- Fork hysteresis returns to neutral only inside 12% of stage center, preventing left/right flicker.
- A 150 ms dropout tolerance applies during dwell.
- Camera samples older than 250 ms are discarded.

The branch mapping, confidence threshold, selection threshold, hysteresis, stale-sample age, animation durations, and 3D asset budget are implementation defaults. The technical spike may tune them before the implementation plan is locked. It must preserve the approved 500 ms bridge dwell, 350 ms direction dwell, left/right order choice, 25–35-second active experience, equal touch outcome, and absence of failure or score states.

### Recovery

- If no usable hand appears for three seconds, show **“Chạm để tiếp tục”** as a quiet paper action without declaring an error.
- Permission denial, dismissal, unsupported camera APIs, model load failure, worker failure, and camera startup timeout all offer the touch path immediately.
- Before `getUserMedia` is called, **“Dùng chạm”** remains available beside the camera choice. While Safari's native permission prompt is on screen, the browser owns interaction and the app makes no claim that controls behind it are usable. Allow, denial, dismissal, or return from the prompt restores an app-owned in-stage surface on which touch is immediately available; an allowed stream may continue model startup in parallel. Stream/model startup receives at most eight seconds of visible-document time. Switching to touch aborts startup logically; a late `getUserMedia` resolution stops all returned tracks without mounting camera UI.
- Tracking loss fades the paper shadow and pauses the ball. It never resets an already completed bridge or branch selection.
- When the document becomes hidden during camera use, stop frame delivery and camera tracks. On return, require an explicit **“Tiếp tục với bàn tay”** action or allow touch.
- Stop the camera permanently as soon as branch selection locks.

Capability checks use `isSecureContext`, `mediaDevices.getUserMedia`, Worker support, WebAssembly/SIMD support, and a real runtime probe. Browser identification may adjust explanatory copy but is not the only control gate. In Zalo, Messenger, or another unsuitable embedded browser, **“Dùng chạm”** is the primary action and camera permission is never requested repeatedly. A quiet note may say **“Muốn dùng bàn tay? Hãy mở liên kết này bằng Safari.”** Touch remains unblocked.

### Touch and pointer contract

- Only one primary pointer may own an interaction. Capture it on the active paper control; ignore all additional pointers until release or cleanup. Apply `touch-action: none` only to that active control, not to the whole page.
- Bridge hold begins on primary pointer-down inside the bridge target. Movement within 12 CSS px is tolerated. Movement beyond that initial tolerance, pointer-up before 500 ms, `pointercancel`, lost capture, window blur, scene exit, or cleanup resets the dwell and emits no command.
- Branch drag begins on the paper guide. It emits no choice while displacement remains below 18% of stage width. Once beyond a side threshold, it must remain on that side for 350 ms; returning inside the 12% neutral band resets the dwell. Pointer-up before confirmation, `pointercancel`, lost capture, window blur, scene exit, or cleanup recenters the guide and emits no command.
- After a bridge or branch command is emitted, that control locks and subsequent pointer events cannot emit it again. The visible semantic **Nối đường ray**, **Chọn lối trái**, and **Chọn lối phải** buttons remain non-drag alternatives and emit their corresponding command once on activation.
- The 12 CSS-px hold tolerance is an initial spike-tunable accessibility value. Any adjustment must preserve intentional hold behavior and avoid turning page scrolling into a workshop command.

### Input parity

Camera, pointer, touch, and keyboard emit the same semantic commands:

```text
BRIDGE_CONFIRMED
CHOOSE_LEFT
CHOOSE_RIGHT
```

Every mode triggers the same reducer transition, scripted animation, gift order, reveal content, and final letter. Touch is not a reduced or visually inferior version.

## 7. State and history

### Stable state

```ts
type Scene = "intro" | "workshop" | "reveal" | "ending";
type WorkshopPhase =
  | "invitation"
  | "bridge"
  | "fork"
  | "delivering-first"
  | "first-envelope-ready"
  | "between-gifts"
  | "delivering-second"
  | "second-envelope-ready"
  | "complete";
type InteractionMode = null | "camera" | "touch";

interface SeptemberState {
  scene: Scene;
  workshopPhase: WorkshopPhase;
  interactionMode: InteractionMode;
  deliveryOrder: Array<"cake" | "bouquet">;
  deliveredCount: 0 | 1 | 2;
  openedGiftIds: Set<"cake" | "bouquet">;
  openOrder: Array<"cake" | "bouquet">;
  activeGiftId: null | "cake" | "bouquet";
}
```

`deliveryOrder` becomes the complete two-item deterministic order exactly once when branch selection locks. `deliveredCount` increments exactly once only after the matching delivery animation completes and its sealed-envelope button has mounted. `openedGiftIds` and `openOrder` change later, only after that envelope is explicitly activated and the product card mounts. An animation canceled before envelope mount does not increment `deliveredCount`; it may restart from its stable pre-delivery phase. Once `deliveredCount` has incremented, restoration presents the already delivered envelope and never replays that delivery.

Camera stream, worker, renderer, timers, animation promises, tracking samples, and pointer capture are runtime resources and never live in application state or history.

### History entries

History advances only at stable user-navigable moments:

```ts
{ v: 2, sessionToken, scene: "intro" }
{ v: 2, sessionToken, scene: "workshop" }
{ v: 2, sessionToken, scene: "reveal", giftId }
{ v: 2, sessionToken, scene: "ending" }
```

- Active navigation uses `pushState`; recovery uses `replaceState`; `popstate` never pushes.
- Version or token mismatch recovers to intro.
- Invalid reveal gift recovers to the workshop.
- Ending before both gifts are committed recovers to the workshop.
- Back from a product reveal returns to the corresponding stable workshop state and never reacquires camera automatically. The first opened product returns to `between-gifts`; the second opened product returns to `complete`.
- Forward to reveal restores the exact gift from the entry.
- Reload creates a new session at intro.
- The initial Back entry may leave the site.

The `reveal` entry is pushed only when the recipient activates a ready envelope. Delivery completion itself remains a `workshop` entry. A Back/Forward traversal must never auto-open an envelope, rerun an already completed delivery, or skip a sealed envelope.

History restoration derives the workshop phase rather than trusting a stale phase value:

- Empty `deliveryOrder` → invitation; the recipient chooses camera or touch again.
- Two-item `deliveryOrder`, zero delivered, zero opened → restart or finish only the still-uncommitted first delivery, guarded by the current generation; it must not ask for branch selection again.
- One delivered and zero opened → `first-envelope-ready`; render the already-delivered sealed envelope without replaying the delivery.
- One delivered and one opened gift → between-gifts.
- Two delivered and one opened gift → `second-envelope-ready`; render the already-delivered sealed envelope without replaying the delivery.
- Two opened gifts → complete.
- A `reveal` entry is valid only when its `giftId` is delivered and already present in `openedGiftIds`; a sealed gift belongs to the workshop's envelope-ready phase, not to `reveal`.
- Any duplicate, unknown, count mismatch, impossible opened/delivered relationship, or reveal gift outside `deliveryOrder.slice(0, deliveredCount)` recovers with `replaceState` to the nearest valid workshop phase.

September no longer reads or writes NFC hash fragments or local storage. The chooser continues forwarding only the existing allowlisted `to`, `from`, and `age` query keys. September uses `to` and `from`, retains but does not display `age`, then immediately removes the query from the visible URL as it does today.

## 8. Component boundaries

The existing vanilla Vite scene-mount architecture remains. The redesign introduces four focused boundaries.

### Pure workshop state

Owns phases, allowed transitions, branch-to-gift mapping, open order, history recovery, and gift commit rules. It has no DOM, camera, worker, or Three.js dependency and is unit-testable.

### Input adapters

The camera adapter and touch/keyboard adapter translate raw input into the three semantic commands. Gesture filtering, dwell, hysteresis, pointer capture, and accessibility controls stay outside the renderer.

### Workshop renderer

Owns the Three.js scene, preauthored animation clips, paper shadow, viewport resize, lighting, and 2.5D fallback. It receives semantic phases and normalized shadow coordinates but has no knowledge of camera permission or gift content.

### Workshop scene controller

Mounts the stage, invitation, accessible controls, and renderer; starts the chosen input adapter; dispatches pure state transitions; and requests navigation or reveal after guarded animation completion.

Each mounted scene owns one idempotent cleanup function. Cleanup marks the controller disposed before aborting async work, then releases pointer capture, animation frames, renderer resources, workers, streams, listeners, and timers. Every async completion compares its generation token and disposed flag before changing state or navigating.

## 9. Rendering and performance

### Three-dimensional stage

- Use Three.js with a small orthographic or restrained-perspective scene.
- Prefer simple meshes, baked light, and preauthored transforms.
- Do not use a physics engine, post-processing, real-time reflections, or dynamic shadow maps.
- Cap device pixel ratio at 1.5.
- Pause rendering when the document is hidden.
- Dispose geometries, materials, textures, and renderer context when the scene exits.
- Use a static 2.5D DOM/CSS workshop if WebGL initialization or context restoration fails.

### Budgets

- Initial September transfer: no more than 491,520 bytes; warn at 95%.
- Camera mode assets after explicit opt-in: no more than 15 MiB cold transfer.
- Compressed 3D workshop meshes and textures: no more than 1.5 MiB combined.
- Each product encoding: no more than 307,200 bytes, preserving AVIF → WebP → JPEG order.
- Target hand-shadow response: 150–180 ms on supported iPhones.
- Target workshop rendering: 30 FPS or better, with no sustained period below 24 FPS on the real-device acceptance set.

The shared workshop renderer, Three.js chunk, and workshop meshes/textures load only after **“Khởi động xưởng”**. Touch uses this same renderer. MediaPipe JavaScript, worker, WASM, and model load only after explicit **“Dùng bàn tay”** opt-in. The 15 MiB cold-transfer budget applies only to the selected camera stack and measures actual compressed network transfer, not every unselected alternative artifact. No runtime request may target a third-party domain. Production headers must enforce a same-origin connection policy (`connect-src 'self'` or a stricter equivalent), and browser tests must fail if the camera path attempts any third-party request, including package usage metrics.

The composite build validator must be changed before integration:

- Stop eager dependency traversal at dynamic-import boundaries and record eager and lazy closures separately in the build manifest.
- Apply the 491,520-byte September initial budget only to its eager route closure; retain a separate Chromium cold-load cap of 512,000 transferred bytes.
- Replace the current global MediaPipe sum with per-route, per-profile accounting so Birthday's legacy Hands bundle and September's Hand Landmarker bundle remain independently validated.
- Keep an 18 MiB per-file ceiling for self-hosted MediaPipe artifacts and validate the exact checksums above.
- Count only the runtime-selected WASM/image encoding in transfer profiles while still validating every emitted alternative file for decode, MIME, digest, and per-file size.
- Add regression tests proving these accounting changes do not weaken Birthday validation.
- Record the model artifact separately from the npm package in the generated provenance manifest: upstream URL, retrieval date, byte length, SHA-256, owning project, and the reviewed model-usage/license reference. Package license metadata must not be reused as an unsupported assertion about the model file.

## 10. Accessibility and reduced motion

- Every scene has a programmatically focusable heading that is scrolled fully into view before focus.
- The app's ivory invitation remains inside the continuous workshop stage with a focusable heading and two semantic actions; it is not a custom permission modal. Initial focus moves to its heading and returns to the initiating control when the invitation is dismissed. Safari's native camera prompt is browser-owned UI and is not restyled or represented as an app dialog.
- Touch and keyboard controls use semantic buttons with accessible names and at least 44×44 CSS-pixel targets.
- The non-drag left/right controls remain visibly available in touch/pointer mode as paper tabs; they are not restricted to keyboard or assistive technology.
- Camera-only visual feedback is never the sole instruction or state signal.
- Product content and product headings do not exist in the DOM or accessibility tree before activation of the corresponding **“Mở phong bì”** control and the subsequent product-card mount.
- Gift commit occurs only after the product card mounts.
- Live regions announce meaningful milestones once and never narrate tracking confidence or each frame.
- Tracking loss, fallback availability, and media errors do not steal focus.
- Reduced motion keeps all interactions and results but removes shadow interpolation, camera parallax, spins, flourish, and long mechanical motion. Transitions use opacity only, no longer than 150 ms.
- Support VoiceOver, keyboard-only use, a single pointer, 200% zoom, portrait/landscape rotation, and safe-area insets.

## 11. Validation and testing

### Technical spike gate

Before replacing the current September experience, build a separate spike with:

- One self-hosted hand model and worker.
- The paper-shadow renderer.
- Bridge dwell and left/right fork selection.
- One short Three.js workshop animation.
- Touch and keyboard parity.

Run it through a locally trusted HTTPS origin on at least one physical iPhone running iOS 17 or later and record the exact device and OS version. An iPhone SE (2nd generation) on iOS 17 plus an iPhone 13 or later on the current available iOS is the recommended coverage matrix when those devices or an equivalent lab are available, but the second device is not a release blocker. The spike is evidence, not production code. Integrate only after the mandatory physical-iPhone run meets camera startup, gesture latency, frame-rate, cleanup, and fallback criteria; claims for untested lower-performance models must remain qualified until covered.

### Automated acceptance

1. **Pure state:** all valid and invalid workshop transitions, deterministic left/right mapping, gift commit once, second gift selection, replay, and history recovery.
2. **Gesture processing:** confidence boundary, 500 ms bridge dwell, 350 ms branch dwell, 150 ms dropout tolerance, 18% selection, 12% hysteresis, stale samples, mirrored coordinates, and noisy direction changes.
3. **Lifecycle:** permission resolve after unmount, worker result after Back, animation completion after disposal, hidden-tab pause, stop-track behavior, double cleanup, pagehide, WebGL context loss, and renderer fallback.
4. **Input parity:** camera, touch, pointer, keyboard, and screen-reader controls emit identical semantic commands and outcomes.
5. **Reveal privacy:** neither product record, product heading, name, photograph, alt text, message, nor hidden CTA appears in the DOM or accessibility tree before activation of the corresponding **“Mở phong bì”** control and product-card mount.
6. **History:** Back/Forward across workshop, both sealed-envelope-ready states, and both opened reveals; invalid entries; reload; direct route; stale navigation; exact reveal focus; and proof that navigation never auto-opens a sealed envelope or replays a completed delivery.
7. **Responsive/accessibility:** 320×568, 375×667, 768, and 1440 px; portrait/landscape; reduced motion; 200% zoom; target size; contrast; focus visibility; VoiceOver smoke; and no serious/critical axe findings.
8. **Failure matrix:** permission denied/dismissed, unresolved native prompt return, no camera API, in-app browser, model/WASM failure, worker failure, timeout, tracking loss, WebGL failure, image fallback, slow network, and the two supported same-document offline cases.
9. **Network privacy:** the camera path produces no third-party runtime request and remains functional under the production same-origin connection policy; no frame, camera-derived landmark, or personal gesture sample enters logs, persistence, or test artifacts.
10. **Touch cancellation:** early bridge release, bridge movement beyond tolerance, sub-threshold branch movement, branch release before dwell, `pointercancel`, lost capture, window blur, secondary pointers, cleanup, and double activation emit no stale or duplicate command.
11. **Camera transfer:** serve the production build from a production-like HTTPS origin with Brotli or gzip enabled, opt into camera, and record only the responses actually selected by that path. Verify each selected response's MIME and `Content-Encoding`, use browser network encoded-byte evidence rather than decoded resource size, and fail above 15 MiB total compressed transfer. The test also asserts that every selected URL is same-origin.
12. **Regression:** every currently registered composite route, personalized URL, direct refresh, canonical/metadata, chooser order, 404, and composite build across Chromium, Firefox, and WebKit. The implementation plan must enumerate the live route registry instead of relying on a fixed route count.

### Real-device and user acceptance

- Safari on iOS 17 or later completes both camera and touch paths.
- After five warmup samples, measure capture-to-shadow latency from camera frame timestamp to the renderer commit for 30 valid samples; p95 must be no more than 180 ms.
- During a ten-second scripted workshop run, median rendering must be at least 30 FPS and no continuous one-second window may average below 24 FPS.
- At least four of five first-time users understand the required action within ten seconds.
- At least four of five complete the camera path on their first attempt.
- All five complete the touch path.
- No participant remains stuck for more than 90 seconds.

If these thresholds fail, revise and repeat with new participants before release approval.

## 12. Product media and release gate

Development and preview builds may use clearly disclosed placeholder/demo images whose provenance, license, MIME, dimensions, and digests pass validation. Reveal displays **“Bản xem thử · ảnh minh họa”** whenever `fixture:true`; the badge and gift-specific placeholder content do not mount before that gift opens. Production validation must reject `fixture:true` or `approved:false`.

Production remains blocked until the sender supplies and approves:

- The exact cake name, size, and confirmed lemon-tiramisu variant.
- The exact bouquet description.
- One owned or properly licensed source JPEG for each real gift.
- The final product variants and any practical gift details shown to the recipient.
- Confirmation that both real gifts are suitable outside the application.
- The exact staging deployment and commit.

After approval, regenerate media and digest manifests, set `fixture:false` and `approved:true`, run release validation, build from a clean commit, and confirm the artifact manifest matches the reviewed staging build.

No production deployment is part of the spike or implementation task. Deployment requires a separate explicit instruction. The release owner must smoke-test every currently registered composite route, personalization, camera fallback, touch fallback, both reveal orders, image failure, and Back/Forward before promotion.

Rollback triggers are: a non-2xx registered route, broken chooser navigation, product content exposed before its envelope activation and product-card mount, both camera and touch paths blocked, a runtime error that prevents completion, or a product/media failure whose text fallback also fails. Camera failure alone does not trigger rollback when touch succeeds. Roll back to the recorded last-known-good deployment and verify the route registry within five minutes.

The redesign adds no client analytics or camera telemetry. Post-release evidence consists of privacy-safe manual smoke records and platform-level route availability without query values, referrer, frames, or landmarks. If the platform cannot exclude those fields, retain manual smoke evidence only.

The chooser remains chronological and human-facing. It must not reintroduce technical status labels, implementation badges, or release-state language into the visible card UI.

## 13. Success criteria

The redesign is complete when:

- The recipient experiences one continuous, warm paper-and-brass workshop rather than a technical mini game.
- Cake and bouquet remain secret until their envelopes open, including in the accessibility tree.
- Camera interaction works on supported iPhones without showing camera imagery or diagnostics.
- Touch and keyboard paths provide the exact same story and rewards.
- Both fixed reveal orders work, commit once, and survive Back/Forward safely.
- Camera, worker, WebGL, timers, and animation callbacks cannot affect state after cleanup.
- Initial and opt-in performance budgets pass.
- The chooser and all older cards retain their current behavior.
- Production remains blocked while fixture media or unapproved content exists.

## 14. Traceability

| Approved decision | Specification sections |
|---|---|
| Direction A — Xưởng giấy & đồng | §§3, 9 |
| One cake and one bouquet | §§1, 4, 5, 12 |
| Lemon tiramisu | §§1, 4, 12 |
| Camera hand interaction on iPhone | §§5–6, 9, 11 |
| Paper shadow, no visible camera/skeleton | §§1, 3, 6 |
| Palm bridge then left/right order choice | §§5–7 |
| Touch fallback with equal experience | §§5–6, 10–11 |
| Gifts hidden until envelope opens | §§3, 5, 10–11 |
| Approved two product messages | §4 |
| Approved final letter | §4 |
| Preserve menu and older routes | §§2, 11, 13 |
| Remove September NFC and ribbon puzzle | §§2, 7 |
| No storage, analytics, or deployment | §§2, 6–7, 12 |

## 15. Technical references and provenance

- [Google Hand Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js) — official web API, local model configuration, landmark output, and worker guidance for synchronous video inference.
- [`@mediapipe/tasks-vision` on npm](https://www.npmjs.com/package/%40mediapipe/tasks-vision) — pinned package version and license metadata.
- [Google MediaPipe repository](https://github.com/google-ai-edge/mediapipe) and [MediaPipe Tasks terms](https://developers.google.com/edge/mediapipe/legal/tos) — upstream license, privacy notice, and terms reviewed for self-hosting and the no-third-party-runtime-request policy.
