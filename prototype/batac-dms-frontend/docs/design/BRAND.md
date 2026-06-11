# Batac City LGU Platform — Brand Guidelines

**Version:** 0.1 · **Status:** Reference Documentation  
**Source:** City of Batac Brand System, Sangguniang Panlungsod (SP) Secretariat

---

## 1. Brand Philosophy

The visual and interactive identity of the Batac City LGU Platform is centered around **Official Clarity**. Unlike commercial SaaS products, this platform represents the authority, legitimacy, and operational care of a local government unit.

### Core Pillars:
* **Institutional Trust**: Every interface decision must project formal authority, utilizing structured layouts, clean borders, and the official City Seal.
* **Role-Aware Hierarchy**: Urgency, workflow positions, and action requests are context-sensitive. SLA/ARTA compliance triggers visual states that guide the user's attention.
* **Visual Restraint**: No startup-casual graphics, gamification, or overly soft pastel accents. The interface uses solid, clear boundaries and legible text.

---

## 2. Color System

The colors are extracted directly from the official City of Batac branding (batac.gov.ph) and legislative specifications.

### A. Primary Brand Colors
These define the app's chrome, sidebar, and primary call-to-actions.

| Token | Hex | Tailwind Utility Class | Usage |
|---|---|---|---|
| `brand-primary` | `#00A651` | `bg-[#00A651]` / `brand-btn` | Primary buttons, active nav indicators, positive status highlights |
| `brand-dark` | `#0D3D20` | `bg-[#0D3D20]` / `sidebar-bg` | Sidebar background, primary brand headers |
| `brand-mid` | `#1A6B35` | `bg-[#1A6B35]` / `sidebar-mid` | Sidebar section headers, dark accents, seal background |
| `brand-light` | `#E8F5ED` | `bg-[#E8F5ED]` / `brand-bg-light` | Light card backgrounds, secondary containers |
| `brand-50` | `#F0FAF4` | `bg-[#F0FAF4]` / `brand-bg-50` | Hover states, subtle panel highlights |

### B. Accent Colors (City Seal Gold)
Used for special sessions, certifications, and high-importance legislative states.

| Token | Hex | Usage |
|---|---|---|
| `accent-gold` | `#F59E0B` | Seal stroke, special session highlights, star badges |
| `accent-gold-dark` | `#92400E` | Gold text on light backgrounds |
| `accent-gold-light` | `#FEF3C7` | Gold background fills |

### C. Semantic Status Colors
These indicate workflow stages, timelines, and alert states.

| Status | Background Hex | Text Hex | Usage |
|---|---|---|---|
| **Approved / Released** | `#DCFCE7` | `#15803D` | Completed steps, signed documents |
| **Pending Approval** | `#FEF3C7` | `#92400E` | Actions currently awaiting sign-off |
| **In Workflow / VP Cert** | `#DBEAFE` | `#1E40AF` | Active routing, standard processing |
| **In Committee** | `#EDE9FE` | `#5B21B6` | SP Committee hearings |
| **For Reading (1st/2nd/3rd)** | `#F3E8FF` / `#EDE9FE` | `#6B21A8` | Legislative reading stages |
| **Rejected / Overdue** | `#FEE2E2` | `#991B1B` | Rejected requests, SLA breaches |
| **Under Investigation** | `#FFEDD5` | `#9A3412` | Admin/legal reviews |
| **Draft** | `#F3F4F6` | `#4B5563` | Not yet submitted |
| **Archived** | `#F3F4F6` | `#6B7280` | Permanently stored |

### D. Neutral Grays
Neutral tones structure the main content area background, card borders, and primary typography.
* `gray-50` (`#F9FAFB`): Secondary section backgrounds.
* `gray-100` (`#F3F4F6`): Borders, dividers, and disabled states.
* `gray-200` (`#E5E7EB`): Accent borders.
* `gray-500` (`#6B7280`): Muted helper text, secondary labels, table headers.
* `gray-700` (`#374151`): Main body text.
* `gray-900` (`#111827`): Headings, bold text, primary emphasis.

