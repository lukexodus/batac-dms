# Batac City LGU Platform — Brand Guidelines

**Version:** 0.1 · **Companion to:** `DESIGN.md`
**Scope:** The platform's visual identity, the official City Seal and its approved forms, naming conventions, voice/tone, and co-branding rules.

---

## 1. Overview

The Batac City LGU Platform is an **operational tool of the City Government of Batac**, not a separate commercial product. Its brand identity must therefore do two things at once:

1. **Inherit the authority of the City Government** — the seal, the official name, the formal register of government communication.
2. **Function as a piece of modern software** — the operational green/UI palette, IBM Plex Sans typography, and component system documented in `DESIGN.md`.

These two layers are deliberately kept **distinct but coordinated**. The seal is never redrawn in the UI's green; the UI's green is never used as a substitute for the seal. Section 2 covers this in detail.

---

## 2. The City Seal

### 2.1 What the seal depicts

The official Seal of the City of Batac is a circular emblem composed of three concentric layers:

- **Outer ring — navy blue**, carrying the text "CITY OF BATAC" (upper arc) and "OFFICIAL SEAL" (lower arc) in gold/yellow lettering, with one large gold five-pointed star at the left and right edges of the ring.
- **Middle ring — red**, bordered with a row of small white five-pointed stars.
- **Center shield**, divided horizontally:
  - **Upper half** — a blue sky with a radiating sunburst behind a white multi-story building (the municipal hall), flanked by a green tree on one side and palm-type trees on the other, sitting on a grey ground line.
  - **Lower half** — a green field displaying agricultural produce: rice/grain stalks, garlic, mango, a large leaf, and a tomato, reflecting the city's agricultural economy.

### 2.2 The seal's two approved forms

| Form | Asset | Used for |
|---|---|---|
| **Official Artwork** | `assets/city-seal-official.jpg` (full-color, full-detail) | Citizen Portal header/footer, printed cover sheets, letterheads, certified-copy stamps, login/auth screens, any context ≥ 48px where the seal represents the City Government in an official capacity |
| **Simplified Mark** | `CitySeal` SVG component (navy/red/gold rings + two-tone shield + sunburst silhouette) | Sidebar branding, browser favicon, compact avatars/badges, loading states, any context < 48px where the full artwork would render as illegible texture |

