# Part 1: Environment Setup — Exact Steps, In Order

Everything below is confirmed against the actual `compose.yml`, `.env.example`, and the three `package.json` files (root, `apps/server`, `packages/database`) — not the README's phrasing, which I found to be slightly stale in one place (the migrate command) and correct everywhere else.

## Step 0 — One-time machine prep (skip if already done)

```bash
# Requires Node.js + pnpm. The repo pins pnpm via corepack, so:
corepack enable
cd batac-dms
pnpm install
```

## Step 1 — Environment file

```bash
cp .env.example .env
```

**Then edit `.env` and fix `CITY_ID` before running any seed command — not after.** This is not optional — it's a real, confirmed bug in the repo, not a maybe:

```
# .env.example ships with:
CITY_ID=01930a7d-0000-0000-0000-000000000001

# Every seed file (iam.seed.ts, organization.seed.ts, and the demo-credentials
# script you already ran) hardcodes a DIFFERENT value as its default:
CITY_ID=00000000-0000-4000-8000-000000000001

# Change .env to the second value BEFORE you seed. If you seed first and fix
# .env second, you'll get rows planted under the stale city_id that are
# invisible to the app and to every other seed script — empty screens everywhere
# despite a "successful" seed. Untangling it means manually deleting from
# iam.role_assignments, iam.credentials, organization.employees, and iam.users
# by hand. That's a four-table cleanup; it's cheap to avoid entirely by just
# getting the ordering right the first time.
```

You already found and fixed this once mid-session — this note is so it doesn't surprise you again if you ever wipe the volume and start clean (see Step 2's warning below).

Everything else in `.env.example` is safe to leave as-is for a local demo — the dev placeholder secrets, ports, and Argon2 cost parameters are all fine for this purpose.

## Step 2 — Start infrastructure

```bash
docker compose -f compose.yml up -d
```

This brings up four services: **Postgres 16** (port 5432), **MinIO** (S3-compatible storage, ports 9000/9001), **Mailpit** (local email preview, ports 1025/8025). Meilisearch is intentionally left out — it's gated behind `--profile search` and isn't required for Phase 1, so don't add that flag unless you specifically want to poke at it.

**Watch for this specifically:** Postgres's role-creation script (`tools/db/init/01-create-roles.sh`, which creates the three DB users your `.env` connection strings depend on) only runs automatically **the first time Postgres initializes against an empty data volume.** Two scenarios:

- **Fresh machine, first-ever `up`:** just works, roles get created automatically.
- **You've run `docker compose up` on this project before** (even a failed attempt): the Postgres volume already exists, so the role-creation script silently won't re-run, and your migration step will fail with an auth error that looks unrelated to this cause. If you're not certain this is a clean first run, the safe move is:
  ```bash
  docker compose -f compose.yml down -v   # -v removes the volume too
  docker compose -f compose.yml up -d
  ```

Confirm all containers are healthy before moving on:

```bash
docker compose -f compose.yml ps
# All four should show "healthy" in the STATUS column, not just "running" —
# the compose file defines real healthchecks for each service, so this is
# a meaningful check, not a formality.
```

## Step 3 — Fix the workflow seed definition (before first seed)

```bash
# In packages/database/src/seeds/workflow/phase1-legislative.ts,
# find the SP_ORDINANCE_WORKFLOW block and add an AMENDED transition rule
# for third_reading_vote (after the existing APPROVED and REJECTED rules):
#
#   { from_step_key: "third_reading_vote", to_step_key: "amendments_logging",
#     outcome_filter: "AMENDED", condition_expression: null, priority: 2,
#     label: "Amended at third reading" },
#
# Do the same in the APPROPRIATION_ORDINANCE_WORKFLOW block (same file,
# same pattern).
```

