# Security Policy

## Supported Version

Security fixes are applied only to the current `main` branch. Historical tags, archived branches, evidence snapshots and the Unity legacy archive are not maintained release channels.

## Report Vulnerabilities Privately

Do **not** open a public issue, discussion or pull request for a suspected vulnerability, leaked credential or exploitable workflow weakness.

Use GitHub private vulnerability reporting:

https://github.com/BenjaminHornung/Weltraum-Spiel/security/advisories/new

Include:

- the affected path, workflow or runtime surface;
- the exact commit SHA;
- reproduction steps or a minimal proof of concept;
- expected and observed behavior;
- realistic impact and required attacker capabilities;
- any suggested remediation;
- whether the issue has been disclosed anywhere else.

Do not include real credentials, personal information or destructive payloads. Use clearly fake test data.

## Research Boundaries

Good-faith testing must stay within your own accounts, forks and local environments. Do not:

- access, modify or delete data belonging to another person;
- exfiltrate repository, Actions or user secrets;
- degrade GitHub, runner or project availability;
- run denial-of-service, persistence or lateral-movement tests;
- interact with private infrastructure or self-hosted runners;
- publicly disclose an unresolved vulnerability.

Stop testing once you have enough evidence to demonstrate the issue safely.

## Response Targets

The maintainer will aim to acknowledge a complete report within seven days. Validation, remediation and disclosure timing depend on severity and reproducibility. These are targets, not service-level guarantees.

## Public Disclosure

Coordinate disclosure with the maintainer. A security advisory, fix and credit may be published after affected users have a reasonable opportunity to update.
