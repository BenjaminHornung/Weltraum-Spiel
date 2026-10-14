# Explizite Freigabe nach SimulationHold – Vorprüfung

Der echte Native-Worker-Trace und der spätere Browser-Hold zeigen eine Factory-Sackgasse: normale Play/Resume-Pfade lehnen unbestätigte Holds absichtlich ab; eine separate Freigabeaktion fehlt. Die bestehenden W06-R1-Goldens bleiben unverändert.

Root implementiert ausschließlich den getrennten, oben exakt beschriebenen Native-/Host-/Session-/UI-Vertrag im initialen 13-Pfad-Grant, später ausdrücklich auf 14 Pfade einschließlich des vorhandenen Clienttests ergänzt. Die private Sessionbarriere muss vor jeder Queue-Ablehnung gesetzt werden: ein bestehendes submit-finally setzt commandBusy sonst während des Recoveryawait zurück. Quieszenz allein beweist keine leere Queue. Nur unadoptierte Requests dürfen mit einem endgültigen Rejected-Receipt beendet werden. Bereits adoptierte Jobs, Material, WIP, Batterie und Bandpakete bleiben erhalten.

Die bestätigte Pausen-ACK darf keinen Produktions-Catchup über bisher unbestätigte Nativeintervalle erzeugen. Nach exakt gebundener ACK wird deshalb ausschließlich der Beobachtungscursor auf den tatsächlichen Native-Tick gesetzt; bestätigte Schritte und Restticks bleiben gleich. Erst neue bestätigte Ticks dürfen weitere100-ms-Schritte erzeugen. Native-RPC-Ablehnungen sind nichtterminal; falsche ACK-Bindung hält die Sitzung geschlossen.

Unabhängiger Source-Vertragsreview durch /root/blocked_band_readonly_review tatsächlich durchgeführt. Kein Implementierungs-, Browser- oder Performance-PASS folgt daraus. Menschliche Terrain-/Visual-/Gameplay-Abnahmen bleiben OWNER_REVIEW_PENDING.


## Tatsächlicher Abschluss der engen Recoverykorrektur

Sourcecommit `d59f978250348e8ec85360a49b2863520949135c`, Evidencecommit `b0871cfe851a6d519f40e56dc885a980a113e095`. Drei unabhängige Quellenprüfungen schließen Fence-Race, unbekannten Hostread und gleiches-Tick-UI-Publishing. 140 betroffene Client/Worker/UI/Hostfälle vor letztem Headerfix, anschließend 130 vollständige Session/Nativefälle und sechs Bootstrap-Holdfälle PASS; aktueller Originalbuild PASS. Zehn fokussierte Recoveryfälle PASS. Tatsächlicher Browser bestätigt drei Freigaben bei Tick910/1803/2828 mit gleichem Tick, Bodies, Cargo, Owner, Carrier, Inventar und Batterie. Gesamtroute bleibt FAIL198,247s wegen kurzer Eingabegeste beim Rückweg vor Batterieaufnahme. OriginalDry-Performance, voller W09-Kreis, W10-Save und W11 bleiben offen.
