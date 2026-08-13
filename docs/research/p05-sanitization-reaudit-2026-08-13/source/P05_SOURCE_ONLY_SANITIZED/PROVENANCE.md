# P05 Source Provenance and License Status

## Identity

- Sanitized package: `p05-ai-copilot-transaction-ux-sanitized@0.2.0`
- Sanitization and rebuild date: 2026-08-13
- Quarantined input SHA-256: `988257c9d9ad74e57b7c963387c695612ace099aa8e55ed82e0982ac6cc4cbb7`
- Quarantined package disposition: `DISCARD / QUARANTINED`

## Source lineage

The visual transaction flow, CSS, favicon, and UX findings were derived from
the isolated P05 prototype created on 2026-08-12. The sanitization rebuild:

- retained the deterministic nine-step React mock flow;
- replaced the Vinext, Next.js, Cloudflare, database, worker, D1, R2, Sites,
  and hosting scaffold with a client-only Vite build;
- removed all supplied and generated build products from the source archive;
- removed deployment metadata, caches, browser state, logs, test reports,
  source maps, and environment files;
- added package-boundary tests and explicit archive provenance.

No code was copied from `Weltraum-Spiel` or `hestia-voxel-kernel-lab`. No
product repository was changed.

## License status

The package is marked `UNLICENSED`. This archive is retained for internal
prototype evaluation and UX adaptation. It grants no permission for external
distribution or product adoption. Third-party runtime and development packages
remain governed by their own licenses as resolved by `package-lock.json`.
