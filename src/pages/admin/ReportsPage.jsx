import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Tag,
  Space,
  Select,
  Table,
  DatePicker,
  Input,
  Statistic,
  message,
  Divider,
  Tooltip
} from "antd";
import {
  FileExcelOutlined,
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  FilterOutlined,
  CalendarOutlined,
  CloudUploadOutlined,
  ArrowRightOutlined,
  BankOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { getMealAllocations, formatDateKey } from "../../services/firebase/mealService";
import { getCompanies } from "../../services/firebase/companyService";
import { getCategories, normalizePaymentType } from "../../services/firebase/categoryService";
import { generateFormattedMealReport } from "../../utils/excelReportGenerator";
import { formatSriLankaDateTime } from "../../utils/timeUtils";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function ReportsPage() {
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters State
  const [presetTime, setPresetTime] = useState("TODAY"); // "TODAY" | "WEEK" | "MONTH" | "ALL" | "CUSTOM"
  const [customDateRange, setCustomDateRange] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState("ALL");
  const [selectedMealType, setSelectedMealType] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedPayCategory, setSelectedPayCategory] = useState("ALL");
  const [searchText, setSearchText] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [allAlloc, allComps, allCats] = await Promise.all([
        getMealAllocations(),
        getCompanies(),
        getCategories()
      ]);
      setAllocations(allAlloc);
      setCompanies(allComps);
      setCategories(allCats);
    } catch (err) {
      console.error("Error loading allocations for reports:", err);
      message.error("Failed to load allocation reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Category to Subsidy Lookup Map (auto-resolves payment plan from Master Categories)
  const categoryMap = useMemo(() => {
    const map = {};
    (categories || []).forEach((c) => {
      if (c.category_name) {
        map[c.category_name.toLowerCase()] = c.configuration_detail;
      }
    });
    return map;
  }, [categories]);

  // Helper to get auto-resolved payment plan
  const getAutoSubsidy = (item) => {
    const catName = (item.category_name || item.category_employment || item.employee_category || "Staff").trim();
    const masterSubsidy = categoryMap[catName.toLowerCase()] || item.pay_category || item.configuration_detail;
    return normalizePaymentType(masterSubsidy);
  };

  // Filter allocations
  const filteredAllocations = useMemo(() => {
    const today = new Date();
    const todayStr = formatDateKey(today);

    return allocations.filter((item) => {
      // 1. Date filter
      if (presetTime === "TODAY") {
        if (item.date !== todayStr) return false;
      } else if (presetTime === "WEEK") {
        const weekAhead = new Date();
        weekAhead.setDate(today.getDate() + 7);
        const weekStr = formatDateKey(weekAhead);
        if (item.date < todayStr || item.date > weekStr) return false;
      } else if (presetTime === "MONTH") {
        const monthPrefix = todayStr.substring(0, 7);
        if (!item.date || !item.date.startsWith(monthPrefix)) return false;
      } else if (presetTime === "CUSTOM" && customDateRange && customDateRange[0] && customDateRange[1]) {
        const startStr = customDateRange[0].format("YYYY-MM-DD");
        const endStr = customDateRange[1].format("YYYY-MM-DD");
        if (item.date < startStr || item.date > endStr) return false;
      }

      // 2. Company filter
      if (selectedCompany !== "ALL") {
        if ((item.company || "").toLowerCase() !== selectedCompany.toLowerCase()) return false;
      }

      // 3. Meal Type filter
      if (selectedMealType !== "ALL") {
        if ((item.meal_type || "").toLowerCase() !== selectedMealType.toLowerCase()) return false;
      }

      // 4. Status filter
      if (selectedStatus !== "ALL") {
        const isRecv = (item.status || "").toLowerCase() === "recieved" || (item.status || "").toLowerCase() === "received";
        if (selectedStatus === "RECEIVED" && !isRecv) return false;
        if (selectedStatus === "ORDERED" && isRecv) return false;
      }

      // 5. Subsidy / Payment Plan filter (Auto-resolved from Master Category)
      const normPay = getAutoSubsidy(item);
      if (selectedPayCategory !== "ALL") {
        if (normPay.toLowerCase() !== selectedPayCategory.toLowerCase()) return false;
      }

      // 6. Text Search
      if (searchText.trim()) {
        const s = searchText.toLowerCase();
        const name = (item.employee_name || "").toLowerCase();
        const id = (item.employee_id || "").toLowerCase();
        const comp = (item.company || "").toLowerCase();
        const cat = (item.category_name || item.category_employment || "").toLowerCase();
        if (!name.includes(s) && !id.includes(s) && !comp.includes(s) && !cat.includes(s)) return false;
      }

      return true;
    });
  }, [allocations, presetTime, customDateRange, selectedCompany, selectedMealType, selectedStatus, selectedPayCategory, searchText, categoryMap]);

  // Aggregate Metrics for filtered data
  const totalCount = filteredAllocations.length;
  const receivedCount = filteredAllocations.filter(
    (a) => (a.status || "").toLowerCase() === "recieved" || (a.status || "").toLowerCase() === "received"
  ).length;
  const pendingCount = totalCount - receivedCount;
  const dispenseRate = totalCount > 0 ? Math.round((receivedCount / totalCount) * 100) : 0;

  const fullPaidCount = filteredAllocations.filter((a) => getAutoSubsidy(a) === "Full Paid").length;
  const halfPaidCount = filteredAllocations.filter((a) => getAutoSubsidy(a) === "Half Paid").length;
  const notPaidCount = filteredAllocations.filter((a) => getAutoSubsidy(a) === "Not Paid").length;

  // Handle Excel Export
  const handleExportExcel = async () => {
    if (filteredAllocations.length === 0) {
      message.warning("No records to export in current filter!");
      return;
    }

    setExporting(true);
    try {
      let rangeLabel = presetTime;
      if (presetTime === "CUSTOM" && customDateRange) {
        rangeLabel = `${customDateRange[0].format("YYYY-MM-DD")} to ${customDateRange[1].format("YYYY-MM-DD")}`;
      }

      await generateFormattedMealReport({
        allocations: filteredAllocations,
        title: "HAYLEYS ECO SOLUTIONS - MEAL ALLOCATIONS REPORT",
        dateRangeStr: rangeLabel,
        generatedBy: "System Administrator",
        categoryMap
      });

      message.success("Formatted Excel report generated and downloaded successfully!");
    } catch (err) {
      console.error("Export error:", err);
      message.error(`Failed to export Excel report: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Columns for Live Preview Table (NO Allocation ID, NO Section/Dept)
  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 115,
      fixed: "left",
      render: (text) => <b style={{ color: "#0f172a" }}>{text}</b>
    },
    {
      title: "Employee ID",
      dataIndex: "employee_id",
      key: "employee_id",
      width: 130,
      fixed: "left",
      render: (text) => (
        <Tag color="blue" style={{ fontWeight: 700, padding: "2px 8px" }}>
          {text}
        </Tag>
      )
    },
    {
      title: "Full Name",
      dataIndex: "employee_name",
      key: "employee_name",
      width: 200,
      render: (text) => <span style={{ fontWeight: 700, color: "#0f172a" }}>{text || "Staff"}</span>
    },
    {
      title: "Company",
      dataIndex: "company",
      key: "company",
      width: 220,
      render: (text) => <Tag color="geekblue" style={{ fontWeight: 600 }}>{text || "Hayleys Eco Solutions"}</Tag>
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
      render: (type) => {
        let color = "orange";
        if (type === "Lunch") color = "green";
        if (type === "Dinner") color = "purple";
        return <Tag color={color} style={{ fontWeight: 700 }}>{type}</Tag>;
      }
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status) => {
        const isRecv = (status || "").toLowerCase() === "recieved" || (status || "").toLowerCase() === "received";
        return isRecv ? (
          <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontWeight: 700 }}>
            Received
          </Tag>
        ) : (
          <Tag color="processing" icon={<ClockCircleOutlined />} style={{ fontWeight: 600 }}>
            Ordered
          </Tag>
        );
      }
    },
    {
      title: "Created At (SL Time)",
      dataIndex: "created_at",
      key: "created_at",
      render: (dt) => <span style={{ color: "#475569", fontSize: "0.85rem" }}>{formatSriLankaDateTime(dt)}</span>
    }
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", width: "100%" }}>
      {/* Top Banner & Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
            Operational Reports & Export
          </Title>
          <Text type="secondary" style={{ fontSize: 14, color: "#475569" }}>
            Real-time meal consumption reports, dynamic payment plan breakdowns, and transaction Excel exports
          </Text>
        </div>

        <Space size="middle" wrap>
          <Button
            type="default"
            icon={<CloudUploadOutlined style={{ color: "#059669" }} />}
            onClick={() => navigate("/admin/daily-archive")}
            style={{ fontWeight: 700, borderColor: "#059669", color: "#059669", borderRadius: 8 }}
          >
            Daily Firebase Storage Archives
          </Button>

          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            size="large"
            loading={exporting}
            onClick={handleExportExcel}
            style={{
              background: "#059669",
              borderColor: "#059669",
              fontWeight: 700,
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(5, 150, 105, 0.25)"
            }}
          >
            Export Formatted Excel Report
          </Button>

          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} style={{ borderRadius: 8 }}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* KPI Stats Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={12} md={6}>
          <Card className="glass-card" style={{ borderRadius: 14 }}>
            <Statistic
              title={<span style={{ fontWeight: 700, color: "#0f172a" }}>Total Allocations</span>}
              value={totalCount}
              prefix={<CoffeeOutlined style={{ color: "#0284c7" }} />}
              valueStyle={{ color: "#0f172a", fontWeight: 800 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card className="glass-card" style={{ borderRadius: 14 }}>
            <Statistic
              title={<span style={{ fontWeight: 700, color: "#0f172a" }}>Full Paid (100%)</span>}
              value={fullPaidCount}
              valueStyle={{ color: "#059669", fontWeight: 800 }}
              suffix={<span style={{ fontSize: 13, color: "#64748b" }}>meals</span>}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card className="glass-card" style={{ borderRadius: 14 }}>
            <Statistic
              title={<span style={{ fontWeight: 700, color: "#0f172a" }}>Half Paid (50%)</span>}
              value={halfPaidCount}
              valueStyle={{ color: "#d97706", fontWeight: 800 }}
              suffix={<span style={{ fontSize: 13, color: "#64748b" }}>meals</span>}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card className="glass-card" style={{ borderRadius: 14 }}>
            <Statistic
              title={<span style={{ fontWeight: 700, color: "#0f172a" }}>Not Paid</span>}
              value={notPaidCount}
              valueStyle={{ color: "#dc2626", fontWeight: 800 }}
              suffix={<span style={{ fontSize: 13, color: "#64748b" }}>meals</span>}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Control Bar */}
      <Card className="glass-card" style={{ marginBottom: 20, borderRadius: 14 }}>
        <Row gutter={[12, 12]} align="middle">
          {/* Preset Time Range */}
          <Col xs={24} md={6}>
            <Text strong style={{ display: "block", marginBottom: 4, color: "#0f172a" }}>Time Preset</Text>
            <Select
              value={presetTime}
              onChange={(val) => setPresetTime(val)}
              style={{ width: "100%" }}
            >
              <Option value="TODAY">Today Only</Option>
              <Option value="WEEK">Next 7 Days</Option>
              <Option value="MONTH">This Month</Option>
              <Option value="ALL">All Recorded Dates</Option>
              <Option value="CUSTOM">Custom Date Range...</Option>
            </Select>
          </Col>

          {/* Custom Date Range Picker */}
          {presetTime === "CUSTOM" && (
            <Col xs={24} md={6}>
              <Text strong style={{ display: "block", marginBottom: 4, color: "#0f172a" }}>Date Range</Text>
              <RangePicker
                value={customDateRange}
                onChange={(dates) => setCustomDateRange(dates)}
                style={{ width: "100%" }}
              />
            </Col>
          )}

          {/* Company Filter */}
          <Col xs={12} sm={6} md={presetTime === "CUSTOM" ? 4 : 5}>
            <Text strong style={{ display: "block", marginBottom: 4, color: "#0f172a" }}>Company / Plant</Text>
            <Select
              value={selectedCompany}
              onChange={(val) => setSelectedCompany(val)}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Companies</Option>
              {companies.map((c) => (
                <Option key={c.name} value={c.name}>{c.name}</Option>
              ))}
            </Select>
          </Col>

          {/* Meal Slot Filter */}
          <Col xs={12} sm={6} md={3}>
            <Text strong style={{ display: "block", marginBottom: 4, color: "#0f172a" }}>Meal Slot</Text>
            <Select
              value={selectedMealType}
              onChange={(val) => setSelectedMealType(val)}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Slots</Option>
              <Option value="Breakfast">Breakfast</Option>
              <Option value="Lunch">Lunch</Option>
              <Option value="Dinner">Dinner</Option>
            </Select>
          </Col>

          {/* Subsidy Plan Filter */}
          <Col xs={12} sm={6} md={4}>
            <Text strong style={{ display: "block", marginBottom: 4, color: "#0f172a" }}>Subsidy Plan</Text>
            <Select
              value={selectedPayCategory}
              onChange={(val) => setSelectedPayCategory(val)}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Plans</Option>
              <Option value="Full Paid">Full Paid (100%)</Option>
              <Option value="Half Paid">Half Paid (50%)</Option>
              <Option value="Not Paid">Not Paid (Unpaid)</Option>
            </Select>
          </Col>

          {/* Status Filter */}
          <Col xs={12} sm={6} md={3}>
            <Text strong style={{ display: "block", marginBottom: 4, color: "#0f172a" }}>Status</Text>
            <Select
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val)}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Status</Option>
              <Option value="ORDERED">Ordered</Option>
              <Option value="RECEIVED">Received</Option>
            </Select>
          </Col>

          {/* Search Input */}
          <Col xs={24} md={presetTime === "CUSTOM" ? 24 : 3}>
            <Text strong style={{ display: "block", marginBottom: 4, color: "#0f172a" }}>Search</Text>
            <Input
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              placeholder="Emp ID, Name..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      {/* Allocations Table Preview */}
      <Card className="glass-card" style={{ borderRadius: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <Text strong style={{ fontSize: 16, color: "#0f172a" }}>
            Transaction Preview ({filteredAllocations.length} matching rows)
          </Text>
          <Text type="secondary" style={{ color: "#475569" }}>
            Payment plan automatically synchronized with Master Categories
          </Text>
        </div>

        <Table
          bordered
          size="middle"
          columns={columns}
          dataSource={filteredAllocations}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "25", "50", "100"]
          }}
        />
      </Card>
    </div>
  );
}
