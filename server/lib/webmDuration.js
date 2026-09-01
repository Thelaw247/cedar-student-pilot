/**
 * Measure the playable length of a WebM/Matroska recording.
 *
 * MediaRecorder writes WebM in streaming mode: the header is emitted before
 * the length is known and is never rewritten, so the Segment `Duration`
 * element is absent and metadata parsers report `undefined`. Every browser
 * recording Praelecta receives has that shape.
 *
 * The timing data is still present in the body — each Cluster carries an
 * absolute timestamp and each block a relative offset — so the real duration
 * is the largest block timestamp plus the length of that final block. This
 * reads the container directly instead of trusting either the header or the
 * client, which matters because duration determines how many credits the
 * recording costs.
 */

const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_TIMECODE_SCALE = 0x2ad7b1;
const ID_DURATION = 0x4489;
const ID_CLUSTER = 0x1f43b675;
const ID_CLUSTER_TIMESTAMP = 0xe7;
const ID_SIMPLE_BLOCK = 0xa3;
const ID_BLOCK_GROUP = 0xa0;
const ID_BLOCK = 0xa1;

// Elements that may appear directly inside Segment. An unknown-size Cluster
// ends where one of these begins.
const SEGMENT_LEVEL_IDS = new Set([
  0x114d9b74, 0x1549a966, 0x1654ae6b, 0x1c53bb6b, 0x1254c367,
  0x1941a469, 0x1043a770, 0x1f43b675,
]);

const DEFAULT_TIMECODE_SCALE = 1_000_000; // nanoseconds per tick (1 ms)
// Opus packets in a MediaRecorder stream are at most 60 ms; assume the common
// 20 ms so the final block is not counted as longer than it was.
const FINAL_BLOCK_MS = 20;

function readVint(buffer, offset, stripMarker) {
  if (offset >= buffer.length) return null;
  const first = buffer[offset];
  if (first === 0) return null;
  let length = 1;
  for (let mask = 0x80; mask && !(first & mask); mask >>= 1) length += 1;
  if (length > 8 || offset + length > buffer.length) return null;

  let value = stripMarker ? first & (0xff >> length) : first;
  let unknown = stripMarker ? (first & (0xff >> length)) === (0xff >> length) : false;
  for (let i = 1; i < length; i += 1) {
    const byte = buffer[offset + i];
    value = value * 256 + byte;
    if (byte !== 0xff) unknown = false;
  }
  return { value, length, unknown };
}

function readElement(buffer, offset) {
  const id = readVint(buffer, offset, false);
  if (!id) return null;
  const size = readVint(buffer, offset + id.length, true);
  if (!size) return null;
  const contentStart = offset + id.length + size.length;
  const end = size.unknown ? buffer.length : contentStart + size.value;
  if (end > buffer.length) return null;
  return { id: id.value, contentStart, contentEnd: end, unknownSize: size.unknown };
}

function readUnsigned(buffer, start, end) {
  let value = 0;
  for (let i = start; i < end; i += 1) value = value * 256 + buffer[i];
  return value;
}

/** Relative timecode of a (Simple)Block: track number VINT, then int16be. */
function blockRelativeMs(buffer, start, end) {
  const track = readVint(buffer, start, true);
  if (!track || start + track.length + 2 > end) return null;
  return buffer.readInt16BE(start + track.length);
}

/**
 * One pass over the Segment: the timecode scale, any declared Duration, and
 * every Cluster with where its Timestamp element lives and how far its blocks
 * reach. Both the measurement and the gap-closing below are built on this.
 */
function scanSegment(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  // EBML magic — anything else is not a Matroska/WebM container.
  if (buffer.readUInt32BE(0) !== 0x1a45dfa3) return null;

  const segment = (() => {
    let offset = 0;
    while (offset < buffer.length) {
      const element = readElement(buffer, offset);
      if (!element) return null;
      if (element.id === ID_SEGMENT) return element;
      offset = element.contentEnd;
    }
    return null;
  })();
  if (!segment) return null;

  let timecodeScale = DEFAULT_TIMECODE_SCALE;
  let declaredDuration = 0;
  const clusters = [];

  let offset = segment.contentStart;
  while (offset < segment.contentEnd) {
    const element = readElement(buffer, offset);
    if (!element) break;

    if (element.id === ID_INFO) {
      let cursor = element.contentStart;
      while (cursor < element.contentEnd) {
        const child = readElement(buffer, cursor);
        if (!child) break;
        if (child.id === ID_TIMECODE_SCALE) {
          const scale = readUnsigned(buffer, child.contentStart, child.contentEnd);
          if (scale > 0) timecodeScale = scale;
        } else if (child.id === ID_DURATION) {
          const width = child.contentEnd - child.contentStart;
          if (width === 4) declaredDuration = buffer.readFloatBE(child.contentStart);
          else if (width === 8) declaredDuration = buffer.readDoubleBE(child.contentStart);
        }
        cursor = child.contentEnd;
      }
    } else if (element.id === ID_CLUSTER) {
      const info = { timestampMs: 0, timestampStart: -1, timestampEnd: -1, minRelativeMs: 0, maxRelativeMs: 0 };
      const noteRelative = (relative) => {
        if (relative === null) return;
        if (relative > info.maxRelativeMs) info.maxRelativeMs = relative;
        if (relative < info.minRelativeMs) info.minRelativeMs = relative;
      };
      let cursor = element.contentStart;
      while (cursor < element.contentEnd) {
        const child = readElement(buffer, cursor);
        if (!child) break;
        // An unknown-size Cluster ends where the next Segment-level element begins.
        if (element.unknownSize && SEGMENT_LEVEL_IDS.has(child.id)) break;

        if (child.id === ID_CLUSTER_TIMESTAMP) {
          info.timestampMs = readUnsigned(buffer, child.contentStart, child.contentEnd);
          info.timestampStart = child.contentStart;
          info.timestampEnd = child.contentEnd;
        } else if (child.id === ID_SIMPLE_BLOCK) {
          noteRelative(blockRelativeMs(buffer, child.contentStart, child.contentEnd));
        } else if (child.id === ID_BLOCK_GROUP) {
          let inner = child.contentStart;
          while (inner < child.contentEnd) {
            const block = readElement(buffer, inner);
            if (!block) break;
            if (block.id === ID_BLOCK) noteRelative(blockRelativeMs(buffer, block.contentStart, block.contentEnd));
            inner = block.contentEnd;
          }
        }
        cursor = child.contentEnd;
      }
      clusters.push(info);
      // A cluster of unknown size runs to the end of the buffer as parsed here;
      // its children loop already stopped at the next segment-level element.
      if (element.unknownSize) {
        offset = cursor;
        continue;
      }
    }

    offset = element.contentEnd;
  }

  return { timecodeScale, declaredDuration, clusters };
}

