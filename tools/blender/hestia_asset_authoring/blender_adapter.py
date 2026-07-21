"""Blender adapter for the Hestia asset-authoring handoff contract.

The adapter is Blender-optional.  The canonical model is deliberately built
from the exact ``hestia.*`` Blender input vocabulary and is serialized only
through the canonical model's camelCase contract.
"""

from __future__ import annotations

import math
import os
from collections import Counter
from collections.abc import Iterable, Mapping
from typing import Any, cast

try:  # pragma: no cover - exercised by Blender, not by the host interpreter
    import bpy  # type: ignore
except ImportError:  # pragma: no cover - normal path for host-side checks
    bpy = None  # type: ignore[assignment]

from .model import (
    AuthoringInput,
    CanonicalAsset,
    CanonicalJoint,
    CanonicalMarker,
    CanonicalMaterial,
    CanonicalPart,
    CollisionPolicy,
    ExtractedAsset,
    GeometryInventory,
    JointType,
    MarkerType,
    NavigationPolicy,
    RepresentationMode,
    Shell,
    ShellLayer,
    ThinFeature,
    ThinFeaturePolicy,
    MaterialInventory,
    MeshInventory,
    MeshTopology,
    PrimitiveInventory,
    Transform,
)
from .schema import (
    ASSET_ID_PROPERTY,
    ASSET_REVISION_PROPERTY,
    BREAK_FORCE_N_PROPERTY,
    BREAK_POLICY_PROPERTY,
    BREAK_TORQUE_NM_PROPERTY,
    CHILD_PART_ID_PROPERTY,
    COLLISION_POLICY_PROPERTY,
    CUT_INTERFACE_ID_PROPERTY,
    DECLARED_MINIMUM_THICKNESS_M_PROPERTY,
    DESTRUCTIBLE_PROPERTY,
    JOINT_ID_PROPERTY,
    JOINT_TYPE_PROPERTY,
    KNOWN_PROPERTY_NAMES,
    MARKER_ID_PROPERTY,
    MARKER_TYPE_PROPERTY,
    NAVIGATION_POLICY_PROPERTY,
    PALETTE_INDEX_PROPERTY,
    PARENT_PART_ID_PROPERTY,
    PART_ID_PROPERTY,
    RENDER_MATERIAL_ID_PROPERTY,
    REPRESENTATION_MODE_PROPERTY,
    SCHEMA_ID,
    SHELL_THICKNESS_M_PROPERTY,
    STRUCTURAL_MATERIAL_ID_PROPERTY,
    THIN_FEATURE_POLICY_PROPERTY,
)


class BlenderUnavailableError(RuntimeError):
    """Raised when a Blender-backed operation is called outside Blender."""


class HestiaContractError(ValueError):
    """Raised when Blender data cannot satisfy the handoff contract."""


_MISSING = object()
_DEGENERATE_AREA_EPSILON = 1.0e-12
_SCHEMA_VERSION_PROPERTY = "hestia.schema_version"
_KNOWN_INPUT_PROPERTY_NAMES = KNOWN_PROPERTY_NAMES | {_SCHEMA_VERSION_PROPERTY}

_PROPERTY_TO_CANONICAL = {
    _SCHEMA_VERSION_PROPERTY: "schema",
    ASSET_ID_PROPERTY: "assetId",
    ASSET_REVISION_PROPERTY: "assetRevision",
    PART_ID_PROPERTY: "partId",
    PARENT_PART_ID_PROPERTY: "parentPartId",
    REPRESENTATION_MODE_PROPERTY: "representation",
    RENDER_MATERIAL_ID_PROPERTY: "renderMaterialId",
    STRUCTURAL_MATERIAL_ID_PROPERTY: "structuralMaterialId",
    DESTRUCTIBLE_PROPERTY: "destructible",
    COLLISION_POLICY_PROPERTY: "collisionPolicy",
    NAVIGATION_POLICY_PROPERTY: "navigationPolicy",
    THIN_FEATURE_POLICY_PROPERTY: "policy",
    DECLARED_MINIMUM_THICKNESS_M_PROPERTY: "declaredMinimumThicknessMeters",
    SHELL_THICKNESS_M_PROPERTY: "thicknessMeters",
    JOINT_ID_PROPERTY: "jointId",
    CHILD_PART_ID_PROPERTY: "childPartId",
    JOINT_TYPE_PROPERTY: "jointType",
    BREAK_POLICY_PROPERTY: "breakPolicy",
    BREAK_FORCE_N_PROPERTY: "breakForceNewtons",
    BREAK_TORQUE_NM_PROPERTY: "breakTorqueNewtonMeters",
    MARKER_ID_PROPERTY: "markerId",
    MARKER_TYPE_PROPERTY: "markerType",
    CUT_INTERFACE_ID_PROPERTY: "interfaceId",
    PALETTE_INDEX_PROPERTY: "paletteIndex",
}
_CANONICAL_PROPERTY_NAMES = frozenset(_PROPERTY_TO_CANONICAL.values()) | frozenset(
    {
        "coordinateFrame", "defaultRenderMaterialId", "defaultStructuralMaterialId",
        "layers", "metersPerUnit", "shell", "tags", "thinFeature",
        # Fail closed on obsolete flattened aliases as well as the committed
        # canonical extras vocabulary.
        "breakForceN", "breakTorqueNm", "cutInterfaceId",
        "declaredMinimumThicknessM", "representationMode",
        "shellThicknessM", "thinFeaturePolicy",
    }
)

