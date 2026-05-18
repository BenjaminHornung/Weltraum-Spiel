# DevToolbox Spec Workflow

Workspace: `{{workspaceRoot}}`
Change: `{{changeName}}`
Change path: `{{changePath}}`
Tasks path: `{{tasksPath}}`

## Ziel
Arbeite fuer neue Arbeit mit der internen DevToolbox-Spec-Engine unter `.devtoolbox/specs`.
Nutze dafuer die `specs_*` MCP-Tools als Standardpfad.

## Was die interne Spec-Engine bereitstellt
- Workspace-lokale Changes unter `.devtoolbox/specs/changes/<change-name>/`
- Pflichtartefakte `proposal.md`, `tasks.md` und mindestens eine `specs/<capability>/spec.md`
- optionales `design.md` fuer Architektur- und Umsetzungsdetails
- kanonische Archivierung unter `.devtoolbox/specs/changes/archive/<yyyy-mm-dd>-<change-name>/`
- MCP-Tools fuer Erstellen, Status, Validierung, Artefaktpflege und Archivierung

## Ordnerstruktur
```text
.devtoolbox/
  specs/
    changes/
      <change-name>/
        proposal.md
        design.md
        tasks.md
        specs/
          <capability>/
            spec.md
      archive/
        <yyyy-mm-dd>-<change-name>/
  templates/
    specs/
      Default.md
```

## Kanonischer Workflow fuer externe Agents
1. Workspace und Spec-Bestand erkennen.
   Verwende zuerst `workspace_discover`.
   Wenn du noch keinen Change kennst, verwende danach `specs_list_changes`.
   Wenn ein neuer Change angelegt werden soll, verwende `specs_create_change`.
2. Status und Pfade laden.
   Verwende `specs_get_status`, um Artefakte, Fortschritt, Archivstatus und den Change-Pfad zu kennen.
3. Validierung vor dem Arbeiten.
   Verwende `specs_validate` vor groesseren Aenderungen, damit fehlende Pflichtartefakte oder defekte `tasks.md` sofort sichtbar werden.
4. Artefakte gezielt lesen.
   Lies `proposal.md`, relevante `specs/**/spec.md`, bei Bedarf `design.md` und immer `tasks.md`.
   Verwende dafuer `specs_read_artifact`.
5. Aufgabenbestand laden.
   Verwende `tasks_load` auf `tasks.md`.
   Nutze `tasks.md` als Source of Truth fuer Umsetzungsfortschritt, Verify und Review.
6. Artefakte nur bewusst schreiben.
   Passe `proposal.md`, `design.md`, `tasks.md` oder `specs/**/spec.md` mit `specs_write_artifact` an.
   Schreibe nicht in Archivpfade und schreibe nicht ausserhalb des Workspace.
7. Implementierung ausfuehren.
   Verwende die Spec-Artefakte zusammen mit Code- und Workspace-Tools fuer die eigentliche Umsetzung.
   Wenn ein Arbeitsauftrag fuer einen weiteren Agenten erzeugt werden soll, nutze `launch_render_prompt` oder `launch_build_package`.
8. Verify und Review fahren.
   Fuehre `verify_run` aus.
   Erzeuge danach bei Bedarf `review_create_comments` und lies sie mit `review_list_comments`.
   Fuer Nacharbeiten auf Basis von Findings verwende `review_build_fix_prompt`.
9. Tasks sauber abschliessen.
   Hake Tasks erst dann mit `tasks_toggle` ab, wenn Implementierung und Verifikation wirklich abgeschlossen sind.
10. Erst am Ende archivieren.
    Verwende `specs_archive_change` nur, wenn alle Tasks erledigt sind und `specs_validate` keine blockierenden Fehler mehr meldet.

## Tool-Zweck und wann du welches Tool verwendest
- `workspace_discover`
  Verwende dieses Tool zu Beginn, um WorkspaceRoot und das interne Spec-Root zu erkennen.
- `specs_create_change`
  Verwende dieses Tool, wenn ein neuer Change scaffolding benoetigt.
  Es legt die Standardstruktur unter `.devtoolbox/specs/changes/<change-name>/` an.
- `specs_list_changes`
  Verwende dieses Tool, wenn du aktive oder archivierte interne Changes auflisten willst.
