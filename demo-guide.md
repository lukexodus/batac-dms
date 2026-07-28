# Demo Guide: Batac City LGU Document Management System (Phase 1)

**How to read this document:** every step below has been checked directly against the current codebase, not just the design documents. Where something is confirmed working, it's stated plainly. Where the real UI differs from what was originally planned, or where something can't be demonstrated live, that's called out explicitly rather than glossed over — you'll walk into the room knowing exactly where the soft spots are.

Labels used throughout, per this project's convention: `[Confirmed]` = checked directly against the code. `[Inference]` = reasoned from confirmed facts. `[Unverified]` = stated somewhere but not independently checked by me.

---

## 0. Before the room — setup checklist

1. **Run the seeds, in this order** (confirmed exact commands from `package.json` and the seed script's own header):
   ```
   pnpm db:seed
   pnpm --filter server exec tsx src/database/seeds/demo-credentials.seed.ts
   ```
   The second script only works after the first — it depends on offices and roles the first one creates. It's deliberately not wired into a normal npm script, likely so it's never run by accident outside a demo context.

2. **Your login sheet** — six real accounts, one shared password, all `[Confirmed]` from the seed file:

   | Username | Password | Plays | Lands on |
   |---|---|---|---|
   | `mayor.chua` | `BatacDemo2026!` | Mayor | `/mayor` (auto-redirect) |
   | `vicemayor.chua` | `BatacDemo2026!` | Vice Mayor / Presiding Officer | generic homepage → `/workflow/steps` |
   | `secretary.lagura` | `BatacDemo2026!` | SP Secretary | `/secretary` (auto-redirect) |
   | `records.mesina` | `BatacDemo2026!` | Records Officer | generic homepage → `/documents` |
   | `councilor.flojo` | `BatacDemo2026!` | SP Member (Chair, Committee on Laws) | generic homepage → `/workflow/steps` |
   | `councilor.aguinaldo` | `BatacDemo2026!` | SP Member (Chair, Peace & Order) | generic homepage → `/workflow/steps` |

   These aren't placeholders — they're built against the real 12-councilor roster and 23-committee structure from the actual 7th SP standing committees list, so the names and committee assignments you'll say out loud are accurate.

3. **Know before you go — two mechanics you cannot trigger live, and why:**
   - The Mayor's 10-day signing window only gets evaluated by a scheduled job that runs **once an hour**. There is no manual "run now" button anywhere in the app — I checked.
   - The Thursday committee-report cutoff (the thing that red-flags an item on the Order of Business) is evaluated **once a week**, Thursday midnight.
   
   Neither of these can be sped up by clicking anything. For both, either **pre-seed a second document already in that state** the night before (recommended — see Section 4), or **narrate the mechanic while pointing at the relevant screen** without pretending to trigger it. Don't promise stakeholders you'll demonstrate a live 10-day wait.

4. **Know before you go — one real bug affecting the flagship walkthrough:** logged in as SP Secretary, the "Assign Preliminary Number" and "Finalize Number" buttons on the document detail page currently do not appear on screen, due to an inverted permission check in the frontend (the backend itself is correctly secured — this is strictly a visibility bug, not a security hole). I've logged this to the project's findings log as `LOG-0174`. **Practical fix for the demo:** ask your engineering team to patch this one-line inversion before the presentation — it's a two-line fix, both lines follow the exact same pattern as every other button on that page. If it's not fixed in time, you'll need to either narrate this step ("the system would show a button here...") or have someone drive it briefly through a different account/API call out of view.

5. **The citizen-facing public portal is not built yet.** Its own source code labels it "Phase 3." There's a root layout file and nothing else — no lookup page, no public document view, no online complaint form. Every citizen/public-facing beat in this guide (Section 7) is narration with a slide or mockup, not a live click-through. Say so plainly if asked — LGU stakeholders will likely appreciate the honesty about what's sequenced for later.

---

## 1. How to frame the demo, at the top

Open by naming the shape of what they're about to see, in one breath: *"This is the system the SP Secretariat, the Vice Mayor, the Mayor, and Councilors will use to move a resolution from a raw draft through committee, through two readings, to the Mayor's desk, to the Province, and out to the public — with every step logged and timestamped automatically."*

Then set the expectation that's actually true: Phase 1 is not finished, and you're showing the finished slice of it working end-to-end, not the whole system. This isn't a weakness to hide — RA 7160's own legislative process has this many stages for a reason, and showing that the software genuinely tracks each one is the point.

---

## 2. The core narrative arc — one resolution, start to finish

This is your spine. It's built directly from the project's own pre-verified "happy path" test scenario (internally called S1), which was deliberately designed as the single most important, fully-specified journey through the system — and I've walked every step of it against the real screens to confirm it holds up.

**The story you're telling:** *A Councilor drafts a resolution. The Secretariat logs it in. It goes to committee, comes back, gets voted on twice, gets numbered, gets certified by the Vice Mayor, goes to the Mayor, gets signed, goes to the Province for review, comes back valid, and becomes publicly visible — automatically, with a full paper trail at every step.*

### Act 1 — Intake (as SP Secretary)

Log in as `secretary.lagura`. You'll land on `/secretary` automatically — a real dashboard with five live panels: your assigned steps, pending Secretariat documents, the upcoming session date, an Order of Business summary (with a "Red Flagged" counter — hold that thought for Section 4), and SLA compliance.

Click **"View all"** under My Assigned Steps, or navigate to **Documents → New**. This is a genuinely simple, three-field form: pick the document type (SP Resolution), give it a title, attach a file (PDF, JPEG, or PNG, up to 25MB). Submit.

**One honest note for this step:** the original plan called for capturing sponsor names (which Councilor is putting this measure forward) right here at intake. That field doesn't currently exist on this form — it's just type, title, and file. If a stakeholder asks about sponsor tracking, the honest answer is "that's not wired into intake yet," not a live demonstration of it.

You'll land on the document detail page. Point out: a QR tracking code has already been generated, and a **preliminary draft number** in the format `Draft 7SP {YEAR}-{NN}` is assigned — this number is provisional; it's not final until the second reading passes.

### Act 2 — Scheduling and First Reading (as SP Secretary)

Still logged in as Secretary: open the step from your inbox, schedule it for the next session's Order of Business, then record First Reading and set committee referral — Committee on Laws plus one subject-matter committee. Submit.

### Act 3 — Committee work (switch logins)

This is a good moment to physically hand the keyboard to someone else in the room, or narrate the switch — this is where the software genuinely shows multiple roles interacting, not one person doing everything.

Log in as `councilor.flojo` (Chair, Committee on Laws). Navigate to **My Assigned Steps** — the referral step is sitting in the inbox. Open it. You'll see a screen called "Multi-Referral" that shows *only* the section relevant to a Councilor: submit a committee report, pick the committee, write the report text, submit.

Switch back to `secretary.lagura`. On the same Multi-Referral screen, the Secretary sees two additional sections a Councilor doesn't — entering the hearing date, and a "manually advance" override (that's Section 5, below). Once all assigned committees have reported, click through to accept the unified report. The workflow moves forward.

