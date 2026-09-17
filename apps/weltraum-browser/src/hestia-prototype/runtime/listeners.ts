/** Actual owned registrations; a failed removal remains visible in the receipt. */
export const createHvpListeners=()=>{
  const entries:{target:Pick<EventTarget,"addEventListener"|"removeEventListener">;type:string;listener:EventListener;options?:boolean|AddEventListenerOptions}[]=[];
  let closed=false;
  return {
    get size(){return entries.length;},
    add(target:Pick<EventTarget,"addEventListener"|"removeEventListener">,type:string,listener:EventListener,options?:boolean|AddEventListenerOptions){
      if(closed){throw new Error("Listener owner disposed");}
      const capture=typeof options==="boolean"?options:options?.capture===true;
      if(entries.some(e=>e.target===target&&e.type===type&&e.listener===listener&&(typeof e.options==="boolean"?e.options:e.options?.capture===true)===capture)){return;}
      target.addEventListener(type,listener,options);entries.push({target,type,listener,options});
    },
    dispose(){
      closed=true;
      let failure:unknown;
      for(let i=entries.length-1;i>=0;i-=1){const e=entries[i]!;
        try{e.target.removeEventListener(e.type,e.listener,e.options);entries.splice(i,1);}catch(error){failure??=error;}}
      if(failure!==undefined){throw failure;}
    }
  };
};