_ASSET_PROPERTIES = frozenset(
    {_SCHEMA_VERSION_PROPERTY, ASSET_ID_PROPERTY, ASSET_REVISION_PROPERTY, REPRESENTATION_MODE_PROPERTY}
)
_PART_PROPERTIES = frozenset(
    {
        PART_ID_PROPERTY,
        PARENT_PART_ID_PROPERTY,
        REPRESENTATION_MODE_PROPERTY,
        RENDER_MATERIAL_ID_PROPERTY,
        STRUCTURAL_MATERIAL_ID_PROPERTY,
        DESTRUCTIBLE_PROPERTY,
        COLLISION_POLICY_PROPERTY,
        NAVIGATION_POLICY_PROPERTY,
        THIN_FEATURE_POLICY_PROPERTY,
        DECLARED_MINIMUM_THICKNESS_M_PROPERTY,
        SHELL_THICKNESS_M_PROPERTY,
    }
)
_JOINT_PROPERTIES = frozenset(
    {
        JOINT_ID_PROPERTY,
        PARENT_PART_ID_PROPERTY,
        CHILD_PART_ID_PROPERTY,
        JOINT_TYPE_PROPERTY,
        BREAK_POLICY_PROPERTY,
        BREAK_FORCE_N_PROPERTY,
        BREAK_TORQUE_NM_PROPERTY,
    }
)
_MARKER_PROPERTIES = frozenset(
    {MARKER_ID_PROPERTY, MARKER_TYPE_PROPERTY, PART_ID_PROPERTY, CUT_INTERFACE_ID_PROPERTY}
)
_MATERIAL_PROPERTIES = frozenset(
    {RENDER_MATERIAL_ID_PROPERTY, STRUCTURAL_MATERIAL_ID_PROPERTY, PALETTE_INDEX_PROPERTY}
)

# A shared reference alone does not establish an object's semantic role.
# Every other role-shaped field is exclusive among exported node roles and
# therefore requires that role's explicit identifier.
_PART_ROLE_FIELDS = _PART_PROPERTIES - {PART_ID_PROPERTY, PARENT_PART_ID_PROPERTY}
_JOINT_ROLE_FIELDS = _JOINT_PROPERTIES - {JOINT_ID_PROPERTY, PARENT_PART_ID_PROPERTY}
_MARKER_ROLE_FIELDS = _MARKER_PROPERTIES - {MARKER_ID_PROPERTY, PART_ID_PROPERTY}

_EXTRA_FIELDS = {
    "part": frozenset({
        "kind",
        "partId", "parentPartId", "representation", "defaultRenderMaterialId",
        "structuralMaterialId", "destructible", "collisionPolicy",
        "navigationPolicy", "thinFeature", "shell", "tags",
    }),
    "joint": frozenset({
        "kind",
        "jointId", "parentPartId", "childPartId", "jointType", "breakPolicy",
        "breakForceNewtons", "breakTorqueNewtonMeters", "tags",
    }),
    "marker": frozenset({"kind", "markerId", "markerType", "partId", "interfaceId", "tags"}),
}
_ASSET_EXTRA_FIELDS = frozenset({
    "schema", "assetId", "assetRevision", "representation", "metersPerUnit",
    "coordinateFrame", "defaultStructuralMaterialId", "tags",
})
_MATERIAL_EXTRA_FIELDS = frozenset(
    {"renderMaterialId", "structuralMaterialId", "paletteIndex", "tags"}
)


def _require_blender() -> Any:
    if bpy is None:
        raise BlenderUnavailableError("Hestia Blender adapter operations require Blender's bpy module")
    return bpy


def require_blender() -> Any:
    """Return Blender's module through the adapter-owned boundary."""

    return _require_blender()


def _stable_name(value: Any) -> str:
    name = getattr(value, "name", None)
    if not isinstance(name, str):
        raise HestiaContractError("Blender data-block has no stable string name")
    return name


def _stable_key(value: Any) -> tuple[str, str]:
    name = _stable_name(value)
    name_full = getattr(value, "name_full", name)
    return name, name_full if isinstance(name_full, str) else name


def _sorted_unique(items: Iterable[Any]) -> tuple[Any, ...]:
    result: list[Any] = []
    seen: set[int] = set()
    for item in sorted(items, key=_stable_key):
        marker = id(item)
        if marker not in seen:
            seen.add(marker)
            result.append(item)
    return tuple(result)


def iter_collection_objects(collection: Any, *, recursive: bool = True) -> tuple[Any, ...]:
    """Return collection objects once, in stable-name order."""

    _require_blender()
    if collection is None:
        raise HestiaContractError("collection is required")
    found: list[Any] = list(getattr(collection, "objects", ()))
    if recursive:
        for child in sorted(getattr(collection, "children", ()), key=_stable_key):
            found.extend(iter_collection_objects(child, recursive=True))
    return _sorted_unique(found)


def iter_scene_objects(scene: Any | None = None) -> tuple[Any, ...]:
    """Return all objects in a scene's collection tree by stable name."""

    blender = _require_blender()
    selected_scene = scene if scene is not None else blender.context.scene
    if selected_scene is None:
        raise HestiaContractError("a Blender scene is required")
    return iter_collection_objects(selected_scene.collection)


def find_named_collection(name: str, scene: Any | None = None) -> Any:
    """Find one named collection in a scene tree, failing on ambiguity."""

    blender = _require_blender()
    if not isinstance(name, str):
        raise TypeError("collection name must be a string")
    selected_scene = scene if scene is not None else blender.context.scene
    collections: list[Any] = []

    def visit(collection: Any) -> None:
        if _stable_name(collection) == name:
            collections.append(collection)
        for child in sorted(getattr(collection, "children", ()), key=_stable_key):
            visit(child)

    visit(selected_scene.collection)
    if len(collections) > 1:
        raise HestiaContractError(f"collection name is ambiguous: {name!r}")
    if not collections:
        raise HestiaContractError(f"named collection was not found: {name!r}")
    return collections[0]


