import './fonts.css';
import './styles.css';

import rawGift from './content/gift.json';
import { normalizeGiftConfig } from './lib/gift-config.js';
import { createAudioController } from './lib/audio-controller.js';
import { createCameraController } from './lib/camera-controller.js';
import { createSceneController } from './lib/scene-controller.js';
import { createCakeScene } from './scenes/cake-scene.js';

const SCENE_LABELS = {
  intro: 'Bìa album',
  letter: 'Lá thư',
  cake: 'Điều ước sinh nhật',
  gallery: 'Những kỷ niệm',
  epilogue: 'Lời kết',
};

const safeSession = {
  get(key) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Session state is an enhancement, never a requirement.
    }
  },
  remove(key) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore storage restrictions.
    }
  },
};

function publicAssetUrl(path) {
  const base = new URL(import.meta.env.BASE_URL, globalThis.location.href);
  return new URL(String(path).replace(/^\/+/, ''), base).href;
}

function fingerprint(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

const gift = normalizeGiftConfig(rawGift, globalThis.location.search);
const giftSessionPrefix = `birthday:${fingerprint(
  JSON.stringify({
    source: rawGift,
    recipient: gift.recipient,
    sender: gift.sender,
    path: globalThis.location.pathname,
  }),
)}`;
const giftSession = {
  get(key) {
    return safeSession.get(`${giftSessionPrefix}:${key}`);
  },
  set(key, value) {
    safeSession.set(`${giftSessionPrefix}:${key}`, value);
  },
  remove(key) {
    safeSession.remove(`${giftSessionPrefix}:${key}`);
  },
};
gift.soundtrack.src = publicAssetUrl(gift.soundtrack.src);
gift.memories = gift.memories.map(memory => ({
  ...memory,
  src: publicAssetUrl(memory.src),
}));
const giftReveal = {
  ...gift.giftReveal,
  src: publicAssetUrl(gift.giftReveal.src),
  webpSrc: publicAssetUrl(gift.giftReveal.src.replace(/\.jpg$/i, '.webp')),
  avifSrc: publicAssetUrl(gift.giftReveal.src.replace(/\.jpg$/i, '.avif')),
};
const elements = {
  main: document.querySelector('#app-main'),
  back: document.querySelector('#back-button'),
  audioToggle: document.querySelector('#audio-toggle'),
  audioLabel: document.querySelector('#audio-label'),
  audioIcon: document.querySelector('#audio-icon'),
  audioStatus: document.querySelector('#audio-status'),
  motionToggle: document.querySelector('#motion-toggle'),
  soundtrack: document.querySelector('#soundtrack'),
  lyrics: document.querySelector('#lyrics'),
  announcer: document.querySelector('#app-announcer'),
  cameraVideo: document.querySelector('#camera-video'),
  cameraPreview: document.querySelector('#camera-preview'),
  cameraStatus: document.querySelector('#camera-status'),
  cameraToggle: document.querySelector('[data-action="enable-camera"]'),
  galleryError: document.querySelector('#gallery-load-error'),
};

function applyTemplate(value) {
  if (typeof value !== 'string') return value;
  return value
    .replaceAll('{{recipient}}', gift.recipient.name)
    .replaceAll('{{age}}', String(gift.recipient.age))
    .replaceAll('{{sender}}', gift.sender.name);
}

function renderPersonalContent() {
  document.title = `Một cuốn album dành cho ${gift.recipient.name}`;
  document.querySelector('#recipient-name').textContent = gift.recipient.name;
  document.querySelector('#cover-signature').textContent = `— ${gift.sender.name}`;
  document.querySelector('#letter-greeting').textContent = applyTemplate(
    gift.letter.greeting,
  );

  const letterCopy = document.querySelector('#letter-copy');
  letterCopy.replaceChildren();
  gift.letter.paragraphs.forEach(paragraph => {
    const element = document.createElement('p');
    element.textContent = applyTemplate(paragraph);
    letterCopy.append(element);
  });
  document.querySelector('#letter-closing').textContent = applyTemplate(
    gift.letter.closing,
  );
  document.querySelector('#epilogue-title').textContent = applyTemplate(
    gift.epilogue.heading,
  );
  document.querySelector('#epilogue-message').textContent = applyTemplate(
    gift.epilogue.message,
  );
  document.querySelector('#final-signature').textContent = `— ${gift.sender.name}`;

  elements.soundtrack.src = gift.soundtrack.src;
  elements.soundtrack.loop = gift.soundtrack.loop !== false;
  elements.lyrics.hidden = !gift.features.lyrics;
  document.querySelector('#camera-consent').hidden =
    !gift.features.cameraGestures;
  document.querySelector('[data-action="download-postcard"]').hidden =
    !gift.features.postcard;
  document.querySelector('#gift-reveal-status').textContent =
    giftReveal.caption;
}

let reducedMotion =
  safeSession.get('birthday:reduced-motion') === 'true' ||
  globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

function renderMotionPreference() {
  document.body.classList.toggle('reduced-motion', reducedMotion);
  elements.motionToggle.setAttribute('aria-pressed', String(reducedMotion));
  elements.motionToggle.setAttribute(
    'aria-label',
    reducedMotion ? 'Bật chuyển động đầy đủ' : 'Giảm chuyển động',
  );
}

function renderAudioState({ playing, error }) {
  elements.audioToggle.setAttribute('aria-pressed', String(playing));
  elements.audioToggle.setAttribute('aria-label', playing ? 'Tạm dừng nhạc' : 'Bật nhạc');
  elements.audioLabel.textContent = playing ? 'Tạm dừng' : 'Nhạc';
  elements.audioIcon.textContent = playing ? 'Ⅱ' : '♪';
  if (error) {
    elements.audioStatus.textContent =
      'Không thể phát nhạc trên thiết bị này. Em vẫn có thể tiếp tục cuốn album.';
  } else {
    elements.audioStatus.textContent = playing
      ? 'Nhạc nền đang phát.'
      : 'Nhạc nền đang tạm dừng.';
  }
}

const audioController = createAudioController({
  audio: elements.soundtrack,
  lyrics: gift.features.lyrics ? gift.soundtrack.lyrics : [],
  lyricsElement: gift.features.lyrics ? elements.lyrics : null,
  onStateChange: renderAudioState,
});

const cakeScene = createCakeScene({
  container: document.querySelector('#cake-stage'),
  loadingElement: document.querySelector('#cake-loading'),
  fallbackElement: document.querySelector('#cake-fallback'),
  countElement: document.querySelector('#candle-count'),
  blowButton: document.querySelector('[data-action="blow-candle"]'),
  continueButton: document.querySelector('[data-action="to-gallery"]'),
  giftRevealStatus: document.querySelector('#gift-reveal-status'),
  giftElement: document.querySelector('#gift-product-visual'),
  giftImage: document.querySelector('#gift-product-image'),
  giftAvifSource: document.querySelector('#gift-product-avif'),
  giftWebpSource: document.querySelector('#gift-product-webp'),
  gift: giftReveal,
  age: gift.recipient.age,
  reducedMotion: () => reducedMotion,
  onComplete: () => {
    elements.announcer.textContent =
      'Tất cả nến đã tắt. Món quà Swarovski Dancing Swan đã xuất hiện và trang kỷ niệm đã sẵn sàng.';
  },
});

function renderCameraStatus(status) {
  const messages = {
    idle: 'Camera đang tắt. Chạm để thổi nến vẫn luôn hoạt động.',
    requesting: 'Đang chờ quyền truy cập camera…',
    active: 'Camera đã bật. Hãy vẫy tay nhẹ để thổi từng ngọn nến.',
    searching: 'Camera đang tìm bàn tay của em…',
    tracking: 'Đã thấy bàn tay. Vẫy nhẹ để thổi nến.',
    denied: 'Camera bị từ chối. Em có thể dùng nút chạm để tiếp tục.',
    unsupported: 'Thiết bị này không hỗ trợ camera. Nút chạm vẫn hoạt động.',
    error: 'Không thể mở camera. Nút chạm vẫn hoạt động.',
    'processing-error': 'Nhận diện cử chỉ bị gián đoạn. Hãy dùng nút chạm.',
    paused: 'Camera tạm dừng khi tab bị ẩn và sẽ bật lại khi em quay về.',
    stopped: 'Camera đã dừng.',
  };

  elements.cameraStatus.textContent = messages[status] || messages.error;
  const visible = ['active', 'searching', 'tracking'].includes(status);
  elements.cameraPreview.hidden = !visible;
  elements.cameraToggle.disabled = status === 'requesting';
  elements.cameraToggle.setAttribute('aria-pressed', String(visible));
  elements.cameraToggle.textContent =
    status === 'requesting'
      ? 'Đang bật camera…'
      : visible
        ? 'Dừng camera'
        : ['paused', 'stopped'].includes(status)
          ? 'Bật lại cử chỉ'
          : 'Dùng cử chỉ';
}

const cameraController = createCameraController({
  video: elements.cameraVideo,
  onGesture: () => cakeScene.blowOne(),
  onStatus: renderCameraStatus,
});
let cameraOptedIn = false;
let resumeCameraWhenVisible = false;

async function startCamera() {
  const started = await cameraController.start();
  cameraOptedIn = started;
  return started;
}

function stopCamera({ preserveOptIn = false } = {}) {
  if (!preserveOptIn) cameraOptedIn = false;
  if (cameraController.engaged) cameraController.stop();
}

let galleryScene = null;
let galleryScenePromise = null;
let galleryReady = false;
let galleryLoadError = null;
let pendingGalleryMoves = 0;
let galleryActive = false;
let galleryGeneration = 0;

function readStoredMemoryIndex() {
  const storedIndex = Number(giftSession.get('memory'));
  if (!Number.isInteger(storedIndex)) return 0;
  return Math.max(0, Math.min(storedIndex, gift.memories.length - 1));
}

function getGalleryScene() {
  if (galleryScene) return Promise.resolve(galleryScene);
  if (!galleryScenePromise) {
    galleryScenePromise = import('./scenes/gallery-scene.js')
      .then(({ createGalleryScene }) => {
        galleryScene = createGalleryScene({
          memories: gift.memories,
          track: document.querySelector('#scrapbook-track'),
          viewport: document.querySelector('#scrapbook-viewport'),
          chapterTabs: document.querySelector('#chapter-tabs'),
          progress: document.querySelector('#gallery-progress'),
          dialog: document.querySelector('#lightbox'),
          dialogPicture: document.querySelector('#lightbox-picture'),
          dialogCaption: document.querySelector('#lightbox-caption'),
          dialogCounter: document.querySelector('#lightbox-counter'),
          closeButton: document.querySelector('#lightbox-close'),
          onProgress: index => giftSession.set('memory', String(index)),
        });
        return galleryScene;
      })
      .catch(error => {
        galleryScenePromise = null;
        throw error;
      });
  }
  return galleryScenePromise;
}

function applyPendingGalleryMoves(gallery) {
  const moves = pendingGalleryMoves;
  pendingGalleryMoves = 0;
  const move = moves < 0 ? () => gallery.previous() : () => gallery.next();
  for (let index = 0; index < Math.abs(moves); index += 1) move();
}

async function loadGallery(generation) {
  try {
    const gallery = await getGalleryScene();
    if (!galleryActive || generation !== galleryGeneration) return;
    gallery.enter({ startAt: readStoredMemoryIndex() });
    galleryReady = true;
    applyPendingGalleryMoves(gallery);
  } catch (error) {
    if (!galleryActive || generation !== galleryGeneration) return;
    galleryLoadError = error;
    pendingGalleryMoves = 0;
    document.querySelector('#gallery-progress').textContent =
      'Không thể tải ảnh lúc này';
    elements.galleryError.hidden = false;
    elements.announcer.textContent =
      'Không thể tải các ảnh lúc này. Em vẫn có thể quay lại, khép lại album hoặc tải phiên bản mới.';
  }
}

const sceneElements = Object.fromEntries(
  [...document.querySelectorAll('[data-scene]')].map(element => [
    element.dataset.scene,
    element,
  ]),
);

const scenes = {
  intro: {
    element: sceneElements.intro,
    enter() {
      document.body.dataset.theme = 'paper';
    },
  },
  letter: {
    element: sceneElements.letter,
    enter() {
      document.body.dataset.theme = 'paper';
    },
  },
  cake: {
    element: sceneElements.cake,
    enter() {
      document.body.dataset.theme = 'night';
      cameraOptedIn = false;
      resumeCameraWhenVisible = false;
      renderCameraStatus('idle');
      return cakeScene.enter();
    },
    exit() {
      resumeCameraWhenVisible = false;
      stopCamera();
      cakeScene.exit();
    },
  },
  gallery: {
    element: sceneElements.gallery,
    enter() {
      const generation = ++galleryGeneration;
      document.body.dataset.theme = 'paper';
      galleryActive = true;
      galleryReady = false;
      galleryLoadError = null;
      elements.galleryError.hidden = true;
      document.querySelector('#gallery-progress').textContent =
        'Đang mở các trang kỷ niệm…';
      // Loading must never keep the scene inert: Back and Finish stay usable
      // even if a deployment replaces or stalls this lazy chunk.
      void loadGallery(generation);
    },
    exit() {
      galleryGeneration += 1;
      galleryActive = false;
      galleryReady = false;
      pendingGalleryMoves = 0;
      galleryScene?.exit();
    },
  },
  epilogue: {
    element: sceneElements.epilogue,
    enter() {
      document.body.dataset.theme = 'paper';
    },
  },
};

const sceneController = createSceneController({
  initial: 'intro',
  scenes,
  onChange({ current, canGoBack }) {
    elements.back.hidden = !canGoBack;
    elements.announcer.textContent =
      current === 'gallery' && galleryLoadError
        ? 'Không thể tải các ảnh lúc này. Em vẫn có thể quay lại hoặc khép lại cuốn album.'
        : `Đã chuyển đến: ${SCENE_LABELS[current]}`;
    giftSession.set('scene', current);
  },
  onError() {
    elements.announcer.textContent =
      'Không thể mở trang tiếp theo. Em đã được đưa về trang gần nhất vẫn hoạt động.';
  },
});

async function go(scene) {
  await sceneController.go(scene);
}

async function replay() {
  resumeCameraWhenVisible = false;
  stopCamera();
  cakeScene.reset();
  galleryScene?.reset();
  audioController.stop({ reset: true });
  giftSession.remove('scene');
  giftSession.remove('memory');
  await sceneController.reset();
}

async function reloadApp() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (registration?.waiting) {
      let reloadStarted = false;
      const reload = () => {
        if (reloadStarted) return;
        reloadStarted = true;
        globalThis.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', reload, {
        once: true,
      });
      registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
      globalThis.setTimeout(reload, 1_500);
      return;
    }
  } catch {
    // A normal reload remains available when service-worker APIs are restricted.
  }
  globalThis.location.reload();
}

