# TrueNAS Self-hosted GitHub Runner

Task-ID: truenas-self-hosted-github-runner-v1

## Zweck und Architektur

GitHub bleibt Quellcode-, Pull-Request- und Workflow-System. Die TrueNAS
Custom App github-runner-weltraum betreibt genau einen nicht privilegierten,
persistenten GitHub-Actions-Runner für BenjaminHornung/Weltraum-Spiel. Nur der
rechenintensive Workflow Browser Mainline CI verwendet ihn. Dieser Workflow
führt ausschließlich Code des aktuellen main aus: automatisch nach einem Push
auf refs/heads/main oder manuell über den festen repository_dispatch-Typ
browser-mainline-ci. Codex Review Gate bleibt unabhängig auf ubuntu-latest.

Der Container wird vom TrueNAS-Apps-System gebaut und verwaltet. Er basiert auf
dem offiziellen Microsoft-Playwright-Noble-Image, enthält den offiziellen
GitHub Actions Runner und benötigt weder VM noch separaten Docker-Daemon.
Ausgehend sind DNS und HTTPS erforderlich; eingehende Ports werden nicht
veröffentlicht. Der persistente Runner ist keine Sandbox für Pull-Request-Code
oder andere nicht vertrauenswürdige Refs.

Der Runner initiiert alle Verbindungen zu GitHub selbst. Eine dynamische
öffentliche IP, Portweiterleitung oder ein Cloudflare-Tunnel ist nicht nötig.

## Aktuelle Trust Boundary

Der persistente Runner besitzt absichtlich wiederverwendbaren State. Unter
/runner-state liegen Runner-Binaries, .runner, .credentials,
.credentials_rsaparams, Hooks, Toolcache und Runtime-State. Runner und Job
laufen als UID/GID 1000:1000. Deshalb darf dieser Runner ausschließlich den
aktuellen, als vertrauenswürdig behandelten main ausführen. Er führt keine
PR-Heads, Merge-Refs, Fork-Refs, Tags, beliebigen Branches oder vom Aufrufer
angegebenen Commit-SHAs aus.

Browser Mainline CI akzeptiert nur:

- push mit github.ref gleich refs/heads/main
- repository_dispatch mit Typ browser-mainline-ci und github.ref gleich
  refs/heads/main

Der Job besitzt zusätzlich einen fail-closed Event-/Ref-Guard. Nach dem
normalen Checkout wird vor npm ci oder Produktskripten geprüft, dass HEAD exakt
github.sha entspricht und github.sha Bestandteil von origin/main ist. Beim
repository_dispatch muss github.sha außerdem exakt dem aktuellen main-Head
entsprechen. Weder Workflow-Inputs noch client_payload, head_ref oder frei
angegebene Refs und SHAs werden für den Checkout verarbeitet.

Zusätzlich erzwingt der root-owned, mit Modus 0555 aus dem Image gelieferte
`ACTIONS_RUNNER_HOOK_JOB_STARTED` die Grenze runnerweit vor jedem Job-Step. Er
akzeptiert nur das exakte Repository, `push` oder `repository_dispatch`,
`refs/heads/main`, den Workflowpfad
`.github/workflows/browser-mainline-ci.yml`, übereinstimmende Job- und
Workflow-SHAs sowie einen passenden Event-Payload. Dadurch scheitert auch ein
anderer Workflow, der in einem Feature-Branch dieselben Runner-Labels
adressiert, vor der Ausführung seines ersten Steps.

### Bewusst akzeptierte Owner-only Trust Root

Die Live-Abfrage am 15. Juli 2026 meldete für dieses private Repository
`protected=false`; Rulesets und klassische Branch Protection antworteten im
aktuellen GitHub-Plan mit HTTP 403 und verlangen GitHub Pro oder ein
öffentliches Repository. Das Repository wird nicht öffentlich gemacht. Der
Repository-Eigentümer hat deshalb ausdrücklich ein Owner-only Trust Model als
Ausnahme akzeptiert.

