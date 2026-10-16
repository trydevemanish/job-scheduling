import express from "express";
import { pool } from "../shared/postgres.js";
import { PORT } from "../shared/config.js";
import { jobTypes } from "../shared/job-types.js";
import { statuses, type JobStatus } from "../shared/job-status.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

const jobDurationSql =
  "CASE WHEN started_at IS NULL THEN NULL ELSE EXTRACT(EPOCH FROM (COALESCE(completed_at, cancelled_at, NOW()) - started_at)) * 1000 END AS duration_ms";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


app.get("/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok" });
});

app.post("/api/jobs", async (req, res) => {
  const body: unknown = req.body;
  if (!isRecord(body)) {
    res.status(400).json({ error: "Request body must be a JSON object." });
    return;
  }

  const { name, jobType, payload = {}, priority = 2, maxRetries = 3, idempotencyKey = null } = body;

  /**Basic check */
  if (typeof name !== "string" || name.trim().length === 0 || name.length > 200) {
    res.status(400).json({ error: "name must be a non-empty string of at most 200 characters." });
    return;
  }

  if (typeof jobType !== "string" || !jobTypes.includes(jobType as (typeof jobTypes)[number])) {
    res.status(400).json({ error: `jobType must be one of: ${jobTypes.join(", ")}.` });
    return;
  }

  if (!Number.isInteger(priority) || typeof priority !== "number" || priority < 1 || priority > 5) {
    res.status(400).json({ error: "priority must be an integer from 1 (highest) to 5 (lowest)." });
    return;
  }

  if (idempotencyKey !== null && (typeof idempotencyKey !== "string" || idempotencyKey.length > 200)) {
    res.status(400).json({ error: "idempotencyKey must be a string of at most 200 characters." });
    return;
  }

  const client = await pool.connect();

  let created;
  try {
    await client.query("BEGIN");
    created = await client.query(
      `INSERT INTO jobs (name, job_type, payload, priority, idempotency_key)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [name.trim(), jobType, JSON.stringify(payload), priority, maxRetries, idempotencyKey],
    );

    if (created.rows[0]) {
      await client.query(
        "INSERT INTO job_events (job_id, event_type) VALUES ($1, 'created')",
        [created.rows[0].id],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (created.rows[0]) {
    res.status(201).json({ job: created.rows[0] });
    return;
  }

  const existing = await pool.query("SELECT * FROM jobs WHERE idempotency_key = $1", [idempotencyKey]);
  if (!existing.rows[0]) {
    throw new Error("Job insert conflicted but the existing idempotent job could not be found.");
  }
  res.status(200).json({ job: existing.rows[0], duplicate: true });
});

async function start() {
  await pool.query("SELECT 1");
  app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
}

start()
