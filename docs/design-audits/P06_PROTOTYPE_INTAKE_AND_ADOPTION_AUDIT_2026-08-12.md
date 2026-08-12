# P06: Unabhängiger Intake- und Ausführbarkeitsaudit für P01 bis P05

**Datum:** 2026-08-12  
**Status:** `REQUIRES_FIX`  
**Scope:** isolierte Mock-/Fixture-Prototypen P01 bis P05  
**Nicht durchgeführt:** Produktintegration, GitHub-Write, Deployment, Performancebenchmark oder Performanceclaim

## Technische Zusammenfassung

Die fünf Archive sind sicher in getrennte temporäre Ordner extrahiert, inventarisiert und mit ihren paketintern dokumentierten lokalen Abläufen geprüft worden. Alle fünf Checkouts lassen sich nach transparenter Normalisierung einer extern gesetzten, nicht beschreibbaren npm-Cache-Variable bauen. P01 besteht seinen vollständigen Prototypscope. P02, P03 und P04 sind ausführbar, verfehlen aber jeweils mindestens ein relevantes Browser-, Accessibility- oder Evidence-Gate. P05s UX-Flow ist ausführbar, das gelieferte Archiv ist jedoch für Distribution und Adoption blockiert, weil sein vorgebautes `dist/` einen nicht offengelegten 64-stelligen `prerenderSecret` in zwei Manifesten enthält.

Das Ergebnis ist deshalb nicht `READY_FOR_SYNTHESIS`. Die Erkenntnisse können in eine spätere Synthese eingehen, aber erst nach den konkret benannten Paket- und Contract-Fixes. Keines der Pakete ist Produkt-Authority.

| Paket | Paketstatus | Primäre Adoption | Kurzbegründung |
|---|---|---|---|
| P01 Editor Shell | `PASS` | `ADAPT` | Install, Build, 4/4 Checks, Browserhealth, Keyboard, Fokus, Responsive und vier frische Bildszenarien bestehen im Prototypscope. Lizenz/Provenienz und neutrale Fixture-Identitäten fehlen. |
| P02 Mission Graph Editor | `PARTIAL` | `ADAPT` | 13/13 Unit- und 6/6 E2E-Tests bestehen. Der 768-px-Zustand bleibt 1180 px breit, neun Interaktionen liegen off-screen, Graphknoten haben keinen sichtbaren Fokus und reagieren nicht auf Enter/Space. Drei Captures sind zeitabhängig. |
| P03 Settlement Editor | `PARTIAL` | `ADAPT` | Gates und frische checkout-gebundene Captures bestehen. Browserhealth ist wegen elf Font-404s nicht sauber; SVG-Objekte sind nicht tastaturfähig; Narrow-Inspector fehlt; Save/Load ist nur teilweise runtimebelegt. |
| P04 Star System Map | `PARTIAL` | `ADAPT` | Gates, Browserhealth, Responsive und frische Bilder bestehen. Der Surface-Handoff-Dialog hat weder Initialfokus noch Fokusfalle oder Escape-Verhalten. |
| P05 AI Copilot Transaction UX | `BLOCKED` | `DISCARD` des aktuellen Archivs, `ADAPT` nur der UX-Learnings | Der rein synthetische v42-v43-Undo-Flow funktioniert. Das Originalarchiv enthält jedoch secret-bearing Build-Output; keine echte KI, Authority oder Transaktion ist belegt. |

### Warum `REQUIRES_FIX`

1. P05 muss gesperrt, das Build-Secret invalidiert oder rotiert und als source-only Archiv ohne `dist/` neu geliefert werden.
2. P02 benötigt einen echten Narrow-/Tablet-Vertrag, tastaturbedienbare Graphknoten und einen stabilen Capture-Ready-Handshake.
3. P03 benötigt korrekte Font-Assetpfade, tastaturfähige Kartenobjekte, zugängliche Narrow-Validierung und einen echten Save/Load-Restore-Test aus verschiedenem Zustand.
4. P04 benötigt einen korrekten modalen Fokusvertrag.
5. Alle Pakete außer P02 haben keine ausreichende Paketlizenz-/Third-Party-Provenienz. P02 ist ausdrücklich `UNLICENSED` und dokumentiert nur seine Third-Party-Abhängigkeiten.

## 1. Bewertungsmaßstab und Evidence-Grenze

Die Paketstatus bedeuten:

| Status | Bedeutung in diesem Audit |
|---|---|
| `PASS` | Die im Paket dokumentierten technischen Schritte und die verlangten Browserchecks bestehen im ausdrücklich begrenzten Prototypscope. Das ist keine Produkt-, Lizenz- oder Owner-Freigabe. |
| `PARTIAL` | Ein ausführbarer und verwertbarer Teil ist belegt, aber mindestens ein materielles Gate oder eine Evidence-Kette bleibt offen oder fehlerhaft. |
| `BLOCKED` | Das Paket darf in der gelieferten Form nicht verteilt oder adoptiert werden, bis der benannte Blocker beseitigt und erneut geprüft ist. |
| `UNVERIFIED` | Für die jeweilige Aussage fehlt belastbare Evidence. Dieser Wert wird in den Dossiers auch für einzelne Unterbereiche verwendet. |

Technische Tests belegen nur die ausgeführten Pfade. Screenshots belegen sichtbare Zustände, aber keine fachliche Korrektheit, Security, Performance oder visuelle Owner-Freigabe. Mock-Hashes, Fixture-Revisionen und lokale React-State-Änderungen sind keine Authority-Belege. Die Architektur-Linsen G02, G05, G10, G11, G14 und G17 werden als Zielverträge verwendet, nicht als rückwirkende Autorisierung der Prototypen.

## 2. Methode, Isolation und Auditumgebung

### 2.1 Sichere Extraktion

Jedes Archiv wurde vor der Extraktion auf absolute Pfade, `..`-Traversal und Symlink-Einträge geprüft. Die fünf exakten Zielordner waren vorher nicht vorhanden. Extraktion und Ausführung fanden getrennt unter `/tmp/p06-audit-P01` bis `/tmp/p06-audit-P05` statt. Es wurde kein Paket in ein anderes kopiert und kein Produktrepository verändert.

| Paket | ZIP SHA-256 | ZIP-Größe | ZIP-Einträge | Extraktionsziel |
|---|---|---:|---:|---|
| P01 | `615b0165b356060dd9ad9a6373682923b7be297c7cb7e606192076edcf5e7fd1` | 1,153,006 B | 29 | `/tmp/p06-audit-P01/P01_editor_shell_ui_prototype` |
| P02 | `6dbf7636dc5153e66e960ab948149fe0fb503120717eae4c6a663330e8678eb7` | 1,498,602 B | 55 | `/tmp/p06-audit-P02/p02-mission-graph-prototype` |
| P03 | `af9cc7f65d1f781006a23ad75d83e358b5fca02c0923339df270aa8bd137eddb` | 488,823 B | 77 | `/tmp/p06-audit-P03/p03-settlement-editor-prototype` |
| P04 | `60a309d9441b1c4fc8464f0e93ab5fd3a3cf9d5606d9e26c18d4c4943bd93152` | 1,456,932 B | 54 | `/tmp/p06-audit-P04/P04_star_system_map_prototype` |
| P05 | `988257c9d9ad74e57b7c963387c695612ace099aa8e55ed82e0982ac6cc4cbb7` | 670,668 B | 108 | `/tmp/p06-audit-P05/helios-ai-transaction-lab` |

