import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, Divider, Alert, Space, Avatar } from "antd";
import { UserOutlined, LockOutlined, ArrowRightOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const { Title, Text, Paragraph } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { loginManual, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // ONLY redirect to admin dashboard if currently authenticated user is an ADMIN
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
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #0f172a 100%)",
      padding: 20
    }}>
      <Card
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: 440,
          padding: "20px 12px",
          background: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)"
        }}
      >
        {/* Brand Icon & Heading */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            display: "inline-flex",
            padding: 12,
            background: "#ecfdf5",
            borderRadius: "50%",
            marginBottom: 12,
            border: "2px solid #10b981"
          }}>
            <Avatar src="/diet.ico" size={54} />
          </div>
          <Title level={3} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
            Admin Portal Login
          </Title>
          <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>
            Meal Management Project • Admin Portal
          </Text>
        </div>

        {errorMsg && (
          <Alert
            message={errorMsg}
            type="error"
            showIcon
            closable
            style={{ marginBottom: 20, borderRadius: 10 }}
            onClose={() => setErrorMsg("")}
          />
        )}

        {/* Manual Login Form */}
        <Form
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ username: "admin", password: "admin" }}
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label={<Text strong style={{ fontSize: 13 }}>Admin Username / ID</Text>}
            rules={[{ required: true, message: "Please enter your Username" }]}
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
            label={<Text strong style={{ fontSize: 13 }}>Password</Text>}
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
              placeholder="e.g. admin"
              size="large"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 8, marginTop: 20 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              icon={<ArrowRightOutlined />}
              style={{
                height: 48,
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 10,
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                boxShadow: "0 6px 18px -4px rgba(16, 185, 129, 0.45)"
              }}
            >
              Sign In to Management Portal
            </Button>
          </Form.Item>

          <div style={{ textAlign: "center", marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Default Admin: <b>admin</b> / <b>admin</b> or <b>admin123</b>
            </Text>
          </div>

          <Divider style={{ margin: "20px 0 16px" }} />

          <Button
            block
            type="default"
            onClick={() => navigate("/kiosk")}
            style={{
              height: 42,
              borderRadius: 10,
              fontWeight: 700,
              borderColor: "#cbd5e1",
              color: "#334155"
            }}
          >
            ← Return to Canteen Kiosk
          </Button>
        </Form>
      </Card>
    </div>
  );
}


