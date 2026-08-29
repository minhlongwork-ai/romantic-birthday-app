import { relative, resolve, sep } from 'node:path';

import { selectBuildExperiences } from './experience-registry.mjs';

function assertPaths(paths) {
  if (!paths || typeof paths !== 'object') {
    throw new TypeError('paths must contain projectRoot, stagingDir, and distDir.');
  }
  for (const field of ['projectRoot', 'stagingDir', 'distDir']) {
    if (typeof paths[field] !== 'string' || paths[field] === '') {
      throw new TypeError(`paths.${field} must be a non-empty string.`);
    }
  }
}

function resolveWithin(baseDir, pathname, label) {
  const target = resolve(baseDir, pathname);
  const relativePath = relative(baseDir, target);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
    throw new Error(`${label} escapes ${baseDir}: ${pathname}`);
  }
  return target;
}

function expandHookArgument(argument, stagingOutput) {
  return argument.replaceAll('{stagingDir}', stagingOutput);
}

export function resolveBuildEnvironment(env = process.env) {
  if (env.VERCEL_ENV === 'production' || env.EXPERIENCE_BUILD_ENV === 'production') {
    return 'production';
  }
  if (env.VERCEL_ENV === 'preview' || env.EXPERIENCE_BUILD_ENV === 'preview') {
    return 'preview';
  }
  return 'development';
}

export function createExperienceRouteBuilds({ records, environment, paths }) {
  assertPaths(paths);
  return selectBuildExperiences(records, environment).map((record) => {
    const output = resolveWithin(paths.stagingDir, record.id, `${record.id} staging output`);
    return Object.freeze({
      id: record.id,
      path: record.route,
      config: resolveWithin(paths.projectRoot, record.build.config, `${record.id} build config`),
      output,
      destination: resolveWithin(
        paths.distDir,
        record.build.destination,
        `${record.id} build destination`,
      ),
      index: `${record.route}index.html`,
      validationArgv: Object.freeze([...record.build.validation.development]),
      postBuild: Object.freeze(record.build.postBuild.map(hook => Object.freeze({
        script: resolveWithin(paths.projectRoot, hook.script, `${record.id} post-build script`),
        args: Object.freeze(hook.args.map(argument =>
          expandHookArgument(argument, output))),
      }))),
      copies: Object.freeze(record.build.copies.map(copy => Object.freeze({
        mode: copy.mode,
        source: resolveWithin(paths.projectRoot, copy.source, `${record.id} copy source`),
        destination: resolveWithin(
          paths.distDir,
          copy.destination,
          `${record.id} copy destination`,
        ),
      }))),
    });
  });
}

export function createExperiencePreviewCopies({ records, paths }) {
  assertPaths(paths);
  const destinations = new Map();
  return records.map((record) => {
    const publicPath = record.preview.publicPath;
    const destination = resolveWithin(
      paths.distDir,
      publicPath.replace(/^\/+/, ''),
      `${record.id} preview destination`,
    );
    const existingId = destinations.get(destination);
    if (existingId) {
      throw new Error(
        `Preview copy destination collision between ${existingId} and ${record.id}: ${publicPath}`,
      );
    }
    destinations.set(destination, record.id);
    return Object.freeze({
      id: record.id,
      source: resolveWithin(
        paths.projectRoot,
        record.preview.source,
        `${record.id} preview source`,
      ),
      destination,
      publicPath,
    });
  });
}

export function findExperienceForUrl(url, experiences) {
  let pathname;
  try {
    pathname = new URL(String(url), 'https://experience.invalid/').pathname;
  } catch {
    return null;
  }
  return [...experiences]
    .sort((left, right) => right.route.length - left.route.length)
    .find(experience => pathname.startsWith(experience.route)) ?? null;
}
