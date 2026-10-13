import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {root,save,bytes} from './bindings.mjs';
import {integrate,composeWater} from '../.runtime/optics.mjs';
const out=root+'/../../.devtoolbox/specs/changes/atm-01-04-2026-10-09/tests/images';
mkdirSync(out,{recursive:true});
const width=48,height=32;
// Independent closed-form layer oracle: no production integrate or composer call.
const closed=(sigma,length,color)=>({T:Math.exp(-sigma*length),L:color.map(v=>v*(1-Math.exp(-sigma*length)))});
const crc=b=>{let c=0xffffffff;for(const byte of b){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
function png(pixels){const chunk=(name,data)=>{const n=Buffer.from(name),size=Buffer.alloc(4),check=Buffer.alloc(4);size.writeUInt32BE(data.length);check.writeUInt32BE(crc(Buffer.concat([n,data])));return Buffer.concat([size,n,data,check]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 const rows=Buffer.alloc(height*(width*3+1));for(let y=0;y<height;y++)Buffer.from(pixels.slice(y*width*3,(y+1)*width*3)).copy(rows,y*(width*3+1)+1);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
const display=v=>Math.round(Math.max(0,Math.min(1,v))*255);
const renders={reference:[],candidate:[],'wrong-water':[],'missing-density':[],'duplicate-fog':[],'opaque-water':[]};
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const sigma=0.02+0.12*x/(width-1),frontLength=0.2+4*y/(height-1),backLength=6-frontLength;
 const frontColor=[0.3,0.4,0.45],backColor=[0.1,0.25,0.3],background=[0.8,0.55,0.3],water=[0.04,0.25,0.4],alpha=0.56;
 const f=closed(sigma,frontLength,frontColor),b=closed(sigma,backLength,backColor);
 const reference=background.map((v,i)=>f.L[i]+f.T*(alpha*water[i]+(1-alpha)*(b.L[i]+b.T*v)));
 const candidate=composeWater(integrate(()=>sigma,frontLength,32,frontColor),integrate(()=>sigma,backLength,32,backColor),background,water,alpha);
 const wrong=composeWater(integrate(()=>sigma,backLength,32,backColor),integrate(()=>sigma,frontLength,32,frontColor),background,water,alpha);
 const missing=water.map((v,i)=>alpha*v+(1-alpha)*background[i]);
 const duplicate=candidate.map((v,i)=>f.L[i]+f.T*v),opaque=composeWater(f,b,background,water,1);
 for(const [key,color] of Object.entries({reference,candidate,'wrong-water':wrong,'missing-density':missing,'duplicate-fog':duplicate,'opaque-water':opaque}))renders[key].push(...color.map(display));
}
const results=[];
for(const [name,raster] of Object.entries(renders)){
 writeFileSync(out+'/'+name+'.png',png(raster));
 let changed=0;for(let i=0;i<raster.length;i+=3)if([0,1,2].some(c=>Math.abs(raster[i+c]-renders.reference[i+c])>1))changed++;
 const fraction=changed/(width*height),pass=fraction<=0.002;
 if(name==='candidate')assert.equal(pass,true);else if(name!=='reference')assert.equal(pass,false,name);
 results.push({name,changedPixelFraction:fraction,threshold:0.002,result:pass?'PASS':'FAIL_EXPECTED_NEGATIVE'});
}
save('../../.devtoolbox/specs/changes/atm-01-04-2026-10-09/tests/image-oracle.json',{status:'PASS',imageKind:'CPU_SYNTHETIC_ARITHMETIC_NOT_GPU_RASTER',width,height,results,hardwareAcceptance:false});
console.log(JSON.stringify({status:'PASS',images:results.length,negativeVariants:4,threshold:0.002}));
