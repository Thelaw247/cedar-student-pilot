/**
 * A link a student pastes, turned into the address of the file behind it.
 *
 * Professors post slides and past papers as links more often than as
 * attachments: a course page, a Google Drive share, a Dropbox folder. A
 * student with the link should be able to paste it and have the file land
 * with the class materials, read by the same tools that read an upload.
 *
 * Most links are the file itself. The ones that are not are the share
 * pages of the three services students actually use, which open a viewer
 * rather than the bytes; each has a documented form that returns the file,
 * and that is what the fetch is sent to. Anything else is fetched as given
 * and judged by what comes back (lib/materialSafety.js).
 *
 * Pure: strings in, strings out, no network. The network side, with the
 * checks on where a link may point, is lib/safeFetch.js.
 */

export const MAX_LINK_LENGTH = 2048;

/**
 * Parse and normalise a pasted link. Throws a TypeError with a sentence the
 * student can act on when the link is not something a file can come from.
 */
export function normalizeMaterialLink(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new TypeError('Paste a link to the file first.');
  if (text.length > MAX_LINK_LENGTH) throw new TypeError('That link is too long to be a file link.');
  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    throw new TypeError('That does not look like a link. It should start with https://');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError('Only http and https links can be fetched.');
  }
  if (url.username || url.password) {
    throw new TypeError('Links with a username and password in them cannot be used.');
  }
  url.hash = '';

  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  // Google Drive: /file/d/<id>/view, /open?id=<id>, /uc?id=<id>.
  if (host === 'drive.google.com' || host === 'docs.google.com') {
    const fileMatch = path.match(/^\/file\/d\/([\w-]{10,})/);
    const idParam = url.searchParams.get('id');
    if (host === 'drive.google.com' && (fileMatch || idParam)) {
      const id = fileMatch ? fileMatch[1] : idParam;
      if (!/^[\w-]{10,}$/.test(id)) throw new TypeError('That Google Drive link has no file id in it.');
      return { url: `https://drive.google.com/uc?export=download&id=${id}`, kind: 'google-drive' };
    }
    // A Google Doc, Slides or Sheet: the export endpoint gives a PDF.
    const docMatch = path.match(/^\/(document|presentation|spreadsheets)\/d\/([\w-]{10,})/);
    if (host === 'docs.google.com' && docMatch) {
      const [, type, id] = docMatch;
      if (type === 'presentation') return { url: `https://docs.google.com/presentation/d/${id}/export/pdf`, kind: 'google-slides' };
      return { url: `https://docs.google.com/${type}/d/${id}/export?format=pdf`, kind: type === 'document' ? 'google-doc' : 'google-sheet' };
    }
  }

  // Dropbox: the same address with dl=1 answers with the file.
  if (host === 'www.dropbox.com' || host === 'dropbox.com') {
    url.searchParams.set('dl', '1');
    return { url: url.toString(), kind: 'dropbox' };
  }
  if (host === 'dl.dropboxusercontent.com') return { url: url.toString(), kind: 'dropbox' };

  // OneDrive and SharePoint: download=1 on the share address returns the
  // file; a 1drv.ms short link redirects to the long one first, and the
  // redirect is re-checked like any other (safeFetch).
  if (host === 'onedrive.live.com' || host.endsWith('.sharepoint.com') || host === '1drv.ms') {
    if (host !== '1drv.ms') url.searchParams.set('download', '1');
    return { url: url.toString(), kind: 'onedrive' };
  }

  return { url: url.toString(), kind: 'direct' };
}

/**
 * The name the saved file gets: the one the server offered
 * (Content-Disposition), else the last part of the address, else a name
 * from the type. Always ends in the extension the type earned, so a slide
 * deck exported from Google ends up "Lecture 4 slides.pdf" and not
 * "export?format=pdf".
 */
export function materialFileName({ contentDisposition = '', finalUrl = '', contentType = 'application/pdf' }) {
  const ext = contentType === 'application/pdf' ? 'pdf' : contentType === 'text/markdown' ? 'md' : 'txt';
  let name = '';
  const star = String(contentDisposition).match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/);
  const plain = String(contentDisposition).match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/);
  if (star) {
    try { name = decodeURIComponent(star[1].trim()); } catch { name = star[1].trim(); }
  } else if (plain) {
    name = (plain[1] || plain[2] || '').trim();
  }
  if (!name) {
    try {
      const last = decodeURIComponent(new URL(finalUrl).pathname.split('/').filter(Boolean).pop() || '');
      // An address like /uc or /export carries no name worth keeping.
      if (last && /\.[a-z0-9]{1,5}$/i.test(last)) name = last;
    } catch { /* no name from the address */ }
  }
  name = name.replace(/[\u0000-\u001f\\/:*?"<>|]/g, '').trim().slice(0, 200);
  if (!name) name = contentType === 'application/pdf' ? 'Document' : 'Notes';
  if (!new RegExp(`\\.${ext}$`, 'i').test(name)) name = `${name.replace(/\.[a-z0-9]{1,5}$/i, '')}.${ext}`;
  return name;
}
