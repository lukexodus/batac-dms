So I have the following usecases as a sequence diagram and I need them updated in accordance to the updated project knowledge files. Feel free to expand on them or create a new one



# Capture and Register Incoming Documents



```mermaid

sequenceDiagram

    actor Ext as External Sender

    participant FD as Front Desk

    participant RO as Records Officer

    participant Sys as System

    participant Office as Owning Office



    Ext->>FD: Submits physical/electronic document

    FD->>RO: Forwards for processing

    RO->>Sys: Scans/Ingests document

    RO->>Sys: Classifies (type, office, subject)

    Sys-->>RO: Validates metadata

    

    alt [Missing fields, Unreadable, Duplicate]

        Sys-->>RO: Exception Alert

        RO->>Ext: Request correction/resubmission

    else [Validation Successful]

        Sys->>Sys: Assigns tracking number/barcode

        Sys->>Office: Routes [Document] to owning office

        Office-->>Sys: Acknowledges receipt

    end

```

# Draft and Author Internal Documents



```mermaid

sequenceDiagram

    actor Owner as Staff/Doc Owner

    participant Sys as System

    actor SH as Section Head



    Owner->>Sys: Creates new draft

    Sys-->>Owner: Prompts for template

    Owner->>Sys: Applies template & fills [Metadata]

    

    alt [Missing template / Permission denied]

        Sys-->>Owner: Error message / Access Denied

    else [Success]

        Sys->>Sys: Auto-versions to [v0.1]

        Owner->>Sys: Saves to work-in-progress (WIP)

        Sys-->>SH: (Optional) Notifies Section Head

    end

``` 

#Review and Edit



```mermaid

sequenceDiagram

    actor Author as Document Owner

    participant Sys as System

    actor PR as Peer Reviewer

    actor SH as Section Head



    Author->>Sys: Submits draft for review

    Sys->>PR: Assigns peer reviewer(s)

    Sys->>SH: Assigns section head

    

    par Parallel Review

        PR->>Sys: Reviews & adds comments

        SH->>Sys: Reviews & adds comments

    end

    

    Sys->>Sys: Consolidates comments

    

    alt [SLA breach / Reviewer conflict]

        Sys-->>Author: Escalation / Alert

    else [Review Complete]

        Sys-->>Author: Returns draft with comments

        Author->>Sys: Revises draft

        Author->>Sys: Resubmits [Revised Draft]

    end

```

# Approval Workflow



```mermaid

sequenceDiagram

    actor Author as Author

    participant Sys as System

    actor App as Approver (Chief/Mayor)



    Sys->>App: Routes [Draft] for approval

    

    alt [Approver on Leave]

        Sys->>App: Routes to Delegate

    end

    

    App->>Sys: Reviews document

    

    alt [Guard: amount < threshold]

        Sys->>Sys: Conditional skip of higher approval

    end

    

    alt [Approve]

        App->>Sys: Records e-signature/sign-off

        Sys->>Sys: Locks [Approved Version]

        Sys-->>Author: Notifies approval

    else [Reject/Changes Requested]

        App->>Sys: Adds feedback

        Sys-->>Author: Returns for revision

    end

```

# Release, Routing, and Acknowledgment



```mermaid

sequenceDiagram

    actor RO as Records Officer

    participant Sys as System

    actor Mess as Messenger

    actor Rec as External/Recipient Office



    Sys->>RO: Flags [Approved Document] for release

    RO->>Sys: Assigns outgoing number & [Transmittal]

    RO->>Mess: Hands over physical copies (if any)

    

    par Digital Delivery

        Sys->>Rec: Emails with read receipt / Portal link

    and Physical Delivery

        Mess->>Rec: Delivers physical copy

    end

    

    alt [Delivery Failure / Bounced Email]

        Sys-->>RO: Bounce/Failure Alert

    else [Success]

        Rec->>Sys: Captures [Acknowledgment/e-receipt]

        Rec->>Mess: Stamps received

        Mess->>RO: Returns stamped transmittal

    end

```

# Filing, Archiving, and Retention