function moveGallery(direction) {
  if (galleryReady && galleryScene) {
    if (direction < 0) galleryScene.previous();
    else galleryScene.next();
    return;
  }
  if (
    !galleryLoadError &&
    (sceneController.pendingTarget === 'gallery' ||
      sceneController.current === 'gallery')
  ) {
    pendingGalleryMoves += direction;
  }
}

const actions = {
  async 'start-with-music'() {
    void audioController.start();
    await go('letter');
  },
  async 'start-quiet'() {
    await go('letter');
  },
  async 'to-cake'() {
    await go('cake');
  },
  async 'skip-to-gallery'() {
    await go('gallery');
  },
  async 'enable-camera'() {
    if (!gift.features.cameraGestures) {
      renderCameraStatus('unsupported');
      return;
    }
    if (cameraController.engaged) {
      resumeCameraWhenVisible = false;
      stopCamera();
      return;
    }
    await startCamera();
  },
  async 'blow-candle'() {
    await cakeScene.blowOne();
  },
  async 'to-gallery'() {
    await go('gallery');
  },
  'previous-memory'() {
    moveGallery(-1);
  },
  'next-memory'() {
    moveGallery(1);
  },
  async 'to-epilogue'() {
    await go('epilogue');
  },
  'lightbox-previous'() {
    galleryScene?.lightboxPrevious();
  },
  'lightbox-next'() {
    galleryScene?.lightboxNext();
  },
  async 'download-postcard'() {
    const button = document.querySelector('[data-action="download-postcard"]');
    button.disabled = true;
    button.textContent = 'Đang chuẩn bị postcard…';
    try {
      const { downloadPostcard } = await import('./lib/postcard.js');
      const memoryIndex = galleryScene?.currentIndex ?? readStoredMemoryIndex();
      await downloadPostcard({
        memory: gift.memories[memoryIndex] || gift.memories[0],
        recipient: gift.recipient,
        sender: gift.sender,
      });
      elements.announcer.textContent = 'Postcard đã được tạo và tải về thiết bị.';
    } catch {
      elements.announcer.textContent =
        'Không thể tạo postcard trên thiết bị này. Em vẫn có thể lưu ảnh trực tiếp.';
    } finally {
      button.disabled = false;
      button.textContent = 'Lưu một tấm postcard';
    }
  },
  'reload-app': reloadApp,
  replay,
};

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action = actions[target.dataset.action];
  action?.();
});

