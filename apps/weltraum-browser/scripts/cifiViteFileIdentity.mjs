import { realpathSync, statSync } from "node:fs";
import path from "node:path";

const normalize = value => value.replaceAll("\\", "/");
const isUrlOrVirtual = value => value.startsWith("\0") || /^[a-z][a-z\d+.-]*:/i.test(value) && !/^[a-z]:[\\/]/i.test(value);
const splitId = value => {
  const index = value.search(/[?#]/);
  return index < 0 ? [value, ""] : [value.slice(0, index), value.slice(index)];
};

export function physicalFileIdentity(root, id) {
  if (isUrlOrVirtual(id)) return id;
  const [file, suffix] = splitId(id);
  if (!path.isAbsolute(file)) return id;
  const physicalRoot = normalize(realpathSync.native(root)).replace(/\/$/, "");
  const inside = value => value.toLowerCase().startsWith(physicalRoot.toLowerCase() + "/");
  if (file.startsWith("\\\\") || !inside(normalize(file))) throw new Error("Build file outside owned local root");
  const physical = normalize(realpathSync.native(file));
  if (physical.startsWith("//") || !inside(physical) || !statSync(physical).isFile()) throw new Error("Build target is not an owned local regular file");
  return physical + suffix;
}

export function requirePhysicalLiteralTarget(root, target) {
  if (!path.isAbsolute(target) || isUrlOrVirtual(target)) throw new Error("Build URL target must be an absolute local file");
  if (physicalFileIdentity(root, target) !== normalize(target)) throw new Error("Build URL target must already have its physical file identity");
}

export function cifiViteFileIdentity(root) {
  return {
    name: "cifi-owned-physical-file-identity",
    apply: "build",
    enforce: "pre",
    async resolveId(source, importer, options) {
      const canonicalImporter = importer ? physicalFileIdentity(root, importer) : importer;
      const resolved = await this.resolve(source, canonicalImporter, { ...options, skipSelf: true });
      if (!resolved || resolved.external) return resolved;
      return { ...resolved, id: physicalFileIdentity(root, resolved.id) };
    }
  };
}
