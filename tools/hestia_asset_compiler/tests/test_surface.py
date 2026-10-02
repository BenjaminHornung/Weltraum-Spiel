"""Independent C4 contact/address oracles; not a full compile claim."""

import copy
import random
import unittest
from fractions import Fraction
from unittest.mock import patch

from tools.hestia_asset_compiler.errors import CompilerError
from tools.hestia_asset_compiler.geometry import canonicalize_geometry
from tools.hestia_asset_compiler.glb import read_glb
from tools.hestia_asset_compiler.voxel import (
    Binding, brick_address, pack_bricks, triangle_box_overlap, voxelize_surface,
)
from glb_fixtures import box, fixture, glb, part

MICRO = "micro-0125-research-v1"
STANDARD = "standard-025-v1"


def bake(doc, binary):
    return canonicalize_geometry(read_glb(glb(doc, binary)))


def instances(count, high):
    doc, binary = fixture(*box((0, 0, 0), high))
    doc["nodes"] = [{"mesh": 0, "extras": {"hestia": part(f"part.{i:04d}")}} for i in range(count)]
    doc["scenes"][0]["nodes"] = list(range(count))
    return bake(doc, binary)


class SurfaceTests(unittest.TestCase):
    def test_sat_broadphase_is_not_overlap(self):
        triangle = ((0, 0, 0), (0, 1, 0), (0, 0, 1))
        self.assertFalse(triangle_box_overlap(triangle, (0, .75, .75), (.25, 1, 1)))
        self.assertTrue(triangle_box_overlap(triangle, (0, .25, .25), (.25, .5, .5)))

    def test_sat_inclusive_face_edge_vertex_and_dyadic_gap(self):
        triangle = ((0, 0, 0), (0, 1, 0), (0, 0, 1))
        for low, high in [((-1, 0, 0), (0, 1, 1)), ((0, 1, 0), (1, 2, 1)),
                          ((0, .5, .5), (1, 1, 1))]:
            with self.subTest(low=low):
                self.assertTrue(triangle_box_overlap(triangle, low, high))
        gap = Fraction(1, 2**80)
        self.assertFalse(triangle_box_overlap(triangle, (gap, 0, 0), (1, 1, 1)))
        self.assertTrue(triangle_box_overlap(triangle, (-gap, 0, 0), (gap, 1, 1)))
        self.assertFalse(triangle_box_overlap(triangle, (0, Fraction(1, 2) + gap, .5), (1, 1, 1)))

    def test_negative_floor_and_x_fastest(self):
        expected = [(-2, 15), (-1, 0), (-1, 15), (0, 0), (0, 15), (1, 0)]
        for i, oracle in zip((-17, -16, -1, 0, 15, 16), expected):
            coordinate, local, offset = brick_address((i, 0, 0))
            self.assertEqual((coordinate[0], local[0]), oracle)
            self.assertEqual(offset, local[0])
        self.assertEqual(brick_address((-1, -16, 16)), ((-1, -1, 1), (15, 0, 0), 15))
        self.assertEqual(brick_address((1, 2, 3))[2], 1 + 16*2 + 256*3)

    def test_surface_cube_full_boundary_sets_both_profiles(self):
        geometry = bake(*fixture(*box()))
        for profile, low, high in [(MICRO, -1, 8), (STANDARD, -1, 4)]:
            with self.subTest(profile=profile):
                result = voxelize_surface(geometry, profile)
                # Independent closed-box interval boundary: any axis touches a source face.
                expected = {(x, y, z) for x in range(low, high + 1) for y in range(low, high + 1)
                            for z in range(low, high + 1)
                            if any(v in (low, low + 1, high - 1, high) for v in (x, y, z))}
                self.assertEqual({cell for owner, cell in result.cells}, expected)
                self.assertEqual(result.domains["part.a"], ((low - 1,)*3, (high + 1,)*3))
                self.assertEqual(set(result.cells.values()), {Binding("render.a", "steel.a")})
                self.assertTrue(all(brick.part_id == "part.a" and len(brick.data) == 4096 for brick in result.bricks))
                self.assertEqual(sum(sum(value != 0 for value in b.data) for b in result.bricks), len(expected))

    def test_profile_required_and_nonfinite_sat_rejected(self):
        geometry = bake(*fixture(*box()))
        for profile in (None, "unknown", .125, True):
            with self.assertRaises(CompilerError) as error:
                voxelize_surface(geometry, profile)
            self.assertEqual(error.exception.code, "surface.profile")
        with self.assertRaises(CompilerError):
            triangle_box_overlap(((float("inf"), 0, 0), (0, 1, 0), (0, 0, 1)), (0, 0, 0), (1, 1, 1))

    def test_sparse_owned_bricks_no_collision_or_air_allocation(self):
        binding = Binding("render.a", "steel.a")
        entries = [("part.a", (-1, -16, 16), binding), ("part.b", (-1, -16, 16), binding)]
        bricks, slots = pack_bricks(entries)
        self.assertEqual(len(bricks), 2)
        self.assertNotEqual(bricks[0].key, bricks[1].key)
        self.assertTrue(all(b.coordinate == (-1, -1, 1) and b.data[15] == 1 and sum(b.data) == 1 for b in bricks))
        self.assertEqual(slots, (binding,))
        self.assertEqual(pack_bricks([]), ((), ()))
        full, mapping = pack_bricks([(f"part.{i}", (0, 0, 0), Binding(f"render.{i}", f"steel.{i}")) for i in range(255)])
        self.assertEqual(len(mapping), 255)
        self.assertEqual({b.data[0] for b in full}, set(range(1, 256)))
        with self.assertRaises(CompilerError) as error:
            pack_bricks(entries + entries[:1])
        self.assertEqual(error.exception.code, "surface.cell-collision")
        with self.assertRaises(CompilerError) as error:
            pack_bricks([(f"part.{i}", (0, 0, 0), Binding(f"render.{i}", f"steel.{i}")) for i in range(256)])
        self.assertEqual(error.exception.code, "surface.material-slots")

    def test_part_ownership_and_all_orderings(self):
        vertices, faces = box()
        doc, binary = fixture(vertices, faces)
        doc["nodes"].append({"mesh": 0, "translation": [-3, 0, 0], "extras": {"hestia": part("part.b")}})
        doc["scenes"][0]["nodes"] = [0, 1]
        doc["materials"].append({"extras": {"hestia": {"renderMaterialId": "render.unused"}}})
        first = voxelize_surface(bake(doc, binary), MICRO)
        variants = [list(reversed(faces)), faces.copy()]
        random.Random(20261002).shuffle(variants[1])
        for triangles in variants:
            changed, raw = fixture(vertices, triangles)
            changed["nodes"] = list(reversed(copy.deepcopy(doc["nodes"])))
            changed["scenes"][0]["nodes"] = [1, 0]
            changed["materials"] = list(reversed(copy.deepcopy(doc["materials"])))
            changed["meshes"][0]["primitives"][0]["material"] = 1
            result = voxelize_surface(bake(changed, raw), MICRO)
            self.assertEqual(result.cells, first.cells)
            self.assertEqual(result.bricks, first.bricks)
            self.assertEqual(result.material_slots, first.material_slots)
        owners = {b.part_id for b in first.bricks}
        self.assertEqual(owners, {"part.a", "part.b"})
        doc["accessors"][1]["count"] = 18
        doc["accessors"].append(dict(doc["accessors"][1], byteOffset=36))
        doc["meshes"][0]["primitives"].append({"attributes": {"POSITION": 0}, "indices": 2, "material": 0})
        doc["meshes"][0]["primitives"].reverse()
        self.assertEqual(voxelize_surface(bake(doc, binary), MICRO).bricks, first.bricks)

    def test_multimaterial_candidates_reject_not_first_last(self):
        doc, binary = fixture(*box())
        doc["materials"].append({"extras": {"hestia": {"renderMaterialId": "render.b", "structuralMaterialId": "steel.b"}}})
        doc["accessors"][1]["count"] = 18
        doc["accessors"].append(dict(doc["accessors"][1], byteOffset=36))
        doc["meshes"][0]["primitives"].append({"attributes": {"POSITION": 0}, "indices": 2, "material": 1})
        for order in range(2):
            with self.assertRaises(CompilerError) as error:
                voxelize_surface(bake(doc, binary), MICRO)
            self.assertEqual(error.exception.code, "surface.material-ambiguity")
            doc["meshes"][0]["primitives"].reverse()

    def test_budget_guards_before_any_cell_or_brick_allocation(self):
        cases = [(bake(*fixture(*box((0, 0, 0), (100, 100, 100)))), "budget.candidate_work"),
                 (instances(100, (8, 8, 8)), "budget.candidate_work"),
                 (instances(50, (4, 4, 4)), "budget.grid_cells"),
                 (instances(1025, (.125, .125, .125)), "budget.bricks")]
        doc, binary = fixture(*box((0, 0, 0), (.125, .125, .125)))
        doc["nodes"][0]["translation"] = [999999.875, 0, 0]
        cases.append((bake(doc, binary), "budget.grid_coordinate"))
        for geometry, code in cases:
            with self.subTest(code=code), patch("tools.hestia_asset_compiler.voxel.rasterize") as allocation, \
                    patch("tools.hestia_asset_compiler.voxel.pack_bricks") as packing:
                with self.assertRaises(CompilerError) as error:
                    voxelize_surface(geometry, MICRO)
                self.assertEqual(error.exception.code, code)
                allocation.assert_not_called()
                packing.assert_not_called()

    def test_budget_stats_aggregate_and_negative_domain(self):
        geometry = instances(3, (1, 1, 1))
        result = voxelize_surface(geometry, MICRO)
        self.assertEqual(result.stats["grid_cells"], 3 * 12**3)
        self.assertEqual(result.stats["flood_cells"], 3 * 12**3)
        self.assertEqual(result.stats["bricks"], 3 * 8)
        self.assertEqual(result.stats["output_bytes"], 3 * 8 * 4096)
        self.assertEqual(result.stats["candidate_work"], 3 * 12 * 2 * 10**2)
        doc, binary = fixture(*box((-3, -2, -1), (-2, -1, 0)))
        negative = voxelize_surface(bake(doc, binary), MICRO)
        self.assertTrue(all(cell[0] < 0 and cell[1] < 0 for owner, cell in negative.cells))


if __name__ == "__main__":
    unittest.main()
