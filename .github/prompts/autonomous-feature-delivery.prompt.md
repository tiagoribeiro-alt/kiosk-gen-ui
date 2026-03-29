---
name: kiosk-autonomous-feature-delivery
description: "Run a kiosk feature through the repo's autonomous delivery workflow with explicit pressure-test, implementation, regression review, and test requirements."
argument-hint: "Describe the feature, affected files or layers, constraints, and expected validation."
agent: autonomous-delivery
---

Drive this feature through the repository's autonomous workflow.

Inputs:
- Feature request: ${input:request:Describe the feature or change}
- Constraints: ${input:constraints:List product, technical, or deployment constraints}
- Done means: ${input:doneMeans:Describe what must be true for the work to be considered complete}

Required workflow:
- Read [ARCHITECTURE.md](../../ARCHITECTURE.md) and [docs/UX_UI_BRIEF_KIOSK_GEN_UI.md](../../docs/UX_UI_BRIEF_KIOSK_GEN_UI.md).
- Decide whether the change affects frontend UI, backend event/session behavior, audio streaming, or multiple layers.
- If the scope is ambiguous or risky, start by pressure-testing it before implementation.
- If the feature is implementation-ready, execute the smallest coherent change path.
- Require automated tests for each new feature slice or report an explicit blocker.
- If the feature touches state, timing, generated UI, or farewell/listening behavior, include a state/UX review before sign-off.

Output format:
- Scope
- Risks
- Files to touch
- Test plan
- Execution status
- Recommended next handoff