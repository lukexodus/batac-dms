# Understanding a Philippine LGU Before Building Software

Before learning the organization, it's important to understand what an LGU actually is.

### What is an LGU?

An **LGU (Local Government Unit)** is the local branch of government responsible for governing a specific geographic area.

The Philippine government has multiple levels:

```
National Government
│
├── Provinces
│   ├── Cities
│   └── Municipalities
│       └── Barangays
│
└── Independent Cities
```

For your project:

- Batac is a **Component City**
- Therefore, the Batac City Hall is a **City LGU**
- It has powers larger than a municipality but still belongs to a province (Ilocos Norte).

Think of the City Hall as a company.

```
CEO           = Mayor
Vice President= Vice Mayor
Board         = City Council (Sangguniang Panlungsod)
Departments   = Offices/Departments
Citizens      = Customers
```

---

## The Three Main Branches

Every city LGU is divided into three major parts.

```
City Government
│
├── Executive Branch
├── Legislative Branch
└── Barangay Governments
```

### 1. Executive Branch

Runs day-to-day government operations.

Head:

- Mayor

Responsibilities:

- Execute laws
- Manage departments
- Sign permits
- Approve expenditures
- Supervise employees
- Deliver services

The mayor is the most powerful official in the city government.

---

### 2. Legislative Branch

Creates local laws.

Head:

- Vice Mayor

Members:

- City Councilors

Official name:

- Sangguniang Panlungsod

Responsibilities:

- Pass ordinances
- Approve budgets
- Create local policies
- Conduct hearings

Example:

```
Executive:
"We need a new public market."

Legislative:
"Let's pass the ordinance and budget."
```

---

### 3. Barangay Governments

Below the city level.

```
City
│
├── Barangay 1
├── Barangay 2
├── Barangay 3
└── ...
```

Each barangay has:

- Barangay Captain
- Barangay Council

Many city systems eventually need integration with barangay data.

---

## Executive Branch Structure

Most software projects interact primarily with this branch.

Typical structure:

```
Mayor
│
├── City Administrator
│
├── Treasurer
├── Accountant
├── Budget Officer
├── Assessor
├── Planning Office
├── Engineering Office
├── Health Office
├── Agriculture Office
├── Social Welfare Office
├── Civil Registrar
├── HR Office
├── Legal Office
├── Business Permits Office
├── IT Office
└── Others
```

---

### Core Offices You Should Know

These offices appear in nearly every LGU.

---

#### Office of the Mayor

Role:

- Overall management

Handles:

- Executive decisions
- Special projects
- Department supervision

Software needs:

- Dashboards
- Reports
- KPI monitoring
- Document approvals

---

#### City Administrator

Think:

```
Mayor = CEO
Administrator = COO
```

Responsibilities:

- Coordinate departments
- Monitor operations
- Follow-up implementation

Software needs:

- Workflow tracking
- Task management
- Performance monitoring

---

#### City Treasurer

Handles money collection.

Examples:

- Property taxes
- Business taxes
- Fees
- Permits

Software systems:

```
Revenue Collection
OR Issuance
Cashiering
Payment Tracking
```

---

#### City Accountant

Handles recording of finances.

Difference:

```
Treasurer = receives money
Accountant = records money
```

Example:

```
Citizen pays tax
      │
Treasurer collects
      │
Accountant records
```

Software systems:

- Accounting
- Ledgers
- Financial reports

---

#### Budget Office

Plans spending.

Questions they answer:

```
How much money is available?
How much can departments spend?
```

Software systems:

- Budget preparation
- Budget monitoring
- Fund utilization

---

#### City Assessor

Maintains property records.

Examples:

- Land
- Buildings
- Property classifications

Produces:

```
Tax Declaration
Assessment Records
```

Software systems:

- GIS
- Property databases
- Mapping

---

#### City Planning and Development Office (CPDO)

Responsible for long-term planning.

