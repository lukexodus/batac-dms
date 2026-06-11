# Batac City LGU Platform - Design System

This design system translates the official branding of Batac City, Ilocos Norte into a modern, accessible, and high-density digital product interface suitable for complex government operations.

## 1. Core Brand Colors
The brand palette is derived from the extracted colors from the provided Batac City prototype screenshots.

*   **Primary (Batac Green):** `#10A63F` (HSL: 139, 82.4%, 35.7%) - Used for primary actions, active states, and dominant branding elements.
*   **Secondary (Batac Blue):** `#286DF7` (HSL: 220, 93%, 56%) - Used for secondary highlights, accents, and contrasting elements.
*   **Destructive (Batac Red):** `#F70000` (HSL: 0, 100%, 48.4%) - Used for destructive actions, critical errors, and rejections.
*   **Background (Slate 50):** `#F8FAFC` (HSL: 210, 40%, 98%) - Used for application backgrounds to provide a soft contrast against content cards.

## 2. UI / System Tokens (Tailwind / Shadcn Approach)
We map the core brand colors into a semantic token system to ensure contrast and readability in high-density applications.

*   `--background`: `0 0% 100%` (White)
*   `--foreground`: `222.2 84% 4.9%` (Near Black)
*   `--primary`: `139 82.4% 35.7%` (Batac Green)
*   `--primary-foreground`: `210 40% 98%`
*   `--secondary`: `220 93% 56%` (Batac Blue)
*   `--secondary-foreground`: `222.2 47.4% 11.2%`
*   `--destructive`: `0 100% 48.4%` (Batac Red)
*   `--muted`: `210 40% 96.1%` (Slate 50 for inactive backgrounds)
*   `--border`: `214.3 31.8% 91.4%`
*   `--radius`: `0.5rem`

## 3. Typography
A clean, modern sans-serif stack optimized for data density and readability.

*   **Font Family:** Inter, System-UI, sans-serif
*   **Display/Headings:** Tight tracking (`-tracking-tight`), semi-bold to bold weight.
*   **Body:** Regular weight, generous line-height (`leading-relaxed`) for paragraphs, tighter for data tables.
*   **Numerics:** Tabular numerals (`tabular-nums`) are mandatory in data tables, tracking IDs, and financial figures.

## 4. Components & Posture
*   **Cards:** 1px subtle border, no heavy drop shadows (`shadow-sm` only). Sharp or slightly rounded corners (`rounded-lg`).
*   **Buttons:** Solid primary for main actions. Outline or ghost for secondary actions.
*   **Data Tables:** Clean, striped or separated by 1px borders. High density, using badges for status columns.
*   **Badges:** Used extensively for Document Status (e.g., Pending, Approved, Rejected, Overdue).
*   **Forms:** Labels above inputs. Clear focus rings (using the Primary Batac Blue) to ensure accessibility.

## 5. Layout Patterns
*   **Dashboards:** Top navigation or sidebar + top bar, followed by a grid of KPI cards, and then primary data tables or lists.
*   **Document Tracking (DTS):** Vertical timelines with clear iconography for states (Check for approved, Clock for pending).
*   **Split Panes:** For review interfaces (WMS), a left pane (document viewer placeholder) and a right pane (action panel/metadata).