Der Aktivierungsaudit bestätigte genau einen schreibberechtigten Principal:
`BenjaminHornung` mit Adminrechten. Es existierten keine Deploy Keys. Der
Standard-GITHUB_TOKEN besitzt nur Leserechte und darf keine Pull-Request-
Reviews genehmigen. Unter diesem Vertrag gilt aktueller `main` als
vertrauenswürdig, obwohl GitHub ihn nicht technisch schützt.

Diese Ausnahme ist schwächer als Branch Protection: Wird das Owner-Konto, ein
zukünftig schreibberechtigter Benutzer, Token, Deploy Key oder eine GitHub App
kompromittiert, kann Code direkt auf `main` gelangen und auf dem persistenten
Runner ausgeführt werden. Vor jeder neuen Schreibberechtigung oder Integration
muss der Audit wiederholt und der Workflow bis zur Neubewertung deaktiviert
werden.

## Aktivierungsbedingungen nach diesem Fix

Der Workflow darf unter dem ausdrücklich akzeptierten Owner-only Trust Model
erst wieder aktiviert werden, wenn alle folgenden Bedingungen belegt sind:

1. Das Runner-Image mit dem gehärteten `job-started.sh` ist über die TrueNAS
   Custom-App-Schnittstelle ausgerollt und positive sowie negative Hook-Tests
   sind grün.
2. Weil der persistente State zuvor PR-Code ausgeführt hat, wurden die
   Runner-Credentials rotiert und Runner-Binaries, Hooks sowie Runtime-State
   aus dem digest-verifizierten Image sauber neu initialisiert.
3. Der Live-Audit weist genau den Repository-Eigentümer als
   schreibberechtigten Principal, keine Deploy Keys und einen standardmäßig
   read-only GITHUB_TOKEN aus.
4. Der Eigentümer akzeptiert dokumentiert, dass eine Kompromittierung seines
   Kontos oder zukünftiger Schreib-Credentials Codeausführung auf dem
   persistenten Runner ermöglicht.

Ein reines Löschen von `_work` erfüllt Punkt 2 nicht. Wenn App-/Runner-Neustart
oder der Schreibzugriffs-Audit nicht möglich sind, bleibt `Browser Mainline CI`
deaktiviert. Der Runner und die TrueNAS App können dabei online bleiben; sie
dürfen bis zur vollständigen Aktivierung der Trust Boundary keinen Job
annehmen.
## PR-Verifikation

Der vorläufige Vertrag trennt untrusted PR-Verifikation vom persistenten
Runner:

```text
PR:
- lokale Agent-Verifikation
- TypeScript
- Units
- Build
- Core/Live/UI/full E2E
- Exact-Head Codex Review
- Review-Threads
- Scope-Audit

Nach Merge:
- vollständige Browser Mainline CI auf Self-hosted Runner
- exakter main-SHA
```

Post-Merge-CI kann eine fehlerhafte Änderung erst nach dem Merge erkennen und
verhindert sie nicht vorab. Eine fehlende lokale oder Review-Verifikation darf
nicht durch den späteren Self-hosted Lauf ersetzt werden.

## Sicherer manueller Lauf

Ein manueller Lauf wird ausschließlich ohne Ref-, Branch-, SHA- oder sonstige
Payload ausgelöst:

```bash
gh api \
  --method POST \
  repos/BenjaminHornung/Weltraum-Spiel/dispatches \
  -f event_type=browser-mainline-ci
```

Kein client_payload mitsenden. GitHub verwendet bei repository_dispatch die
Workflowdatei und den letzten Commit des Default-Branches; GITHUB_REF ist der
Default-Branch. workflow_dispatch ist absichtlich nicht konfiguriert, weil es
einen auswählbaren Ref akzeptiert.

## Spätere PR-fähige Lösung

Eine spätere Self-hosted PR-CI benötigt echte Ephemeral Isolation als eigenes
Work Package:

