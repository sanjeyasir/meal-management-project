import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Table,
  Typography,
  Button,
  Input,
  Tag,
  Space,
  DatePicker,
  Select,
  Popconfirm,
  message,
  Row,
  Col,
  Statistic,
  Tooltip,
  Avatar,
  Divider
} from "antd";
import {
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  TableOutlined,
  FileExcelOutlined,
  FilterOutlined,
  CoffeeOutlined,
  CalendarOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  getMealAllocations,
  updateMealAllocationStatus,
  deleteMealAllocation,
  formatDateKey
} from "../../services/firebase/mealService";
import { generateFormattedMealReport } from "../../utils/excelReportGenerator";
import { formatSriLankaDateTime } from "../../utils/timeUtils";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function AllAllocationsPage() {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters State
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [mealTypeFilter, setMealTypeFilter] = useState("ALL");
  const [payCategoryFilter, setPayCategoryFilter] = useState("ALL");
  const [dateFilterMode, setDateFilterMode] = useState("ALL"); // "ALL" | "TODAY" | "CUSTOM"
  const [customDateRange, setCustomDateRange] = useState(null);

  const loadAllocations = async () => {
    setLoading(true);
    try {
      const data = await getMealAllocations();
      setAllocations(data);
    } catch (err) {
      console.error("Error loading allocations:", err);
      message.error("Failed loading all meal allocations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllocations();
  }, []);

  const handleToggleStatus = async (record) => {
    const isCurrentlyReceived = (record.status || "").toLowerCase() === "recieved" || (record.status || "").toLowerCase() === "received";
    const newStatus = isCurrentlyReceived ? "Ordered" : "Recieved";
    try {
      const res = await updateMealAllocationStatus(record.id, newStatus);
      if (res.success) {
        message.success(`Status updated to ${newStatus}`);
        loadAllocations();
      } else {
        message.error(res.message || "Failed to update status.");
      }
    } catch (err) {
      message.error(`Status update error: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await deleteMealAllocation(id);
      if (res.success) {
        message.success("Allocation removed successfully.");
        loadAllocations();
      } else {
        message.error(res.message || "Failed to delete allocation.");
      }
    } catch (err) {
      message.error(`Delete error: ${err.message}`);
    }
  };

  // Filter allocations
  const filteredAllocations = useMemo(() => {
    const todayStr = formatDateKey(new Date());

    return allocations.filter((item) => {
      // Date Filter
      if (dateFilterMode === "TODAY") {
        if (item.date !== todayStr) return false;
      } else if (dateFilterMode === "CUSTOM" && customDateRange && customDateRange[0] && customDateRange[1]) {
        const startStr = customDateRange[0].format("YYYY-MM-DD");
        const endStr = customDateRange[1].format("YYYY-MM-DD");
        if (item.date < startStr || item.date > endStr) return false;
      }

      // Status Filter
      const isRecv = (item.status || "").toLowerCase() === "recieved" || (item.status || "").toLowerCase() === "received";
      if (statusFilter === "ORDERED" && isRecv) return false;
      if (statusFilter === "RECEIVED" && !isRecv) return false;

      // Meal Type Filter
      if (mealTypeFilter !== "ALL") {
        if ((item.meal_type || "").toLowerCase() !== mealTypeFilter.toLowerCase()) return false;
      }

      // Pay Category Filter
      if (payCategoryFilter !== "ALL") {
        if ((item.pay_category || "").toLowerCase() !== payCategoryFilter.toLowerCase()) return false;
      }

      // Search Query
      if (searchText.trim()) {
        const s = searchText.toLowerCase();
        const name = (item.employee_name || "").toLowerCase();
        const empId = (item.employee_id || "").toLowerCase();
        const sec = (item.section || "").toLowerCase();
        const comp = (item.company || "").toLowerCase();
        if (!name.includes(s) && !empId.includes(s) && !sec.includes(s) && !comp.includes(s)) {
          return false;
        }
      }

      return true;
    });
  }, [allocations, dateFilterMode, customDateRange, statusFilter, mealTypeFilter, payCategoryFilter, searchText]);

  // Aggregate Metrics for filtered data
  const totalCount = filteredAllocations.length;
  const receivedCount = filteredAllocations.filter(
    (a) => (a.status || "").toLowerCase() === "recieved" || (a.status || "").toLowerCase() === "received"
  ).length;
  const pendingCount = totalCount - receivedCount;
  const breakfastCount = filteredAllocations.filter((a) => a.meal_type === "Breakfast").length;
  const lunchCount = filteredAllocations.filter((a) => a.meal_type === "Lunch").length;
  const dinnerCount = filteredAllocations.filter((a) => a.meal_type === "Dinner").length;

  // Formatted Transaction Report Excel Export
  const handleExportFormattedExcel = async () => {
    if (filteredAllocations.length === 0) {
      message.warning("No allocations to export in current filter!");
      return;
    }

    setExporting(true);
    try {
      let rangeLabel = "All Records";
      if (dateFilterMode === "TODAY") {
        rangeLabel = `Today (${formatDateKey(new Date())})`;
      } else if (dateFilterMode === "CUSTOM" && customDateRange) {
        rangeLabel = `${customDateRange[0].format("YYYY-MM-DD")} to ${customDateRange[1].format("YYYY-MM-DD")}`;
      }

      await generateFormattedMealReport({
        allocations: filteredAllocations,
        title: "MEAL MANAGEMENT PROJECT - ALLOCATIONS TRANSACTION REPORT",
        dateRangeStr: rangeLabel,
        generatedBy: "System Administrator"
      });

      message.success("Allocations transaction report downloaded successfully!");
    } catch (err) {
      console.error("Export error:", err);
      message.error(`Failed to export report: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchText("");
    setDateFilterMode("ALL");
    setCustomDateRange(null);
    setStatusFilter("ALL");
    setMealTypeFilter("ALL");
    setPayCategoryFilter("ALL");
  };

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 110,
      render: (d) => <Text strong style={{ color: "#0f172a" }}>{d}</Text>,
      sorter: (a, b) => a.date.localeCompare(b.date)
    },
    {
      title: "Employee Details",
      key: "employee",
      render: (_, r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar size={32} style={{ backgroundColor: "#10b981", fontWeight: 700, flexShrink: 0 }}>
            {r.employee_name ? r.employee_name[0].toUpperCase() : "U"}
          </Avatar>
          <div>
            <div style={{ fontWeight: 700, color: "#1e293b" }}>{r.employee_name}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              <Tag color="blue" style={{ margin: 0, fontWeight: 700, fontSize: 11 }}>{r.employee_id}</Tag> • {r.section || "Operations"}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Meal Slot",
      dataIndex: "meal_type",
      key: "meal_type",
      width: 130,
      render: (m) => {
        const icon = m === "Breakfast" ? "☕" : m === "Lunch" ? "🍲" : "🍽️";
        const color = m === "Breakfast" ? "orange" : m === "Lunch" ? "green" : "purple";
        return (
          <Tag color={color} style={{ fontWeight: 700, borderRadius: 6, fontSize: "0.85rem", padding: "2px 8px" }}>
            {icon} {m}
          </Tag>
        );
      }
    },
    {
      title: "Subsidy Category",
      dataIndex: "pay_category",
      key: "pay_category",
      width: 130,
      render: (c) => <Tag color="cyan" style={{ borderRadius: 6 }}>{c || "Free Meal"}</Tag>
    },
    {
      title: "Status (Click to Toggle)",
      dataIndex: "status",
      key: "status",
      width: 160,
      render: (s, record) => {
        const isRecv = (s || "").toLowerCase() === "recieved" || (s || "").toLowerCase() === "received";
        return (
          <Tooltip title="Click to toggle status between Ordered and Received">
            <Tag
              icon={isRecv ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
              color={isRecv ? "success" : "processing"}
              style={{ cursor: "pointer", fontWeight: 700, borderRadius: 6, padding: "3px 10px" }}
              onClick={() => handleToggleStatus(record)}
            >
              {isRecv ? "Received" : "Ordered"}
            </Tag>
          </Tooltip>
        );
      }
    },
    {
      title: "Created At (SL Time)",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (val) => (
        <Text type="secondary" style={{ fontSize: "0.8rem" }}>
          {formatSriLankaDateTime(val)}
        </Text>
      )
    },
    {
      title: "Dispensed At (SL Time)",
      dataIndex: "received_at",
      key: "received_at",
      width: 180,
      render: (val) => (
        <Text style={{ fontSize: "0.8rem", color: val ? "#059669" : "#94a3b8", fontWeight: val ? 600 : 400 }}>
          {formatSriLankaDateTime(val)}
        </Text>
      )
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      fixed: "right",
      render: (_, r) => (
        <Popconfirm
          title="Delete Meal Allocation"
          description="Are you sure you want to permanently delete this record?"
          onConfirm={() => handleDelete(r.id)}
          okText="Yes, Delete"
          cancelText="No"
          okButtonProps={{ danger: true }}
        >
          <Button danger type="text" icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", width: "100%" }}>
      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
            All Allocations Master Report
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Comprehensive canteen master database with real-time Sri Jayawardenepura timestamp tracking ({filteredAllocations.length} records matching).
          </Text>
        </div>

        <Space size="middle" wrap>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            onClick={handleExportFormattedExcel}
            loading={exporting}
            style={{
              fontWeight: 700,
              background: "linear-gradient(135deg, #059669 0%, #064e3b 100%)",
              borderColor: "#059669",
              borderRadius: 8,
              boxShadow: "0 4px 12px -2px rgba(5, 150, 105, 0.4)"
            }}
          >
            Export Allocations Transaction Report
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadAllocations}
            loading={loading}
            style={{ borderRadius: 8 }}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* KPI Overview Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6} lg={4}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#64748b" }}>Total Scheduled</span>}
              value={totalCount}
              valueStyle={{ fontWeight: 800, color: "#0f172a" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#059669" }}>Dispensed (Received)</span>}
              value={receivedCount}
              valueStyle={{ fontWeight: 800, color: "#059669" }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#2563eb" }}>Pending (Ordered)</span>}
              value={pendingCount}
              valueStyle={{ fontWeight: 800, color: "#2563eb" }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#d97706" }}>☕ Breakfast</span>}
              value={breakfastCount}
              valueStyle={{ fontWeight: 800, color: "#d97706" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#059669" }}>🍲 Lunch</span>}
              value={lunchCount}
              valueStyle={{ fontWeight: 800, color: "#059669" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#7c3aed" }}>🍽️ Dinner</span>}
              value={dinnerCount}
              valueStyle={{ fontWeight: 800, color: "#7c3aed" }}
            />
          </Card>
        </Col>
      </Row>

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
          <Col xs={24} sm={10} md={6}>
            <Input
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              placeholder="Search Employee, ID, or Section..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={12} sm={7} md={4}>
            <Select
              value={dateFilterMode}
              onChange={setDateFilterMode}
              style={{ width: "100%" }}
            >
              <Option value="ALL">📅 All Dates</Option>
              <Option value="TODAY">📅 Today Only</Option>
              <Option value="CUSTOM">📅 Custom Range</Option>
            </Select>
          </Col>

          {dateFilterMode === "CUSTOM" && (
            <Col xs={24} sm={7} md={5}>
              <RangePicker
                style={{ width: "100%" }}
                value={customDateRange}
                onChange={setCustomDateRange}
                placeholder={["Start Date", "End Date"]}
              />
            </Col>
          )}

          <Col xs={12} sm={6} md={3}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Statuses</Option>
              <Option value="ORDERED">Ordered</Option>
              <Option value="RECEIVED">Received</Option>
            </Select>
          </Col>

          <Col xs={12} sm={6} md={3}>
            <Select
              value={mealTypeFilter}
              onChange={setMealTypeFilter}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Meal Slots</Option>
              <Option value="Breakfast">Breakfast</Option>
              <Option value="Lunch">Lunch</Option>
              <Option value="Dinner">Dinner</Option>
            </Select>
          </Col>

          <Col xs={12} sm={6} md={3}>
            <Select
              value={payCategoryFilter}
              onChange={setPayCategoryFilter}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Subsidies</Option>
              <Option value="Free Meal">Free Meal</Option>
              <Option value="Half Paid">Half Paid</Option>
              <Option value="Not Paid">Not Paid</Option>
            </Select>
          </Col>

          <Col xs={12} sm={6} md={2}>
            <Button onClick={handleResetFilters} block style={{ borderRadius: 8 }}>
              Reset
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Master Allocations Table */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)"
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={filteredAllocations}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "25", "50", "100"],
            showTotal: (total) => `Total ${total} Allocations`
          }}
        />
      </Card>
    </div>
  );
}