Alle Archivprüfungen und Extraktionen endeten mit Exit 0. P03 enthielt 53 Dateien, P04 36 und P05 74. Verzeichnis-Einträge erklären die höheren ZIP-Eintragszahlen.

### 2.2 Laufzeit und Browser

- Node.js: `v24.14.0`
- npm: `11.9.0`
- Browser: Chromium `149.0.7827.0`
- P02 bis P05 Browserharness: Playwright `1.62.1`
- Isolierte Ports: P01 `4171`, P02 `4172`, P03 `4173`, P04 `4174`, P05 `4175`
- Alle Server wurden nach dem Audit beendet; die Ports waren danach nicht mehr erreichbar.

Die Umgebung setzte global `NPM_CONFIG_CACHE=/root/.npm`. Dieser Pfad war im Auditcontainer nicht anlegbar und überstimmte bei P03 bis P05 die paketinterne `.npmrc`. Deshalb ist bei jedem Paket sowohl der unveränderte Erstfehler als auch die danach verwendete, explizite Umgebungsnormalisierung protokolliert. Es wurden keine Source-, Script- oder Lockfile-Abweichungen still repariert.

### 2.3 Source- und Mutationskontrolle

P01, P03, P04 und P05 behielten `package.json` und `package-lock.json` byteidentisch. P02s dokumentiertes `npm install` ergänzte mit npm 11 ausschließlich `packages[""].license = "UNLICENSED"` im Lockfile. Der ursprüngliche Hash `b730f91c...` wurde zu `59492ed8...`. Diese Package-Manager-Mutation wurde nicht zurückgesetzt und als Reproduzierbarkeitsdefekt dokumentiert.

P01s und P02s vorgebautes `dist/` wurde byteidentisch reproduziert. P05s Rebuild änderte secret-bezogene Vinext-Manifeste, weil ein neuer Prerender-Wert generiert wurde. Audit-erzeugte `node_modules/`, `dist/`, `.sites-runtime/`, `.wrangler/`, Test- und Cachepfade werden nicht dem Originalarchiv zugerechnet.

## 3. Framework-, Paketmanager- und Dependency-Inventar

Alle direkten Versionen sind exakt gepinnt. Die vollständigen transitiven Auflösungen sind durch Lockfile v3, Lockfile-Hash und Package-Eintragszahl gebunden. Es wurde kein Upgrade oder Ersatz vorgenommen.

| Paket | Framework und Toolchain | Paketmanager und Engine | Lockfile-Evidence |
|---|---|---|---|
| P01 | React `19.2.6`, React DOM `19.2.6`, TypeScript `5.9.3`, Vite `8.0.13`, `@vitejs/plugin-react 6.0.2` | npm, Node `>=22.13.0`, kein `packageManager`-Pin | v3, 55 Package-Einträge, SHA-256 `16b085123813780ca74946305bd0ef37c7ebfbdfea907252ae692329c4871ab8` |
| P02 | React `19.2.8`, React DOM `19.2.8`, `@xyflow/react 12.11.3`, TypeScript `7.0.2`, Vite `8.2.1`, Vitest `4.1.10`, Playwright `1.62.1` | npm, README: Node `^20.19.0 || >=22.12.0`, kein `packageManager`-Pin | v3, 123 Package-Einträge, Original-SHA-256 `b730f91c876a8a0017c898a9990a757c6ecf4f1bf498856c8298db6eed423b17` |
| P03 | React/Next-kompatible App über Vinext `0.0.50`, Vite `8.0.13`, Next `16.2.6`, React `19.2.6`, React DOM `19.2.6` | npm, Node `>=22.13.0`, kein `packageManager`-Pin | v3, 709 Package-Einträge, SHA-256 `283dbdf55081ff6e460baff80764f39f722f13a0720e1a5fa13153ea877051a5` |
| P04 | wie P03 | wie P03 | wie P03 |
| P05 | wie P03 | wie P03 | wie P03 |

### 3.1 Exakte direkte Dependencies P01 und P02

**P01 Dependencies:** `react 19.2.6`, `react-dom 19.2.6`.  
**P01 Dev Dependencies:** `@types/react 19.2.14`, `@types/react-dom 19.2.3`, `@vitejs/plugin-react 6.0.2`, `typescript 5.9.3`, `vite 8.0.13`.

**P02 Dependencies:** `@xyflow/react 12.11.3`, `react 19.2.8`, `react-dom 19.2.8`.  
**P02 Dev Dependencies:** `@playwright/test 1.62.1`, `@types/node 26.2.0`, `@types/react 19.2.18`, `@types/react-dom 19.2.4`, `@vitejs/plugin-react 6.0.5`, `typescript 7.0.2`, `vite 8.2.1`, `vitest 4.1.10`.

### 3.2 Exakte direkte Dependencies P03, P04 und P05

Die drei Pakete haben dieselben direkten Versionen:

**Dependencies:** `drizzle-orm 0.45.2`, `next 16.2.6`, `react 19.2.6`, `react-dom 19.2.6`.

**Dev Dependencies:** `@cloudflare/vite-plugin 1.37.1`, `@tailwindcss/postcss 4.2.1`, `@types/node 22.19.19`, `@types/react 19.2.14`, `@types/react-dom 19.2.3`, `@vitejs/plugin-react 6.0.2`, `@vitejs/plugin-rsc 0.5.26`, `drizzle-kit 0.31.10`, `eslint 9.39.4`, `eslint-config-next 16.2.6`, `react-server-dom-webpack 19.2.6`, `tailwindcss 4.2.1`, `typescript 5.9.3`, `vinext 0.0.50`, `vite 8.0.13`, `wrangler 4.92.0`.

Die Lockfile-Root-Identität heißt bei P03 bis P05 noch `site-creator-vinext-starter`, während die jeweiligen `package.json` andere Paketnamen tragen. Das ist Scaffold-/Provenienzdrift und vor einer Adoption bewusst zu bereinigen.

## 4. Source-, Test-, Fixture-, Screenshot- und Buildpfade

