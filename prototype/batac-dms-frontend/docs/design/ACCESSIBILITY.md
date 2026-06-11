# Batac City LGU Platform — Accessibility (A11y) Standards

**Version:** 0.1 · **Status:** Reference Documentation  
**Compliance Target:** WCAG 2.1 AA Minimum

---

## 1. Governance and Sizing Standards

Local government platforms serve a diverse range of staff members and citizens. Accessibility is a legal and design mandate. Every component must meet the visual, motor, and cognitive readability requirements.

### Key Rules:
* **Color Contrast**: Text and interactive elements must maintain a minimum contrast ratio of **4.5:1** against their background. Large text (18px+ or bold 14px+) must maintain at least **3:1**.
* **Text Resizing**: Layouts must remain fully functional and readable without text clipping when zoomed up to **200%**.
* **Visual Duplicity**: Color must never be the sole indicator of status or severity. A red status dot must always be accompanied by descriptive text (e.g., "Status: Overdue").

---

## 2. Implemented A11y Features in Code

### A. Visible Focus Indicator
Interactive elements use a high-visibility ring to aid keyboard-only navigation.
* **Class definition** in [index.css](file:///home/lukexodus/projects/batac-dms/prototype/prototype/src/index.css):
  ```css
  .brand-ring:focus {
    outline: 2px solid #00A651;
    outline-offset: 2px;
  }
  ```
* Applied to all buttons, inputs, and clickable items inside [App.jsx](file:///home/lukexodus/projects/batac-dms/prototype/prototype/src/App.jsx).

### B. Form Labels and Inputs
* **Explicit Labels**: Labels reside above inputs. Placeholders are never used to replace labels since they disappear during data entry, creating cognitive barriers.
* **Required Indicator**: Required fields display a red asterisk (`*`) which is announced to screen readers.
* **Disabled States**: Disabled buttons apply `opacity-50` and the `cursor-not-allowed` property, visually signaling inoperability.

### C. Semantic Document Structure
Landmarks are utilized across all layout layers:
* `<nav class="flex-1...>` is used for the main sidebar navigation.
* `<main class="flex-1...>` is reserved for the primary page content, allowing screen reader users to skip navigation menus.
* Heading structure is strictly hierarchical: `h1` represents page titles, `h2` represents section titles, and `h3` represents card headers.

---

## 3. Screen Reader Optimization

### A. Monospace Tracking Codes
Monospace codes like `DTS-2026-000089` are difficult for screen readers to pronounce when read as single words.
* **Standard**: Implement an `aria-label` spelling out characters (e.g., `aria-label="D T S 2 0 2 6 0 0 0 0 8 9"`).
* **Code Example**:
  ```jsx
  <span className="font-mono text-xs font-semibold" aria-label={`D-T-S-${doc.id.split('-').slice(1).join('-')}`}>
    {doc.id}
  </span>
  ```

### B. Status Badges & Dots
The indicator dot inside `StatusBadge` is hidden from screen readers to prevent redundant readings, while the text provides the clear status.
```jsx
<span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} aria-hidden="true" />
  <span className="sr-only">Status: </span>{status}
</span>
```
* The `sr-only` class (Screen Reader Only) prepends the context "Status: " before voicing the status itself.

### C. Seal & QR Codes Descriptions
* **City Seal**: Programmed with `role="img"` and `aria-label="Official Seal of the City of Batac"`.
* **QR Visualizer**: Programmed with `role="img"` and `aria-label="QR Code link for routing tracker details"`.

---

## 4. Keyboard Navigation Matrix

Keyboard navigation is mandatory for all user interactions.

| Component | Key | Action |
|---|---|---|
| **Global Layout** | `Tab` | Move focus to next interactive element |
| **Global Layout** | `Shift + Tab` | Move focus to previous interactive element |
| **Sidebar Menu** | `Enter` / `Space` | Select and route to page |
| **Data Tables** | `Tab` | Navigate through sorting headers and row action buttons |
| **Modal / Dialogs** | `Escape` | Dismiss modal / close slide-out panels |
| **Forms** | `Enter` | Submit form when focused on an input |

---

## 5. Audit & Test Checklist

1. **Verify Focus Visibility**: Tab through the entire page. Ensure that focus is never trapped and that every active element has a distinct green ring.
2. **Text Contrast Check**: Inspect status labels. Ensure contrast ratios remain above 4.5:1 (e.g., verify that `#15803D` text on `#DCFCE7` background conforms).
3. **Screen Reader Walkthrough**: Run NVDA, VoiceOver, or Chrome Vox. Traverse the dashboard and verify that document tracking lists and status badges announce their contents logically.
