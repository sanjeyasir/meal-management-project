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
  Input,
  Statistic,
  message,
  Divider,
  Tooltip,
  Popconfirm
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
  DeleteOutlined,
  FireOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  getMealAllocations,
  deleteMealAllocation,
  formatDateKey
} from "../../services/firebase/mealService";
import { getCompanies } from "../../services/firebase/companyService";
import { getCategories, normalizePaymentType } from "../../services/firebase/categoryService";
import { generateFormattedMealReport } from "../../utils/excelReportGenerator";
import { formatSriLankaDateTime } from "../../utils/timeUtils";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function ReportsPage() {
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Filters State for Today
  const [selectedCompany, setSelectedCompany] = useState("ALL");
  const [selectedMealType, setSelectedMealType] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedPayCategory, setSelectedPayCategory] = useState("ALL");
  const [searchText, setSearchText] = useState("");

  const todayStr = formatDateKey(new Date());

  const loadData = async () => {
    setLoading(true);
    try {
      const [todayAlloc, allComps, allCats] = await Promise.all([
        getMealAllocations({ date: todayStr }),
        getCompanies(),
        getCategories()
      ]);
      setAllocations(todayAlloc);
      setCompanies(allComps);
      setCategories(allCats);
    } catch (err) {
      console.error("Error loading today's allocations:", err);
      message.error("Failed to load today's allocations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Category to Subsidy Lookup Map
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

  // Handle Delete Allocation for Today
  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const res = await deleteMealAllocation(id, true);
      if (res.success) {
        message.success("Today's allocation deleted successfully.");
        await loadData();
      } else {
        message.error(res.message || "Failed to delete allocation.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      message.error(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Filter allocations
  const filteredAllocations = useMemo(() => {
    return allocations.filter((item) => {
      // 1. Company filter
      if (selectedCompany !== "ALL") {
        if ((item.company || "").toLowerCase() !== selectedCompany.toLowerCase()) return false;
      }

      // 2. Meal Type filter
      if (selectedMealType !== "ALL") {
        if ((item.meal_type || "").toLowerCase() !== selectedMealType.toLowerCase()) return false;
      }

      // 3. Status filter
      if (selectedStatus !== "ALL") {
        const isRecv = (item.status || "").toLowerCase() === "recieved" || (item.status || "").toLowerCase() === "received" || item.received === true;
        if (selectedStatus === "RECEIVED" && !isRecv) return false;
        if (selectedStatus === "ORDERED" && isRecv) return false;
      }

      // 4. Subsidy / Payment Plan filter
      const normPay = getAutoSubsidy(item);
      if (selectedPayCategory !== "ALL") {
        if (normPay.toLowerCase() !== selectedPayCategory.toLowerCase()) return false;
      }

      // 5. Text Search
      if (searchText.trim()) {
        const s = searchText.toLowerCase();
        const name = (item.employee_name || item.name || "").toLowerCase();
        const id = (item.employee_id || item.emp_id || "").toLowerCase();
        const comp = (item.company || "").toLowerCase();
        const cat = (item.category_name || item.category_employment || "").toLowerCase();
        if (!name.includes(s) && !id.includes(s) && !comp.includes(s) && !cat.includes(s)) return false;
      }

      return true;
    });
  }, [allocations, selectedCompany, selectedMealType, selectedStatus, selectedPayCategory, searchText, categoryMap]);

  // Aggregate Metrics for today's filtered data
  const totalCount = filteredAllocations.length;
  const receivedCount = filteredAllocations.filter(
    (a) => (a.status || "").toLowerCase() === "recieved" || (a.status || "").toLowerCase() === "received" || a.received === true
  ).length;
  const pendingCount = totalCount - receivedCount;
  const dispenseRate = totalCount > 0 ? Math.round((receivedCount / totalCount) * 100) : 0;

  const fullPaidCount = filteredAllocations.filter((a) => getAutoSubsidy(a) === "Full Paid").length;
  const halfPaidCount = filteredAllocations.filter((a) => getAutoSubsidy(a) === "Half Paid").length;
  const notPaidCount = filteredAllocations.filter((a) => getAutoSubsidy(a) === "Not Paid").length;

  // Handle Excel Export (Today's Allocations)
  const handleExportExcel = async () => {
    if (filteredAllocations.length === 0) {
      message.warning("No records to export in current filter for today!");
      return;
    }

    setExporting(true);
    try {
      await generateFormattedMealReport({
        allocations: filteredAllocations,
        title: `HAYLEYS ECO SOLUTIONS - TODAY'S MEAL ALLOCATIONS REPORT (${todayStr})`,
        dateRangeStr: `Today (${todayStr})`,
        generatedBy: "System Administrator",
        categoryMap
      });

      message.success(`Today's formatted Excel report (${todayStr}) generated and downloaded successfully!`);
    } catch (err) {
      console.error("Export error:", err);
      message.error(`Failed to export Excel report: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Table Columns with Ordered Time, Received Time, and Delete Feature
  const columns = [
    {
      title: "Employee ID",
      dataIndex: "employee_id",
      key: "employee_id",
      width: 120,
      fixed: "left",
      render: (text, r) => (
        <Tag color="blue" style={{ fontWeight: 700, padding: "2px 8px" }}>
          {text || r.emp_id || "-"}
        </Tag>
      )
    },
    {
      title: "Full Name",
      dataIndex: "employee_name",
      key: "employee_name",
      width: 190,
      fixed: "left",
      render: (text, r) => <span style={{ fontWeight: 700, color: "#0f172a" }}>{text || r.name || "Staff"}</span>
    },
    {
      title: "Company",
      dataIndex: "company",
      key: "company",
      width: 190,
      render: (text) => <Tag color="geekblue" style={{ fontWeight: 600 }}>{text || "Hayleys Eco Solutions"}</Tag>
    },
    {
      title: "Meal Category",
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
      title: "Received Time (SL Time)",
      dataIndex: "received_at",
      key: "received_at",
      width: 170,
      render: (dt, r) => {
        const isRecv = (r.status || "").toLowerCase() === "recieved" || (r.status || "").toLowerCase() === "received" || r.received === true;
        if (!isRecv || !dt) return <span style={{ color: "#94a3b8" }}>-</span>;
        return <span style={{ color: "#059669", fontSize: "0.85rem", fontWeight: 700 }}>{formatSriLankaDateTime(dt)}</span>;
      }
    },
    {
      title: "Action",
      key: "action",
      width: 110,
      fixed: "right",
      render: (_, record) => (
        <Popconfirm
          title="Delete Today's Allocation"
          description={`Are you sure you want to delete ${record.employee_name || "this employee"}'s ${record.meal_type || "meal"} allocation for today?`}
          onConfirm={() => handleDelete(record.id)}
          okText="Yes, Delete"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Tooltip title="Delete allocation from today's orders">
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              loading={deletingId === record.id}
              style={{ borderRadius: 6, fontWeight: 600 }}
            >
              Delete
            </Button>
          </Tooltip>
        </Popconfirm>
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", width: "100%" }}>
      {/* Top Banner & Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
            Today's Allocations & Formatted Excel Reports
          </Title>
          <Text type="secondary" style={{ fontSize: 14, color: "#475569" }}>
            Active orders and dispenses for Today (<b>{todayStr}</b>) with ordered time, received time, Excel export, and delete management.
          </Text>
        </div>

        <Space size="middle" wrap>
          <Button
            type="default"
            icon={<CloudUploadOutlined style={{ color: "#059669" }} />}
            onClick={() => navigate("/admin/daily-archive")}
            style={{ fontWeight: 700, borderColor: "#059669", color: "#059669", borderRadius: 8, height: 40 }}
          >
            Daily Archived Reports
          </Button>

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
            Export Today's Formatted Excel (.xlsx)
          </Button>

          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} style={{ borderRadius: 8, height: 40 }}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* KPI Stats Row for Today */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6} lg={6}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#64748b" }}>Today's Total Orders</span>}
              value={totalCount}
              prefix={<CoffeeOutlined style={{ color: "#2563eb", marginRight: 6 }} />}
              valueStyle={{ fontWeight: 800, color: "#0f172a" }}
              suffix={<span style={{ fontSize: 13, color: "#64748b" }}>Portions</span>}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={6}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#059669" }}>Dispensed / Received</span>}
              value={receivedCount}
              prefix={<CheckCircleOutlined style={{ color: "#059669", marginRight: 6 }} />}
              valueStyle={{ fontWeight: 800, color: "#065f46" }}
              suffix={<span style={{ fontSize: 13, color: "#059669", fontWeight: 700 }}>({dispenseRate}%)</span>}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={6}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#2563eb" }}>Pending Orders</span>}
              value={pendingCount}
              prefix={<ClockCircleOutlined style={{ color: "#2563eb", marginRight: 6 }} />}
              valueStyle={{ fontWeight: 800, color: "#1e40af" }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={6}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>
              Payment Breakdown
            </div>
            <Space size="small" wrap>
              <Tag color="green" style={{ fontWeight: 700 }}>Full: {fullPaidCount}</Tag>
              <Tag color="gold" style={{ fontWeight: 700 }}>Half: {halfPaidCount}</Tag>
              <Tag color="red" style={{ fontWeight: 700 }}>None: {notPaidCount}</Tag>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Today's Filters Card */}
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
              Search Today:
            </Text>
            <Input
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              placeholder="Search Name, ID, Company..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Text strong style={{ display: "block", marginBottom: 4, fontSize: 12, color: "#0f172a" }}>
              Company:
            </Text>
            <Select style={{ width: "100%" }} value={selectedCompany} onChange={setSelectedCompany}>
              <Option value="ALL">All Companies</Option>
              {companies.map((c) => (
                <Option key={c.id || c.name} value={c.name}>
                  {c.name}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Text strong style={{ display: "block", marginBottom: 4, fontSize: 12, color: "#0f172a" }}>
              Meal Slot:
            </Text>
            <Select style={{ width: "100%" }} value={selectedMealType} onChange={setSelectedMealType}>
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
            <Select style={{ width: "100%" }} value={selectedStatus} onChange={setSelectedStatus}>
              <Option value="ALL">All Status</Option>
              <Option value="RECEIVED">Received</Option>
              <Option value="ORDERED">Ordered</Option>
            </Select>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Text strong style={{ display: "block", marginBottom: 4, fontSize: 12, color: "#0f172a" }}>
              Subsidy Plan:
            </Text>
            <Select style={{ width: "100%" }} value={selectedPayCategory} onChange={setSelectedPayCategory}>
              <Option value="ALL">All Plans</Option>
              <Option value="Full Paid">Full Paid</Option>
              <Option value="Half Paid">Half Paid</Option>
              <Option value="Not Paid">Not Paid</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={3} style={{ display: "flex", alignItems: "flex-end" }}>
            <Button
              onClick={() => {
                setSelectedCompany("ALL");
                setSelectedMealType("ALL");
                setSelectedStatus("ALL");
                setSelectedPayCategory("ALL");
                setSearchText("");
              }}
              style={{ width: "100%", borderRadius: 8, height: 32, marginTop: 18 }}
            >
              Reset
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Today's Allocations Table */}
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
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "25", "50", "100"],
            showTotal: (total) => `Total ${total} Today's Allocations (${todayStr})`
          }}
        />
      </Card>
    </div>
  );
}
