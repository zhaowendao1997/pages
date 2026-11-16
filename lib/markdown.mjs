import { esc } from './util.mjs';

const BREAK = '\u0003';

export function renderMarkdown(source, options = {}) {
  const ctx = {
    resolveImage: options.resolveImage || (() => null),
    fullImage: options.fullImage || (() => ''),
    headings: [],
    usedIds: new Map(),
    depth: 0,
  };
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const html = renderBlocks(lines, ctx).trim();
  return { html, headings: ctx.headings };
}

export function extractImages(markdown) {
  const images = [];
  const re = /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)/g;
  let match;
  while ((match = re.exec(markdown))) {
    images.push({ alt: match[1], src: match[2], title: match[3] || '' });
  }
  return images;
}

export function stripImages(markdown) {
  return markdown
    .replace(/!\[[^\]]*\]\(\s*[^)\s]+(?:\s+"[^"]*")?\s*\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function indentOf(line) {
  return (line.match(/^ */) || [''])[0].length;
}

function isOrderedMarker(marker) {
  return /^\d/.test(marker);
}

function renderBlocks(lines, ctx) {
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Fenced code
    const fence = line.match(/^\s*```(\S*)\s*$/);
    if (fence) {
      const lang = fence[1] || '';
      const code = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      const label = lang || 'text';
      html += `<div class="code-block"${lang ? ` data-lang="${esc(lang)}"` : ''}>`
        + `<div class="code-head"><span>${esc(label)}</span><button type="button" class="code-copy" data-copy>复制</button></div>`
        + `<pre><code>${esc(code.join('\n'))}</code></pre></div>`;
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const raw = heading[2].trim();
      const id = uniqueId(headingSlug(raw), ctx);
      if (level === 2 || level === 3) {
        ctx.headings.push({ level, id, text: plainInline(raw) });
      }
      html += `<h${level} id="${esc(id)}">${inline(raw, ctx)}<a class="heading-anchor" href="#${esc(id)}" aria-hidden="true" tabindex="-1">#</a></h${level}>`;
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      html += '<hr>';
      i += 1;
      continue;
    }

    // Block quote
    if (/^\s*>/.test(line)) {
      const inner = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        inner.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      html += `<blockquote>${renderBlocks(inner, ctx)}</blockquote>`;
      continue;
    }

    // Table
    if (isTableStart(line, lines[i + 1])) {
      const { table, next } = parseTable(lines, i, ctx);
      html += table;
      i = next;
      continue;
    }

    // List
    if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) {
      const { list, next } = parseList(lines, i, ctx);
      html += list;
      i = next;
      continue;
    }

    // Raw HTML block
    if (/^\s*<([a-zA-Z][\w-]*)(?:\s|>|\/)/.test(line)) {
      const block = [];
      while (i < lines.length && lines[i].trim() !== '') {
        block.push(lines[i]);
        i += 1;
      }
      html += block.join('\n');
      continue;
    }

    // Paragraph
    const para = [];
    while (i < lines.length) {
      const current = lines[i];
      if (!current.trim()) break;
      if (para.length > 0 && startsBlock(current, lines[i + 1])) break;
      para.push(current);
      i += 1;
    }
    html += renderParagraph(para, ctx);
  }

  return html;
}

