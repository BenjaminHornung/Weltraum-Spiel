import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { LAB,ROOT,RUN,GIT,START,sha,fresh } from './support.mjs';
const path='reports/RD-00/native-ts-smoke.mts';const repoPath='experiments/hestia-rd-2026-10-02/'+path;
const working=readFileSync(LAB+'/'+path);const blob=execFileSync(GIT,['show',START+':'+repoPath],{cwd:ROOT});
const oid=execFileSync(GIT,['rev-parse',START+':'+repoPath],{cwd:ROOT,encoding:'utf8'}).trim();
const filtered=execFileSync(GIT,['hash-object','--path='+repoPath,repoPath],{cwd:ROOT,encoding:'utf8'}).trim();
const count=(b,text)=>b.toString().split(text).length-1;
fresh(RUN+'/helper-history/support-preflight-v1.mjs',readFileSync(LAB+'/reports/RD-13/phase2-16a5d29a/support.mjs'));
const result={schema:'rd13-own-reader-diagnosis-v1',path,working:{bytes:working.length,sha256:sha(working),crlf:count(working,'\r\n'),lf:count(working,'\n')},
 blob:{bytes:blob.length,sha256:sha(blob),crlf:count(blob,'\r\n'),lf:count(blob,'\n'),oid},gitNativeFilteredOid:filtered,
 rawWorkingBytesNotChanged:true,sourceFreezeRawCheck:'Already passed in retained preflight attempt',diagnosis:filtered===oid?'Existing Git text-filter representation; wrong own blob/raw equality assumption':'UNRESOLVED',productIntegrated:false,nativeExecuted:false};
fresh(RUN+'/diagnose-source.json',result);console.log(JSON.stringify(result));
