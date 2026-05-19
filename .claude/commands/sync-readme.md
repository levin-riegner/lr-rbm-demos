---
description: Manually run the readme-sync subagent against the top-level README.md. Use when a change landed without Claude Code in the loop, or when you want to force a sync mid-session.
argument-hint: [optional one-line summary of what changed]
allowed-tools: Task
---

Invoke the `readme-sync` subagent (defined at `.claude/agents/readme-sync.md`) **exactly once** to update the top-level `README.md` against the current working tree.

Context summary from the user (may be empty): $ARGUMENTS

Rules for this invocation:

- Use the Task tool with `subagent_type: readme-sync`. Pass the context summary above as the subagent's prompt; if empty, just tell it `Manual sync requested — inspect the working tree.`
- Do **not** invoke the subagent more than once. If it reports `no changes needed`, that is the final answer — do not retry with different framing.
- Do **not** edit `README.md` yourself. The subagent owns that file for this operation.
- After the subagent returns, relay its 1–2 sentence report to the user and stop.
- The standard loop-prevention rules from `CLAUDE.md` (`## Top-level README sync protocol` → `### Loop prevention`) apply.
