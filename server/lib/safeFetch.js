import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';

/**
 * Fetch a file from an address a student pasted, without letting that
 * address reach anything of ours.
 *
 * A server that fetches whatever URL it is handed is a server that can be
 * pointed at its own network: the database, the metadata service of the
 * host it runs on, another service behind the firewall. So before a single
 * byte is requested, the name is resolved and every address it resolves to
 * has to be a public one; then the connection is made to that vetted
 * address and no other (the lookup the socket uses is pinned to it, so a
 * name that answers differently a moment later changes nothing); and every
 * redirect goes through the same checks, because a public host can answer
 * with "go to 169.254.169.254".
 *
 * Beyond where, how much: a byte cap enforced while the body streams (a
 * Content-Length is advice, not a promise), a connection timeout, an
 * overall timeout, and a short redirect chain. The caller gets a Buffer and
 * the headers that say what it is; what to make of the bytes is
 * lib/materialSafety.js.
 *
 * Only ports 80 and 443. A file link on another port is rare enough, and a
 * port is the first thing a scan of an internal network varies.
 */
export const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const CONNECT_TIMEOUT_MS = 10_000;
const TOTAL_TIMEOUT_MS = 60_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = 'Praelecta/1.0 (+https://praelecta.ca; fetches a file a student pasted a link to)';

/** True when an IPv4 or IPv6 address is one a public file could live at. */
export function isPublicAddress(address) {
  const ip = String(address || '').trim();
  const family = net.isIP(ip);
  if (family === 4) return isPublicV4(ip);
  if (family === 6) return isPublicV6(ip);
  return false;
}

function isPublicV4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 0) return false;                               // this network
  if (a === 10) return false;                              // private
  if (a === 100 && b >= 64 && b <= 127) return false;      // carrier NAT
  if (a === 127) return false;                             // loopback
  if (a === 169 && b === 254) return false;                // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;       // private
  if (a === 192 && b === 0 && parts[2] === 0) return false; // IETF protocol
  if (a === 192 && b === 0 && parts[2] === 2) return false; // documentation
  if (a === 192 && b === 168) return false;                // private
  if (a === 198 && (b === 18 || b === 19)) return false;   // benchmarking
  if (a === 198 && b === 51 && parts[2] === 100) return false; // documentation
  if (a === 203 && b === 0 && parts[2] === 113) return false;  // documentation
  if (a >= 224) return false;                              // multicast, reserved, broadcast
  return true;
}

function isPublicV6(ip) {
  const lower = ip.toLowerCase();
  // An IPv4 address carried inside IPv6 is judged as the IPv4 address.
  const mapped = lower.match(/^(?:0*:)*ffff:(\d+\.\d+\.\d+\.\d+)$/) || lower.match(/^::ffff:([0-9a-f]+):([0-9a-f]+)$/);
  if (mapped) {
    if (mapped[2] !== undefined) {
      const hi = parseInt(mapped[1], 16); const lo = parseInt(mapped[2], 16);
      return isPublicV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return isPublicV4(mapped[1]);
  }
  const expanded = expandV6(lower);
  if (!expanded) return false;
  const first = parseInt(expanded[0], 16);
  if (expanded.every((h) => h === '0000')) return false;                     // ::
  if (expanded.slice(0, 7).every((h) => h === '0000') && expanded[7] === '0001') return false; // ::1
  if ((first & 0xfe00) === 0xfc00) return false;                            // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return false;                            // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return false;                            // ff00::/8 multicast
  if (first === 0x2001 && parseInt(expanded[1], 16) === 0x0db8) return false; // documentation
  if (first === 0x0064 && parseInt(expanded[1], 16) === 0xff9b) {          // 64:ff9b::/96 NAT64
    const v4 = `${parseInt(expanded[6], 16) >> 8}.${parseInt(expanded[6], 16) & 255}.${parseInt(expanded[7], 16) >> 8}.${parseInt(expanded[7], 16) & 255}`;
    return isPublicV4(v4);
  }
  return true;
}

function expandV6(ip) {
  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...head, ...Array(Math.max(0, missing)).fill('0'), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => g.padStart(4, '0'));
}

/** Resolve a host name and insist every address is public. */
export async function resolvePublicAddress(hostname, { allowPrivate = false } = {}) {
  const bare = hostname.replace(/^\[|\]$/g, '');
  const literal = net.isIP(bare);
  const addresses = literal
    ? [{ address: bare, family: literal }]
    : await dns.lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (addresses.length === 0) throw new TypeError('That address could not be found. Check the link and try again.');
  if (!privateAllowedFor(hostname, allowPrivate) && addresses.some((a) => !isPublicAddress(a.address))) {
    throw new TypeError('That link points somewhere this server cannot fetch from.');
  }
  return addresses[0];
}

