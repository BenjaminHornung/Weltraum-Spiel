Return final markdown only. Do not answer with a preamble. Rank findings by severity. Treat attached bundle as authoritative. Call out uncertainty.

We are in a Unity 6000.4 prototype project. The user is seeing the Blender/imported ship GUI autopilot still flip and brake too early, sometimes orbiting/overcorrecting near the target. They also observed test obstacles briefly appear on Play Mode start and then disappear. The user wants the route to be precomputed with real ship data, shown in the GUI with maneuvers/ETA/fuel, and not guessed live. New data model PrototypeFlightPlan exists, but runtime and HUD still mainly use legacy PrototypeTrajectoryPlan and live gates in PrototypeWaypointAutopilot.RunAutopilotStep.

Current intended next local patch is intentionally smaller than a full executor rewrite:
1. Add/confirm a realistic low-change/near-target guard: below a small position/delta-v threshold, the autopilot must use RCS/Hold only and must not fire the main thruster for little corrections.
2. Fix PrototypeTestEnvironment so Rebuild does not delete manually authored obstacle children under PrototypeEnvironment at Play Mode startup.
3. Surface truth in GUI/debug that legacy live plan is still used until executable PrototypeFlightPlan executor lands.

Please review the attached files and answer:
- What are the highest-risk places where main throttle can still happen for small near-target corrections?
- What threshold(s) are realistic for this codebase and how should they be justified from existing units/arrival envelope?
- Where should the RCS-only guard be enforced so it does not weaken the terminal brake latch for genuinely high-speed arrivals?
- Is preserving manual obstacle children by clearing only generated groups the right lifecycle fix?
- What should be the next authoritative-flight-plan integration order after this patch?

Prefer boring reliable C# changes and focused Unity tests. Do not produce a full implementation package; return actionable advice only.


I attached a context bundle named CONTEXT.zip. Use the files inside it as the authoritative repo context for this question.

Be direct and practical. Prefer boring, reliable implementation choices over cleverness. Do not ask the calling agent to execute generated scripts automatically.
