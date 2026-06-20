# Batac City LGU Platform — Content Style Guide

**Version:** 0.1 · **Companion to:** `BRAND.md` §4 (Voice and Tone), `COMPONENT-GUIDELINES.md`
**Scope:** Terminology, controlled vocabularies, copy patterns, and formatting rules for all UI text.

---

## 1. Terminology Glossary

UI copy should use plain terms for citizens and precise domain terms for staff. This glossary is the single source for both.

| Term / Acronym | Meaning | Staff-facing usage | Citizen-facing usage |
|---|---|---|---|
| **DTS** | Document Tracking System | "Document Tracking (DTS)" on first reference, "DTS" after | "Track your document" — never "DTS" |
| **WMS** | Workflow Management System | "Workflow Management (WMS)" / "Approval Interface" | Not exposed |
| **DMS** | Document Management System | "Document Repository" (avoid raw "DMS" in nav; OK in page subtitle) | Not exposed |
| **RMS** | Records Management System (Phase 2) | "Records Management (RMS)" | Not exposed |
| **SP** | Sangguniang Panlungsod (City Council) | "SP" is acceptable after first reference ("Sangguniang Panlungsod (SP)") | "City Council" preferred |
| **LCE** | Local Chief Executive (the Mayor) | Use "Mayor" in UI; "LCE" only in legal/document text quoting source material | "Mayor" |
| **ARTA** | Anti-Red Tape Act (RA 11032) — mandates processing-time limits | "ARTA deadline" is acceptable staff-facing | Avoid; say "expected processing time" |
| **SLA** | Service Level Agreement / processing-time target | "SLA compliance," "SLA breach" | Avoid; say "on time" / "delayed" |
| **VP Certification** | Vice Mayor's formal certification of an approved measure as Presiding Officer | Use as-is — this is an official step name | Not typically shown |
| **Lapsed into Law** | A measure the Mayor neither signed nor vetoed within 10 days, which takes effect automatically (RA 7160 §47) | Use as-is, it's a formal status | "Took effect automatically after the 10-day review period" |
| **Series Number** | The official document number (e.g., `7SP 2026-047`) | "Resolution No. 7SP 2026-047" | Same — citizens see the official number |
| **Tracking Number** | The system-generated ID for routing/lookup (e.g., `DTS-2026-000045`) | "Tracking No." | "Tracking Number" — primary citizen-facing identifier |
| **Custodian** | The office/person currently physically or digitally responsible for a document | "Current Custodian" | Not shown |
| **Classification** | Public / Internal / Confidential / Restricted — see `DESIGN.md` §12 | Use exact four-term vocabulary, never synonyms | Only "Public" documents are ever shown; the term itself isn't usually surfaced |

**Rule:** When a staff-facing acronym must appear in citizen-facing copy (rare), spell it out on first use: *"...your request will be reviewed under the Anti-Red Tape Act (ARTA) processing time."*

---

## 2. Tracking and Document Number Formatting

