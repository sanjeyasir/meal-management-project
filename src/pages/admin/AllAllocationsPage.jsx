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
  message,
  Row,
  Col,
  Tooltip
} from "antd";
import {
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileExcelOutlined,
  CalendarOutlined,
  HistoryOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  getMealAllocations,
  getMealAllocationsWithArchived,
  formatDateKey
} from "../../services/firebase/mealService";
import { getCompanies } from "../../services/firebase/companyService";
import { normalizePaymentType, getCategories } from "../../services/firebase/categoryService";
import { generateFormattedMealReport } from "../../utils/excelReportGenerator";
import { formatSriLankaDateTime } from "../../utils/timeUtils";

const { Title, Text } = Typography;
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

  const todayStr = formatDateKey(new Date());

  const loadAllocations = async () => {
    setLoading(true);
    try {
      const [allData, allComps, allCats] = await Promise.all([
        getMealAllocationsWithArchived(),
        getCompanies(),
        getCategories()
      ]);

      // Filter entries to come from previous days (archived historical allocations where date < today)
      const pastAllocations = allData.filter((item) => item.date && item.date < todayStr);
      setAllocations(pastAllocations);
      setCompanies(allComps);
      setCategories(allCats);
    } catch (err) {
      console.error("Error loading previous allocations:", err);
      message.error("Failed loading previous day meal allocations.");
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
      const isRecv = (item.status || "").toLowerCase() === "recieved" || (item.status || "").toLowerCase() === "received" || item.received === true;
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

      // 6. Text Search Filter
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const empName = (item.employee_name || item.name || "").toLowerCase();
        const empId = (item.employee_id || item.emp_id || "").toLowerCase();
        const comp = (item.company || "").toLowerCase();
        const cat = (item.category_name || item.category_employment || "").toLowerCase();
        if (!empName.includes(q) && !empId.includes(q) && !comp.includes(q) && !cat.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [allocations, dateRange, statusFilter, mealTypeFilter, payCategoryFilter, companyFilter, searchText, categoryMap]);

  // Handle Export Previous Allocations to Excel
  const handleExportExcel = async () => {
    if (filteredAllocations.length === 0) {
      message.warning("No records to export in current filter!");
      return;
    }

    setExporting(true);
    try {
      let dateRangeLabel = "Previous Days Historical Allocations";
      if (dateRange && dateRange[0] && dateRange[1]) {
        dateRangeLabel = `${dateRange[0].format("YYYY-MM-DD")} to ${dateRange[1].format("YYYY-MM-DD")}`;
      }

      await generateFormattedMealReport({
        allocations: filteredAllocations,
        title: "HAYLEYS ECO SOLUTIONS - PREVIOUS DAY ALLOCATIONS REPORT",
        dateRangeStr: dateRangeLabel,
        generatedBy: "System Administrator",
        categoryMap
      });

      message.success("Previous allocations Excel report exported successfully!");
    } catch (err) {
      console.error("Export error:", err);
      message.error(`Failed to export Excel report: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Table Columns (Read-only, NO delete buttons)
  const columns = [
    {
      title: "Allocation Date",
      dataIndex: "date",
      key: "date",
      width: 140,
      fixed: "left",
      render: (d) => (
        <span style={{ fontWeight: 800, color: "#0f172a" }}>
          {d}
        </span>
      ),
      sorter: (a, b) => (b.date || "").localeCompare(a.date || "")
    },
    {
      title: "Employee ID",
      dataIndex: "employee_id",
      key: "employee_id",
      width: 120,
      fixed: "left",
      render: (id, r) => (
        <Tag color="blue" style={{ fontWeight: 700, padding: "2px 8px" }}>
          {id || r.emp_id || "-"}
        </Tag>
      ),
      sorter: (a, b) => String(a.employee_id || "").localeCompare(String(b.employee_id || ""))
    },
    {
      title: "Employee Name",
      dataIndex: "employee_name",
      key: "employee_name",
      width: 190,
      fixed: "left",
      render: (name, r) => (
        <span style={{ fontWeight: 700, color: "#0f172a" }}>
          {name || r.name || "Staff"}
        </span>
      ),
      sorter: (a, b) => (a.employee_name || "").localeCompare(b.employee_name || "")
    },
    {
      title: "Company",
      dataIndex: "company",
      key: "company",
      width: 190,
      render: (c) => <Tag color="geekblue" style={{ fontWeight: 600 }}>{c || "Hayleys Eco Solutions"}</Tag>
    },
    {
      title: "Category",
      dataIndex: "category_name",
      key: "category_name",
      width: 140,
      render: (cat, r) => <Tag color="cyan" style={{ fontWeight: 600 }}>{cat || r.category_employment || "Staff"}</Tag>
    },
    {
      title: "Payment Plan",
      key: "pay_category",
      width: 130,
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
      render: (status, r) => {
        const isRecv = (status || "").toLowerCase() === "recieved" || (status || "").toLowerCase() === "received" || r.received === true;
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
      title: "Ordered Time (SL Time)",
      dataIndex: "created_at",
      key: "created_at",
      width: 170,
      render: (dt) => <span style={{ color: "#334155", fontSize: "0.85rem", fontWeight: 600 }}>{formatSriLankaDateTime(dt)}</span>
    },
    {
      title: "Dispensed Time (SL Time)",
      dataIndex: "received_at",
      key: "received_at",
      width: 170,
      render: (dt, r) => {
        const isRecv = (r.status || "").toLowerCase() === "recieved" || (r.status || "").toLowerCase() === "received" || r.received === true;
        if (!isRecv || !dt) return <span style={{ color: "#94a3b8" }}>-</span>;
        return <span style={{ color: "#059669", fontSize: "0.85rem", fontWeight: 700 }}>{formatSriLankaDateTime(dt)}</span>;
      }
    }
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", width: "100%" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
            Previous Day Allocations
          </Title>
          <Text type="secondary" style={{ fontSize: 14, color: "#475569" }}>
            Read-only historical allocations audit from archived records prior to today (<b>{todayStr}</b>).
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
              background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
              borderColor: "#059669",
              fontWeight: 700,
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(5, 150, 105, 0.3)",
              height: 40
            }}
          >
            Export Historical Excel (.xlsx)
          </Button>

          <Button icon={<ReloadOutlined />} onClick={loadAllocations} loading={loading} style={{ borderRadius: 8, height: 40 }}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Applied Filters Card (Replaces top statistic cards as requested) */}
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
          <Col xs={24} sm={12} md={6}>
            <Text strong style={{ display: "block", marginBottom: 4, fontSize: 12, color: "#0f172a" }}>
              Filter by Date Range (From - To):
            </Text>
            <RangePicker
              style={{ width: "100%" }}
              value={dateRange}
              onChange={setDateRange}
              placeholder={["From Date", "To Date"]}
            />
          </Col>

          <Col xs={24} sm={12} md={5}>
            <Text strong style={{ display: "block", marginBottom: 4, fontSize: 12, color: "#0f172a" }}>
              Search Employee / ID:
            </Text>
            <Input
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              placeholder="Search Name, ID, Company..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={12} sm={6} md={3}>
            <Text strong style={{ display: "block", marginBottom: 4, fontSize: 12, color: "#0f172a" }}>
              Company:
            </Text>
            <Select style={{ width: "100%" }} value={companyFilter} onChange={setCompanyFilter}>
              <Option value="ALL">All Companies</Option>
              {companies.map((c) => (
                <Option key={c.id || c.name} value={c.name}>
                  {c.name}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={12} sm={6} md={3}>
            <Text strong style={{ display: "block", marginBottom: 4, fontSize: 12, color: "#0f172a" }}>
              Meal Slot:
            </Text>
            <Select style={{ width: "100%" }} value={mealTypeFilter} onChange={setMealTypeFilter}>
              <Option value="ALL">All Slots</Option>
              <Option value="Breakfast">Breakfast</Option>
              <Option value="Lunch">Lunch</Option>
              <Option value="Dinner">Dinner</Option>
            </Select>
          </Col>

          <Col xs={12} sm={6} md={3}>
            <Text strong style={{ display: "block", marginBottom: 4, fontSize: 12, color: "#0f172a" }}>
              Status:
            </Text>
            <Select style={{ width: "100%" }} value={statusFilter} onChange={setStatusFilter}>
              <Option value="ALL">All Status</Option>
              <Option value="RECEIVED">Received</Option>
              <Option value="ORDERED">Ordered</Option>
            </Select>
          </Col>

          <Col xs={12} sm={6} md={2}>
            <Text strong style={{ display: "block", marginBottom: 4, fontSize: 12, color: "#0f172a" }}>
              Subsidy:
            </Text>
            <Select style={{ width: "100%" }} value={payCategoryFilter} onChange={setPayCategoryFilter}>
              <Option value="ALL">All</Option>
              <Option value="Full Paid">Full</Option>
              <Option value="Half Paid">Half</Option>
              <Option value="Not Paid">None</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={2} style={{ display: "flex", alignItems: "flex-end" }}>
            <Button
              onClick={() => {
                setDateRange(null);
                setSearchText("");
                setCompanyFilter("ALL");
                setMealTypeFilter("ALL");
                setStatusFilter("ALL");
                setPayCategoryFilter("ALL");
              }}
              style={{ width: "100%", borderRadius: 8, height: 32, marginTop: 18 }}
            >
              Reset
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Historical Allocations Table (Read-only) */}
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
          scroll={{ x: 1300 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "25", "50", "100"],
            showTotal: (total) => `Total ${total} Previous Day Allocations`
          }}
        />
      </Card>
    </div>
  );
}
