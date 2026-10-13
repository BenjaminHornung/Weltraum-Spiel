# Git-Checkpoint und Vollpaket-Scope

Neuer isolierter Branch feature/hestia-other-pc-handoff-2026-10-13 auf Basis17b1db4201a28e7b607c30707bdc2b75e3484a10. Bestehende A0-/Producer-WIP/Index/Branches bleiben unverändert.

Gitcheckpoint enthält die aktuelle A0-Webprodukt-Source einschließlich Lock/Vendor/WASM/Tests/Skripten, aktuellen Programm-Spec-Source und diese Übergabedokumentation. Zusätzliche Producer-Source-Snapshots werden soweit als aktuelle Source klar zugeordnet mit gesichert. Die vollständige bytegebundene historische Producer-/A0-Evidence, gebundene Originalarchive und administrativen Receipts stehen unabhängig von Gitignore/LFS im vollständigen ZIP-Payload. Ein Gitcheckpoint allein ist kein Ersatz für dieses Vollpaket.

Keine fremden Root-/IDEänderungen, globalen Configs, Authdaten, generierten node_modules/Compiler-/Browsercaches oder manipulierten historischen Reports werden als neuer Produktstand aufgenommen. Code wurde für diesen Wechsel nicht repariert oder adoptiert.

Vor Commit/erstemPush: tatsächlicher finaler Diff in genau diesem Worktree über Plannotator explizit menschlich freigeben. Das bestehende Commit/Push-Verlangen ist Autorität für die Aktion, hebt diese exakte Inhaltsfreigabe nicht auf. Inhaltänderungen invalidieren Review. Danach Commit, Push ohneforce, RemoteRef nachmessen. Tatsächliche Ergebnisse im externen Git/GIT_PUSH_RECEIPT.json des ZIP, damit die CommitSHA nicht selbstreferenziell in den eigenen Commit geschrieben wird.

Gitbundle erfasst vorhandene Refs/Baselines einschließlich alter Branchhistorien. Es transportiert weder alte PC-Sessions noch notwendigerweise GitLFSAssetobjekte. Der Manifest/Restorepayload ist die eigenständige Datenübertragung. Erst neue Ziel-PC-Zuständigkeiten, dann gezielte Weiterarbeit.

