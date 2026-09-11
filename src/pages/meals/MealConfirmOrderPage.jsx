import React, { useState, useEffect } from "react";
import { Card, Row, Col, Typography, Button, Divider, Alert, Tag, Space, List, Spin, message } from "antd";
import {
  CheckCircleFilled,
  CloseCircleFilled,
  ArrowLeftOutlined,
  ShoppingOutlined,
  CheckOutlined,
  SoundOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { createMealOrder } from "../../services/firebase/mealService";
import { getCategoryByName } from "../../services/firebase/categoryService";

const { Title, Text, Paragraph } = Typography;

export default function MealConfirmOrderPage() {
  const { currentUser } = useAuth();
  const { playSuccessChime } = useNotification();
  const navigate = useNavigate();

  const [orderData, setOrderData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("pending_meal_order");
    if (raw) {
      try {
        setOrderData(JSON.parse(raw));
      } catch (e) {
        navigate("/meals/order");
      }
    } else {
      navigate("/meals/order");
    }
  }, [navigate]);

  if (!orderData) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  const handleConfirmCreation = async () => {
    setSubmitting(true);
    try {
      // 1. Resolve Category Info from Firestore
      const categoryConfig = await getCategoryByName(orderData.category_name || currentUser.category_name);
      const payCategory = categoryConfig?.configuration_detail || orderData.pay_category || "Free Meal";

      // 2. Batch Create in Firestore
      const outcome = await createMealOrder(payCategory, orderData, currentUser.name);
      
      setResults(outcome);
      setSubmitted(true);
      playSuccessChime();

      const successCount = outcome.filter(o => o.type === "success").length;
      if (successCount > 0) {
        message.success(`${successCount} meal allocations successfully scheduled in Firestore!`);
      }
    } catch (err) {
      console.error("Order creation error:", err);
      message.error(`Failed creating meal order: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/meals/order")}
          style={{ borderRadius: 10, fontWeight: 600 }}
        >
          Back to Order
        </Button>
        <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
          Confirm Meal Order
        </Title>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left: Order Summary Review */}
        <Col xs={24} md={12}>
          <Card
            className="glass-card"
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ShoppingOutlined style={{ color: "#10b981", fontSize: 18 }} />
                <span style={{ fontWeight: 800 }}>Order Details Summary</span>
              </div>
            }
            style={{ borderRadius: 16 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">Employee ID:</Text>
                <Text strong>{orderData.emp_id}</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">Employee Name:</Text>
                <Text strong>{orderData.emp_name}</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">Designation:</Text>
                <Text strong>{orderData.current_designation || orderData.designation || "Staff"}</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">Company & Section:</Text>
                <Text strong>{orderData.company} • {orderData.section}</Text>
              </div>

              <Divider style={{ margin: "8px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">Start Date:</Text>
                <Tag color="blue" style={{ margin: 0, fontWeight: 700 }}>{orderData.start_date}</Tag>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">End Date:</Text>
                <Tag color="blue" style={{ margin: 0, fontWeight: 700 }}>{orderData.end_date}</Tag>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">Total Scheduling Days:</Text>
                <Text strong>{orderData.total_days} Day(s)</Text>
              </div>

              <Divider style={{ margin: "8px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">Breakfast / Day:</Text>
                <Text strong>{orderData.breakfast} portion(s)</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">Lunch / Day:</Text>
                <Text strong>{orderData.lunch} portion(s)</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">Dinner / Day:</Text>
                <Text strong>{orderData.dinner} portion(s)</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">Payment Category:</Text>
                <Tag color="success" style={{ margin: 0, fontWeight: 700 }}>
                  {orderData.pay_category || "Free Meal"}
                </Tag>
              </div>
            </div>

            <Divider style={{ margin: "20px 0" }} />

            {!submitted ? (
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                <Button
                  type="primary"
                  size="large"
                  icon={<CheckOutlined />}
                  loading={submitting}
                  onClick={handleConfirmCreation}
                  block
                  style={{
                    height: 48,
                    fontWeight: 700,
                    fontSize: 16,
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    boxShadow: "0 6px 18px -4px rgba(16, 185, 129, 0.4)"
                  }}
                >
                  Yes, Create Meal Order
                </Button>

                <Button
                  type="default"
                  onClick={() => navigate("/kiosk")}
                  block
                  style={{ borderRadius: 10, fontWeight: 600 }}
                >
                  Return to Canteen Kiosk
                </Button>
              </Space>
            ) : (
              <Button
                type="primary"
                size="large"
                onClick={() => navigate("/kiosk")}
                block
                style={{ height: 46, borderRadius: 10, fontWeight: 700 }}
              >
                Done • Back to Canteen Kiosk
              </Button>
            )}
          </Card>
        </Col>

        {/* Right: Trilingual Creation Outcome Logs */}
        <Col xs={24} md={12}>
          <Card
            className="glass-card"
            title={<span style={{ fontWeight: 800 }}>Order Generation Feedback</span>}
            style={{ borderRadius: 16, height: "100%" }}
          >
            {results.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                <ShoppingOutlined style={{ fontSize: 42, color: "#cbd5e1", marginBottom: 12 }} />
                <Paragraph type="secondary">
                  Click <b>"Yes, Create Meal Order"</b> to write and schedule these allocations directly into Firebase Firestore.
                </Paragraph>
              </div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                <List
                  dataSource={results}
                  renderItem={(item) => {
                    const isSuccess = item.type === "success";
                    return (
                      <div
                        style={{
                          padding: "12px 16px",
                          borderRadius: 12,
                          marginBottom: 10,
                          background: isSuccess ? "#f0fdf4" : "#fef2f2",
                          border: `1px solid ${isSuccess ? "#bbf7d0" : "#fecaca"}`
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          {isSuccess ? (
                            <CheckCircleFilled style={{ color: "#10b981", fontSize: 18, marginTop: 2 }} />
                          ) : (
                            <CloseCircleFilled style={{ color: "#ef4444", fontSize: 18, marginTop: 2 }} />
                          )}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: isSuccess ? "#166534" : "#991b1b" }}>
                              {item.message}
                            </div>
                            <div style={{ fontSize: 12, color: isSuccess ? "#15803d" : "#b91c1c", marginTop: 4 }}>
                              {isSuccess
                                ? "සාර්ථකව ඇණවුම් කරන ලදී • வெற்றிகரமாக ஆர்டர் செய்யப்பட்டது"
                                : "දැනටමත් ඇණවුම් කර ඇත • ஏற்கனவே ஆர்டர் செய்யப்பட்டது"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
