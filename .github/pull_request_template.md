<!--
Synaptic Room — Pull Request (Spec-Driven Development)
Every PR must trace to at least one SDD task id (e.g. P0-T-005). The `sdd-trace`
CI check enforces this. No implementation without a spec (NN-6).
-->

## What & why

<!-- Short description of the change and the problem it solves. -->

## SDD traceability (required)

<!-- List the task ids this PR implements. Must match P#-T-### (e.g. P1-T-004). -->

Closes: P#-T-###

Requirements addressed: P#-R-###
Acceptance criteria verified: P#-AC-###

## Checklist

- [ ] Traces to a spec task (id above); no out-of-spec "vibe coding".
- [ ] Tests added/updated and passing locally (`npm test` / `pytest`).
- [ ] Lint & format clean (`npm run lint` / `ruff check`).
- [ ] Coverage did not decrease (thresholds only ratchet up).
- [ ] Docs / `.env.example` updated if config or behavior changed.
- [ ] No secrets committed; secure-by-default preserved (NN-4).
- [ ] If an architectural decision was made, an ADR was added under `docs/sdd/adr/`.
