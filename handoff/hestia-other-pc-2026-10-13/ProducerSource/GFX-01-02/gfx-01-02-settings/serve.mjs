import { createServer } from 'node:http';
import { readFileSync, existsSync, realpathSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.GFX_PORT ?? 5192);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid GFX_PORT');
if (!existsSync(resolve(root, 'dist/ui/main.js'))) throw Error('Run build before serving compiled bytes');
const server = createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
    let file;
    if (pathname === '/') file = resolve(root, 'ui/index.html');
    else if (pathname.startsWith('/dist/')) {
      file = resolve(root, '.' + pathname);
      const base = realpathSync(resolve(root, 'dist')) + sep;
      if (!file.startsWith(base)) throw Error('outside dist');
      if (existsSync(file) && statSync(file).isDirectory()) {
        res.writeHead(302, { Location: pathname.replace(/\/$/, '') + '/index.js' });
        res.end(); return;
      }
      if (!existsSync(file) || !statSync(file).isFile()) {
        const moduleFile = file + '.js';
        file = existsSync(moduleFile) ? moduleFile : resolve(file, 'index.js');
      }
      if (!realpathSync(file).startsWith(base)) throw Error('outside dist');
    } else { res.writeHead(404); res.end('Not found'); return; }
    const body = readFileSync(file);
    res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Compiled GFX UI: http://127.0.0.1:${port}`));
const duration = process.env.GFX_SERVE_MS === undefined ? null : Number(process.env.GFX_SERVE_MS);
if (duration !== null) {
  if (!Number.isInteger(duration) || duration < 1000 || duration > 300000) throw Error('Invalid GFX_SERVE_MS');
  setTimeout(() => server.close(), duration).unref();
}
process.on('SIGINT', () => server.close());
