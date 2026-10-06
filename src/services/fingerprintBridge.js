/**
 * Biometric & Multi-Kiosk WebSocket & Firestore Cloud Bridge
 * Supports both:
 * 1. Direct Local / LAN WebSocket connections (192.168.8.168, 192.168.8.160, 10.40.15.115, 127.0.0.1)
 * 2. Real-Time Firestore Cloud Sync (for Web Apps running on DIFFERENT PCs / Tablets / HTTPS)
 */

import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase/config";

export const DEFAULT_KIOSK_DEVICES = {
  ORDERING: {
    ip: "192.168.8.168",
    port: 4370,
    secondaryPort: 5000,
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
    secondaryPort: 5000,
    name: "Receiving Kiosk",
    sinhala: "කෑම ලබාගැනීමේ කියෝස්කය",
    role: "RECEIVING_KIOSK",
    type: "RECEIVING",
    targetAction: "RECEIVE",
    targetRoute: "/meals/receive"
  },
  LOCAL: {
    ip: "127.0.0.1",
    port: 4370,
    secondaryPort: 5000,
    name: "Local Middleware",
    sinhala: "දේශීය සේවාදායකය",
    role: "LOCAL_BRIDGE",
    type: "LOCAL",
    targetAction: "GENERAL",
    targetRoute: "/kiosk"
  }
};

export let KIOSK_DEVICES = {
  ORDERING: { ...DEFAULT_KIOSK_DEVICES.ORDERING },
  RECEIVING: { ...DEFAULT_KIOSK_DEVICES.RECEIVING },
  LOCAL: { ...DEFAULT_KIOSK_DEVICES.LOCAL }
};

export function loadStoredKioskDevices() {
  if (typeof window === "undefined") return DEFAULT_KIOSK_DEVICES;
  try {
    const stored = localStorage.getItem("kiosk_devices_config");
    if (stored) {
      const parsed = JSON.parse(stored);
      KIOSK_DEVICES = {
        ORDERING: { ...DEFAULT_KIOSK_DEVICES.ORDERING, ...(parsed.ORDERING || {}) },
        RECEIVING: { ...DEFAULT_KIOSK_DEVICES.RECEIVING, ...(parsed.RECEIVING || {}) },
        LOCAL: { ...DEFAULT_KIOSK_DEVICES.LOCAL, ...(parsed.LOCAL || {}) }
      };
      return KIOSK_DEVICES;
    }
  } catch (e) {
    console.warn("Error reading stored kiosk devices:", e);
  }
  KIOSK_DEVICES = {
    ORDERING: { ...DEFAULT_KIOSK_DEVICES.ORDERING },
    RECEIVING: { ...DEFAULT_KIOSK_DEVICES.RECEIVING },
    LOCAL: { ...DEFAULT_KIOSK_DEVICES.LOCAL }
  };
  return KIOSK_DEVICES;
}

loadStoredKioskDevices();

export function isPrivateNetworkHost(hostname) {
  if (!hostname) return false;
  const h = String(hostname).toLowerCase().trim();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (h.endsWith(".local") || h.endsWith(".lan") || h.endsWith(".internal")) return true;
  return false;
}

export function getMiddlewareHost() {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("kiosk_middleware_host") || localStorage.getItem("kiosk_middleware_ip");
    if (custom && custom.trim()) {
      return custom.trim();
    }
  }
  return KIOSK_DEVICES.ORDERING.ip || "192.168.8.168";
}

export function getMiddlewarePorts() {
  return [4370, 5000];
}

// -------------------------------------------------------------
// Multi-Endpoint Socket & Cloud Event Manager
// -------------------------------------------------------------

const socketPool = new Map(); // key -> { ws, endpointConfig, isConnected, activePort, timer }
const listeners = new Set();
const connectionListeners = new Set();
const processedEventIds = new Set();

