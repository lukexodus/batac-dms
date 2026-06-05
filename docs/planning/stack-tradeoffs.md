## Proposed Stack vs. Alternative Stack — TL;DR

### Why each choice matters in one sentence each

| Component                            | Proposed                                      | Alternative                                             | Why it matters here                                                          |
| ------------------------------------ | --------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Fastify** vs Express               | Validates input by default                    | You add validation manually                             | A government API with unvalidated routes is a data integrity risk            |
| **Vite SPA** vs Next.js              | Static files, no server needed                | Adds a Node rendering server                            | Internal authenticated apps get zero SEO benefit from SSR                    |
| **PostgreSQL** vs MySQL              | JSONB, Row-Level Security, append-only grants | None of these exist in MySQL                            | Three architectural requirements depend on PostgreSQL-specific features      |
| **Zod + Monorepo** vs separate repos | Frontend and backend share the same schema    | Types must be manually kept in sync                     | If they drift, bugs are caught at runtime in production, not at compile time |
| **TanStack Query** vs manual fetch   | Server state, caching, and refetching managed | You write that logic yourself, per component            | Dashboard apps with multiple live data panels need this badly                |
| **Drizzle** vs Prisma                | Exposes raw PostgreSQL features, fully typed  | Abstracts away PostgreSQL; raw queries lose type safety | JSONB queries are central to the design                                      |
| **Meilisearch** vs nothing           | Typo-tolerant, faceted search                 | PostgreSQL FTS has no typo tolerance                    | Filipino proper names have many spelling variants                            |

---

### The one-paragraph version

The alternative stack (Express + Next.js + MySQL) would produce a working system. The proposed stack produces a system where the **tools enforce the rules** instead of relying on developer discipline. Fastify enforces input validation. PostgreSQL enforces append-only audit logs and row-level data isolation. Shared Zod schemas enforce frontend-backend contract correctness at compile time. For a 10-year government platform maintained by a rotating team, the difference between "enforced by tools" and "enforced by convention" is the difference between a codebase that ages well and one that accumulates invisible debt.

---

# Stack Comparison and Library Ecosystem

---

## 1. How to Frame This Decision

Before going component by component, the evaluation framework matters. The right stack for this project must satisfy five constraints simultaneously:

- **Longevity:** The codebase must be maintainable by developers who were not part of the original team, 5–10 years from now.
- **Type safety at scale:** With module boundaries, complex domain logic, and a small team, the compiler must catch what code review misses.
- **PostgreSQL depth:** The project depends heavily on JSONB for flexible document metadata, Row-Level Security for data isolation, and advanced constraint patterns. Any abstraction that dilutes PostgreSQL access is a liability.
- **Portability:** No vendor lock-in; cloud-agnostic; on-premise deployable.
- **Team alignment:** The stack must be maintainable by Philippine developers in the long term, since the team will eventually change.

With those criteria defined, the comparison becomes principled rather than preferential.

---

## 2. Component-by-Component Comparison

### 2.1 Backend Framework: Fastify vs. Express

#### What Express gives you

Express is the most widely used Node.js framework in the world. It is simple, flexible, and has an enormous ecosystem. Almost every Node.js developer has used it. Its middleware model is straightforward: a function receives `(req, res, next)` and passes control forward.

The problem with this simplicity at scale: Express's middleware model applies globally or per-route, but has no formal structure for encapsulation. Any middleware can read and modify any part of the request and response. In a monolith with 12 modules, a middleware registered in the wrong place silently affects routes it was never intended to touch. There is no compiler-enforced way to prevent this. You catch it in testing or production.

Express has no built-in input validation. You add it separately, typically as middleware (`express-validator`, `joi`, or `zod` + a custom middleware). The validation logic is decoupled from the route definition, meaning a route can exist without validation and the framework will not complain. In a government system where every API endpoint processes official document actions, silent no-validation paths are a security and data integrity problem.

Express's TypeScript support is via `@types/express`, which was retrofitted onto a JavaScript codebase. Type inference at the route level is limited: `req.body` is typed as `any` unless you manually annotate it. This means that in practice, on a large Express codebase, you have TypeScript in name but untyped request data in fact unless you are rigorous about manual annotation on every route.

#### What Fastify gives you

Fastify was built with TypeScript and performance as first-class concerns, not retrofitted.

The most impactful difference for this project is the **schema-first route definition**. Every Fastify route defines its request body, query parameters, headers, and response shape using JSON Schema. Fastify uses Ajv to validate all incoming data against that schema before your route handler runs. If the schema is defined, the data is validated. There is no way to register a route and forget to validate it — validation is part of the route contract, not an optional middleware add-on.

```typescript
fastify.post('/documents', {
  schema: {
    body: DocumentCreateSchema,  // Zod schema converted to JSON Schema
    response: {
      201: DocumentResponseSchema
    }
  }
}, async (request, reply) => {
  // request.body is fully typed here — no `any`
  const doc = await documentService.create(request.body);
  return reply.status(201).send(doc);
});
```

