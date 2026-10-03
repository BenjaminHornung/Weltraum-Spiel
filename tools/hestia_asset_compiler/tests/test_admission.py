"""Report rejection precedes any world/raster work, even with recomputed digests."""

import copy
import json
import unittest
from unittest.mock import patch

from tools.blender.hestia_asset_authoring.canonical import canonical_json_bytes, sha256_bytes
from tools.hestia_asset_compiler.admission import admit_pair
from tools.hestia_asset_compiler.errors import CompilerError
from glb_fixtures import box, fixture, glb, part
from package_fixtures import pair, rehash


class AdmissionTests(unittest.TestCase):
    def test_payload_only_digest_raw_report_and_zero_options(self):
        raw, report_bytes, report = pair()
        altered = json.dumps(report, indent=2).encode()
        for data in (report_bytes, altered):
            admitted = admit_pair(raw, data)
            self.assertEqual(admitted.sources["sourceGlbSha256"], sha256_bytes(raw))
            self.assertEqual(admitted.sources["sourceReportSha256"], sha256_bytes(data))
            self.assertEqual(admitted.sources["authoringPayloadSha256"],
                             sha256_bytes(canonical_json_bytes(report["payload"])))
            self.assertEqual(admitted.report["payload"]["options"]["unappliedScaleTolerance"], 0)

    def test_missing_report_all_digest_bindings_and_error_null_reports(self):
        raw, data, report = pair()
        with self.assertRaises(CompilerError):
            admit_pair(raw, None)
        variants = []
        for owner, key in (("payload", "glbSha256"), ("digests", "glb_sha256"), ("digests", "report_sha256")):
            for value in (None, "0" * 64, "G" * 64, True):
                bad = copy.deepcopy(report)
                bad[owner][key] = value
                variants.append(canonical_json_bytes(bad))
        bad = copy.deepcopy(report)
        bad["payload"]["diagnostics"] = [{"severity": "error", "code": "export.failed", "message": "error", "path": ""}]
        variants.append(rehash(bad))
        for data in variants:
            with self.subTest(data=data[-100:]), self.assertRaises(CompilerError):
                admit_pair(raw, data)

    def test_rehashed_invalid_closed_semantics_and_transport_conflicts(self):
        raw, _, report = pair()
        mutations = [lambda p: p.update(schemaId="unknown.schema"),
                     lambda p: p["semantics"].update(alias=[]),
                     lambda p: p["semantics"]["asset"].update(coordinateFrame={"upAxis": "+Z"}),
                     lambda p: p["semantics"]["asset"].update(assetRevision=True),
                     lambda p: p["semantics"]["parts"][0].update(parentPartId="missing.part"),
                     lambda p: p["semantics"]["parts"][0].update(partId="part.other"),
                     lambda p: p["semantics"]["parts"][0].update(kind="part"),
                     lambda p: p["semantics"]["materials"][0].update(structuralMaterialId="steel.other"),
                     lambda p: p["options"].update(unappliedScalePolicy="WARNING"),
                     lambda p: p["options"].update(unappliedScaleTolerance=-1),
                     lambda p: p["options"].update(unappliedScaleTolerance=True),
                     lambda p: p.update(outputBasename="C:\\foreign\\file.glb")]
        for mutation in mutations:
            bad = copy.deepcopy(report)
            mutation(bad["payload"])
            with self.subTest(mutation=mutation), self.assertRaises(CompilerError):
                admit_pair(raw, rehash(bad))

    def test_inventory_shapes_not_false_geometry_count_matching(self):
        raw, data, report = pair()
        self.assertEqual(len(admit_pair(raw, data).source.primitives[0][0].positions), 8)
        for mutation in (lambda p: p["inventory"]["meshes"][0]["topology"].update(vertexCount=True),
                         lambda p: p["inventory"]["meshes"][0].update(boundsMin=[0, 0]),
                         lambda p: p["inventory"].update(primitives=[{"primitiveId": "p"}]),
                         lambda p: p["inventory"]["materials"].append({"materialId": "missing.render"}),
                         lambda p: p["diagnostics"].append({"severity": "warning", "code": "bad", "message": ""})):
            bad = copy.deepcopy(report)
            mutation(bad["payload"])
            with self.assertRaises(CompilerError):
                admit_pair(raw, rehash(bad))

    def test_current_build_report_model_is_accepted_read_only(self):
        from tools.blender.hestia_asset_authoring.model import (
            AuthoringInput, CanonicalAsset, CanonicalMaterial, CanonicalPart, GeometryInventory, ThinFeature,
            ValidationOptions,
        )
        from tools.blender.hestia_asset_authoring.report import build_report
        authored = CanonicalAsset("asset.test", 0, "Solid", parts=(CanonicalPart(
            "part.a", "Solid", True, "Voxel", "Obstacle", ThinFeature("Reject", 1),
            default_render_material_id="render.a", structural_material_id="steel.a"),),
            materials=(CanonicalMaterial("render.a", "steel.a"),))
        semantics = authored.to_contract_dict()
        doc, binary = fixture(*box())
        doc["asset"]["extras"]["hestia"] = {"schema": semantics["schema"], **semantics["asset"]}
        doc["nodes"][0]["extras"]["hestia"] = {"kind": "part", **semantics["parts"][0]}
        doc["materials"][0]["extras"]["hestia"] = semantics["materials"][0]
        raw = glb(doc, binary)
        report = build_report(AuthoringInput(authored, GeometryInventory((), (), ())), glb_sha256=sha256_bytes(raw),
                              options=ValidationOptions(unapplied_scale_tolerance=0), output_basename="fixture.glb")
        self.assertEqual(admit_pair(raw, canonical_json_bytes(report)).source.semantics["asset"]["assetId"], "asset.test")

    def test_invalid_sidecar_before_world_and_raster(self):
        from tools.hestia_asset_compiler.package import compile_core
        raw, _, report = pair()
        report["payload"]["semantics"]["asset"]["metersPerUnit"] = True
        with patch("tools.hestia_asset_compiler.package.canonicalize_geometry") as world, \
                patch("tools.hestia_asset_compiler.package.classify_cells") as grid:
            with self.assertRaises(CompilerError):
                compile_core(raw, rehash(report), "micro-0125-research-v1")
            world.assert_not_called()
            grid.assert_not_called()

    def test_report_byte_depth_duplicate_and_nonfinite_before_world(self):
        from tools.hestia_asset_compiler.package import compile_core
        raw, _, _ = pair()
        bad_reports = (b" " * (4_194_304 + 1), b"[" * 65 + b"0" + b"]" * 65,
                       b'{"payload":{},"payload":{}}', b'{"payload":NaN}')
        for data in bad_reports:
            with patch("tools.hestia_asset_compiler.package.canonicalize_geometry") as world, \
                    patch("tools.hestia_asset_compiler.package.classify_cells") as cells:
                with self.assertRaises(CompilerError):
                    compile_core(raw, data, "micro-0125-research-v1")
                world.assert_not_called()
                cells.assert_not_called()