Examples:

- Roads
- Housing
- Economic development

Software systems:

- GIS
- Project monitoring
- Development plans

---

#### City Engineering Office

Handles infrastructure.

Examples:

- Roads
- Buildings
- Drainage
- Public works

Software systems:

- Project management
- Infrastructure inventory
- Work orders

---

#### City Health Office

Handles:

- Clinics
- Vaccinations
- Health programs

Software systems:

- Patient records
- Health statistics
- Program monitoring

---

#### Social Welfare and Development Office (CSWDO)

Handles:

- Senior citizens
- PWDs
- Financial assistance
- Social programs

Software systems:

- Beneficiary management
- Case tracking

---

#### Civil Registrar

Handles:

- Birth certificates
- Death certificates
- Marriage records

Software systems:

- Registry management
- Document requests

---

#### Human Resource Management Office (HRMO)

Handles:

- Employees
- Attendance
- Leave
- Recruitment

Software systems:

- HRIS
- Payroll integration
- Leave management

---

#### Business Permits and Licensing Office (BPLO)

One of the most common software projects.

Handles:

```
Business Registration
Business Renewal
Permit Issuance
Inspections
```

Interactions:

```
Applicant
   │
BPLO
   │
Treasurer
   │
Engineering
   │
Health
   │
Fire
   │
Mayor Approval
```

This office is often the center of digital transformation projects.

---

## Constitutional / Mandatory Offices

The Local Government Code requires certain offices.

Examples:

```
Treasurer
Accountant
Budget Officer
Assessor
Planning Officer
Engineer
Health Officer
Civil Registrar
Legal Officer
Administrator
```

These are usually department heads.

---

## How Departments Interact

A common mistake when designing LGU software is thinking departments work independently.

In reality:

```
Citizen Request
       │
       ▼
Receiving Office
       │
       ▼
Multiple Departments
       │
       ▼
Approvals
       │
       ▼
Payment
       │
       ▼
Release
```

LGU work is mostly workflows.

---

### Example: Building Permit

A simplified flow:

```
Applicant
   │
   ▼
Engineering Office
   │
   ▼
Zoning Review
   │
   ▼
Assessor Verification
   │
   ▼
Treasurer Payment
   │
   ▼
Mayor Approval
   │
   ▼
Permit Issued
```

Many offices touch a single transaction.

---

### Example: Business Permit

```
Business Owner
       │
       ▼
BPLO
       │
       ├── Health
       ├── Engineering
       ├── Treasurer
       ├── Fire Bureau
       └── Mayor
```

This is why workflow engines are often more valuable than standalone forms.

---

## Jurisdiction and Authority

Each office has a specific scope.

#### Mayor

Authority:

```
Entire city
```

#### Barangay Captain

Authority:

```
Only within barangay
```

#### Treasurer

Authority:

```
City revenue collection
```

#### Assessor

Authority:

```
Property assessment
```

#### Council

Authority:

```
Local legislation
```

No office should modify another office's official records without authorization.

This becomes important when designing permissions.

---

## Software Architecture Perspective

When building an LGU system, think less about departments and more about entities.

Common entities:

```
Citizen
Business
Property
Employee
Permit
Project
Payment
Case
Document
Complaint
Barangay
```

Departments interact with these entities.

Example:

```
Property
│
├── Assessor
├── Treasurer
├── Planning
└── Engineering
```

A shared master database with role-based access is usually better than isolated departmental systems.

---

### If You Are Building for Batac City Hall

The first thing to discover is:

1. Which office requested the system?
2. Which process is being digitized?
3. Which offices participate in that process?
4. Which office owns the data?
5. Which office approves the final transaction?
6. Which office collects payment?
7. Which office issues the final document?

Those answers matter more than the organizational chart itself because LGU software is fundamentally about **cross-office workflows, approvals, records, and accountability** rather than isolated department functions.

---