def iter_named_collection(name: str, scene: Any | None = None) -> tuple[Any, ...]:
    """Return the objects in a named collection tree by stable name."""

    return iter_collection_objects(find_named_collection(name, scene), recursive=True)


def _property_keys(data_block: Any) -> tuple[str, ...]:
    keys = getattr(data_block, "keys", None)
    if not callable(keys):
        return ()
    raw_keys = cast(Iterable[Any], keys())
    return tuple(key for key in raw_keys if isinstance(key, str))


def _property_value(data_block: Any, name: str, default: Any = _MISSING) -> Any:
    getter = getattr(data_block, "get", None)
    if callable(getter):
        value = getter(name, _MISSING)
        if value is not _MISSING:
            return value
    try:
        return data_block[name]
    except (KeyError, IndexError, TypeError):
        return default


def _validate_property_names(data_block: Any, owner: str) -> tuple[str, ...]:
    """Reject unknown Hestia names and all canonical camelCase input names."""

    names = _property_keys(data_block) if not isinstance(data_block, Mapping) else tuple(data_block.keys())
    if any(not isinstance(name, str) for name in names):
        raise HestiaContractError(f"{owner} has a non-string custom property name")
    unknown = sorted(
        name for name in names
        if name == "hestia" or (name.startswith("hestia.") and name not in _KNOWN_INPUT_PROPERTY_NAMES)
    )
    if unknown:
        raise HestiaContractError(f"{owner} has unknown Hestia custom property: {unknown[0]}")
    canonical = sorted(name for name in names if name in _CANONICAL_PROPERTY_NAMES)
    if canonical:
        raise HestiaContractError(
            f"{owner} uses canonical camelCase custom property instead of an exact hestia.* input: {canonical[0]}"
        )
    return tuple(name for name in names if isinstance(name, str))


def extract_properties(data_block: Any, *, include_unknown: bool = False) -> dict[str, Any]:
    """Extract only the committed exact ``hestia.*`` input vocabulary."""

    names = _validate_property_names(data_block, "data block")
    result = {
        key: _property_value(data_block, key)
        for key in sorted(names)
        if key in _KNOWN_INPUT_PROPERTY_NAMES
    }
    if include_unknown:
        result.update({key: _property_value(data_block, key) for key in sorted(names) if key not in result})
    return result


def canonical_properties(data_block_or_properties: Any) -> dict[str, Any]:
    """Map exact Hestia input names to canonical camelCase names only."""

    properties = (
        dict(data_block_or_properties)
        if isinstance(data_block_or_properties, Mapping)
        else extract_properties(data_block_or_properties)
    )
    _validate_property_names(properties, "properties")
    result: dict[str, Any] = {}
    for key in sorted(properties):
        if key in _KNOWN_INPUT_PROPERTY_NAMES:
            result[_PROPERTY_TO_CANONICAL[key]] = properties[key]
    dropped = sorted(set(properties) - _KNOWN_INPUT_PROPERTY_NAMES)
    if dropped:
        raise HestiaContractError(f"property has no canonical mapping: {dropped[0]}")
    return result


def _role_properties(data_block: Any, owner: str, allowed: frozenset[str]) -> dict[str, Any]:
    properties = extract_properties(data_block)
    unexpected = sorted(set(properties) - allowed)
    if unexpected:
        raise HestiaContractError(f"{owner} has a property not valid for its role: {unexpected[0]}")
    return properties


def _required_exact(properties: Mapping[str, Any], name: str, owner: str) -> Any:
    value = properties.get(name, _MISSING)
    if value is _MISSING:
        raise HestiaContractError(f"{owner} lacks required custom property: {name}")
    return value


def _optional_fields(properties: Mapping[str, Any], names: Mapping[str, str]) -> dict[str, Any]:
    return {field: properties[property_name] for property_name, field in names.items() if property_name in properties}


def _finite_components(values: Iterable[Any], label: str) -> tuple[float, ...]:
    result: list[float] = []
    for value in values:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise HestiaContractError(f"{label} contains a non-numeric value")
        converted = float(value)
        if not math.isfinite(converted):
            raise HestiaContractError(f"{label} contains a non-finite value")
        result.append(converted)
    return tuple(result)


def _matrix_determinant(matrix: Any) -> float:
    determinant = getattr(matrix, "determinant", None)
    if callable(determinant):
        result = float(cast(Any, determinant)())
    else:
        values = [[float(matrix[row][column]) for column in range(4)] for row in range(4)]
        result = (
            values[0][0] * (values[1][1] * (values[2][2] * values[3][3] - values[2][3] * values[3][2])
            - values[1][2] * (values[2][1] * values[3][3] - values[2][3] * values[3][1])
            + values[1][3] * (values[2][1] * values[3][2] - values[2][2] * values[3][1]))
            - values[0][1] * (values[1][0] * (values[2][2] * values[3][3] - values[2][3] * values[3][2])
            - values[1][2] * (values[2][0] * values[3][3] - values[2][3] * values[3][0])
            + values[1][3] * (values[2][0] * values[3][2] - values[2][2] * values[3][0]))
            + values[0][2] * (values[1][0] * (values[2][1] * values[3][3] - values[2][3] * values[3][1])
            - values[1][1] * (values[2][0] * values[3][3] - values[2][3] * values[3][0])
            + values[1][3] * (values[2][0] * values[3][1] - values[2][1] * values[3][0]))
            - values[0][3] * (values[1][0] * (values[2][1] * values[3][2] - values[2][2] * values[3][1])
            - values[1][1] * (values[2][0] * values[3][2] - values[2][2] * values[3][0])
            + values[1][2] * (values[2][0] * values[3][1] - values[2][1] * values[3][0]))
        )
    if not math.isfinite(result):
        raise HestiaContractError("transform determinant is non-finite")
    return result


