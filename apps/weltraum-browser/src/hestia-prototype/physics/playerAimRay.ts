import { R, isHvpSolidNonKinematicCollider } from "./rapierPort";

type Vec = Readonly<{ x: number; y: number; z: number }>;
export type HvpPlayerContact = ReturnType<R.World["castRay"]>;

/** First solid terrain or dynamic contact. Consumers share it only within one synchronous aim command. */
export function castHvpPlayerRay(world: R.World, eye: Vec, direction: Vec): HvpPlayerContact {
  world.updateSceneQueries();
  return world.castRay(new R.Ray(eye, direction), 4, true, undefined, undefined, undefined, undefined, isHvpSolidNonKinematicCollider);
}
