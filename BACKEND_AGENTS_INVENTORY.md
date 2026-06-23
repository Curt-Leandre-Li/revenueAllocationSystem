# Backend AGENTS Inventory

## Scope

Backend Surgery-1 inspected agent instruction files. A later cleanup confirmed
that the active mechanism is `.codex/agents/*.toml`; the older `agents/*.md`
role notes are superseded and can be removed.

## Inventory

| Path | Current project still uses it? | Conflict with three source DOCX documents? | Backend Surgery-1 assessment | Recommendation |
|---|---|---|---|---|
| `AGENTS.md` | Yes. It is the active project-level instruction source for this repository. | No direct product-definition conflict found. It preserves DVAS V1.2/V1.3 navigation, P0/P1, algorithm, audit, and reporting boundaries. | It contains a previous "documentation synchronization only" round boundary that conflicts with later user-authorized backend surgery tasks, but that is a workflow-round constraint rather than stale product truth. | Keep. |
| `.codex/agents/*.toml` | Yes. These are the active project-scoped Codex agent definitions. | No direct product-definition conflict found in this cleanup pass. | Runtime/workflow source for named project agents. | Keep. |
| `agents/*.md` | No. These were older role notes and are not the current runtime or workflow source. | Several files still described the old documentation-only round, which can mislead current implementation work. | Superseded by `.codex/agents/*.toml`. | Delete. |

## Not Found In Repository

- nested `AGENTS.md`
- nested `.agents.md`

## Decision

`AGENTS.md` and `.codex/agents/*.toml` are retained. `agents/*.md` is a safe
deletion candidate after the current cleanup because direct references have
been moved to the active TOML mechanism.
