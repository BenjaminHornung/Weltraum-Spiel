"""Exact current-authoring report/transport admission before world expansion."""

from dataclasses import dataclass
import re

from tools.blender.hestia_asset_authoring.canonical import canonical_json_bytes, canonicalize, sha256_bytes
from tools.blender.hestia_asset_authoring.schema import SCHEMA_ID, is_valid_id
from .errors import CompilerError
from .glb import fail, finite_vector, integer, nonnegative, read_glb, references, semantic, sequence, shape, strict_json
from .profiles import check_budget

TOPOLOGY_FIELDS = ("vertexCount", "edgeCount", "polygonCount", "triangleCount", "boundaryEdgeCount",
                   "nonManifoldEdgeCount", "degeneratePolygonCount")


def digest(value):
    if type(value) is not str or re.fullmatch("[0-9a-f]{64}", value) is None:
        fail("report.digest", "lowercase SHA-256 required; null/error reports are not compile inputs")
    return value


def identities(items, key):
    result = {}
    for item in items:
        value = item[key]
        if not is_valid_id(value) or value in result:
            fail("report.inventory", "unique stable inventory IDs required")
        result[value] = item
    return result


def report_semantics(value):
    fields = ("schema", "asset", "parts", "joints", "markers", "materials")
    shape(value, fields, fields, "report.semantics")
    if value["schema"] != SCHEMA_ID:
        fail("report.schema", "current authoring schema required")
    if not isinstance(value["asset"], dict) or "schema" in value["asset"]:
        fail("report.semantics", "schema belongs on the canonical root, not its asset")
    result = {"schema": SCHEMA_ID, "asset": semantic({**value["asset"], "schema": SCHEMA_ID}, "asset")}
    for collection, kind, budget in (("parts", "part", "nodes"), ("joints", "joint", "nodes"),
                                     ("markers", "marker", "nodes"), ("materials", "material", "materials")):
        items = sequence(value[collection], "report.semantics")
        check_budget(budget, len(items))
        if any(not isinstance(item, dict) or "kind" in item or "schema" in item for item in items):
            fail("report.semantics", "canonical records are not transport aliases")
        result[collection] = [semantic(item, kind) for item in items]
    check_budget("nodes", sum(len(result[k]) for k in ("parts", "joints", "markers")))
    references(result)
    return canonicalize(result)


def validate_inventory(value, semantics):
    shape(value, ["materials", "meshes", "primitives"], ["materials", "meshes", "primitives"], "report.inventory")
    for collection, budget in (("materials", "materials"), ("meshes", "meshes"), ("primitives", "primitives")):
        check_budget(budget, len(sequence(value[collection], "report.inventory")))
    for item in value["materials"]:
        shape(item, ["materialId"], ["materialId"], "report.inventory")
    for item in value["meshes"]:
        fields = ["meshId", "topology", "boundsMin", "boundsMax", "materialIds", "primitiveIds"]
        shape(item, fields, fields, "report.inventory")
        for name in ("materialIds", "primitiveIds"):
            refs = sequence(item[name], "report.inventory")
            check_budget("materials" if name == "materialIds" else "primitives", len(refs))
            if any(not is_valid_id(ref) for ref in refs) or len(set(refs)) != len(refs):
                fail("report.inventory", "unique inventory references required")
        lo, hi = item["boundsMin"], item["boundsMax"]
        if lo is not None or hi is not None:
            finite_vector(lo, 3, "report.inventory")
            finite_vector(hi, 3, "report.inventory")
            if any(a > b for a, b in zip(lo, hi)):
                fail("report.inventory", "ordered local inventory bounds required")
    for item in value["primitives"]:
        fields = ["primitiveId", "meshId", "materialId", "topology"]
        shape(item, fields, fields, "report.inventory")
    maps = {key: identities(value[key], identity) for key, identity in
            (("materials", "materialId"), ("meshes", "meshId"), ("primitives", "primitiveId"))}
    declared = {m["renderMaterialId"] for m in semantics["materials"]}
    if set(maps["materials"]) - declared:
        fail("report.inventory", "inventory materials must reference declared render identities")
    for item in value["meshes"] + value["primitives"]:
        shape(item["topology"], TOPOLOGY_FIELDS, TOPOLOGY_FIELDS, "report.inventory")
        for count in item["topology"].values():
            integer(count, code="report.inventory")
    for item in value["meshes"]:
        if set(item["materialIds"]) - set(maps["materials"]) or set(item["primitiveIds"]) - set(maps["primitives"]):
            fail("report.inventory", "unresolved mesh inventory reference")
    for item in value["primitives"]:
        if item["meshId"] not in maps["meshes"] or (item["materialId"] is not None and item["materialId"] not in maps["materials"]):
            fail("report.inventory", "unresolved primitive inventory reference")
    # No comparison of evaluated local topology counts/bounds with decoded world geometry.


