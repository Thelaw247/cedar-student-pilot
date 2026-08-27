/**
 * Measure the playable length of a WebM/Matroska recording.
 *
 * MediaRecorder writes WebM in streaming mode: the header is emitted before
 * the length is known and is never rewritten, so the Segment `Duration`
 * element is absent and metadata parsers report `undefined`. Every browser
 * recording Cedar receives has that shape.
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

export function readWebmDurationSeconds(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return 0;
  // EBML magic — anything else is not a Matroska/WebM container.
  if (buffer.readUInt32BE(0) !== 0x1a45dfa3) return 0;

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
  if (!segment) return 0;

  let timecodeScale = DEFAULT_TIMECODE_SCALE;
  let declaredDuration = 0;
  let maxTimestampMs = -1;

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
      let clusterTimestamp = 0;
      let cursor = element.contentStart;
      while (cursor < element.contentEnd) {
        const child = readElement(buffer, cursor);
        if (!child) break;
        // An unknown-size Cluster ends where the next Segment-level element begins.
        if (element.unknownSize && SEGMENT_LEVEL_IDS.has(child.id)) break;

        if (child.id === ID_CLUSTER_TIMESTAMP) {
          clusterTimestamp = readUnsigned(buffer, child.contentStart, child.contentEnd);
          if (clusterTimestamp > maxTimestampMs) maxTimestampMs = clusterTimestamp;
        } else if (child.id === ID_SIMPLE_BLOCK) {
          const relative = blockRelativeMs(buffer, child.contentStart, child.contentEnd);
          if (relative !== null && clusterTimestamp + relative > maxTimestampMs) {
            maxTimestampMs = clusterTimestamp + relative;
          }
        } else if (child.id === ID_BLOCK_GROUP) {
          let inner = child.contentStart;
          while (inner < child.contentEnd) {
            const block = readElement(buffer, inner);
            if (!block) break;
            if (block.id === ID_BLOCK) {
              const relative = blockRelativeMs(buffer, block.contentStart, block.contentEnd);
              if (relative !== null && clusterTimestamp + relative > maxTimestampMs) {
                maxTimestampMs = clusterTimestamp + relative;
              }
            }
            inner = block.contentEnd;
          }
        }
        cursor = child.contentEnd;
      }
      // A cluster of unknown size runs to the end of the buffer as parsed here;
      // its children loop already stopped at the next segment-level element.
      if (element.unknownSize) {
        offset = cursor;
        continue;
      }
    }

    offset = element.contentEnd;
  }

  if (declaredDuration > 0) return (declaredDuration * timecodeScale) / 1e9;
  if (maxTimestampMs < 0) return 0;
  // Cluster timestamps are in TimecodeScale ticks (1 ms by default).
  const seconds = ((maxTimestampMs + FINAL_BLOCK_MS) * timecodeScale) / 1e9;
  return seconds > 0 ? seconds : 0;
}