const kioskStatuses = {
  ORDERING: { connected: false, ip: KIOSK_DEVICES.ORDERING.ip, port: 4370 },
  RECEIVING: { connected: false, ip: KIOSK_DEVICES.RECEIVING.ip, port: 4370 },
  LOCAL: { connected: false, ip: "127.0.0.1", port: 4370 },
  CLOUD_SYNC: { connected: true, ip: "firestore.googleapis.com", port: 443 }
};

function emitConnectionState() {
  const isAnyConnected = Object.values(kioskStatuses).some((s) => s.connected);
  const activeEndpoint = Object.values(kioskStatuses).find((s) => s.connected) || {
    port: 4370,
    ip: KIOSK_DEVICES.ORDERING.ip
  };

  connectionListeners.forEach((fn) => {
    try {
      fn(isAnyConnected, activeEndpoint.port, activeEndpoint.ip, kioskStatuses);
    } catch (e) {
      console.warn("Connection listener notification error:", e);
    }
  });
}

function notifyListeners(eventData) {
  // Deduplicate events to prevent double triggers when both WebSocket and Firestore receive the scan
  const eventId = eventData?.log?.id || eventData?.id || `${eventData?.employee_id}_${eventData?.log?.timestamp || Date.now()}`;
  if (eventId && processedEventIds.has(eventId)) {
    return;
  }
  if (eventId) {
    processedEventIds.add(eventId);
    if (processedEventIds.size > 200) {
      const first = processedEventIds.values().next().value;
      processedEventIds.delete(first);
    }
  }

  listeners.forEach((fn) => {
    try {
      fn(eventData);
    } catch (err) {
      console.error("Error in fingerprint listener callback:", err);
    }
  });
}

/**
 * Connect to a specific endpoint (ORDERING, RECEIVING, or LOCAL)
 */
function startEndpointSocket(endpointKey, portIndex = 0) {
  if (typeof WebSocket === "undefined") return;

  const config = KIOSK_DEVICES[endpointKey];
  if (!config || !config.ip) return;

  const ports = [config.port || 4370, config.secondaryPort || 5000].filter((v, i, a) => a.indexOf(v) === i);
  const port = ports[portIndex % ports.length];
  const targetIp = config.ip;
  const wsUrl = `ws://${targetIp}:${port}`;

  // Close existing socket for this endpoint if any
  const existing = socketPool.get(endpointKey);
  if (existing?.ws && (existing.ws.readyState === WebSocket.OPEN || existing.ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  if (existing?.timer) {
    clearTimeout(existing.timer);
  }

  console.log(`[Multi-Kiosk Bridge] 🔌 Connecting ${config.name} socket -> ${wsUrl}`);

  try {
    const ws = new WebSocket(wsUrl);

    socketPool.set(endpointKey, {
      ws,
      endpointKey,
      targetIp,
      activePort: port,
      portIndex,
      timer: null
    });

    ws.onopen = () => {
      console.log(`[Multi-Kiosk Bridge] ✅ ${config.name} (${targetIp}:${port}) connected!`);
      kioskStatuses[endpointKey] = { connected: true, ip: targetIp, port };
      emitConnectionState();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "FINGERPRINT_EVENT") {
          console.log(`[Multi-Kiosk Bridge] ⚡ Biometric punch received on ${config.name}:`, message);
          // Tag event with exact kiosk details
          const enrichedEvent = {
            ...message,
            kiosk: {
              ...config,
              ...(message.kiosk || {}),
              ip: targetIp,
              port
            }
          };
          notifyListeners(enrichedEvent);
        } else if (message.type === "CONNECTION_ACK") {
          console.log(`[Multi-Kiosk Bridge] 🤝 Handshake ACK from ${config.name} (${targetIp}:${port}):`, message.message);
        }
      } catch (err) {
        notifyListeners({ payload: event.data, kiosk: config });
      }
    };

    ws.onclose = () => {
      kioskStatuses[endpointKey] = { connected: false, ip: targetIp, port };
      emitConnectionState();
      scheduleEndpointReconnect(endpointKey, portIndex + 1);
    };

    ws.onerror = () => {
      kioskStatuses[endpointKey] = { connected: false, ip: targetIp, port };
      emitConnectionState();
      try { ws.close(); } catch {}
    };
  } catch (err) {
    kioskStatuses[endpointKey] = { connected: false, ip: targetIp, port };
    emitConnectionState();
    scheduleEndpointReconnect(endpointKey, portIndex + 1);
  }
}

