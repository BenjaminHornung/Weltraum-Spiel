from pathlib import Path
import shutil,subprocess,json,hashlib,base64,html,re,os
root=Path('/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11')
scratch=Path('/workspace/.cloud-setup/ui-ceramic-2026-10-13')
clean=Path('/workspace/.cloud-setup/ui-clean-copy-2026-10-13')
old=Path('/workspace/review-packages/Hestia-FP06-Visual-Review-2026-10-13')
packet=Path('/workspace/review-packages/Hestia-English-UI-Crashsite-Review-2026-10-13')
packet.mkdir(parents=True,exist_ok=True);(packet/'images').mkdir(exist_ok=True)
sourceSha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
# Copy the clean, actually installed/built source without package cache/dependencies.
shutil.copytree(clean,packet/'source',dirs_exist_ok=True,ignore=shutil.ignore_patterns('node_modules'))
shutil.copytree(root/'docs/factory',packet/'source/docs/factory',dirs_exist_ok=True)
shutil.copy2(root/'design-qa.md',packet/'source/design-qa.md')
readme=root/'docs/factory/fp06/play/2026-10-13/ui-ceramic/README_PLAY.md'
shutil.copy2(readme,packet/'README_PLAY.md');shutil.copy2(readme,packet/'source/README_PLAY.md')
snapshot=json.loads((packet/'source/SOURCE_SNAPSHOT.json').read_text());snapshot['sourceCommitSha']=sourceSha;snapshot['branch']='codex/hestia-fp06-play-candidate-2026-10-12';snapshot['prebuiltDistIncluded']=True
(packet/'source/SOURCE_SNAPSHOT.json').write_text(json.dumps(snapshot,indent=2)+'\n')
# Ensure the copied tested product bytes are exactly the checkpoint's bytes.
for dirname in ['src','public','tests']:
 for p in (root/'apps/weltraum-browser'/dirname).rglob('*'):
  if p.is_file():assert p.read_bytes()==(packet/'source'/p.relative_to(root)).read_bytes(),str(p)
shutil.copytree(root/'apps/weltraum-browser/evidence/factory/ui-ceramic-2026-10-13',packet/'evidence',dirs_exist_ok=True)
control=Path('/workspace/Weltraum-Spiel/.worktrees/fp06-w00-2026-10-11/docs/factory/fp06')
(packet/'locks').mkdir(exist_ok=True)
for n in ['source-lock.json','write-ownership.json','decisions.md','baseline.md']:
 if (control/n).exists():shutil.copy2(control/n,packet/'locks'/n)
