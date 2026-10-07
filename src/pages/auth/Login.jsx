import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, Alert, Avatar } from "antd";
import { UserOutlined, LockOutlined, ArrowRightOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const { Title, Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { loginManual, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      setErrorMsg(err.message || "Invalid username or password");
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
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ username: "admin", password: "admin" }}
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label={<Text strong style={{ fontSize: 13, color: "#334155" }}>Admin Username / ID</Text>}
            rules={[{ required: true, message: "Please enter your username" }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: "#94a3b8" }} />}
              placeholder="e.g. admin"
              size="large"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<Text strong style={{ fontSize: 13, color: "#334155" }}>Password</Text>}
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
              placeholder="e.g. admin"
              size="large"
              style={{ borderRadius: 10 }}
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

          <div
            style={{
              textAlign: "center",
              marginTop: 18,
              padding: "10px 14px",
              background: "#f8fafc",
              borderRadius: 10,
              border: "1px solid #f1f5f9"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <SafetyCertificateOutlined style={{ color: "#10b981", fontSize: 13 }} />
              <Text type="secondary" style={{ fontSize: 12, color: "#64748b" }}>
                Default Login: <b>admin</b> / <b>admin</b>
              </Text>
            </div>
          </div>
        </Form>
      </Card>
    </div>
  );
}
