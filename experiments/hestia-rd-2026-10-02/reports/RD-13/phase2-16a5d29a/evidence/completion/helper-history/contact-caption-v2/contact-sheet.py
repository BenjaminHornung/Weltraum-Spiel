"""Derived-only contact sheet. Raw compositor captures are never re-encoded."""
import hashlib
import json
import pathlib
import sys
import importlib.util

ROOT = pathlib.Path(__file__).resolve().parent
assert str(ROOT).lower().startswith('c:\\ifi_sourcecode\\')
HELPERS = pathlib.Path('C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/phase2-16a5d29a-20261004-a/python-helpers')
sys.path.insert(0, str(HELPERS))
assert str(pathlib.Path(importlib.util.find_spec('PIL').origin).resolve()).lower().startswith(str(HELPERS).lower())
import PIL
from PIL import Image, ImageDraw, ImageFont

assert str(pathlib.Path(PIL.__file__).resolve()).lower().startswith('c:\\ifi_sourcecode\\')
index_bytes = (ROOT / 'index.json').read_bytes()
index = json.loads(index_bytes)
assert index['sourceExecuted'] == '16a5d29a5cddea372abae139da618aa000a058be'
output = ROOT / 'contact-sheet.png'
proof = ROOT / 'contact-sheet-proof.json'
assert not output.exists() and not proof.exists(), 'Write-once derived outputs'
entries = index['entries']
cell_w, cell_h, columns = 650, 555, 3
sheet = Image.new('RGB', (columns * cell_w, 90 + ((len(entries) + 2) // 3) * cell_h), '#10171c')
draw = ImageDraw.Draw(sheet)
font = ImageFont.load_default(size=15)
draw.text((12, 12), 'RD13 FUNCTIONAL DIAGNOSTIC: native ray FAIL / greedy controls observed', fill='white', font=font)
draw.text((12, 36), 'DERIVED INDEX ONLY. Raw PNGs unchanged. No native hit/depth-buffer, GPU timing or VRAM proof.', fill='#ffc17c', font=font)
inputs = []
for i, entry in enumerate(entries):
    x, y = (i % columns) * cell_w + 10, 90 + (i // columns) * cell_h
    ref = entry['ui']
    source = (ROOT / ref['path']).resolve()
    assert source.is_relative_to(ROOT) and not source.is_symlink()
    raw = source.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == ref['sha256'] and len(raw) == ref['bytes']
    with Image.open(source) as image:
        assert image.format == 'PNG' and image.size == (ref['width'], ref['height'])
        inputs.append({'path': ref['path'], 'sha256': ref['sha256'], 'bytes': ref['bytes'], 'width': image.width, 'height': image.height})
        thumb = image.convert('RGB')
        thumb.thumbnail((630, 443), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y + 98))
    label = ('RENDER SUBMITTED / not ray acceptance' if entry['actualSubmission'] else 'FAIL / HIDDEN / no canvas buffer claim')
    draw.text((x, y), entry['id'], fill='white', font=font)
    draw.text((x, y + 22), label, fill='#8bdba1' if entry['actualSubmission'] else '#ffc17c', font=font)
    draw.text((x, y + 44), f"requested={entry['requestedTick']} selected={entry['actualSelectedTick']} rendered={entry['actualRenderedTick']}", fill='white', font=font)
    draw.text((x, y + 66), f"camera={entry['cameraId']} rendererDPR={entry['rendererDpr']} browserDPR={entry['browserDpr']}", fill='white', font=font)
sheet.save(output, format='PNG')
result = {'schema': 'rd13-derived-contact-sheet-v1', 'authority': 'Visualization derived only from index.json; NOT additional native capture',
          'indexSha256': hashlib.sha256(index_bytes).hexdigest(), 'inputs': inputs, 'output': {'path': output.name, 'bytes': output.stat().st_size,
          'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'width': sheet.width, 'height': sheet.height},
          'helperSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(), 'python': sys.version, 'pillowVersion': PIL.__version__,
          'pythonExecutable': {'path': sys.executable, 'sha256': hashlib.sha256(pathlib.Path(sys.executable).read_bytes()).hexdigest()},
          'rawInputsUnchanged': all(hashlib.sha256((ROOT / r['path']).read_bytes()).hexdigest() == r['sha256'] for r in inputs), 'productIntegrated': False}
proof.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(f'RD13_DERIVED_CONTACT_SHEET {sheet.width}x{sheet.height} inputs={len(inputs)} raw PNGs unchanged')