def transform_metrics(obj: Any) -> dict[str, Any]:
    """Read a finite local transform, including scale and determinant."""

    _require_blender()
    matrix = getattr(obj, "matrix_local", None)
    if matrix is None:
        raise HestiaContractError(f"object has no local transform: {_stable_name(obj)}")
    try:
        translation = _finite_components(matrix.to_translation(), "translation")
        rotation = _finite_components(matrix.to_quaternion(), "rotation")
        scale = _finite_components(matrix.to_scale(), "scale")
    except AttributeError as exc:
        raise HestiaContractError("Blender transform decomposition is unavailable") from exc
    if len(translation) != 3 or len(rotation) != 4 or len(scale) != 3:
        raise HestiaContractError("Blender transform decomposition returned invalid dimensions")
    return {
        "translation": translation,
        "rotation": rotation,
        "scale": scale,
        "determinant": _matrix_determinant(matrix),
    }


def transform_from_object(obj: Any) -> Transform:
    metrics = transform_metrics(obj)
    scale = list(metrics["scale"])
    scale_product = scale[0] * scale[1] * scale[2]
    determinant = metrics["determinant"]
    if determinant != 0.0 and scale_product != 0.0:
        # Blender's decomposition can discard the reflection sign.  Preserve
        # the actual matrix determinant in the only transform quantity the
        # immutable core model exposes, so core validation cannot accept a
        # mirrored matrix as positive merely because ``to_scale`` did.
        scale[0] *= determinant / scale_product
    return Transform(
        translation=metrics["translation"],
        rotation=metrics["rotation"],
        scale=tuple(scale),
    )


def _mesh_topology(mesh: Any, polygons: Iterable[Any] | None = None) -> MeshTopology:
    vertices: tuple[Any, ...] = tuple(cast(Iterable[Any], getattr(mesh, "vertices", ())))
    edges: tuple[Any, ...] = tuple(cast(Iterable[Any], getattr(mesh, "edges", ())))
    selected_polygons: tuple[Any, ...] = tuple(
        cast(Iterable[Any], getattr(mesh, "polygons", ())) if polygons is None else polygons
    )
    incidence: Counter[tuple[int, int]] = Counter()
    degenerate = 0
    triangles = 0
    for polygon in selected_polygons:
        indices = tuple(int(index) for index in getattr(polygon, "vertices", ()))
        area = getattr(polygon, "area", None)
        is_degenerate = len(indices) < 3 or len(set(indices)) != len(indices)
        if area is not None:
            area_value = float(area)
            is_degenerate = is_degenerate or not math.isfinite(area_value) or area_value <= _DEGENERATE_AREA_EPSILON
        if is_degenerate:
            degenerate += 1
        if len(indices) >= 3:
            triangles += len(indices) - 2
        for position, first in enumerate(indices):
            second = indices[(position + 1) % len(indices)]
            incidence[(min(first, second), max(first, second))] += 1
    edge_keys: set[tuple[int, int]] = set()
    for edge in edges:
        edge_vertices = tuple(int(index) for index in getattr(edge, "vertices", ()))
        if len(edge_vertices) == 2:
            edge_keys.add((min(edge_vertices), max(edge_vertices)))
    all_edges = edge_keys | set(incidence)
    return MeshTopology(
        vertex_count=len(vertices),
        edge_count=len(edges),
        polygon_count=len(selected_polygons),
        triangle_count=triangles,
        boundary_edge_count=sum(incidence[key] == 1 for key in all_edges),
        non_manifold_edge_count=sum(incidence[key] > 2 for key in all_edges),
        degenerate_polygon_count=degenerate,
    )


def _material_id(material: Any) -> str:
    """Read the inventory identifier without accepting canonical Hestia input."""

    _validate_property_names(material, f"material {_stable_name(material)}")
    properties = _role_properties(
        material, f"material {_stable_name(material)}", _MATERIAL_PROPERTIES
    )
    value = properties.get(RENDER_MATERIAL_ID_PROPERTY, _MISSING)
    if value is _MISSING:
        raise HestiaContractError(
            f"material lacks required custom property: {RENDER_MATERIAL_ID_PROPERTY}"
        )
    if not isinstance(value, str):
        raise HestiaContractError(
            f"{RENDER_MATERIAL_ID_PROPERTY} is not a string: {_stable_name(material)}"
        )
    return value


