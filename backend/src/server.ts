import express from "express";
import { createServer } from "node:http";
import { pool } from "../shared/postgres.js";
import { PORT } from "../shared/config.js";
import { connectRabbit } from "../shared/rabbit.js";
import { CancelJobs, CreateJob, GetAllJobs, GetJobsById } from "../controller/controller.js";
import { attachWebSockets } from "../shared/websocket.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

/**-------------------------------------------- */

app.get("/health", async (_req, res) => { await pool.query("SELECT 1"); res.json({ status: "ok" });});

app.post("/api/jobs", CreateJob)
app.get("/api/jobs", GetAllJobs)
app.get("/api/jobs/:id", GetJobsById)
app.post("/api/jobs/:id/cancel", CancelJobs)

/**-------------------------------------------- */

const server = createServer(app);

async function start() {
  await pool.query("SELECT 1");
  await connectRabbit()
  await attachWebSockets(server);
 
  server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});

