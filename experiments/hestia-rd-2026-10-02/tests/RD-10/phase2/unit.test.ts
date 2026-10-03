import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { admitFreshArtifact } from '../phase2-artifacts';

const root = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10/phase2-84aeadb1-20261003/admission-unit';
const image = path.resolve(root, 'nested/probe.png');
const directory = { isSymbolicLink: () => false, isDirectory: () => true };
describe('RD10 phase2 caller-owned artifact admission', () => {
  it('CAP03_PHASE2 fresh nested image leaf is admitted before any mutation', () => {
    const reads: string[] = [];
    expect(admitFreshArtifact(image, root, (file) => { reads.push(file); return file === path.resolve(root) ? directory : undefined; })).toBe(image);
    expect(reads).toContain(image); expect(reads).toContain(path.resolve(root));
    expect(admitFreshArtifact(image.toLowerCase(), root, () => undefined)).toBe(image.toLowerCase());
  });
  it('CAP03_PHASE2 existing leaf, linked/nonfolder ancestor and owner-root escape are rejected', () => {
    expect(() => admitFreshArtifact(image, root, (file) => file === image ? directory : undefined)).toThrow(/already exists/);
    expect(() => admitFreshArtifact(image, root, (file) => file === path.dirname(image)
      ? { isSymbolicLink: () => true, isDirectory: () => true } : undefined)).toThrow(/link/);
    expect(() => admitFreshArtifact(image, root, (file) => file === path.dirname(image)
      ? { isSymbolicLink: () => false, isDirectory: () => false } : undefined)).toThrow(/non-directory/);
    expect(() => admitFreshArtifact(path.resolve(root, '../outside.png'), root)).toThrow(/outside/);
    expect(() => admitFreshArtifact(root, root)).toThrow(/leaf/);
  });
});
