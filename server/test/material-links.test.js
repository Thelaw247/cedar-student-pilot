import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import zlib from 'node:zlib';
import { normalizeMaterialLink, materialFileName, MAX_LINK_LENGTH } from '../lib/materialLinks.js';
import { isPublicAddress, fetchPublicFile, resolvePublicAddress } from '../lib/safeFetch.js';
import { pdfThreatReason, classifyFetchedMaterial } from '../lib/materialSafety.js';
import { downloadExpiryFor, PLAYBACK_EXPIRY_SECONDS } from '../lib/r2.js';
import { takeImportSlot } from '../routes/lectureMaterials.js';

/**
 * A file from a link (6 Oct 2026).
 *
 * A student pastes the address of a PDF, or a Drive, Dropbox or OneDrive
 * share; the server fetches it, checks it, keeps it and reads it like an
 * upload. Three things have to hold, and each is pinned here: the link is
 * turned into the address that actually returns the file; the fetch can
 * reach nothing of ours (no private address, on any hop, on any port but
 * the web's two); and what comes back is kept only if it is a real PDF with
 * nothing hostile in it, or real text.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const ROUTE = read('../routes/lectureMaterials.js');
const WIDGET = read('../../src/components/lecture/LectureMaterials.jsx');
const CLIENT = read('../../src/lib/cedarClient.js');

// --- the link -----------------------------------------------------------

test('share links become the address of the file behind them', () => {
  assert.deepEqual(normalizeMaterialLink('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing'),
    { url: 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOp', kind: 'google-drive' });
  assert.equal(normalizeMaterialLink('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp').url, 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOp');
  assert.equal(normalizeMaterialLink('https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/edit#slide=1').url, 'https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/export/pdf');
  assert.equal(normalizeMaterialLink('https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit').url, 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/export?format=pdf');
  assert.equal(normalizeMaterialLink('https://www.dropbox.com/s/abc123/notes.pdf?dl=0').url, 'https://www.dropbox.com/s/abc123/notes.pdf?dl=1');
  assert.equal(normalizeMaterialLink('https://onedrive.live.com/?cid=1&resid=2').url, 'https://onedrive.live.com/?cid=1&resid=2&download=1');
  assert.equal(normalizeMaterialLink('https://1drv.ms/b/s!Abc').kind, 'onedrive');
  assert.equal(normalizeMaterialLink('https://school.sharepoint.com/:b:/g/abc').url, 'https://school.sharepoint.com/:b:/g/abc?download=1');
  // A plain address is fetched as given; a bare host gets https.
  assert.deepEqual(normalizeMaterialLink('  example.com/slides.pdf#page=3 '), { url: 'https://example.com/slides.pdf', kind: 'direct' });
});

test('a link that cannot be a file is refused in a sentence', () => {
  assert.throws(() => normalizeMaterialLink(''), /Paste a link/);
  assert.throws(() => normalizeMaterialLink('ftp://example.com/x.pdf'), /Only http and https/);
  assert.throws(() => normalizeMaterialLink('file:///etc/passwd'), /Only http and https/);
  assert.throws(() => normalizeMaterialLink('https://user:pw@example.com/x.pdf'), /username and password/);
  assert.throws(() => normalizeMaterialLink('not a link at all'), /does not look like a link/);
  assert.throws(() => normalizeMaterialLink(`https://example.com/${'a'.repeat(MAX_LINK_LENGTH)}`), /too long/);
});

test('the saved name comes from the server, else the address, and always ends in the right extension', () => {
  assert.equal(materialFileName({ contentDisposition: 'attachment; filename="Week 4 slides.pdf"', finalUrl: 'https://drive.google.com/uc?id=1', contentType: 'application/pdf' }), 'Week 4 slides.pdf');
  assert.equal(materialFileName({ contentDisposition: "attachment; filename*=UTF-8''Lecture%204%20%E2%80%93%20notes.pdf", contentType: 'application/pdf' }), 'Lecture 4 – notes.pdf');
  assert.equal(materialFileName({ finalUrl: 'https://example.com/course/syllabus.PDF', contentType: 'application/pdf' }), 'syllabus.PDF');
  assert.equal(materialFileName({ finalUrl: 'https://docs.google.com/presentation/d/x/export/pdf', contentType: 'application/pdf' }), 'Document.pdf');
  assert.equal(materialFileName({ finalUrl: 'https://example.com/readme', contentType: 'text/markdown' }), 'Notes.md');
  assert.equal(materialFileName({ contentDisposition: 'attachment; filename="notes.txt"', contentType: 'application/pdf' }), 'notes.pdf', 'the type the bytes earned wins over the name');
  assert.equal(materialFileName({ contentDisposition: 'attachment; filename="../../x:y?.pdf"', contentType: 'application/pdf' }), '....xy.pdf');
});

// --- where a fetch may go -------------------------------------------------

test('private, loopback, link-local and reserved addresses are not public', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '192.0.2.1', '198.18.0.1',
    '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:7f00:1', '64:ff9b::7f00:1', '2001:db8::1']) {
    assert.equal(isPublicAddress(ip), false, `${ip} should be refused`);
  }
  for (const ip of ['8.8.8.8', '142.250.72.14', '172.32.0.1', '172.15.0.1', '100.63.0.1', '2606:4700::6810:84e5', '::ffff:8.8.8.8', '64:ff9b::808:808']) {
    assert.equal(isPublicAddress(ip), true, `${ip} should be allowed`);
  }
  assert.equal(isPublicAddress('not-an-ip'), false);
});

test('a name that resolves to a private address is refused before any request', async () => {
  await assert.rejects(resolvePublicAddress('localhost'), /cannot fetch from/);
  await assert.rejects(resolvePublicAddress('127.0.0.1'), /cannot fetch from/);
  await assert.rejects(resolvePublicAddress('[::1]'), /cannot fetch from/);
  await assert.rejects(fetchPublicFile('http://127.0.0.1:1/x.pdf'), /usual web ports|cannot fetch from/);
  await assert.rejects(fetchPublicFile('http://169.254.169.254/latest/meta-data/'), /cannot fetch from/);
});

/** A tiny file server on a loopback port; only reachable with allowPrivate. */
function serve(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1');

test('a file is fetched whole, with a cap, through redirects, and only through vetted addresses', async () => {
  const { server, base } = await serve((req, res) => {
    if (req.url === '/go') { res.writeHead(302, { Location: '/slides.pdf' }); res.end(); return; }
    if (req.url === '/slides.pdf') { res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="Week 4.pdf"' }); res.end(PDF); return; }
    if (req.url === '/big') { res.writeHead(200, { 'Content-Type': 'application/pdf' }); res.end(Buffer.alloc(3000, 0x41)); return; }
    if (req.url === '/loop') { res.writeHead(302, { Location: '/loop' }); res.end(); return; }
    if (req.url === '/private') { res.writeHead(302, { Location: 'http://169.254.169.254/' }); res.end(); return; }
    if (req.url === '/locked') { res.writeHead(403); res.end('no'); return; }
    res.writeHead(404); res.end();
  });
  // Only the test server itself is let through; every other host, on every
  // hop, is judged as in production.
  const local = { allowPrivate: ['127.0.0.1'] };
  try {
    const got = await fetchPublicFile(`${base}/go`, local);
    assert.equal(got.buffer.equals(PDF), true);
    assert.equal(got.contentType, 'application/octet-stream');
    assert.match(got.contentDisposition, /Week 4\.pdf/);
    assert.equal(got.finalUrl, `${base}/slides.pdf`);
    await assert.rejects(fetchPublicFile(`${base}/big`, { ...local, maxBytes: 2000 }), /bigger than 20 MB/);
    await assert.rejects(fetchPublicFile(`${base}/loop`, local), /too many times/);
    await assert.rejects(fetchPublicFile(`${base}/locked`, local), /needs a sign-in/);
    await assert.rejects(fetchPublicFile(`${base}/missing`, local), /Nothing is at that link/);
    // A redirect from the allowed host to the cloud metadata address is
    // refused on the second hop.
    await assert.rejects(fetchPublicFile(`${base}/private`, local), /cannot fetch from/);
    // And with no allowance at all, a loopback link on an odd port fails
    // before any request is made.
    await assert.rejects(fetchPublicFile(`${base}/slides.pdf`), /usual web ports/);
  } finally {
    server.close();
  }
});

// --- what comes back ------------------------------------------------------

function pdfWith(body) {
  return Buffer.from(`%PDF-1.5\n1 0 obj\n<< /Type /Catalog ${body} >>\nendobj\n%%EOF\n`, 'latin1');
}

test('a PDF with JavaScript, a Launch action, embedded files, rich media or XFA is refused, even inside a compressed stream', () => {
  assert.equal(pdfThreatReason(PDF), null);
  assert.equal(pdfThreatReason(pdfWith('/OpenAction << /S /JavaScript /JS (app.alert(1)) >>')), 'JavaScript');
  assert.equal(pdfThreatReason(pdfWith('/OpenAction << /S /Launch /F (cmd.exe) >>')), 'a Launch action, which runs a program');
  assert.equal(pdfThreatReason(pdfWith('/Names << /EmbeddedFiles 5 0 R >>')), 'an embedded file');
  assert.equal(pdfThreatReason(pdfWith('/RichMedia 5 0 R')), 'rich media');
  assert.equal(pdfThreatReason(pdfWith('/AcroForm << /XFA 5 0 R >>')), 'an XFA form');
  // The same name hidden in an object stream.
  const hidden = zlib.deflateSync(Buffer.from('<< /S /JavaScript /JS (this.exportDataObject()) >>', 'latin1'));
  const objstm = Buffer.concat([
    Buffer.from('%PDF-1.5\n1 0 obj\n<< /Type /ObjStm /Filter /FlateDecode /Length 999 >>\nstream\n', 'latin1'),
    hidden,
    Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1'),
  ]);
  assert.equal(pdfThreatReason(objstm), 'JavaScript');
  // Ordinary words in a PDF's text are not threats.
  assert.equal(pdfThreatReason(pdfWith('/Title (Launching the satellite: embedded systems and JavaScript in the browser)')), null);
});

test('what is kept is decided by the bytes, never by the link or the server', () => {
  assert.deepEqual(classifyFetchedMaterial(PDF, { declaredType: 'application/octet-stream', finalUrl: 'https://x/uc?id=1' }), { contentType: 'application/pdf' });
  assert.deepEqual(classifyFetchedMaterial(Buffer.from('# Notes\n\nSome text\n'), { declaredType: 'text/plain', finalUrl: 'https://x/notes.md' }), { contentType: 'text/markdown' });
  assert.deepEqual(classifyFetchedMaterial(Buffer.from('plain words'), { declaredType: 'text/plain; charset=utf-8', finalUrl: 'https://x/notes' }), { contentType: 'text/plain' });
  assert.throws(() => classifyFetchedMaterial(Buffer.from('<!DOCTYPE html><html><head><title>Sign in</title></head></html>'), { declaredType: 'text/html', finalUrl: 'https://x/slides.pdf' }), /opens a web page/);
  assert.throws(() => classifyFetchedMaterial(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]), { declaredType: 'image/png' }), /an image/);
  assert.throws(() => classifyFetchedMaterial(Buffer.from('MZ\x90\x00\x03', 'latin1'), { declaredType: 'application/pdf', finalUrl: 'https://x/slides.pdf' }), /not a PDF or a text file/);
  assert.throws(() => classifyFetchedMaterial(Buffer.alloc(0)), /empty file/);
  assert.throws(() => classifyFetchedMaterial(pdfWith('/OpenAction << /S /JavaScript /JS (x) >>')), /contains JavaScript/);
});

