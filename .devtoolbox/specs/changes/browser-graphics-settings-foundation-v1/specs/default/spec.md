# Browser Graphics Settings Foundation

## Versioned settings

The runtime SHALL load schema version 1 from the stable key `weltraum.browser.graphics-settings` and SHALL expose immutable confirmed, draft, runtime, capability, pending, and restart-required snapshots.

### Scenario: invalid or future payload

- **Given** LocalStorage contains malformed, non-finite, out-of-range, or future-version data
- **When** the browser starts
- **Then** startup SHALL use documented High defaults without throwing
- **And** the stored payload SHALL remain untouched until explicit Apply

## Presets and draft flow

Low, Medium, High, and Ultra SHALL deterministically produce the values in `design.md`; High SHALL be the default. Presets SHALL preserve FOV, FPS limit, and fullscreen preference. A changed preset-owned field SHALL derive Custom.

### Scenario: Apply, Cancel, and Reset

- **Given** confirmed settings and an editable draft
- **When** the player changes a control
- **Then** the UI SHALL show Pending and the renderer SHALL remain unchanged
- **When** Apply is activated
- **Then** the valid draft SHALL be persisted and supported fields SHALL be applied
- **When** Cancel, Escape, or Back is activated before Apply
- **Then** the draft SHALL revert to confirmed settings and SHALL NOT persist
- **When** Reset Defaults is activated
- **Then** High defaults SHALL be staged as a pending draft only

## Capability reporting

Every exposed setting SHALL report one of `SupportedLive`, `SupportedAfterRendererRestart`, `BrowserManaged`, `Unsupported`, or `Planned` with a stable reason when it is not live.

### Scenario: honest unavailable features

- **Given** the current renderer has no effective shadows or post-processing pipeline
- **When** the Graphics dialog renders
- **Then** shadows SHALL be Planned, bloom/motion SHALL be Unsupported, and VSync SHALL be BrowserManaged
- **And** none SHALL be reported as applied

### Scenario: anti-aliasing change

- **Given** desired AA differs from the active WebGL context
- **When** Apply succeeds
- **Then** the preference SHALL persist and SHALL report renderer recreation/reload required
- **When** the page reloads
- **Then** renderer construction SHALL use the desired value and the warning SHALL clear when actual matches desired

## Presentation-only renderer application

### Scenario: live settings

- **When** supported settings are applied
- **Then** scale/DPR, FOV, camera far plane, tone mapping, exposure, anisotropy, and render-only decor SHALL update through the adapter
- **And** render distance SHALL NOT affect streaming, detection, navigation, or canonical entity truth

### Scenario: FPS limit

- **Given** a finite FPS limit
- **When** RAF callbacks continue
- **Then** only `renderer.render` SHALL be skipped according to the scheduler
- **And** input processing, `runtime.advance`, fixed simulation ticks, HUD, and telemetry SHALL continue unchanged

## Player UI and input

### Scenario: modal operation

- **When** the player opens Graphics Settings
- **Then** the native dialog SHALL trap focus, inert the background, block and neutralize flight/camera input, and leave simulation running
- **And** it SHALL NOT stack with the Navigation Planner
- **When** the dialog closes
- **Then** focus SHALL return to the opener and normal flight input SHALL resume

## Normal-runtime evidence

### Scenario: Playwright proof

- **Given** Playwright opens `/`
- **Then** `window.TestBridge` SHALL be absent
- **And** tests SHALL verify presets, backing resolution, presentation-safe FOV/far metadata, persistence, Custom, Cancel, Reset, restart-required and unavailable states
- **And** exact gameplay non-mutation SHALL be proven in unit tests while normal E2E compares visible plan hash plus idle distance, speed, fuel, and status
