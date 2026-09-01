const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

/**
 * Metro has to reach shared/ at the repo root, which is OUTSIDE this package.
 * By default it refuses to serve files above the project directory, so the
 * import resolves during development and then fails at bundle time — the worst
 * ordering, because it looks fine until you build.
 *
 * watchFolders adds the repo root so those files are watched and served.
 * nodeModulesPaths keeps resolution anchored to mobile/node_modules so a stray
 * copy of React at the repo root cannot be picked up: two React instances in
 * one bundle is a hooks crash with an error message that names neither cause.
 */
const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [repoRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
