// Parse/source checks only. Never resolve or import main.ts, Three, WebGPU or any product module.
import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{createRequire}from'node:module';
const q=JSON.parse(readFileSync(new URL('TYPESCRIPT_PARSER.json',import.meta.url),'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(readFileSync(q.path)),q.sha256);assert.equal(sha(readFileSync(q.packagePath)),q.packageSha256);
const ts=createRequire(import.meta.url)(q.path);assert.equal(ts.version,q.version);
const main=readFileSync(new URL('src/main.ts',import.meta.url),'utf8');
function check(source){
 const ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);assert.equal(ast.parseDiagnostics.length,0,'TypeScript parse diagnostics');
 const imports=[],calls=[];function visit(n){if(ts.isImportDeclaration(n)&&n.moduleSpecifier.text==='./photo-operations.mjs')imports.push(n);if(ts.isCallExpression(n)&&n.expression.getText(ast)==='cleanupPhoto')calls.push(n);ts.forEachChild(n,visit)}visit(ast);
 assert.equal(imports.length,1);assert.ok(imports[0].importClause.namedBindings.elements.some(e=>e.name.text==='cleanupPhoto'&&!e.propertyName));
 assert.equal(calls.length,2,'exactly two cleanup call sites');
 const parent=(n,predicate)=>{for(let p=n.parent;p;p=p.parent)if(predicate(p))return p;return null};
 const driver=calls.find(c=>parent(c,n=>ts.isMethodDeclaration(n)&&n.name.getText(ast)==='dispose')),failed=calls.find(c=>parent(c,ts.isCatchClause));
 assert.ok(driver&&failed&&driver!==failed);assert.equal(driver.arguments.length,1);assert.equal(failed.arguments.length,2);assert.equal(failed.arguments[1].getText(ast),'error');
 function actions(call){const a=call.arguments[0];assert.ok(ts.isArrayLiteralExpression(a));assert.equal(a.elements.length,4);for(const e of a.elements){assert.ok(ts.isArrowFunction(e)&&ts.isCallExpression(e.body));assert.equal(e.body.arguments.length,0)}return a.elements.map(e=>e.body.getText(ast))}
 assert.deepEqual(actions(driver),['ownedDevice.destroy()','ownedTracer.dispose()','ownedResources.dispose()','ownedRenderer.dispose()']);
 assert.deepEqual(actions(failed),['tracer?.dispose()','failedResources?.dispose()','renderer?.dispose()','device?.destroy()']);
 const clause=parent(failed,ts.isCatchClause),capture=clause.block.statements.find(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>d.name.getText(ast)==='failedResources'&&d.initializer?.getText(ast)==='resources'));
 const clear=clause.block.statements.find(s=>ts.isExpressionStatement(s)&&ts.isBinaryExpression(s.expression)&&s.expression.left.getText(ast)==='resources'&&s.expression.operatorToken.kind===ts.SyntaxKind.EqualsToken&&s.expression.right.kind===ts.SyntaxKind.NullKeyword);
 assert.ok(capture&&clear&&capture.pos<clear.pos&&clear.pos<failed.pos,'capture own failed resources and clear shared reference before fallible cleanup');
 return {parseDiagnostics:0,cleanupCalls:calls.length};
}
const checked=check(main);
let mutants=0;for(const [from,to]of [['resources=null;cleanupPhoto','cleanupPhoto'],['device?.destroy()],error)','device?.destroy()])'],['()=>ownedDevice.destroy(),()=>ownedTracer.dispose()','()=>ownedTracer.dispose(),()=>ownedDevice.destroy()']]){assert.ok(main.includes(from));const changed=main.replace(from,to);assert.notEqual(changed,main);assert.throws(()=>check(changed));mutants++}
const inputs=JSON.parse(readFileSync(new URL('ORIGINAL_INPUTS.json',import.meta.url),'utf8')),original=readFileSync(inputs.find(x=>x.relative==='src/main.ts').path,'utf8');
const pairs=[
 ["import {awaitReadback,resizePhoto,photoDeadline,cleanupPhoto}","import {awaitReadback,resizePhoto,photoDeadline}"],
 ["dispose(){cleanupPhoto([()=>ownedDevice.destroy(),()=>ownedTracer.dispose(),()=>ownedResources.dispose(),()=>ownedRenderer.dispose()]);}","dispose(){ownedDevice.destroy();try{ownedTracer.dispose();}finally{try{ownedResources.dispose();}finally{ownedRenderer.dispose();}}}"],
 ["}catch(error){const failedResources=resources;resources=null;cleanupPhoto([()=>tracer?.dispose(),()=>failedResources?.dispose(),()=>renderer?.dispose(),()=>device?.destroy()],error);}","}catch(error){try{tracer?.dispose();}finally{resources?.dispose();renderer?.dispose();device?.destroy();}resources=null;throw error;}"]
];
let restored=main;for(const[now,before]of pairs){assert.equal(restored.split(now).length-1,1);restored=restored.replace(now,before)}assert.equal(restored,original,'no unrelated main.ts changes');
console.log(JSON.stringify({typescriptVersion:ts.version,typescriptPath:q.path,typescriptSha256:q.sha256,mainSha256:sha(main),...checked,sourceMutantsRejected:mutants,exactMainEdits:pairs.length,mainModuleEvaluations:0,productImports:0,typecheck:'NOT_RUN_PARSE_ONLY',status:'PASS'}));
