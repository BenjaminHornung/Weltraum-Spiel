# Direkter Kinderauftrag: auszufüllen, nicht unverändert losschicken

Task-ID / Attempt-ID: konkrete neue Kennung.
Parent-ID / Ergebnispfad: genau dieser Hauptauftrag.
Read-only oder Writer: ausdrücklich auswählen.
Basis: voller vorhandener Git-SHA; ggf. zusätzliche unveränderliche Build-/Fixturehashes.
CWD: absoluter eigener Worktree unter dem erlaubten Ausführungsroot.
Write-Set: genaue Dateien oder ein enges eigenes Unterverzeichnis; alle anderen read-only.
Ergebnis: ein abgegrenztes, implementiertes/testbares Ergebnis, keine weitere Roadmap.
Akzeptanz: konkrete Tests/Oracles/Artefakte und vollständige erwartete Population.
Ausführungsfenster: vorab passend zur Aufgabe, keine Änderung bestehender Test-/Performancegrenzen.

Lies nur die relevanten Paket-/Repoanweisungen. Delegiere nicht. Starte keinen weiteren Orchestrator.
Bei Fehler diagnostiziere den belegten Root Cause, korrigiere nur im Scope, teste frisch. Keine stillen Retries.
Am Ende schreibe task-result.json nach dem mitgelieferten Muster plus kurze HANDOFF.md.
Melde unvollständige Resultate als UNKNOWN/INCOMPLETE; „Tests laufen“ ist kein Abschluss.
Keine fremden Prozesse oder Arbeitsbäume ändern. Keine Roh-Privacydaten veröffentlichen.
Liefere den vollständigen Diff und tatsächliche Quell-/Resultatbindung. Keine selbst erfundene Abnahme.