// --- the route, the client and the widget ---------------------------------

test('the route fetches after the tier check and the cap, and reads the file the way an upload is read', () => {
  const route = ROUTE.slice(ROUTE.indexOf("router.post('/from-url'"), ROUTE.indexOf("router.get('/download-url'"));
  const order = ['normalizeMaterialLink(', 'requireTier(', 'targetIsFull(', 'takeImportSlot(', 'fetchPublicFile(', 'classifyFetchedMaterial(', 'materialFileName(', 'gateMaterial(', 'storeFetchedMaterial(', 'saveMaterial('];
  let last = -1;
  for (const step of order) {
    const at = route.indexOf(step);
    assert.ok(at > last, `${step} is out of order or missing`);
    last = at;
  }
  // One save step for both doors, so the credit rules cannot drift apart.
  assert.equal((ROUTE.match(/await saveMaterial\(/g) || []).length, 2);
  assert.match(ROUTE, /status\(429\)/);
});

test('the import rate is bounded per student', () => {
  const user = 'rate-test-user';
  let t = 1_000_000;
  for (let i = 0; i < 12; i++) assert.equal(takeImportSlot(user, t += 1000), true);
  assert.equal(takeImportSlot(user, t + 1000), false);
  assert.equal(takeImportSlot(user, t + 11 * 60 * 1000), true, 'the window slides');
  assert.equal(takeImportSlot('someone-else', t), true);
});

test('the client and the widget offer the link beside the upload, with the server\'s own sentence on refusal', () => {
  assert.match(CLIENT, /async importFromUrl\(target, url\)/);
  assert.match(CLIENT, /\/lecture-materials\/from-url/);
  assert.match(WIDGET, /materials\.importFromUrl\(/);
  assert.match(WIDGET, /Add from a link/);
  assert.match(WIDGET, /err\?\.response\?\.data\?\.error/);
  assert.match(WIDGET, /gateFromError\(err\)/, 'a tier refusal is the upgrade card, not a red string');
});

test('a recording\'s playback URL outlives a lecture; other downloads keep the short window', () => {
  assert.equal(downloadExpiryFor('users/u/recordings/x.webm'), PLAYBACK_EXPIRY_SECONDS);
  assert.equal(PLAYBACK_EXPIRY_SECONDS, 4 * 60 * 60);
  assert.equal(downloadExpiryFor('users/u/avatars/x.png'), 15 * 60);
});
