import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuthStore } from "../store/authStore";
import * as authService from "../services/firebase/authService";
import { message } from "antd";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const { user, setUser, loading, setLoading, logout: storeLogout } = useAuthStore();

  // Background bootstrap for initial seed data
  useEffect(() => {
    authService.seedAllInitialData().catch((e) => {
      console.warn("Background seed check:", e);
    });
  }, []);

  const loginManual = useCallback(async (username, password) => {
    setLoading(true);
    try {
      const session = await authService.loginManual(username, password);
      setUser(session);
      message.success(`Welcome back, ${session.name}!`);
      return session;
    } catch (err) {
      message.error(err.message || "Invalid username or password");
      throw err;
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
    message.info("Signed out successfully.");
  }, [storeLogout]);

  const value = {
    currentUser: user,
    isAuthenticated: !!user,
    isAdmin: !!user?.isAdmin,
    loading,
    initDone: true,
    loginManual,
    selectEmployee,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