- frische Runner-Registrierung pro Job
- frische Credentials pro Job
- Runner mit --ephemeral
- komplett neues Ausführungsumfeld pro Job
- keine Wiederverwendung beschreibbarer Runner-Binaries
- keine Wiederverwendung von .runner oder .credentials
- keine gemeinsam beschreibbaren Hooks
- keine gemeinsam beschreibbaren Tool-Verzeichnisse
- vollständige Vernichtung nach Jobende
- Secret-Broker außerhalb des Job-Containers
- keine GitHub-App- oder PAT-Secrets im ausführenden PR-Container
- kontrollierter Image- und Supply-Chain-Hash
- Log- und Artifact-Export vor Vernichtung

Das Löschen von _work allein ist ausdrücklich nicht ephemeral.

## Inventar

| Element | Wert |
| --- | --- |
| TrueNAS | Community 25.04.2.6 |
| TrueNAS Custom App | github-runner-weltraum |
| Repository | BenjaminHornung/Weltraum-Spiel |
| Runner | truenas-weltraum-browser-01 |
| Labels | self-hosted, linux, x64, weltraum-browser, truenas |
| Pool/Dataset | Storage |
| Dedizierte Struktur | /mnt/Storage/apps/github-runner-weltraum |
| Basisimage | mcr.microsoft.com/playwright:v1.61.1-noble |
| Linux-x64-Digest | sha256:cf0daee9b994042e011bc29f20cdff1a9f682a039b43fcd738f7d8a9d3bcd9d6 |
| Playwright | 1.61.1 |
| GitHub Actions Runner | 2.335.1 |
| Node.js | 22.23.1 |
| Containerbenutzer | runner, UID/GID 1000:1000 |
| CPU-Limit | 4 Kerne |
| RAM-Limit | 8 GiB |
| Shared Memory | 2 GiB |
| Parallelität | ein Listener, höchstens ein Job |

Der lokale Image-Tag lautet
`github-runner-weltraum:pw1.61.1-runner2.335.1-r1`. Die am 14. Juli 2026
verifizierte lokale Image-ID ist
`sha256:ed8f37a8de8a91d5ae03148b1e0acab90f29aa9ec5df9bf27873eda807a27fb6`
bei 3.619.939.899 Byte. Das Basisimage ist auf den oben genannten
Linux-x64-Digest gepinnt.

## Storage-Struktur und Mounts

Der bestehende Root-Dataset `Storage` wurde vor dem Deployment verifiziert:
`atime=off`, `compression=lz4`, `dedup=off`. Darin liegt ausschließlich für
diesen Runner die dedizierte Struktur
`/mnt/Storage/apps/github-runner-weltraum`; es wurde kein fremdes Dataset
verändert. Die Struktur enthält nur diese Verzeichnisse:

| Host | Container | Zweck |
| --- | --- | --- |
| deployment | Build-Context, kein Laufzeit-Mount | versionierte App-Dateien |
| state | /runner-state | Runner-Binaries und Registrierung |
| work | /runner-state/_work | flüchtiger Job-Workspace |
| npm-cache | /home/runner/.npm | persistenter npm-Cache |
| logs | /runner-state/_diag | Runner- und Cleanup-Diagnose |
| secrets/runner-registration-token | /run/secrets/runner-registration-token | einmalige Registrierung, read-only |

Der Struktur-Root und die Laufzeitverzeichnisse gehören UID/GID 1000:1000.
secrets hat Modus 0700; die Token-Datei hat Modus 0600. Weder /mnt,
/mnt/Storage, /etc, /root, ein Host-Home, TrueNAS-Konfiguration noch persönliche
Shares werden gemountet.

## Sicherheitsgrenzen

- Kein privileged mode, kein Host-Networking und keine veröffentlichten Ports.
- Kein Mount von /var/run/docker.sock.
- Alle Linux-Capabilities sind entfernt.
- no-new-privileges ist aktiv.
- Das offizielle Playwright-Seccomp-Profil für v1.61.1 wird verwendet.
- Der Runner läuft als UID/GID 1000:1000, nicht als root.
- Registration-Token werden als kurzlebige Datei übergeben, nie als
  Environment-Variable oder langfristiges PAT gespeichert.
