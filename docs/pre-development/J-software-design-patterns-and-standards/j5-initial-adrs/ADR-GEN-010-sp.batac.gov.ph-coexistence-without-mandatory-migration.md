# ADR-GEN-010: sp.batac.gov.ph Coexistence Without Mandatory Migration


**Status:** Accepted **Date:** June 2026 **Deciders:** Development team (confirmed by Interview 2, resolving Q-C07)

---

### Context

sp.batac.gov.ph is the SP Secretariat's current public-facing website. It provides public access to SP documents and serves citizens who look up ordinances, resolutions, and other legislative records. The subscription was recently renewed (Interview 2 confirmed this directly); the site is in active use.

batac-dms will include a public portal with overlapping citizen-facing functionality. Citizens will eventually look up documents in batac-dms. However, batac-dms's primary Phase 1 value proposition is internal workflow automation and operational tracking — not replacing the public website.

The data format and completeness of existing sp.batac.gov.ph content have not been assessed. The LMITS historical data migration is separately unresolved (format TBD, later phases). Forcing a migration of sp.batac.gov.ph data into Phase 1 scope adds unpredictable effort to the most risk-dense development phase.

### Decision

sp.batac.gov.ph continues to operate without a required retirement date. batac-dms is developed and deployed as a parallel system, primarily for internal use, with a public portal that will eventually serve the same citizen-facing purpose. Both systems coexist indefinitely. Migration of sp.batac.gov.ph data into batac-dms is deferred until after batac-dms has been in production use for a significant period and the LGU has independently decided it is ready to retire sp.batac.gov.ph.

### Alternatives Considered

**Mandatory migration and retirement of sp.batac.gov.ph at Phase 1 launch** — Forces a data migration of unknown complexity into the Phase 1 scope. Risks delaying Phase 1 if the migration is harder than expected, or launching batac-dms with missing historical data if a deadline is held. Rejected.

**Federation: sync sp.batac.gov.ph data into batac-dms via API or scraping** — Requires either confirmed API access to sp.batac.gov.ph (not confirmed to exist) or a web-scraping pipeline. Adds an ongoing maintenance dependency between two systems with different owners and update schedules. Rejected.

**Immediate redirect: forward sp.batac.gov.ph traffic to the batac-dms public portal at launch** — Requires the batac-dms public portal to have feature parity with sp.batac.gov.ph and contain the full historical document set before a single user can visit. Both conditions cannot be guaranteed at Phase 1 launch. Rejected.

### Consequences

**Positive**

- Phase 1 scope does not include data migration risk from sp.batac.gov.ph
- No disruption to existing citizen access during batac-dms development and rollout
- Data migration can be scoped, planned, and executed with real operational experience of batac-dms
- LGU retains flexibility to retire sp.batac.gov.ph on their own timeline

**Negative / Trade-offs**

- Two public portals for legislative documents exist simultaneously; citizens may be unsure which system has the most recent content
- The LGU incurs subscription costs for sp.batac.gov.ph while also operating batac-dms
- Documents entered into batac-dms are not visible on sp.batac.gov.ph, and vice versa; cross-system search is not possible
- batac-dms public portal will have a historical data gap until the migration is executed

**Required Follow-On Actions**

- The batac-dms public portal must display a visible notice at launch acknowledging that historical documents may be found on sp.batac.gov.ph and providing a direct link to the site
- When the LGU decides to migrate, a separate migration project must be formally scoped: assess sp.batac.gov.ph data format, extract, transform, import, verify data integrity, then retire the site

### Related Decisions

- ADR-GEN-011 — No Existing Digital QR System for Letters and Memos (similar pattern: don't force integration with a system of uncertain state)

---
