import * as T from 'three';
import {MeshStandardNodeMaterial,MeshBasicNodeMaterial} from 'three/webgpu';
import {attribute,cameraPosition,cameraViewMatrix,float,max,mix,normalize,output,positionLocal,positionWorld,pow,reflect,sin,cos,smoothstep,texture,uniform,uv,vec3,vec4} from 'three/tsl';
import type {MaterialData} from './port.js';

export const materialUniforms={wind:uniform(new T.Vector2()),wetness:uniform(0.4)};
export const glUniforms={wind:{value:new T.Vector2()},wetness:{value:0.4}};
export function setWind(x:number,z:number){materialUniforms.wind.value.set(x,z);glUniforms.wind.value.set(x,z);}

/** Fixed-base shadeHvpSurface formula; extra AO/wetness/wind hooks are composed, not substituted. */
export function surfaceMaterial(api:typeof T,node:boolean,data:MaterialData,water=false,leaf=false):T.Material {
  const base=new api.Color().setRGB(...data.colorLinearRgb,T.LinearSRGBColorSpace);
  const material=node?new MeshStandardNodeMaterial():new api.MeshStandardMaterial();
  material.color.copy(base);material.roughness=0.92;material.metalness=0;material.vertexColors=true;
  if(data.role==='emission')material.emissive.copy(base);
  material.side=api.DoubleSide;material.forceSinglePass=water;
  material.transparent=water;material.opacity=water?0.56:1;material.depthWrite=!water;
  if(leaf)material.alphaTest=0.5;
  if(node){
    const m=material as MeshStandardNodeMaterial;
    const p=positionWorld;
    const strata=sin(p.x.mul(1.7).add(p.y.mul(2.3))).mul(cos(p.z.mul(1.4).sub(p.y)));
    // The explicit colour node includes the attribute; disable the built-in second multiplication.
    m.vertexColors=false;
    m.colorNode=vec3(base.r,base.g,base.b).mul(attribute('color','vec3')).mul(attribute('labAo','float'))
      .mul(mix(float(1),float(0.62),attribute('labWetness','float'))).mul(water?float(1):strata.mul(0.055).add(0.96));
    m.roughnessNode=mix(float(0.92),float(0.24),attribute('labWetness','float'));
    if(leaf){
      const q=uv().sub(0.5);const mask=float(1).sub(smoothstep(0.15,0.22,q.x.mul(q.x).mul(2).add(q.y.mul(q.y))));
      m.opacityNode=mask;
      m.positionNode=vec3(positionLocal.x.add(materialUniforms.wind.y.mul(positionLocal.y)),positionLocal.y,
        positionLocal.z.sub(materialUniforms.wind.x.mul(positionLocal.y)));
    }
    if(water){
      const ripple=normalize(vec3(sin(p.x.mul(3.1).add(p.z.mul(1.7))).mul(0.09).add(cos(p.z.mul(8)).mul(0.035)),
        1,cos(p.z.mul(3.7).sub(p.x.mul(1.3))).mul(0.08).add(sin(p.x.mul(7)).mul(0.03))));
      m.normalNode=normalize(cameraViewMatrix.mul(vec4(ripple,0)).xyz);
      const sight=normalize(cameraPosition.sub(p));
      const fresnel=pow(float(1).sub(sight.dot(ripple).clamp(0,1)),3);
      const glint=pow(max(reflect(vec3(28,-42,18).normalize(),ripple).dot(sight),0),72);
      m.outputNode=vec4(mix(output.rgb,vec3(0.23,0.48,0.72),fresnel.mul(0.48)).add(vec3(0.75,0.69,0.48).mul(glint)),output.a);
    }
  }else{
    material.customProgramCacheKey=()=>`gfx03-hvp-v1:${water}:${leaf}`;
    material.onBeforeCompile=shader=>{
      shader.uniforms.uWind=glUniforms.wind;
      shader.vertexShader=`attribute float labAo;attribute float labWetness;varying float vAo;varying float vWetness;varying vec3 vHvpWorld;varying vec2 vLabUv;uniform vec2 uWind;\n${shader.vertexShader}`;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nvAo=labAo;vWetness=labWetness;vLabUv=uv;${leaf?'transformed.x+=uWind.y*position.y;transformed.z-=uWind.x*position.y;':''}`)
        .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvHvpWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader=`varying float vAo;varying float vWetness;varying vec3 vHvpWorld;varying vec2 vLabUv;\n${shader.fragmentShader}`;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\ndiffuseColor.rgb*=vAo*mix(1.0,0.62,vWetness);${water?'':'float strata=sin(vHvpWorld.x*1.7+vHvpWorld.y*2.3)*cos(vHvpWorld.z*1.4-vHvpWorld.y);diffuseColor.rgb*=0.96+0.055*strata;'}${leaf?'vec2 q=vLabUv-vec2(0.5);diffuseColor.a*=1.0-smoothstep(0.15,0.22,q.x*q.x*2.0+q.y*q.y);':''}`)
        .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(0.92,0.24,vWetness);');
      if(water)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>\nvec2 p=vHvpWorld.xz;vec3 ripple=normalize(vec3(0.09*sin(p.x*3.1+p.y*1.7)+0.035*cos(p.y*8.0),1.0,0.08*cos(p.y*3.7-p.x*1.3)+0.03*sin(p.x*7.0)));normal=normalize(mat3(viewMatrix)*ripple);`)
        .replace('#include <opaque_fragment>',`vec3 sight=normalize(cameraPosition-vHvpWorld);float fresnel=pow(1.0-clamp(dot(sight,ripple),0.0,1.0),3.0);float glint=pow(max(dot(reflect(-normalize(vec3(-28.0,42.0,-18.0)),ripple),sight),0.0),72.0);outgoingLight=mix(outgoingLight,vec3(0.23,0.48,0.72),0.48*fresnel)+vec3(0.75,0.69,0.48)*glint;\n#include <opaque_fragment>`);
    };
  }
  return material;
}

