import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';
export const blobOid=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
function literal(b){
 const z=deflateSync(b),lines=[];
 for(let offset=0;offset<z.length;offset+=52){const block=z.subarray(offset,offset+52);let line=String.fromCharCode(block.length<=26?64+block.length:70+block.length);
  for(let i=0;i<block.length;i+=4){let value=0;for(let j=0;j<4;j++)value=value*256+(block[i+j]??0);let chunk='';for(let n=0;n<5;n++){chunk=alphabet[value%85]+chunk;value=Math.floor(value/85);}line+=chunk;}
  lines.push(line);
 }return 'literal '+b.length+'\n'+lines.join('\n')+'\n\n';
}
export function newFilePatch(name,b){
 if(!name||name.startsWith('/')||name.includes('\\')||name.includes(':')||name.split('/').some(p=>!p||p==='..'||p==='.')||/[\n\r\0"]/.test(name))throw Error('PATCH_PATH');
 let patch='diff --git a/'+name+' b/'+name+'\nnew file mode 100644\nindex '+'0'.repeat(40)+'..'+blobOid(b)+'\n';
 if(b.length===0)return patch;
 if(b.includes(0)||!Buffer.from(b.toString('utf8')).equals(b))return patch+'GIT binary patch\n'+literal(b)+literal(Buffer.alloc(0));
 const text=b.toString('utf8'),lines=text.split('\n');if(lines.at(-1)==='')lines.pop();
 patch+='--- /dev/null\n+++ b/'+name+'\n@@ -0,0 +1,'+lines.length+' @@\n'+lines.map(l=>'+'+l).join('\n')+'\n';
 if(!text.endsWith('\n'))patch+='\\ No newline at end of file\n';
 return patch;
}
