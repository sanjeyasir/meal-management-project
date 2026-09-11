import React, { useState, useEffect } from "react";
import { Card, Row, Col, Typography, Button, DatePicker, InputNumber, Space, Alert, Tag, Avatar, Divider, message } from "antd";
import {
  ArrowLeftOutlined,
  ShoppingOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  MinusOutlined,
  CalendarOutlined,
  CoffeeOutlined,
  FireOutlined,
  SmileOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getNextFiveDaysMeals, formatDateKey } from "../../services/firebase/mealService";

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

export default function MealOrderPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // State for meal counts
  const [breakfast, setBreakfast] = useState(1);
  const [lunch, setLunch] = useState(1);
  const [dinner, setDinner] = useState(0);

  // Date range defaults to today -> today or today -> +1
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [orderReady, setOrderReady] = useState(false);
  const [orderSummary, setOrderSummary] = useState(null);
  const [upcomingMeals, setUpcomingMeals] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);

  // Fetch upcoming 5 days allocations
  useEffect(() => {
    if (!currentUser?.employee_id) return;
    const fetchUpcoming = async () => {
      setLoadingUpcoming(true);
      try {
        const data = await getNextFiveDaysMeals(currentUser.employee_id);
        setUpcomingMeals(data);
      } catch (err) {
        console.error("Error fetching upcoming meals:", err);
      } finally {
        setLoadingUpcoming(false);
      }
    };
    fetchUpcoming();
  }, [currentUser]);

  // Handle Set Order Calculation
  const handleSetOrder = () => {
    if (!startDate || !endDate) {
      message.error("Please select a valid date range.");
      return;
    }

    if (breakfast + lunch + dinner === 0) {
      message.error("Please select at least 1 meal (Breakfast, Lunch, or Dinner).");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
      message.error("End date cannot be earlier than start date.");
      return;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const summary = {
      emp_id: currentUser.employee_id,
      emp_name: currentUser.name,
      current_designation: currentUser.designation,
      company: currentUser.company || "Hayleys Eco Solutions",
      section: currentUser.section || "Operations",
      category_name: currentUser.category_name || "Worker",
      pay_category: currentUser.pay_category || "Free Meal",
      start_date: formatDateKey(start),
      end_date: formatDateKey(end),
      total_days: totalDays,
      breakfast,
      lunch,
      dinner,
      total_meals: (breakfast + lunch + dinner) * totalDays
    };

    setOrderSummary(summary);
    setOrderReady(true);
    message.success(`Order calculated: ${totalDays} day(s), total ${summary.total_meals} meals.`);
  };

  // Proceed to Confirmation Screen
  const handleConfirmOrder = () => {
    if (!orderReady || !orderSummary) {
      handleSetOrder();
    }
    
    // Store in session storage for confirm page
    sessionStorage.setItem("pending_meal_order", JSON.stringify(orderSummary || {
      emp_id: currentUser.employee_id,
      emp_name: currentUser.name,
      current_designation: currentUser.designation,
      company: currentUser.company,
      section: currentUser.section,
      category_name: currentUser.category_name,
      pay_category: currentUser.pay_category,
      start_date: formatDateKey(startDate),
      end_date: formatDateKey(endDate),
      total_days: Math.ceil(Math.abs(new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1,
      breakfast,
      lunch,
      dinner,
    }));

    navigate("/meals/confirm-order");
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      {/* Back Button & Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/kiosk")}
          style={{ borderRadius: 10, fontWeight: 600 }}
        >
          Back to Kiosk
        </Button>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
            Order Meals (කෑම ඇණවුම්)
          </Title>
          <Text type="secondary">
            Select meals and scheduling period for <b>{currentUser?.name}</b> ({currentUser?.employee_id})
          </Text>
        </div>
      </div>


      <Row gutter={[24, 24]}>
        {/* Left: Meal Configuration Form */}
        <Col xs={24} lg={15}>
          <Card className="glass-card" style={{ padding: "8px 12px" }}>
            <Title level={4} style={{ fontWeight: 800, marginBottom: 20 }}>
              1. Select Daily Meal Portions
            </Title>

            {/* Meal Portion Cards */}
            <Row gutter={[16, 16]}>
              {/* Breakfast Counter */}
              <Col xs={24} sm={8}>
                <Card
                  style={{
                    textAlign: "center",
                    borderRadius: 16,
                    border: breakfast > 0 ? "2px solid #f59e0b" : "1px solid #e2e8f0",
                    background: breakfast > 0 ? "#fffbeb" : "#f8fafc",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ fontSize: 32, color: "#d97706", marginBottom: 6 }}>☕</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#92400e" }}>Breakfast</div>
                  <div style={{ fontSize: 12, color: "#b45309", marginBottom: 12 }}>උදෑසන • காலை</div>

                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
                    <Button
                      shape="circle"
                      icon={<MinusOutlined />}
                      disabled={breakfast <= 0}
                      onClick={() => { setBreakfast(Math.max(0, breakfast - 1)); setOrderReady(false); }}
                    />
                    <span style={{ fontSize: 20, fontWeight: 800, minWidth: 24 }}>{breakfast}</span>
                    <Button
                      shape="circle"
                      type="primary"
                      icon={<PlusOutlined />}
                      style={{ background: "#d97706" }}
                      onClick={() => { setBreakfast(breakfast + 1); setOrderReady(false); }}
                    />
                  </div>
                </Card>
              </Col>

              {/* Lunch Counter */}
              <Col xs={24} sm={8}>
                <Card
                  style={{
                    textAlign: "center",
                    borderRadius: 16,
                    border: lunch > 0 ? "2px solid #10b981" : "1px solid #e2e8f0",
                    background: lunch > 0 ? "#ecfdf5" : "#f8fafc",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ fontSize: 32, color: "#059669", marginBottom: 6 }}>🍲</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#065f46" }}>Lunch</div>
                  <div style={{ fontSize: 12, color: "#047857", marginBottom: 12 }}>දවල් • மதியம்</div>

                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
                    <Button
                      shape="circle"
                      icon={<MinusOutlined />}
                      disabled={lunch <= 0}
                      onClick={() => { setLunch(Math.max(0, lunch - 1)); setOrderReady(false); }}
                    />
                    <span style={{ fontSize: 20, fontWeight: 800, minWidth: 24 }}>{lunch}</span>
                    <Button
                      shape="circle"
                      type="primary"
                      icon={<PlusOutlined />}
                      style={{ background: "#059669" }}
                      onClick={() => { setLunch(lunch + 1); setOrderReady(false); }}
                    />
                  </div>
                </Card>
              </Col>

              {/* Dinner Counter */}
              <Col xs={24} sm={8}>
                <Card
                  style={{
                    textAlign: "center",
                    borderRadius: 16,
                    border: dinner > 0 ? "2px solid #ef4444" : "1px solid #e2e8f0",
                    background: dinner > 0 ? "#fef2f2" : "#f8fafc",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ fontSize: 32, color: "#dc2626", marginBottom: 6 }}>🍽</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#991b1b" }}>Dinner</div>
                  <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 12 }}>රාත්‍රී • இரவு</div>

                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
                    <Button
                      shape="circle"
                      icon={<MinusOutlined />}
                      disabled={dinner <= 0}
                      onClick={() => { setDinner(Math.max(0, dinner - 1)); setOrderReady(false); }}
                    />
                    <span style={{ fontSize: 20, fontWeight: 800, minWidth: 24 }}>{dinner}</span>
                    <Button
                      shape="circle"
                      type="primary"
                      icon={<PlusOutlined />}
                      style={{ background: "#dc2626" }}
                      onClick={() => { setDinner(dinner + 1); setOrderReady(false); }}
                    />
                  </div>
                </Card>
              </Col>
            </Row>

            <Divider style={{ margin: "24px 0" }} />

            <Title level={4} style={{ fontWeight: 800, marginBottom: 16 }}>
              2. Select Scheduling Date Range
            </Title>

            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>From Date:</div>
                <input
                  type="date"
                  value={formatDateKey(startDate)}
                  onChange={(e) => {
                    setStartDate(new Date(e.target.value));
                    setOrderReady(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    fontSize: 15,
                    fontWeight: 600,
                    outline: "none"
                  }}
                />
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>To Date:</div>
                <input
                  type="date"
                  value={formatDateKey(endDate)}
                  onChange={(e) => {
                    setEndDate(new Date(e.target.value));
                    setOrderReady(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    fontSize: 15,
                    fontWeight: 600,
                    outline: "none"
                  }}
                />
              </Col>
            </Row>

            <Divider style={{ margin: "24px 0" }} />

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <Button
                type="default"
                size="large"
                onClick={handleSetOrder}
                style={{ borderRadius: 10, fontWeight: 700, minWidth: 140 }}
              >
                Set Order
              </Button>

              <Button
                type="primary"
                size="large"
                icon={<CheckCircleOutlined />}
                onClick={handleConfirmOrder}
                style={{
                  borderRadius: 10,
                  fontWeight: 700,
                  minWidth: 180,
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  boxShadow: "0 6px 18px -4px rgba(16, 185, 129, 0.4)"
                }}
              >
                Confirm Order
              </Button>

              {orderReady && orderSummary && (
                <Tag color="success" style={{ padding: "6px 12px", fontSize: 13, fontWeight: 700 }}>
                  Ready: {orderSummary.total_days} Day(s) • {orderSummary.total_meals} Meals Total
                </Tag>
              )}
            </div>
          </Card>
        </Col>

        {/* Right: Employee Profile & Upcoming Allocations Reference */}
        <Col xs={24} lg={9}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {/* Employee Quick Card */}
            <Card className="glass-card" style={{ borderRadius: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8, color: "#0f172a" }}>
                Ordering For:
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar size={46} style={{ backgroundColor: "#10b981", fontWeight: 800 }}>
                  {currentUser?.name ? currentUser.name[0].toUpperCase() : "U"}
                </Avatar>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{currentUser?.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {currentUser?.employee_id} • {currentUser?.designation}
                  </div>
                  <Tag color="emerald" style={{ marginTop: 4, fontWeight: 700 }}>
                    {currentUser?.pay_category || "Free Meal"}
                  </Tag>
                </div>
              </div>
            </Card>

            {/* Upcoming Allocations Visual */}
            <Card
              title={<span style={{ fontWeight: 800, fontSize: 14 }}>Upcoming 5-Day Allocations</span>}
              className="glass-card"
              style={{ borderRadius: 16 }}
            >
              {upcomingMeals.length === 0 ? (
                <Text type="secondary">No existing meal allocations for the next 5 days.</Text>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                  {upcomingMeals.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{m.date}</div>
                        <div style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>{m.meal_type}</div>
                      </div>
                      <Tag color={m.status === "Recieved" ? "green" : "blue"} style={{ fontWeight: 700 }}>
                        {m.status}
                      </Tag>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}
