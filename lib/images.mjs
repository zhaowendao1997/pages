import { readFileSync, statSync } from 'node:fs';

const cache = new Map();

/** Read intrinsic pixel size from common image formats without dependencies. */
export function imageSize(file) {
  if (cache.has(file)) return cache.get(file);
  let size = null;
  try {
    if (!statSync(file).isFile()) throw new Error('not a file');
    const buf = readFileSync(file);
    size = sniff(buf);
  } catch {
    size = null;
  }
  cache.set(file, size);
  return size;
}

function sniff(buf) {
  if (buf.length < 10) return null;

  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), type: 'png' };
  }

  // GIF
  if (buf.toString('ascii', 0, 3) === 'GIF') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8), type: 'gif' };
  }

  // WebP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && buf.length >= 30) {
      const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
      return { width, height, type: 'webp' };
    }
    if (chunk === 'VP8 ' && buf.length >= 30) {
      return {
        width: buf.readUInt16LE(26) & 0x3fff,
        height: buf.readUInt16LE(28) & 0x3fff,
        type: 'webp',
      };
    }
    if (chunk === 'VP8L' && buf.length >= 25) {
      const bits = buf.readUInt32LE(21);
      return {
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff),
        type: 'webp',
      };
    }
    return null;
  }

  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buf[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) break;
      const length = buf.readUInt16BE(offset + 2);
      const isSOF =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSOF) {
        return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5), type: 'jpeg' };
      }
      offset += 2 + length;
    }
    return null;
  }

  // SVG
  const head = buf.toString('utf8', 0, Math.min(buf.length, 4096));
  if (/<svg[\s>]/i.test(head)) {
    const width = head.match(/\bwidth=["']?([\d.]+)/i);
    const height = head.match(/\bheight=["']?([\d.]+)/i);
    if (width && height) {
      return { width: Math.round(Number(width[1])), height: Math.round(Number(height[1])), type: 'svg' };
    }
    const viewBox = head.match(/\bviewBox=["']([\d.\s-]+)["']/i);
    if (viewBox) {
      const parts = viewBox[1].trim().split(/\s+/).map(Number);
      if (parts.length === 4) return { width: Math.round(parts[2]), height: Math.round(parts[3]), type: 'svg' };
    }
  }

  return null;
}
