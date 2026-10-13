# Run this checkpoint

Partial prototype, not accepted W09–W11. The large crashsite model is an authoring/runtime candidate; it has not replaced the native cargo owner in the game. Factory common Save/Continue is not implemented/accepted.

Tested Node22.23.3, npm11.9.0. From the supplied source folder:

```sh
cd apps/weltraum-browser
npm ci --cache /tmp/hestia-fp06-npm-cache-2026-10-13
npm run build
npm exec -- vite preview --host 127.0.0.1 --port 5194 --strictPort
```

Open http://127.0.0.1:5194/factory.html; normal entry http://127.0.0.1:5194/. Actual fresh-copy install59packages/build/both-browser-entry startup passed. The first default npm-cache attempt failed because /home/agent/.npm was unavailable; the explicit writable cache above passed. No dependency upgrade.

New game → Open workshop → Open cargo. Close does not resume; select Play. WASD walk, Shift sprint, Space jump, V view, B build, M map, Escape close/pause. Build arrows250mm; R90degrees. UI views are under Views. Transport kit selection precedes Pick up; Set down here requires actual native support/clearance. Entire carried-load deliveries currently appear in Power; no remote-container access is granted by opening a panel.

SimulationHold: distinct Recover session then Play, when enabled. This acknowledges the same native tick without catchup; it does not solve the performance failure. The current heavy route still stops before pickup in the latest run.

Do not use an old origin/main checkout as a substitute for this local source. Current code commit1e1c60ee17098cf04844d96c78ec0742a0be1e98; runtime sourcefb1e219802c984aa2fef2d651985ae860bd4468f. Historical asset-generator unit tests require Git objects96cced/e752cc; the standalone source export is intended for install/build/start and does not claim full npm-test PASS.
