export const statuses = ["pending", "processing", "completed", "failed", "cancelled"] as const;
export type JobStatus = (typeof statuses)[number];