export function readWebmDurationSeconds(buffer) {
  const scan = scanSegment(buffer);
  if (!scan) return 0;
  const { timecodeScale, declaredDuration, clusters } = scan;

  if (declaredDuration > 0) return (declaredDuration * timecodeScale) / 1e9;

  let maxTimestampMs = -1;
  for (const c of clusters) {
    const reach = c.timestampMs + c.maxRelativeMs;
    if (c.timestampMs > maxTimestampMs) maxTimestampMs = c.timestampMs;
    if (reach > maxTimestampMs) maxTimestampMs = reach;
  }
  if (maxTimestampMs < 0) return 0;
  // Cluster timestamps are in TimecodeScale ticks (1 ms by default).
  const seconds = ((maxTimestampMs + FINAL_BLOCK_MS) * timecodeScale) / 1e9;
  return seconds > 0 ? seconds : 0;
}

/**
 * Close holes in a streamed recording's timeline, in place.
 *
 * MediaRecorder stamps clusters from the wall clock. When the laptop sleeps,
 * the tab is frozen, or the microphone is muted, no audio is written, but the
 * next cluster picks up where the clock is, not where the audio stopped. The
 * file then *decodes* as the whole elapsed time: a 44-minute lecture recorded
 * across a two-and-a-half-hour sleep decodes as 3 h 14 min of mostly nothing.
 *
 * That is not cosmetic. The transcription provider counts decoded seconds
 * against its hourly quota, so a file like that is refused every time — 1 Sep,
 * lecture 81e25461, three attempts — and the student is billed for the hole.
 *
 * A hole is a jump between consecutive clusters larger than any packet could
 * explain (opus frames are ≤ 60 ms; `gapMs` is far above that). Each cluster
 * after a hole has the accumulated hole subtracted from its Timestamp element.
 * The new value is always smaller, so it fits in the element's existing bytes
 * and nothing else in the container moves. Block-relative offsets are left
 * alone: a hole *inside* a cluster is bounded by the int16 relative timecode
 * (±32 s) and is not worth a rewrite.
 *
 * Returns the milliseconds removed and how many holes there were. A file with
 * a declared Duration is a finished, non-streamed file and is left untouched.
 */
export function closeWebmTimestampGaps(buffer, { gapMs = 2000 } = {}) {
  const scan = scanSegment(buffer);
  if (!scan || scan.declaredDuration > 0) return { removedMs: 0, gaps: 0 };

  let removedMs = 0;
  let gaps = 0;
  let previousEndMs = null; // original timeline: where the last audio reached
  for (const c of scan.clusters) {
    if (c.timestampStart < 0) continue;
    const startMs = c.timestampMs + c.minRelativeMs;
    if (previousEndMs !== null && startMs - previousEndMs > gapMs) {
      removedMs += startMs - previousEndMs;
      gaps += 1;
    }
    const reachMs = c.timestampMs + c.maxRelativeMs + FINAL_BLOCK_MS;
    if (previousEndMs === null || reachMs > previousEndMs) previousEndMs = reachMs;

    if (removedMs > 0) {
      const width = c.timestampEnd - c.timestampStart;
      const value = Math.max(0, c.timestampMs - removedMs);
      if (width >= 1 && width <= 6) {
        buffer.writeUIntBE(value, c.timestampStart, width);
      } else {
        // Wider than writeUIntBE supports: write the low bytes by hand.
        let rest = value;
        for (let i = c.timestampEnd - 1; i >= c.timestampStart; i -= 1) {
          buffer[i] = rest % 256;
          rest = Math.floor(rest / 256);
        }
      }
    }
  }
  return { removedMs, gaps };
}
