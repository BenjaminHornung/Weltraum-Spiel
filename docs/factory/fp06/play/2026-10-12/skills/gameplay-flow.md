---
name: gameplay-flow
description: Design or diagnose a playable core loop, player decisions, onboarding, pacing and state transitions. Use for gameflow and game-feel work; lore, AI technology and monetization are separate optional domains.
metadata:
  sources: omer-metin/skills-for-antigravity game-design-core and game-design
---

# Gameplay flow

Follow project scope, mandatory skills and authorization boundaries. Start from the intended player experience and existing mechanics, not a genre template or a feature list. Do not turn monetization metrics into default design goals.

## Make the loop explicit

Describe what the player perceives, decides, does, receives as feedback and can choose next. Identify the immediate goal, resources or risks, success/failure conditions and the state that changes. Explain why the choice is meaningful. Keep the smallest playable slice that demonstrates this loop; do not add lore, systems or polished assets to conceal a weak interaction.

Inspect the current sequence and distinguish observed friction from a design hypothesis. Look for unclear goals, excessive waiting, missing feedback, no meaningful alternatives, repetitive busywork, irreversible surprises and reward timings that obscure causality. A tutorial may help; neither zero tutorials nor a universal 30-second threshold is an acceptance rule.

## Build coherent states and feedback

Trace entering play, normal actions, menus, pause/resume, success/failure, retry/restart and leaving the game where supported. Preserve the right session state and reset the right state. Choose deliberately whether world time and input continue during overlays. Prevent unintended double actions and stale callbacks after a transition.

Align animation, sound, UI and world response with the same action result. Tune responsiveness, pacing and challenge against the actual input/target hardware. Start with one hypothesis and the smallest change; reuse established mechanics and project systems. Use AI/render/asset specialists only for a demonstrated need.

## Play through and report honestly

Run the complete representative loop, not just startup or a happy-path helper. Exercise the important interruption and retry paths; check that the next action remains clear. Record the input sequence, observed outcomes, failure cases and relevant measures such as time to first meaningful action or avoidable dead time. Use these to test a specific hypothesis, not to invent a fun score.

Human playtesting is needed to judge enjoyment, clarity and difficulty. Record what a player actually does or reports; do not claim fun from static code, a build, FPS or a screenshot. If playthrough/hardware evidence is unavailable, label it NOT RUN and return a bounded test plan. Do not launch a project, consume GPU/provider spend or widen scope without the existing authority for that action.
