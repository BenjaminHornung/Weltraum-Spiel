import {HVP_PLAYER_PROFILE} from "./profile";
type Point=Readonly<{x:number;y:number;z:number}>;
export interface HvpPlayerEyeReceipt {readonly world:string;readonly session:string;readonly epoch:number;readonly terrain:number;readonly moving:number;readonly tick:number}
const same=(a:Point,b:Point)=>Number.isFinite(a.x)&&Number.isFinite(a.y)&&Number.isFinite(a.z)&&Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-5;

/** The worker keeps only eyes it really reported. The ring is private to this world/worker incarnation. */
export function createPublishedPlayerEyes(session:string,now=()=>performance.now()){
  const world=crypto.randomUUID();
  let epoch=0,latest:{tick:number;eye:Point;time:number}|undefined;
  const history=new Array<{token:HvpPlayerEyeReceipt;eye:Point;time:number}|undefined>(256);
  return {
    clear(){epoch++;history.fill(undefined);latest=undefined;},
    record(tick:number,terrain:number,moving:number,eye:Point){
      const time=now();
      if(latest){
        const distance=Math.hypot(eye.x-latest.eye.x,eye.y-latest.eye.y,eye.z-latest.eye.z);
        // A replaced/teleported controller cannot authenticate its previous view. Same-tick movement is never integrated.
        if(tick<latest.tick||tick===latest.tick&&distance>1e-5||distance>.125+HVP_PLAYER_PROFILE.terminalSpeed*Math.max(0,time-latest.time)/1000){
          epoch++;history.fill(undefined);
        }
      }
      const index=tick%history.length,old=history[index];
      if(old&&old.token.tick===tick&&old.token.terrain===terrain&&old.token.moving===moving&&same(old.eye,eye))return old.token;
      const token=Object.freeze({world,session,epoch,terrain,moving,tick});
      const position=Object.freeze({...eye});history[index]={token,eye:position,time};latest={tick,eye:position,time};return token;
    },
    resolve(token:HvpPlayerEyeReceipt,proposed:Point,currentTick:number,terrain:number,moving:number){
      const stored=history[token.tick%history.length];
      if(!stored||!Number.isSafeInteger(token.tick)||token.tick<0||token.tick>currentTick||currentTick-token.tick>=history.length
        ||token.tick!==stored.token.tick||token.session!==session||token.world!==world||token.epoch!==epoch||token.terrain!==terrain||token.moving!==moving
        ||stored.token.terrain!==terrain||stored.token.moving!==moving||now()-stored.time>1500||!same(proposed,stored.eye)){
        throw Error("Augenposition ist nicht mehr für diese Welt bestätigt.");
      }
      return stored.eye;
    }
  };
}