| Paket | Source | Tests | Fixtures/Examples | Screenshots | Build/erzeugte Lieferartefakte |
|---|---|---|---|---|---|
| P01 | `src/main.tsx`, `src/components/EditorShell.tsx`, `src/styles.css` | `tests/contracts.test.mjs` | `src/data/editor.mock.json` | `screenshots/*.png`, vier PNGs plus `manifest.json` | `dist/index.html`, ein JS-, ein CSS-Asset, im Archiv enthalten |
| P02 | `src/App.tsx`, `src/domain/*`, `src/components/*`, `src/hooks/*` | `tests/domain/*.test.ts`, `tests/e2e/editor.spec.ts` | `src/domain/fixtures.ts`, `examples/*.authoring.json`, `examples/*.compiled.json` | `docs/screenshots/*.png`, vier PNGs | `dist/` im Archiv; Capture- und Static-Serve-Scripts unter `scripts/` |
| P03 | `app/*`, `worker/*`, `build/sites-vite-plugin.ts`, `db/*` | `tests/rendered-html.test.mjs` | `fixtures/mesa-crossing.mock.json`, generisches `examples/d1/*` | `screenshots/*.png`, drei sichtbare `PENDING CAPTURE`-Platzhalter | kein `dist/` im Archiv; mitgeliefert: `.vinext/fonts/*`, `tsconfig.tsbuildinfo` |
| P04 | `app/*`, `worker/*`, `build/sites-vite-plugin.ts`, `db/*` | `tests/rendered-html.test.mjs` | Star-System-/Route-/Overlay-Fixtures in `app/page.tsx`, generisches `examples/d1/*` | `screenshots/*.png`, drei echte PNGs | kein `dist/` im Archiv |
| P05 | `app/*`, `worker/*`, `build/sites-vite-plugin.ts`, `db/*` | `tests/rendered-html.test.mjs` | synthetischer Transaction-Flow in `app/page.tsx`, generisches `examples/d1/*` | nur `docs/screenshots/README.md`, keine PNGs | `dist/` mit 40 Dateien im Archiv, inklusive secret-bearing Servermanifesten |

### 4.1 Mitgelieferte oder versehentlich mitgelieferte Artefakte

- P01 und P02 liefern absichtlich `dist/` und kuratierte Screenshots mit. Beide Builds reproduzierten die gelieferten `dist`-Bytes.
- P03 liefert `.vinext/fonts/` und `tsconfig.tsbuildinfo` mit. Die Fonts haben keine paketinterne Lizenz-/Attributionsdatei. Die drei Bilder sind Platzhalter und keine Evidence.
- P03 bis P05 enthalten Sites-/Cloudflare-Starterreste wie `app/chatgpt-auth.ts`, `db/`, `drizzle/`, `worker/` und `examples/d1/`, obwohl die geprüften Prototype-Flows sie nicht benötigen.
- P04 liefert echte Screenshots, aber kein `dist/`.
- P05 liefert ein vorgebautes `dist/` mit Deployment-Metadaten und einem Prerender-Secret. Dieses `dist/` ist zu verwerfen.
- Die Auditläufe erzeugten nur in den temporären Extraktionen `node_modules/`, `.sites-runtime/`, `.wrangler/`, `dist/`, Caches und kleine Teststatusdateien. Nichts davon wurde in die Archive zurückgeschrieben.

## 5. Lizenz, Provenienz, Secrets und private Daten

| Paket | Lizenz/Provenienz | Secrets/private Daten | Urteil |
|---|---|---|---|
| P01 | Keine Projektlizenz, kein `license`-Feld, keine `LICENSE`, `NOTICE`, Third-Party- oder Provenienzdatei | Keine Secrets. Fixture-Akteur `Benni` und Avatar `BH` sind niedrig-sensitive persönliche/pseudonyme Darstellungsdaten. | Vor externer Weitergabe neutralisieren und Rechte/Provenienz ergänzen. |
| P02 | `package.json`: `UNLICENSED`; `THIRD_PARTY_NOTICES.md` mit wesentlichen direkten/transitiven Lizenzen und Links; kein Source-Commit | Keine Secrets oder privaten Daten gefunden. | Third-Party-Dokumentation ist besser als bei den anderen Paketen, autorisiert aber keine Codeadoption. |
| P03 | Keine Paketlizenz/Notice/SBOM; Delivery Note nennt lokalen Commit, ZIP-Kommentar enthält einen anderen unverbundenen Identifier; Lockfile-Root driftet; Fonts ohne paketinterne Attribution | Keine Credentials oder Nutzerwerte. `.openai/hosting.json` enthält einen redaktierten Deployment-Identifier, nicht als Credential nachgewiesen. | Provenienzkette unvollständig; Hosting-Metadaten aus portablem Source-Paket entfernen oder deklarieren. |
| P04 | Keine Paketlizenz, Notice, SBOM oder Provenienzdatei; Lockfile-Root driftet | Keine Secrets/private Daten gefunden; Hosting-Datei ohne Project-ID. | Rechte/Provenienz vor Adoption klären. |
| P05 | Keine Paketlizenz, Notice, SBOM oder versionierte Provenienz; Lockfile-Root driftet; projektspezifische Hosting-Metadaten | Kritisch: derselbe nichtleere 64-stellige Hex-`prerenderSecret` steht im Original in `dist/server/vinext-server.json` und `dist/server/ssr/vinext-server.json`. Wert redaktiert. Der Rebuild erzeugt einen anderen Wert. | `BLOCKED`: nicht weitergeben; Secret invalidieren/rotieren; `dist/` und Deployment-Metadaten entfernen; source-only neu paketieren und reauditieren. |

Der P05-Befund sagt nicht, dass eine konkrete Ausnutzung nachgewiesen wurde. Er sagt, dass ein ausdrücklich als Secret bezeichnetes, nicht reproduzierbares Build-Token im Distributionsarchiv liegt und deshalb nach einem fail-closed Packaging-Standard nicht akzeptiert werden kann.

## 6. Dokumentierte lokale Install-, Build-, Lint- und Testschritte

### 6.1 Vollständiges Befehlsprotokoll in Ergebnisform

