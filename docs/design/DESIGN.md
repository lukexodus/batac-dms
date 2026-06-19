# Batac City LGU Platform — Design System Reference

## Table of Contents

- [L24–L29] `batac-dms` · `/packages/ui` · Version 1.0 — Document scope, authoritative reference guidelines, and version metadata.
- [L30–L116] 1. Brand DNA — Observed brand colors, typography, spacing, and visual tone extracted from the official batac.gov.ph website.
- [L117–L142] 2. Adaptation Rationale — Differences between the citizen-facing portal and internal DMS, including the signature document number monospace pill.
- [L143–L366] 3. Complete Token Dictionary — Authoritative CSS custom properties for colors, typography, spacing, border radius, shadows, and z-index tokens.
- [L367–L531] 4. Tailwind Config Extension — Tailwind CSS configuration extending the utility framework with the design system's custom tokens.
- [L532–L664] 5. shadcn/ui Theme Override — Mapping of tokens to shadcn/ui HSL variables, global CSS resets, and touch target rules.
- [L665–L1114] 6. Component Usage Guidelines — Implementation rules, design patterns, and Tailwind classes for the application's UI components.
  - [L667–L735] 6.1 Layout & Shell — Structure and responsive layouts for the app shell, collapsible sidebar, topbar, and page headers.
  - [L736–L777] 6.2 Navigation — Usage and styling rules for breadcrumbs, document tabs, and the command palette search overlays.
  - [L778–L926] 6.3 Data Display — Guidelines for data tables, the signature document badge, status colors, SLA timers, and timelines.
  - [L927–L1001] 6.4 Forms & Inputs — Styling and constraints for standard inputs, date pickers, drag-and-drop file uploaders, and form wrappers.
  - [L1002–L1064] 6.5 Feedback & Overlays — System alerts, temporary toast notifications, confirm modals, drawers, tooltips, and loading skeletons.
  - [L1065–L1114] 6.6 Specialized Components — Implementation of QR displays, preview cards, agenda rows, referral blocks, and user avatar formatting.
- [L1115–L1148] 7. State Color Map — Authoritative mapping of legislative workflow states to specific token colors and border styling.
- [L1149–L1234] 8. Do / Don't Rules — Twelve mandatory guidelines covering typography, color usage, form tags, empty states, and accessibility requirements.
- [L1235–L1300] 9. Typography Specimen — Visual examples of typography and font styles using actual system document data as specimens.

---

## `batac-dms` · `/packages/ui` · Version 1.0

> **Scope:** This document is the single authoritative reference for the `batac-dms` design system. Every color, spacing value, component decision, and state mapping here is canonical. When in doubt, consult this document before inventing a solution.

---

## 1. Brand DNA

### Signal Extraction from batac.gov.ph

The following signals were directly observed by crawling `batac.gov.ph`, `batac.gov.ph/sangguniang-panlungsod/`, and `sp.batac.gov.ph` (June 2026). Every claim below is sourced from observable content. Inferred values are labeled.

#### Colors — Observed

| Signal | Source | Notes |
|---|---|---|
| **Navy blue** (approx. `#1a2e5a` to `#0e2144`) | City seal, navigation bar background, header region | Primary brand color. Deep, authoritative blue. [Inference: derived from seal image analysis; exact hex not confirmed via CSS source] |
| **Gold / Amber** (approx. `#c9a227` to `#d4af37`) | City seal decorative ring and ornamental elements | Accent/heraldic gold. [Inference: observed from seal imagery] |
| **White `#ffffff`** | Page background, card backgrounds | Primary surface color throughout site |
| **Light gray** (approx. `#f5f5f5` to `#f8f8f8`) | Section alternating backgrounds, footer area | Secondary surface |
| **Dark charcoal `#1a1a1a` / `#222222`** | Body text, headings | Primary text color |
| **Medium gray `#666666` / `#777777`** | Secondary text, captions, dates on news cards | Muted text |
| **Link blue** (approx. `#2563eb` to `#1d4ed8`) | Text links (WordPress default adjusted) | [Inference: standard WP link color, not confirmed from CSS] |
| **Red `#dc2626`** | Emergency hotline section header | Alert/urgency color |

#### Colors — Structural Observations

- The site uses a **white-dominant** layout with navy as a strong accent in the header/nav.
- The city seal prominently features **navy + gold**, which is the heraldic brand combination.
- Emergency information uses red, consistent with government hazard conventions.
- No gradients observed in primary UI; the brand is flat and formal.

#### Typography — Observed

- **WordPress default stack observed** in body content: the rendered pages use a sans-serif system stack.
- Navigation text uses **uppercase or title-case** labels.
- Headings use a **heavier weight** (likely 700) sans-serif.
- [Inference: The site likely loads Google Fonts; Inter or a similar humanist sans is the probable choice given the visual output, but the exact import was not directly confirmed from CSS source retrieval.]
- Document numbers on sp.batac.gov.ph use a consistent format: `Ordinance No. 7SP 2025-08`, `Resolution No. 7SP 2025-72` — plaintext, no special monospace treatment on the public site.

#### Iconography — Observed

- **Emoji used as icons** throughout the public site (🏛️ 📋 🏘️ 📜 ⭐ 🗺️ 📞 👮 🔥 🛡) — this is not an icon system, it is emoji substitution.
- No formal icon library (Font Awesome, Heroicons, Lucide) was directly observed loaded on the public site.
- The official seal (`batac-seal.png`) is used consistently as the logo mark.

#### Spacing — Observed

- Content sections are separated by generous vertical padding (estimated 60–80px between sections on the landing page).
- Card grids use approximately 16–24px gutters.
- Navigation links have approximately 12–16px horizontal padding.
- [Inference: base unit appears to be 8px or 16px; exact values not confirmed from CSS.]

#### Border Radius — Observed

- News cards: minimal to no border radius (approximately 0–4px). Very square, formal.
- Buttons: low border radius (approximately 4px).
- Images in news cards: no border radius.
- The overall aesthetic is **rectilinear and formal** — not rounded.

#### Shadows — Observed

- Cards on the public site use subtle box shadows (estimated `0 2px 4px rgba(0,0,0,0.08)`).
- The header/nav appears flat with no shadow (border-bottom separation only, if any).

#### Component Patterns — Observed

