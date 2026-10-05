import http from "http";
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";

// Primary Port (4370 as requested for physical biometric kiosks) and Secondary fallback (5000)
const PRIMARY_PORT = process.env.PORT || 4370;
const SECONDARY_PORT = parseInt(PRIMARY_PORT, 10) === 4370 ? 5000 : 4370;

// Configured Kiosk Endpoints
const KIOSK_CONFIG = {
  ORDERING: {
    ip: "192.168.8.168",
    port: 4370,
    name: "Ordering Kiosk",
    sinhala: "කෑම ඇණවුම් කියෝස්කය",
    role: "ORDERING_KIOSK",
    type: "ORDERING",
    targetAction: "ORDER",
    targetRoute: "/meals/order"
  },
  RECEIVING: {
    ip: "192.168.8.160",
    port: 4370,
    name: "Receiving Kiosk",
    sinhala: "කෑම ලබාගැනීමේ කියෝස්කය",
    role: "RECEIVING_KIOSK",
    type: "RECEIVING",
    targetAction: "RECEIVE",
    targetRoute: "/meals/receive"
  }
};

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.text({ type: "*/*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory log buffer
const scanLogs = [];
const MAX_LOGS = 100;

// Helper to normalize client IP address
function normalizeIp(ip) {
  if (!ip) return "127.0.0.1";
  let clean = String(ip).trim();
  if (clean.startsWith("::ffff:")) {
    clean = clean.substring(7);
  }
  if (clean === "::1") return "127.0.0.1";
  return clean;
}

// Helper to detect if POST call came from Ordering Kiosk (192.168.8.168) or Receiving Kiosk (192.168.8.160)
function detectKioskSource(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const remote = forwarded ? forwarded.split(",")[0].trim() : (req.socket?.remoteAddress || req.ip || "");
  const clientIp = normalizeIp(remote);

  // Check headers, query params or body overrides for testing/proxying
  const overrideKiosk = req.query?.kiosk || req.headers["x-kiosk-type"] || req.body?.kiosk || "";
  const overrideIp = req.query?.ip || req.headers["x-device-ip"] || req.body?.ip || "";
  const path = req.path.toLowerCase();

  // 1. Ordering Kiosk match (IP: 192.168.8.168 or /order route or override)
  if (
    clientIp === "192.168.8.168" ||
    overrideIp === "192.168.8.168" ||
    String(overrideKiosk).toUpperCase() === "ORDER" ||
    String(overrideKiosk).toUpperCase() === "ORDERING" ||
    path.includes("/order")
  ) {
    return {
      ...KIOSK_CONFIG.ORDERING,
      detectedIp: clientIp || "192.168.8.168",
      sourceHeader: overrideIp ? "OVERRIDDEN_IP" : "CLIENT_IP"
    };
  }

  // 2. Receiving Kiosk match (IP: 192.168.8.160 or /receive route or override)
  if (
    clientIp === "192.168.8.160" ||
    overrideIp === "192.168.8.160" ||
    String(overrideKiosk).toUpperCase() === "RECEIVE" ||
    String(overrideKiosk).toUpperCase() === "RECEIVING" ||
    path.includes("/receive")
  ) {
    return {
      ...KIOSK_CONFIG.RECEIVING,
      detectedIp: clientIp || "192.168.8.160",
      sourceHeader: overrideIp ? "OVERRIDDEN_IP" : "CLIENT_IP"
    };
  }

  // 3. Fallback / Generic device
  return {
    ip: clientIp || "127.0.0.1",
    port: 4370,
    name: `Biometric Terminal (${clientIp || "Local"})`,
    role: "GENERAL_KIOSK",
    type: "GENERAL",
    targetAction: "GENERAL",
    targetRoute: "/kiosk",
    detectedIp: clientIp || "127.0.0.1"
  };
}

// Extract Employee ID helper from text, ZK ADMS punch or tab strings
function extractEmployeeId(data) {
  if (!data) return "";
  if (typeof data === "object") {
    return data.employee_id || data.emp_id || data.id || data.PIN || data.pin || "";
  }
  const str = String(data).trim();
  if (str.startsWith("{") && str.endsWith("}")) {
    try {
      const obj = JSON.parse(str);
      return obj.employee_id || obj.emp_id || obj.id || "";
    } catch {}
  }
  // Tab separated: EMP001\tName\tRole
  const parts = str.replace(/\\t/g, "\t").split("\t");
  if (parts.length > 0 && parts[0]) {
    const match = parts[0].match(/(?:PIN|USERID|ID)=([a-zA-Z0-9_-]+)/i);
    if (match) return match[1];
    return parts[0].trim();
  }
  return str;
}

// Broadcast helper via WebSocket
function broadcastFingerprint(data, kioskInfo, source = "BIOMETRIC_DEVICE") {
  const empId = extractEmployeeId(data);
  const logEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    source,
    sourceIp: kioskInfo.detectedIp || kioskInfo.ip,
    port: kioskInfo.port || 4370,
    kioskName: kioskInfo.name,
    kioskType: kioskInfo.type,
    kioskRole: kioskInfo.role,
    targetAction: kioskInfo.targetAction,
    targetRoute: kioskInfo.targetRoute,
    employeeId: empId,
    raw: typeof data === "string" ? data : JSON.stringify(data),
    data
  };

  scanLogs.unshift(logEntry);
  if (scanLogs.length > MAX_LOGS) scanLogs.pop();

  const message = JSON.stringify({
    type: "FINGERPRINT_EVENT",
    payload: data,
    employee_id: empId,
    kiosk: kioskInfo,
    log: logEntry
  });

  console.log(`[Biometric Middleware] Broadcasted POST event from ${kioskInfo.name} (${kioskInfo.detectedIp}:${kioskInfo.port}) -> Action: ${kioskInfo.targetAction}`);

  // Broadcast to all active WebSocket clients (Electron, Web UI, Kiosks)
  broadcastToWebSockets(message);

  return logEntry;
}

const activeWsClients = new Set();

function broadcastToWebSockets(message) {
  activeWsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (e) {
        console.warn("WebSocket send error:", e);
      }
    }
  });
}