| Paket | Dokumentierter Schritt | Exit/Ergebnis | Evidence-Grenze |
|---|---|---|---|
| P01 | `npm install` | Erst Exit 254 wegen externem `/root/.npm`; derselbe Befehl mit tasklokalem `NPM_CONFIG_CACHE` Exit 0 | Umgebungsnormalisierung, kein Paketfix |
| P01 | `npm run build` | Exit 0 | `tsc --noEmit`, Vite-Build, `dist` byteidentisch |
| P01 | `npm run check` | Exit 0, 4/4 Tests | Kein separates Lint- oder E2E-Script dokumentiert |
| P02 | `npm install` | Erst Exit 254; derselbe Befehl mit tasklokalem Cache Exit 0 | npm 11 ergänzt `UNLICENSED` im Lockfile |
| P02 | `npm test` | Exit 0, 13/13 Tests | Domain-/Runner-Tests |
| P02 | `npm run build` | Exit 0 | `dist` byteidentisch |
| P02 | `npx playwright install chromium` | Exit 1 im Defaultpfad; auch mit Temp-Pfad Exit 1 wegen ungültigem/0-MiB-CDN-ZIP | Saubere paketgetriebene Browserakquise in dieser Umgebung nicht reproduziert |
| P02 | `npm run test:e2e` mit vorhandenem Chromium 149 | Exit 0, 6/6 E2E | Browserersatz transparent, keine Paketänderung |
| P02 | `npm run capture` mit vorhandenem Chromium 149 | dreimal Exit 0 | Drei von vier Zuständen nicht pixelstabil |
| P03 | `npm ci` | Erst Exit 254; `env -u NPM_CONFIG_CACHE npm ci` Exit 0, 507 Pakete | Maßgeblicher README-Pfad; paketdefinierter `install:ci`-Hilfslauf separat offengelegt, nicht als Ersatz gewertet |
| P03 | `npm run build` / `validate:artifact` / `lint` / `test` | jeweils Exit 0; Test 1/1 | Test ist nur ein schmaler Render-/Metadatencheck |
| P04 | `npm ci` | Erst Exit 254 wegen externem Cache | Unveränderter dokumentierter Erstversuch festgehalten |
| P04 | paketdefiniertes `npm run install:ci` | Exit 0, 507 Pakete | Paketlokaler robuster npm-ci-Wrapper, keine Source-/Lockänderung |
| P04 | `npm run build` / `validate:artifact` / `lint` / `test` | jeweils Exit 0; Test 1/1 | Keine paketinterne Interaktions-/Import-/A11y-Suite |
| P05 | `npm ci` | Erst Exit 254 wegen externem Cache | Unveränderter dokumentierter Erstversuch festgehalten |
| P05 | paketdefiniertes `npm run install:ci` | Exit 0, 507 Pakete | Paketlokaler robuster npm-ci-Wrapper, keine Source-/Lockänderung |
| P05 | `npm run build` / `validate:artifact` / `lint` / `test` | jeweils Exit 0; Test 1/1 | Build rotiert Prerender-Wert; Test belegt nicht den Transaction-Flow |

P01 und P02 dokumentieren `npm install`, nicht `npm ci`; deshalb wurde dort kein undokumentiertes `npm ci` erfunden. Die fehlgeschlagenen Installationsversuche und partiellen `node_modules` blieben auf die temporären Arbeitskopien beschränkt und wurden für den nächsten identischen Installbefehl nur innerhalb dieser Tempordner beiseitegelegt.

## 7. Browser-, Keyboard-, Fokus-, Responsive- und TestBridge-Matrix

| Paket/Port | sichtbare Mock-/Prototype-Grenze | Browserhealth | Keyboard/Fokus | Responsive | globale mutierende TestBridge |
|---|---|---|---|---|---|
| P01 / 4171 | `P01 PROTOTYPE`, `MOCK DATA`, `MOCK · DERIVED` | HTTP 200; 0 Console-, Page- oder Requestfehler; nur lokale Assets | Toolshortcut, Eingabeschutz, Hierarchy-Enter und sichtbarer 2-px-Fokus bestehen | 1600x1000 und 768x1024 ohne globalen Overflow; responsive History per UI geprüft | keine in Source oder Runtime |
| P02 / 4172 | `ISOLATED PROTOTYPE · MOCK DATA`, Footer `no product integration` | HTTP 200; 0 Console-, Page- oder Requestfehler; nur lokale Assets | Undo-Schutz im Feld besteht; Graphknoten tab-fokussierbar, aber ohne sichtbaren Fokus und Enter/Space ohne Auswahl | Desktop sauber; bei 768x1024 bleibt Shell 1180 px breit, neun Controls off-screen | keine in Source oder Runtime |
| P03 / 4173 | `P03`, `ISOLIERTER PROTOTYP`, `VORGESCHLAGEN`, `MOCK-DATEN`, `NO PERFORMANCE EVIDENCE` | HTTP 200; keine Page Exception, aber elf Font-404/ERR_ABORTED wegen staler `/workspace/sites/...`-Preloadpfade | Toolbar und Shortcuts erreichbar; SVG-Roads/Parcels/Buildings ohne Tabindex, Keyboardhandler und objektbezogene ARIA-Labels | 800x900 ohne Seitenoverflow, aber Dokumentleiste und Inspector ausgeblendet; genaue Validierung nicht zugänglich | keine in Source oder Runtime |
| P04 / 4174 | `FIXTURE MODE`, `NON-VALIDATED PROPAGATION`, `Prototype boundary` | HTTP 200; 0 Console-, Page-, Request- oder HTTP-Fehler; nur lokale Assets | Kartenobjekt-Enter, Modus-/Overlay-/Range-Tastaturpfade bestehen; Handoff-Dialog ohne Initialfokus, Trap und Escape | 1600x1000 und 768x1024 ohne horizontalen Overflow oder abgeschnittene Interaktionen | keine in Source, Build oder Runtime |
| P05 / 4175 | `MOCK FIXTURE`, `KEINE EXTERNE KI`, `KEIN PRODUKT-WRITE`, `ISOLIERTER PROTOTYP` | HTTP 200; 0 Console-, Page-, Request- oder HTTP-Fehler; nur lokale Assets | Skip-Link, Textarea, Aktionen und Owner-Acknowledge per Tastatur; sichtbarer Fokus | 1600x1000 und 768x1024 ohne horizontalen Dokumentoverflow; Step-Leiste bewusst horizontal scrollend | keine in Source, Build oder Runtime |

P03 bis P05s dokumentierter Dev-Start mit `0.0.0.0` scheiterte in der isolierten Laufzeit an `uv_interface_addresses`. Mit dem für die verlangte Portisolation zulässigen Host `127.0.0.1` wurden die Dev-Server bereit. Checkout-gebundene Browserbelege für P03 bis P05 entstanden anschließend über den paketdefinierten Produktionsstart im selben exogenen Auditprozess. Der Harness lag außerhalb der Pakete und stellte keine App-Mutations-API bereit.

## 8. Screenshot- und visuelle Evidence

| Paket | mitgelieferte/angehängte Evidence | frische Checkout-Evidence | Urteil und Grenze |
|---|---|---|---|
| P01 | Drei angehängte Bilder sind byteidentisch zu den Archivbildern; Manifest enthält vier Hashes und kennzeichnet sie als Prototype-Evidence | Overview, Transform Preview und Validation Blocked byteidentisch; Responsive History visuell gleich mit genau einem abweichenden Pixel | Stark für die vier festen Mockzustände, keine Owner-/Produktevidence |
| P02 | angehängtes Overview byteidentisch zum Archiv | Overview in drei Läufen byteidentisch; Runner, Diagnostics und Compile wechseln zwischen Läufen | Semantik sichtbar korrekt, Golden-Capture für 3/4 Zustände nicht stabil; wahrscheinlich fehlender Wait nach `fitView(..., duration: 350)`, als Inferenz markiert |
| P03 | alle drei Archivbilder sind sichtbare `PENDING CAPTURE`-Platzhalter und werden ausgeschlossen | drei frische Bilder aus exakt gebundenem Checkout: Overview, Road Graph, 800-px-Narrow | Visueller Checkout ist belegt, aber Font-404s und Narrow-Inspector-Gap bleiben sichtbar; alte Bilder bleiben ohne Evidence-Wert |
| P04 | drei angehängte Bilder byteidentisch zu den drei Archiv-PNGs | frische Desktop-, 2D-, Handoff- und 768-px-Bilder | Gleiche Struktur/Zustände, geringe Rasterisierungs-/Blur-Abweichungen; keine Behauptung auf Pixelparität |
| P05 | Dokumentation behauptet fünf kuratierte Captures, Archiv enthält aber keine PNGs | sechs frische Bilder: Initial, Validator, Approval, Mock-Commit, Mock-Undo, 768 px | Frischer Checkout belegt; historischer/gelieferter Visualstatus bleibt mangels PNGs `UNVERIFIED` |

