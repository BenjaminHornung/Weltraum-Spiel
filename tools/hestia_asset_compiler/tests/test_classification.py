"""Independent interval/topology oracles for the bounded C5 research classifier."""

import copy
from fractions import Fraction
from itertools import product
import random
import unittest
from unittest.mock import patch

from tools.hestia_asset_compiler.classification import (
    attachment_is_disk, classify_geometry, cubical_euler, parity_witness, prepared_triangles, prove_topology,
)
from tools.hestia_asset_compiler.errors import CompilerError
from tools.hestia_asset_compiler.geometry import cross, dot
from tools.hestia_asset_compiler.voxel import Binding, voxelize_surface
from glb_fixtures import box, combine_meshes, fixture, orthogonal_union, part
from test_surface import MICRO, STANDARD, bake, instances


def interval(low, high):
    return set(product(*(range(a, b + 1) for a, b in zip(low, high))))


def tunnel(low=.5, high=1, z_low=None, z_high=None):
    z_low, z_high = (low, high) if z_low is None else (z_low, z_high)
    blocks = {(0, y, z) for y in range(3) for z in range(3) if (y, z) != (1, 1)}
    return orthogonal_union((0, 2), (0, low, high, 2), (0, z_low, z_high, 2), blocks)


def source_integrals(geometry):
    volume, moments = Fraction(0), [Fraction(0)] * 3
    for triangle in geometry.triangles:
        a, b, c = [tuple(Fraction(x) for x in p) for p in triangle.vertices]
        v = dot(a, cross(b, c)) / 6
        volume += v
        for axis in range(3):
            moments[axis] += v * (a[axis] + b[axis] + c[axis]) / 4
    return volume, tuple(m / volume for m in moments)


