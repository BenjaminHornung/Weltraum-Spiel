# Hestia FP06 — aktueller Review-Stand

**22. Oktober 2026: Der aktuelle Quellstand ist ein V7-Review-Zwischenstand.** Einstieg: [FP06_REVIEW_CURRENT.md](FP06_REVIEW_CURRENT.md). Die abschließende V7-Handmontage und Gesamt-Abnahme sind offen. Der folgende V4-Spielstand bleibt ein historisch geprüfter Ausgangspunkt; seine Abnahme gilt nicht automatisch für V7.

# Hestia FP06 V6 – geprüfter V4-Spielstand

Die externe Chrome-Sitzung ist im begehbaren Rumpf pausiert. Dort **Play** wählen. **WASD** bewegt, die Maus schaut um, **Esc** pausiert. **I** öffnet das vorhandene Inventar/Cargo mit freiem Mauszeiger; **E** öffnet es für erreichbare Fracht oder die getragene Ladung. Bei geschlossener Kiste zuerst **Open cargo**, danach **Pick up cargo**. **Close** setzt das Spiel nicht automatisch fort.

Die vollständige bezahlte Produktion aus frischen16kg und die neue5,8kg-Strebe sind abgeschlossen. Save19 enthält zehn Anlagen und2984,4kg Gesamtmaterial. Ein aktiver CUT und der abschließende Innenstand überlebten jeweils einen echten Chrome-Prozessneustart.

## Lokal starten

Aus `E:/DEV/Weltraum-Spiel/FP06-Ready-2026-10-21-v4/apps/weltraum-browser`:

```powershell
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5197 --strictPort
```

Der laufende Preview verwendet bereits diesen Port. Den vorhandenen externen Chrome nutzen oder denselben lokalen Browserstand wieder öffnen:

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --user-data-dir='E:\DEV\Weltraum-Spiel\FP06-V6-FullFlow-20261021-R78' 'http://127.0.0.1:5197/factory.html'
```

Bei neuem Start **Continue**, Bestätigung und ausdrücklich **Play** wählen. Ein anderer Browserprofilordner oder Port hat einen separaten lokalen Save. Browserprofile, Zugangsdaten und rohe Spielstände werden nicht mitgeliefert. V6 gilt für neue Spiele; bestehende V5-Stände bleiben V5.

## Nachweise und Grenze

`FP06_V6_GAMEPLAY_ACCEPTANCE.json` beschreibt die funktionale Abnahme, `DELIVERY_MANIFEST.json` bindet die Dateien. Der Ergebnisbericht liegt in `docs/factory/fp06/play/2026-10-19/walkable-hull/RESULTS_20261021.md`.

Die Bildrate ist weiterhin begrenzt: letzter ausgewählter aktiver Vergleich29,4179FPS, Ziel verfehlt; keine neue V6-FPS-Messung. Das begrenzte Performancefenster ist geschlossen. Nicht jede Innenfläche und keine lokale Hardware-/Spielspaßabnahme ist geprüft.