- Der Tokeninhalt wird nach erfolgreicher Registrierung auf dem Host geleert.
- Runner-Credentials liegen ausschließlich im restriktiven state-Verzeichnis.
- Der persistente Runner verarbeitet nur aktuellen main und niemals PR-Code,
  beliebige Refs oder benutzerdefinierte SHAs.
- PLAYWRIGHT_BROWSERS_PATH ist /ms-playwright; es werden keine unsicheren
  Chromium-Flags ergänzt.

## Bereitstellung

Vor jeder Änderung sind TrueNAS-Version, Hardware, Pool Storage, freier Platz,
Apps-Service, vorhandene App-Namen, SSH-Rechte, DNS und ausgehendes HTTPS
read-only zu prüfen. Die App darf nur über die unterstützte TrueNAS-App-API
angelegt werden.

Die versionierten Dateien aus infra/github-runner-truenas werden nach
/mnt/Storage/apps/github-runner-weltraum/deployment kopiert. Danach wird der
gepinnten Runner mit `prepare-deployment.sh` heruntergeladen und SHA-256
verifiziert. Vor `app.create` wird das Basisimage über `app.image.pull`
vorgeladen; das umgeht den festen Lifecycle-Timeout großer Erst-Pulls, bleibt
aber vollständig innerhalb des TrueNAS-Apps-Systems. Danach wird der Inhalt von
compose.yaml als `custom_compose_config_string` an `app.create` übergeben. Es
wird kein Docker-Daemon oder `docker compose` außerhalb des Apps-Systems
verwendet.

Beispiel für die Statusprüfung:

~~~
midclt call system.info
midclt call pool.query
midclt call docker.status
midclt call app.query '[["id","=","github-runner-weltraum"]]'
midclt call -j app.image.pull \
  '{"image":"mcr.microsoft.com/playwright@sha256:cf0daee9b994042e011bc29f20cdff1a9f682a039b43fcd738f7d8a9d3bcd9d6"}'
~~~

## Registrierung und Secret-Rotation

1. In einer bereits authentifizierten GitHub-Sitzung ein kurzlebiges
   Repository-Runner-Registration-Token für BenjaminHornung/Weltraum-Spiel
   erzeugen. Kein klassisches PAT verwenden.
2. Den Token ausschließlich nach
   /mnt/Storage/apps/github-runner-weltraum/secrets/runner-registration-token
   schreiben und Modus 0600 setzen.
3. Die App starten. entrypoint.sh registriert nur, wenn state/.runner fehlt.
4. In GitHub prüfen, dass truenas-weltraum-browser-01 online und idle ist.
5. Die Token-Datei auf dem Host auf Länge null setzen und Modus 0600
   beibehalten.
6. Die App neu starten und prüfen, dass die vorhandene Registrierung verwendet
   wird. Ein neuer Registrierungsvorgang darf dabei nicht erscheinen.

Für eine Re-Registrierung zuerst die App stoppen und den vorhandenen Runner in
den Repository-Einstellungen eindeutig zuordnen. Nur diesen Runner mit einem
kurzlebigen GitHub-Removal-Token sauber abmelden oder in GitHub entfernen.
Danach ausschließlich die runnerbezogenen Credential-Dateien im dedizierten
state-Verzeichnis manuell sichern beziehungsweise entfernen. Erst dann einen
neuen kurzlebigen Registration-Token wie oben verwenden. Andere Runner dürfen
nicht verändert werden.

## Betrieb

Alle Befehle werden über midclt ausgeführt:

~~~
midclt call app.start github-runner-weltraum
midclt call app.stop github-runner-weltraum
midclt call app.redeploy github-runner-weltraum
midclt call app.query '[["id","=","github-runner-weltraum"]]'
~~~

Ein Restart besteht aus app.stop, Zustandsprüfung und app.start. app.redeploy
ist für eine unveränderte erneute Bereitstellung vorgesehen.

Container-IDs und Logs:

~~~
midclt call app.container_ids github-runner-weltraum
sudo tail -n 200 /var/log/app_lifecycle.log
sudo tail -n 200 /mnt/Storage/apps/github-runner-weltraum/logs/Runner_*.log
~~~