This schema is also used for **serialization**: Fastify fast-serializes responses using the schema definition, bypassing `JSON.stringify` for a significant performance gain. `[Inference: Fastify benchmarks consistently show 2–3x throughput versus Express in comparable configurations; verify with your own load testing on your specific workload before relying on any benchmark figure.]`

Fastify's **plugin system** enforces encapsulation. Each module registers its routes inside a plugin with its own scope. A hook or decorator registered inside a plugin does not leak into other plugins unless explicitly inherited. This maps directly to the module boundary architecture: the IAM module's routes, hooks, and decorators cannot accidentally affect the Workflow module's routes.

```
IAM Plugin (isolated scope)
  └── /auth routes, authHooks
Workflow Plugin (isolated scope)
  └── /workflow routes, workflowHooks
Document Plugin (isolated scope)
  └── /documents routes, documentHooks
```

Fastify uses **Pino** as its built-in logger, which is among the fastest structured loggers available in Node.js and produces JSON logs that integrate cleanly with log aggregation systems. Express has no built-in logging.

**For DX:** Express wins on familiarity. If a developer has used Node.js, they have used Express. Fastify has a steeper initial learning curve, particularly around its plugin/scope system and JSON Schema integration. However, once understood, Fastify's structured approach makes large codebases more predictable, not less.

**The honest tradeoff:**

| Dimension | Express | Fastify |
|---|---|---|
| Initial familiarity | Higher | Lower |
| TypeScript integration | Retrofitted (`any` req.body) | Native, full inference |
| Input validation | Manual, optional | Built-in, enforced by schema |
| Module encapsulation | None enforced | Plugin scope system |
| Performance | Baseline | Measurably faster (see disclaimer above) |
| Plugin ecosystem | Very large, aging | Smaller, actively maintained |
| Built-in logging | None | Pino (structured, fast) |
| Long-term maintainability | Dependent on discipline | Partially enforced by framework |

**Verdict for this project:** Fastify is the correct choice. The schema-first route definition eliminates an entire class of input validation bugs. The plugin scope system enforces module boundaries at the framework level. For a 10-year codebase, partially-enforced structure is worth a steeper initial learning curve.

---

### 2.2 Frontend Framework: React SPA (Vite) vs. Next.js

#### The architectural distinction

Both stacks use React. The difference is whether you add Next.js's server-rendering infrastructure.

Next.js provides Server-Side Rendering (SSR), Static Site Generation (SSG), and its own routing, image optimization, and API routes. These capabilities are valuable for public-facing, SEO-dependent websites.

The internal government operations platform — the part used by the SP Secretary, Department Heads, and Mayor — is a role-specific, authenticated SPA. Every meaningful route requires login. Search engines cannot and should not index it. The data changes continuously. There is no SEO benefit from SSR on an authenticated application.

Adding Next.js to an authenticated internal application introduces:

- A Node.js rendering server that must be deployed and maintained alongside the API server
- The complexity of deciding what runs on the server vs. the client for every component
- The App Router's React Server Components model, which significantly changes how data fetching and state management work, in ways that conflict with TanStack Query's client-side caching model
- A framework that has undergone major architectural changes (Pages Router → App Router) and will likely continue to evolve, adding migration debt over a 10-year lifespan

Next.js has become a moving target. Its major version releases have required significant application rewrites in some organizations. For a government system intended to survive a decade with a changing development team, architectural stability matters more than cutting-edge framework features.

**Where Next.js does belong in this project:** The public government portal — where citizens look up ordinances, resolutions, and request statuses — benefits from SSG for published documents (fast, SEO-accessible, cacheable). For this specific part of the system, Next.js is a reasonable choice. The internal application does not need it.

**Vite + React SPA:**

Vite is a build tool, not a framework. It produces a static bundle of HTML, CSS, and JavaScript that a reverse proxy (Nginx or Caddy) serves. The SPA bootstraps in the browser, authenticates, and fetches data from the Fastify API. This is simple, portable, and does not require a running application server for the frontend.

**The honest tradeoff:**

| Dimension | Vite + React SPA | Next.js |
|---|---|---|
| For internal authenticated app | Correct choice | Adds unnecessary complexity |
| For public portal | Requires meta tag management for minimal SEO | Correct choice (SSG for documents) |
| Deployment complexity | Static files behind Nginx | Requires Node.js server |
| Framework stability over 10 years | React is stable; Vite changes are non-breaking | Next.js has undergone major breaking changes |
| Learning curve for new developers | Standard React | Additional Next.js-specific concepts |
| Initial performance | Excellent with code splitting | Excellent (SSR adds TTFB improvement) |

