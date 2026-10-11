# W05 final committed artifact binding

**PASS: the accepted W05 product and its own evidence are bound to actual commit `26d5e892c2b401b9011234dabf86955af7462fb8`.** This commit's sole parent is the required base `10e1e3026610065206d8ac4b361d3f1686114dd8`. Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-domain-2026-10-11` is clean. The earlier independent SPEC PASS / QUALITY PASS remains valid; no new product review or tests were run.

Reviewer `/root/w11_evidence` independently read Git HEAD blobs/pointers with `git cat-file --batch`, compared the exact changed path set and hashes, read local LFS object bytes, decompressed indexed raw archives and read the writer's receipts. No test/build/browser/server, Git mutation, network fetch or repository repair was executed. Only this external report was written.

## Independently verified exact scope

| Binding | Actual result |
| --- | --- |
| Changed paths from full base to full HEAD | Exactly175, equal to the writer's complete file-hash path set. No missing or additional paths. |
| Product paths | Exactly18 in the six W05 granted roots; every committed byte/size/SHA256 equals the final sealed product snapshot. |
| Own evidence paths | Exactly157, all under `apps/weltraum-browser/evidence/factory/w05/run-20261011T104359Z/`, including its manifest. |
| Committed manifest references | All18 product references and156 evidence references match actual committed bytes/SHA256/size. The manifest itself is the157th own evidence file. |
| Raw gzip originals | Exactly16 indexed archives; each committed compressed SHA, decompressed original SHA and original byte count matches `raw-log-index.json`. |
| Committed LFS references | Exactly90 valid own pointers, equal to the writer's pointer set. All pointer SHA256/size values match actual local LFS object bytes and worktree bytes. |
| Unique required local LFS objects | Exactly74, all present in the actual common Git LFS object store; every object SHA256/size matches. Repeated pointers account for the90 references. |
| Clean status | `git status --porcelain=v1` produces empty output. |
| Committed diff whitespace check | `git diff --check 10e1e3026610065206d8ac4b361d3f1686114dd8 26d5e892c2b401b9011234dabf86955af7462fb8`: exit0, no output. |

Independent comparison produced zero path, Git/local-byte, seal, manifest, raw archive or LFS mismatches. The sorted changed-path list, encoded UTF-8 with one path per line and a final newline, SHA256 is `85210d76a20b1f1c834656d04b7acbdf0f6ab86865ff24a07d4fd982ec0fd0c5`.

## Full hash bindings

- Final accepted product patch SHA256: `a2bc3b99b0d15698474787f75946938f86a49e56f7af16a9d89bfcdb364404d0` — unchanged actual patch bytes.
- Final independent technical review `/workspace/.cloud-setup/fp06-w05-review-final.md` SHA256: `827622a94c03f67fa5b12bd0c9838ce498606bc8975d7b1daea8367ade2b433f` — unchanged.
- Exact committed file/pointer receipt `/workspace/.cloud-setup/fp06-task-briefs/w05-file-hashes.json` SHA256: `da448c51bcc7a0190927ad8b7e57a0508455278749df2bf5a0aecec44f78268b`. Its full175 path/hash entries and90 pointer entries independently agree with HEAD and actual object bytes.
- Committed own-run `manifest.json` SHA256: `ace00a143b8e9351b33b1f8eac9e348fdd03fdf8808bcc649e696ee7da3392eb`.
- Writer report `/workspace/.cloud-setup/fp06-task-briefs/w05-report.md` SHA256: `1c1db1c4552643e3cadb4d9b5980166650f9bef570678dc945656c6c4d320566`.
- Separate broad-fsck receipt SHA256: `20286a7954012eee7d58f79567b130caffcb87a06c44ee0fe7a529c24da75391`.

## Broad historical LFS fsck remains a separate failed/incomplete result

The writer's `/workspace/.cloud-setup/fp06-task-briefs/w05-broad-lfs-fsck-receipt.json` records `git lfs fsck --objects HEAD` exit1 for an unnecessarily broad whole-HEAD scan. Its reported historical missing local cache references are outside the175 W05 paths. Full raw stdout was not captured: `stdoutComplete:false`, with the combined console response truncated. This result is **not** a repository-wide PASS and its incomplete output cannot establish a complete inventory of historical failures.

The independent narrow proof above establishes that all90 W05 references /74 unique objects are present with exact SHA256 and size, regardless of that broad result. No W05 object failure was found. The receipt records no quarantine files and no fetch/push/config/history repair. This reviewer neither reran broad fsck nor repaired unrelated cache content.

This report accepts only committed W05 source/evidence binding. Human Owner Art acceptance, HVOX/Blender and normal gameplay admission remain the separately declared NOT_RUN limits in the technical review; no invented acceptance or new approval hurdle follows. Root owns subsequent authorized integration/package admission.
