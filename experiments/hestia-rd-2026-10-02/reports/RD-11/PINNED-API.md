# Pinned API evidence (Three / @types/three 0.185.1)

Inspected the exact-lock local install, not global/latest documentation. Source
and declaration SHAs are recorded in each external bindings receipt.

- `WebGPURenderer.js`: `forceWebGL` constructs WebGLBackend; default installs a
  WebGPU→WebGL fallback. Class `isWebGPURenderer` is not backend evidence.
- `common/Renderer.js`: await `init()`; `hasInitialized()` plus live backend is
  the admission boundary. `compileAsync` can reject. `setAnimationLoop` uses the
  renderer's existing internal loop: do not add a second rAF. `dispose()` before
  initialized does not release partial backend resources and can reenter init
  via `setAnimationLoop`; partial initialization therefore needs owned cleanup.
- `WebGPUBackend.js`: requests compatibility feature level; lacking
  `core-features-and-limits` sets renderer samples to zero. Loss calls
  `onDeviceLost`; uncaptured errors call `onError`. Dispose destroys owned device.
- `webgl-fallback/WebGLBackend.js`: WebGL2 context plus owned loss listener;
  dispose removes listener and requests context loss. A fresh canvas is required
  for a subsequent native page mount, unlike RD03's reusable context policy.
- `NodeMaterial.js` lines 834–865: `colorNode` is multiplied by vertexColor when
  `vertexColors=true`; TSL must not multiply colors twice. `opacityNode` controls
  alpha; emission, fog and Lambert lights have existing node implementations.
- `MeshLambertNodeMaterial.js`: uses Lambert (Phong lighting without specular).
  Explicit TSL `materialColor` / `materialOpacity` / `materialEmissive` keep the
  frozen material descriptors and node graph; no WebGL onBeforeCompile port.
- Renderer has public output-buffer type, requested samples and current final
  output samples. Pinned private framebuffer map/backend texture descriptors
  supply observational scene-buffer format and effective native MSAA where
  available. Unavailable values stay unavailable, never assumed from requests.
- Installed declarations omit backend gl/device/compatibility/texture data and
  type `onError` as string although pinned runtime passes a structured object.
   RD11 uses a small local observation shape for these inspected fields. No new
   shared declaration is needed for those observations. Separately, the pinned
   TypeScript 7.0.2 typing gate stalls even on the retained five-line public TSL
   smoke; HEAD must resolve that tool/type compatibility blocker before admission.

- `WebGLTextureUtils.js`: target data exposes `msaaRenderbuffers`; query the real
  `RENDERBUFFER_SAMPLES`, restoring the prior binding in `finally`. Native zero
  means no MSAA. Do not substitute requested samples or final-output samples.
- Three suppresses `device.lost` with reason `destroyed`; the owned host also
  observes the actual loss promise so explicit task-owned test destruction is
  terminal. Normal disposal is guarded and cannot overwrite the first reason.

These are API/source facts, NOT initialized native renderer/browser evidence.
ProductIntegrated=false.
