/** Finite diagnostic queries only. Missing/disjoint timers are null, never zero or qualification. */
export function createDiagnosticTimer(gl:WebGL2RenderingContext|null){
 const extension=gl?.getExtension('EXT_disjoint_timer_query_webgl2');
 const pending:{name:string;query:WebGLQuery}[]=[],results:{name:string;status:string;milliseconds:number|null}[]=[];
 let issued=0,disposed=false;
 return {
  measure<T>(name:string,work:()=>T):T {
   if(disposed||!gl||!extension||issued>=48)return work();
   const query=gl.createQuery();if(!query)return work();issued++;gl.beginQuery(extension.TIME_ELAPSED_EXT,query);
   try{return work();}finally{gl.endQuery(extension.TIME_ELAPSED_EXT);pending.push({name,query});}
  },
  poll(){if(!gl||!extension)return;
   const disjoint=Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT));
   for(let i=pending.length-1;i>=0;i--){const item=pending[i];
    if(disjoint||gl.getQueryParameter(item.query,gl.QUERY_RESULT_AVAILABLE)){
     const ns=disjoint?null:gl.getQueryParameter(item.query,gl.QUERY_RESULT);
     results.push({name:item.name,status:disjoint?'DISJOINT':typeof ns==='number'&&Number.isFinite(ns)?'DIAGNOSTIC':'UNAVAILABLE',milliseconds:typeof ns==='number'&&Number.isFinite(ns)?ns/1e6:null});
     gl.deleteQuery(item.query);pending.splice(i,1);
    }
   }
  },
  read(){return {status:!gl||!extension?'UNAVAILABLE':results.length?'DIAGNOSTIC_UNQUALIFIED':'PENDING',results:[...results],maxQueries:48,referenceAcceptance:false};},
  dispose(){if(disposed)return;disposed=true;if(gl)for(const item of pending)gl.deleteQuery(item.query);pending.length=0;}
 };
}