export function sky(api:typeof T,node:boolean){
  const pixels=new Uint8Array(256*256);
  const noise=(x:number,y:number,period:number)=>{const ix=Math.floor(x),iy=Math.floor(y);
    const hash=(a:number,b:number)=>{const v=Math.sin((a%period)*127.1+(b%period)*311.7)*43758.5453;return v-Math.floor(v);};
    const fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    return api.MathUtils.lerp(api.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),sx),api.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),sx),sy);};
  for(let y=0;y<256;y++)for(let x=0;x<256;x++)pixels[y*256+x]=Math.round(255*(0.6*noise(x/32,y/32,8)+0.28*noise(x/16,y/16,16)+0.12*noise(x/8,y/8,32)));
  const map=new api.DataTexture(pixels,256,256,api.RedFormat);map.wrapS=map.wrapT=api.RepeatWrapping;map.magFilter=map.minFilter=api.LinearFilter;map.needsUpdate=true;
  let material:T.Material;
  if(node){const m=new MeshBasicNodeMaterial({side:T.BackSide,depthWrite:false,fog:false,toneMapped:false});
    const d=positionLocal.normalize();const p=d.xz.div(max(0.15,d.y)).mul(3);
    const field=texture(map,p.mul(0.065)).r;
    const cloud=smoothstep(0.5,0.72,field).mul(smoothstep(0.05,0.22,d.y));
    m.colorNode=mix(mix(vec3(0.5294118,0.7098039,0.8509804),vec3(0.17,0.46,0.76),smoothstep(0,0.8,d.y)),vec3(0.93,0.96,0.94),cloud.mul(0.82));material=m;
  }else material=new api.ShaderMaterial({side:api.BackSide,depthWrite:false,fog:false,toneMapped:false,uniforms:{cloudMap:{value:map}},
    vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec3 direction;uniform sampler2D cloudMap;void main(){vec3 d=normalize(direction);vec3 color=mix(vec3(0.5294118,0.7098039,0.8509804),vec3(0.17,0.46,0.76),smoothstep(0.0,0.8,d.y));vec2 p=d.xz/max(0.15,d.y)*3.0;float field=texture2D(cloudMap,p*0.065).r;float cloud=smoothstep(0.5,0.72,field)*smoothstep(0.05,0.22,d.y);gl_FragColor=vec4(mix(color,vec3(0.93,0.96,0.94),cloud*0.82),1.0);}'});
  const mesh=new api.Mesh(new api.SphereGeometry(600,24,12),material);mesh.frustumCulled=false;mesh.name='hvp-presentation-sky';return {mesh,map};
}