### Act 4 — Second Reading and Numbering (as SP Secretary)

Open the Second Reading step. Record the vote outcome (Approved). This moves the document to final number assignment. Point out on the document detail page: the number now drops the "Draft" prefix and becomes the permanent `7SP {YEAR}-{NN}` — and this number, once assigned, is genuinely immutable in the system; there's no edit control for it anywhere in the UI. That's a legal-integrity guarantee worth stating plainly to stakeholders.

*(Assuming LOG-0174 is patched — otherwise this is the step to narrate rather than click through.)*

### Act 5 — Vice Mayor certification

Log in as `vicemayor.chua`. This role does not currently have a dedicated dashboard — it lands on a generic homepage with a "Workflow" card. Click through to **My Assigned Steps**, open the pending certification. The screen here is genuinely the simplest one in the whole app: a single "Certify Document" button. One click, done.

### Act 6 — Mayor's decision

Log in as `mayor.chua`. This role *does* get its own dashboard at `/mayor` — two widgets, "My Assigned Steps" (split into "Awaiting Your Decision" and, separately, "Lapse Notices" — the second is your visual proof of the 10-day mechanic, more on that in Section 4) and SLA Compliance.

Open the pending item. The Mayor's decision screen has exactly two buttons: **Sign** and **Veto**. Vetoing requires typing in an objections field first — the system won't let a veto through without a stated reason, which is a nice, concrete governance point to say out loud.

