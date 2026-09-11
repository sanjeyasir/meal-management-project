import React, { useState, useEffect, useMemo } from "react";
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
  Alert,
  Spin,
  Tooltip,
  Badge,
  Modal
} from "antd";
import {
  ThunderboltOutlined,
  UserOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ShoppingOutlined,
  CalendarOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CheckCircleFilled
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { getEmployees } from "../../services/firebase/employeeService";
import { getMealAllocationsForToday, updateMealAllocationStatus, formatDateKey } from "../../services/firebase/mealService";
import FingerprintMonitorModal from "../../components/biometric/FingerprintMonitorModal";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Sri Jayawardenepura Kotte Time Helper (Asia/Colombo, UTC+05:30)
function getSriLankaTime() {
  const now = new Date();
  const hourPart = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Colombo", hour: "numeric", hour12: false }).format(now);
  const minutePart = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Colombo", minute: "numeric" }).format(now);
  const secondPart = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Colombo", second: "numeric" }).format(now);

  const hour = parseInt(hourPart, 10);
  const minute = parseInt(minutePart, 10);
  const second = parseInt(secondPart, 10);
  const totalMinutes = hour * 60 + minute;

  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(now); // YYYY-MM-DD
  const displayTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(now);

  return { hour, minute, second, totalMinutes, dateStr, displayTime };
}

export default function CanteenKiosk() {
  const { currentUser, selectEmployee, logout, middlewareConnected, isAdmin } = useAuth();
  const { playSuccessChime } = useNotification();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState(currentUser?.employee_id || null);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [slTime, setSlTime] = useState(getSriLankaTime());

  // Active employee's meal status
  const [todaySummary, setTodaySummary] = useState(null);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [dispensing, setDispensing] = useState(false);
  const [dispensedAlert, setDispensedAlert] = useState("");

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setSlTime(getSriLankaTime());
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

  // Sync selectedEmpId when currentUser changes (e.g. from Biometrics)
  useEffect(() => {
    if (currentUser?.employee_id) {
      setSelectedEmpId(currentUser.employee_id);
      fetchTodayMeals(currentUser.employee_id);
    }
  }, [currentUser]);

  const fetchTodayMeals = async (empId) => {
    if (!empId) return;
    setLoadingMeals(true);
    try {
      const data = await getMealAllocationsForToday(empId);
      setTodaySummary(data);
    } catch (err) {
      console.error("Error loading today's meals:", err);
    } finally {
      setLoadingMeals(false);
    }
  };

  // Autocomplete Selection
  const handleSelectEmployee = async (empId) => {
    if (!empId) {
      setSelectedEmpId(null);
      return;
    }
    const emp = employees.find((e) => e.employee_id === empId);
    if (emp) {
      setSelectedEmpId(empId);
      await selectEmployee(emp);
      await fetchTodayMeals(empId);
    }
  };

  // Determine current active serving window
  const activeMealSlot = useMemo(() => {
    const mins = slTime.totalMinutes;
    if (mins >= 360 && mins <= 540) return { key: "Breakfast", name: "Breakfast (උදෑසන)", time: "06:00 - 09:00 AM" };
    if (mins >= 660 && mins <= 780) return { key: "Lunch", name: "Lunch (දවල්)", time: "11:00 AM - 01:00 PM" };
    if (mins >= 960 && mins <= 1260) return { key: "Dinner", name: "Dinner (රාත්‍රී)", time: "04:00 - 09:00 PM" };
    return null;
  }, [slTime]);

  // Handle 1-Click Dispensing for the current active slot
  const handleDirectDispense = async (mealKey) => {
    if (!currentUser?.employee_id) return;
    const mealInfo = todaySummary?.meals_ordered?.[mealKey];
    if (!mealInfo || !mealInfo.id) {
      return;
    }

    setDispensing(true);
    try {
      const res = await updateMealAllocationStatus(mealInfo.id, "Recieved");
      if (res.success) {
        playSuccessChime();
        setDispensedAlert(`✅ ${mealKey} portion successfully dispensed for ${currentUser.name}!`);
        await fetchTodayMeals(currentUser.employee_id);
      }
    } catch (err) {
      console.error("Dispense error:", err);
    } finally {
      setDispensing(false);
    }
  };

  const handleClearActiveEmployee = () => {
    setSelectedEmpId(null);
    logout();
    setTodaySummary(null);
    setDispensedAlert("");
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
              Canteen Dispensing & Ordering Kiosk
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
            <span>Sri Jayawardenepura Time: <b>{slTime.displayTime}</b></span>
          </Tag>

          {/* Biometric Status Tag */}
          <Tooltip title="Biometric Listener (Port 5000). Click to test/simulate scanner.">
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
      <div style={{ flex: 1, padding: "28px 24px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        {/* Search & Identification Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Title level={2} style={{ color: "#ffffff", fontWeight: 800, margin: 0 }}>
            Canteen Self-Service Terminal
          </Title>
          <Text style={{ color: "#a7f3d0", fontSize: 15 }}>
            Touch the biometric scanner OR search employee name below to order or receive meals
          </Text>

          {/* Autocomplete Search Bar */}
          <div style={{ maxWidth: 720, margin: "20px auto 0" }}>
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

                    {/* Right: Section + Category clearly in-line */}
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

        {/* Success Alert Banner */}
        {dispensedAlert && (
          <Alert
            type="success"
            showIcon
            closable
            message={<span style={{ fontWeight: 800, fontSize: 16 }}>{dispensedAlert}</span>}
            description="Meal collection confirmed and saved in real-time Firestore database. Enjoy your meal!"
            style={{ marginBottom: 24, borderRadius: 14 }}
            onClose={() => setDispensedAlert("")}
          />
        )}

        {/* Dynamic State: If Employee is Active vs Waiting */}
        {currentUser ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Active Employee Card */}
            <Card
              className="glass-card"
              style={{
                borderRadius: 20,
                background: "#ffffff",
                border: "2px solid #10b981",
                boxShadow: "0 15px 35px -5px rgba(0, 0, 0, 0.25)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <Avatar
                    size={64}
                    style={{
                      backgroundColor: "#10b981",
                      fontSize: 26,
                      fontWeight: 800
                    }}
                  >
                    {currentUser.name ? currentUser.name[0].toUpperCase() : "U"}
                  </Avatar>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Title level={3} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
                        {currentUser.name}
                      </Title>
                      <Tag color="green" style={{ fontWeight: 700, padding: "2px 10px", borderRadius: 6 }}>
                        {currentUser.employee_id}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 14, color: "#475569", marginTop: 2 }}>
                      {currentUser.designation || "Staff"} • <b>{currentUser.section || "Operations"}</b> • {currentUser.company || "Hayleys Eco Solutions"}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                      <Tag color="emerald" style={{ fontWeight: 700, fontSize: 12 }}>
                        Subsidy: {currentUser.pay_category || "Free Meal"}
                      </Tag>
                      <Tag color="blue" style={{ fontWeight: 600, fontSize: 12 }}>
                        Category: {currentUser.category_name || "Worker"}
                      </Tag>
                    </div>
                  </div>
                </div>

                <Button
                  danger
                  type="default"
                  icon={<CloseCircleOutlined />}
                  onClick={handleClearActiveEmployee}
                  style={{ borderRadius: 10, fontWeight: 600, height: 40 }}
                >
                  Clear / Switch Employee
                </Button>
              </div>
            </Card>

            {/* Today's Dispensing Status Grid */}
            <Row gutter={[20, 20]}>
              {[
                {
                  key: "Breakfast",
                  title: "Breakfast / උදෑසන",
                  time: "06:00 - 09:00 AM",
                  icon: "☕",
                  color: "#d97706",
                  bg: "#fffbeb",
                  ordered: todaySummary?.meals_ordered?.Breakfast?.Ordered || 0,
                  received: todaySummary?.meals_ordered?.Breakfast?.Recieved || 0
                },
                {
                  key: "Lunch",
                  title: "Lunch / දවල්",
                  time: "11:00 AM - 01:00 PM",
                  icon: "🍲",
                  color: "#059669",
                  bg: "#ecfdf5",
                  ordered: todaySummary?.meals_ordered?.Lunch?.Ordered || 0,
                  received: todaySummary?.meals_ordered?.Lunch?.Recieved || 0
                },
                {
                  key: "Dinner",
                  title: "Dinner / රාත්‍රී",
                  time: "04:00 - 09:00 PM",
                  icon: "🍽",
                  color: "#dc2626",
                  bg: "#fef2f2",
                  ordered: todaySummary?.meals_ordered?.Dinner?.Ordered || 0,
                  received: todaySummary?.meals_ordered?.Dinner?.Recieved || 0
                }
              ].map((m) => {
                const isCurrentWindow = activeMealSlot?.key === m.key;
                const isReady = m.ordered > 0 && m.received === 0 && isCurrentWindow;
                const isDone = m.received > 0;

                return (
                  <Col xs={24} sm={8} key={m.key}>
                    <Card
                      style={{
                        borderRadius: 18,
                        textAlign: "center",
                        padding: 16,
                        background: isDone ? "#f0fdf4" : isReady ? "#ffffff" : "#f8fafc",
                        border: isReady ? `3px solid ${m.color}` : isDone ? "2px solid #86efac" : "1px solid #e2e8f0",
                        boxShadow: isReady ? "0 10px 25px -5px rgba(16, 185, 129, 0.3)" : "none"
                      }}
                    >
                      <div style={{ fontSize: 40, marginBottom: 6 }}>{m.icon}</div>
                      <Title level={4} style={{ margin: 0, fontWeight: 800, color: m.color }}>
                        {m.title}
                      </Title>
                      <div style={{ fontSize: 12, color: "#64748b", margin: "4px 0 12px" }}>
                        Serving: <b>{m.time}</b>
                      </div>

                      {/* Status Tag */}
                      <div style={{ marginBottom: 16 }}>
                        {isDone ? (
                          <Tag icon={<CheckCircleFilled />} color="success" style={{ fontWeight: 800, padding: "5px 12px", fontSize: 13 }}>
                            Received / ලබාගත්තා
                          </Tag>
                        ) : isReady ? (
                          <Tag color="processing" style={{ fontWeight: 800, padding: "5px 12px", fontSize: 13, background: "#ecfdf5", color: "#065f46", border: "1px solid #10b981" }}>
                            ⚡ Ready to Dispense
                          </Tag>
                        ) : m.ordered > 0 ? (
                          <Tag color="warning" style={{ fontWeight: 600, padding: "4px 10px", fontSize: 12 }}>
                            Outside Window ({m.time})
                          </Tag>
                        ) : (
                          <Tag color="default" style={{ fontWeight: 600, padding: "4px 10px", fontSize: 12 }}>
                            Not Scheduled Today
                          </Tag>
                        )}
                      </div>

                      {/* 1-Click Dispense Button */}
                      {isReady && (
                        <Button
                          type="primary"
                          icon={<CheckCircleOutlined />}
                          loading={dispensing}
                          onClick={() => handleDirectDispense(m.key)}
                          style={{
                            width: "100%",
                            height: 44,
                            fontWeight: 800,
                            borderRadius: 10,
                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            boxShadow: "0 6px 16px -3px rgba(16, 185, 129, 0.4)"
                          }}
                        >
                          Dispense {m.key} Now
                        </Button>
                      )}
                    </Card>
                  </Col>
                );
              })}
            </Row>

            {/* Giant Primary Action Buttons */}
            <Row gutter={[20, 20]}>
              <Col xs={24} sm={12}>
                <Card
                  hoverable
                  onClick={() => navigate("/meals/order")}
                  style={{
                    borderRadius: 20,
                    padding: 20,
                    textAlign: "center",
                    cursor: "pointer",
                    background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
                    color: "#ffffff",
                    boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4)"
                  }}
                >
                  <ShoppingOutlined style={{ fontSize: 44, color: "#e0e7ff", marginBottom: 8 }} />
                  <Title level={3} style={{ color: "#ffffff", margin: 0, fontWeight: 800 }}>
                    Order Meals (කෑම ඇණවුම්)
                  </Title>
                  <Paragraph style={{ color: "#c7d2fe", fontSize: 13, margin: "6px 0 16px" }}>
                    Schedule Breakfast, Lunch, and Dinner for single or multi-day factory shifts.
                  </Paragraph>
                  <Button
                    size="large"
                    style={{
                      borderRadius: 10,
                      fontWeight: 700,
                      background: "#ffffff",
                      color: "#3730a3",
                      border: 0
                    }}
                  >
                    Open Meal Ordering Screen
                  </Button>
                </Card>
              </Col>

              <Col xs={24} sm={12}>
                <Card
                  hoverable
                  onClick={() => navigate("/meals/receive")}
                  style={{
                    borderRadius: 20,
                    padding: 20,
                    textAlign: "center",
                    cursor: "pointer",
                    background: "linear-gradient(135deg, #059669 0%, #064e3b 100%)",
                    color: "#ffffff",
                    boxShadow: "0 10px 25px -5px rgba(5, 150, 105, 0.4)"
                  }}
                >
                  <CheckCircleOutlined style={{ fontSize: 44, color: "#a7f3d0", marginBottom: 8 }} />
                  <Title level={3} style={{ color: "#ffffff", margin: 0, fontWeight: 800 }}>
                    Receive Meals (කෑම ලබා ගැනීම)
                  </Title>
                  <Paragraph style={{ color: "#a7f3d0", fontSize: 13, margin: "6px 0 16px" }}>
                    Full canteen dispensing interface with Sri Jayawardenepura serving window checks.
                  </Paragraph>
                  <Button
                    size="large"
                    style={{
                      borderRadius: 10,
                      fontWeight: 700,
                      background: "#ffffff",
                      color: "#065f46",
                      border: 0
                    }}
                  >
                    Open Full Dispensing View
                  </Button>
                </Card>
              </Col>
            </Row>
          </div>
        ) : (
          /* Waiting State: Biometric Touchpad & Information */
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <Card
              className="glass-card"
              style={{
                borderRadius: 24,
                padding: "32px 24px",
                textAlign: "center",
                background: "rgba(255, 255, 255, 0.95)",
                boxShadow: "0 20px 45px -10px rgba(0, 0, 0, 0.3)"
              }}
            >
              {/* Biometric Touch Animation */}
              <div
                className="fingerprint-pulse"
                onClick={() => setMonitorOpen(true)}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 48,
                  margin: "0 auto 16px",
                  cursor: "pointer",
                  boxShadow: "0 10px 25px -4px rgba(16, 185, 129, 0.5)"
                }}
                title="Click to test/simulate biometric scanner"
              >
                <ThunderboltOutlined />
              </div>

              <Title level={3} style={{ color: "#0f172a", fontWeight: 800, margin: 0 }}>
                Touch Biometric Scanner
              </Title>
              <div style={{ fontSize: 15, color: "#059669", fontWeight: 700, margin: "4px 0" }}>
                ඇඟිලි සලකුණ තබන්න • கைரேகையை வைக்கவும்
              </div>
              <Paragraph type="secondary" style={{ fontSize: 14, maxWidth: 500, margin: "8px auto 20px" }}>
                {middlewareConnected
                  ? "Biometric device connected on Port 5000. Touch scanner or search your name above."
                  : "Biometric Scanner Ready. Place finger on device or search name above."}
              </Paragraph>

              <Button
                type="dashed"
                icon={<ThunderboltOutlined />}
                onClick={() => setMonitorOpen(true)}
                style={{
                  borderRadius: 10,
                  fontWeight: 600,
                  color: "#059669",
                  borderColor: "#10b981"
                }}
              >
                Open Biometric Scan Simulator
              </Button>
            </Card>

            {/* Serving Hours Quick Reference */}
            <div
              style={{
                marginTop: 24,
                background: "rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(10px)",
                borderRadius: 16,
                padding: "16px 20px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                display: "flex",
                justifyContent: "space-around",
                flexWrap: "wrap",
                gap: 12,
                textAlign: "center"
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: 14 }}>☕ Breakfast</div>
                <div style={{ fontSize: 12, color: "#ffffff" }}>06:00 - 09:00 AM</div>
              </div>
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.2)" }} />
              <div>
                <div style={{ fontWeight: 700, color: "#34d399", fontSize: 14 }}>🍲 Lunch</div>
                <div style={{ fontSize: 12, color: "#ffffff" }}>11:00 AM - 01:00 PM</div>
              </div>
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.2)" }} />
              <div>
                <div style={{ fontWeight: 700, color: "#f87171", fontSize: 14 }}>🍽 Dinner</div>
                <div style={{ fontSize: 12, color: "#ffffff" }}>04:00 - 09:00 PM</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Biometric Simulator Modal */}
      <FingerprintMonitorModal open={monitorOpen} onClose={() => setMonitorOpen(false)} />
    </div>
  );
}
