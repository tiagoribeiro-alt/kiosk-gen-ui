---
name: kiosk-regression-review
description: "Review a planned or finished kiosk change for regressions in audio, state flow, event compatibility, and UX behavior."
argument-hint: "Describe the change, branch intent, or files under review."
agent: fullstack-integration
---

Review the change with a regression-first mindset.

Inputs:
- Change summary: ${input:changeSummary:Describe the change to review}

Required checks:
- Verify whether backend and frontend still agree on event names and payloads.
- Check whether session lifecycle and kiosk state transitions remain coherent.
- Check whether audio capture/playback assumptions still hold.
- Check whether the UX still matches [docs/UX_UI_BRIEF_KIOSK_GEN_UI.md](../../docs/UX_UI_BRIEF_KIOSK_GEN_UI.md).
- Identify missing validations or tests that would leave risk unbounded.

Output format:
- Findings ordered by severity
- Open questions
- Suggested validations