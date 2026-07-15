# What you actually do to build A1

### Before any pass

Make sure all your pre-dev documents exist in the repo. A1-AGENTS.md already tells Claude Code where everything lives. You also need one output directory to save each pass result:

```
docs/pre-development/A-project-planning/
  a1-skeleton.md                         ← Step 1 output
  a1-tasks/
    infra.md                             ← Step 2 INFRA output
    ui.md
    iam.md
    audit.md
    org.md
    docs.md
    wf.md
    track.md
    rec.md
    notif.md
    portal.md
  a1-outline-phases.md                   ← Step 3 output
  a1-master-phased-task-list.md          ← Step 4 final output
```

Create the empty folder structure now. Claude Code will write into it.

---

### The prompt pattern

Each prompt tells the agent which section of A1-AGENTS.md governs the pass, what to execute, exactly which files to load in which order, and where to write the output. All file paths are spelled out in full — copy-paste each block as-is, no substitution required.

A1-AGENTS.md is the instruction set; the prompts activate the right section of it. The agent reads A1-AGENTS.md for the rules and the prompt for the document list and output path.

---

### The 14 passes, in order

---

**Step 1 — Skeleton** (run first; no prerequisites)

```
Read docs/pre-development/A1-AGENTS.md — Section 2 Pass Types table and
Section 6 Step 1 rules.

Execute Step 1 — Skeleton.

Load the following documents in this order:
1. docs/pre-development/document-list.md
2. docs/pre-development/tech-stack.md
3. docs/requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md — §10.2 and §13 only

Write the output to docs/pre-development/A-project-planning/a1-skeleton.md.
```

---

**Step 2 — Wave A** (no module prerequisites; both passes can run in parallel)

_INFRA_

```
Read docs/pre-development/A1-AGENTS.md — Section 2 Pass Types table and
Section 6 Step 2 rules.

Execute Step 2 — Module: INFRA.

There are no prerequisite module task lists for this pass. Load the
following documents in this order, using each document's ToC to read
only the sections relevant to INFRA tasks:
1. docs/pre-development/A-project-planning/a1-skeleton.md
2. docs/pre-development/tech-stack.md
3. docs/pre-development/L-infrastructure-and-devops/l1-env-catalog.md
4. docs/pre-development/L-infrastructure-and-devops/l2-docker-and-docker-compose-specification.md
5. docs/pre-development/L-infrastructure-and-devops/l3-cicd-pipeline-specification.md
6. docs/pre-development/L-infrastructure-and-devops/l4-backup-dr-runbooks.md
7. docs/pre-development/D-uml-and-diagrams/d5-deployment-diagram.md
8. docs/pre-development/C-database/c5-migration-strategy-and-conventions.md
9. docs/pre-development/J-software-design-patterns-and-standards/j3-coding-standards-and-conventions.md

Write the output to docs/pre-development/A-project-planning/a1-tasks/infra.md.
```

_UI_

```
Read docs/pre-development/A1-AGENTS.md — Section 2 Pass Types table and
Section 6 Step 2 rules. Pay special attention to the UI-specific rules
in Section 6: Plan 0, Plan 1, and Plan 2 must be instantiated as concrete
tasks (not described or summarized), and Group A/B/C/D component ordering
must be encoded as explicit prerequisites per the rules stated there.

Execute Step 2 — Module: UI.

There are no prerequisite module task lists for this pass. Load the
following documents in this order:
1. docs/pre-development/A-project-planning/a1-skeleton.md
2. docs/pre-development/F-frontend-architecture/f5-ui-component-library-setup-and-package-architecture.md
3. docs/pre-development/J-software-design-patterns-and-standards/j6-domain-component-engineering-reference.md
4. docs/pre-development/F-frontend-architecture/f6-accessibility-compliance-checklist.md
5. docs/pre-development/F-frontend-architecture/f4-component-hierarchy-specification.md
6. docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md
7. docs/design/DESIGN.md
8. packages/ui/src/styles/globals.css
9. docs/pre-development/F-frontend-architecture/f7-frontend-implementation-plans.md

Write the output to docs/pre-development/A-project-planning/a1-tasks/ui.md.
```

