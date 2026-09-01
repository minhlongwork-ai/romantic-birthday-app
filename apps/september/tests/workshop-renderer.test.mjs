import assert from "node:assert/strict";
import test from "node:test";

import { createWorkshopRenderer } from "../src/ui/workshop-renderer.js";

function createFakeElement(tagName, ownerDocument) {
  const attributes = new Map();
  const children = [];
  const classNames = new Set();
  return {
    tagName: String(tagName).toUpperCase(),
    ownerDocument,
    children,
    dataset: {},
    style: {
      setProperty(name, value) {
        this[name] = value;
      },
    },
    classList: {
      add(...names) {
        names.forEach((name) => classNames.add(name));
      },
      remove(...names) {
        names.forEach((name) => classNames.delete(name));
      },
      contains(name) {
        return classNames.has(name);
      },
    },
    append(...nodes) {
      nodes.filter(Boolean).forEach((node) => {
        node.parentNode = this;
        children.push(node);
      });
    },
    appendChild(node) {
      this.append(node);
      return node;
    },
    remove() {
      const siblings = this.parentNode?.children;
      if (!siblings) return;
      const index = siblings.indexOf(this);
      if (index >= 0) siblings.splice(index, 1);
      this.parentNode = null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    querySelector(selector) {
      const wanted = selector.toUpperCase();
      for (const child of children) {
        if (child.tagName === wanted) return child;
        const nested = child.querySelector?.(selector);
        if (nested) return nested;
      }
      return null;
    },
    getBoundingClientRect() {
      return { width: 360, height: 420 };
    },
  };
}

function createFakeContainer() {
  const document = {
    createElement(tagName) {
      return createFakeElement(tagName, document);
    },
  };
  return createFakeElement("div", document);
}

function createFakeWebGLRenderer(container) {
  const domElement = createFakeElement("canvas", container.ownerDocument);
  return {
    domElement,
    shadowMap: {},
    renderCalls: 0,
    disposeCalls: 0,
    contextLossCalls: 0,
    setPixelRatio() {},
    setClearColor() {},
    setSize() {},
    render() {
      this.renderCalls += 1;
    },
    dispose() {
      this.disposeCalls += 1;
    },
    forceContextLoss() {
      this.contextLossCalls += 1;
    },
  };
}

async function withAnimationFrameFake(run) {
  const previousRequest = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  const pending = new Map();
  const cancelled = new Set();
  let nextId = 1;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cancelled.add(id);
    pending.delete(id);
  };

  try {
    await run({ pending, cancelled });
  } finally {
    globalThis.requestAnimationFrame = previousRequest;
    globalThis.cancelAnimationFrame = previousCancel;
  }
}

test("failed WebGL initialization activates a 2.5D workshop without changing story", async () => {
  const container = createFakeContainer();
  const fallbackErrors = [];
  const renderer = await createWorkshopRenderer({
    container,
    createWebGLRenderer() {
      throw new Error("context lost");
    },
    onFallback(error) {
      fallbackErrors.push(error.message);
    },
  });

  renderer.setPhase("fork");
  const result = await renderer.playDelivery({
    index: 0,
    signal: new AbortController().signal,
  });

  assert.deepEqual(result, { kind: "delivery-ready", index: 0 });
  assert.deepEqual(fallbackErrors, ["context lost"]);
  assert.equal(container.querySelector("button"), null);
  assert.equal(container.children[0].dataset.workshopRenderer, "paper-dom");
  assert.equal(container.children[0].style.position, "relative");
  assert.equal(container.children[0].style.minHeight, "22rem");
  assert.match(container.children[0].style.background, /linear-gradient/u);
  assert.equal(container.children[0].children.length, 8);
  assert.equal(
    container.children[0].children[1].classList.contains("workshop-paper-bridge"),
    true,
  );
  assert.equal(
    container.children[0].children[5].style.transform,
    "translateX(-10%) rotate(-2deg)",
  );
});

test("a fake WebGL renderer delivers a closed visual without story controls", async () => {
  const container = createFakeContainer();
  const webgl = createFakeWebGLRenderer(container);
  const renderer = await createWorkshopRenderer({
    container,
    reducedMotion: true,
    createWebGLRenderer() {
      return webgl;
    },
  });

  renderer.setPhase("fork");
  renderer.setPaperShadow({ x: 0.25, y: 0.75, opacity: 0.5 });
  const result = await renderer.playDelivery({ index: 1 });

  assert.deepEqual(result, { kind: "delivery-ready", index: 1 });
  assert.equal(container.children[0].dataset.workshopRenderer, "webgl");
  assert.equal(container.querySelector("button"), null);
  assert.equal(webgl.domElement.parentNode, container.children[0]);
  assert.ok(webgl.renderCalls > 0);
  renderer.dispose();
});

test("an aborted WebGL delivery resets its visual state and cancels its animation frame", async () => {
  await withAnimationFrameFake(async ({ pending, cancelled }) => {
    const container = createFakeContainer();
    const webgl = createFakeWebGLRenderer(container);
    const renderer = await createWorkshopRenderer({
      container,
      createWebGLRenderer() {
        return webgl;
      },
    });
    const abort = new AbortController();
    const delivery = renderer.playDelivery({ index: 0, signal: abort.signal });

    assert.equal(pending.size, 1);
    abort.abort();

    await assert.rejects(delivery, (error) => error?.name === "AbortError");
    assert.equal(container.children[0].classList.contains("is-delivering"), false);
    assert.equal(container.children[0].classList.contains("is-delivery-ready"), false);
    assert.equal(pending.size, 0);
    assert.equal(cancelled.size, 1);
    renderer.dispose();
  });
});

test("reduced motion resolves delivery without scheduling an animation frame", async () => {
  await withAnimationFrameFake(async ({ pending }) => {
    const container = createFakeContainer();
    const renderer = await createWorkshopRenderer({
      container,
      reducedMotion: true,
      createWebGLRenderer() {
        return createFakeWebGLRenderer(container);
      },
    });

    await renderer.playDelivery({ index: 0 });

    assert.equal(pending.size, 0);
    assert.equal(container.children[0].classList.contains("is-delivery-ready"), true);
    renderer.dispose();
  });
});

test("dispose removes the renderer-owned WebGL stage, pending delivery, and renderer context", async () => {
  await withAnimationFrameFake(async ({ pending, cancelled }) => {
    const container = createFakeContainer();
    const webgl = createFakeWebGLRenderer(container);
    const renderer = await createWorkshopRenderer({
      container,
      createWebGLRenderer() {
        return webgl;
      },
    });
    const delivery = renderer.playDelivery({ index: 1 });

    renderer.dispose();

    await assert.rejects(delivery, (error) => error?.name === "AbortError");
    assert.equal(container.children.length, 0);
    assert.equal(pending.size, 0);
    assert.equal(cancelled.size, 1);
    assert.equal(webgl.disposeCalls, 1);
    assert.equal(webgl.contextLossCalls, 1);
  });
});
