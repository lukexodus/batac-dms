# ADR-UI-015: SSE Reconnection — Native `EventSource` Replay, with TanStack Query Poll as Fallback on Drawer Open

**Status:** Accepted
**Date:** 2026-06-19
**Deciders:** Development team (engineering implementation decision; no stakeholder input required)
**Affected documents:** F2 (`f2-zustand-store-design.md`) §7 `useNotificationDrawerStore`; Stack Context — Real-time notifications (SSE)

---

## Context

`useNotificationDrawerStore.newArrivalCount` (F2 §7) increments on each SSE `"notification"` event, driving the bell badge. If the SSE connection drops and reconnects (network blip, server restart, laptop sleep/wake), events delivered during the gap could be missed, undercounting `newArrivalCount` and never surfacing those notifications until the next unrelated event arrives or the user manually opens the drawer.

No source document specifies a reconnection strategy. The native browser `EventSource` API used for one-directional SSE push (per Stack Context's "Server-Sent Events — one-directional push; no WebSocket infrastructure needed") already auto-reconnects and supports a `Last-Event-ID` header for replay, but only if the server tracks recent event IDs and honors that header. This is a pure engineering reliability decision with no conflicting stakeholder requirement, so the development team is deciding it directly.

## Decision

**Two-layer approach: server-side replay via `Last-Event-ID` as the primary mechanism, plus an unconditional TanStack Query refetch whenever the drawer is opened, as a correctness backstop that doesn't depend on replay working.**

1. **Server-side:** The SSE endpoint includes an `id:` field on every emitted event (a monotonic event id or timestamp-derived id from `notifications.notification_events`). When a client reconnects, the native `EventSource` automatically sends `Last-Event-ID` with the last id it saw; the server resumes from that id rather than only emitting events going forward. This is the standard SSE replay mechanism and requires no custom client reconnection logic — `EventSource`'s built-in reconnect already does this.
2. **Client-side backstop:** Independent of whether replay worked, `resetNewArrivalCount` (F2 §7) is _not_ solely how the drawer's view becomes accurate. Whenever the notification drawer is opened, the component triggers (or relies on an already-configured `staleTime: 0`/`refetchOnMount` behavior for) a fresh `notifications.listMine` TanStack Query fetch, so the drawer's actual list is always correct on open regardless of what `newArrivalCount` says. `newArrivalCount` is treated purely as a _hint_ (bell badge), never as the source of truth for what notifications exist.
3. **No custom polling interval is added.** A background poll independent of drawer-open would add server load and complexity for a failure mode (a missed badge increment during a reconnect gap) that is cosmetic, not data-loss — the underlying notification record is never lost; only the transient badge count could undercount until the next event or drawer open.

## Rationale

1. **The actual risk is small and self-correcting.** `newArrivalCount` (F2 §7) is explicitly documented as ephemeral and is allowed to reset to 0 on reload "(acceptable)" per F2 §16's persistence table — the project's own design already accepts that this counter is a convenience indicator, not a guaranteed-accurate one. A reconnect gap undercounting it by a few is the same class of imprecision, not a new category of problem.
2. **Replay via `Last-Event-ID` is free if the server already persists notification events.** `notifications.notification_events` (per F2 §7's reference to `NotificationEventSchema`/`SseEventSchema`, E3 Part 9) already exists as a durable record — emitting an `id:` field and supporting resume-from-id on reconnect is a small, one-time addition to the SSE endpoint, not new infrastructure. This gets correctness for the common case (short network blips, the most frequent reconnect scenario) essentially for free.
3. **The backstop doesn't depend on replay working everywhere.** Some reconnect scenarios (server restart that clears in-memory replay buffers, a proxy/load balancer that doesn't preserve `Last-Event-ID`) could defeat replay regardless of how carefully it's implemented. Rather than trying to make replay airtight, the design accepts that `newArrivalCount` may occasionally undercount, and guarantees correctness _where it actually matters_ — what the user sees when they open the drawer — via an independent TanStack Query refetch that doesn't care about SSE state at all.
4. **Avoids unnecessary server load.** A continuous background poll "just in case" would run for every connected client for the entire session to guard against an occasional, low-severity, self-correcting badge undercount. The targeted backstop (refetch on drawer open) only does the extra work exactly when the user is about to look at the list anyway.

## Alternatives Considered

**Continuous background TanStack Query poll (e.g. every 30s) regardless of drawer state.** Rejected — solves a problem (badge undercount) that resolves itself the next time the user opens the drawer or another event arrives, at the cost of constant server load for every connected session for the entire Phase 1 user base. Disproportionate to the severity of the gap.

**No replay support, accept missed events entirely.** Rejected — the `Last-Event-ID` mechanism is a standard, low-cost part of the SSE spec that the server should support regardless of this specific gap, since it benefits every reconnect scenario, not just this one. Omitting it for no reason leaves easy correctness on the table.

## Consequences

- The SSE endpoint (server-side, outside F2's scope but noted here for the backend team) must emit an `id:` field per event and support resuming from `Last-Event-ID` by querying `notifications.notification_events` for events after that id.
- `useNotificationDrawerStore` itself requires **no shape change** — `onSseNotificationReceived` and `resetNewArrivalCount` (F2 §7) are unchanged.
- The drawer-opening component must ensure the `notifications.listMine` query is freshly fetched (not served purely from a stale cache) whenever `isOpen` transitions to `true`. This is a component/hook-level concern (consistent with F2 §15 Rule 1 — stores don't own this; the component reads `isOpen` and decides), not a store concern.
- This ADR does not change `useNotificationSse`'s described responsibility (F2 §7 usage notes) beyond noting that the underlying `EventSource` instance, being the native browser API, requires no custom reconnect/backoff logic to be written by the frontend team — only the server-side `id`/replay support needs building.
