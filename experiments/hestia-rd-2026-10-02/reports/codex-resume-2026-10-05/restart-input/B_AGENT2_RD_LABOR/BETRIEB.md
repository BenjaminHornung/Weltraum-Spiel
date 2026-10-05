# Gemeinsamer Betriebsvertrag: Codex über Paseo, flach und wiederanlauffähig

Stand: 2026-10-05. Dies sind neue Ausführungsvorgaben für den Wiederanlauf, keine Behauptung über bereits gemessene Zuverlässigkeit deiner Installation.

## 1. Ziel und Rangfolge

Die ursprünglichen fachlichen Ziele, Korrektheitsorakel, Ressourcenbudgets und Integrationsverbote bleiben bestehen. Ersetzt werden die alte OpenCode-Ausführungsorganisation, rekursive Unterorchestratoren, Bindungen an unbrauchbare alte Sessions und rein administrative STOP-nach-jedem-Teilcommit-Regeln. Das ist keine Erlaubnis, Test-/Performancegrenzen, geschützte Daten, Sicherheitsfreigaben oder Repo-Regeln zu umgehen.

Neue fachliche Präzisierungen sind in den jeweiligen Wiederanlaufpaketen ausdrücklich gekennzeichnet. Historische Rohdaten und abgeschlossene Teilresultate bleiben unverändert. Ein früheres FAIL bleibt historisch FAIL; ein korrigierter neuer Quellstand darf mit neuer Run-ID neu qualifiziert werden.

Lies Repository-AGENTS und lokale Sicherheitsregeln. Fehlende Berechtigungen nicht durch full-access/yolo, globale Konfigurationsänderungen oder eigene Freigaben ersetzen.

## 2. Ein Arbeitsverantwortlicher, keine Orchestratorpyramide

Der Haupt-Codex ist selbst implementierungsfähig und darf im eigenen Schreibbereich arbeiten. Er darf Arbeit direkt an höchstens zwei Kinder delegieren. Kinder delegieren NICHT weiter. Kein Kind startet einen Unterorchestrator oder einen weiteren übergeordneten Goal-Loop.

Default pro Paket: Hauptagent als einziger Writer plus ein direkt beauftragter read-only Reviewer. Bei einem wirklich unabhängigen Implementierungsstück ist höchstens ein weiterer Writer in eigenem Worktree mit disjunkten Dateien erlaubt. Am gemeinsamen Produkt-/Integrationspfad gibt es immer genau einen Writer. Ein Reviewer erhält einen unveränderlichen Commit oder ein versiegeltes Preimage/Postimage-Paket, niemals einen sich während des Lesens ändernden Arbeitsbaum.

Wenn ein direktes Kind nicht zuverlässig gestartet oder überwacht werden kann, erledigt der Hauptagent die Implementierung selbst. Ein nötiger unabhängiger Review bleibt unabhängig und wird in einer frischen direkten Session oder durch das optionale QA-Paket durchgeführt. Eigenreview wird nicht in unabhängigen Review umbenannt.

Kein allgemein verwendbares neues Orchestrierungsframework, keine Workflowplattform, keine neuen MCP-Server und keine generische Datenbank bauen. Vorhandene Paseo-Tools, bestehende Run-Wrapper, eine kleine Statusdatei und konkrete Ergebnisbelege reichen.

## 3. Vor jeder neuen Schreibsession: alten Writer wirklich ablösen

1. Ermittle anhand der bekannten Paketpfade und Session-IDs die zugehörigen Paseo-Agenten, Workspaces, Worktrees und noch laufenden Befehle. Keine uneingeschränkten Dumps fremder Prozesse, Chats, Umgebungsvariablen oder Tokens.
2. Sichere lokale, noch nicht committete auftragsbezogene Änderungen und Ergebnisdateien. Besonders RD13 kann neuer als der gepushte Laborcheckpoint sein. Nur Eigentümeränderungen sichern; automatische .opencode-/Playwright-Logs und fremde Dateien nicht normalisieren oder wegputzen.
3. Pausiere/stoppe nur die zu diesem Auftrag gehörigen alten Goals/Agenten über tatsächlich verfügbare APIs. Bestätige zusätzlich, dass kein Kind oder zugehöriger nativer Prozess weiter schreibt. Eine Paseo-Anzeige „idle“ allein ist kein Nachweis.
4. Halte die Ablösung in RECOVERY.md fest: alter Agent/Worktree, letzter Commit, gesicherte Änderungen, Status der Kindprozesse, neuer Owner und neue Session-ID.
5. Erst dann neue Schreibrechte für die betroffenen Dateien übernehmen. Bei unklarem alten Writer keine Doppelimplementierung im alten Arbeitsbaum starten. Unabhängige read-only Analyse darf weiterlaufen.

