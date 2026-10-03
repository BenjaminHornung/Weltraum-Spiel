"""Synthetic current-format sidecars; expected raster sets stay in the tests."""

import copy

from tools.blender.hestia_asset_authoring.canonical import canonical_json_bytes, sha256_bytes
from tools.hestia_asset_compiler.glb import read_glb
from glb_fixtures import box, fixture, glb


def rehash(report):
    report["digests"]["report_sha256"] = sha256_bytes(canonical_json_bytes(report["payload"]))
    return canonical_json_bytes(report)


def pair(document=None, binary=None):
    if document is None:
        document, binary = fixture(*box())
    raw = glb(document, binary)
    source = read_glb(raw)
    counts = {k: 0 for k in ("vertexCount", "edgeCount", "polygonCount", "triangleCount",
                             "boundaryEdgeCount", "nonManifoldEdgeCount", "degeneratePolygonCount")}
    # Deliberately NOT GLB counts: an evaluated Blender inventory is not world geometry.
    inventory = {"materials": [{"materialId": m["renderMaterialId"]} for m in source.semantics["materials"]],
                 "meshes": [{"meshId": "inventory.mesh", "topology": counts, "boundsMin": None,
                             "boundsMax": None, "materialIds": [], "primitiveIds": []}], "primitives": []}
    payload = {"schemaId": "hestia.asset-authoring.v1", "semantics": copy.deepcopy(source.semantics),
               "glbSha256": sha256_bytes(raw), "inventory": inventory, "diagnostics": [],
               "options": {"requireSchemaId": "hestia.asset-authoring.v1", "unappliedScalePolicy": "warning",
                           "unappliedScaleTolerance": 0}, "outputBasename": "fixture.glb"}
    report = {"payload": payload, "digests": {"glb_sha256": sha256_bytes(raw), "report_sha256": ""}}
    return raw, rehash(report), report
