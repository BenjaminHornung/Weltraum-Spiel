# P05 AI Copilot Transaction UX · Sanitized Source

Client-only, deterministic browser prototype for the P05 authoring transaction
flow. This rebuild is source-only and contains no deployment runtime, server
manifest, credential, generated build output, cache, browser profile, test
report, source map, or environment file.

Status: `MOCK / UX PROTOTYPE / NO PRODUCT AUTHORITY`

## Visible flow

1. user instruction;
2. structured tool plan;
3. dry-run preview;
4. validator issues;
5. proposed correction;
6. frozen diff;
7. owner approval gate;
8. simulated local commit;
9. simulated compensating undo.

Every state remains visibly marked `MOCK FIXTURE`, `KEINE EXTERNE KI`, and
`KEIN PRODUKT-WRITE`.

## Truth and security boundaries

- No AI or model API is called.
- No repository, product, file, database, or external service is written.
- `Commit` and `Undo` only change ephemeral React state.
- Actor IDs, revisions, hashes, receipts, permissions, validator results, and
  timestamps are deterministic fixtures, not authenticated authority.
- No performance characteristic is claimed.

## Reproducible local verification

Prerequisite: Node.js `>=22.13.0` and npm with lockfile-v3 support.

Install only from the committed lockfile:

```bash
npm ci
```

Run all static and build checks:

```bash
npm run lint
npm run build
npm test
```

Start the production preview:

```bash
npm run preview -- --port 4175
```

The fresh build is intentionally excluded from the source-only ZIP. It can be
recreated from `package-lock.json` and must pass a separate secret scan before
use as evidence.

## Package contents

- `src/`: the deterministic React UI and styling;
- `tests/`: source and build-boundary checks;
- `docs/P05_UX_FINDINGS.md`: preserved UX learnings and explicit limits;
- `PROVENANCE.md`: source lineage, sanitization actions, and license status;
- package, TypeScript, ESLint, and Vite configuration;
- exact npm lockfile generated for this sanitized dependency set.

The prior P05 ZIP and every `dist/` directory are explicitly excluded.
