import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {root,repo,baseline,hash,json,save,bytes,git,verifyConsumer,verifyFiles} from './bindings.mjs';
const m=verifyConsumer(),files=[];
const product=m.productReads,packageRoot=resolve(repo,'../../artifacts/hestia-cloud-orchestration-2026-10-09/Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09');
verifyFiles(repo,product);verifyFiles(packageRoot,m.packageInputs);
if(existsSync(resolve(root,'SourceBindings.json')))throw Error('SOURCE_BINDINGS_EXIST');
for(const f of product){const b=readFileSync(resolve(repo,f.path)),blob=git(['show',baseline+':'+f.path]);if(b.toString().replaceAll('\r\n','\n')!==blob.toString().replaceAll('\r\n','\n'))throw Error('PRODUCT_BASELINE_DRIFT:'+f.path);
  const target='snapshot/read-only-product/'+f.path;mkdirSync(dirname(resolve(root,target)),{recursive:true});writeFileSync(resolve(root,target),b);files.push({...bytes(root,target),original:f.path,sourceCommit:baseline,gitBlobSha256:hash(blob),workingTreeBytes:'exact bytecopy; CRLF vs Git LF separately bound, no changed port'});
}
for(const f of m.packageInputs){const target='snapshot/card-inputs/'+f.path;mkdirSync(dirname(resolve(root,target)),{recursive:true});writeFileSync(resolve(root,target),readFileSync(resolve(packageRoot,f.path)));files.push({...bytes(root,target),original:f.path,source:'original immutable package'});}
save(resolve(root,'SourceBindings.json'),{baseline,files,cel:bytes(root,'vendor/cel/SourceBindings.json'),pltLicensedClosure:m.files.filter(f=>f.path.startsWith('vendor/cel/vendor/plt/')),productPortChanges:[],macroSource:'Synthetic authoring projection; fixed source contains a design but no implemented global atlas. No second geographic RNG seed, no source mutation.',scientificReferences:[
  {title:'North 1975 two-mode diffusive energy-balance family',url:'https://courses.washington.edu/pcc587/readings/north1975.pdf',status:'SEARCH_ABSTRACT_FOUND_DIRECT_FETCH_404; not distributed'},
  {title:'Diffusive EBM equations and parameter units',url:'https://www.atmos.albany.edu/facstaff/brose/classes/ATM623_Spring2015/Notes/Lectures/Lecture14%20--%20Diffusive%20energy%20balance%20model.html',status:'equation inspected; no code/data dependency'},
  {title:'MIT Held/Hou symmetric circulation calculations',url:'https://ocw.mit.edu/courses/12-810-dynamics-of-the-atmosphere-spring-2008/resources/chapter_7/',status:'source listing inspected; width is a limited diagnostic candidate'}]});
console.log(JSON.stringify({status:'PASS',snapshotFiles:files.length,productPortChanges:0}));
