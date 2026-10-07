# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: native.spec.ts >> RAY02: Position/Depth/Material/Normal nach Edit stimmt mit belegter Quelle; keine geglättete SDF-Oberfläche
- Location: ..\..\tests\RD-13\native.spec.ts:14:1

# Error details

```
Error: page.evaluate: Error: Actual removed source cell required
    at r (http://127.0.0.1:5280/assets/validation-DshwGweA.js:1:106)
    at Object.probeEdit (http://127.0.0.1:5280/assets/entry8-CzSJrQ9J.js:2:6491)
    at async eval (eval at evaluate (:303:30), <anonymous>:3:11)
    at async <anonymous>:329:30
```

# Page snapshot

```yaml
- main [ref=e2]:
  - heading "RD13 · bounded voxel rays / actual greedy control" [level=1] [ref=e3]
  - paragraph [ref=e4]: Lab projection only · productIntegrated=false · native qualification pending · no performance or art-parity claim.
  - paragraph [ref=e5]: Both variants use the same original slots and selected occupancy, without face AO. F01 is a frozen 64³ terrain window plus original water; vegetation is omitted. Outside coverage stays Unknown.
  - generic [ref=e6]:
    - text: Fixture
    - combobox "Fixture" [ref=e7]:
      - option "F00-CONTROL-REPLAY"
      - option "F01-HVP-COAST-REPLAY"
      - option "F03-SHELTER-REPLAY"
      - option "F04-DETACH-REPLAY"
      - option "F05-CUTOUT-REPLAY"
      - option "F06-MATERIAL-REPLAY" [selected]
  - generic [ref=e8]:
    - text: Variant
    - combobox "Variant" [ref=e9]:
      - option "WebGL2 DDA rays · no AO" [selected]
      - option "Real greedy mesh · no AO"
  - button "Remount selected source / recover explicitly" [ref=e10]
  - generic [ref=e11]:
    - generic [ref=e12]:
      - text: Camera
      - combobox "Camera" [ref=e13]:
        - option "far" [selected]
        - option "interior"
        - option "medium"
        - option "near"
    - generic [ref=e14]:
      - text: Tick
      - spinbutton "Tick" [ref=e15]: "90"
    - button "Seek" [ref=e16]
    - button "Step +1" [ref=e17]
    - button "Pause" [ref=e18]
    - button "Reset" [ref=e19]
    - generic [ref=e20]:
      - text: Resolution
      - combobox "Resolution" [ref=e21]:
        - option "1280×720" [selected]
        - option "960×540"
        - option "640×360"
    - generic [ref=e22]:
      - text: DPR
      - combobox "DPR" [ref=e23]:
        - option "1" [selected]
        - option "2"
    - button "Dispose" [ref=e24]
  - status [ref=e25]: Host render submitted. Native numeric/image/depth-water qualification still NOT RUN; this is not an art/performance PASS.
  - generic "RD13 lab projection" [ref=e26]
  - group [ref=e27]:
    - generic "Source, costs, unsupported features and failure history" [ref=e28]
```