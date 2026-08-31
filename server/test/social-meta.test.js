import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Guards the share card and canonical host in index.html.
 *
 * Social scrapers do not resolve relative paths, so these have to be absolute —
 * which means they carry a hardcoded hostname that goes stale silently. They
 * pointed at the workers.dev origin for as long as that was the only host. The
 * failure mode is quiet and permanent: WhatsApp caches a preview for days with
 * no way to purge it, so a card that 404s stays broken everywhere it was posted.
 */

const HTML = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
// Comments stripped before the stale-host check: this is an absence assertion,
// and a hostname named in prose explaining why the canonical exists is not a
// live reference. A commented-out meta tag is not served either. Note this is
// the opposite of the comment-stripping in public-routes and stripe-boot-check,
// where the point was that a commented-out call must not satisfy a presence
// assertion — strip in both cases, for opposite reasons.
const MARKUP = HTML.replace(/<!--[\s\S]*?-->/g, '');
const CANONICAL_HOST = 'https://praelecta.ca';

test('no stale hostname is left in the served markup', () => {
  assert.ok(!/workers\.dev/.test(MARKUP), 'index.html still references the workers.dev origin');
  assert.ok(!/cedarpilot\.ca|cedar-student-pilot\.|base44/.test(MARKUP), 'index.html still references a retired host');
});

test('the share card is absolute, on the canonical host, and points at a file that exists', () => {
  const tags = [...HTML.matchAll(/<meta (?:property|name)="(og:image|twitter:image)" content="([^"]+)"/g)];
  assert.equal(tags.length, 2, 'expected both og:image and twitter:image');
  for (const [, name, url] of tags) {
    assert.ok(url.startsWith(`${CANONICAL_HOST}/`), `${name} is not absolute on ${CANONICAL_HOST}: ${url}`);
    const file = new URL(`../../public/${url.slice(CANONICAL_HOST.length + 1)}`, import.meta.url);
    assert.ok(fs.existsSync(file), `${name} points at ${url}, which is not in public/`);
  }
});

test('the share card is a JPEG — not every scraper handles WebP or PNG', () => {
  const image = HTML.match(/<meta property="og:image" content="([^"]+)"/)[1];
  assert.match(image, /\.jpe?g$/, `og:image is ${image}; scrapers are least surprising with JPEG`);
});

test('the share card stays under the size ceiling that makes WhatsApp drop it silently', () => {
  const image = HTML.match(/<meta property="og:image" content="([^"]+)"/)[1];
  const file = new URL(`../../public/${image.slice(CANONICAL_HOST.length + 1)}`, import.meta.url);
  const bytes = fs.statSync(file).size;
  assert.ok(bytes < 600_000, `og card is ${bytes} bytes; above ~600KB WhatsApp shows no image at all`);
});

test('a canonical URL is declared, so two hosts serving the same app do not compete', () => {
  const canonical = HTML.match(/<link rel="canonical" href="([^"]+)"/);
  assert.ok(canonical, 'no canonical link — both hosts look like the original to a crawler');
  assert.ok(canonical[1].startsWith(CANONICAL_HOST), `canonical points at ${canonical[1]}`);
});
