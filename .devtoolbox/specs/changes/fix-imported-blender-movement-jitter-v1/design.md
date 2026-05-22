# Design

## Diagnosis First

The change separates three possible jitter sources before changing behavior:

- Physics jitter: Rigidbody position/velocity or RCS force direction changes erratically while input is held.
- Visual jitter: the imported visual root changes local transform, or its world delta diverges from the ship delta.
- Camera jitter: Rigidbody/visual motion is smooth, but camera focus or camera position has render-frame spikes.

The evidence runner records both FixedUpdate samples and render/LateUpdate samples. It computes delta variance, force-direction dot products, velocity-direction dot products, camera-minus-focus motion, and visual-root-minus-ship motion.

## Expected Current Risk

`SimpleFollowCamera` already smooths OrbitInspect/Side/FreeInspect, but ChaseLocked sets camera position and rotation directly every LateUpdate. If the focus point comes from Rigidbody center of mass or an anchor derived from it, tiny render/physics step differences are exposed as visible camera jitter. Unity's local documentation for `Rigidbody.interpolation` notes that physics updates and rendering are not synchronized and that interpolation is useful for followed player objects. The project already enables Rigidbody interpolation; the remaining likely issue is the camera hard-snap path.

## Fix Strategy

1. Add diagnostics without changing behavior.
2. Run evidence to classify the jitter.
3. If the Rigidbody and imported visual are smooth but camera/focus is spiky, smooth ChaseLocked like the other camera modes:
   - Snap only after bind, reset, reframe/F6, focus discontinuity, or teleport.
   - Smooth focus with an internal low-pass state.
   - Smooth position and rotation using the existing exponential blend pattern.
4. If translation auto-stop is implicated, add a release grace and fade-in diagnostics; it must remain inactive while manual translation is held.
5. Keep imported visual transforms stable; visual and functional rig rebuilds must only occur on bind/switch, not during steady movement.

## Reuse

- Reuse `SimpleFollowCamera` smoothing style rather than adding a new camera system.
- Reuse `PlayerShipController.ApplyModeSpecificInputForTests` so evidence follows the same command construction path used by existing flight tests.
- Reuse the existing PlayMode evidence pattern and artifact layout under `.devtoolbox/specs/changes/<change>/tests/`.

## Unity Docs Notes

- `E:\Unity\Documentation\en\ScriptReference\Rigidbody-interpolation.html`: interpolation reduces visible jitter when render frames fall between physics updates, especially for followed player objects.
- `E:\Unity\Documentation\en\ScriptReference\Vector3.SmoothDamp.html`: suitable for smoothing a follow camera without overshoot; this project currently uses exponential blends, so the implementation keeps that established pattern.
