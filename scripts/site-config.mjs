import { readFile } from 'node:fs/promises';
import { loadExperienceRegistry } from './experience-registry.mjs';

const PAGE_TEXT_FIELDS = Object.freeze([
  'title',
  'description',
  'ogTitle',
  'ogDescription',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCleanPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || !value.endsWith('/')) {
    return false;
  }
  if (value.startsWith('//') || value.includes('\\')) return false;
  try {
    const parsed = new URL(value, 'https://config.invalid');
    return parsed.origin === 'https://config.invalid'
      && parsed.search === ''
      && parsed.hash === ''
      && parsed.pathname === value;
  } catch {
    return false;
  }
}

export function validateSiteConfig(config) {
  const errors = [];
  if (!isPlainObject(config)) return ['site config must be an object.'];

  if (!Array.isArray(config.experiences)) {
    errors.push('experiences must be an array.');
  }
  const experienceIds = Array.isArray(config.experiences)
    ? config.experiences.map((experience, index) => {
      if (!isPlainObject(experience) || typeof experience.id !== 'string' || experience.id === '') {
        errors.push(`experiences.${index}.id must be non-empty text.`);
        return null;
      }
      return experience.id;
    }).filter(Boolean)
    : [];
  const duplicateExperienceIds = experienceIds.filter(
    (id, index) => experienceIds.indexOf(id) !== index,
  );
  for (const id of new Set(duplicateExperienceIds)) {
    errors.push(`experiences contains duplicate id: ${id}.`);
  }
  const routeIds = ['chooser', ...experienceIds];
  const shareIds = experienceIds;

  try {
    const origin = new URL(config.origin);
    if (
      origin.protocol !== 'https:'
      || origin.username
      || origin.password
      || origin.search
      || origin.hash
      || origin.pathname !== '/'
    ) {
      errors.push('origin must be a clean HTTPS origin.');
    }
  } catch {
    errors.push('origin must be a valid absolute URL.');
  }

  if (!isPlainObject(config.routes)) {
    errors.push('routes must be an object.');
  } else {
    for (const routeId of routeIds) {
      if (!isCleanPath(config.routes[routeId])) {
        errors.push(`routes.${routeId} must be a clean root-relative path ending in /.`);
      }
    }
  }

  if (!isPlainObject(config.shareTargets)) {
    errors.push('shareTargets must be an object.');
  } else {
    for (const routeId of shareIds) {
      const target = config.shareTargets[routeId];
      if (!isCleanPath(target) || target !== config.routes?.[routeId]) {
        errors.push(`shareTargets.${routeId} must equal routes.${routeId}.`);
      }
    }
  }

  if (!isPlainObject(config.pages)) {
    errors.push('pages must be an object.');
  } else {
    for (const routeId of routeIds) {
      const page = config.pages[routeId];
      if (!isPlainObject(page)) {
        errors.push(`pages.${routeId} must be an object.`);
        continue;
      }
      for (const field of PAGE_TEXT_FIELDS) {
        if (typeof page[field] !== 'string' || page[field].trim() === '') {
          errors.push(`pages.${routeId}.${field} must be non-empty text.`);
        }
      }
      if (!isCleanAssetPath(page.ogImage)) {
        errors.push(`pages.${routeId}.ogImage must be a clean root-relative asset path.`);
      }
    }
  }

  return errors;
}

export function composeSiteConfig(shell, experiences) {
  return {
    origin: shell.origin,
    routes: Object.fromEntries([
      ['chooser', '/'],
      ...experiences.map(record => [record.id, record.route]),
    ]),
    shareTargets: Object.fromEntries(experiences.map(record => [record.id, record.route])),
    pages: Object.fromEntries([
      ['chooser', shell.chooser],
      ...experiences.map(record => [record.id, record.metadata]),
    ]),
    experiences,
  };
}

function isCleanAssetPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return false;
  }
  try {
    const parsed = new URL(value, 'https://config.invalid');
    return parsed.origin === 'https://config.invalid'
      && parsed.search === ''
      && parsed.hash === ''
      && parsed.pathname === value
      && !value.endsWith('/');
  } catch {
    return false;
  }
}

export async function loadSiteConfig(
  { siteUrl = new URL('../src/content/site.json', import.meta.url) } = {},
) {
  const [shell, experiences] = await Promise.all([
    readFile(siteUrl, 'utf8').then(JSON.parse),
    loadExperienceRegistry(),
  ]);
  const config = composeSiteConfig(shell, experiences);
  const errors = validateSiteConfig(config);
  if (errors.length > 0) {
    throw new Error(`Invalid site config:\n${errors.map(error => `- ${error}`).join('\n')}`);
  }
  return config;
}

export function buildCanonicalUrl(config, routeId) {
  const errors = validateSiteConfig(config);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const path = config.routes[routeId];
  if (!path) throw new Error(`Unknown route: ${routeId}`);
  return new URL(path, config.origin).href;
}

export function buildShareUrl(config, routeId) {
  const errors = validateSiteConfig(config);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const path = config.shareTargets[routeId];
  if (!path) throw new Error(`Unknown share target: ${routeId}`);
  return new URL(path, config.origin).href;
}
