export const jobTypes = [
  "send_order_confirmation_email",
  "password_reset_email",
] as const;

export type JobType = (typeof jobTypes)[number];