Click Sign.

### Act 7 — Docketing and Panlalawigan transmission (as SP Secretary)

Back as Secretary: complete the docketing step, then log the transmission to the Provincial government (Panlalawigan). This starts the 30-day provincial review clock — another timer you won't fast-forward live, but worth naming.

Then — for the purposes of the demo, treat this as if the Province has already responded — open the Panlalawigan outcome step and record the outcome as **Valid**.

### Act 8 — Archive (as Records Officer)

Log in as `records.mesina`. This role lands on a generic homepage with a "Documents" link. Navigate to the finished document. On the detail page's action bar, there's an **Archive** button, visible specifically because the document is now in a completed state and this account holds the Records Officer role. Click it.

*(Small correction worth knowing, not saying out loud: the original design called this a workflow "step" the Records Officer would complete from their inbox. It's actually simpler than that in the real build — it's a direct button on the document page. Simpler is fine; just don't narrate the inbox version, since it doesn't exist.)*

### Act 9 — Show the paper trail

This is a genuinely strong closing beat. Open the document detail page one more time and click the **"Routing History"** tab. This renders a real, human-readable timeline of every step this specific document has passed through — dates, actors, outcomes — built exactly for the moment you're in right now: proving to a room of stakeholders that nothing gets skipped and everything is timestamped.

*(One routing note: the original plan had a separate `/audit` page for this. That page doesn't exist under that name — what does exist is `/sysadmin/audit-ledger`, but that's a raw technical event log gated to IT administrators, not something to show a general stakeholder audience. The Routing History tab is the better, friendlier answer to "how do we know this is being tracked" — use that one.)*

---

## 3. The Certified Urgent shortcut — worth a short second pass

After the main arc, it's worth a two-minute detour to show the system isn't rigid about the *one* path you just walked. On the document detail page for a **different**, freshly-intake'd resolution — one still sitting at the committee referral step — as SP Secretary there's a "Log Certification of Urgency" action in the same action bar you used for Archive. Using it makes the committee-referral step jump straight to skipped, and the workflow proceeds directly to Second Reading, same-session. This is a real, wired mechanism, not a hypothetical — worth demonstrating precisely because it shows the system enforces the *legal* shortcut correctly (the certification itself is logged as an attachment to the measure, not given its own independent document number) rather than just being lenient.

---

## 4. The two things you narrate instead of click

Be upfront about these rather than trying to fake them:

- **The Mayor's 10-day lapse.** If the Mayor takes no action within 10 calendar days of a document reaching their desk, the system automatically transitions it forward anyway — same downstream path as if it had been signed, with the legal basis (RA 7160 §47) recorded automatically. **How to show this without a 10-day wait:** have your engineering team pre-seed a second document the night before, already sitting past its deadline, so the automatic hourly check has already caught it. Then during the demo, log in as Mayor and point at the "Lapse Notices" section on the dashboard — that's the real, live evidence the mechanic ran, even though you didn't watch it happen in the room.

