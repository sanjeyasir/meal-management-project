import React, { useState } from "react";
import { Layout, Menu, Button, Avatar, Tag, Space, Tooltip, Drawer, Dropdown } from "antd";
import {
  DashboardOutlined,
  ShoppingOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  TableOutlined,
  TeamOutlined,
  SettingOutlined,
  LogoutOutlined,
  ThunderboltOutlined,
  MenuOutlined,
  UserOutlined,
  HomeOutlined,
  FileExcelOutlined,
  DesktopOutlined,
  EditOutlined
} from "@ant-design/icons";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import FingerprintMonitorModal from "../biometric/FingerprintMonitorModal";

const { Header, Sider, Content } = Layout;

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [monitorOpen, setMonitorOpen] = useState(false);

  const { currentUser, logout, isAdmin, middlewareConnected } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // Admin Portal Menu items (No Order/Receive in Admin Portal as requested)
  const menuItems = [
    {
      key: "/admin/dashboard",
      icon: <DashboardOutlined />,
      label: <Link to="/admin/dashboard">Visualisation Dashboard</Link>,
    },
    {
      key: "/admin/allocations-edit",
      icon: <EditOutlined />,
      label: <Link to="/admin/allocations-edit">Allocations Edit</Link>,
    },
    {
      key: "/admin/reports",
      icon: <FileExcelOutlined />,
      label: <Link to="/admin/reports">Formatted Excel Reports</Link>,
    },
    {
      key: "/admin/all-allocations",
      icon: <TableOutlined />,
      label: <Link to="/admin/all-allocations">All Allocations Master</Link>,
    },
    {
      key: "/admin/employees",
      icon: <TeamOutlined />,
      label: <Link to="/admin/employees">Employees Directory</Link>,
    },
    {
      key: "/admin/settings",
      icon: <SettingOutlined />,
      label: <Link to="/admin/settings">Settings & Master Data</Link>,
    }
  ];


  const sidebarContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
      {/* Brand Header */}
      <div style={{
        padding: "20px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: "1px solid #f1f5f9"
      }}>
        <Avatar
          src="/diet.ico"
          size={42}
          style={{
            backgroundColor: "#ecfdf5",
            border: "1px solid #10b981",
            padding: 4
          }}
        />
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a", whiteSpace: "nowrap" }}>
              Meal Management
            </div>
            <div style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 700, letterSpacing: "0.02em" }}>
              Admin Operations Portal
            </div>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <div style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ borderRight: 0, fontWeight: 500 }}
          onClick={() => {
            if (isMobile) setMobileOpen(false);
          }}
        />
      </div>

      {/* Biometric Status & Simulation Quick Button */}
      <div style={{ padding: collapsed ? "8px" : "16px", borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>
        <Tooltip title="Click to open Biometric Middleware Monitor & Test Scanner">
          <Button
            type="dashed"
            block
            icon={<ThunderboltOutlined style={{ color: middlewareConnected ? "#10b981" : "#f59e0b" }} />}
            onClick={() => setMonitorOpen(true)}
            style={{
              borderRadius: 10,
              fontSize: "0.8rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderColor: middlewareConnected ? "#10b981" : "#f59e0b"
            }}
          >
            {!collapsed && (middlewareConnected ? "Port 5000 Active" : "Biometric Simulator")}
          </Button>
        </Tooltip>
      </div>

      {/* Current User Card */}
      <div style={{ padding: collapsed ? "12px 8px" : "16px", borderTop: "1px solid #f1f5f9" }}>
        {!collapsed ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar style={{ backgroundColor: "#10b981", fontWeight: 700 }}>
                {currentUser?.name ? currentUser.name[0].toUpperCase() : "U"}
              </Avatar>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0f172a", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {currentUser?.name || "Employee"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  {currentUser?.employee_id} • {currentUser?.designation || "Staff"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Tag color="emerald" style={{ margin: 0, fontSize: "0.7rem", fontWeight: 600 }}>
                {currentUser?.pay_category || "Free Meal"}
              </Tag>
              {isAdmin && (
                <Tag color="red" style={{ margin: 0, fontSize: "0.7rem", fontWeight: 700 }}>
                  ADMIN
                </Tag>
              )}
            </div>

            <Button
              danger
              type="default"
              icon={<LogoutOutlined />}
              onClick={logout}
              block
              style={{
                borderRadius: 8,
                marginTop: 4,
                background: "rgba(239, 68, 68, 0.04)",
                borderColor: "rgba(239, 68, 68, 0.2)"
              }}
            >
              Sign Out
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Avatar style={{ backgroundColor: "#10b981", fontWeight: 700 }}>
              {currentUser?.name ? currentUser.name[0].toUpperCase() : "U"}
            </Avatar>
            <Button
              danger
              type="text"
              icon={<LogoutOutlined />}
              onClick={logout}
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* Desktop Sider */}
      {!isMobile && (
        <Sider
          width={260}
          collapsedWidth={80}
          collapsible
          collapsed={collapsed}
          trigger={null}
          style={{
            position: "fixed",
            height: "100vh",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            background: "#ffffff",
            borderRight: "1px solid #e2e8f0"
          }}
        >
          {sidebarContent}
        </Sider>
      )}

      {/* Mobile Drawer */}
      <Drawer
        placement="left"
        closable={false}
        onClose={() => setMobileOpen(false)}
        open={mobileOpen}
        styles={{ body: { padding: 0, background: "#ffffff" } }}
        width={260}
      >
        {sidebarContent}
      </Drawer>

      <Layout style={{
        marginLeft: isMobile ? 0 : (collapsed ? 80 : 260),
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.2s"
      }}>
        {/* Top Header */}
        <Header
          style={{
            padding: "0 24px",
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid #e2e8f0",
            position: "fixed",
            top: 0,
            right: 0,
            left: isMobile ? 0 : (collapsed ? 80 : 260),
            zIndex: 90,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 64,
            transition: "all 0.2s"
          }}
        >
          <Space size="middle">
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed)}
              style={{ fontSize: 16, width: 40, height: 40, color: "#0f172a" }}
            />
            <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#10b981", display: "flex", alignItems: "center", gap: 8 }}>
              {!isMobile && "Meal Management Project"}
            </span>
            {currentUser?.company && (
              <Tag color="cyan" style={{ margin: 0, borderRadius: 6, fontWeight: 600 }}>
                {currentUser.company}
              </Tag>
            )}
          </Space>

          <Space size="middle">
            {/* Biometric Status Pill */}
            <Tooltip title="Biometric Middleware (Port 5000). Click to inspect logs or simulate scan.">
              <Tag
                icon={<ThunderboltOutlined />}
                color={middlewareConnected ? "success" : "warning"}
                onClick={() => setMonitorOpen(true)}
                style={{
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: "4px 12px",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                {middlewareConnected ? "Biometric Ready (Port 5000)" : "Biometric Simulator"}
              </Tag>
            </Tooltip>

            <Button
              type="primary"
              icon={<DesktopOutlined />}
              onClick={() => navigate("/kiosk")}
              style={{
                fontWeight: 700,
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                boxShadow: "0 4px 12px -2px rgba(16, 185, 129, 0.4)",
                borderRadius: 8
              }}
            >
              Switch to Canteen Kiosk
            </Button>
          </Space>
        </Header>

        {/* Main Content Area */}
        <Content
          style={{
            margin: "84px 24px 24px 24px",
            flexGrow: 1,
            display: "flex",
            flexDirection: "column"
          }}
        >
          {children}
        </Content>
      </Layout>

      {/* Biometric Monitor & Simulator Modal */}
      <FingerprintMonitorModal
        open={monitorOpen}
        onClose={() => setMonitorOpen(false)}
      />
    </Layout>
  );
}
