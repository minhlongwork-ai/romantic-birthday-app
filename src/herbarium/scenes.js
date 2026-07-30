import { ANCHORS, createInitialArrangement, moveFlowerToAnchor, toggleFlowerLayer } from "./arrangement-engine.js";
import { APP_CONFIG, BOTANICALS, FRAMES, WISHES, getWish } from "./config.js";
import {
  decodeAndDownscalePhoto,
  disposePhoto,
  validatePhoto,
} from "./photo-engine.js";
import { renderPostcard } from "./postcard-renderer.js";

const STAGE_TOTAL = 7;
const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const PHOTO_MAX_BYTES = 15 * 1024 * 1024;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function botanicalPicture(botanical, className = "", attributes = "") {
  if (!botanical) return "";
  return `
    <picture class="${className}" ${attributes}>
      <source srcset="${botanical.asset}" type="image/webp">
      <img src="${botanical.fallbackAsset}" alt="${escapeHtml(botanical.alt || "")}" draggable="false">
    </picture>
  `;
}

function createScene(root, context, options) {
  const {
    id,
    stage,
    eyebrow,
    title,
    body = "",
    showBack = stage > 1,
    className = "",
  } = options;
  const controller = new AbortController();
  const { signal } = controller;
  const scene = document.createElement("section");

  scene.className = `herbarium-scene herbarium-scene--${id} ${className}`.trim();
  scene.dataset.scene = id;
  scene.dataset.reducedMotion = String(Boolean(context.reducedMotion));
  scene.setAttribute("aria-labelledby", `${id}-title`);
  scene.innerHTML = `
    <div class="herbarium-scene__grain" aria-hidden="true"></div>
    <header class="scene-chrome">
      ${
        showBack
          ? `<button class="scene-back" type="button" data-scene-back>
              <span aria-hidden="true">←</span>
              <span>Trở lại</span>
            </button>`
          : `<span class="scene-back scene-back--placeholder" aria-hidden="true"></span>`
      }
      <span class="scene-folio" aria-label="Trang ${stage} trong ${STAGE_TOTAL}">
        ${String(stage).padStart(2, "0")} <i></i> ${String(STAGE_TOTAL).padStart(2, "0")}
      </span>
    </header>
    <div class="herbarium-scene__content">
      <div class="scene-copy">
        <p class="scene-eyebrow">${eyebrow}</p>
        <h1 id="${id}-title" tabindex="-1">${title}</h1>
        ${body ? `<div class="scene-body">${body}</div>` : ""}
      </div>
      <div class="scene-stage" data-scene-stage></div>
    </div>
  `;

  root.replaceChildren(scene);
  scene.querySelector("[data-scene-back]")?.addEventListener("click", context.back, { signal });

  requestAnimationFrame(() => {
    scene.querySelector("h1")?.focus({ preventScroll: true });
  });

  return {
    scene,
    stage: scene.querySelector("[data-scene-stage]"),
    signal,
    cleanup() {
      controller.abort();
    },
  };
}

function buttonMarkup(label, attributes = "", className = "button button--primary") {
  return `<button class="${className}" type="button" ${attributes}>${label}</button>`;
}

function renderPhotoFrame(photo, frameId, className = "") {
  if (!photo?.objectUrl) {
    return `
      <div class="photo-placeholder ${className}" aria-hidden="true">
        <span>08</span>
        <i></i>
      </div>
    `;
  }

  const crop = photo.crop ?? {};
  const zoom = clamp(Number(crop.zoom) || 1, 1, 2.5);
  const x = clamp(Number(crop.x) || 0, -0.5, 0.5);
  const y = clamp(Number(crop.y) || 0, -0.5, 0.5);
  const rotation = [-3, 0, 3].includes(Number(crop.rotation)) ? Number(crop.rotation) : 0;

  return `
    <figure
      class="photo-frame photo-frame--${escapeHtml(frameId || "torn-paper")} ${className}"
      style="--photo-x:${x * 28}%;--photo-y:${y * 28}%;--photo-zoom:${zoom};--photo-rotation:${rotation}deg"
    >
      <img src="${photo.objectUrl}" alt="Ảnh người nhận chụp cùng bó hoa" draggable="false">
    </figure>
  `;
}

