---
name: kiosk-state-machine
description: "Use when changing XState transitions, kiosk lifecycle states, inactivity handling, farewell timing, transcript-driven flow, or UI behavior tied to idle/listening/active/farewell."
argument-hint: "Describe the state change, timeout, or UX flow you want to modify."
---

# Kiosk State Machine

Use this skill whenever the request affects the kiosk lifecycle or the generated UI flow.

## Sources Of Truth

- [frontend/src/machines/kiosk.ts](../../../frontend/src/machines/kiosk.ts)
- [docs/UX_UI_BRIEF_KIOSK_GEN_UI.md](../../../docs/UX_UI_BRIEF_KIOSK_GEN_UI.md)
- [ARCHITECTURE.md](../../../ARCHITECTURE.md)

## Workflow

1. Map the request to the existing lifecycle: `idle`, `listening`, `active`, `farewell`.
2. Decide whether the change is a new event, a new guard/action, or a timing change. Prefer the smallest change that preserves clarity.
3. Keep state transitions explicit in the machine instead of spreading state logic across components.
4. If the UI changes depend on backend timing or event arrival, verify the corresponding event sequence before editing the machine.
5. If a proposed change adds a new state, justify why an action, guard, or context update is not enough.

## Guardrails

- Do not add state just to hold temporary rendering concerns.
- Do not bury lifecycle rules inside React components when the machine should own them.
- Do not break the farewell auto-return behavior without updating the UX brief and validation steps.

## Validation Checklist

- Entry and exit conditions for each affected state remain clear.
- Timeout and session-end behavior still match the kiosk UX.
- Transcript, audio, and event timing still align with rendered behavior.