import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,load,save,sha,verifyInputs,binding} from './bindings.mjs';
verifyInputs();const state=load('inputs/administration/STATE.json'),task=state.tasks.find(t=>t.id==='WXG-07'),git='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const proofs=[];
for(const [i,p] of task.boundInputs.entries()){
  const repo=resolve(p.root,'../..'),seal=load(`inputs/${i===0?'wxg':'plt'}/scope-seal.json`);
  const run=args=>execFileSync(git,args,{cwd:repo,maxBuffer:64*1024*1024});
  const baseline=run(['rev-parse','HEAD']).toString().trim(),branch=run(['branch','--show-current']).toString().trim();
  if(baseline!==state.baseCommit||branch!==seal.branch)throw Error('PRODUCER_IDENTITY');
  const status=run(['status','--porcelain=v1','--untracked-files=all','-z']);
  const staged=run(['diff','--cached','--binary','--no-ext-diff']),unstaged=run(['diff','--binary','--no-ext-diff']),tracked=run(['diff',state.baseCommit,'--binary','--no-ext-diff']);
  for(const [field,bytes] of [['stagedDiffDigest',staged],['unstagedDiffDigest',unstaged],['fullTrackedDiffDigest',tracked]])if(seal[field]!==`sha256:${sha(bytes)}`)throw Error('PRODUCER_DIFF:'+field);
  const paths=new Set([...run(['diff',state.baseCommit,'--name-only','-z']).toString().split('\0'),...run(['ls-files','--others','--exclude-standard','-z']).toString().split('\0')].filter(Boolean));
  if(JSON.stringify([...paths].sort())!==JSON.stringify(seal.changedFiles.map(f=>f.path).sort()))throw Error('PRODUCER_DIRTY_MEMBERSHIP');
  for(const f of seal.changedFiles){const b=readFileSync(resolve(repo,f.path));if(f.bytes!==b.length||f.digest!==`sha256:${sha(b)}`)throw Error('PRODUCER_DIRTY_BYTES');}
  const index=run(['ls-files','--stage','-z']);if(seal.indexBinding&&seal.indexBinding.digest!==`sha256:${sha(index)}`)throw Error('PRODUCER_INDEX');
  if(seal.statusDigest&&seal.statusDigest!==`sha256:${sha(status)}`)throw Error('PRODUCER_STATUS');
  proofs.push({id:p.id,root:p.root,baseline,branch,receipt:p.receipt,seal:p.seal,changedFiles:paths.size,scope:'PASS',indexDigest:sha(index),statusDigest:sha(status),stagedDigest:sha(staged),unstagedDigest:sha(unstaged),trackedDigest:sha(tracked),dirtyTreeDigest:seal.dirtyTreeDigest,fixtureLockWasmShader:'EXACT_FROZEN_MEMBERS_VERIFIED_IN_InputBindings'});
}
save('.runtime/producer-verification.json',{status:'PASS',whenUtc:new Date().toISOString(),proofs});console.log('PASS full producer index/staged/unstaged/dirty membership and bytes');
