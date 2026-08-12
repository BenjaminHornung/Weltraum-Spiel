# G03/G04 Intake Status

The File Library already contains dated G03 and G04 completion reports.
However, the owner explicitly reports that the current G03 and G04 agent runs
are still active. Therefore:

```text
G03: PENDING_CURRENT_AGENT_CONFIRMATION
G04: PENDING_CURRENT_AGENT_CONFIRMATION
G18: WAIT_FOR_EXPLICIT_G03_G04_FINAL
```

Do not silently treat an older completion file as the final result of the
currently active run. When both agents finish, record filename, byte digest,
reported status and any superseded predecessor before starting G18.
