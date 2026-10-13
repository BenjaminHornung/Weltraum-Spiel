import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, lstatSync} from "node:fs";
import {resolve, relative, join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
assert.equal(resolve(process.cwd()), root);
assert.equal(process.versions.node.split(".")[0], "22");
const sha = p => createHash("sha256").update(readFileSync(p)).digest("hex");
const input = join(root, "inputs/r03/candidate/source/bindings/typescript/src.ts");
const output = join(root, "prepared/src");
assert.ok(!existsSync(output), "Create a new revision; never overwrite prepared sources");
function put(path, text) {
    const rel = relative(root, path);
    assert.ok(rel !== ".." && !rel.startsWith("../") && !rel.startsWith("..\\"));
    mkdirSync(dirname(path), {recursive: true});
    writeFileSync(path, text, {flag: "wx"});
}
function dim3(source) {
    const stack = [true]; let result = "";
    for (const line of source.split(/\r?\n/)) {
        const directive = /^\s*\/\/\s*#(if|else|endif)(?:\s+(DIM[23]))?,?\s*$/.exec(line);
        if (directive) {
            if (directive[1] === "if") { assert.ok(directive[2]); stack.push(stack.at(-1) && directive[2] === "DIM3"); }
            else if (directive[1] === "else") { assert.ok(stack.length > 1); stack[stack.length - 1] = stack.at(-2) && !stack.at(-1); }
            else { assert.ok(stack.length > 1); stack.pop(); }
        } else {
            assert.ok(!/^\s*\/\/\s*#(if|else|endif)/.test(line), "Unknown source directive");
            if (stack.at(-1)) result += line + "\n";
        }
    }
    assert.equal(stack.length, 1);
    return result;
}
assert.equal(dim3("// #if DIM2\ntwo\n// #endif\n// #if DIM3\nthree\n// #endif"), "three\n");
assert.throws(() => dim3("// #endif"));
assert.equal(dim3("// #if DIM3\nthree\n// #endif,"), "three\n");
assert.equal(dim3("// // #if DIM3\n// commented"), "// // #if DIM3\n// commented\n");
assert.equal(dim3("// #if DIM2\n// #if DIM3\nwrong\n// #else\nwrong2\n// #endif\n// #else\nright\n// #endif"), "right\n");
assert.throws(() => dim3("// #if DIM4\nwrong"));
function walk(dir) {
    return readdirSync(dir, {withFileTypes: true}).flatMap(e => {
        const p = join(dir, e.name);
        assert.ok(!lstatSync(p).isSymbolicLink());
        return e.isDirectory() ? walk(p) : [p];
    });
}
const files = walk(input).sort();
assert.equal(files.length, 43);
const inputs = files.map(p => ({path: relative(root, p).replaceAll("\\", "/"), sha256: sha(p)}));
for (const file of files) {
    assert.ok(file.endsWith(".ts"));
    put(join(output, relative(input, file)), dim3(readFileSync(file, "utf8")));
}
// This is the mature raw import path; the generated file remains absent until the real tool is authorized.
assert.match(readFileSync(join(output, "raw.ts"), "utf8"), /rapier3d\/pkg\/rapier_wasm3d/);
writeFileSync(join(output, "raw.ts"), 'export * from "./rapier_wasm3d.js";\n');
const imports = [];
for (const file of walk(output)) {
    const text = readFileSync(file, "utf8");
    assert.ok(!/^\s*\/\/\s*#(?:if|else|endif)/m.test(text));
    const names = [...text.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)].map(m => m[1]);
    for (const name of names) {
        assert.ok(name.startsWith("."), "Unexpected external source import: " + name);
        const target = resolve(dirname(file), name);
        const candidates = [target, target + ".ts", join(target, "index.ts")];
        const pendingRaw = name === "./rapier_wasm3d.js" && file === join(output, "raw.ts");
        assert.ok(pendingRaw || candidates.some(existsSync), "Missing actual import: " + name + " in " + file);
        imports.push({file: relative(output, file).replaceAll("\\", "/"), specifier: name, pendingGeneratedRaw: pendingRaw});
    }
}
put(join(root, "prepared/init-compat.template.ts.txt"),
    'import {initSync} from "./rapier_wasm3d.js";\nimport {wasmBase64} from "./wasmBytes";\n'
    + 'export async function init(): Promise<void> { initSync({module: Uint8Array.from(atob(wasmBase64), c => c.charCodeAt(0))}); }\n');
put(join(root, "prepared/LICENSE"), readFileSync(join(root, "inputs/r03/candidate/source/LICENSE")));
const config = {
    compilerOptions: {
        target: "ES2022", module: "ESNext", moduleResolution: "bundler",
        lib: ["ES2022", "DOM", "ESNext.Disposable"], types: [],
        strict: false, skipLibCheck: false, declaration: true, noEmitOnError: true,
        incremental: false, composite: false,
        rootDirs: ["src", "../type-inputs/historical-migration2"],
        rootDir: "..", outDir: "../outputs/unlinked-api-build",
        pretty: false
    },
    files: ["src/rapier.ts", "../tests/api-contracts.ts"]
};
put(join(root, "prepared/tsconfig.json"), JSON.stringify(config, null, 2) + "\n");
const outputs = walk(output).map(p => ({path: relative(root, p).replaceAll("\\", "/"), sha256: sha(p)}));
const manifest = {
    schema: "hestia.phy01.r04.source-preparation.v1",
    sourceDigest: "f6f31c7d6fe0f7a8d6820664d291d62514b23de0893b36d82e3dbee283369ab3",
    sourceFiles: files.length, selfChecks: 6, inputs, outputs, imports,
    stage: "SOURCE_ONLY_WITH_HISTORICAL_RAW_TYPE_REFERENCE",
    pendingGenerated: ["rapier_wasm3d.js", "rapier_wasm3d.d.ts", "rapier_wasm3d_bg.wasm", "wasmBytes.ts", "compat-init"],
    rawWasmSha256: "9f6a79d440b1d4f102624752109fade394f4460bea8ed7992ea52be3b38efc37",
    oldRawDeclarationSha256: "44c5b5386eb391454830d58c16fba5a7cd0166b4bf351013b9e637a19f2ae29d",
    runnablePackage: false, generatedGlueFabricated: false, candidateModuleExecuted: false
};
put(join(root, "prepared/source-preparation.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({sourceFiles: files.length, imports: imports.length, selfChecks: 6, stage: manifest.stage}));
