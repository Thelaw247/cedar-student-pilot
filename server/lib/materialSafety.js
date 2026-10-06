import zlib from 'node:zlib';
import { contentMatchesType, detectedType } from './fileSignature.js';

/**
 * What a fetched file is, and whether it is safe to keep and to read.
 *
 * An upload is checked by its bytes (lib/fileSignature.js): a page or a
 * program renamed to slides.pdf is refused. A file fetched from a link gets
 * the same check and two more, because a link is a step further from the
 * student's hands than a file they chose:
 *
 *   1. The type is decided from the bytes, not from the link or the
 *      server's Content-Type. A Drive link to a PDF answers with
 *      application/octet-stream; a course page answers text/html with a
 *      PDF's name in the address. Only a real PDF, or real text, is kept.
 *
 *   2. A PDF is searched for the things a document has no business
 *      carrying: JavaScript, a Launch action (run a program), embedded
 *      files, rich media, XFA forms. Those are how a PDF attacks the reader
 *      that opens it, and this server hands PDFs to a model that reads them
 *      and to the student's browser that downloads them. The search looks
 *      inside compressed object streams too, where a hostile file hides
 *      the names from a plain scan. A clean deck of slides carries none
 *      of these; a PDF with any of them is refused, with the reason.
 *
 * No antivirus engine runs here; these are the checks that can be made
 * with certainty from the bytes. The file is stored in a private bucket
 * that never executes anything and is served only to its owner.
 */

const PDF_THREATS = [
  { name: 'JavaScript', test: /\/(JavaScript|JS)\s*[(<\[/\d]/ },
  { name: 'a Launch action, which runs a program', test: /\/Launch\b/ },
  { name: 'an embedded file', test: /\/EmbeddedFiles?\b/ },
  { name: 'rich media', test: /\/RichMedia\b/ },
  { name: 'an XFA form', test: /\/XFA\b/ },
];

/** Why a PDF cannot be kept, or null when it carries nothing of the kind. */
export function pdfThreatReason(buffer) {
  const raw = buffer.toString('latin1');
  const hit = PDF_THREATS.find((t) => t.test.test(raw));
  if (hit) return hit.name;
  // The same names inside FlateDecode streams (object streams hold whole
  // dictionaries compressed). Each stream is inflated on its own; one that
  // will not inflate is skipped, not trusted.
  const streamRe = /stream\r?\n/g;
  let m;
  let scanned = 0;
  while ((m = streamRe.exec(raw)) !== null && scanned < 2000) {
    scanned += 1;
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    const slice = buffer.subarray(start, end);
    let inflated;
    try { inflated = zlib.inflateSync(slice, { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('latin1'); } catch { continue; }
    const inner = PDF_THREATS.find((t) => t.test.test(inflated));
    if (inner) return inner.name;
  }
  return null;
}

/** A page served where a file was expected: the usual answer of a sign-in wall or a viewer. */
function looksLikeHtml(buffer) {
  const head = buffer.subarray(0, 2048).toString('latin1').replace(/^﻿/, '').trimStart().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html') || /^<\?xml[^>]*>\s*<html/.test(head) || /<(head|body|title|meta|script)\b/.test(head.slice(0, 600)) && head.startsWith('<');
}

/**
 * Decide what a fetched file is. Returns { contentType } for a file that can
 * be kept, or throws a TypeError with the reason it cannot.
 *
 * `declaredType` is the server's Content-Type and `finalUrl` the address
 * the bytes came from; both are hints for telling plain text from
 * Markdown, never the basis for accepting anything.
 */
export function classifyFetchedMaterial(buffer, { declaredType = '', finalUrl = '' } = {}) {
  if (!buffer || buffer.length === 0) throw new TypeError('That link answered with an empty file.');
  const detected = detectedType(buffer);
  if (detected === 'application/pdf') {
    const threat = pdfThreatReason(buffer);
    if (threat) throw new TypeError(`This PDF was not kept: it contains ${threat}. Ask for a plain copy of the file.`);
    return { contentType: 'application/pdf' };
  }
  if (detected) throw new TypeError('That link is an image. Only PDF and text files can be added as materials.');
  if (looksLikeHtml(buffer)) {
    throw new TypeError('That link opens a web page, not a file. Use the link to the file itself, or a share link that anyone can download from.');
  }
  const path = (() => { try { return new URL(finalUrl).pathname.toLowerCase(); } catch { return ''; } })();
  const declared = String(declaredType || '').toLowerCase();
  const textual = declared.startsWith('text/') || /\.(txt|md|markdown)$/.test(path);
  if (textual && contentMatchesType(buffer, 'text/plain')) {
    const markdown = declared === 'text/markdown' || declared === 'text/x-markdown' || /\.(md|markdown)$/.test(path);
    return { contentType: markdown ? 'text/markdown' : 'text/plain' };
  }
  throw new TypeError('That link is not a PDF or a text file. Only those can be added as materials.');
}
