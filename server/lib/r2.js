import crypto from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const MAX_RECORDING_BYTES = 200 * 1024 * 1024;
const UPLOAD_EXPIRY_SECONDS = 5 * 60;
const DOWNLOAD_EXPIRY_SECONDS = 15 * 60;
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

let cachedClient;
let cachedFingerprint;

function config() {
  const values = {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME,
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
    });
    cachedFingerprint = fingerprint;
  }
  return { client: cachedClient, bucket: values.bucket };
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
    throw new RangeError('Recordings must be 200 MB or smaller');
  }
  return { contentType: normalizedType, sizeBytes: normalizedSize };
}

export function recordingKey(userId, contentType) {
  const safeUserId = String(userId || '');
  if (!/^[0-9a-f-]{36}$/i.test(safeUserId)) throw new TypeError('Invalid user id');
  return `users/${safeUserId}/recordings/${crypto.randomUUID()}.${extensionFor(contentType)}`;
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
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: UPLOAD_EXPIRY_SECONDS });
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

