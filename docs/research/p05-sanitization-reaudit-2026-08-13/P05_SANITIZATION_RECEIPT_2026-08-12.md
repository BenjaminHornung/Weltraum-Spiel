# P05 Sanitization Receipt

**Auftragsdatum im Dateinamen:** 2026-08-12  
**Tatsächlicher Rebuild-/Re-Audit-Lauf:** 2026-08-13  
**Verdict:** `REQUIRES_FIX`  
**Security-Teilverdict:** Sourcebaum, frischer Build und finales ZIP sind im ausgeführten Scan ohne Secret-Treffer.

## 1. Quarantänisierte Eingabe

| Feld | Wert |
|---|---|
| Archiv | `P05_AI_Copilot_Transaction_UX_Prototype.zip` |
| SHA-256 | `988257c9d9ad74e57b7c963387c695612ace099aa8e55ed82e0982ac6cc4cbb7` |
| Größe | 670.668 Byte |
| ZIP-Einträge | 108, davon 74 Dateien |
| ZIP-Integrität | CRC OK, 0 unsichere Pfade, 0 Symlinks, 0 doppelte Namen |
| Eingangsurteil | `DISCARD / QUARANTINED` |

Der bekannte Credentialwert wurde zu keinem Zeitpunkt ausgegeben, zitiert,
protokolliert, gescreenshottet oder in ein Ergebnisartefakt übernommen. Dieser
Receipt trifft keine Annahme über Gültigkeit oder Nutzung. Rotation oder Widerruf
bleiben ein Owner-/Provider-Schritt außerhalb dieses Auftrags.

## 2. Vollständiges Eingangs-Inventar

Die Kategorien können sich überlappen, weil beispielsweise `.vite`-Manifeste
zugleich Buildoutput und Cachemetadaten sind.

| Klasse | Anzahl | Sanitization-Aktion |
|---|---:|---|
| Source außerhalb `dist/` | 16 | UI und CSS als Ausgangspunkt übernommen; Server-/Startercode verworfen |
| `dist/` / Buildoutput | 40 | vollständig verworfen, keine Datei übernommen |
| Cachemetadaten | 2 | zusammen mit altem Buildoutput verworfen |
| `.env*` | 0 | keine vorhanden; final weiterhin ausgeschlossen |
| Konfiguration außerhalb `dist/` | 8 | Hosting-/Cloud-/DB-Konfiguration verworfen; minimale Vite-/TS-/ESLint-Konfiguration neu erstellt |
| Fixture-/Example-Dateien | 2 | generische D1-Beispiele verworfen; deterministische UI-Fixture in `src/App.tsx` beibehalten |
| Screenshotbilder | 0 | keine vorhanden |
| Screenshotnotizen | 1 | historische Exportnotiz nicht als Evidence übernommen |
| Logs | 0 | keine vorhanden; final ausgeschlossen |
| Source Maps | 0 | keine vorhanden; final deaktiviert und ausgeschlossen |
| Lockfile | 1 | auf Credentialtreffer geprüft und durch ein neues Lockfile für den reduzierten client-only Stack ersetzt |
| Lizenz-/Provenienzdateien | 0 | `PROVENANCE.md` und expliziter Status `UNLICENSED` ergänzt |
| `node_modules` | 0 | keine vorhanden; Installation blieb außerhalb des finalen ZIP |
| Testreports | 0 | keine vorhanden; final ausgeschlossen |
| Browserprofile | 0 | keine vorhanden; final ausgeschlossen |

## 3. Secret-Scan-Receipt

Nur Pfadklasse, Trefferklasse, Anzahl und Aktion werden dokumentiert.

| Scanobjekt | Pfadklasse | Trefferklasse | Anzahl | Aktion |
|---|---|---|---:|---|
| quarantänisiertes Original | Buildoutput | Credential-Assignment | 2 | gesamtes altes `dist/` verworfen |
| ursprünglicher Sourcebaum außerhalb Buildoutput | Source / Config / Fixture / Test | alle geprüften Klassen | 0 | client-only Rebuild |
| ursprüngliches Lockfile | Lockfile | alle geprüften Klassen | 0 | Dependency-Scaffold trotzdem reduziert und neu gebunden |
| bereinigter source-only Stagingbaum | alle enthaltenen Klassen | alle geprüften Klassen | 0 | akzeptiert für ZIP-Erzeugung |
| frischer Build aus finalem ZIP | Buildoutput | alle geprüften Klassen | 0 | nur als temporäre Re-Audit-Evidence verwendet |
| finales source-only ZIP | alle enthaltenen Klassen | alle geprüften Klassen | 0 | Security-Gate bestanden |

