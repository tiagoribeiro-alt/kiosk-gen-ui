---
name: gemini-live-session
description: "Use when changing Gemini Live connection setup, async session orchestration, WebSocket piping, response modalities, or frontend-backend streaming behavior."
argument-hint: "Describe the Gemini session change, failure mode, or streaming behavior you want to adjust."
---

# Gemini Live Session

Use this skill for changes around the FastAPI WebSocket endpoint and the live Gemini session loop.

## Sources Of Truth

- [backend/app/main.py](../../../backend/app/main.py)
- [backend/app/core/session.py](../../../backend/app/core/session.py)
- [ARCHITECTURE.md](../../../ARCHITECTURE.md)

## Workflow

1. Identify whether the change belongs at FastAPI entrypoint level, session orchestration level, Gemini config level, or event emission level.
2. Keep the browser WebSocket loop and Gemini receive loop conceptually separate even if they coordinate in one class.
3. Make cancellation and failure behavior explicit. If one side fails, decide what must be cancelled and what error event must be sent.
4. When changing `LiveConnectConfig`, add only options that are supported and meaningful for this kiosk flow.
5. When adding tool calls or system instructions, document where they fit in the architecture and how the frontend will react.
6. Prefer small, inspectable async steps over nested control flow that obscures session lifecycle.

## Guardrails

- Do not turn the session loop into a generic framework unless the repo genuinely needs that complexity.
- Do not add unsupported Gemini features based on guesswork.
- Do not change modality or audio assumptions without coordinating with frontend playback code.

## Validation Checklist

- WebSocket connection still accepts and streams correctly.
- Gemini task and frontend task terminate cleanly on failure or disconnect.
- Error events are still delivered when recovery is impossible.
- Any new behavior is reflected in docs if it changes system operation.