# Understanding the 5 Systems: Storage vs Movement vs Process vs Preservation vs Access

The easiest way to understand them is to imagine a single document:

```
Citizen submits a request letter
        ↓
Received by Secretary
        ↓
Forwarded to Mayor
        ↓
Approved
        ↓
Archived
        ↓
Citizen checks status online
```

Different systems are responsible for different parts of that journey.

---

## First Principle: A Document Has a Life Cycle

A document goes through several stages:

```
Creation
    ↓
Storage
    ↓
Movement
    ↓
Approval
    ↓
Completion
    ↓
Archiving
    ↓
Retrieval
```

The five systems focus on different stages.

---

## 1. Document Management System (DMS)

### Main Purpose

Store and organize documents.

Think:

```
Google Drive
Dropbox
File Cabinet
```

but for an organization.

---

### Core Question It Answers

> "Where is the document?"

---

### Responsibilities

Store:

```
PDF
DOCX
Images
Scanned files
Attachments
```

Manage:

```
Upload
Download
Search
Categorization
Versioning
```

---

### Example

```
Resolution-2026-001.pdf
```

Stored in:

```
SP Resolutions
2026
Approved
```

The DMS knows:

```
Document name
File location
Version
Author
Date created
```

---

### What It Does NOT Care About

Usually:

```
Who approves?
Who receives next?
What step are we in?
```

That's someone else's job.

---

## 2. Document Tracking System (DTS)

### Main Purpose

Track document movement.

Think:

```
LBC
J&T
FedEx
```

for government documents.

---

### Core Question It Answers

> "Where is the document right now?"

---

### Responsibilities

Track:

```
Received
Forwarded
Returned
Released
Completed
```

---

### Example

```
Document #123

Secretary
    ↓
Committee A
    ↓
Vice Mayor
    ↓
Mayor
```

The DTS records:

```
Who handled it
When
Where it went
Current location
```

---

### QR Code Example

```
QR Scan

Current Office:
Mayor's Office

Status:
Pending Approval

Previous Office:
SP Secretary
```

This is DTS functionality.

---

## DMS vs DTS

### DMS

```
Stores document
```

### DTS

```
Tracks document
```

Example:

```
PDF file stored in system
```

DMS.

```
PDF moved from Office A to Office B
```

DTS.

---

## 3. Workflow Management System (WMS)

### Main Purpose

Control business processes.

Think:

```
Traffic lights
```

for documents.

---

### Core Question It Answers

> "What should happen next?"

---

### Responsibilities

Define:

```
Step 1
Step 2
Step 3
Approval
Completion
```

---

### Example

Resolution Workflow

```
Draft
    ↓
Secretary Review
    ↓
Committee Review
    ↓
1st Reading
    ↓
2nd Reading
    ↓
Approval
```

The workflow system enforces:

```
Cannot go to Step 4
unless Step 3 is completed
```

---

### Important Distinction

DTS records what happened.

WMS defines what should happen.

Example:

```
Workflow:

A → B → C
```

WMS.

```
Actually moved from A → B
```

DTS.

---

## DTS vs Workflow

Imagine a GPS.

Workflow:

```
Recommended route
```

Tracking:

```
Actual route taken
```

---

## 4. Records Management System (RMS)

### Main Purpose

Manage official government records over time.

This is usually the least understood.

---

### Core Question It Answers

> "How should this record be preserved and governed?"

---

### Responsibilities

Retention:

```
Keep for 5 years
Keep for 10 years
Keep permanently
```

Classification:

```
Confidential
Public
Restricted
```

Archiving:

```
Active
Inactive
Archived
Destroyed
```

Compliance:

```
Audit requirements
Government regulations
```

---

### Example

A resolution approved in 2020.

Workflow is already finished.

Tracking is finished.

Storage still exists.

But now:

```
How long do we keep it?
Who can access it?
Can it be deleted?
```

Those are Records Management questions.

---

