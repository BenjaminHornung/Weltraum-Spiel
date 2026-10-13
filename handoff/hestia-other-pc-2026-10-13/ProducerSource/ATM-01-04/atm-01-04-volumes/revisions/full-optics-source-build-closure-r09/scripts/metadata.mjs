import {mkdirSync,writeFileSync} from 'node:fs';
const pins={'three':'0.186.1','@types/three':'0.186.0','@takram/three-clouds':'0.7.6','@takram/three-atmosphere':'0.19.1','postprocessing':'6.39.5','typescript':'5.9.3','esbuild':'0.27.3'};
mkdirSync('inputs/registry',{recursive:true});
for(const [name,pin] of Object.entries(pins)){
 const response=await fetch('https://registry.npmjs.org/'+encodeURIComponent(name)+'/'+pin);
 if(!response.ok)throw Error('REGISTRY:'+name+':'+response.status);
 const raw=await response.text(),p=JSON.parse(raw);
 if(p.name!==name||p.version!==pin||!p.dist?.integrity)throw Error('PIN:'+name);
 writeFileSync('inputs/registry/'+name.replaceAll('/','_').replace('@','')+'.json',raw);
 console.log(JSON.stringify({name,version:p.version,license:p.license,gitHead:p.gitHead,peers:p.peerDependencies,optionalPeers:p.peerDependenciesMeta,dependencies:p.dependencies}));
}
