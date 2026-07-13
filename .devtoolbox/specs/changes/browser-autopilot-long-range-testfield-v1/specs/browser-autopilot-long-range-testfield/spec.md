# Behavioral Specification: Browser Autopilot Long-Range Testfield

## 1. Coverage Matrix
- The proving-ground catalog shall contain at least 20 courses; the preferred target is a 25-course matrix.
- Courses shall cover real distances of 500m, 1000m, and 2500m.
- Each distance tier shall be exercised across `SpeedProfile` values `Safe`, `Balanced`, and `Fast`.
- The matrix shall explicitly mark each case as either normal, `KnownStress`, or `ExpectedFail`.

## 2. Classification Rules
- `KnownStress` means the course is intentionally difficult but still useful for observation.
- `ExpectedFail` means the course is currently outside the allowed envelope and must not be reported as pass.
- Multi-obstacle courses may exist, but they must be classified explicitly and never silently promoted to pass.

## 3. Autopilot Behavior Constraints
- No snap correction is allowed.
- No velocity-zero shortcut is allowed.
- No silent replan is allowed.
- `planHash` must remain stable for identical inputs.
- For `StopWithinEnvelope`, terminal speed must be `<= 0.5`.

## 4. Observability and TestBridge
- `TestBridge` may be used only when the request includes `?testBridge=1`.
- Renderer output is observability data only and must not be treated as truth.
- The implementation shall not depend on `unity-legacy-final-2026-07:Assets/**` for this change.

## 5. Evidence Expectations
- Stress and expected-fail outcomes shall be visible in metrics and logs.
- Pass status shall only be claimed when the course is within the defined envelope and the classification is not `KnownStress` or `ExpectedFail`.
