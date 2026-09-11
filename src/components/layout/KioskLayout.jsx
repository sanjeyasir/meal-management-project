import React, { useState, useEffect } from "react";
import { Avatar, Button, Space, Tag, Typography } from "antd";
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  HomeOutlined,
  ThunderboltOutlined,
  UserOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import FingerprintMonitorModal from "../biometric/FingerprintMonitorModal";

const { Title, Text } = Typography;

// Helper to get Sri Jayawardenepura / Sri Lanka Time (Asia/Colombo)
function getSriLankaTime() {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(now);
  const displayTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(now);

  return { dateStr, displayTime };
}

export default function KioskLayout({ children }) {
  const { currentUser, middlewareConnected } = useAuth();
  const navigate = useNavigate();
  const [slTime, setSlTime] = useState(getSriLankaTime());
  const [monitorOpen, setMonitorOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlTime(getSriLankaTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #0f172a 100%)",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* Kiosk Header */}
      <div
        style={{
          padding: "16px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(0, 0, 0, 0.25)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
          position: "sticky",
          top: 0,
          zIndex: 100
        }}
      >
        {/* Brand and Return to Kiosk */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Button
            type="primary"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/kiosk")}
            style={{
              fontWeight: 700,
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.15)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              backdropFilter: "blur(8px)",
              color: "#ffffff",
              height: 40
            }}
          >
            Back to Canteen Kiosk
          </Button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar
              src="/diet.ico"
              size={38}
              style={{
                backgroundColor: "#ecfdf5",
                border: "1.5px solid #10b981",
                padding: 3
              }}
            />
            <div>
              <div style={{ fontWeight: 800, fontSize: "1rem", color: "#ffffff", lineHeight: 1.2 }}>
                MEAL MANAGEMENT PROJECT
              </div>
              <div style={{ fontSize: "0.75rem", color: "#a7f3d0", fontWeight: 600 }}>
                Meal Self-Service Terminal
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Employee info & live clock */}
        <Space size="middle" wrap>
          {currentUser && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(255, 255, 255, 0.1)",
                padding: "6px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255, 255, 255, 0.2)"
              }}
            >
              <Avatar style={{ backgroundColor: "#10b981", fontWeight: 700 }} size={28}>
                {currentUser.name ? currentUser.name[0].toUpperCase() : "U"}
              </Avatar>
              <div>
                <span style={{ fontWeight: 700, color: "#ffffff", fontSize: 13, marginRight: 6 }}>
                  {currentUser.name}
                </span>
                <Tag color="cyan" style={{ margin: 0, fontWeight: 700, fontSize: 11, borderRadius: 4 }}>
                  {currentUser.employee_id}
                </Tag>
              </div>
              <Tag color="emerald" style={{ margin: 0, fontWeight: 700, fontSize: 11, borderRadius: 4 }}>
                {currentUser.pay_category || "Free Meal"}
              </Tag>
            </div>
          )}

          {/* Sri Lanka Live Clock */}
          <Tag
            color="emerald"
            style={{
              padding: "6px 12px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              background: "rgba(16, 185, 129, 0.25)",
              border: "1px solid rgba(16, 185, 129, 0.5)",
              color: "#ecfdf5",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <ClockCircleOutlined />
            <span>Sri Lanka: <b>{slTime.displayTime}</b></span>
          </Tag>
        </Space>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: "24px 20px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        {children}
      </div>

      {/* Biometric Simulator Modal */}
      <FingerprintMonitorModal open={monitorOpen} onClose={() => setMonitorOpen(false)} />
    </div>
  );
}