function mountEnvelope(root, context) {
  const view = createScene(root, context, {
    id: "envelope",
    stage: 1,
    eyebrow: "Một lá thư tháng Tám",
    title: `Gửi ${escapeHtml(context.state.recipient)},<br>một tháng dịu dàng.`,
    showBack: false,
  });
  let startX = 0;
  let progress = 0;
  let dragging = false;
  let opened = false;
  let transitionTimer = 0;

  view.stage.innerHTML = `
    <div class="envelope-table">
      ${botanicalPicture(BOTANICALS.olive, "envelope-sprig envelope-sprig--olive", 'aria-hidden="true"')}
      ${botanicalPicture(BOTANICALS.poppy, "envelope-sprig envelope-sprig--poppy", 'aria-hidden="true"')}
      <div class="envelope" data-envelope>
        <div class="envelope__back"></div>
        <div class="envelope__letter" aria-hidden="true">
          <span>Tháng Tám</span>
        </div>
        <div class="envelope__front"></div>
        <div class="envelope__flap"></div>
        <button
          class="wax-seal"
          type="button"
          data-wax-seal
          aria-label="Kéo con dấu sang phải hoặc nhấn để mở thư"
        >
          <span aria-hidden="true">A</span>
        </button>
      </div>
      <p class="gesture-hint" data-envelope-hint>
        <span aria-hidden="true">↝</span>
        Kéo con dấu sang phải
      </p>
      ${buttonMarkup("Mở thư", "data-open-envelope", "button button--text envelope-open-button")}
    </div>
  `;

  const envelope = view.scene.querySelector("[data-envelope]");
  const seal = view.scene.querySelector("[data-wax-seal]");
  const hint = view.scene.querySelector("[data-envelope-hint]");

  function setProgress(next) {
    progress = clamp(next, 0, 1);
    seal.style.setProperty("--seal-progress", String(progress));
    envelope.style.setProperty("--open-progress", String(progress));
    hint.hidden = progress > 0.12;
  }

  function finish() {
    if (opened) return;
    opened = true;
    setProgress(1);
    envelope.classList.add("is-open");
    context.announce("Phong thư đã mở.");
    const delay = context.reducedMotion ? 180 : 760;
    transitionTimer = window.setTimeout(() => context.navigate("letter"), delay);
  }

  seal.addEventListener(
    "pointerdown",
    (event) => {
      if (opened) return;
      dragging = true;
      startX = event.clientX - progress * Math.min(window.innerWidth * 0.34, 190);
      seal.setPointerCapture(event.pointerId);
      envelope.classList.add("is-dragging");
    },
    { signal: view.signal },
  );

  seal.addEventListener(
    "pointermove",
    (event) => {
      if (!dragging || opened) return;
      const distance = Math.min(window.innerWidth * 0.34, 190);
      setProgress((event.clientX - startX) / distance);
    },
    { signal: view.signal },
  );

  seal.addEventListener(
    "pointerup",
    () => {
      if (!dragging) return;
      dragging = false;
      envelope.classList.remove("is-dragging");
      if (progress >= 0.64) finish();
      else setProgress(0);
    },
    { signal: view.signal },
  );

  seal.addEventListener("click", (event) => {
    if (event.detail === 0) finish();
  }, { signal: view.signal });
  view.scene.querySelector("[data-open-envelope]").addEventListener("click", finish, {
    signal: view.signal,
  });

  return () => {
    window.clearTimeout(transitionTimer);
    view.cleanup();
  };
}

function mountLetter(root, context) {
  const recipient = escapeHtml(context.state.recipient);
  const view = createScene(root, context, {
    id: "letter",
    stage: 2,
    eyebrow: "Lời chúc đầu tháng",
    title: "Có những điều nhỏ,<br>nhưng đủ làm một tháng trở nên đẹp.",
    body: `
      <p>Tháng Tám này, mong ${recipient} gặp thật nhiều điều dịu dàng.</p>
      <p>Và khi bó hoa đến tay, hãy giữ lại một khoảnh khắc cùng nó nhé.</p>
    `,
  });
  let startY = 0;

  view.stage.innerHTML = `
    <article class="letter-sheet" data-letter-sheet>
      <span class="letter-sheet__date">tháng 08</span>
      <blockquote>
        “Một lời chúc không cần thật lớn.<br>
        Chỉ cần đến đúng lúc.”
      </blockquote>
      <div class="letter-sheet__signature">gửi riêng cho ${recipient}</div>
      ${botanicalPicture(BOTANICALS.white, "letter-sheet__flower", 'aria-hidden="true"')}
      <button class="letter-sheet__continue" type="button" data-letter-continue>
        Xem điều dành cho em
        <span aria-hidden="true">↓</span>
      </button>
    </article>
  `;

  const sheet = view.scene.querySelector("[data-letter-sheet]");
  const advance = () => context.navigate("wishes");

  sheet.addEventListener("pointerdown", (event) => {
    startY = event.clientY;
  }, { signal: view.signal });
  sheet.addEventListener("pointerup", (event) => {
    if (startY - event.clientY > 52) advance();
  }, { signal: view.signal });
  view.scene.querySelector("[data-letter-continue]").addEventListener("click", advance, {
    signal: view.signal,
  });

  return view.cleanup;
}

