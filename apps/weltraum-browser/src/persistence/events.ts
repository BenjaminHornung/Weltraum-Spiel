import { serializeCanonicalPersistenceValue } from "./canonical";
import { parseEventId, type EventId } from "./ids";
import { validateDomainEvent, validateEventQueueSnapshot } from "./saveSchema";
import { validateUniverseTime, type UniverseTime } from "./time";
import type { DomainEvent, EventQueueSnapshot } from "./types";

export type EventQueueErrorCode = "EVENT_ID_CONFLICT" | "EVENT_NOT_FOUND" | "EVENT_ACKNOWLEDGEMENT_CONFLICT";

export class EventQueueError extends Error {
  public constructor(
    public readonly code: EventQueueErrorCode,
    public readonly eventId: EventId,
    message: string
  ) {
    super(message);
    this.name = "EventQueueError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface EnqueueEventCommand {
  readonly event: DomainEvent;
}

export interface AcknowledgeEventCommand {
  readonly eventId: EventId;
  readonly acknowledgedAt: UniverseTime;
}

export const createEventQueue = (events: readonly DomainEvent[] = []): EventQueueSnapshot =>
  validateEventQueueSnapshot({ events });

/** Inserts by Universe tick then event ID; exact duplicate data is idempotent. */
export const enqueueEvent = (queue: EventQueueSnapshot, command: EnqueueEventCommand): EventQueueSnapshot => {
  const source = validateEventQueueSnapshot(queue);
  const event = validateDomainEvent(command.event);
  const existing = source.events.find((candidate) => candidate.eventId === event.eventId);
  if (existing !== undefined) {
    if (serializeCanonicalPersistenceValue(existing) === serializeCanonicalPersistenceValue(event)) {
      return source;
    }
    throw new EventQueueError("EVENT_ID_CONFLICT", event.eventId, "Event ID is already used by different event data.");
  }
  return validateEventQueueSnapshot({ events: [...source.events, event] });
};

/** Records only an explicit Universe Time and retains the event and actionRequired flag. */
export const acknowledgeEvent = (
  queue: EventQueueSnapshot,
  command: AcknowledgeEventCommand
): EventQueueSnapshot => {
  const source = validateEventQueueSnapshot(queue);
  const eventId = parseEventId(command.eventId, "/eventId");
  const acknowledgedAt = validateUniverseTime(command.acknowledgedAt, "/acknowledgedAt");
  const index = source.events.findIndex((event) => event.eventId === eventId);
  if (index < 0) {
    throw new EventQueueError("EVENT_NOT_FOUND", eventId, "Event to acknowledge was not found.");
  }
  const event = source.events[index]!;
  if (event.status === "Acknowledged") {
    if (serializeCanonicalPersistenceValue(event.acknowledgedAt) === serializeCanonicalPersistenceValue(acknowledgedAt)) {
      return source;
    }
    throw new EventQueueError(
      "EVENT_ACKNOWLEDGEMENT_CONFLICT",
      eventId,
      "Event was already acknowledged at a different Universe Time."
    );
  }
  const events = source.events.map((candidate, candidateIndex) => candidateIndex === index
    ? { ...candidate, status: "Acknowledged" as const, acknowledgedAt }
    : candidate);
  return validateEventQueueSnapshot({ events });
};