/**
 * `allowPrivate` is for the test suite, which serves files from 127.0.0.1:
 * true, or the list of host names it may reach. Nothing in the app sets it,
 * and a redirect from an allowed host to any other host is judged afresh.
 */
function privateAllowedFor(hostname, allowPrivate) {
  if (allowPrivate === true) return true;
  return Array.isArray(allowPrivate) && allowPrivate.includes(hostname.replace(/^\[|\]$/g, ''));
}

/**
 * GET a file. Resolves to { buffer, contentType, contentDisposition,
 * finalUrl }. Throws a TypeError (a sentence for the student) when the
 * link is unusable, a RangeError when the file is over the cap.
 *
 * `allowPrivate` exists for the test suite (see privateAllowedFor); nothing
 * in the app sets it.
 */
export async function fetchPublicFile(rawUrl, { maxBytes = DEFAULT_MAX_BYTES, allowPrivate = false, timeoutMs = TOTAL_TIMEOUT_MS } = {}) {
  const deadline = Date.now() + timeoutMs;
  let url = new URL(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new TypeError('Only http and https links can be fetched.');
    if (url.username || url.password) throw new TypeError('Links with a username and password in them cannot be used.');
    const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
    if (!privateAllowedFor(url.hostname, allowPrivate) && port !== 80 && port !== 443) throw new TypeError('Only links on the usual web ports can be fetched.');
    const vetted = await resolvePublicAddress(url.hostname, { allowPrivate });
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new TypeError('That file took too long to download.');

    const response = await requestOnce(url, vetted, { maxBytes, timeoutMs: remaining });
    if (response.redirectTo) {
      let next;
      try { next = new URL(response.redirectTo, url); } catch { throw new TypeError('The link redirected somewhere that is not a link.'); }
      url = next;
      continue;
    }
    return { ...response, finalUrl: url.toString() };
  }
  throw new TypeError('The link redirected too many times.');
}

function requestOnce(url, vetted, { maxBytes, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    // The socket connects to the address that was checked, whatever the
    // name resolves to by the time it connects. Node asks for one address
    // or all of them depending on its connection strategy; both answered.
    const lookup = (hostname, options, callback) => {
      if (options && options.all) callback(null, [{ address: vetted.address, family: vetted.family }]);
      else callback(null, vetted.address, vetted.family);
    };
    // One answer per request. A request torn down on purpose (over the cap,
    // over time) still emits errors of its own on the way out; those are
    // not the answer and are swallowed once one has been given.
    let settled = false;
    let overall = null;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      if (overall) clearTimeout(overall);
      fn(value);
    };
    const req = lib.request(url, {
      method: 'GET',
      lookup,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/pdf, text/plain, text/markdown, application/octet-stream;q=0.9, */*;q=0.5',
      },
      timeout: Math.min(CONNECT_TIMEOUT_MS, timeoutMs),
    }, (res) => {
      const status = res.statusCode || 0;
      const refuse = (error) => { settle(reject, error); res.resume(); };
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume();
        settle(resolve, { redirectTo: res.headers.location });
        return;
      }
      if (status === 401 || status === 403) return refuse(new TypeError('That link needs a sign-in to open. Make the file public or share it with a link anyone can open, then try again.'));
      if (status === 404 || status === 410) return refuse(new TypeError('Nothing is at that link any more. Check it and try again.'));
      if (status < 200 || status >= 300) return refuse(new TypeError(`That link answered with an error (${status}). Try again later.`));
      const declared = Number(res.headers['content-length'] || 0);
      if (declared > maxBytes) return refuse(new RangeError('That file is bigger than 20 MB.'));

      const chunks = [];
      let received = 0;
      overall = setTimeout(() => { settle(reject, new TypeError('That file took too long to download.')); req.destroy(); }, timeoutMs);
      res.on('data', (chunk) => {
        if (settled) return;
        received += chunk.length;
        if (received > maxBytes) {
          settle(reject, new RangeError('That file is bigger than 20 MB.'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => settle(resolve, {
        buffer: Buffer.concat(chunks),
        contentType: String(res.headers['content-type'] || '').toLowerCase().split(';')[0].trim(),
        contentDisposition: String(res.headers['content-disposition'] || ''),
      }));
      res.on('error', () => settle(reject, new TypeError('That link stopped answering partway. Try again.')));
      res.on('aborted', () => settle(reject, new TypeError('That link stopped answering partway. Try again.')));
    });
    req.on('timeout', () => { settle(reject, new TypeError('That link did not answer in time.')); req.destroy(); });
    req.on('error', (error) => {
      if (error instanceof TypeError || error instanceof RangeError) settle(reject, error);
      else settle(reject, new TypeError('That link could not be reached. Check it and try again.'));
    });
    req.end();
  });
}