- **Global nav:** horizontal top bar with logo left, nav links right, social icons; dropdown mega-menus for city/government/people sections.
- **Hero:** Full-bleed image slider with overlaid text (City Hall image, Marcos Museum image).
- **Quick-link grid:** Icon + label tiles in a 4-column grid (Sangguniang Panlungsod, Barangays, Government Services, etc.).
- **News cards:** Image top, date, title, excerpt — standard blog-card pattern in a multi-column grid.
- **Forms section:** Government forms listed by office, with emoji icon + title + CTA.
- **Calendar widget:** Small interactive calendar.
- **Footer:** 4-column footer: seal + address, The City, The Government, The People, Quick Access.
- **Emergency hotlines section:** Dark background (approx. navy or near-black), white text, phone numbers in large bold type.

#### Imagery Style — Observed

- **Photography-dominant:** Real photos of City Hall, municipal events, government officials.
- Subjects: civic infrastructure, official ceremonies, government staff.
- Mood: **institutional, documentary, community-service** — not aspirational lifestyle.
- The official seal is used as a standalone graphic element alongside photography.

### Three-Adjective Visual Tone

> **Authoritative · Civic · Grounded**

- **Authoritative:** Deep navy, formal typography, seal-led identity. Communicates state legitimacy.
- **Civic:** Warm community photography, Ilocano cultural references (empanada, bagnet), people-first content.
- **Grounded:** Flat, sans-serif, no decorative gradients. Practical and functional, not aspirational.

---

## 2. Adaptation Rationale

The public site is a **citizen-facing informational portal** with low information density and a scroll-based layout. The `batac-dms` web app is an **internal operations tool** used all day by SP Secretariat staff and LGU employees. These are fundamentally different contexts requiring different design decisions, while preserving brand identity continuity.

### Adaptation Table

| Public Site Pattern | Web App Adaptation | Rationale |
|---|---|---|
| Full-bleed hero image slider | Eliminated entirely; replaced by fixed app shell | Staff do not need marketing content; every pixel must carry data |
| Section-scroll layout | Routed views within a fixed layout (sidebar + main) | Users navigate by function, not by scrolling |
| Marketing-weight typography (display sizes 40px+) | Data-scale typography: body text dominant, headings at 20–24px max | Tables and forms are the primary content; display type wastes vertical space |
| Low information density | High information density: dense tables, multi-column stat rows | Power users process hundreds of documents; density is efficiency |
| Emoji as icons | Lucide icon set (consistent, accessible, scalable, semantic) | Emoji break screen readers, cannot be styled, and are not accessible |
| No persistent navigation | Persistent collapsible sidebar, 240px/56px toggle | Staff move between modules constantly; breadcrumbs alone are insufficient |
| No status indicators | Full semantic status badge system (17 states) | Document lifecycle tracking is the core function of the app |
| Light interactive state coverage | Full state coverage: hover, focus, active, disabled, error, loading, skeleton | Staff interact with forms and tables continuously; state clarity prevents errors |
| No status alerts | Inline alerts, SLA timers, breach warnings | SLA compliance is a legal/operational requirement |
| Navy used decoratively | Navy as primary brand color repurposed into actionable UI (primary buttons, active states, links) | Connects app to brand while putting color to work |
| Gold used in seal decoration | Gold/amber repurposed as warning/SLA-risk signal | Semantically appropriate: amber = caution/attention; connects to brand without decoration |

### Signature Design Element

The single distinctive element that connects this app to batac.gov.ph without copying its layout: **the document number monospace pill**. Every document in the system carries a number in the format `7SP 2026-001`. In the app, this number is always rendered in a dedicated monospace pill component with a left border accent in the primary brand navy — visually recalling the formal "seal and signature" identity of government documents, while being entirely functional (copy-able, filterable, searchable). Preliminary drafts use a dashed border and muted coloring; final enacted documents use the solid brand-navy border. This one component encodes document status, document identity, and brand character simultaneously.

---

## 3. Complete Token Dictionary

All tokens are defined as CSS custom properties. The `:root` block below is the single source of truth. Tailwind config and shadcn/ui theme both derive from these values.

