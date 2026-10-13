import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const sha = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const manifest = JSON.parse(readFileSync("source-manifest.json", "utf8"));
assert.ok(!existsSync("snapshot/c"));
const historical = [], candidate = [];
for (const row of manifest.files) {
  assert.equal(sha(row.copiedTo[0]), row.sha256, "A must remain original");
  for (const path of row.copiedTo) { historical.push({ path, sha256: sha(path) }); }
  const source = row.copiedTo[1], path = source.replace("snapshot/b/", "snapshot/c/");
  assert.notEqual(path, source);
  mkdirSync(dirname(path), { recursive: true }); copyFileSync(source, path);
  candidate.push({ path, from: source, sha256: sha(path) });
}
writeFileSync("historical-populations.json", JSON.stringify({ files: historical }, null, 2) + "\n", { flag: "wx" });
writeFileSync("candidate-lineage.initial.json", JSON.stringify({ files: candidate }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ preserved: historical.length, candidate: candidate.length }));
