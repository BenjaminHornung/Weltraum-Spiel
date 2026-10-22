"""Generator inventory, independent oracle and remapped transport regression."""

import copy
from dataclasses import replace
import unittest
from unittest.mock import patch

from tools.hestia_asset_compiler.errors import CompilerError
from tools.hestia_asset_compiler.admission import admit_pair
from tools.hestia_asset_compiler.geometry import canonicalize_geometry
from tools.hestia_asset_compiler.golden import ORDER_IDS, corpus, independent_oracle, load_pins, ordering_variants, run_case, run_corpus
from tools.hestia_asset_compiler.package import compile_core
from tools.hestia_asset_compiler.profiles import PROFILES


class GoldenTests(unittest.TestCase):
    def test_exact_inventory_deterministic_bytes_and_bound_negative_reports(self):
        from tools.blender.hestia_asset_authoring.canonical import sha256_bytes
        import json
        first, second = corpus(), corpus()
        self.assertEqual({case.case_id for case in first}, {f"G{i:02}" for i in range(1, 31)})
        self.assertEqual([(c.case_id, c.variant, c.glb, c.report) for c in first],
                         [(c.case_id, c.variant, c.glb, c.report) for c in second])
        for case in first:
            sidecar = json.loads(case.report)
            self.assertEqual(sidecar["payload"]["glbSha256"], sha256_bytes(case.glb))
            self.assertEqual(sidecar["digests"]["glb_sha256"], sha256_bytes(case.glb))
        addressed = {(c.case_id, c.variant): (sha256_bytes(c.glb), sha256_bytes(c.report)) for c in first}
        for case in first:
            if case.case_id in ORDER_IDS:
                addressed.update({(c.case_id, c.variant): (sha256_bytes(c.glb), sha256_bytes(c.report)) for c in ordering_variants(case)})
        self.assertEqual(len(addressed), 185)
        self.assertEqual(len(set(addressed.values())), 179)  # Six normal identity transports duplicate their base bytes.
        for case in first:
            if case.case_id in ("G23", "G24", "G25", "G26"):
                self.assertEqual(run_case(case, "standard-025-v1")["outcome"], "EXPECTED_REJECTION")

    def test_independent_positive_oracles_and_TRS_stage_distinction(self):
        for case in corpus():
            if case.case_id not in ("G01", "G05", "G06", "G27"):
                continue
            for profile in PROFILES:
                record = run_case(case, profile)
                self.assertEqual(record["oracle"], "PASS")
                if case.variant in ("quarter-trs", "finite-trs"):
                    self.assertEqual(record["geometryStage"]["status"], "VALID")
                    self.assertEqual(record["diagnostics"], ["thin.unproven"])
                    self.assertEqual(record["outcome"], "BLOCKED")

    def test_ordering_matrix_has_real_24_semantically_equal_transports(self):
        case = next(c for c in corpus() if c.case_id == "G01")
        variants = list(ordering_variants(case))
        self.assertEqual(len(variants), 24)
        baseline = run_case(case, "standard-025-v1")
        hashes = set()
        for reordered in variants:
            result = run_case(reordered, "standard-025-v1")
            self.assertEqual(result["contentHashes"], baseline["contentHashes"])
            self.assertEqual(result["semanticProjection"], baseline["semanticProjection"])
            self.assertEqual(result["ownedBricks"], baseline["ownedBricks"])
            hashes.add(result["sources"]["sourceGlbSha256"])
        self.assertGreater(len(hashes), 1)

    def test_runner_bounds_repeats_and_does_not_accept_changed_pin(self):
        with self.assertRaises(CompilerError):
            run_corpus(case_ids=["G31"])
        with self.assertRaises(CompilerError):
            run_corpus(case_ids=["G01"], repeats=11)
        with patch("tools.hestia_asset_compiler.golden.load_pins", return_value={}):
            with self.assertRaises(CompilerError) as error:
                run_corpus(case_ids=["G01"], profiles=["standard-025-v1"])
            self.assertEqual(error.exception.code, "golden.pin-mismatch")
        with patch("tools.hestia_asset_compiler.golden.bounded_read", return_value=b"[]"):
            with self.assertRaises(CompilerError) as error:
                load_pins()
            self.assertEqual(error.exception.code, "golden.pins-invalid")

    def test_repeat_runner_compares_all_bytes_and_never_accepts_a_difference(self):
        case = next(c for c in corpus() if c.case_id == "G01")
        baseline = run_case(case, "standard-025-v1")
        changed = {**baseline, "_files": {**baseline["_files"], "diagnostics.json": b"different"}}
        with patch("tools.hestia_asset_compiler.golden.run_case", side_effect=[baseline, changed]):
            with self.assertRaises(CompilerError) as error:
                run_corpus(["G01"], ["standard-025-v1"], repeats=2, ordering=False, check_pins=False)
            self.assertEqual(error.exception.code, "golden.oracle")
        with patch("tools.hestia_asset_compiler.golden.run_case", side_effect=[baseline, changed]):
            with self.assertRaises(CompilerError) as error:
                run_corpus(["G01"], ["standard-025-v1"], ordering=True, check_pins=False)
            self.assertEqual(error.exception.code, "golden.oracle")
        # One tiny two-repeat support check, NOT the complete corpus x10 C8 run.
        summary, _, _ = run_corpus(["G02"], ["standard-025-v1"], repeats=2, ordering=False, check_pins=False)
        self.assertEqual(summary["repeats"], 2)
        self.assertEqual(summary["outcomeCounts"]["SUCCESS"], 1)

    def test_independent_owned_bounds_and_cell_volume_reject_each_mutated_descriptor(self):
        for case in corpus():
            if case.case_id not in ("G03", "G08"):
                continue
            geometry = canonicalize_geometry(admit_pair(case.glb, case.report).source)
            for profile in PROFILES:
                generated = compile_core(case.glb, case.report, profile)
                baseline = independent_oracle(case, generated, geometry, profile)
                for field in ("boundsCells", "boundsMeters", "cellVolumeCubicMeters", "gridBounds"):
                    with self.subTest(case=case.case_id, profile=profile, field=field):
                        manifest = copy.deepcopy(generated.manifest)
                        if field == "gridBounds":
                            manifest[field][0]["minimumCell"][0] += 1
                        elif field == "cellVolumeCubicMeters":
                            manifest["geometricMassInputs"][0][field] *= 2
                        else:
                            manifest["geometricMassInputs"][0][field][0][0] += 1
                        # Isolate the independent oracle, NOT a claim that the verifier accepts these fakes.
                        with self.assertRaises(CompilerError) as error:
                            independent_oracle(case, replace(generated, manifest=manifest), geometry, profile)
                        self.assertEqual(error.exception.code, "golden.oracle")
                self.assertEqual(independent_oracle(case, generated, geometry, profile), baseline)
        beam = next(c for c in corpus() if c.case_id == "G10" and c.variant == "beam")
        geometry = canonicalize_geometry(admit_pair(beam.glb, beam.report).source)
        generated = compile_core(beam.glb, beam.report, "standard-025-v1")
        self.assertEqual(generated.manifest["gridBounds"], [])  # Frozen per-owner inventory: no occupied owner/bounds.
        independent_oracle(beam, generated, geometry, "standard-025-v1")
        for invalid in (None, [{"partId": "part.a", "minimumCell": [0, 0, 0], "maximumCell": [0, 0, 0]}]):
            with self.subTest(empty=invalid):
                manifest = {**generated.manifest, "gridBounds": invalid}
                with self.assertRaises(CompilerError) as error:
                    independent_oracle(beam, replace(generated, manifest=manifest), geometry, "standard-025-v1")
                self.assertEqual(error.exception.code, "golden.oracle")
