"""Full-byte packages, independent decoded oracles and owned publication faults."""

import copy
from fractions import Fraction
from itertools import product
import json
import os
from pathlib import Path
import tempfile
import struct
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from tools.blender.hestia_asset_authoring.canonical import canonical_json_bytes, sha256_bytes
from tools.hestia_asset_compiler.errors import CompilerError
from tools.hestia_asset_compiler.voxel import Binding
from tools.hestia_asset_compiler.package import (
    bounded_json, compile_core, compile_to_directory, publish_package, semantic_projection, tree_hash, verify_files, verify_package, voxel_preimage,
)
from glb_fixtures import box, combine_meshes, fixture, orthogonal_union, part
from package_fixtures import pair, rehash
from test_classification import interval
from test_surface import MICRO, STANDARD


def decoded(package):
    result = {}
    for brick in package.manifest["bricks"]:
        data = package.files[brick["path"]]
        assert len(data) == brick["byteLength"] == 4096
        assert sha256_bytes(data) == brick["sha256"]
        for offset, slot in enumerate(data):
            if slot:
                local = (offset % 16, (offset // 16) % 16, offset // 256)
                cell = tuple(16 * b + x for b, x in zip(brick["coordinate"], local))
                identity = (brick["partId"], cell)
                assert identity not in result
                result[identity] = slot
    return result


def rehashed_package(package, mutate):
    files, manifest = dict(package.files), copy.deepcopy(package.manifest)
    mutate(manifest)
    manifest["voxelizationSha256"] = sha256_bytes(bounded_json(voxel_preimage(manifest)))
    report = json.loads(files["compile-report.json"])
    report["contentHashes"]["voxelizationSha256"] = manifest["voxelizationSha256"]
    report["semanticProjectionSha256"] = sha256_bytes(bounded_json(semantic_projection(manifest)))
    files["compile-report.json"] = bounded_json(report)
    files["asset-manifest.json"] = bounded_json(manifest)
    manifest["manifestTreeSha256"] = tree_hash(files)
    files["asset-manifest.json"] = bounded_json(manifest)
    return files


class PackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw, cls.report, _ = pair()
        cls.cube = compile_core(cls.raw, cls.report, MICRO)

    def test_same_raw_inputs_full_bytes_two_generations(self):
        other = compile_core(self.raw, self.report, MICRO)
        self.assertEqual(self.cube.files, other.files)
        self.assertEqual(self.cube.manifest["manifestTreeSha256"], other.manifest["manifestTreeSha256"])
        self.assertEqual(tree_hash(self.cube.files), self.cube.manifest["manifestTreeSha256"])

    def test_independent_hash_preimage_fields_and_virtual_manifest(self):
        manifest = self.cube.manifest
        fields = ("schema", "profileId", "algorithmVersions", "cellMeters", "brickCellsPerAxis", "cellOrder", "gridBounds",
                  "materialSlots", "bricks", "thinFeatureDecisions", "classificationProofs", "geometricMassInputs")
        self.assertEqual(sha256_bytes(canonical_json_bytes({key: manifest[key] for key in fields})), manifest["voxelizationSha256"])
        projection = {key: value for key, value in manifest.items() if key not in ("sources", "provenanceSha256", "manifestTreeSha256")}
        self.assertEqual(projection, semantic_projection(manifest))
        entries = []
        for name, raw in sorted(self.cube.files.items()):
            if name == "asset-manifest.json":
                raw = canonical_json_bytes({key: value for key, value in manifest.items() if key != "manifestTreeSha256"})
            entries.append({"path": name, "byteLength": len(raw), "sha256": sha256_bytes(raw)})
        expected = sha256_bytes(canonical_json_bytes({"treeVersion": "spike-virtual-manifest-tree-v1", "files": entries}))
        self.assertEqual(expected, manifest["manifestTreeSha256"])
        self.assertEqual(manifest["normalizedGeometrySha256"], "ef800a811d3923679542677ce57af817810ed0639b2c41403a6150494a9a581e")
        self.assertEqual(manifest["semanticsSha256"], "f0d55d068211fef06d4b1be7928cbea36f3c9cf00495c74e2b94263bed29b8a5")
        self.assertEqual(manifest["voxelizationSha256"], "efd516378771d891b82988f36c99a7e2b6beb40fc131b36f6f0e87b6b589c78f")
        self.assertEqual(expected, "d9a27b06a65a37b6c7af4c75b58ad327c1fe9c04452fcf96a03bfecc75f4494b")
        self.assertEqual(len(self.cube.files), 12)
        self.assertEqual(sum(map(len, self.cube.files.values())), 41295)

    def test_cube_box_hollow_L_full_sets_mass_center_sums_both_profiles(self):
        inner_v, inner_f = box((.5,) * 3, (1.5,) * 3)
        shapes = [(box(), [((-1,) * 3, (8,) * 3), ((-1,) * 3, (4,) * 3)], [1000, 216]),
                  (box((0, 0, 0), (1, 1.5, .5)), [((-1,) * 3, (8, 12, 4)), ((-1,) * 3, (4, 6, 2))], [840, 192])]
        for shape, bounds, counts in shapes:
            for profile, bound, count in zip((MICRO, STANDARD), bounds, counts):
                self.assert_oracle(compile_core(*pair(*fixture(*shape))[:2], profile), interval(*bound), count)
        for reverse in (False, True):
            faces = [(a, c, b) for a, b, c in inner_f] if reverse else inner_f
            shape = combine_meshes([box((0, 0, 0), (2,) * 3), (inner_v, faces)])
            for profile, hi, a, b, count in ((MICRO, 16, 5, 10, 5616), (STANDARD, 8, 3, 4, 992)):
                expected = interval((-1,) * 3, (hi,) * 3) - interval((a,) * 3, (b,) * 3)
                self.assert_oracle(compile_core(*pair(*fixture(*shape))[:2], profile), expected, count)
        shape = orthogonal_union((0, .5, 1), (0, .5, 1), (0, .5), {(0, 0, 0), (1, 0, 0), (0, 1, 0)})
        for profile, end, mid, count in ((MICRO, 8, 4, 504), (STANDARD, 4, 2, 128)):
            expected = interval((-1,) * 3, (end, mid, mid)) | interval((-1,) * 3, (mid, end, mid))
            self.assert_oracle(compile_core(*pair(*fixture(*shape))[:2], profile), expected, count)

    def assert_oracle(self, package, expected, count):
        actual = decoded(package)
        self.assertEqual(set(actual), {("part.a", cell) for cell in expected})
        self.assertEqual(set(actual.values()), {1})
        self.assertEqual(len(actual), count)
        mass = package.manifest["geometricMassInputs"][0]
        h = Fraction(package.manifest["cellMeters"])
        sums = [float(sum((Fraction(c[a]) + Fraction(1, 2)) * h for c in expected)) for a in range(3)]
        self.assertEqual(mass["cellCenterSumMeters"], sums)
        self.assertEqual(mass["occupiedCellVolumeCubicMeters"], float(len(expected) * h ** 3))
        self.assertEqual(mass["structuralMaterialId"], "steel.a")
        self.assertEqual(package.manifest["thinFeatureDecisions"][0]["outcome"], "Voxelized")

    def test_projection_permutations_truthful_source_hashes(self):
        doc, binary = fixture(*box())
        doc["materials"].append({"extras": {"hestia": {"renderMaterialId": "render.b", "structuralMaterialId": "steel.b"}}})
        doc["nodes"].append({"extras": {"hestia": {"kind": "marker", "markerId": "marker.cut",
                               "markerType": "CutInterface", "partId": "part.a", "interfaceId": "interface.a"}},
                               "translation": [1, 2, 3]})
        doc["scenes"][0]["nodes"] = [0, 1]
        first = compile_core(*pair(doc, binary)[:2], MICRO)
        doc["materials"].reverse()
        doc["meshes"][0]["primitives"][0]["material"] = 1
        doc["nodes"].reverse()
        doc["scenes"][0]["nodes"] = [1, 0]
        # Triangle list permutation with indices remapped in actual binary.
        points, faces = box()
        _, perm_binary = fixture(points, list(reversed(faces)))
        second = compile_core(*pair(doc, perm_binary)[:2], MICRO)
        self.assertEqual(semantic_projection(first.manifest), semantic_projection(second.manifest))
        for field in ("normalizedGeometrySha256", "semanticsSha256", "voxelizationSha256"):
            self.assertEqual(first.manifest[field], second.manifest[field])
        self.assertEqual({k: v for k, v in first.files.items() if k.startswith("bricks/")},
                         {k: v for k, v in second.files.items() if k.startswith("bricks/")})
        self.assertNotEqual(first.manifest["sources"], second.manifest["sources"])
        self.assertNotEqual(first.manifest["manifestTreeSha256"], second.manifest["manifestTreeSha256"])

    def test_source_warning_paths_never_enter_package_and_no_density(self):
        raw, _, report = pair()
        report["payload"]["diagnostics"] = [{"severity": "warning", "code": "source.warning",
            "message": "C:\\Users\\SECRET_HOST\\file", "path": "C:\\foreign\\SECRET_HOST"}]
        package = compile_core(raw, rehash(report), MICRO)
        for data in package.files.values():
            self.assertNotIn(b"SECRET_HOST", data)
        mass = package.manifest["geometricMassInputs"][0]
        self.assertFalse({"density", "massKg", "inertia"} & set(mass))

    def test_preserved_beam_decorative_and_unbound_stats(self):
        doc, binary = fixture(*box((0, 0, 0), (2, .0625, .125)))
        doc["nodes"][0]["extras"]["hestia"]["thinFeature"]["policy"] = "PreserveAsBeam"
        package = compile_core(*pair(doc, binary)[:2], MICRO)
        self.assertEqual(package.manifest["bricks"], [])
        self.assertEqual(package.manifest["thinFeatureDecisions"][0]["replacement"]["lengthMeters"], 2)
        self.assertEqual(package.manifest["geometricMassInputs"], [])
        doc, binary = fixture(*box())
        record = doc["nodes"][0]["extras"]["hestia"]
        record.update(representation="Decorative", destructible=False, collisionPolicy="None", navigationPolicy="None")
        decorative = compile_core(*pair(doc, binary)[:2], MICRO)
        self.assertEqual(decorative.manifest["bricks"], [])
        self.assertEqual(decorative.manifest["parts"][0], {k: v for k, v in record.items() if k != "kind"})
        doc, binary = fixture(*box())
        del doc["nodes"][0]["extras"]["hestia"]["structuralMaterialId"]
        del doc["materials"][0]["extras"]["hestia"]["structuralMaterialId"]
        unbound = compile_core(*pair(doc, binary)[:2], STANDARD)
        self.assertIsNone(unbound.manifest["geometricMassInputs"][0]["structuralMaterialId"])
        self.assertEqual(unbound.manifest["geometricMassInputs"][0]["applicability"], "UnboundGeometry")

    def test_preserved_shell_full_package_no_fake_voxel_mass(self):
        doc, binary = fixture([(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], [(0, 1, 2), (0, 2, 3)])
        record = doc["nodes"][0]["extras"]["hestia"]
        record.update(representation="Shell", shell={"thicknessMeters": .0625,
                      "layers": [{"structuralMaterialId": "steel.a", "thicknessMeters": .0625}]})
        record["thinFeature"]["policy"] = "PreserveAsShell"
        package = compile_core(*pair(doc, binary)[:2], MICRO)
        self.assertEqual(package.manifest["thinFeatureDecisions"][0]["outcome"], "PreservedSemantic")
        self.assertEqual(package.manifest["bricks"], [])
        self.assertEqual(package.manifest["geometricMassInputs"], [])
        self.assertEqual(set(package.files), {"asset-manifest.json", "diagnostics.json", "provenance.json", "compile-report.json"})

    def test_unused_256_declarations_not_active_slots(self):
        doc, binary = fixture(*box())
        doc["materials"].extend({"extras": {"hestia": {"renderMaterialId": f"unused.{i}",
                                   "structuralMaterialId": f"unused.struct.{i}", "paletteIndex": 65535}}} for i in range(256))
        package = compile_core(*pair(doc, binary)[:2], STANDARD)
        self.assertEqual(len(package.manifest["materials"]), 257)
        self.assertEqual(len(package.manifest["materialSlots"]), 1)
        self.assertEqual(package.manifest["materialSlots"][0]["slot"], 1)

    def test_render_only_normals_and_joint_marker_placements(self):
        doc, binary = fixture(*box())
        original = compile_core(*pair(doc, binary)[:2], MICRO)
        offset = len(binary)
        binary += struct.pack("<24f", *([0, 0, 1] * 8))
        doc["buffers"][0]["byteLength"] = len(binary)
        doc["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": 96})
        doc["accessors"].append({"bufferView": 2, "componentType": 5126, "count": 8, "type": "VEC3"})
        doc["meshes"][0]["primitives"][0]["attributes"]["NORMAL"] = 2
        rendered = compile_core(*pair(doc, binary)[:2], MICRO)
        self.assertEqual(semantic_projection(original.manifest), semantic_projection(rendered.manifest))
        doc["nodes"].extend([{"extras": {"hestia": {**part("part.b"), "representation": "StructuralAssembly"}}},
            {"translation": [1, 2, 3], "extras": {"hestia": {"kind": "joint", "jointId": "joint.a", "jointType": "Fixed",
             "parentPartId": "part.a", "childPartId": "part.b", "breakPolicy": "Never"}}},
            {"translation": [-1, 0, 2], "extras": {"hestia": {"kind": "marker", "markerId": "marker.a",
             "markerType": "CutInterface", "partId": "part.a", "interfaceId": "interface.a"}}}])
        doc["nodes"][0]["translation"] = [10, 0, 0]
        doc["nodes"][0]["children"] = [1, 2, 3]
        package = compile_core(*pair(doc, binary)[:2], MICRO)
        by_id = {item["id"]: item for item in package.manifest["placements"]}
        self.assertEqual(by_id["joint.a"]["worldMatrix"][12:15], [11, 2, 3])
        self.assertEqual(by_id["marker.a"]["worldMatrix"][12:15], [9, 0, 2])
        self.assertEqual(package.manifest["markers"][0]["interfaceId"], "interface.a")

    def test_overlap_stats_are_owned_contributions_not_net_volume(self):
        doc, binary = fixture(*box())
        doc["nodes"].append({"mesh": 0, "extras": {"hestia": part("part.b")}})
        doc["scenes"][0]["nodes"].append(1)
        package = compile_core(*pair(doc, binary)[:2], STANDARD)
        self.assertEqual(len(decoded(package)), 432)
        masses = package.manifest["geometricMassInputs"]
        self.assertEqual([m["cellCount"] for m in masses], [216, 216])
        self.assertTrue(all("not net unique" in m["ownershipConvention"] for m in masses))

    def test_exact_90_matrix_success_common_90_TRS_geometry_valid_compile_blocked(self):
        import math
        doc, binary = fixture(*box())
        doc["nodes"][0]["matrix"] = [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        package = compile_core(*pair(doc, binary)[:2], STANDARD)
        self.assertEqual(len(decoded(package)), 216)
        del doc["nodes"][0]["matrix"]
        doc["nodes"][0]["rotation"] = [0, 0, math.sin(math.pi / 4), math.cos(math.pi / 4)]
        with self.assertRaises(CompilerError) as error:
            compile_core(*pair(doc, binary)[:2], STANDARD)
        self.assertEqual(error.exception.code, "thin.unproven")
        self.assertEqual(error.exception.decisions[0]["outcome"], "RejectedUnprovenThickness")

    def test_output_metadata_guard_before_encoding(self):
        with patch("tools.hestia_asset_compiler.package.canonical_json_bytes") as allocating:
            with self.assertRaises(CompilerError):
                bounded_json({"data": "x" * 4_194_304})
            allocating.assert_not_called()

    def test_total_metadata_and_active_slots_before_brick_payload_allocation(self):
        # Allocation controls, NOT synthetic successful compile/geometry evidence.
        with patch("tools.hestia_asset_compiler.package.json_bound", return_value=(67_108_865, 1)), \
                patch("tools.hestia_asset_compiler.package.pack_bricks") as payload:
            with self.assertRaises(CompilerError) as error:
                compile_core(self.raw, self.report, MICRO)
            self.assertEqual(error.exception.code, "budget.output_bytes")
            payload.assert_not_called()
        state = SimpleNamespace(cells={("part.a", (i, 0, 0)): Binding(f"render.{i}", f"steel.{i}") for i in range(256)})
        with patch("tools.hestia_asset_compiler.package.classify_cells", return_value=state), \
                patch("tools.hestia_asset_compiler.package.pack_bricks") as payload:
            with self.assertRaises(CompilerError) as error:
                compile_core(self.raw, self.report, MICRO)
            self.assertEqual(error.exception.code, "surface.material-slots")
            payload.assert_not_called()

    def test_rehashed_false_grid_bounds_and_malformed_metadata_rejected_stably(self):
        for mutate in (lambda m: m["gridBounds"][0]["maximumCell"].__setitem__(0, 999),
                       lambda m: m.update(metersPerUnit=True),
                       lambda m: m.update(sources=[]),
                       lambda m: m["materialSlots"][0].update(renderMaterialId=[])):
            files = dict(self.cube.files)
            manifest = copy.deepcopy(self.cube.manifest)
            mutate(manifest)
            manifest["voxelizationSha256"] = sha256_bytes(bounded_json(voxel_preimage(manifest)))
            report = json.loads(files["compile-report.json"])
            report["contentHashes"]["voxelizationSha256"] = manifest["voxelizationSha256"]
            report["semanticProjectionSha256"] = sha256_bytes(bounded_json(semantic_projection(manifest)))
            files["compile-report.json"] = bounded_json(report)
            files["asset-manifest.json"] = bounded_json(manifest)
            manifest["manifestTreeSha256"] = tree_hash(files)
            files["asset-manifest.json"] = bounded_json(manifest)
            with self.subTest(mutate=mutate), self.assertRaises(CompilerError):
                verify_files(files)

    def test_rehashed_invalid_proof_and_replacement_descriptors_reject(self):
        mutations = (lambda m: m.update(classificationProofs={}),
                     lambda m: m["classificationProofs"]["part.a"].update(topologyVersion="unknown"),
                     lambda m: m["classificationProofs"]["part.a"].update(homotopyEquivalent=False),
                     lambda m: m["classificationProofs"]["part.a"].update(filled=1),
                     lambda m: m["classificationProofs"]["part.a"].update(rasterAirComponents=2),
                     lambda m: m["thinFeatureDecisions"][0]["proof"]["thinSectionWitness"]["exactEndpointRatios"][1][1].update(numerator="3"))
        for mutate in mutations:
            with self.subTest(mutate=mutate), self.assertRaises(CompilerError):
                verify_files(rehashed_package(self.cube, mutate))
        doc, binary = fixture(*box((0, 0, 0), (2, .0625, .125)))
        doc["nodes"][0]["extras"]["hestia"]["thinFeature"]["policy"] = "PreserveAsBeam"
        beam = compile_core(*pair(doc, binary)[:2], MICRO)
        for field, value in (("renderMaterialId", "render.missing"), ("structuralMaterialId", "steel.missing")):
            with self.subTest(field=field), self.assertRaises(CompilerError):
                verify_files(rehashed_package(beam, lambda m: m["thinFeatureDecisions"][0]["replacement"].update({field: value})))

    def test_corrigendum_five_rehashed_review_reproductions(self):
        doc, binary = fixture(*box((0, 0, 0), (1, .0625, .125)))
        doc["nodes"][0]["extras"]["hestia"]["thinFeature"]["policy"] = "PreserveAsBeam"
        beam = compile_core(*pair(doc, binary)[:2], MICRO)
        centered = compile_core(*pair(*fixture(*box((-.375,) * 3, (.375,) * 3)))[:2], MICRO)
        mass = centered.manifest["geometricMassInputs"][0]
        self.assertEqual((mass["cellCount"], mass["occupiedCellVolumeCubicMeters"], mass["cellCenterSumMeters"]),
                         (512, 1.0, [0, 0, 0]))

        def omit_minima(manifest):
            proof = manifest["thinFeatureDecisions"][0]["proof"]
            del proof["minimumAxisSectionMeters"], proof["axisSectionMinimaMeters"]

        cases = (("zero-minima-versus-exact-one", self.cube, lambda m: m["thinFeatureDecisions"][0]["proof"].update(
                    minimumAxisSectionMeters=0, axisSectionMinimaMeters=[0, 0, 0])),
                 ("omitted-minima", self.cube, omit_minima),
                 ("unknown-decision-field", self.cube, lambda m: m["thinFeatureDecisions"][0].update(unrecognizedProbeField="probe")),
                 ("beam-bool-one", beam, lambda m: m["thinFeatureDecisions"][0]["replacement"].update(lengthMeters=True)),
                 ("volume-bool-one-and-center-bool-zero", centered, lambda m: m["geometricMassInputs"][0].update(
                    occupiedCellVolumeCubicMeters=True, cellCenterSumMeters=[False, False, False])))
        for name, package, mutate in cases:
            with self.subTest(case=name):
                with self.assertRaises(CompilerError) as error:
                    verify_files(rehashed_package(package, mutate))
                self.assertEqual(error.exception.code, "package.geometric-inputs" if package is centered else "package.thin")

    def test_corrigendum_section_records_closed_typed_and_coherent(self):
        decision = self.cube.manifest["thinFeatureDecisions"][0]
        records = (((), decision), (("intent",), decision["intent"]), (("proof",), decision["proof"]),
                   (("proof", "thinSectionWitness"), decision["proof"]["thinSectionWitness"]),
                   (("proof", "thinSectionWitness", "exactLengthRatio"), decision["proof"]["thinSectionWitness"]["exactLengthRatio"]))
        for path, record in records:
            for field in (*record, "unknown"):
                def mutate(manifest):
                    target = manifest["thinFeatureDecisions"][0]
                    for key in path:
                        target = target[key]
                    if field == "unknown":
                        target[field] = "probe"
                    else:
                        del target[field]
                with self.subTest(path=path, field=field), self.assertRaises(CompilerError):
                    verify_files(rehashed_package(self.cube, mutate))
        proof_mutations = (lambda p: p.update(minimumAxisSectionMeters=True),
                           lambda p: p.update(axisSectionMinimaMeters=[True, 1, 1]),
                           lambda p: p.update(axisSectionMinimaMeters=[1, 1]),
                           lambda p: p.update(axisSectionMinimaMeters=[2, 1, 1]),
                           lambda p: p.update(minimumAxisSectionMeters=2),
                           lambda p: p["thinSectionWitness"].update(axis=False),
                           lambda p: p["thinSectionWitness"].update(exactEndpointRatios=[[{}], []]),
                           lambda p: p["thinSectionWitness"]["exactEndpointRatios"][0][0].update(unknown="probe"))
        for mutate in proof_mutations:
            with self.subTest(mutate=mutate), self.assertRaises(CompilerError):
                verify_files(rehashed_package(self.cube, lambda m: mutate(m["thinFeatureDecisions"][0]["proof"])))

        def rounded_under_margin(manifest):
            proof = manifest["thinFeatureDecisions"][0]["proof"]
            proof.update(minimumAxisSectionMeters=.25, axisSectionMinimaMeters=[.25] * 3)
            witness = proof["thinSectionWitness"]
            length = Fraction(1, 4) - Fraction(1, 2 ** 56)
            self.assertEqual(float(length), .25)
            ratio = {"numerator": str(length.numerator), "denominator": str(length.denominator)}
            witness["exactLengthRatio"] = ratio
            witness["exactEndpointRatios"][1][witness["axis"]] = ratio
            witness["endpointsMeters"][1][witness["axis"]] = .25
        with self.assertRaises(CompilerError) as error:
            verify_files(rehashed_package(self.cube, rounded_under_margin))
        self.assertEqual(error.exception.code, "package.thin")

    def test_corrigendum_geometric_records_closed_and_nonbool(self):
        centered = compile_core(*pair(*fixture(*box((-.375,) * 3, (.375,) * 3)))[:2], MICRO)
        record = centered.manifest["geometricMassInputs"][0]
        for field in (*record, "unknown"):
            def mutate(manifest):
                target = manifest["geometricMassInputs"][0]
                if field == "unknown":
                    target[field] = "probe"
                else:
                    del target[field]
            with self.subTest(field=field), self.assertRaises(CompilerError):
                verify_files(rehashed_package(centered, mutate))
        mutations = (lambda r: r.update(cellCount=True), lambda r: r.update(cellVolumeCubicMeters=True),
                     lambda r: r.update(occupiedCellVolumeCubicMeters=True),
                     lambda r: r.update(cellCenterSumMeters=[False, False, False]),
                     lambda r: r.update(boundsCells=[[False] * 3, [True] * 3]),
                     lambda r: r.update(boundsCells=[[0] * 3]),
                     lambda r: r.update(boundsMeters=[[False] * 3, [True] * 3]),
                     lambda r: r.update(boundsMeters=[[0] * 3]),
                     lambda r: r.update(structuralMaterialId="steel.missing"),
                     lambda r: r.update(applicability="UnboundGeometry"))
        for mutate in mutations:
            with self.subTest(mutate=mutate), self.assertRaises(CompilerError):
                verify_files(rehashed_package(centered, lambda m: mutate(m["geometricMassInputs"][0])))
        valid = rehashed_package(centered, lambda m: m["geometricMassInputs"][0].update(
            occupiedCellVolumeCubicMeters=1, cellCenterSumMeters=[0, 0, 0]))
        self.assertEqual(verify_files(valid)["geometricMassInputs"][0]["cellCenterSumMeters"], [0, 0, 0])
        negative = compile_core(*pair(*fixture(*box((-1.375,) * 3, (-.625,) * 3)))[:2], MICRO)
        self.assertEqual(negative.manifest["geometricMassInputs"][0]["cellCenterSumMeters"], [-512] * 3)
        self.assertEqual(verify_files(negative.files), negative.manifest)

    def test_corrigendum_preserved_variants_closed_typed_and_exact_margin(self):
        doc, binary = fixture(*box((0, 0, 0), (1, .0625, .125)))
        doc["nodes"][0]["extras"]["hestia"]["thinFeature"]["policy"] = "PreserveAsBeam"
        beam = compile_core(*pair(doc, binary)[:2], MICRO)
        doc, binary = fixture([(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], [(0, 1, 2), (0, 2, 3)])
        doc["nodes"][0]["extras"]["hestia"].update(representation="Shell", shell={"thicknessMeters": 1,
            "layers": [{"structuralMaterialId": "steel.a", "thicknessMeters": 1}]})
        doc["nodes"][0]["extras"]["hestia"]["thinFeature"]["policy"] = "PreserveAsShell"
        shell = compile_core(*pair(doc, binary)[:2], MICRO)
        doc, binary = fixture(*box())
        del doc["nodes"][0]["mesh"]
        doc["nodes"][0]["extras"]["hestia"]["representation"] = "StructuralAssembly"
        assembly = compile_core(*pair(doc, binary)[:2], MICRO)
        doc, binary = fixture(*box())
        doc["nodes"][0]["extras"]["hestia"].update(representation="Decorative", destructible=False,
            collisionPolicy="None", navigationPolicy="None")
        decorative = compile_core(*pair(doc, binary)[:2], MICRO)
        for package in (beam, shell, assembly, decorative):
            self.assertEqual(verify_files(package.files), package.manifest)
            decision = package.manifest["thinFeatureDecisions"][0]
            records = [((), decision)]
            for key in ("proof", "replacement"):
                if key in decision:
                    records.append(((key,), decision[key]))
            for path, record in records:
                for field in (*record, "unknown"):
                    def mutate(manifest):
                        target = manifest["thinFeatureDecisions"][0]
                        for key in path:
                            target = target[key]
                        if field == "unknown":
                            target[field] = "probe"
                        else:
                            del target[field]
                    with self.subTest(outcome=decision["outcome"], path=path, field=field), self.assertRaises(CompilerError):
                        verify_files(rehashed_package(package, mutate))
        for package, mutate in ((beam, lambda r: r.update(lengthMeters=True)),
                                (beam, lambda r: r.update(crossSectionMeters=[True, .125])),
                                (beam, lambda r: r.update(boundsMinMeters=[False, 0, 0])),
                                (shell, lambda r: r.update(thicknessMeters=True)),
                                (shell, lambda r: r.update(normal=[0, 0, True])),
                                (shell, lambda r: r["layerIntent"][0].update(thicknessMeters=True)),
                                (shell, lambda r: r["layerIntent"][0].update(unknown="probe")),
                                (shell, lambda r: r["layerIntent"][0].pop("thicknessMeters"))):
            with self.subTest(mutate=mutate), self.assertRaises(CompilerError):
                verify_files(rehashed_package(package, lambda m: mutate(m["thinFeatureDecisions"][0]["replacement"])))
        doc, binary = fixture(*box((0, 0, 2 ** -55), (2, .5, .5)))
        doc["nodes"][0]["extras"]["hestia"]["thinFeature"]["policy"] = "PreserveAsBeam"
        rounded_beam = compile_core(*pair(doc, binary)[:2], STANDARD)
        proof = rounded_beam.manifest["thinFeatureDecisions"][0]["proof"]
        ratio = proof["thinSectionWitness"]["exactLengthRatio"]
        self.assertEqual(proof["minimumAxisSectionMeters"], .5)
        self.assertLess(Fraction(int(ratio["numerator"]), int(ratio["denominator"])), Fraction(1, 2))
        self.assertEqual(verify_files(rounded_beam.files), rounded_beam.manifest)

    def test_success_actual_directory_verification_and_corrupt_brick(self):
        with tempfile.TemporaryDirectory() as root:
            target = Path(root) / "out"
            publish_package(self.cube, target)
            self.assertEqual(verify_package(target)["manifestTreeSha256"], self.cube.manifest["manifestTreeSha256"])
            brick = self.cube.manifest["bricks"][0]
            (target / brick["path"]).write_bytes(b"\0" * 4096)
            with self.assertRaises(CompilerError):
                verify_package(target)

    def test_bounded_path_core_source_unchanged_existing_output_before_input_io(self):
        with tempfile.TemporaryDirectory() as root:
            parent = Path(root)
            source, report, target = parent / "input.glb", parent / "input.json", parent / "out"
            source.write_bytes(self.raw)
            report.write_bytes(self.report)
            compile_to_directory(source, report, STANDARD, target)
            manifest = verify_package(target)
            self.assertEqual(sum(item["cellCount"] for item in manifest["geometricMassInputs"]), 216)
            self.assertEqual(source.read_bytes(), self.raw)
            self.assertEqual(report.read_bytes(), self.report)
            with patch("tools.hestia_asset_compiler.package.bounded_read") as read, \
                    patch("tools.hestia_asset_compiler.package.tempfile.mkdtemp") as stage:
                with self.assertRaises(CompilerError) as error:
                    compile_to_directory(source, report, STANDARD, target)
                self.assertEqual(error.exception.code, "publication.target-exists")
                read.assert_not_called()
                stage.assert_not_called()

    def test_existing_file_empty_nonempty_junction_broken_junction_before_staging(self):
        with tempfile.TemporaryDirectory() as root:
            parent = Path(root)
            regular = parent / "file"
            regular.write_bytes(b"FOREIGN")
            empty, nonempty = parent / "empty", parent / "nonempty"
            empty.mkdir()
            nonempty.mkdir()
            (nonempty / "sentinel").write_bytes(b"FOREIGN")
            import _winapi
            junction = parent / "junction"
            _winapi.CreateJunction(str(nonempty), str(junction))
            missing, broken = parent / "removed-owned-target", parent / "broken-junction"
            missing.mkdir()
            _winapi.CreateJunction(str(missing), str(broken))
            missing.rmdir()  # Own empty fixture only: makes a REAL broken reparse point.
            for target in (regular, empty, nonempty, junction, broken):
                with self.subTest(target=target.name), patch("tools.hestia_asset_compiler.package.tempfile.mkdtemp") as stage:
                    with self.assertRaises(CompilerError) as error:
                        publish_package(self.cube, target)
                    self.assertEqual(error.exception.code, "publication.target-exists")
                    stage.assert_not_called()
            self.assertEqual(regular.read_bytes(), b"FOREIGN")
            self.assertEqual((nonempty / "sentinel").read_bytes(), b"FOREIGN")

    def test_lexical_link_guard_mock_is_not_native_symlink_evidence(self):
        # Native symlink creation was attempted and failed WinError 1314. No ACL/privilege change.
        # These are unit branch checks, NOT claims that native symlink cases ran on this host.
        with tempfile.TemporaryDirectory() as root:
            for name in ("symlink", "broken-symlink"):
                target = Path(root) / name
                with patch("tools.hestia_asset_compiler.package.os.path.lexists", return_value=True), \
                        patch("tools.hestia_asset_compiler.package.tempfile.mkdtemp") as staging:
                    with self.assertRaises(CompilerError) as error:
                        publish_package(self.cube, target)
                    self.assertEqual(error.exception.code, "publication.target-exists")
                    staging.assert_not_called()

    def test_owned_staging_faults_after_brick_before_manifest_and_temp(self):
        from tools.hestia_asset_compiler import package as module
        for mode in ("after-brick", "before-manifest", "temp"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as root:
                parent, target = Path(root), Path(root) / "out"
                stale = parent / ".hestia-compile-foreign"
                stale.mkdir()
                (stale / "sentinel").write_bytes(b"FOREIGN")
                real_write = module.write_file

                def failing(path, data):
                    if mode == "before-manifest" and path.name == "asset-manifest.json":
                        raise OSError("injected")
                    real_write(path, data)
                    if mode == "after-brick" and path.suffix == ".bin":
                        raise OSError("injected")

                selected = patch("tools.hestia_asset_compiler.package.tempfile.mkdtemp", side_effect=OSError("injected")) \
                    if mode == "temp" else patch("tools.hestia_asset_compiler.package.write_file", side_effect=failing)
                with selected, self.assertRaises(CompilerError):
                    publish_package(self.cube, target)
                self.assertFalse(os.path.lexists(target))
                self.assertEqual(list(parent.iterdir()), [stale])
                self.assertEqual((stale / "sentinel").read_bytes(), b"FOREIGN")

    def test_rename_failure_collision_and_failed_staged_verification(self):
        from tools.hestia_asset_compiler import package as module
        for mode in ("rename", "collision", "empty-collision", "verify", "corrupt"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as root:
                target = Path(root) / "out"
                real_rename, real_write = os.rename, module.write_file

                def rename(source, destination):
                    if mode in ("collision", "empty-collision"):
                        target.mkdir()
                        if mode == "collision":
                            (target / "sentinel").write_bytes(b"FOREIGN")
                        real_rename(source, destination)
                    raise OSError("injected")

                def corrupt(path, data):
                    real_write(path, b"\0" * 4096 if path.suffix == ".bin" else data)

                if mode in ("rename", "collision", "empty-collision"):
                    selected = patch("tools.hestia_asset_compiler.package.os.rename", side_effect=rename)
                elif mode == "verify":
                    selected = patch("tools.hestia_asset_compiler.package.verify_package", side_effect=CompilerError("test.verify", "injected"))
                else:
                    selected = patch("tools.hestia_asset_compiler.package.write_file", side_effect=corrupt)
                with selected, self.assertRaises(CompilerError):
                    publish_package(self.cube, target)
                if mode in ("collision", "empty-collision"):
                    if mode == "collision":
                        self.assertEqual((target / "sentinel").read_bytes(), b"FOREIGN")
                    else:
                        self.assertEqual(list(target.iterdir()), [])
                    self.assertEqual(list(Path(root).iterdir()), [target])
                else:
                    self.assertEqual(list(Path(root).iterdir()), [])

    def test_unwritable_parent_mock_no_acl_change_and_unsupported_platform(self):
        with tempfile.TemporaryDirectory() as root:
            target = Path(root) / "out"
            with patch("tools.hestia_asset_compiler.package.tempfile.mkdtemp", side_effect=PermissionError("injected")), \
                    self.assertRaises(CompilerError):
                publish_package(self.cube, target)
            self.assertEqual(list(Path(root).iterdir()), [])
            with patch("tools.hestia_asset_compiler.package.sys.platform", "linux"), \
                    patch("tools.hestia_asset_compiler.package.tempfile.mkdtemp") as staging:
                with self.assertRaises(CompilerError) as error:
                    publish_package(self.cube, target)
                self.assertEqual(error.exception.code, "publication.platform")
                staging.assert_not_called()
