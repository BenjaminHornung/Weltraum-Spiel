# P05 GitHub Archive Note

This directory persists the sanitized P05 re-audit result in repository-native
form.

## Why the ZIP is expanded

The repository's `.gitattributes` requires `*.zip` to be stored through Git
LFS. The available GitHub API workflow can create normal Git blobs but cannot
upload an LFS object. Committing the ZIP as a normal blob would violate the
repository contract.

Therefore the exact 18-file source tree from
`P05_SOURCE_ONLY_SANITIZED.zip` is committed below
`source/P05_SOURCE_ONLY_SANITIZED/`. The binary ZIP remains bound by its
receipt, manifest and checksum:

```text
SHA-256 43088de468f78021dc2b9fd6f6233759a8cbc66816ef7026fda2f32094ae6b10
size    42696 bytes
```

## Byte-identical reconstruction

From the directory containing `P05_SOURCE_ONLY_SANITIZED/`, on a checkout that
preserves the repository's LF blob bytes:

```bash
find P05_SOURCE_ONLY_SANITIZED -type f -exec touch -t 202608130000.00 {} +
find P05_SOURCE_ONLY_SANITIZED -type f -print \
  | LC_ALL=C sort \
  | zip -X -q P05_SOURCE_ONLY_SANITIZED.zip -@
sha256sum P05_SOURCE_ONLY_SANITIZED.zip
```

The expected SHA-256 is the value above. The quarantined original P05 archive
is intentionally not present anywhere in this tree.
