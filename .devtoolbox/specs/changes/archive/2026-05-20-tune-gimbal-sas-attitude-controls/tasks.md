# Tasks: tune-gimbal-sas-attitude-controls

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec.md
- [x] Validate spec change

## Implementation
- [x] Inspect current gimbal and SAS implementation
- [x] Add or tune inspector-adjustable gimbal response scalar
- [x] Ensure effective gimbal visual and physics angle use the softer command
- [x] Preserve 20 degree hard gimbal cap for diagonal input
- [x] Ensure W/S pitch attitude rotation is countered by SAS after release
- [x] Ensure A/D yaw attitude rotation is countered by SAS after release
- [x] Ensure Q/E roll attitude rotation is countered by SAS after release
- [x] Preserve SAS-off vacuum inertia after attitude release
- [x] Preserve straight throttle-only zero-torque behavior
- [x] Update debug overlay/README/physics docs if behavior labels change

## Verification
- [x] Unity MCP compile has no script errors
- [x] Verify diagonal gimbal effective angle is softer and <= 20 degrees
- [x] Verify straight throttle-only thrust torque remains zero
- [x] Verify SAS enabled reduces angular velocity after W/S input release
- [x] Verify SAS enabled reduces angular velocity after A/D input release
- [x] Verify SAS enabled reduces angular velocity after Q/E input release
- [x] Verify SAS disabled preserves angular velocity after attitude release
- [x] Verify gun/projectile and RCS translation still work
- [x] Re-run specs_validate
