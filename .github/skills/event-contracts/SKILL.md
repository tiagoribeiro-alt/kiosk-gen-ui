---
name: event-contracts
description: "Use when changing WebSocket event models, backend/frontend payload compatibility, transcript or audio events, or any typed session contract between Python and TypeScript."
argument-hint: "Describe the contract change or event flow you want to modify."
---

# Event Contracts

Use this skill when a task changes or depends on the session event protocol.

## Sources Of Truth

- [backend/app/schemas/events.py](../../../backend/app/schemas/events.py)
- [backend/app/core/session.py](../../../backend/app/core/session.py)
- [frontend/src/lib/ws-client.ts](../../../frontend/src/lib/ws-client.ts)
- [ARCHITECTURE.md](../../../ARCHITECTURE.md)

## Workflow

1. Start with the Python models in `events.py` and identify the exact event names, required fields, optional fields, and defaults.
2. Trace where each event is emitted in `session.py` and where it is consumed on the frontend.
3. If the change adds a field, decide whether it is required or optional and explain the compatibility impact.
4. If the change renames or removes a field or event type, treat it as a coordinated full-stack change and update both sides together.
5. Prefer explicit model changes over ad hoc payload mutation in the send path.
6. After editing, verify that event serialization still matches what the client parses and dispatches.

## Guardrails

- Do not invent new event types unless the request clearly needs them and the frontend lifecycle can consume them.
- Do not change event names casually; type strings are effectively protocol identifiers.
- Keep timestamps, session identifiers, and turn identifiers consistent across new events.
- Prefer backward-compatible additions over breaking contract changes.

## Validation Checklist

- Backend model matches emitted JSON.
- Frontend parser and listeners can consume the payload.
- State transitions still make sense with the changed event timing.
- Documentation is updated if the protocol surface changed.