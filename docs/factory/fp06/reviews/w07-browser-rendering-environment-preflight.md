# W07: Browser-Rendering-Umgebung, Readonly-Preflight

Stand: 2026-10-11, 19:07–19:10 UTC. Ergebnis: **Source-Preflight PASS; beide Launchkandidaten NOT_RUN.** Keine Browser-, GPU-, Displayserver-, Installations-, Build- oder Renderjobs gestartet; keine Projektdateien, Konfigurationen, Budgets oder gespeicherten Kopien verändert.

Die vom Root übermittelte Trace97-Beobachtung (RendererMain RunTask 8,88 s, Commit 8,384 s Wallzeit bei kleiner Thread-CPU-Zeit) rechtfertigt eine isolierte Backendprüfung. Sie beweist weder eine bestimmte GPU-Ursache noch die Wirksamkeit der folgenden Kandidaten.

## Tatsächlich vorhandene Fähigkeiten

- `/dev/dri`, `/sys/class/drm` und `/tmp/.X11-unix` existieren nicht. DISPLAY/Wayland/XDG_RUNTIME_DIR sind nicht gesetzt. Nutzbare Hardwarebeschleunigung: **UNKNOWN / nicht nachgewiesen**.
- Chromium **154.0.8037.57**, eigenes ANGLE EGL/GLES und `libvk_swiftshader.so` samt `vk_swiftshader_icd.json` vorhanden. Es gibt keine systemweiten Vulkan-ICD-Dateien. Mesa-Vulkan-Treiber sind nicht installiert.
- Mesa **25.0.7**: EGL/GLX/GBM/DRI vorhanden, einschließlich `swrast_dri.so`; GLVND-EGL-Vendor `50_mesa.json` lädt `libEGL_mesa.so.0`. Diese Dateien beweisen keinen funktionierenden Kontext oder Renderer.
- Kein Xvfb, xvfb-run, eglinfo, glxinfo oder vulkaninfo. Vorhanden: **Xorg 21.1.16** und **Dummy-Treiber 0.4.0**. Aktuelle UID 1000; erfolgreicher rootloser Dummy-Start bleibt unbewiesen.
- Die Chromium-Binärdatei enthält `use-gl`, `use-angle`, `gl-egl` und `ozone-platform`. Aktuelle Playwright-Konfiguration wählt nur die vorhandene Chromium-Executable; sie gibt keine eigenen GL-/ANGLE-Argumente vor. Optionenstrings sind kein Launchnachweis.

## Höchstens zwei unverifizierte Kandidaten

**1. Headless ANGLE mit Mesa-EGL statt SwiftShader-Vulkan.** Nur in einer externen Versuchskonfiguration: `headless: true`, zusätzliche Browserargumente `--ozone-platform=headless`, `--use-gl=angle`, `--use-angle=gl-egl`; Browserumgebung additiv `LIBGL_ALWAYS_SOFTWARE=1`, `EGL_PLATFORM=surfaceless`. Alle bisherigen erforderlichen Launchargumente und Umgebungsbindungen erhalten. Ziel ist ein real nachgewiesener Mesa-Software-GL-Kontext; Verfügbarkeit bisher **NOT_RUN**.

**2. Nur falls Kandidat 1 keinen passenden Kontext liefert: privates Xorg-Dummy-Display mit headed ANGLE/Mesa.** Vorhandene Xorg-/Dummy-Software benutzen; eigene Konfiguration, eigener Displayname und Logs, TCP mit `-nolisten tcp` deaktivieren. Kein bestehendes Display verwenden. Browser `headless: false`, Argumente `--ozone-platform=x11`, `--use-gl=angle`, `--use-angle=gl`; additiv `DISPLAY=<eigener Displayname>`, `LIBGL_ALWAYS_SOFTWARE=1`. `EGL_PLATFORM=surfaceless` hierbei nicht setzen. Keine Installation oder Änderung globaler Xorg-Dateien. Bei Zugriffs-/Startfehlern als **UNSUPPORTED** schließen.

## Vor jedem Gameplayversuch

Ein eigener kurzer WebGL2-Verfügbarkeitsprobe muss die **tatsächliche** Browsercommandline, Kontextverfügbarkeit und Vendor-/Rendererwerte erfassen. Automatisches Zurückfallen auf denselben SwiftShader-Vulkan-Renderer ist kein bestätigter Wechsel. Erst anschließend einen begrenzten Gameplayvergleich genehmigen.

Unverändert bleiben Viewport, DPR, Szene, visueller Umfang, Native-/World-Source und alle aktuellen Playwright-/Native-Zeit-, Queue- und Testbudgets. Kein `--disable-gpu`, kein abgesenkter visueller Umfang, keine neue Uhr oder RAF-Beschleunigung. Verfügbarkeit, gemessene Commitlatenz, Material-/Inputkorrektheit und vollständiges W07-Gate sind getrennte Ergebnisse.