---

**Step 2 — Wave B** (requires Wave A to be complete; both passes can run in parallel)

_IAM_

```
Read docs/pre-development/A1-AGENTS.md — Section 2 Pass Types table and
Section 6 Step 2 rules.

Execute Step 2 — Module: IAM.

Load the following documents in this order. Load item 2 (the prerequisite
module task list) before generating any tasks so that TASK-INFRA IDs can
be referenced in Prerequisites fields.
1.  docs/pre-development/A-project-planning/a1-skeleton.md
2.  docs/pre-development/A-project-planning/a1-tasks/infra.md
3.  docs/pre-development/B-architecture-documents/b5-authentication-and-authorization-architecture.md
4.  docs/pre-development/I-security-and-authorization/i2-role-permission-matrix.md
5.  docs/pre-development/I-security-and-authorization/i1-abac-policy-specification.md
6.  docs/pre-development/C-database/c1-full-database-schema-ddl-v3.md — §iam only
7.  docs/pre-development/J-software-design-patterns-and-standards/j1-software-design-patterns.md
8.  docs/pre-development/J-software-design-patterns-and-standards/j2-error-handling-and-response-normalization-strategy.md
9.  docs/pre-development/J-software-design-patterns-and-standards/j3-coding-standards-and-conventions.md
10. docs/pre-development/J-software-design-patterns-and-standards/j4-module-structure-template.md

Write the output to docs/pre-development/A-project-planning/a1-tasks/iam.md.
```

_AUDIT_

```
Read docs/pre-development/A1-AGENTS.md — Section 2 Pass Types table and
Section 6 Step 2 rules.

Execute Step 2 — Module: AUDIT.

Load the following documents in this order. Load item 2 (the prerequisite
module task list) before generating any tasks so that TASK-INFRA IDs can
be referenced in Prerequisites fields.
1. docs/pre-development/A-project-planning/a1-skeleton.md
2. docs/pre-development/A-project-planning/a1-tasks/infra.md
3. docs/pre-development/C-database/c1-full-database-schema-ddl-v3.md — §audit only
4. docs/pre-development/tech-stack.md — §"Audit Log Integrity" only
5. docs/pre-development/I-security-and-authorization/i3-security-design-document.md

Write the output to docs/pre-development/A-project-planning/a1-tasks/audit.md.
```

---

**Step 2 — Wave C** (requires Wave B to be complete)

_ORG_

```
Read docs/pre-development/A1-AGENTS.md — Section 2 Pass Types table and
Section 6 Step 2 rules.

Execute Step 2 — Module: ORG.

Load the following documents in this order. Load items 2 and 3 (the
prerequisite module task lists) before generating any tasks so that
TASK-IAM and TASK-AUDIT IDs can be referenced in Prerequisites fields.
1. docs/pre-development/A-project-planning/a1-skeleton.md
2. docs/pre-development/A-project-planning/a1-tasks/iam.md
3. docs/pre-development/A-project-planning/a1-tasks/audit.md
4. docs/pre-development/C-database/c1-full-database-schema-ddl-v3.md — §organization only
5. docs/pre-development/B-architecture-documents/b2-module-boundary-and-internal-api-contracts-v1.1.md
6. docs/pre-development/I-security-and-authorization/i1-abac-policy-specification.md
7. docs/pre-development/I-security-and-authorization/i2-role-permission-matrix.md

Write the output to docs/pre-development/A-project-planning/a1-tasks/org.md.
```

---

**Step 2 — Wave D** (requires Wave C to be complete)

_DOCS_