**Verdict:** Use Vite + React SPA for the internal application. Reserve Next.js for the public portal if and when it is built in Phase 3, and only if SSG is genuinely needed for SEO. This is a deliberate architectural split, not a compromise.

---

### 2.3 State Management: TanStack Query + Zustand vs. Nothing Specified

The Express/Next.js/MySQL stack as described includes no client-side state management specification. That's a decision waiting to be made by whoever builds the frontend, which is a risk in itself.

**TanStack Query** is not just a data-fetching library. It is a server-state synchronization layer. It handles:

- Automatic background refetching when the user returns to a tab
- Stale-while-revalidate caching (show cached data immediately, update in background)
- Mutation management with optimistic updates and automatic rollback on failure
- Request deduplication (multiple components requesting the same data trigger one HTTP call)
- Dependent queries (fetch document details only after document list is fetched)
- Infinite scroll / pagination patterns

For a dashboard-heavy application where multiple widgets show related data (pending documents, overdue tasks, workflow queue), TanStack Query's cache invalidation model is critical. When the Mayor approves a document, the pending queue, the routing history, and the notification count all update coherently without manual state coordination.

Without TanStack Query, this coordination is written manually with `useEffect`, loading states, and error states in each component. This code is written once per component, inconsistently, and is a major source of bugs and maintenance burden on large React applications.

**Zustand** handles UI-only state: which modal is open, sidebar collapsed state, multi-step form progress. Redux is the historical alternative. Redux's boilerplate (actions, reducers, selectors, dispatch) was justified at a time when React's ecosystem lacked better tools. It is not justified for this project. Zustand is a few dozen lines of setup, directly readable, and sufficient for everything that isn't server state.

---

### 2.4 UI Components: shadcn/ui vs. Other Libraries

This is one of the most impactful and least-discussed architectural decisions in frontend development.

shadcn/ui is architecturally different from Material UI, Ant Design, Chakra UI, or Mantine. It is not a component library in the traditional sense. It is a collection of component source code that you copy into your own project. You own the code. There is no `npm install` dependency to version-pin and hope does not break with a React update.

Each component is built on **Radix UI** primitives — headless, fully accessible components that handle keyboard navigation, ARIA attributes, focus management, and screen reader behavior correctly out of the box. The visual layer is Tailwind CSS, which you fully control.

For a government application:

- The LGU may have a branding guideline (colors, fonts, logo). With Material UI or Ant Design, overriding their design system is a battle against the library's internal specificity. With shadcn/ui, the components are yours — you change them directly.
- Accessibility is legally and ethically required for a public government application. Radix UI's accessibility primitives are thoroughly tested. Building accessible dropdowns, modals, and date pickers from scratch is genuinely difficult.
- Long-term: if shadcn/ui stops being maintained, your components still exist in your codebase and still work. A deprecated Material UI version requires migrating hundreds of components.

**Potential disadvantage:** shadcn/ui ships fewer out-of-the-box components than Material UI or Ant Design. Complex components like data tables, rich text editors, date range pickers, and drag-and-drop interfaces require additional libraries. This is addressed in the library ecosystem section below.

---

### 2.5 Database: PostgreSQL vs. MySQL

For most applications, MySQL and PostgreSQL are interchangeable. For this specific project, PostgreSQL has four features that are critical to the architecture and have no MySQL equivalent of the same depth.

**JSONB (Binary JSON with indexing and query operators)**

Document metadata schemas in this system are admin-configurable. A Travel Order has different metadata fields than a Purchase Request. A custom document type added in Phase 2 has fields that did not exist when the database schema was designed.

One approach: add a column for every possible metadata field across all document types. This produces a sparse table with hundreds of columns and is unmaintainable.

The correct approach: store document-type-specific metadata in a JSONB column. PostgreSQL's JSONB allows you to query inside that JSON with full index support:

```sql
SELECT * FROM documents
WHERE metadata @> '{"funding_source": "General Fund"}'
AND metadata->>'destination' = 'Manila';
```

MySQL's JSON type supports queries but does not have the same indexing depth or operator richness as PostgreSQL JSONB. `[Inference: based on PostgreSQL 15+ and MySQL 8.0 documentation comparison; verify for specific query patterns against your actual workload.]` For a system where administrators define custom metadata fields for document types, JSONB is not a nice-to-have — it is the architectural enabler.

**Row-Level Security (RLS)**

PostgreSQL's RLS enforces data access rules at the database level. Even if an application bug or misconfigured middleware bypasses your ABAC policy check, the database itself rejects the unauthorized access:

```sql
CREATE POLICY document_office_isolation ON documents
  USING (owning_office_id = current_setting('app.current_office_id')::uuid
         OR current_setting('app.user_role') = 'records_officer');
```

For a system with strict office-level data isolation requirements, RLS is a defense-in-depth layer. MySQL has no equivalent row-level security mechanism.

**Append-Only Enforcement for Audit Logs**