function startsBlock(line, next) {
  return (
    /^\s*```/.test(line) ||
    /^(#{1,6})\s+/.test(line) ||
    /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    /^\s*>/.test(line) ||
    /^\s*(?:[-*+]|\d+[.)])\s+/.test(line) ||
    /^\s*<([a-zA-Z][\w-]*)(?:\s|>|\/)/.test(line) ||
    isTableStart(line, next)
  );
}

function renderParagraph(lines, ctx) {
  let text = lines.map((raw) => raw.trim().replace(/\\$/, '')).join(BREAK);
  const indentMatch = text.match(/^\[indent\](?:[ \t\u0003]+)/i);
  const indent = Boolean(indentMatch);
  if (indent) text = text.slice(indentMatch[0].length);

  const sole = text.match(/^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)$/);
  if (sole) {
    return `<figure class="md-figure">${renderImage(sole[1], sole[2], sole[3], ctx)}<figcaption>${esc(sole[1])}</figcaption></figure>`;
  }

  // 整段用【】括起来 → 细斜注释块
  const note = text.match(/^【([\s\S]+)】$/);
  if (note) {
    return `<p class="note${indent ? ' indent' : ''}">${inline(note[1], ctx)}</p>`;
  }

  return `<p${indent ? ' class="indent"' : ''}>${inline(text, ctx)}</p>`;
}

function isTableStart(line, next) {
  if (!line || !next) return false;
  if (!line.includes('|')) return false;
  return /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(next);
}

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|')) row = row.slice(0, -1);
  return row.split('|').map((cell) => cell.trim());
}

function parseTable(lines, start, ctx) {
  const header = splitRow(lines[start]);
  const rules = splitRow(lines[start + 1]);
  const aligns = rules.map((rule) => {
    const left = rule.startsWith(':');
    const right = rule.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });

  let i = start + 2;
  const rows = [];
  while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
    rows.push(splitRow(lines[i]));
    i += 1;
  }

  const head = header
    .map((cell, idx) => `<th${aligns[idx] && aligns[idx] !== 'left' ? ` class="ta-${aligns[idx]}"` : ''}>${inline(cell, ctx)}</th>`)
    .join('');

  const body = rows
    .map((row) => `<tr>${header
      .map((_, idx) => `<td${aligns[idx] && aligns[idx] !== 'left' ? ` class="ta-${aligns[idx]}"` : ''}>${inline(row[idx] || '', ctx)}</td>`)
      .join('')}</tr>`)
    .join('');

  return {
    table: `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`,
    next: i,
  };
}

function parseList(lines, start, ctx) {
  const first = lines[start];
  const indent = indentOf(first);
  const ordered = /^\s*\d+[.)]\s+/.test(first);
  const items = [];
  let i = start;
  let isTask = false;

  while (i < lines.length) {
    let line = lines[i];

    if (line.trim() === '') {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j += 1;
      const nextItem = j < lines.length ? lines[j].match(/^(\s*)([-*+]|\d+[.)])\s+/) : null;
      if (nextItem && nextItem[1].length === indent && isOrderedMarker(nextItem[2]) === ordered) {
        i = j;
        continue;
      }
      break;
    }

    const match = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (!match) break;
    if (match[1].length !== indent) break;
    if (isOrderedMarker(match[2]) !== ordered) break;

    let contentLines = [match[3]];
    i += 1;

    while (i < lines.length) {
      const next = lines[i];
      if (next.trim() === '') {
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') j += 1;
        if (j < lines.length && indentOf(lines[j]) > indent) {
          contentLines.push('');
          i += 1;
          continue;
        }
        break;
      }
      const nextIndent = indentOf(next);
      if (nextIndent <= indent) break;
      const strip = Math.min(nextIndent, indent + 2);
      contentLines.push(next.slice(strip));
      i += 1;
    }

    while (contentLines.length && contentLines[0].trim() === '') contentLines.shift();
    while (contentLines.length && contentLines[contentLines.length - 1].trim() === '') contentLines.pop();

    const task = contentLines[0].match(/^\[([ xX])\]\s+(.*)$/);
    if (task) {
      isTask = true;
      const checked = task[1].toLowerCase() === 'x';
      contentLines[0] = task[2];
      const inner = renderBlocks(contentLines, ctx);
      items.push(`<li class="task-item${checked ? ' is-done' : ''}"><span class="task-box" aria-hidden="true">${checked ? '✓' : ''}</span><div>${inner}</div></li>`);
      continue;
    }

    items.push(`<li>${renderBlocks(contentLines, ctx)}</li>`);
  }

  const tag = ordered ? 'ol' : 'ul';
  const cls = isTask ? ' class="task-list"' : '';
  return { list: `<${tag}${cls}>${items.join('')}</${tag}>`, next: i };
}

function headingSlug(text) {
  return plainInline(text)
    .toLowerCase()
    .replace(/[’'"“”‘’]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
}

function plainInline(text) {
  return String(text)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim();
}

function uniqueId(base, ctx) {
  const count = ctx.usedIds.get(base) || 0;
  ctx.usedIds.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function renderImage(alt, src, title, ctx) {
  const size = ctx.resolveImage(src);
  const full = ctx.fullImage?.(src) || src;
  const dims = size && size.width && size.height ? ` width="${size.width}" height="${size.height}"` : '';
  const exif = title ? ` data-exif="${esc(title)}"` : '';
  return `<a class="lightbox-link" href="${esc(full)}" data-lightbox data-caption="${esc(alt)}"${exif}>`
    + `<img src="${esc(src)}" alt="${esc(alt)}"${dims} loading="lazy" decoding="async">`
    + '</a>';
}

function inline(input, ctx) {
  if (input == null) return '';
  if (ctx.depth > 6) return esc(input);
  ctx.depth += 1;

  const stash = [];
  const put = (html) => {
    stash.push(html);
    return `\u0002${stash.length - 1}\u0002`;
  };

  let text = String(input);

  text = text.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)/g, (_, alt, src, title) => put(renderImage(alt, src, title, ctx)));

  text = text.replace(/\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)/g, (_, label, href, title) => {
    const external = /^https?:\/\//i.test(href);
    const rel = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    const titleAttr = title ? ` title="${esc(title)}"` : '';
    return put(`<a href="${esc(href)}"${titleAttr}${rel}>${inline(label, ctx)}</a>`);
  });

  text = esc(text);

  text = text.replace(/`([^`]+)`/g, (_, code) => put(`<code>${code}</code>`));

  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  text = text.replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');
  text = text.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

  text = text.replace(new RegExp(BREAK, 'g'), '<br>');
  text = text.replace(/\u0002(\d+)\u0002/g, (_, n) => stash[Number(n)] || '');

  ctx.depth -= 1;
  return text;
}
