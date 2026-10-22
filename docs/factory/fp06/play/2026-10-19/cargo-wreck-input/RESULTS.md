# Ergebnis: Eingabe, Cargo und Kistenrendering – 19. Oktober 2026

Ready-v9 besteht die begrenzte technische Abnahme dieser Reparaturen. Der tatsächliche Kandidat bleibt HEAD `7ee85b0e0e3dedc5a41c3ccf98b3fe92b64f846e`, Branch `feature/hestia-fp06-review-continuation-2026-10-15`, mit seiner erhaltenen lokalen Arbeit. Dieser Abschluss ersetzt die noch offenen Runtime-Gates der vorangehenden Source-Freeze-Einträge; deren historische Zustände und Fehlversuche bleiben erhalten. Die inzwischen gewählte zusätzliche Integration eines **betretbaren Vollrumpfs** ist noch offen und nicht Bestandteil der Ready-v9-Abnahme.

## Tatsächliche Reparaturergebnisse

1. **Maus/Rückstau:** Erster reproduzierter Spielstop war `HVP-02 UNAVAILABLE / Technical initialization failure: Physics command backpressure` im echten Benutzertest auf Ready-v4. Ursache waren unmittelbare Bewegungs-RPCs für jedes mousemove bei gehaltenem WASD. Eine entfernte Producer-Zeile lässt die vorhandene Frame-Aktualisierung die neueste Richtung senden; sämtliche Rohdeltas bleiben sofort in der Kamera erhalten. Tastatur, Sprung, Stop/Neutral und Sicherheits-Cap8 bleiben unverändert. R66: 320 echte Pointer-Lock-Ereignisse, 774 fortgeschrittene Native-Ticks, kein Overflow. R67: 32 mausreine Bewegungen ohne WASD, Position unverändert, Quaternionfehler 3.524958103184872e-15 und kein zusätzliches FactoryInput-RPC.
2. **Cargo unter Pointer Lock:** I öffnet die vorhandene Cargo-/Transportoberfläche. E öffnet sie beim erreichbaren Cargo oder mit getragener Last. Tatsächlicher Pause-ACK, neutrale Eingabe und freigegebener Cursor sind nachgewiesen. Unerreichbares E bleibt wirkungslos; Close bleibt Paused, erst explizites Play setzt fort. Native Open cargo bleibt eine ausdrückliche Aktion, Material bleibt endlich: 2984.4kg.
3. **Flimmernde Kiste:** Zwei neue, streng geprüfte V2-Derivate beheben vordere und hintere gleichgerichtete STRUCT/SHELL-Flächenüberlappung. Native Außenmaße/Kollision und alte V1-Dateien bleiben exakt. Der verbleibende Innenstreifen stammte vom späteren HVP-Schattenempfang: Nur Cargo-Meshes empfangen jetzt keine Eigen-/Fremdschatten; sie werfen weiterhin Bodenschatten. Tatsächlicher Ready-v8/v9-Vergleich desselben Save2, derselben Kamera und desselben Viewports entfernt die Streifen. Root und unabhängiger Reviewer haben beide PNGs geprüft. Nachbarn, Licht, Shadow-Map und globale Einstellungen bleiben gleich.
4. **End session:** Der private Lebenszyklus-Check läuft vor Hostreads. Der echte Ablauf entfernt Shell, Worker, Native und Registrierungen ohne Fehler. Die vorhandene Endmeldung verlangt weiterhin explizit Restart; danach funktionieren Menü und New game mit Paused/tick0. Die Schaltfläche heißt korrekt End session.
5. **Saubere Kopie:** `E:/DEV/Weltraum-Spiel/FP06-Ready-2026-10-19-v9` enthält 896 versiegelte Quelldateien; erneute SHA256-Prüfung: 896/896 exakt. 846 Produkt-/Test-/Assetdateien stimmen mit dem aktuellen Kandidaten überein. Offline-`npm ci --offline --cache E:/DEV/Weltraum-Spiel/FP06-npm-cache --no-audit --no-fund`: 59 Pakete PASS. `npm run build`: TypeScript/Vite327 Module PASS, 4.4347s; bestehende Chunk-Warnung bleibt sichtbar.

## Gemeinsamer Save und echter Browserneustart

Frisches normales New game R68 erreichte das Cargo mit gewöhnlichem Play/S/E/I und öffnete es ausdrücklich. Save1: 1,586,626B, Native1634/Factory272/r2, Masse2984400000mg. Chrome wurde tatsächlich geschlossen und als neuer Prozess mit demselben Profil/Origin gestartet; normales Continue mit Bestätigung stellte Paused, unveränderte Pose, geöffnetes Cargo, neutrale Eingabe und den vollständigen Slot wieder her.

