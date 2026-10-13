import {chromium} from '/workspace/Weltraum-Spiel/apps/weltraum-browser/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'/workspace/.cloud-setup/bin/chromium-hestia-mesa'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5190/favicon.png');
try{
const result=await page.evaluate(async()=>{
 const importMap=document.createElement('script');importMap.type='importmap';importMap.textContent=JSON.stringify({imports:{three:'/node_modules/three/build/three.module.js'}});document.head.append(importMap);
 const T=await import('/node_modules/three/build/three.module.js');
 const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
 document.body.replaceChildren();document.body.style.margin='0';
 const label=document.createElement('p');label.textContent='ASSET REVIEW · STATIC GLB CANDIDATE · NO GAMEPLAY AUTHORITY';label.style='position:absolute;left:18px;top:8px;color:white;font:16px system-ui;z-index:1';document.body.append(label);
 const scene=new T.Scene();scene.background=new T.Color('#53606b');
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1440,900);renderer.setPixelRatio(1);document.body.append(renderer.domElement);
 const camera=new T.PerspectiveCamera(42,1440/900,.1,100);camera.position.set(-13,10,20);camera.lookAt(0,2,0);
 scene.add(new T.HemisphereLight(0xffffff,0x34434d,2.4));const key=new T.DirectionalLight(0xffffff,3);key.position.set(-6,12,8);scene.add(key);
 const gltf=await new GLTFLoader().loadAsync('/factory/crashsite-hybrid-v1/crashsite-hybrid-v1.glb');scene.add(gltf.scene);
 renderer.render(scene,camera);
 const parts=[];gltf.scene.traverse(o=>{if(o.isMesh)parts.push({name:o.name,vertices:o.geometry.attributes.position.count,triangles:o.geometry.index.count/3});});
 const bounds=new T.Box3().setFromObject(gltf.scene),gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
 return {kind:'DETACHED_ASSET_REVIEW_NOT_GAMEPLAY',actualImportedGLB:true,testBridge:'TestBridge' in window,parts,triangles:parts.reduce((n,p)=>n+p.triangles,0),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'not reported',drawCalls:renderer.info.render.calls};
});
await page.screenshot({path:'/workspace/.cloud-setup/ui-ceramic-2026-10-13/crashsite-browser-import.png'});
await writeFile('/workspace/.cloud-setup/ui-ceramic-2026-10-13/crashsite-browser-import.json',JSON.stringify({result,errors},null,2)+'\n');console.log(JSON.stringify({result,errors}));
}finally{await browser.close();}
