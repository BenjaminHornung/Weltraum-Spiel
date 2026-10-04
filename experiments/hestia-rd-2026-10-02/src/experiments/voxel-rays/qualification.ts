/** Test-only native numeric pass. Authored/compiled in Phase1; NEVER executed by the CPU/build workflow. */
import { Matrix3, PerspectiveCamera } from 'three';
import type { Vec3 } from '../../contracts/fixture';
import { requireValue, sha256 } from '../../contracts/validation';
import { hitDepth, PRODUCTION_KERNEL, traceOracle } from './ray';
import type { RayVolume } from './volume';

export type NativeFault='none'|'wrong-slot'|'wrong-normal'|'force-miss'|'hide-unknown'|'proxy-depth'|'stale-upload';
const vertex=`#version 300 es
void main() { vec2 p=gl_VertexID==0?vec2(-1,-1):(gl_VertexID==1?vec2(3,-1):vec2(-1,3)); gl_Position=vec4(p,0,1); }`;
const fragment=`#version 300 es
precision highp float; precision highp int;
layout(location=0) out vec4 positionT;
layout(location=1) out vec4 normalSlot;
layout(location=2) out vec4 cellStatus;
layout(location=3) out vec4 uncertainty;
uniform mat4 gridFromWorld; uniform mat3 worldNormalMatrix; uniform mat4 projectionView;
uniform vec3 worldOrigin; uniform vec3 worldDirection; uniform vec3 originalOffset; uniform int fault;
${PRODUCTION_KERNEL}
void main() {
  VoxelHit h=traceVoxels((gridFromWorld*vec4(worldOrigin,1)).xyz,(gridFromWorld*vec4(worldDirection,0)).xyz);
  if (fault==3) { h.hit=false; } if (fault==4) { h.unknown=false; }
  positionT=vec4(0); normalSlot=vec4(0); cellStatus=vec4(-1,-1,-1,h.traversalFault?-1.0:0.0);
  uncertainty=vec4(h.unknown?1.0:0.0,1.0,0.0,1.0); gl_FragDepth=fault==5?0.0:1.0;
  if (h.hit) {
    vec3 p=worldOrigin+h.t*worldDirection; vec3 n=normalize(worldNormalMatrix*h.normal);
    positionT=vec4(p,h.t); normalSlot=vec4(fault==2?-n:n,float(fault==1?(h.slot==1?2:1):h.slot));
    cellStatus=vec4(vec3(h.cell)+originalOffset,1.0);
    gl_FragDepth=fault==5?0.0:projectionDepth(p,projectionView);
  }
}`;
const resolveDepth=`#version 300 es
precision highp float; layout(location=0) out vec4 depthValue; uniform highp sampler2D attachmentDepth;
void main() { depthValue=vec4(texelFetch(attachmentDepth,ivec2(0),0).r,0,0,1); }`;
export interface NativeProbe { status:'PASS'|'FAIL'|'UNSUPPORTED'; reason?:string; kernelSha256:string; shaderSha256:string;
  productIntegrated:false; source:RayVolume['source']; sourceSlotSha256:string; inputPackedSha256:string; uploadedPackedSha256?:string;
  fault:NativeFault; nativeGpuBytes:{status:'unsupported';reason:string}; expected:ReturnType<typeof traceOracle>;
  observed?:{positionT:readonly number[];normalSlot:readonly number[];originalCellStatus:readonly number[];uncertainty:readonly number[];attachmentDepth:number};
  device?:{renderer:string;vendor:string;version:string;shadingLanguageVersion:string;classification:'software'|'unconfirmed'|'hardware-candidate'};
  mismatches:readonly string[]; projectionAllocations:number; cleanup:{textures:number;programs:number;shaders:number;framebuffers:number;vaos:number}; }
