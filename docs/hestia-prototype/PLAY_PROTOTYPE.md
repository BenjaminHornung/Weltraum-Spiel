# Hestia prototype: start and play

This is the bounded browser prototype, not a complete planet or an accepted
concept-art match. Use `apps/weltraum-browser` in the feature checkout.

## Start

Use Node **22** with the existing lockfile:

```text
npm ci
npm run build
npm exec -- vite preview --host 127.0.0.1 --port 5173 --strictPort
```

Open **http://127.0.0.1:5173/?hestiaPrototype=1** in a browser with WebGL2,
WebAssembly, workers and Pointer Lock. The normal `/` route remains the separate
flight application. `State: Ready` means the current admitted scene and collision
are installed; it does not mean all art/performance acceptance gates passed.

## Move and inspect

- Click **Spielen · WASD / Maus / Space** to acquire Pointer Lock.
- **WASD:** move; **Shift:** sprint; **Space:** grounded jump; **mouse:** look.
- **V:** first/third person. The visible suit is 1.80 m tall. The solver capsule,
  not the camera model, owns movement and collision.
- **Escape:** pause and release the pointer. Resume with a real click on
  **Spiel fortsetzen**, or select **Zur Inspektionsansicht**.
- Camera presets and **Inspect** are inspection controls, not avatar teleportation.
- Losing focus pauses/neutralizes input. Returning to the tab never captures the
  pointer or resumes walking automatically.

If the browser refuses Pointer Lock, the error is visible. Try a normal browser
window and a real click; there is no fake fly-camera fallback presented as walking.

## Cut and push

- **1:** one canonical cell; **2:** half-metre box; **3:** terrain sphere.
- **Left click:** confirm the current cutter target within four metres. Acquisition
  clicks do not cut. Preview, Pending, Rejected and RecoveryHold are distinct.
- **F:** a bounded impulse at an actual unobscured solver contact, not a position
  change. Use some distance to push a grounded piece rather than pinning it down.
  Press briefly, release, and press again if needed: it is a push, not grab/drag.
  The target dot turns green for a movable body; the player hint names the target,
  mass and range. Fixed ground and anchored trees do not move with F. In third
  person the dot is projected from the actual solver contact, not a guessed
  centre-screen hit. The debug panel is hidden while walking; Escape restores it.
- Terrain edits are bounded to the SafeQuarry and the authored rock-arm support.
  **Ansicht: Schnittstelle** and **Stütze anvisieren (2 + Klick)** help orient the
  view, but only real player input performs a cut.
- **Neustart: Felsarm** explicitly starts a new session near the support. Its roof
  is real canonical terrain; removing support can transfer it to a falling body.
- The authored timber arm can be detached with the box tool. Its foliage follows
  the actual surviving support owner. Released timber and rock support cell/box
  recuts with current native motion.

Dynamic sphere cuts and arbitrary hero-tree destruction are not implemented.
Do not interpret a rejected command or a no-op as successful destruction. A new
scenario asks before discarding unsaved session changes; it does not erase saves.

### First successful push

In the ordinary starting scenario, stay near the spawn: select **L-Körper
anvisieren (F)**, then **Spielen · WASD / Maus / Space**. When the target reads
**L-Holzkörper** and the dot is green, press **F** briefly. The small wooden body
receives a real impulse; the status says **Stoß ausgelöst**. A 300 kg stone moves
less than the 35 kg timber under the same capped impulse. If you have walked to
the eastern region, that original body is far away: the aim button does not
teleport either you or the body. Approach a loose piece or use a separately
confirmed new scenario; do not discard an unsaved session just to aim.

## Play the salvage task

Click **Neuer Bergungsauftrag**, confirm the new session, then follow the separate
goal panel: approach the site, cut the marked link, use real contact impulses to
move the light timber cargo into the blue depot, let it settle, then save.

The four goals consume actual world/cut/storage receipts. Merely clicking a
button does not complete them. Partial progress can be saved and reopened.
Failed storage does not complete the final goal or replace the previous save.

## Save and load

- **Spielstand speichern:** pause and persist a confirmed generation.
- **Spielstand laden:** prepare and validate the saved candidate while keeping
  the old scene alive until replacement can publish safely.
- **Gespeicherte Sitzung neu öffnen:** confirm a fresh document/session from the
  stored artifact. No live camera, generator closure or console variable is needed.

Hestia uses its own IndexedDB database `weltraum-hestia-prototype-v1` and slot
`hvp-primary`, separate from flight saves. Source cells, body motion, material
ownership, input/view preferences, command receipts and salvage progress are
stored. Loading starts paused and unlocked. Keep the same browser profile and
origin; another port/host has different browser storage.

Quota, revision conflicts, invalid profiles and malformed artifacts fail closed.
The existing 16 MiB repository payload limit remains in effect. A successful
save advances the slot revision; no automatic overwrite retry bypasses a conflict.

## Regions and recovery

**Neustart: Ostpfad** starts near the eastern route. Walk into the adjacent region
only after canonical collision and presentation are admitted. Render LOD changes
do not coarsen editable cells or collision. Awake bodies pin needed coverage;
distant sleeping terrain fragments can be checkpointed and later rehydrated.

- **CoverageHold:** required confirmed collision is missing. Do not treat it as
  known air. Region status explains Pending/failure; the retry control is explicit.
- **SimulationHold:** the bounded fixed-step clock could not catch up. Inspect the
  status before explicitly continuing. The prototype never silently raises the
  four-step cap or discards time without recording it.
- **RecoveryHold:** rollback could not be proven. Do not keep issuing commands;
  reopen the last valid stored session or start a confirmed new session.
- If loading fails, the previous save is not promoted or silently replaced.

## Current limits and verification

The global caps remain 500,000 triangles, 300 draw groups, 256 MiB controlled CPU
payloads, 128 MiB retained mesh payloads, two heavy preparation jobs, and 32 active /
64 resident dynamic bodies. These are admission limits, not measured FPS promises.
Native/GPU driver memory and hardware acceptance are separate from logical bytes.

The local HVP-13 checkpoint passed 1,781 unit tests and 31 HVP browser cases,
including real cuts, moving recuts, storage failures, salvage, region round trips
and dormant-body restore. HVP-14 measurements, manual new-user usability and final
owner art acceptance are tracked separately in
`docs/architecture/hvp-playable-prototype-execplan.md`. Improved screenshots are
not a substitute for those decisions. There is no automatic merge or golden
baseline promotion.
