import http from "http";
import express from "express";
import cors from "cors";
import os from "os";
import { WebSocketServer, WebSocket } from "ws";

// Primary Port (4370 as standard for ZKTeco ADMS & biometric terminals) and Secondary fallback (5000)
const PRIMARY_PORT = parseInt(process.env.PORT || "4370", 10);
const SECONDARY_PORT = PRIMARY_PORT === 4370 ? 5000 : 4370;

// Configured Kiosk Endpoints
let KIOSK_CONFIG = {
  ORDERING: {
    ip: "192.168.8.168",
    port: 4370,
    sn: "",
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
    sn: "",
    name: "Receiving Kiosk",
    sinhala: "කෑම ලබාගැනීමේ කියෝස්කය",
    role: "RECEIVING_KIOSK",
    type: "RECEIVING",
    targetAction: "RECEIVE",
    targetRoute: "/meals/receive"
  }
};

// Discovered physical devices on the network
const discoveredDevices = new Map();

// Discover local IPv4 network addresses
function getLocalNetworkIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === "IPv4" && !net.internal) {
        ips.push({ iface: name, ip: net.address });
      }
    }
  }
  return ips;
}

const app = express();

// Enable Cross-Origin Resource Sharing
app.use(cors({ origin: "*" }));

// Support plain text, urlencoded, json, and octet-stream for ZKTeco ADMS
app.use(
  express.text({
    type: "*/*",
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    }
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// In-memory log buffer
const scanLogs = [];
const MAX_LOGS = 150;

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

// Request Logger Middleware
app.use((req, res, next) => {
  const clientIp = normalizeIp(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip);
  const sn = req.query?.SN || req.query?.sn || "";
  const snInfo = sn ? ` [SN: ${sn}]` : "";
  console.log(`[HTTP ${req.method}] ${req.originalUrl} from ${clientIp}${snInfo}`);
  next();
});

// Helper to detect if request came from Ordering Kiosk (192.168.8.168) or Receiving Kiosk (192.168.8.160)
function detectKioskSource(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const remote = forwarded ? forwarded.split(",")[0].trim() : (req.socket?.remoteAddress || req.ip || "");
  const clientIp = normalizeIp(remote);

  // Check query params, headers or body
  const sn = req.query?.SN || req.query?.sn || req.body?.SN || req.body?.sn || "";
  const overrideKiosk = req.query?.kiosk || req.headers["x-kiosk-type"] || req.body?.kiosk || "";
  const overrideIp = req.query?.ip || req.headers["x-device-ip"] || req.body?.ip || "";
  const path = (req.path || "").toLowerCase();

  const orderingIp = KIOSK_CONFIG.ORDERING.ip;
  const receivingIp = KIOSK_CONFIG.RECEIVING.ip;
  const orderingSn = KIOSK_CONFIG.ORDERING.sn;
  const receivingSn = KIOSK_CONFIG.RECEIVING.sn;

  // Track discovered device
  if (sn || (clientIp && clientIp !== "127.0.0.1")) {
    discoveredDevices.set(sn || clientIp, {
      ip: clientIp,
      sn: sn || "N/A",
      lastSeen: new Date().toISOString(),
      userAgent: req.headers["user-agent"] || "ZKTeco Terminal"
    });
  }

  // 1. Ordering Kiosk match (IP: 192.168.8.168, SN match, /order route or override)
  if (
    clientIp === orderingIp ||
    overrideIp === orderingIp ||
    (sn && orderingSn && sn === orderingSn) ||
    String(overrideKiosk).toUpperCase() === "ORDER" ||
    String(overrideKiosk).toUpperCase() === "ORDERING" ||
    path.includes("/order")
  ) {
    return {
      ...KIOSK_CONFIG.ORDERING,
      sn: sn || KIOSK_CONFIG.ORDERING.sn,
      detectedIp: clientIp || orderingIp,
      sourceHeader: overrideIp ? "OVERRIDDEN_IP" : (sn ? "DEVICE_SN" : "CLIENT_IP")
    };
  }

  // 2. Receiving Kiosk match (IP: 192.168.8.160, SN match, /receive route or override)
  if (
    clientIp === receivingIp ||
    overrideIp === receivingIp ||
    (sn && receivingSn && sn === receivingSn) ||
    String(overrideKiosk).toUpperCase() === "RECEIVE" ||
    String(overrideKiosk).toUpperCase() === "RECEIVING" ||
    path.includes("/receive")
  ) {
    return {
      ...KIOSK_CONFIG.RECEIVING,
      sn: sn || KIOSK_CONFIG.RECEIVING.sn,
      detectedIp: clientIp || receivingIp,
      sourceHeader: overrideIp ? "OVERRIDDEN_IP" : (sn ? "DEVICE_SN" : "CLIENT_IP")
    };
  }

  // 3. Fallback / Generic device
  return {
    ip: clientIp || "127.0.0.1",
    port: PRIMARY_PORT,
    sn: sn || "GENERIC",
    name: `Biometric Terminal (${clientIp || "Local"})`,
    role: "GENERAL_KIOSK",
    type: "GENERAL",
    targetAction: "GENERAL",
    targetRoute: "/kiosk",
    detectedIp: clientIp || "127.0.0.1"
  };
}

// Extract Employee ID / PIN helper from text, ZK ADMS punch or tab-separated strings
function extractEmployeeId(data) {
  if (!data) return "";
  if (typeof data === "object") {
    return String(data.employee_id || data.emp_id || data.id || data.PIN || data.pin || data.UserID || data.userid || "").trim();
  }
  const str = String(data).trim();
  if (str.startsWith("{") && str.endsWith("}")) {
    try {
      const obj = JSON.parse(str);
      return String(obj.employee_id || obj.emp_id || obj.id || obj.PIN || obj.pin || "").trim();
    } catch {}
  }

  // Handle format: PIN=1001\tTime=... or USERID=1001
  const pinMatch = str.match(/(?:PIN|USERID|ID|CARD)\s*=\s*([a-zA-Z0-9_-]+)/i);
  if (pinMatch) return pinMatch[1].trim();

  // Tab or Space separated: 1001\t2026-10-05 14:30:00\t1\t1...
  const lines = str.split(/[\r\n]+/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("CMD=") || trimmed.startsWith("Stamp=")) continue;
    const parts = trimmed.replace(/\\t/g, "\t").split(/\t+/);
    if (parts.length > 0 && parts[0]) {
      const field = parts[0].trim();
      const subMatch = field.match(/(?:PIN|USERID|ID)=([a-zA-Z0-9_-]+)/i);
      if (subMatch) return subMatch[1];
      if (/^[a-zA-Z0-9_-]+$/.test(field)) return field;
    }
  }

  return str;
}

const FIREBASE_PROJECT_ID = "meal-management-system-ac8ca";
const FIREBASE_API_KEY = "AIzaSyBMHPcENLLt4uYIjCQIxNWrx339Aksv8Js";

// Synchronize event with Firestore Cloud so HTTPS web apps receive live scans without mixed-content blocking
async function pushEventToFirestoreRest(data, kioskInfo, logEntry) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/system_state/latest_kiosk_event?key=${FIREBASE_API_KEY}`;
    const payload = {
      fields: {
        type: { stringValue: "FINGERPRINT_EVENT" },
        employee_id: { stringValue: String(logEntry.employeeId || "") },
        source: { stringValue: String(logEntry.source || "BIOMETRIC_DEVICE") },
        sourceIp: { stringValue: String(kioskInfo.detectedIp || kioskInfo.ip || "") },
        port: { integerValue: String(kioskInfo.port || PRIMARY_PORT) },
        kioskName: { stringValue: String(kioskInfo.name || "") },
        kioskType: { stringValue: String(kioskInfo.type || "") },
        kioskRole: { stringValue: String(kioskInfo.role || "") },
        targetAction: { stringValue: String(kioskInfo.targetAction || "") },
        targetRoute: { stringValue: String(kioskInfo.targetRoute || "") },
        raw: { stringValue: String(logEntry.raw || "") },
        timestamp: { stringValue: logEntry.timestamp },
        id: { stringValue: logEntry.id }
      }
    };

    fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000)
    }).catch(() => {});
  } catch (err) {
    // Non-blocking
  }
}

// Broadcast helper via WebSocket & Firestore
function broadcastFingerprint(data, kioskInfo, source = "BIOMETRIC_DEVICE") {
  const empId = extractEmployeeId(data);
  const logEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    source,
    sourceIp: kioskInfo.detectedIp || kioskInfo.ip,
    port: kioskInfo.port || PRIMARY_PORT,
    sn: kioskInfo.sn || "N/A",
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

  console.log(`[Biometric Middleware] ⚡ BROADCAST: ${kioskInfo.name} (${kioskInfo.detectedIp}:${kioskInfo.port}) -> Action: ${kioskInfo.targetAction} [Employee: ${empId || "UNKNOWN"}]`);

  // 1. Broadcast to local WebSocket clients (Desktop/Electron/Local network)
  broadcastToWebSockets(message);

  // 2. Synchronize to Firestore Cloud so HTTPS web clients receive it in real-time
  pushEventToFirestoreRest(data, kioskInfo, logEntry);

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
// ZKTeco MB360 ADMS / PUSH SDK Protocol Endpoints
// -------------------------------------------------------------

/**
 * 1. ZKTeco Device Handshake (GET /iclock/cdata)
 * When MB360 connects, it sends: GET /iclock/cdata?SN=<SN>&options=all&pushver=2.4.1
 * The server MUST return plain text configuration headers.
 */
app.get(["/iclock/cdata", "/cdata"], (req, res) => {
  const sn = req.query?.SN || req.query?.sn || "UNKNOWN_DEVICE";
  const kioskInfo = detectKioskSource(req);
  console.log(`[ZKTeco ADMS] Handshake GET from Device SN: ${sn} (${kioskInfo.detectedIp}) -> Assigned: ${kioskInfo.name}`);

  // Response required by ZKTeco ADMS / MB360 firmware
  const responseBody = [
    `GET OPTION FROM: ${sn}`,
    "ATTLOGStamp=0",
    "OPERLOGStamp=0",
    "ATTPHOTOStamp=0",
    "ErrorDelay=3",
    "Delay=10",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=1111000000",
    "TimeZone=5.5",
    "Realtime=1",
    "Encrypt=0",
    "ServerVersion=2.4.1",
    ""
  ].join("\n");

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Cache-Control", "no-cache");
  return res.status(200).send(responseBody);
});

/**
 * 2. ZKTeco Device Poll / Heartbeat (GET /iclock/getrequest)
 * Device regularly polls for pending cloud commands.
 */
app.get(["/iclock/getrequest", "/getrequest"], (req, res) => {
  const sn = req.query?.SN || req.query?.sn || "";
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.status(200).send("OK\n");
});

/**
 * 3. ZKTeco Device Punch Push (POST /iclock/cdata)
 * MB360 posts attendance records when a user punches.
 */
app.post(["/iclock/cdata", "/cdata"], (req, res) => {
  const sn = req.query?.SN || req.query?.sn || "";
  const table = req.query?.table || req.query?.Table || "ATTLOG";
  const kioskInfo = detectKioskSource(req);
  
  const rawPayload = req.rawBody || req.body || "";
  const bodyStr = typeof rawPayload === "string" ? rawPayload : JSON.stringify(rawPayload);

  console.log(`[ZKTeco ADMS] POST Punch received from ${kioskInfo.name} (${kioskInfo.detectedIp}) [SN: ${sn}, Table: ${table}]`);
  console.log(`[ZKTeco ADMS Raw Body]:\n${bodyStr}`);

  let processedCount = 0;

  if (bodyStr && bodyStr.trim()) {
    // Split multi-line punches
    const lines = bodyStr.split(/[\r\n]+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("CMD=") || trimmed.startsWith("Stamp=")) continue;
      broadcastFingerprint(trimmed, kioskInfo, "ZKTECO_MB360_PUSH");
      processedCount++;
    }
  }

  if (processedCount === 0 && Object.keys(req.query).length > 0) {
    // If sent via query params
    broadcastFingerprint(req.query, kioskInfo, "ZKTECO_MB360_PUSH");
    processedCount = 1;
  }

  // ZKTeco firmware requires exact "OK: <count>\n" or "OK\n"
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.status(200).send(`OK: ${processedCount || 1}\n`);
});

/**
 * 4. ZKTeco Device Command Acknowledgment (POST /iclock/devicecmd)
 */
app.post(["/iclock/devicecmd", "/devicecmd"], (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.status(200).send("OK\n");
});

/**
 * 5. ZKTeco BioData / Photo / Template Push (POST /iclock/fdata & GET /iclock/fdata)
 */
app.all(["/iclock/fdata", "/fdata"], (req, res) => {
  const kioskInfo = detectKioskSource(req);
  console.log(`[ZKTeco ADMS] /iclock/fdata called from ${kioskInfo.detectedIp}`);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.status(200).send("OK\n");
});

/**
 * 6. ZKTeco Device Registry & Ping (POST/GET /iclock/registry, /iclock/ping, /iclock/options)
 */
app.all(["/iclock/registry", "/iclock/ping", "/iclock/options"], (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.status(200).send("OK\n");
});

// -------------------------------------------------------------
// Universal Generic POST Listener for Webhook / REST / Custom Kiosks
// -------------------------------------------------------------
app.post(
  [
    "/",
    "/fingerprint",
    "/api/fingerprint",
    "/order",
    "/api/kiosk/order",
    "/receive",
    "/api/kiosk/receive"
  ],
  (req, res) => {
    const rawPayload = req.rawBody || req.body;
    const kioskInfo = detectKioskSource(req);
    
    console.log(`[Biometric Middleware] Universal POST received from ${kioskInfo.name} (${kioskInfo.detectedIp}):`, rawPayload);

    if (!rawPayload && Object.keys(req.query).length === 0) {
      return res.status(400).send("Empty payload");
    }

    const payload = rawPayload || req.query;
    const log = broadcastFingerprint(payload, kioskInfo, "UNIVERSAL_POST");

    // Return standard response
    if (req.accepts("json") && !req.accepts("text/plain")) {
      res.status(200).json({ success: true, kiosk: kioskInfo, log });
    } else {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.status(200).send("OK\n");
    }
  }
);

// Simulation endpoint for dev & testing console
app.post("/api/simulate", (req, res) => {
  const { employee_id, name, designation, raw, kiosk, ip, sn } = req.body || {};
  let payload = raw;
  if (!payload && employee_id) {
    payload = `${employee_id}\t${name || ""}\t${designation || ""}`;
  }

  const orderingIp = KIOSK_CONFIG.ORDERING.ip;
  const receivingIp = KIOSK_CONFIG.RECEIVING.ip;

  // Create simulated request object to resolve kiosk
  const fakeReq = {
    headers: {},
    query: { SN: sn || "" },
    body: { kiosk, ip, SN: sn },
    path: kiosk === "ORDERING" ? "/order" : kiosk === "RECEIVING" ? "/receive" : "/",
    socket: { remoteAddress: ip || (kiosk === "ORDERING" ? orderingIp : kiosk === "RECEIVING" ? receivingIp : "127.0.0.1") }
  };

  const kioskInfo = detectKioskSource(fakeReq);
  const log = broadcastFingerprint(payload || "EMP001\tTest User\tStaff", kioskInfo, "UI_SIMULATOR");
  res.status(200).json({ success: true, kiosk: kioskInfo, log });
});

// Health check & Kiosk Configuration API
app.get(["/status", "/api/status"], (req, res) => {
  const localIps = getLocalNetworkIps();
  res.json({
    status: "online",
    ports: [PRIMARY_PORT, SECONDARY_PORT],
    primaryPort: PRIMARY_PORT,
    secondaryPort: SECONDARY_PORT,
    connectedClients: activeWsClients.size,
    serverTime: new Date().toISOString(),
    localNetworkIps: localIps,
    kiosks: KIOSK_CONFIG,
    discoveredDevices: Array.from(discoveredDevices.values())
  });
});

app.get("/api/kiosk/config", (req, res) => {
  res.json({
    kiosks: KIOSK_CONFIG,
    activePorts: [PRIMARY_PORT, SECONDARY_PORT],
    localNetworkIps: getLocalNetworkIps(),
    discoveredDevices: Array.from(discoveredDevices.values())
  });
});

// Update Kiosk Config API (allows modifying Ordering or Receiving Kiosk IP/Port/SN dynamically)
app.post("/api/kiosk/config", (req, res) => {
  const { ORDERING, RECEIVING } = req.body || {};
  if (ORDERING && typeof ORDERING === "object") {
    KIOSK_CONFIG.ORDERING = { ...KIOSK_CONFIG.ORDERING, ...ORDERING };
  }
  if (RECEIVING && typeof RECEIVING === "object") {
    KIOSK_CONFIG.RECEIVING = { ...KIOSK_CONFIG.RECEIVING, ...RECEIVING };
  }
  console.log("[Biometric Middleware] Updated Kiosk Endpoints Configuration:", KIOSK_CONFIG);
  res.json({ success: true, kiosks: KIOSK_CONFIG });
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
    console.log(`[Biometric Middleware] UI Client connected via WebSocket on ${portLabel}. (Total clients: ${activeWsClients.size})`);

    ws.send(
      JSON.stringify({
        type: "CONNECTION_ACK",
        message: `Connected to Biometric Middleware on port ${portLabel}`,
        ports: [PRIMARY_PORT, SECONDARY_PORT],
        kiosks: KIOSK_CONFIG,
        localNetworkIps: getLocalNetworkIps(),
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
  const ips = getLocalNetworkIps();
  console.log(`=======================================================`);
  console.log(`🚀 Hayleys Biometric Kiosk Middleware Active`);
  console.log(`📡 Listening on: http://0.0.0.0:${PRIMARY_PORT} & Port ${SECONDARY_PORT}`);
  console.log(`🌐 Server LAN IPs: ${ips.map(i => `${i.iface}: ${i.ip}`).join(", ") || "127.0.0.1"}`);
  console.log(`📱 Ordering Kiosk IP:  ${KIOSK_CONFIG.ORDERING.ip} (Port: ${KIOSK_CONFIG.ORDERING.port}) -> Target: Order Meals (/meals/order)`);
  console.log(`🍲 Receiving Kiosk IP: ${KIOSK_CONFIG.RECEIVING.ip} (Port: ${KIOSK_CONFIG.RECEIVING.port}) -> Target: Receive Meals (/meals/receive)`);
  console.log(`🔌 WebSocket Stream:   ws://0.0.0.0:${PRIMARY_PORT} & ws://0.0.0.0:${SECONDARY_PORT}`);
  console.log(`-------------------------------------------------------`);
  console.log(`⚙️  ZKTeco MB360 ADMS Settings:`);
  console.log(`   - Server IP: ${ips[0]?.ip || "10.40.15.115"} (Enter THIS PC's IP in MB360 ADMS Menu)`);
  console.log(`   - Server Port: ${PRIMARY_PORT} or ${SECONDARY_PORT}`);
  console.log(`   - Enable Domain Name: OFF`);
  console.log(`=======================================================`);
});

// Also start secondary listener (Port 5000 / 4370) for seamless fallback/backward compatibility
const secondaryServer = http.createServer(app);
const secondaryWss = new WebSocketServer({ server: secondaryServer });
setupWebSocket(secondaryWss, `Port ${SECONDARY_PORT}`);

secondaryServer.listen(SECONDARY_PORT, "0.0.0.0", () => {
  console.log(`🔁 Dual Port Listener active on http://0.0.0.0:${SECONDARY_PORT} (ws://0.0.0.0:${SECONDARY_PORT})`);
}).on("error", (err) => {
  console.log(`[Notice] Secondary listener port ${SECONDARY_PORT} notice: ${err.message}`);
});
