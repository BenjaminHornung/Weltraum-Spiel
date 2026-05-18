# german-keyboard-yz-keybinds Requirements

## ADDED Requirements

### Requirement: Full throttle supports German Y/Z swap
The prototype SHALL accept both the `Y` key and the `Z` key as full-throttle commands.

#### Scenario: Pressing Y sets full throttle
- **WHEN** the player presses `Y`
- **THEN** the throttle is set to 100%

#### Scenario: Pressing Z sets full throttle
- **WHEN** the player presses `Z`
- **THEN** the throttle is set to 100%

### Requirement: Existing throttle controls remain stable
The prototype SHALL keep the existing throttle controls for cut, increase, and decrease throttle.

#### Scenario: Pressing X cuts throttle
- **WHEN** the player presses `X`
- **THEN** the throttle is set to 0%

#### Scenario: Pressing Left Shift increases throttle
- **WHEN** the player holds `Left Shift`
- **THEN** the throttle increases toward 100%

#### Scenario: Pressing Left Control decreases throttle
- **WHEN** the player holds `Left Control`
- **THEN** the throttle decreases toward 0%

### Requirement: German keyboard compatibility is documented
The prototype documentation SHALL list full throttle as `Y/Z` and explain that both keys are accepted for German keyboard compatibility.

#### Scenario: README lists Y/Z full throttle
- **WHEN** the player reads the controls documentation
- **THEN** full throttle is documented as `Y/Z`
