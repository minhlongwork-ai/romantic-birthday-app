import { readFile, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_ENVIRONMENTS = new Set(['development', 'preview', 'production']);
const STATUSES = new Set(['draft', 'published']);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TEXT_FIELDS = ['kind', 'title', 'description', 'actionLabel'];
const METADATA_FIELDS = ['title', 'description', 'ogTitle', 'ogDescription'];
// Recipient-facing registry copy is intentionally concise and bounded.
const MAX_EXPERIENCE_TEXT_LENGTH = 200;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSafeRepositoryPath(value) {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('/')
    && !value.includes('\\')
    && value.split('/').every(segment => segment && segment !== '.' && segment !== '..');
}

function isSafePublicPath(value, { directory = false } = {}) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return false;
  }
  if (directory !== value.endsWith('/')) return false;
  try {
    const parsed = new URL(value, 'https://registry.invalid');
    return parsed.origin === 'https://registry.invalid'
      && parsed.pathname === value
      && !value.includes('/../')
      && !value.includes('/./');
  } catch {
    return false;
  }
}

async function hasExpectedTypeWithinRoot(rootDir, path, expectedType) {
  if (!isSafeRepositoryPath(path)) return Promise.resolve(false);
  return stat(resolve(rootDir, path)).then(
    entry => expectedType === 'file' ? entry.isFile() : entry.isDirectory(),
    () => false,
  );
}

function isRegularFileWithinRoot(rootDir, path) {
  return hasExpectedTypeWithinRoot(rootDir, path, 'file');
}

function isDirectoryWithinRoot(rootDir, path) {
  return hasExpectedTypeWithinRoot(rootDir, path, 'directory');
}

function isWithinDirectory(directory, target) {
  const path = relative(directory, target);
  return path !== '' && !path.startsWith('..') && !path.includes('../');
}

function addDuplicateErrors(records, field, valueFor, errors) {
  const seen = new Map();
  records.forEach((record, index) => {
    const value = valueFor(record);
    if (value === undefined) return;
    if (seen.has(value)) {
      errors.push(`${record.id ?? `record ${index}`}.${field} duplicates ${seen.get(value)}.`);
    } else {
      seen.set(value, record.id ?? `record ${index}`);
    }
  });
}

function addError(errors, id, field, reason) {
  errors.push(`${id}.${field} ${reason}.`);
}

function validateBoundedText(value, field, id, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    addError(errors, id, field, 'must be non-empty text');
    return;
  }
  if ([...value].length > MAX_EXPERIENCE_TEXT_LENGTH) {
    addError(errors, id, field, `must be at most ${MAX_EXPERIENCE_TEXT_LENGTH} characters`);
  }
}

async function validateArgv(argv, field, id, rootDir, errors) {
  if (!Array.isArray(argv) || argv.length === 0) {
    addError(errors, id, field, 'must be a non-empty argv array');
    return;
  }
  if (argv.some(argument => typeof argument !== 'string')) {
    addError(errors, id, field, 'must contain only string arguments');
    return;
  }
  if (!isSafeRepositoryPath(argv[0]) || !await isRegularFileWithinRoot(rootDir, argv[0])) {
    addError(errors, id, field, 'must begin with an existing repository script');
  }
}