// -------------------------------------------------------------
// POST Handlers for Physical Kiosks (192.168.8.168 & 192.168.8.160)
// -------------------------------------------------------------

// Universal POST Listener for all biometric device endpoints
app.post(
  [
    "/",
    "/fingerprint",
    "/api/fingerprint",
    "/iclock/cdata",
    "/iclock/fdata",
    "/order",
    "/api/kiosk/order",
    "/receive",
    "/api/kiosk/receive"
  ],
  (req, res) => {
    const body = req.body;
    const kioskInfo = detectKioskSource(req);
    
    console.log(`[Biometric Middleware] POST received from ${kioskInfo.name} (${kioskInfo.detectedIp}):`, body);

    if (!body && Object.keys(req.query).length === 0) {
      return res.status(400).send("Empty payload");
    }

    const payload = body || req.query;
    const log = broadcastFingerprint(payload, kioskInfo, "PHYSICAL_DEVICE");

    // Return standard 200 OK (ADMS / ZKTeco push format compatible)
    if (req.accepts("json") && !req.accepts("text/plain")) {
      res.status(200).json({ success: true, kiosk: kioskInfo, log });
    } else {
      res.status(200).send("OK");
    }
  }
);

// Simulation endpoint for dev & testing console
app.post("/api/simulate", (req, res) => {
  const { employee_id, name, designation, raw, kiosk, ip } = req.body || {};
  let payload = raw;
  if (!payload && employee_id) {
    payload = `${employee_id}\t${name || ""}\t${designation || ""}`;
  }

  // Create simulated request object to resolve kiosk
  const fakeReq = {
    headers: {},
    query: {},
    body: { kiosk, ip },
    path: kiosk === "ORDERING" ? "/order" : kiosk === "RECEIVING" ? "/receive" : "/",
    socket: { remoteAddress: ip || (kiosk === "ORDERING" ? "192.168.8.168" : kiosk === "RECEIVING" ? "192.168.8.160" : "127.0.0.1") }
  };

  const kioskInfo = detectKioskSource(fakeReq);
  const log = broadcastFingerprint(payload || "EMP001\tTest User\tStaff", kioskInfo, "UI_SIMULATOR");
  res.status(200).json({ success: true, kiosk: kioskInfo, log });
});