def validate_options(options):
    fields = ["requireSchemaId", "unappliedScalePolicy", "unappliedScaleTolerance"]
    shape(options, fields, fields, "report.options")
    if options["requireSchemaId"] != SCHEMA_ID or options["unappliedScalePolicy"] not in ("ignore", "warning", "error"):
        fail("report.options", "current schema and actual scale-policy enum required")
    nonnegative(options["unappliedScaleTolerance"], "report.options")


@dataclass(frozen=True)
class Admission:
    source: object
    report: dict
    sources: dict


def admit_pair(glb_bytes, report_bytes):
    if report_bytes is None:
        fail("report.required", "an exact authoring sidecar is required")
    if type(glb_bytes) is not bytes or type(report_bytes) is not bytes:
        fail("input.bytes", "exact delivered bytes required")
    check_budget("glb_bytes", len(glb_bytes))
    check_budget("report_bytes", len(report_bytes))
    try:
        report = strict_json(report_bytes)
        shape(report, ["payload", "digests"], ["payload", "digests"], "report.structure")
        payload, digests = report["payload"], report["digests"]
        fields = ["schemaId", "semantics", "glbSha256", "inventory", "options", "outputBasename", "diagnostics"]
        shape(payload, fields, fields, "report.structure")
        shape(digests, ["glb_sha256", "report_sha256"], ["glb_sha256", "report_sha256"], "report.structure")
        glb_hash = sha256_bytes(glb_bytes)
        if digest(payload["glbSha256"]) != glb_hash or digest(digests["glb_sha256"]) != glb_hash:
            fail("report.glb-mismatch", "both sidecar GLB bindings must match delivered bytes")
        digest(digests["report_sha256"])
        if payload["schemaId"] != SCHEMA_ID:
            fail("report.schema", "current authoring schema required")
        semantics = report_semantics(payload["semantics"])
        options = payload["options"]
        validate_options(options)
        basename = payload["outputBasename"]
        if type(basename) is not str or not basename or basename in (".", "..") or any(c in basename for c in "/\\"):
            fail("report.basename", "basename-only provenance required; never used as a file path")
        validate_inventory(payload["inventory"], semantics)
        for diagnostic in sequence(payload["diagnostics"], "report.diagnostics"):
            fields = ["severity", "code", "message", "path"]
            shape(diagnostic, fields, fields, "report.diagnostics")
            if (diagnostic["severity"] not in ("info", "warning", "error") or not is_valid_id(diagnostic["code"])
                    or type(diagnostic["message"]) is not str or not diagnostic["message"] or type(diagnostic["path"]) is not str):
                fail("report.diagnostics", "current diagnostic fields required")
            if diagnostic["severity"] == "error":
                fail("report.error", "an authoring Error report cannot authorize compilation")
        payload_hash = sha256_bytes(canonical_json_bytes(payload))
        if digests["report_sha256"] != payload_hash:
            fail("report.payload-mismatch", "report digest binds canonical payload only")
        source = read_glb(glb_bytes)
        if canonical_json_bytes(source.semantics) != canonical_json_bytes(semantics):
            fail("report.semantic-mismatch", "actual asset/node/material projections differ from sidecar semantics")
        return Admission(source, report, {"sourceGlbSha256": glb_hash,
                         "sourceReportSha256": sha256_bytes(report_bytes), "authoringPayloadSha256": payload_hash})
    except (TypeError, KeyError, IndexError, ValueError, UnicodeError) as exc:
        if isinstance(exc, CompilerError):
            raise
        raise CompilerError("report.structure", "invalid closed authoring report") from None
