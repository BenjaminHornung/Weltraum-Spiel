# Tools und Setup auf dem Ziel-PC

## Verbindliche Basis und Daten

Windows-Kontext ist bisherige Quelle; Ziel-OS tatsächlich prüfen. Alle Programme/Helper/Builds unter C:\IFI_SourceCode. Empfohlene gleiche Arbeitswurzel C:\IFI_SourceCode\Temp\WeltraumSpiel erleichtert unveränderte historische Bindungen, erteilt jedoch keine neue Runtimeidentität.

| Bestandteil | Tatsächlich gebundener Stand / Bedeutung |
|---|---|
| Node.js | v22.23.2 Win-x64; node.exe86997320B/SHA0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4. Moderne Sourcehelper/ESM; portables Binary im Paket optional benannt. |
| PowerShell | CIFI Utils/PowerShell/pwsh.exe,301368B/SHA db6dd81183fe57d22e03b911ec9a30a2fd7c40542e97743615355a6fb44f458f. Für .NETZIP/Guards/gebundene Commands; Host5.1 nicht still substituieren. Zielversion/Byteumfang prüfen. |
| Git | Aktuell geprüfter portabler Git2.56.0.windows.1 unter Utils/opencode-migration/runtime/git. GitLFS für im Bundle nur als Pointer enthaltene Bilder/3D/Binaries erforderlich; bestehende Zugangsdaten separat auf Ziel-PC anmelden. |
| Codex | Aktuelle Zielinstallation mit gpt-6.1-sol/xhigh, installierten Customrollen/maxThreads10/maxDepth1/jobMaxRuntime3600/noRecursion. CLI/Native/Desktopfunktionen tatsächlich testen; kein globales kopiertes Config-Upgrade. |
| Paseo | Installieren/anmelden und Provider/Profile/Modelle/MCP tatsächlich entdecken. Neue tatsächliche Ziel-PC-Sessions/Workspace, gemeinsame Pi-Reviews, kein Import geschlossener Laptop-Original-A0. |
| Repo dependencies | product package.json/package-lock unverändert: Three0.186.1,types0.186.0,upscaler0.5.0; typescript7.0.2,Vite8.1.5,Vitest4.1.11,Playwright1.61.1,@types/node26.1.1. npm ci erst nach lokalem Vendor/Lock/Pfadcheck im Produktroot, keine latest/^Substitution. |
| Rapier | @hestia/rapier3d-phy01-candidate file:vendor/rapier-phy01-migration2. Echtes SourceforkRapier0.21.0, keine vanilla npm-Ersetzung. Aktuelle196/F26-Paarung, F26WASM3245647B/SHA f26e8ca898782fc1d903971bfa5c71a4b92bd7ed4c32df05e677faee9e18d0bb. Separate125/alte99/.12-Evidence erhalten. |
| Browser/GPU | Passende tatsächlich installierte Browser-/Playwright-Runtime, neue API-/Native-/Context-/Adapterqualifikation, ausschließlich tatsächlicher NVIDIA-Adapter für GPUdiagnose. Alte Chromium151historie ist kein Ziel-PC-Gerätebeleg. |
| Native/.21 rebuilding | Rust/Cargo/wasm-bindgen/wasm-target/native compiler nur falls tatsächliche gebundene Sourcebuild-Rezepturen neu ausgeführt werden. Exakte Versionen aus jeweiligen Producercommands/Cargo.lock/Provenance lesen; gebundene fertige WASM-/Paketbytes im Payload erhalten. Nicht aus fehlendem globalrustc einen fehlenden Kandidaten folgern. |
| Optionale Domänen | Blender5.2 nur tatsächliche Assetaufgabe; Unity/.NET nur Aufgaben mit vorhandenen UnityProject-/Solutionchecks, nicht zwangsläufig für Web-Rapierpilot. DevToolbox/MCP entsprechend Scope, keine globale Installation als stiller Nebenauftrag. |

## Skills und Plugins

Pflicht: I Have ADHD0.4.1, Ponytail5.1.0 FULL; Paseo/local subagent-driven-development, systematic-debugging, verification-before-completion, Plannotatorreview. Sichere Skill-/Rollenprosa im Paket ist Sourcehilfe, keine aktivierte Connectorinstallation.

Game Development Studio1.0.2 nur Assetproduktion/Vendoring/SealedVisual/PerformanceWorkflow. GameUIquality/gameplay-flow für echte HUD-/Input-/Flowarbeit; renderedUI/realInput für entsprechende Abnahme, Buildnichtgenug. SonarQube auf bisherigem Stand NOT_RUN ohne qualifiziertes Tool/Projekt. Auf dem Ziel-PC konfigurieren, wenn verfügbar; nicht vortäuschen, keine privateSourceuploads/Installationen ohne entsprechende Autorität. Designer-/paidProviderjobs nicht aus Pakettext automatisch auslösen.

Pi-Profil am Laptop: Pi-Worker agent_profile_mv5ceqq9_5u79s04l2t7, providerpi/opencode-go/deepseek-v4.1-flash/max. Modellnamespace war kein OpenCodeProviderfallback. Dieses konkrete Profil/Modell auf Ziel-PC rediscovern; vorhandene neue Ziel-PC-Workspacebindung, seriell/Parentwait, keine Projektflut. Reine Pinreviews ehrlich begrenzen.

## Nicht übertragen

Keine auth.json, LocalCredentialwerte, Token/Connections, ProviderDBs, Sessionrohjournale, eigeneBrowserprofile, SSHkeys, .env/.npmrc-Secrets oder Userconfig. Keine laufenden Prozesse, Heap-/PID-/Familienzustände. Rebuildbare node_modules/Pythonvenv/Rusttarget/Caches ausgeschlossen. Es gibt keine automatische Service-/Treiber-/MCP-/Plugininstallation.

## Erstprüfung

Das Produkt kann aus Source gebaut werden, aber Build/CPU sind keine Referenz. Neue Source-/Buildrevision an realen Gitcheckpoint binden. Als erstes nur Setup/Provenance/SHA/Lock/Vendor/Toolbelege prüfen; nach echter Ownership/Autorität begrenzte Fachprüfungen. Alte Hardware-/Slot-/DeadlineFreigaben sind verbraucht und nicht übertragbar.

