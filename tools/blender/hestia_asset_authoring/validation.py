"""Deterministic, Blender-independent validation of Hestia handoff data."""

from __future__ import annotations

import math
import json
from collections import defaultdict
from collections.abc import Collection, Mapping, Sequence
from typing import Any, cast

from .model import (
    AuthoredAsset,
    AuthoredNode,
    AuthoringInput,
    BreakPolicy,
    CanonicalAsset,
    CanonicalJoint,
    CanonicalMarker,
    CanonicalMaterial,
    CanonicalPart,
    CollisionPolicy,
    CoordinateFrame,
    Diagnostic,
    DiagnosticSeverity,
    ExtractedAsset,
    GeometryInventory,
    JointType,
    MarkerType,
    MeshInventory,
    NavigationPolicy,
    RepresentationMode,
    Shell,
    ThinFeature,
    ThinFeaturePolicy,
    Transform,
    UnappliedScalePolicy,
    ValidationOptions,
)
from .schema import (
    ASSET_ID_PROPERTY,
    COLLISION_POLICY_PROPERTY,
    DESTRUCTIBLE_PROPERTY,
    FORWARD_AXIS,
    HANDEDNESS,
    ID_PATTERN,
    KNOWN_PROPERTY_NAMES,
    MARKER_ID_PROPERTY,
    MARKER_TYPE_PROPERTY,
    METERS_PER_UNIT,
    NAVIGATION_POLICY_PROPERTY,
    PART_ID_PROPERTY,
    PARENT_PART_ID_PROPERTY,
    RENDER_MATERIAL_ID_PROPERTY,
    REPRESENTATION_MODE_PROPERTY,
    REPRESENTATION_MODES,
    SCHEMA_ID,
    SHELL_THICKNESS_M_PROPERTY,
    STRUCTURAL_MATERIAL_ID_PROPERTY,
    THIN_FEATURE_POLICIES,
    THIN_FEATURE_POLICY_PROPERTY,
    UP_AXIS,
    is_valid_id,
)


# The prefix order is part of the handoff contract.  Sorting by the complete
# key after this order keeps diagnostics stable while leaving related errors
# together for humans and consuming tools.
_ORDER = {
    "schema": 10,
    "id": 20,
    "reference": 30,
    "structure": 40,
    "enum": 50,
    "unit": 60,
    "frame": 70,
    "number": 80,
    "transform": 90,
    "inventory": 100,
    "geometry": 110,
    "representation": 120,
    "policy": 130,
}


def _path(kind: str, identity: object = "") -> str:
    return f"{kind}[{identity}]" if identity != "" else kind


def _diag(severity: DiagnosticSeverity, code: str, message: str, path: str = "") -> Diagnostic:
    return Diagnostic(severity=severity, code=code, message=message, path=path)


def _sort_diagnostics(items: Sequence[Diagnostic]) -> tuple[Diagnostic, ...]:
    return tuple(
        sorted(
            items,
            key=lambda item: (
                _ORDER.get(item.code.split(".", 1)[0], 999),
                item.code,
                item.path,
                item.severity.value,
                item.message,
            ),
        )
    )


def _finite_number(value: object) -> bool:
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(float(value))


def _property_errors(properties: Mapping[Any, Any], required: set[str], path: str) -> list[Diagnostic]:
    result: list[Diagnostic] = []
    names = set(properties)
    for name in sorted(names, key=lambda item: (isinstance(item, str), str(item))):
        if not isinstance(name, str) or name not in KNOWN_PROPERTY_NAMES:
            result.append(
                _diag(
                    DiagnosticSeverity.ERROR,
                    "schema.unknown-property",
                    f"unknown Hestia property: {name}",
                    path,
                )
            )
    for name in sorted(required - names):
        result.append(
            _diag(
                DiagnosticSeverity.ERROR,
                "schema.missing-property",
                f"missing required Hestia property: {name}",
                path,
            )
        )
    return result


def _id_diagnostics(values: Sequence[tuple[str, object, str]], kind: str) -> list[Diagnostic]:
    result: list[Diagnostic] = []
    seen: defaultdict[str, list[str]] = defaultdict(list)
    for _, value, path in values:
        if not is_valid_id(value):
            result.append(
                _diag(
                    DiagnosticSeverity.ERROR,
                    "id.invalid",
                    f"invalid {kind} ID: {value!r}; expected {ID_PATTERN.pattern}",
                    path,
                )
            )
        else:
            if isinstance(value, str):
                seen[value].append(path)
    for value in sorted(seen):
        for path in sorted(seen[value]):
            if len(seen[value]) > 1:
                result.append(
                    _diag(
                        DiagnosticSeverity.ERROR,
                        "id.duplicate",
                        f"duplicate {kind} ID: {value}",
                        path,
                    )
                )
    return result