**Why two forms exist:** This mirrors standard practice for institutional seals — a detailed ceremonial seal is paired with a simplified mark for small UI chrome (the same relationship a university's full seal has to its "shield" app icon). The Simplified Mark preserves the seal's **color story** (navy outer ring, red inner ring, gold stars, blue-sky-over-green-field shield) so it remains recognizably "the Batac seal" even at 24px, without attempting to render fine details like the produce illustrations or ring text at illegible sizes.

**The Simplified Mark is never used as a substitute for the Official Artwork on any document that carries legal or ceremonial weight** (cover sheets, certifications, public-facing letterheads). If in doubt, use the Official Artwork.

### 2.3 Seal color reference

| Token | Hex | Element |
|---|---|---|
| `seal-navy` | `#1E3A8A` | Outer ring |
| `seal-red` | `#DC2626` | Middle ring |
| `seal-gold` | `#FBBF24` | Ring text, large stars, sunburst, small stars (white in original — `#FFFFFF`) |
| `seal-sky` | `#7DB8F0` | Shield upper field |
| `seal-field-green` | `#1A7A36` | Shield lower field |

These colors exist **only** to reproduce the seal itself. They are not part of the platform's operational palette (see §5).

### 2.4 Usage rules

**Minimum size**
- Official Artwork: never below 32px (the produce/building details become noise below this)
- Simplified Mark: usable down to 16px (favicon scale); below 24px the ring text becomes pure texture, which is expected and acceptable

**Clear space**
- Maintain a clear space around the seal equal to at least 25% of its diameter on all sides. Do not let text, icons, or other UI elements touch the seal's edge.

**Backgrounds**
- The seal (either form) sits correctly on white, light-gray, or the platform's dark sidebar green (`#0D3D20`). Avoid placing it on busy photographic backgrounds or on red/orange surfaces, which clash with the seal's own red ring.

**Don'ts**

- ❌ Never recolor the seal (no monochrome, no "brand green" tinting, no dark-mode inversion)
- ❌ Never stretch, skew, or crop the seal — it is always a complete circle
- ❌ Never use the seal as a repeating background pattern, watermark texture, or decorative motif
- ❌ Never place the Simplified Mark on a printed legal document in place of the Official Artwork
- ❌ Never combine the seal with platform iconography (e.g., do not overlay a Lucide icon on top of the seal)

### 2.5 Accessibility

- Both forms must always carry `alt`/`aria-label` text identifying it as the **"Seal of the City of Batac"** (Simplified Mark) or **"Official Seal of the City of Batac, Ilocos Norte"** (Official Artwork) — never a generic "logo".
- The seal is **decorative + identifying**, not informational — it does not convey status or data, so it never needs to change based on application state.

---

## 3. Platform Identity

### 3.1 Naming

| Name | Use |
|---|---|
| **Batac City LGU Platform** | Full formal name — used in document titles, the `DESIGN.md` header, login screens, footers |
| **the Platform** | Shorthand in body copy after first reference |
| **City of Batac** / **City Government of Batac** | Used when referring to the institution itself, not the software |

**Do not** invent a separate consumer-style product name (e.g., no "BatacGov+" or "CityFlow"). This is a government system; its name *is* its institutional name. This avoids the platform appearing to be a third-party vendor product.

### 3.2 Module naming conventions

Module names are **capitalized acronyms** when referring to the system, and **spelled out** on first reference in user-facing copy:

| Acronym | Full name | First-reference example |
|---|---|---|
| DTS | Document Tracking System | "Document Tracking (DTS)" |
| WMS | Workflow Management System | "Workflow Management (WMS)" |
| DMS | Document Management System | "Document Repository" *(user-facing label — avoid raw "DMS" in nav)* |
| RMS | Records Management System | "Records Management (RMS)" — Phase 2 |

**Rule:** Acronyms are appropriate in internal/developer contexts (this documentation, code comments, audit logs) but user-facing navigation labels should favor plain descriptions — "Document Repository" reads better in a sidebar than "DMS." The acronym can appear parenthetically on a page's first heading for staff training continuity (e.g., page subtitle "DMS — Internal Document Search and Management").

### 3.3 Logo lockups

The platform does not have its own logo separate from the City Seal + wordmark combination:

```
[Simplified Mark]  City of Batac
                   LGU Platform · v0.1
```

This lockup (seal + two-line wordmark) is the standard application mark, used in the sidebar header. For the Citizen Portal, the lockup expands to include the full government hierarchy line (see §6).

---

## 4. Voice and Tone

### 4.1 Principles

| Principle | In practice |
|---|---|
| **Plain language over bureaucratese** | "Track your document" not "Document Status Inquiry Module" |
| **Precise over vague** | "4 days in queue — overdue" not "Pending for a while" |
| **Calm authority, not alarm** | SLA breaches are flagged clearly but described factually, not in panic language |
| **Second person for citizens, third person for staff** | Citizen Portal: "Enter **your** tracking number." Internal app: "Assigned to **Dr. Reyes**, City Health." |

### 4.2 Examples

| Context | ✅ Do | ❌ Don't |
|---|---|---|
| Empty state | "No documents match your filters." | "Oops! Nothing here :(" |
| Confirmation | "Document approved. Forwarded to the City Budget Office." | "Success!!! 🎉" |
| Error / validation | "A comment is required for this action." | "Error: field cannot be null" |
| Citizen-facing | "Your request has been logged and assigned a tracking number." | "Ticket created. ID: #4471" |
| Overdue flag | "OVERDUE" / "4 days in queue — ARTA deadline exceeded" | "UH OH! This is late!" |

### 4.3 Tone differences by audience

- **Internal staff (Mayor, SP Secretary, Approvers, Records Officers):** Efficient, dense, assumes domain familiarity (ARTA, SLA, "1st Reading," "Certified Urgent" are used without explanation).
- **Citizens:** Plain language, defines terms on first use, never assumes the reader knows what "DTS" or "ARTA" means. "Track your document" instead of "DTS Lookup."

---

## 5. Color System — Brand Rationale

(Full token tables live in `DESIGN.md` §2. This section explains *why*.)

The platform's **operational palette is green** (`#00A651` primary), extracted directly from the live UI of batac.gov.ph — its navigation bar, pill-shaped category buttons, and call-to-action elements. This green is what citizens and staff already associate with "the City of Batac website" in a digital context.

The **seal's heraldic palette is navy/red/gold**, fixed by the seal's original artwork and never altered.

**These two palettes are not in conflict — they operate in different registers:**

- Green = "you are using the City of Batac's digital services" (operational, modern, day-to-day)
- Navy/red/gold (via the seal) = "this is an official act of the City Government" (ceremonial, legal, identity-confirming)

A page can — and often should — contain both: a green-accented UI shell with the seal present as an identity marker in the header or cover sheet. What must never happen is *merging* them (e.g., a green-tinted seal, or seal colors bleeding into buttons/badges).

---

## 6. Co-Branding Hierarchy

Philippine LGU documents follow a standard institutional hierarchy, top to bottom:

```
Republic of the Philippines
  Province of Ilocos Norte
    City Government of Batac
      [Office — e.g., Sangguniang Panlungsod / Office of the City Mayor]
        Batac City LGU Platform
```

### Where this hierarchy appears

| Surface | Hierarchy shown |
|---|---|
| Internal app sidebar | "City of Batac / LGU Platform · v0.1" — abbreviated, since staff already know the full context |
| Citizen Portal header | Full line: "Republic of the Philippines · Province of Ilocos Norte" above "City Government of Batac" |
| Document cover sheets / letterheads | Full hierarchy, plus the originating office (e.g., "SP Secretariat") |
| Printed certified copies | Full hierarchy + seal (Official Artwork) + signatory block |

The Platform itself sits at the **bottom** of this hierarchy — it is a tool used *by* these offices, not an institution in its own right. Its branding should never visually outrank the City Government or Republic-level identity (e.g., the platform name should never appear larger than "City Government of Batac" on any official-facing surface).

---

## 7. Brand Application by Context

| Context | Seal form | Header background | Notes |
|---|---|---|---|
| Internal app sidebar | Simplified Mark, 30–34px | `seal-navy`-adjacent dark green (`#0D3D20`) | Compact lockup; role badge shown below (e.g., "Mayor · City of Batac") |
| Citizen Portal header | Official Artwork, 48–56px | `#0D3D20` | Full Republic/Province/City hierarchy line |
| Document cover sheet (print) | Official Artwork, 3cm diameter | White | Top-left position per `DESIGN.md` §13 |
| Login / auth screen *(not yet mocked)* | Official Artwork, ≥64px | White or `brand-light` | Seal + full hierarchy line, centered above the login form |
| Certified copy stamp | Official Artwork, small inline | — | Paired with signature block, never used alone as a "verified" badge |

---

## 8. Asset Manifest

| Asset | Path | Format | Notes |
|---|---|---|---|
| Official seal artwork | `/assets/city-seal-official.jpg` | JPEG, 1628×1628px | Source file as provided by the City Government. Production: convert to optimized PNG/WebP and place in `/packages/ui/assets/branding/`, served from `/apps/web/public/branding/` |
| Simplified mark | `CitySeal` component (inline SVG) | SVG, 100×100 viewBox | No external file — lives in the shared UI component library |
| Typeface | IBM Plex Sans / IBM Plex Mono | Web font (Google Fonts) | See `DESIGN.md` §3 |

---

## 9. Open Items

- The **Official Artwork** file should be replaced with a vector (SVG/EPS) source from the City Government if available — the current asset is a raster JPEG, which limits quality at very large print sizes (e.g., banners, large cover sheets above A4).
- A **login/auth screen** mockup is not yet part of this prototype; when built, it should follow §7's "Login / auth screen" row.
- Confirm with the SP Secretariat / PIO whether the seal has an existing **official brand manual** with codified Pantone/CMYK values for print — if so, those values supersede the RGB hex approximations in §2.3 for any physical print production.

---

*City Government of Batac · Ilocos Norte, Philippines*
*Brand guidelines for internal development use only — pre-production prototype.*