### 8.1 Relevante Screenshot-Hashes

**P01 Archiv/Referenz:** Overview `f7f6f598...`, Transform Preview `020e570c...`, Validation Blocked `564dee71...`, Responsive History `d33bf401...`. Der frische Responsive-Hash ist `52e11381...`, bei genau einem abweichenden Pixel.

**P02 Archiv:** Overview `8441fc60...`, Runner `6d6de47a...`, Diagnostics `d758dd4c...`, Compile `5518a296...`. Frische Diagnostics- und Compile-Hashes wechselten in drei Läufen; deshalb keine stabile Pixel-Golden-Aussage.

**P03 frisch:** Overview `06434f7b210015a54e4232ca2f4698c487df1504b47b0d5bc558f840252c707b`; Road Graph `bf1fafcaa1277d8b0505473dcf80a65120d76e70957161bcf3969e47d9589ce6`; Narrow `2ff3faac28ff1fddc21ed1ffaefeffdf312de1c13effdb27a29c5f1d2d81b865`.

**P04 Archiv/Upload:** 2D `f21a2819...`; 3D `3bfe778b...`; Handoff `538a6bd0...`. Frisch: Desktop `79a89045...`; 2D `98dc0d98...`; Handoff `a73953e3...`; Narrow `4872b590...`.

**P05 frisch:** Initial `72ab1548...`; Validator `82f91d7e...`; Approval `45eb15f4...`; Mock-Commit `5bbfcc54...`; Mock-Undo `0e03226f...`; Narrow `5db52fde...`.

## 9. Paketdossiers und Adoption

### 9.1 P01 Editor Shell

**Status:** `PASS`  
**Primäre Adoption:** `ADAPT`

P01 ist der technisch sauberste der fünf Prototypen. Build und 4/4 Contracttests bestehen, die gebaute Ausgabe ist reproduzierbar, Browserhealth und die geprüften Keyboard-/Responsive-Pfade sind sauber. Der Status gilt nur für die Shell- und Mock-Transaktionsdarstellung.

**Preserve**

- sichtbare Trennung von committed Fixture-Authority, Draft, Validation Report und abgeleiteter Presentation;
- Preview-Validate-Commit-Reihenfolge und Invalidierung einer veralteten Validation;
- monotone Revisionen, inverse/replay Commands und klarer Issues-Bereich;
- dieselbe Proposal-Grenze für menschliche, Asset- und Mock-Copilot-Eingänge.

**Adapt**

- UI an den headless G02/G17-Command-Core und den alleinigen Authoring Gateway anbinden;
- COW-Preview, exakten Base-Digest, Revalidierung, CAS und Receipt als echte Verträge ergänzen;
- `Benni`/`BH` durch neutrale Fixture-Akteur-ID ersetzen;
- Lizenz, Third-Party-Notice und Source-Provenienz ergänzen;
- die vier Szenarien als paketinterne semantische Browsertests automatisieren.

**Discard**

- `editor.mock.json`, lokale History und Mock-Viewport als Produkt-Authority;
- feste `-6...+6`-Regel, Mock-AI-Antworten und hardcodierte Produktwerte;
- jeden Schluss auf Produktrenderer oder Performance.

**Technische Evidence-Grenze:** kein paketinterner Browser-E2E-/Capture-Runner; der Audit reproduzierte die vier dokumentierten Zustände exogen.  
**Visuelle Evidence-Grenze:** sehr starke Parität für diese Fixture, aber keine visuelle Owner-Freigabe.  
**Kleinster nächster Schritt:** ein UI-freier `EditorTransactionV0`-Vertrag nur für `TransformSet` mit `baseRevision`, `draftDiff`, `validationReport`, Human Commit, Receipt sowie gültigem, stale und blockiertem JSON-Golden. Noch kein Produktadapter.

### 9.2 P02 Mission Graph Editor

**Status:** `PARTIAL`  
**Primäre Adoption:** `ADAPT`

P02 hat die breiteste funktionale Testsuite: 13 Unit- und sechs echte UI-E2E-Pfade. Die Domaintrennung und die deterministische Compile-Idee sind verwertbar. Der aktuelle React-Flow-Editor überspringt jedoch die für G05 erforderliche vorherige, UI-freie Contract-/Registry-/Compiler-Freigabe. Responsive, Graphkeyboard und Capture-Stabilität verfehlen G14/G17.

**Preserve**

- typisierte `flow`-, `success`- und `failure`-Ports und Kardinalitätsdiagnostik;
- Trennung von Authoring- und kanonischer Runtime-Ausgabe;
- atomaren Import, Cycle/Unreachable-Diagnostik, Step Guard und einmalige Mock-Effekte als Vertragshypothesen;
- Domain-Tests und sichtbare Mock-/no-product-integration-Grenze.

**Adapt**

- zuerst G05 S0/S1: geschlossenes MissionGraph-Schema, Registry, pure Validation, Compiler, Simulator und typed Effect Plan;
- Condition-String durch reine typisierte AST ersetzen und Failure-/Dialogue-Semantik entscheiden;
- React Flow ausschließlich als austauschbare Projektion behandeln;
- Node-Fokus und Enter/Space-Selektion reparieren, 768-px-Scope entscheiden und gated testen;
- Capture-Ready-Handshake nach stabiler Layout-/Viewport-Animation einführen;
- npm-11-Lockfile-Mutation bewusst normalisieren und sourcegebunden dokumentieren.

**Discard**

- FNV-1a-32 als Integritätsnachweis;
- simulierten Runner und Fixture-Effekte als Produktlaufzeit;
- 1-MB-Importlimit und Mock-Rewards als Produktwerte;
- aktuellen 768-px-Zustand und Captures 2 bis 4 als Golden-Evidence.

**Technische Evidence-Grenze:** Paketbrowser-Download scheiterte; E2E lief mit vorhandenem, versionsbekanntem Chromium.  
**Visuelle Evidence-Grenze:** Overview stabil, drei dynamische Zustände semantisch korrekt, aber nicht pixelstabil.  
**Kleinster nächster Schritt:** ein UI-freies `MissionGraphV1.1`-Golden mit stabilen ID-Regeln, reiner Condition-AST, expliziter Failure-Entscheidung und kanonisch identischen Bytes nach Authoring-Roundtrip und Compile. Keine React-Flow-, Savegame- oder Spielruntime-Integration.

### 9.3 P03 Settlement Editor

**Status:** `PARTIAL`  
**Primäre Adoption:** `ADAPT`