def mesh_inventory_for_object(
    obj: Any,
    *,
    depsgraph: Any | None = None,
    mesh_id: str | None = None,
    primitive_id: str | None = None,
) -> tuple[MeshInventory, tuple[PrimitiveInventory, ...]] | None:
    """Build evaluated mesh and primitive inventory, always clearing the mesh."""

    blender = _require_blender()
    if getattr(obj, "type", None) != "MESH":
        return None
    graph = depsgraph if depsgraph is not None else blender.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(graph)
    mesh = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=graph)
    try:
        part_id = _property_value(obj, PART_ID_PROPERTY)
        if not isinstance(part_id, str):
            raise HestiaContractError(
                f"mesh object lacks semantic {PART_ID_PROPERTY}: {_stable_name(obj)}"
            )
        slot_material_ids: list[str | None] = []
        for slot in getattr(evaluated, "material_slots", ()):
            material = getattr(slot, "material", None)
            slot_material_ids.append(None if material is None else _material_id(material))
        polygons = tuple(cast(Iterable[Any], getattr(mesh, "polygons", ())))
        polygons_by_slot: dict[int, list[Any]] = {}
        for polygon in polygons:
            slot_index = int(getattr(polygon, "material_index", 0))
            polygons_by_slot.setdefault(slot_index, []).append(polygon)
        used_material_ids = {
            slot_material_ids[index]
            for index in polygons_by_slot
            if 0 <= index < len(slot_material_ids) and slot_material_ids[index] is not None
        }
        material_ids = tuple(sorted(cast(set[str], used_material_ids)))
        vertices: tuple[Any, ...] = tuple(cast(Iterable[Any], getattr(mesh, "vertices", ())))
        if vertices:
            bounds_min = (
                min(float(vertex.co[0]) for vertex in vertices),
                min(float(vertex.co[1]) for vertex in vertices),
                min(float(vertex.co[2]) for vertex in vertices),
            )
            bounds_max = (
                max(float(vertex.co[0]) for vertex in vertices),
                max(float(vertex.co[1]) for vertex in vertices),
                max(float(vertex.co[2]) for vertex in vertices),
            )
        else:
            bounds_min = bounds_max = None
        resolved_mesh_id = part_id if mesh_id is None else mesh_id
        slot_indices = tuple(sorted(polygons_by_slot)) or (0,)
        primitive_ids = tuple(
            primitive_id if primitive_id is not None and len(slot_indices) == 1
            else f"{part_id}:{slot_index}"
            for slot_index in slot_indices
        )
        topology = _mesh_topology(mesh)
        inventory = MeshInventory(
            mesh_id=resolved_mesh_id,
            topology=topology,
            bounds_min=bounds_min,
            bounds_max=bounds_max,
            material_ids=material_ids,
            primitive_ids=primitive_ids,
        )
        primitives = tuple(
            PrimitiveInventory(
                primitive_id=resolved_primitive_id,
                mesh_id=resolved_mesh_id,
                material_id=(
                    slot_material_ids[slot_index]
                    if 0 <= slot_index < len(slot_material_ids)
                    else None
                ),
                topology=_mesh_topology(mesh, polygons_by_slot.get(slot_index, ())),
            )
            for slot_index, resolved_primitive_id in zip(slot_indices, primitive_ids)
        )
        return inventory, primitives
    finally:
        evaluated.to_mesh_clear()


def collect_mesh_inventory(
    objects: Iterable[Any], *, depsgraph: Any | None = None
) -> tuple[tuple[MeshInventory, ...], tuple[PrimitiveInventory, ...], tuple[MaterialInventory, ...]]:
    """Collect deterministic evaluated mesh, primitive, and material inventories."""

    meshes: list[MeshInventory] = []
    primitives: list[PrimitiveInventory] = []
    material_ids: set[str] = set()
    for obj in _sorted_unique(objects):
        result = mesh_inventory_for_object(obj, depsgraph=depsgraph)
        if result is None:
            continue
        mesh, object_primitives = result
        meshes.append(mesh)
        primitives.extend(object_primitives)
        material_ids.update(mesh.material_ids)
    return (
        tuple(sorted(meshes, key=lambda item: item.mesh_id)),
        tuple(sorted(primitives, key=lambda item: item.primitive_id)),
        tuple(MaterialInventory(material_id=value) for value in sorted(material_ids)),
    )


def _duplicate_ids(items: Iterable[Any], field_name: str) -> None:
    seen: set[str] = set()
    for item in items:
        value = getattr(item, field_name)
        if value in seen:
            raise HestiaContractError(f"duplicate {field_name}: {value}")
        seen.add(value)


