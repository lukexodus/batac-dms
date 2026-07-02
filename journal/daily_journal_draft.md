# Daily Journal Draft (Day-by-Day)

## Week 1
**June 1 (Monday)**
*   Started the week with a self-review of skills and familiarizing ourselves with relevant concepts while waiting for our formal project assignment.

**June 2 (Tuesday)**
*   Continued self-review and background preparation. Not much formal work was assigned yet.

**June 3 (Wednesday)**
*   Final day of our self-review period; wrapped up initial preparations and awaited our project allocation.

**June 4 (Thursday)**
*   **Project Assignment**: We were officially given the task to create a presentation for the LGU Batac. This presentation would serve as our system proposal for a Document Management System and double as an interview with the stakeholders. Began conceptualizing our approach.

**June 5 (Friday)**
*   **Team Reorganization**: The project groupings were reorganized today. We gained a new member, bringing our total team count from 3 to 4. We spent time onboarding the new member and restructuring our presentation tasks.

---

## Week 2
**June 8 (Monday)**
*   **Mock Presentation**: Conducted a quick presentation of our LGU Batac system proposal to our supervisor. Received valuable feedback and made necessary, quick adjustments to our materials in preparation for the actual interview tomorrow.

**June 9 (Tuesday) — 🌟 HIGHLIGHTED DAY**
*   **First Client Interview**: Visited Batac City Hall for the system proposal presentation and our first interview round with the LGU. The session started around 8:30 AM and lasted until 11:00 AM. We gathered extensive initial requirements regarding their legislative processes.

**June 10 (Wednesday)**
*   **Documentation Started**: Began documenting the findings from the Tuesday interview and synthesizing the legislative process requirements.

**June 11 (Thursday)**
*   Continued documenting findings and started preparing follow-up questions and presentation materials for our second round of interviews.

**June 12 (Friday)**
*   Finalized preparations and documentation for the second interview scheduled for next week.

---

## Week 3
**June 15 (Monday) — 🌟 HIGHLIGHTED DAY**
*   **Second Client Interview**: Conducted our second interview with the LGU from 2:30 PM until nearly 5:00 PM. This session had a smaller crowd, allowing us to dive deeper into specific technical requirements, clarify our initial assumptions, and validate our proposed features.

**June 16 (Tuesday)**
*   Began extensively documenting our findings from the second interview to ensure all clarified requirements were captured.

**June 17 (Wednesday)**
*   Started drafting the technical architecture and defining the tech stack based on the validated requirements from the interviews.

**June 18 (Thursday)**
*   Laid out the system designs, focusing heavily on database schemas and UI requirements.

**June 19 (Friday)**
*   Documented security architectures and ensured everything was solid and well-defined before we began writing any code.

---

## Week 4
**June 22 (Monday)**
*   Finalized the pre-development documentation and system design specifications.

**June 23 (Tuesday)**
*   Ensured that all tasks and designs were clearly documented so they could be handed over smoothly to the incoming IT OJT students who will take over the project after us.

**June 24 (Wednesday)**
*   Wrapped up all documentation phases just before starting on the system proper.

**June 25 (Thursday)**
*   **System Proper - Infrastructure Setup**: Officially started development on the system proper. Defined the local development Docker Compose infrastructure stack (TASK-INFRA-004) and created the PostgreSQL role bootstrap scripts with post-migration grants (TASK-INFRA-005).

**June 26 (Friday)**
*   **CI Automation & UI Foundation**: Built an automated migration invariant linter for our CI pipeline (TASK-INFRA-007). Shifted focus to the frontend and began building out Tier 3 UI components: PageHeader, Sidebar, Topbar, and EmptyState (TASK-UI-003, 004, 005, 009).

**June 27 (Saturday)**
*   **IAM Module Scaffolding**: Scaffolded the IAM (Identity and Access Management) module file structure with typed stubs (TASK-IAM-002). Implemented the IAM repository layer with all CRUD operations (TASK-IAM-003) and seeded the initial IAM roles, permissions, and the role-permission matrix into the database (TASK-IAM-013).

---

## Week 5
**June 30 (Tuesday)**
*   **IAM Core & Org Scaffolding**: Implemented the Fastify auth preHandler middleware chain (TASK-IAM-005). Added critical security endpoints for token rotation, session termination, and workstation lock/unlock with audit logging (TASK-IAM-007, 008, 011). Completed the IAM tRPC router (TASK-IAM-012). Scaffolded the ORG module structure (TASK-ORG-002) and implemented the delegation grant creation service (TASK-ORG-005).

**July 1 (Wednesday)**
*   **Org Delegation & Docs Scaffolding**: Implemented the delegation grant revoke service with audit events for the ORG module (TASK-ORG-006). Started scaffolding the file structure and typed stubs for the DOCS module (TASK-DOCS-002) to prepare for the core document management features.
