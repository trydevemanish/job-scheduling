import type { Request, Response } from "express";
import { jobTypes } from "../shared/job-types.js";
import { redis } from "../shared/redis.js";
import { pool } from "../shared/postgres.js";
import { statuses, type JobStatus } from "../shared/job-status.js";

/** Useful function --------------------------------- */

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getIdempotencyRedisKey(key: string): string {
  return `idempotency:jobs:${key}`;
}

function isJobStatus(status: string): status is JobStatus  {
    return statuses.includes(status as JobStatus)
}

const jobDurationSql =
  "CASE WHEN started_at IS NULL THEN NULL ELSE EXTRACT(EPOCH FROM (COALESCE(completed_at, cancelled_at, NOW()) - started_at)) * 1000 END AS duration_ms";

/** ------------------------------------------------- */

export async function CreateJob(req:Request, res: Response) {
    const body: unknown = req.body;
    if (!isRecord(body)) {
        res.status(400).json({ error: "Request body must be a JSON object." });
        return;
    }

    const { name, jobType, payload = {}, priority = 2, maxRetries = 3, idempotencyKey = null } = body;

    /**--------------Basic check -------------------*/
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

    const redisKey = idempotencyKey !== null
            ? getIdempotencyRedisKey(idempotencyKey)
            : null;

    if (redisKey) {
        try {
        const cached = await redis.get(redisKey);
        if (cached) {
            return res.status(200).json({ job: JSON.parse(cached), duplicate: true });
        }

        } catch (error) {
        console.error("Redis idempotency lookup failed:", error);
        }
    }

    const client = await pool.connect();
    let created;
    let existingJob = null;

    try {
        await client.query("BEGIN");
        created = await client.query(
        `INSERT INTO jobs (name, job_type, payload, priority, idempotency_key)
        VALUES ($1, $2, $3::jsonb, $4, $5, $6)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING *`,
        [name.trim(), jobType, JSON.stringify(payload), priority, maxRetries, redisKey],
        );

        if (created.rows[0]) {
        await client.query(
            `INSERT INTO job_events (job_id, event_type)
            VALUES ($1, 'created')`,
            [created.rows[0].id],
        );
        } else {
        const result = await client.query(
            `SELECT * FROM jobs WHERE idempotency_key = $1`,
            [redisKey],
        );

        existingJob = result.rows[0] ?? null;

        if (!existingJob) {
            throw new Error(
            "Conflicting idempotency key, but the job was not found.",
            );
        }
        }

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

    const job = created.rows[0] ?? existingJob;

    if (!job) {
        throw new Error("Job creation did not return a job.");
    }

    const responseBody = {
        job,
        ...(existingJob ? { duplicate: true } : {}),
    };

    if (redisKey) {
        try {
        await redis.set( redisKey, JSON.stringify({ job }), "EX", IDEMPOTENCY_TTL_SECONDS);
        } catch (error) {
        console.error("Redis idempotency cache failed:", error);
        }
    }

    if (existingJob) {
        res.status(200).json(responseBody);
        return;
    }

    res.status(201).json(responseBody);
}

export async function GetAllJobs(req:Request, res: Response) {
    try {
        const rawPage = req.query.page ?? "1";
        const rawLimit = req.query.limit ?? "20";
        const page = Number(rawPage);
        const limit = Number(rawLimit);

        if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
            res.status(400).json({ error: "page must be positive and limit must be between 1 and 100." });
            return;
        }

        const filters: string[] = [];
        const values: unknown[] = [];

        const addFilter = (expression: string, value: unknown) => {
            values.push(value);
            filters.push(expression.replace("?", `$${values.length}`));
        };

        const status = req.query.status;

        if (typeof status === "string") {
            if (!isJobStatus(status)) {
                res.status(400).json({ error: `status must be one of: ${statuses.join(", ")}.` });
                return;
            }
            addFilter("status = ?", status);
        }

        const jobType = req.query.jobType;
        if (typeof jobType === "string") {
            addFilter("job_type = ?", jobType);
        }

        const from = req.query.from;
        if (typeof from === "string" && !Number.isNaN(Date.parse(from))) {
            addFilter("created_at >= ?::timestamptz", from);
        } else if (from !== undefined) {
            res.status(400).json({ error: "from must be a valid date." });
            return;
        }

        const to = req.query.to;
        if (typeof to === "string" && !Number.isNaN(Date.parse(to))) {
            addFilter("created_at <= ?::timestamptz", to);
        } else if (to !== undefined) {
            res.status(400).json({ error: "to must be a valid date." });
            return;
        }

        const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
        const count = await pool.query(`SELECT COUNT(*)::integer AS total FROM jobs ${where}`, values);
        const offset = (page - 1) * limit;
        const rows = await pool.query(
            `SELECT jobs.*, ${jobDurationSql} FROM jobs ${where} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, limit, offset],
        );
        res.json({ jobs: rows.rows, page, limit, total: count.rows[0].total });
    } catch (err : any) {
        return res.status(500).json({message: err})
    }
}

export async function GetJobsById(req:Request, res: Response) {
    try {
        const result = await pool.query(`SELECT jobs.*, ${jobDurationSql} FROM jobs WHERE id = $1`, [req.params.id]);
        if (!result.rows[0]) {
            res.status(404).json({ error: "Job not found." });
            return;
        }
        res.json({ job: result.rows[0] });
    } catch (error) {
        return res.status(500).json({ })
    }
}

export async function CancelJobs(req:Request, res: Response) {
    try {
        const result = await pool.query(
            `UPDATE jobs
            SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND status IN ('pending', 'processing')
            RETURNING *`,
            [req.params.id],
        );

        if (result.rows[0]) {
            await pool.query(
            "INSERT INTO job_events (job_id, event_type) VALUES ($1, 'cancelled')",
            [req.params.id],
            );
            res.json({ job: result.rows[0] });
            return;
        }

        const existing = await pool.query("SELECT status FROM jobs WHERE id = $1", [req.params.id]);
        if (!existing.rows[0]) {
            res.status(404).json({ error: "Job not found." });
            return;
        }
        res.status(409).json({ error: `Cannot cancel a ${existing.rows[0].status} job.` });
    } catch (error) {
        return res.status(500).json({ })
    }
}