| Format                                | Example                                | Display rules                                                                                                                                                             |
| ------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DTS Tracking Number                   | `DTS-2026-000045`                      | Always `IBM Plex Mono`. Always shown with the `DTS-` prefix, 4-digit year, 6-digit zero-padded sequence. Never abbreviate (`...045` alone is not acceptable).             |
| SP Resolution/Ordinance Series Number | `7SP 2026-047`                         | `{SP_NUMBER}SP {YEAR}-{NN}` — space between SP number and "SP", space before year. Displayed in regular weight, not monospace (it's a legal citation, not a system code). |
| Franchise Ordinance                   | `7SP 0001-26R`                         | Same family but continuous sequence + 2-digit year + "R" suffix — never drop the "R".                                                                                     |
| Letters / Memos / NCH / Designations  | `2026-01`, `NCH 2025-03`, `D 2024-01`  | Per `consolidated-architecture-and-requirements-reference.md` Part 5.1 — preserve exact prefix/format per type.                                                           |
| Citizen-facing reference              | "Tracking Number: **DTS-2026-000045**" | Always labeled "Tracking Number," bolded or monospace, never just a bare string in a sentence                                                                             |

**Capitalization:** Series numbers use "No." (e.g., "Resolution No. 7SP 2026-047"), not "#" or "no" lowercase.

---

## 3. Status Vocabulary (Controlled List)

This is the **exact, exhaustive list** of values usable in `StatusBadge`. Do not introduce synonyms (e.g., "Done" instead of "Completed," "Awaiting Signature" instead of "Pending Approval") — every synonym fragments the audit trail's readability and breaks `statusConfig` color mapping.

```
Draft · In Workflow · Pending Approval · In Committee ·
For 1st Reading · For 2nd Reading · 3rd Reading · VP Certification ·
Approved · Released · Completed · Rejected · Under Investigation · Archived
```

If a new workflow step genuinely needs a new status (e.g., a future "Lapsed into Law" status), add it here **and** to `statusConfig` in the same change — never inline a one-off badge color.

### Classification Vocabulary (also exhaustive)

```
Public · Internal · Confidential · Restricted
```

---

## 4. UI Copy Patterns

### 4.1 Button labels

Buttons are **verbs**, specific to the action — never generic "OK"/"Submit"/"Go":

| ✅ Use | ❌ Avoid |
|---|---|
| "Approve" | "Yes" |
| "Send for Revision" | "Submit" |
| "Track Document" | "Search" *(too generic — what is being searched?)* |
| "Print Cover Sheet" | "Print" *(ambiguous — print what?)* |
| "Submit Request" | "Send" |

### 4.2 Empty states

Pattern: **icon + one factual sentence + (optional) one action**.

```
[Search icon, gray-300, 28px]
"No documents match your filters"
[Clear all filters]  ← only if filters are active
```

Never use humor, exclamation marks, or apologies ("Oops!", "Sorry, nothing here!") in an empty state for a government system — it undermines the "official records" framing.

### 4.3 Confirmation / result messages

State **what happened** and **what happens next** — two clauses, factual:

- ✅ "Document approved. Forwarded to the City Budget Office."
- ✅ "Your request has been logged and assigned a tracking number."
- ❌ "Success!" (states nothing about what happened or what's next)
- ❌ "Your request has been received and our team will get back to you soon!" (vague timing — "soon" is meaningless against ARTA deadlines)

### 4.4 Validation / error messages

State the **rule**, not the failure:

- ✅ "A comment is required for this action."
- ✅ "Please select your barangay."
- ❌ "Error: comment field is empty"
- ❌ "Invalid input"

### 4.5 Time-sensitivity language

| Situation | Phrasing |
|---|---|
| Normal queue time | "X days in queue" (neutral, factual) |
| Approaching deadline (≥80% of SLA) | "Approaching deadline — due [date]" |
| Breached deadline | "OVERDUE" tag + "X days in queue — ARTA deadline exceeded" |
| Mayor's 10-day review (ordinances) | "X days remaining in the 10-day review period" |

Never use words like "URGENT!!!", "ASAP", or "CRITICAL" outside the controlled `PriorityTag` vocabulary (`OVERDUE` / `URGENT` — both ALL CAPS, both used sparingly per `COMPONENT-GUIDELINES.md` §4).

---

## 5. Dates, Times, and Numbers

| Type | Format | Example |
|---|---|---|
| Dates (staff-facing) | `MMM D, YYYY` | "June 12, 2026" |
| Dates (compact / table cells) | `YYYY-MM-DD` (matches tracking number year convention, monospace) | "2026-06-12" |
| Timestamps (audit/timeline) | `MMM D, YYYY — h:mm A` | "May 29, 2026 — 10:45 AM" |
| Relative time | Avoid in audit contexts ("2 days ago") — always show absolute dates for legal records. Relative time ("4 days in queue") is acceptable **only** for SLA/queue-duration framing, always alongside an absolute due-date. |
| Currency | `₱{amount with thousands separators}.00` | "₱23,200.00" — always 2 decimal places, always the ₱ symbol, right-aligned in tables |
| Vote counts | "{Ayes} Ayes, {Nays} Nays, {Abstentions} Abstentions" | "10 Ayes, 0 Nays, 0 Abstentions" |
| Percentages (SLA/KPI) | One decimal place | "95.3%" |

All date/time formatting in code should go through `date-fns` (per `tech-stack.md`) with explicit format strings matching the above — never rely on `toLocaleDateString()` default locale formatting, which can silently shift between MM/DD and DD/MM depending on the browser locale (a real risk for a system used by both Philippine staff and, eventually, citizens on personal devices with varied locale settings).

---

## 6. Language and Multilingual Considerations

Per `tech-stack.md`, the platform targets Filipino, English, and Ilocano via i18next.

| Layer | Language (Phase 1) |
|---|---|
| Internal app UI chrome (buttons, nav, labels) | English |
| Document *content* (titles, body text) | As-submitted — may be Filipino, English, Ilocano, or mixed; never translated by the system |
| Citizen Portal UI chrome | English (Phase 1); Filipino/English toggle planned Phase 3 per `DESIGN.md` §11 |
| Error/validation messages | English (Phase 1); Filipino (Phase 3) |
| ARTA-mandated notices | Follow the regulation's required language as written in source documents — do not paraphrase legally-mandated notice text |

**When Filipino/Ilocano toggle ships (Phase 3):** every string in this style guide's §4 patterns needs a translated counterpart maintained in the same i18next namespace — do not let translated strings drift in tone (e.g., a Filipino translation that becomes more casual/exclamatory than the English original would break the "calm authority" principle in `BRAND.md` §4).

---

## 7. Capitalization Rules

| Element | Rule | Example |
|---|---|---|
| Page titles (`PageHdr`) | Title Case | "Document Repository" |
| Section headers (`SectionHdr`) | Title Case | "Active Legislative Queue" |
| Form labels | UPPERCASE (small caps via CSS, not literal screaming) | "TRACKING NO." rendered at 11px tracked-wide |
| Status badges | Title Case, exact vocabulary from §3 | "Pending Approval" not "pending approval" or "PENDING APPROVAL" |
| Document titles (as submitted) | Preserve as-submitted — do not re-case official document titles (many are written in legal ALL CAPS per LGU convention, e.g., "RESOLUTION AUTHORIZING...") | Display exactly as received |
| Office names | Match `1-domain-context.md` §4.2 exactly | "City Engineering Office," "Sangguniang Panlungsod," "CSWDO" |
| Names with honorifics | "Hon." for SP Members/Vice Mayor per `consolidated-architecture-and-requirements-reference.md` Part 3 | "Hon. Albert D. Chua" in legislative contexts; "Vice Mayor Albert D. Chua" in UI chrome |

---

*City Government of Batac · Ilocos Norte, Philippines*
*Content style guide for internal development use only — pre-production prototype.*
