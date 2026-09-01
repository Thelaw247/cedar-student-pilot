#!/usr/bin/env node
/**
 * Resolve every import in the iOS app without bundling.
 *
 * A full `expo export` is the real proof, but it needs more memory than CI or
 * this sandbox has, and it is slow. The failures that actually happen when
 * adding screens are narrow and all statically detectable:
 *
 *   - a relative path that does not exist (the extensionless .js/.jsx guess)
 *   - a package imported but never installed in mobile/
 *   - mobile code reaching into src/, the web app, which Metro cannot bundle
 *   - shared/ reaching back into the web app the same way
 *
 * Exits non-zero with the offending file and specifier, so it can gate CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobileRoot = path.join(repoRoot, 'mobile');
const mobileModules = path.join(mobileRoot, 'node_modules');

const EXTS = ['', '.js', '.jsx', '.json', '/index.js', '/index.jsx'];
const walk = (dir) => fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
      return /\.(js|jsx)$/.test(e.name) ? [p] : [];
    })
  : [];

const files = [
  ...walk(path.join(mobileRoot, 'app')),
  ...walk(path.join(mobileRoot, 'src')),
  ...walk(path.join(repoRoot, 'shared')),
];

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
const problems = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(repoRoot, file);
  const isMobile = rel.startsWith('mobile' + path.sep);

  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1] || m[2];
    if (!spec) continue;

    if (spec.startsWith('.')) {
      const base = path.resolve(path.dirname(file), spec);
      if (!EXTS.some((ext) => fs.existsSync(base + ext) && fs.statSync(base + ext).isFile())) {
        problems.push(`${rel}: relative import '${spec}' resolves to nothing`);
        continue;
      }
      const target = path.relative(repoRoot, base);
      if (target.startsWith('src' + path.sep)) {
        problems.push(`${rel}: imports '${spec}' from the web app (src/); move the code to shared/ instead`);
      }
      continue;
    }

    if (spec.startsWith('@/')) {
      problems.push(`${rel}: uses the web alias '${spec}'; Metro does not resolve @/ — use a relative path or shared/`);
      continue;
    }
    if (spec.startsWith('node:')) continue;

    // Bare package: must be installed under mobile/, since that is the only
    // node_modules Metro is configured to look in.
    if (!isMobile && !rel.startsWith('shared')) continue;
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (!fs.existsSync(path.join(mobileModules, pkg))) {
      problems.push(`${rel}: imports '${pkg}', which is not installed in mobile/node_modules`);
    }
  }
}

if (problems.length) {
  console.error(`Mobile import check failed (${problems.length}):`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`Resolved every import across ${files.length} mobile and shared files.`);