- **The Thursday committee-report cutoff.** If a committee hasn't reported back before the week's cutoff, the item gets visually red-flagged on the Order of Business and is held off next Tuesday's agenda. Same approach: pre-seed a referral that's already past its cutoff, then point at the "Red Flagged" counter on the Secretary's dashboard, or open the Order of Business page directly and show the flagged row.

---

## 5. The governance/override moment — good for a skeptical audience

If your stakeholders include anyone likely to ask "what happens when the paperwork doesn't come in on time" — this is your answer, and it's fully demoable live, no pre-seeding required.

Take the red-flagged document from Section 4 (or set one up fresh: log in as Secretary, get a referral to the point where the Thursday cutoff has passed). Open the Multi-Referral screen. Below the Secretary's other options is a "Manually Advance Step" section, styled as a destructive/warning action. Try clicking it with the comment field empty — **the system blocks the submission** and asks for a reason. Type one in, submit. The step advances.

Then, as a follow-up beat: log in as `records.mesina` (or use the Auditor role if your team seeds one) and open `/sysadmin/audit-ledger` — *this* is the moment that page earns its place in the demo, not as a general "look how thorough we are" beat, but specifically to prove that this exact override, and the reason given for it, is permanently logged and cannot be edited or deleted by anyone, regardless of role.

---

## 6. Citizen complaint intake — staff-side only

The complaint module works staff-side, through the same kind of screens you've already shown. As Secretary, **Complaints → New** opens a form for logging a complaint someone brought in physically or reported by phone — violation type, respondent info, date/place. Submit, and it's created with tracking status. From there, route it to committee, get a report back the same way you did for the resolution, and mark it resolved.

What you should **not** promise here: a citizen submitting this themselves online, or checking their own status page. Both exist only as *routes that don't have pages behind them yet* — see Section 7.

---

## 7. Everything citizen-facing — narrate this section, don't click it

Be direct with the room: this piece is sequenced for a later phase and isn't built yet. What's confirmed:

- A citizen scanning a QR code on a physical document should land on a public page showing the document type, its full routing history, the first page only (later pages blurred), and a "Get a Copy" button.
- A citizen should be able to submit a complaint online, without an account, and check its status later with a tracking number.
- Full document text stays gated behind a formal paid request, approved by both the Vice Mayor and the SP Secretary — the portal only ever shows the first page.

All genuine, confirmed design intentions — none of them have a screen behind them in the current build. A slide or a rough mockup is the honest way to cover this section; a live click-through would show a blank shell.

---

## 8. Roles you likely won't demo, and why that's fine to say

- **System Administrator** — this role is entirely infrastructure: server health, database migrations, backups. No document content, by design. Skip it, or mention it exists as a deliberate separation-of-duties choice (the people who keep the servers running can't read what's in the documents).
- **Platform Administrator** — configures the system itself (workflow definitions, numbering formats, notification templates) without ever touching document content, and — by explicit design — can't hold any other operational role at the same time. Worth a sentence if your audience cares about configurability, but it's a "behind the scenes" role, not a story beat.

---

## 9. Suggested run-of-show, if you want a fixed order

1. Frame (Section 1) — 2 min
2. Full lifecycle walkthrough (Section 2, Acts 1–9) — 15–20 min, this is the core
3. Certified Urgent shortcut (Section 3) — 2 min
4. Point at the two pre-seeded, timer-driven examples (Section 4) — 3 min
5. The override + audit trail (Section 5) — 3 min
6. Complaint intake, staff-side (Section 6) — 3 min
7. Citizen portal, narrated (Section 7) — 3 min

Total: roughly 30–35 minutes of material, comfortably leaving room for questions.

---

That's the full guide. Two things worth deciding before you finalize logistics: whether you want your engineering team to patch LOG-0174 before the room (recommended — it's a small, targeted fix), and whether you want the pre-seeded lapse/red-flag documents set up as a one-time manual step the night before, or as a small seed script your team writes once and reuses for future demos.