def _transform_diagnostics(transform: Transform, path: str, options: ValidationOptions) -> list[Diagnostic]:
    result: list[Diagnostic] = []
    for name, value in (
        ("translation", transform.translation),
        ("rotation", transform.rotation),
        ("scale", transform.scale),
    ):
        if not isinstance(value, (tuple, list)):
            result.append(_diag(DiagnosticSeverity.ERROR, "transform.non-exportable", f"{name} is not a sequence", path))
            continue
        if any(not _finite_number(component) for component in value):
            result.append(_diag(DiagnosticSeverity.ERROR, "transform.non-finite", f"{name} contains a non-finite value", path))
    scale = transform.scale
    if isinstance(scale, (tuple, list)) and len(scale) == 3 and all(_finite_number(x) for x in scale):
        determinant = float(scale[0]) * float(scale[1]) * float(scale[2])
        if determinant < 0.0:
            result.append(
                _diag(
                    DiagnosticSeverity.ERROR,
                    "transform.negative-determinant",
                    f"transform determinant is negative: {determinant:.17g}",
                    path,
                )
            )
        if any(abs(float(component) - 1.0) > options.unapplied_scale_tolerance for component in scale):
            severity = {
                UnappliedScalePolicy.IGNORE: None,
                UnappliedScalePolicy.WARNING: DiagnosticSeverity.WARNING,
                UnappliedScalePolicy.ERROR: DiagnosticSeverity.ERROR,
            }[options.unapplied_scale_policy]
            if severity is not None:
                result.append(_diag(severity, "transform.unapplied-scale", "transform has unapplied scale", path))
    return result


def _topology_diagnostics(mesh: MeshInventory, path: str, representation: object) -> list[Diagnostic]:
    result: list[Diagnostic] = []
    topology = mesh.topology
    if topology.boundary_edge_count:
        severity = DiagnosticSeverity.ERROR if representation == "Solid" else DiagnosticSeverity.WARNING
        result.append(_diag(severity, "geometry.open", "mesh has boundary edges and is open", path))
    if topology.non_manifold_edge_count:
        result.append(_diag(DiagnosticSeverity.ERROR, "geometry.non-manifold", "mesh has non-manifold edges", path))
    if topology.degenerate_polygon_count:
        result.append(_diag(DiagnosticSeverity.ERROR, "geometry.degenerate-face", "mesh has degenerate faces", path))
    if representation == "Solid" and (
        topology.boundary_edge_count or topology.non_manifold_edge_count or topology.polygon_count == 0
    ):
        result.append(_diag(DiagnosticSeverity.ERROR, "geometry.solid-not-closed", "Solid requires a closed non-empty volume", path))
    return result


def _validate_node(node: AuthoredNode, options: ValidationOptions, materials: Collection[str], material_inventory_supplied: bool) -> list[Diagnostic]:
    path = _path("node", node.node_id)
    props = dict(node.properties)
    result = _property_errors(props, set(), path)
    if props.get(PART_ID_PROPERTY) != node.part_id:
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.part-id", "property part ID does not match normalized part ID", path))
    parent = props.get(PARENT_PART_ID_PROPERTY)
    if parent is not None and not is_valid_id(parent):
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.parent-part-id", "parent part ID must be a valid ID or null", path))
    if parent is None and node.parent_node_id is not None:
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.parent-part-id", "non-root part requires a parent_part_id", path))
    representation = props.get(REPRESENTATION_MODE_PROPERTY)
    if representation not in REPRESENTATION_MODES:
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.representation-mode", "representation mode is not a supported value", path))
    for property_name in (RENDER_MATERIAL_ID_PROPERTY, STRUCTURAL_MATERIAL_ID_PROPERTY):
        material_id = props.get(property_name)
        if not is_valid_id(material_id):
            result.append(_diag(DiagnosticSeverity.ERROR, "inventory.material-id", f"{property_name} must be a valid material ID", path))
        elif material_inventory_supplied and material_id not in materials:
            result.append(_diag(DiagnosticSeverity.ERROR, "inventory.missing-material", f"material is not in the evaluated inventory: {material_id}", path))
    if not isinstance(props.get(DESTRUCTIBLE_PROPERTY), bool):
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.malformed-property", "destructible must be boolean", path))
    for property_name in (COLLISION_POLICY_PROPERTY, NAVIGATION_POLICY_PROPERTY):
        value = props.get(property_name)
        if not isinstance(value, str) or not value:
            result.append(_diag(DiagnosticSeverity.ERROR, "schema.malformed-property", f"{property_name} must be a non-empty string", path))
    thin_policy = props.get(THIN_FEATURE_POLICY_PROPERTY)
    if node.critical_thin_feature and thin_policy not in THIN_FEATURE_POLICIES:
        result.append(_diag(DiagnosticSeverity.ERROR, "policy.thin-feature", "critical thin feature requires an explicit valid thin_feature_policy", path))
    elif thin_policy is not None and thin_policy not in THIN_FEATURE_POLICIES:
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.thin-feature-policy", "thin_feature_policy is invalid", path))
    if representation in ("Shell", "LayeredShell"):
        thickness = props.get(SHELL_THICKNESS_M_PROPERTY)
        if not _finite_number(thickness) or float(cast(float, thickness)) <= 0.0:
            result.append(_diag(DiagnosticSeverity.ERROR, "geometry.shell-thickness", "Shell requires positive finite shell_thickness_m in meters", path))
    result.extend(_transform_diagnostics(node.transform, path, options))
    if node.mesh is not None:
        result.extend(_topology_diagnostics(node.mesh, f"{path}.mesh[{node.mesh.mesh_id}]", representation))
        if not node.mesh.material_ids:
            result.append(_diag(DiagnosticSeverity.ERROR, "inventory.missing-material-assignment", "mesh has no material assignment", path))
    return result


