const groups=['source-guards.mjs','review-regressions.mjs','data-review-regressions.mjs','wiring-regressions.mjs','lifetime-regressions.mjs','native-correction-regressions.mjs'];
let failedGroups=0;
for(const file of groups){
 process.exitCode=0;
 try{await import('./'+file)}catch(error){console.error(file+': '+error.stack);process.exitCode=1}
 if(process.exitCode)failedGroups++;
}
console.log(JSON.stringify({groups:groups.length,failedGroups,fixtureExecutions:0,nativeMethodsInvoked:0,sourceOnly:true,runtimeGrant:'NONE_HOLD'}));process.exitCode=failedGroups?1:0;