// Health check & Kiosk Configuration API
app.get(["/status", "/api/status"], (req, res) => {
  res.json({
    status: "online",
    ports: [PRIMARY_PORT, SECONDARY_PORT],
    connectedClients: activeWsClients.size,
    serverTime: new Date().toISOString(),
    kiosks: KIOSK_CONFIG
  });
});

app.get("/api/kiosk/config", (req, res) => {
  res.json({
    kiosks: KIOSK_CONFIG,
    activePorts: [PRIMARY_PORT, SECONDARY_PORT]
  });
});

app.get("/api/logs", (req, res) => {
  res.json({ logs: scanLogs });
});

// -------------------------------------------------------------
// Server & WebSocket Initialization
// -------------------------------------------------------------
const primaryServer = http.createServer(app);
const primaryWss = new WebSocketServer({ server: primaryServer });

function setupWebSocket(wss, portLabel) {
  wss.on("connection", (ws) => {
    activeWsClients.add(ws);
    console.log(`[Biometric Middleware] UI Client connected via WebSocket on ${portLabel}.`);

    ws.send(
      JSON.stringify({
        type: "CONNECTION_ACK",
        message: `Connected to Biometric Middleware on port ${portLabel}`,
        kiosks: KIOSK_CONFIG,
        logs: scanLogs.slice(0, 10)
      })
    );

    ws.on("message", (message) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (parsed.type === "SIMULATE_SCAN") {
          const fakeReq = {
            headers: {},
            query: {},
            body: { kiosk: parsed.kiosk, ip: parsed.ip },
            path: "/",
            socket: { remoteAddress: parsed.ip || "127.0.0.1" }
          };
          const kioskInfo = detectKioskSource(fakeReq);
          broadcastFingerprint(parsed.payload, kioskInfo, "WS_CLIENT_SIMULATOR");
        }
      } catch (e) {
        console.error("Error processing ws message:", e);
      }
    });

    ws.on("close", () => {
      activeWsClients.delete(ws);
      console.log(`[Biometric Middleware] Client disconnected from ${portLabel}.`);
    });
  });
}

setupWebSocket(primaryWss, `Port ${PRIMARY_PORT}`);

// Listen on 0.0.0.0 so network kiosk devices (192.168.8.168 & 192.168.8.160) can transmit POST calls directly
primaryServer.listen(PRIMARY_PORT, "0.0.0.0", () => {
  console.log(`=======================================================`);
  console.log(`🚀 Hayleys Biometric Kiosk Middleware Active`);
  console.log(`📡 Listening on: http://0.0.0.0:${PRIMARY_PORT}`);
  console.log(`📱 Ordering Kiosk IP:  192.168.8.168 (Port: 4370) -> Target: Order Meals`);
  console.log(`🍲 Receiving Kiosk IP: 192.168.8.160 (Port: 4370) -> Target: Receive Meals`);
  console.log(`🔌 WebSocket Stream:   ws://0.0.0.0:${PRIMARY_PORT}`);
  console.log(`=======================================================`);
});

// Also start secondary listener (Port 5000 / 4370) for seamless fallback/backward compatibility
const secondaryServer = http.createServer(app);
const secondaryWss = new WebSocketServer({ server: secondaryServer });
setupWebSocket(secondaryWss, `Port ${SECONDARY_PORT}`);

secondaryServer.listen(SECONDARY_PORT, "0.0.0.0", () => {
  console.log(`🔁 Dual Port Listener active on http://0.0.0.0:${SECONDARY_PORT}`);
}).on("error", (err) => {
  console.log(`[Notice] Secondary listener port ${SECONDARY_PORT} notice: ${err.message}`);
});