def _validate_legacy_inventory(asset: AuthoredAsset, result: list[Diagnostic]) -> None:
    meshes = list(asset.meshes) + [node.mesh for node in asset.nodes if node.mesh is not None]
    result.extend(_id_diagnostics([(mesh.mesh_id, mesh.mesh_id, _path("mesh", mesh.mesh_id)) for mesh in meshes], "mesh"))
    materials = list(asset.materials)
    result.extend(_id_diagnostics([(item.material_id, item.material_id, _path("material", item.material_id)) for item in materials], "material"))
    material_ids = {item.material_id for item in materials}
    material_inventory_supplied = bool(materials)
    meshes_by_id = {mesh.mesh_id: mesh for mesh in meshes}
    for mesh in sorted(meshes, key=lambda item: str(item.mesh_id)):
        path = _path("mesh", mesh.mesh_id)
        for material_id in mesh.material_ids:
            if not is_valid_id(material_id):
                result.append(_diag(DiagnosticSeverity.ERROR, "inventory.material-id", "mesh contains an invalid material ID", path))
            elif material_inventory_supplied and material_id not in material_ids:
                result.append(_diag(DiagnosticSeverity.ERROR, "inventory.missing-material", f"mesh material is not in inventory: {material_id}", path))
        if mesh.bounds_min is not None and mesh.bounds_max is not None:
            if len(mesh.bounds_min) != 3 or len(mesh.bounds_max) != 3 or any(not _finite_number(x) for x in (*mesh.bounds_min, *mesh.bounds_max)):
                result.append(_diag(DiagnosticSeverity.ERROR, "inventory.bounds", "mesh bounds must be finite meter coordinates", path))
            elif any(float(low) > float(high) for low, high in zip(mesh.bounds_min, mesh.bounds_max)):
                result.append(_diag(DiagnosticSeverity.ERROR, "inventory.bounds", "mesh bounds minimum exceeds maximum", path))
    primitives = list(asset.primitives)
    result.extend(_id_diagnostics([(item.primitive_id, item.primitive_id, _path("primitive", item.primitive_id)) for item in primitives], "primitive"))
    for primitive in sorted(primitives, key=lambda item: str(item.primitive_id)):
        path = _path("primitive", primitive.primitive_id)
        if primitive.mesh_id not in meshes_by_id:
            result.append(_diag(DiagnosticSeverity.ERROR, "inventory.missing-mesh", f"primitive references missing mesh: {primitive.mesh_id}", path))
        if primitive.material_id is None:
            result.append(_diag(DiagnosticSeverity.ERROR, "inventory.missing-material-assignment", "primitive has no material assignment", path))
        elif material_inventory_supplied and primitive.material_id not in material_ids:
            result.append(_diag(DiagnosticSeverity.ERROR, "inventory.missing-material", f"primitive material is not in inventory: {primitive.material_id}", path))
        if primitive.mesh_id in meshes_by_id:
            result.extend(_topology_diagnostics(meshes_by_id[primitive.mesh_id], path, None))


def _canonical_enum(value: object, enum_type: type, allowed: Collection[str], path: str, result: list[Diagnostic]) -> None:
    enum_value = getattr(value, "value", None)
    if not isinstance(value, enum_type) or enum_value not in allowed:
        result.append(_diag(DiagnosticSeverity.ERROR, "enum.invalid", f"{path} has an invalid enum value", path))


def _number(value: object, path: str, result: list[Diagnostic], *, positive: bool = False) -> None:
    if not _finite_number(value):
        result.append(_diag(DiagnosticSeverity.ERROR, "number.non-finite", f"{path} must be a finite number", path))
    elif positive and float(cast(float, value)) <= 0.0:
        result.append(_diag(DiagnosticSeverity.ERROR, "number.not-positive", f"{path} must be greater than zero", path))


def _exact_type(value: object, expected: type, path: str, result: list[Diagnostic]) -> bool:
    if type(value) is not expected:
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.invalid-type", f"{path} must be an explicit {expected.__name__} model", path))
        return False
    return True


