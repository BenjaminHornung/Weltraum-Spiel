# Explizite Korrektur: REN12 darf schlechte Renderbilder nicht akzeptieren

## Quellenbefund

`reports/RD-11/PHASE2-HANDOFF.md` am Resumecheckpoint dokumentiert das originale 8/9-FAIL. Das gezielte Abschalten von Vertexfarben wird tatsächlich im nativen Bild sichtbar, aber die AO-ROI in 32²-Auflösung akzeptiert es: mittlerer RGB-Fehler ungefähr0,0332 bei0,035 und noch ausreichender Kontrast. Eine als Wasserprüfung benannte ROI liegt in der konkreten Ansicht über Bank/Hintergrund. Gute C1/C2-Differenzwerte allein validieren dieses Orakel nicht.

## Freigegebene neue Richtung

Erzeuge eine ausdrücklich benannte Nachfolgegeneration, z.B. REN12-v2, mit dokumentiertem Messgegenstand. Alte Ergebnisse, Bilder und originale v1-Konfigurationen bleiben als unveränderte historische Belege. Aktive Prüfdateien dürfen nach der neuen fachlichen Spec korrigiert werden; ein neuer v2-PASS darf nicht als rückwirkendes Bestehen des originalen v1-Laufs dargestellt werden.

## Schrittfolge

1. Exaktes altes Negativ mit altem Bild-/Kamerabinding einmal reproduzieren bzw. vorhandene native Rohbilder erneut auswerten. Unterschied tatsächlicher Rendererfehler versus blindes Orakel belegen.
2. ROIs anhand des jeweiligen Source-/Kamerapresets semantisch verorten. Wasser-ROI muss tatsächlich Wasser abdecken. Geometrie/Depth, AO/Vertexfarbe, Material/Transparenz und Beleuchtung nicht in ein einziges Vollbildmittel mischen.
3. Vor Kandidatenwertung feste Kontrollpopulation festlegen: richtige Wiederholungsbilder, zulässige Backendvariation, entfernte Vertexfarben/AO, fehlende Geometrie, falsche Ownerpose, falsche Wasser-/Opacityantwort und ein real verfügbarer Depthfehler. Kein angeblich nativer Fault, wenn nur ein JSON-Flag verändert wurde.
4. Messgrößen/Schwellen aus dieser Kontrollpopulation und dem jeweiligen Qualitätsvertrag begründen. Validierung mit zusätzlichem zuvor nicht verwendeten Gegenbeispiel. Nicht nur die eine fehlerhafte Aufnahme mit einem nachträglich gewählten Pixel aussortieren.
5. Native C0/C1/C2-Aufnahmen, Farbmanagement, Format, Alpha, MSAA und unbewiesene Dimensionen getrennt dokumentieren. Wo Readback fehlt: UNSUPPORTED, nicht perfekte Gleichheit behaupten.
6. Unabhängiger Reviewer prüft Sensitivität UND akzeptable positive Toleranz. Erst dann valide neue Vergleiche und Empfehlungen.

Keine geschwächten Grenzen, keine Referenzbilder aus dem Kandidaten automatisch als neue Goldens, kein Verschweigen des originalen FAIL und keine allgemeine ästhetische Abnahme durch diese Tests.
