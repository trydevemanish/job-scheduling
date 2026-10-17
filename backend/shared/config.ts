import { configDotenv } from "dotenv";

configDotenv();

export const PORT = Number(process.env.PORT ?? 4000);
export const POSTGRES_URL = process.env.POSTGRES_URL ?? "postgres://app:app@postgres:5432/jobs_db";
export const REDIS_URL = process.env.REDIS_URL;
export const RABBITMQ_URL = process.env.RABBITMQ_URL;
