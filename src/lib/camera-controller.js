let handsScriptPromise;

function withTimeout(value, timeoutMs) {
  const promise = Promise.resolve(value);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error('Camera startup timed out.');
      error.name = 'TimeoutError';
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function errorStatus(error) {
  if (error?.name === 'TimeoutError') return 'timeout';
  if (['NotAllowedError', 'SecurityError'].includes(error?.name)) {
    return 'denied';
  }
  if (['NotFoundError', 'OverconstrainedError'].includes(error?.name)) {
    return 'no-device';
  }
  if (['NotReadableError', 'AbortError'].includes(error?.name)) {
    return 'busy';
  }
  return 'error';
}

function loadHandsScript() {
  if (globalThis.Hands) return Promise.resolve();
  if (handsScriptPromise) return handsScriptPromise;

  handsScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${import.meta.env.BASE_URL}vendor/mediapipe/hands/hands.js`;
    const fail = () => {
      script.remove();
      handsScriptPromise = undefined;
      reject(new Error('Không thể tải bộ nhận diện cử chỉ.'));
    };
    script.onload = () => {
      if (globalThis.Hands) resolve();
      else fail();
    };
    script.onerror = fail;
    document.head.append(script);
  });
  return handsScriptPromise;
}

export async function createHandsDetector(onResults) {
  await loadHandsScript();
  const detector = new globalThis.Hands({
    locateFile: file =>
      `${import.meta.env.BASE_URL}vendor/mediapipe/hands/${file}`,
  });
  detector.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.55,
  });
  detector.onResults(onResults);
  return detector;
}

export function createCameraController({
  video,
  mediaDevices = globalThis.navigator?.mediaDevices,
  secureContext = globalThis.isSecureContext !== false,
  createDetector = createHandsDetector,
  startupTimeoutMs = 15_000,
  frameTimeoutMs = 20_000,
  onGesture = () => {},
  onStatus = () => {},
  scheduleFrame = callback => requestAnimationFrame(callback),
  cancelFrame = id => cancelAnimationFrame(id),
  now = () => performance.now(),
}) {
  let generation = 0;
  let startPromise = null;
  let currentSession = null;
  const releasedStreams = new WeakSet();
  const releasedDetectors = new WeakSet();

  function releaseStream(target) {
    if (!target || releasedStreams.has(target)) return;
    releasedStreams.add(target);
    target.getTracks().forEach(track => track.stop());
  }

  function releaseDetector(target) {
    if (!target || releasedDetectors.has(target)) return;
    releasedDetectors.add(target);
    target?.close?.();
  }

  function cleanupSession(session) {
    if (!session) return;
    session.active = false;
    if (session.frameId !== null) {
      cancelFrame(session.frameId);
      session.frameId = null;
    }
    releaseStream(session.stream);
    releaseDetector(session.detector);
    if (video?.srcObject === session.stream) video.srcObject = null;
    session.stream = null;
    session.detector = null;
    session.previousTip = null;
  }

  function isCurrent(session) {
    return (
      currentSession === session &&
      session.generation === generation &&
      session.active
    );
  }

  function handleResults(session, results) {
    if (!isCurrent(session)) return;
    const landmarks = results.multiHandLandmarks?.[0];
    if (!landmarks) {
      onStatus('searching');
      return;
    }

    onStatus('tracking');
    const tip = landmarks[8];
    if (!tip) return;
    const timestamp = now();

    if (session.previousTip) {
      const distance = Math.hypot(
        tip.x - session.previousTip.x,
        tip.y - session.previousTip.y,
      );
      if (distance > 0.055 && timestamp - session.lastGestureAt > 650) {
        session.lastGestureAt = timestamp;
        onGesture();
      }
    }
    session.previousTip = { x: tip.x, y: tip.y };
  }

  async function processFrame(session) {
    if (!isCurrent(session)) return;
    if (!session.processing && session.detector) {
      session.processing = true;
      try {
        await withTimeout(
          session.detector.send({ image: video }),
          frameTimeoutMs,
        );
      } catch (error) {
        if (isCurrent(session)) {
          currentSession = null;
          cleanupSession(session);
          onStatus(
            error?.name === 'TimeoutError'
              ? 'processing-timeout'
              : 'processing-error',
          );
        }
      } finally {
        session.processing = false;
      }
    }
    if (isCurrent(session)) {
      session.frameId = scheduleFrame(() => processFrame(session));
    }
  }

  function stop() {
    generation += 1;
    startPromise = null;
    const session = currentSession;
    currentSession = null;
    cleanupSession(session);
    if (video && !session) video.srcObject = null;
    onStatus('stopped');
  }

  return {
    get active() {
      return Boolean(currentSession?.active);
    },
    get engaged() {
      return Boolean(currentSession || startPromise);
    },
    async start() {
      if (currentSession?.active) return true;
      if (startPromise) return startPromise;
      if (!secureContext) {
        onStatus('insecure');
        return false;
      }
      if (!mediaDevices?.getUserMedia) {
        onStatus('unsupported');
        return false;
      }

      const requestGeneration = ++generation;
      const session = {
        generation: requestGeneration,
        stream: null,
        detector: null,
        frameId: null,
        processing: false,
        active: false,
        previousTip: null,
        lastGestureAt: 0,
      };
      currentSession = session;
      onStatus('requesting');
      const pending = (async () => {
        try {
          session.stream = await mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          });
          if (currentSession !== session || requestGeneration !== generation) {
            cleanupSession(session);
            return false;
          }

          video.srcObject = session.stream;
          onStatus('streaming');
          await withTimeout(video.play(), startupTimeoutMs);
          if (currentSession !== session || requestGeneration !== generation) {
            cleanupSession(session);
            return false;
          }

          const detectorPromise = Promise.resolve(
            createDetector(results => handleResults(session, results)),
          ).then(detector => {
            if (
              currentSession !== session ||
              requestGeneration !== generation
            ) {
              releaseDetector(detector);
            }
            return detector;
          });
          session.detector = await withTimeout(
            detectorPromise,
            startupTimeoutMs,
          );
          if (currentSession !== session || requestGeneration !== generation) {
            cleanupSession(session);
            return false;
          }

          session.active = true;
          onStatus('active');
          session.frameId = scheduleFrame(() => processFrame(session));
          return true;
        } catch (error) {
          cleanupSession(session);
          if (currentSession === session && requestGeneration === generation) {
            currentSession = null;
            onStatus(errorStatus(error));
          }
          return false;
        }
      })();

      startPromise = pending;
      try {
        return await pending;
      } finally {
        if (startPromise === pending) startPromise = null;
      }
    },
    stop,
  };
}