## DMS vs RMS

Many people confuse these.

### DMS

Concerned with:

```
Managing files
```

### RMS

Concerned with:

```
Managing official records
```

Example:

```
Draft memo
```

May only be DMS.

```
Approved city ordinance
```

Becomes an official record.

Needs RMS.

---

## 5. Government Portal

### Main Purpose

Provide access to users.

Think:

```
Front door
```

to all services.

---

### Core Question It Answers

> "How do people interact with the system?"

---

### Responsibilities

Authentication:

```
Login
Logout
Passwords
```

Dashboard:

```
My Documents
My Tasks
Notifications
```

Search:

```
Find records
```

Public Access:

```
Citizen views status
```

---

### Example

Citizen enters:

```
Tracking Number
```

and sees:

```
Current Status
Current Office
History
```

The portal displays information from:

```
DMS
DTS
Workflow
Records
```

---

## How They Work Together

Imagine a single document.

### Step 1

Citizen uploads file.

```
DMS
```

stores it.

---

### Step 2

Tracking number generated.

```
DTS
```

starts tracking.

---

### Step 3

Secretary forwards document.

```
DTS
```

records movement.

```
Workflow
```

validates next step.

---

### Step 4

Mayor approves.

```
Workflow
```

marks process complete.

```
DTS
```

records approval.

---

### Step 5

Document archived.

```
Records Management
```

takes ownership.

---

### Step 6

Citizen checks status.

```
Portal
```

shows information.

---

## Visual Relationship

```
                    Government Portal
                           │
                           ▼
    ┌────────────────────────────────────┐
    │                                    │
    │  Document Management System        │
    │  (stores files)                    │
    │                                    │
    └────────────────────────────────────┘
                           │
                           ▼
    ┌────────────────────────────────────┐
    │                                    │
    │  Document Tracking System          │
    │  (tracks movement)                 │
    │                                    │
    └────────────────────────────────────┘
                           │
                           ▼
    ┌────────────────────────────────────┐
    │                                    │
    │  Workflow Management System        │
    │  (controls process)                │
    │                                    │
    └────────────────────────────────────┘
                           │
                           ▼
    ┌────────────────────────────────────┐
    │                                    │
    │  Records Management System         │
    │  (preserves records)               │
    │                                    │
    └────────────────────────────────────┘
```

---

## For Your LGU Project

Based on your notes, the project is probably:

```
40% Workflow Management
30% Document Tracking
15% Document Management
10% Government Portal
5% Records Management
```

The hardest part will not be file uploads or QR codes.

The hardest part will be modeling:

```
Secretary
    ↓
Committee
    ↓
1st Reading
    ↓
2nd Reading
    ↓
SP Approval
    ↓
Mayor
```

and all the exceptions:

```
Returned
Rejected
Revised
Resubmitted
Cancelled
```

That workflow model is likely the true core of the entire system.

---

# What You Need to Know Before Writing Any Code

Your current scope is not just a "Document Management System (DMS)."

It is actually a combination of:

```
Document Management System (DMS)
+
Document Tracking System (DTS)
+
Workflow Management System
+
Records Management System
+
Government Portal
```

Many student teams fail because they start with pages and databases instead of understanding the government process.

For an LGU project, the most important thing to learn is:

> A document is not the core entity.
> 
> The workflow of the document is the core entity.

---

## First Understand the Real Document Lifecycle

Ask:

### Where does a document come from?

Examples:

```
Citizen Request
Barangay Resolution
SP Resolution
SP Ordinance
Internal Memo
Purchase Request
Travel Order
Endorsement Letter
Complaint
```

### Who receives it first?

```
Receiving Office
Secretary
Records Officer
Mayor's Office
SP Office
```

### Who reviews it?

```
Secretary
Committee
Department Head
Mayor
Vice Mayor
```

### Who approves it?

```
Department Head
Mayor
SP
```

### Who archives it?