---

## 3. Typography System

### Typeface Selection:
* **Primary**: `IBM Plex Sans` (Weights: 400, 500, 600, 700) — projects institutional authority and modern administrative competence.
* **Monospace**: `IBM Plex Mono` (Weights: 400, 500) — critical for tracking codes (`DTS-2026-XXXXXX`), timestamps, and audit log entries.

### Type Scale Hierarchy:
1. **Display**: `2.25rem` (36px) | Bold | Major dashboard titles.
2. **Heading XL**: `1.5rem` (24px) | Bold | Main pages (e.g., Mayor's Dashboard, SP Secretary).
3. **Heading MD**: `1rem` (16px) | Semibold | Card titles, panel headers.
4. **Body MD**: `0.875rem` (14px) | Regular | Data tables, body paragraphs.
5. **Body SM**: `0.75rem` (12px) | Regular | Muted text, timestamps, action helpers.
6. **Label**: `0.6875rem` (11px) | Semibold | All-caps form titles, table column headers.
7. **Monospace Code**: `0.8125rem` (13px) | Regular | DTS Tracking Codes.

---

## 4. City Seal Specifications

The digital representation of the City Seal in the navigation menu is drawn dynamically as a vector graphic. It must never use low-resolution bitmaps.

```xml
<svg width="40" height="40" viewBox="0 0 100 100" fill="none">
  <circle cx="50" cy="50" r="48" fill="#1A6B35" />
  <circle cx="50" cy="50" r="44" fill="#1A6B35" stroke="#F59E0B" strokeWidth="2" />
  <circle cx="50" cy="50" r="37" fill="#1A6B35" stroke="#F59E0B" strokeWidth="1" />
  <!-- Building -->
  <rect x="36" y="52" width="28" height="20" rx="1" fill="#F0FAF4" />
  <rect x="40" y="44" width="20" height="10" rx="1" fill="#F0FAF4" />
  <rect x="45" y="38" width="10" height="8" rx="1" fill="#F0FAF4" />
  <rect x="42" y="55" width="5" height="9" rx="0.5" fill="#1A6B35" />
  <rect x="53" y="55" width="5" height="9" rx="0.5" fill="#1A6B35" />
  <!-- Stars -->
  <circle cx="28" cy="50" r="2" fill="#F59E0B" />
  <circle cx="72" cy="50" r="2" fill="#F59E0B" />
  <circle cx="50" cy="26" r="2" fill="#F59E0B" />
  <!-- Typography -->
  <text x="50" y="20" textAnchor="middle" fill="#F59E0B" fontSize="6" fontFamily="serif" fontWeight="bold" letterSpacing="0.5">CITY OF BATAC</text>
  <text x="50" y="88" textAnchor="middle" fill="#F59E0B" fontSize="5.5" fontFamily="serif" letterSpacing="0.3">ILOCOS NORTE</text>
</svg>
```

* **Color Constraints**: Must use the exact brand tokens (Forest Green `#1A6B35`, Amber Gold `#F59E0B`, Off-white `#F0FAF4`).
* **Sizing**: Default size is `40px` in standard sidebar layouts, collapsing to `30px` when the menu is minimized.

---

## 5. Language and Tone of Voice

1. **Official but Plain Language**: Use direct terminology. Instead of "Execute document query," use "Search documents." Avoid technical jargon where standard administrative terms fit.
2. **Multilingual Ingestion, Unified Interface**:
   - **UI Chrome (Menus, system alerts, table headers)**: Must remain strictly in English.
   - **Document Fields & Title Ingestion**: Supports English, Filipino, and Ilocano as submitted.
   - **Citizen Portal Search Prompts**: Keep descriptions descriptive and simple (e.g., "Enter 15-character tracking number" rather than "Input DTS identifier").
