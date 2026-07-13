# Unity Legacy Manifest

## Immutable archive references

The final Unity-containing mainline snapshot is preserved at:

- Commit: `8383487f89f6eb6e63140def564052ac86de259a`
- Tag: `unity-legacy-final-2026-07`
- Archive branch: `archive/unity-legacy-final-2026-07`

The tag and archive branch were created before cleanup edits, pushed to
`origin`, and verified to resolve to the exact commit above.

```text
8383487f89f6eb6e63140def564052ac86de259a refs/tags/unity-legacy-final-2026-07
8383487f89f6eb6e63140def564052ac86de259a refs/heads/archive/unity-legacy-final-2026-07
```

No history rewrite, force push or Git LFS history migration was performed.

## Recovery

For historical source inspection, create a separate worktree or clone from the
archive branch or tag. Do not merge Unity product architecture back into the
browser mainline.

```text
git worktree add <outside-current-repository-path> unity-legacy-final-2026-07
```

## Pre-existing LFS integrity limitation

The archived commit contains four Git LFS pointers whose payloads were already
absent from GitHub LFS before this cleanup. Normal fetch attempts return HTTP
404, all registered local worktrees contain pointers only, and no exact payload
was found in local context archives.

| Path | LFS object ID |
| --- | --- |
| `.devtoolbox/specs/changes/archive/2026-05-21-prototype-test-environment-ui-pass/tests/screenshots/environment-overview.png` | `c03d059b365d570421ef9c8f06abd7f55c2bbc50ce6587afb84b436f02738e53` |
| `.devtoolbox/specs/changes/archive/2026-05-21-prototype-ui-readability-testability-pass/tests/screenshots/default-compact-flight-ui-after-navball-fix.png` | `909d62e6585e6439a6d189d21b81140e8e892a054801c7fa2e026e8daa50fdd1` |
| `.devtoolbox/specs/changes/archive/2026-05-21-prototype-ui-readability-testability-pass/tests/screenshots/default-compact-flight-ui.png` | `414747a1b9c1943cce1f8b5087a2b55be292df891514e477ceec64e8a0b2a284` |
| `Assets/TutorialInfo/Icons/URP.png` | `1d17a9ff3537859abe2c008603d29d90cf43191ae77aa386167cc65e53ba03d9` |

This is a pre-existing evidence/tutorial-asset loss, not a cleanup deletion.
The source, configuration and other available LFS payloads remain referenced by
the archive refs. The active browser-mainline cleanup removes the broken
pointers rather than fabricating replacement binaries.

## Browser-mainline relationship

The archive is a legacy/reference source for intent, bug traps, art metadata
and historical evidence only. Product development continues under
`apps/weltraum-browser`; renderer objects do not own gameplay truth.
