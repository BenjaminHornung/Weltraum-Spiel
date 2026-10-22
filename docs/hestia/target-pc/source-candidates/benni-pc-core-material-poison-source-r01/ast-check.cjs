const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const compiler = 'C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-target-pc-2026-10-13/rt08-build-toolchain/node_modules/typescript/lib/typescript.js';
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(compiler)).digest('hex'), '3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675');
const ts = require(compiler);
const root = path.resolve(__dirname, '../..');
const parse = p => ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true);
const source = parse(path.join(root, 'apps/weltraum-browser/src/render/three/backend/threeMaterialFactory.ts'));
const before = parse(path.join(__dirname, 'before/threeMaterialFactory.ts'));
const tests = parse(path.join(root, 'apps/weltraum-browser/tests/unit/renderBackendLifecycle.test.ts'));
const testsBefore = parse(path.join(__dirname, 'before/renderBackendLifecycle.test.ts'));
for (const f of [source, before, tests, testsBefore]) assert.equal(f.parseDiagnostics.length, 0, f.fileName);
const find = (f, pred) => { const nodes = []; const walk = n => { if (pred(n)) nodes.push(n); ts.forEachChild(n, walk); }; walk(f); return nodes; };
const printer = ts.createPrinter();
const print = (n, f) => printer.printNode(ts.EmitHint.Unspecified, n, f);
const factory = f => find(f, n => ts.isClassDeclaration(n) && n.name?.text === 'ThreeMaterialFactory')[0];
const member = (f, name) => factory(f).members.find(n => n.name?.getText(f) === name);
const acquire = member(source, 'acquire'), acquireBefore = member(before, 'acquire');
assert.equal(print(acquire.body.statements[0], source), print(member(before, 'disposeAll').body.statements[0], before));
assert.deepEqual([...acquire.body.statements].slice(1).map(n => print(n, source)), [...acquireBefore.body.statements].map(n => print(n, before)));
assert.deepEqual([...factory(source).members].filter(n => n !== acquire).map(n => print(n, source)), [...factory(before).members].filter(n => n !== acquireBefore).map(n => print(n, before)));
const calls = f => find(f, n => ts.isCallExpression(n) && n.expression.getText(f) === 'it');
const title = 'does not prune an ephemeral registration after Evict disposal failure or a later Remove';
const target = f => calls(f).find(n => n.arguments[0]?.text === title);
const afterCase = target(tests), beforeCase = target(testsBefore);
assert.equal(calls(tests).length, calls(testsBefore).length);
assert.deepEqual(calls(tests).filter(n => n !== afterCase).map(n => print(n, tests)), calls(testsBefore).filter(n => n !== beforeCase).map(n => print(n, testsBefore)));
const statements = [...afterCase.arguments[1].body.statements];
const added = statements.filter(n => /materialAllocations|freshKey/.test(n.getText(tests)));
assert.equal(added.length, 5);
assert.deepEqual(statements.filter(n => !added.includes(n)).map(n => print(n, tests)), [...beforeCase.arguments[1].body.statements].map(n => print(n, testsBefore)));
console.log(JSON.stringify({ status: 'PASS_STATIC_ONLY', compiler: ts.version, parseErrors: 0,
  firstAcquireStatementSameExistingPoisonGuard: true, remainingAcquireUnchanged: true,
  allOtherFactoryMembersUnchanged: true, existingTestCountUnchanged: true, extendedCases: 1,
  addedCaseStatements: 5, productImports: false, methodsExecuted: false, tests: 'NOT_RUN', reproduction: 'NOT_RUN' }));
