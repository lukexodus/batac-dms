# L4 Runbook 4: Monthly Restoration Test Checklist

This checklist accompanies each monthly run of the backup restoration test script (`monthly-restoration-test.sh`). It is designed to verify that the daily encrypted database dumps stored in S3/MinIO are actually restorable and contain complete data.

## Verification Checklist

- [ ] **Script Execution**: The script `monthly-restoration-test.sh` completed successfully with exit code `0`.
- [ ] **Row-Count / Schema Spot Check**: Both the schema count floor (default 11 in production) and migration history row count tests passed without alerts.
- [ ] **RTO Compliance**: Record the total time elapsed during the restoration. Compare it against the **4-hour Recovery Time Objective (RTO)** ceiling (per §11.14 of the Consolidated Architecture Reference).
  - *Actual restore time: __________ minutes/hours*
- [ ] **Audit Logging**: Add a new entry to the restoration test log file at `/docs/ops/restoration-test-log.md` with:
  - Date and time of the test
  - Operator's name/ID
  - S3 backup filename tested (e.g., `batac_20260627T000000Z.dump.gpg`)
  - Verification signature / sign-off status
- [ ] **Post-Run Cleanup**: Verify that the temporary local files `/tmp/batac_*.dump.gpg` and `/tmp/restoretest.dump` are deleted, and that the scratch database `batac_lgu_restoretest` has been successfully dropped from the database cluster.

## Escapation Protocol

> [!CAUTION]
> **Backup Restoration Failure**  
> If the script exits with a non-zero code or fails any validation check, **escalate the incident immediately** to the LGU IT Office and DevOps Lead. 
> 
> 1. Do not assume previous daily backups are healthy.
> 2. Manually retrieve the previous day's backup (and older backups if necessary) and run the restoration test script targeting them to find the most recent valid restore point.
> 3. Inspect database logs and the encryption key to isolate the root cause.
