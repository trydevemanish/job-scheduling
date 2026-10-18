import type { JobType } from "../shared/job-types.js";
import { pool } from "../shared/postgres.js";
import { QUEUE, RETRY_QUEUE, DLQ, getChannel, connectRabbit } from "../shared/rabbit.js";
import { publishJobStatus } from "../shared/job-status-events.js";

const MAX_ATTEMPTS = 3

type JobMessage = { jobId: string };

function isJobMessage(value: unknown): value is JobMessage {
  return typeof value === "object"
    && value !== null
    && "jobId" in value
    && typeof value.jobId === "string";
}


type JobRow = {
  id: string;
  job_type: JobType;
  payload: Record<string, unknown>;
  retry_count: number;
  max_retries: number;
};

const handlers: Record<JobType, (payload: Record<string, unknown>) => Promise<unknown>> = {
  send_order_confirmation_email: async (payload) => ({
    demo: true,
    message: `Order confirmation prepared for ${String(payload.customerEmail ?? "unknown recipient")}.`,
  }),
  password_reset_email: async (payload) => ({
    demo: true,
    message: `Password reset email prepared for ${String(payload.email ?? "unknown recipient")}.`,
  })
};

/**---------------------------------------------------------- */
async function consumeEvent() {
    const ch = getChannel();
    await ch.prefetch(3)
    
    await ch.consume(QUEUE, async(msg) => {
        if(!msg) return
        const attempt = Number(msg.properties.headers?.['x-attempt'] ?? 0)
        
        try {
            let decoded: unknown;
            try {
                decoded = JSON.parse(msg.content.toString());
            } catch {
                ch.sendToQueue(DLQ, msg.content, { persistent: true });
                await ch.waitForConfirms();
                ch.ack(msg);
                return;
            }

            if (!isJobMessage(decoded)) {
                ch.sendToQueue(DLQ, msg.content, { persistent: true });
                await ch.waitForConfirms();
                ch.ack(msg);
                return;
            }

            const claimed = await pool.query<JobRow>(
                `UPDATE jobs
                SET status = 'processing', started_at = COALESCE(started_at, NOW()),
                    updated_at = NOW(), failure_reason = NULL
                WHERE id = $1 AND (status = 'pending' OR (status = 'processing' AND $2::boolean))
                RETURNING id, job_type, payload, retry_count`,
                [decoded.jobId, msg.fields.redelivered],
            );

            const job = claimed.rows[0];

            if (!job) {
                ch.ack(msg);
                return;
            }

            await publishJobStatus({
                jobId: String(job.id),
                status: "processing",
                retryCount: job.retry_count,
                updatedAt: new Date().toISOString(),
            });

            try {
                const result = await handlers[job.job_type](job.payload);
                const completed = await pool.query(
                    `UPDATE jobs SET status = 'completed',
                    completed_at = NOW(), updated_at = NOW(), failure_reason = NULL
                    WHERE id = $1 AND status = 'processing'
                    RETURNING id`,
                    [job.id],
                );

                if (completed.rows[0]) {
                    await pool.query(
                        "INSERT INTO job_events (job_id, event_type) VALUES ($1, 'completed')",
                        [job.id],
                    );

                    await publishJobStatus({
                        jobId: String(job.id),
                        status: "completed",
                        retryCount: job.retry_count,
                        updatedAt: new Date().toISOString(),
                    });
                }

                ch.ack(msg);
            } catch (error) {
                const failureReason = error instanceof Error ? error.message : String(error);
                const retry = await pool.query<{ retry_count: number; status: "pending" | "failed"; }>(
                    `UPDATE jobs
                    SET retry_count = retry_count + 1,
                        status = CASE WHEN retry_count < ${MAX_ATTEMPTS} THEN 'pending' ELSE 'failed' END,
                        failure_reason = $2, updated_at = NOW(),
                        completed_at = CASE WHEN retry_count >= ${MAX_ATTEMPTS} THEN NOW() ELSE completed_at END
                    WHERE id = $1 AND status = 'processing'
                    RETURNING retry_count, status`,
                    [job.id, failureReason],
                );

                const updated = retry.rows[0];
                if (!updated) {
                    ch.ack(msg);
                    return;
                }

                await pool.query(
                    "INSERT INTO job_events (job_id, event_type, details) VALUES ($1, $2, $3::jsonb)",
                    [job.id, updated.status === "failed" ? "failed" : "retrying", JSON.stringify({ failureReason })],
                );

                if (updated.status === "failed") {
                    ch.sendToQueue(DLQ, msg.content, { persistent: true, headers: {
                        ...msg.properties.headers,
                        "x-attempt": updated.retry_count,
                        "x-failure-reason": failureReason,
                    }, });
                } else {
                    ch.sendToQueue(RETRY_QUEUE, msg.content, {
                        persistent: true,
                        priority: msg.properties.priority,
                        headers: {
                            ...msg.properties.headers,
                            "x-attempt": updated.retry_count,
                        },
                    });
                }

                await ch.waitForConfirms();

                await publishJobStatus({
                    jobId: String(job.id),
                    status: updated.status,
                    retryCount: updated.retry_count,
                    failureReason,
                    updatedAt: new Date().toISOString(),
                });

                ch.ack(msg);
            }
        } catch (error) {
            console.error("Job delivery failed before acknowledgement", {
                message: error instanceof Error ? error.message : String(error),
            });
            ch.nack(msg, false, true);
        }
    })
}

/** function call */
async function start() {
    await connectRabbit()
    await consumeEvent() 
    console.log('Worker started, waiting for msgs...')
}

start().catch(err => {
    console.error('Worker failed to start:', err)
    process.exit(1)    
})