import express from "express";
import { pool } from "../shared/postgres.js";
import { PORT } from "../shared/config.js";
import { connectRabbit } from "../shared/rabbit.js";
import { CancelJobs, CreateJob, GetAllJobs, GetJobsById } from "../controller/controller.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

/**-------------------------------------------- */

app.get("/health", async (_req, res) => { await pool.query("SELECT 1"); res.json({ status: "ok" });});

app.post("/api/jobs", CreateJob)
app.get("/api/jobs", GetAllJobs)
app.get("/api/jobs/:id", GetJobsById)
app.post("/api/jobs/:id/cancel", CancelJobs)

/**-------------------------------------------- */

async function start() {
  await pool.query("SELECT 1");
  await connectRabbit()
  app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
}

start()
