// NOT_RUN: prepared source/expected cases only. Synthetic authored fixture, no native/browser/HVP proof.
import { beforeAll, expect, it } from "vitest";
import { createMemorySaveRepository } from "../../lab6128-r4-contract-r01/inputs/a0-6128/apps/weltraum-browser/src/browser-storage/memorySaveRepository";
import { createHvpSaveStoreCore } from "../../lab6128-r4-contract-r01/inputs/a0-6128/apps/weltraum-browser/src/hestia-prototype/persistence/phy01LabSave";
import { decodeHvpGame, decodeHvpLabGame, decodeHvpColdLabGame, assertHvpDecodedLabGame, assertHvpDecodedGame } from "../../lab6128-r4-contract-r01/inputs/a0-6128/apps/weltraum-browser/src/hestia-prototype/persistence/gameCheckpoint";
import { HVP_SOLVER_PROFILE } from "../../lab6128-r4-contract-r01/inputs/a0-6128/apps/weltraum-browser/src/hestia-prototype/physics/profile";
import { createPersistenceSignature } from "../../lab6128-r4-contract-r01/inputs/a0-6128/apps/weltraum-browser/src/persistence/canonical";
import { createSyntheticAuthoredCodecFixtures } from "../../lab6128-r4-contract-r01/inputs/a0-6128/apps/weltraum-browser/tests/fixtures/phy01LabCodecFixtures";
let fixtures;
beforeAll(() => { fixtures = createSyntheticAuthoredCodecFixtures(); });
const resign = (value) => { const { signature: _signature, ...data } = value; return { ...value, signature: createPersistenceSignature(data) }; };
const slot = "phy03-modern-r01-r4-contract";
const ownedStore = () => createHvpSaveStoreCore(createMemorySaveRepository([]), { defaultSlot: slot, slot: id => {
        if (id !== slot)
            throw new Error("Task-owned slot required");
        return id;
    }, decode: decodeHvpLabGame, decodeCold: decodeHvpColdLabGame });
