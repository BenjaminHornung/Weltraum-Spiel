# P05 Re-Audit Report

**Auftragsdatum im Dateinamen:** 2026-08-12  
**Ausführung:** 2026-08-13  
**Scope:** isolierter P05-Mockprototyp, Sanitization, client-only Rebuild,
Reproduktion und Archivprüfung  
**Verdict:** `REQUIRES_FIX`

## Technische Zusammenfassung

Das alte P05-Distributionsarchiv bleibt `DISCARD / QUARANTINED`. Sein bekannter
Security-Befund wurde bestätigt, ohne den Wert offenzulegen. Die problematische
Klasse lag ausschließlich im mitgelieferten Buildoutput. Statt dieses
Serverartefakt zu bereinigen oder weiterzureichen, wurde der deterministische
P05-UX-Flow als statische client-only React-/Vite-Anwendung neu aufgebaut.

Der neue Sourcebaum, der daraus frisch erzeugte Build und das finale source-only
ZIP sind in den ausgeführten Scans ohne Secret-Treffer. Das ZIP lässt sich in
einem neuen Tempordner installieren, linten, bauen und testen. Es enthält weder
Buildoutput noch Deploymentmetadaten.

Der Auftrag kann dennoch nicht `PASS_FOR_ARCHIVE` erhalten: Die verlangten
frischen Browser-Screenshots fehlen aufgrund einer nachgewiesenen
Browserinfrastruktur- und Workspacegrenze. Eine synthetische oder mit einem
anderen Renderer rekonstruierte Aufnahme wäre keine zulässige Evidence.

## 1. Quellen und Evidence-Basis

- `P05_sanitization_rebuild_reaudit_prompt(1).md`
- `WELTRAUM_PROJECT_INSTRUCTIONS_ADDENDUM(1).md`
- `P06_PROTOTYPE_INTAKE_AND_ADOPTION_AUDIT_2026-08-12.md`
- quarantänisiertes P05-Originalarchiv mit SHA-256
  `988257c9d9ad74e57b7c963387c695612ace099aa8e55ed82e0982ac6cc4cbb7`
- vollständige Originalinventur und redigierende Scans
- bereinigter Sourcebaum und neues Lockfile
- frische Install-, Lint-, Build-, Test-, HTTP- und Scanläufe
- finales ZIP und isolierter Rebuild aus genau diesem ZIP

Keine Produktrepository- oder GitHub-Evidence wurde erzeugt oder verändert.

## 2. Rebuild-Entscheidung

P06 hatte bereits belegt, dass der Vinext-Build bei jeder Erzeugung erneut eine
secret-bezogene Servermanifestklasse produziert. Nur das alte `dist/` zu löschen
hätte das Rebuild-Gate deshalb nicht dauerhaft geschlossen. Der kleinste saubere
portable Pfad war ein client-only Build, weil P05 keine Server-, Datenbank-,
Cloudflare-, Hosting- oder Produktfunktion benötigt.

### Beibehalten

- deterministischer Neun-Schritte-Flow;
- sichtbare Trennung von Preview, Validation, Approval, Mock-Commit und Undo;
- Blocker-Gate und explizites Owner-Acknowledgement;
- append-only dargestelltes kompensierendes Undo;
- sichtbare Hinweise `MOCK FIXTURE`, `KEINE EXTERNE KI` und
  `KEIN PRODUKT-WRITE`;
- UX-Findings mit klaren Nicht-Belegen.

### Verworfen

- gesamtes altes `dist/`;
- `.openai/hosting.json` und alle Deploymentmetadaten;
- Vinext-/Next-/Cloudflare-/Worker-/DB-/D1-/R2-/Drizzle-Scaffolds;
- generische D1-Beispiele;
- historische Screenshotnotiz ohne Bildbytes;
- altes Lockfile mit nicht benötigter Servertoolchain.

## 3. Dependency-, Lockfile- und Lizenzprüfung

Der neue direkte Stack enthält React `19.2.6`, React DOM `19.2.6`, Vite
`8.0.13`, TypeScript `5.9.3`, ESLint `9.39.4` und die explizit gepinnten
zugehörigen Plugins/Typen. Das Lockfile v3 umfasst 161 Einträge einschließlich
Root und hat keine ungebundenen Nicht-Root-Pakete.

Deklarierte Lizenzverteilung im Lockfile:

| Lizenz | Einträge |
|---|---:|
| MIT | 115 |
| Apache-2.0 | 15 |
| MPL-2.0 | 12 |
| ISC | 7 |
| BSD-2-Clause | 6 |
| BSD-3-Clause | 2 |
| 0BSD | 1 |
| BlueOak-1.0.0 | 1 |
| Python-2.0 | 1 |
| Rootpaket `UNLICENSED` | 1 |

Das ist eine Manifestinventur, kein vollständiges juristisches Lizenzgutachten.
Das Rootpaket erteilt keine externe Distributions- oder Produktadoptionslizenz.

## 4. Ausgeführte technische Gates

