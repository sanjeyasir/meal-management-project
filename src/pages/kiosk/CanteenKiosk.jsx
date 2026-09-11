import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Tag,
  Avatar,
  Space,
  Select,
  Tooltip,
  message
} from "antd";
import {
  ThunderboltOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ShoppingOutlined,
  LockOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ArrowRightOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getEmployees } from "../../services/firebase/employeeService";
import FingerprintMonitorModal from "../../components/biometric/FingerprintMonitorModal";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Sri Jayawardenepura Time Helper (Asia/Colombo, UTC+05:30)
function getSriLankaDisplayTime() {
  const now = new Date();
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(now);
}

export default function CanteenKiosk() {
  const { currentUser, selectEmployee, logout, middlewareConnected, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState(currentUser?.employee_id || null);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [slTimeStr, setSlTimeStr] = useState(getSriLankaDisplayTime());

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setSlTimeStr(getSriLankaDisplayTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch employees list for autocomplete
  useEffect(() => {
    async function loadAllEmployees() {
      setLoadingEmployees(true);
      try {
        const list = await getEmployees();
        setEmployees(list);
      } catch (err) {
        console.error("Error fetching employees:", err);
      } finally {
        setLoadingEmployees(false);
      }
    }
    loadAllEmployees();
  }, []);

  // Sync selectedEmpId when currentUser changes
  useEffect(() => {
    if (currentUser?.employee_id) {
      setSelectedEmpId(currentUser.employee_id);
    }
  }, [currentUser]);

  // Autocomplete Selection
  const handleSelectEmployee = async (empId) => {
    if (!empId) {
      setSelectedEmpId(null);
      logout();
      return;
    }
    const emp = employees.find((e) => e.employee_id === empId);
    if (emp) {
      setSelectedEmpId(empId);
      await selectEmployee(emp);
    }
  };

  const handleClearActiveEmployee = () => {
    setSelectedEmpId(null);
    logout();
  };

  const handleNavigateOrder = () => {
    if (!currentUser) {
      message.info("Please search and select your employee name first.");
      return;
    }
    navigate("/meals/order");
  };

  const handleNavigateReceive = () => {
    if (!currentUser) {
      message.info("Please search and select your employee name first.");
      return;
    }
    navigate("/meals/receive");
  };

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
      {/* Top Navbar */}
      <div
        style={{
          padding: "16px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(0, 0, 0, 0.2)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar
            src="/diet.ico"
            size={46}
            style={{
              backgroundColor: "#ecfdf5",
              border: "2px solid #10b981",
              padding: 4
            }}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.15rem", color: "#ffffff", letterSpacing: "0.02em" }}>
              MEAL MANAGEMENT PROJECT
            </div>
            <div style={{ fontSize: "0.8rem", color: "#a7f3d0", fontWeight: 700 }}>
              Canteen Self-Service Kiosk
            </div>
          </div>
        </div>

        <Space size="middle" wrap>
          {/* Sri Lanka Live Clock */}
          <Tag
            color="emerald"
            style={{
              padding: "6px 14px",
              borderRadius: 10,
              fontSize: 13,
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
            <span>Sri Jayawardenepura Time: <b>{slTimeStr}</b></span>
          </Tag>

          {/* Biometric Status Tag */}
          <Tooltip title="Biometric Listener (Port 5000). Click to test scanner simulator.">
            <Tag
              icon={<ThunderboltOutlined />}
              color={middlewareConnected ? "success" : "warning"}
              onClick={() => setMonitorOpen(true)}
              style={{
                cursor: "pointer",
                fontWeight: 700,
                padding: "6px 14px",
                borderRadius: 10,
                fontSize: 13
              }}
            >
              {middlewareConnected ? "Biometric Ready (Port 5000)" : "Biometric Simulator"}
            </Tag>
          </Tooltip>

          {/* Admin Portal Shortcut */}
          <Button
            type="primary"
            icon={<LockOutlined />}
            onClick={() => navigate(isAdmin ? "/admin/dashboard" : "/admin/login")}
            style={{
              fontWeight: 700,
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.15)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              backdropFilter: "blur(8px)",
              color: "#ffffff"
            }}
          >
            {isAdmin ? "Go to Admin Portal" : "Admin Login"}
          </Button>
        </Space>
      </div>

      {/* Main Kiosk Content Area */}
      <div
        style={{
          flex: 1,
          padding: "36px 24px",
          maxWidth: 960,
          margin: "0 auto",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center"
        }}
      >
        {/* Search & Identification Section */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Title level={2} style={{ color: "#ffffff", fontWeight: 800, margin: 0 }}>
            Select Employee
          </Title>
          <Text style={{ color: "#a7f3d0", fontSize: 15 }}>
            Touch the biometric scanner OR search employee name / ID below
          </Text>

          {/* Autocomplete Search Bar */}
          <div style={{ maxWidth: 680, margin: "20px auto 0" }}>
            <Select
              showSearch
              allowClear
              placeholder="🔍 Search Employee by Name, ID, or Department..."
              value={selectedEmpId}
              onChange={handleSelectEmployee}
              loading={loadingEmployees}
              size="large"
              style={{
                width: "100%",
                borderRadius: 14,
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)"
              }}
              filterOption={(input, option) => {
                const searchStr = (option?.dataSearch || "").toLowerCase();
                return searchStr.includes(input.toLowerCase());
              }}
              dropdownStyle={{ borderRadius: 14, padding: 8 }}
            >
              {employees.map((emp) => (
                <Option
                  key={emp.employee_id}
                  value={emp.employee_id}
                  dataSearch={`${emp.name} ${emp.employee_id} ${emp.section} ${emp.designation}`}
                  label={`${emp.name} (${emp.employee_id})`}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 2px",
                      gap: 12
                    }}
                  >
                    {/* Left: Avatar + Name + ID in single line */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      <Avatar
                        size={28}
                        style={{
                          backgroundColor: "#10b981",
                          fontWeight: 800,
                          flexShrink: 0,
                          fontSize: 13
                        }}
                      >
                        {emp.name ? emp.name[0].toUpperCase() : "U"}
                      </Avatar>
                      <span
                        style={{
                          fontWeight: 700,
                          color: "#0f172a",
                          fontSize: 14,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {emp.name}
                      </span>
                      <Tag
                        color="blue"
                        style={{
                          margin: 0,
                          fontWeight: 700,
                          fontSize: 11,
                          borderRadius: 6,
                          flexShrink: 0
                        }}
                      >
                        {emp.employee_id}
                      </Tag>
                    </div>

                    {/* Right: Section + Category */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <Tag
                        color="default"
                        style={{
                          margin: 0,
                          fontSize: 11,
                          borderRadius: 6,
                          color: "#475569",
                          background: "#f1f5f9"
                        }}
                      >
                        {emp.section || "Operations"}
                      </Tag>
                      <Tag
                        color="cyan"
                        style={{
                          margin: 0,
                          fontWeight: 700,
                          fontSize: 11,
                          borderRadius: 6
                        }}
                      >
                        {emp.category_employment || "Worker"}
                      </Tag>
                    </div>
                  </div>
                </Option>
              ))}
            </Select>
          </div>
        </div>

        {/* Selected Employee Badge */}
        {currentUser && (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              borderRadius: 16,
              padding: "14px 22px",
              marginBottom: 28,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
              border: "2px solid #10b981",
              flexWrap: "wrap",
              gap: 12
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar
                size={48}
                style={{
                  backgroundColor: "#10b981",
                  fontSize: 20,
                  fontWeight: 800
                }}
              >
                {currentUser.name ? currentUser.name[0].toUpperCase() : "U"}
              </Avatar>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#0f172a" }}>
                    {currentUser.name}
                  </span>
                  <Tag color="green" style={{ fontWeight: 700, margin: 0, borderRadius: 6 }}>
                    {currentUser.employee_id}
                  </Tag>
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                  {currentUser.section || "Operations"} • <Tag color="cyan" style={{ margin: 0, fontSize: 11 }}>{currentUser.pay_category || "Free Meal"}</Tag>
                </div>
              </div>
            </div>

            <Button
              danger
              type="text"
              icon={<CloseCircleOutlined />}
              onClick={handleClearActiveEmployee}
              style={{ fontWeight: 600 }}
            >
              Clear / Switch
            </Button>
          </div>
        )}

        {/* ONLY THE TWO MAIN BUTTONS: ORDER MEALS & RECEIVE MEALS */}
        <Row gutter={[24, 24]}>
          {/* 1. ORDER MEALS BUTTON */}
          <Col xs={24} sm={12}>
            <Card
              hoverable
              onClick={handleNavigateOrder}
              style={{
                borderRadius: 24,
                padding: "32px 24px",
                textAlign: "center",
                cursor: "pointer",
                background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
                border: "2px solid rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
                boxShadow: "0 20px 40px -10px rgba(67, 56, 202, 0.45)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 280
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 20,
                  background: "rgba(255, 255, 255, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16
                }}
              >
                <ShoppingOutlined style={{ fontSize: 44, color: "#e0e7ff" }} />
              </div>
              <Title level={2} style={{ color: "#ffffff", margin: 0, fontWeight: 800 }}>
                Order Meals
              </Title>
              <div style={{ fontSize: 15, color: "#c7d2fe", fontWeight: 700, marginTop: 4 }}>
                කෑම ඇණවුම් කිරීම
              </div>
              <Paragraph style={{ color: "#a5b4fc", fontSize: 13, margin: "10px 0 20px" }}>
                Schedule Breakfast, Lunch, or Dinner portions for today or upcoming dates.
              </Paragraph>
              <Button
                type="primary"
                size="large"
                icon={<ArrowRightOutlined />}
                style={{
                  borderRadius: 12,
                  fontWeight: 800,
                  background: "#ffffff",
                  color: "#312e81",
                  border: 0,
                  height: 48,
                  padding: "0 28px",
                  fontSize: 15,
                  boxShadow: "0 4px 14px 0 rgba(0,0,0,0.15)"
                }}
              >
                Open Meal Ordering
              </Button>
            </Card>
          </Col>

          {/* 2. RECEIVE MEALS BUTTON */}
          <Col xs={24} sm={12}>
            <Card
              hoverable
              onClick={handleNavigateReceive}
              style={{
                borderRadius: 24,
                padding: "32px 24px",
                textAlign: "center",
                cursor: "pointer",
                background: "linear-gradient(135deg, #059669 0%, #064e3b 100%)",
                border: "2px solid rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
                boxShadow: "0 20px 40px -10px rgba(5, 150, 105, 0.45)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 280
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 20,
                  background: "rgba(255, 255, 255, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16
                }}
              >
                <CheckCircleOutlined style={{ fontSize: 44, color: "#a7f3d0" }} />
              </div>
              <Title level={2} style={{ color: "#ffffff", margin: 0, fontWeight: 800 }}>
                Receive Meals
              </Title>
              <div style={{ fontSize: 15, color: "#a7f3d0", fontWeight: 700, marginTop: 4 }}>
                කෑම ලබා ගැනීම
              </div>
              <Paragraph style={{ color: "#6ee7b7", fontSize: 13, margin: "10px 0 20px" }}>
                Collect scheduled meal portions in the canteen during serving windows.
              </Paragraph>
              <Button
                type="primary"
                size="large"
                icon={<ArrowRightOutlined />}
                style={{
                  borderRadius: 12,
                  fontWeight: 800,
                  background: "#ffffff",
                  color: "#064e3b",
                  border: 0,
                  height: 48,
                  padding: "0 28px",
                  fontSize: 15,
                  boxShadow: "0 4px 14px 0 rgba(0,0,0,0.15)"
                }}
              >
                Open Meal Dispensing
              </Button>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Biometric Simulator Modal */}
      <FingerprintMonitorModal open={monitorOpen} onClose={() => setMonitorOpen(false)} />
    </div>
  );
}