def extract_asset(
    source: Any,
    *,
    objects: Iterable[Any] | None = None,
    collection: Any | None = None,
    scene: Any | None = None,
    depsgraph: Any | None = None,
) -> AuthoringInput:
    """Construct the canonical document and deterministic evaluated inventory."""

    _require_blender()
    if objects is not None and collection is not None:
        raise HestiaContractError("provide objects or collection, not both")
    source_properties = _role_properties(source, "asset", _ASSET_PROPERTIES)
    schema_version = _required_exact(
        source_properties, _SCHEMA_VERSION_PROPERTY, "asset"
    )
    if schema_version != SCHEMA_ID:
        raise HestiaContractError(
            f"asset custom property {_SCHEMA_VERSION_PROPERTY} must be exactly {SCHEMA_ID}"
        )
    asset_id = _required_exact(source_properties, ASSET_ID_PROPERTY, "asset")
    asset_revision = _required_exact(source_properties, ASSET_REVISION_PROPERTY, "asset")
    asset_representation_mode = _required_exact(
        source_properties, REPRESENTATION_MODE_PROPERTY, "asset"
    )
    part_objects = tuple(objects) if objects is not None else (
        iter_collection_objects(collection) if collection is not None else iter_scene_objects(scene)
    )
    if collection is not None and not part_objects:
        raise HestiaContractError(
            f"named collection contains no exportable objects: {_stable_name(collection)!r}"
        )
    part_objects = _sorted_unique(part_objects)
    parts: list[CanonicalPart] = []
    joints: list[CanonicalJoint] = []
    markers: list[CanonicalMarker] = []
    geometry_objects: list[Any] = []
    for obj in part_objects:
        name = _stable_name(obj)
        properties = extract_properties(obj)
        property_names = set(properties)
        role_shapes = {
            "part": bool(property_names & _PART_ROLE_FIELDS),
            "joint": bool(property_names & _JOINT_ROLE_FIELDS),
            "marker": bool(property_names & _MARKER_ROLE_FIELDS),
        }
        role_ids = {
            "part": PART_ID_PROPERTY,
            "joint": JOINT_ID_PROPERTY,
            "marker": MARKER_ID_PROPERTY,
        }
        for role, shaped in role_shapes.items():
            if shaped and role_ids[role] not in properties:
                raise HestiaContractError(
                    f"{name} has {role}-shaped properties but lacks required custom property: "
                    f"{role_ids[role]}"
                )

        is_marker = MARKER_ID_PROPERTY in properties or role_shapes["marker"]
        is_joint = JOINT_ID_PROPERTY in properties or role_shapes["joint"]
        # A marker's part_id is a reference. Outside a marker role, part_id is
        # the part identity, including the useful fail-closed part-id-only case.
        is_part = role_shapes["part"] or (
            PART_ID_PROPERTY in properties and not is_marker
        )
        active_roles = tuple(
            role for role, active in (
                ("part", is_part), ("joint", is_joint), ("marker", is_marker)
            ) if active
        )
        if len(active_roles) > 1:
            raise HestiaContractError(
                f"{name} combines multiple Hestia roles: {', '.join(active_roles)}"
            )
        if not active_roles:
            if properties:
                raise HestiaContractError(
                    f"{name} has Hestia properties that do not identify a part, joint, or marker role"
                )
            continue
        role = active_roles[0]
        allowed = {
            "part": _PART_PROPERTIES,
            "joint": _JOINT_PROPERTIES,
            "marker": _MARKER_PROPERTIES,
        }[role]
        unexpected = sorted(property_names - allowed)
        if unexpected:
            raise HestiaContractError(f"{name} has a property not valid for its role: {unexpected[0]}")
        if is_part:
            part_representation = _required_exact(
                properties, REPRESENTATION_MODE_PROPERTY, f"part {name}"
            )
            part_fields = _optional_fields(
                properties,
                {
                    PARENT_PART_ID_PROPERTY: "parent_part_id",
                    STRUCTURAL_MATERIAL_ID_PROPERTY: "structural_material_id",
                },
            )
            shell = None
            if SHELL_THICKNESS_M_PROPERTY in properties:
                structural_material_id = properties.get(STRUCTURAL_MATERIAL_ID_PROPERTY)
                if not isinstance(structural_material_id, str):
                    raise HestiaContractError(
                        f"part {name} requires {STRUCTURAL_MATERIAL_ID_PROPERTY} "
                        f"when {SHELL_THICKNESS_M_PROPERTY} is present"
                    )
                shell_thickness = properties[SHELL_THICKNESS_M_PROPERTY]
                shell = Shell(
                    thickness_m=shell_thickness,
                    layers=(
                        ShellLayer(
                            structural_material_id=structural_material_id,
                            thickness_m=shell_thickness,
                        ),
                    ),
                )
            if part_representation in (
                RepresentationMode.SHELL.value,
                RepresentationMode.LAYERED_SHELL.value,
            ) and shell is None:
                raise HestiaContractError(
                    f"part {name} requires {SHELL_THICKNESS_M_PROPERTY} for {part_representation}"
                )
            parts.append(
                CanonicalPart(
                    part_id=_required_exact(properties, PART_ID_PROPERTY, f"part {name}"),
                    representation_mode=cast(Any, part_representation),
                    default_render_material_id=_required_exact(
                        properties, RENDER_MATERIAL_ID_PROPERTY, f"part {name}"
                    ),
                    destructible=_required_exact(
                        properties, DESTRUCTIBLE_PROPERTY, f"part {name}"
                    ),
                    collision_policy=_required_exact(
                        properties, COLLISION_POLICY_PROPERTY, f"part {name}"
                    ),
                    navigation_policy=_required_exact(
                        properties, NAVIGATION_POLICY_PROPERTY, f"part {name}"
                    ),
                    thin_feature=ThinFeature(
                        policy=_required_exact(
                            properties, THIN_FEATURE_POLICY_PROPERTY, f"part {name}"
                        ),
                        declared_minimum_thickness_m=_required_exact(
                            properties, DECLARED_MINIMUM_THICKNESS_M_PROPERTY, f"part {name}"
                        ),
                    ),
                    shell=shell,
                    transform=transform_from_object(obj),
                    **part_fields,
                )
            )
            geometry_objects.append(obj)
        if is_joint:
            break_policy = _required_exact(
                properties, BREAK_POLICY_PROPERTY, f"joint {name}"
            )
            if break_policy == "Threshold" and not any(
                property_name in properties
                for property_name in (BREAK_FORCE_N_PROPERTY, BREAK_TORQUE_NM_PROPERTY)
            ):
                raise HestiaContractError(
                    f"joint {name} with Threshold break policy requires "
                    f"{BREAK_FORCE_N_PROPERTY} or {BREAK_TORQUE_NM_PROPERTY}"
                )
            joints.append(
                CanonicalJoint(
                    joint_id=_required_exact(properties, JOINT_ID_PROPERTY, f"joint {name}"),
                    parent_part_id=_required_exact(
                        properties, PARENT_PART_ID_PROPERTY, f"joint {name}"
                    ),
                    child_part_id=_required_exact(properties, CHILD_PART_ID_PROPERTY, f"joint {name}"),
                    joint_type=_required_exact(
                        properties, JOINT_TYPE_PROPERTY, f"joint {name}"
                    ),
                    break_policy=cast(Any, break_policy),
                    **_optional_fields(
                        properties,
                        {
                            BREAK_FORCE_N_PROPERTY: "break_force_n",
                            BREAK_TORQUE_NM_PROPERTY: "break_torque_nm",
                        },
                    ),
                )
            )
        if is_marker:
            marker_type = _required_exact(
                properties, MARKER_TYPE_PROPERTY, f"marker {name}"
            )
            has_cut_interface = CUT_INTERFACE_ID_PROPERTY in properties
            if marker_type == MarkerType.CUT_INTERFACE.value and not has_cut_interface:
                raise HestiaContractError(
                    f"marker {name} requires {CUT_INTERFACE_ID_PROPERTY} for CutInterface"
                )
            if marker_type != MarkerType.CUT_INTERFACE.value and has_cut_interface:
                raise HestiaContractError(
                    f"marker {name} may only use {CUT_INTERFACE_ID_PROPERTY} for CutInterface"
                )
            markers.append(
                CanonicalMarker(
                    marker_id=_required_exact(properties, MARKER_ID_PROPERTY, f"marker {name}"),
                    marker_type=cast(Any, marker_type),
                    **_optional_fields(
                        properties,
                        {
                            PART_ID_PROPERTY: "part_id",
                            CUT_INTERFACE_ID_PROPERTY: "interface_id",
                        },
                    ),
                    transform=transform_from_object(obj),
                )
            )

    _duplicate_ids(parts, "part_id")
    _duplicate_ids(joints, "joint_id")
    _duplicate_ids(markers, "marker_id")
    meshes, primitives, inventory_materials = collect_mesh_inventory(
        geometry_objects, depsgraph=depsgraph
    )
    canonical_materials: dict[str, CanonicalMaterial] = {}
    material_owners: dict[str, int] = {}
    seen_material_blocks: set[int] = set()
    for obj in geometry_objects:
        for slot in getattr(obj, "material_slots", ()):
            material = getattr(slot, "material", None)
            if material is None:
                continue
            material_identity = id(material)
            if material_identity in seen_material_blocks:
                continue
            seen_material_blocks.add(material_identity)
            properties = _role_properties(
                material, f"material {_stable_name(material)}", _MATERIAL_PROPERTIES
            )
            render_material_id = _required_exact(
                properties, RENDER_MATERIAL_ID_PROPERTY, f"material {_stable_name(material)}"
            )
            candidate = CanonicalMaterial(
                render_material_id=render_material_id,
                **_optional_fields(
                    properties,
                    {
                        STRUCTURAL_MATERIAL_ID_PROPERTY: "structural_material_id",
                        PALETTE_INDEX_PROPERTY: "palette_index",
                    },
                ),
            )
            previous_owner = material_owners.get(render_material_id)
            if previous_owner is not None and previous_owner != material_identity:
                raise HestiaContractError(
                    f"distinct material data-blocks share render material ID: {render_material_id}"
                )
            material_owners[render_material_id] = material_identity
            canonical_materials[render_material_id] = candidate
    materials = tuple(canonical_materials[value] for value in sorted(canonical_materials))
    canonical_asset = CanonicalAsset(
        asset_id=asset_id,
        asset_revision=asset_revision,
        representation_mode=asset_representation_mode,
        parts=tuple(parts),
        joints=tuple(joints),
        markers=tuple(markers),
        materials=materials,
    )
    return ExtractedAsset(
        asset=canonical_asset,
        inventory=GeometryInventory(
            meshes=meshes,
            primitives=primitives,
            materials=inventory_materials,
        ),
    )