P03s Delivery Note warnt ausdrücklich vor fremden parallel laufenden Sites. Deshalb wurden weder alte Ports noch die drei `PENDING CAPTURE`-Bilder als Evidence akzeptiert. Der Audit band PID, Port, CWD und Prozess an den extrahierten Checkout und erfasste drei neue Screenshots. Genau diese Vorgehensweise hebt den visuellen Unterbereich aus `UNVERIFIED`, ohne die fachlichen Verträge aufzuwerten.

**Prototypevertrag Road Graph:** Ausgang 2 Roads, 1 Junction, 20 Parcels, 2 Buildings, Fixture-Hash `fnv1a32:483e3cf2`. Ein Road-Draft mit drei Anchors erzeugte `R003`, 3 Roads, 2 Junctions und 28 Parcels, Hash `fnv1a32:a568c482`. Undo stellte Ausgangshash und Darstellung exakt wieder her; Redo stellte denselben Road-Zustand wieder her.

**Prototypevertrag Parcel Stability:** Für genau diesen Commit entstanden acht Parcels deterministisch, und die sichtbare Parcel-Präsentation war innerhalb derselben Session über Undo/Redo reversibel. Nicht belegt sind stabile Identitäten über Einfügereihenfolge, Geometrieänderungen, Versionen, Prozesse, Kollisionsfälle oder Parcel-Lineage.

**Prototypevertrag Save/Load:** Save erzeugte ein 2,611-Byte-Envelope mit `schemaVersion: p03-settlement-editor/1`, `mock: true` und passendem Fixture-Hash. Ein ungültiges Schema wurde ohne Weltmutation abgelehnt. Der gültige Load startete jedoch aus einem Zustand, der wegen fokussiertem Button nicht nachweislich vom gespeicherten Zustand abwich. Eine echte Wiederherstellung bleibt deshalb `UNVERIFIED`.

**Preserve**

- klare Mock-/Proposed-Grenze, Draft-vor-Commit und verständliche Ablehnungsgründe;
- versioniertes Save-Envelope als Contractskizze;
- visuelle Settlement-Shell und Undo/Redo-Interaktionsmodell;
- semantische Snapping-, Road-ID- und Parcel-Lineage-Fragen als explizite Folgearbeit.

**Adapt**

- `RoadGraphV1`, `ParcelDerivationV1` und Save-Vertrag headless und rendererfrei definieren;
- quantisierte stabile Node-/Edge-/Parcel-IDs, Lineage, Canonical Serialization und echte Digests ergänzen;
- FeatureGraph-/Domain-Authority statt React-State und Offset-Reihenfolge verwenden;
- Font-URLs, Paket-/Lockidentität, Lizenz/Attribution und portable Hosting-Metadaten bereinigen;
- SVG-Objekte tastaturfähig machen und Inspector/Validierung im Narrow-Zustand erreichbar halten.

**Discard**

- aktuelle Polyline- und Offset-Lot-Logik als Produkt-Road-/Parcel-Authority;
- FNV-1a, React-Snapshot-History und Mock-Log als persistente Integrity-/Undo-Lösung;
- radiale Coverage, analytische Terrainwerte und Fixture-Zahlen als Produktsemantik;
- alte `PENDING CAPTURE`-Bilder.

**Technische Evidence-Grenze:** nur ein schmaler Node-Test, eine Fixture und eine Road-Sequenz; Fontpreloads referenzieren einen fremden/stalen Sites-Pfad.  
**Visuelle Evidence-Grenze:** frischer Checkout echt belegt; Fallback-Fonts, fehlender Narrow-Inspector und fehlende Kartenkeyboard-Bedienung bleiben.  
**Kleinster nächster Schritt:** ein headless `RoadGraphV1 + ParcelDerivationV1`-Runner mit fünf kanonischen Fällen für Endpoint-Snap, Segment-Split, Kreuzung, Kollinearität und Tie-Break. Ableitung zweimal und mit permutierter Eingabe ausführen; IDs, Geometrie, Reihenfolge und kanonischen Hash vergleichen. Danach separat ein Save/Load-Restore aus tatsächlich verschiedenem In-Memory-Zustand.

### 9.4 P04 Star System Map

**Status:** `PARTIAL`  
**Primäre Adoption:** `ADAPT`

P04 eignet sich als visuelle, read-only G10-Projektion desselben Fixture-/View-State in 2D und 3D. Die sichtbare Markierung stellt klar, dass Orbit, Propagation, ETA, Fuel, Delta-v und Risiko nicht validiert sind. Der zentrale Handoff-Dialog verletzt jedoch den Tastatur-/Fokusvertrag.

**Preserve**

- gemeinsamen stabilen Selection-/View-State für 2D und 3D;
- `bodyId`, `parentId`, `frameId` und explizite Anzeigeepoche als Contract-Shape;
- read-only Timeline, Overlay-/Quellen-/Risikokennzeichnung;
- Surface-Site-Handoff als sichtbaren Stub, nicht als Integration;
- klare Fixture-/non-validated-boundary.

**Adapt**

- React-interne Contracts in `CelestialSystemDocumentV1`, `StarSystemMapViewStateV1` und `SurfaceSiteHandoffV1` überführen;
- explizite Frames, Epoch, SI-Einheiten, Source-Digests und reine Ableitungen verwenden;
- echte Orbit-/Transferwerte erst nach dem separaten G10-Math-Spike anbinden;
- Dialog mit Initialfokus, Fokusfalle, Escape und Fokusrestore reparieren;
- versteckten File-Input aus redundanter Tabfolge nehmen;
- Import-, Fokus-, Responsive- und Screenshotzustände automatisieren; Lizenz/Provenienz ergänzen.

**Discard**

- alle Mock-Orbits, ETA-, Fuel-, Delta-v-, Risk- und Propagationswerte als Produktwahrheit;
- SVG-Screenpositionen, Overlayontologie und Fixture-JSON als Savegame oder physikalisches Modell;
- ungenutzte Starter-/D1-Komponenten für eine Adoption.

**Technische Evidence-Grenze:** der Pakettest prüft nur Rendering/Metadaten, nicht Import, Handoff oder Keyboard.  
**Visuelle Evidence-Grenze:** alte und neue Zustände strukturell gleich, aber keine Pixelparität oder Owner-Freigabe.  
**Kleinster nächster Schritt:** read-only Contract-Spike für `CelestialSystemDocumentV1` plus `SurfaceSiteHandoffV1` mit geschlossenen Schemas, stabilen IDs, Epoch/Frame und Source-Digest. Für die UI ein einzelner Modal-Regressionscheck für Open-Fokus, Trap, Escape und Restore. Keine echte Propagation.

### 9.5 P05 AI Copilot Transaction UX

**Status:** `BLOCKED`  
**Primäre Adoption:** `DISCARD` des aktuellen Distributionsarchivs; `ADAPT` ausschließlich der UX- und Contract-Learnings

