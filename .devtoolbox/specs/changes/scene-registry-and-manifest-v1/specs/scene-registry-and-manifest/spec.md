# Capability: Scene Registry and Manifest

## Capability
This capability defines the authoritative Markdown-based scene registry and manifest rules for Clean-Core scene work. Every future scene must describe its intent, ownership, constraints, and validation surface before it is treated as a product scene.

### Requirement: Manifest presence before product use
Every scene under `Assets/_Weltraum/Scenes/` SHALL have a manifest Markdown file describing its purpose, type, owners, and constraints before it is treated as a product scene.

#### Scenario: New scene requires manifest first
GIVEN a new scene file exists under `Assets/_Weltraum/Scenes/Product/`
WHEN an agent prepares it for product use
THEN a manifest file SHALL already exist next to it
AND the manifest SHALL describe purpose, type, owners, and constraints

### Requirement: Scene type and folder mapping are constrained
Scene types SHALL be limited to `Product`, `VerticalSlice`, `TestRange`, `UIShowroom`, and `Archive`, and the manifest SHALL map those types to the existing scene folders under `Assets/_Weltraum/Scenes/`.

#### Scenario: Folder and type stay aligned
GIVEN a scene file lives in `Assets/_Weltraum/Scenes/TestRanges/`
WHEN its manifest is authored
THEN the scene type SHALL be `TestRange`
AND the folder mapping SHALL remain aligned with the plural `TestRanges` directory

### Requirement: Manifest fields are complete
The manifest SHALL define all 15 required fields: scene name, scene type, purpose, owner systems, allowed runtime roots, required prefabs, required services, input mode, camera policy, UI policy, test category, screenshot evidence requirements, scene validation checklist, known limits, and exit criteria.

#### Scenario: Missing field fails review
GIVEN a manifest draft is missing `exit criteria`
WHEN the draft is checked against the template
THEN the draft SHALL be rejected as incomplete
AND the missing field SHALL be added before the scene is accepted

### Requirement: Scenes remain wiring only
Scenes SHALL contain wiring only and SHALL NOT contain business logic.

#### Scenario: Scene script contains gameplay rules
GIVEN a scene MonoBehaviour calculates gameplay outcomes directly
WHEN the scene is reviewed
THEN the script SHALL be rejected as business logic in the scene
AND the logic SHALL move to the proper runtime system or adapter layer

### Requirement: Main camera count is controlled
Each scene SHALL have exactly one active MainCamera unless an exception is explicitly documented in the manifest.

#### Scenario: Two active cameras need an exception
GIVEN a scene has two active cameras at runtime
WHEN the manifest is reviewed
THEN the manifest SHALL document the exception explicitly
AND the scene SHALL explain why a second active camera is required

### Requirement: Missing scripts and null-critical fields are forbidden
Scenes SHALL have no missing scripts and no null-critical serialized fields.

#### Scenario: Validation catches broken references
GIVEN a scene contains a missing MonoBehaviour reference
WHEN validation runs
THEN the scene SHALL fail validation
AND the missing reference SHALL be fixed before the change is accepted

### Requirement: Product logic may not live in a scene-only script
Product logic SHALL NOT exist as a scene-only script.

#### Scenario: Product behavior is implemented in a scene script
GIVEN a product feature is implemented only inside a scene-specific script
WHEN the scene is reviewed against the architecture rules
THEN the implementation SHALL be rejected
AND the behavior SHALL be moved into the clean-core runtime structure

### Requirement: Scene changes require evidence
Any scene change SHALL be accompanied by scene validation and screenshot or evidence artifacts.

#### Scenario: Agent changes scene setup
GIVEN an agent edits a scene binding
WHEN the change is prepared for handoff
THEN validation evidence SHALL be attached
AND a screenshot or other scene evidence SHALL be included

### Requirement: TestRange scenes support automation
TestRange scenes SHALL be runnable headless or automatable where possible.

#### Scenario: New TestRange declares automation readiness
GIVEN a new TestRange scene is proposed
WHEN its manifest is written
THEN the manifest SHALL state how the scene can be run headless or automated
AND any limitation SHALL be recorded in the known limits field

### Requirement: This slice remains docs-only
This template and documentation slice SHALL NOT create or modify any `.unity` scene, prefab, runtime code, or `Assets/Scripts/Prototype/` file.

#### Scenario: Scope guard blocks asset edits
GIVEN an implementation attempt targets a `.unity` scene file
WHEN the scope is checked
THEN the change SHALL be rejected as out of scope
AND the docs/template slice SHALL remain unchanged
