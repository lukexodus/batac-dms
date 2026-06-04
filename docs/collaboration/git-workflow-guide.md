# Git Workflow Guide

## Repository Structure

### Branches

```text
main
├── feature/authentication
├── feature/document-management
├── feature/document-tracking
├── feature/workflow-engine
├── feature/notifications
├── feature/dashboard
├── feature/search
├── feature/barcode-qr
├── feature/records-management
└── feature/ui-improvements
```

### Branch Types

#### Main Branch

```text
main
```

Rules:

* Protected branch
* No direct commits
* Only merged through Pull Requests
* Always contains stable code

---

#### Feature Branches

Used for new functionality.

Examples:

```text
feature/authentication
feature/document-tracking
feature/workflow-engine
feature/search
```

---

#### Bug Fix Branches

Examples:

```text
fix/login-redirect
fix/document-routing
fix/notification-bug
```

---

#### Research / Prototype Branches

Examples:

```text
research/workflow-design
research/ui-prototype
```

Used for experiments before implementation.

---

## Initial Setup

Each member:

```bash
git clone <repo-url>
cd batac-dms
git checkout main
git pull origin main
```

Create your working branch:

```bash
git checkout -b feature/authentication
```

Push:

```bash
git push -u origin feature/authentication
```

---

## Daily Workflow

### Start of Session

Update local repository:

```bash
git checkout main
git pull origin main
```

Switch back:

```bash
git checkout feature/authentication
```

Bring latest changes:

```bash
git merge main
```

---

### During Development

Check changes:

```bash
git status
```

Stage files:

```bash
git add .
```

Commit:

```bash
git commit -m "feat(auth): add role-based login"
```

---

### End of Session

Push work:

```bash
git push
```

---

## Pull Request Workflow

When a feature is ready:

```bash
git push origin feature/authentication
```

Create Pull Request:

```text
feature/authentication
      ↓
main
```

PR should include:

* What was added
* Screenshots (if UI)
* Testing notes
* Known issues

At least one teammate reviews before merging.

---

## Suggested Commit Format

### New Feature

```text
feat(auth): add role-based login
feat(dms): upload document endpoint
feat(workflow): create routing engine
feat(tracking): generate tracking number
```

### Bug Fix

```text
fix(auth): prevent duplicate login sessions
fix(search): correct date filtering
```

### Refactoring

```text
refactor(workflow): simplify approval service
```

### Documentation

```text
docs: update ERD
docs: add workflow diagrams
```

### Maintenance

```text
chore: update dependencies
chore: configure linting
```

---

## Merge Conflict Resolution

When merging main:

```bash
git merge main
```

If conflicts occur:

```bash
git status
```

Open conflicted files.

Look for:

```text
<<<<<<< HEAD
your code
=======
incoming code
>>>>>>> main
```

Edit manually.

Then:

```bash
git add .
git commit
```

Push:

```bash
git push
```

---

## Important Collaboration Rules

### Rule 1

One feature branch = one major task.

Avoid:

```text
feature/authentication-and-dashboard-and-search
```

Prefer:

```text
feature/authentication
feature/dashboard
feature/search
```

---

### Rule 2

Pull before starting work.

Always:

```bash
git checkout main
git pull origin main
```

---

### Rule 3

Commit frequently.

Good:

```text
feat(auth): add login page
feat(auth): add password hashing
feat(auth): add session middleware
```

Bad:

```text
final project update
```

---

### Rule 4

Never commit:

```text
.env
node_modules
vendor
build
dist
```

Use:

```gitignore
.env
node_modules/
dist/
build/
```

---

### Rule 5

Review code before merge.

Questions:

```text
Does it work?
Does it break existing features?
Can it be simplified?
Is it secure?
```

---

## Suggested Early Project Phases

### Phase 1 – Requirements

Branches:

```text
research/lgu-workflow
research/document-types
research/user-roles
```

Outputs:

```text
Requirements Specification
Use Cases
Workflow Diagrams
```

---

### Phase 2 – Design

Branches:

```text
design/database-schema
design/ui-prototype
design/system-architecture
```

Outputs:

```text
ERD
Wireframes
Architecture Diagram
```

---

### Phase 3 – Core Development

Features:

```text
Authentication
Role Management
Document Management
Document Tracking
Workflow Engine
Notifications
Dashboard
Search
```

---

### Phase 4 – Integration

Tasks:

```text
Merge all modules
Fix conflicts
Connect workflows
```

---

### Phase 5 – Testing

Tasks:

```text
User Testing
Bug Fixes
Performance Testing
Acceptance Testing
```

---

## Useful Commands

```bash
# Current status
git status

# See changes
git diff

# See commit history
git log --oneline --graph

# View branches
git branch -a

# Create branch
git checkout -b feature/search

# Switch branch
git checkout feature/search

# Delete local branch
git branch -d feature/search

# Update local repository
git pull origin main

# Push current branch
git push

# Fetch remote branches
git fetch --all
```

---

## Suggested Future Module Ownership

Once requirements are finalized, the team can divide work by module:

```text
Authentication & Roles
Document Management
Tracking & Workflow
UI / Dashboard / Reports
```

Each module gets its own feature branch and Pull Requests are used to merge changes into main.