def _canonical_object_shape(
    value: object,
    path: str,
    allowed: Collection[str],
    required: Collection[str],
    result: list[Diagnostic],
) -> Mapping[str, Any] | None:
    if not isinstance(value, Mapping):
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.invalid-field", f"{path} must be a canonical object", path))
        return None
    keys = set(value)
    for field_name in sorted(keys - set(allowed), key=str):
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.unknown-field", f"unknown canonical field: {path}.{field_name}", path))
    for field_name in sorted(set(required) - keys):
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.missing-field", f"missing required canonical field: {path}.{field_name}", path))
    return cast(Mapping[str, Any], value)


def _canonical_array(value: object, path: str, result: list[Diagnostic]) -> Sequence[Any]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.invalid-field", f"{path} must be a canonical array", path))
        return ()
    return cast(Sequence[Any], value)


def _canonical_required_shape(asset: CanonicalAsset, result: list[Diagnostic]) -> None:
    try:
        document = asset.to_contract_dict()
    except (AttributeError, TypeError, ValueError, OverflowError) as exc:
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.unserializable", f"canonical model cannot be serialized: {exc}", "asset"))
        return
    root = _canonical_object_shape(
        document,
        "document",
        {"schema", "asset", "parts", "joints", "markers", "materials"},
        {"schema", "asset", "parts", "joints", "markers", "materials"},
        result,
    )
    if root is None:
        return
    asset_payload = _canonical_object_shape(
        root.get("asset"),
        "asset",
        {"assetId", "assetRevision", "representation", "metersPerUnit", "coordinateFrame", "defaultStructuralMaterialId", "tags"},
        {"assetId", "assetRevision", "representation", "metersPerUnit", "coordinateFrame"},
        result,
    )
    if asset_payload is not None:
        _canonical_object_shape(
            asset_payload.get("coordinateFrame"),
            "asset.coordinateFrame",
            {"upAxis", "forwardAxis", "handedness"},
            {"upAxis", "forwardAxis", "handedness"},
            result,
        )

    for index, part in enumerate(_canonical_array(root.get("parts"), "parts", result)):
        part_path = f"parts[{index}]"
        part_payload = _canonical_object_shape(
            part,
            part_path,
            {"partId", "parentPartId", "representation", "defaultRenderMaterialId", "structuralMaterialId", "destructible", "collisionPolicy", "navigationPolicy", "thinFeature", "shell", "tags"},
            {"partId", "representation", "destructible", "collisionPolicy", "navigationPolicy", "thinFeature"},
            result,
        )
        if part_payload is None:
            continue
        _canonical_object_shape(
            part_payload.get("thinFeature"),
            f"{part_path}.thinFeature",
            {"policy", "declaredMinimumThicknessMeters"},
            {"policy", "declaredMinimumThicknessMeters"},
            result,
        )
        if "shell" in part_payload:
            shell_path = f"{part_path}.shell"
            shell = _canonical_object_shape(
                part_payload["shell"], shell_path, {"thicknessMeters", "layers"}, {"thicknessMeters", "layers"}, result
            )
            if shell is not None:
                for layer_index, layer in enumerate(_canonical_array(shell.get("layers"), f"{shell_path}.layers", result)):
                    _canonical_object_shape(
                        layer,
                        f"{shell_path}.layers[{layer_index}]",
                        {"structuralMaterialId", "thicknessMeters"},
                        {"structuralMaterialId", "thicknessMeters"},
                        result,
                    )

    for index, joint in enumerate(_canonical_array(root.get("joints"), "joints", result)):
        _canonical_object_shape(
            joint,
            f"joints[{index}]",
            {"jointId", "parentPartId", "childPartId", "jointType", "breakPolicy", "breakForceNewtons", "breakTorqueNewtonMeters", "tags"},
            {"jointId", "parentPartId", "childPartId", "jointType", "breakPolicy"},
            result,
        )

    for index, marker in enumerate(_canonical_array(root.get("markers"), "markers", result)):
        _canonical_object_shape(
            marker,
            f"markers[{index}]",
            {"markerId", "markerType", "partId", "interfaceId", "tags"},
            {"markerId", "markerType"},
            result,
        )

    for index, material in enumerate(_canonical_array(root.get("materials"), "materials", result)):
        _canonical_object_shape(
            material,
            f"materials[{index}]",
            {"renderMaterialId", "structuralMaterialId", "paletteIndex", "tags"},
            {"renderMaterialId"},
            result,
        )


def _reference(ref: object, path: str, category: str, values: Mapping[str, int], result: list[Diagnostic]) -> None:
    if not is_valid_id(ref):
        result.append(_diag(DiagnosticSeverity.ERROR, "id.invalid", f"invalid referenced {category} ID: {ref!r}", path))
        return
    count = values.get(cast(str, ref), 0)
    if count != 1:
        result.append(_diag(DiagnosticSeverity.ERROR, "reference.not-exactly-one", f"{category} reference must resolve exactly once: {ref}", path))


