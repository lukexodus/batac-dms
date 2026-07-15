# L4 Runbook 5: Quarterly Disaster Recovery Drill Checklist

This runbook outlines the procedure for the quarterly disaster recovery (DR) drill of the Batac City LGU Platform. The drill exercises both the replication-failover procedure and the Point-in-Time Recovery (PITR) capability together.

> [!IMPORTANT]
> **Staging Environment Only**  
> Disaster recovery drills must **NEVER** be run against the production environment. Staging must be used exclusively.
>
> **Minimum Two Team Members Required**  
> Per §11.14 of the Consolidated Architecture Reference, the drill must be performed and signed off by a **minimum of two participating team members** to ensure cross-training and operational redundancy.
>
> **Scheduling Constraint**  
> Schedule drills on a day with no scheduled Sangguniang Panlalawigan session to avoid unnecessary distraction or impact.

---

## Pre-Drill Validation

- [ ] **Staging Health**: Confirm staging is currently healthy (TASK-INFRA-011 health check returns green).
- [ ] **PITR Base Backups**: Confirm that at least one recent successful WAL-G base backup exists in the staging backup storage (verify via `/docs/ops/pitr-log.md`).
- [ ] **Daily Dump Backups**: Confirm that at least one recent successful daily `pg_dump` exists in the S3 bucket (`s3://batac-backups/daily/`).
- [ ] **Environment Baseline**: Note the staging environment's current configuration, connection strings, active nodes, and data states so they can be restored back to this baseline afterward.
  - _Current Primary Host: ****\*\*****\_\_\_****\*\*****_
  - _Current Standby Host: ****\*\*****\_\_\_****\*\*****_

---

## Drill Part A — Failover Exercise

The objective of this phase is to measure the Recovery Time Objective (RTO) when executing a manual standby promotion after primary node failure. The RTO ceiling is **4 hours**.

- [ ] **Start Drill**: Start a timer to track RTO.
- [ ] **Simulate Failure**: Simulate a primary database failure by stopping the `postgres-primary` container on the staging stack:
  ```bash
  docker compose -f compose.prod.yml stop postgres-primary
  ```
- [ ] **Execute Failover**: Execute the manual failover procedure from `/docs/ops/l4-runbook-3-failover-procedure.md` (TASK-INFRA-018) to promote the standby container:
  ```bash
  docker compose -f compose.prod.yml exec -T postgres-standby pg_ctl promote
  ```
- [ ] **Verify Reconnection**: Update the application connection secrets to target the promoted database node and restart the `server` container:
  ```bash
  docker compose -f compose.prod.yml restart server
  ```
- [ ] **Stop Timer**: Stop the timer as soon as the application's `/health` endpoint returns `200` successfully against the promoted node.
- [ ] **Record Achieved RTO**:
  - _Timer stopped at: **\*\***\_\_**\*\*** (Duration: **\_\_\_\_** minutes / hours)_
  - _RTO Target: **< 4 hours** (Consolidated ref §11.14)_
  - _Result (Pass / Fail): \***\*\_\_\*\***_

---

## Drill Part B — Point-in-Time Recovery Spot Check

The objective of this phase is to measure the Recovery Point Objective (RPO) and verify our ability to restore the database to an arbitrary point in time. The RPO ceiling is **1 hour**.

- [ ] **Define Target Point**: Pick a target timestamp from within the last base-backup-to-now window (e.g., exactly 2 hours ago).
  - _Target recovery timestamp: ****\*\*****\_\_\_\_****\*\*****_
- [ ] **Deploy Scratch Environment**: Restore the data up to the chosen target timestamp into an isolated, disposable scratch environment using `wal-g backup-fetch` and WAL replay (per L4 §1.5).
- [ ] **Validate Restore**: Query the restored database to confirm that the latest transaction timestamp is at or before the chosen target recovery point, and no more than 1 hour earlier.
- [ ] **Record Achieved RPO**:
  - _Latest transaction timestamp in restored database: ****\*\*****\_\_\_\_****\*\*****_
  - _Difference between target timestamp and restored timestamp: **\_\_\_\_** minutes / seconds_
  - _RPO Target: **< 1 hour** (Consolidated ref §11.14)_
  - _Result (Pass / Fail): \***\*\_\_\*\***_

---

## Post-Drill Restoration & Log

- [ ] **Restore Staging Environment**: Restore the staging stack back to its original pre-drill configuration. Re-establish the original primary/standby roles. **Do not leave the staging environment in a degraded, promoted-during-drill state.**
  - _Confirm `postgres-primary` is started and running as the master._
  - _Confirm `postgres-standby` is started and successfully replicating from primary._
  - _Confirm connection strings are reverted to point back to the original primary._
- [ ] **Log Issues**: Record any issues, anomalies, or document gaps discovered during the drill. File follow-up engineering tickets for any problems found.
- [ ] **Create Log Entry**: Add a new entry to the DR drill log at `/docs/ops/dr-drill-log.md` (TASK-INFRA-015) containing:
  - Drill Date
  - Participants (Minimum 2 required)
  - Achieved RTO and RPO
  - Summary of issues found and resolutions
  - Dual sign-offs
- [ ] **Escalation Trigger**: If the achieved RTO exceeded **4 hours** or the achieved RPO exceeded **1 hour**, escalate the failure immediately to the LGU IT Office before the next scheduled quarterly drill.

---

### Drill Sign-off

_Participant 1 Name: ****\*\*****\_\_\_****\*\***** Signature: ****\*\*****\_\_\_****\*\*****_  
_Participant 2 Name: ****\*\*****\_\_\_****\*\***** Signature: ****\*\*****\_\_\_****\*\*****_  
_Date of Sign-off: ****\*\*****\_\_\_****\*\*****_