function mountWishes(root, context) {
  const view = createScene(root, context, {
    id: "wishes",
    stage: 3,
    eyebrow: "Chọn một điều để mang theo",
    title: "Tháng Tám này,<br>em muốn giữ điều gì nhất?",
    body: "<p>Mỗi bông hoa giữ một lời chúc. Chọn bông khiến em muốn dừng lại lâu hơn.</p>",
  });

  view.stage.innerHTML = `
    <div class="wish-gallery" role="radiogroup" aria-label="Ba lời chúc tháng Tám">
      ${WISHES.map(
        (wish, index) => `
          <button
            class="wish-specimen"
            type="button"
            role="radio"
            aria-checked="${context.state.wishId === wish.id}"
            data-wish-id="${wish.id}"
            style="--specimen-index:${index}"
          >
            <span class="wish-specimen__number">0${index + 1}</span>
            ${botanicalPicture(wish, "wish-specimen__flower", 'aria-hidden="true"')}
            <span class="wish-specimen__copy">
              <small>${wish.name}</small>
              <strong>${wish.label}</strong>
              <span>${wish.description}</span>
            </span>
          </button>
        `,
      ).join("")}
    </div>
    <div class="scene-actions scene-actions--center">
      ${buttonMarkup(
        "Mang điều này theo",
        `data-confirm-wish ${context.state.wishId ? "" : "disabled"}`,
      )}
    </div>
  `;

  const confirm = view.scene.querySelector("[data-confirm-wish]");
  const choices = [...view.scene.querySelectorAll("[data-wish-id]")];

  function selectWish(wishId) {
    context.state.wishId = wishId;
    choices.forEach((choice) => {
      const selected = choice.dataset.wishId === wishId;
      choice.setAttribute("aria-checked", String(selected));
      choice.classList.toggle("is-selected", selected);
    });
    confirm.disabled = false;
    context.announce(`Đã chọn: ${getWish(wishId).label}.`);
  }

  choices.forEach((choice) => {
    choice.addEventListener("click", () => selectWish(choice.dataset.wishId), {
      signal: view.signal,
    });
    if (choice.dataset.wishId === context.state.wishId) choice.classList.add("is-selected");
  });

  confirm.addEventListener("click", () => {
    if (!context.state.wishId) return;
    context.navigate("photo-prompt");
  }, { signal: view.signal });

  return view.cleanup;
}

