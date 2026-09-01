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
});

test("an aborted delivery never resolves ready", async () => {
  const container = createFakeContainer();
  const renderer = await createWorkshopRenderer({
    container,
    createWebGLRenderer() {
      throw new Error("context lost");
    },
  });
  const abort = new AbortController();
  const delivery = renderer.playDelivery({ index: 0, signal: abort.signal });
  abort.abort();

  await assert.rejects(delivery, (error) => error?.name === "AbortError");
});

test("dispose removes the renderer-owned stage and cancels a pending delivery", async () => {
  const container = createFakeContainer();
  const renderer = await createWorkshopRenderer({
    container,
    createWebGLRenderer() {
      throw new Error("context lost");
    },
  });
  const delivery = renderer.playDelivery({ index: 1 });

  renderer.dispose();

  await assert.rejects(delivery, (error) => error?.name === "AbortError");
  assert.equal(container.children.length, 0);
});