def asset_to_canonical(asset: CanonicalAsset) -> dict[str, Any]:
    """Serialize a canonical asset without legacy adapter fields."""

    if not isinstance(asset, CanonicalAsset):
        raise TypeError("asset must be a CanonicalAsset")
    return asset.to_contract_dict()


def _id_property_group(data_block: Any) -> Any:
    ensure = getattr(data_block, "id_properties_ensure", None)
    if callable(ensure):
        return ensure()
    return data_block


def _id_property_value(value: Any) -> Any:
    """Detach nested values before Blender converts them to ID properties."""

    if isinstance(value, Mapping):
        return {str(key): _id_property_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_id_property_value(item) for item in value]
    return value


def attach_hestia_extras(data_block: Any, extras: Mapping[str, Any], *, kind: str | None = None) -> None:
    """Attach canonical nested extras and node-only transport role metadata."""

    _require_blender()
    if not isinstance(extras, Mapping):
        raise TypeError("extras must be a mapping")
    if kind is not None and kind not in _EXTRA_FIELDS:
        raise HestiaContractError("transport kind must be part, joint, or marker")
    fields = _EXTRA_FIELDS[kind] if kind is not None else (
        _ASSET_EXTRA_FIELDS if "schema" in extras else _MATERIAL_EXTRA_FIELDS
    )
    if kind is None and "schema" not in extras and "renderMaterialId" not in extras:
        raise HestiaContractError(
            "asset extras require schema or material extras require renderMaterialId"
        )
    invalid = sorted(key for key in extras if not isinstance(key, str) or key not in fields)
    if invalid:
        raise HestiaContractError(f"non-canonical Hestia extra field: {invalid[0]}")
    if kind is not None and "kind" in extras and extras["kind"] != kind:
        raise HestiaContractError(f"transport kind must be exactly {kind}")
    transport_extras = dict(extras)
    if kind is not None:
        transport_extras["kind"] = kind
    root = _id_property_group(data_block)
    # Assign through the group Blender actually retained.  ID property
    # assignment may copy mappings, so later mutation of a detached local can
    # silently drop every nested field.
    root["hestia"] = {}
    retained = root["hestia"]
    for key in sorted(transport_extras):
        retained[key] = _id_property_value(transport_extras[key])