Ein ausdrückliches Save2 vor jedem Play bewahrt alle fünf vollständigen Authority-Hashes. Anschließend wurde Save2 ohne Play/Save auf Ready-v8 und nach erneutem echten Prozessneustart auf Ready-v9 geladen: gesamter Slot, sämtliche gespeicherten Hashes und View-JSON exakt. Save3 auf Ready-v9 bewahrt erneut Native, NativeFactory, Profiles, Host und Factory außer erwarteter Publikationsmetadaten. Keine Native-Felder wurden ausgenommen. R68 ist anschließend geschlossen/disconnected.

Der bestehende vollständige Produktionsstand Save25 (15,121,771B, elf installierte Owner, Native227986) wurde zusätzlich auf final Ready-v9 durch einen neuen Chrome-Prozess normal fortgesetzt: korrekter Produktionsfortschritt, V2-Cargo, Paused/neutral/unlocked, keine Fehler, vollständiger Slot-SHA unverändert. Auch dieser Chrome wurde geschlossen. Benutzer-Save12 und der alte ungespeicherte Paused1802-Tab bleiben unverändert erhalten.

Der vollständige bezahlte frische 16kg-Zyklus wurde vorher in R57–R64 erfolgreich durchgeführt; für diese Input-/UI-/Renderänderungen wurde er **nicht noch einmal durchgeführt**. Erhaltene Bilanz: 16kg = eingebaute bezahlte Strebe5.8kg + Profiles3kg + Sheet5kg + Verschnitt2.2kg; zehn Installationen, beide bezahlten Bänder, fünf Kabel, tatsächlicher CUT-WIP-Neustart mit einmaligem Abschluss. Gesamtbestand2984.4kg.

## Prüfungen und Grenzen

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| PlayerInput / benachbarte Kamera-Präsentation | 53/53 und 11/11 PASS; realer NativeTransport RED/GREEN und unveränderter Cap8-Fail-closed-Test |
| Shell / Loader / Cargo-Derivate / Visual Effects | 27/27, 59/59, ausgewählte2/2, 2/2 PASS |
| Source-, Binär- und Renderreview | Unabhängige registrierte Reviewer PASS; bestehender Pi `opencode-go/deepseek-v4.1-flash` als Plan-/Schlussberater einbezogen |
| Historische Gesamtauswahlen | Vier unveränderte Derivat-Git-Lookups FAIL/exit128; historischer vollständiger Bootstrap FAIL im unveränderten10s Cold-Plant-Setup, 58pass/2skip. Kein Gesamt-PASS behauptet |
| Menschliche Eingabe / lokale Anzeige | Raw-Input-Fix vorher menschlich bestätigt; Hardware-Retest nach neuer Producer-Zeile und lokale Monitor-Glattheit NOT RUN |

Chrome meldet32Hz in der vom Nutzer bestätigten Windows-Remote-Sitzung. Sogar die leere Kontrollseite desselben Chrome erreicht nur30.7713FPS (p9533ms). Das erklärt die Remote-Anzeigegrenze, beweist aber keine lokale Spielbildrate. Die vorherige aktive Produktionsmessung verfehlte ihr mittleres30FPS-Ziel; Performance-Kandidat3/3 und MAIN-Profil1/1 bleiben geschlossen. Keine weitere Performance-, GPU- oder Heap-Verbesserung wird behauptet.

Neue lokale Renderpolicy: Cargo empfängt keine Schatten; Schattenwurf bleibt. Neue gespeicherte Darstellung oder Clock-Policy wurden in diesen Reparaturen nicht eingeführt. Die bereits ausdrücklich genehmigte verlustfreie Save-V2/V1-Kompatibilität bleibt bestehen. Limits, alte Goldens und Fehlversuche bleiben erhalten. Allgemeine menschliche Art-/Spielspaßabnahme ist offen.

Das vorhandene15.125m-Schiffsmodell ist erhalten und bisher NOT_ADMITTED. Der Nutzer hat inzwischen **betretbarer Rumpf** gewählt. Konkrete Platzierung, begehbarer Einstieg, vollständige Kollision und Save-Verträglichkeit werden separat geprüft; Ready-v9 enthält weiterhin den reparierten Cargo-Zugang, keinen begehbaren Vollrumpf.

## Start und Nachweise

Preview läuft auf `http://127.0.0.1:5197/factory.html` aus Ready-v9. Der vordere externe Chrome zeigt New game, Paused0, freie Maus und Play; der alte ungespeicherte Tab bleibt erhalten. I öffnet Cargo; E funktioniert in Reichweite. Close setzt nicht automatisch fort.

[Maschinenlesbare finale Abnahme](../../../../../../FP06_INPUT_CARGO_ACCEPTANCE.json), [tatsächliche R68-/Save25-Ergebnisse](../../../../../../apps/weltraum-browser/evidence/factory/play/2026-10-19/cargo-wreck-input/R68_FINAL_RUNTIME.json), [Pi-Schlussreview und Root-Einordnung](../../../../../../apps/weltraum-browser/evidence/factory/play/2026-10-19/cargo-wreck-input/PI_FINAL_REVIEW.md). Die zusätzliche finale JSON-Abnahme in Ready-v9 liegt außerhalb des unveränderten896-Dateien-Manifests.

