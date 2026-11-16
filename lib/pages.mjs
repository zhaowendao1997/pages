import { esc } from './util.mjs';
import { themeToggle } from './render.mjs';

const price = (value) => (value ? `¥${Number(value).toLocaleString('zh-CN')}` : '');

function postRow(post) {
  return `<li class="post-row">
  <a href="${post.url}">
    <p class="post-row__meta"><time datetime="${esc(post.date.iso)}">${esc(post.date.dot)}</time><span>${esc(post.category)}</span></p>
    <h3>${esc(post.title)}</h3>
    ${post.summary ? `<p>${esc(post.summary)}</p>` : ''}
  </a>
</li>`;
}

function pageHead(title, intro = '', section = false, count = '') {
  return `<header class="page-head${section ? ' page-head--section' : ''}">
  <h1>${esc(title)}</h1>
  ${intro || count ? `<p>${esc(intro)}${count ? `<span class="page-count">${esc(count)}</span>` : ''}</p>` : ''}
</header>`;
}

function pinnedBlock(item) {
  if (!item || (!item.title && !item.bodyHtml)) return '';
  return `<aside class="pinned">
  ${item.title ? `<h2>${esc(item.title)}</h2>` : ''}
  ${item.bodyHtml ? `<div class="pinned-body">${item.bodyHtml}</div>` : ''}
</aside>`;
}

export function homePage({ site, u, essays, reviews, albums, avatar = '' }) {
  const photoCount = albums.reduce((sum, album) => sum + album.count, 0);
  const year = new Date().getFullYear();
  const portalPhotos = (Array.isArray(site.portalPhotos) ? site.portalPhotos : []).filter(Boolean);
  const avatarInner = avatar
    ? `<img src="${esc(avatar)}" alt="" width="64" height="64" loading="eager" fetchpriority="high" decoding="async">`
    : esc(site.sections.about.mark);
  const background = portalPhotos.length
    ? `<div class="portal-bg" data-portal-bg aria-hidden="true">
    <img src="${esc(portalPhotos[0])}" alt="">
    <img src="" alt="">
  </div>
  <script type="application/json" data-portal-photos>${JSON.stringify(portalPhotos).replace(/</g, '\\u003c')}</script>`
    : '';

  return `${background}<div class="portal">
  <header class="portal-head">
    <div class="portal-copy">
      <p class="kicker">${esc(site.hero.eyebrow)}</p>
      <h1>${esc(site.fullTitle)}</h1>
      ${site.signature ? `<p class="portal-signature">${esc(site.signature)}</p>` : ''}
    </div>
    <a class="portal-avatar${avatar ? ' has-image' : ''}" href="${u('/secret/filia/')}" aria-label="彩蛋：filia" data-filia-open>${avatarInner}</a>
  </header>

  <ul class="portal-links">
    <li><a href="${u('/essays/')}"><span class="num">01</span><strong>狗屁话</strong><em>${essays.length} 篇</em><span class="arrow">→</span></a></li>
    <li><a href="${u('/photos/')}"><span class="num">02</span><strong>小烂片</strong><em>${albums.length} 本相册 · ${photoCount} 张</em><span class="arrow">→</span></a></li>
    <li><a href="${u('/gear/')}"><span class="num">03</span><strong>老古董</strong><em>${reviews.length} 篇评测</em><span class="arrow">→</span></a></li>
  </ul>

  <footer class="portal-foot">
    <div><a href="${u('/about/')}">关于我与网站</a><a href="${u('/feed.xml')}">RSS</a>${themeToggle}</div>
    <p>© ${year} ${esc(site.author)}</p>
  </footer>
</div>${avatar ? filiaOverlay({ u }) : ''}`;
}

export function essaysPage({ site, essays, pinned }) {
  return `${pageHead('狗屁话', site.sections.essays.intro, true, `共 ${essays.length} 篇`)}
${pinnedBlock(pinned)}
<ul class="post-list post-list--page">${essays.map(postRow).join('')}</ul>`;
}