P05 zeigt verständlich neun synthetische UX-Stufen: Anweisung, Tool-Plan, Dry-run, Validator, Korrekturvorschlag, Diff, Owner Approval, Mock-Commit und Mock-Undo. Der Browserlauf bestätigte: v42 bleibt bis zur Freigabe sichtbar; Blocker sperrt den nächsten Schritt; die Checkbox aktiviert das Owner-Gate; der lokale Mock-Commit zeigt v43; Undo hängt ein Ereignis an und zeigt wieder v42. Das ist ausschließlich flüchtiger React-State.

**Preserve**

- klare Trennung der neun UX-Stufen;
- Blocker-Gate, explizites Owner-Acknowledge und sichtbare Bindung an Base/Plan/Diff;
- append-only dargestelltes, kompensierendes Undo statt Historienlöschung;
- dauerhafte sichtbare Hinweise `KEINE EXTERNE KI` und `KEIN PRODUKT-WRITE`.

**Adapt**

- G11-konforme kanonische Transaction-, Approval-, Commit- und Undo-Receipt-Schemas;
- volle Digests über kanonische Bytes, exakte Base-Revision, independent host revalidation und CAS;
- Host-CommitCoordinator als einziger Writer; KI weiterhin ausschließlich read/propose/preview;
- stale Authority, Intent Drift, Denied Capabilities und Recovery fail-closed testen;
- echte Accessibility- und Contracttests sowie Lizenz/Provenienz ergänzen.

**Discard**

- das aktuelle Archiv mit `dist/` und Deployment-Metadaten;
- hardcodierte Hashes, Zeitstempel, Identität, Authority, Commit und Undo als Produktsemantik;
- Mock-Validator/Mock-Copilot als Security- oder Korrektheitsbeleg;
- jede Aussage, P05 implementiere echte KI, Authority, Persistenz oder Commit.

**Technische Evidence-Grenze:** vollständiger lokaler UX-Flow, aber keine Authentisierung, Capability-Prüfung, echte Validierung, kanonische Digests, CAS, Persistenz, Concurrency oder Recovery.  
**Visuelle Evidence-Grenze:** sechs frische Zustände belegt; die im Paket behaupteten historischen Bilder fehlen.  
**Kleinster nächster Schritt:** zuerst Secret invalidieren/rotieren und source-only ohne `dist/` neu paketieren. Danach isoliert ein geschlossenes `TransactionBindingV1`-Fixture mit canonical digest und einem konkurrierenden Authority-Write zwischen Approval und Commit testen. Erwartung: stale, fail-closed, kein Auto-Rebase und weiterhin kein Produkt-Commit.

## 10. Gemeinsame Matrix gegen G02, G05, G10, G11, G14 und G17

Legende: Die Zellen bewerten nur, welche Prototyp-Learnings als Input taugen. `Kein Authority-Beleg` ist kein Fehler der UI-Demo, sondern eine harte Adoptionsgrenze.

| Zielvertrag | P01 | P02 | P03 | P04 | P05 | P06-Entscheidung |
|---|---|---|---|---|---|---|
| **G02 Unified Authoring Platform**: ein headless Command-Core, genau eine Domain-Authority, Authoring Gateway als einziger Mutationseingang, COW-Preview, Revalidation/CAS/Receipts | Stärkste Shell-/Preview-Validate-Commit-Referenz; lokale Mock-History ist nicht G02 | Graph-UI kann Domainadapter sein, darf aber nicht selbst World-Authority werden | Settlement-UI kann Domainadapter sein; React-State/Mock-Snap ist keine Authority | read-only View/Handoff passt als Projektion, nicht als Writer | Proposal-/Approval-Darstellung passt als UX, kein realer Gateway/Commit | P01 UI-Learnings priorisieren; alle Domains erst hinter gemeinsamen Contract-/Gateway-Spikes adaptieren |
| **G05 Mission, Dialogue, Narrative Authoring**: eigenes headless Schema/Registry/Compiler/Validator/Simulator; typed Effect Plan; React Flow nur Projektion | nur gemeinsame Shellmuster | Primärer Kandidat, aber S2-UI liegt vor akzeptiertem S0/S1; Condition-/Failure-/Digest-Fragen offen | kein direkter G05-Beleg | kein direkter G05-Beleg | kann später Transaction-UX über G05 legen, belegt aber keinen Missionvertrag | P02 nur nach UI-freiem G05-S0/S1-Contract übernehmen; keine direkten Worldwrites |
| **G10 Planet/System/Orbit Editor**: `CelestialSystemDocumentV1` als Authority, explizite Epoch/Frames, 2D/3D als abgeleitete read-only Projektionen, stabiler Surface-Handoff | kein direkter G10-Beleg | kein direkter G10-Beleg | Surface-Seite zeigt Empfängerfragen, aber keinen Celestial-Vertrag | Primärer UI-Kandidat; IDs/View-State/Handoff preserve, gesamte Mockphysik discard | kein direkter G10-Beleg | P04 als read-only G10-Projektion adaptieren; echte Orbit-/Route-Mathematik separat gaten |
| **G11 AI Authoring Copilot**: KI nur read/propose/preview/stage in COW; kein Committool; Host revalidiert, prüft Approval/CAS und schreibt | Mock-Copilot-Grenze grundsätzlich passend, keine echte KI | kann Vorschläge für Missiondiffs darstellen, aber keine Authority | kein AI-Beleg | kein AI-Beleg | Primärer UX-Kandidat; Reihenfolge verständlich, jedoch komplett synthetisch und Packaging blockiert | Nur UX-Learnings übernehmen. Security-/Authority-Vertrag neu und hostseitig bauen; P05-Archiv vorher sanieren |
| **G14 UX Modes / Editor Surface / City / Space**: ein Input-/Focus-/Camera-Owner, klare Kontexte/Overlays/Workspaces, typed Selection, responsive und keyboardfähig | geprüfte Shell- und Narrow-Muster positiv | verfehlt Narrow und Node-Keyboard | verfehlt Kartenkeyboard und Narrow-Inspector | verfehlt Modal-Fokusvertrag | Narrow und Basiskeyboard positiv, kein Screenreader-/Zoomnachweis | P01 als UI-Referenz; P02-P04 A11y-Fixes sind Adoption-Gates; für alle klare Mode-/Selection-Ownership spezifizieren |
| **G17 Editor QA / Validation / Playwright**: semantische Oracles vor Screenshots, echte UI-Aktionen, read-only receipts, Browserhealth, Fokus/Responsive, keine globale Mutationsbridge, keine Performanceaussage | gute exogene Evidence, aber kein paketinterner E2E-Runner | stärkste E2E-Suite; Capture nicht stabil; Narrow/Keyboard ungedeckt | frische PID/Port/CWD-gebundene Evidence, aber Health-/Keyboard-/Load-Lücken | frische Evidence, sauberer Healthcheck, Modal-Regressionsgate fehlt | frischer vollständiger Mock-Flow; Security-Packaging-Gate fällt | Keine globale mutierende TestBridge in allen fünf. G17-Contracttests vor visuellen Goldens ausbauen; niemals Timings als Performance behandeln |

## 11. Cross-Package Preserve, Adapt, Discard

### Preserve

