# Design - player-ui-evidence-manifest-v1

## Decision

Use a JSON manifest plus a small Unity Editor test. The manifest is easy to review in Git, and the test turns screenshot references into a repeatable gate without depending on external image libraries.

## Manifest Fields

Each screenshot entry records:

- `id`: stable short evidence identifier.
- `path`: repository-relative PNG path.
- `width` / `height`: expected PNG dimensions from the file header.
- `minBytes`: minimum nontrivial file size.
- `captureKind`: renderer-state, live PlayMode, or live aspect evidence.
- `state`: short human-readable state.

## Validation

The test resolves paths under the repository, requires every path to stay inside `.devtoolbox/specs/changes`, checks duplicate IDs and paths, validates the PNG signature, reads PNG dimensions directly from the IHDR bytes, and asserts each file is larger than `minBytes`.

This is intentionally evidence-only. It does not decide visual quality; it prevents stale or missing audit artifacts from silently weakening the Player UI concept verification.
