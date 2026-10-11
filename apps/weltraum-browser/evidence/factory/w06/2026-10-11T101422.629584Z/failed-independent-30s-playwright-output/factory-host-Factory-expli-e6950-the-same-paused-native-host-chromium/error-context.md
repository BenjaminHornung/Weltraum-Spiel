# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: factory-host.spec.ts >> Factory explicitly resumes the same paused native host
- Location: tests/e2e/factory-host.spec.ts:68:1

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- main [ref=e2]:
  - generic "HVP-02 readable coast viewport" [ref=e3]
  - region "Hestia coast and vegetation controls" [ref=e4]:
    - strong [ref=e5]: HVP-13 HESTIA COAST
    - status [ref=e6]: "State: Ready"
    - generic [ref=e7]: "Camera: C04-WIDE (Orbit)"
    - generic [ref=e8]: "Terrain faces: 49436 · vertices: 197744 · triangles: 98872 · scene: 186876 voxel quads / 374632 total tris (coast+flora+sky)"
    - status [ref=e9]: "Physics: Running · 4 bodies / 88 colliders · g=11.79 m/s² · Fallhöhe y=0.62 m · Player: Inspection"
    - status [ref=e10]: "Plasmacutter: Zelle · Idle · Spielen: 1 Zelle · 2 Box · 3 Kugel · Linksklick · 1/2/3, Linksklick · Terrain: SafeQuarry / Holz: Ast · F: Schieben (4 m / 15 N·s) · L-Körper bereit · Ast: Idle · Taste 2 + Linksklick · Fragment: Idle · 1 Zelle / 2 Box / 3 Kugel erneut schneiden"
    - status [ref=e11]: "Spielstand: Idle · Lokaler Hestia-Spielstand"
    - status [ref=e12]: "Ostregion: NotRequested · LOD 0.5 m · Kollision fehlt · Ruhende Fragmente: 0"
    - generic [ref=e13]:
      - button "Sitzung beenden" [ref=e14]
      - button "Spielen · WASD / Maus / Space" [ref=e15]
      - 'button "Perspektive: Ego (V)" [ref=e16]'
      - button "C01-EYE" [ref=e17]
      - button "C02-SHORE" [ref=e18]
      - button "C03-ROOTS" [ref=e19]
      - button "C04-WIDE" [ref=e20]
      - button "C05-Felsarm" [ref=e21]
      - button "Felsarm-Stütze prüfen (ohne Schnitt)" [ref=e22]
      - button "Stütze anvisieren (2 + Klick)" [ref=e23]
      - 'button "Neustart: Felsarm" [ref=e24]'
      - button "Neuer Bergungsauftrag" [ref=e25]
      - 'button "Neustart: Ostpfad" [ref=e26]'
      - button "Ostregion erneut versuchen" [ref=e27]
      - 'button "Ansicht: Schnittstelle" [ref=e28]'
      - button "L-Körper anvisieren (F)" [ref=e29]
      - button "Ast anvisieren (2 + Klick)" [ref=e30]
      - 'button "1: Zelle" [ref=e31]'
      - 'button "2: Box" [ref=e32]'
      - 'button "3: Kugel" [ref=e33]'
      - button "Spielstand speichern" [ref=e34]
      - button "Spielstand laden" [ref=e35]
      - button "Gespeicherte Sitzung neu öffnen" [ref=e36]
      - button "Reset view" [ref=e37]
      - 'button "Water: on" [ref=e38]'
      - 'button "Inspect: off" [ref=e39]'
      - button "Inspect-only ambient occlusion toggle" [pressed] [ref=e40]: "AO: on"
      - button "Physik pausieren" [ref=e41]
      - button "Fallkörper neu starten" [ref=e42]
      - button "Hide UI" [ref=e43]
  - region "Werkstatt" [ref=e44]:
    - strong [ref=e45]: Hestia · Werkstatt
    - status [ref=e46]: Werkstatt bereit · Aktiv
    - paragraph [ref=e47]: Werkstatt vorbereitet. Bau und Produktion folgen. Gemeinsames Speichern ist noch nicht verfügbar.
    - button "Werkstatt pausieren" [ref=e48]
    - button "Werkstatt fortsetzen" [disabled] [ref=e49]
```
