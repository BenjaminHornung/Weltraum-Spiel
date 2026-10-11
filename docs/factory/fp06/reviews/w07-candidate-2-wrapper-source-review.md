# Chromium-Mesa-Wrapper: Selfreview der Quelle

**SOURCE-SCOPE PASS**, kein Wrapper-Browserlauf oder Gameplaynachweis.

Neue Datei: `/workspace/.cloud-setup/bin/chromium-hestia-mesa`, 222 Bytes, Modus 0755, SHA256 `47b081898a76e3f36d43ce06697990adb093ebe2eaeed8ef1b484fa8bffd5ab9`. Erstellung erfolgte exklusiv mit `O_EXCL`; keine bestehende Datei überschrieben. `bash -n` wurde tatsächlich ausgeführt: Exit 0, stdout/stderr leer.

Der Wrapper verwendet Bash `set -eu`, setzt ausschließlich `LIBGL_ALWAYS_SOFTWARE=1` und `EGL_PLATFORM=surfaceless` und ersetzt sich per `exec /usr/bin/chromium`. Feste Argumente: `--ozone-platform=headless`, `--use-gl=angle`, `--use-angle=gl-egl`, `--ignore-gpu-blocklist`. Alle aufrufenden Argumente werden danach mit exakt zitiertem `"$@"` weitergereicht. Keine Parameterinterpretation, Queue, Zeitsteuerung, HOME-/Cacheänderung, Secretserialisierung, Profilbindung oder globale Systemkonfiguration.

Die vier Argumente und beiden GL-Umgebungswerte entsprechen der real erfolgreichen AvailabilityProbe 2. Deren Result-SHA ist `83d6310c0214eb18964c3ed7f19be561c27b08c0af1b80c22f8c749f486e0d82`; Cleanup-SHA `b3e9a2f8f88a1f4073f685737c77a487a36e9acbab123223a32933e82a2b1678` bestätigt keine aktiven eigenen Browserprozesse. Rohlogs einschließlich Shadercachewarnungen bleiben unverändert.

Unabhängiger Review und ein separater autorisierter Gameplaylauf bleiben ausstehend. Die AvailabilityProbe startete Chromium direkt; sie beweist nicht bereits den vollständigen Wrapperstart oder eine verbesserte Spielperformance. Wrapperflags stehen vor den weitergereichten Argumenten: spätere widersprechende Callerflags müssten vor einem Lauf ausgeschlossen werden. Die bisher gelesene bestehende Playwright-Konfiguration und die real aufgezeichnete Defaultcommandline enthalten solche eigenen GL-/ANGLE-/Ozone-Overrides nicht.

Keine dritte Probe, Browser, Display, Vite, Native World, Installation oder Projektänderung ausgeführt. CPU-/GPU-Lease bleibt frei.
