import { distance } from "../core/vector";
import type { WorldCoordinate } from "./frames";

export type SimulationUpdateMode = "Full" | "Snapshot" | "Dormant";

export interface SimulationBubbleDescriptor {
  readonly id: string;
  readonly center: WorldCoordinate;
  readonly fullUpdateRadius: number;
  readonly snapshotRadius: number;
}

export interface SimulationBubbleEntity {
  readonly id: string;
  readonly absolutePosition: WorldCoordinate;
}

export interface SimulationBubbleMembership {
  readonly entityId: string;
  readonly distanceFromCenter: number;
  readonly updateMode: SimulationUpdateMode;
}

export const createSimulationBubble = (descriptor: SimulationBubbleDescriptor): SimulationBubbleDescriptor => {
  if (!descriptor.id.trim()) {
    throw new Error("Simulation bubble id is required");
  }
  if (descriptor.fullUpdateRadius < 0 || descriptor.snapshotRadius < descriptor.fullUpdateRadius) {
    throw new Error("Simulation bubble radii must satisfy 0 <= fullUpdateRadius <= snapshotRadius");
  }
  if (![descriptor.fullUpdateRadius, descriptor.snapshotRadius].every(Number.isFinite)) {
    throw new Error("Simulation bubble radii must be finite");
  }
  return descriptor;
};

export const determineSimulationBubbleMembership = (
  bubble: SimulationBubbleDescriptor,
  entities: readonly SimulationBubbleEntity[]
): readonly SimulationBubbleMembership[] => {
  const checkedBubble = createSimulationBubble(bubble);
  return entities
    .map((entity) => {
      const distanceFromCenter = distance(checkedBubble.center.value, entity.absolutePosition.value);
      const updateMode: SimulationUpdateMode =
        distanceFromCenter <= checkedBubble.fullUpdateRadius ? "Full" : distanceFromCenter <= checkedBubble.snapshotRadius ? "Snapshot" : "Dormant";
      return { entityId: entity.id, distanceFromCenter, updateMode };
    })
    .sort((a, b) => a.distanceFromCenter - b.distanceFromCenter || a.entityId.localeCompare(b.entityId));
};
