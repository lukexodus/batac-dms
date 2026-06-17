# API & Routing Documentation

This document outlines the current data flow, routing strategy, and API endpoints for the Batac DMS Prototype frontend.

## 1. REST API Endpoints (json-server)

The prototype uses `json-server` running on `http://localhost:3001` to mock a backend REST API. The data is stored and persisted in `db.json`.

All endpoints support standard REST methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).

### Main Endpoints

*   **`GET /pendingSignatures`**
    *   **Usage:** Fetches documents awaiting the Mayor's signature.
    *   **Schema:** `[{ id: string, title: string, type: string, submittedBy: string, office: string, daysInQueue: number, dueDate: string, priority: string }]`
*   **`GET /deptWorkload`**
    *   **Usage:** Fetches the breakdown of active, completed, and overdue documents per department.
    *   **Schema:** `[{ id: string, name: string, pending: number, completed: number, overdue: number }]`
*   **`GET /slaData`**
    *   **Usage:** Fetches historical SLA compliance data for chart rendering.
    *   **Schema:** `[{ id: string, name: string, compliant: number, breach: number }]`
*   **`GET /legislativeQueue`**
    *   **Usage:** Fetches the active SP resolutions and ordinances for the SP Secretary Dashboard.
    *   **Schema:** `[{ id: string, title: string, type: string, status: string, committee: string, author: string, session: string }]`
*   **`GET /sessionCalendar`**
    *   **Usage:** Fetches scheduled SP sessions.
    *   **Schema:** `[{ id: string, date: string, day: string, title: string, time: string, type: string, items: number }]`
*   **`GET /legislativeOutput`**
    *   **Usage:** Fetches monthly counts of passed ordinances and resolutions.
    *   **Schema:** `[{ id: string, month: string, resolutions: number, ordinances: number }]`
*   **`GET /routingHistory`**
    *   **Usage:** Fetches the tamper-evident audit trail for a specific document (currently mapped globally for the prototype).
    *   **Schema:** `[{ id: string, office: string, action: string, detail: string, timestamp: string, status: string, user: string, role: string }]`
*   **`GET /documents`**
    *   **Usage:** Fetches the master repository of all documents for the DMS view.
    *   **Schema:** `[{ id: string, title: string, type: string, office: string, date: string, status: string, classification: string, size: string, ver: number }]`

---

## 2. Global Data Synchronization

The application synchronizes data from the `json-server` into the React component tree using **TanStack Query (React Query)** combined with a root-level `<DataFetcher />` component.

1.  **Hooks:** Custom hooks (e.g., `usePendingSignatures()`) wrap `useQuery` to fetch from `http://localhost:3001/...`
2.  **Mutations:** Action hooks (e.g., `useRemovePendingSignature(id)`) use `useMutation` to send `DELETE` or `POST` requests and automatically invalidate the cache.
3.  **Synchronization:** The `<DataFetcher />` executes these hooks and directly splices the returned data into globally exported mutable arrays (e.g., `mockPendingSignatures`).
4.  **Reactivity:** Because `App.jsx` handles state updates during rendering, altering the global mock arrays instantly updates all downstream components (like KPI cards and charts).

---

## 3. Frontend Routing Strategy

Because this is a single-file prototype (`App.jsx`), it does not use a heavy router like `react-router-dom`. Instead, it relies on simple URL parameter parsing via `window.location.search`.

### The `?page=` Parameter
Navigation is handled by reading the `page` query parameter.

*   **Logic:**
    ```javascript
    const queryPage = new URLSearchParams(window.location.search).get("page");
    const [page, setPage] = useState(queryPage || DEBUG_USER_ROLE);
    ```
*   **Component Rendering:** A dictionary maps the `page` string to a specific React Component:
    ```javascript
    const pages = {
      mayor: { component: MayorPage },
      wms: { component: WMSPage },
      // ...
    }
    const ActivePage = pages[page]?.component;
    <ActivePage />
    ```

### New Tab Workflows (e.g., Approval Interface)
To simulate opening a document in a dedicated workspace without losing the dashboard state, the app uses `window.open`.

*   **Trigger (Mayor's Dashboard):**
    ```javascript
    <Btn onClick={() => window.open('?page=wms&docId=' + doc.id, '_blank')}>
      Review / Sign
    </Btn>
    ```
*   **Handling (WMS Page):**
    The `WMSPage` extracts the `docId` from the URL, searches the global arrays for the specific document details, and generates a dynamic mockup.
    ```javascript
    const targetDocId = new URLSearchParams(window.location.search).get("docId");
    const doc = mockPendingSignatures.find(d => d.id === targetDocId);
    ```
*   **Completion:**
    Upon completing an action (Approve/Reject/Return), a mutation is fired, and the user is provided a button to cleanly close the spawned tab:
    ```javascript
    <button onClick={() => window.close()}>Close Tab</button>
    ```

## 4. Role-Based Views
Role switching is achieved via the `DEBUG_USER_ROLE` constant.

```javascript
export const DEBUG_USER_ROLE = "sp"; // "mayor" or "sp"
```

This variable automatically:
1.  Filters the sidebar navigation items.
2.  Changes the user profile identity at the bottom of the sidebar.
3.  Sets the default `page` state if no URL parameter is provided.
