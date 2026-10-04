import unittest
from unittest.mock import MagicMock
from tools.hestia_asset_compiler.review_demo import decoded_cells, visible_faces


class ReviewDemoTests(unittest.TestCase):
    def test_decode_real_x_fastest_negative_brick_offsets(self):
        raw = bytearray(4096)
        raw[15] = 1
        raw[16 + 256] = 2
        directory = MagicMock()
        (directory / "brick.bin").read_bytes.return_value = bytes(raw)
        manifest = {"bricks": [{"path": "brick.bin", "coordinate": [-1, -1, 1]}]}
        self.assertEqual(decoded_cells(directory, manifest), {(-1, -16, 16), (-16, -15, 17)})

    def test_camera_faces_and_adjacent_cell_occlusion(self):
        self.assertEqual(len(list(visible_faces({(-1, -1, -1)}))), 3)
        faces = list(visible_faces({(-1, -1, -1), (0, -1, -1)}))
        self.assertEqual(len(faces), 5)
        self.assertEqual(sum(axis == 0 for axis, _ in faces), 1)
        self.assertEqual(list(visible_faces(set())), [])


if __name__ == "__main__":
    unittest.main()
