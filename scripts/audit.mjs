#!/usr/bin/env node
/**
 * `npm audit`, with a short list of advisories that have been read and accepted.
 *
 * npm cannot accept a single advisory: `npm audit --audit-level=high` fails on
 * every high one, whether a fix exists or not. This runs `npm audit --json` and
 * fails on any advisory at or above the level that is not in ACCEPTED below.
 * Each entry says why it cannot reach a visitor, and expires: after `until` the
 * advisory fails the build again, so it is looked at again rather than
 * forgotten. An advisory with a fix does not belong here; `npm audit fix` is
 * the answer to those.
 *
 *   node scripts/audit.mjs [--audit-level=high] [--prefix <dir>]
 *
 * Exits non-zero with each advisory it did not accept, so it can gate CI.
 */
import { execFileSync } from 'node:child_process';

const ACCEPTED = {
  // braces, every release (<= 3.0.3), CVE-2026-93687: a deeply nested brace
  // pattern overflows the stack. braces reaches this repo only through
  // Tailwind 3's build-time globbing (fast-glob, micromatch, chokidar), where
  // the patterns are the content globs in tailwind.config.js, never anything a
  // visitor sends. No fixed release exists yet, and no Tailwind 3 goes without it.
  'GHSA-vfj7-8cjw-p6xm': { until: '2026-12-01' },
};

const LEVELS = ['info', 'low', 'moderate', 'high', 'critical'];

const args = process.argv.slice(2);
const level = args.find((a) => a.startsWith('--audit-level='))?.split('=')[1] || 'high';
if (!LEVELS.includes(level)) {
  console.error(`Unknown --audit-level "${level}": use one of ${LEVELS.join(', ')}.`);
  process.exit(2);
}
const npmArgs = ['audit', '--json'];
const prefixAt = args.indexOf('--prefix');
if (prefixAt !== -1) npmArgs.push('--prefix', args[prefixAt + 1]);

let output;
try {
  output = execFileSync('npm', npmArgs, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
  // npm audit exits 1 whenever it finds anything; the report is still on stdout.
  output = error.stdout;
}

let report;
try {
  report = JSON.parse(output);
} catch {
  console.error(`npm audit did not return a report:\n${String(output).slice(0, 2000)}`);
  process.exit(1);
}
if (report.error) {
  console.error(`npm audit failed: ${report.error.summary || JSON.stringify(report.error)}`);
  process.exit(1);
}

// Each advisory once, with the packages it is reported against. Packages that
// only inherit one (via: ['braces']) carry no advisory of their own.
const advisories = new Map();
for (const [name, vulnerability] of Object.entries(report.vulnerabilities || {})) {
  for (const via of vulnerability.via) {
    if (typeof via === 'string') continue;
    const id = via.url?.split('/').pop() || String(via.source);
    if (!advisories.has(id)) advisories.set(id, { id, severity: via.severity, title: via.title, url: via.url, packages: new Set() });
    advisories.get(id).packages.add(name);
  }
}

const today = new Date().toISOString().slice(0, 10);
const threshold = LEVELS.indexOf(level);
let failures = 0;
for (const advisory of advisories.values()) {
  if (LEVELS.indexOf(advisory.severity) < threshold) continue;
  const where = [...advisory.packages].join(', ');
  const accepted = ACCEPTED[advisory.id];
  if (accepted && today <= accepted.until) {
    console.log(`accepted until ${accepted.until}: ${advisory.severity} ${where}: ${advisory.title} (${advisory.id})`);
    continue;
  }
  failures += 1;
  const lapsed = accepted ? ` (accepted until ${accepted.until}: look at it again)` : '';
  console.error(`${advisory.severity} ${where}: ${advisory.title} ${advisory.url}${lapsed}`);
}

console.log(failures
  ? `${failures} ${failures === 1 ? 'advisory' : 'advisories'} at ${level} or above: run npm audit fix, or read it and add it to ACCEPTED in scripts/audit.mjs.`
  : `No advisory at ${level} or above apart from the accepted ones.`);
process.exit(failures ? 1 : 0);
