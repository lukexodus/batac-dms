# L4 Runbook 3: Failover Procedure

This document outlines the **manual** failover sequence for the Batac City LGU Platform database.

> [!IMPORTANT]
> **No Automated Promotion**  
> There is no automated health-check-triggered promotion or DNS-update script. Every step below must be executed by a human operator. Do not assume the system has failed over automatically.

## Procedure

1. **Confirm primary failure**  
   Confirm the primary is genuinely down. A transient network blip is not grounds for failover. Check from at least two independent vantage points before proceeding.

2. **Promote the standby**  
   On the standby host, run the following to promote the `postgres-standby` node:

   ```bash
   docker compose -f compose.prod.yml exec -T postgres-standby pg_ctl promote
   ```

   _(Note: The `bitnami/postgresql` image supports `pg_ctl promote` for this action.)_

3. **Confirm promotion**  
   Verify that the node is no longer in recovery mode:

   ```bash
   docker compose -f compose.prod.yml exec -T postgres-standby psql -U postgres -t -A -c "SELECT pg_is_in_recovery();"
   ```

   This must return `f` on the promoted node.

4. **Update connection strings**  
   Update `DATABASE_URL_APP`, `DATABASE_URL_AUDIT`, and `DATABASE_URL_MIGRATE` (wherever they are stored — e.g., the `./secrets/` files referenced in `compose.prod.yml`) to point at the promoted node's host. Then restart the `server` service so it picks up the new connection strings:

   ```bash
   docker compose -f compose.prod.yml restart server
   ```

5. **Update DNS / Load Balancer**  
   Update the DNS record (or load-balancer target) that routes traffic to the database host, if one exists outside the Docker network.

6. **Confirm application health**  
   Confirm application health via the health-check endpoint (TASK-INFRA-011) and perform a smoke-test write through the running application.

7. **Log and notify**  
   Log the failover event and notify the LGU IT Office and relevant Sangguniang Panlalawigan stakeholders.

8. **Rebuild replication (Follow-up)**  
   The old primary is **not** automatically reintegrated as a new standby. Rebuilding replication from the new primary is a separate, deliberate follow-up action, not part of the immediate failover.
