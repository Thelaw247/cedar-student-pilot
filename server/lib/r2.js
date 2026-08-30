import crypto from 'node:crypto';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Groq's free-tier direct attachment limit is 25 MB. Stay one MiB below it so
// multipart/form-data overhead and provider-side rounding cannot turn an
// accepted Praelecta upload into an unprocessable recording later in the flow.
export const MAX_RECORDING_BYTES = 24 * 1024 * 1024;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const UPLOAD_EXPIRY_SECONDS = 5 * 60;
const DOWNLOAD_EXPIRY_SECONDS = 15 * 60;
// Browser uploads send these as request headers. Under Signature V4 every
// x-amz-* header present in a request must be covered by the signature, so
// they must stay headers (not be hoisted into the query string) and be signed.
// Otherwise R2 rejects the browser's PUT with 403 SignatureDoesNotMatch.
const SIGNED_UPLOAD_HEADERS = new Set(['x-amz-meta-owner', 'x-amz-meta-purpose', 'x-amz-meta-max-bytes']);
const UPLOAD_PRESIGN_OPTIONS = { expiresIn: UPLOAD_EXPIRY_SECONDS, unhoistableHeaders: SIGNED_UPLOAD_HEADERS };
const RECORDING_TYPES = new Set([
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
  'audio/x-wav',
  'video/webm',
]);
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

let cachedClient;
let cachedFingerprint;

function r2Env(name) {
  return String(process.env[name] || '').trim();
}

export function r2IsConfigured() {
  return Boolean(
    r2Env('R2_ACCOUNT_ID')
    && r2Env('R2_ACCESS_KEY_ID')
    && r2Env('R2_SECRET_ACCESS_KEY')
    && r2Env('R2_BUCKET_NAME')
  );
}

function config() {
  const values = {
    accountId: r2Env('R2_ACCOUNT_ID'),
    accessKeyId: r2Env('R2_ACCESS_KEY_ID'),
    secretAccessKey: r2Env('R2_SECRET_ACCESS_KEY'),
    bucket: r2Env('R2_BUCKET_NAME'),
  };
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`R2 is not configured: missing ${missing.join(', ')}`);
  }
  return values;
}

export function r2Client() {
  const values = config();
  const fingerprint = [values.accountId, values.accessKeyId, values.secretAccessKey].join(':');
  if (!cachedClient || cachedFingerprint !== fingerprint) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: `https://${values.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: values.accessKeyId,
        secretAccessKey: values.secretAccessKey,
      },
      // AWS SDK >= 3.729 adds a CRC32 checksum to every PutObject by default,
      // including presigned URLs, where it can only hash the empty placeholder
      // body. R2 then rejects the browser's real upload (and omits CORS headers
      // on the error), so the client sees a misleading CORS failure. Only send
      // checksums when an operation actually requires one.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    cachedFingerprint = fingerprint;
  }
  return { client: cachedClient, bucket: values.bucket };
}

export async function checkR2Connection() {
  const { client, bucket } = r2Client();
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
}

function extensionFor(contentType) {
  const subtype = contentType.split('/')[1] || 'bin';
  return subtype === 'mpeg' ? 'mp3'
    : subtype === 'x-m4a' ? 'm4a'
      : subtype === 'x-wav' ? 'wav'
        : subtype.replace(/[^a-z0-9]/g, '') || 'bin';
}

export function validateRecordingUpload({ contentType, sizeBytes }) {
  const normalizedType = String(contentType || '').toLowerCase().split(';')[0].trim();
  const normalizedSize = Number(sizeBytes);
  if (!RECORDING_TYPES.has(normalizedType)) {
    throw new TypeError('Unsupported recording content type');
  }
  if (!Number.isSafeInteger(normalizedSize) || normalizedSize < 1) {
    throw new TypeError('A valid recording size is required');
  }
  if (normalizedSize > MAX_RECORDING_BYTES) {
    throw new RangeError('Recordings must be 24 MB or smaller');
  }
  return { contentType: normalizedType, sizeBytes: normalizedSize };
}

export function validateAvatarUpload({ contentType, sizeBytes }) {
  const normalizedType = String(contentType || '').toLowerCase().split(';')[0].trim();
  const normalizedSize = Number(sizeBytes);
  if (!AVATAR_TYPES.has(normalizedType)) throw new TypeError('Profile photo must be a JPEG, PNG, or WebP image');
  if (!Number.isSafeInteger(normalizedSize) || normalizedSize < 1) throw new TypeError('A valid profile photo size is required');
  if (normalizedSize > MAX_AVATAR_BYTES) throw new RangeError('Profile photos must be 5 MB or smaller');
  return { contentType: normalizedType, sizeBytes: normalizedSize };
}

export function recordingKey(userId, contentType) {
  const safeUserId = String(userId || '');
  if (!/^[0-9a-f-]{36}$/i.test(safeUserId)) throw new TypeError('Invalid user id');
  return `users/${safeUserId}/recordings/${crypto.randomUUID()}.${extensionFor(contentType)}`;
}

export function avatarKey(userId, contentType) {
  const safeUserId = String(userId || '');
  if (!/^[0-9a-f-]{36}$/i.test(safeUserId)) throw new TypeError('Invalid user id');
  return `users/${safeUserId}/avatars/${crypto.randomUUID()}.${extensionFor(contentType)}`;
}

export function assertOwnedKey(userId, key) {
  const value = String(key || '');
  const prefix = `users/${userId}/`;
  if (!value.startsWith(prefix) || value.includes('..') || value.length > 1024) {
    throw new TypeError('Invalid storage key');
  }
  return value;
}

export function storageRef(key) {
  const { bucket } = config();
  return `r2://${bucket}/${key}`;
}