```
Read docs/pre-development/A1-AGENTS.md — Section 2 Pass Types table and
Section 6 Step 2 rules.

Execute Step 2 — Module: DOCS.

Load the following documents in this order. Load item 2 (the prerequisite
module task list) before generating any tasks so that TASK-ORG IDs can
be referenced in Prerequisites fields.
1.  docs/pre-development/A-project-planning/a1-skeleton.md
2.  docs/pre-development/A-project-planning/a1-tasks/org.md
3.  docs/pre-development/C-database/c1-full-database-schema-ddl-v3.md — §documents only
4.  docs/pre-development/H-domain-configuration-documents/h2-document-type-catalog-with-jsonb-metadata-schemas-v1.1.md
5.  docs/pre-development/H-domain-configuration-documents/h3-numbering-series-configuration-specification.md
6.  docs/pre-development/E-api-design/e1-trpc-router-and-procedure-catalog.md — §documents only
7.  docs/pre-development/E-api-design/e3-shared-zod-schema-catalog.md
8.  docs/pre-development/B-architecture-documents/b2-module-boundary-and-internal-api-contracts-v1.1.md
9.  docs/pre-development/I-security-and-authorization/i1-abac-policy-specification.md
10. docs/pre-development/I-security-and-authorization/i2-role-permission-matrix.md

Write the output to docs/pre-development/A-project-planning/a1-tasks/docs.md.
```

---

**Step 2 — Wave E** (requires Wave D to be complete; both passes can run in parallel)

_WF_

```
Read docs/pre-development/A1-AGENTS.md — Section 2 Pass Types table and
Section 6 Step 2 rules. Per Section 9 rule 4, the WF module pass requires
reading consolidated ref Parts 4.1–4.3, 4.10, 4.17, 7.2, 8, and 11.3 in
full — do not excerpt these sections.

Execute Step 2 — Module: WF.

Load the following documents in this order. Load item 2 (the prerequisite
module task list) before generating any tasks so that TASK-DOCS IDs can
be referenced in Prerequisites fields.
1.  docs/pre-development/A-project-planning/a1-skeleton.md
2.  docs/pre-development/A-project-planning/a1-tasks/docs.md
3.  docs/pre-development/B-architecture-documents/b4-workflow-engine-specification.md
4.  docs/pre-development/C-database/c1-full-database-schema-ddl-v3.md — §workflow only
5.  docs/pre-development/H-domain-configuration-documents/h1-phase-1-workflow-definitions-structured-data.md
6.  docs/pre-development/D-uml-and-diagrams/d3-state-machine-diagrams.md
7.  docs/pre-development/K-testing/k2-workflow-engine-test-suite-design.md
8.  docs/pre-development/E-api-design/e1-trpc-router-and-procedure-catalog.md — §workflow only
9.  docs/pre-development/B-architecture-documents/b2-module-boundary-and-internal-api-contracts-v1.1.md
10. docs/requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md — Parts 4.1–4.3, 4.10, 4.17, 7.2, 8, and 11.3 in full

Write the output to docs/pre-development/A-project-planning/a1-tasks/wf.md.
```

_TRACK_

```
Read docs/pre-development/A1-AGENTS.md — Section 2 Pass Types table and
Section 6 Step 2 rules.

Execute Step 2 — Module: TRACK.

Load the following documents in this order. Load item 2 (the prerequisite
module task list) before generating any tasks so that TASK-DOCS IDs can
be referenced in Prerequisites fields.
1. docs/pre-development/A-project-planning/a1-skeleton.md
2. docs/pre-development/A-project-planning/a1-tasks/docs.md
3. docs/pre-development/C-database/c1-full-database-schema-ddl-v3.md — §tracking only
4. docs/requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md — §11.6 only
5. docs/pre-development/E-api-design/e1-trpc-router-and-procedure-catalog.md — §tracking only
6. docs/pre-development/B-architecture-documents/b2-module-boundary-and-internal-api-contracts-v1.1.md

Write the output to docs/pre-development/A-project-planning/a1-tasks/track.md.
```

---

**Step 2 — Wave F** (requires Wave E to be complete; both passes can run in parallel)

_REC_