Keine Löschung unbekannter Leases/Lockfiles, kein git reset --hard, kein git clean -fdx, kein globales Stash, kein killall und kein Beenden aller node/python/chrome/codex-Prozesse. Ein Prozess wird nur nach PID plus Startzeit, Elternbeziehung und Aufgabenbesitz gezielt beendet. Vorschau-Server am Ende stoppen oder ausdrücklich mit Besitzer, Port und begrenzter Laufzeit übergeben.

## 4. Git-Basis und fortgeschrittene Remotes

Die Paket-SHA ist der überprüfte Wiederanlaufanker, nicht die Behauptung eines dauerhaft unveränderten Remotes. Fetch genau das bestätigte Repository, prüfe Ankerobjekt, Abstammung und aktuellen Feature-Head. Lege einen neuen Resume-Branch vom Anker an.

Ist der Remote weiter, bewahre den neuen Stand, lies den Delta und entscheide dokumentiert, ob er bereits benötigte Korrekturen enthält. Nicht blind auf alten Code zurücksetzen und nicht blind HEAD übernehmen. Ohne kollisionsfreie Klärung bleibt die betroffene Aktivierung gesperrt, nicht die gesamte unabhängige Arbeit.

Originale Featurebranches und main bleiben unverändert. Normaler Push ist nur für den neuen dedizierten codex/resume-… Branch nach Quell-, Scope- und Privacyprüfung vorgesehen. Kein Force Push, PR, Merge, Release oder Deployment. Blockiert eine echte Plattformfreigabe die Publikation, liefere lokales Git-Bundle und verifizierte Artefakte statt sie zu umgehen.

## 5. Paseo-/Codex-Fähigkeiten vorab prüfen

Prüfe die tatsächlich installierten Versionen, auftragsbezogenen Profile und Tool-Schemas. Verwende ein vorhandenes Codex-Profil des Nutzers; kopiere nicht blind alte OpenCode- oder Beispielmodell-IDs. Keine globale Installation oder Aktualisierung ohne Freigabe. Ein Dateipfad mit „opencode“ im Namen kann lediglich auf das bereits gepinnte Node-Binary zeigen und muss nicht umbenannt werden.

Die offizielle Codex-Anleitung dokumentiert /goal, /goal pause, /goal resume, /goal clear. Prüfe in der gewählten Paseo-Session, dass /goal als nativer Befehl ankommt und nicht nur als gewöhnlicher Prompttext gespeichert wird. Erfasse Zielstatus und Threadbindung. Ein bloß zurückgespiegelter Prompt beweist keinen aktiven Goal-Modus.

Ein einmaliger kleiner Funktionstest genügt: direktes read-only Kind mit kurzer Dateiinspektion starten, Ergebnisnotification empfangen, tatsächliches Ergebnis prüfen, Kind beenden. Prüfe vorhandene Behandlung von Permission-/Fehlerereignissen und den Statusabgleich nach Wiederverbinden. Erzeuge keine absichtlich privilegierte Operation. Ein fehlgeschlagener Preflight wird konkret gemeldet; keine komplizierte neue Infrastruktur als Ersatz entwickeln.

Goal-Mode erhält die Zielausrichtung, ersetzt aber weder Run-Belege noch Prozessüberwachung. Ein beendeter Provider-Turn ist nicht automatisch ein vollständig abgeschlossenes Paket.

## 6. Delegation mit nachvollziehbarem Auftrag

Vor dem Start bekommt jedes Kind:

- taskId, attemptId, parentTaskId und echten Basis-SHA;
- absolute erlaubte Worktree-/Evidencepfade und enges Write-Set;
- genau ein Ergebnisziel mit überprüfbaren Tests/Artefakten;
- bestehende Abhängigkeiten samt deren Ergebnis-Hashes;
- vereinbartes Fortschrittsfenster und Befehls-Deadlines;
- Verbot weiterer Delegation und öffentlicher Rohdatenpublikation;
- eindeutigen Ergebnisablageort.

