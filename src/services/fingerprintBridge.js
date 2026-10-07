/**
 * Fingerprint & Device Bridge (Web Portal Mode)
 * In Web Portal mode, all WebSocket / LAN connections are disabled.
 * The application interacts directly with Firebase Cloud Firestore.
 */

export const DEFAULT_KIOSK_DEVICES = {
  ORDERING: {
    ip: "127.0.0.1",
    port: 4370,
    name: "Ordering Terminal",
    role: "ORDERING_KIOSK",
    type: "ORDERING",
    targetAction: "ORDER",
    targetRoute: "/meals/order"
  },
  RECEIVING: {
    ip: "127.0.0.1",
    port: 4370,
    name: "Receiving Terminal",
    role: "RECEIVING_KIOSK",
    type: "RECEIVING",
    targetAction: "RECEIVE",
    targetRoute: "/meals/receive"
  },
  LOCAL: {
    ip: "127.0.0.1",
    port: 4370,
    name: "Local Terminal",
    role: "LOCAL_BRIDGE",
    type: "LOCAL",
    targetAction: "GENERAL",
    targetRoute: "/admin/dashboard"
  }
};

export let KIOSK_DEVICES = { ...DEFAULT_KIOSK_DEVICES };

export function loadStoredKioskDevices() {
  return KIOSK_DEVICES;
}

export function saveKioskDevicesConfig(newConfig) {
  KIOSK_DEVICES = { ...KIOSK_DEVICES, ...newConfig };
  return KIOSK_DEVICES;
}

export function isPrivateNetworkHost() {
  return false;
}

export function getMiddlewareHost() {
  return "127.0.0.1";
}

export function getMiddlewarePorts() {
  return [4370];
}

export function isMiddlewareConnected() {
  return false;
}

export function initFingerprintBridge() {
  // Web app uses direct cloud Firestore synchronization.
  // No local WebSockets or LAN connections needed.
  return () => {};
}

export function onFingerprintScan(callback) {
  // Safe no-op subscription for cloud mode
  return () => {};
}

export function onConnectionChange(callback) {
  if (typeof callback === "function") {
    try {
      callback(false, 4370, "127.0.0.1", {
        ORDERING: { connected: false, ip: "127.0.0.1", port: 4370 },
        RECEIVING: { connected: false, ip: "127.0.0.1", port: 4370 },
        LOCAL: { connected: false, ip: "127.0.0.1", port: 4370 }
      });
    } catch (e) {
      console.warn("Connection callback error:", e);
    }
  }
  return () => {};
}

export function simulateFingerprintScan(employeeId) {
  console.log("[Device Bridge] Scan simulation requested:", employeeId);
  return true;
}

export function reconnectAllEndpoints() {
  // No-op in web cloud mode
}
