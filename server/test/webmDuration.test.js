import assert from 'node:assert/strict';
import test from 'node:test';
import { readWebmDurationSeconds, closeWebmTimestampGaps } from '../lib/webmDuration.js';

/** Encode an element size as an 8-byte VINT (or the unknown-size marker). */
function size(value, unknown = false) {
  const buffer = Buffer.alloc(8);
  buffer[0] = 0x01;
  if (unknown) return Buffer.from([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
  buffer.writeUIntBE(value, 2, 6);
  return buffer;
}

function element(id, payload, unknownSize = false) {
  return Buffer.concat([Buffer.from(id), size(payload.length, unknownSize), payload]);
}

function uint(value) {
  const buffer = Buffer.alloc(6);
  buffer.writeUIntBE(value, 0, 6);
  return buffer;
}

/** SimpleBlock: track number VINT (0x81 = track 1), int16be relative timecode. */
function simpleBlock(relativeMs) {
  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header.writeInt16BE(relativeMs, 1);
  header[3] = 0x80;
  return Buffer.concat([header, Buffer.from([0x00, 0x00])]);
}

function cluster(timestampMs, relatives, unknownSize = false) {
  return element([0x1f, 0x43, 0xb6, 0x75], Buffer.concat([
    element([0xe7], uint(timestampMs)),
    ...relatives.map((relative) => element([0xa3], simpleBlock(relative))),
  ]), unknownSize);
}

function webm(clusters, { declaredDuration = null } = {}) {
  const infoChildren = [element([0x2a, 0xd7, 0xb1], uint(1_000_000))];
  if (declaredDuration !== null) {
    const value = Buffer.alloc(8);
    value.writeDoubleBE(declaredDuration);
    infoChildren.push(element([0x44, 0x89], value));
  }
  return Buffer.concat([
    element([0x1a, 0x45, 0xdf, 0xa3], Buffer.from([0x42, 0x86, 0x81, 0x01])),
    element([0x18, 0x53, 0x80, 0x67], Buffer.concat([
      element([0x15, 0x49, 0xa9, 0x66], Buffer.concat(infoChildren)),
      ...clusters,
    ])),
  ]);
}

test('measures a streamed recording from its block timestamps', () => {
  // Last block sits at 60s + 980ms; the final packet adds 20ms.
  const buffer = webm([cluster(0, [0, 20, 40]), cluster(60_000, [0, 500, 980])]);
  assert.equal(Math.round(readWebmDurationSeconds(buffer) * 1000), 61_000);
});

test('reads clusters that declare an unknown size, as live muxers write them', () => {
  const buffer = webm([cluster(0, [0, 20], true)]);
  assert.equal(Math.round(readWebmDurationSeconds(buffer) * 1000), 40);
});

test('prefers an explicit Duration element when the muxer wrote one', () => {
  const buffer = webm([cluster(0, [0])], { declaredDuration: 90_000 });
  assert.equal(readWebmDurationSeconds(buffer), 90);
});

test('reports nothing measurable rather than guessing', () => {
  assert.equal(readWebmDurationSeconds(Buffer.alloc(0)), 0);
  assert.equal(readWebmDurationSeconds(Buffer.from('this is not a container')), 0);
  // A truncated header must not be read as a valid zero-length recording.
  assert.equal(readWebmDurationSeconds(webm([cluster(0, [0])]).subarray(0, 12)), 0);
  assert.equal(readWebmDurationSeconds('not a buffer'), 0);
});

test('ignores block groups from other tracks but counts their timing', () => {
  const blockGroup = element([0xa0], element([0xa1], simpleBlock(750)));
  const withGroup = element([0x1f, 0x43, 0xb6, 0x75], Buffer.concat([
    element([0xe7], uint(2_000)),
    blockGroup,
  ]));
  const buffer = webm([withGroup]);
  assert.equal(Math.round(readWebmDurationSeconds(buffer) * 1000), 2_770);
});

test('closes a sleep-sized hole between clusters, and only that hole', () => {
  // 3 s of audio, a 50-minute hole (laptop lid closed), then 1 s more.
  const buffer = webm([cluster(0, [0, 1000, 2980]), cluster(3_000_000, [0, 980])]);
  assert.equal(Math.round(readWebmDurationSeconds(buffer)), 3001);
  const result = closeWebmTimestampGaps(buffer);
  assert.equal(result.gaps, 1);
  assert.equal(Math.round(result.removedMs / 1000), 2997);
  assert.equal(Math.round(readWebmDurationSeconds(buffer) * 1000), 4000);
});

test('leaves a continuous recording exactly as it was', () => {
  const buffer = webm([cluster(0, [0, 20, 40]), cluster(60, [0, 20]), cluster(100, [0, 500, 980])]);
  const before = Buffer.from(buffer);
  const result = closeWebmTimestampGaps(buffer);
  assert.deepEqual(result, { removedMs: 0, gaps: 0 });
  assert.ok(buffer.equals(before));
});

test('accumulates several holes and rewrites in place without moving bytes', () => {
  const buffer = webm([cluster(0, [0, 980]), cluster(600_000, [0, 980]), cluster(1_200_000, [0, 980], true)]);
  const length = buffer.length;
  const result = closeWebmTimestampGaps(buffer);
  assert.equal(result.gaps, 2);
  assert.equal(buffer.length, length);
  assert.equal(Math.round(readWebmDurationSeconds(buffer) * 1000), 3000);
});

test('does not touch a finished file that declares its duration', () => {
  const buffer = webm([cluster(0, [0]), cluster(900_000, [0])], { declaredDuration: 900_000 });
  assert.deepEqual(closeWebmTimestampGaps(buffer), { removedMs: 0, gaps: 0 });
});
