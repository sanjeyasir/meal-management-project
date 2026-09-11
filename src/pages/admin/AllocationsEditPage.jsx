import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  DatePicker,
  Modal,
  Drawer,
  Form,
  Radio,
  Popconfirm,
  message,
  Tooltip,
  Badge,
  Grid,
  Divider,
  Empty
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  LockOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  FilterOutlined,
  CalendarOutlined,
  UserOutlined,
  CheckOutlined,
  CloseOutlined,
  SafetyCertificateOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  getMealAllocations,
  updateMealAllocation,
  deleteMealAllocation,
  formatDateKey
} from "../../services/firebase/mealService";
import { getDepartments } from "../../services/firebase/departmentService";
import { formatSriLankaDateTime, formatSriLankaDate } from "../../utils/timeUtils";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

export default function AllocationsEditPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // true if screen width < 768px

  const [allocations, setAllocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [dateFilterMode, setDateFilterMode] = useState("TODAY"); // "TODAY" | "TOMORROW" | "WEEK" | "ALL" | "CUSTOM"
  const [customRange, setCustomRange] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ORDERED"); // Default to "ORDERED" so admin immediately sees editable items
  const [mealTypeFilter, setMealTypeFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit Modal/Drawer State
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [allAllocations, allDepts] = await Promise.all([
        getMealAllocations(),
        getDepartments()
      ]);
      setAllocations(allAllocations);
      setDepartments(allDepts);
    } catch (err) {
      console.error("Error loading allocations:", err);
      message.error("Failed to load meal allocations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute filtered allocations
  const filteredAllocations = useMemo(() => {
    const today = new Date();
    const todayStr = formatDateKey(today);

    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = formatDateKey(tomorrow);

    const weekAhead = new Date();
    weekAhead.setDate(today.getDate() + 7);
    const weekAheadStr = formatDateKey(weekAhead);

    return allocations.filter((item) => {
      // 1. Date Filter
      if (dateFilterMode === "TODAY") {
        if (item.date !== todayStr) return false;
      } else if (dateFilterMode === "TOMORROW") {
        if (item.date !== tomorrowStr) return false;
      } else if (dateFilterMode === "WEEK") {
        if (item.date < todayStr || item.date > weekAheadStr) return false;
      } else if (dateFilterMode === "CUSTOM" && customRange && customRange[0] && customRange[1]) {
        const startStr = customRange[0].format("YYYY-MM-DD");
        const endStr = customRange[1].format("YYYY-MM-DD");
        if (item.date < startStr || item.date > endStr) return false;
      }

      // 2. Status Filter
      const isReceived = (item.status || "").toLowerCase() === "recieved" || (item.status || "").toLowerCase() === "received";
      if (statusFilter === "ORDERED" && isReceived) return false;
      if (statusFilter === "RECEIVED" && !isReceived) return false;

      // 3. Meal Type Filter
      if (mealTypeFilter !== "ALL") {
        if ((item.meal_type || "").toLowerCase() !== mealTypeFilter.toLowerCase()) return false;
      }

      // 4. Department Filter
      if (deptFilter !== "ALL") {
        if ((item.section || "").toLowerCase() !== deptFilter.toLowerCase()) return false;
      }

      // 5. Search Text (Name, ID, Section)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (item.employee_name || "").toLowerCase();
        const empId = (item.employee_id || "").toLowerCase();
        const sec = (item.section || "").toLowerCase();
        if (!name.includes(q) && !empId.includes(q) && !sec.includes(q)) return false;
      }

      return true;
    });
  }, [allocations, dateFilterMode, customRange, statusFilter, mealTypeFilter, deptFilter, searchQuery]);

  // Open Edit Modal / Drawer
  const handleOpenEdit = (record) => {
    const isReceived = (record.status || "").toLowerCase() === "recieved" || (record.status || "").toLowerCase() === "received";
    if (isReceived) {
      message.warning("This allocation has already been dispensed/received and cannot be edited.");
      return;
    }

    setSelectedAllocation(record);
    form.setFieldsValue({
      date: dayjs(record.date),
      meal_type: record.meal_type || "Lunch",
      pay_category: record.pay_category || "Free Meal"
    });
    setEditDrawerOpen(true);
  };

  // Submit Edit
  const handleSaveEdit = async (values) => {
    if (!selectedAllocation) return;

    setSaving(true);
    try {
      const newDateStr = values.date.format("YYYY-MM-DD");
      const res = await updateMealAllocation(selectedAllocation.id, {
        date: newDateStr,
        meal_type: values.meal_type,
        pay_category: values.pay_category
      });

      if (res.success) {
        message.success("Meal allocation successfully updated!");
        setEditDrawerOpen(false);
        setSelectedAllocation(null);
        await loadData();
      } else {
        message.error(res.message || "Failed to update allocation.");
      }
    } catch (err) {
      console.error("Save error:", err);
      message.error(`Error updating allocation: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Cancel / Delete Allocation
  const handleDeleteAllocation = async (record) => {
    const isReceived = (record.status || "").toLowerCase() === "recieved" || (record.status || "").toLowerCase() === "received";
    if (isReceived) {
      message.error("Cannot cancel an allocation that has already been received/dispensed.");
      return;
    }

    try {
      const res = await deleteMealAllocation(record.id);
      if (res.success) {
        message.success(`Allocation for ${record.employee_name} (${record.meal_type}) cancelled.`);
        await loadData();
      } else {
        message.error(res.message || "Failed to cancel allocation.");
      }
    } catch (err) {
      message.error(`Error deleting allocation: ${err.message}`);
    }
  };

  // Status Metrics
  const editableCount = allocations.filter(
    (a) => (a.status || "").toLowerCase() !== "recieved" && (a.status || "").toLowerCase() !== "received"
  ).length;
  const dispensedCount = allocations.length - editableCount;

  // Desktop Table Columns
  const tableColumns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 120,
      render: (d) => <Text strong style={{ color: "#0f172a" }}>{d}</Text>,
      sorter: (a, b) => a.date.localeCompare(b.date)
    },
    {
      title: "Employee Details",
      key: "employee",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.95rem" }}>
            {r.employee_name}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
            <Tag color="blue" style={{ margin: 0, fontWeight: 700, fontSize: "0.75rem" }}>
              {r.employee_id}
            </Tag>
            <Text type="secondary" style={{ fontSize: "0.8rem" }}>
              {r.section || "General"}
            </Text>
          </div>
        </div>
      )
    },
    {
      title: "Meal Slot",
      dataIndex: "meal_type",
      key: "meal_type",
      width: 130,
      render: (type) => {
        const icon = type === "Breakfast" ? "☕" : type === "Lunch" ? "🍲" : "🍽️";
        const color = type === "Breakfast" ? "orange" : type === "Lunch" ? "green" : "purple";
        return (
          <Tag color={color} style={{ fontSize: "0.85rem", padding: "3px 8px", borderRadius: 6 }}>
            {icon} {type}
          </Tag>
        );
      }
    },
    {
      title: "Category",
      dataIndex: "pay_category",
      key: "pay_category",
      width: 130,
      render: (cat) => <Tag color="cyan">{cat || "Free Meal"}</Tag>
    },
    {
      title: "Status & Lock",
      key: "status",
      width: 170,
      render: (_, r) => {
        const isReceived = (r.status || "").toLowerCase() === "recieved" || (r.status || "").toLowerCase() === "received";
        if (isReceived) {
          return (
            <Tooltip title={`Dispensed on ${formatSriLankaDateTime(r.received_at)}. Locked from edits.`}>
              <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontWeight: 700, borderRadius: 6 }}>
                Dispensed (Locked)
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Tag color="processing" icon={<ClockCircleOutlined />} style={{ fontWeight: 700, borderRadius: 6 }}>
            Ordered (Editable)
          </Tag>
        );
      }
    },
    {
      title: "Created At (SL Time)",
      dataIndex: "created_at",
      key: "created_at",
      width: 190,
      render: (dt) => (
        <Text type="secondary" style={{ fontSize: "0.8rem" }}>
          {formatSriLankaDateTime(dt)}
        </Text>
      )
    },
    {
      title: "Actions",
      key: "actions",
      width: 160,
      fixed: "right",
      render: (_, record) => {
        const isReceived = (record.status || "").toLowerCase() === "recieved" || (record.status || "").toLowerCase() === "received";

        if (isReceived) {
          return (
            <Tooltip title="This meal has already been dispensed in the canteen and cannot be modified.">
              <Button
                disabled
                size="small"
                icon={<LockOutlined />}
                style={{ borderRadius: 6, fontSize: "0.8rem" }}
              >
                Locked
              </Button>
            </Tooltip>
          );
        }

        return (
          <Space size="small">
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
              style={{
                borderRadius: 6,
                background: "#0284c7",
                borderColor: "#0284c7",
                fontWeight: 600
              }}
            >
              Edit
            </Button>
            <Popconfirm
              title="Cancel Meal Allocation"
              description={`Cancel ${record.meal_type} for ${record.employee_name} on ${record.date}?`}
              onConfirm={() => handleDeleteAllocation(record)}
              okText="Yes, Cancel"
              cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                style={{ borderRadius: 6 }}
              />
            </Popconfirm>
          </Space>
        );
      }
    }
  ];

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", width: "100%" }}>
      {/* Header Banner */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#ffffff",
          marginBottom: 20,
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.3)"
        }}
        bodyStyle={{ padding: isMobile ? "16px" : "24px 32px" }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.2)",
                  border: "1px solid #10b981",
                  borderRadius: 12,
                  padding: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <EditOutlined style={{ fontSize: 24, color: "#10b981" }} />
              </div>
              <div>
                <Title level={isMobile ? 4 : 3} style={{ color: "#ffffff", margin: 0, fontWeight: 800 }}>
                  Meal Allocations Editor
                </Title>
                <Text style={{ color: "#94a3b8", fontSize: isMobile ? "0.8rem" : "0.9rem" }}>
                  Admin control panel to modify, reschedule, or cancel ordered meals before canteen dispensing.
                </Text>
              </div>
            </div>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: isMobile ? "left" : "right" }}>
            <Space wrap size="middle">
              <Tag
                color="blue"
                style={{
                  padding: "6px 14px",
                  borderRadius: 10,
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  background: "rgba(59, 130, 246, 0.15)",
                  border: "1px solid rgba(59, 130, 246, 0.4)",
                  color: "#93c5fd"
                }}
              >
                ✏️ {editableCount} Editable (Ordered)
              </Tag>
              <Tag
                color="green"
                style={{
                  padding: "6px 14px",
                  borderRadius: 10,
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  color: "#6ee7b7"
                }}
              >
                🔒 {dispensedCount} Dispensed (Locked)
              </Tag>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Filter Control Bar */}
      <Card
        bordered={false}
        style={{
          borderRadius: 14,
          marginBottom: 20,
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
        }}
        bodyStyle={{ padding: "16px 20px" }}
      >
        <Row gutter={[12, 12]} align="middle">
          {/* Quick Date Segment */}
          <Col xs={24} lg={9}>
            <Radio.Group
              value={dateFilterMode}
              onChange={(e) => setDateFilterMode(e.target.value)}
              buttonStyle="solid"
              style={{ width: "100%", display: "flex", flexWrap: "wrap" }}
            >
              <Radio.Button value="TODAY" style={{ flex: 1, textAlign: "center" }}>Today</Radio.Button>
              <Radio.Button value="TOMORROW" style={{ flex: 1, textAlign: "center" }}>Tomorrow</Radio.Button>
              <Radio.Button value="WEEK" style={{ flex: 1, textAlign: "center" }}>7 Days</Radio.Button>
              <Radio.Button value="ALL" style={{ flex: 1, textAlign: "center" }}>All</Radio.Button>
              <Radio.Button value="CUSTOM" style={{ flex: 1, textAlign: "center" }}>Custom</Radio.Button>
            </Radio.Group>
          </Col>

          {dateFilterMode === "CUSTOM" && (
            <Col xs={24} sm={12} lg={5}>
              <RangePicker
                style={{ width: "100%" }}
                value={customRange}
                onChange={setCustomRange}
                placeholder={["Start Date", "End Date"]}
              />
            </Col>
          )}

          {/* Status Filter */}
          <Col xs={12} sm={6} lg={4}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: "100%" }}
            >
              <Option value="ORDERED">⏳ Ordered (Editable)</Option>
              <Option value="RECEIVED">🔒 Dispensed (Locked)</Option>
              <Option value="ALL">📋 All Statuses</Option>
            </Select>
          </Col>

          {/* Meal Slot Filter */}
          <Col xs={12} sm={6} lg={3}>
            <Select
              value={mealTypeFilter}
              onChange={setMealTypeFilter}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Slots</Option>
              <Option value="Breakfast">Breakfast</Option>
              <Option value="Lunch">Lunch</Option>
              <Option value="Dinner">Dinner</Option>
            </Select>
          </Col>

          {/* Search Box */}
          <Col xs={20} sm={8} lg={6}>
            <Input
              placeholder="Search employee, ID, section..."
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
          </Col>

          {/* Refresh Button */}
          <Col xs={4} sm={4} lg={2} style={{ textAlign: "right" }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
              title="Refresh Data"
              style={{ borderRadius: 8 }}
            />
          </Col>
        </Row>
      </Card>

      {/* Main Content Area: Mobile Cards VS Desktop Table */}
      {isMobile ? (
        /* Mobile Touch-Friendly Card List */
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 30 }}>
          {filteredAllocations.length === 0 ? (
            <Card style={{ borderRadius: 14, textAlign: "center", padding: "40px 20px" }}>
              <Empty description="No meal allocations matching selected filters." />
            </Card>
          ) : (
            filteredAllocations.map((item) => {
              const isReceived = (item.status || "").toLowerCase() === "recieved" || (item.status || "").toLowerCase() === "received";
              const mealIcon = item.meal_type === "Breakfast" ? "☕" : item.meal_type === "Lunch" ? "🍲" : "🍽️";

              return (
                <Card
                  key={item.id}
                  bordered={false}
                  style={{
                    borderRadius: 14,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    borderLeft: `5px solid ${isReceived ? "#10b981" : "#0284c7"}`,
                    background: "#ffffff"
                  }}
                  bodyStyle={{ padding: 16 }}
                >
                  {/* Card Header: Date + Meal Slot + Status Badge */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a" }}>
                        {item.date}
                      </span>
                      <Tag
                        color={item.meal_type === "Breakfast" ? "orange" : item.meal_type === "Lunch" ? "green" : "purple"}
                        style={{ marginLeft: 8, fontWeight: 700, borderRadius: 6 }}
                      >
                        {mealIcon} {item.meal_type}
                      </Tag>
                    </div>

                    {isReceived ? (
                      <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0, fontWeight: 700, borderRadius: 6 }}>
                        Dispensed
                      </Tag>
                    ) : (
                      <Tag color="processing" icon={<ClockCircleOutlined />} style={{ margin: 0, fontWeight: 700, borderRadius: 6 }}>
                        Ordered
                      </Tag>
                    )}
                  </div>

                  {/* Employee Details */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>
                      {item.employee_name}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 2 }}>
                      <Tag color="blue" style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700 }}>{item.employee_id}</Tag>
                      {" "}• {item.section || "Operations"} • {item.pay_category || "Free Meal"}
                    </div>
                  </div>

                  {/* Timestamp info */}
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", background: "#f8fafc", padding: "6px 10px", borderRadius: 8, marginBottom: 14 }}>
                    <div>📅 Created: {formatSriLankaDateTime(item.created_at)}</div>
                    {item.received_at && (
                      <div style={{ color: "#059669", fontWeight: 600, marginTop: 2 }}>
                        ✅ Dispensed: {formatSriLankaDateTime(item.received_at)}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                    {isReceived ? (
                      <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
                        <LockOutlined style={{ color: "#10b981" }} /> Locked: Dispensed meal
                      </div>
                    ) : (
                      <>
                        <Button
                          type="primary"
                          icon={<EditOutlined />}
                          onClick={() => handleOpenEdit(item)}
                          style={{
                            borderRadius: 8,
                            fontWeight: 600,
                            background: "#0284c7",
                            borderColor: "#0284c7",
                            flex: 1
                          }}
                        >
                          Edit Allocation
                        </Button>
                        <Popconfirm
                          title="Cancel Allocation"
                          description={`Cancel ${item.meal_type} for ${item.employee_name} on ${item.date}?`}
                          onConfirm={() => handleDeleteAllocation(item)}
                          okText="Yes, Cancel"
                          cancelText="No"
                          okButtonProps={{ danger: true }}
                        >
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            style={{ borderRadius: 8 }}
                          >
                            Cancel
                          </Button>
                        </Popconfirm>
                      </>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        /* Desktop Table View */
        <Card
          bordered={false}
          style={{
            borderRadius: 14,
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
          }}
          bodyStyle={{ padding: "0" }}
        >
          <Table
            columns={tableColumns}
            dataSource={filteredAllocations}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              pageSizeOptions: ["10", "15", "25", "50"],
              showTotal: (total) => `Total ${total} Allocations`
            }}
            rowClassName={(record) => {
              const isRecv = (record.status || "").toLowerCase() === "recieved" || (record.status || "").toLowerCase() === "received";
              return isRecv ? "row-dispensed" : "row-ordered";
            }}
          />
        </Card>
      )}

      {/* Edit Drawer / Modal for Modifying Ordered Meals */}
      {isMobile ? (
        <Drawer
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <EditOutlined style={{ color: "#0284c7" }} />
              <span>Edit Meal Allocation</span>
            </div>
          }
          placement="bottom"
          height="auto"
          open={editDrawerOpen}
          onClose={() => setEditDrawerOpen(false)}
          bodyStyle={{ paddingBottom: 24 }}
        >
          {selectedAllocation && (
            <EditAllocationForm
              allocation={selectedAllocation}
              form={form}
              onFinish={handleSaveEdit}
              saving={saving}
              onCancel={() => setEditDrawerOpen(false)}
            />
          )}
        </Drawer>
      ) : (
        <Modal
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <EditOutlined style={{ color: "#0284c7", fontSize: 20 }} />
              <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>Edit Meal Allocation</span>
            </div>
          }
          open={editDrawerOpen}
          onCancel={() => setEditDrawerOpen(false)}
          footer={null}
          width={520}
          destroyOnClose
        >
          {selectedAllocation && (
            <EditAllocationForm
              allocation={selectedAllocation}
              form={form}
              onFinish={handleSaveEdit}
              saving={saving}
              onCancel={() => setEditDrawerOpen(false)}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

/**
 * Reusable Form inside Edit Modal/Drawer
 */
function EditAllocationForm({ allocation, form, onFinish, saving, onCancel }) {
  return (
    <div>
      {/* Employee Info Read-Only Banner */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 20
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "1rem" }}>
              {allocation.employee_name}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
              ID: <b>{allocation.employee_id}</b> • Dept: {allocation.section || "Operations"}
            </div>
          </div>
          <Tag color="processing" style={{ fontWeight: 700 }}>
            Ordered
          </Tag>
        </div>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        {/* Date Field */}
        <Form.Item
          name="date"
          label={<Text strong>Allocation Date</Text>}
          rules={[{ required: true, message: "Please select the allocation date" }]}
        >
          <DatePicker style={{ width: "100%", height: 42, borderRadius: 8 }} />
        </Form.Item>

        {/* Meal Slot Selection */}
        <Form.Item
          name="meal_type"
          label={<Text strong>Meal Slot</Text>}
          rules={[{ required: true, message: "Please choose a meal slot" }]}
        >
          <Radio.Group style={{ width: "100%" }} buttonStyle="solid">
            <Row gutter={[8, 8]}>
              <Col span={8}>
                <Radio.Button value="Breakfast" style={{ width: "100%", textAlign: "center", borderRadius: 8 }}>
                  ☕ Breakfast
                </Radio.Button>
              </Col>
              <Col span={8}>
                <Radio.Button value="Lunch" style={{ width: "100%", textAlign: "center", borderRadius: 8 }}>
                  🍲 Lunch
                </Radio.Button>
              </Col>
              <Col span={8}>
                <Radio.Button value="Dinner" style={{ width: "100%", textAlign: "center", borderRadius: 8 }}>
                  🍽️ Dinner
                </Radio.Button>
              </Col>
            </Row>
          </Radio.Group>
        </Form.Item>

        {/* Subsidy Plan / Payment Category */}
        <Form.Item
          name="pay_category"
          label={<Text strong>Subsidy Plan / Category</Text>}
          rules={[{ required: true, message: "Please select payment category" }]}
        >
          <Select style={{ width: "100%", height: 42 }}>
            <Option value="Free Meal">Free Meal</Option>
            <Option value="Half Paid">Half Paid</Option>
            <Option value="Not Paid">Not Paid</Option>
          </Select>
        </Form.Item>

        {/* Safety Warning */}
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: "0.8rem",
            color: "#1e40af",
            marginBottom: 20
          }}
        >
          ℹ️ Changes will immediately reflect in the Canteen Dispensing terminal and employee records.
        </div>

        {/* Footer Actions */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Button onClick={onCancel} style={{ borderRadius: 8, height: 40, fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
            icon={<CheckOutlined />}
            style={{
              borderRadius: 8,
              height: 40,
              fontWeight: 700,
              background: "#0284c7",
              borderColor: "#0284c7"
            }}
          >
            Save Changes
          </Button>
        </div>
      </Form>
    </div>
  );
}
