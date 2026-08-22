import fs from 'node:fs';
import path from 'node:path';
import { functionPath } from '../src/lib/functionPath.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx']);
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(location) : [location];
  });
}

const invocations = new Map();
for (const file of walk(path.join(ROOT, 'src'))) {
  if (!SOURCE_EXTENSIONS.has(path.extname(file))) continue;
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/functions\.invoke\(\s*['"]([^'"]+)['"]/g)) {
    const locations = invocations.get(match[1]) || [];
    locations.push(path.relative(ROOT, file));
    invocations.set(match[1], locations);
  }
}

const server = fs.readFileSync(path.join(ROOT, 'server/index.js'), 'utf8');
const mounts = new Set(
  [...server.matchAll(/app\.use\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]),
);

const missing = [...invocations]
  .map(([name, files]) => ({ name, files, route: functionPath(name) }))
  .filter(({ route }) => !mounts.has(route));

if (missing.length) {
  for (const item of missing) {
    console.error(`Missing API route ${item.route} for ${item.name} (${item.files.join(', ')})`);
  }
  process.exitCode = 1;
} else {
  console.log(`Verified ${invocations.size} frontend function names against Express route mounts.`);
}
