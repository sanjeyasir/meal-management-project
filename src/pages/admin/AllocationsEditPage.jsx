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
import { getCompanies } from "../../services/firebase/companyService";
import { normalizePaymentType, getCategories } from "../../services/firebase/categoryService";
import { formatSriLankaDateTime, formatSriLankaDate } from "../../utils/timeUtils";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

export default function AllocationsEditPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // true if screen width < 768px

  const [allocations, setAllocations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [dateRange, setDateRange] = useState(null); // From-To Range [dayjs, dayjs]
  const [statusFilter, setStatusFilter] = useState("ORDERED"); // Default to "ORDERED" so admin immediately sees editable items
  const [mealTypeFilter, setMealTypeFilter] = useState("ALL");
  const [payCategoryFilter, setPayCategoryFilter] = useState("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit Modal/Drawer State
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [allAllocations, allComps, allCats] = await Promise.all([
        getMealAllocations(),
        getCompanies(),
        getCategories()
      ]);
      setAllocations(allAllocations);
      setCompanies(allComps);
      setCategories(allCats);
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
    return allocations.filter((item) => {
      // 1. From-To Date Range Filter
      if (dateRange && dateRange[0] && dateRange[1]) {
        const startStr = dateRange[0].format("YYYY-MM-DD");
        const endStr = dateRange[1].format("YYYY-MM-DD");
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

      // 4. Pay Category / Subsidy Filter
      const itemPayNorm = normalizePaymentType(item.pay_category || item.category_employment);
      if (payCategoryFilter !== "ALL") {
        if (itemPayNorm.toLowerCase() !== payCategoryFilter.toLowerCase()) return false;
      }

      // 5. Company Filter
      if (companyFilter !== "ALL") {
        if ((item.company || "").toLowerCase() !== companyFilter.toLowerCase()) return false;
      }

      // 6. Search Text (Name, ID, Company)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (item.employee_name || "").toLowerCase();
        const empId = (item.employee_id || "").toLowerCase();
        const comp = (item.company || "").toLowerCase();
        const cat = (item.category_name || item.category_employment || "").toLowerCase();
        if (!name.includes(q) && !empId.includes(q) && !comp.includes(q) && !cat.includes(q)) return false;
      }

      return true;
    });
  }, [allocations, dateRange, statusFilter, mealTypeFilter, payCategoryFilter, companyFilter, searchQuery]);

  // Open Edit Modal / Drawer
  const handleOpenEdit = (record) => {
    const isReceived = (record.status || "").toLowerCase() === "recieved" || (record.status || "").toLowerCase() === "received";
    if (isReceived) {
      message.warning("This allocation has already been dispensed/received and cannot be edited.");
      return;
    }

    const catName = record.category_name || record.category_employment || "Staff";
    const normPay = normalizePaymentType(record.pay_category || record.category_employment);

    setSelectedAllocation(record);
    form.setFieldsValue({
      date: dayjs(record.date),
      meal_type: record.meal_type || "Lunch",
      category_name: catName,
      pay_category: normPay
    });
    setEditDrawerOpen(true);
  };

  // Submit Edit
  const handleSaveEdit = async (values) => {
    if (!selectedAllocation) return;

    setSaving(true);
    try {
      const newDateStr = values.date.format("YYYY-MM-DD");
      const normalizedPay = normalizePaymentType(values.pay_category);
      const catName = values.category_name || selectedAllocation.category_name || selectedAllocation.category_employment || "Staff";

      const res = await updateMealAllocation(selectedAllocation.id, {
        date: newDateStr,
        meal_type: values.meal_type,
        category_name: catName,
        category_employment: catName,
        pay_category: normalizedPay
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
    const allocId = record.id || record.doc_id;
    try {
      const res = await deleteMealAllocation(allocId, true);
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

  const handleQuickPreset = (days) => {
    if (days === 0) {
      const today = dayjs();
      setDateRange([today, today]);
    } else if (days === 1) {
      const tomorrow = dayjs().add(1, "day");
      setDateRange([tomorrow, tomorrow]);
    } else if (days === 7) {
      setDateRange([dayjs(), dayjs().add(7, "day")]);
    }
  };

  // Category to Subsidy Map
  const categoryMap = useMemo(() => {
    const map = {};
    (categories || []).forEach((c) => {
      if (c.category_name) {
        map[c.category_name.toLowerCase()] = c.configuration_detail;
      }
    });
    return map;
  }, [categories]);

  const getAutoSubsidy = (item) => {
    const catName = (item.category_name || item.category_employment || "Staff").trim();
    const masterSubsidy = categoryMap[catName.toLowerCase()] || item.pay_category;
    return normalizePaymentType(masterSubsidy);
  };

  // Status Metrics
  const editableCount = allocations.filter(
    (a) => (a.status || "").toLowerCase() !== "recieved" && (a.status || "").toLowerCase() !== "received"
  ).length;
  const dispensedCount = allocations.length - editableCount;

  // Desktop Table Columns (Consistent across all allocation master tables)
  const tableColumns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 115,
      fixed: "left",
      render: (d) => <Text strong style={{ color: "#0f172a" }}>{d}</Text>,
      sorter: (a, b) => (a.date || "").localeCompare(b.date || "")
    },
    {
      title: "Employee ID",
      dataIndex: "employee_id",
      key: "employee_id",
      width: 130,
      fixed: "left",
      render: (id) => (
        <Tag color="blue" style={{ fontWeight: 700, padding: "2px 8px" }}>
          {id}
        </Tag>
      ),
      sorter: (a, b) => String(a.employee_id || "").localeCompare(String(b.employee_id || ""))
    },
    {
      title: "Full Name",
      dataIndex: "employee_name",
      key: "employee_name",
      width: 200,
      render: (name) => <span style={{ fontWeight: 700, color: "#0f172a" }}>{name || "Staff"}</span>,
      sorter: (a, b) => (a.employee_name || "").localeCompare(b.employee_name || "")
    },
    {
      title: "Company",
      dataIndex: "company",
      key: "company",
      width: 220,
      render: (comp) => <Tag color="geekblue" style={{ fontWeight: 600 }}>{comp || "Hayleys Eco Solutions"}</Tag>
    },
    {
      title: "Meal Category",
      dataIndex: "category_name",
      key: "category_name",
      width: 130,
      render: (cat, r) => <Tag color="cyan" style={{ fontWeight: 600 }}>{cat || r.category_employment || "Staff"}</Tag>
    },
    {
      title: "Payment Plan",
      key: "pay_category",
      width: 140,
      render: (_, r) => {
        const norm = getAutoSubsidy(r);
        const color = norm === "Full Paid" ? "green" : norm === "Half Paid" ? "orange" : "red";
        return <Tag color={color} style={{ fontWeight: 700 }}>{norm}</Tag>;
      }
    },
    {
      title: "Meal Slot",
      dataIndex: "meal_type",
      key: "meal_type",
      width: 120,
      render: (type) => {
        const icon = type === "Breakfast" ? "☕" : type === "Lunch" ? "🍲" : "🍽️";
        const color = type === "Breakfast" ? "orange" : type === "Lunch" ? "green" : "purple";
        return (
          <Tag color={color} style={{ fontSize: "0.85rem", padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>
            {icon} {type}
          </Tag>
        );
      }
    },
    {
      title: "Status",
      key: "status",
      width: 140,
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
      width: 180,
      render: (dt) => (
        <span style={{ fontSize: "0.85rem", color: "#475569" }}>
          {formatSriLankaDateTime(dt)}
        </span>
      )
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
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
    <div style={{ maxWidth: 1600, margin: "0 auto", width: "100%" }}>
      {/* Header Banner with Clean Dark Slate / Black Text */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
            Meal Allocations Editor
          </Title>
          <Text type="secondary" style={{ fontSize: 14, color: "#475569" }}>
            Modify, reschedule, or cancel pending meal allocations before canteen dispensing.
          </Text>
        </div>

        <Space size="middle" wrap>
          <Tag
            color="blue"
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#1e40af"
            }}
          >
            ✏️ {editableCount} Editable (Ordered)
          </Tag>
          <Tag
            color="green"
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#065f46"
            }}
          >
            🔒 {dispensedCount} Dispensed (Locked)
          </Tag>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} style={{ borderRadius: 8 }}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Filter Control Bar with Prominent From - To Date Range */}
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
          {/* From-To Date Range */}
          <Col xs={24} sm={12} lg={7}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
              📅 From - To Date Range:
            </Text>
            <RangePicker
              style={{ width: "100%" }}
              value={dateRange}
              onChange={setDateRange}
              placeholder={["From Date", "To Date"]}
            />
          </Col>

          {/* Quick Presets */}
          <Col xs={24} sm={12} lg={5}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
              Quick Presets:
            </Text>
            <Space size="small" wrap>
              <Button size="small" onClick={() => handleQuickPreset(0)}>Today</Button>
              <Button size="small" onClick={() => handleQuickPreset(1)}>Tomorrow</Button>
              <Button size="small" onClick={() => handleQuickPreset(7)}>Next 7 Days</Button>
            </Space>
          </Col>

          {/* Status Filter */}
          <Col xs={12} sm={6} lg={4}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
              Status:
            </Text>
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
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
              Slot:
            </Text>
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

          {/* Subsidy Filter */}
          <Col xs={12} sm={6} lg={3}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
              Subsidy:
            </Text>
            <Select
              value={payCategoryFilter}
              onChange={setPayCategoryFilter}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Plans</Option>
              <Option value="Full Paid">Full Paid</Option>
              <Option value="Half Paid">Half Paid</Option>
              <Option value="Not Paid">Not Paid</Option>
            </Select>
          </Col>

          {/* Search Box */}
          <Col xs={24} sm={12} lg={6}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
              Search Employee:
            </Text>
            <Input
              placeholder="Search employee, ID, section..."
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
          </Col>

          {/* Company Filter */}
          <Col xs={12} sm={6} lg={4}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
              Company / Plant:
            </Text>
            <Select
              value={companyFilter}
              onChange={setCompanyFilter}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Companies</Option>
              {companies.map((c) => (
                <Option key={c.name} value={c.name}>
                  {c.name}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={12} sm={6} lg={2} style={{ display: "flex", alignItems: "flex-end" }}>
            <Button
              onClick={() => {
                setDateRange(null);
                setStatusFilter("ORDERED");
                setMealTypeFilter("ALL");
                setPayCategoryFilter("ALL");
                setDeptFilter("ALL");
                setSearchQuery("");
              }}
              style={{ width: "100%", borderRadius: 8, height: 38, marginTop: 22 }}
            >
              Reset
            </Button>
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
              const normPay = normalizePaymentType(item.pay_category || item.category_employment);

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
                  {/* Card Header */}
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
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a" }}>
                      {item.employee_name}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#475569", marginTop: 2 }}>
                      <Tag color="blue" style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700 }}>{item.employee_id}</Tag>
                      {" "}• {item.section || "Operations"} • <Tag color={normPay === "Full Paid" ? "green" : normPay === "Half Paid" ? "orange" : "red"}>{normPay}</Tag>
                    </div>
                  </div>

                  {/* Timestamp info */}
                  <div style={{ fontSize: "0.75rem", color: "#64748b", background: "#f8fafc", padding: "6px 10px", borderRadius: 8, marginBottom: 14 }}>
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
            bordered
            size="middle"
            columns={tableColumns}
            dataSource={filteredAllocations}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1450 }}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              pageSizeOptions: ["10", "15", "25", "50"],
              showTotal: (total) => `Total ${total} Allocations`
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
              <span style={{ fontWeight: 800, color: "#0f172a" }}>Edit Meal Allocation</span>
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
              categories={categories}
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
              <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#0f172a" }}>Edit Meal Allocation</span>
            </div>
          }
          open={editDrawerOpen}
          onCancel={() => setEditDrawerOpen(false)}
          footer={null}
          width={540}
          destroyOnClose
        >
          {selectedAllocation && (
            <EditAllocationForm
              allocation={selectedAllocation}
              form={form}
              categories={categories}
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
function EditAllocationForm({ allocation, form, categories, onFinish, saving, onCancel }) {
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
            <div style={{ fontSize: "0.8rem", color: "#475569" }}>
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
          label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Allocation Date</span>}
          rules={[{ required: true, message: "Please select the allocation date" }]}
        >
          <DatePicker style={{ width: "100%", height: 42, borderRadius: 8 }} />
        </Form.Item>

        {/* Meal Slot Selection */}
        <Form.Item
          name="meal_type"
          label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Meal Slot</span>}
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

        {/* Category & Subsidy Row */}
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="category_name"
              label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Employee Category</span>}
              rules={[{ required: true, message: "Please select category" }]}
            >
              <Select
                placeholder="Select category"
                onChange={(catVal) => {
                  const match = (categories || []).find(
                    (c) => c.category_name?.toLowerCase() === String(catVal).toLowerCase()
                  );
                  if (match) {
                    form.setFieldsValue({
                      pay_category: normalizePaymentType(match.configuration_detail)
                    });
                  }
                }}
              >
                {(categories || []).map((c) => (
                  <Option key={c.category_name} value={c.category_name}>
                    {c.category_name} ({c.configuration_detail})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="pay_category"
              label={<span style={{ fontWeight: 600, color: "#0f172a" }}>Payment Plan</span>}
              rules={[{ required: true, message: "Please select payment subsidy" }]}
            >
              <Select placeholder="Select subsidy plan">
                <Option value="Full Paid">Full Paid (100% Subsidized)</Option>
                <Option value="Half Paid">Half Paid (50% Subsidized)</Option>
                <Option value="Not Paid">Not Paid (Unsubsidized)</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

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
          ℹ️ Changes will immediately reflect in the Canteen Dispensing terminal, reports, and archive exports.
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
