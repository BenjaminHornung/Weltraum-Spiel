import { canonicalJson, sha256 } from '../../contracts/validation';
import selfSource from './source.ts?raw';

export interface SourceBinding { readonly sourceDigest: 'RD40-GALLERY-PHASE1'; readonly sourceBytesDigest: string; readonly lockDigest: string;
  readonly files: readonly { readonly path: string; readonly sha256: string }[]; }
// Compile-time bytes only: no browser filesystem, HEAD-artifact fetch or Git-commit-as-semantic-ID.
const raw = import.meta.glob<string>(['../../contracts/*.ts', '../../runner/*.ts', '../../experiments/three-control/*.ts',
  '../../experiments/three-webgpu/*.ts', '../../registration.ts', './*.ts', './*.css', './index.html',
  '../../../package-lock.json', '../../../reference-cards/index.json', '../../../reference-cards/concepts.json'], { query: '?raw', import: 'default', eager: true });
export async function sourceBinding(): Promise<SourceBinding> {
  // Vite glob excludes its importer; bind this file explicitly as data, without executing a second copy.
  const files = await Promise.all(Object.entries({ ...raw, './source.ts': selfSource }).map(async ([key, bytes]) => ({
    path: key.startsWith('../../../') ? key.slice(9) : key.startsWith('../../') ? `src/${key.slice(6)}` : `src/tools/variant-gallery/${key.slice(2)}`,
    sha256: await sha256(new TextEncoder().encode(bytes)),
  })));
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const lockDigest = files.find((file) => file.path === 'package-lock.json')!.sha256;
  return { sourceDigest: 'RD40-GALLERY-PHASE1', sourceBytesDigest: await sha256(new TextEncoder().encode(canonicalJson(files))), lockDigest, files };
}
