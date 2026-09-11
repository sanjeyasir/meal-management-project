import React from "react";
import { HashRouter, BrowserRouter } from "react-router-dom";
import { ConfigProvider } from "antd";
import { themeConfig } from "./theme/theme";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import AppRoutes from "./routes/AppRoutes";

// Using HashRouter for seamless Electron Desktop and Web compatibility
export default function App() {
  return (
    <ConfigProvider theme={themeConfig}>
      <HashRouter>
        <AuthProvider>
          <NotificationProvider>
            <AppRoutes />
          </NotificationProvider>
        </AuthProvider>
      </HashRouter>
    </ConfigProvider>
  );
}
