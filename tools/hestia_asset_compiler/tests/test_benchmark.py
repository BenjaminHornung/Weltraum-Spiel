"""Diagnostic timings never weaken source proof, budgets, or content identity."""

import unittest
from unittest.mock import patch

from tools.hestia_asset_compiler.benchmark import benchmark, measure_compile, small_input
from tools.hestia_asset_compiler.glb import read_glb
from tools.hestia_asset_compiler.package import compile_core
from package_fixtures import pair


class BenchmarkTests(unittest.TestCase):
    def test_small_is_actual_mesh_copies_not_instancing_label(self):
        raw, report = small_input()
        source = read_glb(raw)
        self.assertEqual(len(source.document["meshes"]), 84)
        self.assertEqual(sum(len(p.indices) // 3 for mesh in source.primitives for p in mesh), 1008)
        self.assertEqual(sum(len(p.positions) for mesh in source.primitives for p in mesh), 672)

    def test_instrumented_core_bytes_unchanged_and_phases_honest(self):
        raw, report, _ = pair()
        expected = compile_core(raw, report, "standard-025-v1")
        measured, generated = measure_compile(raw, report, "standard-025-v1")
        self.assertEqual(generated.files, expected.files)
        self.assertEqual(measured["qualification"], "CONTAMINATED_DIAGNOSTIC")
        self.assertEqual(measured["memory"], "UNSUPPORTED")
        self.assertEqual(measured["counts"]["inputTriangles"], 12)
        self.assertEqual(measured["counts"]["expandedTriangles"], 12)
        self.assertEqual(measured["counts"]["ownedCells"], 216)
        self.assertEqual(measured["phases"]["optionalGwn"]["status"], "NOT_RUN")
        for phase in measured["phases"].values():
            if phase["status"] == "MEASURED":
                self.assertGreaterEqual(phase["wallMilliseconds"], 0)
                self.assertGreaterEqual(phase["cpuMilliseconds"], 0)
                self.assertIn("scope", phase)

    def test_medium_large_excluded_before_input_generation_or_compile(self):
        for population in ("medium", "large"):
            with patch("tools.hestia_asset_compiler.benchmark.small_input") as input_builder, \
                    patch("tools.hestia_asset_compiler.benchmark.measure_compile") as compile:
                result = benchmark(population)
                self.assertTrue(all(run["status"] == "NOT_RUN_BUDGET_EXCLUDED" for run in result["runs"]))
                input_builder.assert_not_called()
                compile.assert_not_called()
