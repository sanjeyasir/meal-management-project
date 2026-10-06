import React, { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Table,
  Tag,
  Space,
  Alert,
  Typography,
  Input,
  message,
  Tabs,
  Badge,
  Card,
  Row,
  Col,
  Radio,
  Form,
  Divider,
  Tooltip
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  UserOutlined,
  SendOutlined,
  DesktopOutlined,
  ShoppingOutlined,
  CheckOutlined,
  SettingOutlined,
  ApiOutlined,
  GlobalOutlined,
  LaptopOutlined
} from "@ant-design/icons";
import {
  checkMiddlewareHealth,
  getMiddlewareLogs,
  simulateScan,
  getMiddlewareHost,
  getMiddlewarePorts,
  setMiddlewareConfig,
  resetMiddlewareConfig,
  isPrivateNetworkHost,
  KIOSK_DEVICES,
  DEFAULT_KIOSK_DEVICES
} from "../../services/fingerprintBridge";
import { getEmployees } from "../../services/firebase/employeeService";

const { Text, Paragraph, Title } = Typography;

export default function FingerprintMonitorModal({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [health, setHealth] = useState({ online: false, port: 4370, host: "127.0.0.1", kiosks: KIOSK_DEVICES });
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [targetKiosk, setTargetKiosk] = useState("ORDERING"); // "ORDERING" | "RECEIVING"
  const [customPayload, setCustomPayload] = useState("EMP001\tSanjey Asirvatham\tQuality Lead");

  // Form State for Endpoint Settings
  const [hostInput, setHostInput] = useState(getMiddlewareHost());
  const [portInput, setPortInput] = useState(getMiddlewarePorts()[0]);
  const [orderIpInput, setOrderIpInput] = useState(KIOSK_DEVICES.ORDERING.ip);
  const [orderPortInput, setOrderPortInput] = useState(KIOSK_DEVICES.ORDERING.port);
  const [receiveIpInput, setReceiveIpInput] = useState(KIOSK_DEVICES.RECEIVING.ip);
  const [receivePortInput, setReceivePortInput] = useState(KIOSK_DEVICES.RECEIVING.port);

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
      setHostInput(getMiddlewareHost());
      setPortInput(getMiddlewarePorts()[0]);
      setOrderIpInput(KIOSK_DEVICES.ORDERING.ip);
      setOrderPortInput(KIOSK_DEVICES.ORDERING.port);
      setReceiveIpInput(KIOSK_DEVICES.RECEIVING.ip);
      setReceivePortInput(KIOSK_DEVICES.RECEIVING.port);

      refreshData();
      const timer = setInterval(refreshData, 3000);
      return () => clearInterval(timer);
    }
  }, [open]);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const result = await checkMiddlewareHealth(hostInput.trim(), portInput);
      if (result.online) {
        message.success(`Connection successful to ${hostInput}:${portInput}! Status: Online`);
        setHealth(result);
      } else {
        message.warning(`Could not reach ${hostInput}:${portInput}. Middleware may be offline or port is blocked.`);
      }
    } catch (e) {
      message.error(`Test connection failed: ${e.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await setMiddlewareConfig({
        host: hostInput.trim(),
        port: parseInt(portInput, 10),
        orderingConfig: { ip: orderIpInput.trim(), port: parseInt(orderPortInput, 10) },
        receivingConfig: { ip: receiveIpInput.trim(), port: parseInt(receivePortInput, 10) }
      });
      message.success("IP and Port configuration saved! WebSocket reconnecting...");
      refreshData();
    } catch (e) {
      message.error(`Failed to save configuration: ${e.message}`);
    }
  };

  const handleResetSettings = () => {
    resetMiddlewareConfig();
    setHostInput("127.0.0.1");
    setPortInput(4370);
    setOrderIpInput(DEFAULT_KIOSK_DEVICES.ORDERING.ip);
    setOrderPortInput(DEFAULT_KIOSK_DEVICES.ORDERING.port);
    setReceiveIpInput(DEFAULT_KIOSK_DEVICES.RECEIVING.ip);
    setReceivePortInput(DEFAULT_KIOSK_DEVICES.RECEIVING.port);
    message.info("Configuration reset to factory defaults.");
    refreshData();
  };

  const handleSimulate = async (emp, kioskChoice = targetKiosk) => {
    try {
      const res = await simulateScan(emp, kioskChoice);
      const isOrder = kioskChoice === "ORDERING";
      const kioskName = isOrder
        ? `Ordering Kiosk (${KIOSK_DEVICES.ORDERING.ip}:${KIOSK_DEVICES.ORDERING.port})`
        : `Receiving Kiosk (${KIOSK_DEVICES.RECEIVING.ip}:${KIOSK_DEVICES.RECEIVING.port})`;
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
      width: 95,
      render: (t) => (t ? new Date(t).toLocaleTimeString() : "-")
    },
    {
      title: "Kiosk / Source IP",
      key: "kioskSource",
      width: 220,
      render: (_, r) => {
        const isOrdering =
          r.sourceIp === KIOSK_DEVICES.ORDERING.ip ||
          r.kioskType === "ORDERING" ||
          r.kioskRole === "ORDERING_KIOSK";
        const isReceiving =
          r.sourceIp === KIOSK_DEVICES.RECEIVING.ip ||
          r.kioskType === "RECEIVING" ||
          r.kioskRole === "RECEIVING_KIOSK";
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
      render: (id) => (id ? <Tag color="blue" style={{ fontWeight: 700 }}>{id}</Tag> : "-")
    },
    {
      title: "Payload Data",
      dataIndex: "raw",
      key: "raw",
      render: (r) => <Text code copyable>{r}</Text>
    }
  ];

  const browserHost = typeof window !== "undefined" ? window.location.hostname || "127.0.0.1" : "127.0.0.1";

  const isOrderingConnected = health?.statuses?.ORDERING?.connected || health?.kioskResults?.ORDERING?.online;
  const isReceivingConnected = health?.statuses?.RECEIVING?.connected || health?.kioskResults?.RECEIVING?.online;
  const isLocalConnected = health?.statuses?.LOCAL?.connected || health?.kioskResults?.LOCAL?.online;

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginRight: 24, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ThunderboltOutlined style={{ color: "#10b981", fontSize: 20 }} />
            <span style={{ fontWeight: 700 }}>Biometric & Kiosk WebSocket Controller</span>
          </div>
          <Space>
            <Tag color={isOrderingConnected ? "indigo" : "default"}>
              📱 Order ({KIOSK_DEVICES.ORDERING.ip}): {isOrderingConnected ? "Online" : "Connecting..."}
            </Tag>
            <Tag color={isReceivingConnected ? "green" : "default"}>
              🍲 Receive ({KIOSK_DEVICES.RECEIVING.ip}): {isReceivingConnected ? "Online" : "Connecting..."}
            </Tag>
          </Space>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={refreshData} loading={loading}>
          Refresh
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Done
        </Button>
      ]}
    >
      {/* Kiosk Hardware Endpoints Status Banner */}
      <div style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <Card
              size="small"
              style={{
                borderRadius: 12,
                border: `1.5px solid ${isOrderingConnected ? "#818cf8" : "#e2e8f0"}`,
                background: isOrderingConnected ? "#f5f3ff" : "#fafafa"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, color: "#3730a3", fontSize: 13 }}>
                  📱 Ordering Kiosk Terminal
                </span>
                <Tag color={isOrderingConnected ? "indigo" : "warning"} style={{ fontWeight: 700 }}>
                  {isOrderingConnected ? "🟢 ws:// connected" : "⏳ connecting..."}
                </Tag>
              </div>
              <div style={{ fontSize: 12, marginTop: 4, color: "#4338ca", fontFamily: "monospace" }}>
                Target: <b>ws://{KIOSK_DEVICES.ORDERING.ip}:{KIOSK_DEVICES.ORDERING.port}</b>
              </div>
              <div style={{ fontSize: 11, color: "#6366f1", marginTop: 2 }}>
                Auto-navigates to <code>/meals/order</code> on biometric punch
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12}>
            <Card
              size="small"
              style={{
                borderRadius: 12,
                border: `1.5px solid ${isReceivingConnected ? "#86efac" : "#e2e8f0"}`,
                background: isReceivingConnected ? "#f0fdf4" : "#fafafa"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, color: "#166534", fontSize: 13 }}>
                  🍲 Receiving Kiosk Terminal
                </span>
                <Tag color={isReceivingConnected ? "green" : "warning"} style={{ fontWeight: 700 }}>
                  {isReceivingConnected ? "🟢 ws:// connected" : "⏳ connecting..."}
                </Tag>
              </div>
              <div style={{ fontSize: 12, marginTop: 4, color: "#15803d", fontFamily: "monospace" }}>
                Target: <b>ws://{KIOSK_DEVICES.RECEIVING.ip}:{KIOSK_DEVICES.RECEIVING.port}</b>
              </div>
              <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2 }}>
                Auto-navigates to <code>/meals/receive</code> on biometric punch
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                    background: "#f8fafc",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0"
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                    Simulate Touch on Kiosk:
                  </span>
                  <Radio.Group
                    value={targetKiosk}
                    onChange={(e) => setTargetKiosk(e.target.value)}
                    buttonStyle="solid"
                  >
                    <Radio.Button value="ORDERING">
                      📱 Ordering Kiosk ({KIOSK_DEVICES.ORDERING.ip})
                    </Radio.Button>
                    <Radio.Button value="RECEIVING">
                      🍲 Receiving Kiosk ({KIOSK_DEVICES.RECEIVING.ip})
                    </Radio.Button>
                  </Radio.Group>
                </div>

                <Paragraph type="secondary" style={{ fontSize: 13 }}>
                  Click an employee below to trigger an immediate biometric event routed as{" "}
                  <b>{targetKiosk === "ORDERING" ? "Ordering Kiosk" : "Receiving Kiosk"}</b>:
                </Paragraph>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                    gap: 12,
                    maxHeight: 280,
                    overflowY: "auto",
                    padding: 2
                  }}
                >
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
            key: "settings",
            label: "⚙️ IP & Port Configuration",
            children: (
              <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <Row gutter={[16, 16]}>
                  {/* Central WebSocket & Middleware Endpoint */}
                  <Col span={24}>
                    <Card size="small" title={<span style={{ fontWeight: 700 }}><ApiOutlined /> Middleware Server & WebSocket Target</span>} style={{ borderRadius: 10 }}>
                      <Row gutter={[12, 12]}>
                        <Col xs={24} sm={14}>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                            Middleware Host / Server IP:
                          </label>
                          <Input
                            value={hostInput}
                            onChange={(e) => setHostInput(e.target.value)}
                            placeholder="e.g. 127.0.0.1 or 192.168.8.xxx"
                          />
                          {/* Quick Host Presets */}
                          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, color: "#64748b" }}>Presets:</span>
                            <Tag
                              style={{ cursor: "pointer" }}
                              onClick={() => setHostInput("127.0.0.1")}
                            >
                              💻 Localhost (127.0.0.1)
                            </Tag>
                            {isPrivateNetworkHost(browserHost) && browserHost !== "127.0.0.1" && (
                              <Tag
                                style={{ cursor: "pointer" }}
                                onClick={() => setHostInput(browserHost)}
                              >
                                🌐 Local LAN ({browserHost})
                              </Tag>
                            )}
                            <Tag
                              style={{ cursor: "pointer" }}
                              onClick={() => setHostInput(KIOSK_DEVICES.ORDERING.ip)}
                            >
                              📱 Ordering ({KIOSK_DEVICES.ORDERING.ip})
                            </Tag>
                            <Tag
                              style={{ cursor: "pointer" }}
                              onClick={() => setHostInput(KIOSK_DEVICES.RECEIVING.ip)}
                            >
                              🍲 Receiving ({KIOSK_DEVICES.RECEIVING.ip})
                            </Tag>
                          </div>
                        </Col>

                        <Col xs={24} sm={10}>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                            Port (Primary & Fallback):
                          </label>
                          <Input
                            type="number"
                            value={portInput}
                            onChange={(e) => setPortInput(e.target.value)}
                            placeholder="4370"
                          />
                          <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                            <Tag style={{ cursor: "pointer" }} onClick={() => setPortInput(4370)}>
                              Port 4370 (Primary)
                            </Tag>
                            <Tag style={{ cursor: "pointer" }} onClick={() => setPortInput(5000)}>
                              Port 5000 (Secondary)
                            </Tag>
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  </Col>

                  {/* Ordering & Receiving Kiosks Config */}
                  <Col xs={24} sm={12}>
                    <Card
                      size="small"
                      title={<span style={{ fontWeight: 700, color: "#4338ca" }}>📱 Ordering Kiosk IP & Port</span>}
                      style={{ borderRadius: 10, borderColor: "#c7d2fe" }}
                    >
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                        Ordering Terminal Device IP:
                      </label>
                      <Input
                        value={orderIpInput}
                        onChange={(e) => setOrderIpInput(e.target.value)}
                        placeholder="192.168.8.168"
                      />
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginTop: 8, marginBottom: 4 }}>
                        Port:
                      </label>
                      <Input
                        type="number"
                        value={orderPortInput}
                        onChange={(e) => setOrderPortInput(e.target.value)}
                        placeholder="4370"
                      />
                    </Card>
                  </Col>

                  <Col xs={24} sm={12}>
                    <Card
                      size="small"
                      title={<span style={{ fontWeight: 700, color: "#15803d" }}>🍲 Receiving Kiosk IP & Port</span>}
                      style={{ borderRadius: 10, borderColor: "#bbf7d0" }}
                    >
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                        Receiving Terminal Device IP:
                      </label>
                      <Input
                        value={receiveIpInput}
                        onChange={(e) => setReceiveIpInput(e.target.value)}
                        placeholder="192.168.8.160"
                      />
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginTop: 8, marginBottom: 4 }}>
                        Port:
                      </label>
                      <Input
                        type="number"
                        value={receivePortInput}
                        onChange={(e) => setReceivePortInput(e.target.value)}
                        placeholder="4370"
                      />
                    </Card>
                  </Col>
                </Row>

                <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Button onClick={handleResetSettings}>
                    Reset Defaults
                  </Button>
                  <Space>
                    <Button
                      icon={<ApiOutlined />}
                      loading={testingConnection}
                      onClick={handleTestConnection}
                    >
                      Ping & Test Connection
                    </Button>
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={handleSaveSettings}
                      style={{ background: "#10b981", borderColor: "#10b981" }}
                    >
                      Save & Connect WebSocket
                    </Button>
                  </Space>
                </div>
              </div>
            )
          },
          {
            key: "custom",
            label: "🛠 Custom HTTP POST Punch",
            children: (
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                <div
                  style={{
                    background: "#f8fafc",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Originating Terminal:</span>
                  <Radio.Group value={targetKiosk} onChange={(e) => setTargetKiosk(e.target.value)}>
                    <Radio value="ORDERING">Ordering Kiosk ({KIOSK_DEVICES.ORDERING.ip}:{KIOSK_DEVICES.ORDERING.port})</Radio>
                    <Radio value="RECEIVING">Receiving Kiosk ({KIOSK_DEVICES.RECEIVING.ip}:{KIOSK_DEVICES.RECEIVING.port})</Radio>
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
