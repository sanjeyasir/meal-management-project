import React, { useState, useEffect, useMemo } from "react";
import { Card, Row, Col, Typography, Button, Tag, Avatar, Space, Alert, Spin, Divider, Badge, Switch, message, Tooltip } from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  CoffeeOutlined,
  FireOutlined,
  SmileOutlined,
  ClockCircleOutlined,
  LockOutlined,
  UnlockOutlined,
  SoundOutlined,
  EnvironmentOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { getMealAllocationsForToday, updateMealAllocationStatus, formatDateKey } from "../../services/firebase/mealService";

const { Title, Text, Paragraph } = Typography;

// Helper to get Sri Jayawardenepura / Sri Lanka Time (Asia/Colombo)
function getSriLankaTime() {
  const now = new Date();
  
  // Format parts for exact hour and minute in Asia/Colombo timezone
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

export default function MealReceivePage() {
  const { currentUser, isAdmin } = useAuth();
  const { playSuccessChime } = useNotification();
  const navigate = useNavigate();

  const [slTime, setSlTime] = useState(getSriLankaTime());
  const [loading, setLoading] = useState(true);
  const [todaySummary, setTodaySummary] = useState(null);
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [dispensing, setDispensing] = useState(false);
  const [dispensedMessage, setDispensedMessage] = useState("");
  const [adminOverride, setAdminOverride] = useState(false);

  // Keep Sri Jayawardenepura clock live with 1-second interval
  useEffect(() => {
    const timer = setInterval(() => {
      setSlTime(getSriLankaTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTodayMeals = async () => {
    if (!currentUser?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMealAllocationsForToday(currentUser.employee_id);
      setTodaySummary(data);

      // Auto-select eligible active meal slot if within time window
      const mins = slTime.totalMinutes;
      if (mins >= 360 && mins <= 540 && data?.meals_ordered?.Breakfast?.Ordered > 0 && data?.meals_ordered?.Breakfast?.Recieved === 0) {
        setSelectedMealType("Breakfast");
      } else if (mins >= 660 && mins <= 780 && data?.meals_ordered?.Lunch?.Ordered > 0 && data?.meals_ordered?.Lunch?.Recieved === 0) {
        setSelectedMealType("Lunch");
      } else if (mins >= 960 && mins <= 1260 && data?.meals_ordered?.Dinner?.Ordered > 0 && data?.meals_ordered?.Dinner?.Recieved === 0) {
        setSelectedMealType("Dinner");
      }
    } catch (err) {
      console.error("Error loading today's meals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodayMeals();
  }, [currentUser]);

  // Meal window verification based on Sri Jayawardenepura Time
  // Breakfast: 6:00 AM (360m) - 9:00 AM (540m)
  // Lunch: 11:00 AM (660m) - 1:00 PM (780m)
  // Dinner: 4:00 PM (960m) - 9:00 PM (1260m)
  const isMealTimeValid = (mealKey) => {
    if (adminOverride) return true;
    const mins = slTime.totalMinutes;
    if (mealKey === "Breakfast") {
      return mins >= 360 && mins <= 540; // 06:00 - 09:00
    }
    if (mealKey === "Lunch") {
      return mins >= 660 && mins <= 780; // 11:00 - 13:00
    }
    if (mealKey === "Dinner") {
      return mins >= 960 && mins <= 1260; // 16:00 - 21:00
    }
    return false;
  };

  const handleConfirmReceive = async () => {
    if (!selectedMealType) {
      message.error("Please select a meal slot first!");
      return;
    }

    if (!isMealTimeValid(selectedMealType)) {
      message.warning(`"${selectedMealType}" is outside official canteen serving hours (Sri Jayawardenepura Time).`);
      return;
    }

    const mealInfo = todaySummary?.meals_ordered?.[selectedMealType];
    if (!mealInfo || !mealInfo.id) {
      message.error(`No active "${selectedMealType}" order found for today to dispense.`);
      return;
    }

    if (mealInfo.Recieved > 0) {
      message.warning(`"${selectedMealType}" has already been received today.`);
      return;
    }

    setDispensing(true);
    try {
      const res = await updateMealAllocationStatus(mealInfo.id, "Recieved");
      if (res.success) {
        playSuccessChime();
        setDispensedMessage(`✅ ${selectedMealType} Confirmed & Dispensed for ${currentUser.name}!`);
        message.success(`${selectedMealType} portion confirmed!`);
        await loadTodayMeals();
      } else {
        message.error(`Failed to update status: ${res.message}`);
      }
    } catch (err) {
      message.error(`Dispensing error: ${err.message}`);
    } finally {
      setDispensing(false);
    }
  };

  const meals = [
    {
      key: "Breakfast",
      title: "Breakfast",
      sinhala: "උදෑසන (6:00 - 9:00 AM)",
      tamil: "காலை (6:00 - 9:00 AM)",
      timeWindow: "06:00 AM - 09:00 AM",
      icon: "☕",
      color: "#d97706",
      bg: "#fffbeb",
      data: todaySummary?.meals_ordered?.Breakfast
    },
    {
      key: "Lunch",
      title: "Lunch",
      sinhala: "දවල් (11:00 AM - 1:00 PM)",
      tamil: "மதியம் (11:00 AM - 1:00 PM)",
      timeWindow: "11:00 AM - 01:00 PM",
      icon: "🍲",
      color: "#059669",
      bg: "#ecfdf5",
      data: todaySummary?.meals_ordered?.Lunch
    },
    {
      key: "Dinner",
      title: "Dinner",
      sinhala: "රාත්‍රී (4:00 - 9:00 PM)",
      tamil: "இரவு (4:00 - 9:00 PM)",
      timeWindow: "04:00 PM - 09:00 PM",
      icon: "🍽",
      color: "#dc2626",
      bg: "#fef2f2",
      data: todaySummary?.meals_ordered?.Dinner
    }
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <Space size="middle">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/kiosk")}
            style={{ borderRadius: 10, fontWeight: 600 }}
          >
            Back to Kiosk
          </Button>
          <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
            Receive Meals (කෑම ලබා ගැනීම)
          </Title>
        </Space>

        {/* Live Sri Jayawardenepura Time Tag */}
        <Space size="small">
          <Tag color="emerald" style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <EnvironmentOutlined />
            <span>Sri Jayawardenepura Time: <b>{slTime.displayTime}</b> ({slTime.dateStr})</span>
          </Tag>

          {isAdmin && (
            <Tooltip title="Admin Override: bypass time window restrictions for testing/dispensing">
              <Space style={{ background: "#f8fafc", padding: "4px 10px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Override:</span>
                <Switch size="small" checked={adminOverride} onChange={setAdminOverride} />
              </Space>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* Serving Window Guidelines */}
      <div style={{
        background: "#f0fdf4",
        border: "1.5px solid #86efac",
        borderRadius: 16,
        padding: "16px 24px",
        textAlign: "center",
        marginBottom: 24
      }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "#166534", marginBottom: 4 }}>
          🕒 Canteen Serving Hours (Sri Jayawardenepura Kotte Time)
        </div>
        <div style={{ fontSize: 14, color: "#15803d", fontWeight: 600 }}>
          Breakfast (6:00 - 9:00 AM) • Lunch (11:00 AM - 1:00 PM) • Dinner (4:00 - 9:00 PM)
        </div>
        <div style={{ fontSize: 12, color: "#166534", marginTop: 4 }}>
          උදෑසන (6-9) | දවල් (11-1) | රාත්‍රී (4-9) • காலை (6-9) | மதியம் (11-1) | இரவு (4-9)
        </div>
      </div>

      {dispensedMessage && (
        <Alert
          type="success"
          showIcon
          closable
          message={<span style={{ fontWeight: 700, fontSize: 15 }}>{dispensedMessage}</span>}
          description="Your meal status has been recorded in the Firestore database. Enjoy your meal!"
          style={{ marginBottom: 24, borderRadius: 12 }}
          onClose={() => setDispensedMessage("")}
        />
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Spin size="large" tip="Loading today's meal allocations..." />
        </div>
      ) : (
        <Row gutter={[20, 20]}>
          {meals.map((m) => {
            const isOrdered = (m.data?.Ordered || 0) > 0;
            const isReceived = (m.data?.Recieved || 0) > 0;
            const isTimeValid = isMealTimeValid(m.key);
            const isReadyToDispense = isOrdered && !isReceived && isTimeValid;
            const isSelected = selectedMealType === m.key;

            return (
              <Col xs={24} sm={8} key={m.key}>
                <Card
                  hoverable={isReadyToDispense}
                  onClick={() => {
                    if (isReadyToDispense) {
                      setSelectedMealType(m.key);
                    } else if (isOrdered && !isTimeValid) {
                      message.info(`"${m.title}" serving window is ${m.timeWindow} (Sri Lanka Time).`);
                    }
                  }}
                  style={{
                    borderRadius: 18,
                    textAlign: "center",
                    padding: 16,
                    border: isSelected
                      ? `3px solid ${m.color}`
                      : isReceived
                        ? "2px solid #86efac"
                        : isReadyToDispense
                          ? `2px dashed ${m.color}`
                          : "1px solid #e2e8f0",
                    background: isReceived
                      ? "#f0fdf4"
                      : isSelected
                        ? m.bg
                        : isReadyToDispense
                          ? "#ffffff"
                          : "#f8fafc",
                    cursor: isReadyToDispense ? "pointer" : "default",
                    opacity: (!isOrdered || (!isReadyToDispense && !isReceived)) ? 0.75 : 1,
                    transition: "all 0.3s"
                  }}
                  className={isSelected ? "glass-card" : ""}
                >
                  <div style={{ fontSize: 44, marginBottom: 8 }}>{m.icon}</div>
                  <Title level={4} style={{ margin: 0, fontWeight: 800, color: m.color }}>
                    {m.title}
                  </Title>
                  <div style={{ fontSize: 12, color: "#475569", fontWeight: 600, margin: "4px 0" }}>
                    {m.sinhala}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>
                    {m.tamil}
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isReceived ? (
                      <Tag icon={<CheckCircleFilled />} color="success" style={{ fontWeight: 700, padding: "4px 10px", fontSize: 12 }}>
                        Received / ලබාගත්තා
                      </Tag>
                    ) : isOrdered ? (
                      isTimeValid ? (
                        <Tag icon={<CheckCircleOutlined />} color="processing" style={{ fontWeight: 800, padding: "5px 12px", fontSize: 13, background: "#ecfdf5", color: "#065f46", borderColor: "#10b981" }}>
                          ⚡ Ready to Dispense
                        </Tag>
                      ) : (
                        <Tag icon={<LockOutlined />} color="warning" style={{ fontWeight: 600, padding: "4px 10px", fontSize: 12 }}>
                          Outside Serving Window ({m.timeWindow})
                        </Tag>
                      )
                    ) : (
                      <Tag color="default" style={{ fontWeight: 600, padding: "4px 10px", fontSize: 12 }}>
                        Not Ordered
                      </Tag>
                    )}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Confirm Action Button */}
      <div style={{ marginTop: 32, textAlign: "center" }}>
        <Button
          type="primary"
          size="large"
          icon={<CheckCircleOutlined />}
          loading={dispensing}
          disabled={!selectedMealType || !isMealTimeValid(selectedMealType) || todaySummary?.meals_ordered?.[selectedMealType]?.Recieved > 0 || todaySummary?.meals_ordered?.[selectedMealType]?.Ordered === 0}
          onClick={handleConfirmReceive}
          style={{
            height: 56,
            minWidth: 280,
            fontSize: 18,
            fontWeight: 800,
            borderRadius: 14,
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            boxShadow: "0 8px 24px -4px rgba(16, 185, 129, 0.45)"
          }}
        >
          Confirm & Dispense Meal
        </Button>
      </div>
    </div>
  );
}
