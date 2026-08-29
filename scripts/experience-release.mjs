import { selectBuildExperiences } from './experience-registry.mjs';

export function createReleaseValidationPlan(records, environment) {
  const validationKey = environment === 'production' ? 'release' : 'development';
  return Object.freeze(
    selectBuildExperiences(records, environment).map(record => Object.freeze({
      id: record.id,
      argv: Object.freeze([...record.build.validation[validationKey]]),
    })),
  );
}
