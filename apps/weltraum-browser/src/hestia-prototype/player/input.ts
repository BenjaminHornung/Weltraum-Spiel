import { Euler, Quaternion, Vector3, type PerspectiveCamera } from "three";
import type { HvpPhysicsClient } from "../physics/client";
import { HVP_PLAYER_PROFILE } from "../physics/profile";
import {createHvpListeners} from "../runtime/listeners";
import { createHvpPlayerVisualPose } from "./presentation";

/** Input owns intent, never avatar position. Camera consumes solver readback only. */
export const createHvpPlayerInput = (canvas: HTMLCanvasElement, camera: PerspectiveCamera, physics: HvpPhysicsClient,
  doc: Document = document, win: Pick<Window, "addEventListener" | "removeEventListener"> = window,
  onInspect: () => void = () => {}, tool: {confirm():void;select(mode:number):void} = {confirm:()=>{},select:()=>{}},isBlocked:()=>boolean=()=>false) => {
  const listeners=createHvpListeners();
  const keys = new Set<string>();
  const movementKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "Space"]);
  let active = false;
  let activating = false;
  let disposed = false;
  let yaw = Math.PI;
  let pitch = 0;
  let jump = false;
  let jumpEdges = 0;
  let neutralizations = 0;
  let thirdPerson = false;
  const visual = createHvpPlayerVisualPose();
  const avatarOrientation = new Quaternion();
  const cameraOffset = new Vector3();
  const pivot = new Vector3();
  const aimPoint = new Vector3();
  let aimScreen:Readonly<{x:number;y:number;visible:boolean}>=Object.freeze({x:50,y:50,visible:false});
  let previousTime = performance.now();
  const rotation = new Euler(0, 0, 0, "YXZ");
  const dialog = doc.createElement("dialog");
  dialog.id = "hvp-player-pause";
  dialog.setAttribute("aria-label", "Spiel pausiert");
  const instruction = doc.createElement("p");
  instruction.textContent = "WASD: Gehen · Shift: Sprint · Space: Springen · V: Ego/3. Person · F kurz drücken: Stoß auf einen gelösten Körper (max. 4 m) · Escape: Pause";
  const resumeButton = doc.createElement("button");
  resumeButton.textContent = "Spiel fortsetzen";
  const inspectButton = doc.createElement("button");
  inspectButton.textContent = "Zur Inspektionsansicht";
  dialog.append(instruction, resumeButton, inspectButton); doc.body.append(dialog);
  const error = (value: unknown): void => { doc.body.dataset.hestiaPrototypeInputError = value instanceof Error ? value.message : String(value); };
  const stop = (): void => {
    const wasActive = active;
    active = false; activating = false; keys.clear(); jump = false; neutralizations += 1;
    physics.setPlayerInput({ x: 0, z: 0, sprint: false, jump: false });
    if (doc.pointerLockElement === canvas) { doc.exitPointerLock(); }
    if (wasActive && !disposed) {
      void physics.command("Pause").catch(error);
      if (!dialog.open) { dialog.showModal(); }
    }
  };
  const locked = (): void => {
    if (disposed) { return; }
    if (doc.pointerLockElement !== canvas||isBlocked()) { stop(); return; }
    active = true; activating = true; keys.clear(); jump = false;
    canvas.focus({ preventScroll: true });
    void physics.command("Play").then(() => { activating = false; }).catch(value => { error(value); stop(); });
  };
  const keyDown = (event: KeyboardEvent): void => {
    if (!active || isBlocked() || doc.pointerLockElement !== canvas) { return; }
    if (event.code === "Escape") { event.preventDefault(); stop(); return; }
    if (/^Digit[123]$/.test(event.code)) { event.preventDefault(); if(!event.repeat) { tool.select(Number(event.code.slice(-1))); } return; }
    if (event.code === "KeyV" && !event.repeat) { event.preventDefault(); thirdPerson = !thirdPerson; return; }
    if(event.code==="KeyF") {
      event.preventDefault();
      if(!activating&&!event.repeat) { void physics.impulse(new Vector3(0,0,-1).applyEuler(new Euler(pitch,yaw,0,"YXZ"))).catch(error); }
      return;
    }
    if (!movementKeys.has(event.code)) { return; }
    event.preventDefault();
    if (event.code === "Space" && !event.repeat && !keys.has(event.code)) { jump = true; jumpEdges += 1; }
    keys.add(event.code);
  };
  const keyUp = (event: KeyboardEvent): void => { keys.delete(event.code); };
  const mouseMove = (event: MouseEvent): void => {
    if (!active || isBlocked() || doc.pointerLockElement !== canvas) { return; }
    yaw -= event.movementX * 0.002;
    pitch = Math.max(-1.4, Math.min(1.4, pitch - event.movementY * 0.002));
  };
  const visibility = (): void => { if (doc.hidden) { stop(); } };
  const pointerError = (): void => { error("Pointer Lock nicht verfügbar – bitte erneut auf Spielen klicken."); stop(); };
  const confirm = (event:MouseEvent):void => {
    if(active&&!isBlocked()&&!activating&&doc.pointerLockElement===canvas&&event.button===0) { event.preventDefault();tool.confirm(); }
  };
  const start = (): void => {
    if (disposed || doc.hidden || isBlocked()) { return; }
    delete doc.body.dataset.hestiaPrototypeInputError;
    if (dialog.open) { dialog.close(); }
    // Stay within the real click's user activation; never auto-relock on focus.
    try { void canvas.requestPointerLock()?.catch(error); } catch (value) { error(value); }
  };
  listeners.add(resumeButton,"click",start);
  listeners.add(inspectButton,"click",()=>{dialog.close();onInspect();});
  listeners.add(doc,"pointerlockchange",locked);
  listeners.add(doc,"pointerlockerror",pointerError);
  listeners.add(doc,"visibilitychange",visibility);
  listeners.add(doc,"mousemove",mouseMove as EventListener);
  listeners.add(canvas,"mousedown",confirm as EventListener);
  listeners.add(win,"keydown",keyDown as EventListener);
  listeners.add(win,"keyup",keyUp as EventListener);
  listeners.add(win,"blur",stop);
  return {
    get listenerCount(){return listeners.size;},
    get active() { return active; },
    get thirdPerson() { return thirdPerson; },
    get aimScreen() { return aimScreen; },
    checkpoint(){return Object.freeze({playerYaw:yaw,playerPitch:pitch,thirdPerson});},
    restore(value:Readonly<{playerYaw:number;playerPitch:number;thirdPerson:boolean}>):void{
      if(disposed||active||doc.pointerLockElement===canvas||!Number.isFinite(value.playerYaw)||!Number.isFinite(value.playerPitch)
        ||Math.abs(value.playerPitch)>1.4||typeof value.thirdPerson!=="boolean"){throw new Error("Input restore requires a valid paused view");}
      yaw=value.playerYaw;pitch=value.playerPitch;thirdPerson=value.thirdPerson;keys.clear();jump=false;activating=false;
      const p=physics.read().player;if(p){visual.update(p.position,0,true);}
      avatarOrientation.set(0,Math.sin(yaw/2),0,Math.cos(yaw/2));
      if(dialog.open){dialog.close();}
    },
    toggleView(): void { thirdPerson = !thirdPerson; },
    get visualPosition() { return visual.position; },
    get visualOrientation() { return avatarOrientation; },
    start,
    stop,
    aimAt(target:Readonly<{x:number;y:number;z:number}>):void {
      const p=physics.read().player;
      if(!p||active) { return; }
      const direction=new Vector3(target.x-p.position.x,target.y-p.position.y-0.75,target.z-p.position.z).normalize();
      yaw=Math.atan2(-direction.x,-direction.z);pitch=Math.asin(direction.y);
    },
    readAim() {
      const s=physics.read();
      if(!active||activating||isBlocked()||!s.player||s.status!=="Running"||s.terrainTransaction!=="Idle"||s.neighborTransaction!=="Idle"||s.bodyResidencyTransaction!=="Idle") { return undefined; }
      return {origin:new Vector3(s.player.position.x,s.player.position.y+0.75,s.player.position.z),
        direction:new Vector3(0,0,-1).applyEuler(new Euler(pitch,yaw,0,"YXZ"))};
    },
    update(): void {
      if (disposed) { return; }
      if(isBlocked()&&active){stop();}
      const now = performance.now();
      const dt = Math.max(0, Math.min(0.1, (now - previousTime) / 1000)); previousTime = now;
      const state = physics.read();
      const p = state.player;
      if (p !== null) { visual.update(p.position, dt, !active || activating); }
      avatarOrientation.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
      doc.body.dataset.hestiaPrototypePlayerView = thirdPerson ? "ThirdPerson" : "FirstPerson";
      doc.body.dataset.hestiaPrototypeInput = JSON.stringify({ owner: active ? "Player" : "Inspection",
        locked: doc.pointerLockElement === canvas, jumpEdges, neutralizations, pressedKeys: [...keys] });
      if (!active || activating) { return; }
      if (state.terrainTransaction !== "Idle" || state.neighborTransaction!=="Idle" || state.bodyResidencyTransaction!=="Idle" || state.status==="CoverageHold" || (state.structural&&state.structural.state!=="Idle")
        ||(state.moving&&["PreparedHeld","CommittedHeld","RecoveryHold"].includes(state.moving.state))) { return; }
      if (state.status !== "Running") { stop(); return; }
      if (p === null) { return; }
      const x = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
      const z = Number(keys.has("KeyS")) - Number(keys.has("KeyW"));
      const norm = Math.max(1, Math.hypot(x, z));
      physics.setPlayerInput({ x: (x * Math.cos(yaw) + z * Math.sin(yaw)) / norm,
        z: (z * Math.cos(yaw) - x * Math.sin(yaw)) / norm,
        sprint: keys.has("ShiftLeft") || keys.has("ShiftRight"), jump });
      jump = false;
      rotation.set(pitch, yaw, 0); camera.quaternion.setFromEuler(rotation);
      if (thirdPerson) {
        pivot.copy(visual.position); pivot.y += 0.6;
        cameraOffset.set(0, 0.6, 3.2).applyQuaternion(camera.quaternion);
        physics.setCameraOffset(cameraOffset);
        camera.position.copy(pivot).addScaledVector(cameraOffset, p.cameraFraction);
        camera.lookAt(pivot);
      } else {
        physics.setCameraOffset();
        camera.position.copy(visual.position);
        camera.position.y += HVP_PLAYER_PROFILE.eyeHeight - HVP_PLAYER_PROFILE.height / 2;
      }
      camera.fov = 60; camera.updateProjectionMatrix();
      // Project the native contact, not a guessed screen-centre ray (third person has parallax).
      if(state.impulseTarget?.point){aimPoint.copy(state.impulseTarget.point);}
      else{aimPoint.set(0,0,-1).applyEuler(rotation).multiplyScalar(4).add(new Vector3(p.position.x,p.position.y+.75,p.position.z));}
      camera.updateMatrixWorld();aimPoint.project(camera);
      aimScreen=Object.freeze({x:(aimPoint.x+1)*50,y:(1-aimPoint.y)*50,
        visible:Math.abs(aimPoint.x)<=1&&Math.abs(aimPoint.y)<=1&&aimPoint.z>=-1&&aimPoint.z<=1});
      doc.body.dataset.hestiaPrototypePlayerCamera = JSON.stringify({ position: camera.position.toArray(), orientation: camera.quaternion.toArray(),
        visualBody: visual.position.toArray(), heightMeters: HVP_PLAYER_PROFILE.height, view: thirdPerson ? "ThirdPerson" : "FirstPerson" });
    },
    dispose(): void {
      if (disposed) { return; }
      disposed = true; stop();
      listeners.dispose();
      dialog.remove();
    }
  };
};
