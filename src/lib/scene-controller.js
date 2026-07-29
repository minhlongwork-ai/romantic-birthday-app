/**
 * A small scene state machine that owns visibility, history and lifecycle cleanup.
 * Scene objects may provide async enter/exit methods.
 */
export function createSceneController({
  scenes,
  initial,
  onChange = () => {},
  onError = () => {},
}) {
  if (!scenes?.[initial]) {
    throw new Error(`Unknown initial scene: ${initial}`);
  }

  let current = initial;
  let history = [initial];
  let transition = Promise.resolve();
  let pendingTarget = null;

  async function performTransition(
    target,
    { remember = true, resetHistory = false } = {},
  ) {
    if (!scenes[target]) {
      throw new Error(`Unknown scene: ${target}`);
    }
    if (target === current) {
      if (resetHistory) {
        history = [initial];
        onChange({ current, previous: current, canGoBack: false });
      }
      return current;
    }

    const previous = current;
    const previousScene = scenes[previous];
    const nextScene = scenes[target];
    let previousExited = false;
    let nextRevealed = false;
    pendingTarget = target;

    try {
      await previousScene.exit?.();
      previousExited = true;
      previousScene.element.classList.toggle('is-active', false);
      previousScene.element.hidden = true;

      nextScene.element.hidden = false;
      nextScene.element.classList.toggle('is-active', true);
      nextScene.element.inert = true;
      nextScene.element.setAttribute?.('aria-busy', 'true');
      nextRevealed = true;

      await nextScene.enter?.({ from: previous });
      nextScene.element.inert = false;
      nextScene.element.removeAttribute?.('aria-busy');
      current = target;

      if (resetHistory) {
        history = [initial];
      } else if (remember) {
        history.push(target);
      } else if (history.length > 1) {
        history.pop();
      }

      nextScene.element.setAttribute?.('tabindex', '-1');
      globalThis.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
      nextScene.element.focus?.({ preventScroll: true });
      onChange({ current: target, previous, canGoBack: history.length > 1 });
      return target;
    } catch (error) {
      if (nextRevealed) {
        try {
          await nextScene.exit?.({ failed: true });
        } catch {
          // Preserve the original transition error.
        }
        nextScene.element.inert = true;
        nextScene.element.removeAttribute?.('aria-busy');
        nextScene.element.classList.toggle('is-active', false);
        nextScene.element.hidden = true;
      }

      previousScene.element.hidden = false;
      previousScene.element.inert = false;
      previousScene.element.classList.toggle('is-active', true);
      if (previousExited) {
        try {
          await previousScene.enter?.({ from: target, recovering: true });
        } catch {
          // Keep the last stable scene visible even if enhancement recovery fails.
        }
      }
      globalThis.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
      previousScene.element.focus?.({ preventScroll: true });
      onError(error, { current: previous, target });
      return previous;
    } finally {
      pendingTarget = null;
    }
  }

  function queue(operation, target) {
    transition = transition
      .catch(error => {
        onError(error, { current, target });
        return current;
      })
      .then(operation)
      .catch(error => {
        onError(error, { current, target });
        return current;
      });
    return transition;
  }

  return {
    get current() {
      return current;
    },
    get canGoBack() {
      return history.length > 1;
    },
    get pendingTarget() {
      return pendingTarget;
    },
    go(target) {
      return queue(
        () => performTransition(target, { remember: true }),
        target,
      );
    },
    back() {
      return queue(() => {
        if (history.length <= 1) return current;
        return performTransition(history.at(-2), { remember: false });
      }, 'back');
    },
    reset() {
      return queue(
        () => performTransition(initial, {
          remember: false,
          resetHistory: true,
        }),
        initial,
      );
    },
  };
}
