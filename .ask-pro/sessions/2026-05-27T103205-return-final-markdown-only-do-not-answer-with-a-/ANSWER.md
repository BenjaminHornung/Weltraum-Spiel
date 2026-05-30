## Single most likely root cause

`arrivalBrakeCommitted` has become a stale global brake latch.

The current code sets `arrivalBrakeCommitted = true` in `ApplyBrakeRequest()`, but it is only cleared on target/engage/reset paths. When terminal capture is later released because the ship has drifted or overshot outside the terminal range, only `arrivalTerminalCaptureActive` is cleared. `arrivalBrakeCommitted` remains true.

That exactly matches all three failure signatures:

```text
finalState=Brake
finalPhase=Brake
finalArrivalBrakeCommitted=True
finalBrakeHoldActive=False
finalArrivalTerminalCaptureActive=False
distance far outside arrival
```

So the ship is no longer in terminal capture and no longer in brake hold, but the final guard still does this:

```csharp
if (arrivalBrakeCommitted || brakeHoldActive || arrivalTerminalCaptureActive)
{
    ApplyBrakeRequest();
    return;
}
```

That prevents normal reacquisition and keeps the ship in `Brake` forever, even at 40m, 105m, or 125m from a 10m target.

## Smallest safe fix

Keep the anti-flap terminal brake commit behavior, but add an explicit stale-commit release before `ShouldRequestBrake()` is evaluated.

Place this after `ShouldReleaseArrivalTerminalCapture()` and before:

```csharp
bool requestBrake = ShouldRequestBrake();
```

Recommended shape:

```csharp
if (ShouldReleaseStaleArrivalBrakeCommitForReacquire())
{
    ReleaseArrivalBrakeCommitForReacquire();
}
```

Add:

```csharp
private bool ShouldReleaseStaleArrivalBrakeCommitForReacquire()
{
    if (!arrivalBrakeCommitted)
    {
        return false;
    }

    if (arrivalTerminalCaptureActive)
    {
        return false;
    }

    if (IsWithinArrivalTerminalCaptureRange())
    {
        return false;
    }

    if (LastMetrics.shouldBrake)
    {
        return false;
    }

    return LastMetrics.closingSpeed <= BrakeHoldReleaseZeroSpeed;
}

private void ReleaseArrivalBrakeCommitForReacquire()
{
    arrivalBrakeCommitted = false;
    arrivalTerminalCaptureActive = false;
    ReleaseBrakeHold();

    brakeAlignmentLocked = false;
    brakeMainThrottleAlignmentLocked = false;
    committedBrakeDirection = Vector3.zero;
}
```

This is intentionally conservative:

* It does **not** release while still inside the terminal capture range.
* It does **not** release while the current metrics still say braking is required.
* It only releases once the ship is no longer closing meaningfully, which is the stale overshoot/reacquire case.
* It preserves the existing no-throttle-during-`FlipForBrake` gate.
* It avoids the old terminal `Brake`/`Accelerate` flap because the release cannot happen inside the terminal capture range.

## Why this is more likely than an alignment or throttle issue

The failures are not primarily saying “brake never engages.” In test 2, the first main brake sample happened at 43.10m, so the main brake path did engage.

The failures are saying: after brake engagement, the ship never transitions into `HoldPosition` or `Complete`, and it remains in `Brake` with only `arrivalBrakeCommitted` still true. That points directly at stale commit state, not retrograde alignment or throttle shaping.

## Ranked fix options

| Rank | Fix option                                                                                                                                                                       | Confidence | Notes                                                                                                                                       |
| ---: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------- |
|    1 | Add stale `arrivalBrakeCommitted` release outside terminal capture range when not closing and not needing brake                                                                  |       High | Best match to all three failure signatures. Minimal and preserves terminal anti-flap behavior.                                              |
|    2 | Narrow the final guard to only brake when `arrivalBrakeCommitted && IsWithinArrivalTerminalCaptureRange()`                                                                       |     Medium | Smaller, but leaves stale `arrivalBrakeCommitted` set, which can poison later brake direction smoothing and commit logic.                   |
|    3 | Fix `ResolveBrakeDirection()` low-speed ordering so `closingSpeed <= 0` can prefer `directionToTarget` before the `velocity.magnitude < BrakeDirectionMinimumSpeed` early return | Medium-low | Real bug risk, especially for the `finalSpeed=0.26` case, but likely insufficient alone because the ship remains globally stuck in `Brake`. |
|    4 | Tune brake alignment constants again                                                                                                                                             |        Low | The observed state flags do not point to an angular gate problem.                                                                           |
|    5 | Revert `requestedFineApproach` relaxation or re-add the closing-speed gate                                                                                                       |        Low | Likely worsens settling. The problem is stale brake commitment, not too much fine approach.                                                 |
|    6 | Revert `ShapeMainThrottleForState` low-speed behavior                                                                                                                            |        Low | Would make post-brake reacquisition/settling harder, not easier.                                                                            |

## Revert recommendation

Do **not** wholesale revert the current changes.

The only change that needs narrowing is the new unconditional early brake return based on:

```csharp
arrivalBrakeCommitted || brakeHoldActive || arrivalTerminalCaptureActive
```

Keep its intent, but make stale `arrivalBrakeCommitted` releasable before that guard can trap the autopilot forever.

I would not revert:

* `BrakeMainThrottleRetrogradeAlignmentDegrees = 35`
* `BrakeFlipMaxAngularAccelerationRadPerSecondSquared = 3`
* `BrakeFlipDampingTimeSeconds = 0.4`
* relaxed `requestedFineApproach`
* `ShouldKeepTerminalBrakeCommitted()` no longer dropping out due to `ShouldCaptureAnyArrivalHold()`
* the `FlipForBrake` throttle gate
* `ShapeMainThrottleForState()` relying on distance/speed scale

## Uncertainty

I cannot prove the tests pass without running Unity PlayMode. Based only on the attached files and the failure signatures, the stale `arrivalBrakeCommitted` latch is the strongest match because all three failures end with the same impossible-looking state combination: committed brake still true, but no active hold, no terminal capture, and far outside arrival.
