import { calculatePhotoTransform } from "./photo-engine.js";
import { resolveSenderSignature } from "./sender-signature.js";

export const POSTCARD_SIZE = Object.freeze({ width: 1200, height: 1500 });

function loadImage(source) {
  if (!source) return Promise.resolve(null);
  if (
    typeof ImageBitmap !== "undefined" &&
    source instanceof ImageBitmap
  ) {
    return Promise.resolve(source);
  }
  if (
    typeof HTMLImageElement !== "undefined" &&
    source instanceof HTMLImageElement
  ) {
    return Promise.resolve(source);
  }
  if (typeof source !== "string" || typeof Image === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

export function wrapText(context, text, maxWidth, maxLines = 3) {
  const words = String(text ?? "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = `${line} ${word}`.trim();
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = candidate;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

export function safePostcardFilename(value = "thang-tam-o-lai") {
  const normalized = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("vi")
    .replace(/đ/gu, "d")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 64);
  return `${normalized || "thang-tam-o-lai"}.png`;
}

function drawPaper(context, width, height, config) {
  context.fillStyle = config?.colors?.paper || "#f3ebdd";
  context.fillRect(0, 0, width, height);

  const light = context.createRadialGradient(
    width * 0.18,
    height * 0.12,
    0,
    width * 0.18,
    height * 0.12,
    width * 0.9,
  );
  light.addColorStop(0, "rgba(255,255,255,0.68)");
  light.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = light;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(91,72,49,0.035)";
  for (let index = 0; index < 180; index += 1) {
    const x = (index * 227 + 83) % width;
    const y = (index * 149 + 41) % height;
    context.fillRect(x, y, index % 3 === 0 ? 2 : 1, 1);
  }

  context.strokeStyle = "rgba(143,49,70,0.22)";
  context.lineWidth = 2;
  context.strokeRect(48, 48, width - 96, height - 96);
}

function createFramePath(context, frameId, rect) {
  const { x, y, width, height } = rect;
  context.beginPath();

  if (frameId === "oval") {
    context.ellipse(
      x + width / 2,
      y + height / 2,
      width / 2,
      height / 2,
      0,
      0,
      Math.PI * 2,
    );
    return;
  }

  if (frameId === "torn-paper") {
    const points = [
      [0.015, 0.02],
      [0.18, 0.008],
      [0.33, 0.021],
      [0.49, 0.006],
      [0.67, 0.019],
      [0.84, 0.009],
      [0.99, 0.02],
      [0.982, 0.24],
      [0.994, 0.43],
      [0.98, 0.62],
      [0.99, 0.82],
      [0.976, 0.99],
      [0.78, 0.98],
      [0.61, 0.992],
      [0.42, 0.978],
      [0.24, 0.99],
      [0.015, 0.978],
      [0.022, 0.78],
      [0.008, 0.58],
      [0.02, 0.38],
    ];
    points.forEach(([px, py], index) => {
      const command = index === 0 ? "moveTo" : "lineTo";
      context[command](x + width * px, y + height * py);
    });
    context.closePath();
    return;
  }

  context.rect(x, y, width, height);
}

async function resolvePhotoSource(photo) {
  if (!photo) return null;
  return (
    (await loadImage(photo.bitmap)) ||
    (await loadImage(photo.image)) ||
    (await loadImage(photo.element)) ||
    (await loadImage(photo.objectUrl)) ||
    (await loadImage(photo.src))
  );
}

async function drawPhoto(context, photo, frameId, rect) {
  const source = await resolvePhotoSource(photo);
  if (!source) return false;

  const sourceWidth = Number(photo.width || source.width || source.naturalWidth);
  const sourceHeight = Number(photo.height || source.height || source.naturalHeight);
  const crop = photo.crop ?? photo;
  const padding = frameId === "polaroid" ? 22 : frameId === "oval" ? 12 : 0;
  const inner = {
    x: rect.x + padding,
    y: rect.y + padding,
    width: rect.width - padding * 2,
    height: rect.height - padding * (frameId === "polaroid" ? 3.4 : 2),
  };

  context.save();
  if (frameId === "polaroid") {
    context.fillStyle = "#fbf7ef";
    context.shadowColor = "rgba(68,48,29,0.18)";
    context.shadowBlur = 24;
    context.shadowOffsetY = 14;
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    context.shadowColor = "transparent";
  } else if (frameId === "oval") {
    context.fillStyle = "#fbf7ef";
    createFramePath(context, "oval", rect);
    context.fill();
  }

  createFramePath(context, frameId === "polaroid" ? "rect" : frameId, inner);
  context.clip();

  const transform = calculatePhotoTransform(
    { width: sourceWidth, height: sourceHeight },
    { width: inner.width, height: inner.height },
    crop,
  );
  const centerX = inner.x + inner.width / 2;
  const centerY = inner.y + inner.height / 2;
  context.translate(centerX, centerY);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.translate(-centerX, -centerY);
  context.drawImage(
    source,
    inner.x + transform.x,
    inner.y + transform.y,
    transform.renderWidth,
    transform.renderHeight,
  );
  context.restore();
  return true;
}

async function loadBotanical(botanical) {
  if (!botanical) return null;
  return (await loadImage(botanical.asset)) || (await loadImage(botanical.fallbackAsset));
}

async function drawFlowers(context, flowers, assets, layer) {
  const selected = (flowers ?? []).filter((flower) => flower.layer === layer);
  const loaded = await Promise.all(
    selected.map(async (flower) => ({
      flower,
      image: await loadBotanical(assets?.[flower.botanicalId]),
    })),
  );

  for (const { flower, image } of loaded) {
    if (!image) {
      context.save();
      context.strokeStyle = flower.botanicalId === "olive" ? "#4e604b" : "#8f3146";
      context.lineWidth = 7;
      context.beginPath();
      context.moveTo(flower.x * 1200, flower.y * 1500 + 180);
      context.quadraticCurveTo(
        flower.x * 1200 - 35,
        flower.y * 1500,
        flower.x * 1200 + 8,
        flower.y * 1500 - 210,
      );
      context.stroke();
      context.restore();
      continue;
    }

    const roleHeight =
      flower.role === "primary" ? 770 : flower.role === "support" ? 620 : 560;
    const imageWidth = image.width || image.naturalWidth || 1;
    const imageHeight = image.height || image.naturalHeight || 1;
    const height = roleHeight * (Number(flower.scale) || 1);
    const width = height * (imageWidth / imageHeight);
    const x = clampNumber(flower.x, 0.5) * POSTCARD_SIZE.width;
    const y = clampNumber(flower.y, 0.5) * POSTCARD_SIZE.height;

    context.save();
    context.translate(x, y);
    context.rotate(((Number(flower.rotation) || 0) * Math.PI) / 180);
    context.shadowColor = "rgba(63,45,29,0.13)";
    context.shadowBlur = 11;
    context.shadowOffsetY = 9;
    context.drawImage(image, -width / 2, -height / 2, width, height);
    context.restore();
  }
}

function clampNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}

function resolveWish(state, config) {
  const wishes = Array.isArray(config?.wishes) ? config.wishes : [];
  return (
    state.wish ||
    wishes.find((wish) => wish.id === state.wishId) ||
    wishes[0] || {
      label: "Một tháng bình an",
      sentence: "luôn bình an",
    }
  );
}

function drawCopy(context, state, config) {
  const wish = resolveWish(state, config);
  const recipient = String(state.recipient || config?.defaultRecipient || "em");
  const signature = resolveSenderSignature(state, config);

  context.textAlign = "right";
  context.fillStyle = "rgba(143,49,70,0.07)";
  context.font = '500 270px "Cormorant Garamond", Georgia, serif';
  context.fillText("08", 1165, 250);

  context.fillStyle = "rgba(251,247,239,0.88)";
  context.fillRect(505, 1040, 610, 330);

  context.fillStyle = config?.colors?.rose || "#8f3146";
  context.font = '700 18px "Avenir Next", sans-serif';
  context.fillText("HOA ÉP THÁNG TÁM", 1060, 1090);

  context.fillStyle = config?.colors?.ink || "#25221e";
  context.font = '600 64px "Cormorant Garamond", Georgia, serif';
  const lines = wrapText(context, wish.label, 520, 3);
  lines.forEach((line, index) => {
    context.fillText(line, 1060, 1160 + index * 58);
  });

  const copyY = 1160 + lines.length * 58 + 16;
  context.fillStyle = "#675f55";
  context.font = '500 22px "Avenir Next", sans-serif';
  context.fillText(`gửi ${recipient},`, 1060, copyY);

  if (signature.visible) {
    context.fillStyle = config?.colors?.rose || "#8f3146";
    context.font = '600 38px "Dancing Script", "Segoe Print", cursive';
    context.fillText(signature.name, 1060, copyY + 43);
  }
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Trình duyệt chưa thể tạo bưu thiếp."));
      },
      "image/png",
      1,
    );
  });
}