```mermaid

sequenceDiagram

    actor RO as Records Officer

    participant Sys as System

    actor Arch as Archivist



    Sys->>RO: Notifies document closed/retention event

    RO->>Sys: Finalizes metadata

    RO->>Sys: Files to classification series

    Sys->>Sys: Applies [Retention Schedule]

    

    alt [Litigation Hold]

        Sys->>Sys: Freezes holds (disposal blocked)

    else [Normal Retention]

        Sys->>Arch: Flags for archive/disposal

        Arch->>Sys: Archives or disposes

        Sys->>Sys: Generates [Audit Trail]

    end

```

# Search, Retrieval, and Access Control



```mermaid

sequenceDiagram

    actor User as Authorized User

    participant Sys as System



    User->>Sys: Performs search (metadata/full-text)

    Sys->>Sys: Evaluates Access Control Lists (ACLs)

    

    alt [Access Denied / Sealed]

        Sys-->>User: Shows error / No results

    else [Redaction Required]

        Sys-->>User: Returns [Redacted Document]

    else [Authorized]

        Sys-->>User: Returns [Full Document]

    end

    

    User->>Sys: Views or Downloads

    Sys->>Sys: Logs access

```

# Versioning and Amendments



```mermaid

sequenceDiagram

    actor Owner as Document Owner

    participant Sys as System

    actor App as Approver



    Owner->>Sys: Requests amendment to [Approved Doc]

    

    alt [Attempt to edit locked final]

        Sys-->>Owner: Denies edit, prompts for new version

    end

    

    Sys->>Sys: Creates new [Version Branch]

    

    alt [Minor Change Rule]

        Owner->>Sys: Submits minor change

        Sys->>Sys: Fast-track approval / Auto-approves

    else [Major Change Rule]

        Owner->>Sys: Submits major change

        Sys->>App: Routes for full approval

        App->>Sys: Approves [New Version]

    end

    

    Sys->>Sys: Supersedes old version & links versions

```

# Audit, Reporting, and SLAs



```mermaid

sequenceDiagram

    actor CO as Compliance Officer

    participant Sys as System



    CO->>Sys: Requests periodic report / audit

    Sys->>Sys: Generates movement history

    Sys->>Sys: Calculates SLA metrics (time-in-step)

    

    alt [Incomplete Logs / No Data]

        Sys-->>CO: Exception Alert

    else [Data Available]

        Sys->>Sys: Compiles [Exception Reports] & KPIs

        Sys-->>CO: Exports to CSV/PDF / Displays Dashboard

    end

```

# Intake of Proposed Ordinances/Resolutions



```mermaid

sequenceDiagram

    actor Prop as SP Member/Committee

    participant Sec as SP Secretariat

    participant Sys as System



    Prop->>Sec: Submits proposed ordinance/resolution

    Sec->>Sys: Registers measure

    Sys->>Sys: Assigns measure number

    Sec->>Sys: Tags proponent and committee

    Sec->>Sys: Schedules in [Calendar]

    Sys-->>Prop: Confirms registration & calendar date

```

# Committee Referral and Hearings



```mermaid

sequenceDiagram

    participant Sec as SP Secretariat

    participant Sys as System

    actor Chair as Committee Chair

    actor Mem as Members



    Sec->>Sys: Refers measure to committee

    Sys->>Chair: Notifies Chair

    Sys->>Mem: Circulates materials

    Chair->>Mem: Conducts hearings

    Chair->>Sys: Records minutes

    Chair->>Sys: Attaches position papers

    Chair->>Sys: Returns measure with [Committee Report/Recommendation]

    Sys-->>Sec: Updates measure status

```

# Plenary Calendar and Session Management



```mermaid

sequenceDiagram

    actor Sec as SP Secretary

    actor VM as Vice Mayor

    actor Mem as Members

    participant Sys as System



    Sec->>Sys: Calendars item to [Agenda]

    VM->>Mem: Calls session to order (Roll call/Quorum)

    Mem->>Sys: Logs attendance

    

    loop Readings (1st, 2nd, 3rd)

        VM->>Mem: Presents measure for reading

        Mem->>Mem: Deliberates

        Mem->>Sys: Casts votes

        Sys->>Sys: Captures [Voting Results]

    end

    

    Sys-->>Sec: Finalizes plenary status

```

