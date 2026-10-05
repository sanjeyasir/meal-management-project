/**
 * Biometric & Kiosk Client Bridge
 * Connects to the local Node.js biometric middleware on port 4370 (with 5000 fallback) via WebSocket and IPC.
 * Listens for POST calls from Ordering Kiosk (192.168.8.168:4370) and Receiving Kiosk (192.168.8.160:4370).
 */

export const KIOSK_DEVICES = {
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

let ws = null;
const listeners = new Set();
let reconnectTimer = null;
let isConnected = false;
const connectionListeners = new Set();
let activePort = 4370;

const PORTS_TO_TRY = [4370, 5000];

function notifyConnection(status, port = activePort) {
  isConnected = status;
  connectionListeners.forEach((fn) => {
    try {
      fn(status, port);
    } catch (e) {
      console.warn("Connection listener error:", e);
    }
  });
}

function notifyListeners(eventData) {
  listeners.forEach((fn) => {
    try {
      fn(eventData);
    } catch (err) {
      console.error("Error in fingerprint listener callback:", err);
    }
  });
}

/**
 * Initialize connection to Middleware
 */
export function initFingerprintBridge() {
  // 1. If Electron API is available, hook to IPC
  if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.onFingerprint) {
    window.electronAPI.onFingerprint((event, data) => {
      console.log("[Bridge IPC] Fingerprint received from Electron main:", data);
      notifyListeners(data);
    });
  }

  // 2. Connect WebSocket directly to local loopback
  connectWebSocket(0);
}

function connectWebSocket(portIndex = 0) {
  if (typeof WebSocket === "undefined") return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const port = PORTS_TO_TRY[portIndex % PORTS_TO_TRY.length];
  activePort = port;
  const wsUrl = `ws://127.0.0.1:${port}`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`[Fingerprint Bridge] Connected to Biometric Middleware on port ${port}`);
      notifyConnection(true, port);
      if (reconnectTimer) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "FINGERPRINT_EVENT") {
          console.log("[Fingerprint Bridge] Biometric scan received:", message);
          notifyListeners(message);
        } else if (message.type === "CONNECTION_ACK") {
          console.log("[Fingerprint Bridge] Handshake ACK:", message.message);
        }
      } catch (err) {
        notifyListeners({ payload: event.data });
      }
    };

    ws.onclose = () => {
      notifyConnection(false);
      scheduleReconnect(portIndex + 1);
    };

    ws.onerror = () => {
      notifyConnection(false);
      try {
        ws?.close();
      } catch {}
    };
  } catch (err) {
    notifyConnection(false);
    scheduleReconnect(portIndex + 1);
  }
}

function scheduleReconnect(nextPortIndex = 0, interval = 4000) {
  if (!reconnectTimer) {
    reconnectTimer = setInterval(() => {
      connectWebSocket(nextPortIndex);
    }, interval);
  }
}

/**
 * Subscribe to fingerprint / kiosk scan events
 * @param {Function} callback Callback receiving event: { payload, employee_id, kiosk, log }
 * @returns {Function} Unsubscribe function
 */
export function onFingerprintScan(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Subscribe to connection status changes
 */
export function onConnectionChange(callback) {
  connectionListeners.add(callback);
  callback(isConnected, activePort);
  return () => {
    connectionListeners.delete(callback);
  };
}

/**
 * Check if middleware is reachable via HTTP on port 4370 or 5000
 */
export async function checkMiddlewareHealth() {
  for (const port of PORTS_TO_TRY) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(1200) });
      if (res.ok) {
        const data = await res.json();
        activePort = port;
        return { online: true, port, ...data };
      }
    } catch {
      // Try next port
    }
  }
  return { online: false, port: 4370, kiosks: KIOSK_DEVICES };
}

/**
 * Fetch recent scan logs from middleware
 */
export async function getMiddlewareLogs() {
  for (const port of PORTS_TO_TRY) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/logs`, { signal: AbortSignal.timeout(1200) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      //
    }
  }
  return { logs: [] };
}

/**
 * Simulate a fingerprint / kiosk scan for development or testing
 * @param {Object} employee Employee object or { raw }
 * @param {string} kioskType "ORDERING" | "RECEIVING" | "GENERAL"
 */
export async function simulateScan(employee, kioskType = "ORDERING") {
  const payload = employee.raw || `${employee.employee_id}\t${employee.name || ""}\t${employee.designation || ""}`;
  const ip = kioskType === "ORDERING" ? "192.168.8.168" : kioskType === "RECEIVING" ? "192.168.8.160" : "127.0.0.1";
  
  // 1. Try sending to local HTTP simulator endpoint
  for (const port of PORTS_TO_TRY) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw: payload,
          kiosk: kioskType,
          ip,
          ...employee
        }),
        signal: AbortSignal.timeout(1200)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      //
    }
  }

  // 2. In-browser fallback
  const kioskObj = kioskType === "ORDERING" ? KIOSK_DEVICES.ORDERING : kioskType === "RECEIVING" ? KIOSK_DEVICES.RECEIVING : {
    ip,
    port: 4370,
    name: "In-Browser Simulator",
    role: "SIMULATED_KIOSK",
    type: kioskType,
    targetAction: kioskType === "RECEIVING" ? "RECEIVE" : "ORDER",
    targetRoute: kioskType === "RECEIVING" ? "/meals/receive" : "/meals/order"
  };

  const syntheticEvent = {
    type: "FINGERPRINT_EVENT",
    payload,
    employee_id: employee.employee_id || "EMP001",
    kiosk: kioskObj,
    log: {
      id: `sim_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: "IN_APP_SIMULATOR",
      sourceIp: ip,
      port: 4370,
      kioskName: kioskObj.name,
      kioskRole: kioskObj.role,
      targetAction: kioskObj.targetAction,
      targetRoute: kioskObj.targetRoute,
      raw: payload
    }
  };

  console.log("[Bridge In-App Simulation] Triggered simulated scan:", syntheticEvent);
  notifyListeners(syntheticEvent);
  return syntheticEvent;
}
