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
  Divider,
  Radio
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
import { getCompanies } from "../../services/firebase/companyService";
import { normalizePaymentType, getCategories } from "../../services/firebase/categoryService";
import { generateFormattedMealReport } from "../../utils/excelReportGenerator";
import { formatSriLankaDateTime } from "../../utils/timeUtils";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function AllAllocationsPage() {
  const [allocations, setAllocations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters State
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [mealTypeFilter, setMealTypeFilter] = useState("ALL");
  const [payCategoryFilter, setPayCategoryFilter] = useState("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState(null); // From-To Range [dayjs, dayjs]

  const loadAllocations = async () => {
    setLoading(true);
    try {
      const [data, allComps, allCats] = await Promise.all([
        getMealAllocations(),
        getCompanies(),
        getCategories()
      ]);
      setAllocations(data);
      setCompanies(allComps);
      setCategories(allCats);
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
      const res = await deleteMealAllocation(id, true);
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
    return allocations.filter((item) => {
      // 1. From-To Date Range Filter
      if (dateRange && dateRange[0] && dateRange[1]) {
        const startStr = dateRange[0].format("YYYY-MM-DD");
        const endStr = dateRange[1].format("YYYY-MM-DD");
        if (item.date < startStr || item.date > endStr) return false;
      }

      // 2. Status Filter
      const isRecv = (item.status || "").toLowerCase() === "recieved" || (item.status || "").toLowerCase() === "received";
      if (statusFilter === "ORDERED" && isRecv) return false;
      if (statusFilter === "RECEIVED" && !isRecv) return false;

      // 3. Meal Type Filter
      if (mealTypeFilter !== "ALL") {
        if ((item.meal_type || "").toLowerCase() !== mealTypeFilter.toLowerCase()) return false;
      }

      // 4. Pay Category / Subsidy Filter
      const itemPayNorm = getAutoSubsidy(item);
      if (payCategoryFilter !== "ALL") {
        if (itemPayNorm.toLowerCase() !== payCategoryFilter.toLowerCase()) return false;
      }

      // 5. Company Filter
      if (companyFilter !== "ALL") {
        if ((item.company || "").toLowerCase() !== companyFilter.toLowerCase()) return false;
      }

      // 6. Search Query
      if (searchText.trim()) {
        const s = searchText.toLowerCase();
        const name = (item.employee_name || "").toLowerCase();
        const empId = (item.employee_id || "").toLowerCase();
        const comp = (item.company || "").toLowerCase();
        const cat = (item.category_name || item.category_employment || "").toLowerCase();
        if (!name.includes(s) && !empId.includes(s) && !comp.includes(s) && !cat.includes(s)) {
          return false;
        }
      }

      return true;
    });
  }, [allocations, dateRange, statusFilter, mealTypeFilter, payCategoryFilter, companyFilter, searchText, categoryMap]);

  // Aggregate Metrics for filtered data
  const totalCount = filteredAllocations.length;
  const receivedCount = filteredAllocations.filter(
    (a) => (a.status || "").toLowerCase() === "recieved" || (a.status || "").toLowerCase() === "received"
  ).length;
  const pendingCount = totalCount - receivedCount;
  const breakfastCount = filteredAllocations.filter((a) => a.meal_type === "Breakfast").length;
  const lunchCount = filteredAllocations.filter((a) => a.meal_type === "Lunch").length;
  const dinnerCount = filteredAllocations.filter((a) => a.meal_type === "Dinner").length;

  const fullPaidCount = filteredAllocations.filter((a) => getAutoSubsidy(a) === "Full Paid").length;
  const halfPaidCount = filteredAllocations.filter((a) => getAutoSubsidy(a) === "Half Paid").length;
  const notPaidCount = filteredAllocations.filter((a) => getAutoSubsidy(a) === "Not Paid").length;

  // Formatted Transaction Report Excel Export
  const handleExportFormattedExcel = async () => {
    if (filteredAllocations.length === 0) {
      message.warning("No allocations to export in current filter!");
      return;
    }

    setExporting(true);
    try {
      let rangeLabel = "All Records";
      if (dateRange && dateRange[0] && dateRange[1]) {
        rangeLabel = `${dateRange[0].format("YYYY-MM-DD")} to ${dateRange[1].format("YYYY-MM-DD")}`;
      }

      await generateFormattedMealReport({
        allocations: filteredAllocations,
        title: "HAYLEYS ECO SOLUTIONS - MEAL ALLOCATIONS REPORT",
        dateRangeStr: rangeLabel,
        generatedBy: "System Administrator",
        categoryMap
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
    setDateRange(null);
    setStatusFilter("ALL");
    setMealTypeFilter("ALL");
    setPayCategoryFilter("ALL");
    setCompanyFilter("ALL");
  };

  const handleQuickPreset = (days) => {
    if (days === 0) {
      // Today
      const today = dayjs();
      setDateRange([today, today]);
    } else if (days === -1) {
      // Yesterday
      const yest = dayjs().subtract(1, "day");
      setDateRange([yest, yest]);
    } else if (days === 7) {
      // Next 7 days
      setDateRange([dayjs(), dayjs().add(7, "day")]);
    } else if (days === -7) {
      // Past 7 days
      setDateRange([dayjs().subtract(7, "day"), dayjs()]);
    } else if (days === 30) {
      // Current Month
      setDateRange([dayjs().startOf("month"), dayjs().endOf("month")]);
    }
  };

  const columns = [
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
      render: (cat, r) => (
        <Tag color="cyan" style={{ fontWeight: 600 }}>
          {cat || r.category_employment || "Staff"}
        </Tag>
      )
    },
    {
      title: "Payment Plan",
      key: "pay_category",
      width: 140,
      render: (_, r) => {
        const norm = getAutoSubsidy(r);
        const color = norm === "Full Paid" ? "green" : norm === "Half Paid" ? "orange" : "red";
        return (
          <Tag color={color} style={{ fontWeight: 700 }}>
            {norm}
          </Tag>
        );
      }
    },
    {
      title: "Meal Slot",
      dataIndex: "meal_type",
      key: "meal_type",
      width: 120,
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
      title: "Status (Click to Toggle)",
      dataIndex: "status",
      key: "status",
      width: 150,
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
        <span style={{ fontSize: "0.85rem", color: "#475569" }}>
          {formatSriLankaDateTime(val)}
        </span>
      )
    },
    {
      title: "Dispensed At (SL Time)",
      dataIndex: "received_at",
      key: "received_at",
      width: 180,
      render: (val) => (
        <span style={{ fontSize: "0.85rem", color: val ? "#059669" : "#94a3b8", fontWeight: val ? 700 : 400 }}>
          {formatSriLankaDateTime(val)}
        </span>
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
          onConfirm={() => handleDelete(r.id || r.doc_id)}
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
    <div style={{ maxWidth: 1600, margin: "0 auto", width: "100%" }}>
      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
            All Allocations Master Report
          </Title>
          <Text type="secondary" style={{ fontSize: 14, color: "#475569" }}>
            Comprehensive canteen allocations database ({filteredAllocations.length} records matching).
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
            Export Formatted Excel Report
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
              title={<span style={{ fontWeight: 600, color: "#059669" }}>Full Paid</span>}
              value={fullPaidCount}
              valueStyle={{ fontWeight: 800, color: "#059669" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#d97706" }}>Half Paid</span>}
              value={halfPaidCount}
              valueStyle={{ fontWeight: 800, color: "#d97706" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#dc2626" }}>Not Paid</span>}
              value={notPaidCount}
              valueStyle={{ fontWeight: 800, color: "#dc2626" }}
            />
          </Card>
        </Col>
      </Row>

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
          {/* From-To Date Range Picker */}
          <Col xs={24} sm={12} md={7}>
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
          <Col xs={24} sm={12} md={5}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
              Quick Presets:
            </Text>
            <Space size="small" wrap>
              <Button size="small" onClick={() => handleQuickPreset(0)}>Today</Button>
              <Button size="small" onClick={() => handleQuickPreset(-1)}>Yesterday</Button>
              <Button size="small" onClick={() => handleQuickPreset(7)}>+7 Days</Button>
              <Button size="small" onClick={() => handleQuickPreset(-7)}>-7 Days</Button>
            </Space>
          </Col>

          {/* Search Box */}
          <Col xs={24} sm={12} md={5}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
              Search:
            </Text>
            <Input
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              placeholder="Employee, ID, or Section..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>

          {/* Status Filter */}
          <Col xs={12} sm={6} md={3}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
              Status:
            </Text>
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

          {/* Meal Slot Filter */}
          <Col xs={12} sm={6} md={2}>
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

          {/* Subsidy Plan Filter */}
          <Col xs={12} sm={6} md={3}>
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

          {/* Company Filter */}
          <Col xs={12} sm={6} md={3}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
              Company:
            </Text>
            <Select
              value={companyFilter}
              onChange={setCompanyFilter}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Companies</Option>
              {companies.map((c) => (
                <Option key={c.name} value={c.name}>{c.name}</Option>
              ))}
            </Select>
          </Col>
        </Row>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={handleResetFilters} size="small" style={{ borderRadius: 6 }}>
            Reset All Filters
          </Button>
        </div>
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
          bordered
          size="middle"
          dataSource={filteredAllocations}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1550 }}
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