```css
/* =========================================================
   BATAC-DMS DESIGN SYSTEM — CSS CUSTOM PROPERTIES
   /packages/ui/src/styles/tokens.css
   ========================================================= */

:root {

  /* -------------------------------------------------------
     PRIMARY — Brand navy derived from batac.gov.ph seal
     Source: City seal deep blue, government nav background
     [Inference: hex scale derived from observed ~#1a2e5a base]
     ------------------------------------------------------- */
  --color-primary-50:  #eef2f9;
  --color-primary-100: #d5e0f0;
  --color-primary-200: #adc2e3;
  --color-primary-300: #7d9fd2;
  --color-primary-400: #527cbf;
  --color-primary-500: #3560ad;
  --color-primary-600: #274d93;
  --color-primary-700: #1e3d7a;
  --color-primary-800: #162e60;
  --color-primary-900: #0e2044;
  --color-primary-950: #081229;

  /* Brand-specific aliases */
  --color-brand:          var(--color-primary-800); /* #162e60 — nav, header */
  --color-brand-hover:    var(--color-primary-900); /* #0e2044 — hover state */
  --color-brand-active:   var(--color-primary-950); /* #081229 — pressed state */
  --color-brand-subtle:   var(--color-primary-100); /* #d5e0f0 — tinted bg */
  --color-brand-muted:    var(--color-primary-200); /* #adc2e3 — borders on brand */

  /* -------------------------------------------------------
     NEUTRAL — UI chrome grays
     ------------------------------------------------------- */
  --color-neutral-50:  #f8f9fa;
  --color-neutral-100: #f1f3f5;
  --color-neutral-200: #e9ecef;
  --color-neutral-300: #dee2e6;
  --color-neutral-400: #ced4da;
  --color-neutral-500: #adb5bd;
  --color-neutral-600: #868e96;
  --color-neutral-700: #495057;
  --color-neutral-800: #343a40;
  --color-neutral-900: #212529;
  --color-neutral-950: #0d0f12;

  /* -------------------------------------------------------
     SEMANTIC — Success (green)
     Usage: Valid, Deemed Approved, approved workflow steps
     ------------------------------------------------------- */
  --color-success-100: #d1fae5;
  --color-success-500: #10b981;
  --color-success-900: #064e3b;

  /* -------------------------------------------------------
     SEMANTIC — Warning (amber)
     Usage: Pending Mayor, Panlalawigan Review, SLA at-risk,
            Valid-in-Part, Certified Urgent overlay
     Source: Brand gold (~#c9a227) shifted to functional amber
     ------------------------------------------------------- */
  --color-warning-100: #fef3c7;
  --color-warning-500: #f59e0b;
  --color-warning-900: #78350f;

  /* -------------------------------------------------------
     SEMANTIC — Danger (red)
     Usage: Vetoed, Returned, SLA breached, missing report
     ------------------------------------------------------- */
  --color-danger-100: #fee2e2;
  --color-danger-500: #ef4444;
  --color-danger-900: #7f1d1d;

  /* -------------------------------------------------------
     SEMANTIC — Info (blue)
     Usage: In Committee, Readings 1–3, In Progress states
     ------------------------------------------------------- */
  --color-info-100: #dbeafe;
  --color-info-500: #3b82f6;
  --color-info-900: #1e3a8a;

  /* -------------------------------------------------------
     SURFACES — Card and panel backgrounds
     ------------------------------------------------------- */
  --color-surface-base:    #ffffff;     /* Default page background */
  --color-surface-raised:  #f8f9fa;     /* Card, panel, sidebar backgrounds */
  --color-surface-overlay: #ffffff;     /* Modal, drawer, popover backgrounds */
  --color-surface-sunken:  #f1f3f5;     /* Table row stripe, input backgrounds */

  /* -------------------------------------------------------
     BORDERS
     ------------------------------------------------------- */
  --color-border-default: #dee2e6;  /* Standard dividers, input borders */
  --color-border-strong:  #ced4da;  /* Emphasized section borders */
  --color-border-subtle:  #e9ecef;  /* Low-contrast row separators */
  --color-border-brand:   #adc2e3;  /* Brand-tinted borders (primary-200) */

  /* -------------------------------------------------------
     TEXT
     ------------------------------------------------------- */
  --color-text-primary:   #212529;  /* Body text, table cell content */
  --color-text-secondary: #495057;  /* Subtitles, secondary labels */
  --color-text-muted:     #868e96;  /* Helper text, timestamps, placeholders */
  --color-text-inverse:   #ffffff;  /* Text on dark backgrounds (sidebar, header) */
  --color-text-disabled:  #ced4da;  /* Disabled inputs and labels */
  --color-text-link:      #1e3d7a;  /* Inline text links (primary-700) */
  --color-text-link-hover:#0e2044;  /* Link hover (primary-900) */

  /* -------------------------------------------------------
     TYPOGRAPHY
     ------------------------------------------------------- */

  /* Font families */
  --font-sans:  'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
  --font-serif: 'Lora', Georgia, serif;  /* Reserved: formal document rendering */
  --font-mono:  'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;

  /* Type scale */
  --text-xs:   0.75rem;    /* 12px — captions, micro labels */
  --text-sm:   0.875rem;   /* 14px — table cells, helper text */
  --text-base: 1rem;       /* 16px — body text */
  --text-lg:   1.125rem;   /* 18px — emphasized body, subheadings */
  --text-xl:   1.25rem;    /* 20px — section headings */
  --text-2xl:  1.5rem;     /* 24px — page headings */
  --text-3xl:  1.875rem;   /* 30px — dashboard metrics */

  /* Line heights paired to scale */
  --leading-xs:   1.333;  /* 12px → 16px */
  --leading-sm:   1.429;  /* 14px → 20px */
  --leading-base: 1.5;    /* 16px → 24px */
  --leading-lg:   1.444;  /* 18px → 26px */
  --leading-xl:   1.4;    /* 20px → 28px */
  --leading-2xl:  1.333;  /* 24px → 32px */
  --leading-3xl:  1.2;    /* 30px → 36px */

  /* Font weights */
  --font-normal:   400;
  --font-medium:   500;
  --font-semibold: 600;
  --font-bold:     700;

  /* -------------------------------------------------------
     SPACING — 4px base unit
     ------------------------------------------------------- */
  --space-0:  0px;
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-7:  28px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;

  /* Layout-specific aliases */
  --sidebar-width-expanded:  240px;
  --sidebar-width-collapsed:  56px;
  --topbar-height:            56px;
  --page-content-max:       1280px;
  --content-padding:          24px;

  /* -------------------------------------------------------
     BORDER RADIUS
     ------------------------------------------------------- */
  --radius-none: 0px;
  --radius-sm:   2px;   /* Badges, status chips — tight/formal */
  --radius-md:   4px;   /* Buttons, inputs — slightly rounded */
  --radius-lg:   8px;   /* Cards, panels — elevated surfaces */
  --radius-xl:  12px;   /* Modals, drawers */
  --radius-full: 9999px; /* Pill shapes — not used for primary UI */

  /* -------------------------------------------------------
     SHADOWS — elevation hierarchy
     ------------------------------------------------------- */
  --shadow-sm:  0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md:  0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg:  0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.06);
  --shadow-xl:  0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.05);

  /* -------------------------------------------------------
     Z-INDEX — no magic numbers
     ------------------------------------------------------- */
  --z-base:     0;
  --z-raised:   10;
  --z-sticky:   100;    /* Topbar, sidebar */
  --z-dropdown: 200;    /* Dropdowns, command palette */
  --z-modal:    300;    /* Dialogs, sheets */
  --z-toast:    400;    /* Toast notifications */

  /* -------------------------------------------------------
     TRANSITIONS
     ------------------------------------------------------- */
  --duration-fast:   100ms;
  --duration-base:   200ms;
  --duration-slow:   300ms;

  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in:      cubic-bezier(0.4, 0, 1, 1);
  --ease-out:     cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out:  cubic-bezier(0.4, 0, 0.2, 1);

  /* -------------------------------------------------------
     FOCUS RING — WCAG 2.1 AA keyboard visibility
     ------------------------------------------------------- */
  --focus-ring: 0 0 0 2px #ffffff, 0 0 0 4px var(--color-primary-600);
  --focus-ring-inset: inset 0 0 0 2px var(--color-primary-600);

}

/* Dark mode support (reserved for Phase 2 — portal) */
/* .dark { ... } */
```

---