This is **not optional and not environment-specific** — it reproduces on a clean checkout every time. Both ordinance workflows declare `AMENDED` as an allowed outcome on `third_reading_vote` but don't provide a transition rule for it, so `pnpm db:seed` will hard-fail at the workflow-definition stage with `MISSING_OUTCOME_TRANSITION` before any of the rest of the setup can proceed. The fix is two identical one-line additions in the same file — same `from_step_key`, same `outcome_filter`, same `to_step_key` in both blocks.

## Step 4 — Run migrations

```bash
pnpm --filter @batac/database db:migrate
```

(This resolves to `tsx scripts/migrate.ts` — confirmed directly in `packages/database/package.json`. The README's phrasing of this step was hedged; this is the exact, real command.)

## Step 5 — Seed reference data

```bash
pnpm db:seed
```

This runs, in order (confirmed from `apps/server/src/database/seeds/orchestrator.ts`): IAM (roles/permissions) → Organization (offices, 12 councilors, 23 committees) → Number Series → Document Types → Phase 1 Workflow Definitions (Resolution, Ordinance, Appropriation Ordinance). Watch the console output — it logs each step by name, so if something fails you'll know exactly which stage.

## Step 6 — Seed demo login credentials

```bash
pnpm --filter server exec tsx src/database/seeds/demo-credentials.seed.ts
```

You already ran this successfully and extended it with the Records Officer account. This must run **after** Step 5, not before — it depends on offices, roles, and the councilor employee placeholders already existing. Confirm your console output shows all six accounts, either freshly "Created" (first run) or correctly "Already existed — skipped" (any re-run):

```
mayor.chua, vicemayor.chua, secretary.lagura, records.mesina, councilor.flojo, councilor.aguinaldo
```
Shared password: `BatacDemo2026!`

## Step 7 — Start the app

```bash
pnpm dev
```

This is Turborepo-orchestrated and starts both `apps/web` (Vite, confirmed default port `5173`) and `apps/server` (Fastify, confirmed default port `3000`) together. Watch the server's console log line specifically — it will print:

```
Server listening on http://0.0.0.0:3000/health
```

That confirms the backend is actually up and its health endpoint is live — a real readiness signal, not a guess. Once you see that, open **`http://localhost:5173`** in your browser. You should land on the login page.

## A note on multi-account logins during the demo

I checked `.env.example` and found `AUTH_MAX_CONCURRENT_SESSIONS=1`. This means **logging in as a second person will end the first person's session.** For a demo where you're moving between six roles, don't try to keep multiple accounts logged in across browser tabs in the same browser profile — it won't hold. Two options:

- **Log out, then log back in as the next role** (clean, simple, and honestly reads well on stage — "let me switch to the Mayor's view now" is a natural, narratable beat).
- **Use separate browser profiles or incognito/private windows per role** if you want two roles visible side-by-side at once (e.g. showing a councilor's queue next to the Secretary's dashboard in a split-screen moment). Each incognito window holds its own session independently.

I'll build the walkthrough below around the log-out/log-in pattern as the default, since it's more reliable in front of a live audience — a session collision mid-sentence is the kind of thing that costs you the room.

---

# Part 2: The 45-Minute Walkthrough Script

Audience: Mayor's Office and SP Secretariat, non-technical. The organizing idea for the whole session: **you are not showing them software features — you are showing them the exact paper process they already know, and pointing at the moment it becomes faster, safer, or impossible to lose.** Every segment below pairs a real requirement-doc fact with a specific click sequence, and I've marked where you switch accounts.

A structural note before the timeline: I'm building this around **two resolutions run in parallel across the session** — one that sails through cleanly, and one that hits a real complication (Certified Urgent, or an amendment) — because watching only the happy path reads as a demo reel, while watching the system handle a wrinkle is what actually earns trust from people who've spent years watching paper process break under real-world messiness.

---

## Segment 1 — Open as the Secretary: "This is where every document is born" *(0:00 – 0:07, 7 min)*

**Log in as `secretary.lagura`.**

Open on the **SP Secretary dashboard** (`/secretary`). Before clicking anything, orient them verbally: *"Right now, when a councilor hands Gladys a drafted resolution, it goes into a folder, gets a handwritten number, and from that point on, whether it's actually moving depends on someone remembering to check on it. This screen is that same intake — except now it can't be forgotten."*

**Click sequence:**
1. Go to `/documents/new`. Walk through creating a new SP Resolution — pick a real, low-stakes subject (e.g. "Resolution Commending the Batac City Public Market Vendors Association for the 2026 Cleanliness Drive" — deliberately uninflammatory, so nobody in the room reacts to the content instead of the process).
2. Fill in sponsors — this is your chance to show `councilor.flojo` and `councilor.aguinaldo` by name in the sponsor picker. Point out: *"Only councilors can sponsor — that rule about who's allowed to author a resolution is enforced by the system, not by someone remembering the rule."* (This maps directly to Part 4.1's confirmed fact: "Sponsors: only councilors can sponsor.")
3. Submit. **Point at the number that appears: `Draft 7SP 2026-0X`.** Say plainly: *"This is the preliminary number. It's assigned the moment Gladys logs it — before the QR code, before anything else happens. And here's the part that matters: this number can still change."* This is a genuinely good "aha" beat because it's counterintuitive — most people expect a number, once assigned, to be permanent. Explain the real reason (Part 4.1, Q-01): *"If two resolutions come in the same week, whichever one finishes its final reading first gets the lower final number — not whichever one was logged first. The draft number is a placeholder. The final number reflects what actually happened."*
4. Show the **QR code** that gets generated. *"This gets printed and physically attached to the paper copy today. From this second, if this document is ever in a box on someone's desk, anyone with a phone can scan it and see exactly where it is in the process — no calling around."*

---

## Segment 2 — First Reading and the Committee Referral: "Two committees, one hearing, no dropped balls" *(0:07 – 0:16, 9 min)*

Stay logged in as `secretary.lagura`.

**Click sequence:**
1. Advance the resolution to **First Reading**. Narrate that in real life this happens in session, live, with the Vice Mayor presiding — the system isn't replacing that moment, it's recording what happens in it.
2. Show the **committee referral step** — this is the single best architectural story in the whole system, and it's worth slowing down for. Say: *"Here's something the team building this actually discovered by reading through years of your own hearing notices, not something we assumed going in — almost every resolution here doesn't go to one committee. It goes to two, at the same time: the subject committee, plus the Committee on Laws, every time, as standard practice."* Point at the two committees populated in the referral (e.g. Committee on Laws + a subject committee chaired by `councilor.aguinaldo`'s Peace & Order committee, or similar, depending on the resolution's topic).
3. Explain the **Thursday cutoff, visually**: *"Committee reports are due by Thursday for next Tuesday's session. If a committee hasn't reported by then, this item doesn't disappear or get forgotten — it gets flagged red on the Order of Business, and it automatically waits for the Tuesday after everyone's actually reported."* (Part 8.3, confirmed: absent/non-reporting committees are visually flagged, not blocking; the measure's Second Reading is delayed to "the Tuesday after the week in which all committees submit.")
4. **Log out. Log in as `councilor.flojo`.** Show his view of the same referral — the committee inbox, the pending report. This is the moment to say: *"A councilor sitting on five or six committees doesn't get five separate emails or five separate stacks of paper to track. It's one queue, and it shows exactly what's assigned to him right now."* (Part 6, confirmed: "Each Councilor sits on 4–6 committees. Notification and inbox logic must handle overlapping membership without duplicating workflow steps.")
5. Submit a short committee report as Flojo, completing the referral step.

---

## Segment 3 — Second Reading and the Certified Urgent Path: showing the system handle a real wrinkle *(0:16 – 0:26, 10 min)*

**Log back in as `secretary.lagura`.**

This is where you introduce your **second resolution** — something genuinely time-sensitive-sounding (e.g. a disaster-response or public-safety-adjacent resolution — again, keep content boring, the point is the mechanism). Log it exactly as in Segment 1, but this time:

1. Attach a **Certification of Urgency** to it. Explain what this actually is in real life first: *"This isn't a system feature invented for this demo — it's a real, formal document the Mayor's office already issues, and your own records show it happens often."* (Part 4.17, confirmed: "Frequency: Frequent — explicitly noted as a common occurrence.")
2. Show what happens the instant it's attached: **the committee referral step is bypassed entirely**, and the resolution jumps straight to being eligible for Second Reading in the *same session* as First Reading. Say: *"Right now, someone has to know this rule exists and manually route around the committee step. Here, attaching the real certified document is what changes the workflow — the system doesn't take anyone's word for it, it reacts to the actual certification being on file."*
3. Advance this resolution through **Second Reading** — show the vote outcome options (Approved / Amended / Returned for Revision / Rejected), matching the actual four outcomes coded into the workflow engine (`second_reading_vote` step, `allowed_outcomes` in the seed data you now know is real, not illustrative). Pick **"Amended"** for this one deliberately — don't only show the clean path.
4. Show the **amendments logging step** that appears as a direct consequence — Secretariat records what changed, prepares the final copy. Tie it back to the requirement: *"No separate third reading for a resolution amendment — that's not a shortcut the software is taking, that's the actual confirmed rule for resolutions specifically. Ordinances work differently — they get a third reading. This system knows the difference automatically, per document type."* If you demo the ordinance path specifically and choose "Amended" at Second Reading, the document now correctly routes through a real `amendments_logging` step before Third Reading (rather than dead-ending), so expect and narrate that extra step when it appears on screen — it's the ordinance path doing exactly what it should.
5. **Now show your first resolution finishing cleanly** (no amendment) alongside it — approved outright at Second Reading, no detour. Having both paths visible back-to-back is the entire point of this segment: *"Same starting point, two different real outcomes — urgent versus normal, clean versus amended — same system, no special-casing by a person."*

---

## Segment 4 — The Final Number, Signatures, and the 10-Day Clock: the part that used to be invisible *(0:26 – 0:34, 8 min)*

Stay logged in as `secretary.lagura` for the final-number moment, then hand off.

1. Advance either resolution past its final vote. **Point at the number changing**: `Draft 7SP 2026-0X` becomes `7SP 2026-X` — the "Draft" prefix drops off. Say: *"This is the moment the number becomes permanent. It happens automatically, right after the vote — nobody has to remember to come back and finalize it."*
2. **Log out. Log in as `vicemayor.chua`.** Show the resolution now sitting in his queue awaiting signature as Presiding Officer. Sign it. *"In the paper world, this document has to physically reach him, physically get signed, and physically travel back. Here, it arrives in his queue the moment it's ready — no courier, no 'is it on his desk yet.'"*
3. **Log out. Log in as `mayor.chua`.** This is your best "the paper process has a real, ticking legal risk in it" beat. Show the resolution now sitting with the Mayor, and explicitly name the **10-day calendar clock** (Part 4.1, RA 7160): *"By law, if the Mayor doesn't act within 10 calendar days, this doesn't just sit in limbo — it automatically lapses into law. Right now, tracking that 10-day window by hand, across dozens of documents, is exactly the kind of thing that's easy to lose track of. Here, the system is counting for you, and if that clock runs out, it doesn't guess — it logs the lapse with the exact legal citation, RA 7160, automatically."* Show the Mayor **signing** it here (the approving path) — you don't need to actually demonstrate the veto path live unless you have extra time; naming that it exists (with the 2/3-override, 8-of-12-votes threshold) is usually enough for a non-technical audience, and trying to fast-forward a fake 10-day timer live risks looking gimmicky.

---

## Segment 5 — Panlalawigan, the Records Officer, and where it finally lands *(0:34 – 0:40, 6 min)*

**Log in as `records.mesina`.**

1. Show the resolution now in **Sangguniang Panlalawigan review** — explain the outward transmission and the automated **30-day timer** (Part 4.3, confirmed) the same way you did the 10-day one, but note the difference in what "no response" means here: *"If the Province doesn't respond in 30 days, the law doesn't treat that as a rejection — it's treated as approved. 'Deemed Approved,' with the exact statute cited automatically: RA 7160, Section 56(d)."*
2. This is Mesina's actual moment in the story — the **archive**. Show the resolution's full routing history end to end, every step it passed through, every signature, every timestamp, as one unbroken record. Say directly to her: *"This whole trail — who touched it, when, in what order — this is the thing you currently have to reconstruct by hand if anyone ever asks 'where did this decision come from.' Here, it's not reconstructed. It was never lost in the first place."*
3. If you have appetite for one more technical-but-plain-language beat here, this is the spot: mention the audit trail is **hash-chained** — *"Each entry is cryptographically linked to the one before it. If a single record were ever quietly altered after the fact, the chain would visibly break. Nobody can go back and rewrite what happened."* Keep this to one sentence; don't over-explain the cryptography to this audience.

---

## Segment 6 — The Citizen's Side: closing where the public actually touches this *(0:40 – 0:45, 5 min)*

Close, don't open, with this — it's the natural landing point because it ties back to the Part 7.1 framing that the whole platform is built around: *"public transparency and access, not internal workflow automation,"* as the stated primary value.

1. Briefly show a **Citizen Complaint** intake form (`/complaints/new`) and, if time allows, a **Document Request** (`/document-requests/new`) — narrate the **three access modes** confirmed for both (Part 4.15): a citizen can print a template and submit it physically, fill it out digitally and print-to-sign, or come in and have a Secretariat clerk key it in for them on the spot. Say: *"Nobody is being asked to change how they interact with your office if they don't want to. Someone who's never touched a computer can still walk in and get exactly the same result — the difference is what happens to their request after they hand it over."*
2. If genuinely built and stable enough to click into live (worth a quick check right before your actual presentation, not assumed from this conversation), show what the **public portal** would eventually show for an approved, published resolution — title and first page visible, full text behind a paid request. If it isn't demo-stable, simply describe it in one sentence rather than risk an unstable screen this late in the session.
3. **Close on the honest scope statement, don't hide it — it will land as credibility, not weakness:** *"This is Phase 1. Resolutions, Ordinances, Appropriation Ordinances — the core legislative spine — plus tracking, plus this audit trail, plus the complaint and request intake you just saw. Letters, memos, hearing notices, designations — those are real, they're scoped, they're Phase 1B, deliberately sequenced next rather than rushed in now."* A room full of people who've watched government IT projects overpromise before will trust a team more, not less, for saying plainly what isn't done yet.

---

## Two operational notes for you, not for the room

**On what's real versus what you're narrating as real:** everything content-specific in this script — the two-reading rule, the Thursday cutoff, the multi-committee default, the 10-day and 30-day clocks, the "Draft" number instability, the three complaint/request access modes — I pulled directly from the confirmed requirements doc and cross-checked against the actual seeded workflow definitions and number-series config in the code. You're not overselling anything by saying these rules are enforced; I traced each one to the actual step config. The one place to genuinely soft-pedal, per the README's own status note plus what you told me: `/organization`, `/sysadmin` beyond user creation, and the Mayor/`/sysadmin` dashboards may still be visually rougher than the flows above — worth a quick click-through on your own machine the day before, specifically on any screen this script doesn't name, so you're not discovering a rough edge live.

**On timing slack:** this adds to about 45 minutes at a natural pace, but demos always run long once questions start landing mid-segment. If you need to cut, cut Segment 6's Document Request half and the hash-chain sentence in Segment 5 first — everything else is load-bearing to the "watch two real documents survive a real complication" arc that makes this land as more than a click-through.