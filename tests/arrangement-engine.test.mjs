import assert from "node:assert/strict";
import test from "node:test";

import {
  ANCHORS,
  createInitialArrangement,
  getAnchor,
  moveFlowerToAnchor,
  toggleFlowerLayer,
  validateArrangement,
} from "../src/herbarium/arrangement-engine.js";

test("creates the same three-stem arrangement for the same wish", () => {
  const first = createInitialArrangement("peace");
  const second = createInitialArrangement("peace");

  assert.deepEqual(second, first);
  assert.notStrictEqual(second, first);
  assert.deepEqual(
    first.map(({ id, role, botanicalId }) => ({ id, role, botanicalId })),
    [
      { id: "primary", role: "primary", botanicalId: "poppy" },
      { id: "white", role: "support", botanicalId: "white" },
      { id: "olive", role: "foliage", botanicalId: "olive" },
    ],
  );
});

test("exposes six named anchors with normalized export coordinates", () => {
  assert.deepEqual(
    ANCHORS.map(({ id }) => id),
    [
      "top-left",
      "top-right",
      "middle-left",
      "middle-right",
      "bottom-left",
      "bottom-right",
    ],
  );

  for (const anchor of ANCHORS) {
    assert.ok(anchor.label.length > 0);
    assert.ok(anchor.x >= 0 && anchor.x <= 1);
    assert.ok(anchor.y >= 0 && anchor.y <= 1);
    assert.strictEqual(getAnchor(anchor.id), anchor);
  }

  assert.equal(getAnchor("not-an-anchor"), null);
});

test("resolves initial stems to deterministic anchors for UI and export", () => {
  const flowers = createInitialArrangement("dahlia");

  assert.deepEqual(
    flowers.map(({ id, anchorId, layer }) => ({ id, anchorId, layer })),
    [
      { id: "primary", anchorId: "bottom-right", layer: "front" },
      { id: "white", anchorId: "top-left", layer: "front" },
      { id: "olive", anchorId: "bottom-left", layer: "back" },
    ],
  );

  for (const flower of flowers) {
    const anchor = getAnchor(flower.anchorId);
    assert.deepEqual(
      {
        x: flower.x,
        y: flower.y,
        rotation: flower.rotation,
        scale: flower.scale,
      },
      {
        x: anchor.x,
        y: anchor.y,
        rotation: anchor.rotation,
        scale: anchor.scale,
      },
    );
  }
});

test("moves one stem immutably and refreshes its normalized placement", () => {
  const flowers = createInitialArrangement("gladiolus");
  const originalSnapshot = structuredClone(flowers);
  const moved = moveFlowerToAnchor(flowers, "primary", "middle-left");
  const destination = getAnchor("middle-left");

  assert.deepEqual(flowers, originalSnapshot);
  assert.notStrictEqual(moved, flowers);
  assert.notStrictEqual(moved[0], flowers[0]);
  assert.strictEqual(moved[1], flowers[1]);
  assert.strictEqual(moved[2], flowers[2]);
  assert.deepEqual(
    {
      anchorId: moved[0].anchorId,
      x: moved[0].x,
      y: moved[0].y,
      rotation: moved[0].rotation,
      scale: moved[0].scale,
    },
    {
      anchorId: destination.id,
      x: destination.x,
      y: destination.y,
      rotation: destination.rotation,
      scale: destination.scale,
    },
  );
});

test("toggles only the requested stem between front and back", () => {
  const flowers = createInitialArrangement("peace");
  const sentBack = toggleFlowerLayer(flowers, "primary");
  const broughtFront = toggleFlowerLayer(sentBack, "primary");

  assert.equal(flowers[0].layer, "front");
  assert.equal(sentBack[0].layer, "back");
  assert.equal(broughtFront[0].layer, "front");
  assert.notStrictEqual(sentBack, flowers);
  assert.notStrictEqual(sentBack[0], flowers[0]);
  assert.strictEqual(sentBack[1], flowers[1]);
  assert.strictEqual(sentBack[2], flowers[2]);
});

test("maps each wish to its intended botanical specimen", () => {
  assert.equal(createInitialArrangement("peace")[0].botanicalId, "poppy");
  assert.equal(createInitialArrangement("joy")[0].botanicalId, "dahlia");
  assert.equal(createInitialArrangement("ease")[0].botanicalId, "gladiolus");
});

test("validates complete arrangements and rejects unsafe export state", () => {
  const flowers = createInitialArrangement("joy");
  assert.equal(validateArrangement(flowers), true);

  assert.equal(validateArrangement(flowers.slice(0, 2)), false);
  assert.equal(
    validateArrangement([
      flowers[0],
      flowers[1],
      { ...flowers[2], anchorId: "outside-page" },
    ]),
    false,
  );
  assert.equal(
    validateArrangement([
      flowers[0],
      flowers[1],
      { ...flowers[2], x: 1.4 },
    ]),
    false,
  );
});