function mountPhotoPrompt(root, context) {
  const view = createScene(root, context, {
    id: "photo-prompt",
    stage: 4,
    eyebrow: "Một nhiệm vụ nhỏ",
    title: "Bó hoa đã đến rồi chứ?",
    body: `
      <p>Chụp một tấm cùng hoa nhé. Khoảnh khắc ấy sẽ trở thành trang cuối của thiệp tháng Tám này.</p>
    `,
  });

  view.stage.innerHTML = `
    <div class="photo-invitation">
      <div class="photo-invitation__viewfinder" aria-hidden="true">
        <span class="viewfinder-corner viewfinder-corner--tl"></span>
        <span class="viewfinder-corner viewfinder-corner--tr"></span>
        <span class="viewfinder-corner viewfinder-corner--bl"></span>
        <span class="viewfinder-corner viewfinder-corner--br"></span>
        <div class="viewfinder-portrait">
          <i></i>
          <span></span>
        </div>
        ${botanicalPicture(BOTANICALS.dahlia, "viewfinder-flower", 'aria-hidden="true"')}
      </div>
      <aside class="photo-tips" aria-labelledby="photo-tips-title">
        <p id="photo-tips-title">Ba gợi ý để ảnh thật đẹp</p>
        <ol>
          <li><span>01</span> Đứng gần cửa sổ.</li>
          <li><span>02</span> Cầm bó hoa hơi lệch sang một bên.</li>
          <li><span>03</span> Chụp dọc và chừa khoảng trống quanh người.</li>
        </ol>
      </aside>
      <p class="privacy-note">
        <span aria-hidden="true">○</span>
        Ảnh chỉ được xử lý trên thiết bị này.
      </p>
      <p class="inline-status" data-photo-status role="status"></p>
      <div class="scene-actions scene-actions--wrap">
        ${buttonMarkup("Chụp cùng bó hoa", "data-take-photo")}
        ${buttonMarkup("Chọn ảnh có sẵn", "data-pick-photo", "button button--secondary")}
        ${buttonMarkup("Để sau", "data-skip-photo", "button button--text")}
      </div>
      <input hidden data-camera-input type="file" accept="${PHOTO_ACCEPT}" capture="user">
      <input hidden data-library-input type="file" accept="${PHOTO_ACCEPT}">
    </div>
  `;

  const cameraInput = view.scene.querySelector("[data-camera-input]");
  const libraryInput = view.scene.querySelector("[data-library-input]");
  const status = view.scene.querySelector("[data-photo-status]");
  const buttons = [...view.scene.querySelectorAll(".scene-actions button")];

  function setBusy(busy) {
    buttons.forEach((button) => {
      button.disabled = busy;
    });
    view.scene.classList.toggle("is-busy", busy);
  }

  async function useFile(file) {
    if (!file) return;
    setBusy(true);
    status.textContent = "Đang đặt ảnh vào trang giấy…";
    try {
      validatePhoto(file, { maxBytes: PHOTO_MAX_BYTES });
      const decoded = await decodeAndDownscalePhoto(file, { maxEdge: 2048 });
      disposePhoto(context.state.photo);
      context.state.photo = {
        ...decoded,
        crop: { x: 0, y: 0, zoom: 1, rotation: 0 },
        frameId: context.state.frameId || "torn-paper",
      };
      status.textContent = "Ảnh đã sẵn sàng.";
      context.announce("Ảnh đã sẵn sàng để căn chỉnh.");
      context.navigate("photo-editor");
    } catch (error) {
      const friendly =
        error?.code === "file-too-large"
          ? "Ảnh lớn hơn 15 MB. Hãy chọn một ảnh nhẹ hơn."
          : error?.code === "unsupported-format"
            ? "Trình duyệt chưa đọc được ảnh này. Hãy chọn JPG, PNG hoặc WebP."
            : error?.message || "Không thể đọc ảnh. Hãy chọn ảnh khác hoặc để sau.";
      status.textContent = friendly;
      context.announce(friendly);
      setBusy(false);
    }
  }

  view.scene.querySelector("[data-take-photo]").addEventListener("click", () => cameraInput.click(), {
    signal: view.signal,
  });
  view.scene.querySelector("[data-pick-photo]").addEventListener("click", () => libraryInput.click(), {
    signal: view.signal,
  });
  cameraInput.addEventListener("change", () => useFile(cameraInput.files?.[0]), {
    signal: view.signal,
  });
  libraryInput.addEventListener("change", () => useFile(libraryInput.files?.[0]), {
    signal: view.signal,
  });
  view.scene.querySelector("[data-skip-photo]").addEventListener("click", () => {
    disposePhoto(context.state.photo);
    context.state.photo = null;
    context.state.flowers = createInitialArrangement(context.state.wishId);
    context.navigate("herbarium");
  }, { signal: view.signal });

  return view.cleanup;
}

