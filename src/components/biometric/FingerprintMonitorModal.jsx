import React, { useState, useEffect } from "react";
import { Modal, Button, Table, Tag, Space, Alert, Typography, Input, message, Tabs, Badge } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, ThunderboltOutlined, UserOutlined, SendOutlined } from "@ant-design/icons";
import { checkMiddlewareHealth, getMiddlewareLogs, simulateScan } from "../../services/fingerprintBridge";
import { getEmployees } from "../../services/firebase/employeeService";

const { Text, Paragraph } = Typography;

export default function FingerprintMonitorModal({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState({ online: false, port: 5000 });
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customPayload, setCustomPayload] = useState("EMP001\tSanjey Asirvatham\tQuality Lead");

  const refreshData = async () => {
    setLoading(true);
    try {
      const h = await checkMiddlewareHealth();
      setHealth(h);
      const l = await getMiddlewareLogs();
      setLogs(l.logs || []);
      const emps = await getEmployees();
      setEmployees(emps);
    } catch (e) {
      console.warn("Failed refreshing monitor data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      refreshData();
      const timer = setInterval(refreshData, 3000);
      return () => clearInterval(timer);
    }
  }, [open]);

  const handleSimulate = async (emp) => {
    try {
      await simulateScan(emp);
      message.success(`Simulated scan for ${emp.name} (${emp.employee_id})`);
      onClose();
    } catch (err) {
      message.error(`Simulation failed: ${err.message}`);
    }
  };

  const handleCustomSend = async () => {
    if (!customPayload.trim()) return;
    try {
      await simulateScan({ raw: customPayload });
      message.success("Custom payload dispatched to middleware!");
      onClose();
    } catch (err) {
      message.error(`Dispatch failed: ${err.message}`);
    }
  };

  const logColumns = [
    {
      title: "Time",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 120,
      render: (t) => t ? new Date(t).toLocaleTimeString() : "-"
    },
    {
      title: "Source",
      dataIndex: "source",
      key: "source",
      width: 140,
      render: (s) => (
        <Tag color={s === "PHYSICAL_DEVICE" ? "green" : "blue"}>{s}</Tag>
      )
    },
    {
      title: "Payload Data",
      dataIndex: "raw",
      key: "raw",
      render: (r) => <Text code copyable>{r}</Text>
    }
  ];

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThunderboltOutlined style={{ color: "#10b981", fontSize: 20 }} />
          <span>Biometric Middleware & Live Scan Simulator</span>
          <Badge
            status={health.online ? "success" : "error"}
            text={health.online ? "Port 5000 Active" : "Port 5000 Offline"}
          />
        </div>
      }
      open={open}
      onCancel={onClose}
      width={780}
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={refreshData} loading={loading}>
          Refresh
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Done
        </Button>
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        {health.online ? (
          <Alert
            type="success"
            showIcon
            message="Fingerprint Middleware Listener Online"
            description="The HTTP server is listening on 0.0.0.0:5000 for biometric POST requests. Physical biometric scanners can transmit directly to http://<IP>:5000."
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            message="Middleware Offline / Running in Browser Fallback Mode"
            description="The background Node.js server on port 5000 is not detected. UI Simulation works locally in-memory, or run 'npm run app:dev' to start both together."
          />
        )}
      </div>

      <Tabs
        defaultActiveKey="simulate"
        items={[
          {
            key: "simulate",
            label: "⚡ Quick Employee Scan Simulator",
            children: (
              <div>
                <Paragraph type="secondary">
                  Click any employee below to simulate their biometric fingerprint scan:
                </Paragraph>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                  {employees.map((emp) => (
                    <div
                      key={emp.employee_id}
                      onClick={() => handleSimulate(emp)}
                      style={{
                        padding: "12px 16px",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        background: "#f8fafc",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#10b981";
                        e.currentTarget.style.background = "#ecfdf5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e2e8f0";
                        e.currentTarget.style.background = "#f8fafc";
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 14 }}>{emp.name}</Text>
                        <Tag color="emerald">{emp.employee_id}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{emp.designation}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                        Category: <b>{emp.category_employment || "Worker"}</b>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          },
          {
            key: "custom",
            label: "🛠 Custom HTTP POST Payload",
            children: (
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                <Paragraph type="secondary">
                  Send a raw tab-separated string (e.g. <code>EMP001\tName\tRole</code>) or JSON payload to simulate third-party hardware:
                </Paragraph>
                <Input.TextArea
                  rows={3}
                  value={customPayload}
                  onChange={(e) => setCustomPayload(e.target.value)}
                  placeholder="EMP_ID\tEmployee Name\tDesignation"
                />
                <Button type="primary" icon={<SendOutlined />} onClick={handleCustomSend}>
                  Transmit Payload
                </Button>
              </Space>
            )
          },
          {
            key: "logs",
            label: "📜 Live Scan Logs",
            children: (
              <Table
                dataSource={logs}
                columns={logColumns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 5 }}
              />
            )
          }
        ]}
      />
    </Modal>
  );
}
