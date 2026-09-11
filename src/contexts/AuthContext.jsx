import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuthStore } from "../store/authStore";
import * as authService from "../services/firebase/authService";
import { initFingerprintBridge, onFingerprintScan, onConnectionChange } from "../services/fingerprintBridge";
import { message } from "antd";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const { user, setUser, loading, setLoading, middlewareConnected, setMiddlewareConnected, logout: storeLogout } = useAuthStore();
  const [initDone, setInitDone] = useState(true);

  // Initialize DB Seeds in background and setup Fingerprint Bridge
  useEffect(() => {
    let unsubscribeScan = null;
    let unsubscribeConn = null;

    // Non-blocking background bootstrap
    authService.seedAllInitialData().catch((e) => {
      console.warn("Background seed notice:", e);
    });

    // Initialize Bridge
    initFingerprintBridge();

    unsubscribeConn = onConnectionChange((connected) => {
      setMiddlewareConnected(connected);
    });

    // Global Biometric Listener
    unsubscribeScan = onFingerprintScan(async (payload) => {
      console.log("[AuthContext] Processing incoming fingerprint scan:", payload);
      try {
        const session = await authService.loginWithBiometric(payload);
        setUser(session);
        message.success({
          content: `Welcome, ${session.name}! (${session.category_name} - ${session.pay_category})`,
          duration: 3
        });
      } catch (err) {
        console.error("Fingerprint auth error:", err);
        message.error({
          content: `Biometric Scan: ${err.message}`,
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