export function parseStorageRef(ref) {
  const value = String(ref || '');
  if (!value.startsWith('r2://')) return null;
  const withoutScheme = value.slice(5);
  const slash = withoutScheme.indexOf('/');
  if (slash < 1) throw new TypeError('Invalid R2 storage reference');
  return {
    bucket: withoutScheme.slice(0, slash),
    key: withoutScheme.slice(slash + 1),
  };
}

export async function createRecordingUpload(userId, input) {
  const { contentType, sizeBytes } = validateRecordingUpload(input);
  const key = recordingKey(userId, contentType);
  const { client, bucket } = r2Client();
  const metadata = {
    owner: userId,
    purpose: 'recording',
    'max-bytes': String(sizeBytes),
  };
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    Metadata: metadata,
  });
  const uploadUrl = await getSignedUrl(client, command, UPLOAD_PRESIGN_OPTIONS);
  return {
    key,
    upload_url: uploadUrl,
    expires_at: new Date(Date.now() + UPLOAD_EXPIRY_SECONDS * 1000).toISOString(),
    headers: {
      'Content-Type': contentType,
      'x-amz-meta-owner': userId,
      'x-amz-meta-purpose': 'recording',
      'x-amz-meta-max-bytes': String(sizeBytes),
    },
  };
}

export async function createAvatarUpload(userId, input) {
  const { contentType, sizeBytes } = validateAvatarUpload(input);
  const key = avatarKey(userId, contentType);
  const { client, bucket } = r2Client();
  const metadata = { owner: userId, purpose: 'avatar', 'max-bytes': String(sizeBytes) };
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, Metadata: metadata });
  const uploadUrl = await getSignedUrl(client, command, UPLOAD_PRESIGN_OPTIONS);
  return {
    key,
    upload_url: uploadUrl,
    expires_at: new Date(Date.now() + UPLOAD_EXPIRY_SECONDS * 1000).toISOString(),
    headers: {
      'Content-Type': contentType,
      'x-amz-meta-owner': userId,
      'x-amz-meta-purpose': 'avatar',
      'x-amz-meta-max-bytes': String(sizeBytes),
    },
  };
}

export async function confirmRecordingUpload(userId, rawKey) {
  const key = assertOwnedKey(userId, rawKey);
  const { client, bucket } = r2Client();
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const size = Number(head.ContentLength || 0);
  const declaredMax = Number(head.Metadata?.['max-bytes'] || 0);
  if (head.Metadata?.owner !== userId || head.Metadata?.purpose !== 'recording') {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
    throw new TypeError('The uploaded object metadata is invalid');
  }
  if (!size || !declaredMax || size > declaredMax || size > MAX_RECORDING_BYTES) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
    throw new RangeError('The uploaded recording size is invalid');
  }
  const playbackUrl = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: DOWNLOAD_EXPIRY_SECONDS },
  );
  return {
    key,
    storage_ref: storageRef(key),
    playback_url: playbackUrl,
    playback_expires_at: new Date(Date.now() + DOWNLOAD_EXPIRY_SECONDS * 1000).toISOString(),
    size_bytes: size,
    content_type: head.ContentType || null,
  };
}

export async function confirmAvatarUpload(userId, rawKey) {
  const key = assertOwnedKey(userId, rawKey);
  const { client, bucket } = r2Client();
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const size = Number(head.ContentLength || 0);
  const declaredMax = Number(head.Metadata?.['max-bytes'] || 0);
  const contentType = String(head.ContentType || '').toLowerCase();
  if (head.Metadata?.owner !== userId || head.Metadata?.purpose !== 'avatar'
      || !AVATAR_TYPES.has(contentType)) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
    throw new TypeError('The uploaded profile photo metadata is invalid');
  }
  if (!size || !declaredMax || size > declaredMax || size > MAX_AVATAR_BYTES) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
    throw new RangeError('The uploaded profile photo size is invalid');
  }
  return { key, storage_ref: storageRef(key), size_bytes: size, content_type: contentType };
}

export async function createDownloadUrl(userId, rawKey) {
  const key = assertOwnedKey(userId, rawKey);
  const { client, bucket } = r2Client();
  await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: DOWNLOAD_EXPIRY_SECONDS },
  );
  return {
    url,
    expires_at: new Date(Date.now() + DOWNLOAD_EXPIRY_SECONDS * 1000).toISOString(),
  };
}

export async function deleteOwnedObject(userId, rawKey) {
  const key = assertOwnedKey(userId, rawKey);
  const { client, bucket } = r2Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function deleteAllOwnedObjects(userId) {
  const prefix = assertOwnedKey(userId, `users/${userId}/`);
  const { client, bucket } = r2Client();
  let continuationToken;
  let deleted = 0;
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    const objects = (page.Contents || [])
      .map((object) => object.Key)
      .filter(Boolean)
      .map((Key) => ({ Key }));
    if (objects.length) {
      const result = await client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects, Quiet: true },
      }));
      if (result.Errors?.length) throw new Error('R2 failed to delete one or more stored files');
      deleted += objects.length;
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (page.IsTruncated && !continuationToken) throw new Error('R2 returned an invalid pagination response');
  } while (continuationToken);
  return deleted;
}

export async function resolveRecordingStorageRef(userId, ref) {
  const parsed = parseStorageRef(ref);
  if (!parsed) return null;
  const { client, bucket } = r2Client();
  if (parsed.bucket !== bucket) throw new TypeError('Recording bucket does not match');
  const key = assertOwnedKey(userId, parsed.key);
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: DOWNLOAD_EXPIRY_SECONDS },
  );
}
