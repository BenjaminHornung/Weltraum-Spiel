# Hestia Factory candidate — tested start instructions

This source checkpoint supplies the English ceramic/petrol UI, existing admitted Factory assets and a separate new crashsite art candidate. It is not the completed W09–W11 release: full production/save/restart and native new-hull admission remain open. See STATUS.md and design-qa.md.

## Clean source installation and build

Use Node.js 22 and npm 11.9. From the review ZIP's `source/` folder:

```bash
cd apps/weltraum-browser
npm ci
npm run build
npm exec -- vite preview --host 127.0.0.1 --port 5192 --strictPort
```

These commands were tested in a fresh materialized source copy: installation of the locked 59 packages, TypeScript+Vite build, normal `/` flight entry and `/factory.html` start/workshop smoke. The candidate GLB is actually served from the build with the expected SHA. No dependency was upgraded. An initial cache-only npm invocation failed because one package was not cached; the normal registry/integrity-checked install passed. npm's upgrade notice was not acted on.

Open `/factory.html` on the address printed by Vite. Normal `/` remains the existing flight entry. New game starts a fresh Factory session. Continue is disabled without an admitted save. The public crashsite candidate is not loaded into gameplay; inspect its `.blend`, actual renders or the detached browser-import screenshot in the review.

For development after installation:

```bash
npm run dev -- --host 127.0.0.1 --port 5190 --strictPort
```

The dev and production preview commands ran in this environment. Processes must be restarted in another cloud instance; a disk/source snapshot does not preserve a running server.

## Controls and reviewed paths

| Input | Action |
| --- | --- |
| New game / Open workshop | Enter the fresh paused session and current workshop |
| Play | Explicitly resume admitted physics/input; blocked source/recovery remains visible |
| B | Build view |
| M | Local map |
| Escape | Close/back or pause/menu; closing a panel does not implicitly resume simulation |
| Tab / Shift+Tab | Move focus; open modal captures focus |
| Arrow keys in build preview | Move on the 0.25 m build grid |
| R in build preview | Quarter-turn rotation |
| Views | Choose Cargo, Build, Machines, Power, Technology or Map |
| Cargo choice / Pick up | Intent from current finite published lots; no duplicate action while response pending |
| Recover session, when admitted | Return from actual SimulationHold to confirmed Paused |

Player movement/look still use the existing native HVP controls and their source gates. No teleport, pose helper, collider shrink or free cargo was introduced. This checkpoint exercised UI paths and pause/recovery; it does not claim a completed heavy route or full 16 kg loop. Cloud llvmpipe currently has poor frame times and can enter SimulationHold. Save/load controls are existing source-bound controls; interrupted-production save plus browser-restart acceptance is NOT_RUN here.

## Models

The ZIP includes actual Factory `.blend`/GLB/PNG payloads, not LFS pointers, and all browser runtime sources/public files. Historical unrelated modular-ship art, Git history, old evidence, credentials and node_modules are omitted; the snapshot is explicitly Browser/Factory-scoped. Original project license is preserved in source/LICENSE. New wreck rebuild: `blender -b -t 1 --python art/factory/crashsite-hybrid-v1/build_crashsite.py` from source root; Blender 4.3.2 was used.
