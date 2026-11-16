import { access, copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const pad = (value) => String(value).padStart(2, '0');
const exists = (path) => access(path).then(() => true, () => false);

const input = process.argv[2];

if (!input) {
  console.error('把装有照片的文件夹拖到「导入照片.bat」上，或在命令行传入文件夹路径。');
  process.exit(1);
}

const source = resolve(input);
let info;
try {
  info = await stat(source);
} catch {
  console.error(`找不到文件夹：${source}`);
  process.exit(1);
}
if (!info.isDirectory()) {
  console.error('请拖一个文件夹进来，不是单个文件。');
  process.exit(1);
}

const title = basename(source);
const slug = title.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
if (!slug) {
  console.error('文件夹名不能作为相册名，请改个名字再试。');
  process.exit(1);
}

const targetDir = join(root, 'public', 'images', 'albums', slug);
if (resolve(targetDir) === source) {
  console.error('这个文件夹已经在相册目录里了，换一个源文件夹。');
  process.exit(1);
}

await mkdir(targetDir, { recursive: true });

const entries = await readdir(source, { withFileTypes: true });
const files = entries
  .filter((entry) => entry.isFile() && IMAGE_EXT.has(extname(entry.name).toLowerCase()))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b, 'zh', { numeric: true }));

if (!files.length) {
  console.error('这个文件夹里没有可用的图片（jpg / png / webp / gif / avif）。');
  process.exit(1);
}

const existing = (await readdir(targetDir)).filter((file) => /^\d+\.(jpe?g|png|webp|gif|avif)$/i.test(file));
let index = existing.reduce((max, file) => Math.max(max, Number.parseInt(file, 10) || 0), 0);

const mdPath = join(root, 'content', 'albums', `${slug}.md`);
const mdExists = await exists(mdPath);
const lines = [];
let firstNew = '';

for (const file of files) {
  const ext = extname(file).toLowerCase();
  let name;
  do {
    index += 1;
    name = `${pad(index)}${ext}`;
  } while (await exists(join(targetDir, name)));

  await copyFile(join(source, file), join(targetDir, name));
  if (!firstNew) firstNew = name;

  const caption = basename(file, extname(file)).replace(/[\[\]\r\n]/g, ' ').trim() || pad(index);
  lines.push(`![${caption}](/images/albums/${slug}/${name})`);
}

if (mdExists) {
  const current = await readFile(mdPath, 'utf8');
  await writeFile(mdPath, `${current.trimEnd()}\n\n${lines.join('\n')}\n`, 'utf8');
} else {
  const now = new Date();
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const markdown = `---
title: ${JSON.stringify(title)}
date: ${date}
location: 
camera: 
lens: 
cover: /images/albums/${slug}/${firstNew}
---

相册介绍（改这里）。

${lines.join('\n')}
`;
  await writeFile(mdPath, markdown, 'utf8');
}

const skipped = entries.filter((entry) => entry.isFile() && !IMAGE_EXT.has(extname(entry.name).toLowerCase())).length;

console.log('');
console.log(`✓ 导入 ${files.length} 张照片到相册「${title}」`);
console.log(`  图片目录：public/images/albums/${slug}/`);
console.log(`  相册文件：content/albums/${slug}.md`);
if (skipped) console.log(`  另有 ${skipped} 个非图片文件被跳过。`);
console.log('');
console.log('接下来改一下 title / location / camera / lens 和相册介绍，保存后刷新页面。');
