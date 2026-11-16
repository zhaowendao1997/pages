import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, watch } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const project = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 4321;
const host = process.env.HOST || '127.0.0.1';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.avif': 'image/avif',
};

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  } catch {
    response.writeHead(400).end('Bad Request');
    return;
  }

  const relative = normalize(pathname).replace(/^([/\\])+/, '');
  const target = join(root, relative);

  if (!target.startsWith(root.endsWith(sep) ? root : root + sep) && target !== root.slice(0, -1)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  const send = (file, status = 200) => {
    const type = mime[extname(file).toLowerCase()] || 'application/octet-stream';
    response.writeHead(status, {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    createReadStream(file).pipe(response);
  };

  let file = target;
  if (!existsSync(file) || statSync(file).isDirectory()) {
    const index = join(file, 'index.html');
    if (existsSync(index)) {
      file = index;
    } else if (!extname(file) && existsSync(join(root, '404.html'))) {
      send(join(root, '404.html'), 404);
      return;
    } else {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
      return;
    }
  }

  send(file);
});

server.listen(port, host, () => {
  console.log(`文道 · 本地预览  http://${host}:${port}`);
});

if (process.argv.includes('--watch')) {
  let timer = null;
  let building = false;
  let queued = false;

  const build = () => {
    if (building) {
      queued = true;
      return;
    }
    building = true;
    const child = spawn(process.execPath, [join(project, 'build.mjs')], { stdio: 'inherit' });
    child.on('exit', () => {
      building = false;
      if (queued) {
        queued = false;
        build();
      }
    });
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(build, 180);
  };

  for (const dir of ['content', 'assets', 'public', 'lib']) {
    try {
      watch(join(project, dir), { recursive: true }, schedule);
    } catch (error) {
      console.warn(`无法监听 ${dir}：${error.message}`);
    }
  }
  watch(join(project, 'site.config.mjs'), schedule);

  console.log('监听 content / assets / public / lib，改动后自动重新构建。');
}
