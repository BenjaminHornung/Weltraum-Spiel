# W09 geschlossene Handlingprofile — technischer READONLY-Vorschlag

2026-10-11, `/root/fp06_domain`. Basis: Vorschlag `c959234…`, unabhängiger Sourcereview `ea289a0…`, Sourcepreflight `eb0635…`, unveränderte FP01§5.5/FP02§§6.2–6.5/8.7 und W01-BOMs. **Keine Profilfreigabe/Implementation; W07 blockiert, sämtliche neuen Nativegates NOT_RUN.**

## Geschlossene Payloads

Profilversion `fp06-handling-s0-v1` vorgeschlagen. Jeder Eintrag bindet exakte Jobterms, Itemversionen/Digests, Sourcecontainer-/Stack-/Instance-IDs; Teilentnahme nur echte Bulkchildren. Ganze C26/C27 bleiben Pieces. Kapazitäten sind ganze mg/mm³, rationale Aufnahme bleibt exakt; Tabellenvolumina sind aufgerundete Kapazitätsgrenzen, keine Änderung der Packvolumina.

| Profil / einzig erlaubte Payload | Masse kg | Kapazität mm³ | technische Box E×N×H mm |
|---|---:|---:|---|
| C26-PACK / ein C26 | 180 | 800000000 | 1000×1000×1000 |
| B06-BOM / vollständige eingefrorene BOM | 208 | 873583334 | 1000×1000×1000 |
| C27-PACK / ein C27 | 300 | 1400000000 | 1000×1500×1000 |
| B07-BOM / vollständige eingefrorene BOM | 341 | 1496916667 | 1000×1500×1000 |
| WIND-PACK / ein C01 | 350 | 1400000000 | 1000×1500×1000 |
| PREFAB / genau ein C02,C03,C04,C05,C08 oder C09 | 80/50/25/40/60/12 | 280/100/80/200/420/70 Millionen | 1000×1000×1000 |
| BELT4 / vier C14 + ein C23 | 26 | 140000000 | 1000×1000×1000 |
| CABLE40 / exakt 40000mm C07 | 10 | 120000000 | 1000×1000×1000 |
| RAW8 / 8000000mg Stahl | 8 | 5000000 | 500×500×1000 |
| MONTAGE / 4000000mg Profile + 2000000mg Blech | 6 | 11666667 | 500×500×1000 |
| BRACE / ein neues REC05-Produkt | 5.8 | 13050000 | 500×500×1000 |

PREFAB expandiert zu sechs separaten unveränderlichen Profilen, keine freie Auswahl/Mengenkapazität. Geschlossene Metadaten: profileId/version, exakte terms, quantityBasis/massMg/volumeRationals, box/supports/offset/yaw/snap/supportPolicy, SourceRefs/fullcanonicalBytes; unbekannte Keys/Items/Mengen oder abweichende Bindungen rejecten. Bezahlte C09 werden separat transportiert/verbraucht, falls die eingefrorene Installation sie benötigt. C28/Bio/Bergbau sind ausgeschlossen. Bekannt sind **aufgebaute** B06-Maße3×2×2.5m/B07-Maße4×3×3m; verpackte Abmessungen/COM fehlen. Alle obigen Boxen sind ausdrücklich technische S0-Proxies. Gestell/Verpackung bleibt Teil der vorhandenen Packmasse, kein neues Item/Geld-/Materialguthaben.

## Native Carrier/Depot

Ein Slot, ein Owner/Body, fünf Collider: Payloadboden250mm über Bodennull; vier125×250×125mm-Auflageboxen mit Zentren E/N jeweils±250mm, bei Lightprofilen±62.5mm. Bodenpatches125×125mm benötigen vollständige bekannte Solidauflage, Höhenabweichung≤2mm/Normale.y≥0.9. Zusätzlich gesamte Hülle/Coverage einschließlich Auto-Step/Rotation prüfen, bevor Capsule **und** Carrierpose gemeinsam fortschreiten; ausschließlich eigener Player/Carrier ausgeschlossen, andere kinematische Hindernisse bleiben relevant.

