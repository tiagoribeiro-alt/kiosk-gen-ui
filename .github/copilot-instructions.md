# Kiosk Gen-UI Repository Instructions

- Treat [ARCHITECTURE.md](../ARCHITECTURE.md) and [docs/UX_UI_BRIEF_KIOSK_GEN_UI.md](../docs/UX_UI_BRIEF_KIOSK_GEN_UI.md) as the primary sources of truth for system behavior, UX states, and architectural constraints.
- Preserve the kiosk product shape: voice-first tourism assistant, vertical layout, WebSocket session, Gemini Live audio streaming, and generated UI synchronized with the conversation.
- Before changing event behavior, read [backend/app/schemas/events.py](../backend/app/schemas/events.py) and verify that backend and frontend stay compatible.
- Before changing session orchestration, read [backend/app/core/session.py](../backend/app/core/session.py) and prefer small changes over speculative rewrites.
- Before changing frontend state flow, read [frontend/src/machines/kiosk.ts](../frontend/src/machines/kiosk.ts) and keep the idle -> listening -> active -> farewell lifecycle coherent.
- Before changing audio code, read [frontend/src/lib/audio.ts](../frontend/src/lib/audio.ts) and preserve the current capture/playback sample-rate split: 16 kHz input, 24 kHz output.
- Avoid dead code, placeholder branches, fake TODO-driven architecture, or comments that promise future behavior without implementing it.
- Do not invent event types, tool calls, Gemini capabilities, or UI states that are not grounded in the repository docs or existing code.
- Prefer typed, explicit contracts over ad hoc dictionaries, any-like payloads, or undocumented JSON shapes.
- Do not present a feature as finished, working, or validated unless there is concrete evidence in code, tests, runtime validation, or directly observed behavior that supports that claim.
- Treat every new feature or materially changed behavior as incomplete until it has automated tests at the right layer, or an explicit blocker is documented.
- Prefer repo-guided autonomous execution in this order when the task is non-trivial: `spec-pressure-test` -> `fullstack-integration` -> `state-ux-guardian` -> regression review.
- Use the custom agents deliberately when they improve scope control or validation. Do not assume agent definitions are invoked automatically by repository configuration alone.
- Keep instructions and documentation in sync with code when a change materially alters workflow, validation, architecture, or UX behavior.
- For backend changes, favor FastAPI, Pydantic v2, and asyncio-native patterns that keep the WebSocket loop and Gemini loop easy to reason about.
- For frontend changes, favor React + XState patterns that keep state transitions obvious and avoid scattered side effects.
- When a request is still ambiguous, pressure-test it against the architecture and UX brief before implementing.