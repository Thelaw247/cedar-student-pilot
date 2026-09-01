import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * shared/ is the code the web app and the iOS app both use. Everything in it
 * must run on both, which means no browser globals and no Vite build-time
 * substitutions.
 *
 * This is enforced rather than trusted because the failure is silent in the
 * direction people work. Someone adding `localStorage` to shared/settings-ish
 * code is editing from the web app, where it works, passes lint and passes
 * every web test. Nothing goes wrong until Metro bundles it for a device — or
 * worse, until it runs on a device and throws at the moment a student presses
 * record.
 *
 * React Native has no window, no document, no localStorage, no indexedDB and no
 * MediaRecorder, and `import.meta.env` is a Vite feature Metro does not
 * implement. Anything needing those belongs in src/lib (web) or mobile/src
 * (native), with a shared interface between them if both need the behaviour.
 */

const DIR = new URL('../../shared/', import.meta.url);
const FILES = fs.readdirSync(DIR).filter((f) => f.endsWith('.js'));

// Comments and strings are stripped first: a comment explaining why a browser
// API is absent, or a string like 'no-window', must not read as a use of one.
const code = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''")
  .replace(/"(?:[^"\\]|\\.)*"/g, '""')
  .replace(/`(?:[^`\\]|\\.)*`/g, '``');

const BANNED = [
  [/\bwindow\b/, 'window'],
  [/\bdocument\b/, 'document'],
  [/\blocalStorage\b/, 'localStorage'],
  [/\bsessionStorage\b/, 'sessionStorage'],
  [/\bindexedDB\b/i, 'indexedDB'],
  [/\bnavigator\b/, 'navigator'],
  [/\bMediaRecorder\b/, 'MediaRecorder'],
  [/import\.meta/, 'import.meta'],
];

test('shared/ contains files', () => {
  assert.ok(FILES.length > 0, 'shared/ is empty — the re-exports would resolve to nothing');
});

test('no file in shared/ touches a browser-only global', () => {
  for (const f of FILES) {
    const src = code(fs.readFileSync(new URL(f, DIR), 'utf8'));
    for (const [re, name] of BANNED) {
      assert.ok(!re.test(src),
        `shared/${f} uses ${name}, which does not exist in React Native — move it to src/lib or mobile/src`);
    }
  }
});

test('nothing in shared/ imports from the web app', () => {
  for (const f of FILES) {
    const src = fs.readFileSync(new URL(f, DIR), 'utf8');
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) {
      const spec = m[1];
      assert.ok(!spec.startsWith('@/'),
        `shared/${f} imports ${spec} from the web app; shared code cannot depend on src/`);
      assert.ok(!spec.includes('../src/'),
        `shared/${f} reaches back into src/`);
    }
  }
});

test('every shared module is re-exported from src/lib so web imports still resolve', () => {
  for (const f of FILES) {
    const stub = new URL(`../../src/lib/${f}`, import.meta.url);
    assert.ok(fs.existsSync(stub), `src/lib/${f} is missing; existing web imports of it would break`);
    const src = fs.readFileSync(stub, 'utf8');
    assert.match(src, new RegExp(`export \\* from '\\.\\./\\.\\./shared/${f.replace('.', '\\.')}'`),
      `src/lib/${f} does not re-export shared/${f}`);
  }
});
