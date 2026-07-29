import test from 'node:test';
import assert from 'node:assert/strict';

import { createSceneController } from '../../src/lib/scene-controller.js';

function sceneDouble(name, events) {
  return {
    element: {
      hidden: name !== 'intro',
      classList: {
        toggle(className, active) {
          events.push(`${name}:${className}:${active}`);
        },
      },
      focus() {
        events.push(`${name}:focus`);
      },
    },
    enter() {
      events.push(`${name}:enter`);
    },
    exit() {
      events.push(`${name}:exit`);
    },
  };
}

test('scene transitions exit the current scene, enter the next scene, and support back', async () => {
  const events = [];
  const controller = createSceneController({
    initial: 'intro',
    scenes: {
      intro: sceneDouble('intro', events),
      letter: sceneDouble('letter', events),
    },
  });

  await controller.go('letter');
  assert.equal(controller.current, 'letter');
  assert.deepEqual(events.slice(0, 4), [
    'intro:exit',
    'intro:is-active:false',
    'letter:is-active:true',
    'letter:enter',
  ]);

  await controller.back();
  assert.equal(controller.current, 'intro');
});

test('scene transitions reset scroll before moving focus to the new scene', async () => {
  const events = [];
  const originalScrollTo = globalThis.scrollTo;
  globalThis.scrollTo = options => {
    events.push(`scroll:${options.top}:${options.left}:${options.behavior}`);
  };

  try {
    const controller = createSceneController({
      initial: 'intro',
      scenes: {
        intro: sceneDouble('intro', events),
        gallery: sceneDouble('gallery', events),
      },
    });

    await controller.go('gallery');

    const scrollIndex = events.indexOf('scroll:0:0:auto');
    const focusIndex = events.indexOf('gallery:focus');
    assert.notEqual(scrollIndex, -1);
    assert.ok(scrollIndex < focusIndex);
  } finally {
    if (originalScrollTo) {
      globalThis.scrollTo = originalScrollTo;
    } else {
      delete globalThis.scrollTo;
    }
  }
});

test('a failed scene entry rolls back and does not poison later transitions', async () => {
  const events = [];
  const errors = [];
  const intro = sceneDouble('intro', events);
  const broken = sceneDouble('broken', events);
  broken.enter = () => {
    events.push('broken:enter');
    throw new Error('chunk unavailable');
  };
  const safe = sceneDouble('safe', events);
  const controller = createSceneController({
    initial: 'intro',
    scenes: { intro, broken, safe },
    onError: error => errors.push(error.message),
  });

  assert.equal(await controller.go('broken'), 'intro');
  assert.equal(controller.current, 'intro');
  assert.equal(intro.element.hidden, false);
  assert.equal(broken.element.hidden, true);
  assert.deepEqual(errors, ['chunk unavailable']);

  await controller.go('safe');
  assert.equal(controller.current, 'safe');
});

test('back resolves against history after an earlier queued transition commits', async () => {
  const events = [];
  let finishCakeEntry;
  let markCakeStarted;
  const cakeStarted = new Promise(resolve => {
    markCakeStarted = resolve;
  });
  const cake = sceneDouble('cake', events);
  cake.enter = () => new Promise(resolve => {
    events.push('cake:enter');
    finishCakeEntry = resolve;
    markCakeStarted();
  });
  const controller = createSceneController({
    initial: 'intro',
    scenes: {
      intro: sceneDouble('intro', events),
      letter: sceneDouble('letter', events),
      cake,
    },
  });

  await controller.go('letter');
  const cakeTransition = controller.go('cake');
  const backTransition = controller.back();
  await cakeStarted;
  finishCakeEntry();
  await Promise.all([cakeTransition, backTransition]);

  assert.equal(controller.current, 'letter');
  assert.equal(controller.canGoBack, true);
  await controller.back();
  assert.equal(controller.current, 'intro');
  assert.equal(controller.canGoBack, false);
});
