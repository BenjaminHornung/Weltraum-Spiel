# Factory-Startplatz v1 – angenommene Ownerentscheidung

Status: **ACCEPTED_BY_USER / noch nicht implementiert**. Tatsächliche Antwort „Startplatz-Fixture freigeben“, dokumentiert am 2026-10-11 um 10:34:17 UTC; vollständige Frage/Antwort im Source-Lock. W07 benötigt weiterhin bestandene W02/W05/W06-Gates und einen exakten Integratorgrant. Gate D07_START_SITE_PROFILE betrifft ausschließlich neue Startplatz-/Vegetations-/Profilanteile. W07-Nativetransaktion und einzelne Cutterplatzierung dürfen auf tatsächlich geprüftem bestehendem v5-Support weiterlaufen; W01/Material/Assets/Host sind unabhängig. Ein vollständiger W09-Kreislauf braucht weiterhin tatsächlichen Gesamt-Support.

Die aktuelle Coast-v5-Quelle bietet trockene rotierte Teilflächen. Der konkret untersuchte Formerfootprint hat dennoch 2,75 m Relief; ein vollständiger gemeinsamer Port-/Fußsupport ist unbewiesen. FP03 fordert echte Bodenkontakte und unterscheidet leichte Nivellierung von bezahlten Stützen/Erdarbeiten. Die vorhandenen Quellen legen keine zulässige Fußverstellung für dieses Relief fest. Trockenheit allein ist kein Build-PASS.

Der konkrete Vorschlag initialisiert **nur /factory.html** aus einer separaten Fixture `hvp-factory-startsite-v1`, Seed `hestia-factory-layout-a-001`, mit Coast-v5/b8fde6b0 als dokumentierter Elternquelle. Terraincoverage bleibt x/z[-16,16), y[-8,8), mit echten 125-mm-Zellen und unveränderten globalen Budgets. Das 250-mm-Bauraster bleibt separat.

Die Vereinigung folgender15 halboffenen Rechtecke in Metern des freigegebenen Layout-A-Frames erhält anfänglichen trockenen Kalkstein bis Top1,5m; alle anderen Terrainzellen bleiben gleich:

| Maske | east min/max | north min/max |
|---|---|---|
| Rohcontainer |0 / 2|5 / 7|
| Cutter |6 / 9|5 / 7|
| Former |13 / 17|4,5 / 7,5|
| Fertigcontainer |17 / 19|5 / 7|
| Werkbank |6 / 8|1,5 / 2,5|
| Rohband |2 / 6|5,5 / 6,5|
| Halbzeugband |9 / 13|5,5 / 6,5|
| Verteiler |9 / 11|9,5 / 10,5|
| Cutterservice |6 / 9|7 / 8|
| Formerservice |13 / 17|7,5 / 8,5|
| Bankservice |6 / 8|2,5 / 3,5|
| Rohcontainerservice |0 / 2|4 / 5|
| Fertigcontainerservice |17 / 19|4 / 5|
| Verteilerservice |9 / 11|8,5 / 9,5|
| Zugang |0 / 19|3,5 / 4,5|

Transformation: world.x=-12,25+north; world.z=12,5-east. Union70m²/4480 Spalten; Boundingbox x[-10,75,-1,75),z[-6,5,12,5) wird nicht pauschal nivelliert. Source-Spalten besitzen Slots iy0..75=Kalkstein1, iy76..127=Air0. Es handelt sich um andere initiale Geologie, keine kostenlose gebaute Plattform oder Terraformingaktion. Ein explizites Factory-Vegetationsmanifest lässt die beiden kollidierenden anfänglichen Woodowner west-frame/north-young weg; es entstehen keine Ernte-/Holzgutschriften.

Die Quelleninspektion zählt27759 geänderte Zellen gegenüber v5:23116 entfernte Solidzellen,3934 neue Solidzellen,709 Materialslotwechsel; netto37,46484375m³ weniger anfänglicher Feststoff. **Inventar, Cargo C01–C28, Produktionsmaterial und Miningreceipts erhalten dafür null Gutschrift.** Materialerhaltung beginnt an der neuen ausdrücklich versionierten Terrainbaseline; Dichten bleiben vorhandene unapproved prototype tuning. Eigene Seed/Header/Digest/Registry-/Vegetationsbindung im gemeinsamen Save, Cross-Profile-Load abweisen. Normale Coast-/Flight-/Legacyprofile unverändert.

Der Vorschlag genehmigt weder Terrainänderungen im Gameplay noch W13-Bergbau, freie 3-m-Stützen, ungeprüften Support oder zusätzliche Sourceflächen. Physischer Körper-/Fuß-/Port-/Kollisions-/Zugangsnachweis und tatsächliche Playerbedienung bleiben W07/W09/W11-Gates. Wind-/PV-Aufstellflächen außerhalb dieser Masken brauchen unverändert eigene tatsächliche Source-/Nativeadmission. Weitere Anfangsflächen oder Vegetationsänderungen erfordern eine konkrete Ergänzung.

Technische Folgeschritte nach Ownerannahme: eng gelockter Sourceprofiladapter in hvpCoastSource.ts; neue Factory-StartSite-Daten/Fixturetests; optional sourcegebundene Vegetation-/Spawnreader im vorhandenen HVP-Host; Entry wählt nur diese Fixture; W10 separater Combinedcodec bindet vollständig dieselbe Rootbase. Kein Enginewechsel, keine generische World-API, keine Budget-/Timeout-/Queueerhöhung und kein stilles Aufweichen geschlossener Legacydecoders. Geplante Pfade sind noch keine Schreibfreigaben.

Read-only Faktenbericht: /workspace/.cloud-setup/fp06-w06-w07-preflight.md (§3), tatsächliche Analyse /root/w00_architecture. Keine Testausführung oder Runtime-Evidence für diesen Vorschlag behauptet.
