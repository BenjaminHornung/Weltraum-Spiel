# RD12 native owning findings — frozen 5e4c1b8f

Functional diagnostic completed, native qualification did not pass. No runtime,
original native test, profile, threshold or ROI was edited. ProductIntegrated=false.

## Frozen original harness reader — confirmed blocker

All original16 tests attempted and failed at `tests/RD-12/browser.spec.ts:16`:
`JSON.parse(await page.locator('#facts').innerText())` receives an empty string.
Actual native C3/C4 DOM diagnosis proves the nearest `details` is closed,
`innerTextLength=0`, while `textContent` contains valid current runtime JSON.
The original attempt, failure PNGs/error contexts/traces remain retained.

Owning future repair location: that facts reader, not gameplay/render authority.
The separately sealed `native-reader-v2.ts` accepts textContent only after the
immutable successful diagnosis proof, actual collapsed details, nonempty text and
runtime shape checks. Supplemental BAB bodies/capture/ROI/assertions differ only
by the explicit reader delegation and versioned titles; they are not original PASS.

## F06 depth control — confirmed insensitive, FAIL / DEFER

Original frozen region `[0.05,0.05,0.90,0.90]`, first fixture camera and
`disable-depth-test` fault were used unchanged. Native PNG/facts show the fault
command and distinct presentation generations; decoded PNG pixels show a real
but insufficient effect. Restoration MAE is zero for both backends.

| Backend | Pixels | Reference contrast | Fault MAE | Required minimum |
| --- | ---: | ---: | ---: | ---: |
| C3 WebGL2 | 748297 | 0.10678134663632566 | 0.0018225261489397359 | 0.01 |
| C4 WebGPU | 748297 | 0.10679002123123271 | 0.0018214046481368742 | 0.01 |

Both deliberate faults also still satisfy positive MAE <=0.035, so this region
cannot qualify parity. Gates correctly reject it. Do not interpret restoration
MAE=0 as parity or tune the ROI/camera/threshold to make this run green.
Owning contract locations: `reports/RD-12/oracle.ts` F06 region and
`src/experiments/babylon/index.ts:212-216` depth-fault application. No functional
runtime defect is established by the insufficient sensitivity alone. Any new
qualification design requires separate authority/specification; no fix here.

## Expected native buffer qualification — UNSUPPORTED, actual FAIL2

Supplemental original-body assertions still require `PASS_NATIVE_READBACK`.
Actual C3 result: `UNSUPPORTED`, native WebGL buffer readback not yet qualified.
Actual C4 result: `UNSUPPORTED`, stock9.29 vertex/index buffers lack COPY_SRC.
SDK-retained CPU attributes are explicitly not native mapped-buffer evidence.
No skip, new expected value, synthetic GPU buffer or runtime change was used.

## Qualified scope and remaining limits

Six C3/C4 F01/F04/F06 snapshot/backseek/reset/camera/resize flows pass; 20 owned
teardown cycles per backend pass; genuine owned context/device-loss checks pass.
F01 only qualifies same-backend restoration and deliberate color omission:
C3 fault MAE0.04902906966642507, C4 MAE0.04904784987756236, restoration0,
665281pixels. This is not C0 or cross-engine/stock-BRDF parity.

Default adapter observation is Intel/xe-lpg, isFallbackAdapter=false; C3 actual
GL renderer is ANGLE Intel Arc Pro140T/D3D11. C4 application adapter identity is
not attested. The listed NVIDIA/Microsoft devices are not selected-device claims.
Memory/VRAM remain unknown; zero logical owners are not released native VRAM.
No shader/BRDF/shadow/AO/water/weather/sample/alpha, performance, art, product,
RD51 or RD52 completion claim. Visible home/gallery links and normal bridge
absence were observed; no C3/C4 gallery variant is claimed.
