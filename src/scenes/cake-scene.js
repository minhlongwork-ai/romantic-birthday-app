const MAX_CANDLES = 8;

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      globalThis.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

export function createCakeScene({
  container,
  loadingElement,
  fallbackElement,
  countElement,
  blowButton,
  continueButton,
  giftRevealStatus,
  giftElement,
  giftImage,
  giftAvifSource,
  giftWebpSource,
  gift,
  age,
  reducedMotion = () => false,
  onComplete = () => {},
}) {
  const candleTotal = Math.max(1, Math.min(Number(age) || 1, MAX_CANDLES));
  let remaining = candleTotal;
  let renderer;
  let scene;
  let camera;
  let cakeGroup;
  let flames = [];
  let animationId;
  let renderCake;
  let modules;
  let active = false;
  let fallbackMode = false;
  let giftRevealed = false;
  let giftLoadState = 'idle';
  let giftLoadPromise;
  let lifecycleGeneration = 0;

  function updateCount() {
    countElement.textContent =
      remaining === 0
        ? 'Điều ước đã được gửi đi'
        : `${remaining} ngọn nến còn lại`;
  }

  function reset() {
    remaining = candleTotal;
    giftRevealed = false;
    continueButton.hidden = true;
    blowButton.hidden = false;
    giftRevealStatus.hidden = true;
    container.dataset.giftState = 'waiting';
    delete container.dataset.giftRenderer;
    fallbackElement.classList.remove('is-blown');
    fallbackElement.setAttribute('aria-hidden', 'true');
    giftElement.hidden = true;
    giftElement.setAttribute('aria-hidden', 'true');
    giftElement.classList.remove('is-visible');
    giftElement.style.removeProperty('--gift-tilt-x');
    giftElement.style.removeProperty('--gift-tilt-y');
    if (cakeGroup) {
      cakeGroup.position.set(0, 0, 0);
      cakeGroup.scale.set(1, 1, 1);
      cakeGroup.visible = true;
    }
    flames.forEach(flame => {
      flame.visible = true;
    });
    updateCount();
  }

  function dispose() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    renderCake = null;
    globalThis.removeEventListener('resize', resizeRenderer);
    if (scene) {
      scene.traverse(object => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose?.());
        } else {
          object.material?.dispose?.();
        }
      });
    }
    renderer?.dispose?.();
    renderer?.domElement?.remove();
    renderer = null;
    scene = null;
    camera = null;
    cakeGroup = null;
    flames = [];
  }

  function resizeRenderer() {
    if (!renderer || !camera) return;
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 360);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.75));
  }

  function showGiftFallback() {
    giftElement.hidden = true;
    giftElement.setAttribute('aria-hidden', 'true');
    giftElement.classList.remove('is-visible');
    fallbackElement.hidden = false;
    fallbackElement.setAttribute('aria-hidden', 'false');
    fallbackElement.classList.add('is-blown');
    container.dataset.giftRenderer = '2d';
  }

  function showGiftImage() {
    if (giftLoadState !== 'ready') return false;

    fallbackElement.hidden = true;
    fallbackElement.setAttribute('aria-hidden', 'true');
    giftElement.hidden = false;
    giftElement.setAttribute('aria-hidden', 'false');
    container.dataset.giftRenderer = 'image';
    requestAnimationFrame(() => {
      if (active && giftRevealed) giftElement.classList.add('is-visible');
    });
    return true;
  }

  function applyGiftLoadResult(loaded, enterGeneration) {
    if (
      !active ||
      enterGeneration !== lifecycleGeneration ||
      !giftRevealed
    ) {
      return;
    }
    if (loaded) showGiftImage();
    else showGiftFallback();
  }

  function loadGiftVisual(enterGeneration) {
    if (giftLoadState === 'ready') return Promise.resolve(true);
    if (giftLoadState === 'loading') {
      return giftLoadPromise.then(loaded => {
        applyGiftLoadResult(loaded, enterGeneration);
        return loaded;
      });
    }
    if (!gift?.src || !giftImage) {
      giftLoadState = 'error';
      return Promise.resolve(false);
    }

    giftLoadState = 'loading';
    giftImage.alt = gift.alt;
    giftAvifSource.srcset = gift.avifSrc;
    giftWebpSource.srcset = gift.webpSrc;

    giftLoadPromise = new Promise(resolve => {
      const settle = loaded => {
        giftImage.removeEventListener('load', handleLoad);
        giftImage.removeEventListener('error', handleError);
        giftLoadState = loaded ? 'ready' : 'error';
        if (loaded) {
          void giftImage.decode?.().catch(() => {});
        }
        applyGiftLoadResult(loaded, enterGeneration);
        resolve(loaded);
      };
      const handleLoad = () => settle(giftImage.naturalWidth > 0);
      const handleError = () => settle(false);

      giftImage.addEventListener('load', handleLoad, { once: true });
      giftImage.addEventListener('error', handleError, { once: true });
      giftImage.src = gift.src;

      if (giftImage.complete) {
        queueMicrotask(() => settle(giftImage.naturalWidth > 0));
      }
    });

    return giftLoadPromise;
  }

  function handleGiftPointerMove(event) {
    if (reducedMotion() || !giftRevealed || giftElement.hidden) return;
    const bounds = giftElement.getBoundingClientRect();
    const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
    const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
    const tiltY = Math.max(-2.5, Math.min(2.5, horizontal * 5));
    const tiltX = Math.max(-2.5, Math.min(2.5, vertical * -5));
    giftElement.style.setProperty('--gift-tilt-x', `${tiltX}deg`);
    giftElement.style.setProperty('--gift-tilt-y', `${tiltY}deg`);
  }

  function resetGiftTilt() {
    giftElement.style.setProperty('--gift-tilt-x', '0deg');
    giftElement.style.setProperty('--gift-tilt-y', '0deg');
  }


  function revealProductGift({ animate = true } = {}) {
    giftRevealed = true;
    container.dataset.giftState = 'revealed';
    giftRevealStatus.hidden = false;

    if (!showGiftImage()) {
      showGiftFallback();
    }

    if (!cakeGroup) return;
    const gsap = modules?.gsap;
    if (!animate || reducedMotion() || !gsap) {
      cakeGroup.position.y = -6;
      return;
    }

    gsap.killTweensOf(cakeGroup.position);
    gsap.to(cakeGroup.position, {
      y: -6,
      duration: 1.05,
      ease: 'power2.inOut',
    });
  }

  async function celebrate() {
    blowButton.hidden = true;
    continueButton.hidden = false;
    container.closest('.scene')?.classList.add('is-celebrating');
    revealProductGift({ animate: !reducedMotion() });

    if (!reducedMotion()) {
      const confetti = modules?.confetti;
      confetti?.({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.66 },
        colors: ['#d69a91', '#f4d7a3', '#fff8ed', '#a97264'],
        disableForReducedMotion: true,
      });
    }
    await onComplete();
  }

  async function blowOne() {
    if (!active || remaining <= 0) return;
    const index = candleTotal - remaining;
    if (!fallbackMode && flames[index]) {
      flames[index].visible = false;
    }
    remaining -= 1;
    updateCount();

    if (remaining === 0) {
      fallbackElement.classList.add('is-blown');
      await celebrate();
    }
  }

  function buildCake(THREE) {
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 360);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 4.6, 10);
    camera.lookAt(0, 1.7, 0);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.append(renderer.domElement);
    globalThis.addEventListener('resize', resizeRenderer);

    scene.add(new THREE.AmbientLight(0xfff1dc, 1.6));
    const keyLight = new THREE.PointLight(0xffd5b8, 45, 30);
    keyLight.position.set(4, 8, 5);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x9c829f, 30, 25);
    rimLight.position.set(-5, 4, -2);
    scene.add(rimLight);
    const frontLight = new THREE.PointLight(0xffffff, 26, 24);
    frontLight.position.set(0, 3.5, 7);
    scene.add(frontLight);

    cakeGroup = new THREE.Group();
    scene.add(cakeGroup);

    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(2.45, 2.6, 0.16, 64),
      new THREE.MeshStandardMaterial({
        color: 0xf2e6d5,
        roughness: 0.32,
        metalness: 0.08,
      }),
    );
    plate.position.y = -0.08;
    cakeGroup.add(plate);

    const bottom = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2.08, 1.25, 64),
      new THREE.MeshStandardMaterial({ color: 0xd59b92, roughness: 0.48 }),
    );
    bottom.position.y = 0.62;
    cakeGroup.add(bottom);

    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.52, 0.92, 64),
      new THREE.MeshStandardMaterial({ color: 0xf0d7c1, roughness: 0.42 }),
    );
    top.position.y = 1.7;
    cakeGroup.add(top);

    const icingMaterial = new THREE.MeshStandardMaterial({
      color: 0xfffaf2,
      roughness: 0.55,
    });
    const icingBottom = new THREE.Mesh(
      new THREE.TorusGeometry(2.02, 0.12, 16, 64),
      icingMaterial,
    );
    icingBottom.rotation.x = Math.PI / 2;
    icingBottom.position.y = 1.22;
    cakeGroup.add(icingBottom);

    const icingTop = new THREE.Mesh(
      new THREE.TorusGeometry(1.46, 0.1, 16, 64),
      icingMaterial,
    );
    icingTop.rotation.x = Math.PI / 2;
    icingTop.position.y = 2.15;
    cakeGroup.add(icingTop);

    const candleMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff3dc,
      roughness: 0.28,
    });
    const flameMaterial = new THREE.MeshBasicMaterial({
      color: 0xffc15a,
      transparent: true,
      opacity: 0.95,
    });

    for (let index = 0; index < candleTotal; index += 1) {
      const angle = (index / candleTotal) * Math.PI * 2;
      const radius = candleTotal <= 3 ? 0.48 : 0.88;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const candle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.52, 16),
        candleMaterial,
      );
      candle.position.set(x, 2.43, z);
      cakeGroup.add(candle);

      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 16, 16),
        flameMaterial.clone(),
      );
      flame.scale.set(0.72, 1.5, 0.72);
      flame.position.set(x, 2.8, z);
      cakeGroup.add(flame);
      flames.push(flame);
    }
    const blownCount = candleTotal - remaining;
    flames.forEach((flame, index) => {
      flame.visible = index >= blownCount;
    });

    const starGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(300 * 3);
    for (let index = 0; index < positions.length; index += 1) {
      positions[index] = (Math.random() - 0.5) * 35;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    scene.add(
      new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({
          color: 0xfff8e8,
          size: 0.035,
          transparent: true,
          opacity: 0.6,
        }),
      ),
    );

    if (giftRevealed) revealProductGift({ animate: !reducedMotion() });

    const clock = new THREE.Clock();
    function render() {
      if (!active) return;
      const elapsed = clock.getElapsedTime();
      if (!reducedMotion()) {
        cakeGroup.rotation.y = Math.sin(elapsed * 0.25) * 0.15;
        flames.forEach((flame, index) => {
          if (flame.visible) {
            const pulse = 1 + Math.sin(elapsed * 8 + index) * 0.08;
            flame.scale.set(0.72 * pulse, 1.5 * pulse, 0.72 * pulse);
          }
        });
      }
      renderer.render(scene, camera);
      animationId = reducedMotion() ? null : requestAnimationFrame(render);
    }
    renderCake = render;
    render();
  }

  async function upgradeTo3D(enterGeneration) {
    const optionalModules = Promise.allSettled([
      import('canvas-confetti'),
      import('gsap'),
    ]);
    try {
      const threeModule = await import('three');
      if (!active || enterGeneration !== lifecycleGeneration) return;
      modules = {
        THREE: threeModule,
        confetti: null,
        gsap: null,
      };
      buildCake(modules.THREE);
      fallbackMode = false;
      fallbackElement.hidden =
        !giftRevealed || giftLoadState === 'ready';

      void optionalModules.then(([confettiResult, gsapResult]) => {
        if (!active || enterGeneration !== lifecycleGeneration || !modules) {
          return;
        }
        modules.confetti =
          confettiResult.status === 'fulfilled'
            ? confettiResult.value.default
            : null;
        modules.gsap =
          gsapResult.status === 'fulfilled'
            ? gsapResult.value.gsap || gsapResult.value.default
            : null;
        if (!reducedMotion() && cakeGroup && !giftRevealed) {
          modules.gsap?.fromTo(
            cakeGroup.scale,
            { x: 0.92, y: 0.92, z: 0.92 },
            { x: 1, y: 1, z: 1, duration: 0.7, ease: 'power2.out' },
          );
        }
      });
    } catch {
      if (!active || enterGeneration !== lifecycleGeneration) return;
      fallbackMode = true;
      fallbackElement.hidden = false;
    } finally {
      if (active && enterGeneration === lifecycleGeneration) {
        loadingElement.hidden = true;
      }
    }
  }

  function enter() {
    const enterGeneration = ++lifecycleGeneration;
    active = true;
    reset();
    blowButton.disabled = false;
    loadingElement.hidden = false;
    fallbackElement.hidden = false;
    fallbackMode = true;
    container.addEventListener('pointermove', handleGiftPointerMove);
    container.addEventListener('pointerleave', resetGiftTilt);
    void loadGiftVisual(enterGeneration);

    if (!supportsWebGL()) {
      loadingElement.hidden = true;
      return;
    }

    // The 2D cake is the immediately interactive baseline. 3D upgrades it in
    // the background and can never hold the scene controller's inert state.
    void upgradeTo3D(enterGeneration);
  }

  function exit() {
    lifecycleGeneration += 1;
    active = false;
    blowButton.disabled = false;
    container.closest('.scene')?.classList.remove('is-celebrating');
    modules?.confetti?.reset?.();
    container.removeEventListener('pointermove', handleGiftPointerMove);
    container.removeEventListener('pointerleave', resetGiftTilt);
    resetGiftTilt();
    if (cakeGroup) {
      modules?.gsap?.killTweensOf?.(cakeGroup.scale);
      modules?.gsap?.killTweensOf?.(cakeGroup.position);
    }
    dispose();
  }

  return {
    enter,
    exit,
    reset,
    blowOne,
    refreshMotion() {
      if (!active || !renderer || !renderCake) return;
      if (animationId) cancelAnimationFrame(animationId);
      animationId = null;

      if (reducedMotion()) {
        if (cakeGroup) {
          modules?.gsap?.killTweensOf?.(cakeGroup.scale);
          modules?.gsap?.killTweensOf?.(cakeGroup.position);
          cakeGroup.scale.set(1, 1, 1);
          if (giftRevealed) cakeGroup.position.y = -6;
        }
        resetGiftTilt();
        modules?.confetti?.reset?.();
      }

      renderCake();
    },
    get remaining() {
      return remaining;
    },
  };
}