export function photosPage({ site, albums, photoCount, pinned }) {
  return `${pageHead('小烂片', site.sections.photos.intro, true, `共 ${photoCount} 张`)}
${pinnedBlock(pinned)}
<div class="album-list">
  ${albums.map((album) => `<a class="album-item" href="${album.url}">
    <img src="${esc(album.coverThumb || album.cover)}" alt="${esc(album.title)}" loading="lazy">
    <h2>${esc(album.title)}</h2>
    <p>${esc(album.date.dot)} · ${album.count} 张${album.location ? ` · ${esc(album.location)}` : ''}</p>
  </a>`).join('')}
</div>`;
}

export function albumPage({ u, album, prev, next }) {
  return `<header class="page-head">
  <p class="back"><a href="${u('/photos/')}">← 全部相册</a></p>
  <h1>${esc(album.title)}</h1>
  <p>${esc(album.date.dot)} · ${album.count} 张${album.location ? ` · ${esc(album.location)}` : ''}</p>
  ${album.camera || album.lens ? `<p class="album-gear">${[album.camera, album.lens].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
</header>

${album.introHtml ? `<div class="album-intro prose">${album.introHtml}</div>` : ''}

<div class="album-grid" data-gallery>
  ${album.photos.map((photo) => `<figure data-ratio="${photo.width && photo.height ? (photo.width / photo.height).toFixed(4) : '1.5'}">
    <a href="${esc(photo.full || photo.src)}" data-lightbox data-caption="${esc(photo.alt)}"${photo.exifLine ? ` data-exif="${esc(photo.exifLine)}"` : ''}>
      <img src="${esc(photo.thumb || photo.src)}" alt="${esc(photo.alt)}"${photo.thumbWidth ? ` width="${photo.thumbWidth}" height="${photo.thumbHeight}"` : ''} loading="lazy">
    </a>
    <figcaption>
      ${photo.exposureLine ? `<span class="photo-exif">${esc(photo.exposureLine)}</span>` : ''}
      ${photo.fallbackCaption ? `<span class="photo-caption">${esc(photo.fallbackCaption)}</span>` : ''}
    </figcaption>
  </figure>`).join('')}
</div>

<nav class="pager">
  ${prev ? `<a href="${prev.url}"><span>上一册</span><strong>${esc(prev.title)}</strong></a>` : '<span></span>'}
  ${next ? `<a class="pager-next" href="${next.url}"><span>下一册</span><strong>${esc(next.title)}</strong></a>` : '<span></span>'}
</nav>`;
}

export function gearPage({ site, u, reviews, pinned }) {
  const hasScore = reviews.some((post) => post.gear && post.gear.score != null);
  return `${pageHead('老古董', site.sections.gear.intro, true)}
${pinnedBlock(pinned)}
<p class="kit-line">在用：${site.kit.map((item) => `<span>${esc(item.name)}</span>`).join(' / ')}</p>
<ul class="review-list">
  ${reviews.map((post) => {
    const gear = post.gear || {};
    const score = gear.score != null ? String(gear.score) : '';
    const meta = [gear.brand, gear.kind].filter(Boolean).join(' ');
    return `<li class="review-item">
    <a href="${post.url}">
      ${post.cover ? `<img class="review-item__cover" src="${esc(post.cover)}" alt=""${post.coverSize ? ` width="${post.coverSize.width}" height="${post.coverSize.height}"` : ''} decoding="async">` : ''}
      ${score ? `<span class="review-item__score">${esc(score)}</span>` : ''}
      <span class="review-item__body">
        <strong>${esc(gear.model || post.title)}</strong>
        ${meta ? `<em>${esc(meta)}${gear.price ? ` · ${price(gear.price)}` : ''}</em>` : ''}
        ${post.summary ? `<span>${esc(post.summary)}</span>` : ''}
      </span>
    </a>
  </li>`;
  }).join('')}
</ul>${hasScore ? '\n<p class="page-note">分数只代表个人使用感受，不构成购买建议。</p>' : ''}`;
}

function reviewBox(post) {
  const gear = post.gear || {};
  const pros = Array.isArray(gear.pros) ? gear.pros : [];
  const cons = Array.isArray(gear.cons) ? gear.cons : [];
  const facts = [
    ['品牌', gear.brand],
    ['型号', gear.model],
    ['卡口', gear.mount],
    ['价格', gear.price ? price(gear.price) : ''],
    ['使用', gear.duration],
  ].filter(([, value]) => value);

  return `<section class="review-box">
  <div class="review-box__score">${esc(String(gear.score ?? '—'))}<span>/10</span></div>
  <div class="review-box__body">
    <p class="review-box__verdict">${esc(post.verdict || post.summary)}</p>
    <p class="review-box__facts">${facts.map(([key, value]) => `<span>${esc(key)} ${esc(value)}</span>`).join('')}</p>
    <div class="review-box__lists">
      <div><h3>喜欢</h3><ul>${pros.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>
      <div><h3>不喜欢</h3><ul>${cons.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>
    </div>
  </div>
</section>`;
}

function specsBox(post) {
  const specs = post.gear?.specs;
  if (!specs || !Object.keys(specs).length) return '';
  return `<details class="specs">
  <summary>规格参数</summary>
  <dl>${Object.entries(specs).map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
</details>`;
}

export function postPage({ post, prev, next }) {
  return `<article class="post${post.type === 'review' ? ' post--review' : ''}">
  <header class="post-head">
    <p class="kicker">${esc(post.type === 'review' ? '老古董' : post.category)}</p>
    <h1>${esc(post.title)}</h1>
    ${post.summary ? `<p class="deck">${esc(post.summary)}</p>` : ''}
    <p class="meta"><time datetime="${esc(post.date.iso)}">${esc(post.date.cn)}</time> · 约 ${post.reading.minutes} 分钟 · ${post.reading.chars.toLocaleString('zh-CN')} 字</p>
  </header>

  ${post.cover ? `<figure class="post-cover"><img src="${esc(post.cover)}" alt=""${post.coverSize ? ` width="${post.coverSize.width}" height="${post.coverSize.height}"` : ''} decoding="async"></figure>` : ''}

  ${post.type === 'review' && post.gear ? reviewBox(post) : ''}

  <div class="prose">${post.bodyHtml}</div>

  ${specsBox(post)}

  <nav class="pager">
    ${prev ? `<a href="${prev.url}"><span>上一篇</span><strong>${esc(prev.title)}</strong></a>` : '<span></span>'}
    ${next ? `<a class="pager-next" href="${next.url}"><span>下一篇</span><strong>${esc(next.title)}</strong></a>` : '<span></span>'}
  </nav>
</article>`;
}

export function aboutPage({ site, about, photoCount, essayCount, reviewCount }) {
  return `<header class="page-head">
  <h1>关于我与网站</h1>
  ${site.aboutLine ? `<p>${esc(site.aboutLine)}</p>` : ''}
</header>

<div class="prose">${about.bodyHtml}</div>

<section class="about-section">
  <h2>在用的老古董</h2>
  <ul class="kit-list">${site.kit.map((item) => `<li><span>${esc(item.role)}</span><strong>${esc(item.name)}</strong></li>`).join('')}</ul>
</section>

<section class="about-section">
  <h2>这个站</h2>
  <p>${site.since} 年开始写，目前 ${essayCount} 篇文章、${photoCount} 张照片、${reviewCount} 篇老古董笔记。纯静态页面，托管在 GitHub Pages。</p>
</section>`;
}

export function archivePage({ posts }) {
  const years = new Map();
  for (const post of posts) {
    if (!years.has(post.date.year)) years.set(post.date.year, []);
    years.get(post.date.year).push(post);
  }

  const counts = new Map();
  for (const post of posts) {
    counts.set(post.category, (counts.get(post.category) || 0) + 1);
  }
  const categories = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'));

  const tabs = [
    `<button type="button" class="is-active" aria-pressed="true" data-archive-tab="*">全部<span class="tab-count">${posts.length}</span></button>`,
    ...categories.map(([name, total]) => `<button type="button" aria-pressed="false" data-archive-tab="${esc(name)}">${esc(name)}<span class="tab-count">${total}</span></button>`),
  ].join('');

  return `<header class="page-head">
  <h1>归档</h1>
  <p>共 <span data-archive-count>${posts.length}</span> 篇，按时间排列。</p>
</header>

<nav class="archive-tabs" data-archive-tabs aria-label="按分类筛选">${tabs}</nav>

${[...years.entries()]
  .sort((a, b) => Number(b[0]) - Number(a[0]))
  .map(([year, items]) => `<section class="archive-year">
  <h2>${year}</h2>
  <ul>
    ${items.map((post) => `<li data-category="${esc(post.category)}"><a href="${post.url}"><time>${esc(post.date.short)}</time><span>${esc(post.title)}</span><em>${esc(post.type === 'review' ? '器材' : post.category)}</em></a></li>`).join('')}
  </ul>
</section>`).join('')}`;
}

export function notFoundPage({ u }) {
  return `<div class="notfound">
  <p class="kicker">404</p>
  <h1>这一页走丢了</h1>
  <p>可能是链接敲错了一个字，也可能是这里本来就什么都没有。</p>
  <p><a href="${u('/')}">回首页 →</a> ${themeToggle}</p>
</div>`;
}

const filiaTracks = [
  'in between',
  "can't be waiting anymore?",
  'ルーム',
  'プリムラの食べ方',
  '幽霊花',
  '深昏睡',
  'nuit',
  'スコール',
  '楽園',
  '私怨',
];

function filiaBody({ u }) {
  const albumUrl = 'https://music.163.com/album?id=90662216';
  return `<div class="secret-hero">
    <figure class="secret-cover">
      <img src="${u('/images/music/filia.jpg')}" alt="春野《filia》专辑封面" width="1000" height="1000">
    </figure>
    <div class="secret-info">
      <p class="secret-kicker">SECRET · 2017</p>
      <h1>filia</h1>
      <p class="secret-artist">春野</p>
      <p class="secret-meta">2017.12.29 · 10 首 · 37:55</p>
      <p class="secret-note">找到彩蛋了。恭喜你。</p>
      <p class="secret-note-sub">这张专辑小时候抱过我。</p>
    </div>
  </div>

  <section class="secret-player" aria-label="filia 专辑">
    <div class="secret-player-head">
      <span>网易云音乐 · 整张专辑</span>
      <a href="${albumUrl}" target="_blank" rel="noreferrer">在网易云打开 ↗</a>
    </div>
    <a class="secret-play" href="${albumUrl}" target="_blank" rel="noreferrer">
      <span class="secret-play__icon" aria-hidden="true">▶</span>
      <span class="secret-play__label">播放整张</span>
      <span class="secret-play__meta">10 首 · 37:55</span>
    </a>
    <ol class="secret-tracks">${filiaTracks
      .map((track, index) => `<li><span class="secret-track-no">${String(index + 1).padStart(2, '0')}</span><span>${esc(track)}</span></li>`)
      .join('')}</ol>
    <p class="secret-foot">整张播放会打开网易云音乐。标准音质可免费试听；高音质可能需要登录或会员。</p>
  </section>`;
}

export function filiaPage({ u }) {
  return `<div class="secret-page">
  <a class="secret-back" href="${u('/')}">← 回到小站</a>
  ${filiaBody({ u })}
</div>`;
}

export function filiaOverlay({ u }) {
  return `<div class="filia-overlay" data-filia-overlay role="dialog" aria-modal="true" aria-label="filia 专辑" hidden>
  <button class="filia-close" type="button" data-filia-close aria-label="关闭">关闭 ×</button>
  <div class="secret-page secret-page--overlay">
    ${filiaBody({ u })}
  </div>
</div>`;
}