The audit log must be tamper-evident. PostgreSQL allows you to revoke UPDATE and DELETE permissions from the application database user on the audit schema while retaining INSERT. This is enforced at the database engine level, not by application code. If the application is compromised, it cannot modify audit records.

MySQL's permission model does not support column or operation-level restrictions with the same precision in this use case. `[Inference: verify against your specific MySQL version and configuration.]`

**Advanced Constraint Expressiveness**

The document numbering problem — gapless sequential numbering within a series per year — is solvable cleanly in PostgreSQL using sequences with specific configurations, partial indexes, and check constraints. For workflow state transitions, PostgreSQL check constraints can enforce valid state transitions at the database level:

```sql
CONSTRAINT valid_status_transition CHECK (
  (status = 'draft' AND prev_status IS NULL) OR
  (status = 'submitted' AND prev_status = 'draft') OR
  (status = 'approved' AND prev_status = 'under_review')
  -- etc.
)
```

MySQL supports check constraints since 8.0 but with less flexibility in expression syntax for complex cases.

**The MySQL advantages that matter for this project:**

MySQL is more commonly available on Philippine web hosting providers and is more familiar to a wider pool of Philippine developers. For a project with a cloud deployment and a defined development team, neither of these advantages is architecturally relevant. The system will run on a VPS, not shared hosting.

**Verdict:** PostgreSQL is unambiguously the correct choice for this specific project. The JSONB, RLS, append-only permissions, and constraint expressiveness are each individually important to the architecture. Together, they are decisive.

---

### 2.6 Search: Meilisearch vs. PostgreSQL Full-Text Search vs. Elasticsearch

**Option 1: PostgreSQL FTS**

PostgreSQL has built-in full-text search via `tsvector` and `tsquery`. For Phase 1 with 100–250 users and a few thousand documents, PostgreSQL FTS is entirely sufficient. No additional service to operate.

The limitations appear at scale: no typo tolerance, limited relevance tuning, no faceted search UI without significant custom query building, and results noticeably degrade on multilingual content (English, Filipino, Ilocano).

**Option 2: Meilisearch**

Meilisearch adds a dedicated search service with typo tolerance (critical for Filipino proper names, where spelling variations are common), faceted filtering (filter results by document type, office, status, and date range simultaneously), configurable stop words and synonyms, and a REST API that works with any backend.

Self-hosted, Docker-deployed, S3-snapshottable. The operational complexity is one Docker container and a periodic sync job from PostgreSQL. At the document volumes expected through Phase 3, Meilisearch will comfortably handle the workload. `[Inference: based on Meilisearch published benchmarks; verify for your specific document volume and query patterns.]`

**Option 3: Elasticsearch / OpenSearch**

The enterprise search standard. More powerful than Meilisearch for complex query DSL, log analytics, and very large document sets (millions of records). The operational complexity, memory requirements, and configuration depth are significantly higher than what a 4-person team should absorb for Phase 1–3. The correct migration path is Meilisearch → OpenSearch when scale demands it, given both expose compatible REST interfaces.

**Verdict:** Start with PostgreSQL FTS in Phase 1 (zero additional operational overhead). Introduce Meilisearch at the start of Phase 2 when search quality requirements from stakeholders become concrete. Design the search interface in the application as an abstraction from day one so the underlying provider is swappable.

---

### 2.7 Authentication: bcrypt + OAuth 2.0 vs. Alternatives

**bcrypt vs. Argon2id**

bcrypt is the industry standard and has a long track record. Argon2id is the OWASP-recommended modern password hashing algorithm and the winner of the Password Hashing Competition. `[Inference: based on OWASP Password Storage Cheat Sheet; verify against current OWASP guidance.]` Argon2id is resistant to both GPU cracking and side-channel attacks in ways that bcrypt is not.

For a new system in 2026, starting with Argon2id is the technically correct choice. The practical difference in implementation is minimal (`argon2` npm package). If bcrypt is preferred due to team familiarity, it remains acceptable — the difference matters most if the database is compromised, not during normal operations.

**OAuth 2.0 Architecture**

What is described in the proposed stack is not "OAuth 2.0" in the traditional sense of using an external provider (Google, Microsoft). It means building the authentication server using OAuth 2.0's authorization patterns — specifically:

- Short-lived JWT access tokens (15–60 minutes)
- Long-lived refresh tokens stored server-side in the database
- Token rotation: each refresh produces a new refresh token, old one is invalidated
- PKCE (Proof Key for Code Exchange) for public clients (the SPA)
- HTTP-only, Secure, SameSite=Strict cookies for token storage — never localStorage

This architecture matters because it enables a clean migration path to SSO or external identity providers later: when the LGU eventually wants to integrate with the national government identity system or add MFA, the authentication flow is already structured correctly to support it.

Storing JWTs in localStorage (the common shortcut) is vulnerable to XSS attacks. On a government application handling official document approvals, XSS leading to token theft and impersonation is a serious risk.

