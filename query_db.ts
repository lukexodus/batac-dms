import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env') });

import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL_APP || 'postgresql://batac_app:app_devpassword@localhost:5435/batac_lgu';
const pool = new Pool({ connectionString });

async function main() {
  const stepInstanceId = 'b3028890-6e12-4b34-8f1a-11d1a83ef538';
  const instanceId = 'd6f779fd-a498-42d8-b4a6-74b72bcf8ab3';
  const defVersionId = '7ae416d5-ea2f-47cd-948b-ff6768d6da16';

  console.log("=== QUERY 1: RAW assigned_to ===");
  const res1 = await pool.query(`
    SELECT id, status, assigned_to, started_at, completed_at
    FROM workflow.step_instances
    WHERE id = $1;
  `, [stepInstanceId]);
  console.log(JSON.stringify(res1.rows, null, 2));

  console.log("\n=== QUERY 2: workflow_events ===");
  const res2 = await pool.query(`
    SELECT event_type, occurred_at, payload
    FROM workflow.workflow_events
    WHERE step_instance_id = $1 OR instance_id = $2
    ORDER BY occurred_at ASC;
  `, [stepInstanceId, instanceId]);
  console.log(JSON.stringify(res2.rows, null, 2));

  console.log("\n=== QUERY 3: transition_rules ===");
  const res3 = await pool.query(`
    SELECT tr.id, tr.from_step_id, tr.to_step_id, tr.outcome_filter, tr.condition_expression,
           fs.step_key as from_step_key, ts.step_key as to_step_key
    FROM workflow.transition_rules tr
    JOIN workflow.steps fs ON fs.id = tr.from_step_id
    JOIN workflow.steps ts ON ts.id = tr.to_step_id
    WHERE tr.definition_version_id = $1
      AND fs.step_key = 'order_of_business_scheduling';
  `, [defVersionId]);
  console.log(JSON.stringify(res3.rows, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


