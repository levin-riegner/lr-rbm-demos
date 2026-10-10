---
name: rbm-webmcp
description: Make a Meta Ray-Ban Display demo controllable by Meta AI via WebMCP (document.modelContext) in vanilla JS. Use when adding voice/assistant control to a demo in lr-rbm-demos, or when a user asks for "talk to the app", "voice control", "Meta AI tools", or WebMCP.
---

# WebMCP for a vanilla demo

WebMCP lets the wearer operate an app by speaking to Meta AI. The browser on the
glasses installs `document.modelContext` before page scripts run; the app
registers tools there, Meta AI calls them, the app updates its own screen.
No SDK, no speech code. It is **additive**: every demo must stay fully usable
with the D-pad alone, and must run unchanged where `document.modelContext`
is absent (desktop Chrome, the simulator, older firmware).

Source of truth: Meta's `ai-glasses-webapp-webmcp` skill in
<https://github.com/facebook/meta-wearables-webapp>. The rules below are the
parts that matter for this repo's vanilla apps.

## Design the tools from utterances

Write three to five sentences a wearer would actually say ("add coffee and
sugar to my list", "what's on my list?", "clear it"). Derive the smallest tool
set that resolves each sentence in **one call**. Always include one read-only
tool that reports current state (`annotations: { readOnlyHint: true }`).

Tool names: `<appprefix>_<verb>_<noun>`, differing in their first 57
characters. Reserved and silently rejected: `openUrl`, `goBack`, `goForward`,
`reload`, `getCurrentUrl`, `getPageTitle`, `getPageText`.

## Parameter rules

- Only `boolean`, `integer`, `number`, `string` reach the assistant. Take a
  spoken list as one comma-separated `string` and split it yourself.
- Only each property's `type` and `description`, plus top-level `required`,
  are read. `enum`, `minimum`, `default` and nested schemas are dropped, so
  state those constraints in the description text.
- Descriptions are truncated near 256 chars (parameters) and 1024 (tools).
- Validate inside `execute`; nothing enforces the schema for you.
- Never put a real answer (a target word, a puzzle solution) in a description.

## Results

- Return a string or a plain object with the **new state** plus a
  `next_action` ("Confirm in one short sentence, then stop." or "Call X next.").
- There is no failure flag. A handled problem is an ordinary result:
  `{ error: true, message, next_action }`. Throw only for what the model
  cannot act on.
- Mutate through the **same functions the D-pad path uses** so the screen
  re-renders. A tool that changes state without re-rendering leaves a stale
  display.
- `execute` has a 10-second deadline; forward its `signal` to any `fetch`.

## Registration pattern (copy this)

Register each tool through one guarded helper so a failed registration can
never take the D-pad path down. Do this once at startup, after the state it
closes over exists. Do **not** install a WebMCP polyfill.

```js
// ---- WebMCP (Meta AI voice control) --------------------------------------
// Additive: the app works identically when document.modelContext is absent.
function registerWebMcp() {
  var ctx = document.modelContext;
  if (!ctx || typeof ctx.registerTool !== 'function') return;

  function safeRegister(tool) {
    try {
      var r = ctx.registerTool(tool);
      if (r && typeof r.then === 'function') {
        r.then(undefined, function (err) { console.error(tool.name + ' registration failed', err); });
      }
    } catch (err) {
      console.error(tool.name + ' registration failed', err);
    }
  }

  safeRegister({
    name: 'tally_get_state',
    description: 'Report the current tally count and when counting started.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: function () {
      return { count: state.count, since: state.since, next_action: 'Tell the wearer the count in one short sentence, then stop.' };
    }
  });

  safeRegister({
    name: 'tally_add',
    description: 'Add a number to the tally (default 1). Use a negative number to subtract. Returns the new count.',
    inputSchema: {
      type: 'object',
      properties: { amount: { type: 'integer', description: 'How much to add. Defaults to 1. Negative subtracts.' } }
    },
    execute: function (args) {
      var n = parseInt(args && args.amount, 10);
      if (isNaN(n)) n = 1;
      increment(n); // the same function the Enter key calls, so the screen updates
      return { count: state.count, next_action: 'Confirm the new count in one short sentence, then stop.' };
    }
  });
}
registerWebMcp();
```

## Head-of-document guardrails

Meta AI always reads `<title>` and `<meta name="description">`. Put behavior
you cannot afford to lose there, e.g. "Confirm changes in one short sentence
rather than reading the whole list back."

## README

Add a `## Voice (Meta AI)` section to the app README listing the example
utterances, and a `Voice` row in the Controls table. State that voice control
requires WebMCP to be enabled on the device (Developer Mode or rollout) and
that the app is relaunched after enabling it.

## Verify on device

`await document.modelContext.getTools()` must list **every** tool. A short
list means one registration failed and the rest were stranded. Keep the
display awake while testing; a hidden page suspends timers and promises.
