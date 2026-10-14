import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, Alert, Avatar, Modal, Divider, Space, Collapse } from "antd";
import { UserOutlined, LockOutlined, ArrowRightOutlined, BookOutlined, FilePdfOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import PortalUserGuide from "../../components/guide/PortalUserGuide";

const { Title, Text, Paragraph } = Typography;

export default function Login() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const { loginManual, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleDownloadPdf = () => {
    const link = document.createElement("a");
    link.href = "/docs/Meal_Management_Web_Portal_User_Manual.pdf";
    link.download = "Meal_Management_Web_Portal_User_Manual.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Redirect to admin dashboard if authenticated
  React.useEffect(() => {
    if (isAuthenticated && isAdmin) {
      const from = location.state?.from?.pathname || "/admin/dashboard";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate, location]);

  const onFinish = async (values) => {
    setErrorMsg("");
    setLoading(true);
    try {
      await loginManual(values.username, values.password);
      navigate("/admin/dashboard");
    } catch (err) {
      setErrorMsg(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at top, #065f46 0%, #064e3b 40%, #0f172a 100%)",
        padding: "24px 16px",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Subtle Background Glows */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(0,0,0,0) 70%)",
          top: "-100px",
          right: "-100px",
          pointerEvents: "none"
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, rgba(0,0,0,0) 70%)",
          bottom: "-80px",
          left: "-80px",
          pointerEvents: "none"
        }}
      />

      <Card
        className="page-enter"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "16px 8px",
          background: "rgba(255, 255, 255, 0.98)",
          borderRadius: 24,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
          border: "1px solid rgba(255, 255, 255, 0.6)",
          zIndex: 1
        }}
      >
        {/* Brand Icon & Heading */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              padding: 12,
              background: "#ecfdf5",
              borderRadius: 20,
              marginBottom: 16,
              border: "1.5px solid #a7f3d0",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.15)"
            }}
          >
            <Avatar src="/diet.ico" size={52} />
          </div>
          <Title level={3} style={{ margin: 0, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
            Meal Management Portal
          </Title>
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, marginTop: 4, display: "block" }}>
            Hayleys Eco Solutions • Operations Portal
          </Text>
        </div>

        {errorMsg && (
          <Alert
            message={errorMsg}
            type="error"
            showIcon
            closable
            style={{ marginBottom: 20, borderRadius: 12, fontSize: 13 }}
            onClose={() => setErrorMsg("")}
          />
        )}

        {/* Login Form */}
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label={<Text strong style={{ fontSize: 13, color: "#334155" }}>Admin Email / ID</Text>}
            rules={[{ required: true, message: "Please enter your admin email or username" }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: "#94a3b8" }} />}
              placeholder="Enter admin email or username"
              size="large"
              style={{ borderRadius: 10 }}
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<Text strong style={{ fontSize: 13, color: "#334155" }}>Password</Text>}
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
              placeholder="Enter password"
              size="large"
              style={{ borderRadius: 10 }}
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 12, marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              icon={<ArrowRightOutlined />}
              style={{
                height: 48,
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 12,
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                boxShadow: "0 6px 20px -4px rgba(16, 185, 129, 0.45)"
              }}
            >
              Sign In to Management Portal
            </Button>
          </Form.Item>

          <Divider style={{ margin: "20px 0 16px", borderColor: "#e2e8f0" }}>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748b" }}>
              User Documentation & Manual
            </Text>
          </Divider>

          {/* User Guide Card inside Form before Login */}
          <div
            style={{
              background: "linear-gradient(145deg, #f0fdf4 0%, #ecfdf5 100%)",
              border: "1.5px solid #a7f3d0",
              borderRadius: 14,
              padding: "14px",
              textAlign: "center",
              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.08)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 16 }}>🌿</span>
              <Text strong style={{ color: "#065f46", fontSize: 13 }}>
                Web Portal User Guide
              </Text>
            </div>
            <Text style={{ fontSize: 11, color: "#475569", display: "block", marginBottom: 12 }}>
              පරිශීලක මාර්ගෝපදේශය • பயனர் வழிகாட்டி
            </Text>

            <Space size="small" style={{ width: "100%", justifyContent: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <Button
                type="primary"
                size="middle"
                icon={<BookOutlined />}
                onClick={() => setIsGuideOpen(true)}
                style={{
                  background: "#15803d",
                  borderColor: "#15803d",
                  fontWeight: 600,
                  fontSize: 12.5,
                  borderRadius: 8
                }}
              >
                View Guide (HTML)
              </Button>

              <Button
                size="middle"
                icon={<FilePdfOutlined />}
                onClick={handleDownloadPdf}
                style={{
                  borderColor: "#86efac",
                  color: "#166534",
                  fontWeight: 600,
                  fontSize: 12.5,
                  borderRadius: 8,
                  background: "#ffffff"
                }}
              >
                PDF Manual (4 MB)
              </Button>
            </Space>

            <Collapse
              ghost
              size="small"
              items={[
                {
                  key: "1",
                  label: (
                    <Text style={{ fontSize: 11.5, color: "#166534", fontWeight: 600 }}>
                      ⚡ Quick 7 Modules Summary
                    </Text>
                  ),
                  children: (
                    <div style={{ textAlign: "left", fontSize: 11, color: "#334155", lineHeight: 1.6 }}>
                      <div>1️⃣ <strong>Secure Login:</strong> Role-based access (<code>#/admin/login</code>)</div>
                      <div>2️⃣ <strong>Dashboard:</strong> Live scheduled, dispensed & workforce count</div>
                      <div>3️⃣ <strong>Today's Reports:</strong> Active orders, filters & Formatted Excel</div>
                      <div>4️⃣ <strong>Previous Day:</strong> Historical audits & date-range lookup</div>
                      <div>5️⃣ <strong>Daily Archives:</strong> 3-day consolidated cloud workbooks</div>
                      <div>6️⃣ <strong>Employees:</strong> 579+ workforce directory & Excel bulk sync</div>
                      <div>7️⃣ <strong>Settings:</strong> Subsidy policies (Full/Half/None) & company master data</div>
                      <div style={{ marginTop: 8, textAlign: "center" }}>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => setIsGuideOpen(true)}
                          style={{ padding: 0, fontSize: 11, fontWeight: 700, color: "#15803d" }}
                        >
                          Open Detailed Guide with Screenshots &rarr;
                        </Button>
                      </div>
                    </div>
                  )
                }
              ]}
            />
          </div>
        </Form>
      </Card>

      {/* Top Floating Guide Pill */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 10
        }}
      >
        <Button
          icon={<BookOutlined />}
          onClick={() => setIsGuideOpen(true)}
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            color: "#ffffff",
            fontWeight: 600,
            borderRadius: 20,
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
          }}
        >
          Portal Guide (HTML & PDF)
        </Button>
      </div>

      {/* Pre-login User Guide Modal */}
      <Modal
        title={null}
        footer={null}
        open={isGuideOpen}
        onCancel={() => setIsGuideOpen(false)}
        width={1150}
        style={{ top: 20 }}
        styles={{ body: { padding: "12px 16px 24px" } }}
      >
        <PortalUserGuide onDownloadPdf={handleDownloadPdf} />
      </Modal>
    </div>
  );
}