def _part_parent_cycles(parts: Sequence[CanonicalPart], result: list[Diagnostic]) -> None:
    parents = {part.part_id: part.parent_part_id for part in parts if is_valid_id(part.part_id)}
    state: dict[str, int] = {}
    reported: set[frozenset[str]] = set()
    for start in sorted(parents):
        if state.get(start, 0):
            continue
        trail: list[str] = []
        current: str | None = start
        while current is not None and current in parents and state.get(current, 0) == 0:
            state[current] = 1
            trail.append(current)
            parent = parents[current]
            current = parent if isinstance(parent, str) else None
        if current in trail:
            cycle = frozenset(trail[trail.index(current):])
            if cycle not in reported:
                reported.add(cycle)
                result.append(
                    _diag(
                        DiagnosticSeverity.ERROR,
                        "structure.part-parent-cycle",
                        "part parent references contain a cycle",
                        _path("part", min(cycle)),
                    )
                )
        for item in trail:
            state[item] = 2


def _validate_canonical(asset: CanonicalAsset, options: ValidationOptions) -> list[Diagnostic]:
    result: list[Diagnostic] = []
    _canonical_required_shape(asset, result)
    result.extend(_id_diagnostics([("asset", asset.asset_id, "asset")], "asset"))
    result.extend(_id_diagnostics([(part.part_id, part.part_id, _path("part", part.part_id)) for part in asset.parts], "part"))
    result.extend(_id_diagnostics([(joint.joint_id, joint.joint_id, _path("joint", joint.joint_id)) for joint in asset.joints], "joint"))
    result.extend(_id_diagnostics([(marker.marker_id, marker.marker_id, _path("marker", marker.marker_id)) for marker in asset.markers], "marker"))
    result.extend(_id_diagnostics([(material.render_material_id, material.render_material_id, _path("material", material.render_material_id)) for material in asset.materials], "material"))
    if not is_valid_id(asset.asset_id):
        result.append(_diag(DiagnosticSeverity.ERROR, "id.invalid", f"invalid asset ID: {asset.asset_id!r}; expected {ID_PATTERN.pattern}", "asset.assetId"))
    if isinstance(asset.asset_revision, bool) or not isinstance(asset.asset_revision, int) or not 0 <= asset.asset_revision <= 2147483647:
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.invalid-field", "assetRevision must be an integer from 0 through 2147483647", "asset.assetRevision"))
    _canonical_enum(asset.representation_mode, RepresentationMode, REPRESENTATION_MODES, "asset.representation", result)
    if asset.coordinate_frame != CoordinateFrame(UP_AXIS, FORWARD_AXIS, HANDEDNESS):
        result.append(_diag(DiagnosticSeverity.ERROR, "frame.invalid", "coordinateFrame must be +Y/+Z/RIGHT", "asset.coordinateFrame"))
    if asset.meters_per_unit != METERS_PER_UNIT:
        result.append(_diag(DiagnosticSeverity.ERROR, "unit.invalid", "asset.metersPerUnit must be 1", "asset.metersPerUnit"))
    if not isinstance(asset.parts, tuple) or not isinstance(asset.joints, tuple) or not isinstance(asset.markers, tuple) or not isinstance(asset.materials, tuple):
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.invalid-type", "canonical collections must be tuples of explicit models", "asset"))

    part_counts = defaultdict(int)
    render_material_counts = defaultdict(int)
    structural_material_counts = defaultdict(int)
    joint_counts = defaultdict(int)
    marker_counts = defaultdict(int)
    for part in asset.parts:
        if type(part) is CanonicalPart:
            part_counts[part.part_id] += 1
    for material in asset.materials:
        if type(material) is CanonicalMaterial:
            render_material_counts[material.render_material_id] += 1
            if material.structural_material_id is not None:
                structural_material_counts[material.structural_material_id] += 1
    for joint in asset.joints:
        if type(joint) is CanonicalJoint:
            joint_counts[joint.joint_id] += 1
    for marker in asset.markers:
        if type(marker) is CanonicalMarker:
            marker_counts[marker.marker_id] += 1

    if asset.default_structural_material_id is not None:
        _reference(
            asset.default_structural_material_id,
            "asset.defaultStructuralMaterialId",
            "material",
            structural_material_counts,
            result,
        )

    for part in asset.parts:
        path = _path("part", getattr(part, "part_id", "?"))
        if not _exact_type(part, CanonicalPart, path, result):
            continue
        if not is_valid_id(part.part_id):
            continue
        _canonical_enum(part.representation_mode, RepresentationMode, REPRESENTATION_MODES, f"{path}.representationMode", result)
        _canonical_enum(part.collision_policy, CollisionPolicy, tuple(item.value for item in CollisionPolicy), f"{path}.collisionPolicy", result)
        _canonical_enum(part.navigation_policy, NavigationPolicy, tuple(item.value for item in NavigationPolicy), f"{path}.navigationPolicy", result)
        if _exact_type(part.thin_feature, ThinFeature, f"{path}.thinFeature", result):
            _canonical_enum(part.thin_feature.policy, ThinFeaturePolicy, THIN_FEATURE_POLICIES, f"{path}.thinFeature.policy", result)
            _number(
                part.thin_feature.declared_minimum_thickness_m,
                f"{path}.thinFeature.declaredMinimumThicknessMeters",
                result,
                positive=True,
            )
        if part.parent_part_id is not None:
            _reference(part.parent_part_id, f"{path}.parentPartId", "part", part_counts, result)
        if part.default_render_material_id is not None:
            _reference(part.default_render_material_id, f"{path}.defaultRenderMaterialId", "render material", render_material_counts, result)
        if part.structural_material_id is not None:
            _reference(part.structural_material_id, f"{path}.structuralMaterialId", "structural material", structural_material_counts, result)
        if not isinstance(part.destructible, bool):
            result.append(_diag(DiagnosticSeverity.ERROR, "schema.invalid-field", "destructible must be boolean", f"{path}.destructible"))
        if part.representation_mode == RepresentationMode.DECORATIVE:
            if part.destructible is not False:
                result.append(_diag(DiagnosticSeverity.ERROR, "representation.decorative-destructible", "Decorative parts must be non-destructible", path))
            if part.collision_policy not in (CollisionPolicy.NONE, CollisionPolicy.AUTHORED_MESH):
                result.append(_diag(DiagnosticSeverity.ERROR, "representation.decorative-collision", "Decorative collisionPolicy must be None or AuthoredMesh", path))
        if part.representation_mode in (RepresentationMode.SHELL, RepresentationMode.LAYERED_SHELL):
            if type(part.shell) is not Shell:
                result.append(_diag(DiagnosticSeverity.ERROR, "geometry.shell-required", "Shell and LayeredShell require shell data", path))
            else:
                _number(part.shell.thickness_m, f"{path}.shell.thicknessMeters", result, positive=True)
                for index, layer in enumerate(part.shell.layers):
                    _reference(
                        layer.structural_material_id,
                        f"{path}.shell.layers[{index}].structuralMaterialId",
                        "structural material",
                        structural_material_counts,
                        result,
                    )
        elif part.shell is not None and type(part.shell) is Shell:
            _number(part.shell.thickness_m, f"{path}.shell.thicknessMeters", result, positive=True)
            for index, layer in enumerate(part.shell.layers):
                _reference(
                    layer.structural_material_id,
                    f"{path}.shell.layers[{index}].structuralMaterialId",
                    "structural material",
                    structural_material_counts,
                    result,
                )
        result.extend(_transform_diagnostics(part.transform, f"{path}.transform", options))

    _part_parent_cycles([part for part in asset.parts if type(part) is CanonicalPart], result)

    for joint in asset.joints:
        path = _path("joint", getattr(joint, "joint_id", "?"))
        if not _exact_type(joint, CanonicalJoint, path, result):
            continue
        _canonical_enum(joint.joint_type, JointType, tuple(item.value for item in JointType), f"{path}.jointType", result)
        _canonical_enum(joint.break_policy, BreakPolicy, tuple(item.value for item in BreakPolicy), f"{path}.breakPolicy", result)
        _reference(joint.child_part_id, f"{path}.childPartId", "part", part_counts, result)
        _reference(joint.parent_part_id, f"{path}.parentPartId", "part", part_counts, result)
        if joint.break_force_n is not None:
            _number(joint.break_force_n, f"{path}.breakForceNewtons", result, positive=True)
        if joint.break_torque_nm is not None:
            _number(joint.break_torque_nm, f"{path}.breakTorqueNewtonMeters", result, positive=True)
        if joint.break_policy == BreakPolicy.THRESHOLD and not (
            _finite_number(joint.break_force_n) and float(cast(float, joint.break_force_n)) > 0.0
            or _finite_number(joint.break_torque_nm) and float(cast(float, joint.break_torque_nm)) > 0.0
        ):
            result.append(_diag(DiagnosticSeverity.ERROR, "policy.threshold", "Threshold joints require a positive force or torque", path))

    for marker in asset.markers:
        path = _path("marker", getattr(marker, "marker_id", "?"))
        if not _exact_type(marker, CanonicalMarker, path, result):
            continue
        _canonical_enum(marker.marker_type, MarkerType, tuple(item.value for item in MarkerType), f"{path}.markerType", result)
        if marker.part_id is not None:
            _reference(marker.part_id, f"{path}.partId", "part", part_counts, result)
        result.extend(_transform_diagnostics(marker.transform, f"{path}.transform", options))
        if marker.marker_type == MarkerType.CUT_INTERFACE and not is_valid_id(marker.interface_id):
            result.append(_diag(DiagnosticSeverity.ERROR, "schema.cut-interface-id", "CutInterface requires a valid interfaceId", path))
        elif marker.marker_type != MarkerType.CUT_INTERFACE and marker.interface_id is not None:
            result.append(
                _diag(
                    DiagnosticSeverity.ERROR,
                    "schema.cut-interface-id",
                    "interfaceId is only allowed for CutInterface markers",
                    f"{path}.interfaceId",
                )
            )

    for material in asset.materials:
        path = _path("material", getattr(material, "render_material_id", "?"))
        _exact_type(material, CanonicalMaterial, path, result)

    try:
        json.dumps(asset.to_contract_dict(), sort_keys=True, separators=(",", ":"), allow_nan=False)
    except (TypeError, ValueError, OverflowError) as exc:
        result.append(_diag(DiagnosticSeverity.ERROR, "schema.non-canonical", f"canonical fields are not serializable: {exc}", "asset"))
    return result


