---
name: frontend-kiosk
description: "Use when working on kiosk frontend code, audio worklets, React UI, XState transitions, vertical layout, or WebSocket-driven rendering."
applyTo: "frontend/src/**/*.ts,frontend/src/**/*.tsx,frontend/src/**/*.css,frontend/public/audio-processors/**/*.js"
---

# Frontend Kiosk Rules

- Use [ARCHITECTURE.md](../../ARCHITECTURE.md) for system boundaries and [docs/UX_UI_BRIEF_KIOSK_GEN_UI.md](../../docs/UX_UI_BRIEF_KIOSK_GEN_UI.md) for layout, pacing, and state intent.
- Keep the kiosk UX voice-first. Do not introduce touch-first assumptions, form-heavy UI, or desktop dashboard patterns.
- Preserve the vertical kiosk framing and the four-state lifecycle defined in [frontend/src/machines/kiosk.ts](../../frontend/src/machines/kiosk.ts).
- Prefer adding or refining explicit XState events and transitions over burying control flow inside React effects.
- Treat audio code as latency-sensitive. Keep capture and playback paths simple, deterministic, and explicit about sample rates and buffer transformations.
- When changing [frontend/src/lib/ws-client.ts](../../frontend/src/lib/ws-client.ts), verify that parsed event types still match backend Pydantic models.
- When changing generated UI rendering, keep the latest response visually prominent and avoid UI patterns that fight the timeline/journey metaphor in the UX brief.
- Avoid unnecessary local state if the state machine or a typed event stream is the right owner.
- Do not silently swallow WebSocket or audio errors. Surface recoverable failures in a way the kiosk can react to.
- Prefer minimal CSS/layout changes that respect the established kiosk proportions instead of generic responsive redesigns.
- New frontend features are not complete without automated tests at the right level. Prefer `Vitest` unit tests for adapters and state logic, plus component tests for rendering-critical Journey behavior.
- For Journey-related work, add or update tests that cover normalized scene mapping, deterministic ordering, focus behavior, and fallback rendering for partial data.
- If automated coverage cannot be added yet, document the blocker explicitly in the task result instead of silently skipping tests.