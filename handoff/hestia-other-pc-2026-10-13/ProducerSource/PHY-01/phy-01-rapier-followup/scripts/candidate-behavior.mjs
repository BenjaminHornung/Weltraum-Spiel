import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const original = readFileSync("tests/behavior.test.ts", "utf8"), output = "tests/candidate-behavior.test.ts";
assert.ok(!existsSync(output));
assert.equal(original.split("../snapshot/b/").length - 1, 7);
assert.equal(original.split("p2-${label}.json").length - 1, 1);
const sourceSha256 = createHash("sha256").update(original).digest("hex");
const generated = original.replaceAll("../snapshot/b/", "../snapshot/c/")
  .replaceAll('"rapier-0.21.0"', '"rapier-0.21.0-phy01.migration2"')
  .replaceAll("p2-${label}.json", "p2-candidate-${label}.json");
assert.equal(generated.match(/expect\(/g)?.length, original.match(/expect\(/g)?.length);
writeFileSync(output, "// Generated from unchanged A/B behavior oracles; only B imports, variant labels and artifact prefix differ.\n" + generated, { flag: "wx" });
writeFileSync("results/candidate-behavior-lineage.json", JSON.stringify({ original: "tests/behavior.test.ts", sourceSha256,
  generated: output, generatedSha256: createHash("sha256").update(readFileSync(output)).digest("hex"),
  changes: ["7 B-to-C imports", "actual candidate labels", "unique result prefix"], assertionsAndTolerancesChanged: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, sourceSha256 }));
