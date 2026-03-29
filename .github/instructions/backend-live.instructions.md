---
name: backend-live
description: "Use when working on FastAPI, Gemini Live session handling, async orchestration, WebSocket events, or Pydantic event schemas."
applyTo: "backend/app/**/*.py"
---

# Backend Live Session Rules

- Treat [backend/app/schemas/events.py](../../backend/app/schemas/events.py) as the event contract source of truth.
- Prefer adding typed Pydantic models or refining existing ones over passing loosely structured JSON around.
- Keep frontend-facing event names, payload fields, and defaults backward-compatible unless the task explicitly requires a coordinated contract change.
- Keep [backend/app/core/session.py](../../backend/app/core/session.py) easy to audit: one responsibility per branch, explicit error handling, and no speculative abstractions.
- Favor asyncio-native coordination and cancellation that keeps the frontend WebSocket loop and Gemini receive loop understandable.
- Preserve the current audio assumptions unless the task explicitly changes the media pipeline: browser input is PCM 16 kHz, model output is forwarded as 24 kHz audio chunks.
- When extending Gemini configuration, only add modalities, instructions, or tools that are supported by the local design and validated against repository documentation.
- Send explicit error events to the frontend when the session cannot recover, instead of failing silently.
- Keep FastAPI entrypoints small and move session behavior into focused helpers when complexity grows.
- Update docs when backend behavior changes in a way that affects frontend integration, testing, or operating assumptions.
- New backend features are not complete without automated tests at the right level. Prefer unit tests for handlers/models and integration tests for session/event-flow changes.
- If a backend change affects frontend-visible events, validate the contract in tests or document the blocker explicitly.