Geprüfte Trefferklassen umfassten insbesondere Credential-Zuweisungen,
Provider-Tokenformate, Private-Key-Material, eingebettete URI-Credentials und
Paketmanager-Auth-Tokens. Die Scanausgaben enthalten keine Matchtexte.

## 4. Sanitization- und Rebuild-Aktionen

- Vinext, Next.js, Cloudflare, Sites, Worker, D1, R2, Drizzle, Hostingmetadaten
  und generische Starterbeispiele entfernt.
- P05 als statische client-only React-/Vite-Anwendung neu aufgebaut.
- Sämtliche Runtime- und Dev-Dependencies exakt gepinnt.
- Neues Lockfile v3 mit konsistenter Root-Identität erzeugt.
- Installation ausschließlich mit `npm ci --ignore-scripts` aus diesem Lockfile.
- `dist/`, `node_modules/`, `.env*`, Caches, Logs, Testreports,
  Browserprofile, Source Maps und Deploymentmetadaten durch Allowlist aus dem
  finalen ZIP ausgeschlossen.
- Sichtbare Mockgrenzen und deterministischer Neun-Schritte-Flow beibehalten.
- Kein GitHub-Write, kein Repository-Write, kein Deployment und keine Änderung
  an `Weltraum-Spiel` oder `hestia-voxel-kernel-lab`.

## 5. Reproduktions-Receipt

| Schritt | Ergebnis |
|---|---|
| Node.js | `v24.14.0` |
| npm | `11.9.0` |
| Lockfile | v3, 161 Package-Einträge einschließlich Root, 0 ungebundene Nicht-Root-Einträge |
| Lockfile SHA-256 | `862919cd5dfcf8d472940947fa14817a9e7bfdb35ea0956dad0d6a215d7e2add` |
| `npm ci --ignore-scripts` | PASS, 131 Pakete installiert |
| `npm run lint` | PASS |
| `npm test` | PASS, 3/3 Tests |
| `npm run build` | PASS, client-only, 4 Dateien, keine Source Maps |
| HTTP-Smoke gegen frisches `dist/` | HTML, JavaScript und CSS jeweils HTTP 200 |
| Scan frischer Build | PASS, 0 Treffer in 4 Dateien |
| Rebuild aus finalem ZIP | PASS |

Die npm-Ausgaben enthielten lediglich eine externe Warnung über eine geerbte
`http-proxy`-Umgebungsoption. Sie veränderte weder Lockfile noch Testergebnis.

## 6. Finales Archiv

| Feld | Wert |
|---|---|
| Datei | `P05_SOURCE_ONLY_SANITIZED.zip` |
| SHA-256 | `43088de468f78021dc2b9fd6f6233759a8cbc66816ef7026fda2f32094ae6b10` |
| Größe | 42.696 Byte |
| Dateien | 18 |
| Unkomprimierte Nutzdaten | 149.538 Byte |
| Verbotene ZIP-Pfade / Symlinks / Duplikate | 0 / 0 / 0 |
| Buildoutput / `node_modules` / Env / Logs / Source Maps | 0 / 0 / 0 / 0 / 0 |

## 7. Offenes Pflichtgate

Frische Browser-Screenshots konnten nicht erzeugt werden. Der Cloud-Browser
blockierte Loopback- und lokale Dateizugriffe durch seine URL-Sicherheitsrichtlinie.
Die zuvor im Projektaudit verfügbare lokale Chromium-Binärdatei war nach der
automatischen Workspace-Bereinigung nicht mehr vorhanden. Es wurde kein Browser
nachgeladen und kein Screenshot rekonstruiert oder fingiert.

Da frische Screenshots Pflichtoutput sind, lautet das Gesamturteil trotz
bestandener Secret-Gates:

## Verdict

`REQUIRES_FIX`
