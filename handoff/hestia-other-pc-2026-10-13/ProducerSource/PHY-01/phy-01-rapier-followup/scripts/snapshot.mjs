import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const BASE_COMMIT = "17b1db4201a28e7b607c30707bdc2b75e3484a10";
const GIT_EXE = String.raw`C:\IFI_SourceCode\Utils\opencode-migration\runtime\git\cmd\git.exe`;
const scriptPath = fileURLToPath(import.meta.url);
const spikeRoot = resolve(dirname(scriptPath), "..");
const repoRoot = resolve(spikeRoot, "..", "..");
const appRoot = resolve(repoRoot, "apps", "weltraum-browser");
const inventoryPath = resolve(spikeRoot, "inventory.json");
const snapshotRoot = resolve(spikeRoot, "snapshot");
const variants = ["a", "b"];
const outputManifest = resolve(spikeRoot, "source-manifest.json");

function fail(message) {
  throw new Error(`PHY-01 snapshot aborted: ${message}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function git(args) {
  const result = spawnSync(GIT_EXE, ["-C", repoRoot, ...args], { encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) fail(`git ${args.join(" ")} failed: ${result.stderr || result.error?.message || result.status}`);
  return result.stdout;
}

function repoPath(path) {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function assertScope() {
  if (process.platform !== "win32") fail("the pinned local Windows Git executable is unavailable on this platform");
  if (!existsSync(GIT_EXE)) fail(`approved Git executable is missing: ${GIT_EXE}`);
  const actualRoot = git(["rev-parse", "--show-toplevel"]).trim();
  if (resolve(actualRoot).toLowerCase() !== resolve(repoRoot).toLowerCase()) fail(`unexpected repository root: ${actualRoot}`);
  const head = git(["rev-parse", "HEAD"]).trim();
  if (head !== BASE_COMMIT) fail(`expected HEAD ${BASE_COMMIT}, found ${head}`);

  const status = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const records = status.split("\0").filter(Boolean);
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const code = record.slice(0, 2);
    const path = repoPath(record.slice(3));
    if (code.includes("R") || code.includes("C")) fail(`rename/copy status needs manual review: ${path}`);
    if (!path.startsWith("spikes/phy-01-rapier-followup/") && !path.startsWith(".devtoolbox/specs/changes/phy-01-2026-10-09/")) {
      fail(`write outside the PHY-01 scope is present: ${path}`);
    }
  }
}

function appRelative(path) {
  const value = relative(appRoot, path);
  if (value === "" || value === ".." || value.startsWith(`..${sep}`) || isAbsolute(value)) fail(`path escapes the browser app: ${path}`);
  return value.split(sep).join("/");
}

function resolveReference(importer, specifier, allowAsset = false) {
  const base = resolve(appRoot, importer);
  const target = resolve(dirname(base), specifier);
  const rel = relative(appRoot, target);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) fail(`relative reference escapes the browser app: ${importer} -> ${specifier}`);

  const candidates = [target];
  if (extname(target) === "") candidates.push(`${target}.ts`, `${target}.json`, resolve(target, "index.ts"));
  for (const candidate of candidates) {
    if (!existsSync(candidate) || !statSync(candidate).isFile()) continue;
    const extension = extname(candidate).toLowerCase();
    if (allowAsset || extension === ".ts" || extension === ".json") return appRelative(candidate);
    fail(`relative module is not TypeScript or JSON: ${importer} -> ${specifier}`);
  }
  fail(`relative reference is missing: ${importer} -> ${specifier}`);
}

function moduleSpecifiers(path, text) {
  const found = [];
  const add = (specifier, kind) => found.push({ specifier, kind });
  const staticImport = /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s*)?(['"])([^'"]+)\1/g;
  for (const match of text.matchAll(staticImport)) add(match[2], "import-or-export");
  for (const match of text.matchAll(/\bimport\s*\(([^)]*)\)/g)) {
    if (/^\s*[:{]/.test(text.slice(match.index + match[0].length))) continue;
    const literal = match[1].match(/^\s*(['"])([^'"]+)\1\s*$/);
    if (!literal) fail(`non-literal dynamic import in ${path}`);
    add(literal[2], "dynamic-import");
  }
  for (const match of text.matchAll(/\bnew\s+URL\s*\(([^)]*)\)/g)) {
    const literal = match[1].match(/^\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*$/);
    if (!literal) fail(`unsupported new URL reference in ${path}`);
    add(literal[2], "url");
  }
  return found;
}

function sourceReferences(path, text, externalImports, runtimeInputs, references) {
  for (const { specifier, kind } of moduleSpecifiers(path, text)) {
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      references.push({ path: resolveReference(path, specifier, kind === "url"), kind });
    } else {
      externalImports.push({ from: path, specifier, kind });
    }
  }

  for (const match of text.matchAll(/\breadFile(?:Sync)?\s*\(\s*process\.env\.([A-Za-z_]\w*)/g)) {
    const input = runtimeInputs.find((item) => item.environmentVariable === match[1]);
    if (!input) fail(`unregistered readFile environment input ${match[1]} in ${path}`);
    input.readBy ??= [];
    if (!input.readBy.includes(path)) input.readBy.push(path);
  }
  for (const match of text.matchAll(/\breadFile(?:Sync)?\s*\(\s*(['"])([^'"]+)\1/g)) {
    references.push({ path: resolveReference("index.ts", match[2], true), kind: "readFile" });
  }
}

function assertParserSelfCheck() {
  const probe = [
    'import "./side-effect";',
    'export { value } from "./re-export";',
    'void import("./dynamic");',
    'type Lazy = import("./type-only").Value;',
    'new URL("./worker.ts", import.meta.url);',
    'const store = { async import(value: unknown) { return value; } };'
  ].join("\n");
  const actual = moduleSpecifiers("parser-self-check.ts", probe)
    .map(({ specifier, kind }) => `${kind}:${specifier}`).sort();
  const expected = [
    "dynamic-import:./dynamic",
    "dynamic-import:./type-only",
    "import-or-export:./re-export",
    "import-or-export:./side-effect",
    "url:./worker.ts"
  ].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail("parser self-check missed or misclassified a dependency");
  for (const [source, expectedError] of [
    ['import(moduleName);', "non-literal dynamic import"],
    ['new URL(path, import.meta.url);', "unsupported new URL reference"]
  ]) {
    try {
      moduleSpecifiers("parser-self-check.ts", source);
    } catch (error) {
      if (String(error).includes(expectedError)) continue;
      throw error;
    }
    fail(`parser self-check did not reject ${expectedError}`);
  }
}

function main() {
  assertParserSelfCheck();
  assertScope();
  const realApp = realpathSync(appRoot);
  if (relative(resolve(appRoot), realApp) !== "") fail(`browser app resolves outside the checkout: ${realApp}`);
  if (existsSync(snapshotRoot)) {
    const snapshotRelativeToSpike = relative(realpathSync(spikeRoot), realpathSync(snapshotRoot));
    if (snapshotRelativeToSpike === ".." || snapshotRelativeToSpike.startsWith(`..${sep}`) || isAbsolute(snapshotRelativeToSpike)) {
      fail("snapshot output directory resolves outside the spike");
    }
  }
  if (![...variants.map((name) => resolve(snapshotRoot, name)), outputManifest].every((path) => !existsSync(path))) {
    fail("snapshot/a, snapshot/b, or source-manifest.json already exists; raw artifacts are preserved");
  }

  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  if (inventory.baseCommit !== BASE_COMMIT) fail(`inventory baseCommit must be ${BASE_COMMIT}`);
  if (!Array.isArray(inventory.tests) || !Array.isArray(inventory.additionalTests)) fail("inventory test lists are missing");
  const testDirectory = resolve(appRoot, "tests", "unit");
  const tests = [...inventory.tests, ...inventory.additionalTests];
  if (tests.length === 0) fail("inventory has no test seeds");
  if (new Set(tests).size !== tests.length) fail("inventory contains duplicate test names");
  const seedFiles = tests.map((name) => {
    const path = resolve(testDirectory, `${name}.test.ts`);
    if (!existsSync(path) || !statSync(path).isFile()) fail(`listed test is missing: tests/unit/${name}.test.ts`);
    return appRelative(path);
  });

  const externalImports = [];
  const runtimeInputs = inventory.runtimeInputs.map((item) => ({ ...item }));
  const files = new Map();
  const pending = [...seedFiles];
  while (pending.length) {
    const path = pending.pop();
    if (files.has(path)) continue;
    const sourcePath = resolve(appRoot, path);
    const actualSourcePath = realpathSync(sourcePath);
    const sourceRelativeToApp = relative(realApp, actualSourcePath);
    if (sourceRelativeToApp === ".." || sourceRelativeToApp.startsWith(`..${sep}`) || isAbsolute(sourceRelativeToApp)) {
      fail(`source symlink escapes the browser app: ${path}`);
    }
    const bytes = readFileSync(sourcePath);
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      fail(`source is not UTF-8 text: ${path}`);
    }
    files.set(path, bytes);
    const references = [];
    sourceReferences(path, text, externalImports, runtimeInputs, references);
    for (const reference of references) if (!files.has(reference.path)) pending.push(reference.path);
  }

  const packageFiles = ["package.json", "package-lock.json"].map((name) => {
    const path = resolve(appRoot, name);
    if (!existsSync(path) || !statSync(path).isFile()) fail(`app dependency binding is missing: ${name}`);
    return { path: `apps/weltraum-browser/${name}`, sha256: sha256(readFileSync(path)) };
  });
  const fileEntries = [...files.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([path, bytes]) => ({
    path: `apps/weltraum-browser/${path}`,
    copiedTo: variants.map((variant) => `snapshot/${variant}/${path}`),
    role: seedFiles.includes(path) ? "test" : path.endsWith(".json") ? "fixture" : "source",
    bytes: bytes.length,
    sha256: sha256(bytes)
  }));
  const bytesPerVariant = fileEntries.reduce((sum, file) => sum + file.bytes, 0);

  for (const variant of variants) {
    const variantRoot = resolve(snapshotRoot, variant);
    mkdirSync(variantRoot, { recursive: true });
    for (const [path, bytes] of files) {
      const destination = resolve(variantRoot, path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, bytes, { flag: "wx" });
      if (sha256(readFileSync(destination)) !== sha256(bytes)) fail(`copied bytes differ: ${variant}/${path}`);
    }
  }

  const manifest = {
    schemaVersion: 1,
    baseCommit: BASE_COMMIT,
    sourceRoot: "apps/weltraum-browser",
    packageBinding: packageFiles,
    tests: tests.map((name) => `tests/unit/${name}.test.ts`),
    variants,
    seedTestBytesIdentical: true,
    files: fileEntries,
    unresolvedExternalImports: [...new Map(externalImports.map((item) => [`${item.from}\0${item.specifier}\0${item.kind}`, item])).values()]
      .sort((left, right) => `${left.from}\0${left.specifier}`.localeCompare(`${right.from}\0${right.specifier}`)),
    runnerSuppliedFileInputs: runtimeInputs,
    uniqueSourceBytes: bytesPerVariant,
    totalCopiedBytes: bytesPerVariant * variants.length
  };
  writeFileSync(outputManifest, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`Snapshot complete: ${fileEntries.length} files, ${bytesPerVariant} bytes per variant, ${manifest.totalCopiedBytes} total copied bytes.\n`);
}

main();
