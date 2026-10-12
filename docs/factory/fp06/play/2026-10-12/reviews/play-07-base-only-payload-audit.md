# PLAY-07 BASE_ONLY: vollständiger LFS-Payload-Audit zweier fester Basis-Trees

**BASE_ONLY_LFS_PAYLOAD_PASS. Finaler Delivery-Freeze, Bundle, LFS-Archiv, unabhängige Kopie, Build, Spielstart und Save/Recovery: NOT_RUN. Menschliche Abnahmen: OWNER_REVIEW_PENDING.**

Der Audit liest ausschließlich die beiden unten genannten unveränderlichen Commit-Trees und deren tatsächlich erforderliche Cacheobjekte. Der Integrator hat autorisierte, uncommittierte Runtime-/Test-/Evidencearbeit; diese Dateien sind ausdrücklich kein Input dieses Audits. Ein LFS-PASS dieser Basisstände ist keine vollständige aktuelle Prototypenlieferung und kein Gameplay-, Save-, UI-, Visual- oder Performance-PASS.

## Gepinnter und tatsächlich verifizierter Umfang

| Rolle | Vollständiger Commit-SHA | Pointerpfade | Eindeutige OIDs | Logische Pfadbytes | Deduplizierte Objektbytes |
| --- | --- | ---: | ---: | ---: | ---: |
| Integrator-Produktbasis | `f85d1379c3458488d225105156adfb66837799ce` | 1.483 | 1.209 | 763.732.725 | 512.707.335 |
| Root-Controlbasis | `6ee49c69bc3cb35d9575166262331c2a3ea586af` | 637 | 498 | 350.466.198 | 245.366.948 |
| Union beider Trees | beide exakten SHAs | 2.120 | **1.210** | 1.114.198.923 | **512.708.211** |

Die Trees teilen 497 OIDs. Es gibt 712 nur im Produkt-Tree benötigte OIDs und genau eine nur im Control-Tree benötigte OID. Diese Control-Payload hat 876 Bytes:

- Pfad: `docs/factory/fp06/play/2026-10-12/proposals/raw-layout-v5/01-readonly-v4-to-proposed-v5-census.raw.log.gz`
- OID/SHA256: `bcaa45a7add9b151961876559ee8ca0f1b187212ce34e01dc09981a37126f9b4`

Beide Live-HEADs entsprachen beim Inventar und beim Endread am 2026-10-12 um 14:19:30 UTC den gepinnten SHAs. Der Root-Control-Worktree war beim Inventar sauber; der Integrator hatte modifizierte Produkt-/Tests und untracked Evidence. Die getrennten Statusreceipts zeigen das, ohne bewegliche Dateiinhalte als Lieferstand aufzunehmen. Beide Commitobjekte wurden tatsächlich mit Git als `commit` aufgelöst.

## Methode und tatsächliche Laufdaten

Zuerst vollständig gelesen: Repository-`AGENTS.md`, `README.md` und das bestehende `PLAY-07/portable-preflight.md`; dessen tatsächlicher SHA ist `8e544fb622bda143031c1e9afaad31ad1e3533e4c868d5de7fcf96634fee1858`. Der historische Mainline-Status wurde als September-Snapshot eingeordnet. Er überschreibt keinen aktuellen FP06-Branchstand. Die Setup-Skill-Anweisung zum Schutz bestehender Dateien wurde berücksichtigt; es wurden nur externe Auditbelege neu angelegt.

`git ls-tree -r -z -l --full-tree <exakter SHA>` liefert beide festen Trees. Kleine Gitblobs wurden per `git cat-file --batch` gelesen und tatsächlich als Git-LFS-v1-Pointer geparst (Version, vollständige SHA256-OID, Integergröße; 1.024-Byte-Grenze der Pointer-Spezifikation). Normale Gitblobs, Gitstatus, Dependencies und bewegliche Quellen werden weder als Payload noch als fertiger Build ausgegeben. Fehlende Gitobjekte dürfen nicht aus dem Netzwerk nachgeladen werden (`GIT_NO_LAZY_FETCH=1`); optionale Gitlocks und interaktive Authentifizierung waren abgeschaltet.