document.addEventListener(
  'keydown',
  event => {
    if (
      !galleryReady &&
      !galleryLoadError &&
      (sceneController.pendingTarget === 'gallery' ||
        sceneController.current === 'gallery') &&
      ['ArrowLeft', 'ArrowRight'].includes(event.key)
    ) {
      event.preventDefault();
      pendingGalleryMoves += event.key === 'ArrowLeft' ? -1 : 1;
    }
  },
  { capture: true },
);

elements.back.addEventListener('click', () => sceneController.back());
elements.audioToggle.addEventListener('click', () => audioController.toggle());
elements.motionToggle.addEventListener('click', () => {
  reducedMotion = !reducedMotion;
  safeSession.set('birthday:reduced-motion', String(reducedMotion));
  renderMotionPreference();
  cakeScene.refreshMotion();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resumeCameraWhenVisible =
      sceneController.current === 'cake' &&
      cameraOptedIn &&
      cameraController.engaged;
    if (cameraController.engaged) {
      cameraController.stop();
      if (resumeCameraWhenVisible) renderCameraStatus('paused');
    }
    return;
  }

  if (
    resumeCameraWhenVisible &&
    cameraOptedIn &&
    sceneController.current === 'cake'
  ) {
    resumeCameraWhenVisible = false;
    void startCamera();
  }
});

globalThis.addEventListener('beforeunload', () => {
  stopCamera();
  audioController.destroy();
});

renderPersonalContent();
renderMotionPreference();
renderAudioState({ playing: false, error: null });

const storedScene = giftSession.get('scene');
if (storedScene && storedScene !== 'intro' && scenes[storedScene]) {
  go(storedScene);
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`).catch(() => {
    // Offline support is optional; the gift must still work online.
  });
}
