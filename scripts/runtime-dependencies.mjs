const HTML_CONTENT_TYPE = "text/html";
const CSS_CONTENT_TYPE = "text/css";
const JAVASCRIPT_CONTENT_TYPES = new Set([
  "application/javascript",
  "text/javascript",
]);
const RESOURCE_LINK_RELS = new Set([
  "icon",
  "manifest",
  "modulepreload",
  "preload",
  "stylesheet",
]);

function attributeValue(tag, name) {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "iu",
  ).exec(tag);
  return match ? match[1] ?? match[2] ?? match[3] ?? "" : null;
}

function srcsetReferences(value) {
  return String(value ?? "")
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/u)[0])
    .filter(Boolean);
}

function htmlRuntimeReferences(source) {
  const references = [];
  for (const match of String(source ?? "").matchAll(
    /<(script|link|img|source|video|audio|object)\b[^>]*>/giu,
  )) {
    const [, rawName] = match;
    const name = rawName.toLowerCase();
    const tag = match[0];
    if (name === "link") {
      const rels = String(attributeValue(tag, "rel") ?? "")
        .toLowerCase()
        .split(/\s+/u);
      if (rels.some((rel) => RESOURCE_LINK_RELS.has(rel))) {
        const href = attributeValue(tag, "href");
        if (href) references.push(href);
      }
      continue;
    }
    if (name === "object") {
      const data = attributeValue(tag, "data");
      if (data) references.push(data);
      continue;
    }
    for (const attribute of name === "video" ? ["src", "poster"] : ["src"]) {
      const value = attributeValue(tag, attribute);
      if (value) references.push(value);
    }
    const srcset = attributeValue(tag, "srcset");
    if (srcset) references.push(...srcsetReferences(srcset));
  }
  for (const match of String(source ?? "").matchAll(
    /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/giu,
  )) {
    references.push(...cssRuntimeReferences(match[1] ?? match[2] ?? ""));
  }
  return references;
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return index;
  }
  return -1;
}

function mediaApplies(condition, viewportWidth) {
  for (const match of condition.matchAll(/(min|max)-width\s*:\s*(\d+(?:\.\d+)?)px/giu)) {
    const width = Number(match[2]);
    if (match[1].toLowerCase() === "min" && viewportWidth < width) return false;
    if (match[1].toLowerCase() === "max" && viewportWidth > width) return false;
  }
  return true;
}

function activeCssForViewport(source, viewportWidth) {
  const css = String(source ?? "");
  let result = "";
  let cursor = 0;
  while (cursor < css.length) {
    const mediaIndex = css.toLowerCase().indexOf("@media", cursor);
    if (mediaIndex < 0) return result + css.slice(cursor);
    result += css.slice(cursor, mediaIndex);
    const openIndex = css.indexOf("{", mediaIndex + 6);
    if (openIndex < 0) return result + css.slice(mediaIndex);
    const closeIndex = findMatchingBrace(css, openIndex);
    if (closeIndex < 0) return result + css.slice(mediaIndex);
    const condition = css.slice(mediaIndex + 6, openIndex);
    if (mediaApplies(condition, viewportWidth)) {
      result += activeCssForViewport(
        css.slice(openIndex + 1, closeIndex),
        viewportWidth,
      );
    }
    cursor = closeIndex + 1;
  }
  return result;
}

function urlReferences(source) {
  return [...String(source ?? "").matchAll(
    /url\(\s*(?:"([^"]+)"|'([^']+)'|([^'"\s)]+))\s*\)/giu,
  )].map((match) => match[1] ?? match[2] ?? match[3]);
}

function cssRuntimeReferences(source, { modernFontFormats = true } = {}) {
  let remaining = String(source ?? "");
  const references = [];
  if (modernFontFormats) {
    remaining = remaining.replace(/\bsrc\s*:\s*([^;}]+)/giu, (declaration, value) => {
      const [preferred] = urlReferences(value);
      if (preferred) references.push(preferred);
      return "";
    });
  }
  references.push(...urlReferences(remaining));
  for (const match of remaining.matchAll(
    /@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)')/giu,
  )) {
    references.push(match[1] ?? match[2]);
  }
  return references;
}

