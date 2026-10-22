# Existing Pi / DeepSeek source review

Human-approved existing advisor eb04a70c-fd51-4110-b1e4-480d5c08d8ab, opencode-go/deepseek-v4.1-flash/high, read-only six-minute bound, no new agent/provider. Relevant sources only; no credentials/raw saves. Returned idle with no confirmed defect. Its Bootstrap hash preceded only the final optional load-argument type annotation (7D4196… →2B0E89…); executable behavior is identical. Final Root type check B3_TSC_FINAL_R04 exits0.

## Root adjudication

- The suggested loaded-metadata branch removal is rejected: it is required for warm V5. Only the inner V6 branch overwrites the same Map entry with the pinned42578B, so the charge is not additive/doubled. Separate V6 guards own cleanup creation and cost reservation; removing them is unnecessary cosmetic churn.
- The queried full FNV check exists in client.ts348–353 on the private eight-sector generation, immediately before synchronous Initialize/send with no intervening await. The earlier import at253 captures the function; it does not move the final check. Native reviewers independently checked this path. No extra hash implementation or policy is needed.
- Sidecar actual6775B/UTF1613550B and its final SHA remain authoritative; Pi's6774B wording is not used for admission. Source hashes/census were independently validated in B2.
- East64 ordering, no Hull coverage, full byte/residency accounting and actual normal play/restart stay acceptance gates. Static review is not Runtime PASS. Root full checks and clean-copy gameplay follow.

## Advisor report (source material)

> FP06_REVIEW_FINAL_BEGIN
> Kein bestätigter Defekt im geprüften Slice; ein toter Zweig und drei offene Verifikationspunkte. Dateihashes vor/nach identisch (`hvpBootstrap 7D4196C3…`, `factoryCheckpoint B32BCECF…`, `factorySaveStore 5D85ADFE…`, `client 93793B96…`, `playAssetLoader DF7D5FC9…`, `hullMetadata 7A9BA33F…`, `factorySession 185BF276…`, `factoryEntry 8DE51865…`), HEAD `7ee85b0`, Working Tree erwartungsgemäß modifiziert — dieser Review bezieht sich auf den gelesenen Stand, nicht auf einen eingefrorenen Commit.
>
> 1. `hvpBootstrap.ts:1246-1252` — kein Defekt, aber toter Zweig: `if(loadedMetadataBytes>0)factoryCosts.set("factory:hull-metadata",…loadedMetadataBytes…)` wird zwei Zeilen später durch die feste `FACTORY_HULL_METADATA_CPU_BYTES=42578` überschrieben, und die V6-Versionsprüfung steht doppelt (`1241` und `1250`). Wirkung: keine, der Endwert entspricht der Invariante; minimale Bereinigung: den geladenen-Zweig und die doppelte Guard entfernen, damit die „exactly once per phase"-Reservierung nicht als zwei Pfade missverstanden wird.
>
> 2. Offener Verifikationspunkt, kein behaupteter Defekt: In `client.ts:161-172` werden die privaten Kopien per SHA gegen die Metadatenpins geprüft, der Hull-Kollisionsdigest wird als `metadata.census.nativeCollisionDigest` übernommen; eine Neuberechnung der FNV über die acht tatsächlichen Sektor-Buffer und Vergleich gegen `7a63fed9` unmittelbar vor `pool.start()`/Initialize war im gescannten Bereich nicht sichtbar. Wenn sie nicht in `loadFactoryHullProjection` erfolgt, ist der Pin nur Metadaten-Behauptung statt Bufferprüfung; kleinste Korrektur: FNV auf den privaten Kopien ohne zwischenliegendes `await` direkt vor dem Start berechnen und vergleichen — oder die bestehende Stelle benennen.
>
> 3. Bestätigt positiv: geschlossene V6-Identität in `client.ts:102-110` (Hull-Sektoren verlangen `cargoSourceDigest==="360b00fa"`, V6-Cargo verlangt Hull-Sektoren) sowie die Descriptor-/Own-Keys-/Bounds-Prüfung `:122-148` vor jeder Allokation; `hvpBootstrap.ts:1410` bricht vor dem ersten Hull-`await` ab, `:1438-1443` erzeugt Physics mit Hull-Sektoren und ersetzt sie danach durch ein Render-only-DTO ohne `nativeSectors` statt eines Casts. Damit sind „private Kopien vor dem ersten await", „keine Render-Buffer-Übertragung" und „Abbruch vor Publikation" im Quellbild gedeckt.
>
> 4. Bestätigt positiv, V5-Kompatibilität: `hullMetadata.ts` hält nur das 6 774-B-Sidecar als `?raw`; `playAssetLoader` importiert daraus ausschließlich Typen und lädt das Leaf erst in `readFactoryHullMetadata` per dynamischem Import. Ein nie-V6-V5-Lauf zieht damit weder Hull-Payload noch Sidecar-Graph in den Startgraphen, und die V5-Profile-/Byte-Konstanten bleiben unberührt.
>
> 5. Offen bleiben (statisch nicht entscheidbar, ausdrücklich nicht abgenommen): die Reihenfolge „acht Hull-Sektoren vor dem residenten 64-Sektor-East-Tail" samt `baseSectorCount`/`FullCollisionDigest` und der Nachweis, dass Hull keine zusätzliche Player-Coverage erzeugt; die Peak-Rechnung (`7 752 960 B` Payload + `703 296 B` Native-Kopie + `219 792 B` SHA-Scratch + `329 688 B` FNV-Scratch + Native96 MiB) gegen die unveränderten Caps; sowie die Modul-Residenz des Metadaten-Graphen über ein V6-Dispose→V5-Continue. Das sind Runtime-/Abnahmegates: нормале V6-Spiel, Cold-V6, tatsächlicher Chrome-Neustart und Cap-Fit sind ungelaufen.
> FP06_REVIEW_FINAL_END
