# Batac City LGU Platform — Component Guidelines

**Version:** 0.1 · **Status:** Developer & Designer Reference  
**Base Repository Component Path:** [src/App.jsx](file:///home/lukexodus/projects/batac-dms/prototype/prototype/src/App.jsx)

---

## 1. Button Component (`Btn`)

The `Btn` component handles all button triggers. It supports preset variants, size scaling, and inline icons.

### Code Pattern:
```jsx
const Btn = ({ children, variant = "primary", size = "md", icon: Icon, onClick, disabled, className = "" }) => { ... }
```

### Properties:
* **`variant`**:
  * `primary` (default): Brand primary green (`#00A651`) with dark hover (`#0D3D20`).
  * `secondary`: White background with gray outline.
  * `danger`: Solid red (`#DC2626`) for destructive workflow states.
  * `warning`: Solid amber (`#F59E0B`) for revisions or delays.
  * `ghost`: Transparent with gray hover.
  * `outline`: Transparent with border color matching current text color.
* **`size`**:
  * `xs`: 12px text, 4px/8px padding. Used in tight tables.
  * `sm`: 12px text, 6px/12px padding. Used in sidebars or cards.
  * `md` (default): 14px text, 8px/16px padding. Standard action button.
  * `lg`: 14px text, 10px/20px padding. Hero actions or primary submission buttons.
* **`icon`**: Accepts a Lucide icon element (e.g., `icon={Download}`). Sized dynamically.

### Interaction Rules:
1. **Destructive Actions**: Rejecting a document or deleting a record must use the `danger` variant and trigger a verification modal or require a text comment.
2. **Disabled State**: Apply `disabled={true}` during API fetches or form submissions. The button opacity is automatically lowered and displays a `not-allowed` cursor.

---

## 2. Badges and Tags

### A. StatusBadge
Indicates document routing states, legislative readings, or audit history.

* **Code Pattern**: `<StatusBadge status="Pending Approval" />`
* **Styling Matrix**:
  - `Approved` / `Released` / `Completed`: Green Pill + Green Dot.
  - `In Workflow` / `VP Certification`: Blue Pill + Blue Dot.
  - `Pending Approval`: Amber Pill + Amber Dot.
  - `In Committee`: Purple Pill + Purple Dot.
  - `For 1st Reading` / `For 2nd Reading`: Violet Pill + Violet Dot.
  - `3rd Reading`: Indigo Pill + Indigo Dot.
  - `Rejected`: Red Pill + Red Dot.
  - `Draft`: Gray Pill + Gray Dot.
  - `Archived`: Dark Gray Pill + Muted Dot.

### B. ClassificationBadge
Mandatory security flag that must be rendered next to any document file title or metadata table.

* **Code Pattern**: `<ClassificationBadge level="Confidential" />`
* **Configurations**:
  - `Public`: Green pill + `Globe` icon. (Authorized for public portal search).
  - `Internal`: Blue pill + `Building` icon. (LGU network users only).
  - `Confidential`: Amber pill + `Shield` icon. (Authorized roles only).
  - `Restricted`: Red pill + `Lock` icon. (Explicit allowlist only).

### C. PriorityTag
Flags time-sensitive records or deadline breaches.

* **Code Pattern**: `<PriorityTag priority="overdue" />`
* **Rendering Rules**:
  - Returns `null` if priority is `"normal"`.
  - Returns a solid, uppercase red `"OVERDUE"` tag if priority is `"overdue"`.
  - Returns a solid, uppercase amber `"URGENT"` tag if priority is `"urgent"`.

---

## 3. StatCard (KPI Visualizers)

Standard cards positioned at the top of dashboard layouts to communicate volumes and warning counts.

### Code Pattern:
```jsx
<StatCard
  title="Overdue Documents"
  value="14"
  subtitle="2 days average SLA breach"
  icon={AlertCircle}
  trend="up"
  trendValue="12%"
  color="red"
/>
```

### Color Schemes:
* `green`: Green background container for the icon. Indicates positive trends (e.g., completed actions).
* `amber`: Amber container. Indicates warning or pending items.
* `red`: Red container. Indicates breaches, SLA violations, or errors.
* `blue` / `purple`: General queue statistics.

---

## 4. Headers and Structure

### A. PageHdr
Renders the primary page title, subtitle, breadcrumb navigation trail, and action buttons.
```jsx
<PageHdr
  title="Document Repository"
  subtitle="Official DMS Storage"
  breadcrumb={["Operations", "Repository"]}
  actions={<Btn variant="primary" icon={Plus}>Upload File</Btn>}
/>
```

### B. SectionHdr
Standard heading for card sections or table groupings.
```jsx
<SectionHdr
  title="Pending Tasks"
  subtitle="Documents requiring your signature"
  action={<Btn variant="ghost" size="sm">View All</Btn>}
/>
```

---

## 5. Timeline Routing (DTS Page)

Displays tracking audit history in chronological or reverse-chronological order.

### Visual Architecture:
* **Completed Steps**: White dot inside a green border, connected by a solid green vertical line (`2px`).
* **Active/Current Step**: Solid green dot with a pulsing accent ring, white text label.
* **Future/Pending Steps**: Gray dot and gray connector lines.
* **Timestamp alignment**: Displayed inmonospace (`IBM Plex Mono`) to highlight precise date-time entries.
* **Action Remarks**: Rendered in a sub-card container (`bg-gray-50`) under each step to show comments.
