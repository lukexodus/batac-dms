# Batac City LGU Platform — Developer Design Handoff

**Version:** 0.1 · **Status:** Developer Handoff Reference  
**Parent Repository:** lukexodus/batac-dms

---

## 1. Codebase Architecture

The prototype is structured as a single-page Vite React application to ensure rapid prototyping and direct layout testing.

```
/prototype
  ├── package.json          # Vite + React 19 + Tailwind v4 dependencies
  ├── vite.config.js        # Vite config integrating @tailwindcss/vite
  ├── index.html            # App entry index container
  └── /src
      ├── main.jsx          # Mounts <App /> into #root
      ├── index.css         # Tailwind directives + Global CSS variables
      └── App.jsx           # Monolithic prototype containing all pages/mocks
```

* **Vite Dev Server**: Default port: `5173` (fallback: `5174` if occupied).
* **Build Target**: Output goes to `/dist` via `npm run build`.

---

## 2. Navigation & Routing System

Routing is handled via React local state in [App.jsx](file:///home/lukexodus/projects/batac-dms/prototype/prototype/src/App.jsx) (no external routing library in this phase for simplicity).

### Routing Hooks & Maps:
```javascript
// State in App component:
const [page, setPage] = useState("mayor")
const [collapsed, setCollapsed] = useState(false)
const isPortal = page === "portal"

// Configuration registry:
const pages = {
  kitchen:  { component: KitchenSinkPage,    title: "Design System",           subtitle: "Component Library & Typography" },
  mayor:    { component: MayorPage,          title: "Mayor's Dashboard",       subtitle: "Executive Operations Overview" },
  sp:       { component: SPSecretaryPage,    title: "SP Secretary Dashboard",  subtitle: "Legislative Workflow Queue" },
  dts:      { component: DTSPage,            title: "Document Tracking System",subtitle: "Physical & Digital Routing History" },
  wms:      { component: WMSPage,            title: "Workflow Approval",       subtitle: "Executive Review Interface" },
  dms:      { component: DMSPage,            title: "Document Repository",     subtitle: "Search, Filter & Archive" },
  portal:   { component: CitizenPortalPage,  title: "Citizen Portal",          subtitle: "Public Document Verification" },
}
```

* **Sidebar Mapping**: The `Sidebar` component iterates over the `navGroups` array and calls `setPage(item.id)` to trigger rendering.
* **Layout Render Structure**:
  - Standard Admin Mode: Renders `<Sidebar>` + `<TopBar>` + page component (`Pg`).
  - Citizen Portal Mode (`isPortal = true`): Suppresses `<Sidebar>` and `<TopBar>`, rendering the standalone full-width portal.

---

## 3. Data Schema & Mock Structures

The mock datasets defined at the top of [App.jsx](file:///home/lukexodus/projects/batac-dms/prototype/prototype/src/App.jsx) map directly to planned PostgreSQL database schemas:

1. **`mockPendingSignatures`**: Maps to a `routing_instances` table linked to `documents`. Contains fields:
   - `id`: Primary Key (Format: `DTS-YYYY-XXXXXX`).
   - `title`: Document short title.
   - `type`: Document type (e.g., `Travel Order`, `Purchase Request`).
   - `submittedBy`: Foreign Key to `users.name`.
   - `office`: Foreign Key to `offices.name`.
   - `daysInQueue`: Integer counting calendar days since routing arrival.
   - `dueDate`: Date timestamp.
   - `priority`: Enum (`"normal"`, `"overdue"`).

2. **`mockDocuments`**: Maps to `documents` repository metadata schema:
   - `id`, `title`, `type`, `classification` (Enum: `Public`, `Internal`, `Confidential`, `Restricted`), `status` (Enum), `updatedAt`, `fileSize`, `department`.

3. **`mockRoutingHistory`**: Maps to `routing_audit_logs` tracking physical & digital chain of custody:
   - `step`: Stage index.
   - `action`: Audit action (e.g., `Submitted`, `Received`, `Approved`, `Signed & Released`).
   - `actor`: User full name.
   - `office`: Office department.
   - `timestamp`: Monospace standard timestamp.
   - `remarks`: Comments supplied by the actor during action.
   - `status`: Step completion enum.

---

## 4. Styling Integration Details

* **Tailwind v4 Setup**: Handled via `@import "tailwindcss";` in [index.css](file:///home/lukexodus/projects/batac-dms/prototype/prototype/src/index.css) and compiled during development using `@tailwindcss/vite`.
* **Global Overrides**:
  - The default `#root` container constraints (width: `1126px`, margin, text centering) have been removed from the compiled [index.css](file:///home/lukexodus/projects/batac-dms/prototype/prototype/src/index.css).
  - The application container now stretches to the full viewport width (`w-full`) and height (`100vh`) with `overflow: hidden`, ensuring the sidebar rests static on the left while the content area scrolls independently.

---

## 5. Physical Integration and Print Rules

### A. QR Code Visuals
The `QRDisplay` component generates a mock QR grid programmatically using SVG rectangles. In production, replace `QRDisplay` with a library like `qrcode.react` that encodes the absolute routing URL:
`http://dms.batac.gov.ph/track/DTS-2026-XXXXXX`

### B. Print Stylesheet
To enable physical document printouts of cover sheets (specifically within the DTS details view), add a print-media CSS block:
```css
@media print {
  body * {
    visibility: hidden;
  }
  #printable-cover-sheet, #printable-cover-sheet * {
    visibility: visible;
  }
  #printable-cover-sheet {
    position: absolute;
    left: 0;
    top: 0;
    width: 210mm; /* A4 standard */
    height: 297mm;
  }
}
```

---

## 6. Next Steps for Production Transition

1. **Database Migration**: Map mock datasets to database tables and generate Prisma/Drizzle schemas.
2. **API Integrations**: Replace state-based list displays (`mockDocuments`, `mockPendingSignatures`) with API fetch queries (`/api/documents/pending`, etc.).
3. **Role-based Authentication**: Implement middleware to restrict pages based on user roles:
   - Only the Mayor role should access `/mayor` page views.
   - Only Secretariat staff should access `/sp` page views.
   - Non-authenticated requests should auto-route to the Citizen Portal `/portal`.
4. **PDF Viewer Integration**: Replace the mock SVG document box in `WMSPage` and `DMSPage` with an embedded PDF renderer (e.g., `pdfjs` or iframe preview) pointing to secure object storage buckets (S3/MinIO).