def _inventory_representation(part_by_id: Mapping[str, CanonicalPart], mesh_id: str, primitive_id: str) -> object:
    part = part_by_id.get(primitive_id) or part_by_id.get(mesh_id)
    return None if part is None else part.representation_mode.value


def _validate_geometry_inventory(
    asset: CanonicalAsset,
    inventory: GeometryInventory,
    result: list[Diagnostic],
) -> None:
    """Validate evaluated geometry without changing canonical document values."""

    meshes = list(inventory.meshes)
    materials = list(inventory.materials)
    primitives = list(inventory.primitives)
    result.extend(_id_diagnostics([(item.mesh_id, item.mesh_id, _path("mesh", item.mesh_id)) for item in meshes], "mesh"))
    result.extend(_id_diagnostics([(item.material_id, item.material_id, _path("material", item.material_id)) for item in materials], "material"))
    result.extend(_id_diagnostics([(item.primitive_id, item.primitive_id, _path("primitive", item.primitive_id)) for item in primitives], "primitive"))

    material_ids = {item.material_id for item in materials}
    meshes_by_id = {item.mesh_id: item for item in meshes}
    part_by_id = {part.part_id: part for part in asset.parts if type(part) is CanonicalPart}
    primitive_materials_by_part: defaultdict[str, set[str]] = defaultdict(set)

    for mesh in sorted(meshes, key=lambda item: str(item.mesh_id)):
        path = _path("mesh", mesh.mesh_id)
        for material_id in mesh.material_ids:
            if not is_valid_id(material_id):
                result.append(_diag(DiagnosticSeverity.ERROR, "inventory.material-id", "mesh contains an invalid material ID", path))
            elif material_id not in material_ids:
                result.append(_diag(DiagnosticSeverity.ERROR, "inventory.missing-material", f"mesh material is not in inventory: {material_id}", path))
        if not mesh.material_ids:
            result.append(_diag(DiagnosticSeverity.ERROR, "inventory.missing-material-assignment", "mesh has no material assignment", path))
        if mesh.bounds_min is not None and mesh.bounds_max is not None:
            bounds = (*mesh.bounds_min, *mesh.bounds_max)
            if len(mesh.bounds_min) != 3 or len(mesh.bounds_max) != 3 or any(not _finite_number(value) for value in bounds):
                result.append(_diag(DiagnosticSeverity.ERROR, "inventory.bounds", "mesh bounds must be finite meter coordinates", path))
            elif any(float(low) > float(high) for low, high in zip(mesh.bounds_min, mesh.bounds_max)):
                result.append(_diag(DiagnosticSeverity.ERROR, "inventory.bounds", "mesh bounds minimum exceeds maximum", path))
        result.extend(_topology_diagnostics(mesh, path, None))

    for primitive in sorted(primitives, key=lambda item: str(item.primitive_id)):
        path = _path("primitive", primitive.primitive_id)
        mesh = meshes_by_id.get(primitive.mesh_id)
        if mesh is None:
            result.append(_diag(DiagnosticSeverity.ERROR, "inventory.missing-mesh", f"primitive references missing mesh: {primitive.mesh_id}", path))
        if primitive.material_id is None:
            result.append(_diag(DiagnosticSeverity.ERROR, "inventory.missing-material-assignment", "primitive has no material assignment", path))
        elif primitive.material_id not in material_ids:
            result.append(_diag(DiagnosticSeverity.ERROR, "inventory.missing-material", f"primitive material is not in inventory: {primitive.material_id}", path))
        if primitive.mesh_id in part_by_id and primitive.material_id is not None:
            primitive_materials_by_part[primitive.mesh_id].add(primitive.material_id)
        elif primitive.primitive_id in part_by_id and primitive.material_id is not None:
            primitive_materials_by_part[primitive.primitive_id].add(primitive.material_id)
        if mesh is not None:
            representation = _inventory_representation(part_by_id, primitive.mesh_id, primitive.primitive_id)
            result.extend(_topology_diagnostics(mesh, path, representation))

    # A Solid part must have geometry that can be associated with its stable
    # part identity; otherwise its closed-volume requirement cannot be proven.
    primitive_ids = {item.primitive_id for item in primitives}
    mesh_ids = {item.mesh_id for item in meshes}
    for part in sorted(part_by_id.values(), key=lambda item: item.part_id):
        assigned_materials = primitive_materials_by_part.get(part.part_id, set())
        if (
            assigned_materials
            and part.default_render_material_id is not None
            and part.default_render_material_id not in assigned_materials
        ):
            result.append(
                _diag(
                    DiagnosticSeverity.ERROR,
                    "inventory.default-material-not-assigned",
                    "part defaultRenderMaterialId is not assigned to any evaluated primitive",
                    f"{_path('part', part.part_id)}.defaultRenderMaterialId",
                )
            )
        if part.representation_mode is RepresentationMode.SOLID and not (
            part.part_id in primitive_ids or part.part_id in mesh_ids
        ):
            result.append(_diag(DiagnosticSeverity.ERROR, "geometry.solid-not-closed", "Solid requires a closed non-empty volume", _path("part", part.part_id)))


