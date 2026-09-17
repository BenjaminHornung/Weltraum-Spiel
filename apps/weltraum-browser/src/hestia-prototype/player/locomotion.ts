import { R, isHvpSolidCollider, isHvpStaticCollider } from "../physics/rapierPort";
import { HVP_PHYSICS_DT } from "../physics/tick";
import { HVP_PLAYER_PROFILE,HVP_PLAYER_PROFILE_DIGEST as profileDigest,validateHvpPlayerCheckpoint,type HvpPlayerCheckpoint } from "../physics/profile";
export { HVP_PLAYER_PROFILE,type HvpPlayerCheckpoint } from "../physics/profile";
export interface HvpPlayerInput { readonly x: number; readonly z: number; readonly sprint: boolean; readonly jump: boolean }
export interface HvpCollisionCoverage { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }

export const createHvpLocomotion = (world: R.World, spawn: Readonly<{ x: number; y: number; z: number }>,
  gravity: number, covered: (x: number, z: number) => boolean, saved?:HvpPlayerCheckpoint) => {
  if (![spawn.x, spawn.y, spawn.z, gravity].every(Number.isFinite) || gravity <= 0) { throw new RangeError("Invalid player admission"); }
  if(saved){validateHvpPlayerCheckpoint(saved,gravity);}
  const initial=saved?.position??spawn;
  const profile = HVP_PLAYER_PROFILE;
  const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(initial.x, initial.y, initial.z));
  const collider = world.createCollider(R.ColliderDesc.capsule(profile.height / 2 - profile.radius, profile.radius).setDensity(0), body);
  const controller = world.createCharacterController(profile.offset);
  controller.enableAutostep(profile.stepHeight, profile.stepWidth, false);
  controller.enableSnapToGround(0.25);
  controller.setMaxSlopeClimbAngle(profile.slopeRadians);
  controller.setMinSlopeSlideAngle(profile.slopeRadians);
  controller.setApplyImpulsesToDynamicBodies(false);
  let input: HvpPlayerInput = { x: 0, z: 0, sprint: false, jump: false };
  let jumpPending = false;
  let enabled = false;
  let grounded = saved?.grounded??false;
  let velocityY = saved?.velocityY??0;
  let jumpCount = saved?.jumpCount??0;
  let disposed = false;
  let coverageHold = saved?.coverageHold??false;
  let cameraFraction = 1;
  const neutralize = (): void => { input = { x: 0, z: 0, sprint: false, jump: false }; jumpPending = false; };
  return {
    setCameraOffset(offset?: Readonly<{ x: number; y: number; z: number }>): void {
      cameraFraction = 1;
      if (offset === undefined || disposed) { return; }
      const length = Math.hypot(offset.x, offset.y, offset.z);
      if (![offset.x, offset.y, offset.z].every(Number.isFinite) || length > 6) { throw new RangeError("Invalid camera clearance query"); }
      if (length === 0) { return; }
      const p = body.translation();
      const hit = world.castShape({ x: p.x, y: p.y + 0.6, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, offset,
        new R.Ball(0.15), 1, true, undefined, undefined, collider, body, isHvpSolidCollider);
      if (hit !== null) { cameraFraction = Math.max(0, hit.toi - 0.1 / length); }
    },
    setEnabled(value: boolean): void { enabled = value; neutralize(); },
    checkpoint():HvpPlayerCheckpoint {
      if(disposed||enabled){throw new Error("Player checkpoint requires a paused live owner");}
      return Object.freeze({version:"hvp-player-checkpoint-v1",profileDigest,gravity,position:Object.freeze({...body.translation()}),grounded,velocityY,jumpCount,coverageHold});
    },
    setInput(value: HvpPlayerInput): void {
      if (![value.x, value.z].every(Number.isFinite) || Math.abs(value.x) > 1 || Math.abs(value.z) > 1
        || typeof value.sprint !== "boolean" || typeof value.jump !== "boolean") { throw new RangeError("Invalid player input"); }
      if (!enabled || disposed) { return; }
      input = { ...value }; jumpPending ||= value.jump;
    },
    step(): void {
      if (disposed || !enabled) { return; }
      const dt = HVP_PHYSICS_DT;
      const speed = input.sprint ? profile.sprintSpeed : profile.walkSpeed;
      const norm = Math.max(1, Math.hypot(input.x, input.z));
      const dx = input.x / norm * speed * dt, dz = input.z / norm * speed * dt;
      const position = body.translation();
      const radius = profile.radius + profile.offset;
      coverageHold = [-radius, radius].some(x => [-radius, radius].some(z => !covered(position.x + dx + x, position.z + dz + z)));
      if (coverageHold) { velocityY = 0; jumpPending = false; return; }
      if (jumpPending && grounded) { velocityY = Math.sqrt(2 * gravity * profile.jumpHeight); grounded = false; jumpCount += 1; }
      jumpPending = false;
      velocityY = Math.max(-profile.terminalSpeed, velocityY - gravity * dt);
      const desired = { x: dx, y: velocityY * dt, z: dz };
      controller.computeColliderMovement(collider, desired, undefined, undefined, isHvpSolidCollider);
      const movement = controller.computedMovement();
      // A capsule can span multiple narrow voxel treads that native autostep
      // treats as one steep obstacle. Sweep the same capsule up/forward/down;
      // never lift through ceilings, cross tall ledges, or synthesize a floor.
      if (grounded && velocityY <= 0 && Math.hypot(dx, dz) > 0
        && movement.x * dx + movement.z * dz < (dx * dx + dz * dz) * 0.5) {
        const cast = (at: R.Vector, delta: R.Vector) => world.castShape(at, body.rotation(), delta, collider.shape, 1, true,
          undefined, undefined, collider, body, isHvpStaticCollider);
        const up = { x: position.x, y: position.y + profile.stepHeight, z: position.z };
        const forward = { x: up.x + dx, y: up.y, z: up.z + dz };
        if (cast(position, { x: 0, y: profile.stepHeight, z: 0 }) === null
          && cast(up, { x: dx, y: 0, z: dz }) === null) {
          const down = cast(forward, { x: 0, y: -profile.stepHeight, z: 0 });
          const length = Math.hypot(dx, dz);
          // Use the actual tread normal, not the capsule/corner contact normal
          // (a horizontal voxel tread can produce a >45-degree corner contact).
          const tread = world.castRayAndGetNormal(new R.Ray({
            x: forward.x + dx / length * profile.radius,
            y: up.y + profile.height / 2,
            z: forward.z + dz / length * profile.radius
          }, { x: 0, y: -1, z: 0 }), profile.height + profile.stepHeight * 2, true,
           undefined, undefined, collider, body, isHvpStaticCollider);
          if (down !== null && tread !== null && tread.normal.y >= Math.cos(profile.slopeRadians) - 0.0001
            && up.y + profile.height / 2 - tread.toi - (position.y - profile.height / 2) <= profile.stepHeight) {
            const rise = profile.stepHeight * (1 - down.toi);
            if (rise > 0 && rise + profile.offset <= profile.stepHeight) {
              movement.x = dx; movement.z = dz; movement.y = rise + profile.offset;
            }
          }
        }
      }
      grounded = controller.computedGrounded();
      if ((grounded && velocityY < 0) || (velocityY > 0 && movement.y < desired.y - 0.0001)) { velocityY = 0; }
      body.setNextKinematicTranslation({ x: position.x + movement.x, y: position.y + movement.y, z: position.z + movement.z });
    },
    read: () => Object.freeze({ ownerId: "hvp:player", position: Object.freeze({ ...body.translation() }),
      grounded, velocityY, jumpCount, cameraFraction, status: enabled ? coverageHold ? "CoverageHold" : "Walking" : "Inspection" }),
    dispose(): void {
      if (disposed) { return; }
      disposed = true; neutralize(); world.removeCharacterController(controller); world.removeRigidBody(body);
    }
  };
};
