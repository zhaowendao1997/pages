import { readFileSync } from 'node:fs';

const cache = new Map();
const TYPE_SIZE = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  7: 1, // UNDEFINED
  9: 4, // SLONG
  10: 8, // SRATIONAL
};

const TAGS = {
  make: 0x010f,
  model: 0x0110,
  exifIfd: 0x8769,
  aperture: 0x829d,
  shutter: 0x829a,
  iso: 0x8827,
  focal: 0x920a,
  lens: 0xa434,
  date: 0x9003,
};

export function readExif(file) {
  if (cache.has(file)) return cache.get(file);

  let result = null;
  try {
    result = parseJpeg(readFileSync(file));
  } catch {
    result = null;
  }

  cache.set(file, result);
  return result;
}

export function formatExif(exif, fallback = {}) {
  if (!exif) return { metaLine: '', exposureLine: '' };

  const camera = exif.model || exif.make || fallback.camera || '';
  const lens = exif.lens || fallback.lens || '';
  const metaLine = [camera, lens].filter(Boolean).join(' · ');

  const parts = [];
  if (exif.focal) parts.push(`${number(exif.focal)}mm`);
  if (exif.aperture) parts.push(`f/${number(exif.aperture)}`);
  if (exif.shutter) parts.push(shutter(exif.shutter));
  if (exif.iso) parts.push(`ISO ${Math.round(exif.iso)}`);

  return { metaLine, exposureLine: parts.join(' · ') };
}

function parseJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break;

    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) break;

    if (
      marker === 0xe1 &&
      offset + 10 <= buffer.length &&
      buffer.toString('ascii', offset + 4, offset + 10) === 'Exif\0\0'
    ) {
      return parseTiff(buffer, offset + 10);
    }

    offset += 2 + length;
  }

  return null;
}

function parseTiff(buffer, base) {
  if (base + 8 > buffer.length) return null;

  const order = buffer.toString('ascii', base, base + 2);
  const little = order === 'II';
  if (!little && order !== 'MM') return null;

  const u16 = (offset) => (little ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset));
  const u32 = (offset) => (little ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset));

  if (u16(base + 2) !== 42) return null;

  const ifd0Offset = base + u32(base + 4);
  const ifd0 = readIfd(buffer, base, ifd0Offset, little);
  if (!ifd0.size) return null;

  const exifOffset = first(ifd0.get(TAGS.exifIfd));
  const exif = exifOffset ? readIfd(buffer, base, base + Number(exifOffset), little) : new Map();

  const value = (tag) => first(exif.get(tag) ?? ifd0.get(tag));
  const text = (tag) => clean(value(tag));

  const make = text(TAGS.make);
  const model = text(TAGS.model);
  const lens = text(TAGS.lens);
  const aperture = numeric(value(TAGS.aperture));
  const shutterSpeed = numeric(value(TAGS.shutter));
  const iso = numeric(value(TAGS.iso));
  const focal = numeric(value(TAGS.focal));

  if (!make && !model && !lens && !aperture && !shutterSpeed && !iso && !focal) return null;

  return {
    make,
    model,
    lens,
    aperture,
    shutter: shutterSpeed,
    iso,
    focal,
    date: text(TAGS.date),
  };
}

function readIfd(buffer, base, offset, little) {
  const map = new Map();
  if (offset < 0 || offset + 2 > buffer.length) return map;

  const u16 = (position) => (little ? buffer.readUInt16LE(position) : buffer.readUInt16BE(position));
  const u32 = (position) => (little ? buffer.readUInt32LE(position) : buffer.readUInt32BE(position));
  const count = u16(offset);

  if (offset + 2 + count * 12 > buffer.length) {
    const safeCount = Math.floor((buffer.length - offset - 2) / 12);
    for (let i = 0; i < safeCount; i += 1) readEntry(buffer, base, offset + 2 + i * 12, map, little);
    return map;
  }

  for (let i = 0; i < count; i += 1) readEntry(buffer, base, offset + 2 + i * 12, map, little);
  return map;
}

function readEntry(buffer, base, entry, map, little) {
  const u16 = (offset) => (little ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset));
  const u32 = (offset) => (little ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset));

  const tag = u16(entry);
  const type = u16(entry + 2);
  const count = u32(entry + 4);
  const size = (TYPE_SIZE[type] || 1) * count;
  const dataOffset = size <= 4 ? entry + 8 : base + u32(entry + 8);

  if (dataOffset < 0 || dataOffset + size > buffer.length) return;

  const value = readValue(buffer, dataOffset, type, count, little);
  if (value !== null && value !== undefined && value !== '') map.set(tag, value);
}

function readValue(buffer, offset, type, count, little) {
  if (offset < 0 || offset >= buffer.length) return null;

  if (type === 1) return buffer[offset];
  if (type === 2) return buffer.toString('utf8', offset, Math.min(offset + count, buffer.length)).replace(/\0.*$/s, '').trim();
  if (type === 3) return little ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
  if (type === 4) return little ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
  if (type === 5 || type === 10) {
    if (offset + 8 > buffer.length) return null;
    const numerator = type === 10
      ? (little ? buffer.readInt32LE(offset) : buffer.readInt32BE(offset))
      : (little ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset));
    const denominator = type === 10
      ? (little ? buffer.readInt32LE(offset + 4) : buffer.readInt32BE(offset + 4))
      : (little ? buffer.readUInt32LE(offset + 4) : buffer.readUInt32BE(offset + 4));
    return denominator ? numerator / denominator : null;
  }
  if (type === 9) {
    if (offset + 4 > buffer.length) return null;
    return little ? buffer.readInt32LE(offset) : buffer.readInt32BE(offset);
  }

  return null;
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function clean(value) {
  return String(value ?? '').replace(/\0/g, '').trim();
}

function number(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * 10) / 10).replace(/\.0$/, '');
}

function shutter(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1) return `${number(n)}s`;
  return `1/${Math.round(1 / n)}s`;
}