function scheduleEndpointReconnect(endpointKey, nextPortIndex = 0, delay = 4000) {
  const current = socketPool.get(endpointKey) || {};
  if (current.timer) clearTimeout(current.timer);

  const timer = setTimeout(() => {
    startEndpointSocket(endpointKey, nextPortIndex);
  }, delay);

  socketPool.set(endpointKey, { ...current, timer });
}

let firestoreUnsubscribe = null;
const BRIDGE_START_TIME = Date.now() - 5000; // Only process events within or after session start

/**
 * Listen to Firestore Cloud for punches pushed from the Middleware Server PC
 * This enables web apps running on DIFFERENT PCs / Tablets to receive live scans instantly!
 */
function initFirestoreCloudBridge() {
  if (firestoreUnsubscribe) return;

  try {
    const eventDocRef = doc(db, "system_state", "latest_kiosk_event");
    firestoreUnsubscribe = onSnapshot(
      eventDocRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        if (!data || !data.employee_id) return;

        // Verify event is fresh (within last 12 seconds)
        const eventTime = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();
        if (eventTime < BRIDGE_START_TIME) {
          return; // Skip historical stale event from previous session
        }

        console.log(`[Cloud Bridge] ☁️ Live biometric event received from Firestore Cloud:`, data);

        const cloudKiosk = {
          name: data.kioskName || (data.kioskType === "ORDERING" ? "Ordering Kiosk" : "Receiving Kiosk"),
          type: data.kioskType || "ORDERING",
          role: data.kioskRole || "ORDERING_KIOSK",
          targetAction: data.targetAction || "ORDER",
          targetRoute: data.targetRoute || "/meals/order",
          ip: data.sourceIp || "192.168.8.168",
          port: data.port || 4370
        };

        const eventData = {
          type: "FINGERPRINT_EVENT",
          payload: data.raw || data.employee_id,
          employee_id: data.employee_id,
          kiosk: cloudKiosk,
          log: data
        };

        notifyListeners(eventData);
      },
      (error) => {
        console.warn("[Cloud Bridge] Firestore sync listener notice:", error);
      }
    );

    kioskStatuses.CLOUD_SYNC = { connected: true, ip: "firestore.googleapis.com", port: 443 };
    emitConnectionState();
  } catch (err) {
    console.warn("Firestore bridge init error:", err);
  }
}

/**
 * Initialize Multi-Kiosk WebSocket Bridges for Ordering, Receiving, Local, and Cloud Sync
 */
export function initFingerprintBridge() {
  loadStoredKioskDevices();

  // 1. Hook to Electron IPC if available
  if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.onFingerprint) {
    window.electronAPI.onFingerprint((event, data) => {
      console.log("[Bridge IPC] Fingerprint received from Electron:", data);
      notifyListeners(data);
    });
  }

  // 2. Launch concurrent WebSockets directly to the given IPs
  startEndpointSocket("ORDERING", 0);
  startEndpointSocket("RECEIVING", 0);
  startEndpointSocket("LOCAL", 0);

  // If custom middleware host is configured (e.g. 10.40.15.115), connect to it as well
  const customHost = typeof window !== "undefined" ? (localStorage.getItem("kiosk_middleware_host") || localStorage.getItem("kiosk_middleware_ip")) : null;
  if (customHost && customHost !== KIOSK_DEVICES.ORDERING.ip && customHost !== "127.0.0.1") {
    KIOSK_DEVICES.CUSTOM_HOST = {
      ip: customHost,
      port: 4370,
      secondaryPort: 5000,
      name: "Remote Middleware Server",
      sinhala: "දුරස්ථ සේවාදායකය",
      role: "REMOTE_BRIDGE",
      type: "CUSTOM",
      targetAction: "GENERAL",
      targetRoute: "/kiosk"
    };
    startEndpointSocket("CUSTOM_HOST", 0);
  }

  // 3. Connect Firestore Cloud Real-Time Bridge (Crucial for Web Apps on different PCs)
  initFirestoreCloudBridge();
}