it("R4-P01: current LAB reads actual21 typed context and preserves legacy labels separately", () => {
    const legacyBytes = JSON.stringify(fixtures.legacy), lab = decodeHvpLabGame(fixtures.lab), legacy = decodeHvpGame(fixtures.legacy);
    expect(lab.checkpoint.profiles.solver).toEqual(HVP_SOLVER_PROFILE);
    expect(lab.checkpoint.world.solver).toBe(HVP_SOLVER_PROFILE.id);
    expect(legacy.checkpoint.world.solver).toBe("rapier-0.12.0");
    expect(JSON.stringify(fixtures.legacy)).toBe(legacyBytes);
    expect(() => decodeHvpLabGame(fixtures.legacy)).toThrow();
    expect(() => decodeHvpGame(fixtures.lab)).toThrow();
});
it("R4-P02: full profile/world/signature negatives cannot silently select gyro or vanilla21", () => {
    for (const patch of [{ dynamicGyroscopicForces: true }, { id: "rapier-0.21.0" }, { sourceProfile: "rapier-0.21.0" }]) {
        const value = structuredClone(fixtures.lab);
        Reflect.set(value.profiles, "solver", { ...HVP_SOLVER_PROFILE, ...patch });
        expect(() => decodeHvpLabGame(resign(value))).toThrow();
    }
    const world = structuredClone(fixtures.lab);
    Reflect.set(world.world, "solver", "rapier-0.12.0");
    expect(() => decodeHvpLabGame(resign(world))).toThrow();
    expect(() => decodeHvpLabGame({ ...fixtures.lab, signature: "forged" })).toThrow();
});
it("R4-P03: decoded brands are actual issued LAB context, never copied/public context", () => {
    const lab = decodeHvpLabGame(fixtures.lab), legacy = decodeHvpGame(fixtures.legacy);
    expect(() => assertHvpDecodedLabGame(lab)).not.toThrow();
    expect(() => assertHvpDecodedGame(lab)).toThrow();
    expect(() => assertHvpDecodedLabGame(legacy)).toThrow();
    expect(() => assertHvpDecodedLabGame({ ...lab })).toThrow();
});
it("R4-P04: Cold callback is accounted admission, with no public/legacy cross-admission", () => {
    const warm = decodeHvpLabGame(fixtures.lab), admissions = [];
    const cold = decodeHvpColdLabGame(fixtures.lab, n => admissions.push(n));
    expect(admissions).toEqual([warm.decodeWorkingBytes]);
    expect(cold.game.checkpoint).toEqual(warm.checkpoint);
    const rejected = [];
    expect(() => decodeHvpColdLabGame(fixtures.legacy, n => rejected.push(n))).toThrow();
    expect(rejected).toEqual([]);
});
it("R4-P05: pure source/frame/material/motion/COM/inertia/surface values agree across warm and Cold decoders", () => {
    const warm = decodeHvpLabGame(fixtures.lab), cold = decodeHvpColdLabGame(fixtures.lab, () => { }).game;
    expect(cold.world.bodies.length).toBe(warm.world.bodies.length);
    for (let i = 0; i < warm.world.bodies.length; i++) {
        const a = warm.world.bodies[i], b = cold.world.bodies[i];
        expect(b.checkpoint).toEqual(a.checkpoint);
        expect(b.motion).toEqual(a.motion);
        expect(b.recipe.source).toEqual(a.recipe.source);
        expect(b.recipe.mass).toEqual(a.recipe.mass);
        expect(b.recipe.axes).toEqual(a.recipe.axes);
        expect(b.recipe.colliders).toEqual(a.recipe.colliders);
    }
});
it("R4-P06: source/collider surface mismatch, corrupted motion transport and invalid surfaces remain rejected", () => {
    const surfaces = structuredClone(fixtures.lab);
    Reflect.set(surfaces.world.bodies[0], "surfaces", []);
    expect(() => decodeHvpLabGame(resign(surfaces))).toThrow();
    const material = structuredClone(fixtures.lab);
    Reflect.set(material.world.bodies[0].surfaces[0], "restitution", 2);
    expect(() => decodeHvpLabGame(resign(material))).toThrow();
    const motion = structuredClone(fixtures.lab), region = JSON.parse(motion.world.bodies[0].region);
    region.motions[0].linvelMetersPerSecond.x = null;
    Reflect.set(motion.world.bodies[0], "region", JSON.stringify(region));
    expect(() => decodeHvpLabGame(resign(motion))).toThrow();
});
it("R4-P07: existing SaveGameEnvelope/bundle path imports into an explicit owned memory slot and resaves with CAS", async () => {
    const first = ownedStore(), second = ownedStore();
    await first.initialize();
    await second.initialize();
    try {
        await first.save(fixtures.lab, null);
        const bundle = await first.export();
        await second.import(bundle, { kind: "CreateNewSlot", targetSlotId: slot });
        const loaded = await second.load();
        expect(loaded.game.checkpoint).toEqual(fixtures.lab);
        expect((await second.export()).canonicalPayload).toBe(bundle.canonicalPayload);
        await second.save(loaded.game.checkpoint, loaded.metadata.recordRevision);
        expect((await second.load()).metadata.recordRevision).toBe(2);
        const before = await second.export();
        await expect(second.save(fixtures.lab, 1)).rejects.toMatchObject({ code: "RevisionConflict" });
        await expect(second.import(bundle, { kind: "CreateNewSlot", targetSlotId: "hvp-primary" })).rejects.toThrow();
        expect(await second.export()).toEqual(before);
    }
    finally {
        await first.close();
        await second.close();
    }
});
it("R4-P08: tampered transport is rejected before publishing an owned memory record", async () => {
    const source = ownedStore(), target = ownedStore();
    await source.initialize();
    await target.initialize();
    try {
        await source.save(fixtures.lab, null);
        const bundle = await source.export();
        await expect(target.import({ ...bundle, contentHash: "sha256:" + "0".repeat(64) }, { kind: "CreateNewSlot", targetSlotId: slot })).rejects.toThrow();
        expect(await target.list()).toEqual({ slots: [] });
    }
    finally {
        await source.close();
        await target.close();
    }
});
