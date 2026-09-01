const MAX_PIXEL_RATIO = 1.5;
const DELIVERY_MS = 640;

function abortError() {
  const error = new Error("The workshop delivery was cancelled.");
  error.name = "AbortError";
  return error;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function isReducedMotion(value) {
  return typeof value === "function" ? Boolean(value()) : Boolean(value);
}

function elementFor(container, name) {
  const document = container?.ownerDocument ?? globalThis.document;
  if (!document?.createElement) {
    throw new TypeError("createWorkshopRenderer requires a DOM container.");
  }
  return document.createElement(name);
}

function clearTimer(timer) {
  if (timer !== null) globalThis.clearTimeout(timer);
}

function waitForDelivery({ signal, duration, pending }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimer(timer);
      signal?.removeEventListener?.("abort", onAbort);
      pending.delete(cancel);
      callback(value);
    };
    const onAbort = () => finish(reject, abortError());
    const cancel = () => finish(reject, abortError());
    const timer = globalThis.setTimeout(() => finish(resolve), duration);

    pending.add(cancel);
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

function setVisualPhase(stage, phase) {
  stage.dataset.phase = String(phase ?? "sleeping");
  stage.classList?.remove?.("is-delivering", "is-delivery-ready");
}

function createPaperDomWorkshop(options) {
  const { container } = options;
  const stage = elementFor(container, "div");
  const track = elementFor(container, "div");
  const bridge = elementFor(container, "div");
  const branch = elementFor(container, "div");
  const brassBall = elementFor(container, "div");
  const lever = elementFor(container, "div");
  const envelope = elementFor(container, "div");
  const lamp = elementFor(container, "div");
  const shadow = elementFor(container, "div");
  const pending = new Set();
  let disposed = false;

  stage.classList?.add?.("workshop-renderer", "workshop-renderer-paper-dom");
  stage.dataset.workshopRenderer = "paper-dom";
  stage.setAttribute?.("aria-hidden", "true");
  [track, bridge, branch, brassBall, lever, envelope, lamp, shadow].forEach((part) => {
    part.setAttribute?.("aria-hidden", "true");
  });
  track.classList?.add?.("workshop-paper-track");
  bridge.classList?.add?.("workshop-paper-bridge");
  branch.classList?.add?.("workshop-paper-branch");
  brassBall.classList?.add?.("workshop-brass-ball");
  lever.classList?.add?.("workshop-brass-lever");
  envelope.classList?.add?.("workshop-paper-envelope");
  lamp.classList?.add?.("workshop-lamp");
  shadow.classList?.add?.("workshop-paper-shadow");
  stage.append(track, bridge, branch, brassBall, lever, envelope, lamp, shadow);
  container.append(stage);
  setVisualPhase(stage, "sleeping");

  return {
    setPhase(phase) {
      if (!disposed) setVisualPhase(stage, phase);
    },
    setPaperShadow(sample) {
      if (disposed) return;
      const x = clamp(Number(sample?.x ?? 0.5), 0, 1);
      const y = clamp(Number(sample?.y ?? 0.5), 0, 1);
      const opacity = clamp(Number(sample?.opacity ?? 0), 0, 1);
      shadow.style.setProperty("--workshop-shadow-x", `${x * 100}%`);
      shadow.style.setProperty("--workshop-shadow-y", `${y * 100}%`);
      shadow.style.setProperty("--workshop-shadow-opacity", String(opacity));
    },
    async playDelivery({ index, signal } = {}) {
      if (disposed) throw abortError();
      stage.classList?.add?.("is-delivering");
      envelope.dataset.deliveryIndex = String(index);
      await waitForDelivery({
        signal,
        duration: isReducedMotion(options.reducedMotion) ? 0 : DELIVERY_MS,
        pending,
      });
      if (disposed || signal?.aborted) throw abortError();
      stage.classList?.remove?.("is-delivering");
      stage.classList?.add?.("is-delivery-ready");
      return { kind: "delivery-ready", index };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pending.forEach((cancel) => cancel());
      pending.clear();
      stage.remove?.();
    },
  };
}

function disposeMaterial(material) {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((item) => {
    if (!item) return;
    Object.values(item).forEach((value) => value?.isTexture && value.dispose?.());
    item.dispose?.();
  });
}

function createThreeWorkshop(THREE, options) {
  const { container } = options;
  const stage = elementFor(container, "div");
  const pending = new Set();
  const rendererFactory = options.createWebGLRenderer ?? ((settings) => new THREE.WebGLRenderer(settings));
  let disposed = false;
  let animationFrame = null;
  let deliveryStart = null;

  stage.classList?.add?.("workshop-renderer", "workshop-renderer-webgl");
  stage.dataset.workshopRenderer = "webgl";
  stage.setAttribute?.("aria-hidden", "true");

  const renderer = rendererFactory({ antialias: true, alpha: true, powerPreference: "low-power" });
  const scene = new THREE.Scene();
  const bounds = () => ({
    width: Math.max(container.clientWidth || container.getBoundingClientRect?.().width || 320, 320),
    height: Math.max(container.clientHeight || container.getBoundingClientRect?.().height || 360, 360),
  });
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
  camera.position.set(0, 3.2, 8.4);
  camera.lookAt(0, 0.55, 0);
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  container.append(stage);
  stage.append(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xfff2d2, 0x2a1d18, 1.75));
  const lamp = new THREE.PointLight(0xffc46b, 18, 15, 2);
  lamp.position.set(-2.1, 4.5, 3.2);
  scene.add(lamp);

  const paper = new THREE.MeshStandardMaterial({ color: 0xf0e4cc, roughness: 0.88, metalness: 0 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc79650, roughness: 0.42, metalness: 0.82 });
  const rose = new THREE.MeshStandardMaterial({ color: 0xa8646c, roughness: 0.7, metalness: 0 });
  const lampHousing = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.55, 24),
    brass,
  );
  lampHousing.position.copy(lamp.position);
  lampHousing.rotation.x = Math.PI;
  scene.add(lampHousing);
  const track = new THREE.Group();
  const trackRail = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.13, 0.42), paper);
  trackRail.position.set(-0.25, 0.15, 0);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.11, 0.52), paper);
  bridge.position.set(0.65, 0.15, 0);
  const leftBranch = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.34), paper);
  leftBranch.position.set(2.55, 0.15, -0.75);
  leftBranch.rotation.y = -0.42;
  const rightBranch = leftBranch.clone();
  rightBranch.position.z = 0.75;
  rightBranch.rotation.y = 0.42;
  track.add(trackRail, bridge, leftBranch, rightBranch);
  scene.add(track);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 16), brass);
  ball.position.set(-2.65, 0.47, 0);
  scene.add(ball);
  const lever = new THREE.Group();
  const leverStem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 12), brass);
  leverStem.rotation.z = -0.45;
  leverStem.position.y = 0.65;
  const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), brass);
  leverKnob.position.set(0.23, 1.1, 0);
  lever.add(leverStem, leverKnob);
  lever.position.set(1.45, 0.08, -1.2);
  scene.add(lever);

  const envelope = new THREE.Group();
  const envelopeBody = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.08, 1.05), paper);
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 18), rose);
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0, 0.075, 0.08);
  envelope.add(envelopeBody, seal);
  envelope.position.set(3.7, 0.35, 0);
  envelope.visible = false;
  scene.add(envelope);

  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x403124, transparent: true, opacity: 0, depthWrite: false });
  const paperShadow = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), shadowMaterial);
  paperShadow.rotation.x = -Math.PI / 2;
  paperShadow.position.set(0, 0.225, 1.2);
  scene.add(paperShadow);

  const resize = () => {
    const { width, height } = bounds();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
  };
  const draw = (time = 0) => {
    if (disposed) return;
    if (!isReducedMotion(options.reducedMotion)) {
      ball.rotation.y = time * 0.0013;
      lamp.intensity = 17.2 + Math.sin(time * 0.002) * 0.8;
    }
    if (deliveryStart !== null) {
      const progress = clamp((time - deliveryStart) / DELIVERY_MS, 0, 1);
      ball.position.x = -2.65 + progress * 5.1;
      lever.rotation.z = progress * 0.46;
      envelope.visible = progress > 0.38;
      envelope.position.x = 3.7 - clamp((progress - 0.38) / 0.62, 0, 1) * 3.2;
    }
    renderer.render(scene, camera);
  };
  const scheduleRender = () => {
    if (
      !disposed &&
      animationFrame === null &&
      (!isReducedMotion(options.reducedMotion) || deliveryStart !== null)
    ) {
      animationFrame = globalThis.requestAnimationFrame?.((time) => {
        animationFrame = null;
        draw(time);
        scheduleRender();
      }) ?? null;
    }
  };

  resize();
  globalThis.addEventListener?.("resize", resize);
  draw();
  scheduleRender();

  return {
    setPhase(phase) {
      if (disposed) return;
      setVisualPhase(stage, phase);
      if (isReducedMotion(options.reducedMotion)) draw();
    },
    setPaperShadow(sample) {
      if (disposed) return;
      const x = clamp(Number(sample?.x ?? 0.5), 0, 1);
      const y = clamp(Number(sample?.y ?? 0.5), 0, 1);
      paperShadow.position.x = (x - 0.5) * 4.6;
      paperShadow.position.z = 1.7 - y * 2.2;
      shadowMaterial.opacity = clamp(Number(sample?.opacity ?? 0), 0, 0.3);
      if (isReducedMotion(options.reducedMotion)) draw();
    },
    async playDelivery({ index, signal } = {}) {
      if (disposed) throw abortError();
      stage.classList?.add?.("is-delivering");
      envelope.userData.deliveryIndex = index;
      deliveryStart = globalThis.performance?.now?.() ?? 0;
      envelope.visible = isReducedMotion(options.reducedMotion);
      if (isReducedMotion(options.reducedMotion)) {
        ball.position.x = 2.45;
        lever.rotation.z = 0.46;
        envelope.position.x = 0.5;
        draw();
      } else if (animationFrame === null) {
        scheduleRender();
      }
      await waitForDelivery({
        signal,
        duration: isReducedMotion(options.reducedMotion) ? 0 : DELIVERY_MS,
        pending,
      });
      if (disposed || signal?.aborted) throw abortError();
      deliveryStart = null;
      envelope.visible = true;
      envelope.position.x = 0.5;
      stage.classList?.remove?.("is-delivering");
      stage.classList?.add?.("is-delivery-ready");
      draw();
      scheduleRender();
      return { kind: "delivery-ready", index };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pending.forEach((cancel) => cancel());
      pending.clear();
      if (animationFrame !== null) globalThis.cancelAnimationFrame?.(animationFrame);
      globalThis.removeEventListener?.("resize", resize);
      scene.traverse((node) => {
        node.geometry?.dispose?.();
        disposeMaterial(node.material);
      });
      renderer.dispose?.();
      renderer.forceContextLoss?.();
      renderer.domElement?.remove?.();
      stage.remove?.();
    },
  };
}

/**
 * Creates only the visual workshop. The controller owns every story decision,
 * including which envelope may be opened and when a gift is revealed.
 */
export async function createWorkshopRenderer(options = {}) {
  try {
    const THREE = await import("three");
    return createThreeWorkshop(THREE, options);
  } catch (error) {
    options.onFallback?.(error);
    return createPaperDomWorkshop(options);
  }
}
