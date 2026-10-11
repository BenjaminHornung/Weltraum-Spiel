# W07 Rendering Availability, Kandidat 2

**AVAILABLE_MESA_SOFTWARE**, ausschließlich WebGL2-Verfügbarkeit auf `about:blank`. Kein Gameplay- oder Performance-PASS.

Tatsächlicher Lauf: 2026-10-11T19:14:47.042545Z bis 19:14:48.656745Z, 1,614 Sekunden, Exit 0, kein 20-Sekunden-Deadlineüberlauf. Node 22/PW bestehen unverändert; Browser meldet Chromium 154.0.8037.57.

Der zweite ausdrücklich freigegebene Kandidat ersetzt die vorher nur vorgeschlagene Xorg-Variante. Identisch zu Probe 1: headless, `--ozone-platform=headless --use-gl=angle --use-angle=gl-egl`, `LIBGL_ALWAYS_SOFTWARE=1`, `EGL_PLATFORM=surfaceless`. Einziger zusätzlicher Launchparameter: `--ignore-gpu-blocklist`. Tatsächliche Browser-/GPU-PIDs und Commandlines stehen im Ergebnis; stderr enthält die echte Launchcommandline.

WebGL2-Kontext erfolgreich, `creationError=null`, `contextLost=false`, Framebufferstatus `36053` entspricht `FRAMEBUFFER_COMPLETE`, GL-Fehler `0`. Tatsächlicher unmaskierter Vendor: `Google Inc. (Mesa)`. Renderer: `ANGLE (Mesa, llvmpipe (LLVM 19.1.7 256 bits), OpenGL ES 3.2)`. Keine SwiftShader-Angabe im ermittelten Renderer. Viewport 1280×720, DPR 1, WebGL 2.0; Extensionliste und Kontextattribute vollständig erfasst.

Browser in `finally` geschlossen. Nachprüfung: keine aktiven eigenen Browser-/GPU-Prozesse; zwei beendete Zygote-Zombies unter PID 1 werden als solche dokumentiert. Kein Displayserver, Vite, Port 5174, Spiel, Native World, Paketupgrade oder Projektwrite. CPU-/GPU-Lease frei.

Probe 1 bleibt unverändert als `UNSUPPORTED_WEBGL2` mit protokolliertem Blocklistfehler erhalten. Die zweite Probe belegt Kontextverfügbarkeit unter dem geänderten Launchparameter. Verbesserung der beobachteten Commit-Wartezeit, echte Spielbedienung und W07-Gate sind **NOT_RUN** und benötigen den nächsten begrenzten Gameplayauftrag. Keine dritte AvailabilityProbe ausgeführt.