```
Read docs/pre-development/A1-AGENTS.md — Section 2 Pass Types table and
Section 6 Step 2 rules.

Execute Step 2 — Module: REC.

Load the following documents in this order. Load items 2 and 3 (the
prerequisite module task lists) before generating any tasks so that
TASK-WF and TASK-TRACK IDs can be referenced in Prerequisites fields.
1. docs/pre-development/A-project-planning/a1-skeleton.md
2. docs/pre-development/A-project-planning/a1-tasks/wf.md
3. docs/pre-development/A-project-planning/a1-tasks/track.md
4. docs/pre-development/C-database/c1-full-database-schema-ddl-v3.md — §records only
5. docs/pre-development/E-api-design/e1-trpc-router-and-procedure-catalog.md — §records only
6. docs/pre-development/B-architecture-documents/b2-module-boundary-and-internal-api-contracts-v1.1.md
7. docs/pre-development/I-security-and-authorization/i1-abac-policy-specification.md
8. docs/pre-development/I-security-and-authorization/i2-role-permission-matrix.md

Write the output to docs/pre-development/A-project-planning/a1-tasks/rec.md.
```

_NOTIF_

```
Read docs/pre-development/A1-AGENTS.md — Section 2 Pass Types table and
Section 6 Step 2 rules.

Execute Step 2 — Module: NOTIF.

Load the following documents in this order. Load item 2 (the prerequisite
module task list) before generating any tasks so that TASK-WF IDs can
be referenced in Prerequisites fields.
1. docs/pre-development/A-project-planning/a1-skeleton.md
2. docs/pre-development/A-project-planning/a1-tasks/wf.md
3. docs/pre-development/H-domain-configuration-documents/h4-notification-event-and-template-catalog.md
4. docs/pre-development/C-database/c1-full-database-schema-ddl-v3.md — §notifications only
5. docs/pre-development/E-api-design/e1-trpc-router-and-procedure-catalog.md — §notifications only
6. docs/pre-development/B-architecture-documents/b2-module-boundary-and-internal-api-contracts-v1.1.md
7. docs/pre-development/B-architecture-documents/b3-internal-domain-event-catalog-v1.3.md

Write the output to docs/pre-development/A-project-planning/a1-tasks/notif.md.
```

---

**Step 2 — Wave G** (requires all of Wave F to be complete)

_PORTAL_

```
Read docs/pre-development/A1-AGENTS.md — Section 2 Pass Types table and
Section 6 Step 2 rules.

Execute Step 2 — Module: PORTAL.

Load the following documents in this order. Load items 2–11 (all
prerequisite module task lists) before generating any tasks so that all
TASK IDs across every module can be referenced in Prerequisites fields.
1.  docs/pre-development/A-project-planning/a1-skeleton.md
2.  docs/pre-development/A-project-planning/a1-tasks/infra.md
3.  docs/pre-development/A-project-planning/a1-tasks/ui.md
4.  docs/pre-development/A-project-planning/a1-tasks/iam.md
5.  docs/pre-development/A-project-planning/a1-tasks/audit.md
6.  docs/pre-development/A-project-planning/a1-tasks/org.md
7.  docs/pre-development/A-project-planning/a1-tasks/docs.md
8.  docs/pre-development/A-project-planning/a1-tasks/wf.md
9.  docs/pre-development/A-project-planning/a1-tasks/track.md
10. docs/pre-development/A-project-planning/a1-tasks/rec.md
11. docs/pre-development/A-project-planning/a1-tasks/notif.md
12. docs/pre-development/E-api-design/e2-rest-api-specification-openapi3.md
13. docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md — §portal only
14. docs/requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md — §13 Phase 3 only

Write the output to docs/pre-development/A-project-planning/a1-tasks/portal.md.
```

---

**Step 3 — Outline**

```
Read docs/pre-development/A1-AGENTS.md — Section 2 Pass Types table and
Section 6 Step 3 rules.

Execute Step 3 — Outline (Phase 1B full spec; Phases 2–5 titles only).

Load the following documents in this order:
1.  docs/pre-development/A-project-planning/a1-skeleton.md
2.  docs/pre-development/A-project-planning/a1-tasks/infra.md
3.  docs/pre-development/A-project-planning/a1-tasks/ui.md
4.  docs/pre-development/A-project-planning/a1-tasks/iam.md
5.  docs/pre-development/A-project-planning/a1-tasks/audit.md
6.  docs/pre-development/A-project-planning/a1-tasks/org.md
7.  docs/pre-development/A-project-planning/a1-tasks/docs.md
8.  docs/pre-development/A-project-planning/a1-tasks/wf.md
9.  docs/pre-development/A-project-planning/a1-tasks/track.md
10. docs/pre-development/A-project-planning/a1-tasks/rec.md
11. docs/pre-development/A-project-planning/a1-tasks/notif.md
12. docs/pre-development/A-project-planning/a1-tasks/portal.md
13. docs/requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md — §13 only

Write the output to docs/pre-development/A-project-planning/a1-outline-phases.md.
```

