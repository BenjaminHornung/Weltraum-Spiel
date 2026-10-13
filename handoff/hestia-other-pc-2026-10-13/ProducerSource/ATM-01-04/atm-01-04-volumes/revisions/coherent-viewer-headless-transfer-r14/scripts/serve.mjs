import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 48741;
const DIST_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const CONTENT_TYPES = new Map([
  ['.bin', 'application/octet-stream'],
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.text', 'text/plain; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wasm', 'application/wasm'],
]);

function safeRelativePath(requestTarget) {
  if (typeof requestTarget !== 'string') throw new Error('invalid request target');
  const rawPath = requestTarget.split(/[?#]/, 1)[0];
  if (!rawPath.startsWith('/') || rawPath.startsWith('//') || rawPath.includes('\\')) {
    throw new Error('invalid request path');
  }

  let decoded = rawPath;
  for (let i = 0; i < 8; i += 1) {
    const next = decodeURIComponent(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  if (decodeURIComponent(decoded) !== decoded || !decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\')) {
    throw new Error('invalid encoded request path');
  }

  const relativePath = decoded.slice(1);
  if (relativePath === '') return 'index.html';
  const parts = relativePath.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || /[:?#\0-\x1f]/.test(part))) {
    throw new Error('invalid path segment');
  }
  if (path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
    throw new Error('absolute paths are not allowed');
  }
  return parts.join(path.sep);
}

function parsePort(value) {
  if (value === undefined) return DEFAULT_PORT;
  if (!/^\d+$/.test(value)) throw new Error('port must be an integer from 1 to 65535');
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('port must be an integer from 1 to 65535');
  }
  return port;
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

if (process.argv[2] === '--self-check') {
  assert.equal(safeRelativePath('/'), 'index.html');
  assert.equal(safeRelativePath('/assets/cloud.bin?version=1'), path.join('assets', 'cloud.bin'));
  assert.equal(safeRelativePath('/index.html'), 'index.html');
  assert.equal(parsePort(undefined), DEFAULT_PORT);
  assert.equal(parsePort('65535'), 65535);
  for (const target of [
    'C:/secret',
    '//server/secret',
    '/C:/secret',
    '/C%3A/secret',
    '/../secret',
    '/%2e%2e/secret',
    '/%252e%252e/secret',
    '/%2f..%2fsecret',
    '/a\\b',
    '/%5c..%5csecret',
    '/a//b',
    '/%00',
  ]) assert.throws(() => safeRelativePath(target));
  for (const value of ['0', '65536', '1.5', 'abc']) assert.throws(() => parsePort(value));
  process.exit(0);
}

if (process.argv.length > 3 || process.argv[2] === '--self-check') {
  console.error('Usage: node scripts/serve.mjs [port]');
  process.exit(2);
}

let port;
try {
  port = parsePort(process.argv[2]);
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let relativePath;
  try {
    relativePath = safeRelativePath(request.url);
  } catch {
    response.writeHead(400).end();
    return;
  }

  const contentType = CONTENT_TYPES.get(path.extname(relativePath).toLowerCase());
  if (!contentType) {
    response.writeHead(415).end();
    return;
  }

  try {
    const root = await realpath(DIST_ROOT);
    const filePath = await realpath(path.join(root, relativePath));
    if (!isWithin(root, filePath)) {
      response.writeHead(404).end();
      return;
    }
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      response.writeHead(404).end();
      return;
    }

    response.writeHead(200, {
      'Content-Length': fileStat.size,
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filePath).on('error', () => response.destroy()).pipe(response);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500).end();
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${DIST_ROOT} at http://127.0.0.1:${port}/`);
});