def _export_property_blocks(objects: Iterable[Any]) -> tuple[Any, ...]:
    blocks: list[Any] = []
    for obj in _sorted_unique(objects):
        blocks.append(obj)
        data = getattr(obj, "data", None)
        if data is not None:
            blocks.append(data)
        for slot in getattr(obj, "material_slots", ()):
            material = getattr(slot, "material", None)
            if material is not None:
                blocks.append(material)
    result: list[Any] = []
    seen: set[int] = set()
    for block in blocks:
        if id(block) not in seen:
            seen.add(id(block))
            result.append(block)
    return tuple(result)


def snapshot_hestia_properties(
    data_blocks: Iterable[Any], *, include_root: bool = True
) -> list[tuple[Any, Mapping[str, Any]]]:
    """Snapshot Hestia values before any temporary attach or stripping."""

    snapshots: list[tuple[Any, Mapping[str, Any]]] = []
    for data_block in data_blocks:
        values: dict[str, Any] = {
            key: _id_property_value(_property_value(data_block, key))
            for key in sorted(_property_keys(data_block))
            if key.startswith("hestia.") or (include_root and key == "hestia")
        }
        snapshots.append((data_block, values))
    return snapshots


def clear_hestia_properties(
    snapshots: Iterable[tuple[Any, Mapping[str, Any]]], *, include_root: bool = True
) -> None:
    """Remove exactly the snapshotted Hestia keys, including partial attempts."""

    failures: list[tuple[str, Exception]] = []
    for data_block, values in snapshots:
        for key in values:
            try:
                del data_block[key]
            except (KeyError, IndexError, TypeError) as exc:
                failures.append((key, exc))
    if failures:
        key, exc = failures[0]
        raise HestiaContractError(f"could not temporarily remove Hestia property: {key}") from exc


def restore_hestia_properties(
    snapshots: Iterable[tuple[Any, Mapping[str, Any]]], *, include_root: bool = True
) -> None:
    """Restore a snapshot and remove any temporary canonical Hestia values."""

    failures: list[tuple[str, Exception]] = []
    for data_block, values in snapshots:
        current_keys = tuple(
            key for key in _property_keys(data_block)
            if key.startswith("hestia.") or (include_root and key == "hestia")
        )
        for key in current_keys:
            if key in values:
                continue
            try:
                del data_block[key]
            except (KeyError, IndexError, TypeError) as exc:
                failures.append((key, exc))
        for key, value in values.items():
            try:
                data_block[key] = _id_property_value(value)
            except (KeyError, IndexError, TypeError, ValueError) as exc:
                failures.append((key, exc))
    if failures:
        key, exc = failures[0]
        raise HestiaContractError(f"could not restore Hestia property: {key}") from exc


def _strip_source_hestia_properties(
    data_blocks: Iterable[Any], *, include_root: bool = True
) -> list[tuple[Any, Mapping[str, Any]]]:
    snapshots = snapshot_hestia_properties(data_blocks, include_root=include_root)
    try:
        clear_hestia_properties(snapshots, include_root=include_root)
    except Exception:
        restore_hestia_properties(snapshots, include_root=include_root)
        raise
    return snapshots


def export_glb(
    output: os.PathLike[str] | str,
    *,
    objects: Iterable[Any] | None = None,
    collection: Any | None = None,
    scene: Any | None = None,
    strip_root_hestia: bool = True,
) -> Any:
    """Export GLB while preventing source Hestia properties from leaking."""

    blender = _require_blender()
    if objects is not None and collection is not None:
        raise HestiaContractError("provide objects or collection, not both")
    selected_scene = scene if scene is not None else blender.context.scene
    target_objects = (
        _sorted_unique(objects)
        if objects is not None
        else iter_collection_objects(collection)
        if collection is not None
        else ()
    )
    if collection is not None and not target_objects:
        raise HestiaContractError(
            f"named collection contains no exportable objects: {_stable_name(collection)!r}"
        )
    export_objects = (
        target_objects
        if objects is not None or collection is not None
        else iter_scene_objects(selected_scene)
    )
    view_layer = blender.context.view_layer
    previous_active = view_layer.objects.active
    previous_selection = tuple(
        obj for obj in getattr(selected_scene, "objects", ()) if getattr(obj, "select_get", lambda: False)()
    )
    snapshots: list[tuple[Any, Mapping[str, Any]]] = []
    try:
        snapshots = _strip_source_hestia_properties(
            _export_property_blocks(export_objects), include_root=strip_root_hestia
        )
        if target_objects:
            for obj in selected_scene.objects:
                obj.select_set(False)
            for obj in target_objects:
                obj.select_set(True)
            view_layer.objects.active = target_objects[0]
        kwargs: dict[str, Any] = {
            "filepath": os.fspath(output),
            "export_format": "GLB",
            "use_selection": bool(target_objects),
            "export_extras": True,
        }
        properties = blender.ops.export_scene.gltf.get_rna_type().properties
        if "export_custom_properties" in properties:
            kwargs["export_custom_properties"] = True
        return blender.ops.export_scene.gltf(**kwargs)
    finally:
        restore_hestia_properties(snapshots, include_root=strip_root_hestia)
        for obj in getattr(selected_scene, "objects", ()):
            obj.select_set(False)
        for obj in previous_selection:
            obj.select_set(True)
        view_layer.objects.active = previous_active


__all__ = [
    "BlenderUnavailableError",
    "HestiaContractError",
    "asset_to_canonical",
    "attach_hestia_extras",
    "canonical_properties",
    "collect_mesh_inventory",
    "export_glb",
    "extract_asset",
    "extract_properties",
    "find_named_collection",
    "iter_collection_objects",
    "iter_named_collection",
    "iter_scene_objects",
    "mesh_inventory_for_object",
    "require_blender",
    "snapshot_hestia_properties",
    "clear_hestia_properties",
    "restore_hestia_properties",
    "transform_from_object",
    "transform_metrics",
]
