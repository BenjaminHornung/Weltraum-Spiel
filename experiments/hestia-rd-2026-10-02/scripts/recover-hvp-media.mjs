import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const lab=fileURLToPath(new URL('../',import.meta.url)),repo=path.resolve(lab,'../..');
const git='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const product='b3c6523a94cd050f5a9a22dc27f4777fcc03363e',tree='cdf8a92b17eecd764bac4588054167bd566485f1';
const cache=realpathSync('C:/IFI_SourceCode/Temp/WeltraumSpiel/.git/lfs/objects');
const output=path.join(lab,'reports/RD-01/resume-2026-10-05/media');
if(existsSync(output))throw Error('Media retrieval is immutable; earlier receipt may not be overwritten');
const sha=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const conceptsPath=path.join(lab,'reference-cards/concepts.json'),conceptsBytes=readFileSync(conceptsPath),concepts=JSON.parse(conceptsBytes);
if(execFileSync(git,['rev-parse',product+'^{tree}'],{cwd:repo,encoding:'utf8'}).trim()!==tree)throw Error('Product-read tree mismatch');
const rows=[];
for(const asset of concepts.assets.filter((row)=>row.lfsPayloadOidSha256)){
  const blob=execFileSync(git,['rev-parse',product+':'+asset.path],{cwd:repo,encoding:'utf8'}).trim();
  if(blob!==asset.blob)throw Error('Pinned media blob mismatch');
  const pointer=execFileSync(git,['cat-file','blob',blob],{cwd:repo});
  if(pointer.length!==asset.byteLength||sha(pointer)!==asset.sha256||!pointer.toString().includes('oid sha256:'+asset.lfsPayloadOidSha256)||!pointer.toString().includes('size '+asset.lfsPayloadExpectedBytes))throw Error('Pinned pointer binding mismatch');
  const oid=asset.lfsPayloadOidSha256,source=path.join(cache,oid.slice(0,2),oid.slice(2,4),oid);
  if(lstatSync(source).isSymbolicLink()||!realpathSync(source).toLowerCase().startsWith(cache.toLowerCase()+path.sep))throw Error('Media cache escape/link');
  const bytes=readFileSync(source);
  if(bytes.length!==asset.lfsPayloadExpectedBytes||sha(bytes)!==oid||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Decoded payload byte/OID/PNG signature mismatch');
  rows.push({id:asset.id,productRead:product,productTree:tree,originalPath:asset.path,blob,pointerSha256:asset.sha256,pointerBytes:asset.byteLength,
    method:'exact-local-git-lfs-cache-retrieval',sourcePath:source,payloadSha256:oid,payloadBytes:bytes.length,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),
    outputPath:path.relative(lab,path.join(output,path.basename(asset.path))).split(path.sep).join('/'),license:'UNKNOWN',productAdoption:false,bytes});
}
if(rows.length!==5)throw Error('Expected all five specific media entries');
mkdirSync(output,{recursive:true});
for(const row of rows)writeFileSync(path.join(lab,row.outputPath),row.bytes,{flag:'wx'});
const receipt={schema:'hestia-rd-media-retrieval-v1',checkedAt:new Date().toISOString(),conceptsInputSha256:sha(conceptsBytes),productRead:product,productTree:tree,
  sourceCacheUnchanged:true,networkRetrieval:false,wholeImageDecode:'PENDING_FRESH_DECODE',productIntegrated:false,rows:rows.map(({bytes,...row})=>row)};
writeFileSync(path.join(output,'retrieval-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({retrieved:rows.length,output,productRead:product,originalCatalogUnchanged:sha(readFileSync(conceptsPath))===sha(conceptsBytes)}));
