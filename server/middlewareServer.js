import http from "http";
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";

const PORT = process.env.PORT || 5000;
const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.text({ type: "*/*" }));
app.use(express.json());

// In-memory log buffer
const scanLogs = [];
const MAX_LOGS = 50;

// Create HTTP Server
const server = http.createServer(app);

// Create WebSocket Server for Real-Time UI Streaming
const wss = new WebSocketServer({ server });

// Broadcast helper
function broadcastFingerprint(data, source = "BIOMETRIC_DEVICE") {
  const logEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    source,
    raw: typeof data === "string" ? data : JSON.stringify(data),
    data
  };

  scanLogs.unshift(logEntry);
  if (scanLogs.length > MAX_LOGS) scanLogs.pop();

  const message = JSON.stringify({
    type: "FINGERPRINT_EVENT",
    payload: data,
    log: logEntry
  });

  console.log(`[Fingerprint Middleware] Broadcasted scan from ${source}:`, data);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });

  return logEntry;
}

// -------------------------------------------------------------
// POST Handler matching the Python Flet Fingerprint listener
// -------------------------------------------------------------
app.post(["/", "/fingerprint", "/api/fingerprint"], (req, res) => {
  const body = req.body;
  console.log("[Fingerprint Middleware] POST received on port 5000:", body);

  if (!body) {
    return res.status(400).send("Empty payload");
  }

  // Broadcast to Desktop/Web frontend
  const log = broadcastFingerprint(body, "PHYSICAL_DEVICE");

  // Send OK response matching original Python HTTP server
  res.status(200).send("OK");
});

// Simulation endpoint for test console
app.post("/api/simulate", (req, res) => {
  const { employee_id, name, designation, raw } = req.body || {};
  let payload = raw;
  if (!payload && employee_id) {
    payload = `${employee_id}\t${name || ""}\t${designation || ""}`;
  }

  const log = broadcastFingerprint(payload || "EMP001\tTest User\tStaff", "UI_SIMULATOR");
  res.status(200).json({ success: true, log });
});

// Health check and logs API
app.get("/status", (req, res) => {
  res.json({
    status: "online",
    port: PORT,
    connectedClients: wss.clients.size,
    serverTime: new Date().toISOString()
  });
});

app.get("/api/logs", (req, res) => {
  res.json({ logs: scanLogs });
});

// WebSocket connection lifecycle
wss.on("connection", (ws) => {
  console.log("[Fingerprint Middleware] UI Client connected via WebSocket.");
  
  // Send connection ack with recent logs
  ws.send(JSON.stringify({
    type: "CONNECTION_ACK",
    message: "Connected to Fingerprint Middleware on port 5000",
    logs: scanLogs.slice(0, 10)
  }));

  ws.on("message", (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed.type === "SIMULATE_SCAN") {
        broadcastFingerprint(parsed.payload, "WS_CLIENT_SIMULATOR");
      }
    } catch (e) {
      console.error("Error processing ws message:", e);
    }
  });

  ws.on("close", () => {
    console.log("[Fingerprint Middleware] Client disconnected.");
  });
});

// Start Server on 0.0.0.0 so network biometric devices can reach it
server.listen(PORT, "0.0.0.0", () => {
  console.log(`=======================================================`);
  console.log(`🚀 Hayleys Fingerprint Middleware running on port ${PORT}`);
  console.log(`📡 Listening for POST / on http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket Stream active on ws://localhost:${PORT}`);
  console.log(`=======================================================`);
});