- sichtbare Fixture-/Prototype-Grenzen und explizite Non-Authority-Sprache;
- P01s Shell- und Transaktionsdarstellung;
- P02s typisierte Graph-/Diagnostikideen und Domain-Tests;
- P03s Draft-/Validation-/Rejection-UX und die expliziten Stability-Fragen;
- P04s gemeinsamen 2D/3D-View-State und read-only Surface-Handoff;
- P05s gestufte Proposal-/Validation-/Approval-/Undo-Darstellung.

### Adapt

- alle Verträge in UI-freie, geschlossene, versionierte Schemas überführen;
- genau eine fachliche Authority pro Domain und einen gemeinsamen, alleinigen Mutationseingang verwenden;
- kanonische Serialisierung, kryptografische Digests, COW-Preview, unabhängige Revalidierung, CAS und Receipts ergänzen;
- G14/G17-Keyboard-, Fokus-, Narrow-, Health- und Capture-Gates als harte Akzeptanzbedingungen behandeln;
- Lizenz, Third-Party-Attribution, Source-/Build-Provenienz und source-only Packaging vereinheitlichen.

### Discard

- alle Fixturewerte, Mock-Validatoren, FNV-Hashes, React-State-Historien und vorgebauten UIs als Produkt-Authority;
- P03s aktuelle Road-/Parcel-Algorithmen und P04s Mockphysik als Produktsemantik;
- P05s aktuelles `dist/` und jede Interpretation seines lokalen Commits als echten Commit;
- Screenshots ohne Checkout-/Zustandsbindung und jede Performanceableitung aus Browser- oder Testtimings.

## 12. Priorisierte nächste Schritte

| Priorität | Schritt | Abschlusskriterium |
|---:|---|---|
| 0 | P05-Archiv sperren, Prerender-Secret invalidieren/rotieren, `dist/` und projektspezifische Deployment-Metadaten entfernen, source-only neu liefern | Secret-/Private-Scan ohne Treffer; neuer Archivhash; dokumentierter Source-/Build-Ursprung; Reaudit |
| 1 | P02 Graphkeyboard, sichtbaren Fokus, 768-px-Scope und Capture-Ready reparieren | Enter/Space selektiert; sichtbarer Fokus; keine off-screen Kernaktion im akzeptierten Scope; drei identische Captures nach Ready-Signal |
| 2 | P03 Fontpfad, Kartenkeyboard, Narrow-Inspector und echten Save/Load-Restore reparieren | 0 Browserfehler; SVG-Objekte keyboardfähig; Validierung narrow erreichbar; Restore startet aus anderem Hash und stellt gespeicherten Hash her |
| 3 | P04 Handoff-Dialog reparieren | Initialfokus im Dialog; Tab/Shift+Tab bleiben gebunden; Escape schließt; Fokus kehrt zum Öffner zurück |
| 4 | Gemeinsames Packaging-/Provenienzgate für P01-P05 | Lizenzentscheidung, Third-Party-Notice/SBOM, Source-Revision, Buildrezept, Artifact-Manifest, kein Secret/PII und konsistente Lockfile-Root-Identität |
| 5 | Danach die fünf kleinsten UI-freien Contract-Spikes aus den Paketdossiers ausführen | deterministische Goldens und negative Tests bestehen, weiterhin keine Produktintegration |

## 13. Robustheitschecks und offene Evidence

- **Installationsrobustheit:** Die initialen Cachefehler waren extern verursacht. P01/P02 benötigen weiterhin eine dokumentierte portable Cache-/Offline-Strategie; P03 bis P05 enthalten bereits Wrapper, deren Hauptdokumentation jedoch konsistent gemacht werden sollte.
- **Buildreproduzierbarkeit:** P01/P02 reproduzieren `dist`. P03/P04 hatten kein geliefertes `dist`. P05 rotiert secret-bezogene Buildbytes und darf Buildoutput deshalb nicht als Source-Archivbestand führen.
- **Browserabdeckung:** Chromium-only. Kein Safari-, Firefox-, Touch-, Screenreader-, 200-Prozent-Zoom- oder 320-px-Nachweis.
- **Security:** Statische und Runtime-Scans fanden keine globale mutierende TestBridge. Das ist kein vollständiger Security-Audit. Besonders P05s Capability- und Commitgrenzen sind reine UX.
- **Fachkorrektheit:** Keine echte Mission-, Road-, Parcel-, Celestial-, Orbit-, Route-, AI-, Savegame- oder World-Authority wurde ausgeführt.
- **Performance:** Es wurden keine verwertbaren Leistungswerte erhoben. Builddauer, Serverstart und Testlaufzeit sind Diagnostik und werden nicht als Produktperformance interpretiert.
- **Visuelle Freigabe:** Keine Aufnahme ersetzt die vom Addendum verlangte visuelle Owner-Freigabe.

## 14. Quellen- und Evidence-Basis

### Projektweite Leitplanken

- `WELTRAUM_PROJECT_INSTRUCTIONS_ADDENDUM(1).md`
- `WELTRAUM_PROJECT_MEMORY(1).md`
- `03-WELTRAUM_RESEARCH_REGISTER-1-.md`
- `G02_unified_ingame_authoring_platform_abschlussbericht_2026-08-12(2).md`
- `G05_Mission_Dialog_Narrative_Authoring_Abschlussbericht_2026-08-12(2).md`
- `G10_Planet_System_Orbit_Editor_Abschlussbericht_2026-08-12(2).md`
- `G11_AI_Authoring_Copilot_Abschlussbericht_2026-08-12(2).md`
- `G14_UX_MODES_EDITOR_SURFACE_CITY_SPACE_ABSCHLUSSBERICHT_2026-08-12(2).md`
- `G17_Editor_QA_Validation_Playwright_Automation_Abschlussbericht_2026-08-12(2).md`

### Paketinterne Evidence

- alle fünf `README.md`/Findings-/Delivery-/Acceptance-Dokumente, `package.json`, `package-lock.json`, Source, Tests, Fixtures, Buildskripte und mitgelieferten Screenshots;
- dokumentierte Befehlsausgaben und Exitcodes aus den getrennten temporären Checkouts;
- frische Browserprotokolle für P01 bis P05;
- frische checkout-gebundene Screenshots für P01 bis P05, wobei P03-Archivplatzhalter und P05s fehlende Altbilder ausdrücklich ausgeschlossen bleiben;
- statische und Runtime-Prüfung auf globale mutierende Testbridges sowie zielgerichtete Secret-/Private-Data-Suche.

## Schlussurteil

**Status: `REQUIRES_FIX`.**

P01 kann als stärkste UI-Referenz in die Synthesevorbereitung gehen. P02, P03 und P04 liefern wertvolle, aber klar begrenzte UX-/Contract-Learnings und benötigen die benannten Accessibility-, Evidence- und Headless-Contract-Fixes. P05s UX-Learnings dürfen diskutiert werden, sein aktuelles Distributionsarchiv darf wegen secret-bearing Buildoutput nicht übernommen oder weitergegeben werden. Keine dieser Aussagen autorisiert Produktintegration.
