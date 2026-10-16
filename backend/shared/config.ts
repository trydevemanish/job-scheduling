import { configDotenv } from "dotenv";

configDotenv();

export const PORT = Number(process.env.PORT ?? 4000);
export const POSTGRES_URL = process.env.POSTGRES_URL ?? "postgresql://app:app@localhost:5432/jobs_db";
export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
export const RABBITMQ_URL = process.env.RABBITMQ_URL ?? "amqp://localhost";
