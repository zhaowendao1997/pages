import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const THUMB_EDGE = 800;
const LARGE_EDGE = 3000;
const ALBUM_WEB_EDGE = 2000;
const ARTICLE_WEB_EDGE = 1600;

function isImage(file) {
  return IMAGE_EXT.has(extname(file).toLowerCase());
}

async function variant(source, maxEdge, quality) {
  let image = sharp(source, { failOn: 'none' })
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });

  const ext = extname(source).toLowerCase();
  if (ext === '.png') return image.png({ compressionLevel: 9 }).toBuffer();
  if (ext === '.webp') return image.webp({ quality }).toBuffer();
  return image.jpeg({ quality, mozjpeg: true, progressive: true }).toBuffer();
}

async function writeVariant(source, dest, maxEdge, quality) {
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, await variant(source, maxEdge, quality));
}

async function prepareOne(source, full, large, thumb, webEdge) {
  if (!existsSync(full)) {
    await mkdir(dirname(full), { recursive: true });
    await copyFile(source, full);
  }

  if (!existsSync(large)) await writeVariant(full, large, LARGE_EDGE, 85);
  if (thumb && !existsSync(thumb)) await writeVariant(full, thumb, THUMB_EDGE, 80);

  const info = await sharp(source, { failOn: 'none' }).metadata();
  const sourceSize = (await stat(source)).size;
  const longest = Math.max(info.width || 0, info.height || 0);
  if (longest > webEdge || sourceSize > 1.5 * 1024 * 1024) {
    await writeVariant(full, source, webEdge, 85);
  }
}

export async function prepareImages({ publicDir }) {
  const imagesDir = join(publicDir, 'images');
  const albumsDir = join(imagesDir, 'albums');
  let count = 0;

  try {
    const albums = await readdir(albumsDir, { withFileTypes: true });
    for (const album of albums) {
      if (!album.isDirectory()) continue;
      const dir = join(albumsDir, album.name);
      const files = await readdir(dir, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile() || !isImage(file.name)) continue;
        const source = join(dir, file.name);
        await prepareOne(
          source,
          join(dir, 'full', file.name),
          join(dir, 'large', file.name),
          join(dir, 'thumbs', file.name),
          ALBUM_WEB_EDGE
        );
        count += 1;
      }
    }
  } catch {
    // No album directory yet.
  }

  let files = [];
  try {
    files = await readdir(imagesDir, { withFileTypes: true });
  } catch {
    return count;
  }

  for (const file of files) {
    if (!file.isFile() || !isImage(file.name)) continue;
    const source = join(imagesDir, file.name);
    await prepareOne(
      source,
      join(imagesDir, 'full', file.name),
      join(imagesDir, 'large', file.name),
      null,
      ARTICLE_WEB_EDGE
    );
    count += 1;
  }

  return count;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const count = await prepareImages({ publicDir: join(root, 'public') });
  console.log(`图片处理完成：${count} 张`);
}
