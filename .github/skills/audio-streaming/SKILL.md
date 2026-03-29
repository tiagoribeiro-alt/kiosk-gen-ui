---
name: audio-streaming
description: "Use when changing microphone capture, audio worklets, PCM or base64 conversion, sample rate handling, playback buffering, or browser audio lifecycle in the kiosk."
argument-hint: "Describe the audio issue or pipeline change you want to make."
---

# Audio Streaming

Use this skill for browser-side audio capture and playback changes.

## Sources Of Truth

- [frontend/src/lib/audio.ts](../../../frontend/src/lib/audio.ts)
- [frontend/public/audio-processors/capture.worklet.js](../../../frontend/public/audio-processors/capture.worklet.js)
- [frontend/public/audio-processors/playback.worklet.js](../../../frontend/public/audio-processors/playback.worklet.js)
- [backend/app/core/session.py](../../../backend/app/core/session.py)

## Workflow

1. Identify whether the issue is in capture, transport, conversion, buffering, or playback.
2. Preserve the current media assumptions unless the task explicitly changes them: browser capture at 16 kHz, model audio delivered to playback at 24 kHz.
3. Be explicit about binary transformations: `ArrayBuffer` -> base64 -> bytes -> Int16 -> Float32.
4. Keep worklet communication simple and deterministic. Avoid adding hidden state when a single message path is enough.
5. When changing start/stop logic, check cleanup carefully so the kiosk can recover between sessions.

## Guardrails

- Do not change sample rates casually.
- Do not connect audio nodes in ways that accidentally feed playback back into capture.
- Do not ignore partial cleanup; leaked streams or contexts will create hard-to-debug kiosk failures.

## Validation Checklist

- Capture starts and stops cleanly.
- Playback still decodes model audio correctly.
- Buffer clearing and teardown do not leave stale audio in the next session.
- Backend and frontend still agree on mime type and chunk format.