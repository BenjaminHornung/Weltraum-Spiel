# Contributing

Contributions are welcome for review, but acceptance is entirely at the maintainer's discretion.

## License of Contributions

By submitting a pull request, you confirm that:

1. you have the right to submit the contribution;
2. the contribution does not contain code, assets, data or secrets that you are not allowed to publish;
3. you license the contribution under the repository's [PolyForm Noncommercial License 1.0.0](LICENSE), including the repository's required notice;
4. you understand that commercial use remains prohibited without a separate written license from Benjamin Hornung;
5. submission does not guarantee acceptance, attribution beyond Git history, support or inclusion in a release.

Do not submit material copied from another game, repository, asset pack or generated source unless its license is compatible and the origin is documented in the pull request.

## Pull Request Rules

- Target `main` from a dedicated branch or fork.
- Never push directly to `main`.
- Keep one coherent change per pull request.
- Explain the goal, scope, risks, tests and changed paths.
- Do not include credentials, tokens, private URLs, personal information or machine-specific secrets.
- Do not weaken tests, security workflows, branch controls or runtime guardrails to obtain a passing result.
- Do not add `pull_request_target`, privileged runners, self-hosted runner labels, broad write permissions or secret access without an explicit security review.
- Do not add package or lockfile changes unless they are required and explained.
- Do not change `Assets/**`; Unity is an immutable legacy/reference boundary on `main`.
- Preserve the browser runtime invariants documented in `README.md` and repository guidance.

## Required Verification

For browser changes, run from `apps/weltraum-browser`:

```bash
npm ci
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
```

The pull request must pass the required GitHub checks. External fork workflows run only after maintainer approval.

## Merge Authority

Anyone may propose a pull request. Only users with write, maintain or admin permission can merge changes into `main`; public contributors receive none of those permissions merely by opening a pull request.

The repository owner decides whether and when a pull request is merged. The final manual confirmation is the owner's normal GitHub **Squash and merge** action after required checks pass and review conversations are resolved. No separate SHA comment is required.

A pull request author may close their own proposal. Closing a pull request does not modify `main`, does not merge code and does not grant repository permissions.

## Security Reports

Do not disclose vulnerabilities in a public pull request or issue. Follow [SECURITY.md](SECURITY.md).
