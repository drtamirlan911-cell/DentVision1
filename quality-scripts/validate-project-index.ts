import fs from 'node:fs';
import path from 'node:path';

type JsonObject = Record<string, unknown>;

const root = process.cwd();
const indexDir = path.join(root, '.dentvision');
const errors: string[] = [];

function readObject(filename: string): JsonObject {
  const absolute = path.join(indexDir, filename);
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      errors.push(`.dentvision/${filename} must contain a JSON object.`);
      return {};
    }
    return parsed as JsonObject;
  } catch (error) {
    errors.push(`Cannot read .dentvision/${filename}: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

function stringArray(record: JsonObject, key: string, label: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    errors.push(`${label}.${key} must be an array of strings.`);
    return [];
  }
  if (value.length === 0) errors.push(`${label}.${key} must not be empty.`);
  return value as string[];
}

function generated(record: JsonObject, label: string): void {
  if (record.generated !== true) errors.push(`${label} is not marked generated=true.`);
  if (record.generator !== 'quality-scripts/project-index.ts') {
    errors.push(`${label} has an unexpected generator identity.`);
  }
}

const routes = readObject('routes.json');
const api = readObject('api.json');
const roles = readObject('roles.json');
const workspaces = readObject('workspaces.json');
const tests = readObject('tests.json');
const security = readObject('security.json');
const parity = readObject('parity.json');

for (const [record, label] of [
  [routes, 'routes.json'],
  [api, 'api.json'],
  [roles, 'roles.json'],
  [workspaces, 'workspaces.json'],
  [tests, 'tests.json'],
  [security, 'security.json'],
  [parity, 'parity.json'],
] as const) {
  generated(record, label);
}

const webRoutes = routes.webRoutes;
const backendRoutes = routes.backendRoutes;
if (!Array.isArray(webRoutes) || webRoutes.length === 0) {
  errors.push('routes.json.webRoutes must contain discovered web routes.');
}
if (!Array.isArray(backendRoutes) || backendRoutes.length === 0) {
  errors.push('routes.json.backendRoutes must contain discovered backend routes.');
}
if (!Array.isArray(api.backendRoutes) || api.backendRoutes.length === 0) {
  errors.push('api.json.backendRoutes must contain discovered backend routes.');
}

const discoveredRoles = stringArray(roles, 'roles', 'roles.json');
const discoveredWorkspaces = stringArray(workspaces, 'workspaces', 'workspaces.json');
const testFiles = stringArray(tests, 'testFiles', 'tests.json');
const securityRequirements = stringArray(security, 'requirements', 'security.json');
const androidScreens = stringArray(parity, 'androidScreens', 'parity.json');
const parityWebRoutes = stringArray(parity, 'webRoutes', 'parity.json');

for (const requiredTest of ['e2e/tests/api-contract.spec.ts', 'e2e/tests/support.spec.ts']) {
  if (!testFiles.includes(requiredTest)) {
    errors.push(`Generated test inventory is missing ${requiredTest}.`);
  }
}

for (const requirement of ['authentication', 'RBAC', 'workspace/tenant isolation', 'ownership checks', 'audit trail']) {
  if (!securityRequirements.includes(requirement)) {
    errors.push(`Generated security inventory is missing requirement: ${requirement}.`);
  }
}

if (discoveredRoles.length < 2) errors.push('Role inventory looks incomplete.');
if (discoveredWorkspaces.length < 1) errors.push('Workspace inventory looks incomplete.');
if (parityWebRoutes.length < 1) errors.push('Web/mobile parity inventory has no web routes.');

const currentStatePath = path.join(indexDir, 'current-state.json');
try {
  const currentState: unknown = JSON.parse(fs.readFileSync(currentStatePath, 'utf8'));
  if (typeof currentState !== 'object' || currentState === null || Array.isArray(currentState)) {
    errors.push('.dentvision/current-state.json must remain a curated JSON object.');
  } else {
    const state = currentState as JsonObject;
    if (state.generated !== false || state.source !== 'DENTVISION_CONTEXT.md') {
      errors.push('Index generation must preserve curated current-state.json sourced from DENTVISION_CONTEXT.md.');
    }
  }
} catch (error) {
  errors.push(`Cannot read curated .dentvision/current-state.json: ${error instanceof Error ? error.message : String(error)}`);
}

if (errors.length > 0) {
  console.error('DentVision project index validation failed:');
  for (const error of errors) console.error(` - ${error}`);
  process.exitCode = 1;
} else {
  console.log('DentVision project index validation passed.');
  console.log(` - ${webRoutes.length} discovered web routes`);
  console.log(` - ${backendRoutes.length} discovered backend routes`);
  console.log(` - ${discoveredRoles.length} roles, ${discoveredWorkspaces.length} workspace identifiers`);
  console.log(` - ${testFiles.length} test files, including support and API contract tests`);
  console.log(` - ${androidScreens.length} Android screens indexed for parity`);
  console.log(' - curated current-state.json preserved');
}
