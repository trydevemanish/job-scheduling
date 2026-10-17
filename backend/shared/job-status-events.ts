import { redis } from "./redis.js";

export type JobStatusEvent = {
  jobId: string;
  status:
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | "cancelled";
  retryCount: number;
  failureReason?: string | null;
  updatedAt: string;
};

export async function publishJobStatus(
  event: JobStatusEvent,
) {
  await redis.publish(
    "job:status",
    JSON.stringify(event),
  );
}