Nur der Parent schreibt das gemeinsame TASKBOARD.json. Kinder schreiben ihre eigenen task-result.json und Logs. Es gibt keine parallelen Überschreibungen einer gemeinsamen Statusdatei. Statusupdates werden vollständig geschrieben und atomar ersetzt; alte Versuchsbelege werden nicht überschrieben.

## 7. Ereignisse zuerst, Wiederherstellung statt Endlos-Polling

Paseo dokumentiert für agent-scoped create_agent und Hintergrundnachrichten standardmäßig notifyOnFinish=true. Nutze die bestätigte Version dieser Funktion und bearbeite währenddessen unabhängige Arbeit. Keine schnelle Schleife aus list_agents/get_agent_status.

Für den gemeldeten Fehlerfall braucht es zusätzlich eine begrenzte Rückfallebene: Wenn die Installation Heartbeats unterstützt, nutze einen auf diese Session beschränkten Heartbeat, beispielsweise alle zehn Minuten mit begrenzter Laufzeit. Er prüft nur offene Aufgaben mit überfälligem vereinbartem Fortschritt oder ausgebliebener terminaler Benachrichtigung. Nach Abschluss löschen. Das ist eine Recoveryprüfung, keine Erfolgsermittlung durch Polling. Die tatsächliche API und deren Ablaufverhalten zuerst prüfen.

Ohne zuverlässige Notifications/Heartbeats kein unbeaufsichtigter verschachtelter Betrieb. Dann Hauptagent direkt arbeiten lassen und endliche Wait-Aufrufe nutzen. Wenn paseo wait verfügbar ist, einen ausdrücklichen Timeout setzen. Nach Ablauf kehrt die Kontrolle zum Parent zurück. Ein Wait-Ergebnis belegt nur seinen dokumentierten Umfang, nicht automatisch Kindziele, Tests oder vollständige Artefakte.

Fortschrittsloser Text ist kein Fortschritt. Als Fortschritt zählen ein neues getestetes Delta, ein verifizierter Befund, ein fertiger Testlauf oder ein gültiger Ergebnischeckpoint. Lange gültige Tests dürfen still sein; fehlender Chattext allein rechtfertigt keinen Kill. Prüfe aktuellen Befehl, vereinbarte maximale Laufzeit, zielbezogene Prozess-/I/O-Fakten und Permissionstatus.

Nach zweimaligem Transport-/Sessionfehler desselben direkten Kindes: keine dritte blinde Wiederholung. Arbeitsbaum und Belege sichern, Owner ablösen, Hauptagent übernimmt oder startet genau einen begründet frischen direkten Reviewer. Keine neue Generation von Unterorchestratoren.

## 8. Zustände und überprüfbares Fertig-Kriterium

Führe Providerstatus und Aufgabenstatus getrennt. Aufgabenstatus:

READY, RUNNING, WAITING_PERMISSION, WAITING_EVIDENCE, REVIEW_PENDING, ACCEPTED, REJECTED_WITH_EVIDENCE, BLOCKED, FAILED, UNKNOWN, SUPERSEDED.

ACCEPTED erfordert gleichzeitig:
1. feststehende Ergebnis-/Quellidentität und erlaubten Diff;
2. alle erwarteten Ergebnisse vorhanden und parsebar;
3. abgeschlossene Befehle mit tatsächlichem Exit-/Signal-/Watchdogstatus;
4. vollständige erwartete Testpopulation, nicht nur „51 passed“ aus Teilstdout;
5. fachliche Akzeptanzkriterien für genau diese Quellen erfüllt;
6. nötiger unabhängiger Review an diese Quellen gebunden;
7. zugehörige Schreib-/Messprozesse beendet oder sauber übergeben.

Fehlendes Endergebnis ist UNKNOWN, nicht PASS. Ein bekannter einzelner Timeout ist FAIL dieses Tests; der unvollständige Gesamtlauf bleibt UNKNOWN/INCOMPLETE. UNSUPPORTED ist kein numerischer Nullwert. Ein valider verworfener Forschungskandidat kann REJECTED_WITH_EVIDENCE sein, ohne das ganze Forschungsprogramm endlos zu blockieren. Ein nicht implementiertes Pflichtwerkzeug wird dadurch nicht erledigt.