function mountPhotoEditor(root, context) {
  if (!context.state.photo?.objectUrl) {
    queueMicrotask(() => {
      context.navigate("photo-prompt", { replace: true });
    });
    return () => {};
  }

  const view = createScene(root, context, {
    id: "photo-editor",
    stage: 5,
    eyebrow: "Căn lại khoảnh khắc",
    title: "Để em và bó hoa<br>ở đúng giữa trang.",
    body: "<p>Kéo ảnh để căn vị trí, phóng to vừa đủ và chọn một kiểu khung.</p>",
  });
  const photo = context.state.photo;
  photo.crop ??= { x: 0, y: 0, zoom: 1, rotation: 0 };
  const pointers = new Map();
  let pinchDistance = 0;

  view.stage.innerHTML = `
    <div class="photo-editor">
      <div class="photo-editor__preview">
        <div
          class="photo-cropper photo-frame--${escapeHtml(photo.frameId || context.state.frameId)}"
          data-photo-cropper
          aria-label="Ảnh đang được căn chỉnh"
        >
          <img src="${photo.objectUrl}" alt="Ảnh đã chọn để đặt vào postcard" draggable="false">
          <span class="photo-cropper__guide" aria-hidden="true"></span>
        </div>
      </div>
      <div class="photo-editor__controls">
        <div class="control-group">
          <label for="photo-zoom">Phóng to</label>
          <input id="photo-zoom" data-photo-zoom type="range" min="1" max="2.5" step="0.05" value="${photo.crop.zoom}">
        </div>
        <fieldset class="control-group control-group--inline">
          <legend>Góc ảnh</legend>
          ${[-3, 0, 3]
            .map(
              (rotation) => `
                <button
                  class="choice-chip ${photo.crop.rotation === rotation ? "is-selected" : ""}"
                  type="button"
                  data-photo-rotation="${rotation}"
                  aria-pressed="${photo.crop.rotation === rotation}"
                >${rotation > 0 ? "+" : ""}${rotation}°</button>
              `,
            )
            .join("")}
        </fieldset>
        <fieldset class="control-group control-group--inline">
          <legend>Kiểu khung</legend>
          ${FRAMES.map(
            (frame) => `
              <button
                class="choice-chip ${photo.frameId === frame.id ? "is-selected" : ""}"
                type="button"
                data-photo-frame="${frame.id}"
                aria-pressed="${photo.frameId === frame.id}"
              >${frame.label}</button>
            `,
          ).join("")}
        </fieldset>
        <div class="scene-actions scene-actions--wrap">
          ${buttonMarkup("Dùng ảnh này", "data-confirm-photo")}
          ${buttonMarkup("Đặt lại", "data-reset-photo", "button button--text")}
        </div>
      </div>
    </div>
  `;

  const cropper = view.scene.querySelector("[data-photo-cropper]");
  const image = cropper.querySelector("img");
  const zoom = view.scene.querySelector("[data-photo-zoom]");
  const rotationButtons = [...view.scene.querySelectorAll("[data-photo-rotation]")];
  const frameButtons = [...view.scene.querySelectorAll("[data-photo-frame]")];

  function applyCrop() {
    const crop = photo.crop;
    crop.x = clamp(Number(crop.x) || 0, -0.5, 0.5);
    crop.y = clamp(Number(crop.y) || 0, -0.5, 0.5);
    crop.zoom = clamp(Number(crop.zoom) || 1, 1, 2.5);
    crop.rotation = [-3, 0, 3].includes(Number(crop.rotation)) ? Number(crop.rotation) : 0;
    cropper.style.setProperty("--photo-x", `${crop.x * 28}%`);
    cropper.style.setProperty("--photo-y", `${crop.y * 28}%`);
    cropper.style.setProperty("--photo-zoom", String(crop.zoom));
    cropper.style.setProperty("--photo-rotation", `${crop.rotation}deg`);
    zoom.value = String(crop.zoom);
    image.style.transform =
      `translate(${crop.x * 28}%, ${crop.y * 28}%) scale(${crop.zoom}) rotate(${crop.rotation}deg)`;
  }

  function pointerDistance() {
    const values = [...pointers.values()];
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  }

  cropper.addEventListener("pointerdown", (event) => {
    cropper.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinchDistance = pointerDistance();
  }, { signal: view.signal });

  cropper.addEventListener("pointermove", (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1) {
      const bounds = cropper.getBoundingClientRect();
      photo.crop.x += (event.clientX - previous.x) / Math.max(bounds.width, 1);
      photo.crop.y += (event.clientY - previous.y) / Math.max(bounds.height, 1);
    } else {
      const nextDistance = pointerDistance();
      if (pinchDistance > 0) {
        photo.crop.zoom *= nextDistance / pinchDistance;
      }
      pinchDistance = nextDistance;
    }
    applyCrop();
  }, { signal: view.signal });

  function releasePointer(event) {
    pointers.delete(event.pointerId);
    pinchDistance = pointerDistance();
  }

  cropper.addEventListener("pointerup", releasePointer, { signal: view.signal });
  cropper.addEventListener("pointercancel", releasePointer, { signal: view.signal });
  zoom.addEventListener("input", () => {
    photo.crop.zoom = Number(zoom.value);
    applyCrop();
  }, { signal: view.signal });

  rotationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      photo.crop.rotation = Number(button.dataset.photoRotation);
      rotationButtons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      applyCrop();
    }, { signal: view.signal });
  });

  frameButtons.forEach((button) => {
    button.addEventListener("click", () => {
      photo.frameId = button.dataset.photoFrame;
      context.state.frameId = photo.frameId;
      cropper.className = `photo-cropper photo-frame--${photo.frameId}`;
      frameButtons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
    }, { signal: view.signal });
  });

  view.scene.querySelector("[data-reset-photo]").addEventListener("click", () => {
    photo.crop = { x: 0, y: 0, zoom: 1, rotation: 0 };
    photo.frameId = "torn-paper";
    context.state.frameId = photo.frameId;
    cropper.className = `photo-cropper photo-frame--${photo.frameId}`;
    frameButtons.forEach((item) => {
      const selected = item.dataset.photoFrame === photo.frameId;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    rotationButtons.forEach((item) => {
      const selected = Number(item.dataset.photoRotation) === 0;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    applyCrop();
  }, { signal: view.signal });

  view.scene.querySelector("[data-confirm-photo]").addEventListener("click", () => {
    context.state.flowers = createInitialArrangement(context.state.wishId);
    context.navigate("herbarium");
  }, { signal: view.signal });

  applyCrop();
  return view.cleanup;
}

function anchorList() {
  return Array.isArray(ANCHORS) ? ANCHORS : Object.values(ANCHORS);
}

function flowerPictureMarkup(flower) {
  const botanical = BOTANICALS[flower.botanicalId] ?? BOTANICALS.olive;
  const x = clamp(Number(flower.x) || 0.5, 0.03, 0.97);
  const y = clamp(Number(flower.y) || 0.5, 0.03, 0.97);
  return `
    <button
      class="arranged-flower arranged-flower--${escapeHtml(flower.role)}"
      type="button"
      data-arranged-flower="${escapeHtml(flower.id)}"
      aria-label="Di chuyển ${escapeHtml(botanical.alt)}"
      aria-pressed="false"
      style="--flower-x:${x * 100}%;--flower-y:${y * 100}%;--flower-layer:${flower.layer === "front" ? 4 : 1}"
    >
      ${botanicalPicture(botanical, "arranged-flower__asset", 'aria-hidden="true"')}
    </button>
  `;
}

function mountHerbarium(root, context) {
  const view = createScene(root, context, {
    id: "herbarium",
    stage: 6,
    eyebrow: "Tự tay giữ lại khoảnh khắc",
    title: "Đặt những cành hoa<br>quanh trang giấy.",
    body: "<p>Kéo hoa đến nơi em thích. Trang giấy sẽ tự giữ chúng ở một vị trí đẹp.</p>",
  });
  context.state.pressed = false;
  if (!context.state.flowers?.length) {
    context.state.flowers = createInitialArrangement(context.state.wishId);
  }
  let selectedId = context.state.flowers[0]?.id ?? null;
  let pressTimer = 0;
  let transitionTimer = 0;
  let pressing = false;

  view.stage.innerHTML = `
    <div class="arrangement-workspace">
      <div class="herbarium-page" data-herbarium-page>
        <span class="herbarium-page__caption">August, pressed gently</span>
        ${renderPhotoFrame(context.state.photo, context.state.frameId, "herbarium-page__photo")}
        <blockquote class="herbarium-page__quote ${context.state.photo ? "is-small" : ""}">
          “Một ngày tháng Tám<br>có em và hoa.”
        </blockquote>
        <div class="arranged-flowers" data-arranged-flowers></div>
        <div class="pressed-glow" aria-hidden="true"></div>
      </div>
      <aside class="arrangement-controls" aria-labelledby="arrangement-controls-title">
        <p id="arrangement-controls-title">Đặt cành đang chọn</p>
        <div class="anchor-grid">
          ${anchorList()
            .map(
              (anchor) => `
                <button type="button" data-anchor-id="${anchor.id}">
                  <span aria-hidden="true"></span>
                  ${anchor.label}
                </button>
              `,
            )
            .join("")}
        </div>
        <button class="layer-toggle" type="button" data-toggle-layer>
          Đưa ra trước ảnh
        </button>
        <div class="press-area">
          <button class="press-button" type="button" data-press-flowers>
            <span class="press-button__progress" aria-hidden="true"></span>
            <span class="press-button__label">${
              context.reducedMotion ? "Ép hoa" : "Nhấn giữ để ép hoa"
            }</span>
          </button>
          <p data-press-status>${
            context.reducedMotion
              ? "Chạm một lần để giữ hoa trên trang."
              : "Giữ đến khi vòng tròn khép lại."
          }</p>
        </div>
      </aside>
    </div>
  `;

  const page = view.scene.querySelector("[data-herbarium-page]");
  const flowerContainer = view.scene.querySelector("[data-arranged-flowers]");
  const layerToggle = view.scene.querySelector("[data-toggle-layer]");
  const pressButton = view.scene.querySelector("[data-press-flowers]");
  const pressStatus = view.scene.querySelector("[data-press-status]");

  function selectedFlower() {
    return context.state.flowers.find((flower) => flower.id === selectedId);
  }

  function updateControls() {
    const flower = selectedFlower();
    layerToggle.textContent =
      flower?.layer === "front" ? "Đưa ra sau ảnh" : "Đưa ra trước ảnh";
    view.scene.querySelectorAll("[data-anchor-id]").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.anchorId === flower?.anchorId);
    });
  }

  function nearestAnchor(clientX, clientY) {
    const bounds = page.getBoundingClientRect();
    const x = clamp((clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1);
    const y = clamp((clientY - bounds.top) / Math.max(bounds.height, 1), 0, 1);
    return anchorList().reduce((closest, anchor) => {
      const distance = Math.hypot(anchor.x - x, anchor.y - y);
      return !closest || distance < closest.distance ? { anchor, distance } : closest;
    }, null)?.anchor;
  }

  function renderFlowers() {
    flowerContainer.innerHTML = context.state.flowers.map(flowerPictureMarkup).join("");
    flowerContainer.querySelectorAll("[data-arranged-flower]").forEach((button) => {
      const flowerId = button.dataset.arrangedFlower;
      button.classList.toggle("is-selected", flowerId === selectedId);
      button.setAttribute("aria-pressed", String(flowerId === selectedId));
      let dragged = false;

      button.addEventListener("click", () => {
        selectedId = flowerId;
        renderFlowers();
        updateControls();
      }, { signal: view.signal });
      button.addEventListener("pointerdown", (event) => {
        selectedId = flowerId;
        dragged = true;
        button.setPointerCapture(event.pointerId);
        button.classList.add("is-dragging");
      }, { signal: view.signal });
      button.addEventListener("pointermove", (event) => {
        if (!dragged) return;
        const bounds = page.getBoundingClientRect();
        button.style.setProperty(
          "--flower-x",
          `${clamp((event.clientX - bounds.left) / bounds.width, 0.03, 0.97) * 100}%`,
        );
        button.style.setProperty(
          "--flower-y",
          `${clamp((event.clientY - bounds.top) / bounds.height, 0.03, 0.97) * 100}%`,
        );
      }, { signal: view.signal });
      button.addEventListener("pointerup", (event) => {
        if (!dragged) return;
        dragged = false;
        const anchor = nearestAnchor(event.clientX, event.clientY);
        if (anchor) {
          context.state.flowers = moveFlowerToAnchor(
            context.state.flowers,
            flowerId,
            anchor.id,
          );
          context.announce(`Đã đặt cành hoa ở ${anchor.label.toLocaleLowerCase("vi")}.`);
        }
        renderFlowers();
        updateControls();
      }, { signal: view.signal });
    });
  }

  view.scene.querySelectorAll("[data-anchor-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!selectedId) return;
      context.state.flowers = moveFlowerToAnchor(
        context.state.flowers,
        selectedId,
        button.dataset.anchorId,
      );
      renderFlowers();
      updateControls();
    }, { signal: view.signal });
  });

  layerToggle.addEventListener("click", () => {
    if (!selectedId) return;
    context.state.flowers = toggleFlowerLayer(context.state.flowers, selectedId);
    renderFlowers();
    updateControls();
  }, { signal: view.signal });

  function completePress() {
    if (context.state.pressed) return;
    pressing = false;
    context.state.pressed = true;
    window.clearTimeout(pressTimer);
    page.classList.add("is-pressed");
    pressButton.classList.add("is-complete");
    pressStatus.textContent = "Những cành hoa đã nằm lại trên trang.";
    context.announce("Trang herbarium đã hoàn thành.");
    transitionTimer = window.setTimeout(
      () => context.navigate("finale"),
      context.reducedMotion ? 180 : 880,
    );
  }

  function startPress() {
    if (pressing || context.state.pressed) return;
    pressing = true;
    pressButton.classList.add("is-pressing");
    if (context.reducedMotion) {
      completePress();
      return;
    }
    pressTimer = window.setTimeout(completePress, 900);
  }

  function cancelPress() {
    if (!pressing || context.state.pressed) return;
    pressing = false;
    window.clearTimeout(pressTimer);
    pressButton.classList.remove("is-pressing");
    pressStatus.textContent = "Giữ thêm một chút để ép hoa.";
  }

  pressButton.addEventListener("pointerdown", startPress, { signal: view.signal });
  pressButton.addEventListener("pointerup", cancelPress, { signal: view.signal });
  pressButton.addEventListener("pointercancel", cancelPress, { signal: view.signal });
  pressButton.addEventListener("pointerleave", cancelPress, { signal: view.signal });
  pressButton.addEventListener("click", (event) => {
    if (event.detail === 0) completePress();
  }, { signal: view.signal });

  renderFlowers();
  updateControls();

  return () => {
    window.clearTimeout(pressTimer);
    window.clearTimeout(transitionTimer);
    view.cleanup();
  };
}

