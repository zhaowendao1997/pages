/**
 * A deliberately small YAML subset: enough for front matter, nothing more.
 * Supports nested maps, lists, inline lists, quoted strings, block scalars.
 */

function tokenize(text) {
  const lines = [];
  for (const raw of String(text).split(/\r?\n/)) {
    let indent = 0;
    let i = 0;
    while (i < raw.length && (raw[i] === ' ' || raw[i] === '\t')) {
      indent += raw[i] === '\t' ? 2 : 1;
      i += 1;
    }
    lines.push({ indent, text: raw.slice(i).replace(/\s+$/, ''), raw });
  }
  return lines;
}

function parseScalar(input) {
  const value = String(input).trim();
  if (value === '') return '';

  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    return splitInline(value.slice(1, -1)).map(parseScalar);
  }
  if (value === 'true' || value === 'True' || value === 'yes') return true;
  if (value === 'false' || value === 'False' || value === 'no') return false;
  if (value === 'null' || value === 'Null' || value === '~') return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d+\.\d+$/.test(value)) return Number(value);
  return value;
}

function splitInline(input) {
  const parts = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ',') {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part !== '');
}

class Parser {
  constructor(text) {
    this.lines = tokenize(text);
    this.i = 0;
  }

  skip() {
    while (this.i < this.lines.length) {
      const line = this.lines[this.i];
      if (line.text === '' || line.text.startsWith('#')) {
        this.i += 1;
      } else {
        break;
      }
    }
  }

  parse() {
    this.skip();
    if (this.i >= this.lines.length) return {};
    const value = this.parseBlock(this.lines[this.i].indent);
    return value && typeof value === 'object' ? value : {};
  }

  parseBlock(indent) {
    this.skip();
    const line = this.lines[this.i];
    if (!line || line.indent < indent) return null;
    if (/^-(?:\s|$)/.test(line.text)) return this.parseArray(line.indent);
    return this.parseMap(line.indent);
  }

  parseMap(indent, seed = null) {
    const obj = {};
    if (seed) {
      const { key, rest } = seed;
      if (rest === '') {
        this.skip();
        const next = this.lines[this.i];
        if (next && next.indent > indent) obj[key] = this.parseBlock(next.indent);
        else obj[key] = null;
      } else {
        obj[key] = parseScalar(rest);
      }
    }

    for (;;) {
      this.skip();
      const line = this.lines[this.i];
      if (!line || line.indent < indent) break;
      if (line.indent > indent) break;
      if (/^-(?:\s|$)/.test(line.text)) break;

      const match = line.text.match(/^([^:]+):(?:\s+(.*))?$/);
      if (!match) {
        this.i += 1;
        continue;
      }

      const key = match[1].trim().replace(/^["']|["']$/g, '');
      const rest = (match[2] ?? '').trim();
      this.i += 1;

      if (rest === '|' || rest === '>') {
        obj[key] = this.parseBlockScalar(indent, rest === '>');
      } else if (rest === '') {
        this.skip();
        const next = this.lines[this.i];
        if (next && next.indent > indent) {
          obj[key] = this.parseBlock(next.indent);
        } else {
          obj[key] = null;
        }
      } else {
        obj[key] = parseScalar(rest);
      }
    }
    return obj;
  }

  parseArray(indent) {
    const arr = [];
    for (;;) {
      this.skip();
      const line = this.lines[this.i];
      if (!line || line.indent !== indent || !/^-(?:\s|$)/.test(line.text)) break;

      const rest = line.text.replace(/^-\s?/, '').trim();
      this.i += 1;

      if (rest === '') {
        this.skip();
        const next = this.lines[this.i];
        if (next && next.indent > indent) arr.push(this.parseBlock(next.indent));
        else arr.push(null);
        continue;
      }

      const mapMatch = rest.match(/^([^:]+):(?:\s+(.*))?$/);
      if (mapMatch && (mapMatch[2] === undefined || mapMatch[2] === '' || /^[^/]/.test(mapMatch[2]))) {
        const key = mapMatch[1].trim().replace(/^["']|["']$/g, '');
        const value = (mapMatch[2] ?? '').trim();
        arr.push(this.parseMap(indent + 2, { key, rest: value }));
        continue;
      }

      arr.push(parseScalar(rest));
    }
    return arr;
  }

  parseBlockScalar(parentIndent, folded) {
    const lines = [];
    let contentIndent = null;

    while (this.i < this.lines.length) {
      const line = this.lines[this.i];
      if (line.text === '') {
        lines.push('');
        this.i += 1;
        continue;
      }
      if (line.indent <= parentIndent) break;
      if (contentIndent === null) contentIndent = line.indent;
      lines.push(' '.repeat(Math.max(0, line.indent - contentIndent)) + line.text);
      this.i += 1;
    }

    while (lines.length && lines[lines.length - 1] === '') lines.pop();

    if (!folded) return lines.join('\n');

    let result = '';
    for (const line of lines) {
      if (line === '') {
        result += '\n';
      } else if (result === '' || result.endsWith('\n')) {
        result += line;
      } else {
        result += ` ${line}`;
      }
    }
    return result.trim();
  }
}

export function parseYaml(text) {
  return new Parser(text).parse();
}

export function parseFrontmatter(source) {
  const text = String(source).replace(/^\uFEFF/, '');
  const match = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) return { data: {}, body: text };
  return { data: parseYaml(match[1]), body: text.slice(match[0].length) };
}
