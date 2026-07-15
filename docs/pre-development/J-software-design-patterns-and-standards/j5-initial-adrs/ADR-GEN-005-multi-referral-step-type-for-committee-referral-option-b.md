# ADR-GEN-005: Multi-Referral Step Type for Committee Referral (Option B)

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team (confirmed against Interview 1 and Interview 2 findings)

---

### Context

Interview 1 and Interview 2 confirmed that most SP measures are referred to **two committees simultaneously**: the relevant subject-matter committee and the Committee on Laws. This is standard practice — the Committee on Laws appears on nearly every Notice of Committee Hearing in the SP logs. It is not a special case; it is the default.

When multiple committees are referred, they hold a **joint hearing** and produce a **single unified compiled report**. If one committee is absent from the hearing, the hearing continues regardless. All assigned committees must sign and contribute to the unified report before the workflow step can complete and the measure can proceed to the next reading. The committee report deadline is the Thursday before the next Tuesday session; if a committee has not submitted by that cutoff, the measure's Second Reading is delayed.

A pre-development decision had stated "parallel steps not included in Phase 1." This conflicts with the operational reality: deferring multi-committee referral would mean Phase 1 cannot accurately model the actual SP legislative process. Three options were evaluated to resolve this conflict.

### Decision

Option B is selected: a `multi_referral` step type is implemented as a distinct step type in the Phase 1 workflow engine. A single step accepts a list of assigned committees. The step completes when the SP Secretary accepts the unified committee report with all required committee signatures. Committees that have not submitted by the Thursday cutoff are marked red in the Order of Business view; their absence delays Second Reading but does not block the hearing itself. The SP Secretary can manually advance the step with a mandatory audit-logged comment to handle exceptional situations.

### Alternatives Considered

**Option A — Sequential referral** — Each committee reviews separately in sequence; the step type would repeat per committee. This does not reflect actual SP practice. A joint hearing producing a unified report is operationally and legally distinct from sequential individual reviews. Modeling it as sequential misrepresents the workflow and would create confusing UX and incorrect audit records. Rejected.

**Option C — Full parallel split/join engine in Phase 1** — Full parallel branches with a join gate would accurately represent concurrent independent processing. However, the unified-report model means there is a single completion event (the joint report), not N independent branch completions. Full parallel split/join is significantly more complex than `multi_referral` and solves a harder problem than Phase 1 requires. It is reserved for Phase 2 (Barangay Budget workflow), which genuinely needs independent parallel paths with independent completion events. Rejected as over-engineering for Phase 1.

### Consequences

**Positive**

- Accurately models the actual SP legislative process: joint hearing, single unified report, all committees must sign
- Simpler implementation than full parallel split/join; single completion event with a clear trigger
- Absent committees are marked red in the Order of Business, preserving visibility without stopping the hearing
- SP Secretary override with mandatory audit-logged comment handles genuinely exceptional situations without breaking the engine

**Negative / Trade-offs**

- All assigned committees must contribute signatures to the unified report; if one committee is unresponsive and the SP Secretary does not use the override, Second Reading is delayed indefinitely
- The SP Secretary override action must be prominently displayed and require explicit confirmation to prevent accidental use
- `multi_referral` must be defined in the workflow schema before the first workflow migration; it cannot be added later without a schema change

**Required Follow-On Actions**

- Define the `multi_referral` step type in the workflow schema in the first workflow module migration, before any workflow definitions are created
- The SP Secretary dashboard Order of Business view must visually red-flag any measure where one or more committees have not submitted by the Thursday cutoff
- The SP Secretary manual-advance action must require a mandatory free-text comment and produce a named audit event distinct from standard step completion

### Related Decisions

- ADR-GEN-002 — Custom Workflow Engine (`multi_referral` is a domain-specific step type only possible in a custom engine)
- ADR-GEN-006 — Parallel Split/Join Deferred to Phase 2 (`multi_referral` explicitly replaces but does not replace the need for `parallel_split`/`parallel_join` in later phases)

---
