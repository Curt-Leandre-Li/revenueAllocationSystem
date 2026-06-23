# Backend Deletion Log

No deletions were executed in this pass.

Reason: the working tree had pre-existing uncommitted changes and the current active project instruction file still forbids uncontrolled backend implementation changes. This file records deletion candidates only.

## Current Dirty Gate

```text
 M README.md
?? docs/P0_ACCEPTANCE_TODAY.md
?? docs/P0_API_CONTRACT_TODAY.md
?? docs/TODAY_CHANGELOG.md
?? output/
?? ui_rebuild/
```

## Deletion Candidates

| File/directory/branch | Deletion reason | Basis | Delete-before validation | Delete-after validation | Executed |
|---|---|---|---|---|---|
| `.DS_Store`, `backend/.DS_Store`, `docs/.DS_Store`, `ui_rebuild/.DS_Store` | Generated macOS metadata | Generated file | `find . -name .DS_Store -print` | `find . -name .DS_Store -print` returns none | No |
| `backend/__pycache__/`, `backend/dvas/__pycache__/`, `scripts/__pycache__/` | Generated Python cache | Generated file | `find . -name __pycache__ -print` | backend tests still pass | No |
| `output/` | Generated output bundle, untracked | Generated/export artifact | `git status --short`, inspect ownership | `git status --short` no longer lists `output/` | No |
| `ui_rebuild/` | Untracked frontend rebuild candidate; outside backend scope | Frontend residual, untracked | Confirm user wants frontend artifact removed | `git status --short`, backend tests pass | No |
| `AGENTS.md` | User requested all AGENTS deletion | Conflicts with active project instruction source | Requires explicit confirmation after audit | `find . -iname 'agents.md' -o -iname 'AGENTS.md' -o -iname '.agents.md'` | No |
| `agents/*.md`, `.codex/agents/*.toml` | User requested agents cleanup | Agent infra, not backend runtime | Requires explicit confirmation; may break project workflow | agent smoke only if scope opens | No |

## Branch Cleanup

Current branch: `main`.

Local branch status relative to `main`:

| Branch | Ahead of main | Behind main | Safe to delete now? | Reason |
|---|---:|---:|---|---|
| `codex/Phase2F：FrontendRebuildCandidate` | 16 | 0 | No | Contains commits not on main; frontend candidate branch. |
| `p0-postgres-acceptance` | 2 | 0 | No | Contains commits not on main; remote HEAD points here. |
| `phase-2a-backend-postgres-read-api` | 5 | 0 | No | Contains commits not on main. |
| `phase-2b-pipeline-write-db` | 6 | 0 | No | Contains commits not on main. |
| `phase-2c-frontend-real-api` | 7 | 0 | No | Contains commits not on main. |
| `phase-2d-ui-acceptance-screenshots` | 11 | 0 | No | Contains commits not on main. |
| `phase-2e-final-release-audit` | 15 | 0 | No | Contains commits not on main. |

Remote branches were listed only. No remote deletion is recommended without human confirmation.

