#!/usr/bin/env bash
# Build the reviewed PHY-04 harness in an isolated Linux x86-64 workspace.
set -euo pipefail
if [[ "$#" -lt 1 || "$#" -gt 2 ]]; then
    echo "usage: $0 OUTPUT_DIRECTORY [LOCAL_GIT_CACHE_WITH_nexus_khal_vortx]" >&2
    exit 2
fi
if [[ "$(uname -sm)" != "Linux x86_64" ]]; then
    echo "This bootstrap pins Linux x86-64 tool binaries." >&2
    exit 2
fi
if [[ -v KHAL_SKIP_SPIRV || -v KHAL_CUDA_ARCH ]]; then
    echo "WebGPU qualification requires SPIR-V shader compilation." >&2
    exit 2
fi

script_dir=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$1"
work=$(cd "$1" && pwd)
run_dir=$(mktemp -d "$work/run-XXXXXXXX")
echo "Build files and log: $run_dir"
exec > >(tee "$run_dir/build.log") 2>&1
trap 'printf "%s\n" "$?" > "$run_dir/exit-code"' EXIT
pin() {
    python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["tools"][sys.argv[2]])' "$script_dir/SourceBindings.json" "$1"
}

prepare_args=("$run_dir")
if [[ $# -eq 2 ]]; then prepare_args+=(--git-cache "$2"); fi
python3 "$script_dir/prepare.py" "${prepare_args[@]}" > "$run_dir/source-receipt.json"
export CARGO_HOME="$work/cargo" RUSTUP_HOME="$work/rustup" XDG_CACHE_HOME="$work/xdg-cache"
export CARGO_NET_GIT_FETCH_WITH_CLI=true
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-1}"
export RUSTUP_TOOLCHAIN="$(pin rust)"
export PATH="$CARGO_HOME/bin:$PATH"
# The script owns this cache. Neither home configuration nor global binaries are modified.
mkdir -p "$CARGO_HOME/bin"
if [[ ! -x "$CARGO_HOME/bin/rustup" ]]; then
    curl --fail --show-error --location --retry 2 \
        "https://static.rust-lang.org/rustup/archive/$(pin rustupInitVersion)/x86_64-unknown-linux-gnu/rustup-init" \
        -o "$run_dir/rustup-init"
    echo "$(pin rustupInitLinuxX64Sha256)  $run_dir/rustup-init" | sha256sum -c -
    chmod 700 "$run_dir/rustup-init"
    "$run_dir/rustup-init" -y --no-modify-path --profile minimal --default-toolchain none
fi
rustup set auto-self-update disable
rustup toolchain install "$RUSTUP_TOOLCHAIN" --profile minimal --target wasm32-unknown-unknown
rustc --version --verbose
cargo --version
gpu_version=$(pin cargoGpu)
if [[ ! -x "$CARGO_HOME/bin/cargo-gpu" || "$(cargo gpu --version)" != *" $gpu_version" ]]; then
    cargo install cargo-gpu --locked --version "=$gpu_version" --jobs "$CARGO_BUILD_JOBS"
fi
cargo gpu --version
bindgen=$(pin wasmBindgen)
archive="wasm-bindgen-$bindgen-x86_64-unknown-linux-musl"
if [[ ! -x "$CARGO_HOME/bin/wasm-bindgen" || "$(wasm-bindgen --version)" != "wasm-bindgen $bindgen" ]]; then
    curl --fail --show-error --location --retry 2 \
        "https://github.com/wasm-bindgen/wasm-bindgen/releases/download/$bindgen/$archive.tar.gz" -o "$run_dir/bindgen.tar.gz"
    echo "$(pin wasmBindgenLinuxX64ArchiveSha256)  $run_dir/bindgen.tar.gz" | sha256sum -c -
    tar -xzf "$run_dir/bindgen.tar.gz" --strip-components=1 -C "$CARGO_HOME/bin" "$archive/wasm-bindgen"
fi
wasm-bindgen --version
cd "$run_dir"
export CARGO_TARGET_DIR="$run_dir/target"
cargo fetch --manifest-path harness/Cargo.toml --locked
cargo gpu install --shader-crate harness --spirv-builder-version "$gpu_version" --auto-install-rust-toolchain
cargo build --locked --release --target wasm32-unknown-unknown --jobs "$CARGO_BUILD_JOBS" \
    --manifest-path harness/Cargo.toml --message-format=json-render-diagnostics > cargo-build.jsonl
wasm-bindgen --target web --out-name nexus --out-dir web "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/phy04_nexus_browser.wasm"
python3 "$script_dir/bind-artifacts.py" "$run_dir"
