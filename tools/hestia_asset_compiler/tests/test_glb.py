import copy
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch

from glb_fixtures import fixture, glb, part
from tools.hestia_asset_compiler.errors import CompilerError
from tools.hestia_asset_compiler.glb import load_glb, read_glb, read_report, strict_json
from tools.hestia_asset_compiler.profiles import BUDGETS, PROFILES, check_budget, check_grid


class ReaderTests(unittest.TestCase):
    def reject(self, code, document=None, binary=None, raw=None):
        if document is None:
            document, binary = fixture()
        with self.assertRaises(CompilerError) as caught:
            read_glb(raw if raw is not None else glb(document, binary))
        self.assertEqual(code, caught.exception.code)

    def test_fixture_repeatability_and_profiles(self):
        doc, binary = fixture()
        self.assertEqual(glb(doc, binary), glb(*fixture()))
        parsed = read_glb(glb(doc, binary))
        self.assertEqual(parsed.primitives[0][0].positions, ((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)))
        self.assertEqual(parsed.primitives[0][0].indices, (0, 1, 2))
        self.assertEqual(tuple(PROFILES.values()), (0.125, 0.25))

    def test_header_and_chunks_negative(self):
        valid = glb(*fixture())
        cases = [b"", b"xxxx" + valid[4:], valid[:4] + struct.pack("<I", 1) + valid[8:],
                 valid[:-1], valid + b"1234", valid[:12] + struct.pack("<II", 3, 0x4E4F534A) + valid[20:]]
        for raw in cases:
            with self.subTest(raw=raw[:20]):
                self.reject("glb.container", raw=raw)
        self.reject("glb.container", raw=valid[:16] + struct.pack("<I", 0x004E4942) + valid[20:])
        self.reject("glb.container", raw=valid[:16] + struct.pack("<I", 1234) + valid[20:])
        first_length = struct.unpack_from("<I", valid, 12)[0]
        second = 20 + first_length
        self.reject("glb.container", raw=valid[:second + 4] + struct.pack("<I", 0x4E4F534A) + valid[second + 8:])

    def test_json_before_decode(self):
        for raw, code in [(b'{"a":1,"a":2}', "json.duplicate-key"), (b'{"a":NaN}', "json.number"),
                          (b'{"a":1e999}', "json.number"), (b'"\xff"', "json.syntax"),
                          (b"[" * 65 + b"0" + b"]" * 65, "budget.json_depth"), (b'{"a":}', "json.syntax")]:
            with self.subTest(raw=raw[:30]), self.assertRaises(CompilerError) as caught:
                strict_json(raw)
            self.assertEqual(code, caught.exception.code)
        self.assertEqual(strict_json(b'{"s":"[\\\"{]"}'), {"s": '["{]'})

    def test_all_numeric_budget_boundaries(self):
        for name, limit in BUDGETS.items():
            with self.subTest(name=name):
                check_budget(name, limit)
                with self.assertRaises(CompilerError) as caught:
                    check_budget(name, limit + 1)
                self.assertEqual("budget." + name, caught.exception.code)
                with self.assertRaises(CompilerError):
                    check_budget(name, True)
        self.assertEqual(check_grid((-2, -2, -2), (9, 9, 9)), 1728)
        for lo, hi, code in [((0, 0, 0), (8000001, 0, 0), "budget.grid_coordinate"),
                             ((0, 0, 0), (200, 200, 200), "budget.grid_cells")]:
            with self.assertRaises(CompilerError) as caught:
                check_grid(lo, hi)
            self.assertEqual(code, caught.exception.code)

    def test_preread_file_and_report_caps(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "big.glb"
            with path.open("wb") as stream:
                stream.truncate(BUDGETS["glb_bytes"] + 1)
            with patch.object(Path, "read_bytes", side_effect=AssertionError("must not read")):
                with self.assertRaises(CompilerError) as caught:
                    load_glb(path)
            self.assertEqual(caught.exception.code, "budget.glb_bytes")
            with path.open("wb") as stream:
                stream.truncate(BUDGETS["report_bytes"] + 1)
            with self.assertRaises(CompilerError) as caught:
                read_report(path)
            self.assertEqual(caught.exception.code, "budget.report_bytes")
            path.write_bytes(b'{"payload":{},"digests":{}}')
            self.assertEqual(read_report(path)[0], {"payload": {}, "digests": {}})

    def test_bin_padding_and_buffer_boundary(self):
        doc, binary = fixture(index_type=5121)
        read_glb(glb(doc, binary))  # one byte alignment slack
        for length in [len(binary) - 4, len(binary) + 4]:
            bad = copy.deepcopy(doc)
            bad["buffers"][0]["byteLength"] = length
            self.reject("glb.buffer", bad, binary)
        doc["bufferViews"][1]["byteLength"] += 1
        self.reject("glb.buffer-view", doc, binary)

    def test_accessor_stride_offset_and_range(self):
        doc, binary = fixture(stride=16)
        read_glb(glb(doc, binary))
        # Offset 4 is legal with this stride; offset 8 exceeds the exact last access.
        shifted = copy.deepcopy(doc)
        shifted["accessors"][0]["byteOffset"] = 4
        read_glb(glb(shifted, binary))
        for field, value in [("byteOffset", 8), ("count", 4), ("count", True), ("componentType", 5125), ("type", "VEC2")]:
            bad = copy.deepcopy(doc)
            bad["accessors"][0][field] = value
            self.reject("glb.accessor", bad, binary)
        for stride in [8, 13, 256]:
            bad = copy.deepcopy(doc)
            bad["bufferViews"][0]["byteStride"] = stride
            self.reject("glb.accessor", bad, binary)
        doc["accessors"][0]["sparse"] = {}
        self.reject("glb.unsupported", doc, binary)

    def test_indices_unsigned_sentinels_and_oob(self):
        for component in [5121, 5123, 5125]:
            doc, binary = fixture(index_type=component)
            read_glb(glb(doc, binary))
            maximum = {5121: 255, 5123: 65535, 5125: 4294967295}[component]
            doc, binary = fixture(faces=[(0, 1, maximum)], index_type=component)
            self.reject("glb.indices", doc, binary)
        doc, binary = fixture(faces=[(0, 1, 3)])
        self.reject("glb.indices", doc, binary)
        doc, binary = fixture()
        doc["accessors"][1]["normalized"] = True
        self.reject("glb.accessor", doc, binary)
        doc["accessors"][1]["normalized"] = False
        doc["bufferViews"][1]["byteStride"] = 4
        self.reject("glb.accessor", doc, binary)

    def test_binary_nonfinite_and_normal_tangent(self):
        for value in [float("inf"), float("nan")]:
            doc, binary = fixture(vertices=[(value, 0, 0), (1, 0, 0), (0, 1, 0)])
            self.reject("glb.nonfinite", doc, binary)
        doc, binary = fixture()
        doc["meshes"][0]["primitives"][0]["attributes"]["NORMAL"] = 0
        read_glb(glb(doc, binary))
        doc["meshes"][0]["primitives"][0]["attributes"]["TANGENT"] = 0
        self.reject("glb.accessor", doc, binary)

    def test_unsupported_failclosed(self):
        base, binary = fixture()
        changes = [{"extensionsRequired": ["UNKNOWN"]}, {"extensionsUsed": ["KHR_draco_mesh_compression"]},
                   {"animations": []}, {"skins": []}]
        for change in changes:
            doc = copy.deepcopy(base)
            doc.update(change)
            self.reject("glb.unsupported", doc, binary)
        for field, value in [("mode", 1), ("targets", []), ("extensions", {"EXT_mesh_gpu_instancing": {}})]:
            doc = copy.deepcopy(base)
            doc["meshes"][0]["primitives"][0][field] = value
            self.reject("glb.unsupported", doc, binary)
        for uri in ["https://example.invalid/x", "file:///x", "data:application/octet-stream;base64,AA=="]:
            doc = copy.deepcopy(base)
            doc["buffers"][0]["uri"] = uri
            self.reject("glb.unsupported", doc, binary)

    def test_graph_and_instancing(self):
        base, binary = fixture()
        doc = copy.deepcopy(base)
        doc["nodes"].append({"mesh": 0, "extras": {"hestia": part("part.b")}})
        doc["scenes"][0]["nodes"] = [0, 1]
        self.assertEqual(len(read_glb(glb(doc, binary)).reachable), 2)
        for nodes, roots in [([{"children": [0]}], [0]), ([{"children": [1, 1]}, {}], [0]),
                             ([{"children": [2]}, {"children": [2]}, {}], [0, 1]),
                             ([{"children": [1]}, {}], [0, 1]), ([{}], [0, 0])]:
            bad = copy.deepcopy(base)
            bad["nodes"] = nodes
            bad["scenes"][0]["nodes"] = roots
            self.reject("glb.graph", bad, binary)
        doc = copy.deepcopy(base)
        doc["nodes"] = [{"children": [i + 1]} for i in range(64)] + [{}]
        self.reject("budget.graph_depth", doc, binary)

    def test_owned_mesh_exact_extras_and_material(self):
        for mutate in [lambda d: d["nodes"][0].pop("extras"),
                       lambda d: d["materials"][0].pop("extras"),
                       lambda d: d["nodes"][0]["extras"]["hestia"].update(partId=" BAD"),
                       lambda d: d["nodes"][0]["extras"]["hestia"].update(unknown=True),
                       lambda d: d["asset"]["extras"]["hestia"].update(metersPerUnit=True)]:
            doc, binary = fixture()
            mutate(doc)
            self.reject("glb.semantics", doc, binary)

    def test_embedded_render_data_and_external_image(self):
        doc, binary = fixture()
        doc["images"] = [{"bufferView": 0, "mimeType": "image/png"}]
        doc["samplers"] = [{"wrapS": 10497, "magFilter": 9729}]
        doc["textures"] = [{"source": 0, "sampler": 0}]
        doc["materials"][0]["pbrMetallicRoughness"] = {"baseColorFactor": [1, 1, 1, 1], "baseColorTexture": {"index": 0}}
        read_glb(glb(doc, binary))
        doc["images"][0]["uri"] = "https://example.invalid/image.png"
        self.reject("glb.unsupported", doc, binary)

    def test_counts_and_instance_cap_before_binary_decode(self):
        doc, binary = fixture(faces=[(0, 1, 2)] * 10001)
        doc["nodes"].append({"mesh": 0, "extras": {"hestia": part("part.b")}})
        doc["scenes"][0]["nodes"] = [0, 1]
        unpack = struct.unpack_from

        def headers_only(fmt, *args):
            if fmt not in ("<4sII", "<II"):
                raise AssertionError("expanded budget must reject before binary decode")
            return unpack(fmt, *args)

        with patch("tools.hestia_asset_compiler.glb.struct.unpack_from", side_effect=headers_only):
            self.reject("budget.instance_triangles", doc, binary)
        doc, binary = fixture()
        doc["accessors"][0]["count"] = BUDGETS["accessor_elements"] + 1
        self.reject("budget.accessor_elements", doc, binary)
        doc["accessors"][0]["count"] = 3
        doc["nodes"] = [{}] * (BUDGETS["nodes"] + 1)
        self.reject("budget.nodes", doc, binary)

    def test_malformed_shapes_always_stable_rejection(self):
        for mutate in [lambda d: d.update(nodes=[None]), lambda d: d.update(meshes=[None]),
                       lambda d: d["meshes"][0].update(primitives=[None]),
                       lambda d: d["accessors"][0].update(type=[]),
                       lambda d: d["bufferViews"][0].update(byteLength=True),
                       lambda d: d["nodes"][0].update(children=[False]),
                       lambda d: d["asset"]["extras"]["hestia"].update(assetRevision=True)]:
            doc, binary = fixture()
            mutate(doc)
            with self.subTest(doc=doc), self.assertRaises(CompilerError):
                read_glb(glb(doc, binary))

    def test_uv_pbr_extension_and_semantic_references(self):
        doc, binary = fixture()
        doc["materials"][0]["extensions"] = {"KHR_materials_unlit": {}}
        doc["extensionsRequired"] = ["KHR_materials_unlit"]
        read_glb(glb(doc, binary))
        doc["materials"][0]["extensions"]["KHR_materials_unlit"] = {"unknown": True}
        self.reject("glb.render", doc, binary)
        doc, binary = fixture()
        doc["nodes"][0]["extras"]["hestia"]["parentPartId"] = "part.missing"
        self.reject("glb.semantics", doc, binary)
        doc["nodes"][0]["extras"]["hestia"]["parentPartId"] = "part.a"
        self.reject("glb.semantics", doc, binary)

    def test_actual_uv_tangent_color_accessors(self):
        doc, binary = fixture()
        binary += b"\0" * (-len(binary) % 4)
        for name, width in [("TEXCOORD_0", 2), ("TANGENT", 4), ("COLOR_0", 4)]:
            start = len(binary)
            binary += struct.pack("<" + "f" * (width * 3), *([0.5] * (width * 3)))
            doc["bufferViews"].append({"buffer": 0, "byteOffset": start, "byteLength": width * 12})
            doc["accessors"].append({"bufferView": len(doc["bufferViews"]) - 1, "componentType": 5126, "count": 3, "type": "VEC" + str(width)})
            doc["meshes"][0]["primitives"][0]["attributes"][name] = len(doc["accessors"]) - 1
        doc["buffers"][0]["byteLength"] = len(binary)
        read_glb(glb(doc, binary))
        tangent = doc["bufferViews"][3]["byteOffset"]
        binary = binary[:tangent] + struct.pack("<f", float("inf")) + binary[tangent + 4:]
        self.reject("glb.nonfinite", doc, binary)


if __name__ == "__main__":
    unittest.main()