export function nativeMismatches(expected:NativeProbe['expected'],observed:NonNullable<NativeProbe['observed']>,expectedDepth:number) {
  const {positionT,normalSlot,originalCellStatus,uncertainty,attachmentDepth}=observed;
  if (![...positionT,...normalSlot,...originalCellStatus,...uncertainty,attachmentDepth].every(Number.isFinite)) {return ['non-finite native attachment readback'];}
  const mismatches:string[]=[];
  if (originalCellStatus[3]!== (expected.status==='hit'?1:0)) {mismatches.push('hit/miss/traversal-fault');}
  if (uncertainty[0]!==Number(expected.unknownTraversed)||uncertainty[1]!==1) {mismatches.push('Unknown/outside policy');}
  requireValue(Number.isFinite(expectedDepth),'Non-finite analytical expected depth');
  if (Math.abs(attachmentDepth-expectedDepth)>2e-5) {mismatches.push('actual attachment depth (not recomputed CPU output)');}
  if (expected.status==='hit') {
    if (positionT.slice(0,3).some((n,a)=>Math.abs(n-expected.point![a])>1e-5)||Math.abs(positionT[3]-expected.t!)>1e-5) {mismatches.push('world position/metre t');}
    if (normalSlot.slice(0,3).some((n,a)=>Math.abs(n-expected.normal![a])>1e-5)) {mismatches.push('world normal');}
    if (normalSlot[3]!==expected.slot||originalCellStatus.slice(0,3).some((n,a)=>n!==expected.originalCell![a])) {mismatches.push('original cell/material slot');}
  }
  return mismatches;
}
/** Uses exactly PRODUCTION_KERNEL; expected values are independent analytical intervals. Depth is sampled from the actual depth attachment. */
export async function probeNative(v:RayVolume,origin:Vec3,direction:Vec3,camera:PerspectiveCamera,fault:NativeFault='none',stale?:RayVolume):Promise<NativeProbe> {
  const expected=traceOracle(v,origin,direction); const kernelSha256=await sha256(new TextEncoder().encode(PRODUCTION_KERNEL));
  const shaderSha256=await sha256(new TextEncoder().encode(fragment)); const inputPackedSha256=await sha256(v.packed);
  const result:NativeProbe={status:'UNSUPPORTED',reason:'Numeric qualification not completed',kernelSha256,shaderSha256,productIntegrated:false,
    source:v.source,sourceSlotSha256:v.sourceSlotSha256,inputPackedSha256,fault,nativeGpuBytes:{status:'unsupported',reason:'Even context-only acquisition consumes unknown native VRAM'},
    expected,mismatches:[],projectionAllocations:0,cleanup:{textures:0,programs:0,shaders:0,framebuffers:0,vaos:0}};
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=1;
  const context=canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});
  if (!context) { return {...result,reason:'WebGL2 unavailable; NOT a mesh fallback PASS'}; }
  const gl:WebGL2RenderingContext=context;
  const textures:WebGLTexture[]=[]; const programs:WebGLProgram[]=[]; const shaders:WebGLShader[]=[]; const framebuffers:WebGLFramebuffer[]=[]; const vaos:WebGLVertexArrayObject[]=[];
  try {
    const debug=gl.getExtension('WEBGL_debug_renderer_info');const renderer=debug?String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):'Unavailable';
    const vendor=debug?String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)):'Unavailable';
    result.device={renderer,vendor,version:String(gl.getParameter(gl.VERSION)),shadingLanguageVersion:String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
      classification:/swiftshader|llvmpipe|softpipe|software|microsoft basic|osmesa/i.test(renderer)?'software':debug?'hardware-candidate':'unconfirmed'};
    if (result.device.classification!=='hardware-candidate') {result.reason='Software/unconfirmed renderer: NOT hardware-native qualification PASS';return result;}
    if (!gl.getExtension('EXT_color_buffer_float') || gl.getParameter(gl.MAX_DRAW_BUFFERS)<4 || gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)<4
      || gl.getParameter(gl.MAX_3D_TEXTURE_SIZE)<Math.max(...v.dimensions)) {
      result.reason='RGBA32F/MRT/FBO/volume admission unsupported; NOT a mesh fallback PASS'; return result;
    }
    gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA32F,gl.SAMPLES);
    gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT32F,gl.SAMPLES);
    requireValue(gl.getError()===gl.NO_ERROR && !gl.isContextLost(),'Native format query failed before projection allocation');
    const uploaded=fault==='stale-upload'?stale?.packed:v.packed;
    requireValue(uploaded && uploaded.length===v.packed.length,'Stale fault requires actual same-sized old source');
    result.uploadedPackedSha256=await sha256(uploaded);
    function texture() { const t=gl!.createTexture(); requireValue(t,'Driver texture allocation failure'); textures.push(t); result.projectionAllocations+=1; return t; }
    function framebuffer() { const f=gl!.createFramebuffer(); requireValue(f,'Driver FBO allocation failure'); framebuffers.push(f); result.projectionAllocations+=1; return f; }
    function program(fs:string) {
      const p=gl!.createProgram(); requireValue(p,'Driver program allocation failure'); programs.push(p); result.projectionAllocations+=1;
      for (const [type,code] of [[gl!.VERTEX_SHADER,vertex],[gl!.FRAGMENT_SHADER,fs]] as const) {
        const s=gl!.createShader(type); requireValue(s,'Driver shader allocation failure'); shaders.push(s); result.projectionAllocations+=1;
        gl!.shaderSource(s,code); gl!.compileShader(s); requireValue(gl!.getShaderParameter(s,gl!.COMPILE_STATUS),`Native shader compile failed: ${gl!.getShaderInfoLog(s)}`); gl!.attachShader(p,s);
      }
      gl!.linkProgram(p); requireValue(gl!.getProgramParameter(p,gl!.LINK_STATUS),`Native program link failed: ${gl!.getProgramInfoLog(p)}`); return p;
    }
    const volumeTexture=texture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D,volumeTexture);
    gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1); gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA8UI,...v.dimensions,0,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,uploaded);
    const fbo=framebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
    function attachment(format:number,type:number) { const t=texture(); gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,format,1,1,0,format===gl.RGBA32F?gl.RGBA:gl.DEPTH_COMPONENT,type,null); return t; }
    for (let i=0;i<4;i+=1) { gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,attachment(gl.RGBA32F,gl.FLOAT),0); }
    const depth=attachment(gl.DEPTH_COMPONENT32F,gl.FLOAT); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depth,0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2,gl.COLOR_ATTACHMENT3]);
    requireValue(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE,'Native MRT/depth FBO incomplete AFTER allocation');
    const p=program(fragment); gl.useProgram(p); const vao=gl.createVertexArray(); requireValue(vao,'Driver VAO allocation failure'); vaos.push(vao); result.projectionAllocations+=1; gl.bindVertexArray(vao);
    gl.uniform1i(gl.getUniformLocation(p,'voxelData'),0); gl.uniform3i(gl.getUniformLocation(p,'gridSize'),...v.dimensions);
    gl.uniformMatrix4fv(gl.getUniformLocation(p,'gridFromWorld'),false,new Float32Array(v.gridFromWorld.elements));
    gl.uniformMatrix3fv(gl.getUniformLocation(p,'worldNormalMatrix'),false,new Float32Array(new Matrix3().getNormalMatrix(v.worldFromGrid).elements));
    gl.uniformMatrix4fv(gl.getUniformLocation(p,'projectionView'),false,new Float32Array(camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements));
    gl.uniform3f(gl.getUniformLocation(p,'worldOrigin'),...origin); gl.uniform3f(gl.getUniformLocation(p,'worldDirection'),...direction); gl.uniform3f(gl.getUniformLocation(p,'originalOffset'),...v.offset);
    gl.uniform1i(gl.getUniformLocation(p,'fault'),['none','wrong-slot','wrong-normal','force-miss','hide-unknown','proxy-depth','stale-upload'].indexOf(fault));
    gl.viewport(0,0,1,1); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.ALWAYS); gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES,0,3);
    const read=(i:number)=>{ gl.readBuffer(gl.COLOR_ATTACHMENT0+i); const data=new Float32Array(4); gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,data); return Array.from(data); };
    const positionT=read(0); const normalSlot=read(1); const originalCellStatus=read(2); const uncertainty=read(3);
    const resolve=framebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,resolve); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,attachment(gl.RGBA32F,gl.FLOAT),0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]); requireValue(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE,'Native depth resolve FBO incomplete AFTER allocation');
    const resolveProgram=program(resolveDepth); gl.useProgram(resolveProgram); gl.disable(gl.DEPTH_TEST); gl.bindTexture(gl.TEXTURE_2D,depth); gl.uniform1i(gl.getUniformLocation(resolveProgram,'attachmentDepth'),0); gl.drawArrays(gl.TRIANGLES,0,3);
    const attachmentDepth=read(0)[0]; requireValue(gl.getError()===gl.NO_ERROR&&!gl.isContextLost(),'Native upload/draw/readback error AFTER allocation');
    result.observed={positionT,normalSlot,originalCellStatus,uncertainty,attachmentDepth};
    const mismatches=nativeMismatches(expected,result.observed,expected.status==='hit'?hitDepth(expected.point!,camera):1);
    result.mismatches=mismatches; result.status=mismatches.length===0?'PASS':'FAIL'; delete result.reason; return result;
  } catch (error) { result.status='FAIL'; result.reason=String(error); return result; }
  finally {
    textures.forEach((t)=>gl.deleteTexture(t)); programs.forEach((p)=>gl.deleteProgram(p)); shaders.forEach((s)=>gl.deleteShader(s)); framebuffers.forEach((f)=>gl.deleteFramebuffer(f)); vaos.forEach((v)=>gl.deleteVertexArray(v));
    result.cleanup={textures:textures.length,programs:programs.length,shaders:shaders.length,framebuffers:framebuffers.length,vaos:vaos.length};
    gl.getExtension('WEBGL_lose_context')?.loseContext(); canvas.remove();
  }
}
