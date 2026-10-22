const fs = require('node:fs');
const path = require('node:path');
const ts = require('C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-target-pc-2026-10-13/rt08-build-toolchain/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '../..');
const configPath = path.join(__dirname, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, __dirname);
if (config.error || parsed.errors.length || parsed.options.noEmit !== true || parsed.options.skipLibCheck !== false) throw Error('Type context invalid');
const old = new Map([
  [path.join(root, 'apps/weltraum-browser/src/hestia-prototype/player/locomotion.ts').toLowerCase(), fs.readFileSync(path.join(__dirname, 'before/locomotion.ts'), 'utf8')],
  [path.join(root, 'apps/weltraum-browser/tests/unit/hvp-locomotion.test.ts').toLowerCase(), fs.readFileSync(path.join(__dirname, 'before/hvp-locomotion.test.ts'), 'utf8')]
]);
function check(before) {
  const host = ts.createCompilerHost(parsed.options);
  const read = host.readFile;
  host.readFile = p => before && old.has(path.resolve(p).toLowerCase()) ? old.get(path.resolve(p).toLowerCase()) : read(p);
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);
  return ts.getPreEmitDiagnostics(program).map(d => ({ code: d.code, file: d.file ? path.relative(root, d.file.fileName).replaceAll('\\', '/') : null,
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n') })).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
const before = check(true), after = check(false);
const identical = JSON.stringify(before) === JSON.stringify(after);
console.log(JSON.stringify({ status: 'HOLD_EXTERNAL_TYPE_CONTEXT', noEmit: true, skipLibCheck: false,
  productOrTestModulesImported: false, compilerApiOnly: true, baselineDiagnostics: before, finalDiagnostics: after, identicalDiagnosticMultiset: identical,
  changedFilesDiagnostics: after.filter(d => d.file?.endsWith('/player/locomotion.ts') || d.file?.endsWith('/hvp-locomotion.test.ts')) }));
if (!identical) process.exitCode = 1;