- `specs_get_status`
  Verwende dieses Tool vor Reads, Writes, Verify oder Archivierung, um den aktuellen Zustand des Changes zu kennen.
- `specs_validate`
  Verwende dieses Tool vor Umsetzung, vor Review und immer vor Archivierung.
- `specs_read_artifact`
  Verwende dieses Tool fuer konkrete Artefakt-Inhalte.
  Lies lieber gezielt, statt pauschal alle Dateien gleichzeitig zu laden.
- `specs_write_artifact`
  Verwende dieses Tool fuer kontrollierte Artefakt-Aenderungen innerhalb des Workspace.
- `tasks_load`
  Verwende dieses Tool, um aus `tasks.md` den aktuellen Task-Bestand mit Source-Lines zu laden.
- `tasks_toggle`
  Verwende dieses Tool nur fuer echte Fortschrittsupdates nach erfolgreicher Umsetzung und Verifikation.
- `launch_render_prompt` oder `launch_build_package`
  Verwende diese Tools, wenn aus einem Change ein konkreter Implementierungsauftrag fuer einen Agenten gebaut werden soll.
- `verify_run`, `verify_get_results`, `verify_re_run`, `verify_fresh`
  Verwende diese Tools fuer den Verifikationszyklus.
- `review_create_comments`, `review_list_comments`, `review_build_fix_prompt`
  Verwende diese Tools, um Findings aus Verify strukturiert in einen Fix-Flow zu ueberfuehren.
- `specs_archive_change`
  Verwende dieses Tool ausschliesslich am Ende des Lebenszyklus.

## Typische Tool-Sequenzen
### Bestehenden Change bearbeiten
1. `workspace_discover`
2. `specs_get_status`
3. `specs_validate`
4. `specs_read_artifact` fuer `proposal.md`, relevante `spec.md`, `tasks.md`
5. `tasks_load`
6. Implementieren
7. `verify_run`
8. `review_create_comments` und optional `review_build_fix_prompt`
9. `tasks_toggle`

### Neuen Change starten
1. `workspace_discover`
2. `specs_create_change`
3. `specs_get_status`
4. `specs_write_artifact` fuer `proposal.md`, `specs/<capability>/spec.md`, optional `design.md`, `tasks.md`
5. `specs_validate`

### Change abschliessen
1. `specs_get_status`
2. `tasks_load`
3. `specs_validate`
4. `verify_run`
5. optional `review_create_comments`
6. `specs_archive_change`

## Beispiel-Calls
```text
specs_list_changes
  workspaceRoot = {{workspaceRoot}}

specs_get_status
  workspaceRoot = {{workspaceRoot}}
  changeName = {{changeName}}

specs_validate
  workspaceRoot = {{workspaceRoot}}
  changeName = {{changeName}}

specs_read_artifact
  artifact.path = {{changePath}}\\proposal.md

tasks_load
  tasksPath = {{tasksPath}}

specs_archive_change
  workspaceRoot = {{workspaceRoot}}
  changeName = {{changeName}}
```

## Pflichtregeln
- `tasks.md` ist die kanonische Steuerung fuer Launch-, Verify- und Review-Arbeit.
- Hake Tasks nur ab, wenn die Implementierung und die Verifikation wirklich fertig sind.
- Lies betroffene Artefakte und den bestehenden Code, bevor du aenderst.
- Verwende fuer Spec-Arbeit ausschliesslich die internen `specs_*` Tools.
- Archiviere ueber `specs_archive_change` erst dann, wenn alle Tasks erledigt und die Validierung gruen oder nur warnend ist.
- `specs_archive_change` verschiebt den kompletten Change-Ordner. Es gibt in V1 keine automatische Haupt-Spec-Synchronisierung.

## Konkrete naechste Schritte fuer diesen Change
1. Lade den aktuellen Status ueber `specs_get_status`.
2. Lies `proposal.md`, relevante `spec.md` Dateien und `tasks.md`.
3. Lade die Tasks ueber `tasks_load`.
4. Arbeite einen Task nach dem anderen ab.
5. Fuehre `verify_run` aus, bevor du Tasks als erledigt markierst.
6. Archiviere erst am Ende mit `specs_archive_change`.