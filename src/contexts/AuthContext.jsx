import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuthStore } from "../store/authStore";
import * as authService from "../services/firebase/authService";
import { initFingerprintBridge, onFingerprintScan, onConnectionChange, KIOSK_DEVICES } from "../services/fingerprintBridge";
import { message, notification } from "antd";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const { user, setUser, loading, setLoading, middlewareConnected, setMiddlewareConnected, logout: storeLogout } = useAuthStore();
  const [activePort, setActivePort] = useState(4370);
  const [activeHost, setActiveHost] = useState(KIOSK_DEVICES.ORDERING.ip || "192.168.8.168");
  const [kioskStatuses, setKioskStatuses] = useState({
    ORDERING: { connected: false, ip: KIOSK_DEVICES.ORDERING.ip, port: 4370 },
    RECEIVING: { connected: false, ip: KIOSK_DEVICES.RECEIVING.ip, port: 4370 },
    LOCAL: { connected: false, ip: "127.0.0.1", port: 4370 }
  });
  const [lastKioskEvent, setLastKioskEvent] = useState(null);

  // Initialize DB Seeds in background and setup Fingerprint Bridge
  useEffect(() => {
    let unsubscribeScan = null;
    let unsubscribeConn = null;

    // Non-blocking background bootstrap
    authService.seedAllInitialData().catch((e) => {
      console.warn("Background seed notice:", e);
    });

    // Initialize Bridge (connecting on port 4370 & 5000 to 192.168.8.168, 192.168.8.160, and 127.0.0.1)
    initFingerprintBridge();

    unsubscribeConn = onConnectionChange((connected, port, host, statuses) => {
      setMiddlewareConnected(connected);
      if (port) setActivePort(port);
      if (host) setActiveHost(host);
      if (statuses) setKioskStatuses({ ...statuses });
    });

    // Global Biometric Listener for Kiosks
    unsubscribeScan = onFingerprintScan(async (eventData) => {
      console.log("[AuthContext] Processing incoming kiosk scan event:", eventData);
      
      const rawPayload = eventData?.payload || eventData;
      const kiosk = eventData?.kiosk || {
        type: "GENERAL",
        role: "GENERAL_KIOSK",
        ip: "127.0.0.1",
        port: 4370,
        name: "Biometric Device",
        targetAction: "GENERAL",
        targetRoute: "/kiosk"
      };

      setLastKioskEvent(eventData);

      try {
        const session = await authService.loginWithBiometric(rawPayload);
        setUser(session);

        const isOrderingKiosk =
          kiosk.type === "ORDERING" ||
          kiosk.targetAction === "ORDER" ||
          kiosk.ip === KIOSK_DEVICES.ORDERING.ip ||
          kiosk.sourceIp === KIOSK_DEVICES.ORDERING.ip;

        const isReceivingKiosk =
          kiosk.type === "RECEIVING" ||
          kiosk.targetAction === "RECEIVE" ||
          kiosk.ip === KIOSK_DEVICES.RECEIVING.ip ||
          kiosk.sourceIp === KIOSK_DEVICES.RECEIVING.ip;

        // Dispatch window event for page-level navigation / auto-action
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("KIOSK_SCAN_EVENT", {
              detail: { session, kiosk, isOrderingKiosk, isReceivingKiosk }
            })
          );
        }

        if (isOrderingKiosk) {
          notification.success({
            message: `📱 ${kiosk.name || "Ordering Kiosk"} (${kiosk.ip || KIOSK_DEVICES.ORDERING.ip}:${kiosk.port || 4370})`,
            description: `Welcome, ${session.name}! (${session.employee_id}) - Proceeding to Meal Ordering`,
            placement: "topRight",
            duration: 4
          });
        } else if (isReceivingKiosk) {
          notification.success({
            message: `🍲 ${kiosk.name || "Receiving Kiosk"} (${kiosk.ip || KIOSK_DEVICES.RECEIVING.ip}:${kiosk.port || 4370})`,
            description: `Welcome, ${session.name}! (${session.employee_id}) - Ready to Dispense Meal`,
            placement: "topRight",
            duration: 4
          });
        } else {
          message.success({
            content: `Welcome, ${session.name}! (${session.category_name} - ${session.pay_category})`,
            duration: 3
          });
        }
      } catch (err) {
        console.error("Fingerprint auth error:", err);
        message.error({
          content: `Biometric Scan Error (${kiosk.name || "Kiosk"}): ${err.message}`,
          duration: 4
        });
      }
    });

    return () => {
      if (unsubscribeScan) unsubscribeScan();
      if (unsubscribeConn) unsubscribeConn();
    };
  }, [setUser, setMiddlewareConnected]);

  const loginManual = useCallback(async (username, password) => {
    setLoading(true);
    try {
      const session = await authService.loginManual(username, password);
      setUser(session);
      message.success(`Logged in as ${session.name}`);
      return session;
    } catch (err) {
      message.error(err.message || "Login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setUser, setLoading]);

  const loginWithBiometric = useCallback(async (rawPayload) => {
    setLoading(true);
    try {
      const session = await authService.loginWithBiometric(rawPayload);
      setUser(session);
      return session;
    } finally {
      setLoading(false);
    }
  }, [setUser, setLoading]);

  const selectEmployee = useCallback(async (employee) => {
    setLoading(true);
    try {
      const session = await authService.selectEmployeeSession(employee);
      setUser(session);
      return session;
    } finally {
      setLoading(false);
    }
  }, [setUser, setLoading]);

  const logout = useCallback(() => {
    authService.logoutUser();
    storeLogout();
    message.info("You have signed out.");
  }, [storeLogout]);

  const value = {
    currentUser: user,
    isAuthenticated: !!user,
    isAdmin: !!user?.isAdmin,
    loading,
    initDone: true,
    middlewareConnected,
    activePort,
    activeHost,
    kiosks: KIOSK_DEVICES,
    kioskStatuses,
    lastKioskEvent,
    loginManual,
    loginWithBiometric,
    selectEmployee,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
