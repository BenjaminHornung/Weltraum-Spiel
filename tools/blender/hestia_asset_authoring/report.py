"""Deterministic handoff report construction for authored Hestia assets."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from .canonical import canonical_json_bytes, canonicalize, sha256_bytes
from .model import (
    AuthoringInput,
    Diagnostic,
    ExtractedAsset,
    GeometryInventory,
    MeshInventory,
    PrimitiveInventory,
    ValidationOptions,
)
from .schema import SCHEMA_ID


def _diagnostic_sort_key(item: Diagnostic) -> tuple[str, str, str, str]:
    return item.sort_key


def _inventory_payload(inventory: GeometryInventory) -> dict[str, Any]:
    """Return inventory collections in identity order, independent of input order."""

    def mesh_payload(item: MeshInventory) -> dict[str, Any]:
        return {
            "meshId": item.mesh_id,
            "topology": {
                "vertexCount": item.topology.vertex_count,
                "edgeCount": item.topology.edge_count,
                "polygonCount": item.topology.polygon_count,
                "triangleCount": item.topology.triangle_count,
                "boundaryEdgeCount": item.topology.boundary_edge_count,
                "nonManifoldEdgeCount": item.topology.non_manifold_edge_count,
                "degeneratePolygonCount": item.topology.degenerate_polygon_count,
            },
            "boundsMin": item.bounds_min,
            "boundsMax": item.bounds_max,
            "materialIds": tuple(sorted(item.material_ids)),
            "primitiveIds": tuple(sorted(item.primitive_ids)),
        }

    def primitive_payload(item: PrimitiveInventory) -> dict[str, Any]:
        return {
            "primitiveId": item.primitive_id,
            "meshId": item.mesh_id,
            "materialId": item.material_id,
            "topology": {
                "vertexCount": item.topology.vertex_count,
                "edgeCount": item.topology.edge_count,
                "polygonCount": item.topology.polygon_count,
                "triangleCount": item.topology.triangle_count,
                "boundaryEdgeCount": item.topology.boundary_edge_count,
                "nonManifoldEdgeCount": item.topology.non_manifold_edge_count,
                "degeneratePolygonCount": item.topology.degenerate_polygon_count,
            },
        }

    return {
        "materials": tuple(
            {"materialId": item.material_id}
            for item in sorted(inventory.materials, key=lambda item: item.material_id)
        ),
        "meshes": tuple(
            mesh_payload(item)
            for item in sorted(inventory.meshes, key=lambda item: item.mesh_id)
        ),
        "primitives": tuple(
            primitive_payload(item)
            for item in sorted(inventory.primitives, key=lambda item: item.primitive_id)
        ),
    }


def _inputs_parts(
    inputs: AuthoringInput | ExtractedAsset,
    diagnostics: Sequence[Diagnostic] | None,
) -> tuple[AuthoringInput, tuple[Diagnostic, ...]]:
    if type(inputs) not in (AuthoringInput, ExtractedAsset):
        raise TypeError("report inputs must be an explicit AuthoringInput or ExtractedAsset model")
    selected_diagnostics = () if diagnostics is None else tuple(diagnostics)
    return inputs, tuple(sorted(selected_diagnostics, key=_diagnostic_sort_key))


def build_report(
    inputs: AuthoringInput | ExtractedAsset,
    diagnostics: Sequence[Diagnostic] | None = None,
    glb_sha256: str | None = None,
    *,
    options: ValidationOptions | None = None,
    output_basename: str,
) -> dict[str, Any]:
    """Build a deterministic, non-self-referential handoff report.

    ``digests.report_sha256`` is the lowercase SHA-256 hex digest of the
    canonical UTF-8 JSON bytes of ``payload`` only.  Neither member of
    ``digests`` is part of that preimage.  The supplied GLB digest is not
    recomputed here, so this function remains Blender- and filesystem-
    independent.
    """

    authoring_input, selected_diagnostics = _inputs_parts(inputs, diagnostics)
    selected_options = ValidationOptions() if options is None else options
    if type(selected_options) is not ValidationOptions:
        raise TypeError("report options must be an explicit ValidationOptions model")
    if not isinstance(output_basename, str):
        raise TypeError("output_basename must be a string")
    basename = output_basename.replace("\\", "/").rsplit("/", 1)[-1]
    if not basename:
        raise ValueError("output_basename must identify a file")
    payload: dict[str, Any] = {
        "semantics": authoring_input.asset.to_contract_dict(),
        "diagnostics": tuple(
            {
                "severity": item.severity.value,
                "code": item.code,
                "message": item.message,
                "path": item.path,
            }
            for item in selected_diagnostics
        ),
        "glbSha256": glb_sha256,
        "inventory": _inventory_payload(authoring_input.inventory),
        "options": {
            "requireSchemaId": selected_options.require_schema_id,
            "unappliedScalePolicy": selected_options.unapplied_scale_policy.value,
            "unappliedScaleTolerance": selected_options.unapplied_scale_tolerance,
        },
        "outputBasename": basename,
        "schemaId": SCHEMA_ID,
    }
    report_sha256 = sha256_bytes(canonical_json_bytes(payload))
    return canonicalize(
        {
            "payload": payload,
            "digests": {
                "glb_sha256": glb_sha256,
                "report_sha256": report_sha256,
            },
        }
    )


__all__ = ["build_report"]