export async function renderPostcard(state, config = {}) {
  if (typeof document === "undefined") {
    throw new Error("Bưu thiếp chỉ có thể được tạo trong trình duyệt.");
  }
  await document.fonts?.load(
    '600 62px "Dancing Script"',
    "Một ngày tháng tám gửi riêng cho em",
  );
  const canvas = document.createElement("canvas");
  canvas.width = POSTCARD_SIZE.width;
  canvas.height = POSTCARD_SIZE.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt chưa hỗ trợ Canvas.");

  drawPaper(context, canvas.width, canvas.height, config);
  await drawFlowers(context, state.flowers, config.assets, "back");

  const photoRect = { x: 145, y: 145, width: 815, height: 1000 };
  const drewPhoto = await drawPhoto(
    context,
    state.photo,
    state.frameId || state.photo?.frameId || "torn-paper",
    photoRect,
  );

  if (!drewPhoto) {
    const placeholder = context.createRadialGradient(560, 470, 20, 560, 470, 480);
    placeholder.addColorStop(0, "rgba(217,166,174,0.34)");
    placeholder.addColorStop(1, "rgba(238,226,208,0.94)");
    context.fillStyle = placeholder;
    context.fillRect(photoRect.x, photoRect.y, photoRect.width, photoRect.height);
    context.fillStyle = "#675f55";
    context.textAlign = "center";
    context.font = '600 62px "Dancing Script", "Segoe Print", cursive';
    context.fillText("Một ngày tháng tám", 552, 635);
  }

  await drawFlowers(context, state.flowers, config.assets, "front");
  drawCopy(context, state, config);
  return canvasToBlob(canvas);
}