# Signing and Enactment Workflow



```mermaid

sequenceDiagram

    actor Sec as SP Secretary

    actor VM as Vice Mayor

    actor Mayor as Mayor

    participant Sys as System



    Sec->>Sys: Prepares post-passage [Enacted Ordinance]

    Sys->>VM: Routes for signature

    VM->>Sys: Signs document

    Sys->>Mayor: Transmits to Mayor

    

    alt [Mayor Vetoes]

        Mayor->>Sys: Records veto

        Sys-->>Sec: Returns for override consideration

    else [Mayor Approves]

        Mayor->>Sys: Signs document

        Sys->>Sys: Final numbering

        Sys->>Sys: Flags for publication

    end

```

# Publication and Public Access



```mermaid

sequenceDiagram

    actor Sec as Secretariat

    participant Sys as System

    actor Cit as Citizens



    Sec->>Sys: Reviews enacted measure

    

    alt [Contains Sensitive Info]

        Sec->>Sys: Redacts sensitive portions

    end

    

    Sec->>Sys: Publishes to portal

    Cit->>Sys: Searches & views/downloads (read-only)

    Sys->>Sys: Tracks public downloads

    Cit->>Sys: Provides feedback (optional)

```

# Template and Classification Management



```mermaid

sequenceDiagram

    actor Admin as Records Admin

    participant Sys as System



    Admin->>Sys: Accesses template management

    Admin->>Sys: Defines document types & [Templates]

    Admin->>Sys: Defines file plan & [Retention Schedules]

    Admin->>Sys: Configures numbering schemes

    Sys->>Sys: Validates and applies globally

    Sys-->>Admin: Confirms configuration

```

# User/Role and Delegation Management



```mermaid

sequenceDiagram

    actor HR as HR

    actor Admin as System Admin

    participant Sys as System



    HR->>Admin: Provides role/office updates

    Admin->>Sys: Provisions new roles/users

    Admin->>Sys: Updates office reorg mappings

    

    alt [User on Leave]

        Admin->>Sys: Sets temporary delegation

    end

    

    Sys->>Sys: Applies access rules

    Sys-->>Admin: Confirms updates

```

# Security, Redaction, and PII Handling



```mermaid

sequenceDiagram

    actor RO as Records Officer

    participant Sys as System

    actor DPO as Data Protection Officer



    Sys->>RO: Detects potential PII during processing

    RO->>DPO: Escalates for review

    DPO->>Sys: Initiates redaction workflow

    Sys->>Sys: Masks/redacts PII fields

    DPO->>Sys: Approves [Redacted Copy]

    Sys->>RO: Releases redacted copy for distribution

```

# External Requests and FOI Handling



```mermaid

sequenceDiagram

    actor Cit as Requester/Citizen

    participant FOI as FOI Officer

    participant Sys as System



    Cit->>FOI: Submits external/FOI request

    FOI->>Sys: Logs request & validates identity/scope

    Sys->>Sys: Starts SLA tracking

    FOI->>Sys: Retrieves requested documents

    

    alt [Exemption applies]

        FOI->>Sys: Redacts or denies

    else [Cleared]

        FOI->>Sys: Approves full release

    end

    

    Sys->>Cit: Delivers response (document/denial)

    Sys->>Sys: Closes request & logs SLA

```

# Incident and Exception Handling



```mermaid

sequenceDiagram

    actor Support as Support

    actor RO as Records Officer

    participant Sys as System



    RO->>Sys: Flags misfiled document / error

    RO->>Support: Requests assistance

    

    alt [Data Loss / Corruption]

        Support->>Sys: Restores from backup

    else [Metadata Correction]

        Support->>Sys: Initiates correction

        RO->>Sys: Provides dual control authorization

        Sys->>Sys: Applies metadata correction

    end

    

    Sys->>Sys: Logs incident resolution

    Sys-->>RO: Confirms fix

```