---

## 3. Complete Library Ecosystem

### 3.1 ORM and Database Access

This is the most consequential library decision after the database choice itself.

**Option A: Drizzle ORM** (Recommended)

Drizzle defines your database schema as TypeScript. Your schema file is the source of truth for both migrations and TypeScript types.

```typescript
// schema/documents.ts
export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  trackingNumber: varchar('tracking_number', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 500 }).notNull(),
  metadata: jsonb('metadata').$type<DocumentMetadata>(),
  status: documentStatusEnum('status').notNull().default('draft'),
  owningOfficeId: uuid('owning_office_id').references(() => offices.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

Every query is fully typed. Drizzle generates TypeScript types from your schema, so `documents.metadata` is typed as `DocumentMetadata`, not `unknown`. Drizzle exposes PostgreSQL-specific types natively: JSONB, arrays, enums, partial indexes, check constraints.

Drizzle does not abstract away SQL. When you need a complex join or a JSONB query operator, you write it with Drizzle's SQL template literal helper — fully typed, no escaping to raw strings:

```typescript
// JSONB query with full type safety
const results = await db.select()
  .from(documents)
  .where(sql`metadata @> ${JSON.stringify({ document_type: 'resolution' })}::jsonb`);
```

Drizzle Kit handles migrations: it compares your TypeScript schema against the current database state and generates SQL migration files that you can review and commit. The migration files are plain SQL — readable, reviewable, and executable directly by `psql` if needed.

**Disadvantages:** Drizzle is newer than Prisma (less community content, fewer StackOverflow answers). The API has had some changes between versions. `[Inference: based on Drizzle changelog and community observations; verify current API stability before committing.]` For a 10-year project, monitor the project's maturity trajectory before final commitment.

---

**Option B: Prisma** (Strong alternative)

Prisma is the most widely used Node.js ORM and has excellent documentation, tooling (Prisma Studio for database GUI), and a large community.

Prisma generates TypeScript types from a `.prisma` schema file. Its migrations generate SQL that it manages in a migrations directory.

The primary concerns for this project:

Prisma uses its own query engine — a compiled Rust binary. This introduces an abstraction layer between your Node.js process and PostgreSQL. `[Inference: based on Prisma architecture documentation; behavior may vary by version.]` Complex PostgreSQL-specific operations (JSONB operators, RLS, partial indexes, custom types) require dropping to `prisma.$queryRaw` — at which point you lose type safety.

Prisma's `$queryRaw` returns `unknown[]` for raw queries unless you manually type them. In a project that relies heavily on JSONB, this means the portions of the application that most depend on type safety are the ones where Prisma provides the least.

Prisma's migration system also "takes ownership" of the database in a way that can conflict with manual migrations or PostgreSQL-specific features (like triggers for audit logging) that Prisma doesn't know about.

---

**Option C: Kysely** (Query builder, not ORM)

Kysely is a type-safe SQL query builder. It does not manage schemas or migrations — it only builds queries. You pair it with a migration tool like `node-pg-migrate` or Flyway.

This is the correct choice if your team is SQL-fluent and prefers explicit control over query generation. The trade-off is that you manage the schema separately, and the TypeScript types for your tables must be maintained by hand or generated from the database schema using a codegen tool.

---

**Recommendation for this project:**

Use **Drizzle ORM + Drizzle Kit**. The rationale: PostgreSQL's advanced features (JSONB, enums, check constraints, RLS, partial indexes) are central to the architecture, and Drizzle exposes them without abstraction. The TypeScript-first schema definition means your database structure, your API types, and your validation schemas all derive from a single source of truth. If Drizzle's maturity is a concern, Kysely + node-pg-migrate is a solid conservative alternative.

---

### 3.2 Input Validation and Schema Sharing

**Zod** (essential, not optional for this project)

Zod is a TypeScript-first schema declaration and validation library. For this project, Zod schemas serve three simultaneous roles:

```typescript
// packages/shared/src/schemas/document.ts

export const DocumentCreateSchema = z.object({
  title: z.string().min(1).max(500),
  documentTypeId: z.uuid(),
  owningOfficeId: z.uuid(),
  metadata: z.record(z.unknown()),
});

