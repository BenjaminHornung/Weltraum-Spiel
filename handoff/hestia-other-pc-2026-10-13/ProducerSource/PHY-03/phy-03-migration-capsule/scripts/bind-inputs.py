"""Bind assigned task sources; no extraction, mutation or broad user-data read."""
import hashlib
import json
from pathlib import Path
import zipfile

spike = Path(__file__).resolve().parent.parent
package = spike.parent.parent.parent.parent / "artifacts/hestia-cloud-orchestration-2026-10-09/Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09"
paths = ["00_START_HIER.md", "01_PRUEFUNG_UND_ENTSCHEIDUNG.md", "03_SCHNITTSTELLEN_UND_UEBERNAHME.md",
         "Cloud/00_GEMEINSAMER_VERTRAG.md", "Auftraege/PHY-03.md", "Goals/PHY-03.txt", "SOURCE_DOCS.json",
         "Quellen/hestia-konzeptpaket-review-und-arbeitspaket-registry-2026-10-09.md",
         "Quellen/hestia-dimforge-technologie-audit-handoff-2026-10-09.md"]
sha = lambda data: hashlib.sha256(data).hexdigest()
records = [{"path": path, "sha256": sha((package / path).read_bytes())} for path in paths]
archive = package / "Vorarbeiten/Hestia_Destruction_Gesamtpaket_Phase1_2_3_2026-10-07.zip"
with zipfile.ZipFile(archive) as source:
    members = [name for name in source.namelist() if name.endswith(("Korrigiert/Spezifikation.md",
               "Arbeitsauftraege/Phase_2_S1_S4.md", "Arbeitsauftraege/Phase_3_M1_M8.md"))]
    assert len(members) == 3
    records.extend({"archive": archive.name, "member": name, "sha256": sha(source.read(name))} for name in members)
result = {"task": "PHY-03", "sourceCommit": "17b1db4201a28e7b607c30707bdc2b75e3484a10",
          "executionOverride": "LOCAL_WINDOWS_ISOLATED", "nestedArchiveSha256": sha(archive.read_bytes()), "inputs": records}
(spike / "evidence/task-inputs.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": "PASS", "inputs": len(records)}))
