export const ANCHORS = Object.freeze(
  [
    {
      id: "top-left",
      label: "Trên trái",
      x: 0.18,
      y: 0.16,
      rotation: -10,
      scale: 0.94,
    },
    {
      id: "top-right",
      label: "Trên phải",
      x: 0.82,
      y: 0.16,
      rotation: 10,
      scale: 0.94,
    },
    {
      id: "middle-left",
      label: "Giữa trái",
      x: 0.12,
      y: 0.48,
      rotation: -4,
      scale: 1,
    },
    {
      id: "middle-right",
      label: "Giữa phải",
      x: 0.88,
      y: 0.48,
      rotation: 4,
      scale: 1,
    },
    {
      id: "bottom-left",
      label: "Dưới trái",
      x: 0.2,
      y: 0.82,
      rotation: -16,
      scale: 0.98,
    },
    {
      id: "bottom-right",
      label: "Dưới phải",
      x: 0.8,
      y: 0.82,
      rotation: 16,
      scale: 0.98,
    },
  ].map(Object.freeze),
);

export const ANCHOR_IDS = Object.freeze(ANCHORS.map(({ id }) => id));

const ANCHOR_BY_ID = new Map(ANCHORS.map((anchor) => [anchor.id, anchor]));
const WISH_BOTANICALS = Object.freeze({
  peace: "poppy",
  joy: "dahlia",
  ease: "gladiolus",
});

export function getAnchor(anchorId) {
  return ANCHOR_BY_ID.get(anchorId) ?? null;
}

function placeAtAnchor(flower, anchorId) {
  const anchor = getAnchor(anchorId);
  if (!anchor) return flower;
  const { x, y, rotation, scale } = anchor;

  return {
    ...flower,
    anchorId,
    x,
    y,
    rotation,
    scale,
  };
}

export function createInitialArrangement(wishId) {
  const botanicalId = WISH_BOTANICALS[wishId] ?? wishId ?? "poppy";
  return [
    placeAtAnchor(
      {
        id: "primary",
        role: "primary",
        botanicalId,
        layer: "front",
      },
      "bottom-right",
    ),
    placeAtAnchor(
      {
        id: "white",
        role: "support",
        botanicalId: "white",
        layer: "front",
      },
      "top-left",
    ),
    placeAtAnchor(
      {
        id: "olive",
        role: "foliage",
        botanicalId: "olive",
        layer: "back",
      },
      "bottom-left",
    ),
  ];
}

export function moveFlowerToAnchor(flowers, flowerId, anchorId) {
  if (!Array.isArray(flowers) || !getAnchor(anchorId)) return flowers;
  return flowers.map((flower) =>
    flower.id === flowerId ? placeAtAnchor(flower, anchorId) : flower,
  );
}

export function toggleFlowerLayer(flowers, flowerId) {
  if (!Array.isArray(flowers)) return flowers;
  return flowers.map((flower) =>
    flower.id === flowerId
      ? { ...flower, layer: flower.layer === "front" ? "back" : "front" }
      : flower,
  );
}

export function validateArrangement(flowers) {
  if (!Array.isArray(flowers) || flowers.length !== 3) return false;
  const ids = new Set();

  return flowers.every((flower) => {
    if (
      !flower ||
      typeof flower.id !== "string" ||
      ids.has(flower.id) ||
      !getAnchor(flower.anchorId) ||
      !["front", "back"].includes(flower.layer) ||
      !Number.isFinite(flower.x) ||
      !Number.isFinite(flower.y)
    ) {
      return false;
    }
    ids.add(flower.id);
    return flower.x >= 0 && flower.x <= 1 && flower.y >= 0 && flower.y <= 1;
  });
}