/**
 * Update and reconnect Kiosk Endpoints Configuration
 */
export async function setMiddlewareConfig({ orderingConfig, receivingConfig, localConfig, host, port }) {
  if (typeof window !== "undefined") {
    const current = loadStoredKioskDevices();
    const updated = {
      ORDERING: { ...current.ORDERING, ...(orderingConfig || (host ? { ip: host, port: port || 4370 } : {})) },
      RECEIVING: { ...current.RECEIVING, ...(receivingConfig || {}) },
      LOCAL: { ...current.LOCAL, ...(localConfig || {}) }
    };
    if (host) {
      localStorage.setItem("kiosk_middleware_host", host);
    }
    localStorage.setItem("kiosk_devices_config", JSON.stringify(updated));
    KIOSK_DEVICES = updated;
  }

  // Close and reconnect all sockets to new IPs
  for (const [key, item] of socketPool.entries()) {
    if (item.timer) clearTimeout(item.timer);
    if (item.ws) {
      try { item.ws.close(); } catch {}
    }
  }
  socketPool.clear();

  startEndpointSocket("ORDERING", 0);
  startEndpointSocket("RECEIVING", 0);
  startEndpointSocket("LOCAL", 0);

  if (host && host !== "127.0.0.1") {
    startEndpointSocket("CUSTOM_HOST", 0);
  }
}

/**
 * Reset Kiosk Configuration to Default Hardware IPs (192.168.8.168 & 192.168.8.160)
 */
export function resetMiddlewareConfig() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("kiosk_devices_config");
    localStorage.removeItem("kiosk_middleware_host");
    localStorage.removeItem("kiosk_middleware_ip");
    localStorage.removeItem("kiosk_middleware_port");
  }
  KIOSK_DEVICES = {
    ORDERING: { ...DEFAULT_KIOSK_DEVICES.ORDERING },
    RECEIVING: { ...DEFAULT_KIOSK_DEVICES.RECEIVING },
    LOCAL: { ...DEFAULT_KIOSK_DEVICES.LOCAL }
  };

  for (const [key, item] of socketPool.entries()) {
    if (item.timer) clearTimeout(item.timer);
    if (item.ws) {
      try { item.ws.close(); } catch {}
    }
  }
  socketPool.clear();

  startEndpointSocket("ORDERING", 0);
  startEndpointSocket("RECEIVING", 0);
  startEndpointSocket("LOCAL", 0);
}

/**
 * Subscribe to biometric / kiosk scan events
 */