Der GitHub-Status wird zusätzlich unter Repository Settings, Actions, Runners
geprüft. Erwartet sind Name truenas-weltraum-browser-01, Status online und
nach jedem Job idle.

## Workspace-Cleanup

Die offiziellen Hooks ACTIONS_RUNNER_HOOK_JOB_STARTED und
ACTIONS_RUNNER_HOOK_JOB_COMPLETED markieren einen laufenden Job und leeren
nach dessen Abschluss ausschließlich /runner-state/_work. Der Cleanup hält
einen exklusiven Lock und verweigert manuellen oder Startup-Cleanup, wenn ein
Runner.Worker aktiv ist.

Erhalten bleiben:

- npm-Cache
- Runner-Toolcache
- Runner-Binaries
- Runner-Konfiguration und Credentials
- Diagnose- und Cleanup-Logs

Bereinigt werden Checkout, temporäre Playwright-Dateien, Testresultate und
sonstige Jobverzeichnisse unter _work. Das Runner-State-Verzeichnis selbst ist
nie automatisches Löschziel. Dieser Cleanup ist keine Ephemeral Isolation:
Runner-Binaries, Credentials, Hooks und Toolcache bleiben beschreibbar und
werden zwischen Jobs wiederverwendet. Die Sicherheitsgrenze entsteht daher
nicht durch Cleanup, sondern ausschließlich durch die Main-only Trigger-,
Ref- und Checkout-Gates.

Sicherer manueller Cleanup bei gestoppter oder eindeutig idle App:

~~~
midclt call app.stop github-runner-weltraum
# cleanup-workspace.sh --manual in einem über TrueNAS ausgeführten App-Container
midclt call app.start github-runner-weltraum
~~~

Vor dem manuellen Aufruf muss belegt sein, dass weder .job-running noch ein
Runner.Worker vorhanden ist.

## Updates

Für Image-Updates zuerst die Playwright-Version aus package-lock.json
ermitteln. Es darf nur das exakt passende offizielle Noble-Image verwendet
werden. Tag und Linux-x64-Digest, Runner-Version und Archiv-SHA sowie
Node-Version und Archiv-SHA werden in Dockerfile und compose.yaml aktualisiert.

Danach:

1. Branch und Pull Request erstellen.
2. App stoppen.
3. deployment aktualisieren.
4. Das neue digest-gepinnte Basisimage über `app.image.pull` vorladen.
5. Custom-App-Konfiguration über ein kontrolliertes `app.redeploy`
   aktualisieren und Image bauen.
6. Toolversionen, Nicht-root-Betrieb, Mounts und Limits prüfen.
7. App-Neustart und Testworkflow ausführen.

Der offizielle GitHub Runner kann sich in state selbst aktualisieren. Diese
Aktualisierung überlebt Neustarts, weil das Image seine Distribution nur bei
fehlender persistenter Installation kopiert. Ein späterer kontrollierter
Image-Build soll die gepinnte Runner-Version wieder auf den geprüften Stand
bringen.

## Fehlerdiagnose

- App bleibt deploying: `app.query`, TrueNAS-Jobstatus und
  `/var/log/app_lifecycle.log` prüfen; keine parallele Docker-Installation
  anlegen. Große Basisimages zuerst mit `app.image.pull` laden. Einen
  abgebrochenen `app.create`-Job nicht durch einen parallelen zweiten Job
  überlagern.
- Runner offline: DNS und HTTPS zu github.com, api.github.com und den von
  GitHub dokumentierten Actions-Endpunkten prüfen; keine Ports veröffentlichen.
- Registration-Fehler: Tokenalter, leere Token-Datei, Dateirechte und
  Repository-Scope prüfen; kein PAT hinterlegen.
- Chromium fehlt: Lockfile-Version gegen /ms-playwright und Image-Tag prüfen.
  Kein anderes Browserimage und keine unsicheren Flags verwenden.
- WebGL fehlt: Shared Memory, Software-Renderer-Ausgabe und Seccomp-Log prüfen.
  Nicht privileged schalten und keinen Docker-Socket mounten.
