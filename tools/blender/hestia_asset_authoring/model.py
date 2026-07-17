"""Frozen Blender-agnostic Hestia authoring and validation models."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from types import MappingProxyType
from typing import Any, Mapping, TypeAlias

from .schema import (
    FORWARD_AXIS,
    HANDEDNESS,
    METERS_PER_UNIT,
    SCHEMA_ID,
    UP_AXIS,
    is_valid_id,
    validate_id,
    validate_property_names,
)


PropertyValue: TypeAlias = Any
Vector3: TypeAlias = tuple[float, float, float]
Quaternion: TypeAlias = tuple[float, float, float, float]


def _finite(value: float, field_name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{field_name} must be a finite number")
    return float(value)


def _vector3(value: tuple[float, ...], field_name: str) -> Vector3:
    if len(value) != 3:
        raise ValueError(f"{field_name} must contain exactly 3 numbers")
    return tuple(value)  # type: ignore[return-value]


def _quaternion(value: tuple[float, ...], field_name: str) -> Quaternion:
    if len(value) != 4:
        raise ValueError(f"{field_name} must contain exactly 4 numbers")
    return tuple(value)  # type: ignore[return-value]


def _mapping(value: Mapping[str, PropertyValue]) -> Mapping[str, PropertyValue]:
    return MappingProxyType(dict(value))


def _non_negative_int(value: int, field_name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{field_name} must be a non-negative integer")
    return value


def _enum(value: Any, enum_type: type[Enum], field_name: str) -> Any:
    try:
        return value if isinstance(value, enum_type) else enum_type(value)
    except ValueError as exc:
        raise ValueError(f"{field_name} has an invalid value: {value!r}") from exc


def _id_or_none(value: str | None, field_name: str) -> str | None:
    return None if value is None else validate_id(value, field_name)


def _optional_number(value: float | None, field_name: str) -> float | None:
    return None if value is None else _finite(value, field_name)


def _optional_positive_number(value: float | None, field_name: str) -> float | None:
    result = _optional_number(value, field_name)
    if result is not None and result <= 0.0:
        raise ValueError(f"{field_name} must be greater than zero")
    return result


def _tags(value: tuple[str, ...] | list[str]) -> tuple[str, ...]:
    result = tuple(validate_id(item, "tag") for item in value)
    if len(set(result)) != len(result):
        raise ValueError("tags must be unique")
    return tuple(sorted(result))


def _omit_none(value: dict[str, Any]) -> dict[str, Any]:
    return {key: item for key, item in value.items() if item is not None}


def _enum_value(value: Enum | str) -> str:
    return value.value if isinstance(value, Enum) else value


class DiagnosticSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class UnappliedScalePolicy(str, Enum):
    IGNORE = "ignore"
    WARNING = "warning"
    ERROR = "error"


class RepresentationMode(str, Enum):
    SOLID = "Solid"
    SHELL = "Shell"
    LAYERED_SHELL = "LayeredShell"
    STRUCTURAL_ASSEMBLY = "StructuralAssembly"
    MODULAR_PART = "ModularPart"
    DECORATIVE = "Decorative"
    HYBRID = "Hybrid"


class ThinFeaturePolicy(str, Enum):
    REJECT = "Reject"
    PRESERVE_AS_BEAM = "PreserveAsBeam"
    PRESERVE_AS_ROD = "PreserveAsRod"
    PRESERVE_AS_SHELL = "PreserveAsShell"
    DECORATIVE_ONLY = "DecorativeOnly"


class CollisionPolicy(str, Enum):
    NONE = "None"
    AUTHORED_MESH = "AuthoredMesh"
    COMPOUND = "Compound"
    VOXEL = "Voxel"


class NavigationPolicy(str, Enum):
    NONE = "None"
    OBSTACLE = "Obstacle"
    WALKABLE = "Walkable"
    PORTAL = "Portal"


class JointType(str, Enum):
    FIXED = "Fixed"
    HINGE = "Hinge"
    SLIDER = "Slider"
    BREAKABLE = "Breakable"


class BreakPolicy(str, Enum):
    NEVER = "Never"
    THRESHOLD = "Threshold"
    SCRIPTED = "Scripted"


class MarkerType(str, Enum):
    SNAP = "Snap"
    DOCKING = "Docking"
    CARGO = "Cargo"
    INTERACTION = "Interaction"
    STORY = "Story"
    SPAWN = "Spawn"
    CUT_INTERFACE = "CutInterface"
    TOOL_MOUNT = "ToolMount"
    SEAT = "Seat"


@dataclass(frozen=True, slots=True)
class Transform:
    """Finite local transform used by adapters and geometry inventories."""

    translation: Vector3 = (0.0, 0.0, 0.0)
    rotation: Quaternion = (0.0, 0.0, 0.0, 1.0)
    scale: Vector3 = (1.0, 1.0, 1.0)

    def __post_init__(self) -> None:
        object.__setattr__(self, "translation", _vector3(self.translation, "translation"))
        object.__setattr__(self, "rotation", _quaternion(self.rotation, "rotation"))
        object.__setattr__(self, "scale", _vector3(self.scale, "scale"))

    @property
    def has_unapplied_scale(self) -> bool:
        return self.scale != (1.0, 1.0, 1.0)

    def to_contract_dict(self) -> dict[str, Any]:
        return {
            "translation": list(self.translation),
            "rotation": list(self.rotation),
            "scale": list(self.scale),
        }


@dataclass(frozen=True, slots=True)
class CoordinateFrame:
    up_axis: str = UP_AXIS
    forward_axis: str = FORWARD_AXIS
    handedness: str = HANDEDNESS

    def __post_init__(self) -> None:
        if (self.up_axis, self.forward_axis, self.handedness) != (
            UP_AXIS,
            FORWARD_AXIS,
            HANDEDNESS,
        ):
            raise ValueError("coordinateFrame must be +Y/+Z/RIGHT")

    def to_contract_dict(self) -> dict[str, str]:
        return {
            "upAxis": self.up_axis,
            "forwardAxis": self.forward_axis,
            "handedness": self.handedness,
        }


@dataclass(frozen=True, slots=True)
class ThinFeature:
    policy: ThinFeaturePolicy
    declared_minimum_thickness_m: float

    def __post_init__(self) -> None:
        object.__setattr__(self, "policy", _enum(self.policy, ThinFeaturePolicy, "policy"))
        object.__setattr__(
            self,
            "declared_minimum_thickness_m",
            _finite(self.declared_minimum_thickness_m, "declared_minimum_thickness_m"),
        )
        if self.declared_minimum_thickness_m <= 0.0:
            raise ValueError("declared_minimum_thickness_m must be greater than zero")

    def to_contract_dict(self) -> dict[str, Any]:
        return _omit_none(
            {
                "policy": _enum_value(self.policy),
                "declaredMinimumThicknessMeters": self.declared_minimum_thickness_m,
            }
        )


@dataclass(frozen=True, slots=True)
class ShellLayer:
    structural_material_id: str
    thickness_m: float

    def __post_init__(self) -> None:
        validate_id(self.structural_material_id, "structural_material_id")
        object.__setattr__(self, "thickness_m", _finite(self.thickness_m, "thickness_m"))
        if self.thickness_m <= 0.0:
            raise ValueError("thickness_m must be greater than zero")

    def to_contract_dict(self) -> dict[str, Any]:
        return _omit_none(
            {
                "structuralMaterialId": self.structural_material_id,
                "thicknessMeters": self.thickness_m,
            }
        )


@dataclass(frozen=True, slots=True)
class Shell:
    thickness_m: float
    layers: tuple[ShellLayer, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "thickness_m", _finite(self.thickness_m, "thickness_m"))
        if self.thickness_m <= 0.0:
            raise ValueError("thickness_m must be greater than zero")
        object.__setattr__(self, "layers", tuple(sorted(self.layers, key=lambda item: item.structural_material_id)))
        if not self.layers:
            raise ValueError("layers must not be empty")

    def to_contract_dict(self) -> dict[str, Any]:
        return {
            "thicknessMeters": self.thickness_m,
            "layers": [layer.to_contract_dict() for layer in self.layers],
        }


@dataclass(frozen=True, slots=True)
class CanonicalPart:
    part_id: str
    representation_mode: RepresentationMode
    destructible: bool
    collision_policy: CollisionPolicy
    navigation_policy: NavigationPolicy
    thin_feature: ThinFeature
    parent_part_id: str | None = None
    default_render_material_id: str | None = None
    structural_material_id: str | None = None
    shell: Shell | None = None
    tags: tuple[str, ...] = ()
    transform: Transform = field(default_factory=Transform)

    def __post_init__(self) -> None:
        validate_id(self.part_id, "part_id")
        object.__setattr__(self, "parent_part_id", _id_or_none(self.parent_part_id, "parent_part_id"))
        for name, enum_type in (
            ("representation_mode", RepresentationMode),
            ("collision_policy", CollisionPolicy),
            ("navigation_policy", NavigationPolicy),
        ):
            object.__setattr__(self, name, _enum(getattr(self, name), enum_type, name))
        if type(self.thin_feature) is not ThinFeature:
            raise TypeError("thin_feature must be an explicit ThinFeature model")
        for name in ("default_render_material_id", "structural_material_id"):
            object.__setattr__(self, name, _id_or_none(getattr(self, name), name))
        if isinstance(self.destructible, bool) is False:
            raise ValueError("destructible must be a boolean")
        object.__setattr__(self, "tags", _tags(self.tags))

    def to_contract_dict(self) -> dict[str, Any]:
        return _omit_none(
            {
                "partId": self.part_id,
                "parentPartId": self.parent_part_id,
                "representation": _enum_value(self.representation_mode),
                "defaultRenderMaterialId": self.default_render_material_id,
                "structuralMaterialId": self.structural_material_id,
                "destructible": self.destructible,
                "collisionPolicy": _enum_value(self.collision_policy),
                "navigationPolicy": _enum_value(self.navigation_policy),
                "thinFeature": self.thin_feature.to_contract_dict(),
                "shell": None if self.shell is None else self.shell.to_contract_dict(),
                "tags": self.tags,
            }
        )


@dataclass(frozen=True, slots=True)
class CanonicalJoint:
    joint_id: str
    parent_part_id: str
    child_part_id: str
    joint_type: JointType
    break_policy: BreakPolicy
    break_force_n: float | None = None
    break_torque_nm: float | None = None
    tags: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        validate_id(self.joint_id, "joint_id")
        validate_id(self.parent_part_id, "parent_part_id")
        validate_id(self.child_part_id, "child_part_id")
        object.__setattr__(self, "joint_type", _enum(self.joint_type, JointType, "joint_type"))
        object.__setattr__(self, "break_policy", _enum(self.break_policy, BreakPolicy, "break_policy"))
        object.__setattr__(self, "break_force_n", _optional_positive_number(self.break_force_n, "break_force_n"))
        object.__setattr__(self, "break_torque_nm", _optional_positive_number(self.break_torque_nm, "break_torque_nm"))
        object.__setattr__(self, "tags", _tags(self.tags))

    def to_contract_dict(self) -> dict[str, Any]:
        return _omit_none(
            {
                "jointId": self.joint_id,
                "parentPartId": self.parent_part_id,
                "childPartId": self.child_part_id,
                "jointType": _enum_value(self.joint_type),
                "breakPolicy": _enum_value(self.break_policy),
                "breakForceNewtons": self.break_force_n,
                "breakTorqueNewtonMeters": self.break_torque_nm,
                "tags": self.tags,
            }
        )


@dataclass(frozen=True, slots=True)
class CanonicalMarker:
    marker_id: str
    marker_type: MarkerType
    part_id: str | None = None
    interface_id: str | None = None
    tags: tuple[str, ...] = ()
    transform: Transform = field(default_factory=Transform)

    def __post_init__(self) -> None:
        validate_id(self.marker_id, "marker_id")
        object.__setattr__(self, "marker_type", _enum(self.marker_type, MarkerType, "marker_type"))
        object.__setattr__(self, "part_id", _id_or_none(self.part_id, "part_id"))
        object.__setattr__(self, "interface_id", _id_or_none(self.interface_id, "interface_id"))
        object.__setattr__(self, "tags", _tags(self.tags))

    def to_contract_dict(self) -> dict[str, Any]:
        return _omit_none(
            {
                "markerId": self.marker_id,
                "markerType": _enum_value(self.marker_type),
                "partId": self.part_id,
                "interfaceId": self.interface_id,
                "tags": self.tags,
            }
        )


@dataclass(frozen=True, slots=True)
class CanonicalMaterial:
    render_material_id: str
    structural_material_id: str | None = None
    palette_index: int | None = None
    tags: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        validate_id(self.render_material_id, "render_material_id")
        object.__setattr__(self, "structural_material_id", _id_or_none(self.structural_material_id, "structural_material_id"))
        if self.palette_index is not None:
            _non_negative_int(self.palette_index, "palette_index")
            if self.palette_index > 65535:
                raise ValueError("palette_index must be at most 65535")
        object.__setattr__(self, "tags", _tags(self.tags))

    def to_contract_dict(self) -> dict[str, Any]:
        return _omit_none({
            "renderMaterialId": self.render_material_id,
            "structuralMaterialId": self.structural_material_id,
            "paletteIndex": self.palette_index,
            "tags": self.tags,
        })


@dataclass(frozen=True, slots=True)
class CanonicalAsset:
    """The complete canonical asset-authoring document."""

    asset_id: str
    asset_revision: int
    representation_mode: RepresentationMode
    parts: tuple[CanonicalPart, ...] = ()
    joints: tuple[CanonicalJoint, ...] = ()
    markers: tuple[CanonicalMarker, ...] = ()
    materials: tuple[CanonicalMaterial, ...] = ()
    coordinate_frame: CoordinateFrame = field(default_factory=CoordinateFrame)
    meters_per_unit: int = METERS_PER_UNIT
    default_structural_material_id: str | None = None
    tags: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        validate_id(self.asset_id, "asset_id")
        if isinstance(self.asset_revision, bool) or not isinstance(self.asset_revision, int) or not 0 <= self.asset_revision <= 2147483647:
            raise ValueError("asset_revision must be a non-negative 32-bit integer")
        object.__setattr__(self, "representation_mode", _enum(self.representation_mode, RepresentationMode, "representation_mode"))
        if self.meters_per_unit != METERS_PER_UNIT:
            raise ValueError("meters_per_unit must be 1")
        object.__setattr__(self, "default_structural_material_id", _id_or_none(self.default_structural_material_id, "default_structural_material_id"))
        object.__setattr__(self, "tags", _tags(self.tags))
        object.__setattr__(self, "parts", tuple(sorted(self.parts, key=lambda item: item.part_id)))
        object.__setattr__(self, "joints", tuple(sorted(self.joints, key=lambda item: item.joint_id)))
        object.__setattr__(self, "markers", tuple(sorted(self.markers, key=lambda item: item.marker_id)))
        object.__setattr__(self, "materials", tuple(sorted(self.materials, key=lambda item: item.render_material_id)))

    @property
    def asset(self) -> Mapping[str, Any]:
        """The asset identity projection used by the document serializer."""

        return MappingProxyType({"assetId": self.asset_id, "assetRevision": self.asset_revision})

    def to_contract_dict(self) -> dict[str, Any]:
        return {
            "schema": SCHEMA_ID,
            "asset": _omit_none({
                "assetId": self.asset_id,
                "assetRevision": self.asset_revision,
                "representation": _enum_value(self.representation_mode),
                "metersPerUnit": self.meters_per_unit,
                "coordinateFrame": self.coordinate_frame.to_contract_dict(),
                "defaultStructuralMaterialId": self.default_structural_material_id,
                "tags": self.tags,
            }),
            "parts": [part.to_contract_dict() for part in self.parts],
            "joints": [joint.to_contract_dict() for joint in self.joints],
            "markers": [marker.to_contract_dict() for marker in self.markers],
            "materials": [material.to_contract_dict() for material in self.materials],
        }


def sort_by_stable_id(items: tuple[Any, ...] | list[Any]) -> tuple[Any, ...]:
    """Return a deterministic tuple sorted by the conventional ``*_id`` field."""

    def stable_id(item: Any) -> str:
        for name in ("asset_id", "part_id", "joint_id", "marker_id", "render_material_id", "material_id", "mesh_id", "primitive_id"):
            value = getattr(item, name, None)
            if value is not None:
                return value
        raise ValueError("item has no stable ID")

    return tuple(sorted(items, key=stable_id))


sort_by_id = sort_by_stable_id


# Deterministic geometry inventory structures retained for adapter/report use.
@dataclass(frozen=True, slots=True)
class MeshTopology:
    vertex_count: int = 0
    edge_count: int = 0
    polygon_count: int = 0
    triangle_count: int = 0
    boundary_edge_count: int = 0
    non_manifold_edge_count: int = 0
    degenerate_polygon_count: int = 0

    def __post_init__(self) -> None:
        for name in (
            "vertex_count", "edge_count", "polygon_count", "triangle_count",
            "boundary_edge_count", "non_manifold_edge_count", "degenerate_polygon_count",
        ):
            _non_negative_int(getattr(self, name), name)


@dataclass(frozen=True, slots=True)
class MeshInventory:
    mesh_id: str
    topology: MeshTopology = field(default_factory=MeshTopology)
    bounds_min: Vector3 | None = None
    bounds_max: Vector3 | None = None
    material_ids: tuple[str, ...] = ()
    primitive_ids: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        validate_id(self.mesh_id, "mesh_id")
        if self.bounds_min is not None:
            object.__setattr__(self, "bounds_min", _vector3(tuple(self.bounds_min), "bounds_min"))
        if self.bounds_max is not None:
            object.__setattr__(self, "bounds_max", _vector3(tuple(self.bounds_max), "bounds_max"))
        object.__setattr__(self, "material_ids", tuple(sorted(self.material_ids)))
        object.__setattr__(self, "primitive_ids", tuple(sorted(self.primitive_ids)))


@dataclass(frozen=True, slots=True)
class PrimitiveInventory:
    primitive_id: str
    mesh_id: str
    material_id: str | None = None
    topology: MeshTopology = field(default_factory=MeshTopology)

    def __post_init__(self) -> None:
        validate_id(self.primitive_id, "primitive_id")
        validate_id(self.mesh_id, "mesh_id")
        object.__setattr__(self, "material_id", _id_or_none(self.material_id, "material_id"))


@dataclass(frozen=True, slots=True)
class MaterialInventory:
    material_id: str

    def __post_init__(self) -> None:
        validate_id(self.material_id, "material_id")


@dataclass(frozen=True, slots=True)
class AuthoredMarker:
    marker_id: str
    marker_type: str = ""
    node_id: str | None = None
    properties: Mapping[str, PropertyValue] = field(default_factory=dict)

    def __post_init__(self) -> None:
        validate_id(self.marker_id, "marker_id")
        object.__setattr__(self, "properties", _mapping(self.properties))


@dataclass(frozen=True, slots=True)
class AuthoredJoint:
    joint_id: str
    node_id: str | None = None
    properties: Mapping[str, PropertyValue] = field(default_factory=dict)

    def __post_init__(self) -> None:
        validate_id(self.joint_id, "joint_id")
        object.__setattr__(self, "properties", _mapping(self.properties))


@dataclass(frozen=True, slots=True)
class AuthoredNode:
    node_id: str
    part_id: str
    name: str
    parent_node_id: str | None = None
    transform: Transform = field(default_factory=Transform)
    mesh: MeshInventory | None = None
    properties: Mapping[str, PropertyValue] = field(default_factory=dict)
    child_node_ids: tuple[str, ...] = ()
    marker_ids: tuple[str, ...] = ()
    joint_ids: tuple[str, ...] = ()
    critical_thin_feature: bool = False

    def __post_init__(self) -> None:
        validate_id(self.node_id, "node_id")
        validate_id(self.part_id, "part_id")
        if not isinstance(self.name, str) or not self.name:
            raise ValueError("name must be a non-empty string")
        object.__setattr__(self, "properties", _mapping(self.properties))
        object.__setattr__(self, "child_node_ids", tuple(sorted(self.child_node_ids)))
        object.__setattr__(self, "marker_ids", tuple(sorted(self.marker_ids)))
        object.__setattr__(self, "joint_ids", tuple(sorted(self.joint_ids)))

    def property_name_errors(self) -> tuple[str, ...]:
        return validate_property_names(self.properties)


@dataclass(frozen=True, slots=True)
class AuthoredAsset:
    """Legacy adapter graph; it intentionally has no canonical JSON serializer."""

    asset_id: str
    nodes: tuple[AuthoredNode, ...] = ()
    root_node_id: str | None = None
    properties: Mapping[str, PropertyValue] = field(default_factory=dict)
    meshes: tuple[MeshInventory, ...] = ()
    primitives: tuple[PrimitiveInventory, ...] = ()
    materials: tuple[MaterialInventory, ...] = ()
    markers: tuple[AuthoredMarker, ...] = ()
    joints: tuple[AuthoredJoint, ...] = ()
    units: str = "m"

    def __post_init__(self) -> None:
        validate_id(self.asset_id, "asset_id")
        object.__setattr__(self, "nodes", tuple(sorted(self.nodes, key=lambda item: item.node_id)))
        object.__setattr__(self, "properties", _mapping(self.properties))
        object.__setattr__(self, "meshes", tuple(sorted(self.meshes, key=lambda item: item.mesh_id)))
        object.__setattr__(self, "primitives", tuple(sorted(self.primitives, key=lambda item: item.primitive_id)))
        object.__setattr__(self, "materials", tuple(sorted(self.materials, key=lambda item: item.material_id)))
        object.__setattr__(self, "markers", tuple(sorted(self.markers, key=lambda item: item.marker_id)))
        object.__setattr__(self, "joints", tuple(sorted(self.joints, key=lambda item: item.joint_id)))

    def property_name_errors(self) -> tuple[str, ...]:
        return validate_property_names(self.properties)


@dataclass(frozen=True, slots=True)
class GeometryInventory:
    """Deterministic evaluated geometry retained beside canonical semantics."""

    meshes: tuple[MeshInventory, ...]
    primitives: tuple[PrimitiveInventory, ...]
    materials: tuple[MaterialInventory, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "meshes", tuple(sorted(self.meshes, key=lambda item: item.mesh_id)))
        object.__setattr__(self, "primitives", tuple(sorted(self.primitives, key=lambda item: item.primitive_id)))
        object.__setattr__(self, "materials", tuple(sorted(self.materials, key=lambda item: item.material_id)))


@dataclass(frozen=True, slots=True)
class AuthoringInput:
    """The single input shared by extraction, validation, and reporting."""

    asset: CanonicalAsset
    inventory: GeometryInventory

    def __post_init__(self) -> None:
        if type(self.asset) is not CanonicalAsset:
            raise TypeError("asset must be an explicit CanonicalAsset model")
        if type(self.inventory) is not GeometryInventory:
            raise TypeError("inventory must be an explicit GeometryInventory model")


@dataclass(frozen=True, slots=True)
class ExtractedAsset(AuthoringInput):
    """Adapter result; it is also the AuthoringInput consumed downstream."""


@dataclass(frozen=True, slots=True)
class ValidationOptions:
    unapplied_scale_policy: UnappliedScalePolicy = UnappliedScalePolicy.WARNING
    unapplied_scale_tolerance: float = 1.0e-6
    require_schema_id: str = SCHEMA_ID

    def __post_init__(self) -> None:
        object.__setattr__(self, "unapplied_scale_policy", _enum(self.unapplied_scale_policy, UnappliedScalePolicy, "unapplied_scale_policy"))
        tolerance = _finite(self.unapplied_scale_tolerance, "unapplied_scale_tolerance")
        if tolerance < 0.0:
            raise ValueError("unapplied_scale_tolerance must not be negative")
        object.__setattr__(self, "unapplied_scale_tolerance", tolerance)
        if not isinstance(self.require_schema_id, str) or not self.require_schema_id:
            raise ValueError("require_schema_id must be a non-empty string")


@dataclass(frozen=True, slots=True)
class Diagnostic:
    severity: DiagnosticSeverity
    code: str
    message: str
    path: str = ""

    def __post_init__(self) -> None:
        object.__setattr__(self, "severity", _enum(self.severity, DiagnosticSeverity, "severity"))
        validate_id(self.code, "diagnostic code")
        if not isinstance(self.message, str) or not self.message:
            raise ValueError("message must be a non-empty string")
        if not isinstance(self.path, str):
            raise ValueError("path must be a string")

    @property
    def sort_key(self) -> tuple[str, str, str, str]:
        return (self.severity.value, self.code, self.path, self.message)


@dataclass(frozen=True, slots=True)
class ValidationReportInputs:
    asset: CanonicalAsset | AuthoredAsset
    options: ValidationOptions = field(default_factory=ValidationOptions)
    diagnostics: tuple[Diagnostic, ...] = ()
    source_label: str = ""

    def __post_init__(self) -> None:
        if not isinstance(self.source_label, str):
            raise ValueError("source_label must be a string")
        object.__setattr__(self, "diagnostics", tuple(sorted(self.diagnostics, key=lambda item: item.sort_key)))


__all__ = [
    "AuthoredAsset", "AuthoredJoint", "AuthoredMarker", "AuthoredNode",
    "AuthoringInput", "ExtractedAsset", "GeometryInventory",
    "BreakPolicy", "CanonicalAsset", "CanonicalJoint", "CanonicalMarker",
    "CanonicalMaterial", "CanonicalPart", "CollisionPolicy", "CoordinateFrame",
    "Diagnostic", "DiagnosticSeverity", "JointType", "MarkerType", "MaterialInventory",
    "MeshInventory", "MeshTopology", "NavigationPolicy", "PrimitiveInventory",
    "PropertyValue", "Quaternion", "RepresentationMode", "Shell", "ShellLayer",
    "ThinFeature", "ThinFeaturePolicy", "Transform", "UnappliedScalePolicy",
    "ValidationOptions", "ValidationReportInputs", "Vector3", "sort_by_id",
    "sort_by_stable_id",
]
