/**
 * Fingerprint Client Bridge
 * Connects to the local Node.js biometric middleware on port 5000 via WebSocket and IPC.
 */

let ws = null;
const listeners = new Set();
let reconnectTimer = null;
let isConnected = false;
const connectionListeners = new Set();

const WS_URL = "ws://127.0.0.1:5000";
const HTTP_URL = "http://127.0.0.1:5000";

function notifyConnection(status) {
  isConnected = status;
  connectionListeners.forEach(fn => {
    try {
      fn(status);
    } catch (e) {
      console.warn("Connection listener error:", e);
    }
  });
}

function notifyListeners(data) {
  listeners.forEach(fn => {
    try {
      fn(data);
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
  connectWebSocket();
}

function connectWebSocket() {
  if (typeof WebSocket === "undefined") return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("[Fingerprint Bridge] Connected to Biometric Middleware on port 5000");
      notifyConnection(true);
      if (reconnectTimer) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "FINGERPRINT_EVENT") {
          console.log("[Fingerprint Bridge] Biometric scan received:", message.payload);
          notifyListeners(message.payload);
        }
      } catch (err) {
        notifyListeners(event.data);
      }
    };

    ws.onclose = () => {
      notifyConnection(false);
      scheduleReconnect(5000);
    };

    ws.onerror = () => {
      notifyConnection(false);
      try {
        ws?.close();
      } catch {}
    };
  } catch (err) {
    notifyConnection(false);
    scheduleReconnect(5000);
  }
}

function scheduleReconnect(interval = 5000) {
  if (!reconnectTimer) {
    reconnectTimer = setInterval(() => {
      connectWebSocket();
    }, interval);
  }
}


/**
 * Subscribe to fingerprint scan events
 * @param {Function} callback Callback receiving the raw payload
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
  callback(isConnected);
  return () => {
    connectionListeners.delete(callback);
  };
}

/**
 * Check if middleware is reachable via HTTP
 */
export async function checkMiddlewareHealth() {
  try {
    const res = await fetch(`${HTTP_URL}/status`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const data = await res.json();
      return { online: true, ...data };
    }
  } catch {
    // Offline
  }
  return { online: false, port: 5000 };
}

/**
 * Fetch recent scan logs from middleware
 */
export async function getMiddlewareLogs() {
  try {
    const res = await fetch(`${HTTP_URL}/api/logs`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    //
  }
  return { logs: [] };
}

/**
 * Simulate a fingerprint scan for development or testing
 */
export async function simulateScan(employee) {
  const payload = employee.raw || `${employee.employee_id}\t${employee.name || ""}\t${employee.designation || ""}`;
  
  // 1. Try sending to local HTTP simulator endpoint if active
  try {
    await fetch(`${HTTP_URL}/api/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: payload, ...employee }),
      signal: AbortSignal.timeout(1200)
    });
  } catch {
    // 2. If on cloud web or middleware server is not on this machine, broadcast in-app directly
    console.log("[Bridge In-App Simulation] Triggered scan for:", payload);
    notifyListeners(payload);
  }
}
