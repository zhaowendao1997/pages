const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export function isCJK(ch = '') {
  return /[\u2e80-\u9fff\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef]/.test(ch);
}

export function stripHtml(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Rough reading stats tuned for mixed Chinese/English prose. */
export function readingStats(markdown = '') {
  const text = String(markdown)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~\-]{1,}/g, ' ');

  const cjk = (text.match(/[\u2e80-\u9fff\uf900-\ufaff]/g) || []).length;
  const words = (text.replace(/[\u2e80-\u9fff\uf900-\ufaff]/g, ' ').match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
  const chars = cjk + words;
  const minutes = Math.max(1, Math.round(cjk / 400 + words / 220));
  return { chars, cjk, words, minutes };
}

const pad = (n) => String(n).padStart(2, '0');

export function dateParts(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = pad(match[2]);
    const d = pad(match[3]);
    return {
      iso: `${y}-${m}-${d}`,
      year: y,
      month: m,
      day: d,
      dot: `${y}.${m}.${d}`,
      cn: `${y} 年 ${Number(m)} 月 ${Number(d)} 日`,
      short: `${m}.${d}`,
      compact: `${y}${m}${d}`,
    };
  }
  const now = new Date();
  const y = String(now.getFullYear());
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  return {
    iso: `${y}-${m}-${d}`,
    year: y,
    month: m,
    day: d,
    dot: `${y}.${m}.${d}`,
    cn: `${y} 年 ${Number(m)} 月 ${Number(d)} 日`,
    short: `${m}.${d}`,
    compact: `${y}${m}${d}`,
  };
}

export function rfc822Date(value) {
  const p = dateParts(value);
  const date = new Date(`${p.iso}T09:00:00+08:00`);
  return date.toUTCString();
}

export function truncate(text = '', max = 120) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if ([...clean].length <= max) return clean;
  return [...clean].slice(0, max).join('').replace(/[，。、；：,.;:]?$/, '') + '…';
}

export function cx(...values) {
  return values.filter(Boolean).join(' ');
}

export function encodePath(value = '') {
  return encodeURI(value);
}

export function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