Die gezielte Konfigurationsabfrage `git config --show-origin --get-all lfs.storage` ergab Exit 1: keine explizite `lfs.storage`-Override. Git LFS selbst meldete den tatsächlichen gemeinsamen Cache `LocalMediaDir=/workspace/Weltraum-Spiel/.git/lfs/objects` sowie `LocalGitStorageDir=/workspace/Weltraum-Spiel/.git`. Aus `git lfs env` wurden ausschließlich diese lokalen Pfadfelder gespeichert; Endpoint-/Credentialfelder und das Prozess-Environment wurden nicht ausgegeben oder kopiert. Der Worktree-spezifische Pfad von `git rev-parse --git-path lfs/objects` ist hier kein verwendeter Cache-Override.

Der erste Inventarversuch scheiterte am eigenen Key-Namen `blob_id`/`git_blob_id`, bevor irgendeine Payload gelesen wurde: **2026-10-12T14:16:13.521087+00:00–14:16:13.888757+00:00, Exit 1, 0 Payloadbytes**. Originalskript, Rawlog, Tree-/Statusreads und Fehlerreceipt bleiben unter `inventory-attempt-01-failed/` erhalten. Der Ausnahmeabbruch erfolgte vor dem finalen Command-Receipt-JSON; diese Grenze wird nicht als vollständige erste Command-Abdeckung behauptet. Die konkrete Ein-Feld-Korrektur betrifft nur das externe Auditskript.

Das korrigierte Inventar lief **2026-10-12T14:17:11.313442+00:00–2026-10-12T14:17:11.710545+00:00, Exit 0**. Alle benötigten Cacheobjekte waren reguläre Dateien, vorhanden und größenpassend. Es gab keine fehlerhaften Pointer und keine OID-Größenkonflikte.

Der Integrator gab anschließend ausdrücklich einen exklusiven CPU-/Datei-IO-Slot ohne aktive Native-/Browser-/Build-/Testjobs. Der tatsächliche Payloadlauf lief **2026-10-12T14:17:45.785100+00:00–2026-10-12T14:17:46.667815+00:00**, CLI **Exit 0**, Walltime **0.882726255 s**. Die interne Hashphase dauerte 0.788923353 s. Genau **512.708.211 Bytes** wurden gelesen: für jede deduplizierte benötigte OID genau ein `open` und ein sequenzieller vollständiger SHA256-Streamingdurchlauf, ohne Wiederholung, Parallelhashing oder Teilhash. Alle **1.210/1.210** Objekte stimmen mit der vollständigen Pointer-OID und der exakten Bytezahl überein, **0 FAIL**. Inode, Device, Dateigröße und mtime waren vor/nach jeder Datei gleich; Symlink-Payloads wären abgewiesen worden. Der Slot wurde nach dem tatsächlichen Ende direkt an den Integrator zurückgegeben.

Der sehr kurze Cache-Hashlauf ist kein Spiel-FPS-, IO-Benchmark- oder Hardwareakzeptanzwert. Anschließende Crosschecks lesen ausschließlich JSON-/Rawbelege und wiederholen den Payloadscan nicht. Alle elf Metadaten-Crosschecks PASS: exakt gleiche Required-/Result-OID-Menge, deduplizierte Anzahl, Größen, SHA256, ein Pass je Objekt, stabile Dateien, reguläre Presence, null Inventar-/Payloadfehler, genaue Inventar-SHA-Bindung und richtige Raw-Zeilenanzahl.

## Tatsächliche Artpayloads in diesem festen Produkt-Tree

**23 native `.blend`-Quellen + 23 Runtime-`.glb`-Payloads, insgesamt 46 Dateien / 13.885.804 Bytes.** Alle 46 sind Teil des obigen vollständigen SHA-/Größen-PASS; kein Pointertext wird als Binary ersetzt. Der Einzelpfad-/OID-/Größenbeleg liegt in `play-art-base-payload-manifest.json`.