function finalFlowerMarkup(flower) {
  const botanical = BOTANICALS[flower.botanicalId] ?? BOTANICALS.olive;
  return `
    <span
      class="final-flower final-flower--${escapeHtml(flower.role)}"
      style="--flower-x:${flower.x * 100}%;--flower-y:${flower.y * 100}%;--flower-layer:${flower.layer === "front" ? 4 : 1}"
      aria-hidden="true"
    >
      ${botanicalPicture(botanical, "final-flower__asset")}
    </span>
  `;
}

function mountFinale(root, context) {
  const wish = getWish(context.state.wishId);
  const recipient = escapeHtml(context.state.recipient);
  const sender = escapeHtml(context.state.sender);
  const view = createScene(root, context, {
    id: "finale",
    stage: 7,
    eyebrow: "Trang cuối",
    title: "Một ngày tháng Tám<br>có em và hoa.",
    body: `
      <p>Mong tháng Tám mang đến cho ${recipient} <strong>${escapeHtml(wish.sentence)}</strong>.</p>
      <p>Hoa rồi sẽ khô, nhưng khoảnh khắc này thì có thể ở lại.</p>
    `,
  });
  let currentBlob = null;
  let busy = false;

  view.stage.innerHTML = `
    <div class="finale-layout">
      <article class="final-postcard" data-final-postcard>
        <span class="final-postcard__month">08</span>
        ${renderPhotoFrame(context.state.photo, context.state.frameId, "final-postcard__photo")}
        <div class="final-postcard__flowers">
          ${context.state.flowers.map(finalFlowerMarkup).join("")}
        </div>
        <div class="final-postcard__copy">
          <small>August herbarium</small>
          <strong>${escapeHtml(wish.label)}</strong>
          <p>gửi ${recipient},</p>
          <em>${sender}</em>
        </div>
      </article>
      <div class="finale-actions">
        <p class="finale-actions__note">Ảnh và postcard chỉ tồn tại trên thiết bị này.</p>
        <p class="inline-status" data-final-status role="status"></p>
        <div class="scene-actions scene-actions--wrap">
          ${buttonMarkup("Lưu postcard", "data-save-postcard")}
          ${buttonMarkup(
            "Chia sẻ",
            "data-share-postcard",
            "button button--secondary",
          )}
          ${buttonMarkup("Xem lại từ đầu", "data-replay", "button button--text")}
        </div>
      </div>
    </div>
  `;

  const status = view.scene.querySelector("[data-final-status]");
  const saveButton = view.scene.querySelector("[data-save-postcard]");
  const shareButton = view.scene.querySelector("[data-share-postcard]");
  const actionButtons = [...view.scene.querySelectorAll(".scene-actions button")];

  if (typeof navigator.share !== "function" || typeof File !== "function") {
    shareButton.hidden = true;
  }

  function setBusy(next) {
    busy = next;
    actionButtons.forEach((button) => {
      button.disabled = next;
    });
  }

  async function getBlob() {
    if (currentBlob) return currentBlob;
    setBusy(true);
    status.textContent = "Đang ép trang giấy thành postcard…";
    try {
      currentBlob = await renderPostcard(context.state, APP_CONFIG);
      if (!(currentBlob instanceof Blob)) throw new Error("Postcard không thể được tạo.");
      status.textContent = "Postcard đã sẵn sàng.";
      return currentBlob;
    } finally {
      setBusy(false);
    }
  }

  saveButton.addEventListener("click", async () => {
    if (busy) return;
    try {
      const blob = await getBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "thang-tam-o-lai.png";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = "Postcard tháng Tám đã được lưu.";
      context.announce(status.textContent);
    } catch (error) {
      status.textContent = error?.message || "Chưa thể tạo postcard. Hãy thử lại.";
      context.announce(status.textContent);
    }
  }, { signal: view.signal });

  shareButton.addEventListener("click", async () => {
    if (busy) return;
    try {
      const blob = await getBlob();
      const file = new File([blob], "thang-tam-o-lai.png", { type: "image/png" });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        throw new Error("Trình duyệt này chưa thể chia sẻ file. Hãy lưu postcard trước.");
      }
      await navigator.share({
        files: [file],
        title: APP_CONFIG.postcardTitle,
        text: "Một trang nhỏ của tháng Tám.",
      });
      status.textContent = "Postcard đã được mở trong bảng chia sẻ.";
    } catch (error) {
      if (error?.name === "AbortError") return;
      status.textContent = error?.message || "Chưa thể chia sẻ. Hãy lưu postcard trước.";
      context.announce(status.textContent);
    }
  }, { signal: view.signal });

  view.scene.querySelector("[data-replay]").addEventListener("click", context.restart, {
    signal: view.signal,
  });

  return () => {
    currentBlob = null;
    view.cleanup();
  };
}

export function createSceneMap() {
  return {
    envelope: mountEnvelope,
    letter: mountLetter,
    wishes: mountWishes,
    "photo-prompt": mountPhotoPrompt,
    "photo-editor": mountPhotoEditor,
    herbarium: mountHerbarium,
    finale: mountFinale,
  };
}
