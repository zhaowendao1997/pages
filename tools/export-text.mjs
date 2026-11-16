import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { site } from '../site.config.mjs';
import { parseFrontmatter } from '../lib/yaml.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const contentDir = join(root, 'content');
const outputFile = join(root, 'docs', '全站文本.md');

const pageUrl = (path) => `${site.url}${site.base}${path}`;

async function readMarkdown(file) {
  const raw = await readFile(file, 'utf8');
  return parseFrontmatter(raw);
}

async function readDirFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md')).map((entry) => entry.name);
}

function dateValue(value) {
  return String(value || '');
}

function byDate(a, b) {
  return dateValue(b.data.date).localeCompare(dateValue(a.data.date));
}

function tags(value) {
  if (Array.isArray(value)) return value.join('、');
  return value ? String(value) : '';
}

function bullet(label, value) {
  return value ? `- ${label}：${value}\n` : '';
}

function demoteHeadings(body, levels = 2) {
  let fenced = false;
  return body
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;

      const match = line.match(/^(#{1,6})(\s+.*)$/);
      if (!match) return line;
      return `${'#'.repeat(Math.min(6, match[1].length + levels))}${match[2]}`;
    })
    .join('\n');
}

function bodyBlock(body) {
  const text = demoteHeadings(String(body || '').trim());
  return text || '（暂无正文）';
}

function postBlock(post, slug) {
  const { data, body } = post;
  let text = `### ${data.title || slug}\n\n`;
  text += bullet('页面', pageUrl(`/posts/${slug}/`));
  text += bullet('日期', data.date);
  text += bullet('分类', data.category);
  text += bullet('标签', tags(data.tags));
  text += bullet('摘要', data.summary);
  text += '\n';
  text += bodyBlock(body);
  return text.trimEnd();
}

function albumBlock(album, slug) {
  const { data, body } = album;
  const photoCount = (String(body).match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
  let text = `### ${data.title || slug}\n\n`;
  text += bullet('页面', pageUrl(`/photos/${slug}/`));
  text += bullet('日期', data.date);
  text += bullet('地点', data.location);
  text += bullet('相机', data.camera);
  text += bullet('镜头', data.lens);
  text += bullet('照片', photoCount ? `${photoCount} 张` : '');
  text += '\n';
  text += bodyBlock(body);
  return text.trimEnd();
}

function pinnedBlock(pinned) {
  const { data, body } = pinned;
  return `### 置顶：${data.title || '未命名'}\n\n${bodyBlock(body)}`;
}

function sectionBlock(key, introLines, items) {
  const section = site.sections[key];
  const nav = section.nav.map((item) => item.label).join(' / ');
  let text = `## ${section.label}\n\n`;
  text += bullet('侧栏简介', section.bio);
  text += bullet('页面导语', section.intro);
  text += bullet('导航', nav);
  text += '\n';
  if (introLines) text += `${introLines}\n\n`;
  text += items.join('\n\n---\n\n');
  return text.trimEnd();
}

const postFiles = await readDirFiles(join(contentDir, 'posts'));
const posts = await Promise.all(
  postFiles.map(async (file) => ({
    slug: basename(file, '.md'),
    ...(await readMarkdown(join(contentDir, 'posts', file))),
  }))
);
posts.sort(byDate);

const essayPosts = posts.filter((post) => post.data.type !== 'review');
const reviewPosts = posts.filter((post) => post.data.type === 'review');

const albumFiles = await readDirFiles(join(contentDir, 'albums'));
const albums = await Promise.all(
  albumFiles.map(async (file) => ({
    slug: basename(file, '.md'),
    ...(await readMarkdown(join(contentDir, 'albums', file))),
  }))
);
albums.sort(byDate);

const pinned = {
  essays: await readMarkdown(join(contentDir, 'pinned', 'essays.md')),
  photos: await readMarkdown(join(contentDir, 'pinned', 'photos.md')),
  gear: await readMarkdown(join(contentDir, 'pinned', 'gear.md')),
};

const about = await readMarkdown(join(contentDir, 'pages', 'about.md'));

const stamp = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date());

const parts = [];

parts.push(`# ${site.fullTitle}

> 这是全站页面文本的汇总，方便通读和统一改写。
>
> 它不是构建源文件：真正的内容在 \`content/\` 和 \`site.config.mjs\`，直接改这里不会更新网站。

- 作者：${site.author}
- 站点标题：${site.title}
- 签名：${site.signature}
- 描述：${site.description}
- 邮箱：${site.email}
- 生成时间：${stamp}

## 目录

- [首页](#首页)
- [狗屁话](#狗屁话)
- [小烂片](#小烂片)
- [老古董](#老古董)
- [关于我与网站](#关于我与网站)
- [归档](#归档)
- [404](#404)
- [彩蛋：filia](#彩蛋filia)
- [页脚](#页脚)
`);

parts.push(`## 首页

- 标题：${site.fullTitle}
- 签名：${site.signature}
- 入口：狗屁话 / 小烂片 / 老古董
- 页脚：© ${site.since} ${site.author}
`);

parts.push(
  sectionBlock(
    'essays',
    null,
    [pinnedBlock(pinned.essays), ...essayPosts.map((post) => postBlock(post, post.slug))]
  )
);

parts.push(
  sectionBlock(
    'photos',
    null,
    [pinnedBlock(pinned.photos), ...albums.map((album) => albumBlock(album, album.slug))]
  )
);

parts.push(
  sectionBlock(
    'gear',
    null,
    [pinnedBlock(pinned.gear), ...reviewPosts.map((post) => postBlock(post, post.slug))]
  )
);

parts.push(`## 关于我与网站

- 页面副标题：${site.aboutLine}
- 页面：${pageUrl('/about/')}

${bodyBlock(about.body)}
`);

parts.push(`## 归档

- 页面：${pageUrl('/archive/')}
- 导语：共 ${essayPosts.length} 篇，按时间排列。
- 说明：按年份倒序列出全部「狗屁话」文章，并可按分类筛选。
`);

parts.push(`## 404

- 页面：${pageUrl('/404.html')}
- 小标题：404
- 标题：这一页走丢了
- 正文：可能是链接敲错了一个字，也可能是这里本来就什么都没有。
- 返回：回首页 →
`);

parts.push(`## 彩蛋：filia

- 页面：${pageUrl('/secret/filia/')}
- 专辑：filia
- 艺人：春野
- 发行：2017.12.29
- 曲目：10 首，37:55
- 说明：一张藏起来的小彩蛋。十首歌，放在这里，等你自己点开。
- 播放器：网易云音乐专辑 90662216（标准音质免费试听）
`);

parts.push(`## 页脚

- 版权：© ${site.since} ${site.author}
- 说明：${site.footerNote}
`);

const output = `${parts.join('\n\n---\n\n').trim()}\n`;

await mkdir(join(root, 'docs'), { recursive: true });
await writeFile(outputFile, output, 'utf8');

console.log(`✓ 已生成 docs/全站文本.md（${essayPosts.length} 篇狗屁话 / ${albums.length} 本相册 / ${reviewPosts.length} 篇老古董）`);
