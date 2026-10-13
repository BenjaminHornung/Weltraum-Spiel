// Detached asset review only. Does not initialize game World or TestBridge.
import {chromium} from '/workspace/Weltraum-Spiel/apps/weltraum-browser/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('.',import.meta.url));
const browser=await chromium.launch({headless:true,executablePath:'/workspace/.cloud-setup/bin/chromium-hestia-mesa'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:660}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5190/favicon.png');
 const result=await page.evaluate(async()=>{
  const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports:{three:'/node_modules/three/build/three.module.js'}});document.head.append(map);
  const T=await import('/node_modules/three/build/three.module.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  document.body.replaceChildren();document.body.style='margin:0;background:#1f2a2e;color:#e7dfcf;font:18px system-ui';
  const heading=document.createElement('p');heading.textContent='WRECK MODEL COMPARISON · SAME CAMERA AND LIGHTS · DETACHED GLB REVIEW';heading.style='margin:16px 24px';document.body.append(heading);
  const container=document.createElement('div');container.style='display:grid;grid-template-columns:1fr 1fr';document.body.append(container);
  const reports=[];
  for (const version of [1,2]) {
   const panel=document.createElement('section');container.append(panel);
   const label=document.createElement('p');label.textContent=`V${version} · ${version===1?'Previous model':'Refined candidate'} · No gameplay authority`;label.style='margin:8px 24px';panel.append(label);
   const scene=new T.Scene();scene.background=new T.Color('#526064');
   const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(720,480);renderer.setPixelRatio(1);panel.append(renderer.domElement);
   renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
   const camera=new T.OrthographicCamera(-9,9,6,-6,.1,100);camera.position.set(-13,10,22);camera.lookAt(0,2.125,.5);
   scene.add(new T.HemisphereLight(0xe9f2f2,0x54625d,2));const key=new T.DirectionalLight(0xffffff,2.5);key.position.set(-7,14,10);scene.add(key);
   const gltf=await new GLTFLoader().loadAsync(`/factory/crashsite-hybrid-v${version}/crashsite-hybrid-v${version}.glb`);scene.add(gltf.scene);
   renderer.render(scene,camera);
   const parts=[];gltf.scene.traverse(o=>{if(o.isMesh)parts.push({name:o.name,vertices:o.geometry.attributes.position.count,triangles:o.geometry.index.count/3});});
   const bounds=new T.Box3().setFromObject(gltf.scene),gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   reports.push({version,kind:'DETACHED_ASSET_REVIEW_NOT_GAMEPLAY',actualImportedGLB:true,testBridge:'TestBridge' in window,
    parts,triangles:parts.reduce((n,p)=>n+p.triangles,0),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'not reported',drawCalls:renderer.info.render.calls});
  }
  const note=document.createElement('p');note.textContent='V2: native hull / access / collision admission and human visual approval are pending.';note.style='margin:18px 24px';document.body.append(note);
  return reports;
 });
 await page.screenshot({path:out+'07-browser-comparison.png'});
 const report={result,errors};await writeFile(out+'browser-import.json',JSON.stringify(report,null,2)+'\n');
 if(errors.length||result.some(r=>r.testBridge)||result[1].triangles>40000)throw new Error(JSON.stringify(report));
 console.log(JSON.stringify(report));
}finally{await browser.close();}
