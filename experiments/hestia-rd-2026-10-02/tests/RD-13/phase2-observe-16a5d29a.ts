import { test, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root='C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/phase2-16a5d29a-20261004-a';
export const source='16a5d29a5cddea372abae139da618aa000a058be';
export const digest=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
export function record(path:string,value:unknown) {mkdirSync(root+'/'+path.slice(0,path.lastIndexOf('/')),{recursive:true});writeFileSync(root+'/'+path,JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
function id(info:TestInfo) {return `${info.testId.replace(/[^a-zA-Z0-9-]/g,'-')}-${info.retry}`;}
export async function state(page:Page) {return page.evaluate(()=>{
 const canvas=document.querySelector<HTMLCanvasElement>('#viewport');const text=document.querySelector('#facts')?.textContent??'';
 let projected:unknown;try {projected=text?JSON.parse(text):null;}catch {projected={unparsed:text};}
 const selections=Object.fromEntries(['fixture','variant','camera','tick','resolution','dpr'].map((name)=>[name,(document.querySelector('#'+name) as HTMLInputElement|null)?.value??null]));
 return {url:location.href,bridgePresent:Object.hasOwn(window,'TestBridge'),status:document.querySelector('#status')?.textContent,projected,selections,
  canvas:canvas?{hidden:canvas.hidden,width:canvas.width,height:canvas.height,box:canvas.getBoundingClientRect().toJSON(),devicePixelRatio}:null};
 });}
export async function settle(page:Page) {await page.waitForFunction(()=>{
 const s=document.querySelector('#status')?.textContent??'';return /Host render submitted|FAIL \/ hidden|Disposed;/.test(s)&&![...document.querySelectorAll<HTMLInputElement>('button,select,input')].some((c)=>c.disabled);
 },undefined,{timeout:20000});return state(page);}
export async function capture(page:Page,name:string) {
 await page.locator('#status').scrollIntoViewIfNeeded();const before=await state(page);const visible=await page.locator('#viewport').isVisible();
 const ui=await page.screenshot({path:root+'/captures/'+name+'-ui.png',fullPage:true,scale:'device'});
 let pixels:Buffer|undefined;let box:unknown=null;if(visible){await page.locator('#viewport').scrollIntoViewIfNeeded();box=await page.locator('#viewport').boundingBox();pixels=await page.locator('#viewport').screenshot({path:root+'/captures/'+name+'-canvas.png',scale:'device'});}
 const after=await state(page);const png=(b:Buffer)=>({bytes:b.length,sha256:digest(b),width:b.readUInt32BE(16),height:b.readUInt32BE(20)});
 const staticPart=(s:any)=>JSON.stringify({selections:s.selections,facts:s.projected?.facts&&{fixtureDigest:s.projected.facts.fixtureDigest,sourceRevision:s.projected.facts.sourceRevision},
  source:s.projected?.private?.source,frame:s.projected?.private?.host?.frame,rendered:s.projected?.private?.host?.rendered,hidden:s.canvas?.hidden,width:s.canvas?.width,height:s.canvas?.height});
 record('captures/'+name+'.json',{schema:'rd13-native-compositor-capture-v1',source,productIntegrated:false,name,before,after,
  stableSourceFrame:staticPart(before)===staticPart(after),fractionalElementBox:box,ui:{path:name+'-ui.png',...png(ui)},canvas:pixels?{path:name+'-canvas.png',...png(pixels)}:null,
  imageAuthority:'Playwright Chromium compositor only; NOT native hit-buffer identity',nativeGpuMs:'UNKNOWN',nativeVram:'UNKNOWN'});
 return {before,after,visible};
}
export function observations() {
 const evidence=new Map<string,{evaluations:unknown[];network:unknown[];console:unknown[];errors:string[];pending:Promise<unknown>[]}>();
 test.beforeEach(async({page,context},info)=>{
  const own={evaluations:[] as unknown[],network:[] as unknown[],console:[] as unknown[],errors:[] as string[],pending:[] as Promise<unknown>[]};evidence.set(id(info),own);
  await context.route('**/*',async(route)=>{const url=route.request().url();if(url.startsWith('http://127.0.0.1:5280/')){await route.continue();}else{own.errors.push('BLOCKED_OFFSITE '+url);await route.abort();}});
  page.on('console',(m)=>own.console.push({type:m.type(),text:m.text()}));page.on('pageerror',(e)=>own.errors.push(String(e)));
  page.on('requestfailed',(r)=>own.network.push({url:r.url(),failure:r.failure()}));
  page.on('response',(r)=>{own.pending.push((async()=>{try {const b=await r.body();own.network.push({url:r.url(),status:r.status(),bytes:b.length,sha256:digest(b)});}catch(e){own.network.push({url:r.url(),status:r.status(),bodyError:String(e)});}})());});
  const evaluate=page.evaluate.bind(page);(page as any).evaluate=async(...args:any[])=>{const fn=String(args[0]);try {const value=await (evaluate as any)(...args);own.evaluations.push({fn,fnSha256:digest(fn),value});return value;}catch(e){own.evaluations.push({fn,fnSha256:digest(fn),error:String(e)});throw e;}};
  await context.addInitScript(()=>{
   const data:any={schema:'rd13-read-only-native-observer-v1',contexts:[],shaders:[],queries:[],readbacks:[],created:{},deleted:{},canvasEvents:[],listeners:[],raf:{requested:0,settled:0,cancelled:0,active:0}};
   (window as any).__RD13Observe=data;const contexts=new WeakMap<object,number>();const ids=new WeakMap<object,number>();let next=0;
   const objectId=(v:any)=>v&&typeof v==='object'?(ids.get(v)??(ids.set(v,++next),next)):v;
   const proto=WebGL2RenderingContext.prototype as any;
   for(const name of ['createTexture','createProgram','createShader','createFramebuffer','createVertexArray','createBuffer','deleteTexture','deleteProgram','deleteShader','deleteFramebuffer','deleteVertexArray','deleteBuffer',
    'shaderSource','getShaderParameter','getShaderInfoLog','getProgramParameter','getProgramInfoLog','getInternalformatParameter','checkFramebufferStatus','getError','readPixels']){
    const native=proto[name];proto[name]=function(this:WebGL2RenderingContext,...args:any[]){const value=native.apply(this,args);const context=contexts.get(this);
     if(name.startsWith('create')){data.created[name]=(data.created[name]??0)+Number(Boolean(value));objectId(value);}
     else if(name.startsWith('delete')){data.deleted[name]=(data.deleted[name]??0)+Number(Boolean(args[0]));}
     else if(name==='shaderSource'){data.shaders.push({context,shader:objectId(args[0]),code:args[1]});}
     else if(name==='readPixels'){data.readbacks.push({context,args:args.slice(0,6),values:ArrayBuffer.isView(args[6])?Array.from(args[6] as any):null});}
     else if(name!=='getError'||value!==0){data.queries.push({context,name,args:args.map((a:any)=>objectId(a)),value:ArrayBuffer.isView(value)?Array.from(value as any):value});}
     return value;};
   }
   const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:any[]){const gl=(getContext as any).apply(this,args);
    if(gl instanceof WebGL2RenderingContext&&!contexts.has(gl)){const index=data.contexts.length;contexts.set(gl,index);const debug=gl.getExtension('WEBGL_debug_renderer_info');
     data.contexts.push({index,request:args[0],canvasId:this.id,actualWebGL2:true,attributes:gl.getContextAttributes(),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'Unavailable',
      vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):'Unavailable',version:gl.getParameter(gl.VERSION),glsl:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      caps:{max3D:gl.getParameter(gl.MAX_3D_TEXTURE_SIZE),maxDrawBuffers:gl.getParameter(gl.MAX_DRAW_BUFFERS),maxAttachments:gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)},
      extensions:gl.getSupportedExtensions(),nativeDriverIdentityQualified:false});}
    return gl;
   } as typeof getContext;
   const add=EventTarget.prototype.addEventListener;const remove=EventTarget.prototype.removeEventListener;
   for(const [name,native] of [['addEventListener',add],['removeEventListener',remove]] as const){(EventTarget.prototype as any)[name]=function(type:string,callback:any,options:any){
    if(this instanceof HTMLCanvasElement){data.listeners.push({operation:name,canvasId:this.id,type,callback:objectId(callback),capture:typeof options==='boolean'?options:Boolean(options?.capture)});}return (native as any).call(this,type,callback,options);};}
   const request=requestAnimationFrame;const cancel=cancelAnimationFrame;const active=new Set<number>();
   window.requestAnimationFrame=(fn)=>{data.raf.requested+=1;let n=0;n=request((t)=>{active.delete(n);data.raf.active=active.size;data.raf.settled+=1;fn(t);});active.add(n);data.raf.active=active.size;return n;};
   window.cancelAnimationFrame=(n)=>{active.delete(n);data.raf.active=active.size;data.raf.cancelled+=1;cancel(n);};
   document.addEventListener('DOMContentLoaded',()=>{const c=document.querySelector('#viewport');for(const type of ['three-lab-rendered','three-lab-error','voxel-rays-rendered','voxel-rays-error']){
    c?.addEventListener(type,(e)=>data.canvasEvents.push({type,detail:String((e as CustomEvent).detail??''),facts:document.querySelector('#facts')?.textContent}));}});
  });
 });
 test.afterEach(async({page},info)=>{
  const own=evidence.get(id(info))!;let final:unknown;let beforeCleanup:unknown;let afterCleanup:unknown;
  try {final=await state(page);beforeCleanup=await page.evaluate(()=>(window as any).__RD13Observe);if(await page.locator('#dispose').count()){await page.locator('#dispose').click({timeout:10000});await settle(page);}afterCleanup=await page.evaluate(()=>(window as any).__RD13Observe);}catch(e){own.errors.push('OWN_CAPTURE_OR_CLEANUP '+String(e));}
  await Promise.all(own.pending);const report={schema:'rd13-original-and-supplement-observation-v1',source,productIntegrated:false,title:info.title,file:info.file,
  status:info.status,expectedStatus:info.expectedStatus,testErrors:info.errors,originalSpecSha256:digest(readFileSync('tests/RD-13/native.spec.ts')),final,beforeCleanup,afterCleanup,...own,pending:undefined};
  record('cases/'+id(info)+'.json',report);evidence.delete(id(info));
 });
}