def _validate_authoring_input(value: AuthoringInput, options: ValidationOptions) -> list[Diagnostic]:
    result = _validate_canonical(value.asset, options)
    _validate_geometry_inventory(value.asset, value.inventory, result)
    return result


def validate_asset(
    asset: AuthoredAsset | CanonicalAsset | AuthoringInput | ExtractedAsset,
    options: ValidationOptions | None = None,
) -> tuple[Diagnostic, ...]:
    """Return stable diagnostics; any error makes the asset ineligible for export."""

    options = options or ValidationOptions()
    if type(asset) in (AuthoringInput, ExtractedAsset):
        return _sort_diagnostics(_validate_authoring_input(cast(AuthoringInput, asset), options))
    if type(asset) is CanonicalAsset:
        return _sort_diagnostics(_validate_canonical(asset, options))
    if type(asset) is not AuthoredAsset:
        return (_diag(DiagnosticSeverity.ERROR, "schema.invalid-input", "asset must be an explicit Hestia asset model", "asset"),)
    result: list[Diagnostic] = []
    if asset.units != "m":
        result.append(_diag(DiagnosticSeverity.ERROR, "unit.non-meter", "linear authoring units must be meters (m)", "asset"))
    result.extend(_property_errors(dict(asset.properties), set(), "asset"))
    result.extend(_id_diagnostics([("asset", asset.asset_id, "asset")], "asset"))
    result.extend(_id_diagnostics([(node.part_id, node.part_id, _path("part", node.part_id)) for node in asset.nodes], "part"))
    result.extend(_id_diagnostics([(marker.marker_id, marker.marker_id, _path("marker", marker.marker_id)) for marker in asset.markers], "marker"))
    result.extend(_id_diagnostics([(joint.joint_id, joint.joint_id, _path("joint", joint.joint_id)) for joint in asset.joints], "joint"))
    material_inventory_supplied = bool(asset.materials)
    material_ids = {item.material_id for item in asset.materials}
    for node in sorted(asset.nodes, key=lambda item: str(item.node_id)):
        result.extend(_validate_node(node, options, material_ids, material_inventory_supplied))
    for marker in sorted(asset.markers, key=lambda item: str(item.marker_id)):
        path = _path("marker", marker.marker_id)
        result.extend(_property_errors(dict(marker.properties), {MARKER_ID_PROPERTY, MARKER_TYPE_PROPERTY}, path))
        if marker.properties.get(MARKER_ID_PROPERTY) != marker.marker_id:
            result.append(_diag(DiagnosticSeverity.ERROR, "schema.marker-id", "property marker ID does not match normalized marker ID", path))
        if not isinstance(marker.properties.get(MARKER_TYPE_PROPERTY), str) or not marker.properties.get(MARKER_TYPE_PROPERTY):
            result.append(_diag(DiagnosticSeverity.ERROR, "schema.marker-type", "marker_type must be a non-empty string", path))
    for joint in sorted(asset.joints, key=lambda item: str(item.joint_id)):
        path = _path("joint", joint.joint_id)
        result.extend(_property_errors(dict(joint.properties), {"hestia.joint_id"}, path))
        if joint.properties.get("hestia.joint_id") != joint.joint_id:
            result.append(_diag(DiagnosticSeverity.ERROR, "schema.joint-id", "property joint ID does not match normalized joint ID", path))
    _validate_legacy_inventory(asset, result)
    return _sort_diagnostics(result)


def validate(
    asset: AuthoringInput | ExtractedAsset,
    options: ValidationOptions | None = None,
) -> tuple[Diagnostic, ...]:
    """Validate the complete canonical document plus evaluated inventory."""

    return validate_asset(asset, options)


def is_exportable(
    asset: AuthoredAsset | CanonicalAsset | AuthoringInput | ExtractedAsset,
    options: ValidationOptions | None = None,
) -> bool:
    """Return true only when validation has no error diagnostics."""

    return not any(item.severity == DiagnosticSeverity.ERROR for item in validate_asset(asset, options))


__all__ = ["is_exportable", "validate", "validate_asset"]
