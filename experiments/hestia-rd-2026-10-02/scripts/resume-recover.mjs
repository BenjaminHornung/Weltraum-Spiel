import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(lab, '../..');
const sourceRepo = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-worktrees/Hestia-RD-RD13';
const sourceLab = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02/experiments/hestia-rd-2026-10-02';
const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const prefix = 'experiments/hestia-rd-2026-10-02/';
const receipt = { sourceCommit: 'b8c5588bf1b78877f3fd76b3768aa404659b4f87', baseCommit: '16a5d29a5cddea372abae139da618aa000a058be', additions: [], restoredLfs: [], missingLfs: [], productIntegrated: false };
if (execFileSync(git, ['rev-parse', 'HEAD'], { cwd: sourceRepo, windowsHide: true }).toString().trim() !== receipt.sourceCommit) throw Error('RD13 source moved');
const additions = execFileSync(git, ['diff', '--name-status', '-z', receipt.baseCommit, receipt.sourceCommit], { cwd: sourceRepo, windowsHide: true }).toString().split('\0').filter(Boolean);
for (let index = 0; index < additions.length; index += 2) {
  const status = additions[index], relative = additions[index + 1];
  if (status !== 'A' || !relative.startsWith(prefix) || !/^\b(reports\/RD-13\/phase2-16a5d29a\/|tests\/RD-13\/phase2-)/.test(relative.slice(prefix.length))) throw Error(`Unreviewed delta: ${relative}`);
  const source = path.join(sourceRepo, relative), target = path.join(repo, relative);
  if (lstatSync(source).isSymbolicLink()) throw Error('Source link forbidden');
  const bytes = readFileSync(source);
  if (existsSync(target) && sha(readFileSync(target)) !== sha(bytes)) throw Error('Target addition differs');
  mkdirSync(path.dirname(target), { recursive: true });
  if (!existsSync(target)) writeFileSync(target, bytes, { flag: 'wx' });
  receipt.additions.push({ path: relative, bytes: bytes.length, sha256: sha(bytes) });
}
function restore(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.vite', '.resume-runs', '.devtoolbox'].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (lstatSync(target).isSymbolicLink()) throw Error('Target link forbidden');
    if (entry.isDirectory()) { restore(target); continue; }
    if (lstatSync(target).size > 1024) continue;
    const pointer = readFileSync(target, 'utf8').match(/^version https:\/\/git-lfs.github.com\/spec\/v1\r?\noid sha256:([0-9a-f]{64})\r?\nsize (\d+)\r?\n?$/);
    if (!pointer) continue;
    const relative = path.relative(lab, target), source = path.join(sourceLab, relative);
    if (!existsSync(source) || lstatSync(source).isSymbolicLink()) { receipt.missingLfs.push({ path: relative, oid: pointer[1] }); continue; }
    const bytes = readFileSync(source);
    if (bytes.length !== Number(pointer[2]) || sha(bytes) !== pointer[1]) { receipt.missingLfs.push({ path: relative, oid: pointer[1] }); continue; }
    cpSync(source, target);
    receipt.restoredLfs.push({ path: relative, bytes: bytes.length, sha256: pointer[1] });
  }
}
restore(lab);
mkdirSync(path.join(lab, '.resume-runs'), { recursive: true });
writeFileSync(path.join(lab, '.resume-runs/recovery-source-receipt.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ additions: receipt.additions.length, restoredLfs: receipt.restoredLfs.length, missingLfs: receipt.missingLfs.length, productIntegrated: false }));
