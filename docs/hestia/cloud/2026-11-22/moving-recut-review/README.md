# Zweiter Schnitt am fallenden Felsarm

Der Kandidat setzt auf dem veröffentlichten Core `b9fef65a7dc4f08c24da6183af9a7982ff6f5607` auf. Die kompakte Bearbeitung ist auf eine überprüfte Partition eines zuvor aus Terrain gelösten Fragments begrenzt. Für mehrere Restkörper bleibt die bestehende Structural-Implementierung zuständig. Die native Kollision behält auch bei der kompakten Bearbeitung die genaue belegte Form.

Beim zweiten Schnitt verliert der 384-Zellen-Felsarm genau 32 Zellen und 135,9375 kg. Das neue Kind besteht aus 352 Zellen mit 1.586,71875 kg. Das Kind wird an Material, Elternquelle und entfernte Zellen gebunden. Die Tests prüfen einen gedrehten und bewegten Körper, linearen Impuls und Drehimpuls um denselben Punkt im Weltraum. Der Drehimpulstest liest die Welttensoren beider Körper direkt aus Rapier. Ein weiterer Test speichert privat, startet kalt, prüft den Raycast und schneidet erneut. [Native Oracles und alle 33 Messpaare](native-oracle.json)

Im ersten exklusiven Browserlauf traf der zweite echte Mausklick bei laufender Simulation ein. Das HUD zeigte zuvor ein schneidbares Fragment. Der Werkzeugzähler blieb bei einer Eingabe. Die Steuerung konnte während eines kurzen exklusiven Weltvorgangs das aktive Ziel verlieren. Sechs manuelle Fortsetzungen endeten ohne zweiten bestätigten Schnitt. Der nachfolgende Eingabecommit `0c8c1c73ba6f9d8b00890caf2b45a4647906acbc` bindet einen zurückgestellten Schnitt an seinen ursprünglichen Strahl, die Augenposition, Fragmentquelle und Sitzung. [Eingabedaten des fehlgeschlagenen Spielversuchs](two-click-before-input-fix.json)

## Referenz-PC ohne lokale Buildarbeit

Der kombinierte Produktstand liegt auf `6daa056c10fa073a6ad51b8b9de8d9f46209258e`. Der Produktionsbuild und alle 17 separaten Buildpfadprüfungen endeten mit Exitcode 0. Die Messpaket-Prüfung nach dem Entpacken verglich 272 Dateihashes. Ein Kontrolllauf mit absichtlich unbrauchbarem Browser endete nach beiden Varianten mit Exitcode 1. Für die Windows-Abnahme sind das vollständige ZIP, ein installierter Chrome und Node.js ab 22 ausreichend. Der mitgelieferte Server bindet nur an die lokale Loopback-Adresse. Das Ryzen-System wurde in der Cloud nicht gemessen. [Start auf dem Zielrechner](reference-kit/LIESMICH.md)

Für einen frisch gebauten Checkout erzeugt `python reference-kit/pack.py ZIEL.zip` aus diesem Dokumentverzeichnis ein neues Messpaket. Das erste aus dem genannten Produktstand bereitgestellte ZIP trägt SHA-256 `1f3bc2e5eb2aa0bd83569f2a7deb29f7a9808ef827dcaa95c5668e6edc53303e`.
