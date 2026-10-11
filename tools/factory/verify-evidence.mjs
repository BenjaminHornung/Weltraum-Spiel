import { lstat, readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

// Artifact admission limits only; no simulation or worker queue budget changes.
const limits = { depth: 12, entries: 4096, files: 4096, fileBytes: 32 * 1024 * 1024, jsonBytes: 8 * 1024 * 1024, totalBytes: 256 * 1024 * 1024 };
const root = process.argv[2];
let entries = 0, files = 0, jsonFiles = 0, totalBytes = 0;
const admitted = new Map(), manifests = [];
const visit = async (file, depth) => {
  if (++entries > limits.entries) throw new Error(`Factory evidence entry budget exceeded: ${file}`);
  if (depth > limits.depth) throw new Error(`Factory evidence depth exceeded: ${file}`);
  const stat = await lstat(file);
  if (stat.isSymbolicLink()) throw new Error(`Factory evidence symlink rejected: ${file}`);
  if (stat.isDirectory()) {
    const names = (await readdir(file)).sort();
    if (entries + names.length > limits.entries) throw new Error(`Factory evidence entry budget exceeded: ${file}`);
    for (const name of names) await visit(path.join(file, name), depth + 1);
    return;
  }
  if (!stat.isFile()) throw new Error(`Factory evidence non-file rejected: ${file}`);
  files++; totalBytes += stat.size;
  if (files > limits.files || stat.size > limits.fileBytes || totalBytes > limits.totalBytes) {
    throw new Error(`Factory evidence byte/file budget exceeded: ${file}`);
  }
  admitted.set(file, { bytes: stat.size });
  if (file.endsWith(".json")) {
    if (stat.size > limits.jsonBytes) throw new Error(`Factory evidence JSON budget exceeded: ${file}`);
    const value = JSON.parse(await readFile(file, "utf8")); jsonFiles++;
    if (path.basename(file) === "manifest.json") manifests.push({ file, value });
  }
};
const relativePath = value => {
  if (typeof value !== "string" || value.length === 0 || value.includes("\\") || value.includes("\0")
    || path.posix.isAbsolute(value) || /^[A-Za-z]:/.test(value)
    || value.split("/").some(part => part === "" || part === "." || part === "..")) {
    throw new Error(`Factory evidence unsafe reference path: ${String(value)}`);
  }
  return value;
};
const receipt = value => {
  if (!value || typeof value !== "object" || !/^[a-f0-9]{64}$/.test(value.sha256)) throw new Error("Factory evidence invalid SHA256 receipt");
  relativePath(value.path);
  if (value.bytes !== undefined && (!Number.isSafeInteger(value.bytes) || value.bytes < 0)) throw new Error("Factory evidence invalid byte receipt");
};
let referencedFiles = 0;
const verifyManifest = async ({ file, value }) => {
  if (!value || typeof value !== "object" || !/^hestia\.fp06\.[a-z0-9-]+\/v1$/.test(value.schema)) {
    throw new Error(`Factory evidence placeholder or unsupported manifest: ${file}`);
  }
  const references = [];
  for (const field of ["artifacts", "evidenceFiles"]) {
    if (value[field] === undefined) continue;
    if (!Array.isArray(value[field])) throw new Error(`Factory evidence invalid ${field}: ${file}`);
    references.push(...value[field]);
  }
  if (references.length === 0) throw new Error(`Factory evidence manifest has no bound artifacts: ${file}`);
  const listed = new Set();
  for (const reference of references) {
    receipt(reference);
    if (listed.has(reference.path)) throw new Error(`Factory evidence duplicate reference: ${reference.path}`);
    listed.add(reference.path);
    // Lookup only previously admitted files: never follow outside paths or symlinks.
    const target = path.join(path.dirname(file), reference.path), actual = admitted.get(target);
    if (!actual) throw new Error(`Factory evidence missing local artifact: ${reference.path}`);
    actual.sha256 ??= createHash("sha256").update(await readFile(target)).digest("hex");
    if (actual.sha256 !== reference.sha256 || (reference.bytes !== undefined && actual.bytes !== reference.bytes)) {
      throw new Error(`Factory evidence digest/byte mismatch: ${reference.path}`);
    }
    referencedFiles++;
  }
  // Historical source receipts describe their recorded commit, not today's HEAD.
  if (value.productFiles !== undefined) {
    if (!Array.isArray(value.productFiles)) throw new Error("Factory evidence invalid historical product receipts");
    value.productFiles.forEach(receipt);
  }
  const localReferences = [...(value.commands ?? []).map(command => command.artifact),
    ...(value.verification ?? []).map(command => command.log), value.review?.artifact].filter(reference => reference !== undefined);
  for (const reference of localReferences) {
    relativePath(reference);
    if (!listed.has(reference)) throw new Error(`Factory evidence unbound command/review artifact: ${reference}`);
  }
};
try {
  if (!root) throw new Error("Usage: node tools/factory/verify-evidence.mjs <factory-evidence-root>");
  await visit(path.resolve(root), 0);
  if (manifests.length === 0) throw new Error("Factory evidence must include an actual bound manifest");
  for (const manifest of manifests) await verifyManifest(manifest);
  console.log(JSON.stringify({ entries, files, jsonFiles, manifests: manifests.length, referencedFiles, totalBytes, limits,
    historicalProductReceipts: "path/hash form only; immutable run artifacts are verified, historical HEAD bytes are not reread" }));
} catch (error) {
  console.error(String(error)); process.exitCode = 1;
}
