import { API } from "typescript/unstable/sync";
import * as ts from "typescript/unstable/ast";
import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const api = new API({ cwd: process.cwd() });
let snapshot;
const rows = [];
const nativeDeclaration = declaration => declaration && /node_modules\/(rapier-a|@dimforge\/rapier3d-compat)\//.test(
  declaration.path.replaceAll("\\", "/"));
try {
snapshot = api.updateSnapshot({ openProjects: [resolve("tsconfig.json")] });
const project = snapshot.getProject(resolve("tsconfig.json"));
assert.ok(project);
const { program, checker } = project;
for (const fileName of program.getSourceFileNames()) {
  const path = fileName.replaceAll("\\", "/");
  if (!path.includes("/snapshot/a/src/hestia-prototype/") && !path.startsWith("snapshot/a/src/hestia-prototype/")) { continue; }
  const source = program.getSourceFile(fileName);
  assert.ok(source);
  const visit = node => {
    let native = false, kind;
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      native = nativeDeclaration(checker.getResolvedSignature(node)?.declaration);
      kind = ts.isNewExpression(node) ? "constructor" : "call";
    } else if (ts.isPropertyAccessExpression(node) && node.name.text === "toi") {
      native = checker.getSymbolAtLocation(node.name)?.declarations?.some(nativeDeclaration) === true;
      kind = "hit field";
    }
    if (native) {
      const file = path.slice(path.indexOf("snapshot/a/") + "snapshot/a/".length);
      const line = source.getLineStarts().filter(start => start <= node.getStart()).length;
      const expression = kind === "hit field" ? node.getText(source) : node.expression.getText(source);
      const bPath = "snapshot/b/" + file;
      const bLine = readFileSync(bPath, "utf8").split(/\r?\n/)[line - 1];
      let migration = "unchanged API call";
      if (expression.endsWith(".updateSceneQueries")) { migration = "UNSUPPORTED equivalence: diagnostic propagation only"; }
      else if (expression.endsWith(".castShape")) { migration = "adapted: targetDistance=0 inserted before unchanged maxToi"; }
      else if (kind === "hit field") { migration = /\.time_of_impact/.test(bLine) ? "adapted: shape time_of_impact" : "adapted: ray timeOfImpact"; }
      else if (/\.(castRay|castRayAndGetNormal|createCharacterController)$/.test(expression)) { migration = "unchanged call; typed wrapper caches predicates before borrow"; }
      else if (expression === "R.World") { migration = "0.21 World wrapper delegates real soft-body-aware World constructor"; }
      rows.push({ file: "apps/weltraum-browser/" + file, line, kind, expression, migration });
    }
    node.forEachChild(visit);
  };
  visit(source);
}
} finally { snapshot?.dispose(); api.close(); }
assert.ok(rows.length > 50, "Empty or incomplete callsite discovery");
assert.ok(rows.some(row => row.expression.endsWith(".updateSceneQueries")));
assert.ok(rows.some(row => row.migration.includes("shape time_of_impact")));
assert.ok(rows.some(row => row.migration.includes("ray timeOfImpact")));
const manifest = JSON.parse(readFileSync("source-manifest.json", "utf8"));
const changed = [];
for (const file of manifest.files) {
  const path = file.copiedTo[1], digest = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (digest !== file.sha256) { changed.push({ original: file.path, candidate: path, originalSha256: file.sha256, candidateSha256: digest }); }
}
const result = { baseCommit: manifest.baseCommit, discovery: "TypeScript resolved declarations: actual Rapier calls/constructors and hit fields",
  sourceScope: "snapshot/a/src/hestia-prototype", rows, changedPorts: changed };
writeFileSync("migration-matrix.json", JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
writeFileSync("MIGRATION_MATRIX.md", "# Actual Rapier migration callsites\n\n" +
  "Fixed 17b1 control; declarations resolved by the installed TypeScript compiler.\n" +
  "The table covers actual Hestia Rapier calls/constructors and consumed hit fields.\n" +
  "0.21 shape hits expose time_of_impact, while rays expose timeOfImpact.\n\n" +
  "| Original source | Line | Expression | Candidate action |\n|---|---:|---|---|\n" +
  rows.map(row => `| \`${row.file}\` | ${row.line} | \`${row.expression}\` | ${row.migration} |`).join("\n") +
  "\n\nSave codecs/solver strings stay unchanged; their incompatibility is a separate gate.\n" +
  "Direct structural test package imports are adapted in the candidate snapshot only.\n" +
  "A0 alone owns integration. Additional public 0.21 exports are not product callsites.\n", { flag: "wx" });
console.log(JSON.stringify({ actualCallsites: rows.length, changedSnapshotFiles: changed.length }));
