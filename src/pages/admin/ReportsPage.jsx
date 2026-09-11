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
  CalendarOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { getMealAllocations, formatDateKey } from "../../services/firebase/mealService";
import { getDepartments } from "../../services/firebase/departmentService";
import { generateFormattedMealReport } from "../../utils/excelReportGenerator";
import { formatSriLankaDateTime } from "../../utils/timeUtils";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function ReportsPage() {
  const [allocations, setAllocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters State
  const [presetTime, setPresetTime] = useState("TODAY"); // "TODAY" | "WEEK" | "MONTH" | "ALL" | "CUSTOM"
  const [customDateRange, setCustomDateRange] = useState(null);
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedMealType, setSelectedMealType] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [searchText, setSearchText] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [allAlloc, allDepts] = await Promise.all([
        getMealAllocations(),
        getDepartments()
      ]);
      setAllocations(allAlloc);
      setDepartments(allDepts);
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

      // 2. Department filter
      if (selectedDept !== "ALL") {
        if ((item.section || "").toLowerCase() !== selectedDept.toLowerCase()) return false;
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

      // 5. Text Search
      if (searchText.trim()) {
        const s = searchText.toLowerCase();
        const name = (item.employee_name || "").toLowerCase();
        const id = (item.employee_id || "").toLowerCase();
        const sec = (item.section || "").toLowerCase();
        if (!name.includes(s) && !id.includes(s) && !sec.includes(s)) return false;
      }

      return true;
    });
  }, [allocations, presetTime, customDateRange, selectedDept, selectedMealType, selectedStatus, searchText]);

  // Aggregate Metrics for filtered data
  const totalCount = filteredAllocations.length;
  const receivedCount = filteredAllocations.filter(
    (a) => (a.status || "").toLowerCase() === "recieved" || (a.status || "").toLowerCase() === "received"
  ).length;
  const pendingCount = totalCount - receivedCount;
  const dispenseRate = totalCount > 0 ? Math.round((receivedCount / totalCount) * 100) : 0;

  const freeCount = filteredAllocations.filter((a) => (a.pay_category || "").toLowerCase().includes("free")).length;
  const halfPaidCount = filteredAllocations.filter((a) => (a.pay_category || "").toLowerCase().includes("half")).length;
  const notPaidCount = filteredAllocations.filter((a) => (a.pay_category || "").toLowerCase().includes("not")).length;

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
        title: "MEAL MANAGEMENT PROJECT - MEAL ALLOCATIONS & CONSUMPTION REPORT",
        dateRangeStr: rangeLabel,
        generatedBy: "System Administrator"
      });

      message.success("Formatted multi-sheet Excel report generated successfully!");
    } catch (err) {
      console.error("Export error:", err);
      message.error(`Failed to export Excel report: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Columns for Live Preview Table
  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 110,
      render: (text) => <b>{text}</b>
    },
    {
      title: "Emp ID",
      dataIndex: "employee_id",
      key: "employee_id",
      width: 100,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: "Employee Name",
      dataIndex: "employee_name",
      key: "employee_name",
      render: (text) => <span style={{ fontWeight: 600 }}>{text || "Staff"}</span>
    },
    {
      title: "Department / Section",
      dataIndex: "section",
      key: "section",
      render: (text) => text || "Operations"
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
      title: "Subsidy Category",
      dataIndex: "pay_category",
      key: "pay_category",
      render: (text) => (
        <Tag color="cyan" style={{ fontWeight: 600 }}>
          {text || "Free Meal"}
        </Tag>
      )
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
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
      title: "Created (SL Time)",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (dt) => formatSriLankaDateTime(dt)
    },
    {
      title: "Dispensed (SL Time)",
      dataIndex: "received_at",
      key: "received_at",
      width: 180,
      render: (dt) => formatSriLankaDateTime(dt)
    }
  ];

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
            Formatted Excel Reports
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Generate styled, multi-sheet Excel reports with executive KPIs, department summaries, and transaction logs.
          </Text>
        </div>

        <Space size="middle" wrap>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            size="large"
            loading={exporting}
            onClick={handleExportExcel}
            style={{
              fontWeight: 800,
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              boxShadow: "0 6px 18px -3px rgba(16, 185, 129, 0.4)",
              height: 44,
              borderRadius: 10
            }}
          >
            Download Formatted Excel (.xlsx)
          </Button>

          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} size="large" style={{ height: 44 }} />
        </Space>
      </div>

      {/* KPI Cards for Filtered Range */}
      <Row gutter={[18, 18]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="glass-card" style={{ borderLeft: "4px solid #3b82f6" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#64748b" }}>Total Filtered Meals</span>}
              value={totalCount}
              valueStyle={{ fontWeight: 800, color: "#1e3a8a" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="glass-card" style={{ borderLeft: "4px solid #10b981" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#64748b" }}>Dispensed Portions</span>}
              value={receivedCount}
              valueStyle={{ fontWeight: 800, color: "#065f46" }}
              suffix={<span style={{ fontSize: 13, color: "#10b981" }}>({dispenseRate}%)</span>}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="glass-card" style={{ borderLeft: "4px solid #f59e0b" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#64748b" }}>Pending Dispensing</span>}
              value={pendingCount}
              valueStyle={{ fontWeight: 800, color: "#92400e" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="glass-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#64748b" }}>Free Subsidies</span>}
              value={freeCount}
              valueStyle={{ fontWeight: 800, color: "#4c1d95" }}
              suffix={<span style={{ fontSize: 12, color: "#64748b" }}>/ {halfPaidCount} half</span>}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Controls Card */}
      <Card className="glass-card" style={{ borderRadius: 16, marginBottom: 24, padding: "8px 4px" }}>
        <Row gutter={[16, 16]} align="middle">
          {/* Timeframe Preset */}
          <Col xs={24} sm={12} md={6}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Timeframe Preset:</Text>
            <Select
              value={presetTime}
              onChange={(val) => {
                setPresetTime(val);
                if (val !== "CUSTOM") setCustomDateRange(null);
              }}
              style={{ width: "100%" }}
            >
              <Option value="TODAY">📅 Today's Meals</Option>
              <Option value="WEEK">🗓 Next 7 Days</Option>
              <Option value="MONTH">📆 Current Month</Option>
              <Option value="ALL">🌐 All Time Records</Option>
              <Option value="CUSTOM">🕒 Custom Date Range...</Option>
            </Select>
          </Col>

          {/* Custom Date Range */}
          {presetTime === "CUSTOM" && (
            <Col xs={24} sm={12} md={6}>
              <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Select Custom Range:</Text>
              <RangePicker
                style={{ width: "100%" }}
                value={customDateRange}
                onChange={setCustomDateRange}
              />
            </Col>
          )}

          {/* Department Filter */}
          <Col xs={24} sm={12} md={5}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Department / Section:</Text>
            <Select
              value={selectedDept}
              onChange={setSelectedDept}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Departments</Option>
              {departments.map((d) => (
                <Option key={d.name} value={d.name}>
                  {d.name}
                </Option>
              ))}
            </Select>
          </Col>

          {/* Meal Type Filter */}
          <Col xs={24} sm={12} md={4}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Meal Slot:</Text>
            <Select
              value={selectedMealType}
              onChange={setSelectedMealType}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Slots</Option>
              <Option value="Breakfast">☕ Breakfast</Option>
              <Option value="Lunch">🍲 Lunch</Option>
              <Option value="Dinner">🍽 Dinner</Option>
            </Select>
          </Col>

          {/* Status Filter */}
          <Col xs={24} sm={12} md={4}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Status:</Text>
            <Select
              value={selectedStatus}
              onChange={setSelectedStatus}
              style={{ width: "100%" }}
            >
              <Option value="ALL">All Statuses</Option>
              <Option value="RECEIVED">✅ Dispensed</Option>
              <Option value="ORDERED">⏳ Pending</Option>
            </Select>
          </Col>

          {/* Search Box */}
          <Col xs={24} md={5}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Search Employee:</Text>
            <Input
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              placeholder="Search Name or ID..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      {/* Live Preview Table */}
      <Card
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Live Report Preview ({filteredAllocations.length} records)</span>
            <Tag color="cyan">Ready to Export</Tag>
          </div>
        }
        className="glass-card"
        style={{ borderRadius: 16 }}
      >
        <Table
          columns={columns}
          dataSource={filteredAllocations}
          rowKey={(record) => record.id || `${record.employee_id}_${record.date}_${record.meal_type}`}
          loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: true }}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
}