---

**Step 4 — Integration**

```
Read docs/pre-development/A1-AGENTS.md — Section 2 Pass Types table and
Section 6 Step 4 rules.

Execute Step 4 — Integration pass.

Load the following documents in this order:
1.  docs/pre-development/A-project-planning/a1-skeleton.md
2.  docs/pre-development/A-project-planning/a1-tasks/infra.md
3.  docs/pre-development/A-project-planning/a1-tasks/ui.md
4.  docs/pre-development/A-project-planning/a1-tasks/iam.md
5.  docs/pre-development/A-project-planning/a1-tasks/audit.md
6.  docs/pre-development/A-project-planning/a1-tasks/org.md
7.  docs/pre-development/A-project-planning/a1-tasks/docs.md
8.  docs/pre-development/A-project-planning/a1-tasks/wf.md
9.  docs/pre-development/A-project-planning/a1-tasks/track.md
10. docs/pre-development/A-project-planning/a1-tasks/rec.md
11. docs/pre-development/A-project-planning/a1-tasks/notif.md
12. docs/pre-development/A-project-planning/a1-tasks/portal.md
13. docs/pre-development/A-project-planning/a1-outline-phases.md

Perform the six operations in Section 6 Step 4 rules in order. Report
each operation's result explicitly before moving to the next.

Write the final assembled A1 to docs/pre-development/A-project-planning/
a1-master-phased-task-list.md.
```

---

### Between passes: the one discipline that matters

After each module pass, before starting the next wave, **read the Module Summary at the bottom of the output file.** Specifically look for:

- `[SPEC GAP]` entries — these need you to fill in the missing spec before the integration pass. A task written against a `[SPEC GAP]` placeholder will fail when executed. Better to resolve them now than discover them at integration.
- `[DEFERRED — Phase X]` entries — just confirm these are actually deferred intentionally, not accidentally dropped Phase 1 capabilities.

You don't need to read every task in every module output. Just the Module Summary. That's the signal-to-noise filter.

---

### The two passes most likely to hit context limits

**WF module pass** — the workflow module has the most complex consolidated reference inputs (Parts 4.1–4.3, 4.10, 4.17, 7.2, 8, 11.3 must all be read in full per A1-AGENTS.md Section 9 rule 4). This is the heaviest single pass. If it stalls or truncates, split it: run Phase 1 tasks for the workflow engine core (step types, transitions, timers) as one sub-pass, then Phase 1 tasks for the Certified Urgent path and Panlalawigan timer as a second sub-pass, then combine the outputs manually before the integration pass.

**Step 4 — Integration** — this pass loads all 11 module task lists simultaneously plus the outline. If context is tight, run the six integration operations in two Claude Code sessions: session one does operations 1–3 (audit, validation, missing task detection) and writes a report; session two takes that report plus all task lists and does operations 4–6 (critical path, first executable set, assembly).

Neither of these is guaranteed to be a problem — just the ones to watch. If Claude Code truncates output mid-task, that's your signal to split.

---

### One thing you should do before starting

Look at the `[SPEC GAP]` risk before you run a single pass. Skim consolidated ref Part 13 (Phase 1 scope) and compare it against the pre-dev documents for the modules you're least confident are fully specified. If any Phase 1 capability is referenced in Part 13 but you know no pre-dev document covers it concretely enough, resolve that now rather than discovering it mid-generation. The WF and DOCS modules are the most likely candidates given how much of the consolidated reference they draw from.
