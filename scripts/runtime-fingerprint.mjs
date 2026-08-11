const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const URL_VALUE = /https?:\/\/[^\s]+/gi;
const VOLATILE_NUMBER = /\b\d+\b/g;

export function normalizeRuntimeMessage(message) {
  return String(message ?? '')
    .toLowerCase()
    .replace(UUID, '<uuid>')
    .replace(URL_VALUE, '<url>')
    .replace(VOLATILE_NUMBER, '<n>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function runtimeErrorFingerprint({
  errorName,
  message,
  affectedRoutes = [],
}) {
  const routes = [...new Set(affectedRoutes.map(route => String(route).trim()))]
    .filter(Boolean)
    .sort()
    .join(',');
  return [
    String(errorName || 'error').trim().toLowerCase(),
    normalizeRuntimeMessage(message),
    routes,
  ].join(' | ');
}