export function onFingerprintScan(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Subscribe to multi-kiosk connection status changes
 */
export function onConnectionChange(callback) {
  connectionListeners.add(callback);
  const isAny = Object.values(kioskStatuses).some((s) => s.connected);
  const active = Object.values(kioskStatuses).find((s) => s.connected) || { port: 4370, ip: KIOSK_DEVICES.ORDERING.ip };
  callback(isAny, active.port, active.ip, kioskStatuses);
  return () => {
    connectionListeners.delete(callback);
  };
}

/**
 * Probe health of all configured hardware endpoints
 */
export async function checkMiddlewareHealth(customHost = null, customPort = null) {
  const probeEndpoints = [
    { key: "ORDERING", ip: customHost || KIOSK_DEVICES.ORDERING.ip, port: customPort || KIOSK_DEVICES.ORDERING.port },
    { key: "RECEIVING", ip: KIOSK_DEVICES.RECEIVING.ip, port: KIOSK_DEVICES.RECEIVING.port },
    { key: "LOCAL", ip: "127.0.0.1", port: 4370 }
  ];

  const results = {};
  let overallOnline = true; // Cloud Sync is always available
  let primaryData = null;

  for (const ep of probeEndpoints) {
    const portsToTry = [ep.port, ep.port === 4370 ? 5000 : 4370];
    let epOnline = false;
    for (const p of portsToTry) {
      try {
        const res = await fetch(`http://${ep.ip}:${p}/status`, { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          const data = await res.json();
          results[ep.key] = { online: true, ip: ep.ip, port: p, data };
          epOnline = true;
          overallOnline = true;
          if (!primaryData) primaryData = { host: ep.ip, port: p, ...data };
          break;
        }
      } catch {
        // next port
      }
    }
    if (!epOnline) {
      results[ep.key] = { online: false, ip: ep.ip, port: ep.port };
    }
  }

  return {
    online: overallOnline,
    cloudSync: true,
    host: primaryData?.host || KIOSK_DEVICES.ORDERING.ip,
    port: primaryData?.port || 4370,
    kioskResults: results,
    kiosks: KIOSK_DEVICES,
    statuses: kioskStatuses
  };
}

/**
 * Fetch logs from whichever endpoint is reachable
 */
export async function getMiddlewareLogs() {
  const hosts = [
    { ip: KIOSK_DEVICES.ORDERING.ip, port: KIOSK_DEVICES.ORDERING.port },
    { ip: KIOSK_DEVICES.RECEIVING.ip, port: KIOSK_DEVICES.RECEIVING.port },
    { ip: "127.0.0.1", port: 4370 },
    { ip: "127.0.0.1", port: 5000 }
  ];

  for (const target of hosts) {
    try {
      const res = await fetch(`http://${target.ip}:${target.port}/api/logs`, { signal: AbortSignal.timeout(1200) });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
  }
  return { logs: [] };
}

/**
 * Simulate a fingerprint / kiosk scan
 */
export async function simulateScan(employee, kioskType = "ORDERING", customIp = null, customPort = null) {
  const isOrder = kioskType === "ORDERING";
  const targetKiosk = isOrder ? KIOSK_DEVICES.ORDERING : KIOSK_DEVICES.RECEIVING;
  const ip = customIp || targetKiosk.ip;
  const port = customPort || targetKiosk.port;
  const payload = employee.raw || `${employee.employee_id}\t${employee.name || ""}\t${employee.designation || ""}`;

  // 1. Try sending directly to physical kiosk IP
  const targetHosts = [
    { ip, port },
    { ip, port: port === 4370 ? 5000 : 4370 },
    { ip: "127.0.0.1", port: 4370 },
    { ip: "127.0.0.1", port: 5000 }
  ];

  for (const t of targetHosts) {
    try {
      const res = await fetch(`http://${t.ip}:${t.port}/api/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw: payload,
          kiosk: kioskType,
          ip: targetKiosk.ip,
          ...employee
        }),
        signal: AbortSignal.timeout(1200)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
  }

  // 2. In-browser synthetic dispatch
  const syntheticEvent = {
    type: "FINGERPRINT_EVENT",
    payload,
    employee_id: employee.employee_id || "EMP001",
    kiosk: {
      ...targetKiosk,
      detectedIp: targetKiosk.ip
    },
    log: {
      id: `sim_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: "IN_APP_SIMULATOR",
      sourceIp: targetKiosk.ip,
      port: targetKiosk.port,
      kioskName: targetKiosk.name,
      kioskRole: targetKiosk.role,
      targetAction: targetKiosk.targetAction,
      targetRoute: targetKiosk.targetRoute,
      raw: payload
    }
  };

  console.log(`[Multi-Kiosk Bridge] In-App Synthetic Scan dispatched for ${targetKiosk.name} (${targetKiosk.ip}):`, syntheticEvent);
  notifyListeners(syntheticEvent);
  return syntheticEvent;
}
