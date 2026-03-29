---
name: kiosk-feature-onboarding
description: "Pressure-test a new kiosk feature or change request against architecture, UX, event contracts, and implementation scope before coding."
argument-hint: "Describe the feature, affected files, user flow, and any known constraints."
agent: spec-pressure-test
---

Review the requested feature or change before implementation.

Inputs:
- Request: ${input:request:Describe the feature or change}
- Constraints: ${input:constraints:List technical or product constraints if known}

Required workflow:
- Read [ARCHITECTURE.md](../../ARCHITECTURE.md), [docs/UX_UI_BRIEF_KIOSK_GEN_UI.md](../../docs/UX_UI_BRIEF_KIOSK_GEN_UI.md), and the most relevant source files.
- Identify whether the request touches event contracts, Gemini session flow, XState transitions, audio streaming, or generated UI layout.
- Call out contradictions, hidden dependencies, or regression risks before suggesting implementation.
- Produce a compact implementation plan only after the request is internally consistent.
- If the task becomes implementation-ready, recommend handing off to `fullstack-integration` or `state-ux-guardian`.

Output format:
- Scope
- Risks
- Files to touch
- Validation plan
- Recommended next agent