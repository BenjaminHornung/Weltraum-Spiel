"""Stable Hestia asset-authoring vocabulary.

This module is deliberately Blender-free.  The names in
``BLENDER_INPUT_PROPERTY_NAMES`` are the only names an authoring adapter may
read from Blender custom properties.  They are not the names of the canonical
JSON document.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping


SCHEMA_ID = "hestia.asset-authoring.v1"
METERS_PER_UNIT = 1
UP_AXIS = "+Y"
FORWARD_AXIS = "+Z"
HANDEDNESS = "RIGHT"

# Explicitly prefixed Blender input names.  Canonical camelCase names must not
# be accepted here, even when they happen to describe the same value.
ASSET_ID_PROPERTY = "hestia.asset_id"
ASSET_REVISION_PROPERTY = "hestia.asset_revision"
PART_ID_PROPERTY = "hestia.part_id"
PARENT_PART_ID_PROPERTY = "hestia.parent_part_id"
REPRESENTATION_MODE_PROPERTY = "hestia.representation_mode"
RENDER_MATERIAL_ID_PROPERTY = "hestia.render_material_id"
STRUCTURAL_MATERIAL_ID_PROPERTY = "hestia.structural_material_id"
DESTRUCTIBLE_PROPERTY = "hestia.destructible"
COLLISION_POLICY_PROPERTY = "hestia.collision_policy"
NAVIGATION_POLICY_PROPERTY = "hestia.navigation_policy"
THIN_FEATURE_POLICY_PROPERTY = "hestia.thin_feature_policy"
DECLARED_MINIMUM_THICKNESS_M_PROPERTY = "hestia.declared_minimum_thickness_m"
SHELL_THICKNESS_M_PROPERTY = "hestia.shell_thickness_m"
JOINT_ID_PROPERTY = "hestia.joint_id"
CHILD_PART_ID_PROPERTY = "hestia.child_part_id"
JOINT_TYPE_PROPERTY = "hestia.joint_type"
BREAK_POLICY_PROPERTY = "hestia.break_policy"
BREAK_FORCE_N_PROPERTY = "hestia.break_force_n"
BREAK_TORQUE_NM_PROPERTY = "hestia.break_torque_nm"
MARKER_ID_PROPERTY = "hestia.marker_id"
MARKER_TYPE_PROPERTY = "hestia.marker_type"
CUT_INTERFACE_ID_PROPERTY = "hestia.cut_interface_id"
PALETTE_INDEX_PROPERTY = "hestia.palette_index"

BLENDER_INPUT_PROPERTY_NAMES = frozenset(
    {
        ASSET_ID_PROPERTY,
        ASSET_REVISION_PROPERTY,
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
        JOINT_ID_PROPERTY,
        CHILD_PART_ID_PROPERTY,
        JOINT_TYPE_PROPERTY,
        BREAK_POLICY_PROPERTY,
        BREAK_FORCE_N_PROPERTY,
        BREAK_TORQUE_NM_PROPERTY,
        MARKER_ID_PROPERTY,
        MARKER_TYPE_PROPERTY,
        CUT_INTERFACE_ID_PROPERTY,
        PALETTE_INDEX_PROPERTY,
    }
)
KNOWN_PROPERTY_NAMES = BLENDER_INPUT_PROPERTY_NAMES
REQUIRED_PROPERTY_NAMES = frozenset()
CONDITIONAL_PROPERTY_NAMES = frozenset()
MINIMUM_PROPERTY_NAMES = frozenset()

REPRESENTATION_MODES = (
    "Solid",
    "Shell",
    "LayeredShell",
    "StructuralAssembly",
    "ModularPart",
    "Decorative",
    "Hybrid",
)
THIN_FEATURE_POLICIES = (
    "Reject",
    "PreserveAsBeam",
    "PreserveAsRod",
    "PreserveAsShell",
    "DecorativeOnly",
)
COLLISION_POLICIES = ("None", "AuthoredMesh", "Compound", "Voxel")
NAVIGATION_POLICIES = ("None", "Obstacle", "Walkable", "Portal")
JOINT_TYPES = ("Fixed", "Hinge", "Slider", "Breakable")
BREAK_POLICIES = ("Never", "Threshold", "Scripted")
MARKER_TYPES = (
    "Snap",
    "Docking",
    "Cargo",
    "Interaction",
    "Story",
    "Spawn",
    "CutInterface",
    "ToolMount",
    "Seat",
)

ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._:-]{0,127}$", re.ASCII)
STABLE_ASCII_ID_PATTERN = ID_PATTERN


def is_valid_id(value: object) -> bool:
    """Return whether *value* exactly matches the canonical ID contract."""

    return isinstance(value, str) and ID_PATTERN.fullmatch(value) is not None


def validate_id(value: object, field_name: str = "id") -> str:
    """Validate and return an ID without normalizing it."""

    if not is_valid_id(value):
        raise ValueError(f"{field_name} must match {ID_PATTERN.pattern!r}")
    assert isinstance(value, str)
    return value


def validate_property_names(
    properties: Mapping[str, object] | Iterable[str],
    *,
    required: Iterable[str] = REQUIRED_PROPERTY_NAMES,
    known: Iterable[str] = KNOWN_PROPERTY_NAMES,
) -> tuple[str, ...]:
    """Return deterministic, fail-closed errors for Blender properties."""

    names = set(properties.keys()) if isinstance(properties, Mapping) else set(properties)
    known_names = set(known)
    required_names = set(required)
    errors = [f"unknown property: {name}" for name in sorted(names - known_names)]
    errors.extend(f"missing required property: {name}" for name in sorted(required_names - names))
    return tuple(errors)


__all__ = [
    "ASSET_ID_PROPERTY",
    "ASSET_REVISION_PROPERTY",
    "BLENDER_INPUT_PROPERTY_NAMES",
    "BREAK_FORCE_N_PROPERTY",
    "BREAK_POLICY_PROPERTY",
    "BREAK_POLICIES",
    "BREAK_TORQUE_NM_PROPERTY",
    "CHILD_PART_ID_PROPERTY",
    "COLLISION_POLICIES",
    "COLLISION_POLICY_PROPERTY",
    "CONDITIONAL_PROPERTY_NAMES",
    "CUT_INTERFACE_ID_PROPERTY",
    "DECLARED_MINIMUM_THICKNESS_M_PROPERTY",
    "DESTRUCTIBLE_PROPERTY",
    "FORWARD_AXIS",
    "HANDEDNESS",
    "ID_PATTERN",
    "JOINT_ID_PROPERTY",
    "JOINT_TYPE_PROPERTY",
    "JOINT_TYPES",
    "KNOWN_PROPERTY_NAMES",
    "MARKER_ID_PROPERTY",
    "MARKER_TYPE_PROPERTY",
    "MARKER_TYPES",
    "METERS_PER_UNIT",
    "MINIMUM_PROPERTY_NAMES",
    "NAVIGATION_POLICIES",
    "NAVIGATION_POLICY_PROPERTY",
    "PALETTE_INDEX_PROPERTY",
    "PARENT_PART_ID_PROPERTY",
    "PART_ID_PROPERTY",
    "REPRESENTATION_MODE_PROPERTY",
    "REPRESENTATION_MODES",
    "RENDER_MATERIAL_ID_PROPERTY",
    "REQUIRED_PROPERTY_NAMES",
    "SCHEMA_ID",
    "SHELL_THICKNESS_M_PROPERTY",
    "STABLE_ASCII_ID_PATTERN",
    "STRUCTURAL_MATERIAL_ID_PROPERTY",
    "THIN_FEATURE_POLICIES",
    "THIN_FEATURE_POLICY_PROPERTY",
    "UP_AXIS",
    "is_valid_id",
    "validate_id",
    "validate_property_names",
]
