import { describe, expect, it } from "vitest";
import {
  EventQueueError,
  PersistenceValidationError,
  acknowledgeEvent,
  createEventQueue,
  createPersistenceSignature,
  createStableFixtureId,
  createUniverseClock,
  enqueueEvent,
  type DomainEvent
} from "../../src/persistence";

const eventFixture = (seed: string, tick: number, payload: DomainEvent["payload"] = { fact: seed }): DomainEvent => ({
  eventId: createStableFixtureId("event", seed, 0),
  type: "NeedsPlayerAttention",
  universeTime: createUniverseClock(tick),
  sourceId: createStableFixtureId("ship", "scout", 0),
  targetId: createStableFixtureId("player", "captain", 0),
  severity: "Warning",
  actionRequired: true,
  payload,
  status: "Pending",
  acknowledgedAt: null
});

describe("persistent domain events", () => {
  it("orders queues deterministically by tick and then event ID", () => {
    const later = eventFixture("later", 20);
    const sameTickZ = eventFixture("zeta", 10);
    const sameTickA = eventFixture("alpha", 10);
    const first = [later, sameTickZ, sameTickA].reduce((queue, event) => enqueueEvent(queue, { event }), createEventQueue());
    const second = [sameTickA, later, sameTickZ].reduce((queue, event) => enqueueEvent(queue, { event }), createEventQueue());

    expect(first.events.map((event) => event.eventId)).toEqual([
      "event:alpha.0",
      "event:zeta.0",
      "event:later.0"
    ]);
    expect(second).toEqual(first);
    expect(createPersistenceSignature(second)).toBe(createPersistenceSignature(first));
    expect(Object.isFrozen(first.events)).toBe(true);
  });

  it("treats exact duplicate event data as a no-op and conflicting reuse as an error", () => {
    const event = eventFixture("duplicate", 3);
    const queue = enqueueEvent(createEventQueue(), { event });
    const duplicate = enqueueEvent(queue, { event: JSON.parse(JSON.stringify(event)) as DomainEvent });
    expect(duplicate).toEqual(queue);

    expect(() => enqueueEvent(queue, { event: { ...event, severity: "Critical" } }))
      .toThrowError(expect.objectContaining({ code: "EVENT_ID_CONFLICT" }));
  });

  it("acknowledges only with explicit Universe Time and retains machine facts and actionRequired", () => {
    const original = eventFixture("ack", 3, { reserveKg: 12, nested: { thresholdKg: 15 } });
    const pending = enqueueEvent(createEventQueue(), { event: original });
    const acknowledgedAt = createUniverseClock(9);
    const acknowledged = acknowledgeEvent(pending, { eventId: original.eventId, acknowledgedAt });
    const stored = acknowledged.events[0]!;

    expect(stored).toMatchObject({
      status: "Acknowledged",
      acknowledgedAt,
      actionRequired: true,
      payload: { reserveKg: 12, nested: { thresholdKg: 15 } },
      sourceId: original.sourceId,
      targetId: original.targetId
    });
    expect(acknowledgeEvent(acknowledged, { eventId: original.eventId, acknowledgedAt })).toEqual(acknowledged);
    expect(() => acknowledgeEvent(acknowledged, {
      eventId: original.eventId,
      acknowledgedAt: createUniverseClock(10)
    })).toThrowError(expect.objectContaining({ code: "EVENT_ACKNOWLEDGEMENT_CONFLICT" }));
  });

  it("fails explicitly when acknowledging an absent event", () => {
    expect(() => acknowledgeEvent(createEventQueue(), {
      eventId: createStableFixtureId("event", "missing", 0),
      acknowledgedAt: createUniverseClock(1)
    })).toThrowError(EventQueueError);
  });

  it.each(["title", "summary", "message", "displayText", "localizedText"])(
    "rejects recursively nested UI-truth payload key %s",
    (forbiddenKey) => {
      const payload = { facts: [{ nested: { [forbiddenKey]: "presentation" } }] };
      expect(() => enqueueEvent(createEventQueue(), { event: eventFixture("ui-key", 1, payload) }))
        .toThrowError(PersistenceValidationError);
    }
  );
});