```
Records Management Office
Secretary
Administrative Office
```

Without understanding these steps, the software cannot model the process correctly.

---

## Learn the Difference Between DMS and DTS

### DMS (Document Management)

Stores documents.

Functions:

```
Upload
Download
Versioning
Search
Categorization
Archiving
```

Example:

```
Resolution_2026_001.pdf
```

stored in system.

---

### DTS (Document Tracking)

Tracks movement.

Functions:

```
Received
Forwarded
Reviewed
Returned
Approved
Released
Archived
```

Example:

```
Secretary
  ↓
Committee A
  ↓
Vice Mayor
  ↓
SP Session
  ↓
Approved
```

This appears to be your primary requirement.

---

## Understand Government Records Concepts

Most students model:

```
Document
```

only.

Real systems usually require:

```
Document
Document Type
Document Status
Document Version
Attachment
Routing History
Comments
Signatures
Notifications
```

---

## Core Entities You Will Probably Need

### User

```
id
name
email
position
office
role
```

---

### Office

```
SP Office
Mayor's Office
Accounting
Treasurer
Barangay
SK
```

Example:

```
Office
 └─ Users
```

---

### Document

```
id
tracking_number
title
description
type
current_status
created_date
```

---

### Document Type

Examples:

```
Resolution
Ordinance
Memo
Letter
Request
Endorsement
```

---

### Routing History

Most important table.

```
Document A

Received by Secretary
Forwarded to Committee
Forwarded to Vice Mayor
Approved
Released
```

Each action becomes a history record.

---

### Notification

```
recipient
message
date
read_status
```

---

### Signature

```
signer
date
signature
status
```

---

## Understand SP Workflow

You mentioned:

```
1st Reading
2nd Reading
Resolution
```

This means you need to understand the legislative process.

Typically:

```
Draft Resolution
    ↓
Secretary Review
    ↓
Committee Review
    ↓
1st Reading
    ↓
2nd Reading
    ↓
3rd Reading
    ↓
Approval
    ↓
Publication
    ↓
Archive
```

Do not hardcode this.

Different LGUs may have different workflows.

Better:

```
Workflow Definition

Step 1
Step 2
Step 3
...
```

configured by administrator.

---

## Learn About Roles vs Positions

Many beginners confuse them.

### Position

Actual job.

Examples:

```
Secretary
Mayor
Councilor
SK Chairman
Barangay Captain
```

---

### Role

System permission.

Examples:

```
Administrator
Approver
Encoder
Viewer
Records Officer
```

One person may have:

```
Position:
Secretary

Roles:
Encoder
Approver
```

---

## Design Around Offices

Most government routing happens between offices.

Example:

```
Document
 ↓
SP Office
 ↓
Mayor's Office
 ↓
Accounting
 ↓
Treasurer
```

Therefore every document should know:

```
Current Office
Current User
```

at all times.

---

## QR and Barcode Design

Most students use QR incorrectly.

Do NOT store document contents inside QR.

Store:

```
tracking_id
```

Example:

```
DTS-2026-000123
```

QR points to:

```
/view-document/DTS-2026-000123
```

The system fetches data from database.

Benefits:

```
Small QR
Fast
Secure
Easy updates
```

---

## Notification System

Ask stakeholders:

### Notify who?

```
Current assignee
Originating office
Secretary
Department head
```

### Notify when?

```
Received
Forwarded
Returned
Approved
Rejected
Overdue
```

### Notify how?

```
In-app
Email
SMS
```

Many government offices only need in-app notifications initially.

---

## Search Requirements

Government users love search.

You will need:

### Basic

```
Tracking Number
Title
Date
```

### Advanced

```
Document Type
Office
Status
Author
Date Range
```

Example:

```
All Resolutions

Status:
Approved

Date:
Jan 1 - Dec 31
```

---

## Annotation Feature

Clarify what they mean.

Possible interpretations:

### Document Comments

```
"Please revise section 3."
```

---

### Sticky Notes

```
Attached to document
```

---

### PDF Markup

```
Highlight
Underline
Draw
```

These are very different implementations.

---

## Security Topics You Need to Learn

### Authentication

Who are you?

```
Login
Password
MFA
```

---

### Authorization

What can you do?

```
Create
Edit
Delete
Approve
View
```

---

### Audit Trail

Extremely important.

Government systems require:

```
Who did it?
When?
What changed?
```

Example:

```
User:
Juan Dela Cruz

Action:
Forwarded document

Date:
2026-06-04 10:00
```

Never delete audit logs.

---

## Questions You Must Ask the LGU

Before designing anything, ask:

### Organization

```
What offices will use the system?
```

### Documents

```
What document types exist?
```

### Workflow

```
What are the exact workflows?
```

### Approvals

```
Who can approve?
```

### Signatures

```
Physical?
Digital?
Electronic?
```

### Notifications

```
Who receives notifications?
```

### Access

```
Who can see what?
```

### Search

```
How do users currently find documents?
```

### Existing Process

```
Walk us through a real document from start to finish.
```

This last question is often the most valuable.

---

## Recommended Mindset

Don't start by designing pages such as:

```
Login
Dashboard
Documents
Users
```

Start by drawing:

```
Document
   ↓
Office A
   ↓
Office B
   ↓
Office C
   ↓
Approved
   ↓
Archive
```

for every major document type.

Once you understand the flows, the database, APIs, permissions, notifications, dashboards, QR tracking, and user interfaces become much easier to design because they naturally emerge from the workflow rather than being guessed.

---

# Understanding Common LGU Documents

Before looking at specific documents, understand that LGU documents generally fall into four categories:

```
Legislative
Administrative
Financial
Citizen-facing
```

Examples:

```
Legislative:
  Resolution
  Ordinance

Administrative:
  Memo
  Travel Order

Financial:
  Purchase Request

Citizen-facing:
  Complaints
  Requests
```

---

## Citizen Request

A formal request from a citizen to the LGU.

Examples:

```
Request for assistance
Request for road repair
Request for scholarship
Request for permit
Request for information
```

Typical flow:

```
Citizen
  ↓
Receiving Office
  ↓
Concerned Department
  ↓
Action Taken
  ↓
Response
```

---

## Barangay Resolution

An official decision made by a Barangay Council.

Think:

```
Barangay-level decision
```

Examples:

```
Requesting city assistance
Approving barangay projects
Supporting a proposal
Authorizing expenditures
```

Example:

```
Barangay A passes a resolution
requesting installation of street lights.
```

Often sent to the city government for action.

---

## SP Resolution

SP means:

```
Sangguniang Panlungsod
(City Council)
```

A resolution expresses the council's position, approval, or intent.

Usually:

```
Temporary
Specific
Non-permanent
```

Examples:

```
Congratulating an athlete
Approving a request
Supporting a project
Authorizing the mayor
```

Think:

```
Official decision
without creating a new law
```

---

## SP Ordinance

An ordinance is much stronger.

Think:

```
Local law
```

Examples:

```
Curfew ordinance
Traffic ordinance
Business regulations
Environmental regulations
```

Unlike resolutions:

```
Resolution = decision

Ordinance = law
```

Typical process:

```
Draft
↓
Committee
↓
1st Reading
↓
2nd Reading
↓
3rd Reading
↓
Approval
↓
Publication
↓
Implementation
```

---

## Internal Memo

Communication inside the LGU.

Examples:

```
Meeting announcements
Policy reminders
Instructions
Department directives
```

Example:

```
Mayor's Office
↓
All Departments

"Submit reports by Friday."
```

Usually shorter and faster than formal resolutions.

---

## Purchase Request (PR)

Request to buy something.

Examples:

```
Computers
Printers
Office supplies
Vehicles
Furniture
```

