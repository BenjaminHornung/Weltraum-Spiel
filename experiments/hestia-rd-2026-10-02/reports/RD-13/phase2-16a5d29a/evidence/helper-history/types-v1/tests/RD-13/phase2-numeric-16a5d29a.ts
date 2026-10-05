/** Declared test-only [1,0,1] witness. No fixture/kernel/oracle rewrite or visible restart. */
export async function numericVisible(input:{kernel:string;packed:number[];projectionView:number[]}) {
 const vertex='#version 300 es\nvoid main(){vec2 p=gl_VertexID==0?vec2(-1,-1):(gl_VertexID==1?vec2(3,-1):vec2(-1,3));gl_Position=vec4(p,0,1);}';
 const fragment=`#version 300 es
precision highp float; precision highp int;
layout(location=0) out vec4 positionT; layout(location=1) out vec4 normalSlot;
layout(location=2) out vec4 cellStatus; layout(location=3) out vec4 uncertainty;
uniform mat4 projectionView; uniform int visibleMode; uniform int fault;
${input.kernel}
void main(){
 vec3 o=vec3(.5);vec3 d=vec3(1,0,0);
 VoxelHit h=visibleMode==1?traceVisibleVoxels(o,d):traceVoxels(o,d);
 if(fault==3){h.hit=false;}if(fault==4){h.unknown=false;}
 positionT=vec4(0);normalSlot=vec4(0);cellStatus=vec4(-1,-1,-1,h.traversalFault?-1.0:0.0);
 uncertainty=vec4(h.unknown?1.0:0.0,1.0,0,1);gl_FragDepth=fault==5?0.0:1.0;
 if(h.hit){vec3 p=o+h.t*d;positionT=vec4(p,h.t);normalSlot=vec4(fault==2?-h.normal:h.normal,float(fault==1?2:h.slot));
 cellStatus=vec4(vec3(h.cell),1);gl_FragDepth=fault==5?0.0:projectionDepth(p,projectionView);}
}`;
 const depthShader='#version 300 es\nprecision highp float;layout(location=0) out vec4 depthValue;uniform highp sampler2D attachmentDepth;void main(){depthValue=vec4(texelFetch(attachmentDepth,ivec2(0),0).r,0,0,1);}';
 const result:any={status:'UNSUPPORTED',reason:'No completed native float readbacks',fragment,vertex,depthShader,rows:[],allocations:0,cleanup:{},firstTerminal:null,productIntegrated:false,nativeVram:'UNKNOWN'};
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});
 if(!gl){result.reason='Actual WebGL2 unavailable; no fallback';return result;}
 const textures:WebGLTexture[]=[],programs:WebGLProgram[]=[],shaders:WebGLShader[]=[],fbos:WebGLFramebuffer[]=[],vaos:WebGLVertexArrayObject[]=[];
 const require=(value:unknown,message:string)=>{if(!value){throw new Error(message);}};
 try {
  const debug=gl.getExtension('WEBGL_debug_renderer_info');const renderer=debug?String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):'Unavailable';
  result.device={renderer,vendor:debug?String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)):'Unavailable',version:gl.getParameter(gl.VERSION),glsl:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
   classification:/swiftshader|llvmpipe|softpipe|software|microsoft basic|osmesa/i.test(renderer)?'software':debug?'hardware-candidate':'unconfirmed'};
  result.caps={float:Boolean(gl.getExtension('EXT_color_buffer_float')),drawBuffers:gl.getParameter(gl.MAX_DRAW_BUFFERS),attachments:gl.getParameter(gl.MAX_COLOR_ATTACHMENTS),max3D:gl.getParameter(gl.MAX_3D_TEXTURE_SIZE)};
  if(result.device.classification!=='hardware-candidate'||!result.caps.float||result.caps.drawBuffers<4||result.caps.attachments<4||result.caps.max3D<3){result.reason='Unsupported native hardware/float/MRT admission; no green software or mesh fallback';return result;}
  result.formatQueries={rgba32f:Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA32F,gl.SAMPLES)??[]),depth32f:Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT32F,gl.SAMPLES)??[])};
  const formatError=gl.getError();result.formatError=formatError;require(formatError===gl.NO_ERROR&&!gl.isContextLost(),'Native format query error BEFORE allocation '+formatError);
  function texture(){const t=gl!.createTexture();require(t,'Texture allocation');textures.push(t!);result.allocations+=1;return t!;}
  function fbo(){const f=gl!.createFramebuffer();require(f,'FBO allocation');fbos.push(f!);result.allocations+=1;return f!;}
  function program(code:string){const p=gl!.createProgram();require(p,'Program allocation');programs.push(p!);result.allocations+=1;
   for(const [type,text] of [[gl!.VERTEX_SHADER,vertex],[gl!.FRAGMENT_SHADER,code]]){const s=gl!.createShader(type as number);require(s,'Shader allocation');shaders.push(s!);result.allocations+=1;
    gl!.shaderSource(s!,text as string);gl!.compileShader(s!);const status=gl!.getShaderParameter(s!,gl!.COMPILE_STATUS);const log=gl!.getShaderInfoLog(s!);(result.shaderLogs??=[]).push({type,status,log});require(status,'Native shader compile AFTER allocation: '+log);gl!.attachShader(p!,s!);}
   gl!.linkProgram(p!);const status=gl!.getProgramParameter(p!,gl!.LINK_STATUS);const log=gl!.getProgramInfoLog(p!);(result.programLogs??=[]).push({status,log});require(status,'Native link AFTER allocation: '+log);return p!;
  }
  const volume=texture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,volume);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  for(const mode of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R]){gl.texParameteri(gl.TEXTURE_3D,mode,gl.CLAMP_TO_EDGE);}gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  function attachment(format:number){const t=texture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
   gl.texImage2D(gl.TEXTURE_2D,0,format,1,1,0,format===gl.RGBA32F?gl.RGBA:gl.DEPTH_COMPONENT,gl.FLOAT,null);return t;}
  const target=fbo();gl.bindFramebuffer(gl.FRAMEBUFFER,target);for(let n=0;n<4;n+=1){gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+n,gl.TEXTURE_2D,attachment(gl.RGBA32F),0);}
  const depth=attachment(gl.DEPTH_COMPONENT32F);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depth,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2,gl.COLOR_ATTACHMENT3]);
  result.targetFbo=gl.checkFramebufferStatus(gl.FRAMEBUFFER);require(result.targetFbo===gl.FRAMEBUFFER_COMPLETE,'MRT/depth FBO incomplete AFTER allocation');
  const ray=program(fragment);const vao=gl.createVertexArray();require(vao,'VAO allocation');vaos.push(vao!);result.allocations+=1;gl.bindVertexArray(vao);
  const resolve=fbo();gl.bindFramebuffer(gl.FRAMEBUFFER,resolve);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,attachment(gl.RGBA32F),0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  result.resolveFbo=gl.checkFramebufferStatus(gl.FRAMEBUFFER);require(result.resolveFbo===gl.FRAMEBUFFER_COMPLETE,'Depth resolve FBO incomplete AFTER allocation');const depthProgram=program(depthShader);
  const read=(n:number)=>{gl!.readBuffer(gl!.COLOR_ATTACHMENT0+n);const b=new Float32Array(4);gl!.readPixels(0,0,1,1,gl!.RGBA,gl!.FLOAT,b);return Array.from(b);};
  for(const row of [{id:'geometric-first-exit',visible:0,double:0,unknown:false,fault:0},{id:'visible-front-only-far-hit',visible:1,double:0,unknown:false,fault:0},
   {id:'visible-double-sided-first-exit',visible:1,double:1,unknown:false,fault:0},{id:'visible-unknown-gap',visible:1,double:0,unknown:true,fault:0},
   ...[1,2,3,4,5].map((fault)=>({id:'visible-induced-fault-'+fault,visible:1,double:0,unknown:true,fault}))]){
   const packed=Uint8Array.from(input.packed);if(row.unknown){packed[5]=0;}gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,volume);gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA8UI,3,1,1,0,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,packed);
   gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2,gl.COLOR_ATTACHMENT3]);gl.useProgram(ray);
   gl.uniform1i(gl.getUniformLocation(ray,'voxelData'),0);gl.uniform3i(gl.getUniformLocation(ray,'gridSize'),3,1,1);gl.uniform1iv(gl.getUniformLocation(ray,'slotDoubleSided[0]'),Int32Array.from([0,row.double,0,0,0,0,0,0]));
   gl.uniform1i(gl.getUniformLocation(ray,'visibleMode'),row.visible);gl.uniform1i(gl.getUniformLocation(ray,'fault'),row.fault);gl.uniformMatrix4fv(gl.getUniformLocation(ray,'projectionView'),false,Float32Array.from(input.projectionView));
   gl.viewport(0,0,1,1);gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.ALWAYS);gl.depthMask(true);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);
   const positionT=read(0),normalSlot=read(1),originalCellStatus=read(2),uncertainty=read(3);
   gl.bindFramebuffer(gl.FRAMEBUFFER,resolve);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);gl.useProgram(depthProgram);gl.disable(gl.DEPTH_TEST);gl.bindTexture(gl.TEXTURE_2D,depth);gl.uniform1i(gl.getUniformLocation(depthProgram,'attachmentDepth'),0);gl.drawArrays(gl.TRIANGLES,0,3);
   const attachmentDepth=read(0)[0];const error=gl.getError();require(error===gl.NO_ERROR&&!gl.isContextLost(),'Native upload/draw/readback AFTER allocation '+error);
   result.rows.push({...row,uploadedPacked:Array.from(packed),observed:{positionT,normalSlot,originalCellStatus,uncertainty,attachmentDepth},readbackError:error});
  }
  result.status='READBACK_COMPLETE';delete result.reason;return result;
 }catch(e){result.status='FAIL';result.reason=String(e);result.firstTerminal={reason:String(e),allocations:result.allocations};return result;}
 finally {textures.forEach((t)=>gl.deleteTexture(t));programs.forEach((p)=>gl.deleteProgram(p));shaders.forEach((s)=>gl.deleteShader(s));fbos.forEach((f)=>gl.deleteFramebuffer(f));vaos.forEach((v)=>gl.deleteVertexArray(v));
  result.cleanup={textures:textures.length,programs:programs.length,shaders:shaders.length,framebuffers:fbos.length,vaos:vaos.length,logicalOnly:true};gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();}
}
