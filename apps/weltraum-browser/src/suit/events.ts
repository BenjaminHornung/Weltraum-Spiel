import { canonicalizeSuitValue, createSuitSignature, deepFreezeSuit, lexicalSuitCompare } from "./canonical";
import { requireDenseSuitArray } from "./denseArray";
import {
  SUIT_EVENT_KINDS, SUIT_EVENT_PHASES,
  type SuitCanonicalValue, type SuitEvent, type SuitEventKind, type SuitEventPhase,
  type SuitSignature, type SuitSourceId, type SuitStateSnapshot
} from "./types";
import { failSuitValidation } from "./errors";
import { createSuitActorId, createSuitEventId, createSuitSourceId, createSuitStateId, createSuitTick } from "./validation";

const phaseRank = new Map<SuitEventPhase, number>(SUIT_EVENT_PHASES.map((phase, index) => [phase, index]));

export interface SuitEventInput {
  readonly kind: SuitEventKind;
  readonly tick: number;
  readonly phase: SuitEventPhase;
  readonly sourceId: string;
  readonly data: { readonly [key: string]: SuitCanonicalValue };
}

export const createSuitEvent = (state: SuitStateSnapshot, input: SuitEventInput): SuitEvent => {
  if (!SUIT_EVENT_KINDS.includes(input.kind)) failSuitValidation("InvalidEnum", "/event/kind", "Event kind is not in the closed registry.");
  if (!SUIT_EVENT_PHASES.includes(input.phase)) failSuitValidation("InvalidEnum", "/event/phase", "Event phase is not in the closed registry.");
  const normalized = {
    kind: input.kind,
    tick: createSuitTick(input.tick, "/event/tick"),
    phase: input.phase,
    actorId: state.actorId,
    stateId: state.stateId,
    sourceId: createSuitSourceId(input.sourceId, "/event/sourceId"),
    data: canonicalizeSuitValue(input.data) as { readonly [key: string]: SuitCanonicalValue }
  };
  const hash = createSuitSignature(normalized).slice("fnv1a32:".length);
  return deepFreezeSuit({ ...normalized, eventId: createSuitEventId(`event:${hash}`) });
};

const validateSuitEvent = (event: SuitEvent): SuitEvent => {
  if (!SUIT_EVENT_KINDS.includes(event.kind)) failSuitValidation("InvalidEnum", "/event/kind", "Event kind is not in the closed registry.");
  if (!SUIT_EVENT_PHASES.includes(event.phase)) failSuitValidation("InvalidEnum", "/event/phase", "Event phase is not in the closed registry.");
  const normalized = {
    kind: event.kind,
    tick: createSuitTick(event.tick, "/event/tick"),
    phase: event.phase,
    actorId: createSuitActorId(event.actorId, "/event/actorId"),
    stateId: createSuitStateId(event.stateId, "/event/stateId"),
    sourceId: createSuitSourceId(event.sourceId, "/event/sourceId"),
    data: canonicalizeSuitValue(event.data) as { readonly [key: string]: SuitCanonicalValue }
  };
  const expectedId = createSuitEventId(`event:${createSuitSignature(normalized).slice("fnv1a32:".length)}`);
  if (createSuitEventId(event.eventId, "/event/eventId") !== expectedId) failSuitValidation("SignatureMismatch", "/event/eventId", "Event ID does not match canonical event content.");
  return deepFreezeSuit({ ...normalized, eventId: expectedId });
};

export const sortSuitEvents = (events: readonly SuitEvent[]): readonly SuitEvent[] => deepFreezeSuit(requireDenseSuitArray(events, "/events").map((event) => validateSuitEvent(event as SuitEvent)).sort((a, b) =>
  a.tick - b.tick
  || (phaseRank.get(a.phase) ?? Number.MAX_SAFE_INTEGER) - (phaseRank.get(b.phase) ?? Number.MAX_SAFE_INTEGER)
  || lexicalSuitCompare(a.actorId, b.actorId)
  || lexicalSuitCompare(a.sourceId, b.sourceId)
  || lexicalSuitCompare(a.eventId, b.eventId)
));

export interface CanonicalSuitEventSequence {
  readonly events: readonly SuitEvent[];
  readonly canonicalJson: string;
  readonly signature: SuitSignature;
}

export const createCanonicalSuitEventSequence = (events: readonly SuitEvent[]): CanonicalSuitEventSequence => {
  const sorted = sortSuitEvents(events);
  return deepFreezeSuit({ events: sorted, canonicalJson: JSON.stringify(canonicalizeSuitValue(sorted)), signature: createSuitSignature(sorted) });
};

export const systemSourceId = (suffix: string): SuitSourceId => createSuitSourceId(`suit:${suffix}`);
