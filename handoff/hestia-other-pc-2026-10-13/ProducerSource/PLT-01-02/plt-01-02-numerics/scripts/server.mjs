import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export async function startProbeServer({ mode = 'none', onReport = () => {} } = {}) {
  if (!['none', 'require-corp', 'credentialless'].includes(mode)) throw new Error('INVALID_ISOLATION_MODE');
  const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
  const reportNonce = randomUUID();
  const assets = createServer((req, res) => {
    if (new URL(req.url, 'http://localhost').searchParams.get('corp') === 'true') res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', 'text/plain'); res.end('PLT synthetic cross-origin asset');
  });
  await new Promise(resolve => assets.listen(0, '127.0.0.1', resolve));
  const assetOrigin = 'http://127.0.0.1:' + assets.address().port;
  const server = createServer(async (req, res) => {
    if (mode !== 'none') { res.setHeader('Cross-Origin-Opener-Policy', 'same-origin'); res.setHeader('Cross-Origin-Embedder-Policy', mode); }
    res.setHeader('Cache-Control', 'no-store');
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/headers') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ mode, coop: mode === 'none' ? null : 'same-origin', coep: mode === 'none' ? null : mode, assetOrigin, reportNonce })); return;
      }
      if (url.pathname === '/report' && req.method === 'POST') {
        const origin = 'http://127.0.0.1:' + server.address().port;
        if (req.headers['x-plt-run'] !== reportNonce || req.headers.origin !== origin) { res.writeHead(403).end('Report binding rejected'); return; }
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 100000) throw new Error('REPORT_TOO_LARGE'); }
        onReport(JSON.parse(body)); res.end('received'); return;
      }
      if (req.method !== 'GET') { res.writeHead(405).end(); return; }
      const decoded = decodeURIComponent(url.pathname);
      if (decoded.includes('\\') || decoded.includes('\0')) throw new Error('INVALID_PATH');
      const path = resolve(root, '.' + (decoded === '/' ? '/web/index.html' : decoded));
      if (!path.startsWith(root + sep) && path !== resolve(root, 'web/index.html')) throw new Error('OUTSIDE_DIST');
      if (!(await stat(path)).isFile()) throw new Error('NOT_A_FILE');
      res.setHeader('Content-Type', ({ '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.wasm': 'application/wasm' })[extname(path)] || 'text/plain');
      res.end(await readFile(path));
    } catch { res.writeHead(404).end('Unavailable'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: 'http://127.0.0.1:' + server.address().port,
    close: async () => { server.closeAllConnections(); assets.closeAllConnections(); await Promise.all([new Promise(r => server.close(r)), new Promise(r => assets.close(r))]); } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startProbeServer({ mode: process.argv[2] || 'none', onReport: report => console.log(JSON.stringify(report)) });
  console.log(server.url);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
}