export async function validateExperienceRegistry(records, { rootDir = DEFAULT_ROOT } = {}) {
  const errors = [];
  if (!Array.isArray(records)) return ['registry must be an array.'];

  addDuplicateErrors(records, 'id', record => record?.id, errors);
  addDuplicateErrors(records, 'year/month', record => (
    Number.isInteger(record?.year) && Number.isInteger(record?.month) ? `${record.year}-${record.month}` : undefined
  ), errors);
  addDuplicateErrors(records, 'route', record => record?.route, errors);
  addDuplicateErrors(records, 'build.destination', record => record?.build?.destination, errors);
  addDuplicateErrors(records, 'preview.publicPath', record => record?.preview?.publicPath, errors);

  await Promise.all(records.map(async (record, index) => {
    const id = typeof record?.id === 'string' ? record.id : `record ${index}`;
    if (!isPlainObject(record)) {
      addError(errors, id, 'record', 'must be an object');
      return;
    }
    if (!ID_PATTERN.test(record.id)) addError(errors, id, 'id', 'must be a lowercase slug');
    if (!Number.isInteger(record.year) || record.year < 1000 || record.year > 9999) addError(errors, id, 'year', 'must be a four-digit integer');
    if (!Number.isInteger(record.month) || record.month < 1 || record.month > 12) addError(errors, id, 'month', 'must be an integer from 1 to 12');
    if (!STATUSES.has(record.status)) addError(errors, id, 'status', 'must be draft or published');
    if (!isSafePublicPath(record.route, { directory: true })) addError(errors, id, 'route', 'must be a clean root-relative path ending in /');

    for (const field of TEXT_FIELDS) {
      validateBoundedText(record[field], field, id, errors);
    }

    const preview = record.preview;
    if (!isPlainObject(preview)) {
      addError(errors, id, 'preview', 'must be an object');
    } else {
      const previewSourceExists = isSafeRepositoryPath(preview.source)
        && await isRegularFileWithinRoot(rootDir, preview.source);
      if (!previewSourceExists) {
        addError(errors, id, 'preview.source', 'must be an existing repository image');
      } else {
        try {
          const metadata = await sharp(resolve(rootDir, preview.source)).metadata();
          if (!Number.isInteger(metadata.width) || !Number.isInteger(metadata.height)) {
            addError(errors, id, 'preview.source', 'must decode as an image with intrinsic dimensions');
          } else {
            if (Number.isInteger(preview.width) && preview.width > 0
              && preview.width !== metadata.width) {
              addError(errors, id, 'preview.width', `must match intrinsic image width ${metadata.width}`);
            }
            if (Number.isInteger(preview.height) && preview.height > 0
              && preview.height !== metadata.height) {
              addError(errors, id, 'preview.height', `must match intrinsic image height ${metadata.height}`);
            }
          }
        } catch {
          addError(errors, id, 'preview.source', 'must decode as an image');
        }
      }
      if (!isSafePublicPath(preview.publicPath) || !preview.publicPath.startsWith('/experience-previews/')) addError(errors, id, 'preview.publicPath', 'must be a clean path under /experience-previews/');
      validateBoundedText(preview.alt, 'preview.alt', id, errors);
      for (const field of ['width', 'height']) {
        if (!Number.isInteger(preview[field]) || preview[field] <= 0) addError(errors, id, `preview.${field}`, 'must be a positive integer');
      }
    }

    const metadata = record.metadata;
    if (!isPlainObject(metadata)) {
      addError(errors, id, 'metadata', 'must be an object');
    } else {
      for (const field of METADATA_FIELDS) {
        if (typeof metadata[field] !== 'string' || metadata[field].trim() === '') addError(errors, id, `metadata.${field}`, 'must be non-empty text');
      }
      if (!isSafePublicPath(metadata.ogImage)) addError(errors, id, 'metadata.ogImage', 'must be a clean root-relative asset path');
    }

    const build = record.build;
    if (!isPlainObject(build)) {
      addError(errors, id, 'build', 'must be an object');
      return;
    }
    if (!isSafeRepositoryPath(build.config) || !await isRegularFileWithinRoot(rootDir, build.config)) addError(errors, id, 'build.config', 'must be an existing repository config');
    const distDir = resolve(rootDir, 'dist');
    const destination = isSafeRepositoryPath(build.destination) ? resolve(distDir, build.destination) : null;
    if (!destination || !isWithinDirectory(distDir, destination)) addError(errors, id, 'build.destination', 'must stay within dist');

    if (!isPlainObject(build.validation)) {
      addError(errors, id, 'build.validation', 'must be an object');
    } else {
      await Promise.all(['development', 'release'].map(environment => validateArgv(
        build.validation[environment],
        `build.validation.${environment}`,
        id,
        rootDir,
        errors,
      )));
    }

    if (!Array.isArray(build.postBuild)) {
      addError(errors, id, 'build.postBuild', 'must be an array');
    } else {
      await Promise.all(build.postBuild.map(async (hook, hookIndex) => {
        const field = `build.postBuild.${hookIndex}`;
        if (!isPlainObject(hook) || !isSafeRepositoryPath(hook.script) || !await isRegularFileWithinRoot(rootDir, hook.script)) {
          addError(errors, id, field, 'must name an existing repository script');
          return;
        }
        if (!Array.isArray(hook.args) || hook.args.some(argument => typeof argument !== 'string')) addError(errors, id, `${field}.args`, 'must contain only string arguments');
      }));
    }

    if (!Array.isArray(build.copies)) {
      addError(errors, id, 'build.copies', 'must be an array');
    } else {
      await Promise.all(build.copies.map(async (copy, copyIndex) => {
        const field = `build.copies.${copyIndex}`;
        if (!isPlainObject(copy) || copy.mode !== 'tree') {
          addError(errors, id, field, 'must be a tree copy rule');
          return;
        }
        if (!isSafeRepositoryPath(copy.source) || !await isDirectoryWithinRoot(rootDir, copy.source)) addError(errors, id, `${field}.source`, 'must be an existing repository directory');
        const target = isSafeRepositoryPath(copy.destination) ? resolve(distDir, copy.destination) : null;
        if (!target || !isWithinDirectory(distDir, target)) addError(errors, id, `${field}.destination`, 'must stay within dist');
      }));
    }
  }));

  return errors;
}

function compareExperiences(left, right) {
  return left.year - right.year || left.month - right.month || left.id.localeCompare(right.id);
}

function freezeRecord(record) {
  return Object.freeze({
    ...record,
    preview: Object.freeze({ ...record.preview }),
    metadata: Object.freeze({ ...record.metadata }),
    build: Object.freeze({
      ...record.build,
      validation: Object.freeze({
        development: Object.freeze([...record.build.validation.development]),
        release: Object.freeze([...record.build.validation.release]),
      }),
      postBuild: Object.freeze(record.build.postBuild.map(hook => Object.freeze({
        ...hook,
        args: Object.freeze([...hook.args]),
      }))),
      copies: Object.freeze(record.build.copies.map(copy => Object.freeze({ ...copy }))),
    }),
  });
}

export async function loadExperienceRegistry({
  registryUrl = new URL('../src/content/experiences.json', import.meta.url),
  rootDir = DEFAULT_ROOT,
} = {}) {
  const records = JSON.parse(await readFile(registryUrl, 'utf8'));
  const errors = await validateExperienceRegistry(records, { rootDir });
  if (errors.length) {
    throw new Error(`Invalid experience registry:\n${errors.map(error => `- ${error}`).join('\n')}`);
  }
  return Object.freeze(records.map(freezeRecord).sort(compareExperiences));
}

export function groupExperiencesByYear(records) {
  const years = new Map();
  for (const record of [...records].sort(compareExperiences)) {
    const experiences = years.get(record.year) ?? [];
    experiences.push(record);
    years.set(record.year, experiences);
  }
  return [...years.entries()].map(([year, experiences]) => ({ year, experiences }));
}

export function selectBuildExperiences(records, environment) {
  if (!BUILD_ENVIRONMENTS.has(environment)) {
    throw new TypeError(`Unknown build environment: ${environment}`);
  }
  return environment === 'production'
    ? records.filter(record => record.status === 'published')
    : [...records];
}
