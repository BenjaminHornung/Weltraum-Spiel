import {planets,createDraft,validateDraft,previewDraft,commitDraft,parseStored,Generation,canonicalCelestialJson,mapWind,type Draft} from './core.js';
import {validateFrame,integrate,density} from '../inputs/atm/src/optics.js';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const planet=el<HTMLSelectElement>('planet'),draft=el<HTMLTextAreaElement>('draft'),tick=el<HTMLInputElement>('tick');
let revision=0,validated:Draft|null=null,preview:Awaited<ReturnType<typeof previewDraft>>|null=null,busy=false;
const generation=new Generation();
for(let i=0;i<72;i++){const o=document.createElement('option');o.value=String(i);o.textContent='row '+Math.floor(i/12)+' / col '+i%12;el<HTMLSelectElement>('probe').append(o);}
for(const name of planets){const option=document.createElement('option');option.value=option.textContent=name;planet.append(option);}planet.value='HestiaAuthoring';
function buttons(){el<HTMLButtonElement>('validate').disabled=busy||!draft.value;el<HTMLButtonElement>('preview').disabled=busy||!validated;el<HTMLButtonElement>('export').disabled=busy||!preview;for(const id of ['validate','preview','export'])el(id).classList.toggle('primary',id===(!validated?'validate':!preview?'preview':'export'));}
function message(text:string){el('status').textContent=text;}
function clear(){generation.cancel();validated=null;preview=null;busy=false;el('map').replaceChildren();el('storms').replaceChildren();el('sample').textContent='Preview ausführen.';el('optical').textContent='ATM-Port: noch kein Preview. Kein GPU-Kontext.';buttons();}
function edited(){clear();message('Draft · Validate erforderlich');}
async function load(){
 clear();draft.value='';buttons();revision=0;const name=planet.value,token=generation.begin();busy=true;buttons();message('Loading '+name);
 try{const base=await createDraft(name),stored=localStorage.getItem('wxg08.lab.v1.'+name),parsed=stored===null?null:await parseStored(stored,name);
  await validateDraft(parsed?.draft??base);if(!generation.current(token))return;
  draft.value=JSON.stringify(parsed?.draft??base,null,2);revision=parsed?.revision??0;el('revision').textContent='Revision '+revision;message('Draft · '+name+' · Validate erforderlich');
 }catch(e){if(generation.current(token))message('Load blocked: '+String(e));}
 finally{if(generation.current(token)){busy=false;buttons();}}
}
async function action(work:(token:number)=>Promise<void>){
 const token=generation.begin();busy=true;buttons();
 try{await work(token);}catch(e){if(generation.current(token)){validated=null;preview=null;message('Blocked: '+String(e));}}
 finally{if(generation.current(token)){busy=false;buttons();}}
}
el('validate').onclick=()=>action(async token=>{message('Validating');const d=await validateDraft(JSON.parse(draft.value));if(!generation.current(token))return;if(d.planet!==planet.value)throw Error('PLANET_MISMATCH');validated=d;preview=null;message('Validated · Preview erforderlich');});
el('preview').onclick=()=>action(async token=>{message('Sampling');const p=await previewDraft(validated!,Number(tick.value));if(!generation.current(token))return;preview=p;render();message('Preview · '+p.planet+' · Export bereit');});
el('export').onclick=()=>action(async token=>{
 if(!preview||!validated||preview.planet!==planet.value)throw Error('PREVIEW_REQUIRED');
 // Editing, canceling or switching while CAS waits must not commit old work.
 const guardedLocks={request:((name:string,callback:(lock:Lock|null)=>unknown)=>navigator.locks.request(name,lock=>{if(!generation.current(token))throw Error('CANCELLED');return callback(lock);}))} as Pick<LockManager,'request'>;
 const stored=await commitDraft(validated,revision,localStorage,guardedLocks,()=>generation.current(token));if(!generation.current(token))return;
 revision=stored.revision;el('revision').textContent='Revision '+revision;
 const text=canonicalCelestialJson(stored);el('export-json').textContent=text;
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='wxg08-'+planet.value+'-r'+revision+'.json';a.click();URL.revokeObjectURL(url);message('Exported · revision '+revision+' · Produktintegration NO');
});
el('cancel').onclick=()=>void load();planet.onchange=()=>void load();draft.oninput=edited;
tick.oninput=()=>{el('tick-value').textContent=tick.value;generation.cancel();busy=false;preview=null;buttons();message(validated?'Validated · Tick geändert, Preview erforderlich':'Draft · Validate erforderlich');};
el('event').onclick=()=>{
 try{const d=JSON.parse(draft.value) as Draft,config={...(d.events.at(-1)?.config??d.base.config),zonalWindMps:Number(el<HTMLInputElement>('wind').value)};
  draft.value=JSON.stringify({...d,events:[...d.events,{id:el<HTMLInputElement>('event-id').value,name:el<HTMLInputElement>('event-name').value,version:1,kind:'ConfigChanged',simulationTick:Number(tick.value),config}]},null,2);edited();
 }catch(e){message('Blocked: '+String(e));}
};
function render(){
 if(!preview)return;const map=el('map'),layer=el<HTMLSelectElement>('layer').value,high=el<HTMLSelectElement>('quality').value==='High';map.replaceChildren();const ns='http://www.w3.org/2000/svg';
 for(const c of preview.cells){
  const r=c.result,s=r.status==='Known'?r.sample:null,rect=document.createElementNS(ns,'rect');
  rect.setAttribute('x',String(c.col*60));rect.setAttribute('y',String((5-c.row)*60));rect.setAttribute('width','60');rect.setAttribute('height','60');
  rect.setAttribute('stroke',high?'#a5c2be':'none');
 const value=s?(layer==='wind'?Math.hypot(s.windBodyFixedMps.x,s.windBodyFixedMps.y,s.windBodyFixedMps.z):s.temperatureK):null;
  rect.setAttribute('fill',s&&layer!=='moisture'&&layer!=='condensate'?'hsl('+Math.max(15,Math.min(220,220-(value??0)*(layer==='wind'?4:0.5)))+' 35% 38%)':'#364348');
  if(c.row*12+c.col===Number(el<HTMLSelectElement>('probe').value)){rect.setAttribute('stroke','#f3da99');rect.setAttribute('stroke-width','3');}
  rect.onclick=()=>{el<HTMLSelectElement>('probe').value=String(c.row*12+c.col);render();};
  const title=document.createElementNS(ns,'title');title.textContent=r.status+(s?' · '+layer+' '+(layer==='moisture'?'Unsupported':layer==='condensate'?JSON.stringify(s.condensates):value):'');rect.append(title);map.append(rect);
  if(s&&high&&layer==='wind'){const wind=mapWind(c.normal,s.windBodyFixedMps),line=document.createElementNS(ns,'line');line.setAttribute('x1',String(c.col*60+30));line.setAttribute('y1',String((5-c.row)*60+30));line.setAttribute('x2',String(c.col*60+30+wind.u));line.setAttribute('y2',String((5-c.row)*60+30-wind.v));line.setAttribute('stroke','#fff');map.append(line);}
 }
 map.setAttribute('aria-label','Globale Wetterkarte '+preview.planet+' · '+layer+' · tick '+preview.tick);
 const statuses=[...new Set(preview.cells.map(c=>c.result.status))].join(', '),known=preview.cells[Number(el<HTMLSelectElement>('probe').value)].result;
 el('sample').textContent=known.status+' · Probe '+el<HTMLSelectElement>('probe').selectedOptions[0].textContent+' · Feuchte UNSUPPORTED_NO_SATURATION · Kondensat '+(known.status==='Known'?JSON.stringify(known.sample.condensates):'nicht verfügbar')+' · '+(known.status==='Known'?'T '+known.sample.temperatureK.toFixed(3)+' K · P '+known.sample.pressurePa.toFixed(3)+' Pa · Wind '+JSON.stringify(known.sample.windBodyFixedMps)+' m/s':'');
 const list=el('storms');list.replaceChildren();const storms=statuses==='Known'?preview.storms.filter(s=>s.kind==='Vortex'):[];
 for(const storm of storms){const li=document.createElement('li');li.textContent=storm.id;list.append(li);}if(!storms.length){const li=document.createElement('li');li.textContent='Keine verfügbaren Storm-IDs · '+statuses;list.append(li);}
 const frame=preview.cells.find(c=>c.atmosphere)?.atmosphere;
 if(frame){const f=validateFrame({...frame,authoredCloudCoverage:frame.status==='NoAtmosphere'?0:Number(el<HTMLInputElement>('cloud').value)});const optical=integrate(x=>density([0,x,0],f.authoredCloudCoverage),40,high?32:16,[1,1,1]);el('optical').textContent='ATM '+f.status+' · optical T '+optical.T.toFixed(4)+' · '+(high?'32':'16')+' CPU steps · Preview only · ActualAdapter NOT_REQUESTED_CPU_DOM · GPU timer unavailable';}
 else el('optical').textContent='ATM Unsupported · kein Ersatz durch Erdatmosphäre.';
}
for(const id of ['layer','quality','cloud','probe'])el(id).oninput=render;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();void load();}});
void load();
