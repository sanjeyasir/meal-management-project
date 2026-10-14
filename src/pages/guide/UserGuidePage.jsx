import React from "react";
import { Button, Card } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import PortalUserGuide from "../../components/guide/PortalUserGuide";

export default function UserGuidePage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: "24px 16px"
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/admin/login")}
            style={{ fontWeight: 600, borderRadius: 8 }}
          >
            Back to Portal Login
          </Button>
        </div>

        <Card
          bordered={false}
          style={{
            borderRadius: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
            overflow: "hidden"
          }}
        >
          <PortalUserGuide />
        </Card>
      </div>
    </div>
  );
}
