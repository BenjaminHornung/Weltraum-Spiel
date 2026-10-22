export function awaitReadback(promise,signal){
 if(signal.aborted)return Promise.reject(Error('Photo readback interrupted'));
 let interrupted;const stopped=new Promise((resolve,reject)=>{interrupted=()=>reject(Error('Photo readback interrupted'));signal.addEventListener('abort',interrupted,{once:true});});
 return Promise.race([promise,stopped]).finally(()=>signal.removeEventListener('abort',interrupted));
}
export async function resizePhoto(session,width,height,update){
 session.resize(width,height);update();try{await session.settled();}finally{update();}
}
export function photoDeadline(session,interrupt,report,milliseconds=180000){
 const timer=setTimeout(()=>{const cleanup=session.deviceLost();interrupt();void cleanup.then(report,report);},milliseconds);
 return ()=>clearTimeout(timer);
}

export function cleanupPhoto(cleanups,...primary){
 const errors=[...primary];
 for(const cleanup of cleanups){
  try{cleanup();}catch(error){errors.push(error);}
 }
 if(errors.length===1)throw errors[0];
 if(errors.length>1)throw new AggregateError(errors,'Photo cleanup failed',{cause:errors[0]});
}
