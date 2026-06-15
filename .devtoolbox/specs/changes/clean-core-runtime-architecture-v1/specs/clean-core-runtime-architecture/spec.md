# Capability: Clean-Core Runtime Architecture

## Summary

The project shall define a clean product architecture boundary that lets future
runtime work move into `Assets/_Weltraum` while preserving the existing
Prototype runtime as legacy/reference.

This spec is planning-only for the current setup task and does not authorize
runtime, scene, prefab or asset edits by itself.

## ADDED Requirements

### Requirement: Clean product root

Future product runtime features shall be planned under `Assets/_Weltraum` unless
a later approved spec gives a narrower exception.

#### Scenario: New runtime feature is started later

- GIVEN an agent begins a future runtime implementation slice
- WHEN the slice adds new product code
- THEN the default target root is `Assets/_Weltraum`
- AND any exception is documented in that slice's proposal or design.

### Requirement: Prototype is legacy/reference

`Assets/Scripts/Prototype` shall remain a legacy/reference boundary. Agents shall
not extend it for new product architecture unless a later task explicitly
authorizes a targeted adapter or fix.

#### Scenario: Agent needs Prototype behavior

- GIVEN an agent needs existing Prototype behavior
- WHEN designing a Clean-Core slice
- THEN the agent treats Prototype as reference or migration source
- AND avoids editing Prototype files unless the active spec explicitly permits it.

### Requirement: Core logic remains scene-independent

Core Clean-Core logic shall be designed so it can be tested without Unity scene
state wherever practical.

#### Scenario: Core calculation is introduced later

- GIVEN a future slice introduces core simulation or navigation logic
- WHEN tests are written
- THEN the core behavior can be verified in focused tests
- AND scene or prefab setup is only used for integration evidence.

### Requirement: Scene wiring is not business logic

Scenes shall contain wiring, composition and presentation setup, not durable
business rules.

#### Scenario: New scene is introduced later

- GIVEN a future task creates a Clean-Core scene
- WHEN the scene is validated
- THEN durable behavior is owned by code/data contracts outside the scene
- AND the scene has documented manifest/evidence expectations.

### Requirement: Setup is documentation-only

This setup slice shall only add documentation, repo rules, prompts, roadmap files
and DevToolbox spec scaffolds.

#### Scenario: Setup change is reviewed

- GIVEN the setup change is inspected
- WHEN modified files are listed
- THEN no runtime code, Unity scene, prefab, asset or
  `Assets/Scripts/Prototype` file is modified.
