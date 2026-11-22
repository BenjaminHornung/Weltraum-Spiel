# PHY-04 Nexus build on Linux x86-64

The portable build compiles the existing PHY-04 Rust/WebGPU harness. It materializes verified upstream source trees and applies a hash-pinned browser overlay to the shipped harness. Its transitive `bvh → rand → getrandom` dependency requires the `js` feature on wasm32-unknown-unknown. The overlay enables the Web Crypto entropy backend on the browser target. Its lockfile changes add three dependency edges and retain the original package versions and checksums. The historical Windows handoff and its PLT/PHY-01 review receipts use a separate schema and remain in the handoff directory.

## Build

Use a Linux x86-64 runner with Python 3.12 or later, Bash, Git, curl, GNU tar, a C/C++ toolchain, pkg-config and OpenSSL development headers. The initial run needs access to the three pinned Git repositories, Cargo's locked dependencies, the Rust distribution archives and the cargo-gpu shader compiler dependencies. Allow space for separate Rust toolchains and shader builds.

```sh
spikes/nexus-gpu/build-linux.sh /tmp/hestia-nexus-build
```

Cargo uses one build job by default. The build installs a private Rust 1.97.1 host toolchain, the matching wasm32-unknown-unknown target, cargo-gpu 0.10.0 and wasm-bindgen 0.2.129. The Rust bootstrap and bindgen download have pinned SHA-256 checksums. Cargo-gpu selects its own matching shader compiler toolchain. Its compiler artifacts persist under the selected work directory. Each invocation stages its sources and outputs into a fresh run directory.

To reuse existing Git clones, pass their parent directory as the second argument. It must contain `nexus/`, `khal/` and `vortx/`. The preparation step checks the pinned commit tree, every file's Git blob and executable bit, and the harness and lockfile SHA-256. The preparation-only command also works without Rust.

```sh
python3 spikes/nexus-gpu/prepare.py /tmp/hestia-nexus-inputs --git-cache /path/to/cached/clones
python3 -m unittest discover -s spikes/nexus-gpu -p test_build.py -v
```

## Outputs

The run directory contains `source-receipt.json`, `build.log` and the terminal `exit-code`. A successful release build also emits `web/nexus.js`, `web/nexus_bg.wasm`, and a `web/bindings.json` compatible with the existing PHY-04 browser runner. Binding requires SPIR-V from the Vortx and Nexus rigid-body build scripts and locates the exact shader byte sequences inside the built WebAssembly module. GPU dispatch, numerical agreement, device loss and reference performance require subsequent browser runs.

[Source and tool pins](SourceBindings.json)
