import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path("reports/RD-01/resume-2026-10-05/media")
receipt = json.loads((root / "retrieval-receipt.json").read_text(encoding="utf-8"))
rows = []
for item in receipt["rows"]:
    file = Path(item["outputPath"])
    data = file.read_bytes()
    with Image.open(file) as image:
        image.verify()
    with Image.open(file) as image:
        image.load()
        assert image.format == "PNG" and image.size == (item["width"], item["height"])
        assert len(data) == item["payloadBytes"] and hashlib.sha256(data).hexdigest() == item["payloadSha256"]
        rows.append({"id": item["id"], "sha256": item["payloadSha256"], "bytes": len(data),
                     "format": image.format, "dimensions": list(image.size), "wholeImageDecode": "PASS"})
assert len(rows) == 5
output = root / "decode-receipt.json"
with output.open("x", encoding="utf-8") as stream:
    json.dump({"decoded": len(rows), "rows": rows, "productIntegrated": False}, stream, indent=2)
print(json.dumps({"decoded": len(rows), "output": str(output)}))