## 4. Tailwind Config Extension

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './apps/web/src/**/*.{ts,tsx}',
    './apps/portal/src/**/*.{ts,tsx}',
    './packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand navy
        primary: {
          50:  '#eef2f9',
          100: '#d5e0f0',
          200: '#adc2e3',
          300: '#7d9fd2',
          400: '#527cbf',
          500: '#3560ad',
          600: '#274d93',
          700: '#1e3d7a',
          800: '#162e60',
          900: '#0e2044',
          950: '#081229',
          DEFAULT: '#162e60',  // primary-800 — use for buttons, active states
        },

        // Semantic colors
        success: {
          100: '#d1fae5',
          500: '#10b981',
          900: '#064e3b',
        },
        warning: {
          100: '#fef3c7',
          500: '#f59e0b',
          900: '#78350f',
        },
        danger: {
          100: '#fee2e2',
          500: '#ef4444',
          900: '#7f1d1d',
        },
        info: {
          100: '#dbeafe',
          500: '#3b82f6',
          900: '#1e3a8a',
        },

        // Surfaces
        surface: {
          base:    '#ffffff',
          raised:  '#f8f9fa',
          overlay: '#ffffff',
          sunken:  '#f1f3f5',
        },

        // Borders
        border: {
          DEFAULT: '#dee2e6',
          strong:  '#ced4da',
          subtle:  '#e9ecef',
          brand:   '#adc2e3',
        },

        // Text
        text: {
          primary:   '#212529',
          secondary: '#495057',
          muted:     '#868e96',
          inverse:   '#ffffff',
          disabled:  '#ced4da',
          link:      '#1e3d7a',
        },
      },

      fontFamily: {
        sans:  ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
        mono:  ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        xs:   ['0.75rem',   { lineHeight: '1rem' }],
        sm:   ['0.875rem',  { lineHeight: '1.25rem' }],
        base: ['1rem',      { lineHeight: '1.5rem' }],
        lg:   ['1.125rem',  { lineHeight: '1.625rem' }],
        xl:   ['1.25rem',   { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem',   { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      },

      spacing: {
        '0':  '0px',
        '1':  '4px',
        '2':  '8px',
        '3':  '12px',
        '4':  '16px',
        '5':  '20px',
        '6':  '24px',
        '7':  '28px',
        '8':  '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
        // Layout constants
        'sidebar':           '240px',
        'sidebar-collapsed': '56px',
        'topbar':            '56px',
      },

      borderRadius: {
        none: '0px',
        sm:   '2px',
        DEFAULT: '4px',
        md:   '4px',
        lg:   '8px',
        xl:   '12px',
        full: '9999px',
      },

      boxShadow: {
        sm:  '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md:  '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
        lg:  '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.06)',
        xl:  '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
      },

      zIndex: {
        base:     '0',
        raised:   '10',
        sticky:   '100',
        dropdown: '200',
        modal:    '300',
        toast:    '400',
      },

      transitionDuration: {
        fast: '100ms',
        base: '200ms',
        slow: '300ms',
      },

      transitionTimingFunction: {
        default:  'cubic-bezier(0.4, 0, 0.2, 1)',
        'in':     'cubic-bezier(0.4, 0, 1, 1)',
        out:      'cubic-bezier(0, 0, 0.2, 1)',
        'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}

export default config
```

---

## 5. shadcn/ui Theme Override

```css
/* packages/ui/src/styles/globals.css */
/* shadcn/ui HSL variable overrides for batac-dms brand */

@import './tokens.css';
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {

  :root {
    /* shadcn/ui uses HSL custom properties — map our brand tokens */

    /* Backgrounds */
    --background:       0 0% 100%;           /* surface-base: white */
    --foreground:       210 11% 15%;         /* text-primary: #212529 */

    /* Card */
    --card:             0 0% 100%;
    --card-foreground:  210 11% 15%;

    /* Popover */
    --popover:          0 0% 100%;
    --popover-foreground: 210 11% 15%;

    /* Primary — brand navy #162e60 */
    --primary:          219 62% 23%;
    --primary-foreground: 0 0% 100%;

    /* Secondary — neutral surface */
    --secondary:        210 17% 95%;         /* neutral-100 */
    --secondary-foreground: 210 11% 29%;     /* neutral-700 */

    /* Muted — subdued backgrounds */
    --muted:            210 17% 95%;         /* neutral-100 */
    --muted-foreground: 210 8% 56%;          /* neutral-500 */

    /* Accent — brand subtle tint */
    --accent:           216 43% 89%;         /* primary-100 */
    --accent-foreground: 219 62% 23%;        /* primary-800 */

    /* Destructive — danger red */
    --destructive:      0 84% 60%;           /* danger-500 */
    --destructive-foreground: 0 0% 100%;

    /* Border */
    --border:           210 18% 87%;         /* border-default: #dee2e6 */

    /* Input */
    --input:            210 18% 87%;         /* same as border */

    /* Ring — focus ring uses brand color */
    --ring:             219 62% 23%;         /* primary-800 */

    /* Border radius override — government-formal: tight rounding */
    --radius: 0.25rem;                       /* 4px = radius-md */

    /* Chart colors for dashboards */
    --chart-1: 219 62% 23%;   /* brand navy */
    --chart-2: 38 92% 50%;    /* warning amber */
    --chart-3: 160 84% 39%;   /* success green */
    --chart-4: 217 91% 60%;   /* info blue */
    --chart-5: 0 84% 60%;     /* danger red */
  }

  /* Global resets and base styles */

  * {
    border-color: hsl(var(--border));
  }

  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: var(--font-sans);
    font-size: var(--text-sm);       /* 14px default — data-density default */
    line-height: var(--leading-sm);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Focus ring — WCAG 2.1 AA visible keyboard focus */
  :focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }

  /* Reduced motion compliance */
  @media (prefers-reduced-motion: reduce) {
    *,
    ::before,
    ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* Minimum touch target enforcement */
  button,
  [role="button"],
  input[type="checkbox"],
  input[type="radio"],
  select,
  a {
    min-height: 44px;
    min-width: 44px;
  }

  /* Exception: allow inline/badge elements to break the 44px rule */
  .touch-exempt {
    min-height: unset;
    min-width: unset;
  }

  /* Monospace document number baseline */
  .font-doc-number {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: 0.05em;
    font-weight: var(--font-medium);
  }
}
```

---

## 6. Component Usage Guidelines

### 6.1 Layout & Shell

#### App Shell

**When to use:** Always. The app shell is the persistent frame for all authenticated views in `/apps/web`. It is never used for the public portal.

**Structure:**
- Fixed left sidebar (`position: fixed; top: 0; left: 0; height: 100vh`) at `--sidebar-width-expanded` (240px) or `--sidebar-width-collapsed` (56px) in icon-only mode.
- Fixed topbar (`position: fixed; top: 0; left: sidebar-width; right: 0; height: --topbar-height`).
- Scrollable main content area (`overflow-y: auto; padding: --content-padding`).

**Tailwind classes (expanded state):**
```
Sidebar:   w-60 fixed left-0 top-0 h-screen bg-primary-950 flex flex-col z-sticky
Topbar:    fixed top-0 left-60 right-0 h-14 bg-white border-b border-border z-sticky
Main:      ml-60 mt-14 min-h-screen bg-surface-raised
```

**Collapsed sidebar:** `w-14` with `overflow-hidden`. Labels hidden via `hidden` class on span.

---

#### Sidebar Nav Item

**States and classes:**

| State | Classes |
|---|---|
| Default | `flex items-center gap-3 px-3 py-2 rounded-md text-sm text-primary-200 hover:bg-primary-800 hover:text-white transition-colors duration-fast cursor-pointer` |
| Active | `flex items-center gap-3 px-3 py-2 rounded-md text-sm bg-primary-700 text-white font-semibold border-l-2 border-warning-500` |
| Focus | Add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-500` |
| Disabled | `opacity-40 cursor-not-allowed pointer-events-none` |

**Badge variant (unread count):**
```jsx
<span className="ml-auto text-xs font-medium bg-danger-500 text-white rounded-full px-1.5 py-0.5 touch-exempt min-h-0 min-w-0">
  {count}
</span>
```

---

#### Topbar

**Structure (left → right):**
1. Breadcrumb (left-aligned, `flex-1`)
2. Page title (optional — only when no page header below)
3. Action slot: notification bell + user avatar menu

**Tailwind:**
```
className="fixed top-0 left-60 right-0 h-14 bg-white border-b border-border-default flex items-center px-6 gap-4 z-sticky"
```

---

#### Page Header

**When to use:** Top of every routed view inside main. Below the topbar.

**Structure:** `mb-6 pb-4 border-b border-border-default` containing:
- `h1` with `text-2xl font-bold text-text-primary`
- Optional subtitle: `text-sm text-text-secondary mt-1`
- Right slot: primary CTA button + optional secondary

**When NOT to use:** Inside modal or sheet panels (use panel header instead).

---

### 6.2 Navigation

#### Breadcrumb

**Format:** `Home / Module / Current Page`

**Separator:** `/` (literal slash character, not an icon)

**Classes:**
- Container: `flex items-center gap-1 text-sm text-text-muted`
- Link segment: `hover:text-text-primary transition-colors duration-fast`
- Current page: `text-text-primary font-medium pointer-events-none`
- Separator: `text-text-disabled mx-1`

**Truncation:** On overflow, truncate middle segments with `…`. Always show first and last segments.

---

#### Tabs

**When to use:** Sub-navigation within a document detail view (Overview / Workflow / History / Attachments). Maximum 6 tabs.

**When NOT to use:** As top-level page navigation — use sidebar nav instead. Do not use tabs for filtering table content; use a filter toolbar instead.

**Classes (active tab):** `border-b-2 border-primary-800 text-primary-800 font-semibold`
**Classes (inactive):** `text-text-secondary hover:text-text-primary border-b-2 border-transparent`

---

#### Command Palette

**Trigger:** `⌘K` (Mac) / `Ctrl+K` (Windows). Also accessible via search icon in topbar.

**When to use:** Quick navigation to any view, search for documents by number or title.

**When NOT to use:** As a replacement for the main table search/filter. Command palette is for navigation, not data filtering.

**Overlay:** `fixed inset-0 bg-black/50 z-modal flex items-start justify-center pt-20`
**Panel:** `bg-white rounded-lg shadow-xl w-full max-w-xl`

---

### 6.3 Data Display

#### Data Table

**When to use:** All list/queue views — documents, sessions, complaints, committees.

**When NOT to use:** For fewer than 3 rows that are better shown as a card list; for a simple two-column property/value display (use a Description List instead).

**Row density:**
- Default: `py-3 px-4` per cell
- Dense mode (toggle): `py-1.5 px-4` per cell

**Key Tailwind patterns:**
```
Table wrapper:  overflow-hidden rounded-lg border border-border-default shadow-sm
Header row:     bg-neutral-50 text-xs text-text-muted font-semibold uppercase tracking-wide
Body row:       bg-white hover:bg-primary-50 transition-colors duration-fast border-b border-border-subtle
Selected row:   bg-primary-50 border-l-2 border-primary-700
```

**Sorted column header:** `text-text-primary font-semibold` + chevron icon (`↑` or `↓` via Lucide `ChevronUp`/`ChevronDown`).

---

#### Document Number Badge

**The signature component of this design system.** See Adaptation Rationale.

**Format examples:** `7SP 2026-001` (ordinance), `SPR 2026-38` (resolution), `Draft 7SP 2026-02` (preliminary)

| Variant | Classes |
|---|---|
| Final (enacted) | `inline-flex items-center px-2 py-0.5 font-mono text-xs font-medium bg-primary-50 text-primary-800 border border-primary-300 border-l-2 border-l-primary-800 rounded-sm` |
| Preliminary (draft) | `inline-flex items-center px-2 py-0.5 font-mono text-xs font-medium bg-neutral-50 text-text-secondary border border-dashed border-neutral-400 rounded-sm italic` |

**Rules:**
- Always rendered in `--font-mono`. No exceptions.
- Never truncated. If space is tight, wrap the containing cell.
- In tables, this occupies its own fixed-width column.

---

#### Status Badge

**When to use:** Every document, workflow step, and complaint row must show a status badge.

**When NOT to use:** Do not combine two status badges on one item (e.g., `DRAFT` + `ARCHIVED`). A document has one active state.

**Base classes:** `inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium touch-exempt`

Full state table is in Section 7. Abbreviated examples:

| State | Background | Text | Border-left |
|---|---|---|---|
| DRAFT | `bg-neutral-100` | `text-neutral-700` | `border-l-2 border-neutral-500` |
| IN_COMMITTEE | `bg-info-100` | `text-info-900` | `border-l-2 border-info-500` |
| PENDING_MAYOR | `bg-warning-100` | `text-warning-900` | `border-l-2 border-warning-500` |
| VALID | `bg-success-100` | `text-success-900` | `border-l-2 border-success-500` |
| VETOED | `bg-danger-100` | `text-danger-900` | `border-l-2 border-danger-500` |

---

#### Workflow Step Indicator

**When to use:** Document detail view — shows current legislative position across the multi-step workflow.

**Orientation:** Horizontal for screens ≥768px; vertical for mobile.

**States per step:**
- Completed: `bg-success-500 text-white` ring
- Active (current): `bg-primary-800 text-white` ring + `font-semibold` label
- Pending: `bg-neutral-200 text-neutral-500` ring
- Skipped: `bg-neutral-100 text-neutral-400` ring with dashed border
- Error: `bg-danger-500 text-white` ring

**Connector line:** `h-0.5 flex-1 bg-neutral-200` (completed segments: `bg-success-500`)

---

#### SLA Timer

**When to use:** Any document in a time-constrained state: `PENDING_MAYOR` (10-day clock), `PANLALAWIGAN_REVIEW` (30-day clock).

**When NOT to use:** On completed, vetoed, or archived documents.

| State | Condition | Classes |
|---|---|---|
| On Track | <80% elapsed | `text-success-500 bg-success-100` bar fill |
| At Risk | ≥80% elapsed | `text-warning-500 bg-warning-100` bar fill + pulsing dot |
| Breached | 100%+ elapsed | `text-danger-500 bg-danger-100` bar fill + `animate-pulse` |

**Structure:** Timer label + progress bar + remaining/elapsed count text.

**ARIA:** `role="timer"` + `aria-label="SLA: X days remaining"` + `aria-live="polite"` for updates.

---

#### Routing History Timeline

**When to use:** Document detail view History tab; QR scan result view.

**Structure (each entry):** Left column: vertical connecting line + dot indicator. Right column: actor name + action + office + timestamp.

**Dot colors:** Match action type — `Transmitted` → info, `Approved` → success, `Returned` → danger, `Filed` → neutral.

**Timestamp:** `text-xs text-text-muted font-mono` (monospace for alignment).

---

#### Stat Card

**When to use:** Dashboard stat row — top-level metrics visible at a glance.

**Compact variant:** For the 4-up stats row, `min-w-0` with tight padding.

**Classes:**
```
Card:    bg-white rounded-lg border border-border-default shadow-sm p-4
Metric:  text-3xl font-bold text-text-primary
Label:   text-xs text-text-muted uppercase tracking-wide
Trend:   text-xs text-success-500 (positive) / text-danger-500 (negative) font-medium
```

---

#### Empty State

**When to use:** Empty table results, empty queue, no complaints for a period.

**Structure:** Centered illustration slot (Lucide icon at 48px, `text-neutral-300`) + `text-lg font-semibold text-text-secondary` heading + `text-sm text-text-muted` body + optional action button.

**Do not:** Use apologetic copy ("Sorry, nothing here"). Use directive copy: "No documents in queue" + "Upload a document to get started."

---

#### Scan Quality Indicator

**When to use:** Post-upload document processing, file attachment list.

**Levels:** Excellent (≥95%), Good (80–94%), Fair (60–79%), Poor (<60%)

**Classes per level:**
- Excellent: `text-success-500`
- Good: `text-info-500`
- Fair: `text-warning-500`
- Poor: `text-danger-500`

---

### 6.4 Forms & Inputs

#### Input

**Base classes:** `flex h-10 w-full rounded-md border border-border-default bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-text-disabled`

**Error state:** Add `border-danger-500 focus-visible:ring-danger-500`

**Required marker:** Red asterisk `*` in label — `text-danger-500 ml-0.5` — not inside the input.

---

#### Textarea

Same as Input + `resize-y min-h-24`. Character count: right-aligned `text-xs text-text-muted` below the field.

---

#### Select / Combobox

Searchable via shadcn `Command` inside a `Popover`. Matches Input height and border styling.

**When to use:** Office selector, document type selector, committee selector, councilor/sponsor selector.

**When NOT to use:** For <4 options — use radio buttons or a button group instead.

---

#### Date Picker

**Locale:** Asia/Manila. Week starts Monday. Philippine holidays should be fetchable from a future API but are not required in Phase 1.

**Format:** `DD MMMM YYYY` (e.g., `18 June 2026`) in display; ISO 8601 internally.

---

#### File Upload

**Zone:** Dashed border, `border-dashed border-2 border-border-default rounded-lg p-8 text-center`. On drag-over: `border-primary-500 bg-primary-50`.

**File list:** Each uploaded file shows: filename, format badge (`.PDF`, `.DOCX`, etc. as neutral chip), file size, scan quality indicator (post-processing), remove button.

**Limits:** PDF, DOCX, XLSX, PNG, JPG. 25MB per file. Show `text-danger-500` error message on size/type violation.

---

#### Multi-Select Combobox

Same as Combobox but allows multiple selections. Shows selected count as `bg-primary-100 text-primary-800` badge in the trigger button.

---

#### Form Section

**Structure:**
```
<section className="space-y-4">
  <div className="border-b border-border-subtle pb-2 mb-4">
    <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
    <p className="text-xs text-text-muted">{description}</p>
  </div>
  {/* fields */}
</section>
```

---

#### Inline Edit

**Trigger:** Click on a `text-sm text-text-primary` value renders an Input in its place. On blur/Enter: save. On Escape: discard.

**Use for:** Routing notes, action remarks in the Secretariat workflow log.

---

### 6.5 Feedback & Overlays

#### Toast (Sonner)

**Variants:** `success` (`bg-success-100 border-success-500`), `error` (`bg-danger-100 border-danger-500`), `warning` (`bg-warning-100 border-warning-500`), `info` (`bg-info-100 border-info-500`).

**Position:** Bottom-right (`bottom-4 right-4`). Duration: 5s auto-dismiss.

**ARIA:** `role="status"` and `aria-live="polite"` for success/info; `role="alert"` and `aria-live="assertive"` for error/warning.

---

#### Alert

**When to use:** Persistent inline warnings that need to remain visible — SLA breach, missing committee report.

**When NOT to use:** For transient confirmations — use Toast instead.

```
Base:    flex items-start gap-3 rounded-md px-4 py-3 text-sm border-l-4
Danger:  bg-danger-100 border-danger-500 text-danger-900
Warning: bg-warning-100 border-warning-500 text-warning-900
Info:    bg-info-100 border-info-500 text-info-900
```

---

#### Dialog / Modal

**Destructive confirmation:** Always requires user to type or check before confirming. Confirm button is `destructive` variant (red). Cancel is always available.

**Mandatory comment variant:** Used for SP Secretary override and manual workflow advance. Comment textarea required before submit button enables.

---

#### Sheet / Drawer

**Position:** Right side (`right-0`). Width: `w-96` (384px) minimum; `w-[480px]` for document preview.

**When to use:** Document detail preview without leaving list view; routing details.

**When NOT to use:** For primary content that requires persistent navigation — use a routed view instead.

---

#### Tooltip

**Required on:** All icon-only buttons (`aria-label` + visual tooltip). All truncated text.

**Delay:** 500ms show delay to prevent tooltip flicker on cursor movement.

---

#### Skeleton

**When to use:** Table rows during initial load, stat card values during fetch, document thumbnail loading.

**Classes:** `animate-pulse bg-neutral-200 rounded`

**Match dimensions:** Skeleton widths must approximate real content width (e.g., status badge skeleton: `w-20 h-5`).

---

### 6.6 Specialized Components

#### QR Code Display

**When to use:** Document detail view, cover sheet print layout.

**Print-optimized variant:** Higher contrast, no shadow, minimum 200×200px printed size.

**Contains:** QR image + document number (monospace, below) + document title (small, below number).

**ARIA:** `role="img"` + `aria-label="QR code for document {number}"`.

---

#### Document Preview Card

**Contents:** First-page thumbnail (gray placeholder if not rendered) + Document Number Badge + title (2-line truncate) + Status Badge + last action timestamp.

**Classes:**
```
Card:       bg-white rounded-lg border border-border-default shadow-sm hover:shadow-md transition-shadow p-3 cursor-pointer
Thumbnail:  w-full aspect-[3/4] bg-neutral-100 rounded object-cover mb-3
```

---

#### Order of Business Row

**Contents (left to right):** Agenda number (monospace) · Document Number Badge · Title (truncated, flex-1) · Committee referral chips · Report status chip · Red-flag icon (if missing report).

**Red flag:** `text-danger-500` Lucide `Flag` icon with `aria-label="Missing committee report"`. Row background: `bg-danger-50`.

**Certified Urgent:** Gold `bg-warning-100 text-warning-900` chip: `CERTIFIED URGENT` prepended to document number column.

---

#### Committee Referral Block

**Each committee entry:** Committee name · Status (`SUBMITTED` in success-100, `PENDING` in warning-100, `ABSENT/NOT HEARD` in neutral-100) · Submitted-by (if applicable) · Submission timestamp.

---

#### Avatar + Name

**Structure:** `Avatar` (shadcn) + name in `text-sm font-medium` + role in `text-xs text-text-muted`.

**Sizes:** `h-6 w-6` (table cell), `h-8 w-8` (inline in timeline), `h-10 w-10` (header/card).

---

## 7. State Color Map

All hex values resolve from the token system defined in Section 3.

| State | Token Category | Background | Text | Left-border | Notes |
|---|---|---|---|---|---|
| `DRAFT` | neutral | `#f1f3f5` (neutral-100) | `#495057` (neutral-700) | `#868e96` (neutral-500) | Default starting state |
| `IN_COMMITTEE` | info | `#dbeafe` (info-100) | `#1e3a8a` (info-900) | `#3b82f6` (info-500) | Active committee deliberation |
| `FIRST_READING` | info | `#dbeafe` | `#1e3a8a` | `#3b82f6` | Same as In Committee, label distinguishes |
| `SECOND_READING` | info | `#dbeafe` | `#1e3a8a` | `#3b82f6` | Same |
| `THIRD_READING` | info | `#dbeafe` | `#1e3a8a` | `#3b82f6` | Same |
| `PENDING_MAYOR` | warning | `#fef3c7` (warning-100) | `#78350f` (warning-900) | `#f59e0b` (warning-500) | SLA clock active |
| `LAPSED` | neutral | `#f1f3f5` | `#495057 italic` | `#ced4da` (neutral-400) | Lapsed into law; not a failure |
| `VETOED` | danger | `#fee2e2` (danger-100) | `#7f1d1d` (danger-900) | `#ef4444` (danger-500) | Requires legislative action |
| `OVERRIDE_PENDING` | warning | `#fef3c7` | `#78350f` | `#f59e0b` | Override vote pending |
| `PANLALAWIGAN_REVIEW` | warning | `#fef3c7` | `#78350f` | `#f59e0b` | 30-day clock active |
| `VALID` | success | `#d1fae5` (success-100) | `#064e3b` (success-900) | `#10b981` (success-500) | Fully enacted |
| `VALID_IN_PART` | warning | `#fef3c7` | `#78350f` | `#f59e0b` | Partially approved |
| `RETURNED` | danger | `#fee2e2` | `#7f1d1d` | `#ef4444` | Returned with objections |
| `DEEMED_APPROVED` | success (muted) | `#d1fae5` | `#064e3b` | `#6ee7b7` (success-300) | Dashed border variant, italic label |
| `ARCHIVED` | neutral | `#f1f3f5` | `#868e96` | `#ced4da` | Read-only historical record |
| `CANCELLED` | neutral (strikethrough) | `#f1f3f5` | `#868e96 line-through` | `#ced4da` | Withdrawn/cancelled |
| `PENDING_HEARING` (complaint) | warning | `#fef3c7` | `#78350f` | `#f59e0b` | Complaint awaiting schedule |
| `DISMISSED` (complaint) | neutral | `#f1f3f5` | `#495057` | `#868e96` | Complaint dismissed |
| `RESOLVED` (complaint) | success | `#d1fae5` | `#064e3b` | `#10b981` | Complaint resolved |
| `CERTIFIED_URGENT` | warning overlay | `#fef3c7` | `#78350f` | — | Tag overlay, not standalone state |
| `SLA_AT_RISK` | warning | `#fef3c7` | `#78350f` | `#f59e0b` | >80% SLA elapsed |
| `SLA_BREACHED` | danger | `#fee2e2` | `#7f1d1d` | `#ef4444` | SLA window exceeded |
| `MISSING_REPORT` | danger flag | `#fee2e2` row bg | `#7f1d1d` | `#ef4444` | Red-flag on Order of Business row |
| Doc: `PRELIMINARY` | neutral (dashed) | `#f8f9fa` | `#495057 italic` | — | Dashed border-1 `#ced4da` |
| Doc: `FINAL` | brand | `#eef2f9` (primary-50) | `#162e60` (primary-800) | 2px solid `#162e60` | Solid left border |

---

## 8. Do / Don't Rules

### Rule 1 — Document Numbers
**Do:** Always render document numbers in `font-mono` (JetBrains Mono or system monospace). In every table, list, badge, and detail view.

**Don't:** Use proportional (sans-serif) font for document numbers. `7SP 2026-001` and `SPR 2026-38` must be instantly distinguishable in a dense table.

---

### Rule 2 — Color for Status
**Do:** Use the exact token colors from Section 7 for every status badge. Use the left-border accent pattern to provide a redundant non-color signal.

**Don't:** Invent a new color for a status not in Section 7. If a new state is needed, update Section 7 first.

---

### Rule 3 — Sidebar Color
**Do:** Keep the sidebar on `primary-950` (`#081229`) background with `primary-200` and white text. This is the strongest brand signal in the app.

**Don't:** Lighten the sidebar to match the content area. The contrast between dark sidebar and light main is the primary structural hierarchy.

---

### Rule 4 — Typography Scale
**Do:** Use `text-sm` (14px) as the default for all table cells, form labels, and body content. The app is data-dense — space is at a premium.

**Don't:** Use `text-base` (16px) for table content. Do not use display sizes (`text-2xl`+) anywhere except page headings and dashboard metrics.

---

### Rule 5 — Icon-Only Buttons
**Do:** Include `aria-label` on every icon-only button (`<Button aria-label="Download PDF">`). Include a `Tooltip` component visually.

**Don't:** Render action buttons with only an icon and no accessible label. This breaks screen readers and fails WCAG 2.1 AA.

---

### Rule 6 — SLA Timers
**Do:** Show SLA timers only on documents in time-constrained states (`PENDING_MAYOR`, `PANLALAWIGAN_REVIEW`, `OVERRIDE_PENDING`). Transition through on-track → at-risk → breached states visually.

**Don't:** Show SLA timers on `VALID`, `ARCHIVED`, `CANCELLED`, or `DRAFT` documents. A completed or inactive document has no running clock.

---

### Rule 7 — Decorative Color
**Do:** Reserve color for semantic signals: brand identity (navy sidebar), workflow states (semantic palette), urgency (danger red). Every use of color should mean something.

**Don't:** Add color to decorate sections, headings, or section dividers. Do not use gradients. Do not use accent colors for visual interest alone.

---

### Rule 8 — Form Tags
**Do:** Use `onClick`/`onChange` React handlers for all form interactions. Use `<div>` or `<section>` as form containers.

**Don't:** Use `<form>` HTML elements. This is a non-negotiable constraint from the platform architecture. See project README.

---

### Rule 9 — Empty States
**Do:** Write directive copy for every empty state: what is empty, and what action creates content. Example: "No resolutions in queue — upload a new resolution to begin workflow."

**Don't:** Use lorem ipsum, generic "Nothing here yet," or decorative illustrations unrelated to the content type. Empty states are functional moments.

---

### Rule 10 — Focus Rings
**Do:** Keep the focus ring visible at all times for keyboard users. The standard ring is `outline: 2px solid #274d93; outline-offset: 2px`.

**Don't:** Apply `outline: none` to any interactive element without providing a custom CSS focus replacement of equal or greater visibility. This is a WCAG 2.1 AA requirement.

---

### Rule 11 — Touch Targets
**Do:** Maintain 44×44px minimum touch targets for all interactive elements (buttons, links, checkboxes, selects).

**Don't:** Use the `.touch-exempt` class on primary interactive elements. It is reserved for inline decorative chips (status badges, doc number badges) that are not themselves actionable.

---

### Rule 12 — Monospace for Codes
**Do:** Use `font-mono` for all reference codes: document numbers, QR tracking IDs, timestamps in routing history, session numbers, case numbers.

**Don't:** Mix font families within a reference code. A document number is always 100% monospace, never split across font families.

---

## 9. Typography Specimen

The specimens below show each text style with the actual content it will carry in the app.

---

### Display / Page Heading — `text-2xl font-bold text-text-primary`
> **SP Secretary Dashboard**

### Section Heading — `text-xl font-semibold text-text-primary`
> **Order of Business — Regular Session, 17 June 2026**

### Subsection Heading — `text-lg font-semibold text-text-primary`
> **Committee Referrals**

### Body Text — `text-base text-text-primary`
> An Ordinance Providing for the Comprehensive Solid Waste Management Program of the City of Batac, Ilocos Norte, Appropriating Funds Therefor, and for Other Purposes.

### Body Small — `text-sm text-text-primary` (default app body)
> Transmitted to the Office of the City Mayor on 12 June 2026 at 2:34 PM. Reviewed and signed by Atty. Windell D. Chua, City Vice Mayor.

### Secondary / Helper Text — `text-sm text-text-secondary`
> Required fields are marked with an asterisk (*). All entries are logged and cannot be deleted after submission.

### Muted / Caption — `text-xs text-text-muted`
> Last updated: 18 June 2026 · 09:15 AM · by Secretariat Staff

### Table Cell — `text-sm text-text-primary`
> An Ordinance Enacting the Zoning Regulation of the City of Batac

### Document Number (Monospace, Final) — `font-mono text-xs font-medium`
> `7SP 2026-001`

### Document Number (Monospace, Preliminary) — `font-mono text-xs font-medium italic text-text-secondary`
> `Draft 7SP 2026-002`

### Resolution Number — `font-mono text-xs font-medium`
> `SPR 2026-038`

### Timestamp (Monospace) — `font-mono text-xs text-text-muted`
> `2026-06-18 09:15:32`

### Dashboard Metric — `text-3xl font-bold text-text-primary`
> **14**

### Dashboard Metric Label — `text-xs font-semibold uppercase tracking-wide text-text-muted`
> PENDING IN QUEUE

### Error Message — `text-xs text-danger-500 font-medium`
> This field is required. Please enter a document title.

### Navigation Label — `text-sm font-medium text-primary-200` (sidebar) / `text-sm font-medium text-text-primary` (topbar)
> Documents · Workflow Queue · Sessions

### Button Label — `text-sm font-semibold`
> Advance to Next Step · Save Draft · Cancel

### Alert Message — `text-sm text-warning-900` / `text-sm text-danger-900`
> **SLA at risk:** Resolution 7SP 2026-001 has 2 days remaining before the Mayor's review deadline lapses.

### Breadcrumb — `text-sm text-text-muted`
> Home / Documents / Resolutions / 7SP 2026-001

---

*End of DESIGN.md — Version 1.0 · batac-dms · Batac City LGU Platform*
