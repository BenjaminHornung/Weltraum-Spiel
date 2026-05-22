# Spec: Modular Ship Part Metadata

## Capability

The generated kit shall expose enough metadata for later ship-builder experiments to identify parts, categories, roles, dimensions, masses, and connector locations without requiring gameplay code changes.

## Requirements

### Custom Properties

- Each modular part shall include `partId`, `category`, `role`, and `massEstimateKg` custom properties.
- Fuel tank parts shall include `fuelEstimateKg`.
- Thruster parts shall include `thrustEstimateN`.
- Metadata values shall match the prototype manifest.

### Connector Objects

- Connector and hardpoint markers shall exist as visible markers and/or empties in the `.blend`.
- Connector object names shall be unique.
- Connector object names shall follow the required `PARTNAME_CONNECTORNAME` convention.
- Required connector ids shall include front, rear, side, mount, nozzle, RCS nozzle, and muzzle markers where appropriate for each part.
- Connector markers shall not be hidden as decorative details; they shall remain inspectable in the `.blend`.

### Manifest

- The kit shall write `Assets/Art/PrototypeShipKit/prototype_ship_kit_manifest.json`.
- The manifest shall include `kitId`, `units`, `style`, `localForwardAxis`, `localUpAxis`, `intendedUnityForward`, and `intendedUnityUp`.
- The manifest shall include one entry per exported modular part.
- Each part entry shall include `partId`, `displayName`, `category`, `role`, `blendObjectName`, `exportPath`, `dimensionsMeters`, mass estimate, connector list, and prototype notes.
- Connector entries shall include `id`, `name`, `type`, `localPosition`, and `localRotationEuler`.
- Demo ship entries shall include id, display name, export path, and parts used.

## Acceptance Scenarios

- A future importer can parse the manifest and list all prototype parts.
- A future builder can identify connector ids and approximate local positions from manifest data.
- Blender custom properties and manifest metadata agree for generated parts.
