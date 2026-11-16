import { mkdir, readFile, readdir, writeFile, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { site } from './site.config.mjs';
import { parseFrontmatter } from './lib/yaml.mjs';
import { renderMarkdown, extractImages, stripImages } from './lib/markdown.mjs';
import { imageSize } from './lib/images.mjs';
import { readExif, formatExif } from './lib/exif.mjs';
import { dateParts, readingStats, stripHtml, rfc822Date, escapeXml, truncate } from './lib/util.mjs';
import { layout, makeUrl } from './lib/render.mjs';
import {
  homePage, essaysPage, photosPage, albumPage, gearPage, postPage, aboutPage, archivePage, notFoundPage, filiaPage,
} from './lib/pages.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const contentDir = join(root, 'content');
const publicDir = join(root, 'public');
const assetsDir = join(root, 'assets');
const distDir = join(root, 'dist');

const u = makeUrl(site);

async function readMarkdown(file) {
  const raw = await readFile(file, 'utf8');
  return parseFrontmatter(raw);
}

function resolveImage(src) {
  if (!src || /^(?:https?:)?\/\//.test(src) || src.startsWith('data:')) return null;
  const file = join(publicDir, src.replace(/^\//, ''));
  return existsSync(file) ? imageSize(file) : null;
}

async function loadPosts() {
  const dir = join(contentDir, 'posts');
  const files = (await readdir(dir)).filter((file) => extname(file) === '.md');
  const posts = [];

  for (const file of files) {
    const { data, body } = await readMarkdown(join(dir, file));
    if (data.draft === true) continue;

    const slug = basename(file, '.md');
    const rendered = renderMarkdown(body, { resolveImage });
    const type = data.type === 'review' ? 'review' : 'essay';
    const postTags = Array.isArray(data.tags) ? data.tags.map(String) : [];

    posts.push({
      slug,
      path: `/posts/${slug}/`,
      url: u(`/posts/${slug}/`),
      title: String(data.title || slug),
      date: dateParts(data.date),
      updated: data.updated ? dateParts(data.updated) : null,
      type,
      category: String(data.category || postTags[0] || (type === 'review' ? '器材' : '随笔')),
      tags: postTags,
      cover: data.cover ? String(data.cover) : '',
      coverSize: data.cover ? resolveImage(String(data.cover)) : null,
      summary: String(data.summary || ''),
      verdict: data.verdict ? String(data.verdict) : '',
      gear: data.gear && typeof data.gear === 'object' ? data.gear : null,
      body,
      bodyHtml: rendered.html,
      headings: rendered.headings,
      reading: readingStats(body),
      draft: Boolean(data.draft),
    });
  }

  posts.sort((a, b) => b.date.iso.localeCompare(a.date.iso));
  return posts;
}

async function loadAlbums() {
  const dir = join(contentDir, 'albums');
  const files = (await readdir(dir)).filter((file) => extname(file) === '.md');
  const albums = [];

  for (const file of files) {
    const { data, body } = await readMarkdown(join(dir, file));
    const slug = basename(file, '.md');
    const images = extractImages(body)
      .sort((a, b) =>
        basename(a.src).localeCompare(basename(b.src), 'zh', { numeric: true, sensitivity: 'base' })
      )
      .map((image) => {
      const size = resolveImage(image.src);
      const file = image.src.startsWith('/images/') ? join(publicDir, image.src.slice(1)) : '';
      const fullSrc = `/images/albums/${slug}/full/${basename(image.src)}`;
      const fullSize = resolveImage(fullSrc);
      const fullFile = fullSize ? join(publicDir, fullSrc.slice(1)) : file;
      const exif = fullFile ? readExif(fullFile) : null;
      const formatted = formatExif(exif);
      const exposureLine = formatted.exposureLine || image.title || '';
      const fallbackCaption = !exposureLine ? image.alt : '';
      const exifLine = exposureLine;
      const thumbSrc = `/images/albums/${slug}/thumbs/${basename(image.src)}`;
      const thumbSize = resolveImage(thumbSrc);

      return {
        ...image,
        width: size?.width || null,
        height: size?.height || null,
        full: fullSize ? fullSrc : image.src,
        thumb: thumbSize ? thumbSrc : image.src,
        thumbWidth: thumbSize?.width || size?.width || null,
        thumbHeight: thumbSize?.height || size?.height || null,
        exif,
        exposureLine,
        fallbackCaption,
        exifLine,
      };
    });
    const intro = stripImages(body);
    const introHtml = intro ? renderMarkdown(intro, { resolveImage }).html : '';
    const cover = data.cover ? String(data.cover) : images[0]?.src || '';
    const coverThumb = cover ? `/images/albums/${slug}/thumbs/${basename(cover)}` : '';
    const coverThumbSize = coverThumb ? resolveImage(coverThumb) : null;

    albums.push({
      slug,
      path: `/photos/${slug}/`,
      url: u(`/photos/${slug}/`),
      title: String(data.title || slug),
      date: dateParts(data.date),
      location: data.location ? String(data.location) : '',
      camera: data.camera ? String(data.camera) : '',
      lens: data.lens ? String(data.lens) : '',
      cover,
      coverThumb: coverThumbSize ? coverThumb : cover,
      coverSize: cover ? resolveImage(cover) : null,
      photos: images,
      count: images.length,
      introHtml,
      body,
    });
  }

  albums.sort((a, b) => b.date.iso.localeCompare(a.date.iso));
  return albums;
}

async function loadPinned() {
  const dir = join(contentDir, 'pinned');
  if (!existsSync(dir)) return {};
  const files = (await readdir(dir)).filter((file) => extname(file) === '.md');
  const pinned = {};

  for (const file of files) {
    const { data, body } = await readMarkdown(join(dir, file));
    pinned[basename(file, '.md')] = {
      title: data.title ? String(data.title) : '',
      bodyHtml: renderMarkdown(body, { resolveImage }).html,
    };
  }

  return pinned;
}

async function loadAbout() {
  const file = join(contentDir, 'pages', 'about.md');
  if (!existsSync(file)) return { title: '关于', bodyHtml: '<p>这里还没有内容。</p>' };
  const { data, body } = await readMarkdown(file);
  return { ...data, bodyHtml: renderMarkdown(body, { resolveImage }).html };
}

async function emit(routePath, html) {
  const target = routePath.endsWith('.html')
    ? join(distDir, routePath)
    : join(distDir, routePath, 'index.html');
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, html, 'utf8');
  return target;
}

function postJsonLd(post) {
  const base = {
    '@context': 'https://schema.org',
    '@type': post.type === 'review' ? 'Review' : 'BlogPosting',
    headline: post.title,
    description: post.summary,
    datePublished: post.date.iso,
    dateModified: (post.updated || post.date).iso,
    author: { '@type': 'Person', name: site.author, url: site.url },
    image: post.cover ? site.url + post.cover : site.url + site.hero.image,
    url: site.url + post.path,
    mainEntityOfPage: site.url + post.path,
  };
  if (post.type === 'review' && post.gear) {
    base.itemReviewed = {
      '@type': 'Product',
      name: post.gear.model,
      brand: { '@type': 'Brand', name: post.gear.brand },
    };
    if (post.gear.score) {
      base.reviewRating = {
        '@type': 'Rating',
        ratingValue: post.gear.score,
        bestRating: 10,
        worstRating: 0,
      };
    }
  }
  return JSON.stringify(base).replace(/</g, '\\u003c');
}

function feedXml(posts, { title = site.fullTitle, path = '/' } = {}) {
  const link = `${site.url}${path}`;
  const self = `${site.url}${path.replace(/\/$/, '')}/feed.xml`;
  const items = posts.slice(0, 20).map((post) => `<item>
  <title>${escapeXml(post.title)}</title>
  <link>${site.url}${post.path}</link>
  <guid isPermaLink="true">${site.url}${post.path}</guid>
  <pubDate>${rfc822Date(post.date.iso)}</pubDate>
  <description>${escapeXml(post.summary)}</description>
  ${post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join('\n  ')}
</item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXml(title)}</title>
  <link>${link}</link>
  <description>${escapeXml(site.description)}</description>
  <language>zh-CN</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${self}" rel="self" type="application/rss+xml"/>
  ${items}
</channel>
</rss>`;
}

function sitemapXml(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({ loc, lastmod }) => `  <url><loc>${escapeXml(site.url + loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;
}

async function main() {
  const started = Date.now();

  const posts = await loadPosts();
  const albums = await loadAlbums();
  const pinned = await loadPinned();
  const about = await loadAbout();

  const essays = posts.filter((post) => post.type !== 'review');
  const reviews = posts.filter((post) => post.type === 'review');
  const photoCount = albums.reduce((sum, album) => sum + album.count, 0);

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await cp(publicDir, distDir, { recursive: true });
  await cp(assetsDir, join(distDir, 'assets'), { recursive: true });
  await writeFile(join(distDir, '.nojekyll'), '');

  // 头像图存在才用图，否则退回单字
  const avatar = site.avatar && resolveImage(site.avatar) ? site.avatar : '';

  // Home
  await emit('/', layout({
    site,
    page: { title: '', path: '/', description: site.description, image: site.hero.image },
    content: homePage({ site, u, essays, reviews, albums, avatar }),
    section: 'portal',
  }));

  // Essays
  await emit('/essays/', layout({
    site,
    page: {
      title: '狗屁话',
      path: '/essays/',
      description: '朝闻道写下的随笔、日常与杂谈。',
      image: essays[0]?.cover || site.hero.image,
    },
    content: essaysPage({ site, essays, pinned: pinned.essays }),
    section: 'essays',
    active: 'essays',
  }));

  // Photos
  await emit('/photos/', layout({
    site,
    page: {
      title: '小烂片',
      path: '/photos/',
      description: '按册存放的照片：海边、城市、山与雾。',
      image: albums[0]?.cover || site.hero.image,
    },
    content: photosPage({ site, albums, photoCount, pinned: pinned.photos }),
    section: 'photos',
    active: 'photos',
  }));

  // Albums
  for (let index = 0; index < albums.length; index += 1) {
    const album = albums[index];
    await emit(album.path, layout({
      site,
      page: {
        title: album.title,
        path: album.path,
        description: album.introHtml ? truncate(stripHtml(album.introHtml), 100) : `${album.title} · ${album.count} 张照片`,
        image: album.cover,
        ogType: 'article',
      },
      content: albumPage({ u, album, prev: albums[index - 1], next: albums[index + 1] }),
      section: 'photos',
      active: 'photos',
    }));
  }

  // Gear
  await emit('/gear/', layout({
    site,
    page: {
      title: '老古董',
      path: '/gear/',
      description: '相机与镜头的长期使用笔记。',
      image: reviews[0]?.cover || site.hero.image,
    },
    content: gearPage({ site, u, reviews, pinned: pinned.gear }),
    section: 'gear',
    active: 'gear',
  }));

  // Posts
  for (let index = 0; index < posts.length; index += 1) {
    const post = posts[index];
    const pool = post.type === 'review' ? reviews : essays;
    const position = pool.findIndex((item) => item.slug === post.slug);

    const related = pool
      .filter((item) => item.slug !== post.slug)
      .map((item) => ({
        item,
        score: (item.category === post.category ? 2 : 0) + item.tags.filter((tag) => post.tags.includes(tag)).length,
      }))
      .sort((a, b) => b.score - a.score || b.item.date.iso.localeCompare(a.item.date.iso))
      .slice(0, 2)
      .map(({ item }) => item);

    await emit(post.path, layout({
      site,
      page: {
        title: post.title,
        path: post.path,
        description: post.summary,
        image: post.cover,
        ogType: 'article',
      },
      content: postPage({
        site,
        u,
        post,
        prev: pool[position - 1] || null,
        next: pool[position + 1] || null,
        related,
      }),
      section: post.type === 'review' ? 'gear' : 'essays',
      active: post.type === 'review' ? 'gear' : 'essays',
      jsonLd: postJsonLd(post),
    }));
  }

  // About
  await emit('/about/', layout({
    site,
    page: {
      title: '关于我与网站',
      path: '/about/',
      description: `关于${site.author}，以及这个博客。`,
    },
    content: aboutPage({
      site,
      u,
      about,
      photoCount,
      essayCount: essays.length,
      reviewCount: reviews.length,
    }),
    section: 'about',
    active: 'about',
  }));

  // Archive
  await emit('/archive/', layout({
    site,
    page: {
      title: '归档',
      path: '/archive/',
      description: '全部文章的时间归档。',
    },
    content: archivePage({ posts: essays }),
    section: 'essays',
    active: 'archive',
  }));

  // 404
  await emit('404.html', layout({
    site,
    page: { title: '页面走丢了', path: '/404.html', description: '404' },
    content: notFoundPage({ u }),
    section: 'portal',
  }));

  // 彩蛋：filia
  await emit('/secret/filia/', layout({
    site,
    page: {
      title: 'filia',
      path: '/secret/filia/',
      description: '春野《filia》— 一个藏起来的小彩蛋。',
      noindex: true,
    },
    content: filiaPage({ u }),
    section: 'portal',
  }));

  // Feed, sitemap, robots, search
  await writeFile(join(distDir, 'feed.xml'), feedXml(posts), 'utf8');
  await writeFile(join(distDir, 'essays', 'feed.xml'), feedXml(essays, { title: `${site.title} · 狗屁话`, path: '/essays/' }), 'utf8');
  await writeFile(join(distDir, 'gear', 'feed.xml'), feedXml(reviews, { title: `${site.title} · 老古董`, path: '/gear/' }), 'utf8');
  await writeFile(join(distDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`, 'utf8');

  const sitemapUrls = [
    { loc: '/', lastmod: posts[0]?.date.iso },
    { loc: '/essays/' },
    { loc: '/photos/' },
    { loc: '/gear/' },
    { loc: '/about/' },
    { loc: '/archive/' },
    ...posts.map((post) => ({ loc: post.path, lastmod: (post.updated || post.date).iso })),
    ...albums.map((album) => ({ loc: album.path, lastmod: album.date.iso })),
  ];
  await writeFile(join(distDir, 'sitemap.xml'), sitemapXml(sitemapUrls), 'utf8');

  const seconds = ((Date.now() - started) / 1000).toFixed(2);
  console.log(`✓ 构建完成：${posts.length} 篇文章 / ${albums.length} 本相册 / ${photoCount} 张照片，用时 ${seconds}s`);
  console.log(`  dist/  →  ${distDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