function javascriptModuleReferences(source) {
  const text = String(source ?? "");
  return {
    eager: [...text.matchAll(
      /\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/gu,
    )].map((match) => match[1]),
    lazy: [...text.matchAll(
    /\bimport\s*\(\s*["']([^"']+)["']/gu,
    )].map((match) => match[1]),
  };
}

function javascriptWorkerReferences(source) {
  return [...String(source ?? "").matchAll(
    /new\s+(?:Worker|SharedWorker)\s*\(\s*new\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url/gu,
  )].map((match) => match[1]);
}

function javascriptLiteralUrlReferences(source) {
  return [...String(source ?? "").matchAll(
    /new\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url/gu,
  )].map((match) => match[1]);
}

function javascriptRuntimeReferences(source) {
  const modules = javascriptModuleReferences(source);
  const references = [
    ...modules.eager,
    ...modules.lazy,
    ...javascriptWorkerReferences(source),
    ...javascriptLiteralUrlReferences(source),
  ];
  for (const match of String(source ?? "").matchAll(
    /(?:fetch|importScripts|WebSocket|EventSource|Worker|SharedWorker)\(\s*["']([^"']+)["']/gu,
  )) {
    references.push(match[1]);
  }
  for (const match of String(source ?? "").matchAll(
    /\.(?:href|src)\s*=\s*["']([^"']+)["']/gu,
  )) {
    references.push(match[1]);
  }
  return references;
}

function resolveReference(rawReference, parentUrl, siteOrigin) {
  const reference = String(rawReference ?? "").trim();
  if (
    reference === ""
    || reference.startsWith("#")
    || /^(?:blob|data|javascript|mailto|tel):/iu.test(reference)
  ) {
    return null;
  }
  let resolved;
  try {
    resolved = new URL(reference, new URL(parentUrl, siteOrigin));
  } catch {
    return null;
  }
  if (!/^https?:$/u.test(resolved.protocol)) return null;
  if (resolved.origin !== new URL(siteOrigin).origin) {
    return { external: resolved.href };
  }
  return { local: resolved.pathname };
}

function dependencyReferences(artifact, viewportWidth) {
  if (artifact.contentType === HTML_CONTENT_TYPE) {
    return htmlRuntimeReferences(artifact.source);
  }
  if (artifact.contentType === CSS_CONTENT_TYPE) {
    return cssRuntimeReferences(
      activeCssForViewport(artifact.source, viewportWidth),
    );
  }
  if (JAVASCRIPT_CONTENT_TYPES.has(artifact.contentType)) {
    return javascriptModuleReferences(artifact.source).eager;
  }
  return [];
}

function sortedUrls(urls) {
  return [...urls].sort();
}

function createClosureResolver({
  artifactMap,
  siteOrigin,
  viewportWidth,
  externalRuntimeUrls,
  missingRuntimeUrls,
}) {
  function resolveLocalReference(reference, parentUrl) {
    const resolved = resolveReference(reference, parentUrl, siteOrigin);
    if (resolved?.external) externalRuntimeUrls.add(resolved.external);
    return resolved?.local ?? null;
  }

  function trace(roots, { includeWorkers = false, collectDynamicRoots = false } = {}) {
    const urls = new Set();
    const dynamicRoots = new Set();
    const pending = [...roots];
    while (pending.length > 0) {
      const currentUrl = pending.shift();
      if (urls.has(currentUrl)) continue;
      urls.add(currentUrl);
      const artifact = artifactMap.get(currentUrl);
      if (!artifact) {
        missingRuntimeUrls.add(currentUrl);
        continue;
      }
      for (const reference of dependencyReferences(artifact, viewportWidth)) {
        const local = resolveLocalReference(reference, currentUrl);
        if (local && !urls.has(local)) pending.push(local);
      }
      if (!JAVASCRIPT_CONTENT_TYPES.has(artifact.contentType)) continue;
      const modules = javascriptModuleReferences(artifact.source);
      if (collectDynamicRoots) {
        for (const reference of modules.lazy) {
          const local = resolveLocalReference(reference, currentUrl);
          if (local) dynamicRoots.add(local);
        }
      }
      if (includeWorkers) {
        for (const reference of javascriptWorkerReferences(artifact.source)) {
          const local = resolveLocalReference(reference, currentUrl);
          if (local && !urls.has(local)) pending.push(local);
        }
      }
    }
    return { urls, dynamicRoots };
  }

  function chunkRoots(chunkName) {
    return [...artifactMap.keys()].filter(url =>
      url.includes(`/${chunkName}-`) && JAVASCRIPT_CONTENT_TYPES.has(artifactMap.get(url)?.contentType));
  }

  return {
    trace,
    chunkRoots,
  };
}

export function analyzeRuntimeArtifacts({
  artifacts,
  routes,
  siteOrigin,
  viewportWidth = 1280,
}) {
  const artifactMap = new Map(
    (Array.isArray(artifacts) ? artifacts : []).map((artifact) => [
      artifact.url,
      artifact,
    ]),
  );
  const externalRuntimeUrls = new Set();

  for (const artifact of artifactMap.values()) {
    let references = [];
    if (artifact.contentType === HTML_CONTENT_TYPE) {
      references = htmlRuntimeReferences(artifact.source);
    } else if (artifact.contentType === CSS_CONTENT_TYPE) {
      references = cssRuntimeReferences(artifact.source, {
        modernFontFormats: false,
      });
    } else if (JAVASCRIPT_CONTENT_TYPES.has(artifact.contentType)) {
      references = javascriptRuntimeReferences(artifact.source);
    }
    for (const reference of references) {
      const resolved = resolveReference(reference, artifact.url, siteOrigin);
      if (resolved?.external) externalRuntimeUrls.add(resolved.external);
    }
  }

  const missingRuntimeUrls = new Set();
  const closureResolver = createClosureResolver({
    artifactMap,
    siteOrigin,
    viewportWidth,
    externalRuntimeUrls,
    missingRuntimeUrls,
  });
  const initialAssetUrlsByRoute = {};
  const lazyAssetUrlsByRoute = {};
  const runtimeProfilesByRoute = {};
  for (const route of Array.isArray(routes) ? routes : []) {
    const initial = closureResolver.trace([route.index], {
      collectDynamicRoots: true,
    });
    initialAssetUrlsByRoute[route.id] = sortedUrls(initial.urls);

    const lazy = new Set();
    const pendingLazyRoots = [...initial.dynamicRoots];
    const visitedLazyRoots = new Set();
    while (pendingLazyRoots.length > 0) {
      const root = pendingLazyRoots.shift();
      if (visitedLazyRoots.has(root)) continue;
      visitedLazyRoots.add(root);
      const closure = closureResolver.trace([root], {
        includeWorkers: true,
        collectDynamicRoots: true,
      });
      for (const url of closure.urls) lazy.add(url);
      for (const nestedRoot of closure.dynamicRoots) {
        if (!visitedLazyRoots.has(nestedRoot)) pendingLazyRoots.push(nestedRoot);
      }
    }
    lazyAssetUrlsByRoute[route.id] = sortedUrls(lazy);

    if (route.id !== "september") continue;
    const workshop = closureResolver.trace(
      closureResolver.chunkRoots("september-workshop"),
    ).urls;
    const cameraRoots = closureResolver.chunkRoots("september-camera");
    const camera = closureResolver.trace(cameraRoots, { includeWorkers: true }).urls;
    if (cameraRoots.length > 0) {
      for (const url of [
        "/september/models/hand-landmarker-float16-v1.task",
        "/september/vendor/mediapipe/vision_bundle.mjs",
        "/september/vendor/mediapipe/vision_wasm_internal.js",
        "/september/vendor/mediapipe/vision_wasm_internal.wasm",
      ]) {
        if (artifactMap.has(url)) camera.add(url);
        else missingRuntimeUrls.add(url);
      }
    }
    runtimeProfilesByRoute.september = {
      workshop: sortedUrls(workshop),
      camera: sortedUrls(camera),
    };
  }

  return {
    externalRuntimeUrls: [...externalRuntimeUrls].sort(),
    initialAssetUrlsByRoute,
    lazyAssetUrlsByRoute,
    runtimeProfilesByRoute,
    missingRuntimeUrls: [...missingRuntimeUrls].sort(),
  };
}