class ClassificationTests(unittest.TestCase):
    def assert_owned(self, result, expected, owner="part.a"):
        self.assertEqual({cell for part_id, cell in result.cells if part_id == owner}, expected)
        self.assertEqual({binding for (part_id, cell), binding in result.cells.items() if part_id == owner},
                         {Binding("render.a", "steel.a")})
        self.assertTrue(all(b.part_id in result.domains and len(b.data) == 4096 for b in result.bricks))
        self.assertEqual(sum(sum(v != 0 for v in b.data) for b in result.bricks), len(result.cells))
        self.assertTrue(all(not ((owner, cell) in result.cells) for cell in result.exterior[owner]))

    def assert_tunnel_path(self, result, profile, y, z):
        # Independent straight 6-neighbor witness through the body, not around it.
        end = 16 if profile == MICRO else 8
        path = [(x, y, z) for x in range(-1, end + 1)]
        self.assertTrue(all(cell in result.exterior["part.a"] for cell in path))
        self.assertTrue(all(("part.a", cell) not in result.cells for cell in path))
        self.assertTrue(all(sum(abs(a - b) for a, b in zip(p, q)) == 1 for p, q in zip(path, path[1:])))

    def test_G01_G02_full_independent_interval_sets(self):
        cases = [((1, 1, 1), MICRO, (-1, -1, -1), (8, 8, 8), 1000),
                 ((1, 1, 1), STANDARD, (-1, -1, -1), (4, 4, 4), 216),
                 ((1, 1.5, .5), MICRO, (-1, -1, -1), (8, 12, 4), 840),
                 ((1, 1.5, .5), STANDARD, (-1, -1, -1), (4, 6, 2), 192)]
        for high, profile, lo, hi, count in cases:
            with self.subTest(high=high, profile=profile):
                result = classify_geometry(bake(*fixture(*box((0, 0, 0), high))), profile)
                expected = interval(lo, hi)
                self.assertEqual(len(expected), count)
                self.assert_owned(result, expected)
                self.assertEqual(result.domains["part.a"],
                                 (tuple(v - 1 for v in lo), tuple(v + 1 for v in hi)))
                proof = result.proofs["part.a"]
                self.assertEqual((proof["sourceEuler"], proof["rasterEuler"]), (1, 1))
                self.assertTrue(proof["homotopyEquivalent"])
                self.assertGreater(proof["certifiedAdditions"], 0)

    def test_G13_both_nested_windings_hollow_full_sets(self):
        for reversed_inner in (False, True):
            inner_v, inner_f = box((.5, .5, .5), (1.5, 1.5, 1.5))
            if reversed_inner:
                inner_f = [(a, c, b) for a, b, c in inner_f]
            geometry = bake(*fixture(*combine_meshes([box((0, 0, 0), (2, 2, 2)), (inner_v, inner_f)])))
            self.assertEqual(source_integrals(geometry)[0], 7 if reversed_inner else 9)
            for profile, hi, a, b, occupied, empty in [(MICRO, 16, 5, 10, 5616, 216),
                                                     (STANDARD, 8, 3, 4, 992, 8)]:
                with self.subTest(winding=reversed_inner, profile=profile):
                    result = classify_geometry(geometry, profile)
                    air = interval((a,) * 3, (b,) * 3)
                    expected = interval((-1,) * 3, (hi,) * 3) - air
                    self.assertEqual((len(expected), len(air)), (occupied, empty))
                    self.assert_owned(result, expected)
                    self.assertEqual(result.cavities["part.a"], (frozenset(air),))
                    self.assertEqual(result.proofs["part.a"]["sourceAirComponents"], 2)
                    self.assertEqual(result.proofs["part.a"]["rasterAirComponents"], 2)
                    if profile == MICRO:
                        self.assertEqual(result.stats["grid_cells"], 16125)
                        self.assertEqual(result.stats["flood_cells"], 40000)
                        self.assertEqual(result.stats["candidate_work"], 2458176)

    def test_G14_narrow_tunnel_micro_path_coarse_loss(self):
        geometry = bake(*fixture(*tunnel()))
        result = classify_geometry(geometry, MICRO)
        for y, z in product((5, 6), repeat=2):
            self.assert_tunnel_path(result, MICRO, y, z)
        self.assertEqual((result.proofs["part.a"]["sourceEuler"],
                          result.proofs["part.a"]["rasterEuler"]), (0, 0))
        with patch("tools.hestia_asset_compiler.classification.pack_bricks") as packing:
            with self.assertRaises(CompilerError) as error:
                classify_geometry(geometry, STANDARD)
            self.assertEqual(error.exception.code, "classification.topology-loss")
            packing.assert_not_called()

    def test_tunnel_resolvable_controls_both_profiles(self):
        geometry = bake(*fixture(*tunnel(.5, 1.5)))
        for profile, positions in [(MICRO, range(5, 11)), (STANDARD, (3, 4))]:
            result = classify_geometry(geometry, profile)
            for y, z in product(positions, repeat=2):
                self.assert_tunnel_path(result, profile, y, z)
            self.assertEqual(result.proofs["part.a"]["sourceAirComponents"], 1)
            self.assertEqual(result.proofs["part.a"]["rasterAirComponents"], 1)

    def test_phase_and_diagonal_offset_controls_or_unproven(self):
        geometry = bake(*fixture(*tunnel(.5625, 1.0625, .625, 1.125)))
        for profile, y, z in [(MICRO, 6, 6), (STANDARD, 3, 3)]:
            result = classify_geometry(geometry, profile)
            self.assert_tunnel_path(result, profile, y, z)
        doc, raw = fixture(*tunnel(.5, 1.5))
        doc["nodes"][0]["matrix"] = [1, 0, 0, 0, .25, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        geometry = bake(doc, raw)
        with patch("tools.hestia_asset_compiler.classification.rasterize") as allocation:
            with self.assertRaises(CompilerError) as error:
                classify_geometry(geometry, MICRO)
            self.assertEqual(error.exception.code, "classification.topology-unproven")
            allocation.assert_not_called()

    def test_G15_disconnected_closed_parts_of_one_owner(self):
        geometry = bake(*fixture(*combine_meshes([box(), box((2, 0, 0), (3, 1, 1))])))
        for profile, first_hi, second_lo, second_hi in [(MICRO, 8, 15, 24), (STANDARD, 4, 7, 12)]:
            result = classify_geometry(geometry, profile)
            expected = interval((-1,) * 3, (first_hi,) * 3)
            expected |= interval((second_lo, -1, -1), (second_hi, first_hi, first_hi))
            self.assert_owned(result, expected)
            self.assertEqual((result.proofs["part.a"]["sourceEuler"],
                              result.proofs["part.a"]["rasterEuler"]), (2, 2))

    def test_G27_L_body_intervals_and_independent_source_integrals(self):
        mesh = orthogonal_union((0, .5, 1), (0, .5, 1), (0, .5), {(0, 0, 0), (1, 0, 0), (0, 1, 0)})
        geometry = bake(*fixture(*mesh))
        self.assertEqual(source_integrals(geometry), (Fraction(3, 8),
                         (Fraction(5, 12), Fraction(5, 12), Fraction(1, 4))))
        for profile, long_hi, short_hi, count in [(MICRO, 8, 4, 504), (STANDARD, 4, 2, 128)]:
            result = classify_geometry(geometry, profile)
            expected = interval((-1,) * 3, (long_hi, short_hi, short_hi))
            expected |= interval((-1,) * 3, (short_hi, long_hi, short_hi))
            self.assertEqual(len(expected), count)
            self.assert_owned(result, expected)

    def test_disconnected_source_resolution_loss_not_closed_flag(self):
        geometry = bake(*fixture(*combine_meshes([box(), box((1.125, 0, 0), (2.125, 1, 1))])))
        self.assertTrue(geometry.topology[0]["closed"])
        with self.assertRaises(CompilerError) as error:
            classify_geometry(geometry, STANDARD)
        self.assertEqual(error.exception.code, "classification.topology-loss")

    def test_shell_layered_shell_assembly_decorative_never_solid_fill(self):
        for representation in ("Shell", "LayeredShell", "StructuralAssembly", "Decorative"):
            doc, raw = fixture(*box())
            part = doc["nodes"][0]["extras"]["hestia"]
            part["representation"] = representation
            if representation in ("Shell", "LayeredShell"):
                part["shell"] = {"thicknessMeters": .125,
                                 "layers": [{"structuralMaterialId": "steel.a", "thicknessMeters": .125}]}
            if representation == "Decorative":
                part.update(destructible=False, collisionPolicy="None")
            geometry = bake(doc, raw)
            result = classify_geometry(geometry, MICRO)
            self.assertFalse(result.proofs["part.a"]["filled"])
            self.assertEqual(result.cells, {} if representation == "Decorative"
                             else voxelize_surface(geometry, MICRO).cells)
            self.assertEqual(result.exterior, {})

    def test_exact_parity_grazing_fallback_and_visible_boundary_ambiguity(self):
        geometry = bake(*fixture(*box()))
        faces = prepared_triangles(geometry.triangles)
        inside, direction = parity_witness((Fraction(1, 2),) * 3, faces)
        self.assertTrue(inside)
        self.assertGreaterEqual(direction, 3)  # Three axis rays hit the triangulated face diagonals.
        self.assertFalse(parity_witness((2, 2, 2), faces)[0])
        with self.assertRaises(CompilerError) as error:
            parity_witness((0, .25, .25), faces)
        self.assertEqual(error.exception.code, "classification.ray-ambiguity")

    def test_final_cell_brick_and_proof_permutation_identity(self):
        vertices, faces = box()
        doc, raw = fixture(vertices, faces)
        doc["nodes"].append({"mesh": 0, "translation": [-3, 0, 0], "extras": {"hestia": part("part.b")}})
        doc["scenes"][0]["nodes"] = [0, 1]
        first = classify_geometry(bake(doc, raw), MICRO)
        self.assert_owned(first, interval((-25, -1, -1), (-16, 8, 8)), "part.b")
        variants = [list(reversed(faces)), faces.copy()]
        random.Random(20261002).shuffle(variants[1])
        for variant in variants:
            changed, binary = fixture(vertices, variant)
            changed["nodes"] = list(reversed(copy.deepcopy(doc["nodes"])))
            changed["scenes"][0]["nodes"] = [1, 0]
            changed["materials"].append({"extras": {"hestia": {"renderMaterialId": "render.unused"}}})
            changed["materials"].reverse()
            changed["meshes"][0]["primitives"][0]["material"] = 1
            result = classify_geometry(bake(changed, binary), MICRO)
            self.assertEqual((result.cells, result.bricks, result.proofs), (first.cells, first.bricks, first.proofs))
        doc["accessors"][1]["count"] = 18
        doc["accessors"].append(dict(doc["accessors"][1], byteOffset=36))
        doc["meshes"][0]["primitives"].append({"attributes": {"POSITION": 0}, "indices": 2, "material": 0})
        doc["meshes"][0]["primitives"].reverse()
        result = classify_geometry(bake(doc, raw), MICRO)
        self.assertEqual((result.cells, result.bricks, result.proofs), (first.cells, first.bricks, first.proofs))

    def test_overlapping_parts_classified_independently_not_global_xor(self):
        result = classify_geometry(instances(2, (1, 1, 1)), MICRO)
        expected = interval((-1,) * 3, (8,) * 3)
        self.assertEqual(len(result.cells), 2000)
        for owner in ("part.0000", "part.0001"):
            self.assert_owned(result, expected, owner)
            self.assertEqual(result.proofs[owner]["sourceEuler"], 1)
        self.assertEqual(len({b.key for b in result.bricks}), len(result.bricks))

    def test_volume_material_unproven_before_raster_in_both_orders(self):
        doc, raw = fixture(*box())
        doc["materials"].append({"extras": {"hestia": {
            "renderMaterialId": "render.b", "structuralMaterialId": "steel.b"}}})
        doc["accessors"][1]["count"] = 18
        doc["accessors"].append(dict(doc["accessors"][1], byteOffset=36))
        doc["meshes"][0]["primitives"].append({"attributes": {"POSITION": 0}, "indices": 2, "material": 1})
        for order in range(2):
            with patch("tools.hestia_asset_compiler.classification.rasterize") as allocation:
                with self.assertRaises(CompilerError) as error:
                    classify_geometry(bake(doc, raw), MICRO)
                self.assertEqual(error.exception.code, "classification.volume-material-unproven")
                allocation.assert_not_called()
            doc["meshes"][0]["primitives"].reverse()

    def test_aggregate_classification_guards_before_all_grid_allocations(self):
        tiny = [box((i / 128,) * 3, (i / 128 + 1 / 1024,) * 3) for i in range(100)]
        cases = [(instances(50, (1, 1, 1)), "budget.candidate_work"),
                 (bake(*fixture(*combine_meshes(tiny))), "budget.grid_cells"),
                 (bake(*fixture(*box((0, 0, 0), (100, 100, 100)))), "budget.candidate_work")]
        for geometry, code in cases:
            with self.subTest(code=code), patch("tools.hestia_asset_compiler.classification.rasterize") as raster, \
                    patch("tools.hestia_asset_compiler.classification.build_axes") as axes, \
                    patch("tools.hestia_asset_compiler.classification.flood") as flooding, \
                    patch("tools.hestia_asset_compiler.classification.source_cells") as source, \
                    patch("tools.hestia_asset_compiler.classification.enumerate_cells") as enumeration, \
                    patch("tools.hestia_asset_compiler.classification.pack_bricks") as packing:
                with self.assertRaises(CompilerError) as error:
                    classify_geometry(geometry, MICRO)
                self.assertEqual(error.exception.code, code)
                for allocation in (raster, axes, flooding, source, enumeration, packing):
                    allocation.assert_not_called()

    def test_certificate_is_not_euler_alone_and_detects_merger(self):
        # A face plus a dangling edge is contractible but not a boundary disk. It must not
        # authorize an ambient/complement topology claim merely from Material homotopy.
        self.assertFalse(attachment_is_disk((0, 0, 0), {(-1, 0, 0), (0, 1, 1)}))
        with patch("tools.hestia_asset_compiler.classification.cubical_euler") as allocation:
            with self.assertRaises(CompilerError) as error:
                prove_topology({(100, 0, 0)}, {(100, 0, 0)}, ((-1, -1, -1), (1, 1, 1)))
            self.assertEqual(error.exception.code, "classification.topology-unproven")
            allocation.assert_not_called()
        source = {(0, 0, 0)}
        ring = {(x, y, 0) for x in range(10, 13) for y in range(3) if (x, y) != (11, 1)}
        target = source | ring
        self.assertEqual(cubical_euler(source), cubical_euler(target))
        with self.assertRaises(CompilerError):
            prove_topology(source, target, ((-1, -1, -1), (13, 3, 1)))
        with self.assertRaises(CompilerError) as error:
            prove_topology({(0, 0, 0), (2, 0, 0)}, {(0, 0, 0), (1, 0, 0), (2, 0, 0)},
                           ((-1, -1, -1), (3, 1, 1)))
        self.assertEqual(error.exception.code, "classification.topology-loss")
        # Same Euler, material-component and Air-component counts, but the original hole is
        # filled and a different hole added. Inclusion is NOT a homotopy equivalence.
        source = {(x, y, 0) for x in range(3) for y in range(3) if (x, y) != (1, 1)}
        new_ring = {(x, y, 0) for x in range(3, 6) for y in range(3) if (x, y) != (4, 1)}
        target = source | new_ring | {(1, 1, 0)}
        self.assertEqual((cubical_euler(source), cubical_euler(target)), (0, 0))
        with self.assertRaises(CompilerError) as error:
            prove_topology(source, target, ((-1, -1, -1), (6, 3, 1)))
        self.assertEqual(error.exception.code, "classification.topology-unproven")


if __name__ == "__main__":
    unittest.main()
