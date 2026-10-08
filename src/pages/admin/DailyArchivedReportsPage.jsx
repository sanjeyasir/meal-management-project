import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Tag,
  Space,
  Table,
  DatePicker,
  Input,
  Statistic,
  Modal,
  Drawer,
  Popconfirm,
  Progress,
  Divider,
  Tooltip,
  Alert,
  message
} from "antd";
import {
  FileExcelOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudUploadOutlined,
  SearchOutlined,
  CalendarOutlined,
  EyeOutlined,
  DeleteOutlined,
  SyncOutlined,
  SafetyCertificateOutlined,
  CoffeeOutlined,
  FireOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  getArchivedDailyReports,
  archiveDailyAllocationsForDate,
  downloadArchivedReport,
  deleteArchivedReport,
  getYesterdayDateKey
} from "../../services/firebase/archiveService";
import { getMealAllocations, formatDateKey } from "../../services/firebase/mealService";
import { formatSriLankaDateTime, formatSriLankaDate } from "../../utils/timeUtils";

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

export default function DailyArchivedReportsPage() {
  const [archivedReports, setArchivedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  // Filters State
  const [customRange, setCustomRange] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Custom Archive Modal
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [selectedCustomDate, setSelectedCustomDate] = useState(dayjs().subtract(1, "day"));

  // Details View Drawer
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailAllocations, setDetailAllocations] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const loadArchives = async () => {
    setLoading(true);
    try {
      const data = await getArchivedDailyReports();
      setArchivedReports(data);
    } catch (err) {
      console.error("Error loading archived reports:", err);
      message.error("Failed to load archived daily reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchives();
  }, []);

  // Archive Yesterday's Data
  const handleArchiveYesterday = async () => {
    const yesterday = getYesterdayDateKey();
    setArchiving(true);
    try {
      message.loading({ content: `Compiling and archiving previous day's allocations (${yesterday}) to Firebase Storage...`, key: "archiving" });
      await archiveDailyAllocationsForDate(yesterday, "Admin Console Archive");
      message.success({ content: `Daily allocations for ${yesterday} successfully archived to Firebase Storage & Firestore!`, key: "archiving" });
      await loadArchives();
    } catch (err) {
      console.error("Archive error:", err);
      message.error({ content: `Archive failed: ${err.message}`, key: "archiving" });
    } finally {
      setArchiving(false);
    }
  };

  // Archive Custom Date
  const handleArchiveCustomDate = async () => {
    if (!selectedCustomDate) {
      message.error("Please select a date to archive.");
      return;
    }
    const targetDateStr = selectedCustomDate.format("YYYY-MM-DD");
    setArchiving(true);
    try {
      message.loading({ content: `Archiving allocations for ${targetDateStr}...`, key: "custom_archiving" });
      await archiveDailyAllocationsForDate(targetDateStr, `Manual Archive (${targetDateStr})`);
      message.success({ content: `Daily report for ${targetDateStr} generated and stored in Firebase Storage!`, key: "custom_archiving" });
      setCustomModalOpen(false);
      await loadArchives();
    } catch (err) {
      console.error("Archive error:", err);
      message.error({ content: `Failed: ${err.message}`, key: "custom_archiving" });
    } finally {
      setArchiving(false);
    }
  };

  // Handle Download Excel
  const handleDownload = async (report) => {
    setDownloadingId(report.id);
    try {
      await downloadArchivedReport(report);
      message.success(`Downloaded ${report.filename || `Daily_Report_${report.date}.xlsx`}`);
    } catch (err) {
      message.error(`Download failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle Delete Archive
  const handleDelete = async (dateStr) => {
    try {
      await deleteArchivedReport(dateStr);
      message.success(`Archived record for ${dateStr} deleted.`);
      await loadArchives();
    } catch (err) {
      message.error(`Delete failed: ${err.message}`);
    }
  };

  // Open Details Drawer
  const handleOpenDetails = async (report) => {
    setSelectedReport(report);
    setDetailDrawerOpen(true);
    setLoadingDetails(true);
    try {
      const data = await getMealAllocations({ date: report.date });
      setDetailAllocations(data);
    } catch (err) {
      console.error("Error loading day details:", err);
      message.error("Failed to load day allocation details.");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Filtered Archive List
  const filteredArchives = useMemo(() => {
    return archivedReports.filter((item) => {
      // Date Range Filter
      if (customRange && customRange[0] && customRange[1]) {
        const startStr = customRange[0].format("YYYY-MM-DD");
        const endStr = customRange[1].format("YYYY-MM-DD");
        if (item.date < startStr || item.date > endStr) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const dateMatch = (item.date || "").toLowerCase().includes(q);
        const labelMatch = (item.display_label || "").toLowerCase().includes(q);
        const fileMatch = (item.filename || "").toLowerCase().includes(q);
        if (!dateMatch && !labelMatch && !fileMatch) return false;
      }

      return true;
    });
  }, [archivedReports, customRange, searchQuery]);

  // Total summary metrics across all archives
  const totalDaysArchived = archivedReports.length;
  const totalArchivedMeals = archivedReports.reduce((sum, r) => sum + (r.total_allocations || 0), 0);
  const totalArchivedDispensed = archivedReports.reduce((sum, r) => sum + (r.dispensed_count || 0), 0);
  const overallDispenseRate = totalArchivedMeals > 0 ? Math.round((totalArchivedDispensed / totalArchivedMeals) * 100) : 0;

  const yesterdayDate = getYesterdayDateKey();
  const isYesterdayArchived = archivedReports.some((r) => r.date === yesterdayDate);

  // Table Columns
  const columns = [
    {
      title: "Archive Date",
      dataIndex: "date",
      key: "date",
      width: 170,
      render: (d) => {
        const isYest = d === yesterdayDate;
        return (
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0f172a" }}>
              {d}
            </div>
            {isYest && (
              <Tag color="purple" style={{ marginTop: 2, fontWeight: 700, fontSize: 11 }}>
                ⭐ Yesterday
              </Tag>
            )}
          </div>
        );
      },
      sorter: (a, b) => a.date.localeCompare(b.date)
    },
    {
      title: "Total Allocations",
      key: "allocations_count",
      width: 160,
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 800, fontSize: "1rem", color: "#0f172a" }}>
            {r.total_allocations || 0} Portions
          </span>
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 2 }}>
            Dispensed: <b style={{ color: "#059669" }}>{r.dispensed_count || 0}</b> | Pending: <b style={{ color: "#2563eb" }}>{r.pending_count || 0}</b>
          </div>
        </div>
      )
    },
    {
      title: "Meal Slots",
      key: "meal_slots",
      width: 200,
      render: (_, r) => (
        <Space size="small" wrap>
          <Tag color="orange" style={{ fontWeight: 700 }}>
            ☕ {r.breakfast_count || 0} Breakfast
          </Tag>
          <Tag color="green" style={{ fontWeight: 700 }}>
            🍲 {r.lunch_count || 0} Lunch
          </Tag>
          <Tag color="purple" style={{ fontWeight: 700 }}>
            🍽️ {r.dinner_count || 0} Dinner
          </Tag>
        </Space>
      )
    },
    {
      title: "Payment / Subsidy Plan",
      key: "subsidies",
      width: 230,
      render: (_, r) => (
        <Space size="small" wrap>
          <Tag color="green" style={{ fontWeight: 700 }}>
            Full: {r.full_paid_count || 0}
          </Tag>
          <Tag color="gold" style={{ fontWeight: 700 }}>
            Half: {r.half_paid_count || 0}
          </Tag>
          <Tag color="red" style={{ fontWeight: 700 }}>
            Not Paid: {r.not_paid_count || 0}
          </Tag>
        </Space>
      )
    },
    {
      title: "Storage & Archive Time",
      key: "storage_status",
      width: 200,
      render: (_, r) => (
        <div>
          <Tag color={r.download_url ? "cyan" : "default"} icon={<CloudUploadOutlined />} style={{ fontWeight: 700, borderRadius: 6 }}>
            {r.download_url ? "Firebase Storage" : "Metadata Recorded"}
          </Tag>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
            {r.archived_at_formatted || formatSriLankaDateTime(r.archived_at)}
          </div>
        </div>
      )
    },
    {
      title: "Actions",
      key: "actions",
      width: 190,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Download formatted Excel (.xlsx) file">
            <Button
              type="primary"
              size="small"
              icon={<DownloadOutlined />}
              loading={downloadingId === record.id}
              onClick={() => handleDownload(record)}
              style={{
                fontWeight: 700,
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                borderColor: "#059669",
                borderRadius: 6
              }}
            >
              Excel
            </Button>
          </Tooltip>

          <Tooltip title="View allocation details for this date">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleOpenDetails(record)}
              style={{ borderRadius: 6, fontWeight: 600 }}
            >
              View
            </Button>
          </Tooltip>

          <Tooltip title="Re-archive this date to Firebase Storage">
            <Button
              size="small"
              icon={<SyncOutlined />}
              onClick={() => archiveDailyAllocationsForDate(record.date, "Manual Sync").then(() => { message.success("Re-archived successfully!"); loadArchives(); })}
              style={{ borderRadius: 6 }}
            />
          </Tooltip>

          <Popconfirm
            title="Delete Daily Archive"
            description={`Delete archived record and storage file for ${record.date}?`}
            onConfirm={() => handleDelete(record.date)}
            okText="Yes, Delete"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Button danger size="small" icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  // Drawer Table Columns
  const detailColumns = [
    {
      title: "Employee ID",
      dataIndex: "employee_id",
      key: "employee_id",
      width: 120,
      render: (id) => <Tag color="blue" style={{ fontWeight: 700, padding: "2px 8px" }}>{id}</Tag>
    },
    {
      title: "Full Name",
      dataIndex: "employee_name",
      key: "employee_name",
      render: (name) => <span style={{ fontWeight: 700, color: "#0f172a" }}>{name || "Staff"}</span>
    },
    {
      title: "Company",
      dataIndex: "company",
      key: "company",
      render: (comp) => <Tag color="geekblue" style={{ fontWeight: 600 }}>{comp || "Hayleys Eco Solutions"}</Tag>
    },
    {
      title: "Meal Category",
      dataIndex: "category_name",
      key: "category_name",
      render: (cat, r) => <Tag color="cyan">{cat || r.category_employment || "Staff"}</Tag>
    },
    {
      title: "Payment Plan",
      dataIndex: "pay_category",
      key: "pay_category",
      render: (p) => {
        const color = (p || "").toLowerCase().includes("half") ? "orange" : (p || "").toLowerCase().includes("not") ? "red" : "green";
        return <Tag color={color} style={{ fontWeight: 700 }}>{p || "Full Paid"}</Tag>;
      }
    },
    {
      title: "Meal Slot",
      dataIndex: "meal_type",
      key: "meal_type",
      width: 120,
      render: (m) => <Tag color={m === "Breakfast" ? "orange" : m === "Lunch" ? "green" : "purple"} style={{ fontWeight: 700 }}>{m}</Tag>
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s) => {
        const isRecv = (s || "").toLowerCase() === "recieved" || (s || "").toLowerCase() === "received";
        return <Tag color={isRecv ? "success" : "processing"} style={{ fontWeight: 700 }}>{isRecv ? "Received" : "Ordered"}</Tag>;
      }
    },
    {
      title: "Dispensed (SL Time)",
      dataIndex: "received_at",
      key: "received_at",
      render: (t) => formatSriLankaDateTime(t)
    }
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
            Daily Archived Reports (Firestorage Archive)
          </Title>
          <Text type="secondary" style={{ fontSize: 14, color: "#475569" }}>
            Automated midnight archives of previous day allocations stored in Firebase Cloud Storage.
          </Text>
        </div>

        <Space size="middle" wrap>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={handleArchiveYesterday}
            loading={archiving}
            style={{
              fontWeight: 700,
              background: "linear-gradient(135deg, #059669 0%, #064e3b 100%)",
              borderColor: "#059669",
              borderRadius: 8,
              boxShadow: "0 4px 12px -2px rgba(5, 150, 105, 0.4)",
              height: 40
            }}
          >
            Archive Yesterday's Data ({yesterdayDate})
          </Button>

          <Button
            icon={<CalendarOutlined />}
            onClick={() => setCustomModalOpen(true)}
            style={{ borderRadius: 8, fontWeight: 600, height: 40 }}
          >
            Archive Custom Date...
          </Button>

          <Button
            icon={<ReloadOutlined />}
            onClick={loadArchives}
            loading={loading}
            style={{ borderRadius: 8, height: 40 }}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* Info Status Banner */}
      {!isYesterdayArchived && (
        <Alert
          type="warning"
          showIcon
          message={<span>Yesterday's allocations (<b>{yesterdayDate}</b>) have not been archived yet.</span>}
          description="Click 'Archive Yesterday's Data' above to generate the formatted Excel file and store it in Firebase Storage."
          style={{ marginBottom: 20, borderRadius: 12 }}
          action={
            <Button size="small" type="primary" onClick={handleArchiveYesterday} loading={archiving}>
              Archive Now
            </Button>
          }
        />
      )}

      {/* Metric Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6} lg={6}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#64748b" }}>Total Archived Days</span>}
              value={totalDaysArchived}
              prefix={<CalendarOutlined style={{ color: "#2563eb", marginRight: 6 }} />}
              valueStyle={{ fontWeight: 800, color: "#0f172a" }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={6}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#059669" }}>Total Archived Meals</span>}
              value={totalArchivedMeals}
              prefix={<FileExcelOutlined style={{ color: "#059669", marginRight: 6 }} />}
              valueStyle={{ fontWeight: 800, color: "#065f46" }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={6}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#64748b" }}>Dispensed Portions</span>}
              value={totalArchivedDispensed}
              prefix={<CheckCircleOutlined style={{ color: "#10b981", marginRight: 6 }} />}
              valueStyle={{ fontWeight: 800, color: "#047857" }}
              suffix={<span style={{ fontSize: 13, color: "#10b981", fontWeight: 700 }}>({overallDispenseRate}%)</span>}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={6}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: "#64748b" }}>Automated Schedule</span>}
              value="12:00 AM Daily"
              prefix={<ClockCircleOutlined style={{ color: "#7c3aed", marginRight: 6 }} />}
              valueStyle={{ fontWeight: 800, color: "#4c1d95", fontSize: "1.1rem" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Search & Filter Bar with From-To Range Picker */}
      <Card
        bordered={false}
        style={{
          borderRadius: 14,
          marginBottom: 20,
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
        }}
        bodyStyle={{ padding: "16px 20px" }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
              Filter by Date Range (From - To):
            </Text>
            <RangePicker
              style={{ width: "100%" }}
              value={customRange}
              onChange={setCustomRange}
              placeholder={["From Date", "To Date"]}
            />
          </Col>

          <Col xs={24} sm={12} md={10}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
              Search Archive:
            </Text>
            <Input
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              placeholder="Search by Date (YYYY-MM-DD) or Filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={24} sm={12} md={6} style={{ display: "flex", alignItems: "flex-end" }}>
            <Button
              onClick={() => {
                setCustomRange(null);
                setSearchQuery("");
              }}
              style={{ width: "100%", borderRadius: 8, height: 38, marginTop: 22 }}
            >
              Reset Filters
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Archives Master Table */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)"
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={filteredArchives}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (total) => `Total ${total} Daily Archives`
          }}
        />
      </Card>

      {/* Modal for Archiving Custom Date */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CalendarOutlined style={{ color: "#059669" }} />
            <span style={{ fontWeight: 800, color: "#0f172a" }}>Archive Allocations for Specific Date</span>
          </div>
        }
        open={customModalOpen}
        onOk={handleArchiveCustomDate}
        onCancel={() => setCustomModalOpen(false)}
        okText="Archive & Upload to Storage"
        confirmLoading={archiving}
        destroyOnClose
      >
        <div style={{ marginTop: 16 }}>
          <Paragraph type="secondary" style={{ color: "#475569" }}>
            Select any date to compile previous allocations, create the formatted Excel sheet, and upload to Firebase Storage:
          </Paragraph>
          <div style={{ fontWeight: 600, marginBottom: 8, color: "#0f172a" }}>Target Date:</div>
          <DatePicker
            value={selectedCustomDate}
            onChange={(d) => setSelectedCustomDate(d)}
            style={{ width: "100%", height: 42, borderRadius: 8 }}
          />
        </div>
      </Modal>

      {/* Drawer for Viewing Detailed Allocations for an Archive */}
      <Drawer
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileExcelOutlined style={{ color: "#059669", fontSize: 20 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a" }}>
                Archive Details: {selectedReport?.date}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                Total {detailAllocations.length} Allocations Recorded
              </div>
            </div>
          </div>
        }
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={typeof window !== "undefined" && window.innerWidth < 768 ? "100%" : 850}
        extra={
          selectedReport && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(selectedReport)}
              style={{ background: "#059669", fontWeight: 700, borderRadius: 6 }}
            >
              Download Excel
            </Button>
          )
        }
      >
        {selectedReport && (
          <div>
            {/* Quick Metrics Summary */}
            <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
              <Col xs={24} sm={8}>
                <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Total Allocations</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{selectedReport.total_allocations}</div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ padding: "10px 14px", background: "#ecfdf5", borderRadius: 10, border: "1px solid #a7f3d0" }}>
                  <div style={{ fontSize: 12, color: "#059669" }}>Dispensed (Received)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#065f46" }}>{selectedReport.dispensed_count}</div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ padding: "10px 14px", background: "#eff6ff", borderRadius: 10, border: "1px solid #bfdbfe" }}>
                  <div style={{ fontSize: 12, color: "#2563eb" }}>Pending</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1e40af" }}>{selectedReport.pending_count}</div>
                </div>
              </Col>
            </Row>

            <Table
              dataSource={detailAllocations}
              columns={detailColumns}
              rowKey="id"
              loading={loadingDetails}
              pagination={{ pageSize: 10 }}
              size="small"
              scroll={{ x: 800 }}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
