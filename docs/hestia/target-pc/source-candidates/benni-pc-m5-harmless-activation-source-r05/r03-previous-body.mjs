// Historical family bodies: exact current R05 -> frozen R04 -> frozen R03 -> frozen R02 reversals.
// Current R04 transport and current R03 guards run separately; no native execution.
import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
const r05=JSON.parse(readFileSync(new URL('R05_EXACT_REVERSALS.json',import.meta.url),'utf8')),r04=JSON.parse(readFileSync(new URL('R04_EXACT_REVERSALS.json',import.meta.url),'utf8')),r03=JSON.parse(readFileSync(new URL('R03_EXACT_REVERSALS.json',import.meta.url),'utf8'));
const sha=s=>createHash('sha256').update(s).digest('hex');
function reverse(rows,name,current,label){const row=rows.find(r=>r.path===name);if(!row)return current;assert.equal(sha(current),row.currentSha256,label+' exact current '+name);assert.equal(current.slice(row.offset,row.offset+row.newText.length),row.newText);const restored=current.slice(0,row.offset)+row.oldText+current.slice(row.offset+row.newText.length);assert.equal(sha(restored),row.originalSha256,label+' exact restored '+name);return restored}
export function previousBody(name,current){return reverse(r03,name,reverse(r04,name,reverse(r05,name,current,'R05'),'R04'),'R03')}
