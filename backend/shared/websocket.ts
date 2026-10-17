import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { redis } from "./redis.js";

export async function attachWebSockets(
  server: Server,
) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
  });

  const subscriber = redis.duplicate();

  await subscriber.subscribe("job:status");

  subscriber.on("message", (channel, message) => {
    if (channel !== "job:status") return;

    const payload = JSON.stringify({
      type: "job.status_changed",
      data: JSON.parse(message),
    });

    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  });

  wss.on("connection", (socket) => {
    socket.send(JSON.stringify({
      type: "connected",
    }));
  });

  return { wss, subscriber };
}