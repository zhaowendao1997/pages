import { esc } from './util.mjs';

export function makeUrl(site) {
  return function url(path = '/') {
    if (!path) return site.base || '/';
    if (/^(?:[a-z]+:|\/\/|#)/i.test(path)) return path;
    const base = site.base && site.base !== '/' ? site.base.replace(/\/$/, '') : '';
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  };
}

const lightboxHtml = `<div class="lightbox" data-lightbox-root hidden>
  <button class="lb-close" type="button" data-lb-close aria-label="关闭"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
  <button class="lb-prev" type="button" data-lb-prev aria-label="上一张"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>
  <figure>
    <img data-lb-img alt="" draggable="false">
    <figcaption>
      <span class="lb-caption" data-lb-caption></span>
      <span class="lb-exif" data-lb-exif></span>
    </figcaption>
  </figure>
  <button class="lb-next" type="button" data-lb-next aria-label="下一张"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
</div>`;

const themeBoot = `<script>(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();</script>`;

export const themeToggle = `<button class="theme-toggle" type="button" data-theme-toggle aria-label="切换深浅色" title="切换深浅色"><svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"/></svg><svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>`;

function head({ site, page, url, pageTitle, description, canonical, ogImage, jsonLd, feedUrl, preloadImage = '' }) {
  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${page.noindex ? '<meta name="robots" content="noindex">' : ''}
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="author" content="${esc(site.author)}">
<meta name="color-scheme" content="light dark">
${themeBoot}
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="${url('/favicon.svg')}" type="image/svg+xml">
${preloadImage ? `<link rel="preload" as="image" href="${esc(preloadImage)}" fetchpriority="high">` : ''}
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="${url(feedUrl)}">
<meta property="og:type" content="${page.ogType || 'website'}">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:title" content="${esc(page.title || site.fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="${url('/assets/style.css')}">
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
</head>`;
}

export function layout({ site, page = {}, content, section = 'portal', active = '', jsonLd = '' }) {
  const url = makeUrl(site);
  const pageTitle = page.title ? `${page.title} · ${site.title}` : site.fullTitle;
  const description = page.description || site.description;
  const canonical = site.url + (page.path || '/');
  const ogImage = site.url + (page.image || site.hero.image);
  const year = new Date().getFullYear();
  const feedUrl = { essays: '/essays/feed.xml', gear: '/gear/feed.xml' }[section] || '/feed.xml';
  const preloadImage = section === 'portal' && site.avatar ? url(site.avatar) : '';

  const headHtml = head({ site, page, url, pageTitle, description, canonical, ogImage, jsonLd, feedUrl, preloadImage });

  if (section === 'portal') {
    return `${headHtml}
<body class="site-portal">
<a class="skip" href="#main">跳到正文</a>
<main id="main" class="portal-main">
${content}
</main>
${lightboxHtml}
<script src="${url('/assets/main.js')}" defer></script>
</body>
</html>`;
  }

  const meta = site.sections?.[section] || site.sections?.about;
  const nav = meta.nav
    .map((item) => `<a href="${url(item.href)}"${active === item.key ? ' class="is-active" aria-current="page"' : ''}>${esc(item.label)}</a>`)
    .join('');

  const socials = [
    site.email ? `<a href="mailto:${esc(site.email)}">邮箱</a>` : '',
    section === 'photos' ? '' : `<a href="${url(feedUrl)}">RSS</a>`,
    ...site.socials.map((item) => `<a href="${url(item.href)}"${/^https?:/i.test(item.href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(item.label)}</a>`),
    themeToggle,
  ].filter(Boolean).join('');

  const pagePath = page.path || '/';
  const isPost = pagePath.startsWith('/posts/');
  const isAlbum = /^\/photos\/[^/]+\/?$/.test(pagePath);
  const back = isAlbum
    ? ''
    : `<a class="back-link" href="${isPost ? url(`/${section}/`) : url('/')}" aria-label="${isPost ? `返回${meta.label}列表` : '返回首页'}">← ${isPost ? '返回' : '返回首页'}</a>`;

  return `${headHtml}
<body class="site-${section}">
<a class="skip" href="#main">跳到正文</a>
<div class="shell">
  <aside class="sidebar">
    <div class="sidebar-inner">
      <a class="avatar" href="${url('/')}" aria-label="回到首页">${esc(meta.mark)}</a>
      <p class="site-name"><a href="${url('/')}">${esc(site.title)}</a></p>
      <p class="site-section">${esc(meta.label)}</p>
      <p class="site-bio">${esc(meta.bio)}</p>
      <nav class="nav" aria-label="分栏导航">${nav}</nav>
      <div class="sidebar-meta">
        <a class="back-home" href="${url('/')}">← 首页</a>
        <div class="socials">${socials}</div>
      </div>
    </div>
  </aside>
  <main id="main" class="main">
    <div class="content">
${back}
${content}
    </div>
    <footer class="footer">
      <p>© ${year} ${esc(site.author)}</p>
      <p>${esc(site.footerNote)}</p>
    </footer>
  </main>
</div>
${lightboxHtml}
<script src="${url('/assets/main.js')}" defer></script>
</body>
</html>`;
}
