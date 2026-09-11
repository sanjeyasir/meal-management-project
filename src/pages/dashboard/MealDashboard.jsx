import React, { useState, useEffect } from "react";
import { Card, Row, Col, Typography, Button, Tag, Space, Avatar, Spin, Divider, Statistic, message } from "antd";
import {
  ShoppingOutlined,
  CheckCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  TableOutlined,
  CoffeeOutlined,
  FireOutlined,
  SmileOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getMealStatistics, getMealAllocationsForToday } from "../../services/firebase/mealService";

const { Title, Text, Paragraph } = Typography;

export default function MealDashboard() {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    requested: { total: 0, breakfast: 0, lunch: 0, dinner: 0 },
    recieved: { total: 0, breakfast: 0, lunch: 0, dinner: 0 },
    half_paid: { total: 0, breakfast: 0, lunch: 0, dinner: 0 },
    not_paid: { total: 0, breakfast: 0, lunch: 0, dinner: 0 },
    free: { total: 0, breakfast: 0, lunch: 0, dinner: 0 }
  });

  const loadStats = async () => {
    if (!currentUser?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMealStatistics(currentUser.employee_id);
      setStats(data);
    } catch (err) {
      console.error("Error loading meal statistics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [currentUser]);

  const handleReceiveNavigation = async () => {
    // Check if there are any meal allocations for today
    try {
      const todayMeals = await getMealAllocationsForToday(currentUser?.employee_id);
      const b = todayMeals?.meals_ordered?.Breakfast?.Ordered || 0;
      const l = todayMeals?.meals_ordered?.Lunch?.Ordered || 0;
      const d = todayMeals?.meals_ordered?.Dinner?.Ordered || 0;
      const rb = todayMeals?.meals_ordered?.Breakfast?.Recieved || 0;
      const rl = todayMeals?.meals_ordered?.Lunch?.Recieved || 0;
      const rd = todayMeals?.meals_ordered?.Dinner?.Recieved || 0;

      if (b + l + d === 0 && rb + rl + rd === 0) {
        message.warning("No meal records found for today. Please order your meals first.");
      }
      navigate("/meals/receive");
    } catch {
      navigate("/meals/receive");
    }
  };

  const statCardsData = [
    { title: "Total Requested", count: stats.requested.total, b: stats.requested.breakfast, l: stats.requested.lunch, d: stats.requested.dinner, color: "#3b82f6", bg: "#eff6ff" },
    { title: "Total Received", count: stats.recieved.total, b: stats.recieved.breakfast, l: stats.recieved.lunch, d: stats.recieved.dinner, color: "#10b981", bg: "#ecfdf5" },
    { title: "Total Half-Paid", count: stats.half_paid.total, b: stats.half_paid.breakfast, l: stats.half_paid.lunch, d: stats.half_paid.dinner, color: "#f59e0b", bg: "#fffbeb" },
    { title: "Total Not Paid", count: stats.not_paid.total, b: stats.not_paid.breakfast, l: stats.not_paid.lunch, d: stats.not_paid.dinner, color: "#ef4444", bg: "#fef2f2" },
    { title: "Total Free Meals", count: stats.free.total, b: stats.free.breakfast, l: stats.free.lunch, d: stats.free.dinner, color: "#8b5cf6", bg: "#f5f3ff" }
  ];

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", width: "100%" }}>
      {/* Welcome Banner */}
      <div style={{
        background: "linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%)",
        borderRadius: 20,
        padding: "24px 32px",
        color: "#ffffff",
        marginBottom: 24,
        boxShadow: "0 10px 25px -5px rgba(6, 78, 59, 0.25)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16
      }}>
        <div>
          <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a7f3d0", fontWeight: 700, marginBottom: 4 }}>
            Meal Management Project Canteen Operations
          </div>
          <Title level={2} style={{ color: "#ffffff", margin: 0, fontWeight: 800 }}>
            Welcome, {currentUser?.name || "Employee"}!
          </Title>
          <Text style={{ color: "#d1fae5", fontSize: 14 }}>
            Emp ID: <b>{currentUser?.employee_id}</b> • {currentUser?.section || "Operations"} • Category: <b>{currentUser?.category_name || "Worker"} ({currentUser?.pay_category || "Free Meal"})</b>
          </Text>
        </div>

        <Space size="middle">
          <Tag color="success" style={{ padding: "6px 14px", borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
            {currentUser?.pay_category || "Free Meal"}
          </Tag>
          <Button
            type="primary"
            icon={<CalendarOutlined />}
            onClick={() => navigate("/meals/my-allocations")}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              borderColor: "rgba(255, 255, 255, 0.3)",
              backdropFilter: "blur(8px)",
              fontWeight: 600,
              height: 42
            }}
          >
            My 5-Day Plan
          </Button>
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Column: Two Giant Primary Action Cards */}
        <Col xs={24} lg={16}>
          <Row gutter={[20, 20]}>
            {/* 1. ORDER MEALS CARD */}
            <Col xs={24} sm={12}>
              <Card
                hoverable
                onClick={() => navigate("/meals/order")}
                style={{
                  height: "100%",
                  minHeight: 280,
                  borderRadius: 20,
                  border: "2px solid #e0e7ff",
                  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  textAlign: "center",
                  padding: 24,
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: "0 8px 24px -4px rgba(99, 102, 241, 0.12)"
                }}
                className="glass-card"
              >
                <div style={{
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 44,
                  marginBottom: 16,
                  boxShadow: "0 10px 20px -5px rgba(99, 102, 241, 0.4)"
                }}>
                  <ShoppingOutlined />
                </div>

                <Title level={3} style={{ margin: 0, fontWeight: 800, color: "#1e1b4b" }}>
                  Order Meals
                </Title>
                <div style={{ fontSize: 13, color: "#6366f1", fontWeight: 700, margin: "4px 0" }}>
                  කෑම ඇණවුම් කිරීම • உணவுகளை ஆர்டர் செய்யுங்கள்
                </div>
                <Paragraph type="secondary" style={{ fontSize: 13, margin: "8px 0 16px" }}>
                  Schedule Breakfast, Lunch, and Dinner for single or multi-day periods.
                </Paragraph>

                <Button
                  type="primary"
                  icon={<ArrowRightOutlined />}
                  style={{
                    borderRadius: 10,
                    fontWeight: 700,
                    height: 42,
                    background: "#4f46e5",
                    padding: "0 24px"
                  }}
                >
                  Create Meal Order
                </Button>
              </Card>
            </Col>

            {/* 2. RECEIVE MEALS CARD */}
            <Col xs={24} sm={12}>
              <Card
                hoverable
                onClick={handleReceiveNavigation}
                style={{
                  height: "100%",
                  minHeight: 280,
                  borderRadius: 20,
                  border: "2px solid #d1fae5",
                  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  textAlign: "center",
                  padding: 24,
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: "0 8px 24px -4px rgba(16, 185, 129, 0.12)"
                }}
                className="glass-card"
              >
                <div style={{
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 44,
                  marginBottom: 16,
                  boxShadow: "0 10px 20px -5px rgba(16, 185, 129, 0.4)"
                }}>
                  <CheckCircleOutlined />
                </div>

                <Title level={3} style={{ margin: 0, fontWeight: 800, color: "#064e3b" }}>
                  Receive Meals
                </Title>
                <div style={{ fontSize: 13, color: "#059669", fontWeight: 700, margin: "4px 0" }}>
                  කෑම ලබා ගැනීම • உணவு பெறுங்கள்
                </div>
                <Paragraph type="secondary" style={{ fontSize: 13, margin: "8px 0 16px" }}>
                  Instant canteen dispensing kiosk for today's scheduled meal portions.
                </Paragraph>

                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  style={{
                    borderRadius: 10,
                    fontWeight: 700,
                    height: 42,
                    background: "#059669",
                    padding: "0 24px"
                  }}
                >
                  Dispense Today's Meal
                </Button>
              </Card>
            </Col>
          </Row>

          {/* Quick Shortcuts */}
          <div style={{ marginTop: 24 }}>
            <Card className="glass-card" style={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <Space size="middle">
                  <Avatar style={{ backgroundColor: "#10b981" }} icon={<CalendarOutlined />} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>My Scheduled Allocations</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>View next 5-day meal schedule and statuses</div>
                  </div>
                </Space>
                <Button type="default" onClick={() => navigate("/meals/my-allocations")} style={{ fontWeight: 600 }}>
                  View All Allocations
                </Button>
              </div>
            </Card>
          </div>
        </Col>

        {/* Right Column: Employee Profile Card & Live Meal Stat Cards */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {/* Employee Profile Card */}
            <Card
              className="glass-card"
              style={{
                borderRadius: 16,
                background: "#ffffff",
                border: "1px solid #e2e8f0"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <Avatar
                  size={52}
                  style={{
                    backgroundColor: "#10b981",
                    fontSize: 22,
                    fontWeight: 800
                  }}
                >
                  {currentUser?.name ? currentUser.name[0].toUpperCase() : "U"}
                </Avatar>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>
                    {currentUser?.name}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    {currentUser?.designation}
                  </div>
                  <Tag color="emerald" style={{ marginTop: 4, fontWeight: 700 }}>
                    {currentUser?.employee_id}
                  </Tag>
                </div>
              </div>

              <Divider style={{ margin: "12px 0" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text type="secondary">Company:</Text>
                  <Text strong>{currentUser?.company || "Hayleys Eco Solutions"}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text type="secondary">Section:</Text>
                  <Text strong>{currentUser?.section || "Operations"}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text type="secondary">Category:</Text>
                  <Text strong>{currentUser?.category_name || "Worker"}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text type="secondary">Payment Status:</Text>
                  <Tag color="success" style={{ margin: 0, fontWeight: 700 }}>
                    {currentUser?.pay_category || "Free Meal"}
                  </Tag>
                </div>
              </div>
            </Card>

            {/* Meal Statistics Container */}
            <Card
              title={
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>My Meal Statistics</span>
                  {loading && <Spin size="small" />}
                </div>
              }
              className="glass-card"
              style={{ borderRadius: 16 }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
                {statCardsData.map((sc, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: sc.bg,
                      border: `1px solid ${sc.color}25`
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <Text strong style={{ fontSize: 14, color: sc.color }}>
                        {sc.title}
                      </Text>
                      <Tag color={sc.color} style={{ margin: 0, fontWeight: 800, fontSize: 13 }}>
                        {sc.count} Meals
                      </Tag>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569" }}>
                      <span>☕ B'fast: <b>{sc.b}</b></span>
                      <span>🍲 Lunch: <b>{sc.l}</b></span>
                      <span>🍽 Dinner: <b>{sc.d}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}
