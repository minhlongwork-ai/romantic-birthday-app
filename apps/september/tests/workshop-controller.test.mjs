import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { mountWorkshop } from "../src/ui/workshop-controller.js";
import { createWorkshopInput } from "../src/ui/workshop-input.js";

const controllerPath = new URL("../src/ui/workshop-controller.js", import.meta.url);
const stylesPath = new URL("../src/styles.css", import.meta.url);

function createFakeElement(tagName, ownerDocument) {
  const attributes = new Map();
  const listeners = new Map();
  const children = [];
  const classNames = new Set();
  const node = {
    tagName: String(tagName).toUpperCase(),
    ownerDocument,
    children,
    dataset: {},
    hidden: false,
    disabled: false,
    textContent: "",
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
      nodes.filter(Boolean).forEach((child) => {
        child.parentNode = node;
        children.push(child);
      });
    },
    replaceChildren(...nodes) {
      children.splice(0, children.length);
      node.append(...nodes);
    },
    remove() {
      const siblings = node.parentNode?.children;
      if (!siblings) return;
      const index = siblings.indexOf(node);
      if (index >= 0) siblings.splice(index, 1);
      node.parentNode = null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    addEventListener(type, listener, options = {}) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
      options.signal?.addEventListener?.("abort", () => {
        listeners.get(type)?.delete(listener);
      }, { once: true });
    },
    dispatch(type, properties = {}) {
      const event = {
        type,
        detail: 0,
        isPrimary: true,
        pointerId: 1,
        clientX: 50,
        clientY: 50,
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...properties,
      };
      for (const listener of listeners.get(type) ?? []) listener(event);
      return event;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 300, height: 300 };
    },
    querySelector(selector) {
      const selectors = selector.split(",").map(value => value.trim().toUpperCase());
      for (const child of children) {
        if (selectors.includes(child.tagName)) return child;
        const nested = child.querySelector?.(selector);
        if (nested) return nested;
      }
      return null;
    },
  };
  return node;
}

function createFakeDocument() {
  const listeners = new Map();
  const document = {
    hidden: false,
    createElement(tagName) {
      return createFakeElement(tagName, document);
    },
    addEventListener(type, listener, options = {}) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
      options.signal?.addEventListener?.("abort", () => {
        listeners.get(type)?.delete(listener);
      }, { once: true });
    },
    dispatch(type, properties = {}) {
      const event = {
        type,
        pointerId: 1,
        clientX: 50,
        clientY: 50,
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...properties,
      };
      for (const listener of listeners.get(type) ?? []) listener(event);
      return event;
    },
  };
  return document;
}

function fakeWorkshopContext() {
  return {
    state: { workshopPhase: "invitation", deliveryOrder: [], deliveredCount: 0 },
    reducedMotion: true,
    dispatchWorkshop() {},
    requestGiftReveal() {},
    announce() {},
  };
}

test("workshop controller keeps gift DOM secret until a sealed envelope is ready", async () => {
  const source = await readFile(controllerPath, "utf8");

  assert.match(source, /Một xưởng nhỏ đang chờ em/u);
  assert.match(source, /workshop-stage/u);
  assert.match(source, /paper-shadow/u);
  assert.match(source, /first-envelope-ready/u);
  assert.doesNotMatch(source, /localStorage|navigator\.share/u);
});

test("mountWorkshop exposes an idempotent SceneMount disposer", () => {
  const document = createFakeDocument();
  const root = createFakeElement("main", document);
  const mounted = mountWorkshop(root, fakeWorkshopContext());

  assert.equal(typeof mounted.dispose, "function");
  mounted.dispose();
  mounted.dispose();
  assert.equal(root.children.length, 0);
});

test("a synthesized click after an early primary bridge pointer release cannot confirm", () => {
  const document = createFakeDocument();
  const stage = createFakeElement("div", document);
  const bridgeButton = createFakeElement("button", document);
  const leftButton = createFakeElement("button", document);
  const rightButton = createFakeElement("button", document);
  const commands = [];
  let now = 0;
  const input = createWorkshopInput({
    stage,
    bridgeButton,
    leftButton,
    rightButton,
    now: () => now,
    onCommand(type) {
      commands.push(type);
    },
  });

  input.startTouch();
  bridgeButton.dispatch("pointerdown", { pointerId: 7, clientX: 90, clientY: 90 });
  now = 300;
  bridgeButton.dispatch("pointerup", { pointerId: 7, clientX: 90, clientY: 90 });
  bridgeButton.dispatch("click", { detail: 0 });

  assert.deepEqual(commands, []);
  input.dispose();
});

test("a document pointer release frees primary bridge ownership for a keyboard confirmation", async () => {
  const document = createFakeDocument();
  const stage = createFakeElement("div", document);
  const bridgeButton = createFakeElement("button", document);
  const leftButton = createFakeElement("button", document);
  const rightButton = createFakeElement("button", document);
  const commands = [];
  let now = 0;
  const input = createWorkshopInput({
    stage,
    bridgeButton,
    leftButton,
    rightButton,
    documentTarget: document,
    windowTarget: { addEventListener() {} },
    now: () => now,
    onCommand(type) {
      commands.push(type);
    },
  });

  input.startTouch();
  bridgeButton.dispatch("pointerdown", { pointerId: 7, clientX: 90, clientY: 90 });
  now = 300;
  document.dispatch("pointerup", { pointerId: 7, clientX: 390, clientY: 90 });
  await Promise.resolve();
  bridgeButton.dispatch("click", { detail: 0 });

  assert.deepEqual(commands, ["BRIDGE_CONFIRMED"]);
  input.dispose();
});

test("a resolved camera start waits for the no-hand timeout before offering touch", async () => {
  const document = createFakeDocument();
  const stage = createFakeElement("div", document);
  const bridgeButton = createFakeElement("button", document);
  const leftButton = createFakeElement("button", document);
  const rightButton = createFakeElement("button", document);
  const notices = [];
  const input = createWorkshopInput({
    stage,
    bridgeButton,
    leftButton,
    rightButton,
    documentTarget: document,
    windowTarget: { addEventListener() {} },
    loadCameraSession: async () => ({
      createCameraSession() {
        return {
          start: async () => {},
          stop() {},
        };
      },
    }),
    onCameraNotice(notice) {
      notices.push(notice);
    },
  });

  await input.startCamera();

  assert.deepEqual(notices, [{ reason: "starting", label: "", touchPrimary: false }]);
  input.dispose();
});

test("reduced motion keeps the workshop paper shadow from interpolating position", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(
    styles,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.workshop-paper-shadow\s*,[\s\S]*?\{[\s\S]*?transition:\s*opacity\s+150ms/u,
  );
});