shutil.copy2(control/'play/2026-10-12/grants/ui-ceramic-owner-approved-2026-10-13.json',packet/'locks/ui-ceramic-owner-approved-2026-10-13.json')
images=[]
def picture(group,title,path,note):
 name=f'{len(images)+1:02d}-{path.stem}.png';dest=packet/'images'/name;shutil.copy2(path,dest)
 images.append({'group':group,'title':title,'file':'images/'+name,'note':note,'original':str(path),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
picture('Neue Crashsite','Freigegebene Assetvorlage',root/'art/factory/visual-reference/2026-10-13/crashsite/03-hybrid-revision.png','IMAGEGEN REFERENZ · Owner-approved asset reference, kein Screenshot des Spiels.')
for name,title in [('01-bay-and-turrets','Blender: Ladebucht und beide Geschütze'),('02-rear-damage','Blender: beschädigtes Heck'),('03-plan-access','Blender: Zugang und Draufsicht')]:
 picture('Neue Crashsite',title,root/'art/factory/crashsite-hybrid-v1'/(name+'.png'),'ECHTER BLENDER-RENDER · native Quelle und GLB im Paket; erste Modellfassung, OWNER_REVIEW_PENDING.')
picture('Neue Crashsite','GLB im echten Three.js-Browserimport',scratch/'crashsite-browser-import.png','DETACHED ASSET REVIEW · nicht in die Spielworld integriert; 29 Materialprimitives, 4.208 Dreiecke.')
picture('Referenz und Vergleich','Freigegebene HUD-Richtung',root/'art/factory/visual-reference/2026-10-13/approved-hud-ceramic-petrol-microvoxel.png','DESIGNREFERENZ · Layout 1, Palette 2, Minimap oben rechts. Keine Runtime-Evidence.')
picture('Referenz und Vergleich','Cargo: kompletter direkter Vergleich',scratch/'qa-full-cargo.png','Links generierte Vorlage, rechts tatsächlicher Browser. Kamera, Sprache und Gameplayphase unterscheiden sich; kein Fidelity-Score.')
picture('Referenz und Vergleich','Cargo: Inspectorvergleich nach Korrektur',scratch/'qa-focused-cargo.png','Tatsächliche englische UI, native Icons und sichtbare 341 kg; Details der Trägerillustration noch vereinfacht.')
picture('Vorher','Vorher: Cargo-Panel',scratch/'before/02-cargo.png','ECHTER VORHER-SCREENSHOT auf Integratorbasis f0a901; keine neue Implementierung behauptet.')
picture('Vorher','Vorher: pausierter HUD',scratch/'before/06-paused-hud.png','ECHTER VORHER-SCREENSHOT, gleiche lokale Quellbasis.')
picture('Aktueller Browser','Cargo: ausgewählter Former',scratch/'cargo-post-qa-1280.png','AKTUELLER PRODUKTIONSBUILD · 1280×720, source-bound Auswahl und 341 kg, normaler Input, kein TestBridge.')
for name,title in [('01-start-1280','Start und Fortsetzen'),('03-build-rejected-1280','Bauvorschau: tatsächlich abgewiesen'),('04-machines-empty-1280','Maschinen: ehrlicher leerer Startzustand'),('05-power-empty-1280','Energie: ehrlicher leerer Startzustand'),('06-technology-1280','Technikübersicht in Englisch'),('07-map-1280','Aktuelle Karte: veröffentlichte Startsite'),('08-paused-hud-1280','Pausierter HUD, Minimap oben rechts'),('09-paused-hud-1920','Großer Viewport 1920×1080'),('12-explicit-play-1280','Tatsächlicher SimulationHold'),('13-recovery-1280','Recovery über normale Taste bestätigt')]:
 picture('Aktueller Browser',title,scratch/'production-complete'/(name+'.png'),'ECHTER BROWSER · normale Eingaben; frischer Startzustand. Kein Nachweis für vollständigen 16-kg-Kreislauf oder Save-Abnahme.')
picture('Aktueller Browser','Schmaler HUD: 375×812',scratch/'production-complete/10-paused-hud-375.png','ECHTER BROWSER · Layoutprüfung, kein zugesagtes Touch-/Controller-Spielziel.')
picture('Aktueller Browser','Schmales Cargo-Panel nach Korrektur',scratch/'cargo-post-qa-375.png','ECHTER BROWSER · ausgewählte Masse sichtbar, Bedienelemente erreichbar.')
picture('Aktueller Browser','Sichtbarer Tastatur-Fokus',scratch/'focus-objective-final.png','ECHTE TAB-EINGABE · 3-px-Inset-Fokus bleibt trotz Cut-Corner sichtbar.')
picture('Aktueller Browser','Normaler Browserentry in Englisch',scratch/'main-01-english.png','ECHTER NORMALER / ENTRY · bestehende Flug-UI sprachlich umgestellt; nicht die Factory-Ceramic-World.')
picture('Aktueller Browser','Graphics-Dialog in Englisch',scratch/'main-02-graphics-english.png','ECHTER NORMALER / ENTRY · Dialog geöffnet und mit Escape verlassen.')
picture('Saubere Kopie','Start aus frisch gebauter Quellkopie',scratch/'clean-copy-start.png','ECHTER CLEAN-COPY-SMOKE · npm ci + npm run build + Vite preview, keine alten node_modules kopiert.')
picture('Saubere Kopie','Workshop aus frisch gebauter Quellkopie',scratch/'clean-copy-workshop.png','ECHTER CLEAN-COPY-SMOKE · confirmed Paused; keine volle Produktions-/Speicherabnahme.')
# All older Factory model sources have their actual previous renders reused only when source hashes match.
coverage=[]
for row in json.loads((old/'BLENDER_SOURCE_COVERAGE.json').read_text()):
 if not row['repositoryPath'].startswith('art/factory/'):continue
 p=root/row['repositoryPath'];assert hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256'],row['repositoryPath']
 name=p.stem
 candidates=list((old/'base/images/assets').glob(name+'--*primary.png'))
 if name.endswith('-v2'):candidates=list((old/'surface-v2').rglob(name+'*.png'))
 if not candidates:candidates=list((old/'surface-v2').rglob('*'+name+'*.png'))
 assert candidates,'No actual existing render for '+name
 preferred=next((p for p in candidates if 'neutral' in p.name),candidates[0])
 picture('Bestehende Factory-Blenderquellen',name,preferred,'BEREITS VORHANDENER BLENDER-RENDER · alte Aufnahme wiederverwendet, heutige native Quell-SHA identisch; kein neuer Runtime-/Flow-Nachweis.')
 coverage.append({'path':row['repositoryPath'],'sourceSha256':row['sha256'],'image':images[-1]['file'],'imageKind':'REUSED_ACTUAL_BLENDER_RENDER_SOURCE_UNCHANGED'})
coverage.append({'path':'art/factory/crashsite-hybrid-v1/crashsite-hybrid-v1.blend','sourceSha256':'2987725a6c1d8802c40f921c11582db90f39d30bdbf2f665f5804d3bfe9a1437','image':images[1]['file'],'imageKind':'NEW_ACTUAL_BLENDER_RENDER'})
assert len(coverage)==len(list((root/'art/factory').rglob('*.blend')))
(packet/'BLENDER_COVERAGE.json').write_text(json.dumps(coverage,indent=2)+'\n')
(packet/'IMAGE_PROVENANCE.json').write_text(json.dumps(images,indent=2)+'\n')
intro=f'''# Hestia: English UI und Crashsite — Review 2026-10-13

Quellcheckpoint: `{sourceSha}`. Branch `codex/hestia-fp06-play-candidate-2026-10-12`. Root war der einzige Implementierungs-/Art-Writer; unabhängiger Reviewer ohne Repository-Codeänderungen.

Die freigegebene Keramik/Petrol-Richtung ist in den vorhandenen Factory-Flows umgesetzt. Spielertexte, Panels und Statusmeldungen sind Englisch; eingefrorene Daten und eigene Markertexte bleiben erhalten. Native UI-Thumbnails werden tatsächlich geladen. Das neue größere Wrack wurde in Blender modelliert, als GLB exportiert und im Browser importiert. **Seine native Spielworld-Integration ist NOT_ADMITTED**; die Geschütze sind ruhende Art ohne Munition/Defense-Gameplay.

| Bereich | Tatsächlicher Stand |
| --- | --- |
| Functional/UI | 110 gezielte Tests PASS; normale Ansichten, Auswahl, abgewiesene Bauvorschau, Fokus, Escape und Recovery geprüft |
| Clean Copy | gelockte npm-Installation, TypeScript/Vite-Build und echte Browser-Smokes PASS |
| Assets | {len(coverage)} aktuelle Factory-.blend-Quellen mit tatsächlichen Payloads; jedes Modell mit Bild im Review |
| Visual | OWNER_REVIEW_PENDING; Design-QA bleibt BLOCKED wegen Karte, nativer Crashsite und vereinfachter Transportdarstellung |
| Save / vollständiger 16-kg-Kreislauf | NOT_RUN in diesem Checkpoint; W09–W11 weiterhin offen |
| Regressionen | Gesamtsuite nicht grün: historischer Lauf 2419 PASS/21 FAIL, reparierte UI-Pfade gezielt grün, fünf bekannte Fach-/Zeitbudgetfälle offen |
| Performance | Software-GPU llvmpipe auf Xeon Platinum 8573C, 4 CPU-Quota: isolierter pausierter Frame-Sample Median 516.5 ms, p95 1416.6 ms; keine Gameplay-Performanceabnahme |

Im letzten Durchlauf: SimulationHold bei Tick 27, danach normale Recovery zu bestätigt Paused. Ein Harness-Enum hatte den Start zu stark beschrieben; [HARNESS_LABEL_AUDIT.json](evidence/HARNESS_LABEL_AUDIT.json) dokumentiert das, ohne die Rohdateien umzuschreiben. Frühere Rohbeobachtungen zeigen Running/Ready bei Tick 72–123; das ist keine vollständige Gameplayabnahme.

[Getestete Startbefehle und Steuerung](README_PLAY.md) · [Vollständiger Prüfbericht](source/docs/factory/fp06/play/2026-10-13/ui-ceramic/STATUS.md) · [Design-QA](source/design-qa.md) · [Native Wrackdatei](source/art/factory/crashsite-hybrid-v1/crashsite-hybrid-v1.blend) · [GLB](source/art/factory/crashsite-hybrid-v1/crashsite-hybrid-v1.glb)

Die **HTML-Galerie enthält sämtliche Bilder eingebettet** und funktioniert als einzelne Datei. Für Markdown und Modelle das gesamte ZIP entpacken. `source/` enthält komplette Browser-/Factoryquellen und geprüfte Factory-LFS-Payloads, den vorgebauten `dist/`, Tests, Lockdatei, Lizenz und Factory-Dokumente. Historische fremde Modularschiff-Art, Git-Historie, alte Evidence und node_modules sind bewusst nicht Bestandteil dieses Browser-/Factory-Snapshots; Umfang steht in SOURCE_SNAPSHOT.json. Kein Mainmerge, Push oder Publishing.

'''
md=intro
currentGroup=None
for item in images:
 if item['group']!=currentGroup:currentGroup=item['group'];md+='\n## '+currentGroup+'\n\n'
 md+='### '+item['title']+'\n\n'+item['note']+'\n\n!['+item['title']+']('+item['file']+')\n\n'
(packet/'REVIEW.md').write_text(md)
# Standalone HTML: every displayed image is embedded, no missing-relative-image problem.
sections=[];last=None
for item in images:
 if item['group']!=last:
  last=item['group'];sections.append('<h2>'+html.escape(last)+'</h2>')
 data=base64.b64encode((packet/item['file']).read_bytes()).decode()
 sections.append('<figure><h3>'+html.escape(item['title'])+'</h3><img loading="lazy" src="data:image/png;base64,'+data+'" alt="'+html.escape(item['title'])+'"><figcaption>'+html.escape(item['note'])+'</figcaption></figure>')
content='''<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hestia English UI & Crashsite Review</title><style>body{margin:0;background:#f6f0e3;color:#182b38;font:17px/1.55 system-ui}header,main{max-width:1180px;margin:auto;padding:28px}header{border-bottom:2px solid #216780}h1{font-size:32px}h2{margin:50px 0 16px;border-bottom:1px solid #d4cfc2}h3{margin:12px 0}figure{margin:0 0 34px;padding:16px;background:white;border:1px solid #d4cfc2}img{display:block;max-width:100%;max-height:900px;object-fit:contain;margin:auto}figcaption{font-size:14px;color:#55636a;margin-top:12px}.status{border-left:4px solid #216780;padding:12px 20px;background:#e0edf0}code{overflow-wrap:anywhere}a{color:#216780}</style><header><h1>Hestia — English UI & Crashsite</h1><p>Aktueller Quellcheckpoint: <code>'''+sourceSha+'''</code></p><p class="status">110 fokussierte Tests und Clean-Copy-Build PASS. Native Crashsite ist NOT_ADMITTED. Save/16-kg-Flow und W09–W11 bleiben offen; Visual OWNER_REVIEW_PENDING. Die letzte Spielaufnahme zeigt SimulationHold und erfolgreiche Rückkehr zu Paused.</p><p>Alle Bilder sind in dieser HTML-Datei eingebettet. Concept-Art, tatsächliche Blender-Renders, alte unveränderte Quellen und aktueller Browser sind jeweils beschriftet. <a href="REVIEW.md">Markdown</a> · <a href="README_PLAY.md">Startbefehle</a></p></header><main>'''+''.join(sections)+'</main></html>'
(packet/'GALERIE.html').write_text(content)
# Seal actual files; generated manifest is excluded from its own hash list.
rows=[]
for p in sorted(packet.rglob('*')):
 if not p.is_file() or p.name in ['MANIFEST.json','SHA256SUMS.txt']:continue
 p.chmod(0o644)
 if p.suffix in ['.blend','.glb','.png'] and p.read_bytes().startswith(b'version https://git-lfs.github.com/spec/v1'):raise RuntimeError('Pointer-only payload '+str(p))
 rows.append({'path':str(p.relative_to(packet)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
for p in [packet,*packet.rglob('*')]:
 if p.is_dir():p.chmod(0o755)
(packet/'MANIFEST.json').write_text(json.dumps({'schema':'hestia.review.materialized/v1','sourceCommitSha':sourceSha,'images':len(images),'factoryBlenderSources':len(coverage),'files':rows,'noPublishing':True,'acceptance':'OWNER_REVIEW_PENDING'},indent=2)+'\n')
(packet/'SHA256SUMS.txt').write_text(''.join(r['sha256']+'  '+r['path']+'\n' for r in rows))
for p in packet.glob('*'):
 if p.is_file():p.chmod(0o644)
print(json.dumps({'package':str(packet),'files':len(rows),'galleryImages':len(images),'factoryBlenderSources':len(coverage),'htmlBytes':(packet/'GALERIE.html').stat().st_size,'sourceCommitSha':sourceSha}))
