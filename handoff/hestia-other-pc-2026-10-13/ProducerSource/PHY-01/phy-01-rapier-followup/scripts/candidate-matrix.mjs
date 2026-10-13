import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const original = readFileSync("migration-matrix.json"), b = JSON.parse(original);
assert.equal(b.rows.length, 295);
const rows = b.rows.map(row => ({...row,
  migration: row.expression.endsWith(".updateSceneQueries") ? "C: explicit transient current-AABB native BVH; no step; clears at ordinary step" :
    row.expression === "R.World" ? "C: bound migration2 World, lab gyrofalse profile, real native owner" :
    row.migration.includes("caches predicates") ? "C: evaluate caller predicates before borrow; capture actual live handle membership" : row.migration }));
const ports = JSON.parse(readFileSync("migration-patches.json", "utf8"));
const value = {baseCommit:b.baseCommit, originalMatrixSha256:createHash("sha256").update(original).digest("hex"),
  discovery:"Original295 TypeScript-resolved actual17b1 callsites, mapped to verified C actions; original line numbers retained",
  sourceProfile:"rapier-0.21.0-phy01.migration2",rows,additionalSourceChanges:ports.productChanges,
  sourcePatches:{rapier:ports.rapierChanges,parry:ports.parryChanges},
  save:"C world/game checkpoint validator and live snapshot use exact fork/profile; foreign rejected before restore; A0 productcutover gate"};
writeFileSync("migration-matrix-c.json",JSON.stringify(value,null,2)+"\n",{flag:"wx"});
writeFileSync("MIGRATION_MATRIX_C.md","# Actual17b1 callsites mapped to migration2\n\nOriginal295 resolved callsites; lines remain original17b1 locations.\nC changes are isolated and proposed to A0, not integrated product claims.\n\n| Source | Line | Expression | C action |\n|---|---:|---|---|\n"+
  rows.map(r=>`| \`${r.file}\` | ${r.line} | \`${r.expression}\` | ${r.migration} |`).join("\n")+
  "\n\nAdditional profile/save/gyro and native changes are listed with exact before/after hashes in migration-patches.json and product-proposal.diff.\nA0 owns product profile and Save cutover; no history/assertion removal.\n",{flag:"wx"});
console.log(JSON.stringify({mappedCallsites:rows.length,changedSnapshotFiles:ports.productChanges.length}));