export type DocumentCreateInput = z.infer<typeof DocumentCreateSchema>;
// ^ This TypeScript type is derived from the schema — single source of truth
```

The same `DocumentCreateSchema` is used:

1. As Fastify route body validation (via `fastify-zod` or `zod-to-json-schema` conversion)
2. As React Hook Form validation on the document creation form
3. As the TypeScript type definition across the entire monorepo

This eliminates frontend-backend contract drift entirely at the type level. If the backend changes a field name, the frontend fails to compile. This is the most practical benefit of TypeScript across the full stack.

---

### 3.3 Migrations

**Drizzle Kit** if using Drizzle ORM — generates and applies SQL migrations from schema diffing.

**node-pg-migrate** if using Kysely or plain SQL — each migration is a JavaScript/TypeScript file with `up` and `down` functions. SQL-based, no abstraction.

**Flyway** — Java-based but runs as a CLI or Docker container. SQL migration files stored in a directory, versioned by naming convention. Battle-tested in enterprise environments, including government systems. `[Inference: based on Flyway documentation and community usage reports.]` Adds a non-JavaScript dependency but is significantly more mature for regulated environments where migration auditability matters.

For a government system, store every migration SQL file in version control. Every database schema change is a reviewable, committable artifact. Never use a "reset and regenerate" migration approach in production.

---

### 3.4 Form Handling

**React Hook Form** is the standard for complex, performant forms in React. It avoids controlled component re-renders by using uncontrolled inputs with ref-based tracking, which makes it significantly more performant than Formik on forms with many fields.

For this project, forms are a central concern: document submission forms, workflow step definition forms, user creation forms, office configuration forms. React Hook Form + Zod resolver (via `@hookform/resolvers/zod`) gives you schema-validated forms with TypeScript inference throughout.

```typescript
const form = useForm<DocumentCreateInput>({
  resolver: zodResolver(DocumentCreateSchema),
});
// form.register('title') — fully typed, validated against the shared Zod schema
```

---

### 3.5 File Upload and Processing

**Backend file handling:**

`@fastify/multipart` handles multipart form data for file uploads in Fastify.

Files are **streamed directly to S3-compatible storage** — never written to the server's disk. This keeps the application stateless (critical for future horizontal scaling) and eliminates disk management concerns.

```typescript
// File upload pipeline: browser → Fastify stream → S3
const uploadedFile = await s3Client.putObject({
  Bucket: config.bucketName,
  Key: `documents/${documentId}/${crypto.randomUUID()}.pdf`,
  Body: file.file,  // readable stream
  ContentType: file.mimetype,
});
```

**PDF generation for cover sheets and QR labels:**

- `@react-pdf/renderer` — React-based PDF generation. You design PDF layouts as React components and render them to binary on the server. The best DX for complex, template-based documents.
- `pdf-lib` — Low-level PDF manipulation. For stamping QR codes and tracking numbers onto existing PDFs (the physical cover sheet).
- `puppeteer` — Headless Chrome rendering. More powerful for pixel-perfect HTML-to-PDF conversion, but higher operational footprint (full Chromium binary in your container).

**QR code:**

- `qrcode` (Node.js) — Generate QR codes as PNG, SVG, or data URLs. Store the tracking number, not document content, as described in the previous analysis.
- `html5-qrcode` or `zxing-wasm` (frontend) — Scan QR codes from a camera for physical document check-in. This is the "physical document arrives at an office" use case.

---

### 3.6 Real-Time Notifications

**Recommendation: Server-Sent Events (SSE)**

In-app notifications are one-directional: server pushes events to the browser. SSE is the correct protocol for this. It works over standard HTTP, requires no additional infrastructure, is supported by all modern browsers, and integrates with Fastify's streaming response model.

```typescript
// Server sends notification stream
fastify.get('/notifications/stream', async (request, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  // Push events when workflow steps are assigned, documents are approved, etc.
});
```

WebSockets would be appropriate if bidirectional, real-time collaboration (simultaneous editing, live session voting) were in scope. For notification-only use cases, SSE is simpler, more reliable under load balancers, and requires no additional protocol handling.

---

### 3.7 Email

**Nodemailer** — the standard Node.js SMTP library. Works with any SMTP provider (SendGrid, Brevo, or the LGU's own mail server).

**@react-email/components** — Define email templates as React components. Renders to HTML for sending and displays a preview in the browser during development. For a system with multiple notification email types (document assigned, step overdue, approval completed), template management becomes significant and React Email handles it cleanly.

---

### 3.8 Logging and Observability

**Pino** — Built into Fastify. Structured JSON logs. Outputs to stdout; a log aggregator (Loki, Datadog, or CloudWatch) collects from there. Significantly faster than Winston. `[Inference: based on Pino benchmark documentation; behavior depends on configuration.]`

**Sentry** — Error tracking and performance monitoring. Captures unhandled exceptions with stack traces, user context, and request data. For a government system where silent failures are unacceptable, error tracking is non-negotiable from day one.

**pino-http** — Auto-logs every request and response (status code, duration, route) through Fastify's built-in hooks. Zero-configuration request logging.

---

### 3.9 Testing

**Vitest** — Unit and integration testing. Vitest is compatible with the Vite ecosystem, runs significantly faster than Jest, and has identical API surface to Jest so existing Jest knowledge transfers. `[Inference: based on Vitest benchmark documentation; actual performance depends on test suite composition.]`

**Playwright** — End-to-end browser testing. Tests real user workflows: log in as an SP Secretary, submit a resolution, verify it appears in the Mayor's approval queue. For a government workflow system, end-to-end tests that cover complete document lifecycle flows are more valuable than unit tests that cover individual functions in isolation.

**Supertest** or **Fastify's built-in inject** — API integration testing without spinning up a full HTTP server. Tests the Fastify application layer: send a request, verify the response, verify the database state.

**Testing strategy note:** For this project, prioritize tests in this order: (1) workflow engine state machine unit tests — every valid and invalid transition, (2) API integration tests for all ABAC-protected routes, (3) end-to-end tests for the five or six most critical user journeys. Do not try to achieve high unit test coverage of all functions — it is a poor return on investment for CRUD-heavy modules.

---

### 3.10 Other Supporting Libraries

| Concern | Library | Rationale |
|---|---|---|
| Date/time | `date-fns` | Tree-shakeable, immutable, no prototype modification. Never `moment.js` (deprecated). |
| Environment config | `dotenv` + Zod schema validation | Validate all env vars at startup; fail fast if required vars are missing |
| HTTP client (internal calls) | `ky` or native `fetch` (Node 18+) | For internal service calls; TanStack Query handles browser data fetching |
| API documentation | `@fastify/swagger` + `@fastify/swagger-ui` | Auto-generates OpenAPI 3.0 spec from Fastify route schemas |
| Rate limiting | `@fastify/rate-limit` | Protect citizen portal and auth endpoints from abuse |
| CORS | `@fastify/cors` | Configured with strict origin allowlist |
| Helmet equivalent | `@fastify/helmet` | Sets security-relevant HTTP response headers |
| UUID generation | Built into Node 18+ `crypto.randomUUID()` | No additional library needed |
| Scheduling (cron) | `node-cron` + pgboss | node-cron for simple intervals; pgboss for durable scheduled jobs |
| i18n | `i18next` + `react-i18next` | Filipino, English, and Ilocano interface language support |
| Rich text (annotations) | `Tiptap` | Prosemirror-based rich text editor; headless and customizable; for document comments and annotations |
| Data tables | `TanStack Table` | Headless table with sorting, filtering, pagination — pairs with TanStack Query and shadcn/ui |
| Charts (dashboards) | `Recharts` | React-native charting library; composable and customizable |
| Virtual lists | `TanStack Virtual` | For long lists of documents without DOM performance degradation |
| PDF viewer | `react-pdf` | Render PDF documents in-browser without downloading |

---

## 4. The Monorepo Question (Not Yet Asked)

This is the most important structural decision not yet addressed.

With TypeScript on both frontend and backend, the most significant practical benefit is **shared types and validation schemas**. A Zod schema defined once in a shared package is used on the backend for API validation and on the frontend for form validation. An API response type defined once is consumed by both the Fastify route handler and the TanStack Query hook that calls it.

If the frontend and backend live in separate repositories, sharing types requires either duplicating them (which defeats the purpose — they will drift), or publishing an npm package for every change (operational friction). A monorepo solves this with zero friction.

**Recommended structure:**

```
/apps
  /web          — Vite + React SPA (internal application)
  /server       — Fastify backend
  /portal       — Next.js (public portal, Phase 3)

