"""Independent offline Q16 oracle: Python Decimal, 80 significant digits. No candidate import."""
import json
from decimal import Decimal, getcontext, ROUND_HALF_UP
from pathlib import Path

getcontext().prec = 80
scale = Decimal(65536)
inputs = [0, 1, 2, 127, 1024, 8191, 16384, 21845, 32767, 32768, 32769, 43691, 49152, 65534, 65535, 65536]
rows = []
for n in inputs:
    x = Decimal(n) / scale
    value = 3*x*x - 2*x*x*x
    rows.append({"inputQ16": n, "exactDecimal": str(value), "expectedQ16": int((value*scale).to_integral_value(rounding=ROUND_HALF_UP))})
output = Path(__file__).resolve().parent.parent / "fixtures" / "smoothstep-goldens.json"
output.parent.mkdir(parents=True, exist_ok=True)
data = {"oracle": "Python Decimal precision80, 3*x*x-2*x*x*x; ROUND_HALF_UP", "domain": [0, 65536], "absoluteErrorBound": "1/131072", "vectors": rows}
output.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
print(f"Offline Decimal goldens: {len(rows)}")
