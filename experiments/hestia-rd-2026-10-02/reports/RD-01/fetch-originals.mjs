import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-01';
const timeoutMs = 15_000;
const byteCap = 256 * 1024;
const manifestBytes = readFileSync(new URL('../../docs/coordination/input-package/sources/web_sources.json', import.meta.url));
const sources = JSON.parse(manifestBytes).sources.filter((source) => /^RR-0[1-7]$/.test(source.id));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fetchId = new Date().toISOString().replace(/[:.]/g, '-');
const directory = `${run}/http/${fetchId}`;
mkdirSync(directory, { recursive: true });
const records = [];
for (const source of sources) {
  const record = { id: source.id, requestedUrl: source.url, requestedAt: new Date().toISOString(),
    timeoutMs, byteCap, redirectPolicy: 'MANUAL_NO_FOLLOW', httpStatus: null, contentType: null,
    accessClass: 'UNAVAILABLE', textStatus: 'UNAVAILABLE', mediaStatus: 'NOT_VIEWED', observedIntervals: [],
    author: 'UNKNOWN', license: 'UNKNOWN', publicDeveloperLinks: [],
    developerSourceStatus: 'NOT_DISCOVERABLE_FROM_UNAVAILABLE_POST', body: null, error: null };
  try {
    const response = await fetch(source.url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'text/html' } });
    record.httpStatus = response.status;
    record.contentType = response.headers.get('content-type');
    if (!record.contentType?.toLowerCase().startsWith('text/html')) {
      await response.body?.cancel();
      record.accessClass = 'NON_HTML_NOT_READ';
    } else {
      const reader = response.body.getReader();
      const chunks = [];
      let length = 0;
      let complete = false;
      while (length < byteCap) {
        const { value, done } = await reader.read();
        if (done) {
          complete = true;
          break;
        }
        const chunk = Buffer.from(value).subarray(0, byteCap - length);
        chunks.push(chunk);
        length += chunk.length;
      }
      if (!complete) {
        await reader.cancel();
      }
      const bytes = Buffer.concat(chunks);
      const bodyPath = `${directory}/${source.id}.html`;
      writeFileSync(bodyPath, bytes, { flag: 'wx' });
      const html = bytes.toString('utf8');
      const marker = html.match(/.{0,80}(?:js[_ -]?challenge|javascript[^<]{0,80}(?:required|enable)|enable[^<]{0,80}javascript|captcha|you(?:'|’)?ve been blocked|security challenge|shreddit-challenge).{0,100}/i)?.[0] ?? null;
      record.body = { path: bodyPath, byteLength: bytes.length, sha256: sha256(bytes), complete,
        title: html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null, accessMarker: marker };
      record.accessClass = marker ? 'JS_CHALLENGE' : response.status >= 300 ? 'HTTP_ERROR_OR_REDIRECT' : 'HTML_REVIEW_REQUIRED';
      if (record.accessClass === 'HTML_REVIEW_REQUIRED') {
        record.developerSourceStatus = 'REQUIRES_PUBLIC_TEXT_REVIEW';
      }
    }
  } catch (error) {
    record.accessClass = 'REQUEST_FAILED';
    record.error = { name: error.name, message: error.message, cause: error.cause?.code ?? null };
  }
  record.finishedAt = new Date().toISOString();
  records.push(record);
}
const result = { schemaVersion: 1, taskId: 'RD-01', fetchId, productIntegrated: false,
  sourceManifestSha256: sha256(manifestBytes), records,
  policy: 'Seven original permalinks only. No authentication, retries, redirects, challenge bypass, media requests or downloads. HTTP/body evidence is not playback.' };
writeFileSync(`${directory}/requests.json`, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
writeFileSync(fileURLToPath(new URL('./sources-current.json', import.meta.url)), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify(result, null, 2));