/packages
  /shared       — Zod schemas, TypeScript types, constants shared across apps
  /ui           — shared React component library (shadcn/ui components)
  /config       — shared ESLint, TypeScript, Prettier configurations
  /database     — Drizzle schema, migrations, seed data

/tools
  /scripts      — deployment, seeding, maintenance scripts
```

**Tool:** pnpm workspaces + Turborepo. Turborepo caches build outputs — if the `shared` package hasn't changed, it doesn't rebuild. For a team running CI/CD, this reduces pipeline times significantly. `[Inference: based on Turborepo documentation; actual cache hit rates depend on your pipeline configuration.]`

pnpm (not npm or yarn) is recommended because its symlink-based module isolation prevents one package from accidentally importing another package's dependencies that are not declared in its own `package.json`. This enforces the module boundary discipline that the architecture depends on.

---

## 5. The tRPC Question (Not Yet Asked)

**tRPC** enables end-to-end type safety between backend and frontend with no code generation step. You define procedures on the backend:

```typescript
// server/src/router/documents.ts
export const documentsRouter = router({
  create: protectedProcedure
    .input(DocumentCreateSchema)
    .mutation(async ({ input, ctx }) => {
      return documentService.create(input, ctx.user);
    }),

  list: protectedProcedure
    .input(DocumentListFiltersSchema)
    .query(async ({ input, ctx }) => {
      return documentService.list(input, ctx.user);
    }),
});
```

The frontend consumes this with full type inference automatically:

```typescript
// web/src/features/documents/useDocuments.ts
const { data } = trpc.documents.list.useQuery({ status: 'pending' });
// data is fully typed — no manual type annotation
// if the backend changes the return shape, the frontend fails to compile
```

**Advantages for this project:**
- Zero API contract drift (enforced at compile time)
- No OpenAPI spec to maintain
- Excellent integration with TanStack Query (tRPC v11 uses TanStack Query as its data layer)
- Faster development for the internal application

**Disadvantages:**
- Backend and frontend become tightly coupled. If you later need to expose an API for external consumers (a mobile app, a third-party integration, a future barangay application with a different tech stack), tRPC's internal RPC format is not the right interface. You would need a separate REST or GraphQL API alongside tRPC.
- The public portal API must be REST or GraphQL regardless, since it will eventually serve citizens and potentially third parties.
- It ties the project entirely to the TypeScript monorepo architecture. If a future team member builds a module in a different language, they cannot use tRPC.

**Recommendation:** Use tRPC for the internal application API (the authenticated, TypeScript-only part). Use a conventional REST API (documented with OpenAPI via `@fastify/swagger`) for the public portal and any future external-facing endpoints. This split is clean and aligns with the internal vs. external boundary.

---

## 6. What the Alternative Stack Actually Costs

To make the comparison concrete: the TypeScript + Node + Express + Next.js + MySQL stack is not wrong. It would produce a working system. The specific costs relative to the proposed stack are:

**Express over Fastify:** Every input validation must be explicitly added per route. On a codebase with 100+ routes built by 4 developers over 2 years, some routes will inevitably lack validation. In a government system processing official document actions, an unvalidated API endpoint is a data integrity and security risk. You can enforce validation discipline through code review, but the framework does not enforce it. Fastify's schema-first model makes the correct behavior the default.

**Next.js for an authenticated SPA:** Adds a Node.js rendering server to deploy and maintain, the App Router's RSC/Client Component mental model to manage on every new screen, and a framework that has historically required significant rework on major version upgrades. For the internal application, none of Next.js's benefits (SSR, SEO, image optimization) are relevant. The complexity cost is real; the benefit is absent.

**MySQL over PostgreSQL:** In practice, for the workflow engine's state tracking, the document metadata's flexible schema design, and the audit log's append-only enforcement, MySQL requires either workaround implementations or accepting a weaker architectural guarantee. JSONB with GIN indexes, Row-Level Security, and grant-level append-only constraints are PostgreSQL-specific. Each one can be approximated in MySQL, but the approximation is more complex to build, harder to maintain, and less robust.

**The shared cost:** Without a monorepo with shared Zod schemas, type drift between frontend and backend is caught at runtime (when a form submits the wrong field name) rather than at compile time. In a codebase that will be maintained for 10 years by changing teams, compile-time contract enforcement is a significant long-term quality advantage.

---

## 7. Summary Table

| Dimension | Proposed Stack | Alternative Stack |
|---|---|---|
| **Type safety (full stack)** | End-to-end with shared Zod schemas | Partial — runtime drift possible |
| **Input validation** | Enforced by framework (Fastify) | Manual per route (Express) |
| **Module encapsulation** | Plugin scope enforced (Fastify) | Discipline-only (Express) |
| **PostgreSQL feature access** | Full (JSONB, RLS, enums, arrays) | Partial (MySQL lacks RLS, weak JSONB) |
| **Admin-configurable metadata** | JSONB — no migrations per new field | Requires schema change or workaround |
| **Audit log hardening** | PostgreSQL grant-level append-only | Workaround required |
| **SSR for internal app** | Not used — correct for SPA | Added complexity, no benefit |
| **SSR for public portal** | Next.js if needed (Phase 3) | Available immediately |
| **Framework stability** | React + Fastify (stable APIs) | Next.js has had major breaking changes |
| **DX initial** | Higher learning curve (Fastify schema model) | Lower (Express widely known) |
| **DX long-term** | Higher (type enforcement, encapsulation) | Lower (manual discipline required) |
| **Typo-tolerant search** | Meilisearch | Not specified |
| **PH developer talent pool** | Moderate (React + Node is mainstream) | Higher (Express widely known) |
| **On-premise portability** | Full — no cloud-specific dependencies | Depends on implementation choices |
| **Performance** | Higher throughput (Fastify benchmarks) | Lower (Express baseline) |

---

The proposed stack's advantages compound over time. In year one, the difference is primarily in correctness guarantees and slightly higher initial setup complexity. In year three, it's in the reduced rate of type-mismatch bugs and the enforced module boundaries that allow new team members to understand the system without reading all of it. In year seven, it's in the absence of accumulated workarounds for the missing PostgreSQL features, the clean audit trail, and the maintainability of a codebase where the framework and tools enforced discipline from the start.

The alternative stack can deliver the same product. The question is how much invisible maintenance debt accumulates over the lifespan of the system, and how many of the architectural guarantees you rely on are enforced by the tools versus enforced by developer discipline. For a 10-year government platform, this distinction is not theoretical.
