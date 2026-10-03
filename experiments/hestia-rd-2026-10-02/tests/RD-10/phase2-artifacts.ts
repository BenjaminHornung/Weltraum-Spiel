import { lstatSync } from 'node:fs';
import path from 'node:path';
import { assertIsolation } from '../../scripts/verify-boundary.mjs';

type ReadStat = (file: string) => { isSymbolicLink(): boolean; isDirectory(): boolean } | undefined;
/** Actual caller prewrite boundary; shared isolation guards the root, not a child image leaf. */
export function admitFreshArtifact(file: string, ownerRoot: string,
  readStat: ReadStat = (entry) => lstatSync(entry, { throwIfNoEntry: false })): string {
  const root = path.resolve(ownerRoot); const target = path.resolve(file); const relative = path.relative(root, target);
  if (!relative) { throw new Error('Artifact requires a child leaf'); }
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) { throw new Error('Artifact outside owner root'); }
  assertIsolation({ task: 'RD-10', runRoot: root });
  if (readStat(target)) { throw new Error('Artifact already exists; no overwrite or links'); }
  for (let cursor = path.dirname(target); ; cursor = path.dirname(cursor)) {
    const stat = readStat(cursor);
    if (stat?.isSymbolicLink()) { throw new Error('Artifact parent link forbidden'); }
    if (stat && !stat.isDirectory()) { throw new Error('Artifact parent non-directory forbidden'); }
    if (!path.relative(root, cursor)) { break; }
  }
  return target;
}
