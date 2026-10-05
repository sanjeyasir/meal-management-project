import React, { useState, useEffect } from "react";
import { Modal, Button, Table, Tag, Space, Alert, Typography, Input, message, Tabs, Badge, Card, Row, Col, Radio } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  UserOutlined,
  SendOutlined,
  DesktopOutlined,
  ShoppingOutlined,
  CheckOutlined
} from "@ant-design/icons";
import { checkMiddlewareHealth, getMiddlewareLogs, simulateScan, KIOSK_DEVICES } from "../../services/fingerprintBridge";
import { getEmployees } from "../../services/firebase/employeeService";

const { Text, Paragraph } = Typography;

export default function FingerprintMonitorModal({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState({ online: false, port: 4370, kiosks: KIOSK_DEVICES });
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [targetKiosk, setTargetKiosk] = useState("ORDERING"); // "ORDERING" | "RECEIVING"
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

  const handleSimulate = async (emp, kioskChoice = targetKiosk) => {
    try {
      const res = await simulateScan(emp, kioskChoice);
      const kioskName = kioskChoice === "ORDERING" ? "Ordering Kiosk (192.168.8.168:4370)" : "Receiving Kiosk (192.168.8.160:4370)";
      message.success(`Simulated scan from ${kioskName} for ${emp.name} (${emp.employee_id})`);
      onClose();
    } catch (err) {
      message.error(`Simulation failed: ${err.message}`);
    }
  };

  const handleCustomSend = async () => {
    if (!customPayload.trim()) return;
    try {
      await simulateScan({ raw: customPayload }, targetKiosk);
      message.success(`Custom payload dispatched to middleware as ${targetKiosk} kiosk!`);
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
      width: 100,
      render: (t) => (t ? new Date(t).toLocaleTimeString() : "-")
    },
    {
      title: "Kiosk / Source IP",
      key: "kioskSource",
      width: 220,
      render: (_, r) => {
        const isOrdering = r.sourceIp === "192.168.8.168" || r.kioskType === "ORDERING" || r.kioskRole === "ORDERING_KIOSK";
        const isReceiving = r.sourceIp === "192.168.8.160" || r.kioskType === "RECEIVING" || r.kioskRole === "RECEIVING_KIOSK";
        return (
          <Space direction="vertical" size={2}>
            <Tag color={isOrdering ? "indigo" : isReceiving ? "green" : "blue"}>
              {isOrdering ? "📱 Ordering Kiosk" : isReceiving ? "🍲 Receiving Kiosk" : r.kioskName || r.source}
            </Tag>
            <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
              {r.sourceIp || "127.0.0.1"}:{r.port || 4370}
            </span>
          </Space>
        );
      }
    },
    {
      title: "Action / Target",
      key: "action",
      width: 140,
      render: (_, r) => (
        <Tag color={r.targetAction === "ORDER" ? "purple" : r.targetAction === "RECEIVE" ? "cyan" : "default"}>
          {r.targetAction || "GENERAL"}
        </Tag>
      )
    },
    {
      title: "Employee ID",
      dataIndex: "employeeId",
      key: "employeeId",
      width: 120,
      render: (id) => id ? <Tag color="blue" style={{ fontWeight: 700 }}>{id}</Tag> : "-"
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
          <span>Biometric & Hardware Kiosk Middleware Monitor</span>
          <Badge
            status={health.online ? "success" : "error"}
            text={health.online ? `Port ${health.port || 4370} Active` : "Offline / Browser Mode"}
          />
        </div>
      }
      open={open}
      onCancel={onClose}
      width={880}
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={refreshData} loading={loading}>
          Refresh
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Done
        </Button>
      ]}
    >
      {/* Kiosk Hardware Endpoints Status Cards */}
      <div style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <Card
              size="small"
              style={{
                borderRadius: 12,
                border: "1.5px solid #818cf8",
                background: "#f5f3ff"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, color: "#3730a3", fontSize: 13 }}>
                  📱 Ordering Kiosk Terminal
                </span>
                <Tag color="indigo" style={{ fontWeight: 700 }}>Target: Order Meals</Tag>
              </div>
              <div style={{ fontSize: 12, marginTop: 4, color: "#4338ca", fontFamily: "monospace" }}>
                IP: <b>192.168.8.168</b> • Port: <b>4370</b>
              </div>
              <div style={{ fontSize: 11, color: "#6366f1", marginTop: 2 }}>
                Listening for POST / on http://192.168.8.168:4370
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12}>
            <Card
              size="small"
              style={{
                borderRadius: 12,
                border: "1.5px solid #86efac",
                background: "#f0fdf4"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, color: "#166534", fontSize: 13 }}>
                  🍲 Receiving Kiosk Terminal
                </span>
                <Tag color="green" style={{ fontWeight: 700 }}>Target: Dispense Meals</Tag>
              </div>
              <div style={{ fontSize: 12, marginTop: 4, color: "#15803d", fontFamily: "monospace" }}>
                IP: <b>192.168.8.160</b> • Port: <b>4370</b>
              </div>
              <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2 }}>
                Listening for POST / on http://192.168.8.160:4370
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      <Tabs
        defaultActiveKey="simulate"
        items={[
          {
            key: "simulate",
            label: "⚡ Quick Kiosk Simulator",
            children: (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, background: "#f8fafc", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                    Simulate Touch on Kiosk:
                  </span>
                  <Radio.Group
                    value={targetKiosk}
                    onChange={(e) => setTargetKiosk(e.target.value)}
                    buttonStyle="solid"
                  >
                    <Radio.Button value="ORDERING">
                      📱 Ordering Kiosk (192.168.8.168)
                    </Radio.Button>
                    <Radio.Button value="RECEIVING">
                      🍲 Receiving Kiosk (192.168.8.160)
                    </Radio.Button>
                  </Radio.Group>
                </div>

                <Paragraph type="secondary" style={{ fontSize: 13 }}>
                  Click an employee below to trigger a simulated biometric scan from the selected Kiosk terminal:
                </Paragraph>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, maxHeight: 320, overflowY: "auto", padding: 2 }}>
                  {employees.map((emp) => (
                    <div
                      key={emp.employee_id}
                      onClick={() => handleSimulate(emp)}
                      style={{
                        padding: "12px 14px",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        background: "#ffffff",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = targetKiosk === "ORDERING" ? "#6366f1" : "#10b981";
                        e.currentTarget.style.background = targetKiosk === "ORDERING" ? "#f5f3ff" : "#ecfdf5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e2e8f0";
                        e.currentTarget.style.background = "#ffffff";
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 14 }}>{emp.name}</Text>
                        <Tag color={targetKiosk === "ORDERING" ? "indigo" : "emerald"}>{emp.employee_id}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{emp.designation}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                        <span>{emp.section || "Operations"}</span>
                        <Tag color="cyan" style={{ margin: 0, fontSize: 10 }}>{emp.pay_category || "Free Meal"}</Tag>
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
                <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Originating Terminal:</span>
                  <Radio.Group value={targetKiosk} onChange={(e) => setTargetKiosk(e.target.value)}>
                    <Radio value="ORDERING">Ordering Kiosk (192.168.8.168:4370)</Radio>
                    <Radio value="RECEIVING">Receiving Kiosk (192.168.8.160:4370)</Radio>
                  </Radio.Group>
                </div>

                <Paragraph type="secondary">
                  Send a raw tab-separated string (e.g. <code>EMP001\tName\tRole</code>), ZKTeco punch string, or JSON payload:
                </Paragraph>
                <Input.TextArea
                  rows={3}
                  value={customPayload}
                  onChange={(e) => setCustomPayload(e.target.value)}
                  placeholder="EMP_ID\tEmployee Name\tDesignation"
                />
                <Button type="primary" icon={<SendOutlined />} onClick={handleCustomSend}>
                  Transmit POST Payload to Port {health.port || 4370}
                </Button>
              </Space>
            )
          },
          {
            key: "logs",
            label: `📜 Live Scan Logs (${logs.length})`,
            children: (
              <Table
                dataSource={logs}
                columns={logColumns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 6 }}
              />
            )
          }
        ]}
      />
    </Modal>
  );
}