Example:

```
IT Office

Needs:
10 Computers
```

Flow:

```
Requesting Office
↓
Budget
↓
Accounting
↓
BAC/Procurement
↓
Purchase
```

Very common in government.

---

## Travel Order

Official authorization for government travel.

Examples:

```
Training
Seminar
Conference
Inspection
Official Meeting
```

Contains:

```
Employee
Destination
Purpose
Dates
Funding Source
```

Flow:

```
Employee
↓
Department Head
↓
Mayor Approval
↓
Travel
```

---

## Endorsement Letter

One office officially recommends or forwards something.

Examples:

```
Endorsing a citizen request
Endorsing scholarship applicants
Endorsing project proposals
```

Example:

```
Barangay
↓
City Hall

"We recommend approval of this request."
```

Often accompanies other documents.

---

## Complaint

Formal grievance or report.

Examples:

```
Noise complaint
Road complaint
Corruption complaint
Employee complaint
Business complaint
```

Flow:

```
Citizen
↓
Receiving Office
↓
Investigation
↓
Action
↓
Resolution
```

These usually need status tracking.

---

## Other Common LGU Documents

Your stakeholders may mention many of these.

---

### Ordinance

```
Local law
```

Example:

```
Anti-littering ordinance
```

---

### Resolution

```
Official council decision
```

Example:

```
Approving a project
```

---

### Executive Order

Issued by the Mayor.

Examples:

```
Emergency measures
Task force creation
Office policies
```

Think:

```
Mayor's directive
```

---

### Memorandum Order

Administrative instruction.

Examples:

```
Attendance rules
Office procedures
```

---

### Letter

General correspondence.

Examples:

```
Request letter
Invitation
Response letter
```

---

### Endorsement

Official recommendation.

Often attached to:

```
Requests
Applications
Projects
```

---

### Permit Application

Examples:

```
Business permit
Building permit
Occupancy permit
```

Usually involve multiple departments.

---

### Project Proposal

Requests funding or approval for a project.

Examples:

```
Road construction
Health programs
Training programs
```

---

### Project Monitoring Report

Tracks project implementation.

Contains:

```
Progress
Budget
Issues
Completion %
```

---

### Inspection Report

Prepared after inspections.

Examples:

```
Building inspection
Health inspection
Business inspection
```

---

### Incident Report

Records events.

Examples:

```
Accident
Property damage
Security issue
```

---

### Accomplishment Report

Common government reporting document.

Shows:

```
Activities completed
Outputs achieved
```

---

### Activity Proposal

Request to conduct an activity.

Examples:

```
Training
Seminar
Community event
```

---

### Payroll Documents

Examples:

```
Payroll summary
Time records
Leave forms
```

Usually HR-related.

---

### Leave Application

Employee requests leave.

Examples:

```
Vacation leave
Sick leave
Emergency leave
```

---

### Job Order / Contract Documents

Used for:

```
Contractual workers
Projects
Services
```

---

### Procurement Documents

A huge category by itself.

Examples:

```
Purchase Request (PR)
Purchase Order (PO)
Abstract of Bids
Canvass
Inspection Report
Disbursement Voucher
```

---

### Financial Documents

Examples:

```
Budget Requests
Disbursement Vouchers
Liquidation Reports
Obligation Requests
```

---

### Meeting Documents

Examples:

```
Agenda
Minutes of Meeting
Attendance Sheets
Committee Reports
```

Very common for SP offices.

---

### For Your DMS/DTS

A useful design question is:

Instead of asking:

```
What documents exist?
```

Ask:

```
Which documents need routing?
Which documents need approval?
Which documents need signatures?
Which documents need tracking?
Which documents become permanent records?
```

You may discover that out of 50 document types, only about 10–15 actually require a complex workflow engine, while the rest mainly need storage, search, and retrieval. That distinction can greatly simplify your system design.

---