Ein Paket darf nicht als fertig gelten, solange Pflichtaufgaben RUNNING/WAITING/UNKNOWN sind. Eine echte externe Blockade wird als BLOCKED mit Ursache und exakt benötigter Entscheidung übergeben. Nicht alle offenen Aufgaben einfach zu BLOCKED umetikettieren.

## 9. Test- und Prozessführung

Verwende bestehende Runner und explizite Programmpfade mit Argumentarrays und Arbeitsverzeichnis. PowerShell-Syntax nicht durch einen anderen Default-Shell interpretieren lassen. Falscher Launcher/fehlendes Binary ist kein fachlicher RED-Test.

Befehlslaufzeit, native Testtimeout, Performancegate und administrativer Berichtszeitraum sind getrennte Dinge. Die alten 5-s-Testgrenzen, 180-s-Ownerprüfung und Performancegrenzen von Paket A werden nicht erhöht. Alte administrative 600-/540-/60-s-Checklisten und STOP-an-eine-bestimmte-Session-Bindungen erzeugen beim Wiederanlauf keinen neuen Endlos-Reviewzyklus. Neue Aufträge erhalten angemessene endliche Ausführungsfenster, ohne alte Verletzungen zu verdecken.

Bei Timeout: auftragsgebundenen Baum beenden/prüfen, vollständigen bisherigen Lauf sichern, minimalen Reproducer und konkrete Hypothese wählen. Für Diagnose darf die Population nach Dateien untersucht werden, unveränderte Einzelassertions und Zeitgrenzen bleiben. Das ersetzt später nicht den vollständigen Pflichtlauf.

Keine „grün bis es klappt“-Schleifen, kein stilles retry/bail/skip, keine nachträgliche selektive Stichprobenwahl. Korrigierter Code oder neue begründete Diagnose erhält neue Run-ID und neuen Quellbezug.

## 10. Maschinenlast und Privatheit

A, B und C dürfen parallel Quellen lesen und eng abgegrenzten Code bearbeiten. Auf derselben physischen Maschine gibt es nur eine qualifizierte CPU-/GPU-Messung zugleich. Paket A hat für die V3-Abnahme Vorrang. Eine bestehende native Messlease wiederverwenden; sonst einen kleinen, atomar erworbenen lokalen Messslot mit Owner und expliziter Freigabe führen. Keine Stale-Lock-Löschung ohne Prozessabgleich. Compilerbenchmarks dürfen keine Renderer-/Cutmessungen verfälschen.

Publizierbare Metadaten sind eine Allowlist: Versionen, zulässige Hardwarekennung, viewport/DPR, Quellen-/Buildhashes, vollständige Ergebnisse. Keine vollständigen CDP-SystemInfo-Antworten, Browserkommandozeilen, Umgebungsvariablen, Profildirectorys, Debug-WebSocket-URLs oder Secrets kopieren. Private Originale bleiben geschützt; öffentliche Kopien erhalten nachvollziehbare Redaktionsreferenzen. Hashintegrität beweist nicht Datenschutzfreiheit.

## 11. Ergebnis statt Dokumentationsschleife

Pro Teilauftrag genügen ein konkreter Auftrag, Testergebnis/Artefakte und eine kurze Übernahmekarte. Nicht vor jedem kleinen Fix alle historischen Archive erneut hashen. Neue oder transitiv betroffene Quellen prüfen, unveränderte bereits gebundene Evidenz referenzieren. Vollständige Archivprüfung am relevanten Abschluss.

Der Hauptagent beendet die Arbeit nicht mit „als Nächstes würde ich…“, solange freigegebene konkrete Restarbeit ausführbar ist. Er führt sie aus. Menschliche Art-Freigabe, neue Produktsemantik, Veröffentlichung eingeschränkter Daten und fehlende Berechtigungen bleiben echte Grenzen.

## Primärquellen für die Bedienung, nicht Beweis der lokalen Installation

- https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex
- https://github.com/getpaseo/paseo/blob/main/skills/paseo/SKILL.md
- https://github.com/getpaseo/paseo/blob/main/public-docs/cli.md

Die installierte Toolbeschreibung hat für Aufrufe Vorrang vor hier wiedergegebenen Beispielen. Keine erfundenen Goal-/Watchdog-/Paseo-Parameter benutzen.
