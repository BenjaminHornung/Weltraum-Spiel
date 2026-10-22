import { expect, it } from "vitest";
import { createFp02Fixture } from "../../../src/factory/catalog/fp02Catalog";
import { mountFactorySession } from "../../../src/factory/session/factorySession";
import type { FactoryHostPort, FactoryHostView } from "../../../src/factory/session/hostPort";
import type { FactoryDecodedCheckpointV1 } from "../../../src/factory/persistence/factoryCheckpoint";

it("rejects a fabricated decoded owner before claiming the Host mount", async () => {
  const catalog = createFp02Fixture("cargo").catalog;
  const view: FactoryHostView = { sessionId: "restore-owner-test", epoch: 1, nativeTick: 0, physicsStatus: "Paused", confirmed: true,
    terrain: { epoch: 1, revision: 0, sourceDigest: "source", baseDigest: "base", cellMeters: 0.125,
      originMeters: { x: -12, y: 0, z: -12 }, sizeX: 192, sizeY: 64, sizeZ: 192 } };
  const listeners = new Set<(header: FactoryHostView) => void>();
  const host: FactoryHostPort = { current: () => true, read: () => view, readTerrainSlot: () => undefined,
    subscribeConfirmed: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    pause: async () => view, resume: async () => view };
  const fabricated = Object.freeze({ checkpoint: {}, native: {}, material: {}, decodeWorkingBytes: 0, cpuWorkingBytes: 0 }) as FactoryDecodedCheckpointV1;

  await expect(mountFactorySession(host, catalog, fabricated)).rejects.toThrow(/Unvalidated Factory restore candidate/);
  expect(listeners.size).toBe(0);
  const fresh = await mountFactorySession(host, catalog);
  expect(listeners.size).toBe(1);
  await fresh.dispose();
  expect(listeners.size).toBe(0);
});

it("does not read a caller checkpoint getter before issued-checkpoint validation", async () => {
  const catalog = createFp02Fixture("cargo").catalog;
  const view: FactoryHostView = { sessionId: "restore-owner-getter-test", epoch: 1, nativeTick: 0, physicsStatus: "Paused", confirmed: true,
    terrain: { epoch: 1, revision: 0, sourceDigest: "source", baseDigest: "base", cellMeters: 0.125,
      originMeters: { x: -12, y: 0, z: -12 }, sizeX: 192, sizeY: 64, sizeZ: 192 } };
  const listeners = new Set<(header: FactoryHostView) => void>();
  const host: FactoryHostPort = { current: () => true, read: () => view, readTerrainSlot: () => undefined,
    subscribeConfirmed: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    pause: async () => view, resume: async () => view };
  let getterCalls = 0;
  const fabricated = Object.freeze({ get checkpoint() { getterCalls++; throw new Error("Caller checkpoint getter executed"); },
    native: {}, material: {}, decodeWorkingBytes: 0, cpuWorkingBytes: 0 }) as unknown as FactoryDecodedCheckpointV1;

  await expect(mountFactorySession(host, catalog, fabricated)).rejects.toThrow(/Unvalidated Factory restore candidate/);
  expect(getterCalls).toBe(0);
  expect(listeners.size).toBe(0);
});