S0-Tutorialyaw `quarterTurns=1`, während Carry unverändert. Offset relativ bestätigten Playerfüßen: E+1000mm, Light+750mm; Nativeground bestimmt Y. Depot benutzt denselben Owner fixed, aktuellen Standort,250mm-X/Z-Snap≤125mm je Achse, geprüften Snap-Sweep und identische Bodenhöhe≤2mm. Keine beliebigen UI-Anker/Actorposen. Aufnahme/lokaler Transfer: offener nativer Owner, Rechte, frische Revisionen, echte LOS, Sourceaccess≤4m; Montage zusätzlich bestätigte freie1m-Servicezone, Abstand≤3m. Diese Zahlen übernehmen bestehende Placementgrenzen als technische Handlingpolicy; W04 übernimmt ausschließlich Hostfacts, keinen UI-Reichweitenbeleg.

## Konkreter Normalflowkandidat

Runtime `(x,z)`, Boden1.5m, bestehende D07-Masken: **vor** Rohlager/B05/Formeraufbau Pickup-Player(-5.75,11.875), Carrier(-5.75,10.875); normale Inputs über(-8.25,11.875)→(-8.25,-1.5)→(-6.25,-1.5), Depot(-6.25,-2.5). Auflagepatches bleiben in Rawmask/Service/Gang/Formerbauplatz; Cutterkörper hat mindestens0.25m rechnerischen Abstand. Der spätere Former blockiert diesen breiten Weg. Bei Aufbau müssen genau die verbrauchten Depotcollider atomar deaktiviert/übergeben werden; keine pauschale Kollisionsausnahme/zusätzliche Ownerreserve.

Nach zwei tatsächlichen CUT/FORM-Batches: neue4kg-Profile/2kg-Blech am Produktlager aufnehmen, Player(-8.25,-4.25) entlang Gang zu(-8.25,5), Lightdepot(-8.25,4.25), lokale B05-Montage und anschließende BRACE-Aufnahme. Native BRACE-Platzierung/Verwendung braucht separat sourcegebundenes Installationsprofil; Aufnahme allein beweist keine Nutzbarkeit. Native Service-/LOS-/kombinierte Hullprüfung bleibt erforderlich; diese BBoxrechnung ist kein befahrener Wegnachweis.

## Masse, Persistenz, echte nächste REDs

Pinned Rapier bietet `setAdditionalMassProperties`, `recomputeMassPropertiesFromColliders`, `mass/localCom/principalInertia`. Vorschlag: Colliderdichte0, zusätzliche tatsächliche Sourcegesamtmasse; technischer COM(0,.75,0), uniforme Boxinertia `m/12·(b²+c²)`, Identitätsframe. Receipt muss echte Rapierwerte nach Kinematic→Fixed samt Source-/Custody-/Ownerbinding prüfen (Massentoleranz max(1e-6kg,2·ulp32(m)), COM1e-5m, Inertia max(1e-6kgm²,2·ulp32(I))); aktuelle Defaultdichte beweist diese Masse nicht.

W10 erhält Profilbytes, bestätigte Pose/Yaw, Massreceipt, Depotphase/Membership, ganze Materialview/Receipts/Commandbelege und Pendingzustand gemeinsam. Bedeutungsvolle Native-REDs:300kg-Piece+BOM ohne Split/Copy, breite Hülle trotz freier Capsule blockiert, fehlender Bodenkontakt, fremde Kinematicblockade, Snapstale, tatsächliche Rapiermasse/Modewechsel, Depot→Machine-Überlappung atomar, historischer Replay/Cancel/lostACK ohne Refund. Bestehende64Body/4096Collider/16Fixedfacility-Budgets gelten inklusive Staging/Depots. Keine Ausführungsjobs oder Produktänderungen.
