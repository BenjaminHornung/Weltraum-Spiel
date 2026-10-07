"""Read-only full-resolution RGBA/semantic RGB comparisons; no resampling/editing."""
import hashlib
import json
import pathlib
from PIL import Image, ImageChops, ImageStat

ROOT = pathlib.Path(__file__).resolve().parent


def compare(first, second):
    with Image.open(first) as opened_a, Image.open(second) as opened_b:
        opened_a.load()
        opened_b.load()
        a, b = opened_a.convert("RGBA"), opened_b.convert("RGBA")
        assert a.size == b.size, "Different native PNG dimensions"
        delta = ImageChops.difference(a, b)
        stats = ImageStat.Stat(delta)
        return {"first": str(first.relative_to(ROOT)), "second": str(second.relative_to(ROOT)),
                "dimensions": a.size, "rgbaByteExact": a.tobytes() == b.tobytes(),
                "meanRgbError": sum(stats.mean[:3]) / (3 * 255),
                "maxRgbErrorByte": max(extent[1] for extent in stats.extrema[:3]),
                "alphaByteExact": delta.getchannel("A").getextrema()[1] == 0,
                "firstSha256": hashlib.sha256(first.read_bytes()).hexdigest(),
                "secondSha256": hashlib.sha256(second.read_bytes()).hexdigest()}


if __name__ == "__main__":
    result = {"combined": compare(ROOT / "runs/combined-control-direction-timing-02/same-tick-color.png",
                                  ROOT / "runs/combined-candidate-direction-timing-02/same-tick-color.png"),
              "rays": [compare(ROOT / ("runs/ray-candidate-native-01/" + fixture + "-greedy-no-ao.png"),
                               ROOT / ("runs/ray-candidate-native-01/" + fixture + "-rays-no-ao.png"))
                       for fixture in ["F00-CONTROL-REPLAY", "F01-HVP-COAST-REPLAY"]],
              "method": "Actual full decoded PNG pixels, no resampling; comparisons are observations, not a newly invented parity threshold.",
              "productIntegrated": False}
    output = ROOT / "runs/native-image-comparisons-01.json"
    with output.open("x", encoding="utf-8") as target:
        json.dump(result, target, indent=2)
    print(json.dumps(result))
