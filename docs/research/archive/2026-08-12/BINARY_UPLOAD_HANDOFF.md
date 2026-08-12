# Binary Upload Handoff

The GitHub connector can safely create the archive branch and commit text
metadata, but it cannot stream the local ZIP/PNG bytes as file parameters.
A local git-capable agent should therefore complete the binary upload.

## Target

```text
Repository: BenjaminHornung/Weltraum-Spiel
Branch: archive/cloud-research-prototypes-2026-08-12
Base/main SHA: 15f3550bd604856b25d40a7ac700ec4d5106b89e
Target root: docs/research/archive/2026-08-12/
```

## Prepared package

Use the downloadable archive `weltraum-research-prototypes-archive-2026-08-12.zip`.
It contains:

- source-only P01–P05 ZIPs;
- representative screenshots;
- all locally available Markdown reports;
- a report index;
- SHA-256 archive manifest;
- prototype intake and next-step synthesis.

## Rules

- Do not merge the archive branch.
- Do not modify `main`, runtime code, package files or CI.
- Preserve the exact paths and bytes from the archive manifest.
- Do not add generated build/cache folders or font binaries.
- Verify every SHA-256 after extraction and before commit.
- Commit message:
  `#WELTRAUM-000 Archive cloud research and isolated prototypes`
- Non-force push only; stop afterward.
