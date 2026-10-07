/** Borrowed nested work: bounded batches avoid one outer plan/timing allocation per scalar. */
export function* borrowedHvpPlanSteps<T>(steps:Generator<unknown,T,unknown>,phase:string|(()=>string)):Generator<string,T,unknown>{
  let failed=false;
  let start=performance.now(),units=0;
  try{for(;;){
    const step=steps.next();if(step.done){return step.value;}
    if(++units>=128||performance.now()-start>=1){yield typeof phase==="string"?phase:phase();start=performance.now();units=0;}
  }}
  catch(error){failed=true;throw error;}
  finally{try{steps.return(undefined as never);}catch(error){if(!failed){throw error;}}}
}