Die Runtimeprodukte umfassen Cutter, Former, geschlossenen/offenen Lagerkörper, geschlossen/offenes Wrack/Frachtobjekt, schweren/mittleren/leichten Carrier, Werkbank, Band, Batterie, Verteiler, PV, Wind, Kabelende/-verbindung, Stahl, Halbzeug, Profil, Blech, Verschnitt und Stütze. Vorhandene native Quellen und Runtimeprodukte sind damit als echte lokale Payloads bestätigt. Hier wurden Blender, GLB-Loader, Browser oder Renderer nicht gestartet; Modellqualität, aktuelle normale Build-Einbindung und menschliche Art-/Terrain-/UI-Abnahme sind aus diesem Audit nicht abgeleitet.

Die Produktbasis enthält insgesamt 98 LFS-Public-Dateien / 15.223.052 logische Bytes, 23 PLAY-Blends / 13.328.928 Bytes, 1.113 Evidencepfade / 601.767.258 Bytes und 249 sonstige Quellen-/Referenzpfade / 133.413.487 Bytes. Die zusätzliche Control-OID zeigt, warum die finale Lieferung beide finalen Trees berücksichtigen muss.

## Belege und unveränderte Grenzen

| Beleg | Bytes | SHA256 |
| --- | ---: | --- |
| Vollständiger Pointer-/Required-Manifest | 2775136 | `06d4640a92a54d649b2e7aa1880e2f68f86c68d0889e7add16ed571974ec7bc8` |
| Vollständige SHA256-/Größenresultate | 1975499 | `a61fa65b52198ef0ff3192ad3f43ff05e272f692a6abc751cf96c4e3ac4a1cc5` |
| Tatsächlicher Hash-Rawlog | 269586 | `c1f3732dafea155c74e758efbac13447e65d11395293f385526b2fe02ede827b` |
| Korrigierte Inventar-Commandreceipts | 13350 | `9ee14a5ce9b9ab2179a9e19f1c5c0349c87c4cb855f824cb6dc6667bc14bcf86` |

Alle Belege, das tatsächliche Skript, die Slotfreigabe, vollständige Start-/End-/Exitreceipts, failed-attempt-Belege und Statusreads liegen ausschließlich unter `/workspace/.cloud-setup/fp06-play-2026-10-12/PLAY-07/base-payload-audit/`. `evidence-files-manifest.json`/`SHA256SUMS.txt` erfassen diese eigenen externen Artefakte; sie enthalten keine `.git/config`, Hooks, Credentials, Browserprofile oder Secrets.

**Keine** Repository-/Implementierungsdatei wurde geändert, kein Branch erstellt, kein Worktree hydriert, kein Fetch/Netzwerk-/Installjob, Bundle, Archiv oder neue Instanz erzeugt. Keine Browser-, Native-, Test-, Build-, Profiling- oder Blenderjobs ausgeführt. Der beschränkte Scope hält die zwei aktiven Implementierungswriter unverändert.

Vor einer finalen portablen Lieferung muss Root die abschließenden Produkt-/Control-SHAs und saubere Zustände dokumentieren. Die benötigte LFS-Union dieser finalen Trees ist neu zu ermitteln und vollständig zu prüfen; diese Basisprüfung darf neue oder uncommittierte Payloads nicht stillschweigend abdecken. Anschließend bleiben exakt begrenztes Sourcebundle/LFS-Paket, finale Evidence-Whitelist, vollständige Source-/Artlieferung, README_PLAY, unabhängige saubere Kopie, echter Build/Start und normaler vollständiger Spiel-/Save-/Browserneustart-Nachweis erforderlich. All diese Schritte sind hier **NOT_RUN**. Die historische Instance-2 und gespeicherte Cloud-Draftrevision sind kein aktueller Clean-Copy- oder zweiter Live-VM-Nachweis.