- LFS schlägt fehl: git lfs version, Repositoryzugriff und selektive LFS-Pfade
  im Workflow prüfen.
- Cleanup schlägt fehl: .job-running, Runner.Worker und
  _diag/workspace-cleanup.log prüfen. state nicht löschen.
- Ressourcenprüfung: Container-Inspect-Daten über die TrueNAS-App-Schnittstelle
  auf 4 CPUs, 8 GiB RAM und 2 GiB SHM kontrollieren.

Bei einem Fehlschlag bleibt das Dataset erhalten. Die App wird gestoppt; es
werden weder Dataset noch Snapshots automatisch entfernt.

## Nicht destruktiver Rollback

1. Neue Browser-Workflow-Änderung in einem separaten Pull Request revertieren,
   sodass Browser Mainline CI wieder den vorherigen Runner verwendet.
2. Laufende Jobs auslaufen lassen oder über GitHub kontrolliert abbrechen.
3. App stoppen:

~~~
midclt call app.stop github-runner-weltraum
~~~

4. In Repository Settings, Actions, Runners ausschließlich
   truenas-weltraum-browser-01 auswählen und entfernen. Keinen anderen Runner
   löschen.
5. App-Status und Prozessende prüfen.
6. Optional und erst nach ausdrücklicher Freigabe die Custom-App-Definition
   über die TrueNAS-Apps-Oberfläche oder app.delete entfernen.
7. `/mnt/Storage/apps/github-runner-weltraum` standardmäßig vollständig
   erhalten.
   Weder Dataset noch Verzeichnisse, ZFS-Snapshots oder Credentials werden im
   Rollback automatisch gelöscht.

Damit ist der Runner deaktiviert und aus GitHub entfernt, während alle
forensischen Logs und der wiederverwendbare Zustand für eine kontrollierte
Nachanalyse erhalten bleiben.

## Abnahme auf TrueNAS und GitHub

Die Abnahme protokolliert:

- TrueNAS Community 25.04.2.6, Pool Storage und Dataset-Eigenschaften.
- App wird in app.query als Custom App geführt.
- Container läuft als UID/GID 1000:1000 und ohne privileged/Host-Netzwerk.
- Kein Docker-Socket und keine unerlaubten Hostpfade sind gemountet.
- Limits 4 CPU, 8 GiB RAM, 2 GiB SHM sind aktiv.
- git, git lfs, node, npm, jq und Chromium funktionieren.
- Runner.Listener läuft genau einmal.
- GitHub zeigt den Runner online/idle und die erwarteten Labels.
- App-Neustart behält die Registrierung ohne erneute Tokenverwendung.
- Der Workflow besitzt weder pull_request, pull_request_target,
  workflow_dispatch noch andere untrusted Trigger.
- Ein Push auf main oder ein payload-freier repository_dispatch führt exakt
  den von GitHub gemeldeten main-SHA aus.
- Für PR-Heads wird auf diesem persistenten Runner kein Lauf erzeugt.
- Codex Review Gate läuft getrennt auf ubuntu-latest.
- Erfolgreiche Browserläufe laden keine großen Testartefakte hoch.
- Ein schneller Folge-Push auf main storniert den älteren Browserlauf.
- Nach Jobabschluss ist _work leer; Cache, Toolcache und Konfiguration bleiben
  erhalten.

Am 14. Juli 2026 wurden zusätzlich direkt am laufenden Prozess bestätigt:

- UID/GID 1000:1000, alle Capability-Sets 0, `NoNewPrivs=1`, `Seccomp=2`.
- cgroup `cpu.max=400000 100000`, `memory.max=8589934592`.
- `/dev/shm` als tmpfs mit `size=2097152k`.
- Keine veröffentlichten Ports, Bridge-Netzwerk und exakt die fünf oben
  dokumentierten Bind-Mounts.
- Node, Git LFS und `/opt/actions-runner-dist` sind root-owned und Modus 0755.
- Registrierung überlebte Stop/Start und Redeploy; die Token-Datei blieb leer.
- GitHub meldete `truenas-weltraum-browser-01` online und idle.