| Gate | Ergebnis | Evidence-Grenze |
|---|---|---|
| sichere Original-ZIP-Prüfung | PASS | Struktur und CRC, keine fachliche Freigabe |
| Original-Inventur | PASS | 74 Dateien vollständig klassifiziert |
| Original-Secret-Scan | erwarteter FAIL | 2 redigierte Treffer, nur Buildoutput |
| Source-/Lockfile-Scan vor Installation | PASS | 0 Treffer |
| `npm ci --ignore-scripts` | PASS | Installation nur aus neuem Lockfile |
| ESLint | PASS | statische Codeprüfung |
| TypeScript + Vite Build | PASS | client-only, 4 Dateien |
| Node-Test | PASS, 3/3 | Mock-/Non-Authority-Labels und Buildgrenzen |
| lokaler HTTP-Smoke | PASS | HTML, JavaScript, CSS jeweils 200 |
| frischer Buildscan | PASS | 0 Treffer in 4 Dateien |
| finales ZIP | PASS | 0 Treffer, 0 unsichere Pfade/Symlinks/Duplikate |
| Rebuild aus finalem ZIP | PASS | frische Installation, Lint, Build, 3/3 Tests, Buildscan |
| frische Browser-Screenshots | BLOCKED | Cloud-URL-Policy plus fehlende lokale Browserbinärdatei |

Vites eigener Preview-Server traf in dieser Sandbox beim Ermitteln der
Netzwerkschnittstellen auf `uv_interface_addresses`. Exakt derselbe geprüfte
`dist/`-Ordner wurde anschließend über einen lokalen statischen HTTP-Server
gestartet und erfolgreich angefragt. Diese Abweichung ist Infrastrukturdiagnostik,
kein Performancewert.

## 5. UX- und Wahrheitsgrenzen

| Pflichtgrenze | Ergebnis | Beleg |
|---|---|---|
| keine echte KI | PASS im Source-/Buildcontract | kein `fetch`, kein WebSocket, sichtbarer Hinweis `KEINE EXTERNE KI` |
| keine echte Authority | PASS im Mockcontract | Authorityangaben bleiben Fixturetexte und flüchtiger React-State |
| kein echter Commit | PASS im Mockcontract | sichtbarer Hinweis und Sourceassertion: Commit ändert nur React-State |
| deterministischer Fixtureflow | PASS im Source-/Testcontract | feste IDs, Zeitpunkte, Revisionen, Hashkürzel, Seed und Resetpfad |
| sichtbare Mockkennzeichnung | PASS in Source und gebauten Bytes | drei permanente Bannertexte werden in Tests geprüft |
| kein Performanceclaim | PASS | keine Messung oder Leistungsbehauptung |

Diese Gates belegen keine Authentisierung, Capability-Sicherheit, CAS,
kanonische Digests, Persistenz, Concurrency, Recovery oder Produktintegration.
Die fehlende frische Browserausführung verhindert außerdem eine neue visuelle
und interaktive Bestätigung des Rebuilds.

## 6. Screenshot-Evidence

Vorgesehene frische Zustände waren:

1. Initialzustand;
2. Validator-Blocker;
3. gesperrtes Owner-Gate;
4. commit-bereiter Zustand;
5. Mock-Commit-Receipt;
6. abgeschlossener Mock-Undo-Round-trip.

Es wurden null Bilddateien erzeugt. Der Cloud-Browser verweigerte den Zugriff
auf Loopback und lokale Dateipfade durch seine URL-Sicherheitsrichtlinie. Der
lokale Playwright-Fallback konnte nicht starten, weil die zuvor verfügbare
Chromium-Binärdatei nach automatischer Workspace-Bereinigung nicht mehr
vorhanden war. Nach dem ausdrücklichen Browser-Policy-Block wurden keine
weiteren Umgehungs- oder Alternate-Browser-Versuche unternommen.

## 7. Findings

### P0 geschlossen: Secret-bearing Buildoutput

Der alte Buildoutput wurde nicht selektiv redigiert, sondern vollständig
verworfen. Der neue Buildpfad erzeugt keine Servermanifeste und der frische
Buildscan ist ohne Treffer.

### P1 geschlossen: portable Sourcegrenze

Das neue ZIP ist eine Allowlist aus Source, Tests, Dokumentation, Lockfile und
Buildkonfiguration. Es enthält keine generierten Laufzeitprodukte.

### P1 offen: frische visuelle und interaktive Evidence

Die Source-/Buildtests ersetzen keine Browserprüfung. Ohne die sechs frischen
Zustände ist das Pflichtoutput unvollständig.

### Owner-Schritt weiterhin offen

Eine gegebenenfalls erforderliche Rotation oder Widerrufung des alten
Credentials bleibt außerhalb dieses Agents. Ein sauberer Rebuild beweist nicht,
dass dieser Owner-/Provider-Schritt erfolgt ist.

## 8. Kleinster Fix-Loop

1. Eine bekannte lokale Chromium-/Chrome-Binärdatei in einer Umgebung mit
   Zugriff auf den lokalen Previewserver bereitstellen.
2. Finales ZIP unverändert extrahieren und `npm ci`, `npm run lint`, `npm test`
   erneut ausführen.
3. Produktionbuild lokal starten und die sechs im Manifest definierten Zustände
   bei 1365 × 935, DPR 1, Reduced Motion erfassen.
4. HTTP-, Console-, Page- und Requestfehler fail-closed prüfen.
5. Screenshot-SHA-256 und Maße in `P05_EVIDENCE_MANIFEST.json` ergänzen.
6. Source, frischen Build und unverändertes finales ZIP erneut auf Secrets
   scannen. Nur bei weiterhin 0/0/0 darf das Verdict auf `PASS_FOR_ARCHIVE`
   wechseln.

## Verdict

`REQUIRES_FIX`

Begründung: Alle drei Secret-Gates bestehen, aber die verpflichtende frische
Screenshot-Evidence fehlt. Das alte P05-Archiv bleibt quarantänisiert und darf
nicht verteilt oder nach GitHub geschrieben werden.
