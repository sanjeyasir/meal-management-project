import React, { useState, useEffect } from "react";
import { Layout, Menu, Button, Avatar, Tag, Space, Drawer, Dropdown, Typography } from "antd";
import {
  DashboardOutlined,
  TableOutlined,
  TeamOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuOutlined,
  UserOutlined,
  FileExcelOutlined,
  EditOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined
} from "@ant-design/icons";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

function getSriLankaTime() {
  const now = new Date();
  const displayTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(now);
  return displayTime;
}

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [slTime, setSlTime] = useState(getSriLankaTime());

  const { currentUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  useEffect(() => {
    const timer = setInterval(() => {
      setSlTime(getSriLankaTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Admin Portal Menu items
  const menuItems = [
    {
      key: "/admin/dashboard",
      icon: <DashboardOutlined style={{ fontSize: 16 }} />,
      label: <Link to="/admin/dashboard">Visualisation Dashboard</Link>,
    },
    {
      key: "/admin/allocations-edit",
      icon: <EditOutlined style={{ fontSize: 16 }} />,
      label: <Link to="/admin/allocations-edit">Allocations Edit</Link>,
    },
    {
      key: "/admin/reports",
      icon: <FileExcelOutlined style={{ fontSize: 16 }} />,
      label: <Link to="/admin/reports">Formatted Excel Reports</Link>,
    },
    {
      key: "/admin/all-allocations",
      icon: <TableOutlined style={{ fontSize: 16 }} />,
      label: <Link to="/admin/all-allocations">All Allocations Master</Link>,
    },
    {
      key: "/admin/employees",
      icon: <TeamOutlined style={{ fontSize: 16 }} />,
      label: <Link to="/admin/employees">Employees Directory</Link>,
    },
    {
      key: "/admin/settings",
      icon: <SettingOutlined style={{ fontSize: 16 }} />,
      label: <Link to="/admin/settings">Settings & Master Data</Link>,
    }
  ];

  // User Dropdown Menu
  const userMenuItems = [
    {
      key: "user-info",
      label: (
        <div style={{ padding: "4px 8px" }}>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>{currentUser?.name || "Admin"}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{currentUser?.employee_id || "admin"} • {currentUser?.designation || "Administrator"}</div>
        </div>
      ),
      disabled: true,
    },
    { type: "divider" },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: <Link to="/admin/settings">System Settings</Link>,
    },
    {
      key: "logout",
      icon: <LogoutOutlined style={{ color: "#ef4444" }} />,
      label: <span style={{ color: "#ef4444", fontWeight: 600 }}>Sign Out</span>,
      onClick: logout,
    }
  ];

  const sidebarContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
      {/* Brand Header */}
      <div
        style={{
          padding: "20px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid #f1f5f9"
        }}
      >
        <Avatar
          src="/diet.ico"
          size={42}
          style={{
            backgroundColor: "#ecfdf5",
            border: "1.5px solid #10b981",
            padding: 3,
            flexShrink: 0
          }}
        />
        {!collapsed && (
          <div style={{ overflow: "hidden", lineHeight: 1.2 }}>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a", whiteSpace: "nowrap" }}>
              Meal Management
            </div>
            <div style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 700, letterSpacing: "0.02em", marginTop: 2 }}>
              Operations Portal
            </div>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <div style={{ flex: 1, padding: "14px 10px", overflowY: "auto" }}>
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

      {/* Current User Card in Sidebar */}
      <div style={{ padding: collapsed ? "12px 8px" : "16px", borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>
        {!collapsed ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar style={{ backgroundColor: "#10b981", fontWeight: 700, flexShrink: 0 }}>
                {currentUser?.name ? currentUser.name[0].toUpperCase() : "A"}
              </Avatar>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0f172a", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {currentUser?.name || "Administrator"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  {currentUser?.employee_id || "admin"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <Tag color="emerald" style={{ margin: 0, fontSize: "0.7rem", fontWeight: 700 }}>
                {currentUser?.pay_category || "Free Meal"}
              </Tag>
              {isAdmin && (
                <Tag color="purple" style={{ margin: 0, fontSize: "0.7rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  <SafetyCertificateOutlined /> ADMIN
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
                background: "#ffffff",
                borderColor: "#fca5a5",
                fontWeight: 600,
                fontSize: "0.8rem"
              }}
            >
              Sign Out
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Avatar style={{ backgroundColor: "#10b981", fontWeight: 700 }}>
              {currentUser?.name ? currentUser.name[0].toUpperCase() : "A"}
            </Avatar>
            <Button
              danger
              type="text"
              icon={<LogoutOutlined />}
              onClick={logout}
              title="Sign Out"
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

      <Layout
        style={{
          marginLeft: isMobile ? 0 : (collapsed ? 80 : 260),
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          background: "#f8fafc"
        }}
      >
        {/* Top Header */}
        <Header
          style={{
            padding: "0 24px",
            background: "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
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
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
        >
          <Space size="middle">
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => (isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed))}
              style={{ fontSize: 16, width: 40, height: 40, color: "#0f172a", borderRadius: 8 }}
            />
            <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              {!isMobile && "Meal Management System"}
            </span>
            {currentUser?.company && (
              <Tag color="cyan" style={{ margin: 0, borderRadius: 6, fontWeight: 600, fontSize: 12 }}>
                {currentUser.company}
              </Tag>
            )}
          </Space>

          <Space size="middle">
            {/* Live Clock Tag */}
            <Tag
              color="emerald"
              style={{
                padding: "4px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#ecfdf5",
                borderColor: "#a7f3d0",
                color: "#065f46"
              }}
            >
              <ClockCircleOutlined />
              <span>{slTime}</span>
            </Tag>

            {/* Profile Dropdown */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 10px",
                  borderRadius: 10,
                  cursor: "pointer",
                  background: "#f1f5f9",
                  transition: "all 0.2s ease"
                }}
              >
                <Avatar size={30} style={{ backgroundColor: "#10b981", fontWeight: 700 }}>
                  {currentUser?.name ? currentUser.name[0].toUpperCase() : "A"}
                </Avatar>
                {!isMobile && (
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                    {currentUser?.name || "Admin"}
                  </span>
                )}
              </div>
            </Dropdown>
          </Space>
        </Header>

        {/* Main Content Area */}
        <Content
          className="page-enter"
          style={{
            margin: "80px 24px 24px 24px",
            flexGrow: 1,
            display: "flex",
            flexDirection: "column"
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
