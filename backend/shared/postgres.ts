import { Pool } from "pg";
import { POSTGRES_URL } from "./config.js";

export const pool = new Pool({
  connectionString: POSTGRES_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
});

pool.on("connect", () => {
  console.log("Postgres Connected!");
});

pool.on("error", (error: Error) => {
  console.error("Unexpected PostgreSQL pool error", {
    message: error.message,
  });
});

export const query = (text: string, params: unknown[] = []) => pool.query(text, params);
