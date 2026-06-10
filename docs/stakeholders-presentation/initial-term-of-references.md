**Term of Reference**

**Introduction**

A Document Management System (DMS) is a digital solution designed to capture, store, organize, track, and retrieve documents and records in a structured and secure manner. By replacing or supplementing traditional paper-based filing systems, a DMS enables organizations to manage the full lifecycle of their documents from creation and review to approval, archiving, and eventual disposal within a single, centralized platform.

In the context of local government units (LGUs), effective document management is essential for transparency, accountability, and efficient public service delivery. Legislative bodies such as the Sangguniang Panlungsod generate a continuous flow of official documents  including resolutions, ordinances, minutes of sessions, and barangay records  that must be properly recorded, accessible to authorized personnel, and preserved for compliance and public reference. Without a systematic approach, these records are vulnerable to loss, unauthorized access, duplication, and delays in retrieval that can impede governance.

This Terms of Reference (TOR) outlines the objectives, scope, deliverables, and requirements for the development and deployment of a web-based Document Management System for the City Government of Batac (LGU Batac), specifically serving the Sangguniang Panlungsod (SP), its member offices, and the barangay secretariats within the city. The proposed DMS aims to modernize document handling, enforce access controls aligned with organizational roles, and provide an intuitive interface for both government personnel and the general public.

This document is intended to serve as the primary reference for stakeholders, project team members, and prospective development vendors. It provides the necessary context for ongoing requirements-gathering activities, including upcoming stakeholder interviews, and will be updated as additional project details are confirmed.

**Background and Rationale**

The City Government of Batac, through the Sangguniang Panlungsod (SP), generates and manages a significant volume of legislative documents, resolutions, ordinances, and barangay-level records. Currently, these documents are managed through manual, paper-based processes that present challenges in retrieval, version control, accessibility, and overall efficiency.

To address these challenges, the LGU Batac intends to commission the development of a web-based Document Management System (DMS) that will digitize, centralize, and streamline document workflows across the SP Secretariat, barangay secretariats, SP members, and the general public (clients). This Terms of Reference (TOR) is issued to define the project objectives, scope of work, roles and responsibilities, and expected deliverables to guide the development team.

**Project Objectives**

The DMS project aims to achieve the following objectives:

* Digitize and centralize document storage for the Sangguniang Panlungsod and all city barangays.

* Implement role-based access controls to ensure appropriate document visibility and editing privileges per user type.

* Provide an intuitive content management interface for document creation, uploading, versioning, and archiving.

* Develop a real-time dashboard for monitoring document status, pending actions, and system activity.

* Improve transparency and accessibility by enabling clients to access relevant public documents.

* Reduce administrative burden and processing time through automated document workflows.

**Scope**

**User Authentication**

* Secure login and logout functionality with session management.

* Multi-factor authentication (MFA) support (to be confirmed during requirements gathering).

* Password reset and account recovery mechanisms.

* User account creation, modification, and deactivation by authorized administrators.

* Audit logging of login events and authentication activities.

**Role-Based-Access-Control (Who else?)**

The system shall support, at minimum, the following user roles:

* SP Secretary – Full administrative access; manages system-wide document workflows, user accounts, and configurations. (Layman terms)

* Barangay Secretary – Access limited to documents within their respective barangay; can upload, manage, and track barangay-level records.

* SP Member – Access to SP session documents, legislative records, and relevant cross-barangay reports; read and comment privileges.

* Client (Public User) – Access to publicly available documents; may submit document requests (scope to be confirmed).


**Content management system (CMS)**

* Document uploading with support for common formats (PDF, DOCX, XLSX, images).

* Document metadata tagging (e.g., document type, barangay, date, author, subject).

* Version control to track document revisions and maintain history.

* Document categorization and folder/archive structure.

* Full-text search and filter capabilities.

* Document approval and endorsement workflow (scope to be confirmed).

* Notification system for pending tasks, approvals, and document updates.


**Dashboard**

* Personalized dashboard view per user role showing relevant pending actions and recent documents.

* System-wide statistics (e.g., total documents, pending requests, recent uploads) accessible to the SP Secretary.

* Barangay-level document status summary for Barangay Secretaries.

* SP Members to see a summary of session schedules, resolutions, and ordinances (details subject to requirements gathering).

**Proposed technology stack**

**Frontend** 

React \- Core UI framework for building the web-based interface.

TanStack Query \- Server state management; handles API data fetching, caching, and synchronization.

Zustand \- Lightweight global state management for client-side application state.

shadcn/ui \- Accessible, customizable UI component library for consistent design across the system.

**Backend**

Node.js \- Server-side JavaScript runtime environment for the API layer.

TypeScript \- Statically typed superset of JavaScript; improves code reliability and maintainability.

Fastify \- High-performance web framework for building the REST API; significantly faster than alternatives such as Express.

**Database**

PostgreSQL \- Robust, open-source relational database for structured storage of documents, user records, roles, and audit logs.

**Search Engine**

Meilisearch \- Fast, typo-tolerant full-text search engine for document retrieval and filtering; provides near-instant search results across large document collections.

**Authentication**

Bcrypt \- Industry-standard password hashing library for secure credential storage.

OAuth 2.0 \- Open authorization framework enabling secure delegated access and potential third-party identity provider integration.

